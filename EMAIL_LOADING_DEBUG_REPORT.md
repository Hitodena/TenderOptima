# Диагностика загрузки Email конфигурации в админ панели

## Проблема
Поля "Email аккаунт для емайла" и "Пароль для Email аккаунта" не загружаются корректно при редактировании подписки. Ожидается отображение `gmz@tenderoptima.by` и пароля.

## Выполненные диагностические изменения

### ✅ **1. Добавлено расширенное логирование на сервере**
**Файл**: `server/routes/admin.ts`

```typescript
// Get user email configuration (admin only)
router.get('/users/:id/email-config', requireAuth, requireAdmin, async (req, res) => {
  // Get user email configuration
  const emailConfig = await storage.getUserEmailConfig(userId);
  
  console.log(`[Admin API] Raw email config from storage for user ${userId}:`, emailConfig);
  
  if (!emailConfig) {
    console.log(`[Admin API] No email configuration found for user ${userId}`);
    return res.status(404).json({
      error: 'Not Found',
      message: 'Email configuration not found for this user'
    });
  }
  
  // Decrypt password if it's encrypted
  let decryptedPassword = emailConfig.emailPassword;
  if (emailConfig.emailPassword && emailConfig.emailPassword.includes(':') && emailConfig.emailPassword.split(':').length === 3) {
    try {
      const { decryptEmailPassword } = await import('../utils/email-encryption');
      decryptedPassword = decryptEmailPassword(emailConfig.emailPassword);
    } catch (error) {
      console.error('Error decrypting password for user', userId, ':', error);
    }
  }
  
  console.log(`[Admin API] Email config for user ${userId}:`, {
    emailAccount: emailConfig.emailAccount,
    hasPassword: !!emailConfig.emailPassword,
    emailConfigured: emailConfig.emailConfigured
  });
  
  // Return config with decrypted password
  res.status(200).json({
    ...emailConfig,
    emailPassword: decryptedPassword
  });
});
```

### ✅ **2. Добавлен debug endpoint для проверки данных пользователя**
**Файл**: `server/routes/admin.ts`

```typescript
// Debug endpoint to check user data (admin only)
router.get('/users/:id/debug', requireAuth, requireAdmin, async (req, res) => {
  // Get full user data
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  console.log(`[Admin API] Debug: Full user data for user ${userId}:`, {
    id: user.id,
    username: user.username,
    emailAccount: user.emailAccount,
    emailPassword: user.emailPassword ? '[ENCRYPTED]' : null,
    emailConfigured: user.emailConfigured,
    smtpHost: user.smtpHost,
    smtpPort: user.smtpPort,
    imapHost: user.imapHost,
    imapPort: user.imapPort
  });
  
  res.status(200).json({
    id: user.id,
    username: user.username,
    emailAccount: user.emailAccount,
    emailPassword: user.emailPassword ? '[ENCRYPTED]' : null,
    emailConfigured: user.emailConfigured,
    smtpHost: user.smtpHost,
    smtpPort: user.smtpPort,
    imapHost: user.imapHost,
    imapPort: user.imapPort
  });
});
```

### ✅ **3. Добавлено расширенное логирование на клиенте**
**Файл**: `client/src/pages/admin/subscriptions-page.tsx`

```typescript
// Debug: Check user data first
const debugResponse = await fetch(`/api/admin/users/${subscription.userId}/debug`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "X-Admin-Token": adminToken
  },
  credentials: "include"
});

if (debugResponse.ok) {
  const debugData = await debugResponse.json();
  console.log('Debug user data:', debugData);
}

// Load email configuration
const emailResponse = await fetch(`/api/admin/users/${subscription.userId}/email-config`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "X-Admin-Token": adminToken
  },
  credentials: "include"
});

if (emailResponse.ok) {
  const emailConfig = await emailResponse.json();
  console.log('Loaded email config for user:', emailConfig);
  console.log('Email account:', emailConfig.emailAccount);
  console.log('Email password length:', emailConfig.emailPassword?.length || 0);
  
  // Update form with email configuration
  setFormData(prev => ({
    ...prev,
    emailAccount: emailConfig.emailAccount || "",
    emailPassword: emailConfig.emailPassword || ""
  }));
} else {
  console.log('No email configuration found for user:', subscription.userId);
  console.log('Response status:', emailResponse.status);
  console.log('Response text:', await emailResponse.text());
}
```

## Диагностические шаги

### 🔍 **1. Проверка данных в базе**
- Debug endpoint покажет, есть ли данные `emailAccount` и `emailPassword` в таблице `users`
- Логи покажут, какие именно данные хранятся для пользователя

### 🔍 **2. Проверка API ответов**
- Логи покажут, что возвращает `getUserEmailConfig`
- Логи покажут, что получает клиент от API

### 🔍 **3. Проверка расшифровки пароля**
- Логи покажут, происходит ли расшифровка пароля
- Логи покажут, есть ли ошибки при расшифровке

## Ожидаемые результаты

### ✅ **Если данные есть в базе:**
- Debug endpoint покажет `emailAccount: "gmz@tenderoptima.by"`
- Email config endpoint вернет данные
- Клиент получит и отобразит данные

### ❌ **Если данных нет в базе:**
- Debug endpoint покажет `emailAccount: null`
- Email config endpoint вернет 404
- Клиент покажет пустые поля

### ❌ **Если есть проблемы с расшифровкой:**
- Логи покажут ошибки расшифровки
- Пароль может не отображаться корректно

## Следующие шаги

1. **Откройте админ панель** и попробуйте отредактировать подписку
2. **Проверьте консоль браузера** - там будут логи загрузки данных
3. **Проверьте серверные логи** - там будут логи API вызовов
4. **Сообщите результаты** - какие данные показывает debug endpoint

## Заключение

Добавлено расширенное логирование для диагностики проблемы с загрузкой email конфигурации. Теперь можно точно определить, на каком этапе происходит сбой:
- Отсутствие данных в базе
- Проблемы с API
- Проблемы с расшифровкой пароля
- Проблемы с отображением на клиенте
