import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupplierOfferAnalyzer } from '../../../server/services/supplierOfferAnalyzer';

// Моки для внешних зависимостей
vi.mock('../../../server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mock-hash')
  }))
}));

describe('SupplierOfferAnalyzer Service', () => {
  let analyzer: SupplierOfferAnalyzer;

  beforeEach(() => {
    analyzer = new SupplierOfferAnalyzer();
    vi.clearAllMocks();
  });

  describe('analyzeSupplierOffer', () => {
    it('should analyze supplier offer with valid data', async () => {
      const projectId = 1;
      const supplierId = 1;
      const supplierOfferText = 'We offer high-quality electronics with ISO certification and fast delivery';
      const technicalRequirements = [
        {
          id: 1,
          tech_spec_number: 'TS-001',
          extracted_value: 'ISO 9001 certification required'
        },
        {
          id: 2,
          tech_spec_number: 'TS-002',
          extracted_value: 'Delivery time: 2-4 weeks'
        }
      ];

      const result = await analyzer.analyzeSupplierOffer(
        projectId,
        supplierId,
        supplierOfferText,
        technicalRequirements
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty supplier offer text', async () => {
      const projectId = 1;
      const supplierId = 1;
      const supplierOfferText = '';
      const technicalRequirements = [];

      const result = await analyzer.analyzeSupplierOffer(
        projectId,
        supplierId,
        supplierOfferText,
        technicalRequirements
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle large supplier offer text', async () => {
      const projectId = 1;
      const supplierId = 1;
      const supplierOfferText = 'A'.repeat(50000); // Большой текст
      const technicalRequirements = [
        {
          id: 1,
          tech_spec_number: 'TS-001',
          extracted_value: 'Test requirement'
        }
      ];

      const result = await analyzer.analyzeSupplierOffer(
        projectId,
        supplierId,
        supplierOfferText,
        technicalRequirements
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle multiple technical requirements', async () => {
      const projectId = 1;
      const supplierId = 1;
      const supplierOfferText = 'We offer comprehensive electronics solutions';
      const technicalRequirements = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        tech_spec_number: `TS-${String(i + 1).padStart(3, '0')}`,
        extracted_value: `Requirement ${i + 1}`
      }));

      const result = await analyzer.analyzeSupplierOffer(
        projectId,
        supplierId,
        supplierOfferText,
        technicalRequirements
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const projectId = 1;
      const supplierId = 1;
      const supplierOfferText = 'Test offer';
      const technicalRequirements = [
        {
          id: 1,
          tech_spec_number: 'TS-001',
          extracted_value: 'Test requirement'
        }
      ];

      // Мокаем ошибку базы данных
      const { db } = await import('../../../server/db');
      vi.mocked(db.select).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        analyzer.analyzeSupplierOffer(projectId, supplierId, supplierOfferText, technicalRequirements)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid project ID', async () => {
      const projectId = -1;
      const supplierId = 1;
      const supplierOfferText = 'Test offer';
      const technicalRequirements = [];

      const result = await analyzer.analyzeSupplierOffer(
        projectId,
        supplierId,
        supplierOfferText,
        technicalRequirements
      );

      expect(result).toBeDefined();
    });

    it('should handle invalid supplier ID', async () => {
      const projectId = 1;
      const supplierId = -1;
      const supplierOfferText = 'Test offer';
      const technicalRequirements = [];

      const result = await analyzer.analyzeSupplierOffer(
        projectId,
        supplierId,
        supplierOfferText,
        technicalRequirements
      );

      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should process offer within reasonable time', async () => {
      const projectId = 1;
      const supplierId = 1;
      const supplierOfferText = 'We offer high-quality electronics with comprehensive specifications';
      const technicalRequirements = [
        {
          id: 1,
          tech_spec_number: 'TS-001',
          extracted_value: 'ISO 9001 certification required'
        }
      ];

      const startTime = Date.now();
      await analyzer.analyzeSupplierOffer(
        projectId,
        supplierId,
        supplierOfferText,
        technicalRequirements
      );
      const endTime = Date.now();

      // Анализ должен завершиться за разумное время (менее 30 секунд)
      expect(endTime - startTime).toBeLessThan(30000);
    });

    it('should handle concurrent analysis requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        projectId: i + 1,
        supplierId: i + 1,
        supplierOfferText: `Offer ${i + 1}`,
        technicalRequirements: [
          {
            id: i + 1,
            tech_spec_number: `TS-${i + 1}`,
            extracted_value: `Requirement ${i + 1}`
          }
        ]
      });

      const promises = requests.map(request =>
        analyzer.analyzeSupplierOffer(
          request.projectId,
          request.supplierId,
          request.supplierOfferText,
          request.technicalRequirements
        )
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});


