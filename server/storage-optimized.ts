// Оптимизированные функции для storage.ts
// Добавить в server/storage.ts

// 1. Оптимизированная функция для batch запросов (заменить существующую)
async getAllSupplierResponsesForRequestsOptimized(requestIds: number[], userId?: number): Promise<SupplierResponse[]> {
  if (!requestIds.length) {
    return [];
  }
  
  console.log(`[storage] OPTIMIZED: Fetching batch responses for ${requestIds.length} requests - userId provided: ${userId !== undefined}`);
  
  // CRITICAL SECURITY: Always require userId for data isolation
  if (userId === undefined) {
    console.error(`[storage] SECURITY VIOLATION: Attempted to fetch batch responses without user filter`);
    throw new Error("User ID is required for batch response access - security violation prevented");
  }
  
  // Build the query with both request IDs and user ID filters
  const conditions = and(
    inArray(supplierResponses.requestId, requestIds),
    eq(supplierResponses.userId, userId)
  );
  
  const results = await db
    .select()
    .from(supplierResponses)
    .where(conditions)
    .orderBy(desc(supplierResponses.responseDate));
    
  console.log(`[storage] OPTIMIZED: Returning ${results.length} batch responses exclusively for user ID: ${userId}`);
  
  // ОПТИМИЗАЦИЯ: Убираем содержимое вложений, оставляем только метаданные
  return results.map(response => ({
    ...response,
    attachments: (response.attachments as any[]).map((attachment: any) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      extractedText: attachment.extractedText,
      processingStatus: attachment.processingStatus || 'pending',
      // НЕ включаем content - загружаем по требованию
    }))
  }));
}

// 2. Функция для обновления ответа поставщика (добавить в интерфейс)
async updateSupplierResponse(id: number, updates: Partial<SupplierResponse>): Promise<SupplierResponse | undefined> {
  try {
    const result = await db
      .update(supplierResponses)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(supplierResponses.id, id))
      .returning();

    return result[0];
  } catch (error) {
    console.error(`[storage] Error updating supplier response ${id}:`, error);
    return undefined;
  }
}

// 3. Функция для получения ответов по статусу обработки
async getSupplierResponsesByProcessingStatus(
  status: 'pending' | 'processing' | 'completed' | 'failed',
  userId?: number
): Promise<SupplierResponse[]> {
  const conditions = userId 
    ? and(
        eq(supplierResponses.processingStatus, status),
        eq(supplierResponses.userId, userId)
      )
    : eq(supplierResponses.processingStatus, status);

  return await db
    .select()
    .from(supplierResponses)
    .where(conditions)
    .orderBy(desc(supplierResponses.responseDate));
}

// 4. Функция для получения статистики обработки
async getProcessingStats(userId?: number): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const conditions = userId 
    ? eq(supplierResponses.userId, userId)
    : undefined;

  const results = await db
    .select({
      status: supplierResponses.processingStatus,
      count: count(supplierResponses.id)
    })
    .from(supplierResponses)
    .where(conditions)
    .groupBy(supplierResponses.processingStatus);

  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0
  };

  results.forEach(result => {
    const status = result.status as keyof typeof stats;
    if (status in stats) {
      stats[status] = result.count;
    }
    stats.total += result.count;
  });

  return stats;
}
