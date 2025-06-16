import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { User as SelectUser, Passenger as SelectPassenger } from "@shared/schema";

// Adicionar propriedade userType a todos os tipos de usuário
declare global {
  namespace Express {
    // Uma interface mais flexível para trabalhar com qualquer tipo de usuário
    interface User extends Record<string, any> {
      id: number;
      email: string;
      password: string;
      userType?: string;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  // Se a senha armazenada começar com $2b$, é bcrypt
  if (stored.startsWith('$2b$')) {
    return await bcrypt.compare(supplied, stored);
  }
  
  // Senão, usar o método antigo com scrypt
  const [hashed, salt] = stored.split(".");
  if (!salt) {
    return false;
  }
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "serv-motors-session-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Strategy for driver authentication
  passport.use('driver-local',
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        const user = await storage.getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, { ...user, userType: 'driver' });
        }
      }
    )
  );
  
  // Strategy for passenger authentication
  passport.use('passenger-local',
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        const passenger = await storage.getPassengerByEmail(email);
        if (!passenger || !(await comparePasswords(password, passenger.password))) {
          return done(null, false);
        } else {
          // Update last login timestamp
          await storage.updatePassengerLastLogin(passenger.id);
          // Convert Passenger to User (compatible with type system)
          const userLikePassenger = {
            ...passenger,
            userType: 'passenger',
            // Adaptar os campos necessários para compatibilidade
            firstName: passenger.fullName.split(' ')[0],
            lastName: passenger.fullName.split(' ').slice(1).join(' '),
            type: 'passenger',  // Adiciona o campo type para compatibilidade
            approved: true      // Adiciona o campo approved para compatibilidade
          };
          
          return done(null, userLikePassenger);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, { id: user.id, userType: user.userType });
  });
  
  passport.deserializeUser(async (data: { id: number, userType: string }, done) => {
    try {
      if (data.userType === 'superadmin') {
        // Lidar com super admin especial
        const superAdminUser = {
          id: 999999,
          email: "superadmin@servmotors.com",
          userType: "superadmin",
          type: "superadmin",
          fullName: "Super Administrador",
          isActive: true,
          password: "" // Não expor password
        };
        done(null, superAdminUser);
      } else if (data.userType === 'passenger') {
        const passenger = await storage.getPassenger(data.id);
        
        if (passenger) {
          // Converter para o formato compatível com User
          const userLikePassenger = {
            ...passenger,
            userType: 'passenger',
            // Adaptar os campos necessários
            firstName: passenger.fullName.split(' ')[0],
            lastName: passenger.fullName.split(' ').slice(1).join(' '),
            type: 'passenger',  // Adiciona o campo type
            approved: true      // Adiciona o campo approved
          };
          
          done(null, userLikePassenger);
        } else {
          done(null, null);
        }
      } else {
        const user = await storage.getUser(data.id);
        if (user) {
          // Adicionar o userType ao objeto do usuário e verificar se é admin
          const userWithType = {
            ...user,
            userType: user.type === 'admin' ? 'admin' : (user.type || data.userType || 'driver')
          };
          done(null, userWithType);
        } else {
          done(null, null);
        }
      }
    } catch (err) {
      done(err, null);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registration data received:", Object.keys(req.body));
      
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      
      // Replace the plaintext password with the hashed one
      const userData = {
        ...req.body,
        password: hashedPassword,
        // Set default balance for new users
        balance: 0
      };

      // Convert image files from base64 to file paths if they're not already paths
      // This is a temporary solution until we implement proper file upload handling
      // In a production environment, we would use multer middleware for this
      
      const user = await storage.createUser(userData);
      
      // Strip password from response
      const { password, ...userWithoutPassword } = user;

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    // Check if the login attempt includes userType
    const userType = req.body.userType || 'driver'; // Default to driver if not specified
    
    // Choose the authentication strategy based on user type
    const strategy = userType === 'passenger' ? 'passenger-local' : 'driver-local';
    
    passport.authenticate(strategy, (err: Error | null, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Credenciais inválidas" });
      
      // Verificar se o usuário é admin pelo campo 'type'
      if (user.type === 'admin') {
        user.userType = 'admin'; // Definir explicitamente userType como 'admin'
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Strip password from response
        const { password, ...userWithoutPassword } = user;
        
        // Log para depuração
        console.log(`Usuário autenticado: ${user.email} | tipo: ${user.userType || user.type || 'driver'}`);
        
        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    try {
      // Buscar dados atualizados do banco de dados
      const currentUser = req.user as any;
      let userData;
      
      // Primeiro tentar buscar como motorista (drivers table)
      userData = await storage.getUser(currentUser.id);
      
      // Se não encontrou como motorista, tentar como passageiro
      if (!userData && currentUser.userType === 'passenger') {
        userData = await storage.getPassenger(currentUser.id);
      }
      
      if (!userData) {
        console.log("Usuário não encontrado - ID:", currentUser.id, "Type:", currentUser.userType || currentUser.type);
        return res.status(404).json({ message: "User not found" });
      }
      
      // Strip password from response
      const { password, ...userWithoutPassword } = userData;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });
}
