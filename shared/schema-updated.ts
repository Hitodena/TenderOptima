// Обновленная схема с полями для асинхронной обработки
// Заменить в shared/schema.ts строки 125-142

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
  // Новые поля для асинхронной обработки
  processingStatus: text("processing_status").default("pending"), // pending, processing, completed, failed
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  processingError: text("processing_error")
});
