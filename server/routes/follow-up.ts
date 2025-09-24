import { Request, Response } from "express";
import { z } from "zod";
import { emailService } from "../email";
import { storage } from "../storage";
import { log } from "../vite";

// Schema for follow-up email validation
const followUpSchema = z.object({
  supplierId: z.union([z.number(), z.string()]), // Поддерживаем и числовые, и строковые ID
  supplierEmail: z.string().email().optional(), // Опционально - email поставщика
  supplierName: z.string().optional(), // Опционально - имя поставщика
  requestId: z.number(),
  // Делаем поле subject опциональным, т.к. в БД его нет и теперь клиент его не отправляет
  subject: z.string().min(1, "Subject cannot be empty").optional(),
  message: z.string().min(1, "Message cannot be empty")
});

// Вспомогательная функция для обработки отправки сообщения
async function processSupplierFollowUp(
  supplier: any, 
  searchRequest: any, 
  requestId: number, 
  subject: string, 
  message: string, 
  trackingId: string, 
  res: Response,
  userId: number | null // Add userId parameter to pass down from route handlers
) {
  if (!searchRequest) {
    console.error(`[follow-up] Search request with ID ${requestId} not found`);
    return res.status(404).json({ message: "Search request not found" });
  }

  console.log(`[follow-up] Processing follow-up with supplier: ${supplier.name}, email: ${supplier.email}`);

  try {
    // Сначала проверяем существует ли уже связь поставщика с запросом
    let requestSupplier;
    try {
      requestSupplier = await storage.getRequestSupplierByRequestAndEmail(
        requestId,
        supplier.email
      );
      console.log(`[follow-up] Request supplier relation found: ${requestSupplier ? 'yes, ID=' + requestSupplier.id : 'no'}`);
    } catch (lookupError) {
      console.error(`[follow-up] Error looking up request supplier relation:`, lookupError);
    }
    
    // Если нет, создаем новую запись
    let requestSupplierId = requestSupplier?.id;
    if (!requestSupplier) {
      try {
        const newRequestSupplier = await storage.createRequestSupplier({
          userId: userId || undefined, // Use the userId passed from the route handler
          requestId: requestId,
          supplierId: supplier.id.toString(),  // Преобразуем в строку, т.к. в схеме это строка
          supplierEmail: supplier.email,
          supplierName: supplier.name,
          supplierWebsite: supplier.website || '',
          supplierPhone: supplier.phone || '',
          trackingId: trackingId,
          hasResponded: false,
          emailSubject: subject,
          emailContent: message,
          sentAt: new Date()
        });
        requestSupplierId = newRequestSupplier.id;
        console.log(`[follow-up] Created new request supplier link with ID ${requestSupplierId}`);
      } catch (createError) {
        console.error('[follow-up] Error creating request supplier relation:', createError);
        // Продолжаем отправку email даже при ошибке создания связи
      }
    }
    
    // Теперь пробуем сначала сохранить сообщение (перед отправкой email)
    let messageId;
    if (requestSupplierId) {
      try {
        // Формируем полный текст сообщения с идентификаторами для отслеживания
        const requestRef = `RQ${requestId}`;
        const msgFormattedSubject = `${subject} [${requestRef}] [TID:${trackingId}]`;
        // Add tracking footer to message BEFORE business card
        const referenceFooter = `\n**!При ответе на наш запрос не меняйте тему письма (Subject), иначе мы не сможем обработать ваш ответ!**\n!Request Reference: ${requestRef}\nRequest Tracking ID: ${trackingId}\n`;
        
        // Insert the footer before the business card if it exists in content
        let msgFullContent = message;
        if (message.includes('С уважением,') || message.includes('С Уважением,')) {
          // Find the position where business card starts and insert footer before it
          const businessCardStart = message.lastIndexOf('С уважением,');
          if (businessCardStart !== -1) {
            const beforeBusinessCard = message.substring(0, businessCardStart);
            const businessCard = message.substring(businessCardStart);
            // Add one space before business card
            msgFullContent = beforeBusinessCard + referenceFooter + '\n' + businessCard;
          } else {
            msgFullContent = message + referenceFooter;
          }
        } else {
          msgFullContent = message + referenceFooter;
        }

        // Сохраняем сообщение в историю с полной информацией
        const savedMessage = await storage.addSupplierMessage({
          userId: userId || undefined, // Add userId for proper data isolation
          requestSupplierId: requestSupplierId,
          direction: "outbound", // направление: outbound вместо outgoing
          content: msgFullContent, // Используем полный текст с идентификаторами
          subject: msgFormattedSubject, // Сохраняем тему с идентификаторами
          sentDate: new Date(), // sentDate вместо timestamp
        });
        
        messageId = savedMessage.id;
        console.log(`[follow-up] Message saved to history with ID ${messageId} for requestSupplierId ${requestSupplierId}`);
      } catch (saveError) {
        console.error('[follow-up] Error saving message to database:', saveError);
        // Продолжаем отправку даже если сохранение сообщения не удалось
      }
    }
    
    // Формируем тему и сообщение с трекинг-информацией
    const orderNumber = searchRequest.orderNumber || '0000-00000';
    const requestRef = `REQ-${orderNumber}`;
    const formattedSubject = `${subject} [${requestRef}] [TID:${trackingId}]`;
    // Add tracking footer to message BEFORE business card
    // The footer should appear after the main content but before the business card
    const referenceFooter = `\n**!При ответе на наш запрос не меняйте тему письма (Subject), иначе мы не сможем обработать ваш ответ!**\n!Request Reference: ${requestRef}\nRequest Tracking ID: ${trackingId}\n`;
    
    // Insert the footer before the business card if it exists in content
    let fullMessage = message;
    if (message.includes('С уважением,') || message.includes('С Уважением,')) {
      // Find the position where business card starts and insert footer before it
      const businessCardStart = message.lastIndexOf('С уважением,');
      if (businessCardStart !== -1) {
        const beforeBusinessCard = message.substring(0, businessCardStart);
        const businessCard = message.substring(businessCardStart);
        // Add one space before business card
        fullMessage = beforeBusinessCard + referenceFooter + '\n' + businessCard;
      } else {
        fullMessage = message + referenceFooter;
      }
    } else {
      fullMessage = message + referenceFooter;
    }

    // Отправляем email
    const emailSuccess = await emailService.sendEmail({
      to: supplier.email,
      subject: formattedSubject,
      text: fullMessage,
      html: fullMessage.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
      userId: userId || undefined,
      hideBusinessCard: true, // Hide business card for follow-up requests
    });

    if (!emailSuccess) {
      console.error('[follow-up] Failed to send email');
      throw new Error("Failed to send email");
    }

    // Email successfully sent
    console.log(`[follow-up] Email sent successfully to ${supplier.email} (tracking ID: ${trackingId})`);

    return res.status(200).json({
      message: "Follow-up email sent successfully",
      trackingId,
      messageId,
      requestSupplierId
    });
  } catch (error: any) {
    console.error(`[follow-up] Error sending follow-up email:`, error);
    return res.status(500).json({
      message: "Failed to send follow-up email",
      error: error.message
    });
  }
}

