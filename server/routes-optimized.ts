// Оптимизированные routes для server/routes.ts

// 1. Заменить существующий batch endpoint (строка 2493):
// БЫЛО:
// const responses = await storage.getAllSupplierResponsesForRequests(requestIds, userId);

// ДОЛЖНО БЫТЬ:
const responses = await storage.getAllSupplierResponsesForRequestsOptimized(requestIds, userId);

// 2. Добавить новые endpoints после строки 2500:

// Endpoint для загрузки вложений по требованию
app.get("/api/attachments/:responseId/:filename", requireAuth, async (req, res) => {
  try {
    const { responseId, filename } = req.params;
    const userId = req.user?.id;

    const response = await storage.getSupplierResponseById(parseInt(responseId));
    
    if (!response || response.userId !== userId) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = (response.attachments as any[]).find((att: any) => att.filename === filename);
    
    if (!attachment || !attachment.content) {
      return res.status(404).json({ error: 'Attachment content not found' });
    }

    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(attachment.content, 'base64'));
  } catch (error) {
    console.error('Error fetching attachment:', error);
    res.status(500).json({ error: 'Failed to fetch attachment' });
  }
});

// Endpoint для ручного запуска обработки
app.post("/api/supplier-responses/:id/process", requireAuth, async (req, res) => {
  try {
    const responseId = parseInt(req.params.id);
    const userId = req.user?.id;

    // Проверяем, что ответ принадлежит пользователю
    const response = await storage.getSupplierResponseById(responseId);
    if (!response || response.userId !== userId) {
      return res.status(404).json({ error: 'Response not found' });
    }

    // Запускаем обработку
    const processor = AsyncEmailProcessor.getInstance();
    await processor.manualProcessing(responseId);

    res.json({ 
      message: 'Processing started',
      responseId: responseId
    });
  } catch (error) {
    console.error('Error starting manual processing:', error);
    res.status(500).json({ error: 'Failed to start processing' });
  }
});

// Endpoint для получения статуса обработки
app.get("/api/supplier-responses/:id/processing-status", requireAuth, async (req, res) => {
  try {
    const responseId = parseInt(req.params.id);
    const userId = req.user?.id;

    // Проверяем, что ответ принадлежит пользователю
    const response = await storage.getSupplierResponseById(responseId);
    if (!response || response.userId !== userId) {
      return res.status(404).json({ error: 'Response not found' });
    }

    const processor = AsyncEmailProcessor.getInstance();
    const status = await processor.getProcessingStatus(responseId);

    res.json(status);
  } catch (error) {
    console.error('Error getting processing status:', error);
    res.status(500).json({ error: 'Failed to get processing status' });
  }
});

// Endpoint для получения статистики обработки
app.get("/api/processing-stats", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const stats = await storage.getProcessingStats(userId);
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting processing stats:', error);
    res.status(500).json({ error: 'Failed to get processing stats' });
  }
});

// Endpoint для получения ответов по статусу обработки
app.get("/api/supplier-responses/by-status/:status", requireAuth, async (req, res) => {
  try {
    const { status } = req.params;
    const userId = req.user?.id;

    if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const responses = await storage.getSupplierResponsesByProcessingStatus(
      status as 'pending' | 'processing' | 'completed' | 'failed',
      userId
    );

    res.json(responses);
  } catch (error) {
    console.error('Error getting responses by status:', error);
    res.status(500).json({ error: 'Failed to get responses by status' });
  }
});
