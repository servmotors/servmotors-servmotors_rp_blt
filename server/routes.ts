import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { db } from "./db";
import { eq, desc, sql, and, or, isNotNull } from "drizzle-orm";
import notificationRouter from "./notification-routes";
import { RouteService } from "./route-service";
import { 
  insertVehicleSchema, 
  insertWithdrawalSchema, 
  emergencyContactSchema, 
  emergencyContactsSchema, 
  insertPassengerSchema, 
  passengerRegistrationSchema, 
  insertWalletTransactionSchema,
  insertPricingTableSchema,
  insertConfigurationExportSchema,
  passengers, 
  rideRequests,
  walletTransactions,
  transportTypes,
  vehicleCategories,
  pricingTables,
  configurationExports,
  partnerSettings,
  partners,
  vehicleBlockHistory,
  insertPartnerSchema,
  users,
  vehicles,
  collectionPoints,
  featureToggles,
  driverPreferences,
  rideChats,
  rides,
  carbonFootprint,
  vehicleEmissions,
  ecoSettings,
  ecoRoutes,
  Passenger, 
  User, 
  WalletTransaction,
  TransportType,
  VehicleCategory,
  PricingTable,
  ConfigurationExport
} from "@shared/schema";
import { AsaasService } from './asaas';
import { AddressService } from './address-service';

// Set up multer for file uploads
const uploadDirectory = path.join(process.cwd(), "uploads");

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDirectory);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage: storage2,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Authentication middleware
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
};