export async function sendFollowUp(req: Request, res: Response) {
  try {
    console.log('[follow-up] Processing follow-up request', {
      body: typeof req.body === 'object' ? JSON.stringify(req.body) : typeof req.body,
      contentType: req.headers['content-type']
    });
    
    // Validate input
    let validationResult;
    try {
      validationResult = followUpSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error('[follow-up] Validation error:', validationResult.error.format());
        return res.status(400).json({
          message: "Invalid request data",
          errors: validationResult.error.format()
        });
      }
    } catch (parseError) {
      console.error('[follow-up] Error parsing request body:', parseError);
      return res.status(400).json({
        message: "Could not parse request data",
        error: String(parseError)
      });
    }

    // Извлечение данных из запроса с fallback значениями для отсутствующих полей
    const { supplierId, supplierEmail, supplierName, requestId, message } = validationResult.data;
    // Устанавливаем тему по умолчанию, если она не указана
    const subject = validationResult.data.subject || `Уточнение предложения по заказу #${requestId}`;
    
    // Get the user ID first, as it's needed for secure data retrieval
    const userId = req.user?.id || null;

    console.log(`[follow-up] Processing request:`, {
      supplierId,
      supplierIdType: typeof supplierId,
      requestId,
      requestIdType: typeof requestId,
      hasSubject: !!validationResult.data.subject
    });

    // Получаем данные запроса, ОБЯЗАТЕЛЬНО с фильтром по пользователю
    const searchRequest = await storage.getSearchRequest(requestId, userId || undefined);
    if (!searchRequest) {
      console.error(`[follow-up] Search request with ID ${requestId} not found for user ${userId}`);
      return res.status(404).json({ message: "Search request not found" });
    }

    // Генерируем tracking ID для отслеживания
    const trackingId = storage.generateTrackingId();
    
    // Идентификатор пользователя
    let supplier;
    
    // ПРИОРИТЕТ: Если клиент передал данные поставщика (как в кнопке "Улучшить"), используем их
    if (supplierEmail && supplierName) {
      console.log(`[follow-up] Using supplier data from client: ${supplierName} (${supplierEmail})`);
      supplier = {
        id: supplierId,
        name: supplierName,
        email: supplierEmail,
        phone: '',
        website: '',
        description: `Supplier data from client`,
        categories: []
      };
      // Сразу обрабатываем запрос
      return processSupplierFollowUp(supplier, searchRequest, requestId, subject, message, trackingId, res, userId);
    }
    
    // FALLBACK: Пытаемся найти поставщика в базе данных (старая логика)
    console.log(`[follow-up] No supplier data from client, searching in database...`);
    if (typeof supplierId === 'number') {
      supplier = await storage.getSupplier(supplierId);
    } else if (typeof supplierId === 'string') {
      // Может быть ID или email
      if (supplierId.includes('@')) {
        supplier = await storage.getSupplierByEmail(supplierId);
      } else {
        // Пробуем как ID, если не email
        const numericId = parseInt(supplierId, 10);
        if (!isNaN(numericId)) {
          supplier = await storage.getSupplier(numericId);
        }
      }
    }

    if (supplier) {
      // Если поставщик найден в базе данных
      return processSupplierFollowUp(supplier, searchRequest, requestId, subject, message, trackingId, res, userId);
    }
    
    // Если поставщик не найден, возможно, это новый email
    if (typeof supplierId === 'string' && supplierId.includes('@')) {
      const newSupplier = {
        name: supplierId.split('@')[0], // Имя по умолчанию из email
        email: supplierId,
        id: `new-${Date.now()}` // Временный ID для обработки
      };
      // Обрабатываем как нового поставщика
      return processSupplierFollowUp(newSupplier, searchRequest, requestId, subject, message, trackingId, res, userId);
    }

    // Если ничего не подошло
    console.error(`[follow-up] Supplier with ID/email "${supplierId}" not found and no supplier data provided`);
    return res.status(404).json({ message: "Supplier not found" });
  } catch (error: any) {
    console.error(`[follow-up] General error:`, error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}