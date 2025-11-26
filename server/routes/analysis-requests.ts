import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/requireAuth';
import { subscriptionService } from '../subscription';

const router = Router();

// Get all analysis requests for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { type } = req.query;
    
    let query = `
      SELECT 
        ar.*,
        ap.id as project_id,
        ap.procedure_name,
        ap.description as project_description,
        COUNT(DISTINCT arp.id) as parameters_count,
        COUNT(DISTINCT ars.id) as suppliers_count,
        tar.id as technical_analysis_id,
        tar.status as analysis_status,
        tar.tz_file_path,
        tar.kp_file_path,
        tar.result_json,
        tar.completed_at as analysis_completed_at
      FROM analysis_requests ar
      LEFT JOIN analysis_projects ap ON ar.id = ap.analysis_request_id
      LEFT JOIN analysis_request_parameters arp ON ar.id = arp.request_id
      LEFT JOIN analysis_request_suppliers ars ON ar.id = ars.request_id
      LEFT JOIN technical_analysis_requests tar ON ar.id = tar.analysis_request_id
      WHERE ar.user_id = $1
    `;
    
    const params: any[] = [userId];
    
    if (type) {
      query += ` AND ar.type = $2`;
      params.push(String(type));
    }
    
    query += `
      GROUP BY ar.id, ap.id, ap.procedure_name, ap.description, tar.id, tar.status, tar.tz_file_path, tar.kp_file_path, tar.result_json, tar.completed_at
      ORDER BY ar.updated_at DESC, ar.created_at DESC
    `;

    const result = await pool.query(query, params);
    
    res.json({
      requests: result.rows
    });
  } catch (error) {
    console.error('Error fetching analysis requests:', error);
    res.status(500).json({ error: 'Ошибка получения запросов' });
  }
});

// Create new analysis request
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Check subscription status (no counter increment for analysis request creation)
    const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(userId);
    if (!subscriptionStatus.isActive) {
      console.log(`[AnalysisRequest] User ${userId} subscription is not active: ${subscriptionStatus.message}`);
      return res.status(403).json({ 
        error: 'Подписка неактивна', 
        message: subscriptionStatus.message 
      });
    }

    console.log(`[AnalysisRequest] Subscription active for user ${userId} - creating analysis request`);

    const { name, description, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Название и тип запроса обязательны' });
    }

    if (!['technical_analysis', 'parameter_analysis'].includes(type)) {
      return res.status(400).json({ error: 'Недопустимый тип запроса' });
    }

    const query = `
      INSERT INTO analysis_requests (user_id, name, description, type, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'draft', NOW(), NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [userId, name, description, type]);
    const newRequest = result.rows[0];

    res.status(201).json({
      success: true,
      request: newRequest
    });
  } catch (error) {
    console.error('Error creating analysis request:', error);
    res.status(500).json({ error: 'Ошибка создания запроса' });
  }
});

// Get specific analysis request
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Недопустимый ID запроса' });
    }

    const query = `
      SELECT 
        ar.*,
        COUNT(DISTINCT arp.id) as parameters_count,
        COUNT(DISTINCT ars.id) as suppliers_count,
        tar.id as technical_analysis_id,
        tar.status as analysis_status,
        tar.tz_file_path,
        tar.kp_file_path,
        tar.result_json,
        tar.completed_at as analysis_completed_at
      FROM analysis_requests ar
      LEFT JOIN analysis_request_parameters arp ON ar.id = arp.request_id
      LEFT JOIN analysis_request_suppliers ars ON ar.id = ars.request_id
      LEFT JOIN technical_analysis_requests tar ON ar.id = tar.analysis_request_id
      WHERE ar.id = $1 AND ar.user_id = $2
      GROUP BY ar.id, tar.id, tar.status, tar.tz_file_path, tar.kp_file_path, tar.result_json, tar.completed_at
    `;

    const result = await pool.query(query, [requestId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    res.json({
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching analysis request:', error);
    res.status(500).json({ error: 'Ошибка получения запроса' });
  }
});

// Update analysis request
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Недопустимый ID запроса' });
    }

    const { name, description, status } = req.body;
    
    // Verify ownership
    const ownershipCheck = await pool.query(
      'SELECT id FROM analysis_requests WHERE id = $1 AND user_id = $2',
      [requestId, userId]
    );
    
    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    
    if (status && ['draft', 'in_progress', 'completed'].includes(status)) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(requestId);

    const query = `
      UPDATE analysis_requests 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating analysis request:', error);
    res.status(500).json({ error: 'Ошибка обновления запроса' });
  }
});

// Patch analysis request (partial update, mainly for status changes)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Недопустимый ID запроса' });
    }

    const { status } = req.body;
    
    // Verify ownership
    const ownershipCheck = await pool.query(
      'SELECT id FROM analysis_requests WHERE id = $1 AND user_id = $2',
      [requestId, userId]
    );
    
    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (!status || !['draft', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Недопустимый статус' });
    }

    const query = `
      UPDATE analysis_requests 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, requestId]);

    res.json({
      success: true,
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating analysis request status:', error);
    res.status(500).json({ error: 'Ошибка обновления статуса запроса' });
  }
});

// Delete analysis request
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Недопустимый ID запроса' });
    }

    // Verify ownership and delete
    const result = await pool.query(
      'DELETE FROM analysis_requests WHERE id = $1 AND user_id = $2 RETURNING *',
      [requestId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    res.json({
      success: true,
      message: 'Запрос успешно удален'
    });
  } catch (error) {
    console.error('Error deleting analysis request:', error);
    res.status(500).json({ error: 'Ошибка удаления запроса' });
  }
});

export default router;