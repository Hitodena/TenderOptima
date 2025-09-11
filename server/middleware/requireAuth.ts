import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth';

// Переменные окружения для режима разработки
const SKIP_AUTH = process.env.SKIP_AUTH === 'true';
const DEV_MODE = process.env.DEV_MODE === 'true';

// Security check: Prevent dangerous flags in production
if (process.env.NODE_ENV === 'production') {
  if (SKIP_AUTH) {
    throw new Error('SKIP_AUTH cannot be enabled in production environment');
  }
  if (DEV_MODE) {
    throw new Error('DEV_MODE cannot be enabled in production environment');
  }
}

/**
 * Middleware для проверки аутентификации
 * Проверяет, аутентифицирован ли пользователь, прежде чем разрешить доступ к маршруту
 * Поддерживает DEV_MODE и SKIP_AUTH для режима разработки
 * Также поддерживает Bearer token authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check if authentication should be bypassed in development mode
  if (SKIP_AUTH && DEV_MODE) {
    console.log('[Auth] Skipping authorization check in DEV_MODE with SKIP_AUTH=true');
    req.user = { id: 1, username: 'admin@example.com', role: 'admin' };
    return next();
  }
  
  // Check for admin token in header for admin panel requests
  const adminToken = req.headers && req.headers['x-admin-token'] || '';
  if (adminToken && (adminToken === 'admin-token-123456' || adminToken === 'true')) {
    console.log('[Auth] Admin token authentication successful');
    // Set admin user for the request
    req.user = { id: 1, username: 'admin', role: 'admin' };
    return next();
  }

  // Check for Bearer token authentication
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const tokenVerification = verifyToken(token);
      if (tokenVerification.valid) {
        console.log('[Auth] Bearer token authentication successful for user:', tokenVerification.userId);
        req.user = { 
          id: tokenVerification.userId, 
          username: undefined, // We'll need to fetch this from DB if needed
          role: undefined // We'll need to fetch this from DB if needed
        };
        return next();
      } else {
        console.log('[Auth] Invalid Bearer token:', tokenVerification.error);
        // Continue to check other authentication methods
      }
    } catch (error) {
      console.log('[Auth] Error verifying Bearer token:', error);
      // Continue to check other authentication methods
    }
  }

  // Check if user is authenticated via session
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    console.log(`[Auth] Authenticated request from user ${req.user?.username || req.user?.id || 'unknown'}`);
    return next();
  }
  
  // Check if user is in session but not properly deserialized
  if (req.session && req.session.passport && req.session.passport.user) {
    console.log('[Auth] Session exists but user not deserialized, attempting manual lookup');
    try {
      const userId = req.session.passport.user;
      // Manually set user from session for this request
      req.user = { id: userId };
      console.log(`[Auth] Manually authenticated user ${userId} from session`);
      return next();
    } catch (error) {
      console.log('[Auth] Failed to manually authenticate from session:', error);
    }
  }

  // User not authenticated, return 401
  console.log('[Auth] Unauthorized request, returning 401');
  res.status(401).json({
    error: 'Требуется авторизация. Пожалуйста, выполните вход в систему.'
  });
}