import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';
import { TestHelpers } from '../../utils/test-helpers';

// Моки для OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
};

vi.mock('openai', () => ({
  OpenAI: vi.fn(() => mockOpenAI)
}));

describe('OpenAI Integration Tests', () => {
  let authToken: string;
  let userId: number;

  beforeEach(async () => {
    await setupTestEnvironment();
    const session = await TestHelpers.createTestSession();
    authToken = session.token;
    userId = session.user.id;
    
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Text Analysis', () => {
    it('should analyze requirements text', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                requirements: ['ISO 9001', 'Quality control', 'Fast delivery'],
                keywords: ['electronics', 'manufacturing', 'certification'],
                confidence: 0.95
              })
            }
          }
        ]
      });

      const analysisData = {
        text: 'We need electronics suppliers with ISO 9001 certification and fast delivery',
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
      const result = await response.json();
      expect(result.requirements).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.confidence).toBeDefined();
    });

    it('should analyze supplier offers', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                analysis: 'High-quality electronics supplier with competitive pricing',
                keywords: ['electronics', 'quality', 'competitive'],
                confidence: 0.88
              })
            }
          }
        ]
      });

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
      const result = await response.json();
      expect(result.analysis).toBeDefined();
      expect(result.keywords).toBeDefined();
    });

    it('should handle large text inputs', async () => {
      const largeText = 'A'.repeat(50000); // Большой текст
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                requirements: ['Large document analysis'],
                keywords: ['analysis', 'document'],
                confidence: 0.75
              })
            }
          }
        ]
      });

      const analysisData = {
        text: largeText,
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
    });

    it('should handle empty text input', async () => {
      const analysisData = {
        text: '',
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
  });

  describe('Parameter Extraction', () => {
    it('should extract parameters from supplier response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                extractedParameters: [
                  {
                    parameter: 'price',
                    value: '$1000',
                    confidence: 0.95,
                    section: 'pricing'
                  },
                  {
                    parameter: 'delivery',
                    value: '2-4 weeks',
                    confidence: 0.88,
                    section: 'delivery'
                  }
                ]
              })
            }
          }
        ]
      });

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
      const result = await response.json();
      expect(result.extractedParameters).toBeDefined();
      expect(Array.isArray(result.extractedParameters)).toBe(true);
    });

    it('should handle extraction without AI', async () => {
      const extractData = {
        responseId: 1,
        parameters: ['price', 'delivery'],
        useAI: false
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
    });
  });

  describe('Semantic Analysis', () => {
    it('should perform semantic block analysis', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                semanticEssence: {
                  coreFunction: 'electronics manufacturing',
                  semanticDescription: 'High-quality electronics production',
                  keyProcesses: ['assembly', 'testing', 'quality control'],
                  criticalParams: {
                    'ISO certification': 'required',
                    'delivery time': '2-4 weeks'
                  },
                  dependencies: ['raw materials', 'testing equipment'],
                  exclusions: ['defective products'],
                  keyRequirements: ['ISO 9001', 'quality control']
                }
              })
            }
          }
        ]
      });

      const semanticData = {
        projectId: 1,
        content: 'Electronics manufacturing with ISO 9001 certification',
        blockTitle: 'Technical Specifications'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/semantic/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(semanticData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.semanticEssence).toBeDefined();
      expect(result.semanticEssence.coreFunction).toBeDefined();
    });

    it('should handle semantic analysis errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

      const semanticData = {
        projectId: 1,
        content: 'Test content',
        blockTitle: 'Test Block'
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/semantic/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(semanticData)
      });

      expect(response.status).toBe(500);
    });
  });

  describe('AI Rate Limiting', () => {
    it('should handle OpenAI rate limits', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Rate limit exceeded'));

      const analysisData = {
        text: 'Test text for analysis',
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

      expect(response.status).toBe(429);
    });

    it('should retry on temporary failures', async () => {
      let callCount = 0;
      mockOpenAI.chat.completions.create.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  requirements: ['Test requirement'],
                  keywords: ['test'],
                  confidence: 0.8
                })
              }
            }
          ]
        });
      });

      const analysisData = {
        text: 'Test text for analysis',
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
      expect(callCount).toBe(3);
    });
  });

  describe('AI Configuration', () => {
    it('should use different AI models for different tasks', async () => {
      const requirementsData = {
        text: 'We need electronics suppliers',
        type: 'requirements'
      };

      const offersData = {
        text: 'We offer high-quality electronics',
        type: 'offers'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                requirements: ['electronics'],
                keywords: ['suppliers'],
                confidence: 0.9
              })
            }
          }
        ]
      });

      // Анализ требований
      const requirementsResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(requirementsData)
      });

      // Анализ предложений
      const offersResponse = await fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(offersData)
      });

      expect(requirementsResponse.status).toBe(200);
      expect(offersResponse.status).toBe(200);
    });

    it('should handle AI model selection', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                model: 'gpt-4',
                analysis: 'Advanced analysis result'
              })
            }
          }
        ]
      });

      const analysisData = {
        text: 'Complex technical requirements',
        type: 'requirements',
        model: 'gpt-4'
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
    });
  });

  describe('AI Performance', () => {
    it('should handle concurrent AI requests', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                requirements: ['Test requirement'],
                keywords: ['test'],
                confidence: 0.8
              })
            }
          }
        ]
      });

      const requests = Array.from({ length: 5 }, (_, i) => ({
        text: `Test text ${i}`,
        type: 'requirements'
      }));

      const promises = requests.map(data =>
        fetch(`${TEST_CONFIG.API_BASE_URL}/api/analyze`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(data)
        })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle AI timeout', async () => {
      mockOpenAI.chat.completions.create.mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 30000);
        })
      );

      const analysisData = {
        text: 'Test text for analysis',
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

      expect(response.status).toBe(408);
    });
  });
});


