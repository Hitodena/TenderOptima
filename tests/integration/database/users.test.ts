import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../../server/db';
import { users, subscriptions, searchRequests } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';
import { TestHelpers } from '../../utils/test-helpers';

describe('Database Integration - Users', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('User CRUD Operations', () => {
    it('should create user in database', async () => {
      const userData = {
        username: 'test@example.com',
        password: 'hashedpassword123',
        role: 'user',
        language: 'ru',
        preferredMode: 'supplier_search'
      };

      const result = await db.insert(users).values(userData).returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe(userData.username);
      expect(result[0].role).toBe(userData.role);
      expect(result[0].id).toBeDefined();
    });

    it('should read user from database', async () => {
      // Создаем пользователя
      const userData = {
        username: 'readtest@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      const createdUser = await db.insert(users).values(userData).returning();
      const userId = createdUser[0].id;

      // Читаем пользователя
      const foundUser = await db.select().from(users).where(eq(users.id, userId));
      
      expect(foundUser).toHaveLength(1);
      expect(foundUser[0].username).toBe(userData.username);
    });

    it('should update user in database', async () => {
      // Создаем пользователя
      const userData = {
        username: 'updatetest@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      const createdUser = await db.insert(users).values(userData).returning();
      const userId = createdUser[0].id;

      // Обновляем пользователя
      const updateData = {
        language: 'en',
        preferredMode: 'analyze_offers'
      };

      await db.update(users)
        .set(updateData)
        .where(eq(users.id, userId));

      // Проверяем обновление
      const updatedUser = await db.select().from(users).where(eq(users.id, userId));
      
      expect(updatedUser[0].language).toBe(updateData.language);
      expect(updatedUser[0].preferredMode).toBe(updateData.preferredMode);
    });

    it('should delete user from database', async () => {
      // Создаем пользователя
      const userData = {
        username: 'deletetest@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      const createdUser = await db.insert(users).values(userData).returning();
      const userId = createdUser[0].id;

      // Удаляем пользователя
      await db.delete(users).where(eq(users.id, userId));

      // Проверяем удаление
      const deletedUser = await db.select().from(users).where(eq(users.id, userId));
      expect(deletedUser).toHaveLength(0);
    });
  });

  describe('User Authentication', () => {
    it('should find user by username', async () => {
      const userData = {
        username: 'authtest@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      await db.insert(users).values(userData);

      const foundUser = await db.select()
        .from(users)
        .where(eq(users.username, userData.username));

      expect(foundUser).toHaveLength(1);
      expect(foundUser[0].username).toBe(userData.username);
    });

    it('should handle duplicate username', async () => {
      const userData = {
        username: 'duplicate@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      // Создаем первого пользователя
      await db.insert(users).values(userData);

      // Пытаемся создать второго с тем же username
      await expect(
        db.insert(users).values(userData)
      ).rejects.toThrow();
    });

    it('should update last login timestamp', async () => {
      const userData = {
        username: 'logintest@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      const createdUser = await db.insert(users).values(userData).returning();
      const userId = createdUser[0].id;

      const loginTime = new Date();
      await db.update(users)
        .set({ lastLogin: loginTime })
        .where(eq(users.id, userId));

      const updatedUser = await db.select().from(users).where(eq(users.id, userId));
      expect(updatedUser[0].lastLogin).toBeDefined();
    });
  });

  describe('User Email Configuration', () => {
    it('should configure user email settings', async () => {
      const userData = {
        username: 'emailtest@example.com',
        password: 'hashedpassword123',
        role: 'user',
        emailAccount: 'user@company.com',
        emailPassword: 'encryptedpassword',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        imapHost: 'imap.gmail.com',
        imapPort: 993,
        emailConfigured: true
      };

      const result = await db.insert(users).values(userData).returning();
      
      expect(result[0].emailAccount).toBe(userData.emailAccount);
      expect(result[0].emailConfigured).toBe(true);
      expect(result[0].smtpHost).toBe(userData.smtpHost);
    });

    it('should update email configuration', async () => {
      const userData = {
        username: 'emailupdatetest@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      const createdUser = await db.insert(users).values(userData).returning();
      const userId = createdUser[0].id;

      const emailConfig = {
        emailAccount: 'newemail@company.com',
        emailPassword: 'newencryptedpassword',
        emailConfigured: true
      };

      await db.update(users)
        .set(emailConfig)
        .where(eq(users.id, userId));

      const updatedUser = await db.select().from(users).where(eq(users.id, userId));
      expect(updatedUser[0].emailAccount).toBe(emailConfig.emailAccount);
      expect(updatedUser[0].emailConfigured).toBe(true);
    });
  });

  describe('User Roles and Permissions', () => {
    it('should create admin user', async () => {
      const adminData = {
        username: 'admin@example.com',
        password: 'hashedpassword123',
        role: 'admin'
      };

      const result = await db.insert(users).values(adminData).returning();
      
      expect(result[0].role).toBe('admin');
    });

    it('should create regular user', async () => {
      const userData = {
        username: 'user@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      const result = await db.insert(users).values(userData).returning();
      
      expect(result[0].role).toBe('user');
    });

    it('should handle role updates', async () => {
      const userData = {
        username: 'roleupdatetest@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      const createdUser = await db.insert(users).values(userData).returning();
      const userId = createdUser[0].id;

      // Обновляем роль на admin
      await db.update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, userId));

      const updatedUser = await db.select().from(users).where(eq(users.id, userId));
      expect(updatedUser[0].role).toBe('admin');
    });
  });

  describe('User Preferences', () => {
    it('should set user language preference', async () => {
      const userData = {
        username: 'langtest@example.com',
        password: 'hashedpassword123',
        role: 'user',
        language: 'en'
      };

      const result = await db.insert(users).values(userData).returning();
      
      expect(result[0].language).toBe('en');
    });

    it('should set user preferred mode', async () => {
      const userData = {
        username: 'modetest@example.com',
        password: 'hashedpassword123',
        role: 'user',
        preferredMode: 'analyze_offers'
      };

      const result = await db.insert(users).values(userData).returning();
      
      expect(result[0].preferredMode).toBe('analyze_offers');
    });

    it('should handle onboarding completion', async () => {
      const userData = {
        username: 'onboardingtest@example.com',
        password: 'hashedpassword123',
        role: 'user',
        onboardingCompleted: false
      };

      const createdUser = await db.insert(users).values(userData).returning();
      const userId = createdUser[0].id;

      // Отмечаем онбординг как завершенный
      await db.update(users)
        .set({ onboardingCompleted: true })
        .where(eq(users.id, userId));

      const updatedUser = await db.select().from(users).where(eq(users.id, userId));
      expect(updatedUser[0].onboardingCompleted).toBe(true);
    });
  });

  describe('Database Constraints', () => {
    it('should enforce unique username constraint', async () => {
      const userData = {
        username: 'unique@example.com',
        password: 'hashedpassword123',
        role: 'user'
      };

      await db.insert(users).values(userData);

      // Пытаемся создать пользователя с тем же username
      await expect(
        db.insert(users).values(userData)
      ).rejects.toThrow();
    });

    it('should handle null values correctly', async () => {
      const userData = {
        username: 'nulltest@example.com',
        password: 'hashedpassword123',
        role: 'user'
        // Не указываем опциональные поля
      };

      const result = await db.insert(users).values(userData).returning();
      
      expect(result[0].businessCard).toBeNull();
      expect(result[0].logoUrl).toBeNull();
      expect(result[0].resetToken).toBeNull();
    });

    it('should handle default values', async () => {
      const userData = {
        username: 'defaulttest@example.com',
        password: 'hashedpassword123'
        // Не указываем role, language, preferredMode
      };

      const result = await db.insert(users).values(userData).returning();
      
      expect(result[0].role).toBe('user');
      expect(result[0].language).toBe('ru');
      expect(result[0].preferredMode).toBe('supplier_search');
      expect(result[0].onboardingCompleted).toBe(false);
    });
  });
});


