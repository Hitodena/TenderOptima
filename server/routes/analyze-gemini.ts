import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import os from 'os';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../auth';
import { pool } from '../db';
import { sendSimpleEmail } from '../email';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for file uploads (store on disk in temp first)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tempDir = os.tmpdir();
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `${file.fieldname}-${uniqueSuffix}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  }
});

// Helper function to notify admin
async function notifyAdmin(data: {
  type: string;
  requestId: number;
  userId: number;
  userEmail?: string;
  tzFile: string;
  kpFile: string;
}) {
  // Отправка в Telegram
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
    
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const message = `
🔔 Новый запрос на технический анализ

ID: ${data.requestId}
Пользователь: ${data.userEmail || `ID: ${data.userId}`}
ТЗ: ${data.tzFile}
КП: ${data.kpFile}

Файлы доступны на сервере для обработки.
      `;
      
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message
        })
      });
      
      console.log(`✅ Уведомление отправлено в Telegram для запроса #${data.requestId}`);
    }
  } catch (telegramError) {
    console.error('❌ Ошибка при отправке уведомления в Telegram:', telegramError);
    // Не прерываем выполнение, если Telegram уведомление не отправилось
  }

  // Отправка email (fallback)
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    
    if (adminEmail) {
      const emailSubject = `Новый запрос на технический анализ #${data.requestId}`;
      const emailText = `
Новый запрос на технический анализ через Gemini API:

ID запроса: ${data.requestId}
Пользователь ID: ${data.userId}
Email пользователя: ${data.userEmail || 'не указан'}
Файл ТЗ: ${data.tzFile}
Файл КП: ${data.kpFile}

Статус: pending
Ожидаемое время обработки: 2 часа

Пожалуйста, обработайте запрос вручную через Google AI Studio.
      `;

      await sendSimpleEmail(adminEmail, emailSubject, emailText);
      console.log(`✅ Email уведомление отправлено админу: ${adminEmail}`);
    }
  } catch (emailError) {
    console.error('❌ Ошибка при отправке email уведомления админу:', emailError);
    // Не прерываем выполнение, если email не отправился
  }
}

