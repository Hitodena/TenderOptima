import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter для аутентификации
 * Ограничивает количество попыток входа с одного IP
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20, // максимум 20 попыток за 15 минут
  message: {
    error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.',
    retryAfter: 15 * 60 // секунды до следующей попытки
  },
  standardHeaders: true, // Возвращает информацию о лимитах в заголовках
  legacyHeaders: false, // Отключает устаревшие заголовки
  handler: (req: Request, res: Response) => {
    console.log(`[RateLimit] Too many login attempts from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.',
      retryAfter: 15 * 60
    });
  },
  // Пропускаем rate limiting в режиме разработки
  skip: (req: Request) => {
    return process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true';
  }
});

/**
 * Rate limiter для регистрации
 * Ограничивает количество регистраций с одного IP
 */
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // максимум 3 регистрации за час
  message: {
    error: 'Слишком много попыток регистрации. Попробуйте снова через час.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.log(`[RateLimit] Too many registration attempts from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Слишком много попыток регистрации. Попробуйте снова через час.',
      retryAfter: 60 * 60
    });
  },
  skip: (req: Request) => {
    return process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true';
  }
});

/**
 * Rate limiter для восстановления пароля
 * Ограничивает количество запросов на восстановление пароля
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // максимум 10 запросов за 15 минут
  message: {
    error: 'Слишком много запросов на восстановление пароля. Попробуйте снова через 15 минут.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.log(`[RateLimit] Too many password reset attempts from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Слишком много запросов на восстановление пароля. Попробуйте снова через 15 минут.',
      retryAfter: 15 * 60
    });
  },
  skip: (req: Request) => {
    return process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true';
  }
});

/**
 * Общий rate limiter для API
 * Ограничивает общее количество запросов к API
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 200, // максимум 200 запросов за 15 минут
  message: {
    error: 'Слишком много запросов к API. Попробуйте снова через 15 минут.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    console.log(`[RateLimit] Too many API requests from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Слишком много запросов к API. Попробуйте снова через 15 минут.',
      retryAfter: 15 * 60
    });
  },
  skip: (req: Request) => {
    return process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true';
  }
});
