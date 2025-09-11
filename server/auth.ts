import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users, subscriptions, improvementRequests } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { authRateLimit, registerRateLimit, passwordResetRateLimit } from "./middleware/rateLimiter";
import { securityLogger } from "./middleware/securityLogger";
import { ipMonitor } from "./middleware/ipMonitor";
import { createFailedLoginAlert, createSuspiciousActivityAlert, createIPBlockedAlert } from "./middleware/securityAlerts";

// Настройка токенов доступа
const TOKEN_SECRET = process.env.TOKEN_SECRET;
if (!TOKEN_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('TOKEN_SECRET must be set in production environment');
}
const TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 дней в миллисекундах - увеличено для предотвращения частых разлогинов

// Environment variables to toggle auth modes
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

console.log('[Server] SKIP_AUTH:', SKIP_AUTH);
console.log('[Server] DEV_MODE:', DEV_MODE);

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      role: string;
      businessCard?: string;
      logoUrl?: string;
      language?: string;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Функции для работы с токенами аутентификации
function generateToken(userId: number): string {
  if (!TOKEN_SECRET) {
    throw new Error('TOKEN_SECRET is required for token generation');
  }
  const timestamp = Date.now();
  const tokenData = `${userId}:${timestamp}`;
  const hmac = createHmac('sha256', TOKEN_SECRET);
  const signature = hmac.update(tokenData).digest('hex');
  return `${tokenData}:${signature}`;
}

export function verifyToken(token: string): { userId: number, valid: boolean, error?: string, expired?: boolean } {
  try {
    // Validate token structure
    const parts = token.split(':');
    if (parts.length !== 3) {
      return { 
        userId: 0, 
        valid: false, 
        error: 'Invalid token format' 
      };
    }
    
    const [userIdStr, timestampStr, signature] = parts;
    
    if (!userIdStr || !timestampStr || !signature) {
      return { 
        userId: 0, 
        valid: false, 
        error: 'Missing token components' 
      };
    }
    
    // Validate user ID format
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId) || userId <= 0) {
      return { 
        userId: 0, 
        valid: false, 
        error: 'Invalid user ID in token' 
      };
    }
    
    // Validate timestamp format
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || timestamp <= 0) {
      return { 
        userId, 
        valid: false, 
        error: 'Invalid timestamp in token' 
      };
    }
    
    // Check token expiration but with more detailed reporting
    const tokenAge = Date.now() - timestamp;
    const isExpired = tokenAge > TOKEN_EXPIRY;
    
    if (isExpired) {
      // Token is expired but we return userId for possible refresh operations
      return { 
        userId, 
        valid: false, 
        expired: true,
        error: 'Token expired' 
      };
    }
    
    // Verify signature
    if (!TOKEN_SECRET) {
      return { userId: 0, valid: false, error: 'TOKEN_SECRET is required for token verification' };
    }
    const tokenData = `${userId}:${timestamp}`;
    const hmac = createHmac('sha256', TOKEN_SECRET);
    const expectedSignature = hmac.update(tokenData).digest('hex');
    
    const isValidSignature = signature === expectedSignature;
    
    return { 
      userId, 
      valid: isValidSignature,
      error: isValidSignature ? undefined : 'Invalid token signature'
    };
  } catch (error) {
    console.error('Error verifying token:', error);
    return { 
      userId: 0, 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown token validation error'
    };
  }
}

