import { Request, Response } from 'express';
import multer from 'multer';
import { storage } from '../storage';
import { db } from '../db';
import { requireAuth } from '../middleware/requireAuth';
import { subscriptionService } from '../subscription';

// Создаем временное хранилище для загруженных файлов
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB макс. размер файла
  },
});

// Middleware для обработки файлов
const handleFileUpload = upload.array('attachments');

/**
 * Обработчик для добавления сообщения поставщику
 */
export async function addSupplierMessage(req: Request, res: Response) {
  try {
    // Используем multer для обработки файлов вложений
    handleFileUpload(req, res, async (err) => {
      if (err) {
        console.error('[supplier-messages] Ошибка загрузки файла:', err);
        return res.status(400).json({ message: 'File upload error', error: String(err) });
      }

      const requestSupplierId = parseInt(req.params.id);
      const messageText = req.body.content || req.body.messageText;

      console.log(`[supplier-messages] Добавление сообщения для requestSupplierId=${requestSupplierId}, содержание: ${messageText ? messageText.substring(0, 50) + '...' : 'пусто'}`);

      if (isNaN(requestSupplierId)) {
        console.error('[supplier-messages] Некорректный ID поставщика');
        return res.status(400).json({ message: 'Invalid supplier ID' });
      }

      // Проверяем, существует ли такой requestSupplier
      const requestSupplier = await storage.getRequestSupplierById(requestSupplierId);
      if (!requestSupplier) {
        console.error(`[supplier-messages] RequestSupplier с ID ${requestSupplierId} не найден`);
        return res.status(404).json({ message: `RequestSupplier with ID ${requestSupplierId} not found` });
      }

      // Получаем загруженные файлы
      const files = req.files as Express.Multer.File[];
      
      console.log(`[supplier-messages] Количество вложений: ${files ? files.length : 0}`);
      
      // Преобразуем файлы в формат для хранения
      // Важно правильно указать encoding как 'base64' чтобы при отправке письма вложения корректно обрабатывались
      const attachments = files ? files.map(file => ({
        filename: file.originalname,
        contentType: file.mimetype,
        content: file.buffer.toString('base64'),
        encoding: 'base64',
        size: file.size
      })) : [];

      // Сохраняем сообщение в базу данных
      try {
        // Получаем userId из запроса аутентификации
        const userId = req.user?.id;
        console.log(`[supplier-messages] User ID from request: ${userId}`);

        // Note: Request counting is handled at the higher level (/api/send-email endpoint)
        // Individual message saving does not increment the counter
        
        const newMessage = await storage.addSupplierMessage({
          userId: userId || null,
          requestSupplierId,
          content: messageText || '',
          subject: `Сообщение для поставщика от ${new Date().toLocaleDateString('ru-RU')}`,
          direction: 'outbound', // отправлено пользователем системы, не поставщиком
          sentDate: new Date(),
          attachments
        });

        console.log(`[supplier-messages] Сообщение успешно сохранено с ID: ${newMessage.id}`);
        return res.status(201).json(newMessage);
      } catch (dbError) {
        console.error('[supplier-messages] Ошибка при сохранении сообщения в БД:', dbError);
        return res.status(500).json({ 
          message: 'Failed to save message to database', 
          error: String(dbError) 
        });
      }
    });
  } catch (error) {
    console.error('[supplier-messages] Ошибка при добавлении сообщения поставщику:', error);
    return res.status(500).json({ 
      message: 'Failed to send message to supplier', 
      error: String(error) 
    });
  }
}

/**
 * Обработчик для получения сообщений поставщика
 */
export async function getSupplierMessages(req: Request, res: Response) {
  try {
    const requestSupplierId = parseInt(req.params.id);

    if (isNaN(requestSupplierId)) {
      console.error('[supplier-messages] Недопустимый ID поставщика:', req.params.id);
      return res.status(400).json({ message: 'Invalid request supplier ID' });
    }
    
    console.log(`[supplier-messages] Получение сообщений для requestSupplierId = ${requestSupplierId}`);

    // Сначала проверяем, что такой requestSupplier существует
    const requestSupplier = await storage.getRequestSupplierById(requestSupplierId);
    if (!requestSupplier) {
      console.warn(`[supplier-messages] RequestSupplier с ID ${requestSupplierId} не найден`);
      return res.status(404).json({ message: `RequestSupplier with ID ${requestSupplierId} not found` });
    }
    
    // Получаем userId из запроса аутентификации
    const userId = req.user?.id;
    console.log(`[supplier-messages] User ID from request: ${userId}`);
    
    // Получаем все сообщения для данного requestSupplierId с фильтрацией по userId
    const messages = await storage.getSupplierMessages(requestSupplierId, userId);
    
    console.log(`[supplier-messages] Найдено ${messages.length} сообщений для requestSupplierId ${requestSupplierId} и userId ${userId || 'not provided'}`);
    
    // Отправляем сообщения клиенту
    return res.json(messages);
  } catch (error) {
    console.error('[supplier-messages] Ошибка при получении сообщений поставщика:', error);
    return res.status(500).json({ 
      message: 'Failed to get supplier messages', 
      error: String(error) 
    });
  }
}