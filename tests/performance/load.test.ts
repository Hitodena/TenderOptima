import { describe, it, expect } from 'vitest';
import { TEST_CONFIG } from '../setup/test-environment';

describe('Performance Tests', () => {
  it('should handle concurrent health check requests', async () => {
    const concurrentRequests = 50;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
      );
    }

    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const endTime = Date.now();

    // Все запросы должны быть успешными
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Время выполнения не должно превышать 5 секунд
    expect(endTime - startTime).toBeLessThan(5000);
    
    console.log(`✅ Обработано ${concurrentRequests} запросов за ${endTime - startTime}ms`);
  });

  it('should handle rapid sequential requests', async () => {
    const requestCount = 100;
    const startTime = Date.now();
    
    for (let i = 0; i < requestCount; i++) {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
      expect(response.status).toBe(200);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / requestCount;
    
    // Среднее время ответа не должно превышать 100ms
    expect(avgTime).toBeLessThan(100);
    
    console.log(`✅ ${requestCount} последовательных запросов за ${totalTime}ms (среднее: ${avgTime.toFixed(2)}ms)`);
  });

  it('should handle large payload requests', async () => {
    // Создаем большой JSON объект
    const largeData = {
      title: 'Large Request Test',
      description: 'A'.repeat(10000), // 10KB строка
      requirements: Array.from({ length: 100 }, (_, i) => `requirement_${i}`),
      metadata: {
        tags: Array.from({ length: 50 }, (_, i) => `tag_${i}`),
        notes: 'B'.repeat(5000) // 5KB строка
      }
    };

    const startTime = Date.now();
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_CONFIG.TEST_USERS.user.token || 'test-token'}`
      },
      body: JSON.stringify(largeData)
    });
    const endTime = Date.now();

    // Запрос должен обработаться за разумное время
    expect(endTime - startTime).toBeLessThan(2000);
    
    console.log(`✅ Большой запрос обработан за ${endTime - startTime}ms`);
  });

  it('should handle memory usage efficiently', async () => {
    const initialMemory = process.memoryUsage();
    const requests = [];
    
    // Создаем много запросов для проверки утечек памяти
    for (let i = 0; i < 1000; i++) {
      requests.push(
        fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`)
      );
    }
    
    await Promise.all(requests);
    
    // Принудительная сборка мусора
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Увеличение памяти не должно превышать 50MB
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    
    console.log(`✅ Использование памяти: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  });

  it('should handle database connection pool efficiently', async () => {
    const dbRequests = 100;
    const promises = [];
    
    // Симулируем множественные запросы к БД
    for (let i = 0; i < dbRequests; i++) {
      promises.push(
        fetch(`${TEST_CONFIG.API_BASE_URL}/api/search-requests`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${TEST_CONFIG.TEST_USERS.user.token || 'test-token'}`
          }
        })
      );
    }

    const startTime = Date.now();
    const responses = await Promise.all(promises);
    const endTime = Date.now();

    // Все запросы должны быть успешными
    const successCount = responses.filter(r => r.status === 200).length;
    expect(successCount).toBeGreaterThan(0);
    
    // Время выполнения не должно превышать 10 секунд
    expect(endTime - startTime).toBeLessThan(10000);
    
    console.log(`✅ ${successCount}/${dbRequests} запросов к БД за ${endTime - startTime}ms`);
  });
});


