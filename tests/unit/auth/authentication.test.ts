import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';

describe('Authentication Tests', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  it('should register new user', async () => {
    const userData = {
      email: 'newuser@test.com',
      password: 'password123',
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
  });

  it('should login existing user', async () => {
    // Сначала создаем пользователя
    const userData = {
      email: 'logintest@test.com',
      password: 'password123',
      name: 'Login Test User'
    };

    await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    // Теперь пытаемся войти
    const loginData = {
      email: userData.email,
      password: userData.password
    };

    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.sessionId).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const loginData = {
      email: 'invalid@test.com',
      password: 'wrongpassword'
    };

    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });

    expect(response.status).toBe(401);
  });

  it('should require authentication for protected routes', async () => {
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'GET'
    });

    expect(response.status).toBe(401);
  });

  it('should validate email format', async () => {
    const userData = {
      email: 'invalid-email',
      password: 'password123',
      name: 'Test User'
    };

    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    expect(response.status).toBe(400);
  });

  it('should validate password strength', async () => {
    const userData = {
      email: 'test@test.com',
      password: '123', // Слишком короткий пароль
      name: 'Test User'
    };

    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    expect(response.status).toBe(400);
  });
});


