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
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { pool } from "./db";
import cors from "cors";
import net from "net";
import { csrfProtection, csrfTokenMiddleware, csrfErrorHandler } from "./middleware/csrfProtection";
import { PersonalImapService } from "./imap-service-personal";
import { storage } from "./storage";

// Minimal environment logging for faster startup
if (process.env.NODE_ENV === 'development') {
  console.log('Starting server in development mode');
}

// Initialize IMAP service for automatic email checking
const personalImapService = new PersonalImapService();

// Function to check emails for all users with configured email
async function checkEmailsForAllUsers() {
  try {
    console.log('📧 Checking emails for all users with configured email...');
    
    // Get all users with email configuration
    const usersWithEmail = await storage.getUsersWithEmailConfig();
    console.log(`📧 Found ${usersWithEmail.length} users with configured email`);
    
    if (usersWithEmail.length === 0) {
      console.log('📧 No users with configured email found');
      return;
    }
    
    // Check emails for each user using the same approach as manual check
    for (const user of usersWithEmail) {
      try {
        console.log(`📧 Checking emails for user ${user.id} (${user.emailAccount})`);
        
        // Use the same approach as manual check - check all requests for this user
        const result = await personalImapService.checkEmailsOnDemand(undefined, user.id);
        
        if (result.success) {
          console.log(`✅ User ${user.id}: Found ${result.newResponses} new responses`);
        } else {
          console.log(`❌ User ${user.id}: ${result.message}`);
        }
      } catch (error) {
        console.error(`❌ Error checking emails for user ${user.id}:`, error);
      }
    }
    
    console.log('📧 Email check completed for all users');
  } catch (error) {
    console.error('❌ Error in checkEmailsForAllUsers:', error);
  }
}

// Function to start automatic email checking
function startAutomaticEmailChecking() {
  console.log('🔄 Starting automatic email checking...');
  
  // Check emails every 2 minutes (120000 ms)
  const checkInterval = 2 * 60 * 1000;
  
  // Initial check after 30 seconds to let server fully start
  setTimeout(async () => {
    console.log('📧 Performing initial email check...');
    try {
      await checkEmailsForAllUsers();
      console.log('✅ Initial email check completed');
    } catch (error) {
      console.error('❌ Initial email check failed:', error);
    }
  }, 30000);
  
  // Set up regular interval for email checking
  setInterval(async () => {
    console.log('📧 Performing scheduled email check...');
    try {
      await checkEmailsForAllUsers();
      console.log('✅ Scheduled email check completed');
    } catch (error) {
      console.error('❌ Scheduled email check failed:', error);
    }
  }, checkInterval);
  
  console.log(`📧 Automatic email checking configured - checking every ${checkInterval / 1000} seconds`);
}

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 1 день в секундах
}));

// Селективные заголовки кэширования - разные правила для разных типов ресурсов
app.use((req, res, next) => {
  const path = req.path;
  const isApiRoute = path.startsWith('/api/');
  const isAuthRoute = path.startsWith('/api/auth/');
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i.test(path);
  
  // Для API маршрутов - НЕ кэшируем, но сохраняем сессии
  if (isApiRoute) {
    if (isAuthRoute) {
      // Для аутентификации - полное отключение кэширования
      res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');
    } else {
      // Для остальных API - отключаем кэширование, но разрешаем сессии
      res.header('Cache-Control', 'no-cache, must-revalidate, private');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');
    }
  } else if (isStaticAsset) {
    // Для статических ресурсов - кэшируем с хэшем
    res.header('Cache-Control', 'public, max-age=31536000, immutable'); // 1 год
    res.header('Last-Modified', new Date().toUTCString());
  } else {
    // Для HTML страниц - отключаем кэширование
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  }
  
  // Общие заголовки безопасности
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Заголовки для предотвращения проблем с Chrome
  res.header('Last-Modified', new Date().toUTCString());
  res.header('ETag', `"${Date.now()}"`);
  
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

// Minimal request logging for performance
app.use((req, res, next) => {
  // Only log critical errors, not normal requests
  next();
});

// Optimized request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Only log slow requests (>1000ms) or errors
    if (path.startsWith("/api") && (duration > 1000 || res.statusCode >= 400)) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
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

  // Setup Socket.IO for real-time updates
  io.on('connection', (socket) => {
    console.log('🔌 Client connected to Socket.IO:', socket.id);
    
    // Handle user authentication for socket
    socket.on('authenticate', (data) => {
      console.log('🔐 Socket authentication attempt:', data);
      if (data.userId) {
        socket.join(`user_${data.userId}`);
        console.log(`👤 User ${data.userId} joined their room`);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected from Socket.IO:', socket.id);
    });
    
    // Log all events for debugging
    socket.onAny((event, ...args) => {
      console.log(`📡 Socket event received: ${event}`, args);
    });
  });

  // Export io for use in other modules
  (global as any).io = io;

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
      
      // Start automatic email checking after server is ready (if enabled)
      const enableEmailChecking = process.env.ENABLE_EMAIL_CHECKING === 'true';
      if (enableEmailChecking) {
        console.log('📧 Email checking is ENABLED - starting automatic email checking...');
        startAutomaticEmailChecking();
      } else {
        console.log('📧 Email checking is DISABLED - skipping automatic email checking');
        console.log('📧 To enable email checking, set ENABLE_EMAIL_CHECKING=true in your environment');
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
