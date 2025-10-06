# Исправление загрузки Email конфигурации в админ панели

## Проблема
Поля "Email аккаунт" и "Пароль email" не загружались корректно при редактировании подписки. Например, для пользователя `test122@test.com` должен был отображаться email `gmz@tenderoptima.by` и пароль в расшифрованном виде.

## Выполненные исправления

### ✅ **1. Добавлен серверный endpoint для получения email конфигурации**
**Файл**: `server/routes/admin.ts`

```typescript
// Get user email configuration (admin only)
router.get('/users/:id/email-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Get user email configuration
    const emailConfig = await storage.getUserEmailConfig(userId);
    
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
    
    // Return config with decrypted password
    res.status(200).json({
      ...emailConfig,
      emailPassword: decryptedPassword
    });
  } catch (error) {
    // Error handling
  }
});
```

### ✅ **2. Обновлена клиентская логика загрузки конфигурации**
**Файл**: `client/src/pages/admin/subscriptions-page.tsx`

**Было:**
```typescript
const openEditDialog = (subscription: Subscription) => {
  setSelectedSubscription(subscription);
  setFormData({
    // ... subscription data
    emailAccount: "",
    emailPassword: ""
  });
  setShowEditDialog(true);
};
```

**Стало:**
```typescript
const openEditDialog = async (subscription: Subscription) => {
  setSelectedSubscription(subscription);
  
  // Initialize form with subscription data
  setFormData({
    // ... subscription data
    emailAccount: "",
    emailPassword: ""
  });
  
  // Load user email configuration
  try {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      throw new Error('Admin token not found. Please login again.');
    }
    
    const response = await fetch(`/api/admin/users/${subscription.userId}/email-config`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": adminToken
      },
      credentials: "include"
    });
    
    if (response.ok) {
      const emailConfig = await response.json();
      console.log('Loaded email config for user:', emailConfig);
      
      // Update form with email configuration
      setFormData(prev => ({
        ...prev,
        emailAccount: emailConfig.emailAccount || "",
        emailPassword: emailConfig.emailPassword || ""
      }));
    } else {
      console.log('No email configuration found for user:', subscription.userId);
    }
  } catch (error) {
    console.error('Error loading email configuration:', error);
  }
  
  setShowEditDialog(true);
};
```

## Результат

### ✅ **Что исправлено:**
- ✅ Email конфигурация загружается при открытии формы редактирования
- ✅ Пароли расшифровываются и отображаются в читаемом виде
- ✅ Обработка ошибок при отсутствии конфигурации
- ✅ Логирование для диагностики

### ✅ **Как это работает:**
1. **При открытии формы редактирования** - автоматически загружается email конфигурация пользователя
2. **Расшифровка пароля** - если пароль зашифрован, он расшифровывается на сервере
3. **Заполнение полей** - поля "Email аккаунт" и "Пароль email" заполняются актуальными данными
4. **Обработка ошибок** - если конфигурация не найдена, поля остаются пустыми

### ✅ **Пример работы:**
- **Пользователь**: `test122@test.com`
- **Email аккаунт**: `gmz@tenderoptima.by` (загружается из конфигурации)
- **Пароль**: `actual_password` (расшифровывается и отображается)

## Тестирование

1. Откройте админ панель: `http://localhost:5000/admpanel`
2. Перейдите в "Управление подписками"
3. Нажмите на иконку редактирования (карандаш) у любой подписки
4. ✅ **Ожидаемый результат**: Поля "Email аккаунт" и "Пароль email" должны заполниться актуальными данными пользователя

## Заключение

Проблема с загрузкой email конфигурации успешно исправлена. Теперь при редактировании подписки поля "Email аккаунт" и "Пароль email" корректно загружаются и отображают актуальные данные пользователя.
