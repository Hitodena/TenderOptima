import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../setup/test-environment';
import { TestHelpers } from '../utils/test-helpers';

describe('Resource Monitoring Tests', () => {
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

  describe('Memory Monitoring', () => {
    it('should monitor memory usage patterns', async () => {
      const monitoringDuration = 30000; // 30 секунд
      const checkInterval = 1000; // 1 секунда
      const memoryReadings = [];
      const startTime = Date.now();

      console.log('📊 Starting memory monitoring...');

      while (Date.now() - startTime < monitoringDuration) {
        const currentMemory = process.memoryUsage();
        const timestamp = Date.now() - startTime;
        
        memoryReadings.push({
          timestamp,
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          external: currentMemory.external,
          rss: currentMemory.rss
        });

        // Выполняем операции для создания нагрузки
        if (timestamp % 5000 < 1000) { // Каждые 5 секунд
          const promises = [];
          for (let i = 0; i < 10; i++) {
            promises.push(
              fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
              })
            );
          }
          await Promise.all(promises);
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      // Анализируем данные мониторинга
      const heapUsedReadings = memoryReadings.map(r => r.heapUsed);
      const maxMemory = Math.max(...heapUsedReadings);
      const minMemory = Math.min(...heapUsedReadings);
      const avgMemory = heapUsedReadings.reduce((a, b) => a + b, 0) / heapUsedReadings.length;
      const memoryVariance = Math.max(...heapUsedReadings) - Math.min(...heapUsedReadings);

      console.log(`📊 Memory Monitoring Results:`);
      console.log(`   Duration: ${monitoringDuration}ms`);
      console.log(`   Readings: ${memoryReadings.length}`);
      console.log(`   Max Memory: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Min Memory: ${(minMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Avg Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory Variance: ${(memoryVariance / 1024 / 1024).toFixed(2)}MB`);

      // Проверяем, что использование памяти стабильно
      expect(maxMemory).toBeLessThan(500 * 1024 * 1024); // < 500MB
      expect(memoryVariance).toBeLessThan(100 * 1024 * 1024); // < 100MB variance
    });

    it('should detect memory leaks', async () => {
      const leakTestDuration = 20000; // 20 секунд
      const operationsPerSecond = 5;
      const totalOperations = (leakTestDuration / 1000) * operationsPerSecond;
      
      const startMemory = process.memoryUsage();
      const memoryReadings = [];
      const startTime = Date.now();

      console.log('📊 Starting memory leak detection...');

      for (let i = 0; i < totalOperations; i++) {
        // Выполняем операции, которые могут вызвать утечки
        const promises = [];
        for (let j = 0; j < 3; j++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                text: `Memory leak test ${i}-${j}`.repeat(100),
                type: 'requirements'
              })
            })
          );
        }

        await Promise.all(promises);
        
        // Записываем использование памяти
        const currentMemory = process.memoryUsage();
        memoryReadings.push({
          operation: i,
          heapUsed: currentMemory.heapUsed,
          timestamp: Date.now() - startTime
        });

        // Принудительная сборка мусора каждые 10 операций
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }

        await new Promise(resolve => setTimeout(resolve, 1000 / operationsPerSecond));
      }

      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // Анализируем тренд использования памяти
      const firstHalf = memoryReadings.slice(0, Math.floor(memoryReadings.length / 2));
      const secondHalf = memoryReadings.slice(Math.floor(memoryReadings.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b.heapUsed, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b.heapUsed, 0) / secondHalf.length;
      const memoryTrend = secondHalfAvg - firstHalfAvg;

      console.log(`📊 Memory Leak Detection Results:`);
      console.log(`   Total Operations: ${totalOperations}`);
      console.log(`   Memory Increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      console.log(`   Memory Trend: ${(memoryTrend / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory per Operation: ${(memoryIncreaseMB / totalOperations).toFixed(4)}MB`);

      // Проверяем, что утечек памяти нет
      expect(memoryIncreaseMB).toBeLessThan(100); // < 100MB increase
      expect(memoryTrend).toBeLessThan(50 * 1024 * 1024); // < 50MB trend
    });
  });

  describe('CPU Monitoring', () => {
    it('should monitor CPU usage patterns', async () => {
      const monitoringDuration = 20000; // 20 секунд
      const checkInterval = 2000; // 2 секунды
      const cpuReadings = [];
      const startTime = Date.now();

      console.log('📊 Starting CPU monitoring...');

      while (Date.now() - startTime < monitoringDuration) {
        const currentCpu = process.cpuUsage();
        const timestamp = Date.now() - startTime;
        
        cpuReadings.push({
          timestamp,
          user: currentCpu.user,
          system: currentCpu.system
        });

        // Создаем CPU нагрузку
        if (timestamp % 5000 < 2000) { // Каждые 5 секунд на 2 секунды
          const promises = [];
          for (let i = 0; i < 20; i++) {
            promises.push(
              fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                  text: `CPU test ${i}`.repeat(50),
                  type: 'requirements'
                })
              })
            );
          }
          await Promise.all(promises);
        }

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      // Анализируем данные CPU
      const userCpuReadings = cpuReadings.map(r => r.user);
      const systemCpuReadings = cpuReadings.map(r => r.system);
      
      const maxUserCpu = Math.max(...userCpuReadings);
      const maxSystemCpu = Math.max(...systemCpuReadings);
      const avgUserCpu = userCpuReadings.reduce((a, b) => a + b, 0) / userCpuReadings.length;
      const avgSystemCpu = systemCpuReadings.reduce((a, b) => a + b, 0) / systemCpuReadings.length;

      console.log(`📊 CPU Monitoring Results:`);
      console.log(`   Duration: ${monitoringDuration}ms`);
      console.log(`   Readings: ${cpuReadings.length}`);
      console.log(`   Max User CPU: ${(maxUserCpu / 1000).toFixed(2)}ms`);
      console.log(`   Max System CPU: ${(maxSystemCpu / 1000).toFixed(2)}ms`);
      console.log(`   Avg User CPU: ${(avgUserCpu / 1000).toFixed(2)}ms`);
      console.log(`   Avg System CPU: ${(avgSystemCpu / 1000).toFixed(2)}ms`);

      // Проверяем, что CPU использование разумно
      expect(maxUserCpu).toBeLessThan(10000 * 1000); // < 10 секунд
      expect(maxSystemCpu).toBeLessThan(5000 * 1000); // < 5 секунд
    });

    it('should monitor CPU under load', async () => {
      const loadDuration = 15000; // 15 секунд
      const startCpu = process.cpuUsage();
      const startTime = Date.now();

      console.log('📊 Starting CPU load monitoring...');

      // Создаем постоянную нагрузку
      const loadPromises = [];
      for (let i = 0; i < 50; i++) {
        loadPromises.push(
          fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              text: `CPU load test ${i}`.repeat(200),
              type: 'requirements'
            })
          })
        );
      }

      await Promise.all(loadPromises);
      const endTime = Date.now();
      const endCpu = process.cpuUsage();

      const totalTime = endTime - startTime;
      const totalCpu = (endCpu.user - startCpu.user) + (endCpu.system - startCpu.system);
      const cpuUsagePercent = (totalCpu / (totalTime * 1000)) * 100;

      console.log(`📊 CPU Load Monitoring Results:`);
      console.log(`   Load Duration: ${totalTime}ms`);
      console.log(`   Total CPU Time: ${(totalCpu / 1000).toFixed(2)}ms`);
      console.log(`   CPU Usage: ${cpuUsagePercent.toFixed(2)}%`);

      // Проверяем, что CPU использование эффективно
      expect(cpuUsagePercent).toBeLessThan(80); // < 80% CPU usage
      expect(totalCpu).toBeLessThan(totalTime * 1000 * 0.8); // < 80% of total time
    });
  });

  describe('Network Monitoring', () => {
    it('should monitor network throughput', async () => {
      const throughputTests = [10, 25, 50, 100];
      const throughputResults = [];

      for (const testSize of throughputTests) {
        const startTime = Date.now();
        const promises = [];

        // Создаем сетевые запросы
        for (let i = 0; i < testSize; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/supplier-search`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                query: `Network throughput test ${i}`.repeat(50),
                maxResults: 20
              })
            })
          );
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / testSize) * 100;
        const throughput = testSize / (totalTime / 1000); // requests per second
        const avgResponseTime = totalTime / testSize;

        throughputResults.push({
          testSize,
          successRate,
          throughput,
          avgResponseTime
        });

        console.log(`📊 Network Throughput Test - ${testSize} requests:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Throughput: ${throughput.toFixed(2)} req/s`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      }

      // Проверяем, что пропускная способность сети стабильна
      throughputResults.forEach(result => {
        expect(result.successRate).toBeGreaterThanOrEqual(90);
        expect(result.throughput).toBeGreaterThan(5);
        expect(result.avgResponseTime).toBeLessThan(2000);
      });
    });

    it('should monitor network latency', async () => {
      const latencyTests = 50;
      const latencyReadings = [];

      console.log('📊 Starting network latency monitoring...');

      for (let i = 0; i < latencyTests; i++) {
        const startTime = Date.now();
        
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const endTime = Date.now();
        const latency = endTime - startTime;

        if (response.ok) {
          latencyReadings.push(latency);
        }

        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Анализируем задержки
      const avgLatency = latencyReadings.reduce((a, b) => a + b, 0) / latencyReadings.length;
      const minLatency = Math.min(...latencyReadings);
      const maxLatency = Math.max(...latencyReadings);
      const p95Latency = latencyReadings.sort((a, b) => a - b)[Math.floor(latencyReadings.length * 0.95)];
      const p99Latency = latencyReadings.sort((a, b) => a - b)[Math.floor(latencyReadings.length * 0.99)];

      console.log(`📊 Network Latency Monitoring Results:`);
      console.log(`   Tests: ${latencyTests}`);
      console.log(`   Avg Latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Min Latency: ${minLatency}ms`);
      console.log(`   Max Latency: ${maxLatency}ms`);
      console.log(`   P95 Latency: ${p95Latency}ms`);
      console.log(`   P99 Latency: ${p99Latency}ms`);

      // Проверяем, что задержки приемлемы
      expect(avgLatency).toBeLessThan(500); // < 500ms average
      expect(p95Latency).toBeLessThan(1000); // < 1s P95
      expect(p99Latency).toBeLessThan(2000); // < 2s P99
    });
  });

  describe('Database Monitoring', () => {
    it('should monitor database connection pool', async () => {
      const connectionTests = [10, 25, 50, 100];
      const connectionResults = [];

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
                title: `DB monitoring test ${i}`,
                description: `Database connection monitoring ${i}`,
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
        const avgConnectionTime = totalTime / connectionCount;
        const connectionsPerSecond = connectionCount / (totalTime / 1000);

        connectionResults.push({
          connectionCount,
          successRate,
          avgConnectionTime,
          connectionsPerSecond
        });

        console.log(`📊 Database Connection Pool Monitoring - ${connectionCount} connections:`);
        console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`   Avg Connection Time: ${avgConnectionTime.toFixed(2)}ms`);
        console.log(`   Connections/Second: ${connectionsPerSecond.toFixed(2)}`);
      }

      // Проверяем, что пул соединений работает эффективно
      connectionResults.forEach(result => {
        expect(result.successRate).toBeGreaterThanOrEqual(90);
        expect(result.avgConnectionTime).toBeLessThan(2000);
        expect(result.connectionsPerSecond).toBeGreaterThan(5);
      });
    });

    it('should monitor database query performance', async () => {
      const queryTypes = [
        { name: 'Simple SELECT', endpoint: '/api/requests', method: 'GET' },
        { name: 'Complex JOIN', endpoint: '/api/supplier-search', method: 'POST', body: { query: 'electronics' } },
        { name: 'Aggregation', endpoint: '/api/analysis', method: 'POST', body: { text: 'test', type: 'requirements' } }
      ];

      const queryResults = [];

      for (const queryType of queryTypes) {
        const iterations = 20;
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
        const p95QueryTime = queryTimes.sort((a, b) => a - b)[Math.floor(queryTimes.length * 0.95)];

        queryResults.push({
          query: queryType.name,
          avgQueryTime,
          minQueryTime,
          maxQueryTime,
          p95QueryTime
        });

        console.log(`📊 Database Query Performance Monitoring - ${queryType.name}:`);
        console.log(`   Avg Query Time: ${avgQueryTime.toFixed(2)}ms`);
        console.log(`   Min Query Time: ${minQueryTime}ms`);
        console.log(`   Max Query Time: ${maxQueryTime}ms`);
        console.log(`   P95 Query Time: ${p95QueryTime}ms`);
      }

      // Проверяем, что запросы к БД оптимизированы
      queryResults.forEach(result => {
        expect(result.avgQueryTime).toBeLessThan(500);
        expect(result.p95QueryTime).toBeLessThan(1000);
      });
    });
  });

  describe('Application Monitoring', () => {
    it('should monitor application health', async () => {
      const healthChecks = 100;
      const healthResults = [];

      console.log('📊 Starting application health monitoring...');

      for (let i = 0; i < healthChecks; i++) {
        const startTime = Date.now();
        
        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        healthResults.push({
          check: i,
          status: response.status,
          responseTime,
          timestamp: Date.now()
        });

        // Небольшая задержка между проверками
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Анализируем результаты
      const successCount = healthResults.filter(r => r.status === 200).length;
      const successRate = (successCount / healthChecks) * 100;
      const avgResponseTime = healthResults.reduce((a, b) => a + b.responseTime, 0) / healthResults.length;
      const maxResponseTime = Math.max(...healthResults.map(r => r.responseTime));
      const minResponseTime = Math.min(...healthResults.map(r => r.responseTime));

      console.log(`📊 Application Health Monitoring Results:`);
      console.log(`   Health Checks: ${healthChecks}`);
      console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Min Response Time: ${minResponseTime}ms`);
      console.log(`   Max Response Time: ${maxResponseTime}ms`);

      // Проверяем, что приложение здорово
      expect(successRate).toBeGreaterThanOrEqual(95);
      expect(avgResponseTime).toBeLessThan(1000);
      expect(maxResponseTime).toBeLessThan(2000);
    });

    it('should monitor application performance trends', async () => {
      const trendDuration = 30000; // 30 секунд
      const checkInterval = 2000; // 2 секунды
      const performanceReadings = [];
      const startTime = Date.now();

      console.log('📊 Starting application performance trend monitoring...');

      while (Date.now() - startTime < trendDuration) {
        const iterationStart = Date.now();
        
        // Выполняем набор операций
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            })
          );
        }

        const results = await Promise.all(promises);
        const iterationEnd = Date.now();
        const iterationTime = iterationEnd - iterationStart;

        const successCount = results.filter(r => r.ok).length;
        const successRate = (successCount / 10) * 100;

        performanceReadings.push({
          timestamp: Date.now() - startTime,
          iterationTime,
          successRate,
          memory: process.memoryUsage().heapUsed
        });

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      // Анализируем тренды
      const iterationTimes = performanceReadings.map(r => r.iterationTime);
      const successRates = performanceReadings.map(r => r.successRate);
      const memoryReadings = performanceReadings.map(r => r.memory);

      const avgIterationTime = iterationTimes.reduce((a, b) => a + b, 0) / iterationTimes.length;
      const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
      const avgMemory = memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length;

      // Проверяем стабильность трендов
      const firstHalf = performanceReadings.slice(0, Math.floor(performanceReadings.length / 2));
      const secondHalf = performanceReadings.slice(Math.floor(performanceReadings.length / 2));

      const firstHalfAvgTime = firstHalf.reduce((a, b) => a + b.iterationTime, 0) / firstHalf.length;
      const secondHalfAvgTime = secondHalf.reduce((a, b) => a + b.iterationTime, 0) / secondHalf.length;
      const performanceTrend = secondHalfAvgTime - firstHalfAvgTime;

      console.log(`📊 Application Performance Trend Results:`);
      console.log(`   Duration: ${trendDuration}ms`);
      console.log(`   Readings: ${performanceReadings.length}`);
      console.log(`   Avg Iteration Time: ${avgIterationTime.toFixed(2)}ms`);
      console.log(`   Avg Success Rate: ${avgSuccessRate.toFixed(2)}%`);
      console.log(`   Avg Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Performance Trend: ${performanceTrend.toFixed(2)}ms`);

      // Проверяем, что производительность стабильна
      expect(avgSuccessRate).toBeGreaterThanOrEqual(95);
      expect(avgIterationTime).toBeLessThan(2000);
      expect(Math.abs(performanceTrend)).toBeLessThan(1000); // Тренд не более 1 секунды
    });
  });
});


