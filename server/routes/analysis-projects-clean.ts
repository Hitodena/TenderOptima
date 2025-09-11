import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { z } from 'zod';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import pg from 'pg';

const router = Router();
const { Pool } = pg;

// Database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/analysis/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  }
});

// Ensure uploads directory exists
(async () => {
  try {
    await fs.mkdir('uploads/analysis', { recursive: true });
  } catch (err) {
    // Directory already exists
  }
})();

// Helper function to extract text from uploaded files
async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'extract_text.py');
    const python = spawn('python3', [pythonScript, filePath]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', error);
        reject(new Error(`Text extraction failed: ${error}`));
      } else {
        resolve(output.trim());
      }
    });
  });
}

// Helper function to extract requirements from text using AI
async function extractRequirementsFromText(text: string): Promise<any[]> {
  // For now, return mock data structure - in production this would call DeepSeek API
  // This simulates parameter extraction from technical documents
  const mockRequirements = [
    {
      techSpecNumber: "2.1",
      extractedValue: "Материал корпуса: нержавеющая сталь",
      confidence: 0.95
    },
    {
      techSpecNumber: "2.2", 
      extractedValue: "Рабочая температура: -40°C до +85°C",
      confidence: 0.88
    },
    {
      techSpecNumber: "3.1",
      extractedValue: "Степень защиты: IP67",
      confidence: 0.92
    }
  ];
  
  return mockRequirements;
}

// Schema for analysis projects
const analysisProjectSchema = z.object({
  procedureName: z.string().min(1, 'Procedure name is required'),
  description: z.string().optional(),
  status: z.enum(['step1_requirements', 'step2_offers', 'step3_compliance']).default('step1_requirements')
});

const requirementSchema = z.object({
  serialNumber: z.number(),
  techSpecNumber: z.string(),
  extractedValue: z.string(),
  confidence: z.number().optional(),
  isApproved: z.boolean().optional(),
  projectId: z.number()
});

// Create a new analysis project
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const validatedData = analysisProjectSchema.parse(req.body);
    
    const result = await pool.query(`
      INSERT INTO analysis_projects (user_id, procedure_name, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `, [userId, validatedData.procedureName, validatedData.description, validatedData.status]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating analysis project:', error);
    res.status(500).json({ error: 'Ошибка создания проекта' });
  }
});

// Get analysis projects for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const result = await pool.query(`
      SELECT * FROM analysis_projects 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching analysis projects:', error);
    res.status(500).json({ error: 'Ошибка получения проектов' });
  }
});

// Get specific analysis project
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Неверный ID проекта' });
    }

    const result = await pool.query(`
      SELECT * FROM analysis_projects 
      WHERE id = $1 AND user_id = $2
    `, [projectId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching analysis project:', error);
    res.status(500).json({ error: 'Ошибка получения проекта' });
  }
});

// Update analysis project
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Неверный ID проекта' });
    }

    const validatedData = analysisProjectSchema.parse(req.body);
    
    const result = await pool.query(`
      UPDATE analysis_projects 
      SET procedure_name = $1, description = $2, status = $3, updated_at = NOW()
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `, [validatedData.procedureName, validatedData.description, validatedData.status, projectId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating analysis project:', error);
    res.status(500).json({ error: 'Ошибка обновления проекта' });
  }
});

