import { pgTable, text, serial, integer, varchar, real, timestamp, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // Email address used as username
  password: text("password").notNull(),
  businessCard: text("business_card"), // Custom business card content
  logoUrl: text("logo_url"), // Path to uploaded company logo
  role: text("role").default("user").notNull(), // 'user' or 'admin'
  language: text("language").default("ru").notNull(), // Default language: Russian
  preferredMode: text("preferred_mode").default("supplier_search"), // User's preferred app mode
  onboardingCompleted: boolean("onboarding_completed").default(false),
  resetToken: text("reset_token"), // Password reset token
  resetTokenExpiry: timestamp("reset_token_expiry"), // Token expiration date
  // Personal email configuration fields
  emailAccount: text("email_account"), // User's email address for sending/receiving emails
  emailPassword: text("email_password"), // Encrypted password for email account
  smtpHost: text("smtp_host").default("smtp.mail.ru"), // SMTP host
  smtpPort: integer("smtp_port").default(587), // SMTP port
  imapHost: text("imap_host").default("imap.mail.ru"), // IMAP host
  imapPort: integer("imap_port").default(993), // IMAP port
  emailConfigured: boolean("email_configured").default(false), // Flag indicating if email is configured
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  lastEmailCheck: timestamp("last_email_check"), // Дата последней успешной проверки emails
  updatedAt: timestamp("updated_at").defaultNow()
});

// Managers table for user support managers
export const managers = pgTable("managers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Subscriptions table for user subscription plans - matching actual database schema
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  plan: text("plan").default("trial").notNull(), // 'trial', 'basic', 'premium', 'professional'
  requestsLimit: integer("requests_limit").default(10), // Max number of requests per period
  requestsUsed: integer("requests_used").default(0), // Current number of requests used
  requestsRest: integer("requests_rest"), // Remaining requests (computed as requestsLimit - requestsUsed)
  status: text("status").default("active").notNull(), // 'active', 'expired', 'canceled', 'pending'
  startDate: timestamp("start_date").defaultNow(), // When the subscription started
  endDate: timestamp("end_date"), // When the subscription expires
  maxRequests: integer("max_requests").default(10), // Max number of requests per period
  maxSuppliers: integer("max_suppliers").default(-1), // Max number of suppliers per request
  managerId: integer("manager_id").references(() => managers.id), // Assigned account manager
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Supplier search requests table

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  website: text("website").notNull().unique(),
  email: text("email").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  categories: text("categories").array().notNull(),
  responseRate: real("response_rate"),
  totalRequests: integer("total_requests").default(0),
  successfulMatches: integer("successful_matches").default(0),
  verifiedResponses: integer("verified_responses").default(0),
  unverifiedResponses: integer("unverified_responses").default(0),
  region: text("region"),
  lastResponseTime: timestamp("last_response_time"),
  // Дополнительные поля для полной карточки компании
  legalName: text("legal_name"), // Юридическое наименование
  taxId: text("tax_id"), // ИНН/УНП
  legalAddress: text("legal_address"), // Юридический адрес
  bankDetails: text("bank_details"), // Банковские реквизиты
  contactPerson: text("contact_person"), // Контактное лицо
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const stagingSuppliers = pgTable("staging_suppliers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Связь с пользователем
  requestId: integer("request_id").references(() => searchRequests.id), // Связь с конкретным запросом
  searchSessionId: text("search_session_id"), // Уникальный идентификатор сессии поиска
  sourceEngine: text("source_engine").notNull(), // 'google' или 'yandex'
  searchQuery: text("search_query").notNull(),   // Исходный поисковый запрос
  region: text("region"),                         // Регион поиска
  rawTitle: text("raw_title"),
  rawDescription: text("raw_description"),
  rawUrl: text("raw_url").notNull(),
  rawEmails: text("raw_emails").array(),
  rawPhones: text("raw_phones").array(),
  status: text("status", { enum: ["new", "in_review", "approved", "rejected", "merged"] }).default("new"),
  matchedSupplierId: integer("matched_supplier_id").references(() => suppliers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supplierSearchKeywords = pgTable("supplier_search_keywords", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
  keyword: text("keyword").notNull(),
}, (table) => {
  return {
    supplierKeywordIdx: uniqueIndex("supplier_keyword_idx").on(table.supplierId, table.keyword),
  };
});

export const searchRequests = pgTable("search_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  orderNumber: text("order_number").notNull().unique(), // Unique identifier for the request
  searchSessionId: text("search_session_id"), // Уникальный идентификатор сессии поиска
  productName: text("product_name").notNull(),
  productDescription: text("product_description").notNull(),
  quantity: integer("quantity"), // Optional field no longer used in UI
  budget: text("budget"), // Optional field no longer used in UI
  timeline: text("timeline").notNull(),
  additionalRequirements: text("additional_requirements"),
  matchedSuppliers: integer("matched_suppliers").array(),
  useDbSearch: boolean("use_db_search").default(true),
  useApiSearch: boolean("use_api_search").default(false),
  status: text("status").default("sent").notNull(), // Status of the request: sent, completed, cancelled
  createdAt: timestamp("created_at").defaultNow()
});

// Table to track which suppliers were contacted for each request
export const requestSuppliers = pgTable("request_suppliers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  requestId: integer("request_id").notNull().references(() => searchRequests.id),
  supplierId: text("supplier_id").notNull(), // Text to handle both regular IDs and negative IDs from API
  supplierEmail: text("supplier_email").notNull(),
  supplierName: text("supplier_name").notNull(),
  supplierWebsite: text("supplier_website"),
  supplierPhone: text("supplier_phone"),
  trackingId: text("tracking_id").notNull(), // Unique identifier for this specific request-supplier combination
  sentAt: timestamp("sent_at").defaultNow(),
  emailSubject: text("email_subject").notNull(),
  emailContent: text("email_content").notNull(),
  businessCard: text("business_card"), // Business card data at the time of sending
  hasResponded: boolean("has_responded").default(false),
});