// Промежуточное ПО для проверки токенов с улучшенной обработкой ошибок и восстановлением
export function tokenAuthMiddleware(req: any, res: any, next: any) {
  // Пропускаем, если запрос уже аутентифицирован
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Извлекаем токен из заголовка
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  const token = authHeader.substring(7); // Убираем 'Bearer ' из заголовка
  
  // Проверяем токен с расширенной информацией о возможных ошибках
  const tokenVerification = verifyToken(token);
  
  // Если токен просто истек, но все остальные параметры верны, можно попробовать восстановить/обновить
  const isExpiredButRecoverable = !tokenVerification.valid && 
                                  tokenVerification.expired && 
                                  tokenVerification.userId > 0;
  
  if (tokenVerification.valid || isExpiredButRecoverable) {
    const userId = tokenVerification.userId;
    
    // Попытка найти пользователя в кэше сначала (оптимизация)
    // После обработки ошибок соединения с базой
    try {
      // Находим пользователя по ID с улучшенной обработкой ошибок БД
      db.select()
        .from(users)
        .where(eq(users.id, userId))
        .then(([user]) => {
          if (user) {
            // Устанавливаем пользователя в запросе
            req.user = {
              id: user.id,
              username: user.username,
              role: user.role,
              businessCard: user.businessCard,
              logoUrl: user.logoUrl,
              language: user.language
            };
            
            // Отмечаем, что запрос аутентифицирован токеном
            // @ts-ignore
            req.authType = 'token';
            
            // This is crucial: mark request as authenticated
            req.isAuthenticated = () => true;
            
            // Если токен был просрочен, но мы восстановили сессию, логируем это
            if (isExpiredButRecoverable) {
              console.log(`[Auth] Запрос с истекшим токеном восстановлен для пользователя ${user.username}`);
              
              // В ответе устанавливаем заголовок, сообщающий клиенту о необходимости обновить токен
              res.setHeader('X-Token-Expired', 'true');
              
              // Генерируем новый токен доступа и добавляем его в заголовок ответа для клиента
              const newToken = generateToken(user.id);
              res.setHeader('X-New-Token', newToken);
            } else {
              console.log(`[Auth] Запрос аутентифицирован токеном для пользователя ${user.username}`);
            }
          } else {
            console.log(`[Auth] Пользователь с ID ${userId} не найден, несмотря на валидный токен`);
          }
          next();
        })
        .catch(error => {
          // Улучшенная обработка ошибок базы данных
          console.error('Error fetching user for token auth:', error);
          
          // Если ошибка связана с соединением, попробуем восстановить
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || 
              error.message.includes('connection') || error.message.includes('timeout')) {
            console.log('[Auth] Database connection issue detected, attempting recovery');
            
            // Даже в случае ошибки БД, если токен был валидным, можно считать пользователя аутентифицированным
            // с минимальными данными для продолжения работы (только ID пользователя)
            if (tokenVerification.valid) {
              req.user = {
                id: userId,
                username: 'recovered-session',
                role: 'user' // Устанавливаем роль по умолчанию для безопасности
              };
              
              // @ts-ignore
              req.authType = 'token-recovery';
              req.isAuthenticated = () => true;
              
              console.log(`[Auth] Emergency session recovery for user ID ${userId} due to DB connection issue`);
            }
          }
          next();
        });
    } catch (globalError) {
      // Обработка непредвиденных ошибок
      console.error('Unexpected error in token authentication:', globalError);
      next();
    }
  } else {
    // Если токен невалидный, просто продолжаем без аутентификации
    console.log(`[Auth] Invalid token, reason: ${tokenVerification.error || 'Unknown'}`);
    next();
  }
}

