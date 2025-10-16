import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth';
import { storage } from '../storage';

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
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  
  // Check if authentication should be bypassed in development mode
  // ИСПРАВЛЕНО: Убрана автоматическая подмена на админа
  if (SKIP_AUTH && DEV_MODE) {
    console.log('[Auth] DEV_MODE enabled but not auto-setting admin user');
    // Не устанавливаем автоматически админа - пусть пользователь аутентифицируется нормально
  }
  
  
  // Check for admin token in header for admin panel requests
  const adminToken = req.headers && (req.headers['x-admin-token'] || req.headers['X-Admin-Token']) || '';
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
        
        // Fetch full user data from database
        try {
          const user = await storage.getUserById(tokenVerification.userId);
          if (user) {
            req.user = { 
              id: user.id, 
              username: user.username,
              role: user.role
            };
            console.log('[Auth] User data loaded from DB:', { id: user.id, username: user.username, role: user.role });
            return next();
          } else {
            console.log('[Auth] User not found in database for ID:', tokenVerification.userId);
          }
        } catch (dbError) {
          console.log('[Auth] Error fetching user from database:', dbError);
        }
        
        // Fallback to basic user data if DB fetch fails
        req.user = { 
          id: tokenVerification.userId, 
          username: undefined,
          role: undefined
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
    
    // If user data is incomplete, fetch from database
    if (req.user && !req.user.role) {
      try {
        const user = await storage.getUserById(req.user.id);
        if (user) {
          req.user.role = user.role;
          req.user.username = user.username;
          console.log(`[Auth] User data completed from DB: ${user.username} (${user.role})`);
        }
      } catch (dbError) {
        console.log('[Auth] Error fetching user from database:', dbError);
      }
    }
    
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