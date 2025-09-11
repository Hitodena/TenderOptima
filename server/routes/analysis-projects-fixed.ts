import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { z } from 'zod';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { execSync } from 'child_process';
import pg from 'pg';
import OpenAI from 'openai';

const router = Router();
const { Pool } = pg;

// Database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize DeepSeek API client
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, DOC, DOCX, TXT, XLS, XLSX and image files
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/bmp',
      'image/gif'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`));
    }
  }
});

// Get all analysis projects for the current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const result = await pool.query(
      'SELECT * FROM analysis_projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching analysis projects:', error);
    res.status(500).json({ error: 'Ошибка получения проектов' });
  }
});

// Create a new analysis project
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { procedure_name, description } = req.body;

    // Allow creating project without procedure_name
    const result = await pool.query(
      'INSERT INTO analysis_projects (user_id, procedure_name, description, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [userId, procedure_name || null, description || null]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating analysis project:', error);
    res.status(500).json({ error: 'Ошибка создания проекта' });
  }
});

// Upload files to analysis project
router.post('/:projectId/upload', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const projectId = parseInt(req.params.projectId);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Файлы не найдены' });
    }

    const uploadedFiles = [];
    
    for (const file of req.files as Express.Multer.File[]) {
      try {
        const result = await pool.query(
          'INSERT INTO analysis_project_files (project_id, filename, original_name, file_data, mime_type, file_size, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
          [
            projectId,
            `${Date.now()}_${file.originalname}`,
            file.originalname,
            file.buffer,
            file.mimetype,
            file.size
          ]
        );
        
        uploadedFiles.push({
          id: result.rows[0].id,
          filename: result.rows[0].original_name,
          size: result.rows[0].file_size,
          type: result.rows[0].mime_type
        });
      } catch (fileError) {
        console.error(`Error uploading file ${file.originalname}:`, fileError);
      }
    }

    res.json({ 
      success: true, 
      files: uploadedFiles,
      message: `Загружено файлов: ${uploadedFiles.length}`
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Ошибка загрузки файлов' });
  }
});

// Get uploaded files for project
router.get('/:projectId/files', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const projectId = parseInt(req.params.projectId);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const result = await pool.query(
      'SELECT id, filename, original_name, mime_type, file_size, created_at FROM analysis_project_files WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );

    const files = result.rows.map(file => ({
      id: file.id,
      filename: file.original_name,
      size: file.file_size,
      type: file.mime_type,
      uploadedAt: file.created_at
    }));

    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Ошибка получения файлов' });
  }
});

// Delete uploaded file
router.delete('/:projectId/files/:fileId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const projectId = parseInt(req.params.projectId);
    const fileId = parseInt(req.params.fileId);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    // Delete the file
    const result = await pool.query(
      'DELETE FROM analysis_project_files WHERE id = $1 AND project_id = $2 RETURNING *',
      [fileId, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    res.json({ success: true, message: 'Файл удален' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// Update analysis project
router.put('/:projectId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const projectId = parseInt(req.params.projectId);
    const { procedure_name, description } = req.body;
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const result = await pool.query(
      'UPDATE analysis_projects SET procedure_name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [procedure_name, description, projectId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Ошибка обновления проекта' });
  }
});

// Extract parameters from uploaded files using working DeepSeek API
router.post('/:projectId/extract-parameters', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const projectId = parseInt(req.params.projectId);
    console.log(`[Analysis] Starting parameter extraction for project ${projectId}`);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const project = projectResult.rows[0];

    // Check if procedure name is filled
    if (!project.procedure_name || project.procedure_name.trim() === '') {
      return res.status(400).json({ 
        error: 'Необходимо заполнить название процедуры перед извлечением параметров' 
      });
    }

    // Get uploaded files for this project
    const filesResult = await pool.query(
      'SELECT id, filename, original_name, file_data, mime_type, file_size FROM analysis_project_files WHERE project_id = $1',
      [projectId]
    );

    const files = filesResult.rows;
    if (files.length === 0) {
      console.warn(`[Analysis] No files found for project ${projectId}`);
      return res.status(400).json({ error: 'Нет файлов для обработки' });
    }

    console.log(`[Analysis] Found ${files.length} files to process`);
    
    let combinedText = '';
    let processedFilesCount = 0;

    // Process each file to extract text (same as supplier search)
    for (const file of files) {
      try {
        console.log(`[Analysis] Processing file: ${file.original_name} (${file.file_size} bytes)`);
        
        // Save file temporarily for text extraction
        const tempFilePath = path.join(process.cwd(), 'temp', `analysis_${file.id}_${file.filename}`);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempFilePath);
        if (!fsSync.existsSync(tempDir)) {
          fsSync.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write file data to temporary file
        fsSync.writeFileSync(tempFilePath, file.file_data);
        
        // Extract text using Python script (same as supplier search)
        const pythonScriptPath = path.join(process.cwd(), 'extract_text.py');
        const command = `python3 "${pythonScriptPath}" "${tempFilePath}"`;
        
        console.log(`[Analysis] Running text extraction: ${command}`);
        const extractedText = execSync(command, { 
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10,
          timeout: 30000
        });

        if (extractedText && extractedText.trim()) {
          combinedText += `\n\n=== ФАЙЛ: ${file.original_name} ===\n${extractedText.trim()}`;
          processedFilesCount++;
          console.log(`[Analysis] Extracted ${extractedText.length} characters from ${file.original_name}`);
        } else {
          console.warn(`[Analysis] No text extracted from ${file.original_name}`);
        }
        
        // Clean up temporary file
        if (fsSync.existsSync(tempFilePath)) {
          fsSync.unlinkSync(tempFilePath);
        }
        
      } catch (fileError) {
        console.error(`[Analysis] Error processing file ${file.original_name}:`, fileError);
        // Continue with other files
      }
    }

    if (!combinedText.trim()) {
      console.warn(`[Analysis] No text extracted from any files`);
      return res.json({
        success: true,
        extractedRequirements: [],
        totalRequirements: 0,
        totalFiles: processedFilesCount,
        message: 'Не удалось извлечь текст из загруженных файлов'
      });
    }

    console.log(`[Analysis] Total extracted text length: ${combinedText.length} characters`);

    // Use DeepSeek API with exact same implementation as supplier search
    try {
      console.log('[Analysis] Using DeepSeek API for requirement extraction...');
      
      // Check for API key
      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY is not configured');
      }
      
      // Limit text length to avoid token limits (same as supplier search)
      const maxTextLength = 10000;
      const truncatedText = combinedText.length > maxTextLength 
        ? combinedText.substring(0, maxTextLength) + '...(текст сокращен)' 
        : combinedText;
      
      // Use exact DeepSeek API call as supplier search
      const systemPrompt = `Вы эксперт по анализу технических требований и спецификаций в сфере закупок. 