// Table to store request parameters
export const requestParameters = pgTable("request_parameters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  requestId: integer("request_id").notNull().references(() => searchRequests.id),
  parameters: jsonb("parameters").default([]).notNull(), // Array of parameter objects with id, label, required status
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Table to store supplier responses to requests
export const supplierResponses = pgTable("supplier_responses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  requestId: integer("request_id").notNull().references(() => searchRequests.id),
  requestSupplierId: integer("request_supplier_id").references(() => requestSuppliers.id),
  supplierId: text("supplier_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  supplierEmail: text("supplier_email").notNull(),
  responseDate: timestamp("response_date").defaultNow(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).notNull(), // JSON array of attachments
  isRead: boolean("is_read").default(false),
  isRepliedTo: boolean("is_replied_to").default(false), // Track whether this response has been replied to
  messageId: text("message_id"), // Добавляем поле для хранения уникального идентификатора IMAP сообщения
  isFavorite: boolean("is_favorite").default(false), // Отметка ответа как избранное
  isAnalyzed: boolean("is_analyzed").default(false), // Флаг, показывающий, что ответ был проанализирован
  verificationStatus: text("verification_status", { enum: ["verified", "unverified", "pending"] }).default("pending"),
  verificationNotes: text("verification_notes"),
  // Новые поля для асинхронной обработки
  processingStatus: text("processing_status").default("pending"), // pending, processing, completed, failed
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  processingError: text("processing_error")
});

// Table to store extracted parameters from supplier responses
export const extractedParameters = pgTable("extracted_parameters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  responseId: integer("response_id").notNull().references(() => supplierResponses.id),
  requestId: integer("request_id").notNull().references(() => searchRequests.id),
  supplierEmail: text("supplier_email").notNull(),
  parameters: jsonb("parameters").default({}).notNull(), // JSON object with parameter name/value pairs
  extractionDate: timestamp("extraction_date").defaultNow(),
  lastUpdateDate: timestamp("last_update_date").defaultNow(),
  status: text("status").default("completed").notNull(), // Status: pending, processing, completed, failed
  errorMessage: text("error_message"), // Error message if extraction failed
});

