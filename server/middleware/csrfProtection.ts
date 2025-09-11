import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';

/**
 * CSRF защита для приложения
 * Предотвращает Cross-Site Request Forgery атаки
 */

// Настройки CSRF защиты
const csrfOptions = {
  cookie: {
    httpOnly: true, // Куки недоступны через JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS только в продакшене
    sameSite: 'strict' as const, // Строгая политика SameSite
    maxAge: 3600000 // 1 час
  },
  // Игнорируем GET, HEAD, OPTIONS запросы (они не изменяют данные)
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  // Пропускаем CSRF проверку для API endpoints, которые не изменяют данные
  skip: (req: Request) => {
    // Пропускаем в режиме разработки с SKIP_AUTH
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      return true;
    }
    
    // Пропускаем для статических файлов
    if (req.path.startsWith('/static/') || req.path.startsWith('/assets/')) {
      return true;
    }
    
    // Пропускаем для WebSocket соединений
    if (req.headers.upgrade === 'websocket') {
      return true;
    }
    
    return false;
  }
};

// Создаем CSRF middleware только если не в режиме разработки
export const csrfProtection = process.env.NODE_ENV === 'development' 
  ? (req: Request, res: Response, next: NextFunction) => next() // Пропускаем CSRF в dev режиме
  : csrf(csrfOptions);

/**
 * Middleware для получения CSRF токена
 * Добавляет токен в ответ для использования на фронтенде
 */
export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Пропускаем в режиме разработки
  if (process.env.NODE_ENV === 'development') {
    res.locals.csrfToken = 'dev-token';
    res.setHeader('X-CSRF-Token', 'dev-token');
    return next();
  }
  
  // Добавляем CSRF токен в ответ
  res.locals.csrfToken = req.csrfToken();
  
  // Добавляем токен в заголовки для AJAX запросов
  res.setHeader('X-CSRF-Token', req.csrfToken());
  
  next();
};

/**
 * Middleware для проверки CSRF токена в AJAX запросах
 * Проверяет токен в заголовке X-CSRF-Token
 */
export const csrfAjaxMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Пропускаем для GET, HEAD, OPTIONS запросов
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Пропускаем в режиме разработки с SKIP_AUTH
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    return next();
  }
  
  // Проверяем CSRF токен в заголовке
  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionToken = req.session?.csrfSecret;
  
  if (!csrfToken || !sessionToken) {
    return res.status(403).json({
      error: 'CSRF токен отсутствует',
      message: 'Пожалуйста, обновите страницу и попробуйте снова'
    });
  }
  
  // Проверяем соответствие токенов
  if (csrfToken !== sessionToken) {
    return res.status(403).json({
      error: 'Неверный CSRF токен',
      message: 'Пожалуйста, обновите страницу и попробуйте снова'
    });
  }
  
  next();
};

/**
 * Обработчик ошибок CSRF
 * Возвращает понятные сообщения об ошибках
 */
export const csrfErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.log(`[CSRF] Invalid CSRF token from IP: ${req.ip}`);
    return res.status(403).json({
      error: 'Неверный CSRF токен',
      message: 'Пожалуйста, обновите страницу и попробуйте снова',
      code: 'INVALID_CSRF_TOKEN'
    });
  }
  
  next(err);
};
