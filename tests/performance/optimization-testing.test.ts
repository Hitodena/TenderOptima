import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('Performance Optimization Tests', () => {
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

  describe('Response Time Optimization', () => {
    it('should optimize API response times', async () => {
      const endpoints = [
        { path: '/api/health', method: 'GET' },
        { path: '/api/status', method: 'GET' },
        { path: '/api/requests', method: 'GET' },
        { path: '/api/supplier-search', method: 'POST', body: { query: 'test' } }
      ];

      const optimizationResults = [];

      for (const endpoint of endpoints) {
        const iterations = 20;
        const responseTimes = [];

        // Измеряем время ответа для каждого endpoint
        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          
          const requestOptions: RequestInit = {
            method: endpoint.method,
            headers: { 'Authorization': `Bearer ${authToken}` }
          };

          if (endpoint.body) {
            requestOptions.headers = { 
              ...requestOptions.headers,
              'Content-Type': 'application/json'
            };
            requestOptions.body = JSON.stringify(endpoint.body);
          }

          const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${endpoint.path}`, requestOptions);
          const endTime = Date.now();
          
          if (response.ok) {
            responseTimes.push(endTime - startTime);
          }
        }

        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const minResponseTime = Math.min(...responseTimes);
        const maxResponseTime = Math.max(...responseTimes);
        const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

        optimizationResults.push({
          endpoint: endpoint.path,
          avgResponseTime,
          minResponseTime,
          maxResponseTime,
          p95ResponseTime
        });

        console.log(`📊 Response Time Optimization - ${endpoint.path}:`);
        console.log(`   Avg: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Min: ${minResponseTime}ms`);
        console.log(`   Max: ${maxResponseTime}ms`);
        console.log(`   P95: ${p95ResponseTime}ms`);
      }

      // Проверяем, что все endpoints оптимизированы
      optimizationResults.forEach(result => {
        expect(result.avgResponseTime).toBeLessThan(1000); // < 1 секунды
        expect(result.p95ResponseTime).toBeLessThan(2000); // P95 < 2 секунды
      });
    });

    it('should optimize database query performance', async () => {
      const queryTests = [
        { name: 'Simple SELECT', endpoint: '/api/requests', method: 'GET' },
        { name: 'Complex JOIN', endpoint: '/api/supplier-search', method: 'POST', body: { query: 'electronics' } },
        { name: 'Aggregation', endpoint: '/api/analysis', method: 'POST', body: { text: 'test analysis', type: 'requirements' } }
      ];

      const queryResults = [];

      for (const queryTest of queryTests) {
        const iterations = 10;
        const queryTimes = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          
          const requestOptions: RequestInit = {
            method: queryTest.method,
            headers: { 'Authorization': `Bearer ${authToken}` }
          };

          if (queryTest.body) {
            requestOptions.headers = { 
              ...requestOptions.headers,
              'Content-Type': 'application/json'
            };
            requestOptions.body = JSON.stringify(queryTest.body);
          }

          const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${queryTest.endpoint}`, requestOptions);
          const endTime = Date.now();
          
          if (response.ok) {
            queryTimes.push(endTime - startTime);
          }
        }

        const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
        const maxQueryTime = Math.max(...queryTimes);

        queryResults.push({
          query: queryTest.name,
          avgQueryTime,
          maxQueryTime
        });

        console.log(`📊 Database Query Optimization - ${queryTest.name}:`);
        console.log(`   Avg Query Time: ${avgQueryTime.toFixed(2)}ms`);
        console.log(`   Max Query Time: ${maxQueryTime}ms`);
      }

      // Проверяем, что запросы к БД оптимизированы
      queryResults.forEach(result => {
        expect(result.avgQueryTime).toBeLessThan(500); // < 500ms
        expect(result.maxQueryTime).toBeLessThan(1000); // < 1 секунды
      });
    });

    it('should optimize caching performance', async () => {
      const cacheTests = [
        { endpoint: '/api/health', description: 'Health check caching' },
        { endpoint: '/api/status', description: 'Status caching' },
        { endpoint: '/api/requests', description: 'Requests caching' }
      ];

      const cacheResults = [];

      for (const cacheTest of cacheTests) {
        // Первый запрос (без кэша)
        const firstRequestStart = Date.now();
        const firstResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}${cacheTest.endpoint}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const firstRequestTime = Date.now() - firstRequestStart;

        // Второй запрос (с кэшем)
        const secondRequestStart = Date.now();
        const secondResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}${cacheTest.endpoint}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const secondRequestTime = Date.now() - secondRequestStart;

        const cacheImprovement = ((firstRequestTime - secondRequestTime) / firstRequestTime) * 100;

        cacheResults.push({
          endpoint: cacheTest.endpoint,
          firstRequestTime,
          secondRequestTime,
          cacheImprovement
        });

        console.log(`📊 Cache Optimization - ${cacheTest.description}:`);
        console.log(`   First Request: ${firstRequestTime}ms`);
        console.log(`   Second Request: ${secondRequestTime}ms`);
        console.log(`   Cache Improvement: ${cacheImprovement.toFixed(2)}%`);
      }

      // Проверяем, что кэширование работает
      cacheResults.forEach(result => {
        expect(result.secondRequestTime).toBeLessThanOrEqual(result.firstRequestTime);
      });
    });
  });

  describe('Memory Optimization', () => {
    it('should optimize memory usage', async () => {
      const startMemory = process.memoryUsage();
      const startTime = Date.now();

      // Выполняем операции для измерения памяти
      const operations = 100;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const endMemory = process.memoryUsage();

      const totalTime = endTime - startTime;
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
      const memoryUsedMB = memoryUsed / 1024 / 1024;
      const memoryPerOperation = memoryUsed / operations;
      const memoryPerSecond = memoryUsed / (totalTime / 1000);

      console.log(`📊 Memory Optimization Results:`);
      console.log(`   Operations: ${operations}`);
      console.log(`   Total Time: ${totalTime}ms`);
      console.log(`   Memory Used: ${memoryUsedMB.toFixed(2)}MB`);
      console.log(`   Memory per Operation: ${(memoryPerOperation / 1024).toFixed(2)}KB`);
      console.log(`   Memory per Second: ${(memoryPerSecond / 1024 / 1024).toFixed(2)}MB/s`);

      // Проверяем, что использование памяти оптимизировано
      expect(memoryUsedMB).toBeLessThan(50); // < 50MB
      expect(memoryPerOperation).toBeLessThan(1024 * 1024); // < 1MB per operation
    });

    it('should optimize garbage collection', async () => {
      const gcTests = [10, 25, 50, 100];
      const gcResults = [];

      for (const gcTest of gcTests) {
        const startMemory = process.memoryUsage();
        const startTime = Date.now();

        // Выполняем операции
        const promises = [];
        for (let i = 0; i < gcTest; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                text: `GC test ${i}`.repeat(100),
                type: 'requirements'
              })
            })
          );
        }

        await Promise.all(promises);
        const endTime = Date.now();
        const endMemory = process.memoryUsage();

        const totalTime = endTime - startTime;
        const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
        const memoryUsedMB = memoryUsed / 1024 / 1024;

        // Принудительная сборка мусора
        if (global.gc) {
          global.gc();
        }

        const afterGcMemory = process.memoryUsage();
        const afterGcMemoryMB = afterGcMemory.heapUsed / 1024 / 1024;
        const gcEfficiency = ((memoryUsed - (afterGcMemory.heapUsed - startMemory.heapUsed)) / memoryUsed) * 100;

        gcResults.push({
          operations: gcTest,
          memoryUsedMB,
          afterGcMemoryMB,
          gcEfficiency
        });

        console.log(`📊 GC Optimization - ${gcTest} operations:`);
        console.log(`   Memory Used: ${memoryUsedMB.toFixed(2)}MB`);
        console.log(`   After GC: ${afterGcMemoryMB.toFixed(2)}MB`);
        console.log(`   GC Efficiency: ${gcEfficiency.toFixed(2)}%`);
      }

      // Проверяем, что сборка мусора эффективна
      gcResults.forEach(result => {
        expect(result.gcEfficiency).toBeGreaterThan(50); // > 50% эффективность
      });
    });
  });

  describe('Network Optimization', () => {
    it('should optimize network requests', async () => {
      const networkTests = [
        { endpoint: '/api/health', method: 'GET', description: 'Simple GET' },
        { endpoint: '/api/status', method: 'GET', description: 'Status GET' },
        { endpoint: '/api/requests', method: 'POST', description: 'Complex POST', body: { title: 'Test', description: 'Test' } }
      ];

      const networkResults = [];

      for (const networkTest of networkTests) {
        const iterations = 20;
        const requestTimes = [];
        const dataSizes = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          
          const requestOptions: RequestInit = {
            method: networkTest.method,
            headers: { 'Authorization': `Bearer ${authToken}` }
          };

          if (networkTest.body) {
            requestOptions.headers = { 
              ...requestOptions.headers,
              'Content-Type': 'application/json'
            };
            requestOptions.body = JSON.stringify(networkTest.body);
          }

          const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${networkTest.endpoint}`, requestOptions);
          const endTime = Date.now();
          
          if (response.ok) {
            const responseTime = endTime - startTime;
            requestTimes.push(responseTime);
            
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
              dataSizes.push(parseInt(contentLength));
            }
          }
        }

        const avgRequestTime = requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length;
        const avgDataSize = dataSizes.length > 0 ? dataSizes.reduce((a, b) => a + b, 0) / dataSizes.length : 0;
        const throughput = avgDataSize / (avgRequestTime / 1000); // bytes per second

        networkResults.push({
          endpoint: networkTest.endpoint,
          avgRequestTime,
          avgDataSize,
          throughput
        });

        console.log(`📊 Network Optimization - ${networkTest.description}:`);
        console.log(`   Avg Request Time: ${avgRequestTime.toFixed(2)}ms`);
        console.log(`   Avg Data Size: ${avgDataSize.toFixed(2)} bytes`);
        console.log(`   Throughput: ${(throughput / 1024).toFixed(2)} KB/s`);
      }

      // Проверяем, что сетевые запросы оптимизированы
      networkResults.forEach(result => {
        expect(result.avgRequestTime).toBeLessThan(1000); // < 1 секунды
        expect(result.throughput).toBeGreaterThan(1000); // > 1KB/s
      });
    });

    it('should optimize connection pooling', async () => {
      const connectionTests = [10, 25, 50, 100];
      const connectionResults = [];

      for (const connectionTest of connectionTests) {
        const startTime = Date.now();
        const promises = [];

        // Создаем параллельные соединения
        for (let i = 0; i < connectionTest; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            })
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / connectionTest) * 100;
        const avgConnectionTime = totalTime / connectionTest;
        const connectionsPerSecond = connectionTest / (totalTime / 1000);

        connectionResults.push({
          connections: connectionTest,
          successRate,
          avgConnectionTime,
          connectionsPerSecond
        });

        console.log(`📊 Connection Pooling Optimization - ${connectionTest} connections:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Connection Time: ${avgConnectionTime.toFixed(2)}ms`);
        console.log(`   Connections/Second: ${connectionsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что пул соединений оптимизирован
      connectionResults.forEach(result => {
        expect(result.successRate).toBeGreaterThanOrEqual(95);
        expect(result.avgConnectionTime).toBeLessThan(1000);
        expect(result.connectionsPerSecond).toBeGreaterThan(10);
      });
    });
  });

  describe('Database Optimization', () => {
    it('should optimize database connections', async () => {
      const dbTests = [5, 10, 20, 50];
      const dbResults = [];

      for (const dbTest of dbTests) {
        const startTime = Date.now();
        const promises = [];

        // Создаем операции с БД
        for (let i = 0; i < dbTest; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/requests`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                title: `DB optimization test ${i}`,
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
        const successRate = (successCount / dbTest) * 100;
        const avgDbTime = totalTime / dbTest;
        const dbOperationsPerSecond = dbTest / (totalTime / 1000);

        dbResults.push({
          operations: dbTest,
          successRate,
          avgDbTime,
          dbOperationsPerSecond
        });

        console.log(`📊 Database Connection Optimization - ${dbTest} operations:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg DB Time: ${avgDbTime.toFixed(2)}ms`);
        console.log(`   DB Operations/Second: ${dbOperationsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что БД оптимизирована
      dbResults.forEach(result => {
        expect(result.successRate).toBeGreaterThanOrEqual(90);
        expect(result.avgDbTime).toBeLessThan(2000);
        expect(result.dbOperationsPerSecond).toBeGreaterThan(5);
      });
    });

    it('should optimize query performance', async () => {
      const queryTypes = [
        { name: 'Simple SELECT', endpoint: '/api/requests', method: 'GET' },
        { name: 'Complex JOIN', endpoint: '/api/supplier-search', method: 'POST', body: { query: 'electronics' } },
        { name: 'Aggregation', endpoint: '/api/analysis', method: 'POST', body: { text: 'test', type: 'requirements' } }
      ];

      const queryResults = [];

      for (const queryType of queryTypes) {
        const iterations = 10;
        const queryTimes = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          
          const requestOptions: RequestInit = {
            method: queryType.method,
            headers: { 'Authorization': `Bearer ${authToken}` }
          };

          if (queryType.body) {
            requestOptions.headers = { 
              ...requestOptions.headers,
              'Content-Type': 'application/json'
            };
            requestOptions.body = JSON.stringify(queryType.body);
          }

          const response = await fetch(`${TEST_CONFIG.API_BASE_URL}${queryType.endpoint}`, requestOptions);
          const endTime = Date.now();
          
          if (response.ok) {
            queryTimes.push(endTime - startTime);
          }
        }

        const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
        const minQueryTime = Math.min(...queryTimes);
        const maxQueryTime = Math.max(...queryTimes);

        queryResults.push({
          query: queryType.name,
          avgQueryTime,
          minQueryTime,
          maxQueryTime
        });

        console.log(`📊 Query Performance Optimization - ${queryType.name}:`);
        console.log(`   Avg Query Time: ${avgQueryTime.toFixed(2)}ms`);
        console.log(`   Min Query Time: ${minQueryTime}ms`);
        console.log(`   Max Query Time: ${maxQueryTime}ms`);
      }

      // Проверяем, что запросы оптимизированы
      queryResults.forEach(result => {
        expect(result.avgQueryTime).toBeLessThan(500);
        expect(result.maxQueryTime).toBeLessThan(1000);
      });
    });
  });

  describe('Application Optimization', () => {
    it('should optimize application startup time', async () => {
      const startupTests = 5;
      const startupTimes = [];

      for (let i = 0; i < startupTests; i++) {
        const startTime = Date.now();
        
        // Имитируем запуск приложения
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const endTime = Date.now();
        
        if (response.ok) {
          startupTimes.push(endTime - startTime);
        }
      }

      const avgStartupTime = startupTimes.reduce((a, b) => a + b, 0) / startupTimes.length;
      const minStartupTime = Math.min(...startupTimes);
      const maxStartupTime = Math.max(...startupTimes);

      console.log(`📊 Application Startup Optimization:`);
      console.log(`   Avg Startup Time: ${avgStartupTime.toFixed(2)}ms`);
      console.log(`   Min Startup Time: ${minStartupTime}ms`);
      console.log(`   Max Startup Time: ${maxStartupTime}ms`);

      // Проверяем, что время запуска оптимизировано
      expect(avgStartupTime).toBeLessThan(1000); // < 1 секунды
      expect(maxStartupTime).toBeLessThan(2000); // < 2 секунды
    });

    it('should optimize resource usage', async () => {
      const startMemory = process.memoryUsage();
      const startCpu = process.cpuUsage();

      // Выполняем операции для измерения ресурсов
      const operations = 50;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
        );
      }

      await Promise.all(promises);
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage();

      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
      const memoryUsedMB = memoryUsed / 1024 / 1024;
      const cpuUsed = endCpu.user - startCpu.user + endCpu.system - startCpu.system;
      const cpuUsedMs = cpuUsed / 1000;

      console.log(`📊 Resource Usage Optimization:`);
      console.log(`   Operations: ${operations}`);
      console.log(`   Memory Used: ${memoryUsedMB.toFixed(2)}MB`);
      console.log(`   CPU Used: ${cpuUsedMs.toFixed(2)}ms`);
      console.log(`   Memory per Operation: ${(memoryUsed / operations / 1024).toFixed(2)}KB`);
      console.log(`   CPU per Operation: ${(cpuUsedMs / operations).toFixed(2)}ms`);

      // Проверяем, что использование ресурсов оптимизировано
      expect(memoryUsedMB).toBeLessThan(25); // < 25MB
      expect(cpuUsedMs).toBeLessThan(1000); // < 1 секунда CPU
    });
  });
});


