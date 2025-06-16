import { pgTable, text, serial, integer, boolean, date, timestamp, jsonb, varchar, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User/Driver schema
export const users = pgTable("drivers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  phoneNumber: text("phone_number").notNull(),
  profilePhoto: text("profile_photo"),
  cpf: text("cpf"),
  birthDate: date("birth_date"),
  gender: text("gender"), // 'male', 'female', 'other'
  genderUpdated: boolean("gender_updated").default(false),
  cpfFront: text("cpf_front"),
  cpfBack: text("cpf_back"),
  cnhNumber: text("cnh_number"),
  cnhCategory: text("cnh_category"),
  remuneratedActivity: boolean("remunerated_activity").default(false), // EAR - Exerce Atividade Remunerada
  cnhFront: text("cnh_front"),
  cnhBack: text("cnh_back"),
  cnhExpiry: date("cnh_expiry"),
  cnhExpiration: date("cnh_expiration"),
  cnhDocumentUrl: text("cnh_document_url"),
  cnhBlockDate: date("cnh_block_date"),
  cep: text("cep"),
  street: text("street"),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  emergencyContacts: jsonb("emergency_contacts").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  balance: real("balance").default(0),
  type: text("type").notNull().default("driver"),
  approved: boolean("approved").default(false),
  status: text("status").default("pending"), // 'active', 'pending', 'inactive'
  asaasCustomerId: text("asaas_customer_id"), // ID do cliente no Asaas
});

// Vehicle schema
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  year: integer("year").notNull(),
  plateNumber: text("plate_number").notNull(),
  renavam: text("renavam"),
  crlvYear: integer("crlv_year"),
  crlvExpiration: date("crlv_expiration"),
  crlvDocumentUrl: text("crlv_document_url"),
  crlvBlockDate: date("crlv_block_date"),
  crlvPhoto: text("crlv_photo"),
  platePhoto: text("plate_photo"),
  frontPhoto: text("front_photo"),
  diagonalPhoto: text("diagonal_photo"),
  backPhoto: text("back_photo"),
  municipality: text("municipality"),
  state: text("state"),
  maker: text("maker"),
  model: text("model"),
  version: text("version"),
  color: text("color"),
  vehicleType: text("vehicle_type").notNull(),
  rideTypes: text("ride_types").array(),
  vehicleStatus: text("vehicle_status").default("pending"), // 'approved', 'rejected', 'blocked', 'unblocked', 'pending'
  createdAt: timestamp("created_at").defaultNow(),
});

// Ride types schema
export const rideTypes = pgTable("ride_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
});

// Vehicle types schema
export const vehicleTypes = pgTable("vehicle_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
});

// Transport types schema (passenger rides vs delivery)
export const transportTypes = pgTable("transport_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  category: text("category").notNull(), // 'passenger' or 'delivery'
  description: text("description").notNull(),
  descriptionEn: text("description_en").notNull(),
  basePrice: real("base_price").notNull(),
  pricePerKm: real("price_per_km").notNull(),
  icon: text("icon").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vehicle categories for tow trucks
export const vehicleCategories = pgTable("vehicle_categories", {
  id: serial("id").primaryKey(),
  transportTypeId: integer("transport_type_id").references(() => transportTypes.id, { 
    onDelete: "cascade", 
    onUpdate: "cascade" 
  }),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  description: text("description").notNull(),
  descriptionEn: text("description_en").notNull(),
  basePrice: real("base_price").notNull(),
  pricePerKm: real("price_per_km").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rides schema
export const rides = pgTable("rides", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "cascade", onUpdate: "cascade" }),
  status: text("status").notNull(), // 'completed', 'cancelled', 'in-progress'
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  origin: text("origin"),
  destination: text("destination"),
  currentLocation: text("current_location"),
  amount: real("amount"),
  rideType: text("ride_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Campos adicionais para o app de passageiro
  driverId: integer("driver_id"),
  driverName: text("driver_name"),
  driverPhoto: text("driver_photo"),
  driverRating: real("driver_rating"),
  vehicleName: text("vehicle_name"),
  vehiclePlate: text("vehicle_plate"),
  price: real("price"),
  estimatedArrivalTime: timestamp("estimated_arrival_time"),
  currentLatitude: text("current_latitude"),
  currentLongitude: text("current_longitude"),
});

// Withdrawal schema
export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  amount: real("amount").notNull(),
  status: text("status").notNull(), // 'pending', 'completed', 'rejected'
  requestDate: timestamp("request_date").defaultNow(),
  processDate: timestamp("process_date"),
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, balance: true });
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, createdAt: true });
export const insertRideSchema = createInsertSchema(rides).omit({ id: true, createdAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, requestDate: true, processDate: true });

