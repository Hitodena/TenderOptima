import { Router, Request, Response } from 'express';
import { db } from '../db';
import { stagingSuppliers, suppliers, supplierSearchKeywords, supplierResponses } from '../../shared/schema';
import { eq, and, desc, count, or, like, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/**
 * Нормализация URL для унифицированного поиска и сохранения
 * Удаляет протокол, www, путь и параметры, оставляя только домен
 * @param url - исходный URL
 * @returns нормализованный домен
 */
function normalizeWebsite(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  try {
    // Удаляем протокол (http://, https://)
    let normalized = url.replace(/^https?:\/\//, '');
    
    // Удаляем www.
    normalized = normalized.replace(/^www\./, '');
    
    // Удаляем все после первого слэша (путь, параметры, якоря)
    normalized = normalized.split('/')[0];
    
    // Удаляем порт если есть
    normalized = normalized.split(':')[0];
    
    // Приводим к нижнему регистру
    normalized = normalized.toLowerCase();
    
    return normalized.trim();
  } catch (error) {
    console.error('[normalizeWebsite] Error normalizing URL:', url, error);
    return url;
  }
}

/**
 * GET /api/admin/staging-suppliers
 * Получение списка поставщиков на модерацию
 */
router.get('/staging-suppliers', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const offset = (page - 1) * limit;
    
    console.log(`[AdminModeration] Fetching staging suppliers for moderation - page: ${page}, limit: ${limit}`);
    
    // Получаем общее количество записей
    const totalCountResult = await db
      .select({ count: count() })
      .from(stagingSuppliers)
      .where(eq(stagingSuppliers.status, 'new'));
    
    const totalCount = totalCountResult[0]?.count || 0;
    console.log(`[AdminModeration] Total records: ${totalCount}`);
    
    // Получаем записи с пагинацией
    const stagingRecords = await db
      .select()
      .from(stagingSuppliers)
      .where(eq(stagingSuppliers.status, 'new'))
      .orderBy(stagingSuppliers.createdAt)
      .limit(limit)
      .offset(offset);

    console.log(`[AdminModeration] Found ${stagingRecords.length} records for page ${page}`);

    // Обогащаем данные проверкой на дубликаты (только для текущей страницы)
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
          console.error(`[AdminModeration] Error processing record ${record.id}:`, error);
          return {
            ...record,
            isDuplicate: false,
            matchedSupplierId: null,
            domain: record.rawUrl.replace(/^https?:\/\//, '').replace(/^www\./, '')
          };
        }
      })
    );

    console.log(`[AdminModeration] Returning ${enrichedRecords.length} enriched records for page ${page}`);
    
    res.json({
      success: true,
      data: enrichedRecords,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('[AdminModeration] Error fetching staging suppliers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staging suppliers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/approve-supplier
 * Одобрение поставщика и создание новой записи в suppliers
 */
router.post('/approve-supplier', requireAuth, async (req: Request, res: Response) => {
  try {
    const { stagingId } = req.body;

    if (!stagingId || typeof stagingId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'stagingId is required and must be a number'
      });
    }

    console.log(`[AdminModeration] Approving supplier with stagingId: ${stagingId}`);

    // Находим запись в staging_suppliers
    const stagingRecord = await db
      .select()
      .from(stagingSuppliers)
      .where(eq(stagingSuppliers.id, stagingId))
      .limit(1);

    if (stagingRecord.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Staging supplier not found'
      });
    }

    const record = stagingRecord[0];

    // Создаем новую запись в suppliers
    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        name: record.rawTitle,
        description: record.rawDescription || 'Поставщик одобрен через модерацию',
        website: record.rawUrl,
        email: record.rawEmails && record.rawEmails[0] ? record.rawEmails[0] : '',
        phone: record.rawPhones && record.rawPhones[0] ? record.rawPhones[0] : '',
        categories: [record.searchQuery], // Используем searchQuery как категорию
        region: record.region,
        responseRate: null,
        totalRequests: 0,
        successfulMatches: 0,
        lastResponseTime: null
      })
      .returning();

    console.log(`[AdminModeration] Created new supplier with ID: ${newSupplier.id}`);

    // Создаем запись в supplier_search_keywords
    await db
      .insert(supplierSearchKeywords)
      .values({
        supplierId: newSupplier.id,
        keyword: record.searchQuery
      });

    console.log(`[AdminModeration] Created search keyword link for supplier ${newSupplier.id}`);

    // Обновляем статус в staging_suppliers
    await db
      .update(stagingSuppliers)
      .set({
        status: 'approved',
        matchedSupplierId: newSupplier.id
      })
      .where(eq(stagingSuppliers.id, stagingId));

    console.log(`[AdminModeration] Updated staging record status to 'approved'`);

    res.json({
      success: true,
      message: 'Supplier approved successfully',
      data: {
        stagingId,
        newSupplierId: newSupplier.id,
        supplierName: newSupplier.name,
        website: newSupplier.website
      }
    });

  } catch (error) {
    console.error('[AdminModeration] Error approving supplier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve supplier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/merge-supplier
 * Обработка дубликата - связывание с существующим поставщиком
 */
router.post('/merge-supplier', requireAuth, async (req: Request, res: Response) => {
  try {
    const { stagingId, existingSupplierId } = req.body;

    if (!stagingId || typeof stagingId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'stagingId is required and must be a number'
      });
    }

    if (!existingSupplierId || typeof existingSupplierId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'existingSupplierId is required and must be a number'
      });
    }

    console.log(`[AdminModeration] Merging staging supplier ${stagingId} with existing supplier ${existingSupplierId}`);

    // Находим запись в staging_suppliers
    const stagingRecord = await db
      .select()
      .from(stagingSuppliers)
      .where(eq(stagingSuppliers.id, stagingId))
      .limit(1);

    if (stagingRecord.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Staging supplier not found'
      });
    }

    // Проверяем существование поставщика
    const existingSupplier = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, existingSupplierId))
      .limit(1);

    if (existingSupplier.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Existing supplier not found'
      });
    }

    const record = stagingRecord[0];

    // Создаем запись в supplier_search_keywords
    await db
      .insert(supplierSearchKeywords)
      .values({
        supplierId: existingSupplierId,
        keyword: record.searchQuery
      });

    console.log(`[AdminModeration] Created search keyword link for existing supplier ${existingSupplierId}`);

    // Обновляем статус в staging_suppliers
    await db
      .update(stagingSuppliers)
      .set({
        status: 'merged',
        matchedSupplierId: existingSupplierId
      })
      .where(eq(stagingSuppliers.id, stagingId));

    console.log(`[AdminModeration] Updated staging record status to 'merged'`);

    res.json({
      success: true,
      message: 'Supplier merged successfully',
      data: {
        stagingId,
        existingSupplierId,
        supplierName: existingSupplier[0].name,
        website: existingSupplier[0].website,
        newKeyword: record.searchQuery
      }
    });

  } catch (error) {
    console.error('[AdminModeration] Error merging supplier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to merge supplier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/reject-supplier
 * Отклонение поставщика
 */
router.post('/reject-supplier', requireAuth, async (req: Request, res: Response) => {
  try {
    const { stagingId } = req.body;

    if (!stagingId || typeof stagingId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'stagingId is required and must be a number'
      });
    }

    console.log(`[AdminModeration] Rejecting supplier with stagingId: ${stagingId}`);

    // Находим запись в staging_suppliers
    const stagingRecord = await db
      .select()
      .from(stagingSuppliers)
      .where(eq(stagingSuppliers.id, stagingId))
      .limit(1);

    if (stagingRecord.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Staging supplier not found'
      });
    }

    // Обновляем статус в staging_suppliers
    await db
      .update(stagingSuppliers)
      .set({
        status: 'rejected'
      })
      .where(eq(stagingSuppliers.id, stagingId));

    console.log(`[AdminModeration] Updated staging record status to 'rejected'`);

    res.json({
      success: true,
      message: 'Supplier rejected successfully',
      data: {
        stagingId,
        supplierName: stagingRecord[0].rawTitle,
        website: stagingRecord[0].rawUrl
      }
    });

  } catch (error) {
    console.error('[AdminModeration] Error rejecting supplier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject supplier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/suppliers/:id/stats
 * Получение статистики по поставщику
 */
router.get('/suppliers/:id/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const supplierId = parseInt(req.params.id);

    if (isNaN(supplierId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid supplier ID'
      });
    }

    console.log(`[AdminVerification] Fetching stats for supplier ID: ${supplierId}`);

    // Находим поставщика
    const supplier = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (supplier.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    // Подсчитываем общее количество ответов от этого поставщика
    const totalResponsesResult = await db
      .select({ count: count() })
      .from(supplierResponses)
      .where(eq(supplierResponses.supplierId, supplierId.toString()));

    const totalResponses = totalResponsesResult[0]?.count || 0;

    const stats = {
      totalRequests: supplier[0].totalRequests,
      totalResponses: totalResponses,
      verifiedResponses: supplier[0].verifiedResponses,
      unverifiedResponses: supplier[0].unverifiedResponses
    };

    console.log(`[AdminVerification] Stats for supplier ${supplierId}:`, stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[AdminVerification] Error fetching supplier stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supplier stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/suppliers/:id/responses
 * Получение истории ответов поставщика
 */
router.get('/suppliers/:id/responses', requireAuth, async (req: Request, res: Response) => {
  try {
    const supplierId = parseInt(req.params.id);

    if (isNaN(supplierId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid supplier ID'
      });
    }

    console.log(`[AdminVerification] Fetching responses for supplier ID: ${supplierId}`);

    // Находим все ответы поставщика, отсортированные по дате
    const responses = await db
      .select()
      .from(supplierResponses)
      .where(eq(supplierResponses.supplierId, supplierId.toString()))
      .orderBy(desc(supplierResponses.responseDate));

    console.log(`[AdminVerification] Found ${responses.length} responses for supplier ${supplierId}`);

    res.json({
      success: true,
      data: responses,
      total: responses.length
    });

  } catch (error) {
    console.error('[AdminVerification] Error fetching supplier responses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supplier responses',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/admin/supplier-responses/:id/verify
 * Модерация конкретного ответа поставщика
 */
router.put('/supplier-responses/:id/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const responseId = parseInt(req.params.id);
    const { status, notes } = req.body;

    if (isNaN(responseId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid response ID'
      });
    }

    if (!status || !['verified', 'unverified'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be either "verified" or "unverified"'
      });
    }

    console.log(`[AdminVerification] Verifying response ID: ${responseId} with status: ${status}`);

    // Используем транзакцию для обеспечения целостности данных
    const result = await db.transaction(async (tx) => {
      // Находим ответ
      const response = await tx
        .select()
        .from(supplierResponses)
        .where(eq(supplierResponses.id, responseId))
        .limit(1);

      if (response.length === 0) {
        throw new Error('Response not found');
      }

      const currentResponse = response[0];
      const oldStatus = currentResponse.verificationStatus;

      // Обновляем статус и заметки ответа
      await tx
        .update(supplierResponses)
        .set({
          verificationStatus: status,
          verificationNotes: notes || null
        })
        .where(eq(supplierResponses.id, responseId));

      // Находим связанного поставщика
      const supplier = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, parseInt(currentResponse.supplierId)))
        .limit(1);

      if (supplier.length === 0) {
        throw new Error('Supplier not found');
      }

      const currentSupplier = supplier[0];

      // Обновляем счетчики у поставщика
      let newVerifiedResponses = currentSupplier.verifiedResponses;
      let newUnverifiedResponses = currentSupplier.unverifiedResponses;

      // Уменьшаем счетчик для старого статуса (если он не был 'pending')
      if (oldStatus === 'verified') {
        newVerifiedResponses = Math.max(0, newVerifiedResponses - 1);
      } else if (oldStatus === 'unverified') {
        newUnverifiedResponses = Math.max(0, newUnverifiedResponses - 1);
      }

      // Увеличиваем счетчик для нового статуса
      if (status === 'verified') {
        newVerifiedResponses += 1;
      } else if (status === 'unverified') {
        newUnverifiedResponses += 1;
      }

      // Обновляем счетчики в таблице suppliers
      await tx
        .update(suppliers)
        .set({
          verifiedResponses: newVerifiedResponses,
          unverifiedResponses: newUnverifiedResponses
        })
        .where(eq(suppliers.id, parseInt(currentResponse.supplierId)));

      return {
        responseId,
        supplierId: parseInt(currentResponse.supplierId),
        oldStatus,
        newStatus: status,
        newVerifiedResponses,
        newUnverifiedResponses
      };
    });

    console.log(`[AdminVerification] Successfully verified response ${responseId}:`, result);

    res.json({
      success: true,
      message: 'Response verification updated successfully',
      data: result
    });

  } catch (error) {
    console.error('[AdminVerification] Error verifying response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify response',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/admin/suppliers
 * Создание нового поставщика напрямую в реестр (ручное создание администратором)
 */
router.post('/suppliers', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      website,
      email,
      phone,
      categories,
      region,
      legalName,
      taxId,
      legalAddress,
      bankDetails,
      contactPerson
    } = req.body;

    // Нормализуем website для унифицированного поиска и сохранения
    const normalizedWebsite = normalizeWebsite(website);
    
    console.log('[AdminSuppliers] Creating new supplier:', { name, website, normalizedWebsite, email });

    // Валидация обязательных полей
    if (!name || !description || !website || !email || !phone || !categories) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'name, description, website, email, phone, and categories are required'
      });
    }

    // Проверка, что categories является массивом
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid categories',
        details: 'categories must be a non-empty array'
      });
    }

    // Проверка уникальности website (используем нормализованный URL)
    const existingSupplier = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.website, normalizedWebsite))
      .limit(1);

    if (existingSupplier.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Supplier already exists',
        details: `Supplier with website "${website}" already exists in the registry`
      });
    }

    // Создание нового поставщика
    const newSupplier = await db
      .insert(suppliers)
      .values({
        name: name.trim(),
        description: description.trim(),
        website: normalizedWebsite, // Сохраняем нормализованный URL
        email: email.trim(),
        phone: phone.trim(),
        categories: categories.map(cat => cat.trim()),
        region: region?.trim() || null,
        legalName: legalName?.trim() || null,
        taxId: taxId?.trim() || null,
        legalAddress: legalAddress?.trim() || null,
        bankDetails: bankDetails?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        totalRequests: 0,
        successfulMatches: 0,
        verifiedResponses: 0,
        unverifiedResponses: 0,
        responseRate: null,
        lastResponseTime: null
      })
      .returning();

    console.log('[AdminSuppliers] Successfully created supplier:', newSupplier[0]);

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: newSupplier[0]
    });

  } catch (error) {
    console.error('[AdminSuppliers] Error creating supplier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create supplier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/admin/suppliers/find
 * Поиск поставщика по website или taxId
 */
router.get('/suppliers/find', requireAuth, async (req: Request, res: Response) => {
  try {
    const { website, taxId } = req.query;

    // Нормализуем website для поиска
    const normalizedWebsite = website ? normalizeWebsite(website as string) : null;
    
    console.log('[AdminSuppliers] Searching supplier:', { website, normalizedWebsite, taxId });

    // Валидация: должен быть передан хотя бы один параметр
    if (!website && !taxId) {
      return res.status(400).json({
        success: false,
        error: 'Missing search parameters',
        details: 'Either website or taxId parameter is required'
      });
    }

    let supplier = null;

    // Поиск по website (используем нормализованный URL)
    if (normalizedWebsite) {
      const websiteResults = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.website, normalizedWebsite))
        .limit(1);

      if (websiteResults.length > 0) {
        supplier = websiteResults[0];
        console.log('[AdminSuppliers] Found supplier by website:', supplier.id);
      }
    }

    // Поиск по taxId (если не найден по website)
    if (!supplier && taxId) {
      const taxIdResults = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.taxId, taxId as string))
        .limit(1);

      if (taxIdResults.length > 0) {
        supplier = taxIdResults[0];
        console.log('[AdminSuppliers] Found supplier by taxId:', supplier.id);
      }
    }

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        details: 'No supplier found with the provided criteria'
      });
    }

    res.json({
      success: true,
      message: 'Supplier found successfully',
      data: supplier
    });

  } catch (error) {
    console.error('[AdminSuppliers] Error searching supplier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search supplier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/admin/suppliers/:id
 * Обновление поставщика
 */
router.put('/suppliers/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const supplierId = parseInt(req.params.id);
    const {
      name,
      description,
      website,
      email,
      phone,
      categories,
      region,
      legalName,
      taxId,
      legalAddress,
      bankDetails,
      contactPerson
    } = req.body;

    // Нормализуем website для унифицированного поиска и сохранения
    const normalizedWebsite = normalizeWebsite(website);
    
    console.log('[AdminSuppliers] Updating supplier:', { supplierId, name, website, normalizedWebsite, email });

    // Валидация ID
    if (isNaN(supplierId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid supplier ID',
        details: 'Supplier ID must be a valid number'
      });
    }

    // Проверяем, существует ли поставщик
    const existingSupplier = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (existingSupplier.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        details: `Supplier with ID ${supplierId} does not exist`
      });
    }

    // Валидация обязательных полей
    if (!name || !description || !website || !email || !phone || !categories) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'name, description, website, email, phone, and categories are required'
      });
    }

    // Проверка, что categories является массивом
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid categories',
        details: 'categories must be a non-empty array'
      });
    }

    // Проверка уникальности website (если изменился, используем нормализованный URL)
    if (normalizedWebsite !== existingSupplier[0].website) {
      const duplicateSupplier = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.website, normalizedWebsite))
        .limit(1);

      if (duplicateSupplier.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Website already exists',
          details: `Another supplier with website "${normalizedWebsite}" already exists`
        });
      }
    }

    // Проверка уникальности taxId (если изменился и не пустой)
    if (taxId && taxId !== existingSupplier[0].taxId) {
      const duplicateTaxId = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.taxId, taxId))
        .limit(1);

      if (duplicateTaxId.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Tax ID already exists',
          details: `Another supplier with tax ID "${taxId}" already exists`
        });
      }
    }

    // Обновление поставщика
    const updatedSupplier = await db
      .update(suppliers)
      .set({
        name: name.trim(),
        description: description.trim(),
        website: normalizedWebsite, // Сохраняем нормализованный URL
        email: email.trim(),
        phone: phone.trim(),
        categories: categories.map(cat => cat.trim()),
        region: region?.trim() || null,
        legalName: legalName?.trim() || null,
        taxId: taxId?.trim() || null,
        legalAddress: legalAddress?.trim() || null,
        bankDetails: bankDetails?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        updatedAt: new Date()
      })
      .where(eq(suppliers.id, supplierId))
      .returning();

    console.log('[AdminSuppliers] Successfully updated supplier:', updatedSupplier[0]);

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: updatedSupplier[0]
    });

  } catch (error) {
    console.error('[AdminSuppliers] Error updating supplier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update supplier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/admin/suppliers - Получение списка всех верифицированных поставщиков с пагинацией и поиском
router.get('/suppliers', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('[AdminSuppliers] Fetching suppliers list with pagination and search');
    
    // Извлекаем параметры запроса
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    
    console.log('[AdminSuppliers] Request parameters:', { page, limit, search });
    
    // Валидация параметров
    if (page < 1) {
      return res.status(400).json({
        success: false,
        error: 'Page number must be greater than 0'
      });
    }
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 100'
      });
    }
    
    // Рассчитываем offset для пагинации
    const offset = (page - 1) * limit;
    
    // Строим условия для поиска
    let whereConditions = [];
    
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      whereConditions.push(
        or(
          like(suppliers.name, searchTerm),
          like(suppliers.description, searchTerm),
          like(suppliers.website, searchTerm),
          like(suppliers.taxId, searchTerm),
          sql`${suppliers.categories}::text ILIKE ${searchTerm}`
        )
      );
    }
    
    // Получаем общее количество записей (для расчета общего количества страниц)
    const totalCountQuery = db
      .select({ count: count() })
      .from(suppliers);
    
    if (whereConditions.length > 0) {
      totalCountQuery.where(and(...whereConditions));
    }
    
    const totalCountResult = await totalCountQuery;
    const total = totalCountResult[0]?.count || 0;
    
    console.log('[AdminSuppliers] Total suppliers found:', total);
    
    // Получаем данные с пагинацией
    let dataQuery = db
      .select()
      .from(suppliers)
      .orderBy(desc(suppliers.createdAt))
      .limit(limit)
      .offset(offset);
    
    if (whereConditions.length > 0) {
      dataQuery = dataQuery.where(and(...whereConditions));
    }
    
    const suppliersData = await dataQuery;
    
    console.log('[AdminSuppliers] Returning suppliers:', {
      count: suppliersData.length,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
    
    // Возвращаем результат
    res.json({
      success: true,
      data: suppliersData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
    
  } catch (error) {
    console.error('[AdminSuppliers] Error fetching suppliers list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suppliers list',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Получение одного поставщика по ID
router.get('/suppliers/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('[AdminSuppliers] Fetching supplier by ID:', req.params.id);

    const supplierId = parseInt(req.params.id);
    
    if (isNaN(supplierId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid supplier ID'
      });
    }

    const supplier = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (supplier.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    console.log('[AdminSuppliers] Found supplier:', supplier[0].name);

    res.json({
      success: true,
      data: supplier[0]
    });

  } catch (error) {
    console.error('[AdminSuppliers] Error fetching supplier by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supplier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