// Table to store analysis projects for the analysis mode
export const analysisProjects = pgTable("analysis_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  procedureName: text("procedure_name").notNull(),
  description: text("description"),
  status: text("status").default("step1_requirements").notNull(), // step1_requirements, step2_offers, step3_compliance
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Table to store requirement sections for analysis projects
export const requirementSections: any = pgTable("requirement_sections", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => analysisProjects.id),
  sectionNumber: varchar("section_number", { length: 10 }).notNull(), // e.g., "3", "4", "4.1"
  sectionTitle: text("section_title").notNull(), // e.g., "Комплект технологического оборудования линии"
  parentSectionId: integer("parent_section_id").references((): any => requirementSections.id),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table to store extracted requirements for analysis projects
export const analysisExtractedRequirements = pgTable("analysis_extracted_requirements", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => analysisProjects.id),
  sectionId: integer("section_id").references(() => requirementSections.id),
  techSpecNumber: text("tech_spec_number").notNull(),
  extractedValue: text("extracted_value").notNull(),
  fullSectionPath: varchar("full_section_path", { length: 50 }), // e.g., "3.1", "4.2.1"
  confidence: real("confidence").default(0.8),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table to store project files for analysis
export const analysisProjectFiles = pgTable("analysis_project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => analysisProjects.id),
  originalName: text("original_name").notNull(),
  fileData: text("file_data").notNull(), // Base64 encoded file data
  mimetype: text("mimetype").notNull(),
  fileSize: integer("file_size").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table to store analysis results from supplier comparisons
export const analysisResults = pgTable("analysis_results", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => searchRequests.id),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  dateCreated: timestamp("date_created").defaultNow(),
  comparedSuppliers: jsonb("compared_suppliers").default([]).notNull(), // Array of supplier IDs that were compared
  parameters: jsonb("parameters").default([]).notNull(), // Array of parameters used in comparison
  recommendedSupplier: text("recommended_supplier"), // ID of the recommended supplier
  recommendationReason: text("recommendation_reason"), // Why this supplier was recommended
  analysisContent: text("analysis_content").notNull(), // Full analysis content as formatted text
  pdfUrl: text("pdf_url"), // URL to the generated PDF if available
});

// Table to store contact groups
export const contactGroups = pgTable("contact_groups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  contactCount: integer("contact_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Table to store contacts within contact groups
export const contactItems = pgTable("contact_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  groupId: integer("group_id").notNull().references(() => contactGroups.id),
  email: text("email").notNull(),
  name: text("name"), // Переименуем на фронтенде в "Компания"
  phone: text("phone"), // Будем хранить несколько телефонов через разделитель
  organization: text("organization"), // Переименуем на фронтенде в "Описание" 
  website: text("website"), // Веб-сайт контакта
  // position: text("position"), // Поле удалено
  createdAt: timestamp("created_at").defaultNow(),
});

// Table to store email requests for contact groups
export const emailRequests = pgTable("email_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  groupId: integer("group_id").notNull().references(() => contactGroups.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status").default("created").notNull(), // created, sent, completed
});

// Table to store request supplier to contact group relationships
export const requestSupplierGroups = pgTable("request_supplier_groups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  requestSupplierId: integer("request_supplier_id").notNull().references(() => requestSuppliers.id),
  contactGroupId: integer("contact_group_id").notNull().references(() => contactGroups.id),
  addedAt: timestamp("added_at").defaultNow(),
});

// Table to store message history for each request supplier
export const requestSupplierMessages = pgTable("request_supplier_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  requestSupplierId: integer("request_supplier_id").notNull().references(() => requestSuppliers.id),
  content: text("content").notNull(),
  subject: text("subject").default("").notNull(), // тема сообщения 
  direction: text("direction").notNull(), // 'inbound' or 'outbound'
  sentDate: timestamp("sent_date").notNull(),
  attachments: jsonb("attachments").default([]).notNull(), // JSON array of attachments with {filename, contentType, content, size}
});

