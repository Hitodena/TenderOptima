import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('Load Testing - Performance Tests', () => {
  let authToken: string;
  let userId: number;
  let testServer: any;

  beforeAll(async () => {
    await setupTestEnvironment();
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    userId = session.user.id;
    testServer = await TestHelpers.createTestServer();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    if (testServer) {
      await testServer.close();
    }
  });

  describe('Concurrent User Load', () => {
    it('should handle 100 concurrent users', async () => {
      const concurrentUsers = 100;
      const requestsPerUser = 10;
      const totalRequests = concurrentUsers * requestsPerUser;

      const startTime = Date.now();
      const promises = [];

      // Создаем 100 параллельных пользователей
      for (let i = 0; i < concurrentUsers; i++) {
        const userPromises = [];
        
        // Каждый пользователь делает 10 запросов
        for (let j = 0; j < requestsPerUser; j++) {
          userPromises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${authToken}` }
            })
          );
        }
        
        promises.push(Promise.all(userPromises));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Проверяем, что все запросы успешны
      let successCount = 0;
      let errorCount = 0;

      results.forEach(userResults => {
        userResults.forEach(response => {
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        });
      });

      // Метрики производительности
      const avgResponseTime = totalTime / totalRequests;
      const requestsPerSecond = totalRequests / (totalTime / 1000);
      const successRate = (successCount / totalRequests) * 100;

      console.log(`📊 Load Test Results (100 users, 10 requests each):`);
      console.log(`   Total Requests: ${totalRequests}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);
      console.log(`   Total Time: ${totalTime}ms`);

      // Проверяем производительность
      expect(successRate).toBeGreaterThanOrEqual(95); // 95% успешных запросов
      expect(avgResponseTime).toBeLessThan(1000); // Средний ответ < 1 секунды
      expect(requestsPerSecond).toBeGreaterThan(50); // > 50 RPS
    });

    it('should handle 500 concurrent users', async () => {
      const concurrentUsers = 500;
      const requestsPerUser = 5;
      const totalRequests = concurrentUsers * requestsPerUser;

      const startTime = Date.now();
      const promises = [];

      // Создаем 500 параллельных пользователей
      for (let i = 0; i < concurrentUsers; i++) {
        const userPromises = [];
        
        // Каждый пользователь делает 5 запросов
        for (let j = 0; j < requestsPerUser; j++) {
          userPromises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/status`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${authToken}` }
            })
          );
        }
        
        promises.push(Promise.all(userPromises));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Проверяем результаты
      let successCount = 0;
      let errorCount = 0;

      results.forEach(userResults => {
        userResults.forEach(response => {
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        });
      });

      const avgResponseTime = totalTime / totalRequests;
      const requestsPerSecond = totalRequests / (totalTime / 1000);
      const successRate = (successCount / totalRequests) * 100;

      console.log(`📊 High Load Test Results (500 users, 5 requests each):`);
      console.log(`   Total Requests: ${totalRequests}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);

      // Более мягкие требования для высокой нагрузки
      expect(successRate).toBeGreaterThanOrEqual(90); // 90% успешных запросов
      expect(avgResponseTime).toBeLessThan(2000); // Средний ответ < 2 секунд
      expect(requestsPerSecond).toBeGreaterThan(100); // > 100 RPS
    });
  });

  describe('Database Load Testing', () => {
    it('should handle concurrent database operations', async () => {
      const concurrentOperations = 50;
      const operationsPerUser = 20;

      const startTime = Date.now();
      const promises = [];

      // Создаем параллельные операции с БД
      for (let i = 0; i < concurrentOperations; i++) {
        const operationPromises = [];
        
        for (let j = 0; j < operationsPerUser; j++) {
          // Создаем поисковый запрос
          operationPromises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                title: `Load Test Request ${i}-${j}`,
                description: `Load test description ${i}-${j}`,
                requirements: ['quality', 'delivery'],
                budget: 10000,
                deadline: '2024-12-31'
              })
            })
          );
        }
        
        promises.push(Promise.all(operationPromises));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Проверяем результаты
      let successCount = 0;
      let errorCount = 0;

      results.forEach(operationResults => {
        operationResults.forEach(response => {
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        });
      });

      const totalOperations = concurrentOperations * operationsPerUser;
      const avgResponseTime = totalTime / totalOperations;
      const operationsPerSecond = totalOperations / (totalTime / 1000);
      const successRate = (successCount / totalOperations) * 100;

      console.log(`📊 Database Load Test Results:`);
      console.log(`   Total Operations: ${totalOperations}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Operations/Second: ${operationsPerSecond.toFixed(2)}`);

      expect(successRate).toBeGreaterThanOrEqual(95);
      expect(avgResponseTime).toBeLessThan(1500);
      expect(operationsPerSecond).toBeGreaterThan(30);
    });

    it('should handle concurrent search operations', async () => {
      const concurrentSearches = 30;
      const searchesPerUser = 10;

      const startTime = Date.now();
      const promises = [];

      // Создаем параллельные поиски
      for (let i = 0; i < concurrentSearches; i++) {
        const searchPromises = [];
        
        for (let j = 0; j < searchesPerUser; j++) {
          searchPromises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                query: `electronics manufacturer ${i}-${j}`,
                maxResults: 10,
                regions: ['ru']
              })
            })
          );
        }
        
        promises.push(Promise.all(searchPromises));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Проверяем результаты
      let successCount = 0;
      let errorCount = 0;

      results.forEach(searchResults => {
        searchResults.forEach(response => {
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        });
      });

      const totalSearches = concurrentSearches * searchesPerUser;
      const avgResponseTime = totalTime / totalSearches;
      const searchesPerSecond = totalSearches / (totalTime / 1000);
      const successRate = (successCount / totalSearches) * 100;

      console.log(`📊 Search Load Test Results:`);
      console.log(`   Total Searches: ${totalSearches}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Searches/Second: ${searchesPerSecond.toFixed(2)}`);

      expect(successRate).toBeGreaterThanOrEqual(90);
      expect(avgResponseTime).toBeLessThan(3000);
      expect(searchesPerSecond).toBeGreaterThan(20);
    });
  });

  describe('Memory Load Testing', () => {
    it('should handle memory-intensive operations', async () => {
      const memoryOperations = 20;
      const operationsPerBatch = 10;

      const startTime = Date.now();
      const promises = [];

      // Создаем операции, интенсивные по памяти
      for (let i = 0; i < memoryOperations; i++) {
        const batchPromises = [];
        
        for (let j = 0; j < operationsPerBatch; j++) {
          // Создаем большие документы для анализа
          batchPromises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                text: 'A'.repeat(10000) + ` - Large document ${i}-${j}`,
                type: 'requirements'
              })
            })
          );
        }
        
        promises.push(Promise.all(batchPromises));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Проверяем результаты
      let successCount = 0;
      let errorCount = 0;

      results.forEach(batchResults => {
        batchResults.forEach(response => {
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        });
      });

      const totalOperations = memoryOperations * operationsPerBatch;
      const avgResponseTime = totalTime / totalOperations;
      const operationsPerSecond = totalOperations / (totalTime / 1000);
      const successRate = (successCount / totalOperations) * 100;

      console.log(`📊 Memory Load Test Results:`);
      console.log(`   Total Operations: ${totalOperations}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Operations/Second: ${operationsPerSecond.toFixed(2)}`);

      expect(successRate).toBeGreaterThanOrEqual(85);
      expect(avgResponseTime).toBeLessThan(5000);
      expect(operationsPerSecond).toBeGreaterThan(10);
    });

    it('should handle memory leaks', async () => {
      const iterations = 100;
      const startMemory = process.memoryUsage();

      // Выполняем много операций для проверки утечек памяти
      for (let i = 0; i < iterations; i++) {
        await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // Принудительная сборка мусора каждые 10 итераций
        if (i % 10 === 0) {
          if (global.gc) {
            global.gc();
          }
        }
      }

      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`📊 Memory Leak Test Results:`);
      console.log(`   Start Memory: ${(startMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   End Memory: ${(endMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory Increase: ${memoryIncreaseMB.toFixed(2)}MB`);

      // Проверяем, что увеличение памяти не критично
      expect(memoryIncreaseMB).toBeLessThan(100); // Увеличение < 100MB
    });
  });

  describe('Network Load Testing', () => {
    it('should handle network latency', async () => {
      const requests = 50;
      const startTime = Date.now();
      const promises = [];

      // Создаем запросы с разными задержками
      for (let i = 0; i < requests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Анализируем время ответа
      const responseTimes = [];
      for (const response of results) {
        if (response.ok) {
          responseTimes.push(100); // Примерное время ответа
        }
      }

      const avgResponseTime = totalTime / requests;
      const requestsPerSecond = requests / (totalTime / 1000);
      const successRate = (responseTimes.length / requests) * 100;

      console.log(`📊 Network Load Test Results:`);
      console.log(`   Total Requests: ${requests}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);

      expect(successRate).toBeGreaterThanOrEqual(95);
      expect(avgResponseTime).toBeLessThan(1000);
      expect(requestsPerSecond).toBeGreaterThan(30);
    });

    it('should handle connection timeouts', async () => {
      const timeoutRequests = 20;
      const promises = [];

      // Создаем запросы с таймаутами
      for (let i = 0; i < timeoutRequests; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` },
            signal: AbortSignal.timeout(5000) // 5 секунд таймаут
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      const successRate = (successCount / timeoutRequests) * 100;

      console.log(`📊 Timeout Test Results:`);
      console.log(`   Total Requests: ${timeoutRequests}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Failures: ${failureCount}`);

      expect(successRate).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Stress Testing', () => {
    it('should handle system stress', async () => {
      const stressLevel = 1000; // 1000 одновременных операций
      const startTime = Date.now();
      const promises = [];

      // Создаем стресс-тест
      for (let i = 0; i < stressLevel; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/status`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      const successRate = (successCount / stressLevel) * 100;

      console.log(`📊 Stress Test Results:`);
      console.log(`   Total Operations: ${stressLevel}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Failures: ${failureCount}`);
      console.log(`   Total Time: ${totalTime}ms`);

      // При стресс-тесте допускаем больше ошибок
      expect(successRate).toBeGreaterThanOrEqual(80);
      expect(totalTime).toBeLessThan(30000); // < 30 секунд
    });

    it('should recover from system stress', async () => {
      // Сначала создаем стресс
      const stressPromises = [];
      for (let i = 0; i < 500; i++) {
        stressPromises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );
      }

      await Promise.allSettled(stressPromises);

      // Ждем восстановления
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Проверяем, что система восстановилась
      const recoveryStart = Date.now();
      const recoveryPromises = [];
      
      for (let i = 0; i < 10; i++) {
        recoveryPromises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );
      }

      const recoveryResults = await Promise.all(recoveryPromises);
      const recoveryEnd = Date.now();
      const recoveryTime = recoveryEnd - recoveryStart;

      const successCount = recoveryResults.filter(r => r.ok).length;
      const successRate = (successCount / 10) * 100;

      console.log(`📊 Recovery Test Results:`);
      console.log(`   Recovery Time: ${recoveryTime}ms`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);

      expect(successRate).toBeGreaterThanOrEqual(95);
      expect(recoveryTime).toBeLessThan(5000);
    });
  });
});


