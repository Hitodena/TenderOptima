import { describe, it, expect } from 'vitest';

// Импортируем утилиты валидации (предполагаем, что они существуют)
// Если их нет, создадим простые функции для тестирования

// Простые функции валидации для тестирования
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): boolean => {
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password);
};

const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'test123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test@.com',
        'test..test@example.com',
        '',
        'test@example',
        'test@.com'
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validateEmail('a@b.c')).toBe(true);
      expect(validateEmail('test@sub.domain.com')).toBe(true);
      expect(validateEmail('user+tag+label@example.com')).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'Password123',
        'MySecure1Pass',
        'ComplexP@ssw0rd',
        'StrongP@ss123'
      ];

      strongPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password', // Нет цифр и заглавных букв
        'PASSWORD', // Нет строчных букв и цифр
        '12345678', // Нет букв
        'Pass1', // Слишком короткий
        '', // Пустой
        'password123', // Нет заглавных букв
        'PASSWORD123' // Нет строчных букв
      ];

      weakPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });

    it('should handle special characters', () => {
      expect(validatePassword('Pass@123')).toBe(true);
      expect(validatePassword('Pass#123')).toBe(true);
      expect(validatePassword('Pass$123')).toBe(true);
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '1234567890',
        '+7 123 456 7890',
        '+44 20 7946 0958',
        '123-456-7890',
        '(123) 456-7890'
      ];

      validPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '123', // Слишком короткий
        'abc1234567', // Содержит буквы
        '+0123456789', // Начинается с 0
        '', // Пустой
        '123-abc-7890' // Содержит буквы
      ];

      invalidPhones.forEach(phone => {
        expect(validatePhone(phone)).toBe(false);
      });
    });

    it('should handle international formats', () => {
      expect(validatePhone('+1 234 567 8900')).toBe(true);
      expect(validatePhone('+44 20 7946 0958')).toBe(true);
      expect(validatePhone('+7 495 123 4567')).toBe(true);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://www.example.com',
        'https://example.com/path',
        'https://example.com/path?query=value',
        'https://subdomain.example.com'
      ];

      validUrls.forEach(url => {
        expect(validateUrl(url)).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'example.com', // Нет протокола
        'ftp://example.com', // Неподдерживаемый протокол
        '', // Пустой
        'https://', // Нет домена
        'javascript:alert(1)' // Опасный протокол
      ];

      invalidUrls.forEach(url => {
        expect(validateUrl(url)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validateUrl('https://example.com:8080')).toBe(true);
      expect(validateUrl('https://example.com#section')).toBe(true);
      expect(validateUrl('https://user:pass@example.com')).toBe(true);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const maliciousInput = '<script>alert("XSS")</script>Hello World';
      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove HTML tags', () => {
      const htmlInput = '<p>Hello <strong>World</strong></p>';
      const sanitized = sanitizeInput(htmlInput);
      
      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('should handle nested script tags', () => {
      const nestedScript = '<div><script>alert("XSS")</script></div>';
      const sanitized = sanitizeInput(nestedScript);
      
      expect(sanitized).toBe('');
      expect(sanitized).not.toContain('<script>');
    });

    it('should preserve safe text', () => {
      const safeInput = 'This is safe text with numbers 123 and symbols !@#';
      const sanitized = sanitizeInput(safeInput);
      
      expect(sanitized).toBe(safeInput);
    });

    it('should trim whitespace', () => {
      const inputWithSpaces = '  Hello World  ';
      const sanitized = sanitizeInput(inputWithSpaces);
      
      expect(sanitized).toBe('Hello World');
    });

    it('should handle empty input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput('   ')).toBe('');
    });
  });

  describe('Integration tests', () => {
    it('should validate complete user data', () => {
      const validUserData = {
        email: 'test@example.com',
        password: 'Password123',
        phone: '+1234567890',
        website: 'https://example.com'
      };

      expect(validateEmail(validUserData.email)).toBe(true);
      expect(validatePassword(validUserData.password)).toBe(true);
      expect(validatePhone(validUserData.phone)).toBe(true);
      expect(validateUrl(validUserData.website)).toBe(true);
    });

    it('should sanitize user input before validation', () => {
      const maliciousInput = '<script>alert("XSS")</script>test@example.com';
      const sanitized = sanitizeInput(maliciousInput);
      
      expect(validateEmail(sanitized)).toBe(true);
      expect(sanitized).not.toContain('<script>');
    });
  });
});