// Table to track improvement requests sent to suppliers
export const improvementRequests = pgTable("improvement_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  requestId: integer("request_id").notNull().references(() => searchRequests.id),
  supplierId: text("supplier_id").notNull(),
  supplierEmail: text("supplier_email").notNull(),
  supplierName: text("supplier_name").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  requestType: text("request_type").default("improvement").notNull(), // "improvement" or "compliance_check"
  trackingId: text("tracking_id"), // For email tracking and identification
  sentAt: timestamp("sent_at").defaultNow(),
});

// Table to store winner selections for tenders
export const winnerSelections = pgTable("winner_selections", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => searchRequests.id),
  winnerEmail: text("winner_email").notNull(),
  winnerName: text("winner_name").notNull(),
  selectedDate: timestamp("selected_date").defaultNow(),
  notificationSent: boolean("notification_sent").default(false),
  userId: integer("user_id").references(() => users.id),
  notificationSubject: text("notification_subject"),
  notificationContent: text("notification_content"),
  attachments: jsonb("attachments").default([]).notNull(), // JSON array of attachments
});

// ============================================================================
// ANALYSIS MODE TABLES - Steps 2 & 3 Implementation
// ============================================================================

// Analysis suppliers table for Step 2
export const analysisSuppliers = pgTable("analysis_suppliers", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => analysisProjects.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Supplier files table for Step 2
export const supplierFiles = pgTable("supplier_files", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => analysisSuppliers.id),
  filename: text("filename").notNull(),
  fileData: text("file_data").notNull(), // Base64 encoded file data
  mimetype: text("mimetype").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadDate: timestamp("upload_date").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
});

// Compliance analysis table for Step 3
export const complianceAnalysis = pgTable("compliance_analysis", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => analysisProjects.id),
  supplierId: integer("supplier_id").notNull().references(() => analysisSuppliers.id),
  analysisData: jsonb("analysis_data").notNull(), // Full analysis results
  compliancePercentage: real("compliance_percentage").notNull(),
  gapsIdentified: text("gaps_identified").array().default([]),
  recommendations: text("recommendations").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Semantic blocks table for enhanced equipment analysis
export const semanticBlocks = pgTable("semantic_blocks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => analysisProjects.id),
  blockTitle: text("block_title").notNull(),
  contentHash: text("content_hash").notNull(),
  semanticEssence: jsonb("semantic_essence").notNull(),
  tokenCount: integer("token_count").notNull(),
  processingMethod: text("processing_method").notNull(),
  orderIndex: integer("order_index").notNull(),
  searchVector: text("search_vector"), // Optimized search vector for matching
  optimizedRequirements: jsonb("optimized_requirements"), // Deduplicated and categorized requirements
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Define relations
export const usersRelations = relations(users, ({ many, one }) => ({
  searchRequests: many(searchRequests),
  contactGroups: many(contactGroups),
  analysisResults: many(analysisResults),
  analysisProjects: many(analysisProjects),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  })
}));

export const analysisProjectsRelations = relations(analysisProjects, ({ one, many }) => ({
  user: one(users, {
    fields: [analysisProjects.userId],
    references: [users.id],
  }),
  suppliers: many(analysisSuppliers),
  extractedRequirements: many(analysisExtractedRequirements),
  projectFiles: many(analysisProjectFiles),
  complianceAnalyses: many(complianceAnalysis),
  requirementSections: many(requirementSections),
  semanticBlocks: many(semanticBlocks),
}));

export const requirementSectionsRelations = relations(requirementSections, ({ one, many }) => ({
  project: one(analysisProjects, {
    fields: [requirementSections.projectId],
    references: [analysisProjects.id],
  }),
  parentSection: one(requirementSections, {
    fields: [requirementSections.parentSectionId],
    references: [requirementSections.id],
  }),
  subSections: many(requirementSections),
  extractedRequirements: many(analysisExtractedRequirements),
}));

