import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';
import { TestHelpers } from '../../utils/test-helpers';

describe('Analysis API Tests', () => {
  let authToken: string;
  let userId: number;

  beforeEach(async () => {
    await setupTestEnvironment();
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    userId = session.user.id;
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('POST /api/compare', () => {
    it('should compare suppliers with valid data', async () => {
      const compareData = {
        suppliers: [
          {
            id: 1,
            name: 'Supplier 1',
            email: 'supplier1@test.com',
            rating: 4.5
          },
          {
            id: 2,
            name: 'Supplier 2',
            email: 'supplier2@test.com',
            rating: 4.2
          }
        ],
        parameters: ['price', 'quality', 'delivery'],
        requestId: 1
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/compare`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(compareData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.comparison).toBeDefined();
      expect(data.suppliers).toBeDefined();
      expect(Array.isArray(data.suppliers)).toBe(true);
    });

    it('should reject comparison without suppliers', async () => {
      const compareData = {
        parameters: ['price', 'quality'],
        requestId: 1
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/compare`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(compareData)
      });

      expect(response.status).toBe(400);
    });

    it('should reject comparison without parameters', async () => {
      const compareData = {
        suppliers: [
          { id: 1, name: 'Supplier 1' }
        ],
        requestId: 1
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/compare`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(compareData)
      });

      expect(response.status).toBe(400);
    });

    it('should handle empty suppliers array', async () => {
      const compareData = {
        suppliers: [],
        parameters: ['price', 'quality'],
        requestId: 1
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/compare`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(compareData)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/compare-fixed', () => {
    it('should perform fixed comparison', async () => {
      const compareData = {
        suppliers: [
          {
            id: 1,
            name: 'Supplier 1',
            email: 'supplier1@test.com',
            rating: 4.5,
            price: 1000,
            quality: 'high',
            delivery: 'fast'
          },
          {
            id: 2,
            name: 'Supplier 2',
            email: 'supplier2@test.com',
            rating: 4.2,
            price: 1200,
            quality: 'medium',
            delivery: 'medium'
          }
        ],
        parameters: ['price', 'quality', 'delivery'],
        requestId: 1
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/compare-fixed`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(compareData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.comparison).toBeDefined();
      expect(data.suppliers).toBeDefined();
    });

    it('should handle large number of suppliers', async () => {
      const suppliers = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Supplier ${i + 1}`,
        email: `supplier${i + 1}@test.com`,
        rating: 4.0 + Math.random() * 0.5,
        price: 1000 + Math.random() * 500,
        quality: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        delivery: ['slow', 'medium', 'fast'][Math.floor(Math.random() * 3)]
      }));

      const compareData = {
        suppliers,
        parameters: ['price', 'quality', 'delivery'],
        requestId: 1
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/compare-fixed`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(compareData)
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/analyze', () => {
    it('should analyze requirements', async () => {
      const analysisData = {
        text: 'We need electronics suppliers with ISO certification and fast delivery',
        type: 'requirements'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(analysisData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analysis).toBeDefined();
      expect(data.keywords).toBeDefined();
      expect(Array.isArray(data.keywords)).toBe(true);
    });

    it('should analyze offers', async () => {
      const analysisData = {
        text: 'We offer high-quality electronics with competitive pricing and fast delivery',
        type: 'offers'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(analysisData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analysis).toBeDefined();
    });

    it('should reject analysis without text', async () => {
      const analysisData = {
        type: 'requirements'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(analysisData)
      });

      expect(response.status).toBe(400);
    });

    it('should handle different analysis types', async () => {
      const types = ['requirements', 'offers', 'compliance'];
      
      for (const type of types) {
        const analysisData = {
          text: 'Test analysis text',
          type
        };

        const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(analysisData)
        });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('GET /api/analysis-projects', () => {
    it('should get analysis projects', async () => {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analysis-projects`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should create new analysis project', async () => {
      const projectData = {
        name: 'Test Analysis Project',
        description: 'Test project description',
        type: 'technical'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analysis-projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(projectData)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe(projectData.name);
      expect(data.id).toBeDefined();
    });
  });

  describe('POST /api/extract-parameters', () => {
    it('should extract parameters from response', async () => {
      const extractData = {
        responseId: 1,
        parameters: ['price', 'delivery', 'quality'],
        useAI: true
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/extract-parameters`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(extractData)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.extractedParameters).toBeDefined();
      expect(Array.isArray(data.extractedParameters)).toBe(true);
    });

    it('should reject extraction without responseId', async () => {
      const extractData = {
        parameters: ['price', 'delivery'],
        useAI: true
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/extract-parameters`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(extractData)
      });

      expect(response.status).toBe(400);
    });
  });
});


