import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('Scalability Testing - Performance Tests', () => {
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

  describe('Horizontal Scaling Tests', () => {
    it('should scale with increasing user load', async () => {
      const userLoads = [10, 50, 100, 200, 500];
      const performanceMetrics = [];

      for (const userLoad of userLoads) {
        const startTime = Date.now();
        const promises = [];

        // Создаем нагрузку для каждого уровня пользователей
        for (let i = 0; i < userLoad; i++) {
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

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / userLoad) * 100;
        const avgResponseTime = totalTime / userLoad;
        const requestsPerSecond = userLoad / (totalTime / 1000);

        performanceMetrics.push({
          userLoad,
          successRate,
          avgResponseTime,
          requestsPerSecond,
          totalTime
        });

        console.log(`📊 Scaling Test - ${userLoad} users:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что производительность не деградирует критично
      const firstMetric = performanceMetrics[0];
      const lastMetric = performanceMetrics[performanceMetrics.length - 1];

      // Успешность не должна падать более чем на 20%
      expect(lastMetric.successRate).toBeGreaterThanOrEqual(firstMetric.successRate - 20);
      
      // Время ответа не должно увеличиваться более чем в 3 раза
      expect(lastMetric.avgResponseTime).toBeLessThan(firstMetric.avgResponseTime * 3);
    });

    it('should maintain performance with concurrent operations', async () => {
      const operationTypes = [
        { endpoint: '/api/health', method: 'GET' },
        { endpoint: '/api/status', method: 'GET' },
        { endpoint: '/api/requests', method: 'POST', body: { title: 'Test', description: 'Test' } },
        { endpoint: '/api/supplier-search', method: 'POST', body: { query: 'test' } }
      ];

      const concurrentOperations = 50;
      const performanceMetrics = [];

      for (const operationType of operationTypes) {
        const startTime = Date.now();
        const promises = [];

        // Создаем параллельные операции
        for (let i = 0; i < concurrentOperations; i++) {
          const requestOptions: RequestInit = {
            method: operationType.method,
            headers: { 
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          };

          if (operationType.body) {
            requestOptions.body = JSON.stringify(operationType.body);
          }

          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}${operationType.endpoint}`, requestOptions)
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / concurrentOperations) * 100;
        const avgResponseTime = totalTime / concurrentOperations;
        const operationsPerSecond = concurrentOperations / (totalTime / 1000);

        performanceMetrics.push({
          operation: operationType.endpoint,
          successRate,
          avgResponseTime,
          operationsPerSecond
        });

        console.log(`📊 Operation Test - ${operationType.endpoint}:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Operations/Second: ${operationsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что все операции выполняются успешно
      performanceMetrics.forEach(metric => {
        expect(metric.successRate).toBeGreaterThanOrEqual(90);
        expect(metric.avgResponseTime).toBeLessThan(2000);
      });
    });
  });

  describe('Database Scaling Tests', () => {
    it('should handle database connection pooling', async () => {
      const connectionTests = [10, 25, 50, 100, 200];
      const performanceMetrics = [];

      for (const connectionCount of connectionTests) {
        const startTime = Date.now();
        const promises = [];

        // Создаем операции с БД
        for (let i = 0; i < connectionCount; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                title: `DB Test ${i}`,
                description: `Database connection test ${i}`,
                requirements: ['quality'],
                budget: 1000
              })
            })
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / connectionCount) * 100;
        const avgResponseTime = totalTime / connectionCount;
        const connectionsPerSecond = connectionCount / (totalTime / 1000);

        performanceMetrics.push({
          connectionCount,
          successRate,
          avgResponseTime,
          connectionsPerSecond
        });

        console.log(`📊 DB Connection Test - ${connectionCount} connections:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Connections/Second: ${connectionsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что производительность БД остается стабильной
      const firstMetric = performanceMetrics[0];
      const lastMetric = performanceMetrics[performanceMetrics.length - 1];

      expect(lastMetric.successRate).toBeGreaterThanOrEqual(firstMetric.successRate - 15);
      expect(lastMetric.avgResponseTime).toBeLessThan(firstMetric.avgResponseTime * 2);
    });

    it('should handle database query optimization', async () => {
      const queryTypes = [
        { endpoint: '/api/requests', description: 'Simple queries' },
        { endpoint: '/api/supplier-search', description: 'Complex search queries' },
        { endpoint: '/api/analysis', description: 'Analysis queries' }
      ];

      const queryLoad = 30;
      const performanceMetrics = [];

      for (const queryType of queryTypes) {
        const startTime = Date.now();
        const promises = [];

        // Создаем нагрузку для каждого типа запросов
        for (let i = 0; i < queryLoad; i++) {
          const requestBody = queryType.endpoint === '/api/supplier-search' 
            ? { query: `test query ${i}`, maxResults: 10 }
            : queryType.endpoint === '/api/analysis'
            ? { text: `test text ${i}`, type: 'requirements' }
            : { title: `test ${i}`, description: `test description ${i}` };

          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}${queryType.endpoint}`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify(requestBody)
            })
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / queryLoad) * 100;
        const avgResponseTime = totalTime / queryLoad;
        const queriesPerSecond = queryLoad / (totalTime / 1000);

        performanceMetrics.push({
          queryType: queryType.description,
          successRate,
          avgResponseTime,
          queriesPerSecond
        });

        console.log(`📊 Query Optimization Test - ${queryType.description}:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Queries/Second: ${queriesPerSecond.toFixed(2)}`);
      }

      // Проверяем, что все типы запросов оптимизированы
      performanceMetrics.forEach(metric => {
        expect(metric.successRate).toBeGreaterThanOrEqual(85);
        expect(metric.avgResponseTime).toBeLessThan(3000);
      });
    });
  });

  describe('Memory Scaling Tests', () => {
    it('should handle memory usage scaling', async () => {
      const memoryLoads = [10, 25, 50, 100];
      const performanceMetrics = [];

      for (const memoryLoad of memoryLoads) {
        const startMemory = process.memoryUsage();
        const startTime = Date.now();
        const promises = [];

        // Создаем операции, интенсивные по памяти
        for (let i = 0; i < memoryLoad; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                text: 'A'.repeat(5000) + ` - Memory test ${i}`,
                type: 'requirements'
              })
            })
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const endMemory = process.memoryUsage();

        const totalTime = endTime - startTime;
        const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
        const memoryUsedMB = memoryUsed / 1024 / 1024;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / memoryLoad) * 100;
        const avgResponseTime = totalTime / memoryLoad;
        const operationsPerSecond = memoryLoad / (totalTime / 1000);

        performanceMetrics.push({
          memoryLoad,
          successRate,
          avgResponseTime,
          operationsPerSecond,
          memoryUsedMB
        });

        console.log(`📊 Memory Scaling Test - ${memoryLoad} operations:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Operations/Second: ${operationsPerSecond.toFixed(2)}`);
        console.log(`   Memory Used: ${memoryUsedMB.toFixed(2)}MB`);

        // Принудительная сборка мусора
        if (global.gc) {
          global.gc();
        }
      }

      // Проверяем, что использование памяти растет линейно
      const firstMetric = performanceMetrics[0];
      const lastMetric = performanceMetrics[performanceMetrics.length - 1];

      expect(lastMetric.successRate).toBeGreaterThanOrEqual(firstMetric.successRate - 10);
      expect(lastMetric.memoryUsedMB).toBeLessThan(500); // < 500MB
    });

    it('should handle memory leak prevention', async () => {
      const iterations = 200;
      const startMemory = process.memoryUsage();
      const startTime = Date.now();

      // Выполняем много операций для проверки утечек
      for (let i = 0; i < iterations; i++) {
        await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // Принудительная сборка мусора каждые 20 итераций
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      const totalTime = endTime - startTime;
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`📊 Memory Leak Prevention Test:`);
      console.log(`   Iterations: ${iterations}`);
      console.log(`   Total Time: ${totalTime}ms`);
      console.log(`   Memory Increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      console.log(`   Memory per Operation: ${(memoryIncreaseMB / iterations).toFixed(4)}MB`);

      // Проверяем, что утечек памяти нет
      expect(memoryIncreaseMB).toBeLessThan(50); // Увеличение < 50MB
      expect(totalTime).toBeLessThan(30000); // < 30 секунд
    });
  });

  describe('Network Scaling Tests', () => {
    it('should handle network bandwidth scaling', async () => {
      const bandwidthTests = [10, 25, 50, 100];
      const performanceMetrics = [];

      for (const bandwidthTest of bandwidthTests) {
        const startTime = Date.now();
        const promises = [];

        // Создаем операции с разной нагрузкой на сеть
        for (let i = 0; i < bandwidthTest; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                query: `network test ${i}`.repeat(100), // Большой запрос
                maxResults: 50
              })
            })
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / bandwidthTest) * 100;
        const avgResponseTime = totalTime / bandwidthTest;
        const requestsPerSecond = bandwidthTest / (totalTime / 1000);

        performanceMetrics.push({
          bandwidthTest,
          successRate,
          avgResponseTime,
          requestsPerSecond
        });

        console.log(`📊 Network Bandwidth Test - ${bandwidthTest} requests:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что производительность сети остается стабильной
      const firstMetric = performanceMetrics[0];
      const lastMetric = performanceMetrics[performanceMetrics.length - 1];

      expect(lastMetric.successRate).toBeGreaterThanOrEqual(firstMetric.successRate - 15);
      expect(lastMetric.avgResponseTime).toBeLessThan(firstMetric.avgResponseTime * 2);
    });

    it('should handle network latency scaling', async () => {
      const latencyTests = [5, 10, 20, 50];
      const performanceMetrics = [];

      for (const latencyTest of latencyTests) {
        const startTime = Date.now();
        const promises = [];

        // Создаем операции с разными задержками
        for (let i = 0; i < latencyTest; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${authToken}` },
              signal: AbortSignal.timeout(10000) // 10 секунд таймаут
            })
          );
        }

        const results = await Promise.allSettled(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const successRate = (successCount / latencyTest) * 100;
        const avgResponseTime = totalTime / latencyTest;
        const requestsPerSecond = latencyTest / (totalTime / 1000);

        performanceMetrics.push({
          latencyTest,
          successRate,
          avgResponseTime,
          requestsPerSecond
        });

        console.log(`📊 Network Latency Test - ${latencyTest} requests:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что задержки не критичны
      performanceMetrics.forEach(metric => {
        expect(metric.successRate).toBeGreaterThanOrEqual(90);
        expect(metric.avgResponseTime).toBeLessThan(5000);
      });
    });
  });

  describe('System Resource Scaling', () => {
    it('should handle CPU scaling', async () => {
      const cpuLoads = [10, 25, 50, 100];
      const performanceMetrics = [];

      for (const cpuLoad of cpuLoads) {
        const startTime = Date.now();
        const promises = [];

        // Создаем CPU-интенсивные операции
        for (let i = 0; i < cpuLoad; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                text: `CPU intensive analysis ${i}`.repeat(100),
                type: 'requirements'
              })
            })
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / cpuLoad) * 100;
        const avgResponseTime = totalTime / cpuLoad;
        const operationsPerSecond = cpuLoad / (totalTime / 1000);

        performanceMetrics.push({
          cpuLoad,
          successRate,
          avgResponseTime,
          operationsPerSecond
        });

        console.log(`📊 CPU Scaling Test - ${cpuLoad} operations:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Operations/Second: ${operationsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что CPU нагрузка обрабатывается корректно
      const firstMetric = performanceMetrics[0];
      const lastMetric = performanceMetrics[performanceMetrics.length - 1];

      expect(lastMetric.successRate).toBeGreaterThanOrEqual(firstMetric.successRate - 20);
      expect(lastMetric.avgResponseTime).toBeLessThan(firstMetric.avgResponseTime * 3);
    });

    it('should handle disk I/O scaling', async () => {
      const diskLoads = [5, 10, 20, 50];
      const performanceMetrics = [];

      for (const diskLoad of diskLoads) {
        const startTime = Date.now();
        const promises = [];

        // Создаем операции с дисковым I/O
        for (let i = 0; i < diskLoad; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                title: `Disk I/O test ${i}`,
                description: `Testing disk operations ${i}`.repeat(50),
                requirements: ['quality', 'delivery', 'certification'],
                budget: 10000
              })
            })
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / diskLoad) * 100;
        const avgResponseTime = totalTime / diskLoad;
        const operationsPerSecond = diskLoad / (totalTime / 1000);

        performanceMetrics.push({
          diskLoad,
          successRate,
          avgResponseTime,
          operationsPerSecond
        });

        console.log(`📊 Disk I/O Scaling Test - ${diskLoad} operations:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Operations/Second: ${operationsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что дисковые операции масштабируются
      performanceMetrics.forEach(metric => {
        expect(metric.successRate).toBeGreaterThanOrEqual(85);
        expect(metric.avgResponseTime).toBeLessThan(4000);
      });
    });
  });
});