export const analysisExtractedRequirementsRelations = relations(analysisExtractedRequirements, ({ one }) => ({
  project: one(analysisProjects, {
    fields: [analysisExtractedRequirements.projectId],
    references: [analysisProjects.id],
  }),
  section: one(requirementSections, {
    fields: [analysisExtractedRequirements.sectionId],
    references: [requirementSections.id],
  }),
}));

export const analysisProjectFilesRelations = relations(analysisProjectFiles, ({ one }) => ({
  project: one(analysisProjects, {
    fields: [analysisProjectFiles.projectId],
    references: [analysisProjects.id],
  }),
}));

export const analysisSuppliersRelations = relations(analysisSuppliers, ({ one, many }) => ({
  project: one(analysisProjects, {
    fields: [analysisSuppliers.projectId],
    references: [analysisProjects.id],
  }),
  files: many(supplierFiles),
  complianceAnalyses: many(complianceAnalysis),
}));

export const supplierFilesRelations = relations(supplierFiles, ({ one }) => ({
  supplier: one(analysisSuppliers, {
    fields: [supplierFiles.supplierId],
    references: [analysisSuppliers.id],
  }),
}));

export const complianceAnalysisRelations = relations(complianceAnalysis, ({ one }) => ({
  project: one(analysisProjects, {
    fields: [complianceAnalysis.projectId],
    references: [analysisProjects.id],
  }),
  supplier: one(analysisSuppliers, {
    fields: [complianceAnalysis.supplierId],
    references: [analysisSuppliers.id],
  }),
}));

export const semanticBlocksRelations = relations(semanticBlocks, ({ one }) => ({
  project: one(analysisProjects, {
    fields: [semanticBlocks.projectId],
    references: [analysisProjects.id],
  }),
}));

export const managersRelations = relations(managers, ({ many }) => ({
  subscriptions: many(subscriptions)
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  manager: one(managers, {
    fields: [subscriptions.managerId],
    references: [managers.id],
  })
}));

export const searchRequestsRelations = relations(searchRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [searchRequests.userId],
    references: [users.id],
  }),
  parameters: many(requestParameters),
  suppliers: many(requestSuppliers),
  responses: many(supplierResponses),
  analysisResults: many(analysisResults)
}));

export const contactGroupsRelations = relations(contactGroups, ({ many, one }) => ({
  contacts: many(contactItems),
  supplierGroups: many(requestSupplierGroups),
  emailRequests: many(emailRequests),
  user: one(users, {
    fields: [contactGroups.userId],
    references: [users.id],
  })
}));

export const emailRequestsRelations = relations(emailRequests, ({ one }) => ({
  group: one(contactGroups, {
    fields: [emailRequests.groupId],
    references: [contactGroups.id],
  }),
}));

export const contactItemsRelations = relations(contactItems, ({ one }) => ({
  group: one(contactGroups, {
    fields: [contactItems.groupId],
    references: [contactGroups.id],
  }),
}));

