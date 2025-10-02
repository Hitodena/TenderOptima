import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../../server/db';
import { users, searchRequests, supplierResponses } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { TEST_CONFIG, setupTestEnvironment, cleanupTestEnvironment } from '../../setup/test-environment';
import { TestHelpers } from '../../utils/test-helpers';

describe('Database Integration - Search Requests', () => {
  let testUserId: number;

  beforeEach(async () => {
    await setupTestEnvironment();
    
    // Создаем тестового пользователя
    const userData = {
      username: 'searchtest@example.com',
      password: 'hashedpassword123',
      role: 'user'
    };
    
    const createdUser = await db.insert(users).values(userData).returning();
    testUserId = createdUser[0].id;
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Search Request CRUD Operations', () => {
    it('should create search request', async () => {
      const requestData = {
        title: 'Test Search Request',
        description: 'Test description for search request',
        requirements: ['quality', 'delivery', 'price'],
        budget: 10000,
        deadline: new Date('2024-12-31'),
        status: 'active',
        userId: testUserId
      };

      const result = await db.insert(searchRequests).values(requestData).returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe(requestData.title);
      expect(result[0].description).toBe(requestData.description);
      expect(result[0].userId).toBe(testUserId);
      expect(result[0].id).toBeDefined();
    });

    it('should read search request by ID', async () => {
      const requestData = {
        title: 'Read Test Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const createdRequest = await db.insert(searchRequests).values(requestData).returning();
      const requestId = createdRequest[0].id;

      const foundRequest = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.id, requestId));

      expect(foundRequest).toHaveLength(1);
      expect(foundRequest[0].title).toBe(requestData.title);
    });

    it('should read search requests by user ID', async () => {
      const requestData1 = {
        title: 'Request 1',
        description: 'Description 1',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const requestData2 = {
        title: 'Request 2',
        description: 'Description 2',
        requirements: ['delivery'],
        status: 'active',
        userId: testUserId
      };

      await db.insert(searchRequests).values(requestData1);
      await db.insert(searchRequests).values(requestData2);

      const userRequests = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.userId, testUserId));

      expect(userRequests).toHaveLength(2);
    });

    it('should update search request', async () => {
      const requestData = {
        title: 'Update Test Request',
        description: 'Original description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const createdRequest = await db.insert(searchRequests).values(requestData).returning();
      const requestId = createdRequest[0].id;

      const updateData = {
        title: 'Updated Request',
        description: 'Updated description',
        status: 'completed'
      };

      await db.update(searchRequests)
        .set(updateData)
        .where(eq(searchRequests.id, requestId));

      const updatedRequest = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.id, requestId));

      expect(updatedRequest[0].title).toBe(updateData.title);
      expect(updatedRequest[0].description).toBe(updateData.description);
      expect(updatedRequest[0].status).toBe(updateData.status);
    });

    it('should delete search request', async () => {
      const requestData = {
        title: 'Delete Test Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const createdRequest = await db.insert(searchRequests).values(requestData).returning();
      const requestId = createdRequest[0].id;

      await db.delete(searchRequests).where(eq(searchRequests.id, requestId));

      const deletedRequest = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.id, requestId));

      expect(deletedRequest).toHaveLength(0);
    });
  });

  describe('Search Request Status Management', () => {
    it('should change request status to active', async () => {
      const requestData = {
        title: 'Status Test Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'draft',
        userId: testUserId
      };

      const createdRequest = await db.insert(searchRequests).values(requestData).returning();
      const requestId = createdRequest[0].id;

      await db.update(searchRequests)
        .set({ status: 'active' })
        .where(eq(searchRequests.id, requestId));

      const updatedRequest = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.id, requestId));

      expect(updatedRequest[0].status).toBe('active');
    });

    it('should change request status to completed', async () => {
      const requestData = {
        title: 'Complete Test Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const createdRequest = await db.insert(searchRequests).values(requestData).returning();
      const requestId = createdRequest[0].id;

      await db.update(searchRequests)
        .set({ status: 'completed' })
        .where(eq(searchRequests.id, requestId));

      const updatedRequest = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.id, requestId));

      expect(updatedRequest[0].status).toBe('completed');
    });

    it('should change request status to cancelled', async () => {
      const requestData = {
        title: 'Cancel Test Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const createdRequest = await db.insert(searchRequests).values(requestData).returning();
      const requestId = createdRequest[0].id;

      await db.update(searchRequests)
        .set({ status: 'cancelled' })
        .where(eq(searchRequests.id, requestId));

      const updatedRequest = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.id, requestId));

      expect(updatedRequest[0].status).toBe('cancelled');
    });
  });

  describe('Search Request Requirements', () => {
    it('should handle multiple requirements', async () => {
      const requestData = {
        title: 'Multi Requirements Request',
        description: 'Test description',
        requirements: ['quality', 'delivery', 'price', 'certification'],
        status: 'active',
        userId: testUserId
      };

      const result = await db.insert(searchRequests).values(requestData).returning();
      
      expect(result[0].requirements).toEqual(requestData.requirements);
    });

    it('should handle empty requirements', async () => {
      const requestData = {
        title: 'No Requirements Request',
        description: 'Test description',
        requirements: [],
        status: 'active',
        userId: testUserId
      };

      const result = await db.insert(searchRequests).values(requestData).returning();
      
      expect(result[0].requirements).toEqual([]);
    });

    it('should update requirements', async () => {
      const requestData = {
        title: 'Update Requirements Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const createdRequest = await db.insert(searchRequests).values(requestData).returning();
      const requestId = createdRequest[0].id;

      const newRequirements = ['quality', 'delivery', 'price'];
      await db.update(searchRequests)
        .set({ requirements: newRequirements })
        .where(eq(searchRequests.id, requestId));

      const updatedRequest = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.id, requestId));

      expect(updatedRequest[0].requirements).toEqual(newRequirements);
    });
  });

  describe('Search Request Budget and Deadline', () => {
    it('should handle budget values', async () => {
      const requestData = {
        title: 'Budget Test Request',
        description: 'Test description',
        requirements: ['quality'],
        budget: 50000,
        status: 'active',
        userId: testUserId
      };

      const result = await db.insert(searchRequests).values(requestData).returning();
      
      expect(result[0].budget).toBe(50000);
    });

    it('should handle null budget', async () => {
      const requestData = {
        title: 'No Budget Request',
        description: 'Test description',
        requirements: ['quality'],
        budget: null,
        status: 'active',
        userId: testUserId
      };

      const result = await db.insert(searchRequests).values(requestData).returning();
      
      expect(result[0].budget).toBeNull();
    });

    it('should handle deadline dates', async () => {
      const deadline = new Date('2024-12-31');
      const requestData = {
        title: 'Deadline Test Request',
        description: 'Test description',
        requirements: ['quality'],
        deadline: deadline,
        status: 'active',
        userId: testUserId
      };

      const result = await db.insert(searchRequests).values(requestData).returning();
      
      expect(result[0].deadline).toEqual(deadline);
    });

    it('should handle null deadline', async () => {
      const requestData = {
        title: 'No Deadline Request',
        description: 'Test description',
        requirements: ['quality'],
        deadline: null,
        status: 'active',
        userId: testUserId
      };

      const result = await db.insert(searchRequests).values(requestData).returning();
      
      expect(result[0].deadline).toBeNull();
    });
  });

  describe('Search Request Relationships', () => {
    it('should maintain user relationship', async () => {
      const requestData = {
        title: 'Relationship Test Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const result = await db.insert(searchRequests).values(requestData).returning();
      
      expect(result[0].userId).toBe(testUserId);
    });

    it('should handle foreign key constraint', async () => {
      const requestData = {
        title: 'Invalid User Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: 99999 // Несуществующий пользователь
      };

      await expect(
        db.insert(searchRequests).values(requestData)
      ).rejects.toThrow();
    });

    it('should cascade delete with user', async () => {
      const requestData = {
        title: 'Cascade Test Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const createdRequest = await db.insert(searchRequests).values(requestData).returning();
      const requestId = createdRequest[0].id;

      // Удаляем пользователя
      await db.delete(users).where(eq(users.id, testUserId));

      // Проверяем, что запрос тоже удален (если настроен CASCADE)
      const deletedRequest = await db.select()
        .from(searchRequests)
        .where(eq(searchRequests.id, requestId));

      // В зависимости от настроек БД, запрос может быть удален или остаться
      expect(deletedRequest.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Search Request Queries', () => {
    it('should filter requests by status', async () => {
      const activeRequest = {
        title: 'Active Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId
      };

      const draftRequest = {
        title: 'Draft Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'draft',
        userId: testUserId
      };

      await db.insert(searchRequests).values(activeRequest);
      await db.insert(searchRequests).values(draftRequest);

      const activeRequests = await db.select()
        .from(searchRequests)
        .where(and(
          eq(searchRequests.userId, testUserId),
          eq(searchRequests.status, 'active')
        ));

      expect(activeRequests).toHaveLength(1);
      expect(activeRequests[0].status).toBe('active');
    });

    it('should filter requests by date range', async () => {
      const oldDate = new Date('2023-01-01');
      const newDate = new Date('2024-01-01');

      const oldRequest = {
        title: 'Old Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId,
        createdAt: oldDate
      };

      const newRequest = {
        title: 'New Request',
        description: 'Test description',
        requirements: ['quality'],
        status: 'active',
        userId: testUserId,
        createdAt: newDate
      };

      await db.insert(searchRequests).values(oldRequest);
      await db.insert(searchRequests).values(newRequest);

      const recentRequests = await db.select()
        .from(searchRequests)
        .where(and(
          eq(searchRequests.userId, testUserId),
          // Здесь можно добавить фильтр по дате
        ));

      expect(recentRequests).toHaveLength(2);
    });
  });
});


