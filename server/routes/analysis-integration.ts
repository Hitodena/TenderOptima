import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// Create analysis project as a search request for dashboard integration
router.post('/create-integrated-project', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { procedureName, description, parameters } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Generate order number for integration
    const timestamp = Date.now().toString().slice(-6);
    const orderNumber = `ANA-${timestamp}`;

    // Create as search request for dashboard visibility
    const searchRequestResult = await pool.query(`
      INSERT INTO search_requests (
        user_id, order_number, procedure_name, description, 
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'analysis', NOW(), NOW()) 
      RETURNING id, order_number
    `, [userId, orderNumber, procedureName, description]);

    const searchRequestId = searchRequestResult.rows[0].id;

    // Create analysis project linked to search request
    const analysisResult = await pool.query(`
      INSERT INTO analysis_projects (
        user_id, search_request_id, procedure_name, description, 
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'step1_requirements', NOW(), NOW()) 
      RETURNING *
    `, [userId, searchRequestId, procedureName, description]);

    const analysisProject = analysisResult.rows[0];

    // Store parameters if provided
    if (parameters && parameters.length > 0) {
      const parameterValues = parameters.map((p: string) => `('${p.replace(/'/g, "''")}')`).join(',');
      await pool.query(`
        INSERT INTO analysis_project_parameters (project_id, parameter_name, created_at)
        VALUES ${parameters.map((p: string, i: number) => `($1, $${i + 2}, NOW())`).join(',')}
      `, [analysisProject.id, ...parameters]);
    }

    return res.json({
      project: analysisProject,
      searchRequest: searchRequestResult.rows[0],
      message: 'Analysis project created and integrated with dashboard'
    });
  } catch (error) {
    console.error('[Analysis Integration] Error creating project:', error);
    return res.status(500).json({ error: 'Failed to create analysis project' });
  }
});

// Get analysis project with search request data
router.get('/project/:projectId/full', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const result = await pool.query(`
      SELECT 
        ap.*,
        sr.order_number,
        sr.status as search_status,
        COALESCE(
          json_agg(
            json_build_object(
              'name', app.parameter_name
            ) ORDER BY app.created_at
          ) FILTER (WHERE app.id IS NOT NULL), 
          '[]'::json
        ) as parameters
      FROM analysis_projects ap
      LEFT JOIN search_requests sr ON ap.search_request_id = sr.id
      LEFT JOIN analysis_project_parameters app ON ap.id = app.project_id
      WHERE ap.id = $1 AND ap.user_id = $2
      GROUP BY ap.id, sr.order_number, sr.status
    `, [projectId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json({ project: result.rows[0] });
  } catch (error) {
    console.error('[Analysis Integration] Error loading project:', error);
    return res.status(500).json({ error: 'Failed to load project' });
  }
});

export default router;