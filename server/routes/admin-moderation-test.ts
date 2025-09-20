import { Router, Request, Response } from 'express';
import { db } from '../db';
import { stagingSuppliers, suppliers, supplierSearchKeywords } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/admin-test/staging-suppliers
 * Получение списка поставщиков на модерацию (БЕЗ АУТЕНТИФИКАЦИИ - ТОЛЬКО ДЛЯ ТЕСТИРОВАНИЯ)
 */
router.get('/staging-suppliers', async (req: Request, res: Response) => {
  try {
    console.log('[AdminModerationTest] Fetching staging suppliers for moderation');
    
    // Получаем все записи со статусом 'new'
    const stagingRecords = await db
      .select()
      .from(stagingSuppliers)
      .where(eq(stagingSuppliers.status, 'new'))
      .orderBy(stagingSuppliers.createdAt);

    console.log(`[AdminModerationTest] Found ${stagingRecords.length} records for moderation`);

    // Обогащаем данные проверкой на дубликаты
    const enrichedRecords = await Promise.all(
      stagingRecords.map(async (record) => {
        try {
          // Извлекаем домен из rawUrl
          const domain = record.rawUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
          
          // Ищем совпадение в основной таблице suppliers
          const existingSupplier = await db
            .select()
            .from(suppliers)
            .where(eq(suppliers.website, record.rawUrl))
            .limit(1);

          const isDuplicate = existingSupplier.length > 0;
          const matchedSupplierId = isDuplicate ? existingSupplier[0].id : null;

          return {
            ...record,
            isDuplicate,
            matchedSupplierId,
            domain
          };
        } catch (error) {
          console.error(`[AdminModerationTest] Error processing record ${record.id}:`, error);
          return {
            ...record,
            isDuplicate: false,
            matchedSupplierId: null,
            domain: record.rawUrl.replace(/^https?:\/\//, '').replace(/^www\./, '')
          };
        }
      })
    );

    console.log(`[AdminModerationTest] Returning ${enrichedRecords.length} enriched records`);
    
    res.json({
      success: true,
      data: enrichedRecords,
      total: enrichedRecords.length
    });

  } catch (error) {
    console.error('[AdminModerationTest] Error fetching staging suppliers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staging suppliers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
