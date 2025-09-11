
import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { VectorizationService } from '../services/vectorizationService';

const router = Router();

/**
 * Manually optimize semantic blocks for a project
 */
router.post('/projects/:projectId/vectorize', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    
    console.log(`[Vectorization] Manual optimization for project ${projectId}`);
    
    const vectorizationService = new VectorizationService();
    const vectorizedBlocks = await vectorizationService.optimizeSemanticBlocks(projectId);
    
    res.json({
      success: true,
      processedBlocks: vectorizedBlocks.length,
      blocks: vectorizedBlocks
    });
    
  } catch (error) {
    console.error('[Vectorization] Error in manual optimization:', error);
    res.status(500).json({ 
      error: 'Ошибка векторизации',
      details: error.message 
    });
  }
});

/**
 * Get vectorized blocks for a project
 */
router.get('/projects/:projectId/vectors', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    
    const vectorizationService = new VectorizationService();
    const vectorizedBlocks = await vectorizationService.getVectorizedBlocks(projectId);
    
    res.json({
      success: true,
      blocks: vectorizedBlocks
    });
    
  } catch (error) {
    console.error('[Vectorization] Error getting vectors:', error);
    res.status(500).json({ 
      error: 'Ошибка получения векторов',
      details: error.message 
    });
  }
});

/**
 * Get semantic blocks for a project
 */
router.get('/projects/:projectId/semantic-blocks', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    
    const vectorizationService = new VectorizationService();
    const semanticBlocks = await vectorizationService.getSemanticBlocks(projectId);
    
    res.json({
      success: true,
      blocks: semanticBlocks
    });
    
  } catch (error) {
    console.error('[Vectorization] Error getting semantic blocks:', error);
    res.status(500).json({ 
      error: 'Ошибка получения семантических блоков',
      details: error.message 
    });
  }
});

export default router;