// POST endpoint for Gemini analysis
router.post('/analyze-gemini', 
  requireAuth,
  upload.fields([
    { name: 'technicalSpecification', maxCount: 1 },
    { name: 'commercialOffer', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (!files?.technicalSpecification?.[0] || !files?.commercialOffer?.[0]) {
        return res.status(400).json({
          success: false,
          error: 'Необходимо загрузить оба файла'
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Пользователь не авторизован'
        });
      }

      const tzFile = files.technicalSpecification[0];
      const kpFile = files.commercialOffer[0];
      
      // Сохраняем файлы в постоянное хранилище
      const uploadsDir = path.join(__dirname, '../../uploads/technical-analysis');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const tzPath = path.join(uploadsDir, `${timestamp}_tz_${tzFile.originalname}`);
      const kpPath = path.join(uploadsDir, `${timestamp}_kp_${kpFile.originalname}`);
      
      // Перемещаем файлы из временной директории в постоянную
      fs.renameSync(tzFile.path, tzPath);
      fs.renameSync(kpFile.path, kpPath);

      // Получаем analysis_request_id и project_id из body (опционально)
      const { analysis_request_id, project_id } = req.body;
      
      // Сохраняем в БД
      const result = await pool.query(`
        INSERT INTO technical_analysis_requests 
        (user_id, tz_file_path, kp_file_path, status, analysis_request_id, project_id) 
        VALUES ($1, $2, $3, 'pending', $4, $5)
        RETURNING id
      `, [userId, tzPath, kpPath, analysis_request_id || null, project_id || null]);
      
      const requestId = result.rows[0].id;
      
      // Обновляем статус analysis_request на 'in_progress' если указан
      if (analysis_request_id) {
        await pool.query(`
          UPDATE analysis_requests 
          SET status = 'in_progress', updated_at = NOW()
          WHERE id = $1
        `, [analysis_request_id]);
      }
      
      // Отправляем уведомление админу
      await notifyAdmin({
        type: 'new_technical_analysis',
        requestId: requestId,
        userId: userId,
        userEmail: req.user?.username || undefined,
        tzFile: tzFile.originalname,
        kpFile: kpFile.originalname
      });

      return res.json({
        success: true,
        requestId: requestId,
        message: 'Файлы загружены. Результат будет готов в течение 2 часов.',
        estimatedTime: '2 часа'
      });

    } catch (error) {
      console.error('❌ Ошибка:', error);
      
      // Clean up files on error
      try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (files?.technicalSpecification?.[0]?.path) {
          if (fs.existsSync(files.technicalSpecification[0].path)) {
            fs.unlinkSync(files.technicalSpecification[0].path);
          }
        }
        if (files?.commercialOffer?.[0]?.path) {
          if (fs.existsSync(files.commercialOffer[0].path)) {
            fs.unlinkSync(files.commercialOffer[0].path);
          }
        }
      } catch (cleanupError) {
        console.warn('⚠️ Ошибка при очистке файлов:', cleanupError);
      }
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  }
);

// GET endpoint for checking request status
router.get('/analyze-gemini/:requestId', 
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.requestId);
      
      if (isNaN(requestId)) {
        return res.status(400).json({
          success: false,
          error: 'Неверный ID запроса'
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Пользователь не авторизован'
        });
      }

      const result = await pool.query(`
        SELECT 
          tar.id, 
          tar.status, 
          tar.result_json, 
          tar.created_at, 
          tar.completed_at, 
          tar.tz_file_path, 
          tar.kp_file_path,
          ar.name as request_name
        FROM technical_analysis_requests tar
        LEFT JOIN analysis_requests ar ON tar.analysis_request_id = ar.id
        WHERE tar.id = $1 AND tar.user_id = $2
      `, [requestId, userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Запрос не найден'
        });
      }
      
      const request = result.rows[0];
      
      // Извлекаем имена файлов из путей
      const getFileName = (filePath: string | null) => {
        if (!filePath) return null;
        const parts = filePath.split(/[/\\]/);
        return parts[parts.length - 1] || null;
      };
      
      return res.json({
        success: true,
        data: {
          id: request.id,
          status: request.status,
          result: request.result_json,
          createdAt: request.created_at,
          completedAt: request.completed_at,
          tzFilePath: request.tz_file_path,
          kpFilePath: request.kp_file_path,
          tzFileName: getFileName(request.tz_file_path),
          kpFileName: getFileName(request.kp_file_path),
          requestName: request.request_name
        }
      });
      
    } catch (error) {
      console.error('❌ Ошибка:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  }
);

// Admin endpoint for uploading result
router.post('/admin/analyze-gemini/:requestId/result',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.requestId);
      
      if (isNaN(requestId)) {
        return res.status(400).json({
          success: false,
          error: 'Неверный ID запроса'
        });
      }

      const { result } = req.body;
      
      if (!result) {
        return res.status(400).json({
          success: false,
          error: 'Результат не предоставлен'
        });
      }

      // Обновляем запрос в БД
      await pool.query(`
        UPDATE technical_analysis_requests
        SET status = 'completed',
            result_json = $1,
            completed_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(result), requestId]);
      
      // Отправляем уведомление пользователю
      const userResult = await pool.query(`
        SELECT u.username as email 
        FROM technical_analysis_requests tar
        JOIN users u ON u.id = tar.user_id
        WHERE tar.id = $1
      `, [requestId]);
      
      if (userResult.rows.length > 0 && userResult.rows[0].email) {
        try {
          await sendSimpleEmail(
            userResult.rows[0].email,
            'Технический анализ готов',
            `Ваш анализ ТЗ и КП завершен. Результаты доступны в личном кабинете.`
          );
          console.log(`✅ Уведомление отправлено пользователю: ${userResult.rows[0].email}`);
        } catch (emailError) {
          console.error('❌ Ошибка при отправке email пользователю:', emailError);
          // Не прерываем выполнение, если email не отправился
        }
      }
      
      return res.json({
        success: true,
        message: 'Результат сохранен'
      });
      
    } catch (error) {
      console.error('❌ Ошибка:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  }
);

// GET endpoint for downloading files
router.get('/analyze-gemini/files',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const filePath = req.query.path as string;
      
      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: 'Путь к файлу не указан'
        });
      }
      
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Пользователь не авторизован'
        });
      }

      // Проверяем, что файл принадлежит пользователю
      const checkResult = await pool.query(`
        SELECT id FROM technical_analysis_requests
        WHERE (tz_file_path = $1 OR kp_file_path = $1) AND user_id = $2
      `, [filePath, userId]);
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Файл не найден или доступ запрещен'
        });
      }

      // Проверяем существование файла
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'Файл не найден на сервере'
        });
      }

      // Отправляем файл
      const fileName = path.basename(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error('❌ Ошибка при скачивании файла:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      });
    }
  }
);

export default router;

