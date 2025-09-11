import { Request, Response } from "express";
import { z } from "zod";
import { sendEmail } from "../email";
import { storage } from "../storage";
import { log } from "../vite";

// Schema for follow-up email validation
const followUpSchema = z.object({
  supplierId: z.union([z.number(), z.string()]), // Поддерживаем и числовые, и строковые ID
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
          userId: userId, // Use the userId passed from the route handler
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
        const referenceFooter = `При ответе на наш запрос не изменяйте тему письма (Subject), иначе мы не сможем обработать ваш ответ! \n\n!Request Reference: ${requestRef}\nRequest Tracking ID: ${trackingId}\n`;
        const msgFullContent = message + referenceFooter;

        // Сохраняем сообщение в историю с полной информацией
        const savedMessage = await storage.addSupplierMessage({
          userId: userId, // Add userId for proper data isolation
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
    
    // Отправляем email
    const emailSuccess = await sendEmail(
      supplier.email,
      subject,
      message,
      {
        trackingId,
        requestId,
        replyTo: process.env.EMAIL_FROM || process.env.SMTP_USER
      }
    );

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
    const { supplierId, requestId, message } = validationResult.data;
    // Устанавливаем тему по умолчанию, если она не указана
    const subject = validationResult.data.subject || `Уточнение предложения по заказу #${requestId}`;
    
    console.log(`[follow-up] Processing request:`, {
      supplierId,
      supplierIdType: typeof supplierId,
      requestId,
      requestIdType: typeof requestId,
      hasSubject: !!validationResult.data.subject
    });

    // Получаем данные запроса
    const searchRequest = await storage.getSearchRequest(requestId);
    if (!searchRequest) {
      console.error(`[follow-up] Search request with ID ${requestId} not found`);
      return res.status(404).json({ message: "Search request not found" });
    }

    // Генерируем tracking ID для отслеживания
    const trackingId = storage.generateTrackingId();
    
    // Пытаемся получить поставщика разными способами
    let supplier;
    
    // 1. Пробуем найти в основной таблице поставщиков
    console.log(`[follow-up] Trying to find supplier with ID: ${supplierId} (type: ${typeof supplierId})`);
    
    if (typeof supplierId === 'string') {
      supplier = await storage.getSupplierByStringId(supplierId);
      console.log(`[follow-up] Result of getSupplierByStringId: ${supplier ? 'Found' : 'Not found'}`);
    } else {
      supplier = await storage.getSupplier(supplierId);
      console.log(`[follow-up] Result of getSupplier: ${supplier ? 'Found' : 'Not found'}`);
    }
    
    // 2. Если не нашли, пробуем найти в requestSuppliers
    if (!supplier) {
      console.log(`[follow-up] Supplier not found in main suppliers table, checking requestSuppliers`);
      const requestSuppliers = await storage.getRequestSuppliers(requestId);
      console.log(`[follow-up] Found ${requestSuppliers.length} requestSuppliers for request ID ${requestId}`);
      
      // Более гибкий подход к поиску: сравниваем как строки и учитываем оба варианта
      const matchingSupplier = requestSuppliers.find(rs => 
        rs.supplierId === String(supplierId) || 
        rs.supplierId === supplierId
      );
      
      if (matchingSupplier) {
        // Создаем объект поставщика из данных requestSupplier
        supplier = {
          id: parseInt(matchingSupplier.supplierId),
          name: matchingSupplier.supplierName,
          email: matchingSupplier.supplierEmail,
          phone: matchingSupplier.supplierPhone || '',
          website: matchingSupplier.supplierWebsite || '',
          description: `Поставщик для запроса #${requestId}`,
          categories: []
        };
        console.log(`[follow-up] Found supplier in requestSuppliers: ${supplier.name} (ID: ${supplier.id})`);
      }
    }
    
    // 3. Если и в requestSuppliers не нашли, попробуем найти по responseId
    // В логах видно, что иногда вместо ID поставщика передается ID ответа
    if (!supplier && typeof supplierId === 'string' || typeof supplierId === 'number') {
      console.log(`[follow-up] Trying to find supplier by response ID: ${supplierId}`);
      const responses = await storage.getSupplierResponses(requestId);
      
      // Ищем ответ с ID = supplierId
      const matchingResponse = responses.find(r => r.id === parseInt(String(supplierId)));
      
      if (matchingResponse) {
        console.log(`[follow-up] Found matching response with supplierId: ${matchingResponse.supplierId}`);
        // Теперь ищем поставщика по ID из ответа
        if (matchingResponse.supplierId) {
          supplier = await storage.getSupplierByStringId(matchingResponse.supplierId);
          
          if (!supplier) {
            // Если поставщик все еще не найден, создаем временный объект из данных ответа
            supplier = {
              id: parseInt(matchingResponse.supplierId),
              name: matchingResponse.supplierName || 'Неизвестный поставщик',
              email: matchingResponse.supplierEmail,
              phone: '',
              website: '',
              description: `Поставщик из ответа #${supplierId}`,
              categories: []
            };
            console.log(`[follow-up] Created temporary supplier from response data: ${supplier.name}`);
          }
        }
      }
    }
    
    // Если поставщик не найден вообще
    if (!supplier) {
      console.error(`[follow-up] Supplier with ID ${supplierId} not found anywhere despite all attempts`);
      return res.status(404).json({ message: "Supplier not found" });
    }
    
    // Отправляем email и сохраняем сообщение
    console.log(`[follow-up] Processing email to ${supplier.name} <${supplier.email}> for request #${requestId}`);
    
    try {
      // Get the authenticated user ID
      const userId = req.user?.id || null;
      
      // 1. Проверяем существующую связь запрос-поставщик
      let requestSupplier = await storage.getRequestSupplierByRequestAndEmail(
        requestId,
        supplier.email
      ).catch(err => {
        console.warn(`[follow-up] Error checking for existing request-supplier link:`, err);
        return null;
      });
      
      // 2. Создаем связь, если не существует
      let requestSupplierId = requestSupplier?.id;
      if (!requestSupplier) {
        try {
          const newRequestSupplier = await storage.createRequestSupplier({
            userId: userId, // Use the userId passed from the route handler
            requestId: requestId,
            supplierId: supplier.id.toString(),
            supplierEmail: supplier.email,
            supplierName: supplier.name,
            supplierWebsite: supplier.website || '',
            supplierPhone: supplier.phone || '',
            trackingId: trackingId,
            hasResponded: false,
            // Гарантируем, что emailSubject всегда строка
            emailSubject: subject || `Уточнение предложения по заказу #${requestId}`,
            emailContent: message,
            sentAt: new Date()
          });
          
          requestSupplierId = newRequestSupplier.id;
          console.log(`[follow-up] Created new request-supplier link with ID ${requestSupplierId}`);
        } catch (createError) {
          console.error('[follow-up] Error creating request-supplier relation:', createError);
          // Продолжаем даже при ошибке
        }
      }
      
      // Формируем тему письма с полными идентификаторами запроса и отслеживания
      // Используем полный формат REQ-2504-27567
      const searchRequest = await storage.getSearchRequest(requestId);
      const orderNumber = searchRequest?.orderNumber || '0000-00000';
      const requestRef = `REQ-${orderNumber}`;
      const formattedSubject = `${subject || `Уточнение предложения по заказу #${requestId}`} [${requestRef}] [TID:${trackingId}]`;
      
      // Добавляем информацию для отслеживания в конец сообщения
      const referenceFooter = `\n !При ответе на наш запрос не меняйте тему письма (Subject), иначе мы не сможем обработать ваш ответ! \n!Request Reference: ${requestRef}\nRequest Tracking ID: ${trackingId}\n`;
      const fullMessage = message + referenceFooter;
      
      // 3. Сохраняем сообщение в историю (если есть связь)
      let messageId;
      if (requestSupplierId) {
        try {
        
        // Сохраняем сообщение в историю c полным форматированием
        const savedMessage = await storage.addSupplierMessage({
            userId: userId, // Add user ID for proper data isolation
            requestSupplierId: requestSupplierId,
            direction: "outbound",
            content: fullMessage,
            subject: formattedSubject,
            sentDate: new Date(),
          });
          
          messageId = savedMessage.id;
          console.log(`[follow-up] Message saved to history with ID ${messageId}`);
        } catch (saveError) {
          console.error('[follow-up] Error saving message:', saveError);
          // Продолжаем даже при ошибке
        }
      }
      
      // 4. Отправляем email
      // Используем уже сформированные ранее значения темы и содержания
      
      // Отправляем email с форматированной темой и дополненным сообщением
      const emailSuccess = await sendEmail(
        supplier.email,
        formattedSubject,
        fullMessage,
        {
          trackingId,
          requestId,
          replyTo: process.env.EMAIL_FROM || process.env.SMTP_USER
        }
      );

      if (!emailSuccess) {
        console.error('[follow-up] Failed to send email');
        throw new Error("Failed to send email");
      }

      console.log(`[follow-up] Email sent successfully to ${supplier.email} (tracking ID: ${trackingId})`);

      // 5. Log this as a compliance check request (not improvement request)
      try {
        await storage.logImprovementRequest({
          userId: userId,
          requestId: requestId,
          supplierId: String(supplier.id),
          supplierEmail: supplier.email,
          supplierName: supplier.name,
          subject: subject || `Уточнение предложения по заказу #${requestId}`,
          message: message,
          requestType: "compliance_check"
        });
        console.log('[follow-up] Compliance check request logged to improvement_requests table');
      } catch (logError) {
        console.error('[follow-up] Error logging compliance check request:', logError);
        // Continue even if logging fails
      }

      return res.status(200).json({
        message: "Follow-up email sent successfully",
        trackingId,
        messageId,
        requestSupplierId
      });
    } catch (error: any) {
      console.error(`[follow-up] Error in email handling:`, error);
      return res.status(500).json({
        message: "Failed to send follow-up email",
        error: error.message
      });
    }
  } catch (error: any) {
    console.error(`[follow-up] General error:`, error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
}