Ваша задача: извлечь из текста конкретные технические параметры и требования, которые будут использоваться для сравнения коммерческих предложений от поставщиков.

Верните ТОЛЬКО валидный JSON массив объектов в следующем формате:
[
  {
    "tech_spec_number": "пункт спецификации (например: 2.1, 3.4.2, А.1)",
    "extracted_value": "конкретное техническое требование",
    "confidence": число_от_0_до_1
  }
]

Правила извлечения:
1. Ищите конкретные технические характеристики: мощность, размеры, материалы, стандарты, сроки, условия
2. Указывайте номер пункта спецификации, если он есть в тексте
3. Если номера пунктов нет, создайте логический номер (1.1, 1.2, и т.д.)
4. Каждое требование должно быть конкретным и измеримым
5. Не включайте общие фразы или описания процедур
6. Confidence: 0.9-1.0 для четких требований, 0.7-0.8 для неточных, 0.5-0.6 для предположений

Если технических требований не найдено, верните: []`;

      const completion = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Проанализируйте следующий текст технической спецификации и извлеките все технические требования:\n\n${truncatedText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        top_p: 0.9
      });

      console.log('[Analysis] DeepSeek API response received');
      
      if (!completion.choices || completion.choices.length === 0) {
        console.warn('[Analysis] Empty response from DeepSeek API');
        throw new Error('Пустой ответ от AI сервиса');
      }

      const content = completion.choices[0]?.message?.content?.trim();
      console.log('[Analysis] DeepSeek API response content:', content?.substring(0, 200));
      
      if (!content) {
        console.warn('[Analysis] Empty content from DeepSeek API');
        throw new Error('Пустой ответ от AI сервиса');
      }

      // Parse JSON response (same logic as supplier search)
      let jsonContent = content;
      
      // Remove any markdown formatting
      if (jsonContent.includes('```json')) {
        jsonContent = jsonContent.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      
      // Try to find JSON array in the response
      const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }
      
      const requirements = JSON.parse(jsonContent);
      
      if (!Array.isArray(requirements)) {
        console.warn('[Analysis] DeepSeek response is not an array:', requirements);
        throw new Error('Invalid response format from AI');
      }
      
      console.log(`[Analysis] Successfully extracted ${requirements.length} requirements`);
      
      // Save extracted requirements to database
      const savedRequirements = [];
      for (const req of requirements.filter(r => r && r.tech_spec_number && r.extracted_value)) {
        try {
          const result = await pool.query(`
            INSERT INTO analysis_extracted_requirements 
            (project_id, tech_spec_number, extracted_value, confidence, is_approved, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
          `, [
            projectId,
            req.tech_spec_number || 'N/A',
            req.extracted_value || '',
            Math.min(Math.max(req.confidence || 0.8, 0), 1),
            false
          ]);
          
          savedRequirements.push(result.rows[0]);
          console.log(`[Analysis] Saved: ${req.tech_spec_number} - ${req.extracted_value.substring(0, 50)}...`);
        } catch (dbError) {
          console.error('[Analysis] Error saving requirement:', dbError);
        }
      }

      console.log(`[Analysis] Successfully saved ${savedRequirements.length} requirements to database`);

      res.json({
        success: true,
        extractedRequirements: savedRequirements,
        totalRequirements: savedRequirements.length,
        totalFiles: processedFilesCount,
        message: `Извлечено ${savedRequirements.length} технических требований из ${processedFilesCount} файлов`
      });

    } catch (aiError) {
      console.error('[Analysis] DeepSeek API error:', aiError);
      res.status(500).json({ 
        error: 'Ошибка AI обработки',
        details: aiError instanceof Error ? aiError.message : 'Unknown AI error'
      });
    }

  } catch (error) {
    console.error('[Analysis] Critical error:', error);
    res.status(500).json({ 
      error: 'Ошибка извлечения параметров',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get extracted requirements for project
router.get('/:projectId/requirements', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const result = await pool.query(
      'SELECT * FROM analysis_extracted_requirements WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ error: 'Ошибка получения требований' });
  }
});

// Update requirement approval status
router.put('/:projectId/requirements/:requirementId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId);
    const requirementId = parseInt(req.params.requirementId);
    const { is_approved, extracted_value } = req.body;
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const result = await pool.query(
      'UPDATE analysis_extracted_requirements SET is_approved = $1, extracted_value = $2, updated_at = NOW() WHERE id = $3 AND project_id = $4 RETURNING *',
      [is_approved, extracted_value, requirementId, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Требование не найдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating requirement:', error);
    res.status(500).json({ error: 'Ошибка обновления требования' });
  }
});

export default router;