// Custom zod schemas for registration steps
export const personalInfoSchema = z.object({
  firstName: z.string().min(1, "Nome completo é obrigatório"),
  birthDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data deve estar no formato DD/MM/YYYY"),
  gender: z.string().min(1, "Sexo é obrigatório"),
  email: z.string().email(),
  confirmEmail: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  phoneNumber: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/),
  profilePhoto: z.string().min(1, "Foto de perfil é obrigatória"),
}).refine(data => data.email === data.confirmEmail, {
  message: "Emails don't match",
  path: ["confirmEmail"],
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine(data => {
  // Validar se a pessoa tem pelo menos 18 anos
  const [day, month, year] = data.birthDate.split('/').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 18;
  }
  return age >= 18;
}, {
  message: "Deve ter pelo menos 18 anos",
  path: ["birthDate"],
});

export const documentationSchema = z.object({
  cpf: z.string().min(1, "Número do CPF é obrigatório"),
  cpfFront: z.string(),
  cpfBack: z.string(),
  cnhNumber: z.string().min(1, "Número da CNH é obrigatório"),
  cnhCategory: z.string().min(1, "Categoria da CNH é obrigatória"),
  cnhFront: z.string(),
  cnhBack: z.string(),
  cnhExpiry: z.date().refine(date => date > new Date(), {
    message: "CNH must not be expired",
  }),
  remuneratedActivity: z.boolean(),
});

export const addressSchema = z.object({
  cep: z.string().regex(/^\d{5}-\d{3}$/),
  street: z.string(),
  number: z.string(),
  complement: z.string().optional(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  notes: z.string().optional(),
});

export const vehicleYearSchema = z.object({
  year: z.number()
    .min(new Date().getFullYear() - 15, "*vehicleYearMin")
    .max(new Date().getFullYear(), "*vehicleYearMax"),
});

export const vehicleDocsSchema = z.object({
  frontPhoto: z.string().min(1, "*required"),
  diagonalPhoto: z.string().min(1, "*required"),
  backPhoto: z.string().min(1, "*required"),
  renavam: z.string().min(1, "*required"),
  platePhoto: z.string().min(1, "*required"),
  crlvPhoto: z.string().min(1, "*required"),
  crlvYear: z.number()
    .min(new Date().getFullYear() - 15, "*vehicleTooOld")
    .max(new Date().getFullYear(), "*vehicleYearMax"),
});

export const plateInfoSchema = z.object({
  plateNumber: z.string().min(1, "*required"),
  municipality: z.string().min(1, "*required"),
  state: z.string().length(2, "*invalidState"),
  maker: z.string().min(1, "*required"),
  model: z.string().min(1, "*required"),
  color: z.string().min(1, "*required"),
  vehicleType: z.string().min(1, "*required"),
  rideTypes: z.array(z.string()).min(1, "*required"),
  termsAgreed: z.boolean().refine(val => val === true, {
    message: "*termsRequired"
  }),
});

export const loginSchema = z.object({
  email: z.string().email("*invalidEmail"),
  password: z.string().min(1, "*required"),
  userType: z.enum(['driver', 'passenger', 'admin']).optional().default('driver'),
});

export const emergencyContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "*required"),
  phoneNumber: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "*invalidPhone"),
  relationship: z.string().min(1, "*required"),
});

export const emergencyContactsSchema = z.array(emergencyContactSchema);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Tipos para transportes
export type TransportType = typeof transportTypes.$inferSelect;
export type VehicleCategory = typeof vehicleCategories.$inferSelect;

// Insert schemas para transportTypes e vehicleCategories
export const insertTransportTypeSchema = createInsertSchema(transportTypes).omit({
  id: true,
  createdAt: true
});
export const insertVehicleCategorySchema = createInsertSchema(vehicleCategories).omit({
  id: true,
  createdAt: true
});

// Types para inserção
export type InsertTransportType = z.infer<typeof insertTransportTypeSchema>;
export type InsertVehicleCategory = z.infer<typeof insertVehicleCategorySchema>;

// Definir relações para transportTypes e vehicleCategories
export const transportTypesRelations = relations(transportTypes, ({ many }) => ({
  vehicleCategories: many(vehicleCategories)
}));

export const vehicleCategoriesRelations = relations(vehicleCategories, ({ one }) => ({
  transportType: one(transportTypes, {
    fields: [vehicleCategories.transportTypeId],
    references: [transportTypes.id]
  })
}));

// Definições de relações
export const usersRelations = relations(users, ({ many }) => ({
  vehicles: many(vehicles),
  rides: many(rides),
  withdrawals: many(withdrawals),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  user: one(users, {
    fields: [vehicles.userId],
    references: [users.id],
  }),
  rides: many(rides),
}));

export const ridesRelations = relations(rides, ({ one }) => ({
  user: one(users, {
    fields: [rides.userId],
    references: [users.id],
  }),
  vehicle: one(vehicles, {
    fields: [rides.vehicleId],
    references: [vehicles.id],
  }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  user: one(users, {
    fields: [withdrawals.userId],
    references: [users.id],
  }),
}));

// Passengers schema (clientes) - Supports both CPF and CNPJ
export const passengers = pgTable("passengers", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  cpf: text("cpf").notNull(),
  birthDate: date("birth_date"),
  phoneNumber: text("phone_number").notNull(),
  previousPhoneNumber: text("previous_phone_number"),
  lastPhoneUpdate: timestamp("last_phone_update"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  profilePhoto: text("profile_photo"),
  previousProfilePhoto: text("previous_profile_photo"),
  lastProfilePhotoUpdate: timestamp("last_profile_photo_update"),
  cpfPhoto: text("cpf_photo"),
  cep: text("cep"),
  street: text("street"),
  number: text("number"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  userType: text("user_type").default("passenger"),
  balance: real("balance").default(0),
  asaasCustomerId: text("asaas_customer_id"),
});

// Zod schema para validação de passageiros
export const insertPassengerSchema = createInsertSchema(passengers).omit({ 
  id: true, 
  createdAt: true, 
  lastLogin: true
});

// Esquema personalizado para validação de força de senha 
export const passengerRegistrationSchema = z.object({
  fullName: z.string().min(3, "*required"),
  cpf: z.string().min(1, "*required"),
  birthDate: z.date().optional().refine(date => {
    // Se não tiver data de nascimento, considera válido
    if (!date) return true;
    
    const today = new Date();
    const birthDate = new Date(date);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Ajuste para ainda não ter feito aniversário este ano
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1 >= 18;
    }
    
    return age >= 18;
  }, "*minAge"),
  phoneNumber: z.string().regex(/^\(\d{2}\) \d{5}-\d{4}$/, "*invalidPhone"),
  email: z.string().email("*invalidEmail"),
  password: z.string()
    .min(8, "*passwordLength")
    .regex(/[A-Z]/, "*passwordUppercase")
    .regex(/\d/, "*passwordNumber")
    .regex(/[\W_]/, "*passwordSymbol"),
  confirmPassword: z.string(),
  profilePhoto: z.string().optional(),
  cpfPhoto: z.string().optional(),
  cep: z.string().regex(/^\d{5}-\d{3}$/, "*invalidCEP"),
  street: z.string().min(3, "*required"),
  number: z.string().min(1, "*required"),
  neighborhood: z.string().min(2, "*required"),
  city: z.string().min(2, "*required"),
  state: z.string().length(2, "*invalidState"),
  notes: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "*passwordMismatch",
  path: ["confirmPassword"],
});

export type Passenger = typeof passengers.$inferSelect;
export type InsertPassenger = z.infer<typeof insertPassengerSchema>;
export type PassengerRegistration = z.infer<typeof passengerRegistrationSchema>;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Ride = typeof rides.$inferSelect;
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;

export type PersonalInfo = z.infer<typeof personalInfoSchema>;
export type Documentation = z.infer<typeof documentationSchema>;
export type Address = z.infer<typeof addressSchema>;
export type VehicleYear = z.infer<typeof vehicleYearSchema>;
export type VehicleDocs = z.infer<typeof vehicleDocsSchema>;
export type PlateInfo = z.infer<typeof plateInfoSchema>;
export type Login = z.infer<typeof loginSchema>;
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;
export type EmergencyContacts = z.infer<typeof emergencyContactsSchema>;

// Wallet transactions schema
export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }),
  type: text("type").notNull(), // 'deposit', 'payment', 'refund'
  amount: real("amount").notNull(),
  description: text("description"),
  rideId: integer("ride_id").references(() => rides.id, { onDelete: "set null", onUpdate: "cascade" }),
  paymentMethod: text("payment_method"), // 'credit_card', 'pix', etc
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  asaasPaymentId: text("asaas_payment_id"), // ID do pagamento no Asaas
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