export async function setupAuth(app: Express) {
  // Set up session store
  const PgSessionStore = connectPgSimple(session);
  
  // Определим режим работы куки
  const isProduction = process.env.NODE_ENV === 'production';
  const isReplit = process.env.REPL_ID !== undefined;
  
  // Проверяем наличие SESSION_SECRET в продакшене
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production environment');
  }
  
  // В Replit нам нужны специальные настройки для надежной работы сессий
  const sessionSecret = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? 'fallback-secret' : 'dev-session-secret');
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: true,
    saveUninitialized: true,
    rolling: true, // Обновлять куки при каждом запросе
    name: 'supplier_session', // Более информативное имя для куки
    proxy: true, // Доверяем прокси серверам Replit
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: false, // В Replit нужно использовать false даже для HTTPS
      sameSite: 'lax', // Более совместимая настройка для браузеров
      httpOnly: true,
      path: '/',
    },
    store: new PgSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: false, // Disable automatic pruning to prevent connection issues
    }),
  };
  
  console.log('[Server] Session settings:', {
    secret: sessionSettings.secret ? 'hidden' : 'not set',
    resave: sessionSettings.resave,
    saveUninitialized: sessionSettings.saveUninitialized,
    cookie: {
      maxAge: sessionSettings.cookie?.maxAge,
      secure: sessionSettings.cookie?.secure,
      sameSite: sessionSettings.cookie?.sameSite,
      httpOnly: sessionSettings.cookie?.httpOnly,
    },
  });

  // Доверяем прокси в Replit
  app.set("trust proxy", 1);
  
  // Настраиваем сессии и обработчик ошибок
  app.use(session(sessionSettings));
  
  // Инициализируем Passport и включаем использование сессий
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Сначала добавляем промежуточное ПО для токенов
  app.use(tokenAuthMiddleware);
  
  // Session monitoring middleware (reduced logging)
  app.use((req, res, next) => {
    // Only log critical auth failures
    if (req.path.includes('/api/auth/') && req.method === 'POST') {
      console.log('[Auth]', req.method, req.path, {
        hasSession: !!req.session,
        authenticated: req.isAuthenticated(),
        cookies: req.headers.cookie ? 'present' : 'missing',
        token: req.headers.authorization ? 'present' : 'missing',
      });
    }
    next();
  });

  // Development mode middleware
  // Setting FORCE_DEV_MODE to false to allow manual login
  const FORCE_DEV_MODE = false;
  if (DEV_MODE || FORCE_DEV_MODE) {
    console.log('[Server] DEV_MODE active: Enabling auto-login as admin');
    app.use((req, res, next) => {
      // If in dev mode and not authenticated, auto-login as admin
      if (!req.isAuthenticated()) {
        req.login({ 
          id: 1, 
          username: 'admin@example.com',
          role: 'admin',
          language: 'ru'
        }, (err) => {
          if (err) return next(err);
          return next();
        });
      } else {
        return next();
      }
    });
  } else {
    // Normal authentication mode
    passport.use(
      new LocalStrategy(async (username, password, done) => {
        try {
          const [user] = await db.select().from(users).where(eq(users.username, username));
          
          if (!user) {
            return done(null, false, { message: 'Пользователь с таким email не найден. Возможно, вам нужно зарегистрироваться' });
          }
          
          if (!(await comparePasswords(password, user.password))) {
            return done(null, false, { message: 'Неверный пароль. Если вы забыли пароль, воспользуйтесь функцией восстановления' });
          }
          
          // Update last login time
          await db.update(users)
            .set({ lastLogin: new Date() })
            .where(eq(users.id, user.id));
          
          return done(null, {
            id: user.id,
            username: user.username,
            role: user.role,
            businessCard: user.businessCard || undefined,
            logoUrl: user.logoUrl || undefined,
            language: user.language || 'ru'
          });
        } catch (error) {
          return done(error);
        }
      })
    );
  }

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      if (DEV_MODE) {
        // In dev mode, return the mock admin user
        return done(null, {
          id: 1,
          username: 'admin@example.com',
          role: 'admin',
          language: 'ru'
        });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, id));
      
      if (!user) {
        return done(null, false);
      }
      
      return done(null, {
        id: user.id,
        username: user.username,
        role: user.role,
        businessCard: user.businessCard || undefined,
        logoUrl: user.logoUrl || undefined,
        language: user.language || 'ru'
      });
    } catch (error) {
      return done(error);
    }
  });

  // Authentication routes
  app.post("/api/auth/forgot-password", passwordResetRateLimit, async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: 'Email обязателен' });
      }
      
      // Check if user exists
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        // For security reasons, don't reveal if user exists or not
        return res.status(200).json({ 
          message: 'Если учетная запись существует, инструкции по сбросу пароля были отправлены на указанный email' 
        });
      }
      
      // Generate a reset token (e.g. a random string)
      const resetToken = randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
      
      // Store the reset token in the database
      await db.update(users)
        .set({ 
          resetToken, 
          resetTokenExpiry 
        })
        .where(eq(users.id, user.id));
      
      // Send password reset email (this would use your email service)
      // This is a placeholder - actual email sending would be implemented using your email service
      console.log(`Password reset request for ${username}. Reset token: ${resetToken}`);
      
      return res.status(200).json({ 
        message: 'Если учетная запись существует, инструкции по сбросу пароля были отправлены на указанный email' 
      });
    } catch (error) {
      console.error('Password reset error:', error);
      return res.status(500).json({ error: 'Ошибка при обработке запроса на сброс пароля' });
    }
  });
  
  app.post("/api/auth/reset-password", passwordResetRateLimit, async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
      }
      
      // Find user with valid token
      const [user] = await db.select()
        .from(users)
        .where(eq(users.resetToken, token));
      
      if (!user || !user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
        return res.status(400).json({ error: 'Недействительный или просроченный токен сброса пароля' });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(password);
      
      // Update the user's password and clear the reset token
      await db.update(users)
        .set({ 
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
      
      return res.status(200).json({ message: 'Пароль успешно изменен' });
    } catch (error) {
      console.error('Password reset error:', error);
      return res.status(500).json({ error: 'Ошибка при сбросе пароля' });
    }
  });

  app.post("/api/auth/login", authRateLimit, (req, res, next) => {
    console.log('Попытка входа в систему, DEV_MODE =', DEV_MODE);
    console.log('Данные запроса:', {
      username: req.body.username,
      hasPassword: !!req.body.password,
      requestHeaders: req.headers,
      sessionID: req.sessionID
    });
    
    if (DEV_MODE) {
      console.log('Используется DEV_MODE, пропускаем аутентификацию');
      // Генерируем токен даже в DEV_MODE
      const token = generateToken(1);
      return res.status(200).json({
        id: 1,
        username: 'admin@example.com',
        role: 'admin',
        language: 'ru',
        accessToken: token,
        tokenExpiry: Date.now() + TOKEN_EXPIRY
      });
    }

    try {
      passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
        if (err) {
          console.error('Ошибка аутентификации:', err);
          return res.status(500).json({ error: 'Внутренняя ошибка аутентификации: ' + err.message });
        }
        
        if (!user) {
          console.log('Вход не удался:', info?.message);
          
          // 🔍 Security Monitoring - Log failed login attempt
          const ip = req.ip || req.connection.remoteAddress || 'Unknown';
          const username = req.body.username || 'Unknown';
          const error = info?.message || 'Authentication failed';
          
          // Log to security logger
          securityLogger.logLoginAttempt(req, false, undefined, error);
          
          // Record failed attempt in IP monitor
          ipMonitor.recordFailedAttempt(ip, `Failed login for user: ${username}`);
          
          // Create security alert
          createFailedLoginAlert(ip, username, error);
          
          return res.status(401).json({ error: info?.message || 'Ошибка аутентификации' });
        }
        
        console.log('Пользователь найден, пытаемся войти в систему:', user.username, user.id);
        
        // Генерируем токен доступа с увеличенным сроком действия
        const token = generateToken(user.id);
        
        // Обновляем дату последнего входа
        db.update(users)
          .set({ lastLogin: new Date(), updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .then(() => console.log(`Обновлена дата последнего входа для ${user.username}`))
          .catch(error => console.error('Ошибка при обновлении даты входа:', error));
        
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error('Ошибка сессии при входе:', loginErr);
            // В случае ошибки сессии, все равно продолжаем с токеном доступа
            // Это важно для корректной работы с Replit
          }
          
          console.log('Пользователь успешно вошел в систему:', user.username, user.id);
          
          // Принудительно сохраняем сессию с дополнительными данными
          if (req.session) {
            // @ts-ignore
            req.session.userId = user.id;
            req.session.touch(); // Обновляет время жизни сессии
            req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000; // Увеличиваем срок жизни cookie до 7 дней
            
            req.session.save((saveErr) => {
              if (saveErr) {
                console.error('Ошибка сохранения сессии:', saveErr);
              } else {
                console.log('Сессия успешно сохранена');
              }
              
              console.log('Сессия после входа:', {
                id: req.sessionID,
                cookie: req.session?.cookie,
                // @ts-ignore
                userId: req.session?.userId,
                passport: req.session?.passport,
                user: req.user
              });
            });
          }
          
          // Устанавливаем заголовки для отладки
          res.setHeader('X-Auth-Status', 'success');
          res.setHeader('X-Session-ID', req.sessionID || 'none');
          
          // Отправляем куки в заголовках специально для Replit
          if (req.sessionID) {
            res.setHeader('Set-Cookie', [
              `supplier_session=${req.sessionID}; Path=/; HttpOnly; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`
            ]);
          }
          
          // 🔍 Security Monitoring - Log successful login
          const ip = req.ip || req.connection.remoteAddress || 'Unknown';
          
          // Log to security logger
          securityLogger.logLoginAttempt(req, true, user.id);
          
          // Record successful attempt in IP monitor
          ipMonitor.recordSuccessfulAttempt(ip);
          
          // Log protected access
          securityLogger.logProtectedAccess(req, user.id, 'login');
          
          // Возвращаем данные пользователя и токен доступа
          return res.status(200).json({
            ...user,
            accessToken: token, // Добавляем токен к ответу
            tokenExpiry: Date.now() + TOKEN_EXPIRY
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error('Непредвиденная ошибка входа:', error);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера при входе в систему: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });
  
  // Добавляем отдельный маршрут для логина только с токеном
  app.post("/api/auth/token", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
      }
      
      // Найдем пользователя
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        return res.status(401).json({ error: 'Пользователь с таким email не найден' });
      }
      
      // Проверим пароль
      const isPasswordValid = await comparePasswords(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Неверный пароль' });
      }
      
      // Генерируем токен
      const token = generateToken(user.id);
      
      // Обновляем время последнего входа
      await db.update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));
      
      // Возвращаем токен и информацию о пользователе
      return res.status(200).json({
        id: user.id,
        username: user.username,
        role: user.role,
        businessCard: user.businessCard,
        logoUrl: user.logoUrl,
        language: user.language,
        accessToken: token,
        tokenExpiry: Date.now() + TOKEN_EXPIRY
      });
    } catch (error) {
      console.error('Ошибка входа по токену:', error);
      return res.status(500).json({ error: 'Внутренняя ошибка сервера при входе по токену' });
    }
  });

  app.post("/api/auth/register", registerRateLimit, async (req, res, next) => {
    try {
      // Check if username already exists
      const [existingUser] = await db.select().from(users).where(eq(users.username, req.body.username));
      
      if (existingUser) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }
      
      // Create user
      const hashedPassword = await hashPassword(req.body.password);
      
      let createdUser;
      
      try {
        // Create user
        const [user] = await db.insert(users)
          .values({
            username: req.body.username,
            password: hashedPassword,
            role: 'user',
            language: 'ru',
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        createdUser = user;
        console.log("Created user:", createdUser);
        
        // Make sure createdUser.id exists
        if (!createdUser || !createdUser.id) {
          throw new Error("Failed to create user with valid ID");
        }
        
        // Create default subscription
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 14); // 14 days trial
        
        await db.insert(subscriptions)
          .values({
            userId: createdUser.id,
            plan: 'trial',
            status: 'active',
            expiryDate: expiryDate,
            requestsLimit: 5,
            requestsUsed: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({ error: 'Ошибка при создании пользователя' });
      }
      
      // Log user in
      req.login({
        id: createdUser.id,
        username: createdUser.username,
        role: createdUser.role,
        language: createdUser.language || 'ru'
      }, (err) => {
        if (err) return next(err);
        return res.status(201).json({
          id: createdUser.id,
          username: createdUser.username,
          role: createdUser.role,
          language: createdUser.language || 'ru'
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ error: 'Ошибка при регистрации пользователя' });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    console.log('[Auth] LOGOUT: Starting logout process');
    
    req.logout((err) => {
      if (err) {
        console.error('[Auth] LOGOUT: Error during logout:', err);
        return res.status(500).json({ error: 'Ошибка при выходе из системы' });
      }
      
      // Completely destroy the session
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error('[Auth] LOGOUT: Error destroying session:', destroyErr);
          return res.status(500).json({ error: 'Ошибка при очистке сессии' });
        }
        
        // Clear the session cookie
        res.clearCookie('supplier_session', {
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'lax'
        });
        
        console.log('[Auth] LOGOUT: Complete - session destroyed and cookie cleared');
        return res.status(200).json({ success: true, message: 'Logout successful' });
      });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    console.log('[Auth Debug] GET /api/auth/me:', {
      isAuthenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      sessionData: req.session,
      cookies: req.headers.cookie ? 'present' : 'missing',
      user: req.user
    });
    
    // Проверяем, есть ли у нас кука сессии
    const cookieHeader = req.headers.cookie;
    const hasCookie = cookieHeader && (
      cookieHeader.includes('supplier_session=') ||
      cookieHeader.includes('sid=')
    );
    
    console.log(`[Auth] Cookies: ${hasCookie ? 'present' : 'missing'}, SessionID: ${req.sessionID || 'none'}`);
    
    // Принудительно обновляем куки сессии
    if (req.session) {
      req.session.touch();
    }
    
    // Only return fake admin user in dev mode if explicitly set to true
    if (DEV_MODE && SKIP_AUTH) {
      console.log('[Auth] Using DEV_MODE admin credentials');
      return res.status(200).json({
        id: 1,
        username: 'admin@example.com',
        role: 'admin',
        language: 'ru'
      });
    }
    
    // Альтернативная проверка аутентификации
    // Если у нас есть userId в сессии, но passport не установил req.user, делаем это вручную
    // @ts-ignore
    if (!req.isAuthenticated() && req.session && req.session.userId) {
      try {
        // @ts-ignore
        const userId = req.session.userId;
        console.log(`[Auth] Восстанавливаем сессию пользователя ${userId} из сохраненного userId`);
        
        // Найдем пользователя вручную
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        
        if (user) {
          console.log(`[Auth] Найден пользователь для восстановления:`, user.username);
          // Принудительно устанавливаем пользователя в сессии
          req.login(user, (err) => {
            if (err) {
              console.error('[Auth] Ошибка при восстановлении сессии:', err);
            }
          });
          
          // Вернем данные пользователя с сохраненным идентификатором
          res.setHeader('X-Auth-Status', 'restored');
          res.setHeader('X-Session-ID', req.sessionID || 'none');
          
          return res.status(200).json({
            id: user.id,
            username: user.username,
            role: user.role,
            businessCard: user.businessCard,
            logoUrl: user.logoUrl,
            language: user.language
          });
        }
      } catch (error) {
        console.error('[Auth] Ошибка при восстановлении сессии:', error);
      }
    }
    
    // Стандартная проверка аутентификации
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        error: 'Не авторизован', 
        sessionId: req.sessionID || 'no-session',
        hasCookie: hasCookie
      });
    }
    
    // Прямая установка заголовка для отладки
    res.setHeader('X-Auth-Status', 'success');
    res.setHeader('X-Session-ID', req.sessionID || 'none');
    
    return res.status(200).json(req.user);
  });

  app.put("/api/auth/business-card", async (req, res) => {
    // Enhanced debugging for business card persistence
    console.log('[Business Card Debug] === REQUEST RECEIVED ===');
    console.log('[Business Card Debug] Business card update request:', {
      isAuthenticated: req.isAuthenticated(),
      DEV_MODE,
      userId: req.user?.id || 'не определен',
      sessionID: req.sessionID,
      bodyData: {
        businessCardLength: req.body.businessCard?.length || 0,
        hasLogoUrl: !!req.body.logoUrl
      }
    });
    
    if (!req.isAuthenticated() && !DEV_MODE) {
      console.log('[Business Card Debug] Authentication failed');
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    try {
      // В режиме разработки используем тестового пользователя с ID=1
      const userId = DEV_MODE ? 1 : req.user!.id;
      
      console.log(`[Business Card Debug] Starting update for user ID=${userId}`);
      
      // Check if user exists first
      const [existingUser] = await db.select().from(users).where(eq(users.id, userId));
      console.log('[Business Card Debug] User before update:', {
        exists: !!existingUser,
        currentBusinessCard: existingUser?.businessCard?.substring(0, 50) + '...' || 'none',
        currentLogoUrl: existingUser?.logoUrl || 'none'
      });
      
      if (!existingUser) {
        throw new Error(`User with ID ${userId} does not exist`);
      }
      
      // Update business card
      const updateResult = await db.update(users)
        .set({
          businessCard: req.body.businessCard,
          logoUrl: req.body.logoUrl,
          updatedAt: new Date(),
          onboardingCompleted: true
        })
        .where(eq(users.id, userId))
        .returning();
      
      console.log('[Business Card Debug] Update result:', {
        rowsAffected: updateResult.length,
        updatedBusinessCard: updateResult[0]?.businessCard?.substring(0, 50) + '...' || 'none',
        updatedLogoUrl: updateResult[0]?.logoUrl || 'none'
      });
      
      // Получаем обновленные данные пользователя из базы для подтверждения
      const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));
      
      console.log('[Business Card Debug] User after update verification:', {
        exists: !!updatedUser,
        businessCard: updatedUser?.businessCard?.substring(0, 50) + '...' || 'none',
        logoUrl: updatedUser?.logoUrl || 'none',
        onboardingCompleted: updatedUser?.onboardingCompleted
      });
      
      if (!updatedUser) {
        throw new Error(`Пользователь с ID ${userId} не найден после обновления`);
      }
      
      // Формируем ответ с обновленными данными
      const userResponse = {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        businessCard: updatedUser.businessCard,
        logoUrl: updatedUser.logoUrl,
        language: updatedUser.language,
        onboardingCompleted: updatedUser.onboardingCompleted
      };
      
      console.log(`[Business Card Debug] Successful response prepared for user ID=${userId}`);
      console.log(`[Business Card Debug] === RESPONSE SENT ===`);
      return res.status(200).json(userResponse);
    } catch (error) {
      console.error("[Server] Business card update error:", error);
      return res.status(500).json({ error: 'Ошибка при обновлении визитной карточки: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Onboarding status
  app.get("/api/auth/onboarding", async (req, res) => {
    if (!req.isAuthenticated() && !DEV_MODE) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    try {
      // Get onboarding status
      const [user] = await db.select({ onboardingCompleted: users.onboardingCompleted })
        .from(users)
        .where(eq(users.id, req.user!.id));
      
      return res.status(200).json({ 
        completed: user?.onboardingCompleted || false 
      });
    } catch (error) {
      console.error("Onboarding status error:", error);
      return res.status(500).json({ error: 'Ошибка при получении статуса онбординга' });
    }
  });
  
  // Complete onboarding
  app.post("/api/auth/onboarding/complete", async (req, res) => {
    if (!req.isAuthenticated() && !DEV_MODE) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    try {
      // Update onboarding completed flag
      await db.update(users)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date()
        })
        .where(eq(users.id, req.user!.id));
      
      return res.status(200).json({ completed: true });
    } catch (error) {
      console.error("Onboarding completion error:", error);
      return res.status(500).json({ error: 'Ошибка при завершении онбординга' });
    }
  });

  // Middleware for checking if user is authenticated
  app.use("/api", (req, res, next) => {
    // Only skip auth check for auth routes themselves
    if (req.path.startsWith('/auth/') || req.originalUrl.startsWith('/api/auth/')) {
      console.log(`[Auth] Bypassing authentication for auth endpoint: ${req.originalUrl}`);
      return next();
    }
    
    if (!req.isAuthenticated()) {
      // Добавим подробную информацию о проблеме с аутентификацией
      console.log(`Unauthorized request to ${req.originalUrl}, user not authenticated`);
      console.log('Session ID:', req.sessionID || 'No session ID');
      console.log('Session Data:', req.session);
      console.log('Cookies:', req.headers.cookie);
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Эта часть выполнится только после успешной аутентификации
    console.log(`Authenticated request to ${req.originalUrl} by user ${req.user?.username} (${req.user?.id})`);
    next();
  });
}

// Middleware for protecting routes
export function requireAuth(req: any, res: any, next: any) {
  // Only bypass auth if BOTH DEV_MODE AND SKIP_AUTH are true
  if (DEV_MODE && SKIP_AUTH) {
    console.log('[Auth] Skipping authorization check in DEV_MODE with SKIP_AUTH=true');
    // Use default test user account in bypass mode
    req.user = {
      id: 1,
      username: 'admin@example.com',
      role: 'admin',
      language: 'ru'
    };
    return next();
  }
  
  // Reduced logging - only log auth failures
  
  if (!req.isAuthenticated()) {
    console.log('[Auth] Unauthorized request rejected:', req.path);
    return res.status(401).json({ error: 'Не авторизован' });
  }
  
  console.log(`[Auth] Authorized request from user ${req.user.username} (${req.user.id})`);
  next();
}

// Middleware for requiring admin role
export function requireAdmin(req: any, res: any, next: any) {
  // Only bypass auth if BOTH DEV_MODE AND SKIP_AUTH are true
  if (DEV_MODE && SKIP_AUTH) {
    console.log('[Auth] Skipping admin authorization check in DEV_MODE with SKIP_AUTH=true');
    // Use default admin user account in bypass mode
    req.user = {
      id: 1,
      username: 'admin@example.com',
      role: 'admin',
      language: 'ru'
    };
    return next();
  }
  
  if (!req.isAuthenticated()) {
    console.log('[Auth] Unauthorized admin request rejected:', req.path);
    return res.status(401).json({ error: 'Не авторизован' });
  }
  
  if (req.user.role !== 'admin') {
    console.log(`[Auth] Forbidden admin request from non-admin user ${req.user.username} (${req.user.id})`);
    return res.status(403).json({ error: 'Доступ запрещен' });
  }
  
  console.log(`[Auth] Authorized admin request from ${req.user.username} (${req.user.id})`);
  next();
}

// Helper for creating user
export async function createUser(username: string, password: string, role: string = 'user') {
  const hashedPassword = await hashPassword(password);
  
  const [user] = await db.insert(users)
    .values({
      username,
      password: hashedPassword,
      role,
      language: 'ru',
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();
  
  return user;
}

// API endpoint to get improvement request counts for suppliers
export async function saveImprovementRequest(req: any, res: any) {
  try {
    const { supplierName, requestId } = req.body;
    
    if (!supplierName || !requestId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: supplierName and requestId' 
      });
    }

    // Save improvement request to database
    await db.insert(improvementRequests).values({
      supplierName,
      requestId: parseInt(requestId),
      createdAt: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Improvement request saved successfully' 
    });
  } catch (error) {
    console.error('Error saving improvement request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save improvement request' 
    });
  }
}

export async function getImprovementRequestCounts(req: any, res: any) {
  try {
    const { requestId } = req.query;
    
    if (!requestId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameter: requestId' 
      });
    }

    // Get improvement request counts by supplier for this request
    // Only count actual improvement requests (not compliance checks)
    const counts = await db
      .select({
        supplierName: improvementRequests.supplierName,
        count: count(improvementRequests.id)
      })
      .from(improvementRequests)
      .where(and(
        eq(improvementRequests.requestId, parseInt(requestId)),
        eq(improvementRequests.requestType, "improvement")
      ))
      .groupBy(improvementRequests.supplierName);

    // Convert to object for easy lookup
    const countsMap: Record<string, number> = {};
    counts.forEach(item => {
      countsMap[item.supplierName] = item.count;
    });

    res.json({ 
      success: true, 
      counts: countsMap 
    });
  } catch (error) {
    console.error('Error getting improvement request counts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get improvement request counts' 
    });
  }
}