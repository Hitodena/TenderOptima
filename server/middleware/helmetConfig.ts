import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Конфигурация Helmet для безопасности
export const helmetConfig = helmet({
  // Защита от XSS атак
  xssFilter: true,
  
  // Защита от MIME sniffing
  noSniff: true,
  
  // Защита от clickjacking
  frameguard: { action: 'deny' },
  
  // Принуждение к HTTPS (только в продакшене)
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 год
    includeSubDomains: true,
    preload: true
  } : false,
  
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // В разработке разрешаем unsafe-eval для Vite
      connectSrc: ["'self'", "ws:", "wss:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  
  // Защита от DNS prefetching
  dnsPrefetchControl: { allow: false },
  
  // Защита от IE XSS
  ieNoOpen: true
});

// Middleware для логирования безопасности
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  // Логируем подозрительную активность
  if (userAgent.includes('bot') || userAgent.includes('crawler')) {
    console.log(`[Security] Bot detected: ${ip} - ${userAgent}`);
  }
  
  // Логируем попытки доступа к защищенным ресурсам
  if (req.path.includes('admin') || req.path.includes('api/auth')) {
    console.log(`[Security] Protected resource access: ${ip} - ${req.path}`);
  }
  
  next();
};