// Type definitions
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;

// Pricing Tables Schema - Store all pricing configurations
export const pricingTables = pgTable("pricing_tables", {
  id: serial("id").primaryKey(),
  tableType: text("table_type").notNull(), // 'passenger', 'delivery', 'towing'
  region: text("region").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  basePrice: real("base_price").default(0),
  priceUpTo16km: real("price_up_to_16km").default(0),
  priceAbove16km: real("price_above_16km").default(0),
  pricePerMinute: real("price_per_minute").default(0),
  creditCardFee: real("credit_card_fee").default(0),
  creditCardPercent: real("credit_card_percent").default(0),
  appProfit: real("app_profit").default(0),
  taxes: real("taxes").default(0),
  additionalStop: real("additional_stop").default(0),
  minValue: real("min_value").default(0),
  monthlyPlanDiscount: real("monthly_plan_discount").default(0), // Desconto percentual para planos mensais
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Configuration Exports Schema - For backup/restore functionality
export const configurationExports = pgTable("configuration_exports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  exportType: text("export_type").notNull(), // 'full', 'pricing_only', 'custom'
  configData: jsonb("config_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Zod schemas for pricing tables
export const insertPricingTableSchema = createInsertSchema(pricingTables).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertConfigurationExportSchema = createInsertSchema(configurationExports).omit({
  id: true,
  createdAt: true
});

// Types
export type PricingTable = typeof pricingTables.$inferSelect;
export type InsertPricingTable = z.infer<typeof insertPricingTableSchema>;
export type ConfigurationExport = typeof configurationExports.$inferSelect;
export type InsertConfigurationExport = z.infer<typeof insertConfigurationExportSchema>;

// Corporate Plans Schema for Companies
export const corporatePlans = pgTable("corporate_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Nome do plano (ex: "Plano Básico")
  description: text("description"), // Descrição do plano
  minVolumes: integer("min_volumes").notNull(), // Volume mínimo (ex: 1)
  maxVolumes: integer("max_volumes").notNull(), // Volume máximo (ex: 100)
  monthlyPrice: real("monthly_price").notNull(), // Preço mensal em reais
  city: text("city").notNull(), // Cidade onde o plano está disponível
  active: boolean("active").default(true), // Se o plano está ativo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Corporate Subscriptions Schema
export const corporateSubscriptions = pgTable("corporate_subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }),
  planId: integer("plan_id").references(() => corporatePlans.id, { onDelete: "cascade", onUpdate: "cascade" }),
  status: text("status").notNull().default("active"), // 'active', 'cancelled', 'suspended'
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"), // Data de vencimento mensal
  volumesUsed: integer("volumes_used").default(0), // Volumes utilizados no mês
  volumesLimit: integer("volumes_limit").notNull(), // Limite de volumes do plano
  autoUpgrade: boolean("auto_upgrade").default(false), // Upgrade automático quando atingir limite
  nextPlanId: integer("next_plan_id").references(() => corporatePlans.id), // Próximo plano para upgrade
  city: text("city").notNull(), // Cidade da assinatura
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Corporate Deliveries Schema - Track deliveries using corporate plans
export const corporateDeliveries = pgTable("corporate_deliveries", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => corporateSubscriptions.id, { onDelete: "cascade", onUpdate: "cascade" }),
  rideId: integer("ride_id").references(() => rides.id, { onDelete: "cascade", onUpdate: "cascade" }),
  companyId: integer("company_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }),
  status: text("status").notNull(), // 'completed', 'cancelled', 'in-progress'
  volumeUsed: integer("volume_used").default(1), // Quantos volumes esta entrega consumiu
  originalPrice: real("original_price"), // Preço que seria cobrado sem o plano
  discountApplied: real("discount_applied"), // Desconto aplicado pelo plano
  createdAt: timestamp("created_at").defaultNow(),
});

// Corporate Usage Logs Schema - For audit and reporting
export const corporateUsageLogs = pgTable("corporate_usage_logs", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => corporateSubscriptions.id, { onDelete: "cascade", onUpdate: "cascade" }),
  companyId: integer("company_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }),
  action: text("action").notNull(), // 'delivery_created', 'plan_upgraded', 'limit_reached', etc
  volumesBefore: integer("volumes_before"),
  volumesAfter: integer("volumes_after"),
  planBefore: text("plan_before"),
  planAfter: text("plan_after"),
  details: jsonb("details"), // Informações adicionais em JSON
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertCorporatePlanSchema = createInsertSchema(corporatePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCorporateSubscriptionSchema = createInsertSchema(corporateSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCorporateDeliverySchema = createInsertSchema(corporateDeliveries).omit({
  id: true,
  createdAt: true
});

export const insertCorporateUsageLogSchema = createInsertSchema(corporateUsageLogs).omit({
  id: true,
  createdAt: true
});

// Types
export type CorporatePlan = typeof corporatePlans.$inferSelect;
export type InsertCorporatePlan = z.infer<typeof insertCorporatePlanSchema>;

export type CorporateSubscription = typeof corporateSubscriptions.$inferSelect;
export type InsertCorporateSubscription = z.infer<typeof insertCorporateSubscriptionSchema>;

export type CorporateDelivery = typeof corporateDeliveries.$inferSelect;
export type InsertCorporateDelivery = z.infer<typeof insertCorporateDeliverySchema>;

export type CorporateUsageLog = typeof corporateUsageLogs.$inferSelect;
export type InsertCorporateUsageLog = z.infer<typeof insertCorporateUsageLogSchema>;

// Monthly Plan Schema - Planos mensais para passageiros
export const monthlyPlans = pgTable("monthly_plans", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }),
  planName: text("plan_name").notNull(),
  totalRides: integer("total_rides").notNull(), // Número de corridas do plano
  usedRides: integer("used_rides").default(0), // Corridas utilizadas
  totalAmount: real("total_amount").notNull(), // Valor total pago
  discountApplied: real("discount_applied").notNull(), // Desconto aplicado
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date").notNull(), // Data de vencimento mensal
  status: text("status").notNull().default("active"), // 'active', 'expired', 'cancelled'
  scheduledRides: jsonb("scheduled_rides").default([]).notNull(), // Array de corridas agendadas
  creditCardRequired: boolean("credit_card_required").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Driver Preference Schema - Preferência de motorista
export const driverPreferences = pgTable("driver_preferences", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }),
  genderPreference: text("gender_preference").notNull().default("todos"), // 'homem', 'mulher', 'todos'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referral System Schema - Sistema de indicações
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }),
  referredId: integer("referred_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }),
  referredContact: text("referred_contact").notNull(), // Contato da pessoa indicada
  referralCode: text("referral_code").notNull().unique(), // Código único de indicação
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'expired'
  creditAmount: real("credit_amount").default(0), // Valor do crédito gerado
  firstRideCompleted: boolean("first_ride_completed").default(false),
  firstRideId: integer("first_ride_id").references(() => rides.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Driver Search Configuration Schema - Configuração de busca de motoristas
export const driverSearchConfig = pgTable("driver_search_config", {
  id: serial("id").primaryKey(),
  radiusKm1: real("radius_km_1").default(3), // Primeiro raio de busca
  timeMinutes1: integer("time_minutes_1").default(2), // Tempo do primeiro raio
  radiusKm2: real("radius_km_2").default(6), // Segundo raio de busca
  timeMinutes2: integer("time_minutes_2").default(3), // Tempo do segundo raio
  radiusKm3: real("radius_km_3").default(10), // Terceiro raio de busca
  timeMinutes3: integer("time_minutes_3").default(5), // Tempo do terceiro raio
  maxTotalMinutes: integer("max_total_minutes").default(10), // Tempo máximo total
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Financial Entries Schema - Lançamentos financeiros
export const financialEntries = pgTable("financial_entries", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'credit', 'debit'
  category: text("category").notNull(), // 'ride_payment', 'withdrawal', 'folha_pagamento', 'prolabore', etc
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  receipt: text("receipt"), // URL do comprovante
  userId: integer("user_id"), // ID do usuário relacionado (opcional)
  rideId: integer("ride_id").references(() => rides.id), // ID da corrida relacionada (opcional)
  createdBy: integer("created_by").references(() => users.id), // Admin que criou o lançamento
  createdAt: timestamp("created_at").defaultNow(),
});

// Collection Points Schema - Pontos de coleta
export const collectionPoints = pgTable("collection_points", {
  id: serial("id").primaryKey(),
  cnpj: text("cnpj").notNull().unique(),
  companyName: text("company_name").notNull(),
  responsibleName: text("responsible_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  cep: text("cep").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  complement: text("complement"),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  operatingHours: jsonb("operating_hours").notNull(), // Horários de funcionamento
  capacity: integer("capacity").default(50), // Capacidade de pacotes
  currentPackages: integer("current_packages").default(0), // Pacotes atuais
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'blocked'
  commission: real("commission").default(0), // Comissão por pacote
  documents: jsonb("documents"), // Documentos anexados
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vehicle Block History Schema - Histórico de bloqueios de motoristas
export const vehicleBlockHistory = pgTable("vehicle_block_history", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  action: text("action").notNull(), // 'block' ou 'unblock'
  reason: text("reason").notNull(), // Motivo do bloqueio/desbloqueio
  performedBy: integer("performed_by").references(() => users.id), // Admin que executou a ação
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Package Tracking Schema - Rastreamento de pacotes
export const packageTracking = pgTable("package_tracking", {
  id: serial("id").primaryKey(),
  trackingCode: text("tracking_code").notNull().unique(),
  qrCode: text("qr_code").notNull().unique(),
  collectionPointId: integer("collection_point_id").references(() => collectionPoints.id),
  rideId: integer("ride_id").references(() => rides.id),
  driverId: integer("driver_id").references(() => users.id),
  status: text("status").notNull().default("collected"), // 'collected', 'at_point', 'in_transit', 'delivered'
  pickupAddress: text("pickup_address").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  packageDetails: jsonb("package_details").notNull(), // Peso, dimensões, etc
  vehicleType: text("vehicle_type").notNull(),
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Investor Configuration Schema - Configurações do sistema de investidores
export const investorConfig = pgTable("investor_config", {
  id: serial("id").primaryKey(),
  minInvestment: real("min_investment").default(1000), // Valor mínimo de investimento
  profitPercentage: real("profit_percentage").default(12), // Percentual de lucro anual
  isEnabled: boolean("is_enabled").default(false), // Sistema ativo/inativo
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Coupon System Schema - Sistema de cupons
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull(), // 'percentage', 'fixed'
  discountValue: real("discount_value").notNull(),
  minValue: real("min_value").default(0), // Valor mínimo da corrida
  maxDiscount: real("max_discount"), // Desconto máximo (para percentuais)
  usageLimit: integer("usage_limit"), // Limite de uso geral
  usageCount: integer("usage_count").default(0), // Quantas vezes foi usado
  userLimit: integer("user_limit").default(1), // Limite por usuário
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  applicableFor: text("applicable_for").array(), // ['passenger', 'delivery', 'towing']
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Feature Toggles Schema - Controle de funcionalidades
export const featureToggles = pgTable("feature_toggles", {
  id: serial("id").primaryKey(),
  featureName: text("feature_name").notNull().unique(),
  isEnabled: boolean("is_enabled").default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by"), // Removida a referência de FK para permitir superadmin
});

// Ride Settings Schema - Configurações específicas para corridas
export const rideSettings = pgTable("ride_settings", {
  id: serial("id").primaryKey(),
  settingName: text("setting_name").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  settingType: text("setting_type").notNull(), // 'number', 'boolean', 'string'
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de histórico de bloqueios/desbloqueios de motoristas
export const driverBlockHistory = pgTable("driver_block_history", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").notNull(),
  adminId: integer("admin_id").notNull(),
  adminName: text("admin_name").notNull(),
  action: text("action").notNull(), // 'blocked' ou 'unblocked'
  reason: text("reason").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Insert schemas
export const insertMonthlyPlanSchema = createInsertSchema(monthlyPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertDriverPreferenceSchema = createInsertSchema(driverPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  completedAt: true
});

export const insertDriverSearchConfigSchema = createInsertSchema(driverSearchConfig).omit({
  id: true,
  updatedAt: true
});

export const insertFinancialEntrySchema = createInsertSchema(financialEntries).omit({
  id: true,
  createdAt: true
});

export const insertCollectionPointSchema = createInsertSchema(collectionPoints).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertPackageTrackingSchema = createInsertSchema(packageTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertInvestorConfigSchema = createInsertSchema(investorConfig).omit({
  id: true,
  updatedAt: true
});

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertFeatureToggleSchema = createInsertSchema(featureToggles).omit({
  id: true,
  updatedAt: true
});

export const insertRideSettingSchema = createInsertSchema(rideSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertDriverBlockHistorySchema = createInsertSchema(driverBlockHistory).omit({
  id: true,
  createdAt: true
});

// Types
export type MonthlyPlan = typeof monthlyPlans.$inferSelect;
export type InsertMonthlyPlan = z.infer<typeof insertMonthlyPlanSchema>;

export type DriverPreference = typeof driverPreferences.$inferSelect;
export type InsertDriverPreference = z.infer<typeof insertDriverPreferenceSchema>;

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

export type DriverSearchConfig = typeof driverSearchConfig.$inferSelect;
export type InsertDriverSearchConfig = z.infer<typeof insertDriverSearchConfigSchema>;

export type FinancialEntry = typeof financialEntries.$inferSelect;
export type InsertFinancialEntry = z.infer<typeof insertFinancialEntrySchema>;

export type CollectionPoint = typeof collectionPoints.$inferSelect;
export type InsertCollectionPoint = z.infer<typeof insertCollectionPointSchema>;

export type PackageTracking = typeof packageTracking.$inferSelect;
export type InsertPackageTracking = z.infer<typeof insertPackageTrackingSchema>;

export type InvestorConfig = typeof investorConfig.$inferSelect;
export type InsertInvestorConfig = z.infer<typeof insertInvestorConfigSchema>;

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export type FeatureToggle = typeof featureToggles.$inferSelect;
export type InsertFeatureToggle = z.infer<typeof insertFeatureToggleSchema>;

export type RideSetting = typeof rideSettings.$inferSelect;
export type InsertRideSetting = z.infer<typeof insertRideSettingSchema>;

export type DriverBlockHistory = typeof driverBlockHistory.$inferSelect;
export type InsertDriverBlockHistory = z.infer<typeof insertDriverBlockHistorySchema>;

// Relation definitions for corporate plans
export const corporatePlansRelations = relations(corporatePlans, ({ many }) => ({
  subscriptions: many(corporateSubscriptions),
}));

export const corporateSubscriptionsRelations = relations(corporateSubscriptions, ({ one, many }) => ({
  company: one(passengers, {
    fields: [corporateSubscriptions.companyId],
    references: [passengers.id],
  }),
  plan: one(corporatePlans, {
    fields: [corporateSubscriptions.planId],
    references: [corporatePlans.id],
  }),
  nextPlan: one(corporatePlans, {
    fields: [corporateSubscriptions.nextPlanId],
    references: [corporatePlans.id],
  }),
  deliveries: many(corporateDeliveries),
  usageLogs: many(corporateUsageLogs),
}));

export const corporateDeliveriesRelations = relations(corporateDeliveries, ({ one }) => ({
  subscription: one(corporateSubscriptions, {
    fields: [corporateDeliveries.subscriptionId],
    references: [corporateSubscriptions.id],
  }),
  ride: one(rides, {
    fields: [corporateDeliveries.rideId],
    references: [rides.id],
  }),
  company: one(passengers, {
    fields: [corporateDeliveries.companyId],
    references: [passengers.id],
  }),
}));

export const corporateUsageLogsRelations = relations(corporateUsageLogs, ({ one }) => ({
  subscription: one(corporateSubscriptions, {
    fields: [corporateUsageLogs.subscriptionId],
    references: [corporateSubscriptions.id],
  }),
  company: one(passengers, {
    fields: [corporateUsageLogs.companyId],
    references: [passengers.id],
  }),
}));

// Relation definitions
export const passengersRelations = relations(passengers, ({ many }) => ({
  walletTransactions: many(walletTransactions),
  rides: many(rides),
  corporateSubscriptions: many(corporateSubscriptions),
  corporateDeliveries: many(corporateDeliveries),
  corporateUsageLogs: many(corporateUsageLogs),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  passenger: one(passengers, {
    fields: [walletTransactions.passengerId],
    references: [passengers.id],
  }),
  ride: one(rides, {
    fields: [walletTransactions.rideId],
    references: [rides.id],
  }),
}));

// Driver Locations schema - Armazena a localização atual dos motoristas
export const driverLocations = pgTable("driver_locations", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  heading: real("heading"), // Direção em graus (0-360)
  speed: real("speed"), // Velocidade em km/h
  accuracy: real("accuracy"), // Precisão da localização em metros
  status: text("status").notNull().default("available"), // available, busy, offline
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null", onUpdate: "cascade" }),
  currentRideId: integer("current_ride_id").references(() => rides.id, { onDelete: "set null", onUpdate: "cascade" }),
});

// Ride Requests schema - Armazena solicitações de corridas/passageiros
export const rideRequests = pgTable("ride_requests", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").references(() => passengers.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  transportTypeId: integer("transport_type_id").references(() => transportTypes.id, { onDelete: "set null", onUpdate: "cascade" }),
  vehicleCategoryId: integer("vehicle_category_id").references(() => vehicleCategories.id, { onDelete: "set null", onUpdate: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, accepted, in_progress, completed, cancelled
  
  // Localização de origem
  originLatitude: real("origin_latitude").notNull(),
  originLongitude: real("origin_longitude").notNull(),
  originAddress: text("origin_address").notNull(),
  
  // Localização de destino
  destinationLatitude: real("destination_latitude").notNull(),
  destinationLongitude: real("destination_longitude").notNull(),
  destinationAddress: text("destination_address").notNull(),
  
  // Detalhes adicionais
  estimatedDistance: real("estimated_distance"), // Distância estimada em km
  estimatedDuration: real("estimated_duration"), // Duração estimada em minutos
  estimatedPrice: real("estimated_price"), // Preço estimado
  
  // Timestamps importantes
  requestTime: timestamp("request_time").defaultNow().notNull(),
  acceptTime: timestamp("accept_time"),
  pickupTime: timestamp("pickup_time"),
  completeTime: timestamp("complete_time"),
  cancelTime: timestamp("cancel_time"),
  
  // Referências a motorista e corrida (quando aceita)
  assignedDriverId: integer("assigned_driver_id").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
  driverId: integer("driver_id"),
  acceptedAt: timestamp("accepted_at"),
  rideId: integer("ride_id").references(() => rides.id, { onDelete: "set null", onUpdate: "cascade" }),
  
  // Notas e informações adicionais
  passengerNotes: text("passenger_notes"),
  cancellationReason: text("cancellation_reason"),
  scheduledTime: timestamp("scheduled_time"), // Para corridas agendadas
});

// Schemas de inserção para as novas tabelas
export const insertDriverLocationSchema = createInsertSchema(driverLocations).omit({
  id: true,
  lastUpdated: true
});

export const insertRideRequestSchema = createInsertSchema(rideRequests).omit({
  id: true,
  requestTime: true,
  acceptTime: true,
  pickupTime: true,
  completeTime: true,
  cancelTime: true
});

// Tipos gerados para as novas tabelas
export type DriverLocation = typeof driverLocations.$inferSelect;
export type InsertDriverLocation = z.infer<typeof insertDriverLocationSchema>;

export type RideRequest = typeof rideRequests.$inferSelect;
export type InsertRideRequest = z.infer<typeof insertRideRequestSchema>;

// Relações para as novas tabelas
export const driverLocationsRelations = relations(driverLocations, ({ one }) => ({
  driver: one(users, {
    fields: [driverLocations.driverId],
    references: [users.id],
  }),
  vehicle: one(vehicles, {
    fields: [driverLocations.vehicleId],
    references: [vehicles.id],
  }),
  currentRide: one(rides, {
    fields: [driverLocations.currentRideId],
    references: [rides.id],
  }),
}));

export const rideRequestsRelations = relations(rideRequests, ({ one }) => ({
  passenger: one(passengers, {
    fields: [rideRequests.passengerId],
    references: [passengers.id],
  }),
  transportType: one(transportTypes, {
    fields: [rideRequests.transportTypeId],
    references: [transportTypes.id],
  }),
  vehicleCategory: one(vehicleCategories, {
    fields: [rideRequests.vehicleCategoryId], 
    references: [vehicleCategories.id],
  }),
  assignedDriver: one(users, {
    fields: [rideRequests.assignedDriverId],
    references: [users.id],
  }),
  ride: one(rides, {
    fields: [rideRequests.rideId],
    references: [rides.id],
  }),
}));

// Toll booths schema
export const tollBooths = pgTable("toll_booths", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  value: real("value").notNull(),
  exemptVehicles: text("exempt_vehicles").array().notNull().default([]), // ['moto'] para isenção de motos
  highway: text("highway").notNull(),
  city: text("city").notNull(),
  direction: text("direction"), // sentido da rodovia se necessário
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTollBoothSchema = createInsertSchema(tollBooths).omit({ 
  id: true, 
  createdAt: true 
});

export type TollBooth = typeof tollBooths.$inferSelect;
export type InsertTollBooth = z.infer<typeof insertTollBoothSchema>;

// ===== SISTEMA DE PARCEIROS =====

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  companyName: text("company_name").notNull(),
  cep: text("cep").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  complement: text("complement"),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  notes: text("notes"),
  establishmentPhoto: text("establishment_photo").notNull(),
  status: text("status").default("pending"), // pending, approved, rejected, blocked
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references(() => users.id),
});

export const partnerPromotions = pgTable("partner_promotions", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  productName: text("product_name").notNull(),
  description: text("description").notNull(),
  originalPrice: real("original_price").notNull(),
  promotionalPrice: real("promotional_price").notNull(),
  productPhoto: text("product_photo").notNull(),
  promoCode: text("promo_code").notNull().unique(),
  publishType: text("publish_type").notNull(), // now, scheduled
  publishDate: timestamp("publish_date"),
  expiryDate: timestamp("expiry_date").notNull(),
  status: text("status").default("active"), // active, inactive, expired
  createdAt: timestamp("created_at").defaultNow(),
});

export const partnerSettings = pgTable("partner_settings", {
  id: serial("id").primaryKey(),
  isEnabled: boolean("is_enabled").default(false),
  monthlyFreePromotions: integer("monthly_free_promotions").default(3),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schemas de validação para parceiros
export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
  approvedBy: true,
});

export const insertPartnerPromotionSchema = createInsertSchema(partnerPromotions).omit({
  id: true,
  createdAt: true,
});

export const insertPartnerSettingsSchema = createInsertSchema(partnerSettings).omit({
  id: true,
  updatedAt: true,
});

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type PartnerPromotion = typeof partnerPromotions.$inferSelect;
export type InsertPartnerPromotion = z.infer<typeof insertPartnerPromotionSchema>;
export type PartnerSettings = typeof partnerSettings.$inferSelect;
export type InsertPartnerSettings = z.infer<typeof insertPartnerSettingsSchema>;

// Relações de parceiros
export const partnersRelations = relations(partners, ({ many, one }) => ({
  promotions: many(partnerPromotions),
  approver: one(users, { fields: [partners.approvedBy], references: [users.id] }),
}));

export const partnerPromotionsRelations = relations(partnerPromotions, ({ one }) => ({
  partner: one(partners, { fields: [partnerPromotions.partnerId], references: [partners.id] }),
}));

// ===== SISTEMA DE CHAT =====

export const rideChats = pgTable("ride_chats", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => rides.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  messageType: text("message_type").default("text"), // text, audio
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at").defaultNow(),
  isRead: boolean("is_read").default(false),
});

export const rideAudioRecordings = pgTable("ride_audio_recordings", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").notNull().references(() => rides.id),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration"), // em segundos
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRideChatSchema = createInsertSchema(rideChats).omit({
  id: true,
  createdAt: true,
});

export const insertRideAudioRecordingSchema = createInsertSchema(rideAudioRecordings).omit({
  id: true,
  createdAt: true,
});

export type RideChat = typeof rideChats.$inferSelect;
export type InsertRideChat = z.infer<typeof insertRideChatSchema>;
export type RideAudioRecording = typeof rideAudioRecordings.$inferSelect;
export type InsertRideAudioRecording = z.infer<typeof insertRideAudioRecordingSchema>;

// Relações de chat
export const rideChatsRelations = relations(rideChats, ({ one }) => ({
  ride: one(rides, { fields: [rideChats.rideId], references: [rides.id] }),
  sender: one(users, { fields: [rideChats.senderId], references: [users.id] }),
  receiver: one(users, { fields: [rideChats.receiverId], references: [users.id] }),
}));

export const rideAudioRecordingsRelations = relations(rideAudioRecordings, ({ one }) => ({
  ride: one(rides, { fields: [rideAudioRecordings.rideId], references: [rides.id] }),
}));

// ===== SISTEMA SUPER ADMIN =====

export const superAdmins = pgTable("super_admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  permissions: jsonb("permissions").default({}).notNull(),
  status: text("status").default("pending"), // pending, approved, rejected, blocked
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").notNull().references(() => superAdmins.id),
});

export const adminPermissions = pgTable("admin_permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  isActive: boolean("is_active").default(true),
});

export const insertSuperAdminSchema = createInsertSchema(superAdmins).omit({
  id: true,
  createdAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
});

export const insertAdminPermissionSchema = createInsertSchema(adminPermissions).omit({
  id: true,
});

export type SuperAdmin = typeof superAdmins.$inferSelect;
export type InsertSuperAdmin = z.infer<typeof insertSuperAdminSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminPermission = typeof adminPermissions.$inferSelect;
export type InsertAdminPermission = z.infer<typeof insertAdminPermissionSchema>;

// Relações super admin
export const superAdminsRelations = relations(superAdmins, ({ many }) => ({
  createdAdmins: many(adminUsers),
}));

export const adminUsersRelations = relations(adminUsers, ({ one }) => ({
  creator: one(superAdmins, { fields: [adminUsers.createdBy], references: [superAdmins.id] }),
}));

// ===== SISTEMA DE CUPONS =====

export const discountCoupons = pgTable("discount_coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  discountType: text("discount_type").notNull(), // percentage, fixed
  discountValue: real("discount_value").notNull(),
  city: text("city").notNull(),
  serviceType: text("service_type").notNull(), // ride, delivery, both
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0),
  minValue: real("min_value"),
  maxDiscount: real("max_discount"),
  expiryDate: timestamp("expiry_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const couponSettings = pgTable("coupon_settings", {
  id: serial("id").primaryKey(),
  isEnabled: boolean("is_enabled").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDiscountCouponSchema = createInsertSchema(discountCoupons).omit({
  id: true,
  createdAt: true,
  currentUses: true,
});

export const insertCouponSettingsSchema = createInsertSchema(couponSettings).omit({
  id: true,
  updatedAt: true,
});

export type DiscountCoupon = typeof discountCoupons.$inferSelect;
export type InsertDiscountCoupon = z.infer<typeof insertDiscountCouponSchema>;
export type CouponSettings = typeof couponSettings.$inferSelect;
export type InsertCouponSettings = z.infer<typeof insertCouponSettingsSchema>;

// ===== SISTEMA DE INVESTIDORES =====

export const investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  cpf: text("cpf").notNull().unique(),
  rgCpfPhoto: text("rg_cpf_photo").notNull(),
  cep: text("cep").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  complement: text("complement"),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  notes: text("notes"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  status: text("status").default("pending"), // pending, approved, rejected, blocked
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const investmentPlans = pgTable("investment_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  investmentAmount: real("investment_amount").notNull(),
  profitPercentage: real("profit_percentage").notNull(),
  contractCount: integer("contract_count"),
  planType: text("plan_type").notNull(), // quota_350, quota_simple, custom
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const investorInvestments = pgTable("investor_investments", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id").notNull().references(() => investors.id),
  planId: integer("plan_id").notNull().references(() => investmentPlans.id),
  investmentAmount: real("investment_amount").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentProof: text("payment_proof"),
  status: text("status").default("pending"), // pending, approved, active, cancelled
  validityDate: timestamp("validity_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const monthlyReports = pgTable("monthly_reports", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  totalRevenue: real("total_revenue").notNull(),
  totalExpenses: real("total_expenses").notNull(),
  netProfit: real("net_profit").notNull(),
  reportFile: text("report_file"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const investorSettings = pgTable("investor_settings", {
  id: serial("id").primaryKey(),
  isEnabled: boolean("is_enabled").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvestorSchema = createInsertSchema(investors).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

export const insertInvestmentPlanSchema = createInsertSchema(investmentPlans).omit({
  id: true,
  createdAt: true,
});

export const insertInvestorInvestmentSchema = createInsertSchema(investorInvestments).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

export const insertMonthlyReportSchema = createInsertSchema(monthlyReports).omit({
  id: true,
  createdAt: true,
});

export const insertInvestorSettingsSchema = createInsertSchema(investorSettings).omit({
  id: true,
  updatedAt: true,
});

export type Investor = typeof investors.$inferSelect;
export type InsertInvestor = z.infer<typeof insertInvestorSchema>;
export type InvestmentPlan = typeof investmentPlans.$inferSelect;
export type InsertInvestmentPlan = z.infer<typeof insertInvestmentPlanSchema>;
export type InvestorInvestment = typeof investorInvestments.$inferSelect;
export type InsertInvestorInvestment = z.infer<typeof insertInvestorInvestmentSchema>;
export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type InsertMonthlyReport = z.infer<typeof insertMonthlyReportSchema>;
export type InvestorSettings = typeof investorSettings.$inferSelect;
export type InsertInvestorSettings = z.infer<typeof insertInvestorSettingsSchema>;

// Relações investidores
export const investorsRelations = relations(investors, ({ many }) => ({
  investments: many(investorInvestments),
}));

export const investmentPlansRelations = relations(investmentPlans, ({ many }) => ({
  investments: many(investorInvestments),
}));

export const investorInvestmentsRelations = relations(investorInvestments, ({ one }) => ({
  investor: one(investors, { fields: [investorInvestments.investorId], references: [investors.id] }),
  plan: one(investmentPlans, { fields: [investorInvestments.planId], references: [investmentPlans.id] }),
}));

// Eco-friendly routing schema
export const ecoRoutes = pgTable("eco_routes", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").references(() => rides.id, { onDelete: "cascade" }),
  routeData: jsonb("route_data").notNull(), // Google Maps route data
  standardDistance: real("standard_distance").notNull(), // km
  ecoDistance: real("eco_distance").notNull(), // km
  standardDuration: integer("standard_duration").notNull(), // minutes
  ecoDuration: integer("eco_duration").notNull(), // minutes
  standardFuelConsumption: real("standard_fuel_consumption").notNull(), // liters
  ecoFuelConsumption: real("eco_fuel_consumption").notNull(), // liters
  carbonSaved: real("carbon_saved").notNull(), // kg CO2
  costSaved: real("cost_saved").notNull(), // currency
  routeType: text("route_type").notNull().default("eco"), // 'standard', 'eco', 'fastest'
  selectedByDriver: boolean("selected_by_driver").default(false),
  selectedByPassenger: boolean("selected_by_passenger").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vehicleEmissions = pgTable("vehicle_emissions", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }),
  fuelType: text("fuel_type").notNull(), // 'gasoline', 'ethanol', 'diesel', 'electric', 'hybrid'
  fuelConsumption: real("fuel_consumption").notNull(), // km/l or km/kWh
  co2EmissionRate: real("co2_emission_rate").notNull(), // kg CO2 per liter or kWh
  ecoScore: integer("eco_score").default(0), // 0-100 eco rating
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const ecoSettings = pgTable("eco_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  userType: text("user_type").notNull(), // 'driver', 'passenger'
  preferEcoRoutes: boolean("prefer_eco_routes").default(true),
  showCarbonSavings: boolean("show_carbon_savings").default(true),
  maxExtraTime: integer("max_extra_time").default(15), // max additional minutes for eco route
  ecoRewardEnabled: boolean("eco_reward_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const carbonFootprint = pgTable("carbon_footprint", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  userType: text("user_type").notNull(), // 'driver', 'passenger'
  totalTrips: integer("total_trips").default(0),
  totalDistance: real("total_distance").default(0), // km
  totalCarbonEmitted: real("total_carbon_emitted").default(0), // kg CO2
  totalCarbonSaved: real("total_carbon_saved").default(0), // kg CO2
  ecoTripsCount: integer("eco_trips_count").default(0),
  monthlyEmissions: jsonb("monthly_emissions").default({}), // monthly breakdown
  yearlyEmissions: jsonb("yearly_emissions").default({}), // yearly breakdown
  lastCalculated: timestamp("last_calculated").defaultNow(),
});

// Insert schemas for eco-friendly features
export const insertEcoRouteSchema = createInsertSchema(ecoRoutes).omit({
  id: true,
  createdAt: true,
});

export const insertVehicleEmissionSchema = createInsertSchema(vehicleEmissions).omit({
  id: true,
  lastUpdated: true,
});

export const insertEcoSettingsSchema = createInsertSchema(ecoSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCarbonFootprintSchema = createInsertSchema(carbonFootprint).omit({
  id: true,
  lastCalculated: true,
});

// Types for eco-friendly features
export type EcoRoute = typeof ecoRoutes.$inferSelect;
export type InsertEcoRoute = z.infer<typeof insertEcoRouteSchema>;

export type VehicleEmission = typeof vehicleEmissions.$inferSelect;
export type InsertVehicleEmission = z.infer<typeof insertVehicleEmissionSchema>;

export type EcoSettings = typeof ecoSettings.$inferSelect;
export type InsertEcoSettings = z.infer<typeof insertEcoSettingsSchema>;

export type CarbonFootprint = typeof carbonFootprint.$inferSelect;
export type InsertCarbonFootprint = z.infer<typeof insertCarbonFootprintSchema>;

// Relations for eco-friendly features
export const ecoRoutesRelations = relations(ecoRoutes, ({ one }) => ({
  ride: one(rides, { fields: [ecoRoutes.rideId], references: [rides.id] }),
}));

export const vehicleEmissionsRelations = relations(vehicleEmissions, ({ one }) => ({
  vehicle: one(vehicles, { fields: [vehicleEmissions.vehicleId], references: [vehicles.id] }),
}));

export const ecoSettingsRelations = relations(ecoSettings, ({ one }) => ({
  user: one(users, { fields: [ecoSettings.userId], references: [users.id] }),
}));

export const carbonFootprintRelations = relations(carbonFootprint, ({ one }) => ({
  user: one(users, { fields: [carbonFootprint.userId], references: [users.id] }),
}));