// Upload and process requirements documents
router.post('/requirements/upload', requireAuth, upload.array('file'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.body.projectId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Неверный ID проекта' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Файлы не загружены' });
    }

    // Verify project ownership
    const projectResult = await pool.query(`
      SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2
    `, [projectId, userId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const extractedRequirements: any[] = [];

    // Process each uploaded file
    for (const file of files) {
      try {
        // Extract text from file using Python OCR service
        const extractedText = await extractTextFromFile(file.path, file.mimetype);
        
        if (extractedText) {
          // Extract parameters using AI (DeepSeek API would be called here)
          const requirements = await extractRequirementsFromText(extractedText);
          
          // Save requirements to database
          for (let i = 0; i < requirements.length; i++) {
            const req = requirements[i];
            const result = await pool.query(`
              INSERT INTO extracted_requirements 
              (project_id, serial_number, tech_spec_number, extracted_value, confidence, is_approved, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, NOW())
              RETURNING *
            `, [
              projectId,
              extractedRequirements.length + i + 1,
              req.techSpecNumber,
              req.extractedValue,
              req.confidence,
              false
            ]);
            
            extractedRequirements.push(result.rows[0]);
          }
        }
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
      }
    }

    res.json({
      extractedRequirements,
      message: `Обработано файлов: ${files.length}, извлечено параметров: ${extractedRequirements.length}`
    });
  } catch (error) {
    console.error('Error uploading requirements:', error);
    res.status(500).json({ error: 'Ошибка обработки файлов' });
  }
});

// Get extracted requirements for project
router.get('/requirements/:projectId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Неверный ID проекта' });
    }

    // Verify project ownership
    const projectResult = await pool.query(`
      SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2
    `, [projectId, userId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const requirements = await pool.query(`
      SELECT * FROM extracted_requirements 
      WHERE project_id = $1 
      ORDER BY serial_number ASC
    `, [projectId]);

    res.json(requirements.rows);
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ error: 'Ошибка получения требований' });
  }
});

// Create new requirement manually
router.post('/requirements', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const validatedData = requirementSchema.parse(req.body);
    const projectId = parseInt(req.body.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Неверный ID проекта' });
    }

    // Verify project ownership
    const projectResult = await pool.query(`
      SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2
    `, [projectId, userId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const result = await pool.query(`
      INSERT INTO extracted_requirements 
      (project_id, serial_number, tech_spec_number, extracted_value, confidence, is_approved, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [
      projectId,
      validatedData.serialNumber,
      validatedData.techSpecNumber,
      validatedData.extractedValue,
      validatedData.confidence || 1.0,
      validatedData.isApproved
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating requirement:', error);
    res.status(500).json({ error: 'Ошибка создания требования' });
  }
});

// Update requirement
router.put('/requirements/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const requirementId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (isNaN(requirementId)) {
      return res.status(400).json({ error: 'Неверный ID требования' });
    }

    const validatedData = requirementSchema.parse(req.body);

    // Verify ownership through project
    const verifyResult = await pool.query(`
      SELECT er.* FROM extracted_requirements er
      JOIN analysis_projects ap ON er.project_id = ap.id
      WHERE er.id = $1 AND ap.user_id = $2
    `, [requirementId, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Требование не найдено' });
    }

    const result = await pool.query(`
      UPDATE extracted_requirements 
      SET tech_spec_number = $1, extracted_value = $2, confidence = $3, is_approved = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [
      validatedData.techSpecNumber,
      validatedData.extractedValue,
      validatedData.confidence,
      validatedData.isApproved,
      requirementId
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating requirement:', error);
    res.status(500).json({ error: 'Ошибка обновления требования' });
  }
});

// Delete requirement
router.delete('/requirements/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const requirementId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (isNaN(requirementId)) {
      return res.status(400).json({ error: 'Неверный ID требования' });
    }

    // Verify ownership through project
    const verifyResult = await pool.query(`
      SELECT er.* FROM extracted_requirements er
      JOIN analysis_projects ap ON er.project_id = ap.id
      WHERE er.id = $1 AND ap.user_id = $2
    `, [requirementId, userId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Требование не найдено' });
    }

    await pool.query('DELETE FROM extracted_requirements WHERE id = $1', [requirementId]);

    res.json({ message: 'Требование удалено' });
  } catch (error) {
    console.error('Error deleting requirement:', error);
    res.status(500).json({ error: 'Ошибка удаления требования' });
  }
});

export default router;