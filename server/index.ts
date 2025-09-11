// Загрузка переменных окружения в самом начале приложения
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Определяем эквиваленты __dirname для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверяем наличие .env файлов в разных местах (приоритет от корня к подпапкам)
const rootEnvPath = path.resolve(process.cwd(), '.env');
const projectEnvPath = path.join(__dirname, '../.env');

// Загружаем .env файл, отдавая приоритет корневому файлу
if (fs.existsSync(rootEnvPath)) {
  console.log(`[Server] Загружаем .env файл из корня проекта: ${rootEnvPath}`);
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(projectEnvPath)) {
  console.log(`[Server] Загружаем .env файл из подпапки проекта: ${projectEnvPath}`);
  dotenv.config({ path: projectEnvPath });
} else {
  console.warn(`[Server] ВНИМАНИЕ: .env файл не найден. Используются только переменные окружения системы.`);
}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { pool } from "./db";
import cors from "cors";
import net from "net";
import { csrfProtection, csrfTokenMiddleware, csrfErrorHandler } from "./middleware/csrfProtection";

// Выводим для отладки значения переменных
console.log('Environment settings:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SKIP_AUTH:', process.env.SKIP_AUTH);
console.log('DEV_MODE:', process.env.DEV_MODE);

const app = express();

// Устанавливаем доверие к прокси для корректной работы в Replit
app.set('trust proxy', 1);

// Настройка CORS для обеспечения работы с клиентской частью
app.use(cors({
  origin: function(origin, callback) {
    // В режиме разработки разрешаем все источники
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Разрешаем локальные соединения или соединения с replit
    const allowedDomains = [
      'localhost', 
      '127.0.0.1',
      'replit.dev',
      'replit.app',
      'replit.com',
      'kirk.replit.dev'
    ];
    
    const isAllowed = allowedDomains.some(domain => 
      origin.includes(domain)
    );
    
    if (isAllowed) {
      console.log('Разрешаем CORS для origin:', origin);
      callback(null, true);
    } else {
      console.log('Блокируем CORS для origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 1 день в секундах
}));

// Дополнительные заголовки для лучшей совместимости
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

// Increase the limit for JSON body parser to handle file attachments (15MB limit)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false, limit: '15mb' }));

// Регистрируем маршруты контактной формы
import contactRoutes from './routes/contact';
app.use('/api/contact', contactRoutes);

// Регистрируем маршруты администратора
import adminRouter from './routes/admin';
app.use('/api/admin', adminRouter);

// Регистрируем маршруты подписок будут зарегистрированы в routes.ts после настройки аутентификации

// Регистрируем маршруты поиска Yandex
import yandexSearchRoutes from './routes/yandex-search';
app.use('/api/yandex-search', yandexSearchRoutes);
console.log('[Server] Registered Yandex search routes at /api/yandex-search');

// Регистрируем объединенный поиск поставщиков
import supplierSearchRoutes from './routes/supplier-search';
app.use('/api/supplier-search', supplierSearchRoutes);
console.log('[Server] Registered unified supplier search routes at /api/supplier-search');

// ПЕРЕХВАТЫВАЕМ ВСЕ POST ЗАПРОСЫ ЗДЕСЬ В САМОМ НАЧАЛЕ
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path.includes('send-email')) {
    console.log("⚡ СУПЕР-РАННЕЕ ЛОГИРОВАНИЕ:", req.method, req.path);
    console.log("⚡ URL:", req.url);
    console.log("⚡ Body suppliers:", req.body?.suppliers);
    console.log("⚡ Body suppliers length:", req.body?.suppliers?.length);
  }
  next();
});

app.use((req, res, next) => {
  // Специальное логирование для /api/send-email
  if (req.path === '/api/send-email' && req.method === 'POST') {
    console.log("=== ГЛОБАЛЬНОЕ ЛОГИРОВАНИЕ: /api/send-email ===");
    console.log("Method:", req.method);
    console.log("Path:", req.path);
    console.log("Headers:", req.headers);
    console.log("Body suppliers:", req.body?.suppliers);
    console.log("Body suppliers length:", req.body?.suppliers?.length);
  }
  
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Setup authentication
  await setupAuth(app);
  
  // Setup CSRF protection
  app.use(csrfProtection);
  app.use(csrfTokenMiddleware);
  app.use(csrfErrorHandler);
  
  // CSRF token endpoint for frontend
  app.get('/api/csrf-token', (req: Request, res: Response) => {
    res.json({ 
      csrfToken: req.csrfToken(),
      message: 'CSRF token generated successfully'
    });
  });
  
  // Register API routes
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Function to check if port is available
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      server.on('error', () => resolve(false));
    });
  };

  // Function to find an available port starting from a given port
  const findAvailablePort = async (startPort: number): Promise<number> => {
    let port = startPort;
    while (port < startPort + 100) {
      if (await isPortAvailable(port)) {
        return port;
      }
      port++;
    }
    throw new Error(`No available ports found starting from ${startPort}`);
  };

  // Try to use the port specified in environment variable, fallback to finding available port
  let port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  
  try {
    // Check if the specified port is available
    if (!(await isPortAvailable(port))) {
      console.log(`Port ${port} is in use, finding available port...`);
      port = await findAvailablePort(port);
      console.log(`Found available port: ${port}`);
    }

    // Set up error handler before listening
    server.on('error', async (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${port} is busy, trying to find another available port...`);
        try {
          const newPort = await findAvailablePort(port + 1);
          console.log(`Retrying on port ${newPort}...`);
          server.listen({
            port: newPort,
            host: "0.0.0.0",
          }, () => {
            log(`serving on port ${newPort}`);
          });
        } catch (portError) {
          console.error('Failed to find available port:', portError);
          process.exit(1);
        }
      } else {
        console.error('Server startup error:', error);
        process.exit(1);
      }
    });

    // Start the server on the determined port
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`serving on port ${port}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