export const requestSupplierGroupsRelations = relations(requestSupplierGroups, ({ one }) => ({
  supplier: one(requestSuppliers, {
    fields: [requestSupplierGroups.requestSupplierId],
    references: [requestSuppliers.id],
  }),
  group: one(contactGroups, {
    fields: [requestSupplierGroups.contactGroupId],
    references: [contactGroups.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, lastLogin: true, updatedAt: true });

export const insertSubscriptionSchema = createInsertSchema(subscriptions)
  .omit({ id: true, createdAt: true, updatedAt: true });

export const userLoginSchema = z.object({
  username: z.string().min(3, "Необходим адрес электронной почты"),
  password: z.string().min(6, "Пароль должен содержать не менее 6 символов"),
});

export const userRegisterSchema = z.object({
  username: z.string().email("Введите корректный адрес электронной почты"),
  password: z.string().min(6, "Пароль должен содержать не менее 6 символов"),
  passwordConfirm: z.string().min(6, "Пароль должен содержать не менее 6 символов"),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Пароли не совпадают",
  path: ["passwordConfirm"],
});

export const businessCardSchema = z.object({
  businessCard: z.string().optional(),
  logoUrl: z.string().optional(),
});

export const insertSupplierSchema = createInsertSchema(suppliers);
export const insertSearchRequestSchema = createInsertSchema(searchRequests)
  .omit({ id: true })
  .extend({
    orderNumber: z.string().min(1, "Order number is required").optional(), // Make optional so it can be auto-generated
    // userId field is removed temporarily until it is added to the database
  });
export const insertRequestSupplierSchema = createInsertSchema(requestSuppliers);
export const insertSupplierResponseSchema = createInsertSchema(supplierResponses);
export const insertAnalysisResultSchema = createInsertSchema(analysisResults)
  .omit({ id: true, dateCreated: true });
export const insertContactGroupSchema = createInsertSchema(contactGroups)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactItemSchema = createInsertSchema(contactItems)
  .omit({ id: true, createdAt: true });
export const insertRequestSupplierGroupSchema = createInsertSchema(requestSupplierGroups)
  .omit({ id: true, addedAt: true });
export const insertEmailRequestSchema = createInsertSchema(emailRequests)
  .omit({ id: true, createdAt: true, status: true });
export const insertRequestParameterSchema = createInsertSchema(requestParameters)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const insertImprovementRequestSchema = createInsertSchema(improvementRequests)
  .omit({ id: true, sentAt: true });

// Define a cleaner schema for form input without database-specific fields
export const searchRequestFormSchema = z.object({
  productName: z.string().min(3, "Product name must be at least 3 characters"),
  productDescription: z.string().optional(),
  timeline: z.string().min(1, "Please specify your timeline"),
  useDbSearch: z.boolean().default(true), // Database search enabled by default
  useApiSearch: z.boolean().default(false), // API search disabled by default
  parameters: z.array(z.string()).optional(), // Selected parameters for comparison
});

// Updated email template schema with tracking information and attachments
export const emailTemplateSchema = z.object({
  suppliers: z.array(z.union([z.number(), z.string()])).min(1, "Выберите хотя бы одного поставщика"), // Supplier IDs
  subject: z.string()
    .min(1, "Тема не может быть пустой")
    .refine((val) => {
      // Check if subject starts with "Запрос" and has at least 4 additional characters
      if (val.startsWith("")) {
        const afterZapros = val.substring(6).trim(); // Remove "Запрос" and trim spaces
        return afterZapros.length >= 2;
      }
      return true; // Allow subjects that don't start with "Запрос"
    }, {
      message: "Пожалуйста, заполните тему письма. Запрос будет отображен в истории ваших запросов под с аналогичным названием"
    }),
  message: z.string().min(1, "Сообщение не может быть пустым"),
  requestId: z.number().optional().default(0), // ID of the search request
  // Support for API suppliers from search engines
  apiSuppliers: z.array(z.object({
    id: z.union([z.number(), z.string()]),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    website: z.string().optional(),
    description: z.string().optional(),
    categories: z.array(z.string()).optional(),
    searchEngine: z.string().optional(),
    allEmails: z.array(z.string()).optional(),
    allPhones: z.array(z.string()).optional(),
    searchDate: z.string().optional(),
  })).optional().default([]),
  // Support for contact groups
  fromContactGroup: z.boolean().optional().default(false),
  // User-selected parameters for email templates
  parameters: z.array(z.union([z.string(), z.object({
    label: z.string(),
    value: z.string().optional()
  })])).optional().default([]),
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string(),
    content: z.string(), // Base64 encoded content
    encoding: z.string().optional(), // For specifying encoding type (e.g., 'base64')
    size: z.number().optional(),
    extractedText: z.string().optional(), // Extracted text from attachment
  })).optional().default([]),
});

export type User = typeof users.$inferSelect & {
  subscription?: Subscription;
};
export type InsertUser = typeof users.$inferInsert;
export type Manager = typeof managers.$inferSelect;
export type InsertManager = typeof managers.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect & {
  manager?: Manager;
};
export type InsertSubscription = typeof subscriptions.$inferInsert;
export type UserRegister = z.infer<typeof userRegisterSchema>;
export type BusinessCard = z.infer<typeof businessCardSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;
export type StagingSupplier = typeof stagingSuppliers.$inferSelect;
export type InsertStagingSupplier = typeof stagingSuppliers.$inferInsert;
export type SupplierSearchKeyword = typeof supplierSearchKeywords.$inferSelect;
export type InsertSupplierSearchKeyword = typeof supplierSearchKeywords.$inferInsert;
export type SearchRequest = typeof searchRequests.$inferSelect;
export type InsertSearchRequest = typeof searchRequests.$inferInsert;
export type RequestSupplier = typeof requestSuppliers.$inferSelect;
export type InsertRequestSupplier = typeof requestSuppliers.$inferInsert;
export type SupplierResponse = typeof supplierResponses.$inferSelect;
export type InsertSupplierResponse = typeof supplierResponses.$inferInsert;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = typeof analysisResults.$inferInsert;
export type ContactGroup = typeof contactGroups.$inferSelect & {
  contactCount?: number;
};
export type InsertContactGroup = typeof contactGroups.$inferInsert;
export type ContactItem = typeof contactItems.$inferSelect;
export type InsertContactItem = typeof contactItems.$inferInsert;
export type EmailRequest = typeof emailRequests.$inferSelect;
export type InsertEmailRequest = typeof emailRequests.$inferInsert;
export type RequestParameter = typeof requestParameters.$inferSelect;
export type InsertRequestParameter = typeof requestParameters.$inferInsert;
export type RequestSupplierGroup = typeof requestSupplierGroups.$inferSelect;
export type InsertRequestSupplierGroup = typeof requestSupplierGroups.$inferInsert;
export type SupplierMessage = typeof requestSupplierMessages.$inferSelect;
export type InsertSupplierMessage = typeof requestSupplierMessages.$inferInsert;
export type ExtractedParameter = typeof extractedParameters.$inferSelect;
export type InsertExtractedParameter = typeof extractedParameters.$inferInsert;
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

// Excluded domains table for stop-list functionality
export const excludedDomains = pgTable("excluded_domains", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  addedById: integer("added_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ExcludedDomain = typeof excludedDomains.$inferSelect;
export type InsertExcludedDomain = typeof excludedDomains.$inferInsert;

// Table for unprocessed emails (emails without REQ/ID tags)
export const unprocessedEmails = pgTable("unprocessed_emails", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  messageId: text("message_id").notNull().unique(), // Unique IMAP message ID
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name"),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).notNull(), // JSON array of attachments
  receivedAt: timestamp("received_at").notNull(),
  status: text("status", { 
    enum: ["new", "replied"] 
  }).default("new").notNull(),
  linkedRequestId: integer("linked_request_id").references(() => searchRequests.id),
  repliedAt: timestamp("replied_at"),
  replyContent: text("reply_content"),
  processedBy: integer("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UnprocessedEmail = typeof unprocessedEmails.$inferSelect;
export type InsertUnprocessedEmail = typeof unprocessedEmails.$inferInsert;

// Email templates table (unified for both reply and improvement templates)
export const emailReplyTemplates = pgTable("email_reply_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default('reply'), // 'reply' or 'improvement'
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EmailReplyTemplate = typeof emailReplyTemplates.$inferSelect;
export type InsertEmailReplyTemplate = typeof emailReplyTemplates.$inferInsert;

// Additional types for the matching system
export interface EmailAttachment {
  filename?: string;
  contentType?: string;
  content?: string;
  encoding?: string; // For specifying encoding type (e.g., 'base64')
  size?: number;
  extractedText?: string; // Extracted text content from the attachment
  [key: string]: any;
}

export type SupplierMatch = Supplier & {
  matchScore: number;
  matchDetails?: any;
};