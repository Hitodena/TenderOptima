import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';

describe('Search Requests API Tests', () => {
  let authToken: string;
  let userId: number;

  beforeEach(async () => {
    await setupTestEnvironment();
    
    // Создаем тестового пользователя и получаем токен
    const userData = {
      email: 'apiuser@test.com',
      password: 'password123',
      name: 'API Test User'
    };

    // Регистрируем пользователя
    await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    // Логинимся
    const loginResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password
      })
    });

    const loginData = await loginResponse.json();
    authToken = loginData.sessionId;
    userId = loginData.user.id;
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  it('should create search request', async () => {
    const requestData = {
      title: 'Test Search Request',
      description: 'Test description',
      requirements: ['quality', 'delivery'],
      budget: 10000,
      deadline: '2024-12-31'
    };

    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(requestData)
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.title).toBe(requestData.title);
    expect(data.description).toBe(requestData.description);
    expect(data.userId).toBe(userId);
  });

  it('should get user search requests', async () => {
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should update search request', async () => {
    // Сначала создаем запрос
    const requestData = {
      title: 'Original Title',
      description: 'Original description',
      requirements: ['quality']
    };

    const createResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(requestData)
    });

    const createdRequest = await createResponse.json();

    // Теперь обновляем
    const updateData = {
      title: 'Updated Title',
      description: 'Updated description'
    };

    const updateResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests/${createdRequest.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(updateData)
    });

    expect(updateResponse.status).toBe(200);
    const updatedRequest = await updateResponse.json();
    expect(updatedRequest.title).toBe(updateData.title);
    expect(updatedRequest.description).toBe(updateData.description);
  });

  it('should delete search request', async () => {
    // Сначала создаем запрос
    const requestData = {
      title: 'To Delete',
      description: 'This will be deleted',
      requirements: ['quality']
    };

    const createResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(requestData)
    });

    const createdRequest = await createResponse.json();

    // Теперь удаляем
    const deleteResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests/${createdRequest.id}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(deleteResponse.status).toBe(200);
  });

  it('should validate request data', async () => {
    const invalidData = {
      title: '', // Пустой заголовок
      description: 'Test description'
    };

    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(invalidData)
    });

    expect(response.status).toBe(400);
  });

  it('should prevent access to other users requests', async () => {
    // Создаем запрос от первого пользователя
    const requestData = {
      title: 'Private Request',
      description: 'This should be private',
      requirements: ['quality']
    };

    const createResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(requestData)
    });

    const createdRequest = await createResponse.json();

    // Создаем второго пользователя
    const secondUserData = {
      email: 'seconduser@test.com',
      password: 'password123',
      name: 'Second User'
    };

    await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secondUserData)
    });

    const secondLoginResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: secondUserData.email,
        password: secondUserData.password
      })
    });

    const secondLoginData = await secondLoginResponse.json();
    const secondAuthToken = secondLoginData.sessionId;

    // Второй пользователь пытается получить доступ к запросу первого
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests/${createdRequest.id}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${secondAuthToken}`
      }
    });

    expect(response.status).toBe(403);
  });
});


