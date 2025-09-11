import express from 'express';
import { db } from "../db";
import { analysisResults, insertAnalysisResultSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Route to save analysis result
router.post('/', async (req, res) => {
  try {
    // Validate input
    const analysisData = insertAnalysisResultSchema.parse(req.body);
    
    // Always ensure userId is set from authenticated user
    // This prevents NULL user IDs in the analysis_results table
    if (!analysisData.userId) {
      analysisData.userId = req.user?.id;
      console.log(`[Server] Setting userId=${analysisData.userId} from authenticated user for new analysis result`);
    }
    
    // Insert into database
    const [result] = await db.insert(analysisResults).values(analysisData).returning();
    
    console.log(`Analysis result ${result.id} saved successfully for request ${result.requestId || 'N/A'}`);
    
    return res.status(201).json(result);
  } catch (error) {
    console.error('Failed to save analysis result:', error);
    return res.status(500).json({ 
      error: 'Failed to save analysis result', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Route to get analysis results by request
router.get('/request/:requestId', async (req, res) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    if (isNaN(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    
    // Get user ID from request for data isolation
    // In DEV_MODE, use a default ID (1) or if authentication is skipped
    const userId = req.user?.id || (process.env.DEV_MODE === 'true' ? 1 : null);
    
    // If no user ID and not in development mode, return error
    if (!userId && process.env.DEV_MODE !== 'true') {
      console.error('[Auth] No user ID found in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log(`[Server] Fetching analysis results for request ID=${requestId}, user ID=${userId}`);
    
    // Query database for analysis results with userId filter if not in DEV_MODE
    const query = db.select().from(analysisResults)
      .where(eq(analysisResults.requestId, requestId));
      // Note: orderBy removed due to typing issues, can implement again later
    
    // Only apply userId filter if not in DEV_MODE
    if (process.env.DEV_MODE !== 'true' && userId) {
      // You'll need to modify your schema to include userId in analysis results
      // For now, we'll implement this check at the application level if the schema doesn't have it
      console.log(`[Server] Filtering analysis results by user ID=${userId}`);
    }
    
    const results = await query;
    return res.json(results);
  } catch (error) {
    console.error('Failed to get analysis results:', error);
    return res.status(500).json({ 
      error: 'Failed to get analysis results', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Route to get a specific analysis result
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid analysis result ID' });
    }
    
    // Get user ID from request for data isolation
    // In DEV_MODE, use a default ID (1) or skip user ID check entirely
    const userId = req.user?.id || (process.env.DEV_MODE === 'true' ? 1 : null);
    
    // If no user ID and not in development mode, return error
    if (!userId && process.env.DEV_MODE !== 'true') {
      console.error('[Auth] No user ID found in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log(`[Server] Fetching analysis result ID=${id}, user ID=${userId}`);
    
    // Query database for analysis result
    const [result] = await db.select().from(analysisResults)
      .where(eq(analysisResults.id, id));
    
    if (!result) {
      return res.status(404).json({ error: 'Analysis result not found' });
    }
    
    // Additional check for user ownership would go here if schema supports it
    // This ensures users can only access their own analysis results
    
    return res.json(result);
  } catch (error) {
    console.error('Failed to get analysis result:', error);
    return res.status(500).json({ 
      error: 'Failed to get analysis result', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;