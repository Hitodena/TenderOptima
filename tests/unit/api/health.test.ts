import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';

describe('API Health Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  it('should return health status', async () => {
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.version).toBe('1.0.0');
  });

  it('should return server status', async () => {
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/status`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('running');
    expect(data.timestamp).toBeDefined();
  });

  it('should handle CORS headers', async () => {
    const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/health`, {
      method: 'OPTIONS'
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
  });
});