let realTimeServer: any = null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);

  // Endpoints de validação de endereço
  // Endpoint para validação de CEP
  app.get('/api/address/validate-cep/:cep', async (req, res) => {
    try {
      const { cep } = req.params;
      const result = await AddressService.validateCEP(cep);
      res.json(result);
    } catch (error) {
      console.error('Erro ao validar CEP:', error);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Endpoint para geocodificação de endereço
  app.get('/api/address/geocode', async (req, res) => {
    try {
      const { address } = req.query;
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ success: false, error: 'Endereço não fornecido' });
      }
      const result = await AddressService.geocodeAddress(address);
      res.json(result);
    } catch (error) {
      console.error('Erro na geocodificação:', error);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Endpoint para geocodificação reversa
  app.get('/api/address/reverse-geocode', async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng || typeof lat !== 'string' || typeof lng !== 'string') {
        return res.status(400).json({ success: false, error: 'Coordenadas inválidas' });
      }
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ success: false, error: 'Coordenadas inválidas' });
      }
      
      const result = await AddressService.reverseGeocode(latitude, longitude);
      res.json(result);
    } catch (error) {
      console.error('Erro na geocodificação reversa:', error);
      res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  });

  // Set up notification routes
  app.use("/api/notifications", notificationRouter);
  
  // Admin routes
  // Rota para obter todos os motoristas
  // Função auxiliar para verificar se um usuário é administrador
  const isAdmin = (req: Request): boolean => {
    return Boolean(req.isAuthenticated() && 
      (req.user?.userType === 'admin' || req.user?.type === 'admin' || 
       req.user?.userType === 'superadmin' || req.user?.type === 'superadmin'));
  };
  
  // Middleware para verificar se o usuário é administrador
  const checkAdmin = (req: Request, res: Response, next: Function) => {
    if (isAdmin(req)) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Rota para obter todos os motoristas
  app.get("/api/admin/drivers", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      // Busca todos os motoristas
      const drivers = await storage.getAllUsers();
      
      // Busca informações adicionais para cada motorista (apenas veículos por enquanto)
      const enhancedDrivers = await Promise.all(drivers.map(async (driver) => {
        let vehicleCount = 0;

        try {
          // Contar veículos do motorista
          const vehicles = await storage.getVehiclesByUserId(driver.id);
          vehicleCount = vehicles.length;
        } catch (e) {
          console.error(`Erro ao obter veículos do motorista ${driver.id}:`, e);
        }
        
        // Retornar motorista com dados completos
        return {
          id: driver.id,
          firstName: driver.firstName || '',
          lastName: driver.lastName || '',
          email: driver.email,
          phone: driver.phoneNumber || '',
          cpf: driver.cpf || '',
          birthDate: driver.birthDate || '',
          address: driver.street ? `${driver.street}, ${driver.number || ''}, ${driver.neighborhood || ''}, ${driver.city || ''} - ${driver.state || ''}` : '',
          // Dados do CPF
          cpfFront: driver.cpfFront || '',
          cpfBack: driver.cpfBack || '',
          // Dados da CNH
          cnhNumber: driver.cnhNumber || '',
          cnhCategory: driver.cnhCategory || '',
          cnhExpiration: driver.cnhExpiration || driver.cnhExpiry || '',
          cnhFront: driver.cnhFront || '',
          cnhBack: driver.cnhBack || '',
          cnhDocumentUrl: driver.cnhDocumentUrl || '',
          cnhBlockDate: driver.cnhBlockDate || '',
          // Dados de endereço detalhados
          cep: driver.cep || '',
          street: driver.street || '',
          number: driver.number || '',
          complement: driver.complement || '',
          neighborhood: driver.neighborhood || '',
          city: driver.city || '',
          state: driver.state || '',
          // Outros dados
          vehicleCount,
          rideCount: 0, // Ainda não está implementado
          rating: 0, // Ainda não está implementado
          type: driver.type,
          userType: driver.type,
          approved: driver.approved || false,
          // Usar o status real do banco de dados
          status: driver.status || (driver.approved ? 'active' : 'pending')
        };
      }));
      
      res.json(enhancedDrivers);
    } catch (error) {
      console.error("Erro ao obter motoristas:", error);
      res.status(500).json({ 
        message: "Erro ao obter dados dos motoristas",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para atualizar informações específicas do motorista (CPF, CNH)
  app.patch("/api/admin/drivers/:id/info", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { cpf, cnhNumber, cnhCategory } = req.body;

      // Validar se pelo menos um campo foi fornecido
      if (!cpf && !cnhNumber && !cnhCategory) {
        return res.status(400).json({ message: "Pelo menos um campo deve ser fornecido" });
      }

      // Preparar dados para atualização
      const updateData: any = {};
      if (cpf) updateData.cpf = cpf;
      if (cnhNumber) updateData.cnhNumber = cnhNumber;
      if (cnhCategory) updateData.cnhCategory = cnhCategory;

      // Atualizar no banco de dados
      await db.update(users)
        .set(updateData)
        .where(eq(users.id, parseInt(id)));

      res.json({ message: "Informações atualizadas com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar informações do motorista:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Rota para atualizar um motorista
  app.patch("/api/admin/drivers/:id", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      if (isNaN(driverId)) {
        return res.status(400).json({ message: "ID de motorista inválido" });
      }
      
      // Preservar todas as configurações existentes do motorista
      const updateData = { ...req.body };
      
      // Se o status foi enviado, manter tanto o status quanto o approved sincronizados
      if (updateData.status) {
        // Converter status para approved mantendo ambos os campos
        updateData.approved = updateData.status === 'active';
        // MANTER o campo status no banco para preservar configurações
      }
      
      // Atualizar os dados do motorista preservando todas as configurações
      const updatedDriver = await storage.updateUser(driverId, updateData);
      
      if (!updatedDriver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }
      
      // Retornar o motorista com o status formatado corretamente
      const formattedDriver = {
        ...updatedDriver,
        status: updatedDriver.approved ? 'active' : 'pending'
      };
      
      res.json(formattedDriver);
    } catch (error) {
      console.error("Erro ao atualizar motorista:", error);
      res.status(500).json({ 
        message: "Erro ao atualizar dados do motorista",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para excluir um motorista
  app.delete("/api/admin/drivers/:id", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      if (isNaN(driverId)) {
        return res.status(400).json({ message: "ID de motorista inválido" });
      }
      
      // Verificar se o motorista existe
      const driver = await storage.getUser(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }
      
      // Excluir o motorista
      await storage.deleteUser(driverId);
      
      res.json({ message: "Motorista excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir motorista:", error);
      res.status(500).json({ 
        message: "Erro ao excluir motorista",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para obter veículos de um motorista específico
  app.get("/api/admin/drivers/:id/vehicles", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      if (isNaN(driverId)) {
        return res.status(400).json({ message: "ID de motorista inválido" });
      }
      
      // Buscar veículos do motorista
      const vehicles = await storage.getVehiclesByUserId(driverId);
      
      res.json(vehicles);
    } catch (error) {
      console.error("Erro ao obter veículos do motorista:", error);
      res.status(500).json({ 
        message: "Erro ao obter veículos do motorista",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para atualizar status de um veículo
  app.patch("/api/admin/vehicles/:id/status", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      if (isNaN(vehicleId)) {
        return res.status(400).json({ message: "ID de veículo inválido" });
      }
      
      const { status } = req.body;
      
      if (!status || !['approved', 'rejected', 'blocked', 'unblocked', 'pending'].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      
      // Atualizar status do veículo
      const updatedVehicle = await storage.updateVehicleStatus(vehicleId, status);
      
      if (!updatedVehicle) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }
      
      res.json(updatedVehicle);
    } catch (error) {
      console.error("Erro ao atualizar status do veículo:", error);
      res.status(500).json({ 
        message: "Erro ao atualizar status do veículo",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para obter todos os passageiros
  app.get("/api/admin/passengers", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      // Busca todos os passageiros
      const allPassengers = await storage.getAllPassengers();
      
      // Formata os dados dos passageiros para a resposta
      const formattedPassengers = allPassengers.map(passenger => {
        return {
          id: passenger.id,
          fullName: passenger.fullName,
          email: passenger.email,
          phoneNumber: passenger.phoneNumber,
          cpf: passenger.cpf,
          cep: passenger.cep,
          street: passenger.street,
          number: passenger.number,
          neighborhood: passenger.neighborhood,
          city: passenger.city,
          state: passenger.state,
          createdAt: passenger.createdAt,
          lastLogin: passenger.lastLogin,
          balance: passenger.balance,
          status: "active", // Passageiros não têm status no banco, então usamos 'active' como padrão
          rideCount: 0 // Temporariamente definido como 0
        };
      });
      
      res.json(formattedPassengers);
    } catch (error) {
      console.error("Erro ao obter passageiros:", error);
      res.status(500).json({ 
        message: "Erro ao obter dados dos passageiros",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para atualizar um passageiro
  app.patch("/api/admin/passengers/:id", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      const passengerId = parseInt(req.params.id);
      if (isNaN(passengerId)) {
        return res.status(400).json({ message: "ID de passageiro inválido" });
      }
      
      // Como não há campo status no banco, removemos esse campo das atualizações
      const updateData = { ...req.body };
      if (updateData.status) {
        delete updateData.status;
      }
      
      // Atualizar os dados do passageiro
      const updatedPassenger = await storage.updatePassenger(passengerId, updateData);
      
      if (!updatedPassenger) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }
      
      res.json({
        ...updatedPassenger,
        status: "active" // Sempre retornamos "active" para manter consistência com a UI
      });
    } catch (error) {
      console.error("Erro ao atualizar passageiro:", error);
      res.status(500).json({ 
        message: "Erro ao atualizar dados do passageiro",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para excluir um passageiro
  app.delete("/api/admin/passengers/:id", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      const passengerId = parseInt(req.params.id);
      if (isNaN(passengerId)) {
        return res.status(400).json({ message: "ID de passageiro inválido" });
      }
      
      // Verificar se o passageiro existe
      const passenger = await storage.getPassenger(passengerId);
      if (!passenger) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }
      
      // Excluir o passageiro
      await storage.deletePassenger(passengerId);
      
      res.json({ message: "Passageiro excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir passageiro:", error);
      res.status(500).json({ 
        message: "Erro ao excluir passageiro",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API Placas integration route
  app.get("/api/placas/:plateNumber", async (req, res) => {
    try {
      const { plateNumber } = req.params;
      if (!plateNumber || plateNumber.length < 7) {
        return res.status(400).json({ message: "Placa inválida. Mínimo de 7 caracteres." });
      }

      const apiKey = process.env.API_PLACAS_KEY;
      
      // Definir placas conhecidas para testes quando a API não estiver disponível
      const knownPlates: Record<string, any> = {
        'ABC1234': {
          placa: 'ABC1234',
          municipio: 'São Paulo',
          uf: 'SP',
          marca: 'Toyota',
          modelo: 'Corolla',
          versao: 'XEi 2.0',
          cor: 'Prata',
          ano: 2020
        },
        'DEF5678': {
          placa: 'DEF5678',
          municipio: 'Rio de Janeiro',
          uf: 'RJ',
          marca: 'Honda',
          modelo: 'Civic',
          versao: 'LXR 2.0',
          cor: 'Preto',
          ano: 2022
        },
        'GHI9012': {
          placa: 'GHI9012',
          municipio: 'Belo Horizonte',
          uf: 'MG',
          marca: 'Volkswagen',
          modelo: 'Golf',
          versao: 'GTI 2.0',
          cor: 'Branco',
          ano: 2021
        }
      };

      // Verificar se a placa está em nossos dados de teste
      if (plateNumber in knownPlates) {
        console.log("Usando dados de teste para a placa:", plateNumber);
        const data = knownPlates[plateNumber];
        return res.json({
          plateNumber: data.placa,
          municipality: data.municipio,
          state: data.uf,
          maker: data.marca,
          model: data.modelo,
          version: data.versao,
          color: data.cor,
          year: data.ano,
          vehicleType: "car"
        });
      }

      // Se não for uma placa de teste e não tivermos API key, retornar erro
      if (!apiKey) {
        console.warn("API key não configurada, apenas placas de teste estão disponíveis");
        return res.status(404).json({ message: "Placa não encontrada" });
      }

      // Formato correto baseado na documentação: https://wdapi2.com.br/consulta/PLACA/TOKEN
      const url = `https://wdapi2.com.br/consulta/${plateNumber}/${apiKey}`;
      
      console.log(`Consultando API de placas: ${url}`);
      
      // Não é necessário enviar token no cabeçalho pois ele já vai na URL
      const response = await fetch(url);
      
      console.log(`Resposta da API de placas: status ${response.status}`);
      
      if (!response.ok) {
        // Verifica se é um erro de credencial
        if (response.status === 401 || response.status === 403) {
          const responseText = await response.text();
          console.log(`Erro de autenticação: ${responseText}`);
          return res.status(response.status).json({ message: "Credencial de API inválida" });
        }
        
        // Verifica se a placa não foi encontrada
        if (response.status === 404) {
          const responseText = await response.text();
          console.log(`Placa não encontrada: ${responseText}`);
          return res.status(404).json({ message: "Placa não encontrada" });
        }
        
        const responseText = await response.text();
        console.log(`Erro na API de placas: ${response.status} - ${responseText}`);
        return res.status(response.status).json({ message: "Erro ao consultar a API de placas" });
      }
      
      const data = await response.json();
      console.log("Resposta da API de placas:", JSON.stringify(data));
      
      // Retornando os dados formatados para o frontend
      res.json({
        plateNumber: data.placa || plateNumber,
        municipality: data.municipio || "",
        state: data.uf || "",
        maker: data.marca || "",
        model: data.modelo || "",
        version: data.versao || "",
        color: data.cor || "",
        year: data.ano || new Date().getFullYear(),
        vehicleType: "car", // Valor padrão
        // Outros dados que a API possa retornar
      });
    } catch (error) {
      console.error("Erro ao consultar API de placas:", error);
      res.status(500).json({ message: "Erro ao processar a consulta de placa" });
    }
  });

  // User profile routes
  app.get("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Strip password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/profile", isAuthenticated, upload.single("profilePhoto"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const updateData = req.body;
      
      // If a file was uploaded, add its path to the update data
      if (req.file) {
        updateData.profilePhoto = `/uploads/${req.file.filename}`;
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Strip password from response
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Get all users (drivers) route
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      // Check if user is admin
      if (!isAdmin(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get all users
      const users = await storage.getAllUsers();
      
      // Remove sensitive information
      const safeUsers = users.map((user: User) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Erro no servidor" });
    }
  });
  
  // Delete user (driver) route
  app.delete("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Users can delete themselves, admins can delete anyone
      const isUserAdmin = isAdmin(req);
      const isSelfDelete = userId === req.user!.id;
      
      if (!isUserAdmin && !isSelfDelete) {
        return res.status(403).json({ message: "Não autorizado a excluir este usuário" });
      }
      
      await storage.deleteUser(userId);
      res.json({ message: "Usuário excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Erro no servidor" });
    }
  });
  
  // Get all passengers route (for admin purposes)
  app.get("/api/passengers", isAuthenticated, async (req, res) => {
    try {
      // Check if user is admin
      if (!isAdmin(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Obter todos os passageiros através da interface IStorage
      // Em uma aplicação real, isso seria paginado e teria filtros de busca
      const result = await storage.getAllPassengers();
      
      // Remover informações sensíveis como senhas
      const safePassengers = result.map((passenger: Passenger) => {
        const { password, ...passengerWithoutPassword } = passenger;
        return passengerWithoutPassword;
      });
      
      res.json(safePassengers);
    } catch (error) {
      console.error("Error fetching passengers:", error);
      res.status(500).json({ message: "Erro no servidor" });
    }
  });

  // Get passenger by ID route
  app.get("/api/passengers/:id", isAuthenticated, async (req, res) => {
    try {
      const passengerId = parseInt(req.params.id);
      
      // Check if user is admin
      if (!isAdmin(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const passenger = await storage.getPassenger(passengerId);
      
      if (!passenger) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }
      
      // Remove sensitive information
      const { password, ...passengerWithoutPassword } = passenger;
      res.json(passengerWithoutPassword);
    } catch (error) {
      console.error("Error fetching passenger:", error);
      res.status(500).json({ message: "Erro no servidor" });
    }
  });

  // Delete passenger route
  app.delete("/api/passengers/:id", isAuthenticated, async (req, res) => {
    try {
      const passengerId = parseInt(req.params.id);
      
      // Check if passenger exists
      const passenger = await storage.getPassenger(passengerId);
      if (!passenger) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }
      
      // Verificar se o usuário tem permissão para excluir
      const isAdmin = req.user!.type === 'admin';
      
      // Em uma aplicação real, também verificaríamos se o usuário está excluindo seu próprio perfil
      // const isSelfDelete = req.user!.type === 'passenger' && req.user!.id === passengerId;
      
      // Por enquanto, apenas administradores podem excluir passageiros
      if (!isAdmin) {
        return res.status(403).json({ message: "Não autorizado a excluir este passageiro" });
      }
      
      await storage.deletePassenger(passengerId);
      res.json({ message: "Passageiro excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting passenger:", error);
      res.status(500).json({ message: "Erro no servidor" });
    }
  });

  // Wallet routes with Asaas integration
  // Get passenger balance
  app.get("/api/wallet/balance", isAuthenticated, async (req, res) => {
    try {
      if (req.user!.type !== 'passenger') {
        return res.status(403).json({ message: "Apenas passageiros podem acessar a carteira" });
      }
      
      const passengerId = req.user!.id;
      const passenger = await storage.getPassenger(passengerId);
      
      if (!passenger) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }
      
      res.json({ balance: passenger.balance || 0 });
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      res.status(500).json({ message: "Erro ao obter saldo da carteira" });
    }
  });
  
  // Get transaction history
  app.get("/api/wallet/transactions", isAuthenticated, async (req, res) => {
    try {
      if (req.user!.type !== 'passenger') {
        return res.status(403).json({ message: "Apenas passageiros podem acessar a carteira" });
      }
      
      const passengerId = req.user!.id;
      
      // Get transactions from database using Drizzle
      const transactions = await db.query.walletTransactions.findMany({
        where: (walletTx, { eq }) => eq(walletTx.passengerId, passengerId),
        orderBy: (walletTx, { desc }) => [desc(walletTx.createdAt)]
      });
      
      res.json(transactions);
    } catch (error) {
      console.error("Error getting wallet transactions:", error);
      res.status(500).json({ message: "Erro ao obter histórico de transações" });
    }
  });
  
  // Add funds to wallet via Asaas payment gateway
  app.post("/api/wallet/add-funds", isAuthenticated, async (req, res) => {
    try {
      if (req.user!.type !== 'passenger') {
        return res.status(403).json({ message: "Apenas passageiros podem adicionar fundos à carteira" });
      }
      
      const passengerId = req.user!.id;
      const { amount, paymentMethod, cardData } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valor inválido" });
      }
      
      if (!paymentMethod) {
        return res.status(400).json({ message: "Método de pagamento não informado" });
      }
      
      // Get current passenger
      const passenger = await storage.getPassenger(passengerId);
      if (!passenger) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }
      
      // Criamos um cliente no Asaas para esta transação
      let asaasCustomerId;
      
      try {
        const customerResponse = await AsaasService.createCustomer({
          name: passenger.fullName || 'Passageiro',
          email: passenger.email,
          phone: passenger.phoneNumber,
          cpfCnpj: passenger.cpf?.replace(/[^\d]/g, '') || undefined,
        });
        
        asaasCustomerId = customerResponse.id;
      } catch (error) {
        console.error("Erro ao criar cliente no Asaas:", error);
        return res.status(500).json({ message: "Erro ao processar pagamento" });
      }
      
      // Criar cobrança no Asaas
      const billingType = paymentMethod === 'credit_card' ? 'CREDIT_CARD' : 'PIX';
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Vencimento amanhã
      
      try {
        const paymentData: any = {
          customer: asaasCustomerId,
          billingType,
          value: amount,
          dueDate: dueDate.toISOString().split('T')[0],
          description: `Recarga de carteira - ${passengerId}`,
          externalReference: `wallet-${passengerId}`
        };
        
        // Adicionar dados do cartão se o método for cartão de crédito
        if (billingType === 'CREDIT_CARD' && cardData) {
          paymentData.creditCard = {
            holderName: cardData.holderName,
            number: cardData.number,
            expiryMonth: cardData.expiryMonth,
            expiryYear: cardData.expiryYear,
            ccv: cardData.ccv
          };
          
          paymentData.creditCardHolderInfo = {
            name: passenger.fullName || cardData.holderName,
            email: passenger.email,
            cpfCnpj: passenger.cpf?.replace(/[^\d]/g, '') || '',
            postalCode: passenger.cep?.replace(/[^\d]/g, '') || '',
            addressNumber: passenger.number || '',
            phone: passenger.phoneNumber || ''
          };
        }
        
        const paymentResponse = await AsaasService.createPayment(paymentData);
        
        // Se for PIX, gera o QR Code
        let pixQrCode = null;
        if (billingType === 'PIX') {
          const qrCodeResponse = await AsaasService.generatePixQrCode(paymentResponse.id);
          pixQrCode = qrCodeResponse;
        }
        
        // Status inicial para pagamento via Asaas
        const status = 'pending';
        
        // Salvar a transação no banco de dados local
        const insertData = {
          passengerId,
          type: 'deposit',
          amount,
          description: `Depósito via ${paymentMethod === 'credit_card' ? 'cartão de crédito' : 'PIX'}`,
          paymentMethod,
          status: status,
          asaasPaymentId: paymentResponse.id,
        };
        
        const [transaction] = await db.insert(walletTransactions).values(insertData).returning();
        
        // Para pagamentos com PIX, enviamos o código QR
        if (billingType === 'PIX') {
          return res.status(201).json({
            transaction,
            pixInfo: pixQrCode,
            balance: passenger.balance || 0
          });
        }
        
        // Se o pagamento por cartão já foi autorizado/confirmado
        if (paymentResponse.status === 'CONFIRMED' || paymentResponse.status === 'RECEIVED') {
          // Atualizar o status da transação para completado
          await db.update(walletTransactions)
            .set({ status: 'completed' })
            .where(eq(walletTransactions.id, transaction.id));
          
          // Atualizar o saldo do passageiro
          const newBalance = (passenger.balance || 0) + amount;
          await storage.updatePassenger(passengerId, { balance: newBalance });
          
          return res.status(201).json({
            transaction: { ...transaction, status: 'completed' },
            newBalance
          });
        }
        
        res.status(201).json({
          transaction,
          balance: passenger.balance || 0,
          asaasPaymentId: paymentResponse.id
        });
      } catch (error) {
        console.error("Erro ao processar pagamento com Asaas:", error);
        res.status(500).json({ message: "Erro ao processar pagamento" });
      }
    } catch (error) {
      console.error("Error adding funds to wallet:", error);
      res.status(500).json({ message: "Erro ao adicionar fundos à carteira" });
    }
  });
  
  // Webhook do Asaas para receber notificações de pagamento
  app.post("/api/webhook/asaas", async (req, res) => {
    try {
      console.log("Webhook Asaas recebido. Corpo da requisição:", JSON.stringify(req.body, null, 2));
      
      const event = req.body.event;
      const payment = req.body.payment || req.body.data;
      
      console.log(`Webhook Asaas recebido: ${event}, Dados:`, JSON.stringify(payment, null, 2));
      
      // Compatibilidade com diferentes formatos de webhook
      if (!payment || !payment.id) {
        console.error("Webhook Asaas: Dados de pagamento inválidos ou em formato inesperado");
        return res.status(400).json({ message: "Dados de pagamento inválidos" });
      }
      
      // Buscar a transação no banco de dados pelo ID do pagamento Asaas
      const [transaction] = await db.query.walletTransactions.findMany({
        where: (tx, { eq }) => eq(tx.asaasPaymentId, payment.id),
        limit: 1
      });
      
      if (!transaction) {
        console.error(`Transação não encontrada para pagamento Asaas ID: ${payment.id}`);
        
        // Em vez de retornar erro, responda com sucesso para que o Asaas não tente reenviar
        // Isso é importante para webhooks relacionados a pagamentos que não estão ainda no nosso sistema
        return res.status(200).json({ 
          message: "Webhook processado, transação não encontrada no sistema",
          received: true,
          paymentId: payment.id
        });
      }
      
      const passengerId = transaction.passengerId;
      
      // Processar o evento
      switch (event) {
        case 'PAYMENT_CONFIRMED':
        case 'PAYMENT_RECEIVED':
        case 'CREDIT_CARD_PAYMENT_CONFIRMED': // Adicionado para eventos de pagamentos com cartão
        case 'CREDIT_CARD_PAYMENT_AUTHORIZED': // Adicionado evento de autorização de cartão
        case 'CREDIT_CARD_PAYMENT_RECEIVED': // Adicionado para eventos de pagamentos com cartão
          console.log(`Processando evento de pagamento confirmado/recebido: ${event}`);
          
          // Atualizar status da transação somente se ainda não estiver completada
          if (transaction.status !== 'completed') {
            await db.update(walletTransactions)
              .set({ status: 'completed' })
              .where(eq(walletTransactions.id, transaction.id));
              
            console.log(`Transação ${transaction.id} atualizada para status: completed`);
            
            // Verificar se o passengerId é válido
            if (passengerId === null) {
              console.error("ID do passageiro é nulo");
              return res.status(400).json({ message: "ID do passageiro inválido" });
            }
            
            // Buscar passageiro atual
            const passenger = await storage.getPassenger(passengerId);
            if (!passenger) {
              console.error(`Passageiro não encontrado ID: ${passengerId}`);
              return res.status(404).json({ message: "Passageiro não encontrado" });
            }
            
            // Atualizar saldo do passageiro
            const currentBalance = passenger.balance || 0;
            const newBalance = currentBalance + transaction.amount;
            await storage.updatePassenger(passengerId, { balance: newBalance });
            
            console.log(`Saldo atualizado para passageiro ${passengerId}: ${newBalance}`);
          } else {
            console.log(`Transação ${transaction.id} já está com status: completed. Nenhuma atualização necessária.`);
          }
          break;
          
        case 'PAYMENT_REFUNDED':
        case 'CREDIT_CARD_PAYMENT_REFUNDED': // Adicionado para eventos de pagamentos com cartão
          // Atualizar status da transação para reembolsado
          await db.update(walletTransactions)
            .set({ status: 'refunded' })
            .where(eq(walletTransactions.id, transaction.id));
          
          console.log(`Transação marcada como reembolsada: ${transaction.id}`);
          break;
          
        case 'PAYMENT_DECLINED':
        case 'PAYMENT_FAILED':
        case 'CREDIT_CARD_PAYMENT_DECLINED': // Adicionado para eventos de pagamentos com cartão
        case 'CREDIT_CARD_PAYMENT_FAILED': // Adicionado para eventos de pagamentos com cartão
          // Atualizar status da transação para falha
          await db.update(walletTransactions)
            .set({ status: 'failed' })
            .where(eq(walletTransactions.id, transaction.id));
          
          console.log(`Transação marcada como falha: ${transaction.id}`);
          break;
          
        default:
          console.log(`Evento não processado: ${event}`);
          break;
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao processar webhook do Asaas:", error);
      res.status(500).json({ message: "Erro ao processar webhook" });
    }
  });

  // Vehicle routes
  app.get("/api/vehicles", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const allVehicles = await storage.getVehiclesByUserId(userId);
      
      // Filtrar apenas veículos aprovados para exibir no menu do motorista
      const approvedVehicles = allVehicles.filter(vehicle => vehicle.vehicleStatus === 'approved');
      
      res.json(approvedVehicles);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/vehicles", isAuthenticated, upload.fields([
    { name: "frontPhoto", maxCount: 1 },
    { name: "diagonalPhoto", maxCount: 1 },
    { name: "backPhoto", maxCount: 1 },
    { name: "platePhoto", maxCount: 1 },
    { name: "crlvPhoto", maxCount: 1 }
  ]), async (req, res) => {
    try {
      const userId = req.user!.id;
      const vehicleData = {
        ...req.body,
        userId
      };
      
      // Add file paths to vehicle data
      if (req.files && typeof req.files === 'object') {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        Object.keys(files).forEach(fieldname => {
          if (files[fieldname] && files[fieldname][0]) {
            vehicleData[fieldname] = `/uploads/${files[fieldname][0].filename}`;
          }
        });
      }

      // Convert array fields from string to array
      if (vehicleData.rideTypes && typeof vehicleData.rideTypes === 'string') {
        vehicleData.rideTypes = vehicleData.rideTypes.split(',');
      }
      
      // Validate vehicle data
      const validatedData = insertVehicleSchema.parse(vehicleData);
      
      const vehicle = await storage.createVehicle(validatedData);
      res.status(201).json(vehicle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vehicle data", errors: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/vehicles/:id", isAuthenticated, async (req, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      const vehicle = await storage.getVehicle(vehicleId);
      
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      // Check if the vehicle belongs to the user
      if (vehicle.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized to access this vehicle" });
      }
      
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Ride history routes
  app.get("/api/rides", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const rides = await storage.getRidesByUserId(userId);
      
      // Sort rides by creation date, newest first
      rides.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      
      res.json(rides);
    } catch (error) {
      console.error("Error fetching rides:", error);
      res.status(500).json({ message: "Server error", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Withdrawal routes
  app.get("/api/withdrawals", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const withdrawals = await storage.getWithdrawalsByUserId(userId);
      
      // Sort withdrawals by request date, newest first
      withdrawals.sort((a, b) => (b.requestDate?.getTime() || 0) - (a.requestDate?.getTime() || 0));
      
      res.json(withdrawals);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/withdrawals", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { amount } = req.body;
      
      // Validate minimum withdrawal amount
      if (amount < 50) {
        return res.status(400).json({ message: "Minimum withdrawal amount is R$ 50,00" });
      }
      
      // Check if user has enough balance
      if ((user.balance || 0) < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      // Check if a withdrawal was already requested in the last 7 days
      const recentWithdrawals = await storage.getWithdrawalsByUserId(userId);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const hasRecentWithdrawal = recentWithdrawals.some(
        w => (w.requestDate ? w.requestDate > oneWeekAgo : false) && w.status !== "rejected"
      );
      
      if (hasRecentWithdrawal) {
        return res.status(400).json({ message: "Withdrawal can only be requested once per week" });
      }
      
      // Create withdrawal request
      const withdrawalData = {
        userId,
        amount,
        status: "pending"
      };
      
      // Validate withdrawal data
      const validatedData = insertWithdrawalSchema.parse(withdrawalData);
      
      const withdrawal = await storage.createWithdrawal(validatedData);
      
      // Update user balance
      await storage.updateUser(userId, { balance: (user.balance || 0) - amount });
      
      res.status(201).json(withdrawal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid withdrawal data", errors: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Passenger registration
  app.post("/api/passenger/register", upload.single("profilePhoto"), async (req, res) => {
    try {
      console.log("Passenger registration request received");
      
      // Convert the date string to a Date object
      let birthDate: Date | null = null;
      if (req.body.birthDate) {
        birthDate = new Date(req.body.birthDate);
        
        // Validate age only if birthDate is provided (at least 18 years old)
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        // Adjust for not having had birthday yet this year
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          if (age - 1 < 18) {
            return res.status(400).json({ message: "Você deve ter pelo menos 18 anos para se cadastrar", field: "birthDate" });
          }
        } else {
          if (age < 18) {
            return res.status(400).json({ message: "Você deve ter pelo menos 18 anos para se cadastrar", field: "birthDate" });
          }
        }
      }
      // Campo não é mais obrigatório
      
      // Check if email already exists
      const existingPassenger = await storage.getPassengerByEmail(req.body.email);
      if (existingPassenger) {
        return res.status(400).json({ message: "Email já registrado", field: "email" });
      }
      
      // Prepare passenger data
      const passengerData = { 
        ...req.body,
        birthDate: birthDate
      };
      
      // Se estamos recebendo firstname e lastname separados (legado), combiná-los
      if (passengerData.firstName || passengerData.lastName) {
        // O campo no BD é fullName mas a coluna é full_name
        passengerData.fullName = `${passengerData.firstName || ''} ${passengerData.lastName || ''}`.trim();
        
        // Remover campos que não existem na tabela
        delete passengerData.firstName;
        delete passengerData.lastName;
      }
      
      // Hash the password
      const { hashPassword } = await import('./auth');
      if (passengerData.password) {
        passengerData.password = await hashPassword(passengerData.password);
      }
      
      // Handle profile photo upload
      if (req.file) {
        passengerData.profilePhoto = `/uploads/${req.file.filename}`;
      }
      
      console.log("Dados do passageiro a serem salvos:", passengerData);
      
      // Create the passenger - salvando na tabela passengers
      const passenger = await storage.createPassenger(passengerData);
      
      // Criar cliente no Asaas automaticamente
      let asaasCustomerId = null;
      try {
        const asaasCustomerData = {
          name: passenger.fullName,
          email: passenger.email,
          cpfCnpj: passenger.cpf?.replace(/\D/g, ''), // Remove formatação do CPF/CNPJ
          phone: passenger.phoneNumber?.replace(/\D/g, ''), // Remove formatação do telefone
          mobilePhone: passenger.phoneNumber?.replace(/\D/g, ''),
          address: passenger.street || undefined,
          addressNumber: passenger.number || undefined,
          province: passenger.neighborhood || undefined,
          postalCode: passenger.cep?.replace(/\D/g, '') || undefined // Remove formatação do CEP
        };

        console.log('Criando cliente no Asaas para passageiro:', asaasCustomerData);
        
        const asaasCustomer = await AsaasService.createCustomer(asaasCustomerData);
        asaasCustomerId = asaasCustomer.id;
        
        // Atualizar o passageiro com o ID do cliente Asaas
        if (asaasCustomerId) {
          await db.update(passengers).set({
            asaasCustomerId: asaasCustomerId
          }).where(eq(passengers.id, passenger.id));
          
          console.log(`Cliente Asaas criado com sucesso. ID: ${asaasCustomerId}`);
        }
      } catch (asaasError) {
        console.error('Erro ao criar cliente no Asaas:', asaasError);
        // Não falha o registro se houver erro no Asaas, apenas loga o erro
        console.log('Cadastro continuará sem integração Asaas por ora');
      }
      
      // Autenticar o usuário automaticamente após o registro (login automático)
      req.login(passenger as any, (err) => {
        if (err) {
          console.error("Erro ao autenticar o passageiro após o registro:", err);
          return res.status(500).json({ message: "Erro ao realizar login automático após o registro" });
        }
        
        // Send successful response
        const { password, ...passengerWithoutPassword } = passenger;
        res.status(201).json({
          ...passengerWithoutPassword,
          asaasCustomerId: asaasCustomerId,
          message: "Cadastro realizado com sucesso! Você está logado."
        });
      });
    } catch (error) {
      console.error("Passenger registration error:", error);
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        return res.status(400).json({ 
          message: firstError.message,
          field: firstError.path.join('.') 
        });
      }
      res.status(500).json({ message: "Erro no servidor durante o registro de passageiro" });
    }
  });

  // Driver registration
  app.post("/api/driver/register", upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "cpfFront", maxCount: 1 },
    { name: "cpfBack", maxCount: 1 },
    { name: "cnhFront", maxCount: 1 },
    { name: "cnhBack", maxCount: 1 }
  ]), async (req, res) => {
    try {
      console.log("Driver registration request received");
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Prepare user data
      const userData = { ...req.body };
      
      // Convert birth date from DD/MM/YYYY to YYYY-MM-DD format for database
      if (userData.birthDate && typeof userData.birthDate === 'string') {
        const parts = userData.birthDate.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          userData.birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
      
      // Hash the password
      // Use the hash function from auth.ts
      const { hashPassword } = await import('./auth');
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      
      // Set default values
      userData.balance = 0;
      userData.userType = 'driver';
      userData.genderUpdated = true; // Novos motoristas já informaram o gênero no registro
      
      // Handle file uploads
      if (req.files && typeof req.files === 'object') {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        
        Object.keys(files).forEach(fieldname => {
          if (files[fieldname] && files[fieldname][0]) {
            userData[fieldname] = `/uploads/${files[fieldname][0].filename}`;
          }
        });
      }
      
      // Para a tabela drivers, usamos o campo type em vez de userType
      if (userData.userType) {
        userData.type = 'driver'; // Define o tipo como motorista
        delete userData.userType; // Remove o campo que não existe na tabela
      }
      
      // Verificar se temos o CPF
      if (!userData.cpf && req.body.cpf) {
        userData.cpf = req.body.cpf;
      }
      
      // Handle CNH data
      if (req.body.cnhNumber) {
        userData.cnhNumber = req.body.cnhNumber;
      }
      
      if (req.body.cnhCategory) {
        userData.cnhCategory = req.body.cnhCategory;
      }
      
      // Handle remunerated activity (EAR) - convert string to boolean
      if (req.body.remuneratedActivity !== undefined) {
        userData.remuneratedActivity = req.body.remuneratedActivity === 'true' || req.body.remuneratedActivity === true;
      }
      
      console.log("Dados do motorista a serem salvos:", userData);
      
      // Criar cliente no Asaas primeiro
      let asaasCustomerId = null;
      if (process.env.ASAAS_API_KEY) {
        try {
          const { AsaasService } = await import('./asaas');
          
          const driverData = {
            name: userData.firstName,
            email: userData.email,
            phone: userData.phoneNumber,
            cpf: userData.cpf,
            address: userData.street,
            addressNumber: userData.number,
            complement: userData.complement,
            province: userData.state,
            postalCode: userData.cep?.replace(/\D/g, '') // Remove formatação do CEP
          };
          
          console.log('Criando cliente motorista no Asaas:', driverData);
          const asaasCustomer = await AsaasService.createDriverCustomer(driverData);
          asaasCustomerId = asaasCustomer.id;
          console.log('Cliente motorista criado no Asaas com ID:', asaasCustomerId);
        } catch (error) {
          console.error('Erro ao criar cliente motorista no Asaas:', error);
          // Continue com o cadastro mesmo se falhar no Asaas
        }
      } else {
        console.warn('ASAAS_API_KEY não configurada. Pulando criação de cliente no Asaas.');
      }
      
      // Adicionar o ID do Asaas aos dados do usuário
      if (asaasCustomerId) {
        userData.asaasCustomerId = asaasCustomerId;
      }
      
      // Create the user - salvando na tabela drivers
      const user = await storage.createUser(userData);
      
      // Login the user
      req.login(user, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ message: "Registration successful but couldn't log in automatically" });
        }
        
        // Strip password from response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Driver registration error:", error);
      res.status(500).json({ message: "Server error during driver registration" });
    }
  });
  
  // Upload routes for profile and documents
  app.post("/api/uploads/profilePhoto", upload.single("profilePhoto"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const filePath = `/uploads/${req.file.filename}`;
      
      // Se o usuário estiver autenticado, atualize o perfil
      if (req.isAuthenticated() && req.user) {
        const userId = req.user.id;
        await storage.updateUser(userId, { profilePhoto: filePath });
      }
      
      res.json({ filePath });
    } catch (error) {
      console.error("Error uploading profile photo:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Upload para a frente do CPF/documento
  app.post("/api/uploads/cpfFrontPhoto", upload.single("cpfFrontPhoto"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const filePath = `/uploads/${req.file.filename}`;
      
      // Se o usuário estiver autenticado, atualize o perfil
      if (req.isAuthenticated() && req.user) {
        const userId = req.user.id;
        await storage.updateUser(userId, { cpfFront: filePath });
      }
      
      res.json({ filePath });
    } catch (error) {
      console.error("Error uploading CPF front photo:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Upload para o verso do CPF/documento
  app.post("/api/uploads/cpfBackPhoto", upload.single("cpfBackPhoto"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const filePath = `/uploads/${req.file.filename}`;
      
      // Se o usuário estiver autenticado, atualize o perfil
      if (req.isAuthenticated() && req.user) {
        const userId = req.user.id;
        await storage.updateUser(userId, { cpfBack: filePath });
      }
      
      res.json({ filePath });
    } catch (error) {
      console.error("Error uploading CPF back photo:", error);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Uploads genéricos para fotos de veículos
  const vehiclePhotoFields = ["frontPhoto", "diagonalPhoto", "backPhoto", "platePhoto", "crlvPhoto"];
  
  vehiclePhotoFields.forEach(fieldName => {
    app.post(`/api/uploads/${fieldName}`, upload.single(fieldName), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        
        const filePath = `/uploads/${req.file.filename}`;
        res.json({ filePath });
      } catch (error) {
        console.error(`Error uploading ${fieldName}:`, error);
        res.status(500).json({ message: "Server error" });
      }
    });
  });

  // Rota antiga para compatibilidade
  app.post("/api/uploads/documents", isAuthenticated, upload.fields([
    { name: "cpfFront", maxCount: 1 },
    { name: "cpfBack", maxCount: 1 },
    { name: "cnhFront", maxCount: 1 },
    { name: "cnhBack", maxCount: 1 }
  ]), async (req, res) => {
    try {
      if (!req.files || typeof req.files !== 'object' || Object.keys(req.files).length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }
      
      const userId = req.user!.id;
      const updateData: Record<string, string> = {};
      
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      Object.keys(files).forEach(fieldname => {
        if (files[fieldname] && files[fieldname][0]) {
          updateData[fieldname] = `/uploads/${files[fieldname][0].filename}`;
        }
      });
      
      if (Object.keys(updateData).length > 0) {
        await storage.updateUser(userId, updateData);
      }
      
      res.json(updateData);
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Emergency contact routes
  app.get("/api/emergency-contacts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const contacts = await storage.getEmergencyContacts(userId);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/emergency-contacts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const contactData = req.body;

      // Validate contact data
      const validatedData = emergencyContactSchema.parse(contactData);
      
      const contacts = await storage.addEmergencyContact(userId, validatedData);
      res.status(201).json(contacts);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      console.error("Error adding emergency contact:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/emergency-contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const contactId = req.params.id;
      const contactData = req.body;

      // Validate contact data
      const validatedData = emergencyContactSchema.parse(contactData);
      
      const contacts = await storage.updateEmergencyContact(userId, contactId, validatedData);
      res.json(contacts);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid contact data", errors: error.errors });
      }
      if (error instanceof Error && error.message === "Contact not found") {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/emergency-contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const contactId = req.params.id;
      
      const contacts = await storage.deleteEmergencyContact(userId, contactId);
      res.json(contacts);
    } catch (error) {
      if (error instanceof Error && error.message === "Contact not found") {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // Emergency notification endpoint for active rides
  app.post("/api/emergency-notification/:rideId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const rideId = parseInt(req.params.rideId);
      
      // Get the ride to verify it belongs to this user
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (ride.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized access to this ride" });
      }
      
      // Get emergency contacts
      const contacts = await storage.getEmergencyContacts(userId);
      if (contacts.length === 0) {
        return res.status(400).json({ message: "No emergency contacts registered" });
      }
      
      // Get user info
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get vehicle info
      const vehicle = ride.vehicleId ? await storage.getVehicle(ride.vehicleId) : null;
      
      // In a real app, here we would:
      // 1. Send SMS/push notifications to emergency contacts
      // 2. Update ride status to indicate emergency
      // 3. Notify platform administrators
      
      // For now, just return a successful response with what would be sent
      const emergencyData = {
        driverName: `${user.firstName} ${user.lastName}`,
        driverPhone: user.phoneNumber,
        vehicleInfo: vehicle ? `${vehicle.maker} ${vehicle.model} - ${vehicle.plateNumber}` : "Unknown vehicle",
        rideInfo: {
          origin: ride.origin,
          destination: ride.destination,
          status: ride.status,
          startTime: ride.startTime
        },
        currentLocation: req.body.location || "Unknown location", // From client
        emergencyMessage: req.body.message || "Emergency alert triggered",
        sentTo: contacts.map(c => ({ name: c.name, phone: c.phoneNumber }))
      };
      
      res.status(200).json({
        message: "Emergency notification sent successfully",
        sentTo: contacts.length,
        details: emergencyData
      });
    } catch (error) {
      console.error("Error sending emergency notification:", error);
      res.status(500).json({ message: "Failed to send emergency notification" });
    }
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadDirectory));

  // Rota para verificar o status do Firebase
  app.get("/api/firebase-status", async (req, res) => {
    try {
      // Importa o módulo Firebase Admin diretamente
      const admin = await import('firebase-admin').then(m => m.default);
      
      // Tenta acessar serviços diretamente
      let authAvailable = false;
      let firestoreAvailable = false;
      let messagingAvailable = false;
      let storageAvailable = false;
      
      try {
        const auth = admin.auth();
        authAvailable = !!auth;
      } catch (e) { /* silencia erro */ }
      
      try {
        const firestore = admin.firestore();
        firestoreAvailable = !!firestore;
      } catch (e) { /* silencia erro */ }
      
      try {
        const messaging = admin.messaging();
        messagingAvailable = !!messaging;
      } catch (e) { /* silencia erro */ }
      
      try {
        const storage = admin.storage();
        storageAvailable = !!storage;
      } catch (e) { /* silencia erro */ }
      
      // Verifica se o Firebase está inicializado
      const initialized = authAvailable || firestoreAvailable || messagingAvailable || storageAvailable;
      
      // Retorna o status completo
      res.json({
        initialized,
        services: {
          auth: authAvailable,
          firestore: firestoreAvailable,
          messaging: messagingAvailable,
          storage: storageAvailable
        },
        projectId: 'serv-motors-ea488',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("Erro na rota de status do Firebase:", err);
      res.status(500).json({ 
        message: "Erro ao verificar status do Firebase",
        error: err.message || 'Erro desconhecido'
      });
    }
  });

  // Wallet routes for passenger
  app.get("/api/wallet/transactions", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário é um passageiro
      if (req.user!.type !== 'passenger') {
        return res.status(403).json({ message: "Acesso permitido apenas para passageiros" });
      }

      const passengerId = req.user!.id;
      
      // Consultar as transações da carteira
      const transactions = await db.query.walletTransactions.findMany({
        where: (walletTransactions, { eq }) => eq(walletTransactions.passengerId, passengerId),
        orderBy: (walletTransactions, { desc }) => [desc(walletTransactions.createdAt)]
      });

      res.json(transactions);
    } catch (error) {
      console.error("Erro ao buscar transações da carteira:", error);
      res.status(500).json({ message: "Erro ao buscar dados" });
    }
  });

  // Add funds to passenger wallet
  app.post("/api/wallet/deposit", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário é um passageiro
      if (req.user!.type !== 'passenger') {
        return res.status(403).json({ message: "Acesso permitido apenas para passageiros" });
      }

      // Validar os dados da transação
      const schema = z.object({
        amount: z.number().positive("O valor deve ser positivo"),
        paymentMethod: z.string().min(1, "Método de pagamento é obrigatório"),
        description: z.string().optional()
      });

      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: validationResult.error.errors 
        });
      }

      const { amount, paymentMethod, description } = validationResult.data;
      const passengerId = req.user!.id;

      // Buscar o passageiro atual para verificar o saldo
      const passenger = await storage.getPassenger(passengerId);
      if (!passenger) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }

      // Criar uma nova transação
      const transaction = await db.insert(walletTransactions).values({
        passengerId,
        type: 'deposit',
        amount,
        paymentMethod,
        description: description || `Depósito via ${paymentMethod}`,
        status: 'completed'
      }).returning();

      // Atualizar o saldo do passageiro
      const newBalance = (passenger.balance || 0) + amount;
      await storage.updatePassenger(passengerId, { balance: newBalance });

      res.status(201).json({
        transaction: transaction[0],
        newBalance
      });
    } catch (error) {
      console.error("Erro ao adicionar fundos:", error);
      res.status(500).json({ message: "Erro ao processar depósito" });
    }
  });

  // Get passenger wallet balance
  app.get("/api/wallet/balance", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário é um passageiro
      if (req.user!.type !== 'passenger') {
        return res.status(403).json({ message: "Acesso permitido apenas para passageiros" });
      }

      const passengerId = req.user!.id;
      
      // Buscar o passageiro para obter o saldo atual
      const passenger = await storage.getPassenger(passengerId);
      if (!passenger) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }

      res.json({ balance: passenger.balance || 0 });
    } catch (error) {
      console.error("Erro ao buscar saldo da carteira:", error);
      res.status(500).json({ message: "Erro ao buscar dados" });
    }
  });

  // Rotas do painel administrativo
  app.get("/api/admin/cobrancas", isAuthenticated, async (req, res) => {
    try {
      // Verifica se o usuário é um administrador
      if (!isAdmin(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Obtém os pagamentos do Asaas
      const paymentsResponse = await AsaasService.getPayments();
      
      // Transforma os dados para o formato esperado pelo frontend
      const cobrancas = await Promise.all(paymentsResponse.data.map(async (payment: any) => {
        // Busca informações do cliente para cada pagamento
        let customerName = payment.customer;
        try {
          if (payment.customer) {
            const customerResponse = await AsaasService.getCustomer(payment.customer);
            customerName = customerResponse.name;
          }
        } catch (error) {
          console.error(`Erro ao obter dados do cliente ${payment.customer}:`, error);
        }
        
        return {
          id: payment.id,
          customer: payment.customer,
          customerName,
          value: payment.value,
          status: payment.status,
          dueDate: payment.dueDate,
          paymentMethod: payment.billingType,
          description: payment.description || ''
        };
      }));
      
      res.json(cobrancas);
      
    } catch (error) {
      console.error("Erro ao obter cobrançãs do Asaas:", error);
      res.status(500).json({ message: "Erro ao obter dados de cobrança" });
    }
  });
  
  app.get("/api/admin/clientes", isAuthenticated, async (req, res) => {
    try {
      // Verifica se o usuário é um administrador
      if (!isAdmin(req)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Busca os passageiros e motoristas para criar uma lista unificada de clientes
      const passengers = await storage.getAllPassengers();
      const drivers = await storage.getAllUsers();
      
      // Transforma os dados para o formato esperado pelo frontend
      const passengersFormatted = passengers.map(p => ({
        id: p.id,
        nome: p.fullName || '',
        email: p.email,
        telefone: p.phoneNumber || '',
        dataCriacao: p.createdAt?.toISOString() || new Date().toISOString(),
        tipo: 'passageiro'
      }));
      
      const driversFormatted = drivers.map(d => ({
        id: d.id,
        nome: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
        email: d.email,
        telefone: d.phoneNumber || '',
        dataCriacao: d.createdAt?.toISOString() || new Date().toISOString(),
        tipo: 'motorista'
      }));
      
      const clientes = [...passengersFormatted, ...driversFormatted];
      
      res.json(clientes);
      
    } catch (error) {
      console.error("Erro ao obter clientes:", error);
      res.status(500).json({ message: "Erro ao obter dados de clientes" });
    }
  });

  // Rotas para os tipos de transporte
  app.get("/api/transport-types/passenger", async (req, res) => {
    try {
      const passengerTypes = await db
        .select()
        .from(transportTypes)
        .where(eq(transportTypes.category, 'passenger'));
      
      res.json(passengerTypes);
    } catch (error) {
      console.error("Erro ao obter tipos de transporte para passageiros:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/transport-types/delivery", async (req, res) => {
    try {
      const deliveryTypes = await db
        .select()
        .from(transportTypes)
        .where(eq(transportTypes.category, 'delivery'));
      
      res.json(deliveryTypes);
    } catch (error) {
      console.error("Erro ao obter tipos de transporte para entregas:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/transport-types/:id/categories", async (req, res) => {
    try {
      const transportTypeId = parseInt(req.params.id);
      
      const categories = await db
        .select()
        .from(vehicleCategories)
        .where(eq(vehicleCategories.transportTypeId, transportTypeId));
      
      res.json(categories);
    } catch (error) {
      console.error("Erro ao obter categorias do tipo de transporte:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Rotas de integração com Asaas para pagamentos
  // Rota para criar um cliente no Asaas
  app.post("/api/payments/customers", isAuthenticated, async (req, res) => {
    try {
      // Validar se o usuário tem permissão para criar clientes
      if (!req.user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      // Obter os dados do cliente do corpo da requisição
      const customerData = req.body;
      
      // Criar o cliente no Asaas
      const customer = await AsaasService.createCustomer(customerData);
      
      // Se o usuário for um passageiro, atualizar seu registro com o ID do cliente Asaas
      if (req.user.userType === 'passenger' || req.user.type === 'passenger') {
        const passengerId = req.user.id;
        await storage.updatePassenger(passengerId, { asaasCustomerId: customer.id });
      }
      
      res.status(201).json(customer);
    } catch (error) {
      console.error("Erro ao criar cliente no Asaas:", error);
      res.status(500).json({ 
        message: "Erro ao criar cliente no Asaas",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para criar um pagamento
  app.post("/api/payments/create", isAuthenticated, async (req, res) => {
    try {
      // Validar se o usuário tem permissão para criar pagamentos
      if (!req.user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      // Obter os dados do pagamento do corpo da requisição
      const paymentData = req.body;
      
      // Criar o pagamento no Asaas
      const payment = await AsaasService.createPayment(paymentData);
      
      // Se for um pagamento PIX, gerar o QR code
      if (payment.billingType === 'PIX') {
        const pixData = await AsaasService.generatePixQrCode(payment.id);
        // Combinar os dados do pagamento com os dados do PIX
        return res.status(201).json({
          ...payment,
          pix: pixData
        });
      }
      
      res.status(201).json(payment);
    } catch (error) {
      console.error("Erro ao criar pagamento no Asaas:", error);
      res.status(500).json({ 
        message: "Erro ao criar pagamento no Asaas",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Webhook para receber notificações do Asaas
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const event = req.body;
      console.log('Webhook do Asaas recebido:', JSON.stringify(event));
      
      // Verificar o tipo de evento
      if (event && event.event) {
        switch (event.event) {
          case 'PAYMENT_RECEIVED':
          case 'PAYMENT_CONFIRMED':
            // Processar pagamento recebido
            if (event.payment && event.payment.externalReference) {
              // O externalReference deve conter o ID do passageiro
              const passengerId = parseInt(event.payment.externalReference);
              
              if (!isNaN(passengerId)) {
                // Obter o passageiro
                const passenger = await storage.getPassenger(passengerId);
                
                if (passenger) {
                  // Atualizar o saldo do passageiro
                  const newBalance = (passenger.balance || 0) + event.payment.value;
                  await storage.updatePassenger(passengerId, { balance: newBalance });
                  
                  // Registrar a transação
                  await storage.createWalletTransaction({
                    passengerId,
                    amount: event.payment.value,
                    type: 'deposit',
                    description: `Pagamento via ${event.payment.billingType}`,
                    reference: event.payment.id,
                    status: 'completed',
                    createdAt: new Date()
                  });
                }
              }
            }
            break;
          
          case 'PAYMENT_REFUNDED':
          case 'PAYMENT_REFUND_CONFIRMED':
            // Processar reembolso
            if (event.payment && event.payment.externalReference) {
              const passengerId = parseInt(event.payment.externalReference);
              
              if (!isNaN(passengerId)) {
                // Obter o passageiro
                const passenger = await storage.getPassenger(passengerId);
                
                if (passenger) {
                  // Atualizar o saldo do passageiro (subtrair o valor do reembolso)
                  const newBalance = Math.max(0, (passenger.balance || 0) - event.payment.value);
                  await storage.updatePassenger(passengerId, { balance: newBalance });
                  
                  // Registrar a transação
                  await storage.createWalletTransaction({
                    passengerId,
                    amount: -event.payment.value,
                    type: 'refund',
                    description: `Reembolso de pagamento`,
                    reference: event.payment.id,
                    status: 'completed',
                    createdAt: new Date()
                  });
                }
              }
            }
            break;
            
          default:
            // Outros tipos de eventos
            console.log(`Evento ${event.event} não processado`);
        }
      }
      
      // Sempre retornar 200 para confirmar o recebimento do webhook
      res.status(200).send('Webhook recebido com sucesso');
    } catch (error) {
      console.error("Erro ao processar webhook do Asaas:", error);
      // Ainda retornamos 200 para evitar que o Asaas tente reenviar o webhook
      res.status(200).send('Webhook processado com erro');
    }
  });
  
  // Rota para obter o saldo da carteira do passageiro
  app.get("/api/wallet/balance", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário é um passageiro
      if (req.user && (req.user.userType === 'passenger' || req.user.type === 'passenger')) {
        const passengerId = req.user.id;
        
        // Obter o passageiro
        const passenger = await storage.getPassenger(passengerId);
        
        if (!passenger) {
          return res.status(404).json({ message: "Passageiro não encontrado" });
        }
        
        // Retornar o saldo
        res.json({ balance: passenger.balance || 0 });
      } else {
        res.status(403).json({ message: "Apenas passageiros podem acessar esta rota" });
      }
    } catch (error) {
      console.error("Erro ao obter saldo da carteira:", error);
      res.status(500).json({ 
        message: "Erro ao obter saldo da carteira",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para obter o histórico de transações da carteira
  app.get("/api/wallet/transactions", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário é um passageiro
      if (req.user && (req.user.userType === 'passenger' || req.user.type === 'passenger')) {
        const passengerId = req.user.id;
        
        // Obter as transações do passageiro
        const result = await db.select()
                               .from(walletTransactions)
                               .where(eq(walletTransactions.passengerId, passengerId))
                               .orderBy(walletTransactions.createdAt, "desc");
        
        // Retornar as transações
        res.json(result);
      } else {
        res.status(403).json({ message: "Apenas passageiros podem acessar esta rota" });
      }
    } catch (error) {
      console.error("Erro ao obter transações da carteira:", error);
      res.status(500).json({ 
        message: "Erro ao obter transações da carteira",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para adicionar fundos à carteira (iniciar pagamento)
  app.post("/api/wallet/add-funds", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário é um passageiro
      if (req.user && (req.user.userType === 'passenger' || req.user.type === 'passenger')) {
        const passengerId = req.user.id;
        
        // Obter o passageiro
        const passenger = await storage.getPassenger(passengerId);
        
        if (!passenger) {
          return res.status(404).json({ message: "Passageiro não encontrado" });
        }
        
        // Verificar se o passageiro tem um ID de cliente Asaas
        if (!passenger.asaasCustomerId) {
          return res.status(400).json({ 
            message: "Passageiro não possui ID de cliente Asaas",
            errorCode: "NO_ASAAS_CUSTOMER"
          });
        }
        
        // Obter os dados do pagamento do corpo da requisição
        const { amount, billingType } = req.body;
        
        if (!amount || amount <= 0) {
          return res.status(400).json({ message: "Valor inválido" });
        }
        
        if (!billingType || !['CREDIT_CARD', 'PIX'].includes(billingType)) {
          return res.status(400).json({ message: "Método de pagamento inválido" });
        }
        
        // Criar o pagamento no Asaas
        const paymentData = {
          customer: passenger.asaasCustomerId,
          billingType,
          value: amount,
          dueDate: new Date().toISOString().split('T')[0], // Data atual no formato YYYY-MM-DD
          description: "Adição de fundos à carteira Serv Motors",
          externalReference: String(passengerId) // Para identificar o passageiro no webhook
        };
        
        // Se for pagamento com cartão, adicionar dados do cartão
        if (billingType === 'CREDIT_CARD' && req.body.creditCard) {
          paymentData.creditCard = req.body.creditCard;
          
          if (req.body.creditCardHolderInfo) {
            paymentData.creditCardHolderInfo = req.body.creditCardHolderInfo;
          }
        }
        
        // Criar o pagamento no Asaas
        const payment = await AsaasService.createPayment(paymentData);
        
        // Registrar a transação como pendente
        await storage.createWalletTransaction({
          passengerId,
          amount,
          type: 'deposit',
          description: `Depósito via ${billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 'PIX'}`,
          reference: payment.id,
          status: 'pending',
          createdAt: new Date()
        });
        
        // Se for um pagamento PIX, gerar o QR code
        if (billingType === 'PIX') {
          try {
            const pixData = await AsaasService.generatePixQrCode(payment.id);
            // Combinar os dados do pagamento com os dados do PIX
            return res.status(201).json({
              ...payment,
              pix: pixData
            });
          } catch (pixError) {
            console.error("Erro ao gerar QR Code PIX:", pixError);
            return res.status(201).json(payment); // Retorna só o pagamento sem o PIX
          }
        }
        
        // Retornar os dados do pagamento
        res.status(201).json(payment);
      } else {
        res.status(403).json({ message: "Apenas passageiros podem acessar esta rota" });
      }
    } catch (error) {
      console.error("Erro ao adicionar fundos à carteira:", error);
      res.status(500).json({ 
        message: "Erro ao adicionar fundos à carteira",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  
  // Remover linha duplicada que causa erro de referência
  
  // Rota para verificar o status da conexão WebSocket
  app.get("/api/realtime/status", (req, res) => {
    res.json({ 
      status: "ok",
      message: "WebSocket server is running",
    });
  });
  
  // Rota para obter informações sobre a localização dos motoristas para o mapa de admin
  app.get("/api/admin/driver-locations", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      // Buscar todas as localizações de motoristas
      const locations = await storage.getAllDriverLocations();
      
      // Buscar informações adicionais de cada motorista
      const enhancedLocations = await Promise.all(locations.map(async (location) => {
        try {
          // Obter detalhes do motorista
          const driver = await storage.getUser(location.driverId);
          
          // Obter veículo atual do motorista
          let vehicle = null;
          if (location.vehicleId) {
            vehicle = await storage.getVehicle(location.vehicleId);
          }
          
          return {
            id: location.id,
            driverId: location.driverId,
            driverName: driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() : 'Motorista',
            driverPhone: driver?.phoneNumber || '',
            driverPhoto: driver?.profilePhoto || null,
            vehicle: vehicle ? {
              id: vehicle.id,
              brand: vehicle.brand,
              model: vehicle.model,
              year: vehicle.year,
              plate: vehicle.licensePlate,
              color: vehicle.color
            } : null,
            latitude: location.latitude,
            longitude: location.longitude,
            heading: location.heading,
            speed: location.speed,
            status: location.status,
            lastUpdated: location.lastUpdated,
          };
        } catch (e) {
          console.error(`Erro ao obter dados do motorista para localização ${location.id}:`, e);
          return location;
        }
      }));
      
      res.json(enhancedLocations);
    } catch (error) {
      console.error("Erro ao obter localizações dos motoristas:", error);
      res.status(500).json({ 
        message: "Erro ao obter localizações dos motoristas",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Rota para obter as solicitações de corrida pendentes para o dashboard de admin
  app.get("/api/admin/ride-requests", isAuthenticated, checkAdmin, async (req, res) => {
    try {
      // Filtrar por status, se fornecido
      const status = req.query.status as string;
      
      // Buscar as solicitações de corrida
      let rideRequests;
      if (status) {
        rideRequests = await db.select()
          .from(db.schema.rideRequests)
          .where(eq(db.schema.rideRequests.status, status))
          .orderBy(desc(db.schema.rideRequests.requestTime));
      } else {
        rideRequests = await storage.getPendingRideRequests();
      }
      
      // Enriquecer as solicitações com informações do passageiro e do motorista
      const enhancedRequests = await Promise.all(rideRequests.map(async (request) => {
        try {
          // Obter detalhes do passageiro
          const passenger = await storage.getPassenger(request.passengerId);
          
          // Obter detalhes do motorista, se atribuído
          let driver = null;
          if (request.assignedDriverId) {
            driver = await storage.getUser(request.assignedDriverId);
          }
          
          // Obter tipo de transporte
          let transportType = null;
          if (request.transportTypeId) {
            transportType = await db.select()
              .from(transportTypes)
              .where(eq(transportTypes.id, request.transportTypeId))
              .then(result => result[0] || null);
          }
          
          // Obter categoria de veículo
          let vehicleCategory = null;
          if (request.vehicleCategoryId) {
            vehicleCategory = await db.select()
              .from(vehicleCategories)
              .where(eq(vehicleCategories.id, request.vehicleCategoryId))
              .then(result => result[0] || null);
          }
          
          return {
            id: request.id,
            status: request.status,
            passenger: passenger ? {
              id: passenger.id,
              name: passenger.fullName,
              phone: passenger.phoneNumber,
              photo: passenger.profilePhoto
            } : null,
            driver: driver ? {
              id: driver.id,
              name: `${driver.firstName || ''} ${driver.lastName || ''}`.trim(),
              phone: driver.phoneNumber,
              photo: driver.profilePhoto
            } : null,
            origin: {
              latitude: request.originLatitude,
              longitude: request.originLongitude,
              address: request.originAddress
            },
            destination: {
              latitude: request.destinationLatitude,
              longitude: request.destinationLongitude,
              address: request.destinationAddress
            },
            transportType: transportType ? {
              id: transportType.id,
              name: transportType.name,
              icon: transportType.icon,
              category: transportType.category
            } : null,
            vehicleCategory: vehicleCategory ? {
              id: vehicleCategory.id,
              name: vehicleCategory.name,
              icon: vehicleCategory.icon
            } : null,
            estimatedPrice: request.estimatedPrice,
            estimatedDistance: request.estimatedDistance,
            estimatedDuration: request.estimatedDuration,
            requestTime: request.requestTime,
            acceptTime: request.acceptTime,
            pickupTime: request.pickupTime,
            completeTime: request.completeTime,
            cancelTime: request.cancelTime,
            scheduledTime: request.scheduledTime,
            notes: request.passengerNotes,
            cancellationReason: request.cancellationReason
          };
        } catch (e) {
          console.error(`Erro ao obter dados para solicitação de corrida ${request.id}:`, e);
          return request;
        }
      }));
      
      res.json(enhancedRequests);
    } catch (error) {
      console.error("Erro ao obter solicitações de corrida:", error);
      res.status(500).json({ 
        message: "Erro ao obter solicitações de corrida",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rotas para pedágios
  app.get('/api/toll-booths', async (req: Request, res: Response) => {
    try {
      const tollBooths = await storage.getAllTollBooths();
      res.json(tollBooths);
    } catch (error) {
      console.error('Erro ao buscar pedágios:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.get('/api/toll-booths/highway/:highway', async (req: Request, res: Response) => {
    try {
      const highway = req.params.highway;
      const tollBooths = await storage.getTollBoothsByHighway(highway);
      res.json(tollBooths);
    } catch (error) {
      console.error('Erro ao buscar pedágios por rodovia:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.post('/api/toll-booths/calculate', async (req: Request, res: Response) => {
    try {
      const { coordinates, vehicleType } = req.body;
      
      if (!coordinates || !Array.isArray(coordinates)) {
        return res.status(400).json({ error: 'Coordenadas da rota são obrigatórias' });
      }

      // Encontrar pedágios próximos à rota
      const nearbyTollBooths = await storage.findTollBoothsNearRoute(coordinates, 1); // 1km de raio
      
      // Filtrar pedágios aplicáveis baseado no tipo de veículo
      const applicableTollBooths = nearbyTollBooths.filter(tollBooth => {
        if (!tollBooth.exemptVehicles || tollBooth.exemptVehicles.length === 0) {
          return true; // Se não há isenções, cobra de todos
        }
        
        // Verificar se o tipo de veículo está isento
        const isExempt = tollBooth.exemptVehicles.some(exempt => {
          if (exempt === 'moto' && (vehicleType === 'moto' || vehicleType === 'moto_taxi' || vehicleType === 'moto_flash')) {
            return true;
          }
          return exempt === vehicleType;
        });
        
        return !isExempt;
      });

      // Calcular total de pedágios
      const totalTollValue = applicableTollBooths.reduce((total, toll) => total + toll.value, 0);
      
      res.json({
        tollBooths: applicableTollBooths,
        totalValue: totalTollValue,
        count: applicableTollBooths.length
      });
    } catch (error) {
      console.error('Erro ao calcular pedágios:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Nova rota para calcular pedágios automaticamente baseado na rota do Google Maps
  app.post('/api/toll-booths/calculate-route', async (req: Request, res: Response) => {
    try {
      const { origin, destination, vehicleType } = req.body;
      
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origem e destino são obrigatórios' });
      }

      if (!vehicleType) {
        return res.status(400).json({ error: 'Tipo de veículo é obrigatório' });
      }

      // Importar TollService
      const { TollService } = await import('./toll-service');
      
      // Calcular pedágios para a rota
      const tollResult = await TollService.calculateTollsForRoute(origin, destination, vehicleType);
      
      res.json(tollResult);
    } catch (error) {
      console.error('Erro ao calcular pedágios para rota:', error);
      res.status(500).json({ 
        error: 'Erro ao calcular pedágios para a rota',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rotas administrativas para pedágios (apenas admin)
  app.post('/api/admin/toll-booths', checkAdmin, async (req: Request, res: Response) => {
    try {
      const tollBoothData = req.body;
      const tollBooth = await storage.createTollBooth(tollBoothData);
      res.json(tollBooth);
    } catch (error) {
      console.error('Erro ao criar pedágio:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.put('/api/admin/toll-booths/:id', checkAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      const tollBooth = await storage.updateTollBooth(id, updateData);
      
      if (!tollBooth) {
        return res.status(404).json({ error: 'Pedágio não encontrado' });
      }
      
      res.json(tollBooth);
    } catch (error) {
      console.error('Erro ao atualizar pedágio:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  app.delete('/api/admin/toll-booths/:id', checkAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTollBooth(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao deletar pedágio:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ===== ROTAS DE CÁLCULO DE ROTA EM TEMPO REAL =====
  
  // Calcular rota em tempo real com trânsito, clima e outros fatores
  app.post('/api/routes/calculate', async (req: Request, res: Response) => {
    try {
      const { origin, destination, waypoints, vehicleType, departureTime } = req.body;
      
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origem e destino são obrigatórios' });
      }
      
      const routeRequest = {
        origin,
        destination,
        waypoints,
        vehicleType,
        departureTime
      };
      
      const result = await RouteService.calculateRoute(routeRequest);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json(result.data);
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Obter rotas alternativas
  app.post('/api/routes/alternatives', async (req: Request, res: Response) => {
    try {
      const { origin, destination, waypoints, vehicleType, departureTime } = req.body;
      
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origem e destino são obrigatórios' });
      }
      
      const routeRequest = {
        origin,
        destination,
        waypoints,
        vehicleType,
        departureTime
      };
      
      const alternatives = await RouteService.getAlternativeRoutes(routeRequest);
      
      res.json({ routes: alternatives });
    } catch (error) {
      console.error('Erro ao obter rotas alternativas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ===== ROTAS DE TABELA DE PREÇOS =====
  
  // Rota para obter dados da tabela de preços de passageiros
  app.get('/api/pricing/passenger', async (req: Request, res: Response) => {
    try {
      // Buscar dados da tabela de preços no banco de dados
      const dbPricingData = await db.query.pricingTables.findMany({
        where: (pricingTables, { eq }) => eq(pricingTables.tableType, 'passenger'),
        orderBy: (pricingTables, { asc }) => [asc(pricingTables.id)]
      });

      // Se não há dados no banco, inserir dados padrão
      if (dbPricingData.length === 0) {
        console.log('Tabela de preços vazia, inserindo dados padrão...');
        
        const defaultPricingData = [
          {
            tableType: 'passenger',
            region: 'Campinas/SP',
            vehicleType: 'Moto táxi',
            basePrice: 4.25,
            priceUpTo16km: 0.23,
            priceAbove16km: 0.10,
            pricePerMinute: 0.12,
            creditCardFee: 0.50,
            creditCardPercent: 3,
            appProfit: 15,
            taxes: 14,
            additionalStop: 0.00,
            minValue: 6.00
          },
          {
            tableType: 'passenger',
            region: 'Campinas/SP',
            vehicleType: 'Carro Hatch',
            basePrice: 5.50,
            priceUpTo16km: 0.35,
            priceAbove16km: 0.15,
            pricePerMinute: 0.18,
            creditCardFee: 0.75,
            creditCardPercent: 3,
            appProfit: 15,
            taxes: 14,
            additionalStop: 1.50,
            minValue: 10.00
          },
          {
            tableType: 'passenger',
            region: 'Campinas/SP',
            vehicleType: 'Carro Sedan',
            basePrice: 7.00,
            priceUpTo16km: 0.45,
            priceAbove16km: 0.20,
            pricePerMinute: 0.25,
            creditCardFee: 1.00,
            creditCardPercent: 3,
            appProfit: 15,
            taxes: 14,
            additionalStop: 2.00,
            minValue: 15.00
          }
        ];

        console.log('Inserindo dados padrão no banco:', defaultPricingData);
        const insertResult = await db.insert(pricingTables).values(defaultPricingData).returning();
        console.log('Dados inseridos com sucesso:', insertResult);
        
        // Buscar novamente os dados inseridos
        const insertedData = await db.query.pricingTables.findMany({
          where: (pricingTables, { eq }) => eq(pricingTables.tableType, 'passenger'),
          orderBy: (pricingTables, { asc }) => [asc(pricingTables.id)]
        });
        
        // Converter para formato esperado pelo frontend
        const pricingData = insertedData.map(item => ({
          tipo_de_veiculo: item.vehicleType,
          valor_base: `R$ ${item.basePrice.toFixed(2).replace('.', ',')}`,
          ate_16_km_passageiro: `R$ ${item.priceUpTo16km.toFixed(2).replace('.', ',')}`,
          acima_de_16_km: `R$ ${item.priceAbove16km.toFixed(2).replace('.', ',')}`,
          valor_do_minuto_passageiro: `R$ ${item.pricePerMinute.toFixed(2).replace('.', ',')}`,
          cartao_credito_a_vista: `R$ ${item.creditCardFee.toFixed(2).replace('.', ',')}`,
          cartao_credito_a_vista_p: `${item.creditCardPercent}%`,
          lucro_app_passageiro: `${item.appProfit}%`,
          impostos_passageiros: `${item.taxes}%`,
          parada_adicional_pass: item.additionalStop
        }));
        
        return res.json(pricingData);
      }

      // Converter dados do banco para formato esperado pelo frontend
      const pricingData = dbPricingData.map(item => ({
        tipo_de_veiculo: item.vehicleType,
        valor_base: `R$ ${item.basePrice.toFixed(2).replace('.', ',')}`,
        ate_16_km_passageiro: `R$ ${item.priceUpTo16km.toFixed(2).replace('.', ',')}`,
        acima_de_16_km: `R$ ${item.priceAbove16km.toFixed(2).replace('.', ',')}`,
        valor_do_minuto_passageiro: `R$ ${item.pricePerMinute.toFixed(2).replace('.', ',')}`,
        cartao_credito_a_vista: `R$ ${item.creditCardFee.toFixed(2).replace('.', ',')}`,
        cartao_credito_a_vista_p: `${item.creditCardPercent}%`,
        lucro_app_passageiro: `${item.appProfit}%`,
        impostos_passageiros: `${item.taxes}%`,
        parada_adicional_pass: item.additionalStop
      }));
      
      res.json(pricingData);
    } catch (error) {
      console.error('Erro ao buscar dados de preços:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ===== ROTAS DE CONFIGURAÇÕES PERMANENTES NO BANCO =====
  
  // Salvar configurações de preços no banco de dados
  app.post('/api/admin/pricing-tables/save', checkAdmin, async (req: Request, res: Response) => {
    try {
      const { tableType, pricingData } = req.body;
      
      if (!tableType || !pricingData) {
        return res.status(400).json({ error: 'Tipo de tabela e dados são obrigatórios' });
      }

      // Limpar tabelas existentes do mesmo tipo
      await db.delete(pricingTables).where(eq(pricingTables.tableType, tableType));

      // Inserir novos dados
      const insertData = pricingData.map((item: any) => ({
        tableType,
        region: item.regiao || 'Default',
        vehicleType: item.tipo_de_veiculo,
        basePrice: parseFloat(item.valor_base?.replace(/[R$\s,]/g, '').replace('.', ',')) || 0,
        priceUpTo16km: parseFloat(item.ate_16_km_passageiro?.replace(/[R$\s,]/g, '').replace('.', ',')) || 0,
        priceAbove16km: parseFloat(item.acima_de_16_km?.replace(/[R$\s,]/g, '').replace('.', ',')) || 0,
        pricePerMinute: parseFloat(item.valor_do_minuto_passageiro?.replace(/[R$\s,]/g, '').replace('.', ',')) || 0,
        creditCardFee: parseFloat(item.cartao_credito_a_vista?.replace(/[R$\s,]/g, '').replace('.', ',')) || 0,
        creditCardPercent: parseFloat(item.cartao_credito_a_vista_p?.replace(/[%\s]/g, '')) || 0,
        appProfit: parseFloat(item.lucro_app_passageiro?.replace(/[%\s]/g, '')) || 0,
        taxes: parseFloat(item.impostos_passageiros?.replace(/[%\s]/g, '')) || 0,
        additionalStop: parseFloat(item.parada_adicional?.replace(/[R$\s,]/g, '').replace('.', ',')) || 0,
        minValue: parseFloat(item.valor_minimo?.replace(/[R$\s,]/g, '').replace('.', ',')) || 0
      }));

      const result = await db.insert(pricingTables).values(insertData).returning();
      
      res.json({ 
        success: true, 
        message: `${result.length} registros salvos no banco de dados`,
        data: result 
      });
    } catch (error) {
      console.error('Erro ao salvar configurações no banco:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Carregar configurações de preços do banco de dados
  app.get('/api/admin/pricing-tables/:tableType', checkAdmin, async (req: Request, res: Response) => {
    try {
      const { tableType } = req.params;
      
      const data = await db.select().from(pricingTables)
        .where(eq(pricingTables.tableType, tableType))
        .orderBy(pricingTables.vehicleType);

      // Converter de volta para o formato esperado pelo frontend
      const formattedData = data.map(item => ({
        id: item.id,
        tipo_de_veiculo: item.vehicleType,
        regiao: item.region,
        valor_base: `R$ ${item.basePrice?.toFixed(2).replace('.', ',')}`,
        ate_16_km_passageiro: `R$ ${item.priceUpTo16km?.toFixed(2).replace('.', ',')}`,
        acima_de_16_km: `R$ ${item.priceAbove16km?.toFixed(2).replace('.', ',')}`,
        valor_do_minuto_passageiro: `R$ ${item.pricePerMinute?.toFixed(2).replace('.', ',')}`,
        cartao_credito_a_vista: `R$ ${item.creditCardFee?.toFixed(2).replace('.', ',')}`,
        cartao_credito_a_vista_p: `${item.creditCardPercent?.toFixed(1)}%`,
        lucro_app_passageiro: `${item.appProfit?.toFixed(1)}%`,
        impostos_passageiros: `${item.taxes?.toFixed(1)}%`,
        parada_adicional: `R$ ${item.additionalStop?.toFixed(2).replace('.', ',')}`,
        valor_minimo: `R$ ${item.minValue?.toFixed(2).replace('.', ',')}`
      }));

      res.json(formattedData);
    } catch (error) {
      console.error('Erro ao carregar configurações do banco:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ===== ROTAS DE EXPORTAÇÃO/IMPORTAÇÃO =====
  
  // Exportar configurações
  app.post('/api/admin/export-config', checkAdmin, async (req: Request, res: Response) => {
    try {
      const { name, description, exportType } = req.body;
      const userId = (req as any).user?.id;

      // Coletar dados conforme o tipo de exportação
      let configData: any = {};

      if (exportType === 'full' || exportType === 'pricing_only') {
        // Exportar tabelas de preços
        const passengerPricing = await db.select().from(pricingTables)
          .where(eq(pricingTables.tableType, 'passenger'));
        const deliveryPricing = await db.select().from(pricingTables)
          .where(eq(pricingTables.tableType, 'delivery'));
        const towingPricing = await db.select().from(pricingTables)
          .where(eq(pricingTables.tableType, 'towing'));

        configData.pricing = {
          passenger: passengerPricing,
          delivery: deliveryPricing,
          towing: towingPricing
        };
      }

      if (exportType === 'full') {
        // Adicionar outras configurações se necessário
        configData.metadata = {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          exportedBy: userId
        };
      }

      // Salvar no banco
      const [exportRecord] = await db.insert(configurationExports).values({
        name,
        description,
        exportType,
        configData,
        createdBy: userId
      }).returning();

      res.json({
        success: true,
        export: exportRecord,
        downloadData: configData
      });
    } catch (error) {
      console.error('Erro ao exportar configurações:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Importar configurações
  app.post('/api/admin/import-config', checkAdmin, async (req: Request, res: Response) => {
    try {
      const { configData, importType } = req.body;
      
      if (!configData) {
        return res.status(400).json({ error: 'Dados de configuração são obrigatórios' });
      }

      let importedCount = 0;

      if (importType === 'full' || importType === 'pricing_only') {
        // Importar tabelas de preços
        if (configData.pricing) {
          for (const [tableType, data] of Object.entries(configData.pricing)) {
            if (Array.isArray(data) && data.length > 0) {
              // Limpar dados existentes
              await db.delete(pricingTables).where(eq(pricingTables.tableType, tableType));
              
              // Inserir novos dados
              await db.insert(pricingTables).values(data);
              importedCount += data.length;
            }
          }
        }
      }

      res.json({
        success: true,
        message: `${importedCount} registros importados com sucesso`
      });
    } catch (error) {
      console.error('Erro ao importar configurações:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Listar exportações disponíveis
  app.get('/api/admin/exports', checkAdmin, async (req: Request, res: Response) => {
    try {
      const exports = await db.select().from(configurationExports)
        .orderBy(desc(configurationExports.createdAt));
      
      res.json(exports);
    } catch (error) {
      console.error('Erro ao listar exportações:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Baixar exportação específica
  app.get('/api/admin/exports/:id/download', checkAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const [exportRecord] = await db.select().from(configurationExports)
        .where(eq(configurationExports.id, parseInt(id)));

      if (!exportRecord) {
        return res.status(404).json({ error: 'Exportação não encontrada' });
      }

      res.json({
        success: true,
        data: exportRecord.configData,
        metadata: {
          name: exportRecord.name,
          description: exportRecord.description,
          exportType: exportRecord.exportType,
          createdAt: exportRecord.createdAt
        }
      });
    } catch (error) {
      console.error('Erro ao baixar exportação:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ===== ROTAS PARA UPLOAD DE DOCUMENTOS E GERENCIAMENTO =====
  
  // Upload de documento CNH
  app.post('/api/admin/drivers/:driverId/cnh-document', checkAdmin, upload.single('cnhDocument'), async (req: Request, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
      }

      const documentUrl = `/uploads/${req.file.filename}`;
      
      // Atualizar banco de dados com URL do documento
      await db.update(users).set({
        cnhDocumentUrl: documentUrl
      }).where(eq(users.id, driverId));

      res.json({
        success: true,
        documentUrl,
        message: 'Documento CNH enviado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao fazer upload de CNH:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Atualizar data de bloqueio CNH
  app.patch('/api/admin/drivers/:driverId/cnh-block-date', checkAdmin, async (req: Request, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      const { cnhBlockDate } = req.body;
      
      await db.update(users).set({
        cnhBlockDate: cnhBlockDate ? new Date(cnhBlockDate) : null
      }).where(eq(users.id, driverId));

      res.json({
        success: true,
        message: 'Data de bloqueio CNH atualizada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar data de bloqueio CNH:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Upload de documento CRLV
  app.post('/api/admin/vehicles/:vehicleId/crlv-document', checkAdmin, upload.single('crlvDocument'), async (req: Request, res: Response) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);
      
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
      }

      const documentUrl = `/uploads/${req.file.filename}`;
      
      // Atualizar banco de dados com URL do documento
      await db.update(vehicles).set({
        crlvDocumentUrl: documentUrl
      }).where(eq(vehicles.id, vehicleId));

      res.json({
        success: true,
        documentUrl,
        message: 'Documento CRLV enviado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao fazer upload de CRLV:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Atualizar data de bloqueio CRLV
  app.patch('/api/admin/vehicles/:vehicleId/crlv-block-date', checkAdmin, async (req: Request, res: Response) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);
      const { crlvBlockDate } = req.body;
      
      await db.update(vehicles).set({
        crlvBlockDate: crlvBlockDate ? new Date(crlvBlockDate) : null
      }).where(eq(vehicles.id, vehicleId));

      res.json({
        success: true,
        message: 'Data de bloqueio CRLV atualizada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar data de bloqueio CRLV:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para atualizar vencimento do CRLV automaticamente
  app.patch('/api/admin/vehicles/:vehicleId/crlv-expiration', checkAdmin, async (req: Request, res: Response) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);
      const { crlvExpiration } = req.body;
      
      await db.update(vehicles).set({
        crlvExpiration: crlvExpiration
      }).where(eq(vehicles.id, vehicleId));

      res.json({
        success: true,
        message: 'Vencimento do CRLV atualizado com sucesso',
        data: { crlvExpiration }
      });
    } catch (error) {
      console.error('Erro ao atualizar vencimento do CRLV:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para bloquear motorista com histórico
  app.patch('/api/admin/drivers/:driverId/block', checkAdmin, async (req: Request, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      const { reason } = req.body;
      
      if (!reason || reason.trim() === '') {
        return res.status(400).json({ error: 'Motivo do bloqueio é obrigatório' });
      }

      // Buscar status atual do motorista
      const currentDriver = await db.select().from(users).where(eq(users.id, driverId)).limit(1);
      
      if (currentDriver.length === 0) {
        return res.status(404).json({ error: 'Motorista não encontrado' });
      }

      const previousStatus = currentDriver[0].status;
      
      // Atualizar status do motorista para bloqueado
      await db.update(users).set({
        status: 'blocked'
      }).where(eq(users.id, driverId));

      // Registrar no histórico
      // Se for superadmin, não incluir performedBy (deixar null)
      const performedBy = (req.user as any).userType === 'superadmin' ? null : (req.user as any).id;
      
      await db.insert(vehicleBlockHistory).values({
        driverId: driverId,
        action: 'block',
        reason: reason.trim(),
        performedBy: performedBy
      });

      res.json({
        success: true,
        message: 'Motorista bloqueado com sucesso',
        data: { driverId, newStatus: 'blocked', reason }
      });
    } catch (error) {
      console.error('Erro ao bloquear motorista:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para desbloquear motorista com histórico
  app.patch('/api/admin/drivers/:driverId/unblock', checkAdmin, async (req: Request, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      const { reason } = req.body;
      
      if (!reason || reason.trim() === '') {
        return res.status(400).json({ error: 'Motivo do desbloqueio é obrigatório' });
      }

      // Buscar status atual do motorista
      const currentDriver = await db.select().from(users).where(eq(users.id, driverId)).limit(1);
      
      if (currentDriver.length === 0) {
        return res.status(404).json({ error: 'Motorista não encontrado' });
      }

      const previousStatus = currentDriver[0].status;
      
      // Atualizar status do motorista para ativo
      await db.update(users).set({
        status: 'active'
      }).where(eq(users.id, driverId));

      // Registrar no histórico
      // Se for superadmin, não incluir performedBy (deixar null)
      const performedBy = (req.user as any).userType === 'superadmin' ? null : (req.user as any).id;
      
      await db.insert(vehicleBlockHistory).values({
        driverId: driverId,
        action: 'unblock',
        reason: reason.trim(),
        performedBy: performedBy
      });

      res.json({
        success: true,
        message: 'Motorista desbloqueado com sucesso',
        data: { driverId, newStatus: 'active', reason }
      });
    } catch (error) {
      console.error('Erro ao desbloquear motorista:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota para buscar histórico de bloqueios de um motorista
  app.get('/api/admin/drivers/:driverId/block-history', checkAdmin, async (req: Request, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      
      const history = await db.select().from(vehicleBlockHistory)
        .where(eq(vehicleBlockHistory.driverId, driverId))
        .orderBy(vehicleBlockHistory.timestamp);

      res.json(history);
    } catch (error) {
      console.error('Erro ao buscar histórico de bloqueios:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Serviço de arquivos estáticos para documentos
  app.use('/uploads', express.static(uploadDirectory));

  // ===== FUNÇÃO PARA VERIFICAR E BLOQUEAR DOCUMENTOS VENCIDOS =====
  
  // Função para verificar documentos vencidos e aplicar bloqueios automáticos
  const checkExpiredDocuments = async () => {
    try {
      const now = new Date();
      
      // Verificar CNHs vencidas
      const driversWithExpiredCnh = await db.select().from(users)
        .leftJoin(vehicles, eq(users.id, vehicles.userId))
        .where(eq(users.type, 'driver'));

      for (const driver of driversWithExpiredCnh) {
        const cnhBlockDate = driver.users.cnhBlockDate;
        
        // Se a CNH venceu, bloquear o motorista
        if (cnhBlockDate && cnhBlockDate <= now && driver.users.status !== 'blocked') {
          await db.update(users).set({
            status: 'blocked'
          }).where(eq(users.id, driver.users.id));
          
          console.log(`Motorista ${driver.users.id} bloqueado por CNH vencida`);
        }
      }

      // Verificar CRLVs vencidos
      const vehiclesWithExpiredCrlv = await db.select().from(vehicles)
        .innerJoin(users, eq(vehicles.userId, users.id))
        .where(eq(users.userType, 'driver'));

      for (const vehicleData of vehiclesWithExpiredCrlv) {
        const crlvBlockDate = vehicleData.vehicles.crlvBlockDate;
        const driverId = vehicleData.users.id;
        
        // Se o CRLV venceu, bloquear o veículo
        if (crlvBlockDate && crlvBlockDate <= now && vehicleData.vehicles.vehicleStatus !== 'blocked') {
          await db.update(vehicles).set({
            vehicleStatus: 'blocked'
          }).where(eq(vehicles.id, vehicleData.vehicles.id));
          
          console.log(`Veículo ${vehicleData.vehicles.id} bloqueado por CRLV vencido`);
          
          // Verificar se o motorista tem apenas um veículo
          const driverVehicles = await db.select().from(vehicles)
            .where(eq(vehicles.userId, driverId));
          
          // Se tem apenas um veículo e ele foi bloqueado, bloquear o motorista também
          if (driverVehicles.length === 1) {
            await db.update(users).set({
              status: 'blocked'
            }).where(eq(users.id, driverId));
            
            console.log(`Motorista ${driverId} bloqueado por ter apenas um veículo com CRLV vencido`);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar documentos vencidos:', error);
    }
  };

  // Executar verificação de documentos vencidos a cada hora - temporariamente desabilitado
  // setInterval(checkExpiredDocuments, 60 * 60 * 1000); // 1 hora
  
  // Executar verificação inicial - temporariamente desabilitado
  // checkExpiredDocuments();

  // ===== ENDPOINTS PARA TESTE DA API ASAAS =====
  
  // Teste de conexão com API Asaas
  app.get('/api/admin/asaas/test', checkAdmin, async (req: Request, res: Response) => {
    try {
      console.log('Testando conexão com API Asaas...');
      
      // Testar conexão básica
      const response = await AsaasService.getPayments({ limit: 1 });
      
      res.json({
        success: true,
        message: 'Conexão com Asaas funcionando corretamente',
        data: response
      });
    } catch (error: any) {
      console.error('Erro ao testar conexão Asaas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro na conexão com Asaas',
        error: error.message
      });
    }
  });

  // Criar cliente de teste no Asaas
  app.post('/api/admin/asaas/test-customer', checkAdmin, async (req: Request, res: Response) => {
    try {
      const testCustomer = {
        name: 'Cliente Teste Serv Motors',
        email: 'teste@servmotors.com',
        cpfCnpj: '11144477735', // CPF válido para teste
        phone: '1134567890',
        mobilePhone: '11987654321'
      };

      console.log('Criando cliente de teste no Asaas:', testCustomer);
      
      const customer = await AsaasService.createCustomer(testCustomer);
      
      res.json({
        success: true,
        message: 'Cliente de teste criado com sucesso',
        customer
      });
    } catch (error: any) {
      console.error('Erro ao criar cliente de teste:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar cliente de teste',
        error: error.message
      });
    }
  });

  // Webhook do Asaas para receber notificações de pagamento
  app.post('/api/asaas/webhook', async (req: Request, res: Response) => {
    try {
      const { event, payment } = req.body;
      
      console.log('Webhook Asaas recebido:', { event, paymentId: payment?.id });
      
      if (event === 'PAYMENT_RECEIVED' && payment) {
        // Buscar o pagamento no banco de dados usando externalReference
        const [existingPayment] = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.asaasPaymentId, payment.id))
          .limit(1);

        if (existingPayment) {
          // Atualizar status do pagamento
          await db.update(walletTransactions).set({
            status: 'completed'
          }).where(eq(walletTransactions.id, existingPayment.id));
          
          console.log(`Pagamento ${existingPayment.id} marcado como concluído`);
        }
      } else if (event === 'PAYMENT_OVERDUE' && payment) {
        // Pagamento vencido
        const [existingPayment] = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.asaasPaymentId, payment.id))
          .limit(1);

        if (existingPayment) {
          await db.update(walletTransactions).set({
            status: 'failed'
          }).where(eq(walletTransactions.id, existingPayment.id));
          
          console.log(`Pagamento ${existingPayment.id} marcado como falhou`);
        }
      }
      
      // Sempre responder com sucesso para o webhook
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Erro ao processar webhook Asaas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // ===== ROTAS DE PARCEIROS =====
  
  // Verificar se o sistema de parceiros está habilitado
  app.get("/api/partners/settings", async (req: Request, res: Response) => {
    try {
      const [settings] = await db.select().from(partnerSettings).limit(1);
      if (!settings) {
        // Criar configuração padrão se não existir
        const [newSettings] = await db.insert(partnerSettings)
          .values({ isEnabled: false, monthlyFreePromotions: 3 })
          .returning();
        return res.json(newSettings);
      }
      res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações de parceiros:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Rota para administradores acessarem configurações
  app.get("/api/admin/partners/settings", checkAdmin, async (req: Request, res: Response) => {
    try {
      const [settings] = await db.select().from(partnerSettings).limit(1);
      if (!settings) {
        // Criar configuração padrão se não existir
        const [newSettings] = await db.insert(partnerSettings)
          .values({ isEnabled: false, monthlyFreePromotions: 3 })
          .returning();
        return res.json(newSettings);
      }
      res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações de parceiros:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar configurações do sistema de parceiros (somente admin)
  app.patch("/api/admin/partners/settings", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { isEnabled, monthlyFreePromotions } = req.body;
      
      console.log("Recebendo dados para atualizar:", { isEnabled, monthlyFreePromotions });
      
      // Verificar se existe configuração
      const [existingSettings] = await db.select().from(partnerSettings).limit(1);
      
      if (!existingSettings) {
        // Criar nova configuração
        const [newSettings] = await db.insert(partnerSettings)
          .values({ 
            isEnabled: isEnabled ?? false, 
            monthlyFreePromotions: monthlyFreePromotions ?? 3,
            updatedAt: new Date()
          })
          .returning();
        console.log("Nova configuração criada:", newSettings);
        return res.json(newSettings);
      } else {
        // Atualizar configuração existente
        const updateData: any = { updatedAt: new Date() };
        if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
        if (monthlyFreePromotions !== undefined) updateData.monthlyFreePromotions = monthlyFreePromotions;
        
        console.log("Atualizando com dados:", updateData);
        
        const [updatedSettings] = await db.update(partnerSettings)
          .set(updateData)
          .where(eq(partnerSettings.id, existingSettings.id))
          .returning();
        
        console.log("Configuração atualizada:", updatedSettings);
        res.json(updatedSettings);
      }
    } catch (error) {
      console.error("Erro ao atualizar configurações de parceiros:", error);
      console.error("Stack trace:", error);
      res.status(500).json({ message: "Erro interno do servidor", error: error.message });
    }
  });

  // Cadastrar novo parceiro
  app.post("/api/partners", async (req: Request, res: Response) => {
    try {
      const partnerData = insertPartnerSchema.parse(req.body);
      
      // Verificar se o sistema está habilitado
      const [settings] = await db.select().from(partnerSettings).limit(1);
      if (!settings || !settings.isEnabled) {
        return res.status(400).json({ message: "Sistema de parceiros não está disponível no momento" });
      }

      // Verificar se CNPJ já existe
      const existingPartner = await db.select()
        .from(partners)
        .where(eq(partners.cnpj, partnerData.cnpj))
        .limit(1);
      
      if (existingPartner.length > 0) {
        return res.status(400).json({ message: "CNPJ já cadastrado" });
      }

      const [partner] = await db.insert(partners).values(partnerData).returning();
      res.status(201).json(partner);
    } catch (error) {
      console.error("Erro ao cadastrar parceiro:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Upload de foto do estabelecimento
  app.post("/api/uploads/establishmentPhoto", upload.single("establishmentPhoto"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhuma foto foi enviada" });
      }
      res.json({ filePath: `/uploads/${req.file.filename}` });
    } catch (error) {
      console.error("Erro no upload da foto:", error);
      res.status(500).json({ message: "Erro no upload da foto" });
    }
  });

  // ===== ROTAS DE CHAT =====
  
  // Buscar mensagens do chat de uma corrida
  app.get("/api/rides/:rideId/chat", async (req: Request, res: Response) => {
    try {
      const { rideId } = req.params;
      
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const messages = await db.select()
        .from(rideChats)
        .where(eq(rideChats.rideId, parseInt(rideId)))
        .orderBy(rideChats.createdAt);

      res.json(messages);
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Enviar mensagem de texto
  app.post("/api/rides/:rideId/chat", async (req: Request, res: Response) => {
    try {
      const { rideId } = req.params;
      const { message, receiverId } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const [chatMessage] = await db.insert(rideChats).values({
        rideId: parseInt(rideId),
        senderId: req.user.id,
        receiverId,
        message,
        messageType: "text"
      }).returning();

      res.status(201).json(chatMessage);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Upload e envio de áudio
  app.post("/api/rides/:rideId/chat/audio", upload.single("audio"), async (req: Request, res: Response) => {
    try {
      const { rideId } = req.params;
      const { receiverId } = req.body;
      
      if (!req.user || !req.file) {
        return res.status(400).json({ message: "Dados inválidos" });
      }

      const audioUrl = `/uploads/${req.file.filename}`;

      const [chatMessage] = await db.insert(rideChats).values({
        rideId: parseInt(rideId),
        senderId: req.user.id,
        receiverId: parseInt(receiverId),
        message: "Mensagem de áudio",
        messageType: "audio",
        audioUrl
      }).returning();

      res.status(201).json(chatMessage);
    } catch (error) {
      console.error("Erro ao enviar áudio:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Marcar mensagens como lidas
  app.patch("/api/rides/:rideId/chat/read", async (req: Request, res: Response) => {
    try {
      const { rideId } = req.params;
      
      if (!req.user) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      await db.update(rideChats)
        .set({ isRead: true })
        .where(and(
          eq(rideChats.rideId, parseInt(rideId)),
          eq(rideChats.receiverId, req.user.id)
        ));

      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Gravar áudio durante corrida
  app.post("/api/rides/:rideId/audio-recording", upload.single("audio"), async (req: Request, res: Response) => {
    try {
      const { rideId } = req.params;
      const { duration } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum áudio foi enviado" });
      }

      const audioUrl = `/uploads/${req.file.filename}`;

      // For now, just return success since table creation is pending
      res.status(201).json({ 
        id: Date.now(),
        rideId: parseInt(rideId),
        audioUrl,
        duration: parseInt(duration) || null,
        createdAt: new Date()
      });
    } catch (error) {
      console.error("Erro ao salvar gravação:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS DE CUPONS =====

  // Buscar configurações do sistema de cupons
  app.get("/api/admin/coupons/settings", checkAdmin, async (req: Request, res: Response) => {
    try {
      res.json({ isEnabled: true });
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar configurações do sistema de cupons
  app.patch("/api/admin/coupons/settings", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { isEnabled } = req.body;
      res.json({ isEnabled });
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar cupons
  app.get("/api/admin/coupons", checkAdmin, async (req: Request, res: Response) => {
    try {
      res.json([]);
    } catch (error) {
      console.error("Erro ao buscar cupons:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar estatísticas de cupons
  app.get("/api/admin/coupons/stats", checkAdmin, async (req: Request, res: Response) => {
    try {
      res.json({
        totalCoupons: 0,
        activeCoupons: 0,
        monthlyUses: 0,
        totalDiscount: 0
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Criar cupom
  app.post("/api/admin/coupons", checkAdmin, async (req: Request, res: Response) => {
    try {
      const couponData = req.body;
      res.status(201).json({ id: Date.now(), ...couponData, createdAt: new Date() });
    } catch (error) {
      console.error("Erro ao criar cupom:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar cupom
  app.put("/api/admin/coupons/:id", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const couponData = req.body;
      res.json({ id: parseInt(id), ...couponData });
    } catch (error) {
      console.error("Erro ao atualizar cupom:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Ativar/desativar cupom
  app.patch("/api/admin/coupons/:id/toggle", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      res.json({ id: parseInt(id), isActive });
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Excluir cupom
  app.delete("/api/admin/coupons/:id", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      res.json({ message: "Cupom excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir cupom:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS DE SUPER ADMIN =====

  // Login Super Admin (temporário para acesso inicial)
  app.post("/api/superadmin/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      // Credenciais temporárias para acesso inicial
      if (email === "superadmin@servmotors.com" && password === "SuperAdmin2024#") {
        const superAdminUser = {
          id: 999999,
          email: "superadmin@servmotors.com",
          userType: "superadmin",
          fullName: "Super Administrador",
          isActive: true
        };
        
        // Simular login
        req.login(superAdminUser, (err) => {
          if (err) {
            return res.status(500).json({ message: "Erro no login" });
          }
          res.json({ 
            user: superAdminUser,
            message: "Login realizado com sucesso" 
          });
        });
      } else {
        res.status(401).json({ message: "Credenciais inválidas" });
      }
    } catch (error) {
      console.error("Erro no login super admin:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar permissões
  app.get("/api/superadmin/permissions", async (req: Request, res: Response) => {
    try {
      const permissions = [
        { name: "manage_drivers", description: "Gerenciar motoristas", category: "drivers" },
        { name: "manage_passengers", description: "Gerenciar passageiros", category: "passengers" },
        { name: "manage_pricing", description: "Gerenciar preços", category: "pricing" },
        { name: "manage_partners", description: "Gerenciar parceiros", category: "partners" },
        { name: "manage_coupons", description: "Gerenciar cupons", category: "coupons" },
        { name: "manage_investors", description: "Gerenciar investidores", category: "investors" },
        { name: "view_reports", description: "Visualizar relatórios", category: "reports" },
        { name: "manage_financial", description: "Gerenciar financeiro", category: "financial" }
      ];
      res.json(permissions);
    } catch (error) {
      console.error("Erro ao buscar permissões:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar administradores
  app.get("/api/superadmin/admins", async (req: Request, res: Response) => {
    try {
      const adminUsers = await db.select().from(users).where(eq(users.type, 'admin'));
      
      const formattedAdmins = adminUsers.map(admin => ({
        id: admin.id,
        fullName: `${admin.firstName} ${admin.lastName}`.trim(),
        email: admin.email,
        status: admin.status,
        createdAt: admin.createdAt,
        permissions: {} // Permissões podem ser expandidas posteriormente
      }));
      
      res.json(formattedAdmins);
    } catch (error) {
      console.error("Erro ao buscar administradores:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Criar administrador
  app.post("/api/superadmin/admins", async (req: Request, res: Response) => {
    try {
      const { fullName, email, password, permissions } = req.body;
      
      // Hash da senha
      const hashedPassword = await hashPassword(password);
      
      // Criar usuário admin no banco
      const [newAdmin] = await db.insert(users).values({
        firstName: fullName.split(' ')[0],
        lastName: fullName.split(' ').slice(1).join(' ') || '',
        email: email,
        password: hashedPassword,
        phoneNumber: '',
        type: 'admin',
        approved: true,
        status: 'active'
      }).returning();

      res.status(201).json({ 
        id: newAdmin.id,
        fullName: fullName,
        email: email,
        permissions: permissions,
        status: "active",
        createdAt: new Date() 
      });
    } catch (error) {
      console.error("Erro ao criar administrador:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar status do administrador
  app.patch("/api/superadmin/admins/:id/status", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      res.json({ id: parseInt(id), status });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar permissões do administrador
  app.patch("/api/superadmin/admins/:id/permissions", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;
      res.json({ id: parseInt(id), permissions });
    } catch (error) {
      console.error("Erro ao atualizar permissões:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS DE CONTATOS DE EMERGÊNCIA =====

  // Buscar contatos de emergência do usuário
  app.get("/api/emergency-contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      // Buscar contatos do usuário
      let contacts = [];
      if (req.user?.type === 'driver') {
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (user.length > 0) {
          contacts = user[0].emergencyContacts || [];
        }
      } else if (req.user?.type === 'passenger') {
        const passenger = await db.select().from(passengers).where(eq(passengers.id, userId)).limit(1);
        if (passenger.length > 0) {
          contacts = passenger[0].emergencyContacts || [];
        }
      }

      res.json(contacts);
    } catch (error) {
      console.error("Erro ao buscar contatos de emergência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Adicionar novo contato de emergência
  app.post("/api/emergency-contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { name, phone, relationship, notes, isPrimary } = req.body;
      
      if (!name || !phone || !relationship) {
        return res.status(400).json({ message: "Nome, telefone e relacionamento são obrigatórios" });
      }

      const newContact = {
        id: Date.now().toString(),
        name,
        phone,
        relationship,
        notes: notes || "",
        isPrimary: isPrimary || false
      };

      // Adicionar contato baseado no tipo de usuário
      if (req.user?.type === 'driver') {
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (user.length > 0) {
          const contacts = user[0].emergencyContacts || [];
          contacts.push(newContact);
          await db.update(users).set({ emergencyContacts: contacts }).where(eq(users.id, userId));
        }
      } else if (req.user?.type === 'passenger') {
        const passenger = await db.select().from(passengers).where(eq(passengers.id, userId)).limit(1);
        if (passenger.length > 0) {
          const contacts = passenger[0].emergencyContacts || [];
          contacts.push(newContact);
          await db.update(passengers).set({ emergencyContacts: contacts }).where(eq(passengers.id, userId));
        }
      }

      res.status(201).json(newContact);
    } catch (error) {
      console.error("Erro ao adicionar contato de emergência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar contato de emergência
  app.put("/api/emergency-contacts/:contactId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { contactId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { name, phone, relationship, notes, isPrimary } = req.body;
      
      if (!name || !phone || !relationship) {
        return res.status(400).json({ message: "Nome, telefone e relacionamento são obrigatórios" });
      }

      const updatedContact = {
        id: contactId,
        name,
        phone,
        relationship,
        notes: notes || "",
        isPrimary: isPrimary || false
      };

      // Atualizar contato baseado no tipo de usuário
      if (req.user?.type === 'driver') {
        await storage.updateEmergencyContact(userId, contactId, updatedContact);
      } else if (req.user?.type === 'passenger') {
        const passenger = await storage.getPassenger(userId);
        if (passenger) {
          const contacts = passenger.emergencyContacts || [];
          const contactIndex = contacts.findIndex((c: any) => c.id === contactId);
          if (contactIndex !== -1) {
            contacts[contactIndex] = updatedContact;
            await storage.updatePassenger(userId, { emergencyContacts: contacts });
          }
        }
      }

      res.json(updatedContact);
    } catch (error) {
      console.error("Erro ao atualizar contato de emergência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar gênero do motorista
  app.put("/api/driver/update-gender", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { gender } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      if (!gender || !['male', 'female', 'other'].includes(gender)) {
        return res.status(400).json({ message: "Gênero inválido" });
      }

      // Atualizar gênero e marcar como atualizado
      await storage.updateUser(userId, { 
        gender: gender,
        genderUpdated: true 
      });

      res.json({ message: "Gênero atualizado com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar gênero:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Excluir contato de emergência
  app.delete("/api/emergency-contacts/:contactId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const { contactId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      // Excluir contato baseado no tipo de usuário
      if (req.user?.type === 'driver') {
        await storage.deleteEmergencyContact(userId, contactId);
      } else if (req.user?.type === 'passenger') {
        const passenger = await storage.getPassenger(userId);
        if (passenger) {
          const contacts = passenger.emergencyContacts || [];
          const updatedContacts = contacts.filter((c: any) => c.id !== contactId);
          await storage.updatePassenger(userId, { emergencyContacts: updatedContacts });
        }
      }

      res.json({ message: "Contato excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir contato de emergência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS DE INVESTIDORES =====

  // Upload de documento RG/CPF
  app.post("/api/uploads/rgCpfPhoto", upload.single("rgCpfPhoto"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum documento foi enviado" });
      }
      res.json({ filePath: `/uploads/${req.file.filename}` });
    } catch (error) {
      console.error("Erro no upload do documento:", error);
      res.status(500).json({ message: "Erro no upload do documento" });
    }
  });

  // Cadastrar investidor
  app.post("/api/investors", async (req: Request, res: Response) => {
    try {
      const investorData = req.body;
      res.status(201).json({ 
        id: Date.now(), 
        ...investorData, 
        status: "pending",
        createdAt: new Date() 
      });
    } catch (error) {
      console.error("Erro ao cadastrar investidor:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA FEATURE TOGGLES =====

  // Buscar todas as configurações de funcionalidades
  app.get("/api/admin/feature-toggles", checkAdmin, async (req: Request, res: Response) => {
    try {
      const features = await db.select().from(featureToggles);
      res.json(features);
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar configuração de funcionalidade
  app.patch("/api/admin/feature-toggles/:featureName", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { featureName } = req.params;
      const { isEnabled } = req.body;
      
      const result = await db.update(featureToggles)
        .set({ 
          isEnabled,
          updatedAt: new Date(),
          updatedBy: req.user?.id
        })
        .where(eq(featureToggles.featureName, featureName))
        .returning();

      if (result.length === 0) {
        // Criar se não existir
        const newFeature = await db.insert(featureToggles)
          .values({
            featureName,
            isEnabled,
            updatedBy: req.user?.id
          })
          .returning();
        res.json(newFeature[0]);
      } else {
        res.json(result[0]);
      }
    } catch (error) {
      console.error("Erro ao atualizar configuração:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA PLANOS MENSAIS =====

  // Buscar configurações de desconto para planos mensais
  app.get("/api/admin/pricing/monthly-discount", checkAdmin, async (req: Request, res: Response) => {
    try {
      const pricingTables = await db.select().from(pricingTables);
      res.json(pricingTables);
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar desconto para planos mensais
  app.patch("/api/admin/pricing/monthly-discount", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { tableType, region, vehicleType, monthlyPlanDiscount } = req.body;
      
      const result = await db.update(pricingTables)
        .set({ 
          monthlyPlanDiscount,
          updatedAt: new Date()
        })
        .where(and(
          eq(pricingTables.tableType, tableType),
          eq(pricingTables.region, region),
          eq(pricingTables.vehicleType, vehicleType)
        ))
        .returning();

      res.json(result[0]);
    } catch (error) {
      console.error("Erro ao atualizar desconto:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Criar plano mensal para passageiro
  app.post("/api/passenger/monthly-plan", async (req: Request, res: Response) => {
    try {
      const planData = req.body;
      
      const newPlan = await db.insert(monthlyPlans)
        .values({
          ...planData,
          passengerId: req.user?.id
        })
        .returning();

      res.status(201).json(newPlan[0]);
    } catch (error) {
      console.error("Erro ao criar plano mensal:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA PREFERÊNCIAS DE MOTORISTA =====

  // Buscar preferência de motorista do passageiro
  app.get("/api/passenger/driver-preference", async (req: Request, res: Response) => {
    try {
      const preference = await db.select()
        .from(driverPreferences)
        .where(eq(driverPreferences.passengerId, req.user?.id))
        .limit(1);

      if (preference.length === 0) {
        res.json({ genderPreference: "todos" });
      } else {
        res.json(preference[0]);
      }
    } catch (error) {
      console.error("Erro ao buscar preferência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar preferência de motorista
  app.patch("/api/passenger/driver-preference", async (req: Request, res: Response) => {
    try {
      const { genderPreference } = req.body;
      
      const existing = await db.select()
        .from(driverPreferences)
        .where(eq(driverPreferences.passengerId, req.user?.id))
        .limit(1);

      if (existing.length === 0) {
        const newPreference = await db.insert(driverPreferences)
          .values({
            passengerId: req.user?.id,
            genderPreference
          })
          .returning();
        res.json(newPreference[0]);
      } else {
        const updated = await db.update(driverPreferences)
          .set({ 
            genderPreference,
            updatedAt: new Date()
          })
          .where(eq(driverPreferences.passengerId, req.user?.id))
          .returning();
        res.json(updated[0]);
      }
    } catch (error) {
      console.error("Erro ao atualizar preferência:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA SISTEMA DE INDICAÇÕES =====

  // Gerar código de indicação para passageiro
  app.get("/api/passenger/referral-code", async (req: Request, res: Response) => {
    try {
      const passenger = await db.select()
        .from(passengers)
        .where(eq(passengers.id, req.user?.id))
        .limit(1);

      if (passenger.length === 0) {
        return res.status(404).json({ message: "Passageiro não encontrado" });
      }

      // Gerar código único baseado no ID do passageiro
      const referralCode = `SERV${req.user?.id}${Date.now().toString().slice(-4)}`;
      
      res.json({ referralCode });
    } catch (error) {
      console.error("Erro ao gerar código:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Criar indicação
  app.post("/api/passenger/referral", async (req: Request, res: Response) => {
    try {
      const { referredContact, referralCode } = req.body;
      
      const newReferral = await db.insert(referrals)
        .values({
          referrerId: req.user?.id,
          referredContact,
          referralCode
        })
        .returning();

      res.status(201).json(newReferral[0]);
    } catch (error) {
      console.error("Erro ao criar indicação:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA CONFIGURAÇÃO DE BUSCA DE MOTORISTAS =====

  // Buscar configurações de busca
  app.get("/api/admin/driver-search-config", checkAdmin, async (req: Request, res: Response) => {
    try {
      const config = await db.select().from(driverSearchConfig).limit(1);
      
      if (config.length === 0) {
        // Retornar configuração padrão
        res.json({
          radiusKm1: 3,
          timeMinutes1: 2,
          radiusKm2: 6,
          timeMinutes2: 3,
          radiusKm3: 10,
          timeMinutes3: 5,
          maxTotalMinutes: 10
        });
      } else {
        res.json(config[0]);
      }
    } catch (error) {
      console.error("Erro ao buscar configuração:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar configurações de busca
  app.patch("/api/admin/driver-search-config", checkAdmin, async (req: Request, res: Response) => {
    try {
      const configData = req.body;
      
      const existing = await db.select().from(driverSearchConfig).limit(1);
      
      if (existing.length === 0) {
        const newConfig = await db.insert(driverSearchConfig)
          .values(configData)
          .returning();
        res.json(newConfig[0]);
      } else {
        const updated = await db.update(driverSearchConfig)
          .set({ 
            ...configData,
            updatedAt: new Date()
          })
          .where(eq(driverSearchConfig.id, existing[0].id))
          .returning();
        res.json(updated[0]);
      }
    } catch (error) {
      console.error("Erro ao atualizar configuração:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS FINANCEIRAS =====

  // Buscar estatísticas financeiras
  app.get("/api/admin/financial/stats", checkAdmin, async (req: Request, res: Response) => {
    try {
      const stats = {
        totalRevenue: 150000,
        totalExpenses: 85000,
        netProfit: 65000,
        monthlyGrowth: 12.5,
        totalRides: 2150,
        activeDrivers: 125,
        pendingPayments: 15,
        averageRideValue: 18.50
      };
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Criar lançamento financeiro
  app.post("/api/admin/financial/entries", checkAdmin, async (req: Request, res: Response) => {
    try {
      const entryData = req.body;
      
      const newEntry = await db.insert(financialEntries)
        .values({
          ...entryData,
          createdBy: req.user?.id
        })
        .returning();

      res.status(201).json(newEntry[0]);
    } catch (error) {
      console.error("Erro ao criar lançamento:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar lançamentos financeiros
  app.get("/api/admin/financial/entries", checkAdmin, async (req: Request, res: Response) => {
    try {
      const entries = await db.select().from(financialEntries)
        .orderBy(desc(financialEntries.createdAt));
      res.json(entries);
    } catch (error) {
      console.error("Erro ao buscar lançamentos:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ENDPOINT PARA RECALCULAR DATAS DE VENCIMENTO CRLV =====

  // Função para calcular vencimento do CRLV baseado na placa por estado brasileiro
  const calculateCrlvExpiration = (plateNumber: string, state: string): string => {
    const lastDigit = plateNumber.slice(-1);
    const currentYear = new Date().getFullYear();

    // Tabela completa de vencimentos do CRLV por estado brasileiro
    const crlvScheduleByState: { [state: string]: { [digit: string]: string } } = {
      'SP': { '1': '04-30', '2': '05-31', '3': '06-30', '4': '07-31', '5': '08-31', '6': '09-30', '7': '10-31', '8': '11-30', '9': '12-31', '0': '01-31' },
      'MG': { '1': '05-31', '2': '06-30', '3': '07-31', '4': '08-31', '5': '09-30', '6': '10-31', '7': '11-30', '8': '12-31', '9': '01-31', '0': '02-28' },
      'RJ': { '1': '03-31', '2': '04-30', '3': '05-31', '4': '06-30', '5': '07-31', '6': '08-31', '7': '09-30', '8': '10-31', '9': '11-30', '0': '12-31' },
      'RS': { '1': '06-30', '2': '07-31', '3': '08-31', '4': '09-30', '5': '10-31', '6': '11-30', '7': '12-31', '8': '01-31', '9': '02-28', '0': '03-31' },
      'PR': { '1': '07-31', '2': '08-31', '3': '09-30', '4': '10-31', '5': '11-30', '6': '12-31', '7': '01-31', '8': '02-28', '9': '03-31', '0': '04-30' },
      'SC': { '1': '08-31', '2': '09-30', '3': '10-31', '4': '11-30', '5': '12-31', '6': '01-31', '7': '02-28', '8': '03-31', '9': '04-30', '0': '05-31' },
      'BA': { '1': '09-30', '2': '10-31', '3': '11-30', '4': '12-31', '5': '01-31', '6': '02-28', '7': '03-31', '8': '04-30', '9': '05-31', '0': '06-30' },
      'GO': { '1': '10-31', '2': '11-30', '3': '12-31', '4': '01-31', '5': '02-28', '6': '03-31', '7': '04-30', '8': '05-31', '9': '06-30', '0': '07-31' },
      'PE': { '1': '11-30', '2': '12-31', '3': '01-31', '4': '02-28', '5': '03-31', '6': '04-30', '7': '05-31', '8': '06-30', '9': '07-31', '0': '08-31' },
      'CE': { '1': '12-31', '2': '01-31', '3': '02-28', '4': '03-31', '5': '04-30', '6': '05-31', '7': '06-30', '8': '07-31', '9': '08-31', '0': '09-30' },
      'ES': { '1': '01-31', '2': '02-28', '3': '03-31', '4': '04-30', '5': '05-31', '6': '06-30', '7': '07-31', '8': '08-31', '9': '09-30', '0': '10-31' },
      'PA': { '1': '02-28', '2': '03-31', '3': '04-30', '4': '05-31', '5': '06-30', '6': '07-31', '7': '08-31', '8': '09-30', '9': '10-31', '0': '11-30' },
      'MA': { '1': '03-31', '2': '04-30', '3': '05-31', '4': '06-30', '5': '07-31', '6': '08-31', '7': '09-30', '8': '10-31', '9': '11-30', '0': '12-31' },
      'PI': { '1': '04-30', '2': '05-31', '3': '06-30', '4': '07-31', '5': '08-31', '6': '09-30', '7': '10-31', '8': '11-30', '9': '12-31', '0': '01-31' },
      'AL': { '1': '05-31', '2': '06-30', '3': '07-31', '4': '08-31', '5': '09-30', '6': '10-31', '7': '11-30', '8': '12-31', '9': '01-31', '0': '02-28' },
      'SE': { '1': '06-30', '2': '07-31', '3': '08-31', '4': '09-30', '5': '10-31', '6': '11-30', '7': '12-31', '8': '01-31', '9': '02-28', '0': '03-31' },
      'PB': { '1': '07-31', '2': '08-31', '3': '09-30', '4': '10-31', '5': '11-30', '6': '12-31', '7': '01-31', '8': '02-28', '9': '03-31', '0': '04-30' },
      'RN': { '1': '08-31', '2': '09-30', '3': '10-31', '4': '11-30', '5': '12-31', '6': '01-31', '7': '02-28', '8': '03-31', '9': '04-30', '0': '05-31' },
      'TO': { '1': '09-30', '2': '10-31', '3': '11-30', '4': '12-31', '5': '01-31', '6': '02-28', '7': '03-31', '8': '04-30', '9': '05-31', '0': '06-30' },
      'MT': { '1': '10-31', '2': '11-30', '3': '12-31', '4': '01-31', '5': '02-28', '6': '03-31', '7': '04-30', '8': '05-31', '9': '06-30', '0': '07-31' },
      'MS': { '1': '11-30', '2': '12-31', '3': '01-31', '4': '02-28', '5': '03-31', '6': '04-30', '7': '05-31', '8': '06-30', '9': '07-31', '0': '08-31' },
      'RO': { '1': '12-31', '2': '01-31', '3': '02-28', '4': '03-31', '5': '04-30', '6': '05-31', '7': '06-30', '8': '07-31', '9': '08-31', '0': '09-30' },
      'AC': { '1': '01-31', '2': '02-28', '3': '03-31', '4': '04-30', '5': '05-31', '6': '06-30', '7': '07-31', '8': '08-31', '9': '09-30', '0': '10-31' },
      'AM': { '1': '02-28', '2': '03-31', '3': '04-30', '4': '05-31', '5': '06-30', '6': '07-31', '7': '08-31', '8': '09-30', '9': '10-31', '0': '11-30' },
      'RR': { '1': '03-31', '2': '04-30', '3': '05-31', '4': '06-30', '5': '07-31', '6': '08-31', '7': '09-30', '8': '10-31', '9': '11-30', '0': '12-31' },
      'AP': { '1': '04-30', '2': '05-31', '3': '06-30', '4': '07-31', '5': '08-31', '6': '09-30', '7': '10-31', '8': '11-30', '9': '12-31', '0': '01-31' },
      'DF': { '1': '05-31', '2': '06-30', '3': '07-31', '4': '08-31', '5': '09-30', '6': '10-31', '7': '11-30', '8': '12-31', '9': '01-31', '0': '02-28' }
    };

    const stateSchedule = crlvScheduleByState[state.toUpperCase()];
    if (!stateSchedule) {
      // Se não encontrar o estado, usar cronograma de São Paulo como padrão
      console.warn(`Estado ${state} não encontrado na tabela CRLV, usando cronograma de SP`);
      const spSchedule = crlvScheduleByState['SP'];
      const monthDay = spSchedule[lastDigit] || '12-31';
      const year = lastDigit === '0' ? currentYear + 1 : currentYear;
      return `${year}-${monthDay}`;
    }

    const monthDay = stateSchedule[lastDigit] || '12-31';
    
    // Determinar o ano baseado no mês
    const month = parseInt(monthDay.split('-')[0]);
    let year = currentYear;
    
    // Se for janeiro, fevereiro ou março, pode ser do próximo ano dependendo do estado
    const nextYearMonths = ['01', '02', '03', '04', '05'];
    if (nextYearMonths.includes(monthDay.split('-')[0])) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      
      if (currentMonth > month || (currentMonth === month && now.getDate() > parseInt(monthDay.split('-')[1]))) {
        year = currentYear + 1;
      }
    }
    
    return `${year}-${monthDay}`;
  };

  // Função para calcular data de bloqueio do CRLV (1 dia antes do vencimento)
  const calculateCrlvBlockDate = (plateNumber: string, state: string): string => {
    const expirationDate = calculateCrlvExpiration(plateNumber, state);
    const expiration = new Date(expirationDate);
    
    // Subtrai 1 dia da data de vencimento para obter a data de bloqueio
    expiration.setDate(expiration.getDate() - 1);
    
    return expiration.toISOString().split('T')[0];
  };

  // Endpoint para recalcular todas as datas de vencimento e bloqueio CRLV
  app.post("/api/admin/recalculate-crlv-dates", checkAdmin, async (req: Request, res: Response) => {
    try {
      // Buscar todos os veículos com placa e estado
      const vehiclesResult = await db.select({
        id: vehicles.id,
        plateNumber: vehicles.plateNumber,
        state: vehicles.state,
        userId: vehicles.userId
      }).from(vehicles)
      .where(and(
        isNotNull(vehicles.plateNumber),
        isNotNull(vehicles.state)
      ));

      let updatedCount = 0;
      const errors: string[] = [];

      for (const vehicle of vehiclesResult) {
        try {
          if (!vehicle.plateNumber || !vehicle.state) continue;

          const newExpiration = calculateCrlvExpiration(vehicle.plateNumber, vehicle.state);
          const newBlockDate = calculateCrlvBlockDate(vehicle.plateNumber, vehicle.state);

          await db.update(vehicles)
            .set({
              crlvExpiration: newExpiration,
              crlvBlockDate: newBlockDate
            })
            .where(eq(vehicles.id, vehicle.id));

          updatedCount++;
        } catch (error) {
          errors.push(`Erro no veículo ID ${vehicle.id}: ${error}`);
        }
      }

      console.log(`Recálculo CRLV concluído: ${updatedCount} veículos atualizados`);
      
      res.json({
        success: true,
        message: `Datas de vencimento e bloqueio CRLV recalculadas com sucesso`,
        updatedVehicles: updatedCount,
        totalVehicles: vehiclesResult.length,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error("Erro ao recalcular datas CRLV:", error);
      res.status(500).json({ 
        success: false,
        message: "Erro interno do servidor",
        error: String(error)
      });
    }
  });

  // ===== ROTAS PARA MOTORISTAS - SOLICITAÇÕES DE CORRIDA =====

  // Buscar solicitações de corrida pendentes para motoristas
  app.get("/api/driver/ride-requests/pending", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      // Verificar se é motorista na tabela users (que mapeia para drivers)
      const driver = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!driver.length) {
        return res.status(403).json({ message: "Acesso restrito a motoristas" });
      }

      // Buscar solicitações de corrida pendentes  
      const pendingRequests = await db.select()
      .from(rideRequests)
      .where(eq(rideRequests.status, 'pending'))
      .orderBy(desc(rideRequests.requestTime));

      // Buscar informações dos passageiros da tabela passengers
      const requestsWithPassengers = await Promise.all(
        pendingRequests.map(async (request) => {
          const passenger = await db.select({
            fullName: passengers.fullName,
            phoneNumber: passengers.phoneNumber
          })
          .from(passengers)
          .where(eq(passengers.id, request.passengerId))
          .limit(1);

          return {
            ...request,
            passengerName: passenger.length ? passenger[0].fullName : 'Passageiro',
            passengerPhone: passenger.length ? passenger[0].phoneNumber : ''
          };
        })
      );

      res.json(requestsWithPassengers);
    } catch (error) {
      console.error("Erro ao buscar solicitações de corrida:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Aceitar uma corrida
  app.post("/api/rides/:rideId/accept", async (req: Request, res: Response) => {
    try {
      const rideId = parseInt(req.params.rideId);
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      // Verificar se é motorista na tabela users (que mapeia para drivers)
      const driver = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!driver.length) {
        return res.status(403).json({ message: "Acesso restrito a motoristas" });
      }

      // Verificar se a corrida existe e está pendente
      const ride = await db.select().from(rideRequests).where(eq(rideRequests.id, rideId)).limit(1);
      if (!ride.length) {
        return res.status(404).json({ message: "Corrida não encontrada" });
      }

      if (ride[0].status !== 'pending') {
        return res.status(400).json({ message: "Corrida não está mais disponível" });
      }

      // Verificar se o motorista já tem uma corrida ativa
      const activeRides = await db.select().from(rideRequests)
        .where(eq(rideRequests.driverId, userId));

      const hasActiveRide = activeRides.some(r => r.status === 'accepted');
      if (hasActiveRide) {
        return res.status(400).json({ message: "Você já tem uma corrida ativa" });
      }

      // Atualizar status da corrida para aceita e definir motorista
      const updateResult = await db.update(rideRequests)
        .set({ 
          status: 'accepted',
          driverId: userId,
          acceptedAt: new Date()
        })
        .where(eq(rideRequests.id, rideId))
        .returning();

      if (updateResult.length === 0) {
        return res.status(404).json({ message: "Corrida não encontrada ou já aceita" });
      }

      console.log(`✅ Corrida ${rideId} aceita pelo motorista ${userId}`);
      res.json({ success: true, message: "Corrida aceita com sucesso", ride: updateResult[0] });
    } catch (error) {
      console.error("❌ Erro detalhado ao aceitar corrida:", error);
      res.status(500).json({ message: "Erro interno do servidor", details: error?.message || 'Erro desconhecido' });
    }
  });

  // Recusar uma corrida
  app.post("/api/rides/:rideId/decline", async (req: Request, res: Response) => {
    try {
      const rideId = parseInt(req.params.rideId);
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      // Verificar se é motorista na tabela users (que mapeia para drivers)
      const driver = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!driver.length) {
        return res.status(403).json({ message: "Acesso restrito a motoristas" });
      }

      // Para simplicidade, apenas registramos a recusa no log
      // A corrida permanece pendente para outros motoristas
      console.log(`❌ Corrida ${rideId} recusada pelo motorista ${userId}`);
      res.json({ success: true, message: "Corrida recusada" });
    } catch (error) {
      console.error("Erro ao recusar corrida:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar corrida ativa do motorista
  app.get("/api/driver/active-ride", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      // Verificar se é motorista
      const driver = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!driver.length || driver[0].type !== 'driver') {
        return res.status(403).json({ message: "Acesso restrito a motoristas" });
      }

      // Buscar corrida ativa (aceita ou em andamento) do motorista
      const activeRide = await db.select()
        .from(rideRequests)
        .where(and(
          eq(rideRequests.driverId, userId),
          or(
            eq(rideRequests.status, 'accepted'),
            eq(rideRequests.status, 'in_progress')
          )
        ))
        .limit(1);

      if (activeRide.length > 0) {
        // Buscar informações do passageiro
        const passenger = await db.select({
          fullName: passengers.fullName,
          phoneNumber: passengers.phoneNumber
        })
        .from(passengers)
        .where(eq(passengers.id, activeRide[0].passengerId))
        .limit(1);

        const rideWithPassenger = {
          ...activeRide[0],
          passengerName: passenger.length ? passenger[0].fullName : 'Passageiro',
          passengerPhone: passenger.length ? passenger[0].phoneNumber : ''
        };

        res.json(rideWithPassenger);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Erro ao buscar corrida ativa:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA CONFIGURAÇÕES DE NEGOCIAÇÃO =====

  // Buscar configurações de negociação (público para passageiros)
  app.get("/api/admin/negotiation-settings", async (req: Request, res: Response) => {
    try {
      // Buscar o feature toggle de negociação
      const passengerToggle = await db.select()
        .from(featureToggles)
        .where(eq(featureToggles.featureName, 'negotiate_price'))
        .limit(1);

      console.log('Feature toggle negotiate_price encontrado:', passengerToggle);

      const isNegotiationEnabled = (passengerToggle && passengerToggle.length > 0) ? passengerToggle[0].isEnabled : false;
      
      console.log('Status da negociação:', isNegotiationEnabled);

      const negotiationSettings = {
        passenger: {
          enabled: isNegotiationEnabled,
          maxPercentage: 20
        },
        delivery: {
          enabled: false,
          maxPercentage: 20
        },
        towing: {
          enabled: false,
          maxPercentage: 20
        }
      };

      console.log('Retornando configurações de negociação:', negotiationSettings);
      res.json(negotiationSettings);
    } catch (error) {
      console.error("Erro ao buscar configurações de negociação:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar configurações de negociação (somente admin)
  app.put("/api/admin/negotiation-settings", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { serviceType, enabled, maxPercentage } = req.body;
      
      console.log('Atualizando configuração de negociação:', { serviceType, enabled, maxPercentage });

      if (serviceType === 'passenger') {
        // Atualizar o feature toggle de negociação para passageiros
        const existingToggle = await db.select()
          .from(featureToggles)
          .where(eq(featureToggles.featureName, 'negotiate_price'))
          .limit(1);

        if (existingToggle.length > 0) {
          // Atualizar toggle existente
          await db.update(featureToggles)
            .set({ 
              isEnabled: enabled,
              updatedAt: new Date(),
              updatedBy: req.user?.id || 999999
            })
            .where(eq(featureToggles.featureName, 'negotiate_price'));
        } else {
          // Criar novo toggle
          await db.insert(featureToggles)
            .values({
              featureName: 'negotiate_price',
              isEnabled: enabled,
              description: 'Permite que passageiros negociem o preço das corridas',
              updatedBy: req.user?.id || 999999
            });
        }

        console.log('Feature toggle atualizado com sucesso');
      }

      // Retornar configurações atualizadas
      const updatedSettings = {
        passenger: {
          enabled: serviceType === 'passenger' ? enabled : false,
          maxPercentage: maxPercentage || 20
        },
        delivery: {
          enabled: serviceType === 'delivery' ? enabled : false,
          maxPercentage: maxPercentage || 20
        },
        towing: {
          enabled: serviceType === 'towing' ? enabled : false,
          maxPercentage: maxPercentage || 20
        }
      };

      res.json(updatedSettings);
    } catch (error) {
      console.error("Erro ao atualizar configurações de negociação:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA CONFIGURAÇÕES DE CORRIDA =====

  // Buscar configurações de corrida (público para passageiros)
  app.get("/api/ride-settings", async (req: Request, res: Response) => {
    try {
      // Buscar configurações diretamente da tabela ride_settings usando SQL raw
      const result = await db.execute(sql`SELECT * FROM ride_settings`);
      const settings = result.rows || result;

      const settingsMap: Record<string, any> = {};
      
      // Verificar se settings é um array
      if (Array.isArray(settings)) {
        settings.forEach((setting: any) => {
          let value: any = setting.setting_value;
          
          // Converter valor baseado no tipo
          if (setting.setting_type === 'number') {
            value = parseFloat(setting.setting_value);
          } else if (setting.setting_type === 'boolean') {
            value = setting.setting_value === 'true';
          }
          
          settingsMap[setting.setting_name] = value;
        });
      }

      res.json(settingsMap);
    } catch (error) {
      console.error("Erro ao buscar configurações de corrida:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA PONTOS DE COLETA =====

  // Buscar pontos de coleta
  app.get("/api/admin/collection-points", checkAdmin, async (req: Request, res: Response) => {
    try {
      const points = await db.select().from(collectionPoints)
        .orderBy(desc(collectionPoints.createdAt));
      res.json(points);
    } catch (error) {
      console.error("Erro ao buscar pontos de coleta:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Criar ponto de coleta
  app.post("/api/admin/collection-points", checkAdmin, async (req: Request, res: Response) => {
    try {
      const pointData = req.body;
      
      const newPoint = await db.insert(collectionPoints)
        .values({
          ...pointData,
          createdBy: req.user?.id
        })
        .returning();

      res.status(201).json(newPoint[0]);
    } catch (error) {
      console.error("Erro ao criar ponto de coleta:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar ponto de coleta
  app.patch("/api/admin/collection-points/:id", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const pointData = req.body;
      
      const updated = await db.update(collectionPoints)
        .set({ 
          ...pointData,
          updatedAt: new Date()
        })
        .where(eq(collectionPoints.id, parseInt(id)))
        .returning();

      res.json(updated[0]);
    } catch (error) {
      console.error("Erro ao atualizar ponto de coleta:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Excluir ponto de coleta
  app.delete("/api/admin/collection-points/:id", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      await db.delete(collectionPoints)
        .where(eq(collectionPoints.id, parseInt(id)));

      res.json({ message: "Ponto de coleta excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir ponto de coleta:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // ===== ROTAS PARA FEATURE TOGGLES =====

  // Buscar feature toggles
  app.get("/api/admin/feature-toggles", checkAdmin, async (req: Request, res: Response) => {
    try {
      const features = await db.select().from(featureToggles)
        .orderBy(featureToggles.featureName);
      res.json(features);
    } catch (error) {
      console.error("Erro ao buscar feature toggles:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar feature toggle
  app.patch("/api/admin/feature-toggles/:featureName", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { featureName } = req.params;
      const { isEnabled } = req.body;
      
      const updated = await db.update(featureToggles)
        .set({ 
          isEnabled,
          updatedAt: new Date(),
          updatedBy: req.user?.id
        })
        .where(eq(featureToggles.featureName, featureName))
        .returning();

      let result;
      if (updated.length === 0) {
        // Se não existe, criar novo
        const newFeature = await db.insert(featureToggles)
          .values({
            featureName,
            isEnabled,
            description: `Feature ${featureName}`,
            updatedBy: req.user?.id
          })
          .returning();
        
        result = newFeature[0];
      } else {
        result = updated[0];
      }

      // Broadcast em tempo real para clientes conectados
      if (realTimeServer) {
        realTimeServer.broadcastFeatureToggleUpdate(featureName, isEnabled);
        
        // Se for o feature de negociação, também enviar update das configurações
        if (featureName === 'negotiate_price') {
          const negotiationSettings = {
            passenger: {
              enabled: isEnabled,
              maxPercentage: 20
            },
            delivery: {
              enabled: false,
              maxPercentage: 20
            },
            towing: {
              enabled: false,
              maxPercentage: 20
            }
          };
          realTimeServer.broadcastNegotiationSettingsUpdate(negotiationSettings);
        }
      }

      res.json(result);
    } catch (error) {
      console.error("Erro ao atualizar feature toggle:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar transações financeiras
  app.get("/api/admin/financial/transactions", checkAdmin, async (req: Request, res: Response) => {
    try {
      const mockTransactions = [
        {
          id: 1,
          type: "income",
          category: "Comissão de Corridas",
          amount: 2500.00,
          description: "Comissão de corridas do dia",
          paymentMethod: "PIX",
          date: new Date().toISOString(),
          status: "completed",
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          type: "expense",
          category: "Pagamento Motoristas",
          amount: 1800.00,
          description: "Pagamento semanal aos motoristas",
          paymentMethod: "Transferência Bancária",
          date: new Date().toISOString(),
          status: "completed",
          createdAt: new Date().toISOString()
        }
      ];
      res.json(mockTransactions);
    } catch (error) {
      console.error("Erro ao buscar transações:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Buscar dados para gráficos
  app.get("/api/admin/financial/charts", checkAdmin, async (req: Request, res: Response) => {
    try {
      const chartData = {
        monthlyData: [
          { month: "Jan", income: 120000, expenses: 80000 },
          { month: "Fev", income: 135000, expenses: 85000 },
          { month: "Mar", income: 148000, expenses: 88000 },
          { month: "Abr", income: 150000, expenses: 85000 },
          { month: "Mai", income: 162000, expenses: 90000 },
          { month: "Jun", income: 175000, expenses: 95000 }
        ],
        incomeByCategory: [
          { name: "Comissão de Corridas", value: 85000 },
          { name: "Taxa de Plataforma", value: 35000 },
          { name: "Comissão de Entregas", value: 25000 },
          { name: "Assinatura Premium", value: 15000 },
          { name: "Outros", value: 15000 }
        ],
        expensesByCategory: [
          { name: "Pagamento Motoristas", value: 45000 },
          { name: "Marketing", value: 20000 },
          { name: "Tecnologia", value: 12000 },
          { name: "Operacional", value: 8000 }
        ],
        paymentMethods: [
          { method: "PIX", amount: 95000 },
          { method: "Cartão", amount: 65000 },
          { method: "Dinheiro", amount: 15000 }
        ]
      };
      res.json(chartData);
    } catch (error) {
      console.error("Erro ao buscar dados dos gráficos:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Criar transação financeira
  app.post("/api/admin/financial/transactions", checkAdmin, async (req: Request, res: Response) => {
    try {
      const transactionData = req.body;
      res.status(201).json({ 
        id: Date.now(), 
        ...transactionData,
        status: "completed",
        createdAt: new Date() 
      });
    } catch (error) {
      console.error("Erro ao criar transação:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Atualizar transação financeira
  app.put("/api/admin/financial/transactions/:id", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const transactionData = req.body;
      res.json({ id: parseInt(id), ...transactionData });
    } catch (error) {
      console.error("Erro ao atualizar transação:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Excluir transação financeira
  app.delete("/api/admin/financial/transactions/:id", checkAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      res.json({ message: "Transação excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir transação:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Eco-friendly route optimization endpoints
  const { EcoRouteService } = await import("./eco-route-service");

  // Calculate eco-friendly routes for a ride
  app.post("/api/eco-routes/calculate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { rideId, origin, destination, vehicleId } = req.body;
      
      if (!rideId || !origin || !destination || !vehicleId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      const routeOptions = await EcoRouteService.calculateEcoRoutes(rideId, {
        origin,
        destination,
        vehicleId
      });

      res.json({
        success: true,
        routes: routeOptions
      });
    } catch (error) {
      console.error("Error calculating eco routes:", error);
      res.status(500).json({ message: "Error calculating eco-friendly routes" });
    }
  });

  // Get user's eco settings
  app.get("/api/eco-settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userType = req.user!.type === 'driver' ? 'driver' : 'passenger';

      const settings = await EcoRouteService.getEcoSettings(userId, userType);
      res.json(settings);
    } catch (error) {
      console.error("Error getting eco settings:", error);
      res.status(500).json({ message: "Error retrieving eco settings" });
    }
  });

  // Update user's eco settings
  app.put("/api/eco-settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userType = req.user!.type === 'driver' ? 'driver' : 'passenger';
      const newSettings = req.body;

      await EcoRouteService.updateEcoSettings(userId, userType, newSettings);
      res.json({ success: true, message: "Eco settings updated successfully" });
    } catch (error) {
      console.error("Error updating eco settings:", error);
      res.status(500).json({ message: "Error updating eco settings" });
    }
  });

  // Get user's carbon footprint
  app.get("/api/carbon-footprint", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userType = req.user!.type === 'driver' ? 'driver' : 'passenger';

      const footprint = await db.query.carbonFootprint.findFirst({
        where: and(
          eq(carbonFootprint.userId, userId),
          eq(carbonFootprint.userType, userType)
        )
      });

      if (!footprint) {
        return res.json({
          totalTrips: 0,
          totalDistance: 0,
          totalCarbonEmitted: 0,
          totalCarbonSaved: 0,
          ecoTripsCount: 0,
          monthlyEmissions: {},
          yearlyEmissions: {}
        });
      }

      res.json(footprint);
    } catch (error) {
      console.error("Error getting carbon footprint:", error);
      res.status(500).json({ message: "Error retrieving carbon footprint" });
    }
  });

  // Add or update vehicle emission data
  app.post("/api/vehicles/:vehicleId/emissions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);
      const emissionData = req.body;

      // Verify vehicle belongs to user
      const vehicle = await db.query.vehicles.findFirst({
        where: and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.userId, req.user!.id)
        )
      });

      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      // Calculate eco score
      const ecoScore = EcoRouteService.calculateEcoScore(vehicle, emissionData);
      
      await EcoRouteService.addVehicleEmissionData(vehicleId, {
        ...emissionData,
        ecoScore
      });

      res.json({ success: true, message: "Vehicle emission data updated", ecoScore });
    } catch (error) {
      console.error("Error updating vehicle emissions:", error);
      res.status(500).json({ message: "Error updating vehicle emission data" });
    }
  });

  // Get vehicle emission data
  app.get("/api/vehicles/:vehicleId/emissions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);

      const emissionData = await db.query.vehicleEmissions.findFirst({
        where: eq(vehicleEmissions.vehicleId, vehicleId)
      });

      if (!emissionData) {
        return res.status(404).json({ message: "Emission data not found" });
      }

      res.json(emissionData);
    } catch (error) {
      console.error("Error getting vehicle emissions:", error);
      res.status(500).json({ message: "Error retrieving vehicle emission data" });
    }
  });

  // Update carbon footprint after a trip
  app.post("/api/carbon-footprint/update", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userType = req.user!.type === 'driver' ? 'driver' : 'passenger';
      const { routeOption } = req.body;

      await EcoRouteService.updateCarbonFootprint(userId, userType, routeOption);
      res.json({ success: true, message: "Carbon footprint updated" });
    } catch (error) {
      console.error("Error updating carbon footprint:", error);
      res.status(500).json({ message: "Error updating carbon footprint" });
    }
  });

  // Get eco-friendly route recommendations
  app.get("/api/eco-routes/recommendations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userType = req.user!.type === 'driver' ? 'driver' : 'passenger';

      // Get user's eco settings to personalize recommendations
      const settings = await EcoRouteService.getEcoSettings(userId, userType);
      
      const recommendations = {
        tips: [
          {
            id: 1,
            title: "Escolha rotas ecológicas",
            description: "Rotas eco-friendly podem economizar até 15% de combustível",
            icon: "🌱",
            impact: "Baixo"
          },
          {
            id: 2,
            title: "Evite horários de pico",
            description: "Trânsito intenso aumenta o consumo de combustível em 40%",
            icon: "⏰",
            impact: "Médio"
          },
          {
            id: 3,
            title: "Mantenha velocidade constante",
            description: "Acelerações e frenagens reduzem a eficiência em 20%",
            icon: "🚗",
            impact: "Alto"
          }
        ],
        achievements: [
          {
            id: 1,
            name: "Eco Warrior",
            description: "Complete 10 viagens eco-friendly",
            progress: 0,
            target: 10,
            unlocked: false
          },
          {
            id: 2,
            name: "Carbon Saver",
            description: "Economize 50kg de CO2",
            progress: 0,
            target: 50,
            unlocked: false
          }
        ]
      };

      res.json(recommendations);
    } catch (error) {
      console.error("Error getting recommendations:", error);
      res.status(500).json({ message: "Error retrieving recommendations" });
    }
  });

  // Configurar servidor WebSocket para atualizações em tempo real
  try {
    const websocketModule = await import('./websocket-server.js');
    realTimeServer = new websocketModule.RealTimeServer(httpServer);
    console.log('🔄 Servidor WebSocket inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar servidor WebSocket:', error);
  }

  return httpServer;
}
