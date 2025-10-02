import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';
import { TestHelpers } from '../../utils/test-helpers';

describe('Authentication API Tests', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const userData = {
        email: 'newuser@test.com',
        password: 'Password123!',
        name: 'Test User'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.user.email).toBe(userData.email);
      expect(data.user.name).toBe(userData.name);
      expect(data.user.id).toBeDefined();
      expect(data.sessionId).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Password123!',
        name: 'Test User'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      expect(response.status).toBe(400);
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@test.com',
        password: '123',
        name: 'Test User'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      expect(response.status).toBe(400);
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'Password123!',
        name: 'Test User'
      };

      // Первая регистрация
      await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      // Попытка повторной регистрации
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      expect(response.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await TestHelpers.createTestUser();
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.user.email,
        password: 'TestPassword123!'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.email).toBe(loginData.email);
      expect(data.sessionId).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const loginData = {
        email: 'nonexistent@test.com',
        password: 'Password123!'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      expect(response.status).toBe(401);
    });

    it('should reject invalid password', async () => {
      const loginData = {
        email: testUser.user.email,
        password: 'WrongPassword123!'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
      const session = await TestHelpers.createTestSession();
      authToken = session.token;
    });

    it('should return user info for authenticated user', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBeDefined();
      expect(data.user.id).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/me`, {
        method: 'GET'
      });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      const session = await TestHelpers.createTestSession();
      authToken = session.token;
    });

    it('should logout authenticated user', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
    });

    it('should handle logout for unauthenticated user', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/logout`, {
        method: 'POST'
      });

      expect(response.status).toBe(401);
    });
  });
});


