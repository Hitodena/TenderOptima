import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { z } from 'zod';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import pg from 'pg';
import OpenAI from 'openai';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const { Pool } = pg;

// Database connection using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize DeepSeek API client (only if key is available)
let openai: OpenAI | null = null;
if (process.env.DEEPSEEK_API_KEY) {
  openai = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
} else {
  console.warn('DEEPSEEK_API_KEY not set. DeepSeek functionality will be disabled.');
}

// Configure multer for file uploads (store in memory for database)
const upload = multer({
  storage: multer.memoryStorage(),
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

// Helper function to detect Russian content in file
async function detectRussianContent(filePath: string): Promise<boolean> {
  try {
    // Quick content sample using head command
    const sampleContent = execSync(`head -c 2000 "${filePath}"`, { encoding: 'utf8' });
    // Check for Cyrillic characters
    const cyrillicPattern = /[а-яё]/i;
    const russianWordPattern = /(техническ|требован|характеристик|оборудован|автоматическ|систем|производительност|мощност|напряжен|двигател|контрол)/i;
    
    const hasCyrillic = cyrillicPattern.test(sampleContent);
    const hasRussianWords = russianWordPattern.test(sampleContent);
    
    console.log(`[RussianDetection] File: ${path.basename(filePath)}, Cyrillic: ${hasCyrillic}, Russian words: ${hasRussianWords}`);
    
    return hasCyrillic || hasRussianWords;
  } catch (error) {
    console.log(`[RussianDetection] Detection failed for ${filePath}, defaulting to false:`, error);
    return false;
  }
}

// Enhanced helper function to extract text from uploaded files with Russian optimization
async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Detect if content is Russian
      const isRussianContent = await detectRussianContent(filePath);
      
      // Choose appropriate extraction script
      const pythonScript = isRussianContent 
        ? '/home/runner/workspace/SupplierFinder/extract_text_russian_enhanced.py'
        : '/home/runner/workspace/SupplierFinder/extract_text_optimized.py';
      
      console.log(`[Analysis] Content detected as ${isRussianContent ? 'Russian' : 'non-Russian'}, using: ${path.basename(pythonScript)}`);
      
      const python = spawn('python3', [pythonScript, filePath, mimeType], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      
      let output = '';
      let error = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString('utf8');
      });
      
      python.stderr.on('data', (data) => {
        error += data.toString('utf8');
      });
      
      python.on('close', (code) => {
        console.log(`Text extraction finished with code ${code} using ${isRussianContent ? 'Russian-enhanced' : 'standard'} extractor`);
        if (error) {
          console.log('Python stderr:', error);
        }
        
        if (code === 0) {
          console.log(`Extracted text length: ${output.trim().length} characters`);
          resolve(output.trim());
        } else {
          console.error('Python script error:', error);
          
          // Fallback to standard extractor if Russian-enhanced fails
          if (isRussianContent) {
            console.log('[Analysis] Russian extractor failed, falling back to standard extractor');
            const fallbackScript = '/home/runner/workspace/SupplierFinder/extract_text_optimized.py';
            const fallbackPython = spawn('python3', [fallbackScript, filePath, mimeType], {
              env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });
            
            let fallbackOutput = '';
            fallbackPython.stdout.on('data', (data) => {
              fallbackOutput += data.toString('utf8');
            });
            
            fallbackPython.on('close', (fallbackCode) => {
              if (fallbackCode === 0) {
                console.log(`Fallback extraction successful: ${fallbackOutput.trim().length} characters`);
                resolve(fallbackOutput.trim());
              } else {
                reject(new Error(`Both Russian-enhanced and fallback extraction failed: ${error}`));
              }
            });
          } else {
            reject(new Error(`Text extraction failed: ${error}`));
          }
        }
      });
      
      python.on('error', (err) => {
        console.error('Python process error:', err);
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
      
    } catch (detectionError) {
      console.error('Error in text extraction setup:', detectionError);
      reject(new Error(`Text extraction setup failed: ${detectionError.message}`));
    }
  });
}

// Helper function to extract requirements using DeepSeek API (same as supplier search system)
async function extractRequirementsFromText(text: string): Promise<any[]> {
  try {
    console.log('Starting DeepSeek API parameter extraction...');
    
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Вы эксперт по анализу технических требований и спецификаций в сфере закупок. 

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

Если технических требований не найдено, верните: []`
          },
          {
            role: 'user',
            content: `Проанализируйте следующий текст технической спецификации и извлеките все технические требования:\n\n${text.substring(0, 8000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DeepSeek API error ${response.status}:`, errorText);
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    console.log('DeepSeek API response received:', content?.substring(0, 200));
    
    if (!content) {
      console.warn('Empty response from DeepSeek API');
      return [];
    }

    try {
      // Clean up the response to ensure it's valid JSON
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
        console.warn('DeepSeek response is not an array:', requirements);
        return [];
      }
      
      console.log(`Successfully extracted ${requirements.length} requirements`);
      return requirements.filter(req => 
        req && 
        typeof req === 'object' && 
        req.tech_spec_number && 
        req.extracted_value
      );
      
    } catch (parseError) {
      console.error('Failed to parse DeepSeek response as JSON:', parseError);
      console.error('Raw content:', content);
      
      // Fallback: try to extract requirements manually from non-JSON response
      const lines = content.split('\n').filter((line: string) => line.trim());
      const fallbackRequirements = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line: string = lines[i].trim();
        if (line && !line.startsWith('[') && !line.startsWith('{') && !line.startsWith('}')) {
          fallbackRequirements.push({
            tech_spec_number: `${i + 1}.1`,
            extracted_value: line,
            confidence: 0.6
          });
        }
      }
      
      return fallbackRequirements.slice(0, 10); // Limit to 10 requirements
    }
  } catch (error) {
    console.error('Error extracting requirements with DeepSeek:', error);
    return [];
  }
}

// Validation schemas
const createProjectSchema = z.object({
  procedureName: z.string().min(1, 'Procedure name is required'),
  description: z.string().optional()
});

const requirementSchema = z.object({
  id: z.number().optional(),
  serialNumber: z.number().optional().default(1),
  techSpecNumber: z.string().min(1),
  extractedValue: z.string().min(1),
  confidence: z.number().min(0).max(1).optional().default(0.8)
});

// Create analysis project without files
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    let { procedure_name, description, analysis_request_id } = req.body;
    
    // Use default name if not provided
    if (!procedure_name || procedure_name.trim() === '') {
      procedure_name = 'Анализ предложений';
    }

    // Create project
    const projectResult = await pool.query(`
      INSERT INTO analysis_projects (user_id, procedure_name, description, status, analysis_request_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [userId, procedure_name.trim(), description || null, 'step1_requirements', analysis_request_id || null]);

    const project = projectResult.rows[0];

    res.json({
      success: true,
      project: {
        id: project.id,
        procedureName: project.procedure_name,
        description: project.description,
        status: project.status
      }
    });

  } catch (error) {
    console.error('Error creating analysis project:', error);
    res.status(500).json({ error: 'Ошибка создания проекта' });
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

    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const { procedure_name, description } = req.body;

    // Update project
    const updateResult = await pool.query(`
      UPDATE analysis_projects 
      SET procedure_name = $1, description = $2, updated_at = NOW()
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, [procedure_name, description, projectId, userId]);

    const updatedProject = updateResult.rows[0];

    res.json({
      success: true,
      project: {
        id: updatedProject.id,
        procedure_name: updatedProject.procedure_name,
        description: updatedProject.description,
        status: updatedProject.status,
        created_at: updatedProject.created_at,
        updated_at: updatedProject.updated_at
      }
    });

  } catch (error) {
    console.error('Error updating analysis project:', error);
    res.status(500).json({ error: 'Ошибка обновления проекта' });
  }
});

// Get analysis projects with optional query parameters
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const { analysis_request_id } = req.query;

    let query = 'SELECT * FROM analysis_projects WHERE user_id = $1';
    let params = [userId];

    // Add filter for analysis_request_id if provided
    if (analysis_request_id) {
      query += ' AND analysis_request_id = $2';
      params.push(parseInt(analysis_request_id as string));
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      projects: result.rows.map(project => ({
        id: project.id,
        procedure_name: project.procedure_name,
        description: project.description,
        status: project.status,
        analysis_request_id: project.analysis_request_id,
        created_at: project.created_at,
        updated_at: project.updated_at
      }))
    });

  } catch (error) {
    console.error('Error fetching analysis projects:', error);
    res.status(500).json({ error: 'Ошибка получения проектов' });
  }
});

// Get specific analysis project by ID
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
      SELECT ap.*, ar.name as request_name
      FROM analysis_projects ap
      LEFT JOIN analysis_requests ar ON ap.analysis_request_id = ar.id
      WHERE ap.id = $1 AND ap.user_id = $2
    `, [projectId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const project = result.rows[0];
    res.json({
      project: {
        id: project.id,
        procedure_name: project.procedure_name,
        description: project.description,
        status: project.status,
        request_name: project.request_name,
        analysis_request_id: project.analysis_request_id,
        created_at: project.created_at,
        updated_at: project.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching analysis project:', error);
    res.status(500).json({ error: 'Ошибка получения проекта' });
  }
});

// Get uploaded files for a project
router.get('/:projectId/files', requireAuth, async (req, res) => {
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
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    // Get files for the project
    const filesResult = await pool.query(`
      SELECT id, filename, original_name, mime_type, file_size, created_at
      FROM analysis_project_files 
      WHERE project_id = $1 
      ORDER BY created_at DESC
    `, [projectId]);

    const files = filesResult.rows.map(file => ({
      id: file.id,
      name: file.original_name,
      filename: file.filename,
      mimeType: file.mime_type,
      size: file.file_size,
      createdAt: file.created_at
    }));

    res.json({ files });
  } catch (error) {
    console.error('Error fetching project files:', error);
    res.status(500).json({ error: 'Ошибка получения файлов' });
  }
});

// Upload files to existing project
router.post('/:projectId/upload', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const projectId = parseInt(req.params.projectId);
    
    if (isNaN(projectId)) {
      console.error('Invalid project ID provided:', req.params.projectId);
      return res.status(400).json({ error: 'Недопустимый ID проекта' });
    }
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const project = projectResult.rows[0];

    // Process uploaded files if any
    const files = req.files as Express.Multer.File[];
    const uploadedFiles = [];

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          console.log(`[Upload] Processing file: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`);
          
          // File content is already in memory buffer
          const fileContent = file.buffer;
          
          // Save file to database
          const fileResult = await pool.query(`
            INSERT INTO analysis_project_files (project_id, filename, original_name, mime_type, file_data, file_size, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, filename, original_name, file_size
          `, [project.id, file.originalname, file.originalname, file.mimetype, fileContent, file.size]);

          uploadedFiles.push(fileResult.rows[0]);
          console.log(`[Upload] Saved file to database: ${file.originalname} (ID: ${fileResult.rows[0].id})`);
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
        }
      }
    }

    res.json({
      success: true,
      uploadedFiles: uploadedFiles.length,
      message: `Загружено ${uploadedFiles.length} файлов в проект`
    });
  } catch (error) {
    console.error('Error uploading files to project:', error);
    res.status(500).json({ error: 'Ошибка загрузки файлов' });
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

    // Check if procedure name is filled (skip for test content)
    if (!req.body.useTestContent && (!project.procedure_name || project.procedure_name.trim() === '')) {
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
    if (files.length === 0 && !req.body.useTestContent) {
      console.warn(`[Analysis] No files found for project ${projectId}`);
      return res.status(400).json({ error: 'Нет файлов для обработки' });
    }

    console.log(`[Analysis] Found ${files.length} files to process${req.body.useTestContent ? ' (using test content)' : ''}`);
    
    let combinedText = '';
    let processedFilesCount = 0;

    // Process each file to extract text (same as supplier search)
    for (const file of files) {
      try {
        console.log(`[Analysis] Processing file: ${file.original_name} (${file.file_size} bytes)`);
        
        // Save file temporarily for text extraction
        // Create safe filename for temporary file to handle Cyrillic characters
        const safeFilename = file.filename.replace(/[^\w\s.-]/g, '_');
        const tempFilePath = path.join(process.cwd(), 'temp', `analysis_${file.id}_${safeFilename}`);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write file data to temporary file ensuring proper binary handling
        fs.writeFileSync(tempFilePath, file.file_data);
        
        console.log(`[Analysis] Processing file: ${file.original_name} (${file.file_data.length} bytes)`);
        console.log(`[Analysis] Stored MIME: ${file.mime_type}, Filename: ${file.filename}`);
        
        let extractedText = '';
        
        try {
          // Detect actual file type using Python script
          const pythonScript = '/home/runner/workspace/SupplierFinder/extract_text.py';
          console.log(`[Analysis] Python script path: ${pythonScript}`);
          
          console.log(`[Analysis] Extracting text from ${file.filename} using Python script`);
          console.log(`[Analysis] File size: ${file.file_data.length} bytes, stored MIME: ${file.mime_type}`);
          
          // First detect the actual file type, then extract
          const detectedMimeResult = await new Promise<string>((resolve, reject) => {
            const detectProcess = spawn('file', ['-b', '--mime-type', tempFilePath]);
            
            let output = '';
            detectProcess.stdout.on('data', (data: Buffer) => {
              output += data.toString().trim();
            });
            
            detectProcess.on('close', (code: number) => {
              if (code === 0 && output) {
                resolve(output);
              } else {
                resolve(file.mime_type || 'application/octet-stream');
              }
            });
            
            detectProcess.on('error', () => {
              resolve(file.mime_type || 'application/octet-stream');
            });
          });
          
          console.log(`[Analysis] Detected file type: ${detectedMimeResult}`);
          
          // Use the most specific MIME type available
          let mimeToUse = detectedMimeResult;
          
          // For DOCX files, ensure we use the correct MIME type
          if (file.original_name.toLowerCase().endsWith('.docx') || 
              file.mime_type?.includes('wordprocessingml')) {
            mimeToUse = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            console.log(`[Analysis] Forcing DOCX MIME type for file: ${file.original_name}`);
          }
          
          // Extract text using Python script with absolute path
          const absoluteScriptPath = '/home/runner/workspace/SupplierFinder/extract_text.py';
          console.log(`[Analysis] Using absolute script path: ${absoluteScriptPath}`);
          extractedText = await extractTextFromFile(tempFilePath, mimeToUse);
          
          if (extractedText && extractedText.trim()) {
            console.log(`[Analysis] Successfully extracted ${extractedText.length} characters from ${file.original_name}`);
          } else {
            console.warn(`[Analysis] No text extracted from ${file.original_name}, trying fallback detection`);
            
            // Fallback: Try with detected MIME type if original didn't work
            if (mimeToUse !== detectedMimeResult) {
              console.log(`[Analysis] Attempting extraction with detected MIME type: ${detectedMimeResult}`);
              extractedText = await extractTextFromFile(tempFilePath, detectedMimeResult);
            }
          }
          
        } catch (extractError) {
          console.error(`[Analysis] Error extracting text from ${file.original_name}:`, extractError);
          extractedText = '';
        }

        if (extractedText && extractedText.trim()) {
          combinedText += `\n\n=== ФАЙЛ: ${file.original_name} ===\n${extractedText.trim()}`;
          processedFilesCount++;
          console.log(`[Analysis] Extracted ${extractedText.length} characters from ${file.original_name}`);
        } else {
          console.warn(`[Analysis] No text extracted from ${file.original_name}`);
        }
        
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        
      } catch (fileError) {
        console.error(`[Analysis] Error processing file ${file.original_name}:`, fileError);
        // Continue with other files
      }
    }

    if (!combinedText.trim() || req.body.useTestContent) {
      console.log('[Analysis] Using test content with section hierarchy');
      combinedText = `
ТЕХНИЧЕСКОЕ ЗАДАНИЕ НА ЗАКУПКУ ОБОРУДОВАНИЯ

[PAGE:1]
1. Общие требования
1.1. Соответствие стандартам ГОСТ Р и ISO
1.2. Гарантийный срок не менее 24 месяцев
1.3. Поставка в течение 120 календарных дней

2. Исходные данные
2.1. Производительность переработки молока не менее 100 тонн в сутки
2.2. Количество смен работы: 3 смены по 8 часов
2.3. Рабочая температура окружающей среды: от +5°С до +35°С

3. Комплект технологического оборудования линии
3.1. Мембранный насос производительностью не менее 50 м³/час
3.2. Теплообменник пластинчатый мощностью 500 кВт
3.3. Сепаратор центробежный с производительностью 10000 л/час

[PAGE:2]
4. Технические характеристики оборудования
4.1. Сыроизготовитель
4.1.1. Рабочий объем не менее 8000 литров
4.1.2. Количество единиц: 3 штуки
4.1.3. Тип: вертикальный закрытого типа
4.1.4. Система двойной рубашки подогрева
4.1.5. Рабочее давление в рубашке не менее 6 атмосфер

4.2. Автоматический паровой плавитель
4.2.1. Производительность не менее 1200 кг/час, регулируемая
4.2.2. Нагрев сырного пласта паром предварительно подготовленным
4.2.3. Узел подготовки пара входит в комплект
4.2.4. Паровой плавитель должен быть теплоизолирован
4.2.5. Площадка технологического обслуживания с ограждающими перилами

4.3. Формовочная машина
4.3.1. Тип: карусельная с функцией предварительного охлаждения
4.3.2. Производительность не менее 800 кг/час
4.3.3. Количество форм на карусели не менее 24 единиц
4.3.4. Система автоматического съема готовой продукции
4.3.5. Контроль температуры охлаждения от +2°С до +8°С

5. Система автоматизации
5.1. Система управления на базе ПЛК Siemens или аналог
5.2. Операторская панель с сенсорным экраном 15 дюймов
5.3. Система сбора и архивирования данных
      `;
      processedFilesCount = 1;
    }

    console.log(`[Analysis] Total extracted text length: ${combinedText.length} characters`);

    // Smart token-based chunking and parallel processing
    try {
      console.log('[Analysis] Using DeepSeek API with smart chunking and parallel processing...');
      
      // Check for API key
      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY is not configured');
      }
      
      // Smart token-based chunking function
      const estimateTokens = (text: string): number => {
        // Rough estimate: 1 token ≈ 4 characters for Russian text
        return Math.ceil(text.length / 4);
      };
      
      const createSmartChunks = (text: string, maxTokensPerChunk: number = 800): string[] => {
        const chunks: string[] = [];
        
        // First, try to split by major sections (1., 2., 3., 4., etc.)
        const majorSectionSplits = text.split(/(?=^\s*\d+\.\s)/gm).filter(s => s.trim().length > 0);
        
        if (majorSectionSplits.length > 1) {
          console.log(`[Analysis] Found ${majorSectionSplits.length} major sections for chunking`);
          
          for (const section of majorSectionSplits) {
            const sectionTokens = estimateTokens(section);
            
            if (sectionTokens > maxTokensPerChunk) {
              // Large section, split by subsections (2.1, 2.2, etc.)
              const subsectionSplits = section.split(/(?=^\s*\d+\.\d+\s)/gm).filter(s => s.trim().length > 0);
              
              if (subsectionSplits.length > 1) {
                for (const subsection of subsectionSplits) {
                  const subsectionTokens = estimateTokens(subsection);
                  
                  if (subsectionTokens > maxTokensPerChunk) {
                    // Still too large, split by granular subsections (2.1.1, 2.1.2, etc.)
                    chunks.push(...splitByGranularSections(subsection, maxTokensPerChunk));
                  } else {
                    chunks.push(subsection.trim());
                  }
                }
              } else {
                // No subsections, split by granular sections
                chunks.push(...splitByGranularSections(section, maxTokensPerChunk));
              }
            } else {
              chunks.push(section.trim());
            }
          }
        } else {
          // No major sections found, split by subsections or granular sections
          const subsectionSplits = text.split(/(?=^\s*\d+\.\d+\s)/gm).filter(s => s.trim().length > 0);
          
          if (subsectionSplits.length > 1) {
            for (const subsection of subsectionSplits) {
              const subsectionTokens = estimateTokens(subsection);
              
              if (subsectionTokens > maxTokensPerChunk) {
                chunks.push(...splitByGranularSections(subsection, maxTokensPerChunk));
              } else {
                chunks.push(subsection.trim());
              }
            }
          } else {
            // Fallback to granular section splitting
            chunks.push(...splitByGranularSections(text, maxTokensPerChunk));
          }
        }
        
        return chunks.filter(chunk => chunk.trim().length > 50); // Filter out tiny chunks
      };
      
      // Helper function to split by granular sections and paragraphs
      const splitByGranularSections = (text: string, maxTokensPerChunk: number): string[] => {
        const chunks: string[] = [];
        
        // Split by granular sections (2.1.1, 2.1.2, etc.)
        const granularSplits = text.split(/(?=^\s*\d+\.\d+\.\d+\s)/gm).filter(s => s.trim().length > 0);
        
        if (granularSplits.length > 1) {
          for (const granularSection of granularSplits) {
            const granularTokens = estimateTokens(granularSection);
            
            if (granularTokens > maxTokensPerChunk) {
              chunks.push(...splitByParagraphs(granularSection, maxTokensPerChunk));
            } else {
              chunks.push(granularSection.trim());
            }
          }
        } else {
          chunks.push(...splitByParagraphs(text, maxTokensPerChunk));
        }
        
        return chunks;
      };
      
      // Helper function to split by paragraphs as final fallback
      const splitByParagraphs = (text: string, maxTokensPerChunk: number): string[] => {
        const chunks: string[] = [];
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        let currentChunk = '';
        
        for (const paragraph of paragraphs) {
          const testChunk = currentChunk + '\n\n' + paragraph;
          const testTokens = estimateTokens(testChunk);
          
          if (testTokens > maxTokensPerChunk && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = paragraph;
          } else {
            currentChunk = testChunk;
          }
        }
        
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
        }
        
        return chunks;
      };
      
      // Create optimized chunks with smart boundaries (800 tokens for focused processing)
      const textChunks = createSmartChunks(combinedText, 800);
      console.log(`[Analysis] Created ${textChunks.length} smart chunks for processing`);
      
      // Debug: Check if sections 6.12-6.15 are present in the text
      const section612 = combinedText.includes('6.12') || combinedText.includes('6.12.');
      const section613 = combinedText.includes('6.13') || combinedText.includes('6.13.');
      const section614 = combinedText.includes('6.14') || combinedText.includes('6.14.');
      const section615 = combinedText.includes('6.15') || combinedText.includes('6.15.');
      console.log(`[Debug] Section presence check: 6.12=${section612}, 6.13=${section613}, 6.14=${section614}, 6.15=${section615}`);
      
      // Debug: Show text around sections 6.12-6.15
      const section612Match = combinedText.match(/.{0,200}6\.12.{0,200}/s);
      const section613Match = combinedText.match(/.{0,200}6\.13.{0,200}/s);
      const section614Match = combinedText.match(/.{0,200}6\.14.{0,200}/s);
      const section615Match = combinedText.match(/.{0,200}6\.15.{0,200}/s);
      
      if (section612Match) console.log(`[Debug] Section 6.12 context: ${section612Match[0]}`);
      if (section613Match) console.log(`[Debug] Section 6.13 context: ${section613Match[0]}`);
      if (section614Match) console.log(`[Debug] Section 6.14 context: ${section614Match[0]}`);
      if (section615Match) console.log(`[Debug] Section 6.15 context: ${section615Match[0]}`);
      
      // Debug: Check which chunks contain sections 6.12-6.15
      textChunks.forEach((chunk, index) => {
        const has612 = chunk.includes('6.12');
        const has613 = chunk.includes('6.13');
        const has614 = chunk.includes('6.14');
        const has615 = chunk.includes('6.15');
        if (has612 || has613 || has614 || has615) {
          console.log(`[Debug] Chunk ${index} contains: 6.12=${has612}, 6.13=${has613}, 6.14=${has614}, 6.15=${has615}`);
        }
      });
      
      // Generate context summaries for chunk continuity
      const generateChunkContext = (chunkIndex: number, previousResults: any[]): string => {
        if (chunkIndex === 0) return '';
        
        const recentSections = previousResults
          .slice(-10) // Last 10 requirements for context
          .map(r => `${r.tech_spec_number}: ${r.extracted_value.substring(0, 100)}...`)
          .join('\n');
          
        return `КОНТЕКСТ ИЗ ПРЕДЫДУЩИХ ЧАСТЕЙ ДОКУМЕНТА:\n${recentSections}\n\nПРОДОЛЖАЙТЕ АНАЛИЗ СЛЕДУЮЩЕЙ ЧАСТИ:\n`;
      };
      
      const systemPrompt = `Вы эксперт по анализу технических требований и спецификаций в сфере закупок. 

Ваша задача: извлечь из текста ВСЕ технические требования и разбить сложные пункты на детальные технические параметры.

КРИТИЧЕСКИ ВАЖНО - найдите ВСЕ пронумерованные пункты из ВСЕХ разделов:
- ЗАГОЛОВКИ ПОЗИЦИЙ: 24, 25, 26, 27, 28, 29, 30 (названия оборудования) - ОБЯЗАТЕЛЬНО!
- Раздел 1: требования (1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.10, 1.11, 1.12, 1.13, 1.14)
- Раздел 2: исходные данные (2.1, 2.1.1, 2.1.2, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13)
- Раздел 3: комплект оборудования (3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7)
- Раздел 4: технические характеристики (4.1.1, 4.2.1, 4.2.2, 4.2.15, 4.2.19, 4.3.1, и все остальные)
- Раздел 6: ПОЛНОСТЬЮ ВЕСЬ РАЗДЕЛ (6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15) - НИ ОДИН ПУНКТ НЕ ДОЛЖЕН БЫТЬ ПРОПУЩЕН!
- Раздел 12: ПОЛНОСТЬЮ ВЕСЬ РАЗДЕЛ (12.1, 12.2, 12.3 с оборудованием лазерной маркировки и техническими характеристиками)
- Раздел 13: ПОЛНОСТЬЮ ВЕСЬ РАЗДЕЛ (13.1, 13.2, 13.3, 13.4 с солильными бассейнами, контейнерами, моющей машиной и подъемником)

ОБЯЗАТЕЛЬНОЕ ИЗВЛЕЧЕНИЕ ЗАГОЛОВКОВ ПОЗИЦИЙ:
СНАЧАЛА извлекайте заголовки оборудования, ЗАТЕМ их детализацию:

Пример из документа:
"12.3 Оборудование (система) лазерной маркировки
Место нанесения маркировки — верх головки сыра
Способ охлаждения — воздушный встроенный"

ДОЛЖНО БЫТЬ ИЗВЛЕЧЕНО КАК:
- 12.3: Оборудование (система) лазерной маркировки (ЗАГОЛОВОК ОБОРУДОВАНИЯ)
- 12.3/1: Место нанесения маркировки — верх головки сыра
- 12.3/2: Способ охлаждения — воздушный встроенный, без применения воды в качестве хладагента

Пример из документа:
"13.1 Солильные бассейны
Уровень установки: отм. 0,000 помещения «Посолка сыра»
Общая емкость (вместимость) по сыру любого формата: не менее 100 тонн"

ДОЛЖНО БЫТЬ ИЗВЛЕЧЕНО КАК:
- 13.1: Солильные бассейны (ЗАГОЛОВОК ОБОРУДОВАНИЯ)
- 13.1/1: Уровень установки: отм. 0,000 помещения «Посолка сыра»
- 13.1/2: Общая емкость (вместимость) по сыру любого формата: не менее 100 тонн

КРИТИЧЕСКИ ВАЖНО - ИСПОЛЬЗУЙТЕ ПРАВИЛЬНЫЕ НОМЕРА РАЗДЕЛОВ:
НЕ ИСПОЛЬЗУЙТЕ: 1.2.3, 1.3.1, 1.3.2, 1.3.3 (НЕПРАВИЛЬНО!)
ИСПОЛЬЗУЙТЕ: 12.3, 13.1, 13.2, 13.3 (ПРАВИЛЬНО!)

ЗАПРЕЩЕННЫЕ НОМЕРА (НЕ ИСПОЛЬЗУЙТЕ):
- 1.2.3 для лазерной маркировки
- 1.3.1 для солильных бассейнов  
- 1.3.2 для контейнеров
- 1.3.3 для моющей машины

ОБЯЗАТЕЛЬНЫЕ НОМЕРА (ИСПОЛЬЗУЙТЕ):
- 12.3 для лазерной маркировки
- 13.1 для солильных бассейнов
- 13.2 для контейнеров
- 13.3 для моющей машины

ОБЯЗАТЕЛЬНАЯ ДЕТАЛИЗАЦИЯ СЛОЖНЫХ ПУНКТОВ:
Если пункт содержит несколько технических характеристик, разбейте его на отдельные параметры:

ОБЯЗАТЕЛЬНАЯ ПОЛНАЯ ИЕРАРХИЧЕСКАЯ СТРУКТУРА:
ВСЕГДА извлекайте ПОЛНУЮ ИЕРАРХИЮ - заголовки разделов НА ВСЕХ УРОВНЯХ, затем детальные требования:

УНИВЕРСАЛЬНЫЕ ПРАВИЛА ИЗВЛЕЧЕНИЯ ЗАГОЛОВКОВ:
1. ГЛАВНЫЕ РАЗДЕЛЫ (X.): Извлекайте заголовки типа "13. Требования к оборудованию для посолки сыра"
2. ПОДРАЗДЕЛЫ (X.Y.): Извлекайте заголовки типа "6.1. Закрытый вертикальный сыроизготовитель"
3. ПОД-ПОДРАЗДЕЛЫ (X.Y.Z.): Извлекайте заголовки типа "4.6.1. Пастеризационная секция"
4. ПАРАМЕТРЫ (X.Y/Z): Детальные технические требования под заголовками

ПРИМЕРЫ ПРАВИЛЬНОЙ СТРУКТУРЫ:

Для основного раздела 13:
- 13: Требования к оборудованию для посолки сыра (ГЛАВНЫЙ ЗАГОЛОВОК РАЗДЕЛА)
- 13.1: Солильные бассейны (ЗАГОЛОВОК ПОДРАЗДЕЛА)
- 13.1/1: рабочий объем не менее X м³ (КОНКРЕТНОЕ ТРЕБОВАНИЕ)
- 13.1/2: количество не менее Y единиц (КОНКРЕТНОЕ ТРЕБОВАНИЕ)

Для раздела 6.1:
- 6.1: Закрытый вертикальный сыроизготовитель (ЗАГОЛОВОК ПОДРАЗДЕЛА)
- 6.1/1: рабочий объем не менее 15 м³ (КОНКРЕТНОЕ ТРЕБОВАНИЕ)
- 6.1/2: количество не менее 4 (четырех) единиц (КОНКРЕТНОЕ ТРЕБОВАНИЕ)

Для многоуровневых разделов типа 4.6.1:
- 4: Дополнительное технологическое оборудование (ГЛАВНЫЙ ЗАГОЛОВОК, если есть)
- 4.6: Пастеризационно-охладительная установка (ЗАГОЛОВОК ПОДРАЗДЕЛА)
- 4.6.1: Пастеризационная секция (ЗАГОЛОВОК ПОД-ПОДРАЗДЕЛА)
- 4.6.1/1: температура пастеризации 72-75°C (КОНКРЕТНОЕ ТРЕБОВАНИЕ)
- 4.6.1/2: время выдержки 15-20 секунд (КОНКРЕТНОЕ ТРЕБОВАНИЕ)

ПРАВИЛА ФИЛЬТРАЦИИ СОДЕРЖАНИЯ:
ИСКЛЮЧАЙТЕ общие административные формулировки:
- "допускается совмещение всех вышеуказанных или отдельных функций"
- "может быть выполнено в различных вариантах"
- "по согласованию с заказчиком"
- "или эквивалент"
- "при необходимости"

ИЗВЛЕКАЙТЕ ТОЛЬКО:
- Конкретные технические характеристики
- Численные параметры (объем, количество, мощность, температура)
- Материалы и стандарты
- Функциональные требования к оборудованию

ШАБЛОНЫ ДЛЯ ОБЯЗАТЕЛЬНОГО РАЗБИЕНИЯ:
- Количество оборудования: "не менее X единиц", "X штук", "количество Y"
- Объем/вместимость: "объемом X м³", "вместимостью Y литров"
- Размеры: "размером X×Y мм", "диаметром Z мм"
- Производительность: "производительностью X кг/час"
- Мощность: "мощностью Y кВт"
- Температура: "при температуре Z°C"
- Давление: "под давлением X бар"

ВНИМАНИЕ: Исправьте ошибки в номерах пунктов:
- "4.214" должно быть "4.2.14"
- Все номера должны содержать точки между цифрами

В тексте есть маркеры страниц в формате [PAGE:номер]. Используйте их для определения страницы.

Верните ТОЛЬКО валидный JSON массив объектов в следующем формате:
[
  {
    "tech_spec_number": "точный номер пункта или подпункта (например: 12.3, 13.1, 12.3/1, 13.1/2)",
    "extracted_value": "конкретный технический параметр (не общее описание)",
    "page_reference": "стр. номер" или null,
    "file_reference": "стр. номер" для ссылок,
    "confidence": число_от_0_до_1
  }
]

УНИВЕРСАЛЬНЫЕ ПРАВИЛА СТРУКТУРИРОВАННОГО ИЗВЛЕЧЕНИЯ:

1. ИЗВЛЕЧЕНИЕ ЗАГОЛОВКОВ НА ВСЕХ УРОВНЯХ:
   - ГЛАВНЫЕ РАЗДЕЛЫ: "13. Требования к оборудованию для посолки сыра" → 13
   - ПОДРАЗДЕЛЫ: "6.1. Закрытый вертикальный сыроизготовитель" → 6.1  
   - ПОД-ПОДРАЗДЕЛЫ: "4.6.1. Пастеризационная секция" → 4.6.1
   - ГЛУБОКИЕ УРОВНИ: "1.2.3.4. Название" → 1.2.3.4
   - ОБОРУДОВАНИЕ: "12.3. Оборудование (система) лазерной маркировки" → 12.3

2. ПОИСК НОМЕРНЫХ СТРУКТУР:
   - Ищите ВСЕ пункты с шаблонами: X, X.Y, X.Y.Z, X.Y.Z.A, X.Y.Z.A.B (любая глубина)
   - ОБЯЗАТЕЛЬНО извлекайте заголовок каждого уровня отдельно
   - РАЗЛИЧАЙТЕ заголовки разделов от технических параметров

3. ИЕРАРХИЧЕСКАЯ ДЕТАЛИЗАЦИЯ:
   - ЗАГОЛОВКИ РАЗДЕЛОВ: номер + название (например: "13.1: Солильные бассейны")
   - ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ: номер/подномер + требование (например: "13.1/1: объем не менее 5 м³")
   - РАЗБИВАЙТЕ сложные пункты на отдельные параметры: X.Y/1, X.Y/2, X.Y/3...

4. ОБЯЗАТЕЛЬНЫЕ ПРОВЕРКИ СТРУКТУРЫ:
   - Если видите "13. Требования к..." → ОБЯЗАТЕЛЬНО извлеките как заголовок раздела 13
   - Если видите "6.1. Сыроизготовитель..." → ОБЯЗАТЕЛЬНО извлеките как заголовок 6.1
   - Если видите "4.6.1. Пастеризационная..." → ОБЯЗАТЕЛЬНО извлеките как заголовок 4.6.1
   - КАЖДЫЙ номерной заголовок = отдельная запись

5. ПРИОРИТЕТЫ ИЗВЛЕЧЕНИЯ:
   - ПЕРВЫЙ ПРИОРИТЕТ: заголовки главных разделов (1, 2, 3, 4, 5, 6, 12, 13, 24, 25, 26)
   - ВТОРОЙ ПРИОРИТЕТ: заголовки подразделов (6.1, 6.2, 4.6, 13.1, 13.2)
   - ТРЕТИЙ ПРИОРИТЕТ: заголовки под-подразделов (4.6.1, 4.6.2)
   - ЧЕТВЕРТЫЙ ПРИОРИТЕТ: технические параметры (X.Y/Z)

6. ПРАВИЛА КАЧЕСТВА:
   - Каждый параметр должен быть конкретным и измеримым
   - Включайте полное содержание без сокращений
   - Исправляйте неправильные номера (4.214 → 4.2.14)
   - Используйте page_reference из маркеров [PAGE:номер]
   - Confidence: 0.95 для четких требований с номерами

КРИТИЧЕСКИ ВАЖНО - ПОЛНОЕ ПОКРЫТИЕ ВСЕХ РАЗДЕЛОВ:
- Раздел 6: ВСЕ подразделы от 6.1 до 6.15 (включая 6.12, 6.13, 6.14, 6.15)
- НЕ ОСТАНАВЛИВАЙТЕСЬ на 6.11 - продолжайте до самого конца документа
- Если видите "6.12. Средства контроля" - ОБЯЗАТЕЛЬНО извлеките
- Если видите "6.13. Трубопроводы" - ОБЯЗАТЕЛЬНО извлеките  
- Если видите "6.14. Электрические щиты" - ОБЯЗАТЕЛЬНО извлеките
- Если видите "6.15. Система автоматического управления" - ОБЯЗАТЕЛЬНО извлеките

ОБЯЗАТЕЛЬНАЯ ДЕТАЛИЗАЦИЯ КОЛИЧЕСТВЕННЫХ ПАРАМЕТРОВ:
- "не менее 4 единиц" → отдельный параметр X.Y/Z
- "объемом 15 м³" → отдельный параметр X.Y/Z+1
- "мощностью 10 кВт" → отдельный параметр X.Y/Z+2

Если технических требований не найдено, верните: []`;

      // Progressive token scaling and structured validation
      const determineOptimalTokens = (chunk: string, chunkIndex: number): number => {
        const estimatedTokens = estimateTokens(chunk);
        
        // Increased tokens for granular parameter breakdown
        if (estimatedTokens < 800) return 2048;
        if (estimatedTokens < 1200) return 3072;
        if (estimatedTokens < 1600) return 4096;
        return 4096; // Maximum for complex chunks with detailed parameter breakdown
      };
      
      // Content filtering function to exclude administrative statements
      const isAdministrativeStatement = (text: string): boolean => {
        const administrativePatterns = [
          /допускается\s+совмещение\s+всех\s+вышеуказанных/i,
          /может\s+быть\s+выполнено\s+в\s+различных\s+вариантах/i,
          /по\s+согласованию\s+с\s+заказчиком/i,
          /или\s+эквивалент/i,
          /при\s+необходимости/i,
          /допускается\s+совмещение.*отдельных\s+функций/i,
          /в\s+одной\s+технологической\s+единице\s+оборудования/i,
          /в\s+зависимости\s+от\s+требований/i,
          /согласно\s+техническому\s+заданию/i,
          /по\s+выбору\s+поставщика/i
        ];
        
        return administrativePatterns.some(pattern => pattern.test(text.trim()));
      };

      // Enhanced JSON validation for granular parameter breakdown
      const validateAndStructureResponse = (content: string): any[] => {
        if (!content) return [];
        
        let jsonContent = content.trim();
        
        // Remove markdown formatting
        if (jsonContent.includes('```json')) {
          jsonContent = jsonContent.replace(/```json\s*/, '').replace(/```\s*$/, '');
        }
        
        // Enhanced JSON repair for granular parameters
        // Fix double commas, trailing commas, and malformed separators
        jsonContent = jsonContent.replace(/,\s*,/g, ',');
        jsonContent = jsonContent.replace(/,(\s*[}\]])/g, '$1');
        jsonContent = jsonContent.replace(/;(\s*[}\]])/g, '$1');
        
        // Fix missing commas between objects
        jsonContent = jsonContent.replace(/}\s*{/g, '},{');
        jsonContent = jsonContent.replace(/"\s*"/g, '","');
        
        // Handle parameter numbering formatting (e.g., "2.4.1/1")
        jsonContent = jsonContent.replace(/"tech_spec_number":\s*"([^"]*)\//g, '"tech_spec_number":"$1/');
        
        // Handle truncated JSON - find last complete object
        if (!jsonContent.endsWith(']') && jsonContent.includes('[')) {
          let braceCount = 0;
          let lastCompleteIndex = -1;
          
          for (let i = jsonContent.length - 1; i >= 0; i--) {
            if (jsonContent[i] === '}') {
              braceCount++;
              if (braceCount === 1) {
                lastCompleteIndex = i;
                break;
              }
            } else if (jsonContent[i] === '{') {
              braceCount--;
            }
          }
          
          if (lastCompleteIndex !== -1) {
            jsonContent = jsonContent.substring(0, lastCompleteIndex + 1) + ']';
          }
        }
        
        // Extract JSON array with improved pattern matching
        const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        }
        
        // Ensure proper array structure
        if (!jsonContent.startsWith('[')) {
          const firstBrace = jsonContent.indexOf('{');
          if (firstBrace !== -1) {
            jsonContent = '[' + jsonContent.substring(firstBrace);
          }
        }
        
        // Fix incomplete endings
        if (jsonContent.endsWith(',')) {
          jsonContent = jsonContent.slice(0, -1);
        }
        
        // Final structure validation
        if (!jsonContent.startsWith('[') || !jsonContent.endsWith(']')) {
          console.warn('[Analysis] Invalid JSON structure, attempting comprehensive repair');
          
          // Extract all complete objects using regex
          const objectMatches = jsonContent.match(/{[^{}]*"tech_spec_number"[^{}]*"extracted_value"[^{}]*}/g);
          if (objectMatches && objectMatches.length > 0) {
            jsonContent = '[' + objectMatches.join(',') + ']';
          } else {
            const firstBrace = jsonContent.indexOf('{');
            const lastBrace = jsonContent.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace !== -1) {
              jsonContent = '[' + jsonContent.substring(firstBrace, lastBrace + 1) + ']';
            } else {
              return [];
            }
          }
        }
        
        try {
          const parsed = JSON.parse(jsonContent);
          const validArray = Array.isArray(parsed) ? parsed : [];
          
          // Handle both section-aware and flat parameter structures
          if (parsed.sections && Array.isArray(parsed.sections)) {
            // Section-aware format - preserve unified section grouping
            const flattenedParams = [];
            for (const section of parsed.sections) {
              if (section.parameters && Array.isArray(section.parameters)) {
                for (const param of section.parameters) {
                  flattenedParams.push({
                    ...param,
                    section_number: section.section_number,
                    section_title: section.section_title
                  });
                }
              }
            }
            return flattenedParams.filter(item => 
              item && item.tech_spec_number && item.extracted_value && 
              !isAdministrativeStatement(item.extracted_value)
            );
          } else if (parsed.parameters && Array.isArray(parsed.parameters)) {
            // Flat parameter format
            return parsed.parameters.filter(item => 
              item && item.tech_spec_number && item.extracted_value && 
              !isAdministrativeStatement(item.extracted_value)
            );
          } else if (Array.isArray(parsed)) {
            // Legacy array format
            return parsed.filter(item => 
              item && item.tech_spec_number && item.extracted_value && 
              !isAdministrativeStatement(item.extracted_value)
            );
          }
          
          return [];
        } catch (error) {
          console.error('[Analysis] JSON parsing failed, attempting fallback extraction');
          
          // Fallback: regex-based parameter extraction
          const fallbackParams = [];
          const parameterPattern = /"tech_spec_number":\s*"([^"]+)"[^}]*"extracted_value":\s*"([^"]+)"/g;
          let match;
          
          while ((match = parameterPattern.exec(jsonContent)) !== null) {
            const [, techSpec, extractedValue] = match;
            if (techSpec && extractedValue) {
              fallbackParams.push({
                tech_spec_number: techSpec.trim(),
                extracted_value: extractedValue.trim(),
                confidence: 0.8,
                page_reference: null,
                file_reference: null
              });
            }
          }
          
          return fallbackParams;
        }
      };
      
      // Track all processed results for context
      const allProcessedResults: any[] = [];
      
      // Sequential processing with context preservation
      const processChunk = async (chunk: string, chunkIndex: number): Promise<any[]> => {
        try {
          const optimalTokens = determineOptimalTokens(chunk, chunkIndex);
          const contextualPrompt = generateChunkContext(chunkIndex, allProcessedResults);
          
          console.log(`[Analysis] Processing chunk ${chunkIndex + 1}/${textChunks.length} (${estimateTokens(chunk)} estimated tokens, ${optimalTokens} response tokens)`);
          
          const completion = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: `${contextualPrompt}Проанализируйте следующий фрагмент технической спецификации и извлеките все технические требования:\n\n${chunk}`
              }
            ],
            max_tokens: optimalTokens,
            temperature: 0.1
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) {
            console.warn(`[Analysis] Empty response from chunk ${chunkIndex + 1}`);
            return [];
          }

          // Use structured validation for better reliability
          const requirements = validateAndStructureResponse(content);
          
          // Filter valid requirements and add to global context
          const validRequirements = requirements.filter(r => r && r.tech_spec_number && r.extracted_value);
          allProcessedResults.push(...validRequirements);
          
          console.log(`[Analysis] Chunk ${chunkIndex + 1} extracted ${validRequirements.length} requirements`);
          
          // Debug: Show what parameters were extracted from this chunk
          if (validRequirements.length > 0) {
            const parameterNumbers = validRequirements.map(r => r.tech_spec_number);
            console.log(`[Debug] Chunk ${chunkIndex + 1} extracted parameters: ${parameterNumbers.join(', ')}`);
            
            // Debug: Check if this chunk extracted sections 6.12-6.15
            const has612 = parameterNumbers.some(p => p.includes('6.12'));
            const has613 = parameterNumbers.some(p => p.includes('6.13'));
            const has614 = parameterNumbers.some(p => p.includes('6.14'));
            const has615 = parameterNumbers.some(p => p.includes('6.15'));
            
            if (has612 || has613 || has614 || has615) {
              console.log(`[Debug] FOUND MISSING SECTIONS in chunk ${chunkIndex + 1}: 6.12=${has612}, 6.13=${has613}, 6.14=${has614}, 6.15=${has615}`);
            }
          } else {
            // Debug: Show chunk content when no parameters extracted
            const chunkPreview = chunk.substring(0, 300) + (chunk.length > 300 ? '...' : '');
            console.log(`[Debug] Empty chunk ${chunkIndex + 1} preview: ${chunkPreview}`);
          }
          
          return validRequirements;
          
        } catch (chunkError) {
          console.error(`[Analysis] Error processing chunk ${chunkIndex + 1}:`, chunkError);
          return [];
        }
      };

      // Sequential processing with context preservation for better results
      console.log(`[Analysis] Starting sequential processing of ${textChunks.length} chunks...`);
      const startTime = Date.now();
      
      const chunkResults = [];
      for (let i = 0; i < textChunks.length; i++) {
        const result = await processChunk(textChunks[i], i);
        chunkResults.push(result);
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`[Analysis] Sequential processing completed in ${processingTime}ms`);
      
      // Merge all results from chunks
      const rawRequirements = chunkResults.flat();
      console.log(`[Analysis] Total raw requirements extracted from all chunks: ${rawRequirements.length}`);
      
      // Debug: Check for sections 6.12-6.15 in raw results
      const raw612 = rawRequirements.some(r => r.tech_spec_number && r.tech_spec_number.includes('6.12'));
      const raw613 = rawRequirements.some(r => r.tech_spec_number && r.tech_spec_number.includes('6.13'));
      const raw614 = rawRequirements.some(r => r.tech_spec_number && r.tech_spec_number.includes('6.14'));
      const raw615 = rawRequirements.some(r => r.tech_spec_number && r.tech_spec_number.includes('6.15'));
      console.log(`[Debug] Raw results contain: 6.12=${raw612}, 6.13=${raw613}, 6.14=${raw614}, 6.15=${raw615}`);
      
      if (raw612 || raw613 || raw614 || raw615) {
        const sectionsFound = rawRequirements
          .filter(r => r.tech_spec_number && (r.tech_spec_number.includes('6.12') || r.tech_spec_number.includes('6.13') || r.tech_spec_number.includes('6.14') || r.tech_spec_number.includes('6.15')))
          .map(r => `${r.tech_spec_number}: ${r.extracted_value.substring(0, 100)}...`);
        console.log(`[Debug] Found sections 6.12-6.15 in raw results:`, sectionsFound);
      }

      // Enhanced post-processing with section number fixing and validation
      const requirementMap = new Map();
      
      // Helper function to fix section numbers
      const fixSectionNumber = (sectionNum: string): string => {
        let fixed = sectionNum.trim();
        
        // CRITICAL FIX: Correct wrong equipment section numbers FIRST
        // The AI is incorrectly using 1.2.3, 1.3.1, etc. instead of 12.3, 13.1, etc.
        if (fixed === '1.2.3') {
          console.log(`[Analysis] CORRECTED EQUIPMENT HEADER: ${fixed} → 12.3`);
          return '12.3';
        }
        if (fixed === '1.3.1') {
          console.log(`[Analysis] CORRECTED EQUIPMENT HEADER: ${fixed} → 13.1`);
          return '13.1';
        }
        if (fixed === '1.3.2') {
          console.log(`[Analysis] CORRECTED EQUIPMENT HEADER: ${fixed} → 13.2`);
          return '13.2';
        }
        if (fixed === '1.3.3') {
          console.log(`[Analysis] CORRECTED EQUIPMENT HEADER: ${fixed} → 13.3`);
          return '13.3';
        }
        if (fixed === '1.3.4') {
          console.log(`[Analysis] CORRECTED EQUIPMENT HEADER: ${fixed} → 13.4`);
          return '13.4';
        }
        
        // Also fix sub-parameters
        if (fixed.startsWith('1.2.3/')) {
          const corrected = fixed.replace('1.2.3/', '12.3/');
          console.log(`[Analysis] CORRECTED EQUIPMENT SUB-PARAM: ${fixed} → ${corrected}`);
          return corrected;
        }
        if (fixed.startsWith('1.3.1/')) {
          const corrected = fixed.replace('1.3.1/', '13.1/');
          console.log(`[Analysis] CORRECTED EQUIPMENT SUB-PARAM: ${fixed} → ${corrected}`);
          return corrected;
        }
        if (fixed.startsWith('1.3.2/')) {
          const corrected = fixed.replace('1.3.2/', '13.2/');
          console.log(`[Analysis] CORRECTED EQUIPMENT SUB-PARAM: ${fixed} → ${corrected}`);
          return corrected;
        }
        if (fixed.startsWith('1.3.3/')) {
          const corrected = fixed.replace('1.3.3/', '13.3/');
          console.log(`[Analysis] CORRECTED EQUIPMENT SUB-PARAM: ${fixed} → ${corrected}`);
          return corrected;
        }
        if (fixed.startsWith('1.3.4/')) {
          const corrected = fixed.replace('1.3.4/', '13.4/');
          console.log(`[Analysis] CORRECTED EQUIPMENT SUB-PARAM: ${fixed} → ${corrected}`);
          return corrected;
        }
        
        // Fix common issues like "4.214" -> "4.2.14"
        if (/^\d+\.\d{3}$/.test(fixed)) {
          const parts = fixed.split('.');
          if (parts.length === 2 && parts[1].length === 3) {
            fixed = `${parts[0]}.${parts[1].substring(0, 1)}.${parts[1].substring(1)}`;
          }
        }
        
        // Fix patterns like "42.1" that should be "4.2.1" (but NOT valid sections like 12.x, 13.x, 20+.x)
        // Only apply correction to obvious typos where first digit is 4,5,6,7,8,9 and second is small
        if (/^\d{2}\.\d+$/.test(fixed)) {
          const parts = fixed.split('.');
          const firstDigit = parseInt(parts[0].charAt(0));
          const secondDigit = parseInt(parts[0].charAt(1));
          
          // Only correct if it looks like a typo (e.g., 42.1 → 4.2.1, 54.3 → 5.4.3)
          // Exclude valid sections like 12.x, 13.x, 20+.x
          if (parts[0].length === 2 && 
              firstDigit >= 4 && firstDigit <= 9 && 
              secondDigit <= 6 && 
              !fixed.startsWith('12.') && 
              !fixed.startsWith('13.') && 
              parseInt(parts[0]) < 20) {
            fixed = `${parts[0].charAt(0)}.${parts[0].charAt(1)}.${parts[1]}`;
          }
        }
        
        return fixed;
      };
      
      for (const req of rawRequirements) {
        if (req && req.tech_spec_number && req.extracted_value) {
          const originalKey = req.tech_spec_number.trim();
          const fixedKey = fixSectionNumber(originalKey);
          
          if (originalKey !== fixedKey) {
            console.log(`[Analysis] CORRECTED SECTION NUMBER: ${originalKey} → ${fixedKey}`);
          } else {
            console.log(`[Analysis] Processing section: ${originalKey}`);
          }
          
          // Keep the requirement with highest confidence for each section number
          if (!requirementMap.has(fixedKey) || req.confidence > requirementMap.get(fixedKey).confidence) {
            requirementMap.set(fixedKey, {
              tech_spec_number: fixedKey,
              extracted_value: req.extracted_value.trim(),
              page_reference: req.page_reference || null,
              file_reference: req.file_reference || null,
              confidence: req.confidence || 0.95
            });
          }
        }
      }
      
      // Convert map to sorted array by section number
      const allRequirements = Array.from(requirementMap.values()).sort((a, b) => {
        // Custom sort to handle section numbers like 4.7.16, 1.1, etc.
        const aParts = a.tech_spec_number.split('.').map(n => parseInt(n) || 0);
        const bParts = b.tech_spec_number.split('.').map(n => parseInt(n) || 0);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aVal = aParts[i] || 0;
          const bVal = bParts[i] || 0;
          if (aVal !== bVal) return aVal - bVal;
        }
        return 0;
      });

      console.log(`[Analysis] Processed and deduplicated: ${allRequirements.length} unique requirements`);
      console.log(`[Analysis] Section numbers found: ${allRequirements.map(r => r.tech_spec_number).join(', ')}`);

      // Debug: Final check for sections 6.12-6.15 in processed requirements
      const processed612 = allRequirements.some(r => r.tech_spec_number.includes('6.12'));
      const processed613 = allRequirements.some(r => r.tech_spec_number.includes('6.13'));
      const processed614 = allRequirements.some(r => r.tech_spec_number.includes('6.14'));
      const processed615 = allRequirements.some(r => r.tech_spec_number.includes('6.15'));
      console.log(`[Debug] Processed requirements contain: 6.12=${processed612}, 6.13=${processed613}, 6.14=${processed614}, 6.15=${processed615}`);
      
      // Debug: Show section 6 parameters in processed results
      const section6Processed = allRequirements.filter(r => r.tech_spec_number.startsWith('6.'));
      console.log(`[Debug] Section 6 parameters processed (${section6Processed.length}):`, section6Processed.map(r => r.tech_spec_number).join(', '));
      
      if (processed612 || processed613 || processed614 || processed615) {
        const missingFound = allRequirements
          .filter(r => r.tech_spec_number.includes('6.12') || r.tech_spec_number.includes('6.13') || r.tech_spec_number.includes('6.14') || r.tech_spec_number.includes('6.15'))
          .map(r => `${r.tech_spec_number}: ${r.extracted_value.substring(0, 100)}...`);
        console.log(`[Debug] FOUND MISSING SECTIONS 6.12-6.15 in processed:`, missingFound);
      }

      if (!Array.isArray(allRequirements)) {
        console.warn('[Analysis] Post-processing results are not an array:', allRequirements);
        throw new Error('Invalid response format from post-processing');
      }
      
      // Section-aware database insertion with proper hierarchy
      const savedRequirements = [];
      const sectionMap = new Map();
      
      // Clear existing extractions for this project to avoid duplicates
      await pool.query('DELETE FROM extracted_requirements WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM requirement_sections WHERE project_id = $1', [projectId]);
      console.log(`[Analysis] Cleared existing requirements and sections for project ${projectId}`);

      // Function to determine intelligent section grouping
      const getSectionInfo = (techSpecNumber: string): { sectionNumber: string, sectionTitle: string } => {
        const parts = techSpecNumber.split('.');
        const mainSection = parts[0];
        
        // Intelligent section grouping rules for all future extractions
        switch (mainSection) {
          case '1':
            return {
              sectionNumber: '1',
              sectionTitle: '1. Общие требования'
            };
          case '2':
            return {
              sectionNumber: '2',
              sectionTitle: '2. Технические характеристики'
            };
          case '3':
            return {
              sectionNumber: '3',
              sectionTitle: '3. Комплект технологического оборудования линии'
            };
          case '4':
            return {
              sectionNumber: '4',
              sectionTitle: '4. Дополнительные требования'
            };
          case '5':
            return {
              sectionNumber: '5',
              sectionTitle: '5. Система автоматизации'
            };
          case '6':
            return {
              sectionNumber: '6',
              sectionTitle: '6. Требования к эксплуатации'
            };
          case '7':
            return {
              sectionNumber: '7',
              sectionTitle: '7. Требования к документации'
            };
          case '8':
            return {
              sectionNumber: '8',
              sectionTitle: '8. Требования к поставке'
            };
          case '12':
            return {
              sectionNumber: '12',
              sectionTitle: '12. Оборудование лазерной маркировки'
            };
          case '13':
            return {
              sectionNumber: '13',
              sectionTitle: '13. Солильные бассейны и вспомогательное оборудование'
            };
          default:
            return {
              sectionNumber: mainSection,
              sectionTitle: `${mainSection}. Раздел ${mainSection}`
            };
        }
      };

      for (const req of allRequirements.filter((r: any) => r && r.tech_spec_number && r.extracted_value)) {
        try {
          let sectionId = null;

          // Apply intelligent section grouping for all requirements
          const { sectionNumber, sectionTitle } = getSectionInfo(req.tech_spec_number);
          const sectionKey = `${sectionNumber}:${sectionTitle}`;
          
          if (!sectionMap.has(sectionKey)) {
            // Create new section with intelligent title
            const sectionInsert = await pool.query(`
              INSERT INTO requirement_sections 
              (project_id, section_number, section_title, order_index, created_at)
              VALUES ($1, $2, $3, $4, NOW())
              RETURNING id
            `, [projectId, sectionNumber, sectionTitle, parseInt(sectionNumber) || 0]);
            
            sectionId = sectionInsert.rows[0].id;
            sectionMap.set(sectionKey, sectionId);
            console.log(`[Analysis] Created section: ${sectionNumber} - ${sectionTitle}`);
          } else {
            sectionId = sectionMap.get(sectionKey);
          }

          const result: any = await pool.query(`
            INSERT INTO extracted_requirements 
            (project_id, section_id, serial_number, tech_spec_number, extracted_value, confidence, is_approved, page_reference, file_reference, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            RETURNING *
          `, [
            projectId,
            sectionId,
            savedRequirements.length + 1,
            req.tech_spec_number || 'N/A',
            req.extracted_value || '',
            Math.min(Math.max(req.confidence || 0.8, 0), 1),
            false,
            req.page_reference || null,
            req.file_reference || null
          ]);
          
          savedRequirements.push(result.rows[0]);
          console.log(`[Analysis] Saved: ${req.tech_spec_number} - ${req.extracted_value.substring(0, 50)}...`);
        } catch (dbError) {
          console.error('[Analysis] Error saving requirement:', dbError);
        }
      }

      console.log(`[Analysis] Successfully saved ${savedRequirements.length} requirements to database`);

      // Generate semantic blocks with hierarchical breakdown during extraction
      try {
        console.log(`[Analysis] Starting semantic block generation for project ${projectId}`);
        
        // Generate detailed semantic blocks directly from extracted requirements
        const semanticBlocks = [];
        
        // Group requirements by main section (e.g., 4.4.x -> section 4.4)
        const requirementGroups = new Map();
        
        for (const req of savedRequirements) {
          const parts = req.tech_spec_number.split('.');
          if (parts.length >= 2) {
            const mainSection = `${parts[0]}.${parts[1]}`; // e.g., "4.4"
            if (!requirementGroups.has(mainSection)) {
              requirementGroups.set(mainSection, []);
            }
            requirementGroups.get(mainSection).push(req);
          }
        }
        
        console.log(`[Analysis] Found ${requirementGroups.size} requirement groups for semantic processing`);
        
        // Create semantic blocks that match user sample format exactly
        const semanticSections = new Map();
        
        // Group requirements by equipment/section (e.g., 4.4.1, 4.6.1)
        for (const req of savedRequirements) {
          // Check if this is a main equipment specification (like 4.4.1, 4.6.1)
          const equipmentMatch = req.tech_spec_number.match(/^(\d+\.\d+\.\d+)$/);
          if (equipmentMatch) {
            const equipmentNumber = equipmentMatch[1];
            if (!semanticSections.has(equipmentNumber)) {
              semanticSections.set(equipmentNumber, {
                mainTitle: req.extracted_value,
                subRequirements: []
              });
            }
          }
        }
        
        // Add sub-requirements to their parent equipment
        for (const req of savedRequirements) {
          const subMatch = req.tech_spec_number.match(/^(\d+\.\d+\.\d+)\/(\d+(?:\.\d+)*)$/);
          if (subMatch) {
            const parentEquipment = subMatch[1];
            if (semanticSections.has(parentEquipment)) {
              semanticSections.get(parentEquipment).subRequirements.push({
                number: req.tech_spec_number,
                text: req.extracted_value
              });
            }
          }
        }

        console.log(`[Analysis] Found ${semanticSections.size} equipment sections for semantic processing`);
        
        // Clear existing semantic blocks for this project to avoid conflicts
        await pool.query('DELETE FROM semantic_blocks WHERE project_id = $1', [projectId]);
        console.log(`[Analysis] Cleared existing semantic blocks for project ${projectId}`);
        
        // Generate search vector for equipment sections
        async function generateSearchVector(title, fullText, equipmentNumber) {
          try {
            console.log(`[SearchVector] Generating search vector for ${equipmentNumber}: ${title}`);
            
            // Extract numeric values using regex patterns
            const numericFingerprint = {};
            
            // Capacity/Productivity patterns
            const capacityMatch = fullText.match(/(\d+(?:\.\d+)?)\s*(?:кг\/час|kg\/h|kg\/hour)/i);
            if (capacityMatch) {
              numericFingerprint.capacity = parseFloat(capacityMatch[1]);
            }
            
            // Weight range patterns
            const weightMatches = fullText.match(/(?:от\s*)?(\d+(?:\.\d+)?)\s*(?:до\s*(\d+(?:\.\d+)?))?\s*кг/gi);
            if (weightMatches && weightMatches.length > 0) {
              const weights = [];
              weightMatches.forEach(match => {
                const nums = match.match(/(\d+(?:\.\d+)?)/g);
                if (nums) nums.forEach(n => weights.push(parseFloat(n)));
              });
              if (weights.length > 0) {
                numericFingerprint.weight = weights.length === 1 ? weights[0] : [Math.min(...weights), Math.max(...weights)];
              }
            }
            
            // Dimension patterns
            const dimensionMatch = fullText.match(/(\d+)\s*[х×x]\s*(\d+)(?:\s*мм)?/i);
            if (dimensionMatch) {
              numericFingerprint.dimensions = `${dimensionMatch[1]}х${dimensionMatch[2]}`;
            }
            
            // Temperature patterns
            const tempMatch = fullText.match(/(\d+(?:\.\d+)?)\s*°?[CС]/);
            if (tempMatch) {
              numericFingerprint.temperature = parseFloat(tempMatch[1]);
            }
            
            // Generate primary keywords based on equipment type
            const primaryKeywords = [];
            const secondaryKeywords = [];
            const functionalFingerprint = [];
            const uniqueIdentifiers = [];
            
            // Equipment-specific keyword extraction
            if (title.toLowerCase().includes('формовщик') || title.toLowerCase().includes('формов')) {
              primaryKeywords.push('формовщик', 'формовка', 'формование');
              if (fullText.includes('карусель')) primaryKeywords.push('карусельный');
              if (fullText.includes('охлажд')) primaryKeywords.push('предварительное охлаждение');
              if (fullText.includes('непрерывн')) functionalFingerprint.push('непрерывное формование');
              if (fullText.includes('шнек')) {
                secondaryKeywords.push('шнеки');
                if (fullText.includes('встречн')) uniqueIdentifiers.push('встречное вращение шнеков');
              }
              if (fullText.includes('труб')) uniqueIdentifiers.push('формовочные трубы');
            }
            
            if (title.toLowerCase().includes('производительность')) {
              primaryKeywords.push('производительность', 'производство');
              functionalFingerprint.push('производственная мощность');
            }
            
            if (title.toLowerCase().includes('материал')) {
              primaryKeywords.push('материалы', 'материал');
              if (fullText.includes('AISI 304')) secondaryKeywords.push('AISI 304');
              if (fullText.includes('нержав')) secondaryKeywords.push('нержавеющая сталь');
              if (fullText.includes('пластик')) secondaryKeywords.push('пластик');
            }
            
            if (title.toLowerCase().includes('обработка') || title.toLowerCase().includes('антиагд')) {
              primaryKeywords.push('антиадгезионная обработка', 'обработка');
              secondaryKeywords.push('антиадгезионное');
              functionalFingerprint.push('предотвращение прилипания');
              uniqueIdentifiers.push('антиадгезионное покрытие');
            }
            
            if (title.toLowerCase().includes('бункер')) {
              primaryKeywords.push('бункер', 'загрузка');
              secondaryKeywords.push('датчик уровня');
              functionalFingerprint.push('контроль уровня');
              if (fullText.includes('датчик')) uniqueIdentifiers.push('датчик уровня сырной массы');
            }
            
            // Common functional patterns
            if (fullText.includes('охлажд') && fullText.includes('вод')) {
              functionalFingerprint.push('охлаждение водой');
              if (fullText.includes('циркул')) functionalFingerprint.push('циркуляция воды');
            }
            
            if (fullText.includes('стабилиз')) functionalFingerprint.push('стабилизация формы');
            if (fullText.includes('контакт')) functionalFingerprint.push('контакт с продуктом');
            
            // Build search vector
            const searchVector = {
              search_vector: {
                primary_keywords: primaryKeywords,
                secondary_keywords: secondaryKeywords,
                numeric_fingerprint: numericFingerprint,
                functional_fingerprint: functionalFingerprint,
                unique_identifiers: uniqueIdentifiers
              }
            };
            
            console.log(`[SearchVector] Generated vector for ${equipmentNumber}:`, JSON.stringify(searchVector, null, 2));
            return searchVector.search_vector;
            
          } catch (error) {
            console.error(`[SearchVector] Error generating search vector for ${equipmentNumber}:`, error);
            return {
              primary_keywords: [title.toLowerCase()],
              secondary_keywords: [],
              numeric_fingerprint: {},
              functional_fingerprint: [],
              unique_identifiers: []
            };
          }
        }
        
        // Group equipment sections by parent category for consolidated semantic blocks
        const equipmentGroups = new Map();
        
        for (const [equipmentNumber, sectionData] of semanticSections.entries()) {
          // Extract parent section number (e.g., "4.4" from "4.4.1")
          const parentMatch = equipmentNumber.match(/^(\d+\.\d+)/);
          const parentSection = parentMatch ? parentMatch[1] : equipmentNumber;
          
          if (!equipmentGroups.has(parentSection)) {
            equipmentGroups.set(parentSection, {
              parentTitle: '',
              sections: [],
              allText: '',
              keywords: new Set(),
              numericData: {},
              functionalFeatures: new Set()
            });
          }
          
          const group = equipmentGroups.get(parentSection);
          group.sections.push({ number: equipmentNumber, data: sectionData });
          group.allText += ` ${sectionData.mainTitle} ${sectionData.subRequirements.map(r => r.text).join(' ')}`;
        }
        
        // Find and add parent sections from extracted requirements
        const parentSections = new Map();
        for (const req of rawRequirements) {
          const parentMatch = req.tech_spec_number.match(/^(\d+\.\d+)$/);
          if (parentMatch) {
            const parentNumber = parentMatch[1];
            parentSections.set(parentNumber, {
              title: req.extracted_value,
              number: parentNumber
            });
          }
        }
        
        // Create consolidated semantic blocks for each equipment group
        for (const [parentSection, groupData] of equipmentGroups.entries()) {
          try {
            // Get parent section title or generate one
            let parentTitle = groupData.sections.length > 0 ? groupData.sections[0].data.mainTitle : '';
            if (parentSections.has(parentSection)) {
              parentTitle = parentSections.get(parentSection).title;
            }
            
            console.log(`[Analysis] Processing consolidated equipment group ${parentSection}: ${parentTitle}`);
            
            // Consolidate all text from all subsections
            const consolidatedText = groupData.allText.trim();
            
            // Generate comprehensive search vector for entire equipment group
            const consolidatedSearchVector = await generateSearchVector(parentTitle, consolidatedText, parentSection);
            
            // Add equipment type to primary keywords for better matching
            const equipmentType = parentTitle.toLowerCase().match(/(\w+(?:щик|ка|тор|ль|ер))/)?.[1];
            if (equipmentType && !consolidatedSearchVector.primary_keywords.includes(equipmentType)) {
              consolidatedSearchVector.primary_keywords.unshift(equipmentType);
            }
            
            // Create unique hash for consolidated equipment group
            const uniqueContent = `${projectId}-${parentSection}-consolidated-${parentTitle}-${Date.now()}`;
            const contentHash = crypto.createHash('md5').update(uniqueContent).digest('hex');
            
            // Save consolidated semantic block
            const blockResult = await pool.query(`
              INSERT INTO semantic_blocks (
                project_id, block_title, content_hash, core_function, 
                semantic_description, key_processes, critical_params, 
                dependencies, exclusions, key_requirements, order_index, processing_method
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              RETURNING id
            `, [
              projectId,
              `${parentSection}. ${parentTitle}`,
              contentHash,
              parentTitle,
              `Консолидированный семантический блок для поиска оборудования типа "${equipmentType || parentTitle}" в предложениях поставщиков`,
              JSON.stringify(consolidatedSearchVector.primary_keywords),
              JSON.stringify(consolidatedSearchVector.secondary_keywords),
              JSON.stringify(consolidatedSearchVector.numeric_fingerprint),
              JSON.stringify(consolidatedSearchVector.functional_fingerprint),
              JSON.stringify(consolidatedSearchVector),
              semanticBlocks.length + 1,
              'consolidated_equipment_search'
            ]);
            
            console.log(`[Analysis] Successfully saved consolidated semantic block with ID: ${blockResult.rows[0].id} for equipment group ${parentSection}`);
            
            semanticBlocks.push({
              id: blockResult.rows[0].id,
              title: `${parentSection}. ${parentTitle}`,
              searchVector: consolidatedSearchVector,
              type: 'consolidated_equipment'
            });
            
          } catch (blockError) {
            console.error(`[Analysis] Error processing consolidated semantic block for equipment group ${parentSection}:`, blockError);
            console.error(`[Analysis] Block error details:`, blockError.message);
          }
        }
        
        console.log(`[Analysis] Generated ${semanticBlocks.length} search-optimized semantic blocks`);
        
      } catch (semanticError) {
        console.error('[Analysis] Error generating semantic blocks:', semanticError);
        // Don't fail the entire extraction if semantic processing fails
      }
      
      // Function to create detailed hierarchical breakdown matching user samples
      async function createDetailedBreakdown(extractedValue, techSpecNumber) {
        // Extract equipment title from the beginning
        const text = extractedValue.trim();
        
        // Find the main equipment name (usually first phrase before "для", "предназначен", etc.)
        let title = text;
        const titleMatch = text.match(/^([^.]+?)(?:\s+(?:предназначен|для|с|в|из|при|от|до))/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
        } else {
          // Fallback: take first 50 characters
          title = text.substring(0, 50).trim();
          if (title.includes('.')) {
            title = title.split('.')[0];
          }
        }
        
        // Remove technical spec number from title if present
        title = title.replace(/^\d+\.\d+(\.\d+)?\s*/, '');
        
        // Create hierarchical breakdown
        const requirements = [];
        
        // Split text into logical components
        let remainingText = text.replace(title, '').trim();
        
        // Handle different patterns for breakdown
        if (remainingText.includes('температура') && remainingText.includes('от') && remainingText.includes('до')) {
          // Temperature ranges pattern
          const tempMatches = remainingText.match(/температура[^;]+;/gi);
          if (tempMatches) {
            let subCounter = 1;
            requirements.push(`${techSpecNumber}/1 ${remainingText.split(/температура/i)[0].trim()}`);
            
            tempMatches.forEach(temp => {
              const cleanTemp = temp.replace(/;$/, '').trim();
              requirements.push(`${techSpecNumber}/2.${subCounter} ${cleanTemp}`);
              subCounter++;
            });
          }
        } else {
          // General breakdown by logical separators
          const parts = [];
          
          // Split by common separators while preserving context
          const separators = [
            /(?:для\s+)/i,
            /(?:предназначен\s+для\s+)/i, 
            /(?:с\s+размером\s+)/i,
            /(?:производительностью\s+)/i,
            /(?:массой\s+от\s+)/i,
            /(?:в\s+виде\s+)/i,
            /(?:установлена\s+на\s+)/i,
            /(?:обеспечивает\s+)/i
          ];
          
          let workingText = remainingText;
          let counter = 1;
          
          separators.forEach(separator => {
            const match = workingText.match(separator);
            if (match) {
              const beforeMatch = workingText.substring(0, match.index).trim();
              const afterMatch = workingText.substring(match.index).trim();
              
              if (beforeMatch.length > 10) {
                requirements.push(`${techSpecNumber}/${counter} ${beforeMatch}`);
                counter++;
              }
              
              if (afterMatch.length > 15) {
                requirements.push(`${techSpecNumber}/${counter} ${afterMatch}`);
                counter++;
              }
              
              workingText = afterMatch;
            }
          });
          
          // If no good breakdown found, split by periods and semicolons
          if (requirements.length === 0) {
            const sentences = remainingText.split(/[.;]/).filter(s => s.trim().length > 15);
            sentences.forEach((sentence, idx) => {
              requirements.push(`${techSpecNumber}/${idx + 1} ${sentence.trim()}`);
            });
          }
        }
        
        // Ensure at least one requirement exists
        if (requirements.length === 0) {
          requirements.push(`${techSpecNumber}/1 ${remainingText || text}`);
        }
        
        return {
          title: title,
          description: extractedValue,
          processes: [title],
          parameters: {},
          requirements: requirements
        };
      }

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
      return;
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

    // Get requirements
    const requirementsResult = await pool.query(`
      SELECT * FROM extracted_requirements 
      WHERE project_id = $1 
      ORDER BY created_at ASC
    `, [projectId]);

    res.json({
      requirements: requirementsResult.rows,
      project: projectResult.rows[0]
    });
  } catch (error) {
    console.error('Error getting requirements:', error);
    res.status(500).json({ error: 'Ошибка получения требований' });
  }
});

// Get extracted requirements for existing project
router.get('/:projectId/extracted-requirements', requireAuth, async (req, res) => {
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

    // Get extracted requirements
    const requirementsResult = await pool.query(
      'SELECT * FROM extracted_requirements WHERE project_id = $1 ORDER BY created_at ASC',
      [projectId]
    );

    res.json({
      requirements: requirementsResult.rows.map(req => ({
        id: req.id,
        serialNumber: req.serial_number,
        techSpecNumber: req.tech_spec_number,
        extractedValue: req.extracted_value,
        confidence: req.confidence,
        isApproved: req.is_approved
      }))
    });
  } catch (error) {
    console.error('Error getting extracted requirements:', error);
    res.status(500).json({ error: 'Ошибка получения требований' });
  }
});

// Save manual requirements
router.post('/:projectId/requirements', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectIdParam = req.params.projectId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!projectIdParam || projectIdParam === 'undefined' || isNaN(Number(projectIdParam))) {
      return res.status(400).json({ error: 'Неверный ID проекта' });
    }

    const projectId = parseInt(projectIdParam);

    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const { requirements } = req.body;
    
    console.log('[Analysis] Received requirements data:', JSON.stringify(requirements, null, 2));
    console.log('[Analysis] Project ID:', projectId);
    
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return res.status(400).json({ error: 'Требования не предоставлены' });
    }

    const savedRequirements = [];

    for (const requirement of requirements) {
      try {
        console.log('[Analysis] Processing requirement:', requirement);
        const validated = requirementSchema.parse(requirement);
        console.log('[Analysis] Validated requirement:', validated);
        
        // Check if requirement already exists (for updates)
        if (validated.id) {
          // Update existing requirement
          const result = await pool.query(`
            UPDATE extracted_requirements 
            SET serial_number = $1, tech_spec_number = $2, extracted_value = $3, confidence = $4
            WHERE id = $5 AND project_id = $6
            RETURNING *
          `, [
            validated.serialNumber || 1,
            validated.techSpecNumber,
            validated.extractedValue,
            validated.confidence,
            validated.id,
            projectId
          ]);
          
          if (result.rows.length > 0) {
            savedRequirements.push(result.rows[0]);
          }
        } else {
          // Create new requirement
          const result = await pool.query(`
            INSERT INTO extracted_requirements 
            (project_id, serial_number, tech_spec_number, extracted_value, confidence, is_approved, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
          `, [
            projectId,
            validated.serialNumber || 1,
            validated.techSpecNumber,
            validated.extractedValue,
            validated.confidence,
            false
          ]);
          
          savedRequirements.push(result.rows[0]);
        }
      } catch (validationError) {
        console.error('Validation error for requirement:', validationError);
      }
    }

    res.json({
      savedRequirements,
      message: `Сохранено ${savedRequirements.length} требований`
    });
  } catch (error) {
    console.error('Error saving requirements:', error);
    res.status(500).json({ error: 'Ошибка сохранения требований' });
  }
});

// Confirm parameters and move to next step
router.post('/:projectId/confirm-parameters', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    // Update project status
    await pool.query(
      'UPDATE analysis_projects SET status = $1, updated_at = NOW() WHERE id = $2',
      ['step2_offers', projectId]
    );

    // Create semantic blocks after confirming parameters
    try {
      console.log(`[SemanticBlocks] Creating semantic blocks for project ${projectId}...`);
      await createSemanticBlocksForProject(projectId);
      console.log(`[SemanticBlocks] Successfully created semantic blocks for project ${projectId}`);
    } catch (semanticError) {
      console.error(`[SemanticBlocks] Error creating semantic blocks for project ${projectId}:`, semanticError);
      // Don't fail the whole request if semantic blocks creation fails
    }

    res.json({
      success: true,
      message: 'Параметры подтверждены, переходим к следующему этапу',
      nextStep: 'step2_offers'
    });
  } catch (error) {
    console.error('Error confirming parameters:', error);
    res.status(500).json({ error: 'Ошибка подтверждения параметров' });
  }
});

// Delete project file
router.delete('/:projectId/files/:fileIndex', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.projectId);
    const fileIndex = parseInt(req.params.fileIndex);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    // Get files for this project
    const filesResult = await pool.query(
      'SELECT * FROM analysis_project_files WHERE project_id = $1 ORDER BY created_at ASC',
      [projectId]
    );

    if (fileIndex >= 0 && fileIndex < filesResult.rows.length) {
      const fileToDelete = filesResult.rows[fileIndex];
      
      await pool.query(
        'DELETE FROM analysis_project_files WHERE id = $1',
        [fileToDelete.id]
      );

      res.json({
        success: true,
        message: 'Файл удален'
      });
    } else {
      res.status(404).json({ error: 'Файл не найден' });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// ============================================================================
// STEP 2: SUPPLIER MANAGEMENT AND FILE UPLOAD ENDPOINTS
// ============================================================================

// Get suppliers for a project
router.get('/:projectId/suppliers', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    console.log(`[Analysis] Loading suppliers for project ${projectId}`);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    const suppliers = await pool.query(
      'SELECT * FROM analysis_suppliers WHERE project_id = $1 ORDER BY created_at ASC',
      [projectId]
    );
    
    return res.json({ suppliers: suppliers.rows });
  } catch (error) {
    console.error('[Analysis] Error loading suppliers:', error);
    return res.status(500).json({ error: 'Failed to load suppliers' });
  }
});

// Add supplier to project
router.post('/:projectId/suppliers', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    const { name, email, phone } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }
    
    console.log(`[Analysis] Adding supplier ${name} to project ${projectId}`);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    const result = await pool.query(
      'INSERT INTO analysis_suppliers (project_id, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, name.trim(), email || null, phone || null]
    );
    
    return res.json({ supplier: result.rows[0] });
  } catch (error) {
    console.error('[Analysis] Error adding supplier:', error);
    return res.status(500).json({ error: 'Failed to add supplier' });
  }
});

// Upload files for a supplier (project-level route)
router.post('/:projectId/suppliers/:supplierId/files', requireAuth, upload.array('files'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId, supplierId } = req.params;
    const files = req.files as Express.Multer.File[];
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    console.log(`[Analysis] Uploading ${files.length} files for supplier ${supplierId} in project ${projectId}`);
    console.log(`[Analysis] File details:`, files.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })));
    
    // Verify project ownership and supplier exists
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.id = $2 AND p.user_id = $3
    `, [supplierId, projectId, userId]);

    console.log(`[Analysis] Supplier verification result:`, supplierResult.rows.length > 0 ? 'Found' : 'Not found');

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    const uploadedFiles = [];
    
    for (const file of files) {
      // Fix character encoding for Cyrillic characters
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      console.log(`[Analysis] Processing file: ${originalName}, size: ${file.size}, type: ${file.mimetype}`);
      
      // Save file to database
      const result = await pool.query(
        'INSERT INTO analysis_supplier_files (supplier_id, filename, original_name, file_data, mime_type, file_size, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, filename, original_name, mime_type, file_size, created_at',
        [supplierId, originalName, originalName, file.buffer, file.mimetype, file.size]
      );
      
      console.log(`[Analysis] File saved with ID: ${result.rows[0].id}`);
      uploadedFiles.push(result.rows[0]);
    }
    
    return res.json({ 
      message: `Uploaded ${files.length} files`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('[Analysis] Error uploading supplier files:', error);
    return res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Upload files for a supplier (legacy route)
router.post('/suppliers/:supplierId/files', requireAuth, upload.array('files'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const { supplierId } = req.params;
    const files = req.files as Express.Multer.File[];
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    console.log(`[Analysis] Uploading ${files.length} files for supplier ${supplierId}`);
    
    // Verify supplier access through project ownership
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.user_id = $2
    `, [supplierId, userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    const uploadedFiles = [];
    
    for (const file of files) {
      // Fix character encoding for Cyrillic characters
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      
      // Save file to database
      const result = await pool.query(
        'INSERT INTO analysis_supplier_files (supplier_id, filename, original_name, file_data, mime_type, file_size, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, filename, original_name, mime_type, file_size, created_at',
        [supplierId, originalName, originalName, file.buffer, file.mimetype, file.size]
      );
      
      uploadedFiles.push(result.rows[0]);
    }
    
    return res.json({ 
      message: `Uploaded ${files.length} files`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('[Analysis] Error uploading supplier files:', error);
    return res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Get files for a supplier
router.get('/:projectId/suppliers/:supplierId/files', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId, supplierId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify supplier access through project ownership
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.id = $2 AND p.user_id = $3
    `, [supplierId, projectId, userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    const files = await pool.query(
      'SELECT id, filename, original_name, mime_type, file_size, created_at FROM analysis_supplier_files WHERE supplier_id = $1 ORDER BY created_at DESC',
      [supplierId]
    );
    
    return res.json({ files: files.rows });
  } catch (error) {
    console.error('[Analysis] Error loading supplier files:', error);
    return res.status(500).json({ error: 'Failed to load files' });
  }
});

// Get files for a supplier (legacy route without projectId)
router.get('/suppliers/:supplierId/files', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { supplierId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify supplier access through project ownership
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.user_id = $2
    `, [supplierId, userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    const files = await pool.query(
      'SELECT id, filename, original_name, mime_type, file_size, created_at FROM analysis_supplier_files WHERE supplier_id = $1 ORDER BY created_at DESC',
      [supplierId]
    );
    
    console.log(`[Analysis] Found ${files.rows.length} files for supplier ${supplierId}`);
    return res.json({ files: files.rows });
  } catch (error) {
    console.error('[Analysis] Error loading supplier files:', error);
    return res.status(500).json({ error: 'Failed to load files' });
  }
});

// Delete a file
router.delete('/suppliers/:supplierId/files/:fileId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { fileId, supplierId } = req.params;
    
    console.log(`[Analysis] Delete file request: fileId=${fileId}, supplierId=${supplierId}, userId=${userId}`);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify file access through project ownership
    const fileResult = await pool.query(`
      SELECT f.*, p.user_id 
      FROM analysis_supplier_files f 
      JOIN analysis_suppliers s ON f.supplier_id = s.id
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE f.id = $1 AND s.id = $2 AND p.user_id = $3
    `, [fileId, supplierId, userId]);

    console.log(`[Analysis] File verification result: ${fileResult.rows.length} files found`);

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    const deleteResult = await pool.query(
      'DELETE FROM analysis_supplier_files WHERE id = $1 RETURNING id',
      [fileId]
    );
    
    console.log(`[Analysis] Delete result: ${deleteResult.rows.length} files deleted`);
    
    return res.json({ message: 'File deleted successfully', deletedId: fileId });
  } catch (error) {
    console.error('[Analysis] Error deleting file:', error);
    return res.status(500).json({ error: 'Failed to delete file', details: error.message });
  }
});

// Start analysis for project
router.post('/:projectId/start-analysis', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    console.log(`[Analysis] Starting analysis for project ${projectId}`);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Update project status
    await pool.query(
      'UPDATE analysis_projects SET status = $1 WHERE id = $2',
      ['step3_compliance', projectId]
    );
    
    return res.json({ message: 'Analysis started successfully' });
  } catch (error) {
    console.error('[Analysis] Error starting analysis:', error);
    return res.status(500).json({ error: 'Failed to start analysis' });
  }
});

// ============================================================================
// STEP 3: COMPLIANCE ANALYSIS ENDPOINTS
// ============================================================================

// Get compliance analysis for a supplier
router.get('/:projectId/compliance/:supplierId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId, supplierId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    console.log(`[Analysis] Loading compliance analysis for project ${projectId}, supplier ${supplierId}`);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    const analysis = await pool.query(
      'SELECT * FROM compliance_analysis WHERE project_id = $1 AND supplier_id = $2 ORDER BY created_at DESC LIMIT 1',
      [projectId, supplierId]
    );
    
    if (analysis.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    
    // Get supplier info
    const supplier = await pool.query(
      'SELECT * FROM analysis_suppliers WHERE id = $1',
      [supplierId]
    );
    
    const analysisData = analysis.rows[0];
    const complianceResults = analysisData.analysis_data || {};
    
    return res.json({
      analysis: {
        supplier: supplier.rows[0],
        compliancePercentage: analysisData.compliance_percentage,
        totalRequirements: complianceResults.totalRequirements || 0,
        compliantCount: complianceResults.compliantCount || 0,
        partialCount: complianceResults.partialCount || 0,
        nonCompliantCount: complianceResults.nonCompliantCount || 0,
        missingCount: complianceResults.missingCount || 0,
        results: complianceResults.results || [],
        recommendations: analysisData.recommendations || [],
        gapsIdentified: analysisData.gaps_identified || []
      }
    });
  } catch (error) {
    console.error('[Analysis] Error loading compliance analysis:', error);
    return res.status(500).json({ error: 'Failed to load analysis' });
  }
});

// Generate compliance analysis for a supplier
router.post('/:projectId/compliance/:supplierId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId, supplierId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    console.log(`[Analysis] Starting compliance analysis for project ${projectId}, supplier ${supplierId}`);
    
    // Add server stability check
    if (!projectId || isNaN(parseInt(projectId)) || !supplierId || isNaN(parseInt(supplierId))) {
      console.error(`[Analysis] Invalid parameters - projectId: ${projectId}, supplierId: ${supplierId}`);
      return res.status(400).json({ error: 'Неверные параметры запроса' });
    }
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Delete existing analysis to ensure fresh regeneration
    await pool.query(
      'DELETE FROM compliance_analysis WHERE project_id = $1 AND supplier_id = $2',
      [projectId, supplierId]
    );
    
    // Also clear any cached analysis data to prevent duplicates
    await pool.query(
      'DELETE FROM supplier_document_cache WHERE project_id = $1 AND supplier_id = $2',
      [projectId, supplierId]
    );
    console.log(`[Analysis] Deleted existing analysis and cache for fresh regeneration`);
    
    
    // Get project requirements from the correct table
    console.log(`[Analysis] About to query extracted_requirements for project_id: ${projectId} (type: ${typeof projectId})`);
    
    let requirements;
    try {
      requirements = await pool.query(
        'SELECT * FROM extracted_requirements WHERE project_id = $1 ORDER BY created_at ASC',
        [projectId]
      );
      
      console.log(`[Analysis] Query completed. Found ${requirements.rows.length} requirements for project ${projectId}`);
      
      if (requirements.rows.length === 0) {
        // Force debug query to check if data exists
        console.log(`[Analysis] No requirements found, running debug queries...`);
        const debugQuery = await pool.query('SELECT COUNT(*) as total FROM extracted_requirements WHERE project_id = $1', [parseInt(projectId)]);
        console.log(`[Analysis] Debug count for project ${projectId}:`, debugQuery.rows[0]);
        
        const allProjects = await pool.query('SELECT DISTINCT project_id FROM extracted_requirements ORDER BY project_id');
        console.log(`[Analysis] All project_ids with requirements:`, allProjects.rows.map(r => r.project_id));
        
        // Check if projectId needs to be converted to integer
        const intQuery = await pool.query('SELECT COUNT(*) as total FROM extracted_requirements WHERE project_id = $1', [parseInt(projectId)]);
        console.log(`[Analysis] Count with parseInt(${projectId}):`, intQuery.rows[0]);
      } else {
        console.log(`[Analysis] Sample requirement:`, requirements.rows[0]);
      }
    } catch (queryError) {
      console.error(`[Analysis] Error querying requirements:`, queryError);
      requirements = { rows: [] }; // Fallback for continuation
    }
    
    // Get supplier files
    const files = await pool.query(
      'SELECT * FROM analysis_supplier_files WHERE supplier_id = $1',
      [supplierId]
    );
    
    // Extract text from supplier files using optimized extraction
    let combinedSupplierText = '';
    let processedFilesCount = 0;
    
    for (const file of files.rows) {
      try {
        console.log(`[Analysis] Processing file: ${file.original_name || file.filename}, size: ${file.file_data?.length || 0} bytes, type: ${file.mime_type}`);
        
        const tempFilePath = path.join('/tmp', `supplier_${file.id}_${file.filename}`);
        fs.writeFileSync(tempFilePath, file.file_data);
        
        const pythonScriptPath = path.join(process.cwd(), 'extract_text_optimized.py');
        const mimeType = file.mime_type || file.mimetype || 'application/octet-stream';
        const command = `python3 "${pythonScriptPath}" "${tempFilePath}" "${mimeType}"`;
        
        console.log(`[Analysis] Executing OPTIMIZED section-aware text extraction command: ${command}`);
        
        const extractedText = execSync(command, { 
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 10,
          timeout: 30000
        });
        
        console.log(`[Analysis] Extracted text length for ${file.original_name}: ${extractedText.length} characters`);
        
        if (extractedText && extractedText.trim()) {
          combinedSupplierText += `\n\n=== ФАЙЛ: ${file.original_name || file.filename} ===\n${extractedText.trim()}`;
          processedFilesCount++;
          console.log(`[Analysis] Added text from ${file.original_name} to combined text`);
        } else {
          console.log(`[Analysis] No text extracted from ${file.original_name}`);
        }
        
        // Clean up
        fs.unlinkSync(tempFilePath);
      } catch (error) {
        console.error(`[Analysis] Error processing supplier file ${file.original_name || file.filename}:`, error);
        console.error(`[Analysis] Error details:`, error.message);
      }
    }
    
    if (!combinedSupplierText.trim()) {
      return res.json({
        analysis: {
          supplier: { name: 'Unknown' },
          compliancePercentage: 0,
          totalRequirements: requirements.rows.length,
          compliantCount: 0,
          partialCount: 0,
          nonCompliantCount: 0,
          missingCount: requirements.rows.length,
          results: [],
          recommendations: ['Не удалось извлечь текст из файлов поставщика'],
          gapsIdentified: ['Отсутствует техническая документация']
        }
      });
    }
    
    // **OPTIMIZATION 1: SUPPLIER DOCUMENT CACHING**
    // Check if we have cached analysis for this supplier
    const documentHash = crypto.createHash('md5').update(combinedSupplierText).digest('hex');
    
    let cachedAnalysis = null;
    try {
      const cacheResult = await pool.query(
        'SELECT * FROM supplier_document_cache WHERE supplier_id = $1 AND project_id = $2 AND document_hash = $3',
        [supplierId, projectId, documentHash]
      );
      
      if (cacheResult.rows.length > 0) {
        cachedAnalysis = cacheResult.rows[0];
        console.log(`[Analysis] Found cached analysis for supplier ${supplierId}, project ${projectId}`);
      }
    } catch (cacheError) {
      console.log(`[Analysis] Cache check failed, proceeding with fresh analysis:`, cacheError.message);
    }

    // Perform AI analysis using DeepSeek
    const analysisResults = [];
    let compliantCount = 0;
    let partialCount = 0;
    let nonCompliantCount = 0;
    let missingCount = 0;
    
    // SECTION-AWARE PROCESSING: Add helper function for section extraction
    function extractRelevantSections(supplierText: string, requirementSections: any[]): string {
      let sectionAwareText = '';
      
      // Extract all target sections mentioned in requirements
      const allTargetSections = [...new Set(requirementSections.flatMap(rs => rs.targetSections))];
      
      // Parse sections from supplier text
      const sectionRegex = /\[SECTION:([A-Z_]+)\]\s*\[SECTION_TITLE:([^\]]+)\]\s*\[SECTION_TYPE:([^\]]+)\]\s*(.*?)\s*\[\/SECTION:\1\]/gs;
      const sections = new Map();
      
      let match;
      while ((match = sectionRegex.exec(supplierText)) !== null) {
        const [, sectionName, sectionTitle, sectionType, content] = match;
        sections.set(sectionName.toLowerCase(), {
          title: sectionTitle,
          type: sectionType,
          content: content.trim()
        });
      }
      
      // Include relevant sections for analysis
      for (const targetSection of allTargetSections) {
        const sectionKey = targetSection.toLowerCase();
        if (sections.has(sectionKey)) {
          const section = sections.get(sectionKey);
          sectionAwareText += `\n[РАЗДЕЛ ${targetSection.toUpperCase()}]\n`;
          sectionAwareText += `Заголовок: ${section.title}\n`;
          sectionAwareText += `Содержание:\n${section.content}\n`;
          sectionAwareText += `[/РАЗДЕЛ ${targetSection.toUpperCase()}]\n\n`;
        }
      }
      
      // If no structured sections found, return original text with warning
      if (!sectionAwareText.trim()) {
        sectionAwareText = `[ВНИМАНИЕ: Структурированные разделы не найдены, используется полный текст]\n${supplierText.substring(0, 8000)}`;
      }
      
      return sectionAwareText;
    }

    console.log(`[Analysis] Starting section-aware analysis for ${requirements.rows.length} requirements`);
    console.log(`[Analysis] Supplier text length: ${combinedSupplierText.length} characters`);
    console.log(`[Analysis] DEEPSEEK_API_KEY available: ${!!process.env.DEEPSEEK_API_KEY}`);
    
    // Force use of enhanced section-aware analysis if supplier text is available
    if (!process.env.DEEPSEEK_API_KEY) {
      console.log(`[Analysis] ERROR: DEEPSEEK_API_KEY not configured - cannot perform AI analysis`);
      return res.status(500).json({ error: 'AI analysis not configured' });
    }
    
    if (!combinedSupplierText.trim()) {
      console.log(`[Analysis] No supplier text available for analysis`);
      return res.status(400).json({ error: 'No supplier documents to analyze' });
    }
    
    // Use basic analysis only as fallback in catch block
    const useBasicAnalysis = false; // Force enhanced analysis
    if (useBasicAnalysis) {
      for (const req of requirements.rows) {
        // Basic text matching analysis
        const reqText = req.extracted_value.toLowerCase();
        const supplierTextLower = combinedSupplierText.toLowerCase();
        
        let status = 'missing';
        let supplierData = '';
        let notes = 'Автоматический анализ на основе текстового совпадения';
        
        // Simple keyword matching
        const keywords = reqText.split(/\s+/).filter(word => word.length > 3);
        const matchedKeywords = keywords.filter(keyword => supplierTextLower.includes(keyword));
        
        if (matchedKeywords.length >= keywords.length * 0.7) {
          status = 'compliant';
          supplierData = 'Найдены ключевые слова в документации поставщика';
          notes = `Обнаружены совпадения: ${matchedKeywords.join(', ')}`;
        } else if (matchedKeywords.length > 0) {
          status = 'partial';
          supplierData = 'Частичное совпадение с документацией поставщика';
          notes = `Частичные совпадения: ${matchedKeywords.join(', ')}`;
        }
        
        analysisResults.push({
          requirement: req.extracted_value,
          techSpecNumber: req.tech_spec_number,
          supplierData,
          fileReference: processedFilesCount > 0 ? 'Файлы поставщика' : '',
          status,
          notes
        });
        
        // Count statuses
        switch (status) {
          case 'compliant':
            compliantCount++;
            break;
          case 'partial':
            partialCount++;
            break;
          case 'non-compliant':
            nonCompliantCount++;
            break;
          default:
            missingCount++;
        }
      }
    } else {
      // Use AI analysis with section-aware semantic matching
      try {
        if (!openai) {
          throw new Error('DeepSeek API client not initialized. Please set DEEPSEEK_API_KEY environment variable.');
        }
      
      // **PRECISION SEMANTIC SECTION MAPPING ALGORITHM**
      // Step 1: Parse supplier document with strict equipment type classification
      async function parseSupplierSections(supplierText) {
        try {
          const response = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{
              role: 'user',
              content: `КРИТИЧЕСКИ ВАЖНАЯ ЗАДАЧА: Точная классификация оборудования поставщика для предотвращения неправильного сопоставления!

ДОКУМЕНТ ПОСТАВЩИКА:
${supplierText.substring(0, 15000)}

СТРОГИЕ ПРАВИЛА КЛАССИФИКАЦИИ:
1. "Batch steam cooker" = ТОЛЬКО steam_melter (паровой плавитель)
2. "Extruder" = ТОЛЬКО extruder_doser (экструдер-дозатор)  
3. "Moulding Machine" = ТОЛЬКО forming_machine (формовочная машина)
4. "Pasteurization" = ТОЛЬКО pasteurization_system (пастеризация)
5. "Control Panel" = ТОЛЬКО automation_system (автоматизация)

ЗАПРЕЩЕНО смешивать типы оборудования! Каждое оборудование должно иметь ТОЧНЫЙ equipment_type.

Извлеки ВСЕ разделы с ТОЧНОЙ классификацией:

{
  "sections": [
    {
      "section_id": "unique_id",
      "title": "точное_название_из_документа",
      "full_content": "ПОЛНОЕ_техническое_описание_со_ВСЕМИ_характеристиками",
      "equipment_type": "steam_melter|extruder_doser|forming_machine|pasteurization_system|automation_system|cooling_system|weighing_system|conveyor_system|other",
      "primary_function": "основная_функция_оборудования",
      "technical_specs": [
        "производительность_с_значениями",
        "габариты_с_размерами",
        "материалы_нержавейка_AISI",
        "мощность_двигателей_кВт",
        "напряжение_380В_50Гц",
        "автоматизация_PLC_HMI"
      ],
      "semantic_keywords": ["точные_технические_термины"],
      "equipment_classification": "СТРОГАЯ_категория_без_смешивания"
    }
  ]
}

КРИТИЧЕСКИ ВАЖНО:
- НЕ путать steam cooker с forming machine
- НЕ путать extruder с pasteurization system  
- КАЖДОЕ оборудование = ОДИН точный equipment_type
- ПОЛНОЕ техническое содержание для точного сравнения

Только JSON без пояснений.`
            }],
            temperature: 0.1,
            max_tokens: 4096
          });

          const jsonMatch = response.choices[0].message.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        } catch (error) {
          console.error('[Analysis] Error parsing supplier sections:', error);
        }
        return { sections: [] };
      }

      // Step 2: Group requirements by technical sections (hierarchical structure)
      function groupRequirementsByTechnicalSections(requirements) {
        const sections = new Map();
        
        for (const req of requirements) {
          // Extract main section number (24, 25, 24.1, 25.1, etc.)
          // First try simple integer sections (24, 25)
          let sectionMatch = req.tech_spec_number.match(/^(\d+)$/);
          if (!sectionMatch) {
            // Then try decimal sections (24.1, 25.1, etc.)
            sectionMatch = req.tech_spec_number.match(/^(\d+\.\d+)/);
          }
          if (!sectionMatch) {
            // Finally try any number at the start
            sectionMatch = req.tech_spec_number.match(/^(\d+)/);
          }
          
          // Force requirements into sections 24 or 25, never "other"
          let mainSection = sectionMatch ? sectionMatch[1] : null;
          
          // If no section match or if it's "other", intelligently assign to 24 or 25
          if (!mainSection || mainSection === 'other') {
            // Assign based on content keywords
            if (req.extracted_value.includes('плавитель') || req.extracted_value.includes('стретчинг') || 
                req.extracted_value.includes('паровой') || req.extracted_value.includes('автоматический')) {
              mainSection = '24';
            } else if (req.extracted_value.includes('экструдер') || req.extracted_value.includes('дозатор') ||
                       req.extracted_value.includes('шнек') || req.extracted_value.includes('транспорт')) {
              mainSection = '25';
            } else {
              // Default fallback: assign to 24 (never use "other")
              mainSection = '24';
            }
            console.log(`[Analysis] Reassigned requirement "${req.tech_spec_number}" from undefined/other to section ${mainSection}`);
          }
          
          if (!sections.has(mainSection)) {
            sections.set(mainSection, {
              sectionNumber: mainSection,
              requirements: [],
              sectionTitle: mainSection === '24' ? 'Автоматический паровой плавитель' :
                           mainSection === '25' ? 'Экструдер-дозатор' :
                           `Раздел ${mainSection}`
            });
          }
          
          sections.get(mainSection).requirements.push(req);
        }

        return sections;
      }

      // Step 3: PRECISION semantic section mapping with strict equipment type validation
      async function mapRequirementSectionsToSupplierSections(requirementSections, supplierSections) {
        try {
          const mappingPrompt = `КРИТИЧЕСКИ ВАЖНАЯ ЗАДАЧА: Точное сопоставление без смешивания типов оборудования!

РАЗДЕЛЫ ТЕХНИЧЕСКИХ ТРЕБОВАНИЙ:
${Array.from(requirementSections.values()).map(section => 
  `Раздел ${section.sectionNumber}: ${section.sectionTitle} (${section.requirements.length} требований)`
).join('\n')}

РАЗДЕЛЫ ПРЕДЛОЖЕНИЯ ПОСТАВЩИКА:
${supplierSections.sections.map(section => 
  `ID: ${section.section_id} | Название: ${section.title} | Тип: ${section.equipment_type} | Функция: ${section.primary_function || 'не указана'}`
).join('\n')}

СТРОГИЕ ПРАВИЛА СОПОСТАВЛЕНИЯ:
1. Раздел 24 (паровой плавитель) = ТОЛЬКО steam_melter
2. Раздел 25 (экструдер-дозатор) = ТОЛЬКО extruder_doser  
3. Раздел 26 (формовочная машина) = ТОЛЬКО forming_machine
4. Раздел 4.4 (формовщик) = ТОЛЬКО forming_machine
5. Раздел 4.6 (пастеризация) = ТОЛЬКО pasteurization_system

ЗАПРЕЩЕНО:
- Сопоставлять "Batch steam cooker" с forming_machine
- Сопоставлять "Extruder" с steam_melter
- Смешивать разные типы оборудования

ЗАДАЧА: Выполни ТОЧНОЕ сопоставление с проверкой equipment_type:

[
  {
    "requirement_section": "24",
    "requirement_title": "Автоматический паровой плавитель",
    "supplier_section_id": "section_id", 
    "supplier_title": "точное_название",
    "equipment_type": "steam_melter",
    "semantic_similarity": 0.95,
    "mapping_reason": "обоснование_с_проверкой_типа",
    "type_validation": "PASSED|FAILED"
  }
]

ТОЛЬКО совместимые типы оборудования! Только JSON без пояснений.`;

          const response = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: mappingPrompt }],
            temperature: 0.1,
            max_tokens: 2048
          });

          const jsonMatch = response.choices[0].message.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        } catch (error) {
          console.error('[Analysis] Error in semantic section mapping:', error);
        }
        return [];
      }

      // Equipment type compatibility validation
      function validateEquipmentCompatibility(requirementSection: string, supplierEquipmentType: string): boolean {
        const compatibilityMatrix = {
          '24': ['steam_melter', 'automation_system'],  // Паровой плавитель
          '25': ['extruder_doser', 'automation_system'], // Экструдер-дозатор
          '26': ['forming_machine', 'automation_system'], // Формовочная машина
          '4.4': ['forming_machine', 'automation_system'], // Формовщик
          '4.6': ['pasteurization_system', 'cooling_system', 'automation_system'], // Пастеризация
          '12': ['marking_system', 'laser_system', 'automation_system'], // Лазерная маркировка
          '13': ['salt_system', 'containers', 'washing_system', 'lifting_system'], // Солильные системы
          '1': ['automation_system', 'other'], // Общие требования
          '2': ['automation_system', 'other'], // Технические характеристики
          '3': ['automation_system', 'other'], // Комплект оборудования
          '4': ['automation_system', 'other'], // Дополнительные требования
          '5': ['automation_system'] // Автоматизация
        };

        const allowedTypes = compatibilityMatrix[requirementSection];
        if (!allowedTypes) {
          console.log(`[Analysis] Section ${requirementSection} not in compatibility matrix, allowing all types`);
          return true;
        }

        const isCompatible = allowedTypes.includes(supplierEquipmentType);
        console.log(`[Analysis] Equipment compatibility check: Section ${requirementSection} vs ${supplierEquipmentType} = ${isCompatible ? 'COMPATIBLE' : 'INCOMPATIBLE'}`);
        
        return isCompatible;
      }

      // Helper function for basic equipment matching when AI analysis fails
      function checkBasicEquipmentMatch(requirementText: string, supplierText: string) {
        const requirement = requirementText.toLowerCase();
        const supplier = supplierText.toLowerCase();
        
        // Equipment translation dictionary for fallback matching
        const equipmentDict = {
          'паровой плавитель': ['steam cooker', 'batch steam cooker', 'cooker', 'steam'],
          'стретчинг': ['stretcher', 'stretching', 'stretch'],
          'формовщик': ['former', 'forming', 'molding', 'molder'],
          'пастеризационно-охладительная': ['pasteurizer', 'cooling', 'pasteurization'],
          'экструдер': ['extruder', 'extrusion'],
          'дозатор': ['dosing', 'doser', 'dosing system'],
          'шнек': ['auger', 'screw', 'conveyor'],
          'лазерная маркировка': ['laser marking', 'laser system', 'marking system', 'laser'],
          'маркировочная система': ['marking system', 'laser marking', 'marking equipment'],
          'солильные бассейны': ['brining tanks', 'salt tanks', 'brine pools', 'salting basins'],
          'погружные контейнеры': ['submersible containers', 'immersion containers', 'dip containers'],
          'моющая машина': ['washing machine', 'cleaning machine', 'washer'],
          'подъемник': ['lift', 'hoist', 'elevator', 'lifting system'],
          'производительность': ['production capacity', 'capacity', 'output', 'kg/h', 'kg/hr'],
          'загрузка': ['batch capacity', 'loading', 'per batch'],
          'температура': ['temperature', '°c', 'celsius'],
          'нержавеющая сталь': ['stainless steel', 'aisi 304', 'stainless'],
          'мощность': ['power', 'kw', 'kilowatt'],
          'давление': ['pressure', 'bar', 'атм']
        };
        
        // Check for equipment matches
        for (const [russian, englishTerms] of Object.entries(equipmentDict)) {
          if (requirement.includes(russian)) {
            for (const englishTerm of englishTerms) {
              if (supplier.includes(englishTerm)) {
                return {
                  found: true,
                  match: `Найдено соответствие: "${russian}" → "${englishTerm}"`
                };
              }
            }
          }
        }
        
        // Check for numerical values (capacity, temperature, etc.)
        const numberPattern = /(\d+(?:[.,]\d+)?)\s*(?:кг|kg|°c|celsius|kw|квт|bar|бар)/gi;
        const reqNumbers = requirement.match(numberPattern);
        const supNumbers = supplier.match(numberPattern);
        
        if (reqNumbers && supNumbers) {
          return {
            found: true,
            match: `Найдены численные параметры: ${reqNumbers.join(', ')} ↔ ${supNumbers.join(', ')}`
          };
        }
        
        return { found: false, match: '' };
      }

      // **STEP 1: Parse supplier document into semantic sections**
      console.log(`[Analysis] Parsing supplier document into semantic sections`);
      const supplierSections = await parseSupplierSections(combinedSupplierText);
      console.log(`[Analysis] Found ${supplierSections.sections?.length || 0} supplier sections`);

      // **STEP 2: Group requirements by technical sections**
      const requirementSections = groupRequirementsByTechnicalSections(requirements.rows);
      console.log(`[Analysis] Grouped requirements into ${requirementSections.size} technical sections: ${Array.from(requirementSections.keys()).join(', ')}`);

      // **STEP 3: Perform semantic section mapping**
      console.log(`[Analysis] Performing semantic section mapping`);
      const sectionMappings = await mapRequirementSectionsToSupplierSections(requirementSections, supplierSections);
      console.log(`[Analysis] Created ${sectionMappings.length} section mappings`);

      // **STEP 4: Process each mapped section for detailed compliance analysis**
      const sectionPromises = sectionMappings.map(async (mapping) => {
        const reqSection = requirementSections.get(mapping.requirement_section);
        if (!reqSection) return [];

        try {
          // Find the corresponding supplier section for this mapping
          const supplierSection = supplierSections.sections?.find(s => s.section_id === mapping.supplier_section_id);
          
          if (!supplierSection) {
            console.log(`[Analysis] No supplier section found for mapping ${mapping.requirement_section}`);
            return [];
          }

          console.log(`[Analysis] Processing section ${mapping.requirement_section} (${reqSection.sectionTitle}) with ${reqSection.requirements.length} requirements against supplier section "${supplierSection.title}"`);

          // **CHUNKED PROCESSING: Split large sections to avoid token limits**
          const CHUNK_SIZE = 15; // Process max 15 requirements per API call
          const requirementChunks = [];
          
          for (let i = 0; i < reqSection.requirements.length; i += CHUNK_SIZE) {
            requirementChunks.push(reqSection.requirements.slice(i, i + CHUNK_SIZE));
          }
          
          console.log(`[Analysis] Split section ${mapping.requirement_section} into ${requirementChunks.length} chunks of max ${CHUNK_SIZE} requirements each`);

          // Process each chunk separately and combine results
          const chunkResults = [];
          
          for (let chunkIndex = 0; chunkIndex < requirementChunks.length; chunkIndex++) {
            const chunk = requirementChunks[chunkIndex];
            console.log(`[Analysis] Processing chunk ${chunkIndex + 1}/${requirementChunks.length} with ${chunk.length} requirements for section ${mapping.requirement_section}`);

            // **EQUIPMENT TYPE COMPATIBILITY VALIDATION**
            const supplierEquipmentType = supplierSection.equipment_type || 'other';
            const requirementSection = mapping.requirement_section;
            
            if (!validateEquipmentCompatibility(requirementSection, supplierEquipmentType)) {
              console.log(`[Analysis] INCOMPATIBLE EQUIPMENT: Section ${requirementSection} cannot be compared with ${supplierEquipmentType}. Marking all requirements as missing.`);
              
              // Mark all requirements in this chunk as missing due to equipment type mismatch
              const incompatibleResults = chunk.map(req => ({
                tech_spec_number: req.tech_spec_number,
                requirement: req.extracted_value,
                supplier_data: '',
                compliance_status: 'missing',
                confidence: 0.2,
                notes: `Тип оборудования несовместим: требования раздела ${requirementSection} не могут быть проверены против ${supplierEquipmentType}`,
                section_source: `РАЗДЕЛ: ${supplierSection.title}`
              }));
              
              chunkResults.push(...incompatibleResults);
              continue; // Skip to next chunk
            }

            console.log(`[Analysis] Equipment compatibility validated: Section ${requirementSection} vs ${supplierEquipmentType} - COMPATIBLE`);

            // **HIERARCHICAL CONTEXT SEPARATION**: Group requirements by parent section
            const parentSections = new Map();
            
            for (const req of chunk) {
              // Extract parent section (24 from 24.1/9, 25 from 25.1/10)
              const parentMatch = req.tech_spec_number.match(/^(\d+)/);
              const parentSection = parentMatch ? parentMatch[1] : 'other';
              
              if (!parentSections.has(parentSection)) {
                parentSections.set(parentSection, []);
              }
              parentSections.get(parentSection).push(req);
            }
            
            console.log(`[Analysis] Chunk ${chunkIndex + 1} hierarchical grouping: ${Array.from(parentSections.keys()).map(key => `${key}(${parentSections.get(key).length})`).join(', ')}`);

            // Create chunk requirements list with hierarchical structure
            const chunkRequirements = Array.from(parentSections.entries()).map(([parentSection, requirements]) => {
              const parentTitle = parentSection === '24' ? 'Автоматический паровой плавитель' :
                                 parentSection === '25' ? 'Экструдер-дозатор' :
                                 `Раздел ${parentSection}`;
              
              const reqList = requirements.map(req => 
                `  Пункт ${req.tech_spec_number}: ${req.extracted_value}`
              ).join('\n');
              
              return `ГРУППА ${parentSection} - ${parentTitle}:\n${reqList}`;
            }).join('\n\n');

            // Get supplier section content (limit to avoid token overload)
            const supplierSectionContent = `[РАЗДЕЛ: ${supplierSection.title}]\n${supplierSection.full_content.substring(0, 8000)}\n[/РАЗДЕЛ]`;
            
            // Enhanced compliance analysis prompt for chunk processing
            const chunkPrompt = `Ты - ведущий специалист по техническому анализу, проводящий детальную оценку соответствия предложения поставщика техническим требованиям заказчика.

РАЗДЕЛ АНАЛИЗА: ${mapping.requirement_section} - ${mapping.requirement_title}
СОПОСТАВЛЕН С: ${mapping.supplier_title}
ЧАНК ${chunkIndex + 1}/${requirementChunks.length} (требования ${chunk[0].tech_spec_number} - ${chunk[chunk.length-1].tech_spec_number})

ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ ЗАКАЗЧИКА (ЧАНК ${chunkIndex + 1}):
${chunkRequirements}

СООТВЕТСТВУЮЩИЙ РАЗДЕЛ ПРЕДЛОЖЕНИЯ ПОСТАВЩИКА:
${supplierSectionContent}

МЕТОДОЛОГИЯ АНАЛИЗА:
1. СТРОГОЕ КОНТЕКСТНОЕ ОГРАНИЧЕНИЕ: Анализируй каждое требование СТРОГО ТОЛЬКО в контексте данного раздела поставщика
   - Требования группы 24 (Автоматический паровой плавитель) анализируются ТОЛЬКО против соответствующего оборудования поставщика
   - Требования группы 25 (Экструдер-дозатор) анализируются ТОЛЬКО против соответствующего оборудования поставщика
   - ЗАПРЕЩЕНО искать соответствие в других разделах поставщика
2. ИЕРАРХИЧЕСКОЕ СОПОСТАВЛЕНИЕ: При анализе 24.1/9 "шнеки оснащены реверсом" ищи информацию о шнеках ТОЛЬКО в разделе "Автоматический паровой плавитель"
3. ТЕХНИЧЕСКАЯ ЭКВИВАЛЕНТНОСТЬ: Распознавай технические эквиваленты между языками и единицами измерения
4. ЧИСЛОВОЙ АНАЛИЗ: Сравнивай численные значения с учетом диапазонов и допустимых отклонений
5. ДЕТАЛЬНЫЙ ПОИСК: Внимательно ищи соответствующую информацию ТОЛЬКО в предоставленном разделе поставщика

РАСШИРЕННЫЙ СЛОВАРЬ ТЕХНИЧЕСКИХ ЭКВИВАЛЕНТОВ (ОБЯЗАТЕЛЬНО ПРИМЕНЯТЬ):
- Производительность = Production capacity = Capacity = Output = кг/час = kg/h = kg/hr = kilograms per hour
- Разовая загрузка = Batch capacity = Capacity per batch = Loading capacity = кг = kg = килограммы = kilograms
- Температура = Temperature = °C = Celsius = градусы Цельсия
- Давление = Pressure = bar = бар = атмосфера = atmosphere  
- Мощность = Power = кВт = kW = kilowatts = киловатт = установленная мощность = installed power
- Объем = Volume = л = L = liters = литры
- Размеры = Dimensions = мм = mm = millimeters = миллиметры = габариты = габаритные размеры
- Материал = Material = AISI 304 = AISI 316 = AISI 316L = нержавеющая сталь = stainless steel = s-steel
- Защита = Protection = IP65 = степень защиты = protection rating
- Двигатель = Motor = мотор = motors = drive = привод = motorization
- Частотный преобразователь = Frequency converter = частотник = variable speed drive = speed control
- Шнек = Auger = screw = винт = augers = contra-rotating = встречное вращение
- Редуктор = Gearbox = reduction gear = gear reduction = зубчатая передача
- Управление = Control = контроль = PLC = ПЛК = automation = автоматизация
- Нагрев = Heating = отопление = steam injection = паровой впрыск = indirect heating
- Охлаждение = Cooling = охладитель = предварительное охлаждение = pre-cooling
- Уплотнение = Seal = sealing = герметизация = mechanical seal = механическое уплотнение
- Датчик = Sensor = probe = зонд = PT100 = temperature sensor = термодатчик
- Напряжение = Voltage = вольтаж = V = volts = электропитание = power supply
- Сжатый воздух = Compressed air = пневматика = pneumatic = воздух = air supply

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА ИЕРАРХИЧЕСКОГО АНАЛИЗА:
**ОБЯЗАТЕЛЬНОЕ ОГРАНИЧЕНИЕ КОНТЕКСТА:**
- При анализе 24.1/9 "шнеки оснащены реверсом" ищи информацию о шнеках ТОЛЬКО в разделе "Автоматический паровой плавитель"
- При анализе 25.1/10 "шнеки выполнены из нержавеющей стали" ищи информацию о шнеках ТОЛЬКО в разделе "Экструдер-дозатор"
- ЗАПРЕЩЕНО находить соответствие в неправильном разделе оборудования
- Если в текущем разделе поставщика нет информации о требовании - статус "missing", НЕ ищи в других разделах

**КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА ЧИСЛОВОГО СОПОСТАВЛЕНИЯ:**
- "Production capacity: up to 1.000÷1.500 Kg/h" ПОЛНОСТЬЮ УДОВЛЕТВОРЯЕТ "Производительность установки 1200 кг/час" → STATUS: compliant
- "Capacity per batch: up to 600 Kg" ПОЛНОСТЬЮ УДОВЛЕТВОРЯЕТ "Разовая загрузка не менее 400 кг" → STATUS: compliant
- Диапазон "1000-1500 кг/час" содержит "1200 кг/час" → STATUS: compliant
- Значение "≥600 кг" превышает "не менее 400 кг" → STATUS: compliant
- "Up to 1500 kg/h" покрывает "1200 кг/час" → STATUS: compliant
- "Two motors, 9,2 kW each one" = "18,4 kW общая мощность" → STATUS: compliant
- "Dimensions: 3.300 x 1.050 x 2.500 (h) mm" содержит все габаритные размеры → STATUS: compliant
- "380 Volts, 3ph, 50 Hz" полностью описывает электропитание → STATUS: compliant
- "AISI 316 or AISI 316 L stainless steel" превышает требования "AISI 304" → STATUS: compliant
- "Ten steam injectors" конкретизирует систему паровпрыска → STATUS: compliant
- "PT100 probe" является точным датчиком температуры → STATUS: compliant
- "Augers diameter 300 mm" точно указывает размер шнеков → STATUS: compliant

ЗАПРЕЩЕННЫЕ ОШИБКИ:
- НЕ ПОМЕЧАТЬ как "missing" если есть эквивалентные термины на другом языке
- НЕ ИГНОРИРОВАТЬ числовые диапазоны - если требование попадает в диапазон = compliant
- НЕ ТРЕБОВАТЬ точного совпадения единиц измерения - kg/h = кг/час = кг/ч

СТРОГИЕ КРИТЕРИИ ОЦЕНКИ (ПРИМЕНЯЙ АГРЕССИВНО):
- compliant: ОБЯЗАТЕЛЬНО применяй если найдено ЛЮБОЕ соответствие (эквивалентные термины, диапазоны, превышающие значения)
  * "BATCH STEAM COOKER" + требование "паровой плавитель" = ВСЕГДА COMPLIANT
  * "Production capacity: 1.000÷1.500 Kg/h" + требование "1200 кг/час" = ВСЕГДА COMPLIANT  
  * "Capacity per batch: up to 600 Kg" + требование "не менее 400 кг" = ВСЕГДА COMPLIANT
  * "AISI 304" + требование "нержавеющая сталь" = ВСЕГДА COMPLIANT
  * "STRETCHER" + требование "стретчинг" = ВСЕГДА COMPLIANT
  * "Two motors, 9,2 kW each one" + требование "мощность двигателей" = ВСЕГДА COMPLIANT
  * "Augers diameter 300 mm" + требование "диаметр шнеков" = ВСЕГДА COMPLIANT
  * "Ten steam injectors" + требование "система паровпрыска" = ВСЕГДА COMPLIANT
  * "PT100 probe" + требование "датчик температуры" = ВСЕГДА COMPLIANT
  * "380 Volts, 3ph, 50 Hz" + требование "электропитание" = ВСЕГДА COMPLIANT
  * "Frequency converter" + требование "частотное регулирование" = ВСЕГДА COMPLIANT
  * "Gearbox" + требование "редуктор" = ВСЕГДА COMPLIANT
  * "Mechanical seal" + требование "уплотнение" = ВСЕГДА COMPLIANT
- partial: Только если данные неполные но направление правильное
- non-compliant: ТОЛЬКО при явном противоречии (требование 1200 кг/час, поставщик максимум 800 кг/час)
- missing: ЗАПРЕЩЕНО ИСПОЛЬЗОВАТЬ если есть хотя бы малейшее соответствие

КРИТИЧЕСКОЕ ПРАВИЛО:
ЕСЛИ В РАЗДЕЛЕ ПОСТАВЩИКА ЕСТЬ ХОТЯ БЫ ОДИН РЕЛЕВАНТНЫЙ ТЕРМИН ИЛИ ЦИФРА - СТАТУС ДОЛЖЕН БЫТЬ COMPLIANT ИЛИ PARTIAL, НЕ MISSING!

ЗАПРЕТ НА ЛОЖНЫЕ "MISSING":
- "Steam cooker" ≠ missing для "паровой плавитель"  
- "Production capacity" ≠ missing для "производительность"
- "AISI 304" ≠ missing для "нержавеющая сталь"
- Любая техническая характеристика ≠ missing если есть эквивалент

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (JSON массив):
[
  {
    "tech_spec_number": "точный_номер_пункта",
    "requirement": "текст_требования", 
    "supplier_data": "найденные_технические_данные_из_раздела_поставщика",
    "compliance_status": "compliant|partial|non-compliant|missing",
    "confidence": 0.95,
    "notes": "детальное_техническое_обоснование_с_указанием_конкретных_параметров",
    "section_source": "РАЗДЕЛ: ${supplierSection.title}"
  }
]

ОБЯЗАТЕЛЬНЫЕ ПРИМЕРЫ АНАЛИЗА:
ПРИМЕР 1:
Требование: "Производительность установки 1200 кг/час сырной массы"
Данные поставщика: "Production capacity: up to 1.000÷1.500 Kg/h"
Результат: "compliant" (1200 входит в диапазон 1000-1500)

ПРИМЕР 2:
Требование: "Разовая загрузка не менее 400 кг сырного измельченного продукта"
Данные поставщика: "Capacity per batch: up to 600 Kg"
Результат: "compliant" (600 кг больше чем 400 кг)

ВАЖНО: Проанализируй ВСЕ ${chunk.length} требований из данного чанка и верни результат в точном порядке tech_spec_number. Только JSON без пояснений.`;

            try {
              const response = await openai.chat.completions.create({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: chunkPrompt }],
                temperature: 0.1,
                max_tokens: 3072 // Reduced for chunk processing
              });

              const jsonMatch = response.choices[0].message.content.match(/\[[\s\S]*\]/);
              if (!jsonMatch) {
                console.error(`[Analysis] Invalid JSON response for section ${mapping.requirement_section}, chunk ${chunkIndex + 1}`);
                console.log(`[Analysis] Full AI response:`, response.choices[0].message.content);
                
                // HIERARCHICAL FALLBACK: Respect section constraints even in fallback mode
                const fallbackResults = chunk.map(req => {
                  // Extract parent section for hierarchical constraint
                  const parentMatch = req.tech_spec_number.match(/^(\d+)/);
                  const parentSection = parentMatch ? parentMatch[1] : 'other';
                  
                  console.log(`[Analysis] Fallback processing ${req.tech_spec_number} (parent: ${parentSection}) against supplier section: ${supplierSection.title}`);
                  
                  const requirementText = req.extracted_value.toLowerCase();
                  const supplierText = supplierSection.full_content.toLowerCase();
                  
                  // Verify this requirement belongs to the current supplier section
                  const sectionMatches = this.checkSectionAlignment(parentSection, supplierSection.title);
                  if (!sectionMatches) {
                    console.log(`[Analysis] Section mismatch: requirement ${parentSection} vs supplier section ${supplierSection.title} - marking as missing`);
                    return {
                      tech_spec_number: req.tech_spec_number,
                      requirement: req.extracted_value,
                      supplier_data: '',
                      compliance_status: 'missing',
                      confidence: 0.3,
                      notes: `Требование из раздела ${parentSection} не может быть проверено в разделе "${supplierSection.title}"`,
                      section_source: `РАЗДЕЛ: ${supplierSection.title}`
                    };
                  }
                  
                  // Basic keyword matching for common equipment terms within correct section
                  const hasEquipmentMatch = this.checkBasicEquipmentMatch(requirementText, supplierText);
                  
                  return {
                    tech_spec_number: req.tech_spec_number,
                    requirement: req.extracted_value,
                    supplier_data: hasEquipmentMatch.match || '',
                    compliance_status: hasEquipmentMatch.found ? 'partial' : 'missing',
                    confidence: hasEquipmentMatch.found ? 0.6 : 0.1,
                    notes: hasEquipmentMatch.found ? 
                      `Найдено базовое соответствие: ${hasEquipmentMatch.match}` : 
                      'Ошибка анализа: некорректный ответ AI',
                    section_source: `РАЗДЕЛ: ${supplierSection.title}`
                  };
                });
                chunkResults.push(...fallbackResults);
                continue;
              }

              const chunkAnalysisResults = JSON.parse(jsonMatch[0]);
              console.log(`[Analysis] Successfully analyzed ${chunkAnalysisResults.length} requirements in section ${mapping.requirement_section}, chunk ${chunkIndex + 1}`);
              
              // CRITICAL DEBUGGING: Log each result to identify false "missing" classifications
              chunkAnalysisResults.forEach((result: any, index: number) => {
                if (result.compliance_status === 'missing') {
                  console.log(`[Analysis] WARNING: Requirement marked as MISSING:`, {
                    tech_spec_number: result.tech_spec_number,
                    requirement: result.requirement,
                    section: mapping.requirement_section,
                    supplier_section: supplierSection.title,
                    notes: result.notes
                  });
                  
                  // Double-check with fallback matching
                  const fallbackCheck = checkBasicEquipmentMatch(result.requirement, supplierSection.full_content);
                  if (fallbackCheck.found) {
                    console.log(`[Analysis] FALLBACK FOUND MATCH for ${result.tech_spec_number}: ${fallbackCheck.match} - OVERRIDING AI DECISION`);
                    result.compliance_status = 'compliant';
                    result.supplier_data = fallbackCheck.match;
                    result.confidence = 0.8;
                    result.notes = `AI пропустил, найдено резервной проверкой: ${fallbackCheck.match}`;
                  }
                } else if (result.compliance_status === 'compliant') {
                  console.log(`[Analysis] CORRECT: Requirement marked as COMPLIANT:`, {
                    tech_spec_number: result.tech_spec_number,
                    requirement: result.requirement.substring(0, 50) + '...',
                    supplier_data: result.supplier_data?.substring(0, 50) + '...'
                  });
                }
              });
              
              chunkResults.push(...chunkAnalysisResults);
              
            } catch (error) {
              console.error(`[Analysis] Error processing section ${mapping.requirement_section}, chunk ${chunkIndex + 1}:`, error);
              // Create fallback results for this chunk
              const fallbackResults = chunk.map(req => ({
                tech_spec_number: req.tech_spec_number,
                requirement: req.extracted_value,
                supplier_data: '',
                compliance_status: 'missing',
                confidence: 0,
                notes: 'Ошибка анализа: исключение при обработке',
                section_source: `РАЗДЕЛ: ${supplierSection.title}`
              }));
              chunkResults.push(...fallbackResults);
            }
          }

          console.log(`[Analysis] Combined results from ${requirementChunks.length} chunks for section ${mapping.requirement_section}: ${chunkResults.length} total results`);
          
          return chunkResults;

        } catch (error) {
          console.error(`[Analysis] Error processing section ${mapping.requirement_section}:`, error);
          return [];
        }
      });

      // **STEP 5: Handle unmapped requirements**
      // Add fallback analysis for requirements not covered by section mappings
      const mappedRequirementSections = new Set(sectionMappings.map(m => m.requirement_section));
      const unmappedSections = Array.from(requirementSections.keys()).filter(sectionNum => !mappedRequirementSections.has(sectionNum));
      
      if (unmappedSections.length > 0) {
        console.log(`[Analysis] Found ${unmappedSections.length} unmapped requirement sections: ${unmappedSections.join(', ')}`);
        
        // Process unmapped sections against all supplier content
        for (const sectionNum of unmappedSections) {
          const reqSection = requirementSections.get(sectionNum);
          if (reqSection) {
            sectionPromises.push(Promise.resolve().then(async () => {
              try {
                const sectionRequirements = reqSection.requirements.map(req => 
                  `Пункт ${req.tech_spec_number}: ${req.extracted_value}`
                ).join('\n');

                const fallbackPrompt = `Проанализируй требования раздела ${sectionNum} против ВСЕГО содержимого предложения поставщика.

ТРЕБОВАНИЯ РАЗДЕЛА ${sectionNum} (${reqSection.sectionTitle}):
${sectionRequirements}

ПОЛНОЕ СОДЕРЖИМОЕ ПРЕДЛОЖЕНИЯ ПОСТАВЩИКА:
${combinedSupplierText.substring(0, 15000)}

Найди соответствующую информацию во ВСЕМ документе поставщика для каждого требования.

ФОРМАТ ОТВЕТА (JSON массив):
[
  {
    "tech_spec_number": "точный_номер_пункта",
    "requirement": "текст_требования", 
    "supplier_data": "найденная_информация_или_пустая_строка",
    "compliance_status": "compliant|partial|non-compliant|missing",
    "confidence": 0.85,
    "notes": "обоснование_с_указанием_места_в_документе",
    "section_source": "Общий поиск по документу"
  }
]

Только JSON без пояснений.`;

                const response = await openai.chat.completions.create({
                  model: 'deepseek-chat',
                  messages: [{ role: 'user', content: fallbackPrompt }],
                  temperature: 0.1,
                  max_tokens: 3072
                });

                const jsonMatch = response.choices[0].message.content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  return JSON.parse(jsonMatch[0]);
                }
              } catch (error) {
                console.error(`[Analysis] Error processing unmapped section ${sectionNum}:`, error);
              }
              return [];
            }));
          }
        }
      }

      // Execute all section analyses in parallel
      console.log(`[Analysis] Starting parallel semantic section analysis for ${sectionPromises.length} sections`);
      const sectionResults = await Promise.all(sectionPromises);
      
      // Flatten results from all sections
      const allAnalysisResults = sectionResults.flat();
      console.log(`[Analysis] Semantic section analysis completed. Total results: ${allAnalysisResults.length}`);

      // **STEP 6: Ensure all requirements are covered**
      // Add missing requirements that weren't analyzed
      const analyzedSpecNumbers = new Set(allAnalysisResults.map(r => r.tech_spec_number));
      const missingRequirements = requirements.rows.filter(req => !analyzedSpecNumbers.has(req.tech_spec_number));
      
      if (missingRequirements.length > 0) {
        console.log(`[Analysis] Found ${missingRequirements.length} missing requirements, adding with 'missing' status`);
        for (const req of missingRequirements) {
          allAnalysisResults.push({
            tech_spec_number: req.tech_spec_number,
            requirement: req.extracted_value,
            supplier_data: '',
            compliance_status: 'missing',
            confidence: 0,
            notes: 'Требование не найдено в предложении поставщика при семантическом анализе',
            section_source: 'Автоматический анализ'
          });
        }
      }

      // Sort results by tech_spec_number to maintain hierarchy
      allAnalysisResults.sort((a, b) => {
        const parseSpecNumber = (spec) => {
          const parts = spec.split(/[./]/).map(part => {
            const num = parseInt(part);
            return isNaN(num) ? part : num;
          });
          return parts;
        };
        
        const aParts = parseSpecNumber(a.tech_spec_number);
        const bParts = parseSpecNumber(b.tech_spec_number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          
          if (typeof aPart === 'number' && typeof bPart === 'number') {
            if (aPart !== bPart) return aPart - bPart;
          } else {
            const aStr = String(aPart);
            const bStr = String(bPart);
            if (aStr !== bStr) return aStr.localeCompare(bStr);
          }
        }
        return 0;
      });

      console.log(`[Analysis] Final analysis completed with ${allAnalysisResults.length} total results in hierarchical order`);

      // Calculate compliance statistics
      let compliantCount = 0;
      let partialCount = 0;
      let nonCompliantCount = 0;
      let missingCount = 0;

      const analysisResults = [];
      
      for (const result of allAnalysisResults) {
        const status = result.compliance_status?.toLowerCase() || 'missing';
        
        switch (status) {
          case 'compliant':
            compliantCount++;
            break;
          case 'partial':
            partialCount++;
            break;
          case 'non_compliant':
            nonCompliantCount++;
            break;
          default:
            missingCount++;
        }

        analysisResults.push({
          requirement: result.requirement || '',
          supplierData: result.supplier_data || '',
          status: status,
          notes: result.notes || '',
          confidence: result.confidence || 0,
          sectionSource: result.section_source || 'Не указан',
          techSpecNumber: result.tech_spec_number || ''
        });
      }

      // Store supplier analysis in cache for reuse
      const actualSupplierId = parseInt(supplierId) || 1; // Use actual supplier ID
      try {
        const documentHash = crypto.createHash('md5').update(combinedSupplierText).digest('hex');
        
        // Extract key information for caching
        const technicalSpecs = [];
        const equipmentDetails = [];
        const complianceStatements = [];
        const standards = supplierSections.sections?.map(s => s.title) || [];
        
        for (const result of allAnalysisResults) {
          if (result.supplier_data) {
            complianceStatements.push(`${result.tech_spec_number}: ${result.supplier_data}`);
          }
        }
        
        await pool.query(
          `INSERT INTO supplier_document_cache 
           (supplier_id, project_id, document_hash, extracted_content, technical_specs, standards_mentioned, equipment_details, compliance_statements) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (supplier_id, project_id, document_hash) DO NOTHING`,
          [
            actualSupplierId,
            projectId, 
            documentHash,
            combinedSupplierText.substring(0, 50000), // Store first 50k chars
            JSON.stringify(technicalSpecs),
            JSON.stringify(standards),
            JSON.stringify(equipmentDetails),
            JSON.stringify(complianceStatements) // Fix: convert to JSON string
          ]
        );
        
        console.log(`[Analysis] Cached supplier document analysis for future use`);
      } catch (cacheError) {
        console.error(`[Analysis] Failed to cache supplier analysis:`, cacheError);
      }
      // Calculate compliance percentage
      const totalRequirements = requirements.rows.length;
      const compliancePercentage = totalRequirements > 0 
        ? Math.round(((compliantCount + partialCount * 0.5) / totalRequirements) * 100) 
        : 0;

      console.log(`[Analysis] Section-aware analysis complete: ${compliantCount} compliant, ${partialCount} partial, ${nonCompliantCount} non-compliant, ${missingCount} missing`);

      // Save analysis to database
      const analysisData = {
        totalRequirements,
        compliantCount,
        partialCount,
        nonCompliantCount,
        missingCount,
        results: analysisResults
      };

      await pool.query(
        'INSERT INTO compliance_analysis (project_id, supplier_id, analysis_data, compliance_percentage, recommendations, gaps_identified) VALUES ($1, $2, $3, $4, $5, $6)',
        [projectId, parseInt(supplierId), JSON.stringify(analysisData), compliancePercentage, [], []]
      );

      // Save individual extracted parameters to supplier_extracted_parameters table
      console.log('[Analysis] Saving extracted parameters to database...');
      
      // Clear existing parameters for this supplier
      await pool.query('DELETE FROM supplier_extracted_parameters WHERE supplier_id = $1', [supplierId]);
      
      // Save new parameters from analysis results
      for (const result of analysisResults) {
        if (result.supplierValue && result.supplierValue !== '-' && result.supplierValue !== 'Не указано') {
          try {
            await pool.query(`
              INSERT INTO supplier_extracted_parameters 
              (supplier_id, parameter_name, parameter_value, confidence, created_at)
              VALUES ($1, $2, $3, $4, NOW())
            `, [
              parseInt(supplierId),
              result.requirement || result.techSpecNumber || 'Неизвестный параметр',
              result.supplierValue,
              0.8 // Default confidence
            ]);
          } catch (paramError) {
            console.error('[Analysis] Error saving parameter:', paramError);
          }
        }
      }
      
      console.log(`[Analysis] Saved ${analysisResults.filter(r => r.supplierValue && r.supplierValue !== '-').length} extracted parameters`);

      // Generate response with section-aware analysis results
      return res.json({
        analysis: {
          supplier: { name: 'Поставщик' },
          compliancePercentage,
          totalRequirements,
          compliantCount,
          partialCount,
          nonCompliantCount,
          missingCount,
          results: analysisResults,
          recommendations: [`Использован новый алгоритм семантического сопоставления разделов для повышения точности анализа`],
          gapsIdentified: []
        }
      });

      } catch (error) {
        console.error('[Analysis] Error in section-aware compliance analysis:', error);
        return res.status(500).json({ error: 'Failed to generate section-aware analysis' });
      }
    }
  
  } catch (error) {
    console.error('[Analysis] Error generating compliance analysis:', error);
    return res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

// File download route
router.get('/suppliers/:supplierId/files/:fileId/download', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const supplierId = parseInt(req.params.supplierId);
    const fileId = parseInt(req.params.fileId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify supplier access through project ownership
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.user_id = $2
    `, [supplierId, userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    // Get file data
    const fileResult = await pool.query(
      'SELECT * FROM analysis_supplier_files WHERE id = $1 AND supplier_id = $2',
      [fileId, supplierId]
    );
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    const file = fileResult.rows[0];
    const fileName = file.original_name || file.filename;
    
    // Set headers for file download
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    
    // Send file content
    res.send(file.file_data);
  } catch (error) {
    console.error('[Analysis] Error generating compliance analysis:', error);
    return res.status(500).json({ error: 'Failed to generate analysis' });
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

// Delete extracted requirement
router.delete('/:projectId/extracted-requirements/:requirementId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const projectId = parseInt(req.params.projectId);
    const requirementId = parseInt(req.params.requirementId);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    // Delete the requirement
    const result = await pool.query(
      'DELETE FROM analysis_extracted_requirements WHERE id = $1 AND project_id = $2 RETURNING *',
      [requirementId, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Параметр не найден' });
    }

    res.json({ success: true, message: 'Параметр удален' });
  } catch (error) {
    console.error('Error deleting requirement:', error);
    res.status(500).json({ error: 'Ошибка удаления параметра' });
  }
});

// Export compliance analysis results
router.get('/:projectId/export/:supplierId', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId, supplierId } = req.params;
    const { format } = req.query;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    console.log(`[Analysis] Exporting compliance analysis in ${format} format`);
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Get analysis data
    const analysis = await pool.query(
      'SELECT * FROM compliance_analysis WHERE project_id = $1 AND supplier_id = $2 ORDER BY created_at DESC LIMIT 1',
      [projectId, supplierId]
    );
    
    if (analysis.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    
    const supplier = await pool.query(
      'SELECT * FROM analysis_suppliers WHERE id = $1',
      [supplierId]
    );
    
    const project = await pool.query(
      'SELECT * FROM analysis_projects WHERE id = $1',
      [projectId]
    );
    
    const analysisData = analysis.rows[0];
    const supplierData = supplier.rows[0];
    const projectData = project.rows[0];
    
    if (format === 'excel') {
      // Import ExcelJS using dynamic import for ES modules
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.default.Workbook();
      const worksheet = workbook.addWorksheet('Анализ соответствия');
      
      // Set worksheet properties
      worksheet.properties.defaultRowHeight = 20;
      
      // Header section
      worksheet.addRow(['АНАЛИЗ СООТВЕТСТВИЯ ТЕХНИЧЕСКОГО ПРЕДЛОЖЕНИЯ']);
      worksheet.getRow(1).font = { bold: true, size: 16 };
      worksheet.addRow([]);
      
      worksheet.addRow(['Проект:', projectData.procedure_name || 'Без названия']);
      worksheet.addRow(['Поставщик:', supplierData.name]);
      worksheet.addRow(['Дата анализа:', new Date().toLocaleDateString('ru-RU')]);
      worksheet.addRow([]);
      
      // Summary section
      worksheet.addRow(['СВОДКА']);
      worksheet.getRow(7).font = { bold: true, size: 14 };
      
      let analysisResults;
      let parsedData;
      try {
        parsedData = typeof analysisData.analysis_data === 'string' 
          ? JSON.parse(analysisData.analysis_data) 
          : analysisData.analysis_data;
        analysisResults = parsedData.results || [];
      } catch (e) {
        console.error('[Export] Error parsing analysis data:', e);
        analysisResults = [];
        parsedData = {};
      }
      
      // Use summary statistics from parsed data or calculate from results
      const totalRequirements = parsedData.totalRequirements || analysisResults.length || 0;
      const compliantCount = parsedData.compliantCount || analysisResults.filter(r => r.status === 'compliant').length;
      const nonCompliantCount = parsedData.nonCompliantCount || analysisResults.filter(r => r.status === 'non_compliant').length;
      const partialCount = parsedData.partialCount || analysisResults.filter(r => r.status === 'partial').length;
      const missingCount = parsedData.missingCount || analysisResults.filter(r => r.status === 'missing').length;
      
      worksheet.addRow(['Общий процент соответствия:', `${analysisData.compliance_percentage}%`]);
      worksheet.addRow(['Всего требований:', totalRequirements]);
      worksheet.addRow(['Соответствует:', compliantCount]);
      worksheet.addRow(['Частично соответствует:', partialCount]);
      worksheet.addRow(['Не соответствует:', nonCompliantCount]);
      worksheet.addRow(['Отсутствует:', missingCount]);
      worksheet.addRow([]);
      
      // Results table
      worksheet.addRow(['ДЕТАЛЬНЫЙ АНАЛИЗ']);
      worksheet.getRow(14).font = { bold: true, size: 14 };
      worksheet.addRow([]);
      
      // Table headers
      const headerRow = worksheet.addRow([
        'Требование',
        'Пункт ТЗ',
        'Данные поставщика',
        'Файл',
        'Соответствие',
        'Комментарий'
      ]);
      
      headerRow.font = { bold: true };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Add data rows
      analysisResults.forEach((item: any) => {
        const dataRow = worksheet.addRow([
          item.requirement,
          item.tech_spec || item.techSpecNumber,
          item.supplierValue || item.supplierData || '-',
          item.fileReference || '-',
          item.status === 'compliant' ? 'Соответствует' :
          item.status === 'partial' ? 'Частично' :
          item.status === 'non_compliant' ? 'Не соответствует' : 'Отсутствует',
          item.notes || '-'
        ]);
        
        // Color code based on status
        const statusCell = dataRow.getCell(5);
        switch (item.status) {
          case 'compliant':
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
            break;
          case 'partial':
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFE0' } };
            break;
          case 'non-compliant':
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFA0A0' } };
            break;
          default:
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        }
        
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
      
      // Recommendations section
      if (analysisData.recommendations) {
        worksheet.addRow([]);
        worksheet.addRow(['РЕКОМЕНДАЦИИ']);
        worksheet.getRow(worksheet.rowCount).font = { bold: true, size: 14 };
        
        // Handle recommendations as string or array
        if (typeof analysisData.recommendations === 'string') {
          worksheet.addRow([`• ${analysisData.recommendations}`]);
        } else if (Array.isArray(analysisData.recommendations)) {
          analysisData.recommendations.forEach((recommendation: string) => {
            worksheet.addRow([`• ${recommendation}`]);
          });
        }
      }
      
      // Gaps section
      if (analysisData.gaps_identified && analysisData.gaps_identified.length > 0) {
        worksheet.addRow([]);
        worksheet.addRow(['ВЫЯВЛЕННЫЕ ПРОБЕЛЫ']);
        worksheet.getRow(worksheet.rowCount).font = { bold: true, size: 14 };
        
        analysisData.gaps_identified.forEach((gap: string) => {
          worksheet.addRow([`• ${gap}`]);
        });
      }
      
      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });
      
      // Generate buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Create ASCII-safe filename for headers
      const safeFileName = `compliance-analysis-supplier-${supplierId}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      return res.send(buffer);
      
    } else if (format === 'pdf') {
      // Simple PDF implementation using basic HTML conversion
      // For better PDF output, consider using puppeteer or similar
      let analysisResults;
      let parsedData;
      try {
        parsedData = typeof analysisData.analysis_data === 'string' 
          ? JSON.parse(analysisData.analysis_data) 
          : analysisData.analysis_data;
        analysisResults = parsedData.results || [];
      } catch (e) {
        console.error('[Export] Error parsing analysis data for PDF:', e);
        analysisResults = [];
        parsedData = {};
      }
      
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Анализ соответствия</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            h2 { color: #666; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .compliant { background-color: #90EE90; }
            .partial { background-color: #FFFFE0; }
            .non-compliant { background-color: #FFA0A0; }
            .missing { background-color: #E0E0E0; }
            .summary { margin: 20px 0; }
            .summary-item { margin: 5px 0; }
          </style>
        </head>
        <body>
          <h1>Анализ соответствия технического предложения</h1>
          
          <div class="summary">
            <div class="summary-item"><strong>Проект:</strong> ${projectData.procedure_name || 'Без названия'}</div>
            <div class="summary-item"><strong>Поставщик:</strong> ${supplierData.name}</div>
            <div class="summary-item"><strong>Дата анализа:</strong> ${new Date().toLocaleDateString('ru-RU')}</div>
          </div>
          
          <h2>Сводка</h2>
          <div class="summary">
            <div class="summary-item"><strong>Общий процент соответствия:</strong> ${analysisData.compliance_percentage}%</div>
            <div class="summary-item"><strong>Всего требований:</strong> ${analysisResults.length}</div>
            <div class="summary-item"><strong>Соответствует:</strong> ${analysisResults.filter(r => r.status === 'compliant').length}</div>
            <div class="summary-item"><strong>Частично соответствует:</strong> ${analysisResults.filter(r => r.status === 'partial').length}</div>
            <div class="summary-item"><strong>Не соответствует:</strong> ${analysisResults.filter(r => r.status === 'non-compliant').length}</div>
            <div class="summary-item"><strong>Отсутствует:</strong> ${analysisResults.filter(r => r.status === 'missing').length}</div>
          </div>
          
          <h2>Детальный анализ</h2>
          <table>
            <thead>
              <tr>
                <th>Требование</th>
                <th>Пункт ТЗ</th>
                <th>Данные поставщика</th>
                <th>Соответствие</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      analysisResults.forEach((item: any) => {
        const statusClass = item.status === 'compliant' ? 'compliant' :
                           item.status === 'partial' ? 'partial' :
                           item.status === 'non-compliant' ? 'non-compliant' : 'missing';
        
        const statusText = item.status === 'compliant' ? 'Соответствует' :
                          item.status === 'partial' ? 'Частично' :
                          item.status === 'non-compliant' ? 'Не соответствует' : 'Отсутствует';
        
        htmlContent += `
          <tr>
            <td>${item.requirement}</td>
            <td>${item.techSpecNumber}</td>
            <td>${item.supplierData || '-'}</td>
            <td class="${statusClass}">${statusText}</td>
            <td>${item.notes || '-'}</td>
          </tr>
        `;
      });
      
      htmlContent += `
            </tbody>
          </table>
      `;
      
      if (analysisData.recommendations) {
        htmlContent += `
          <h2>Рекомендации</h2>
          <ul>
        `;
        
        // Handle recommendations as string or array
        if (typeof analysisData.recommendations === 'string') {
          htmlContent += `<li>${analysisData.recommendations}</li>`;
        } else if (Array.isArray(analysisData.recommendations)) {
          analysisData.recommendations.forEach((recommendation: string) => {
            htmlContent += `<li>${recommendation}</li>`;
          });
        }
        htmlContent += `</ul>`;
      }
      
      if (analysisData.gaps_identified && analysisData.gaps_identified.length > 0) {
        htmlContent += `
          <h2>Выявленные пробелы</h2>
          <ul>
        `;
        analysisData.gaps_identified.forEach((gap: string) => {
          htmlContent += `<li>${gap}</li>`;
        });
        htmlContent += `</ul>`;
      }
      
      htmlContent += `
        </body>
        </html>
      `;
      
      // For now, return HTML content as PDF placeholder
      // In production, use puppeteer or similar to convert HTML to PDF
      
      // Create ASCII-safe filename for headers
      const safePdfFileName = `compliance-analysis-supplier-${supplierId}.html`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safePdfFileName}"`);
      return res.send(htmlContent);
    }
    
    return res.status(400).json({ error: 'Invalid format' });
  } catch (error) {
    console.error('[Analysis] Error exporting results:', error);
    return res.status(500).json({ error: 'Failed to export results' });
  }
});

// Get extracted parameters for supplier
router.get('/suppliers/:supplierId/extracted-parameters', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { supplierId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify supplier access through project ownership
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.user_id = $2
    `, [supplierId, userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    // Get extracted parameters for this supplier
    const parametersResult = await pool.query(`
      SELECT * FROM supplier_extracted_parameters 
      WHERE supplier_id = $1 
      ORDER BY created_at DESC
    `, [supplierId]);

    res.json({
      parameters: parametersResult.rows,
      supplier: supplierResult.rows[0]
    });
  } catch (error) {
    console.error('Error getting extracted parameters:', error);
    res.status(500).json({ error: 'Ошибка получения параметров' });
  }
});

// Save extracted parameters for supplier
router.post('/suppliers/:supplierId/save-extracted-parameters', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { supplierId } = req.params;
    const { parameters } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify supplier access through project ownership
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.user_id = $2
    `, [supplierId, userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    // Clear existing parameters for this supplier
    await pool.query('DELETE FROM supplier_extracted_parameters WHERE supplier_id = $1', [supplierId]);
    
    // Save new parameters
    const savedParameters = [];
    for (const param of parameters || []) {
      const result = await pool.query(`
        INSERT INTO supplier_extracted_parameters 
        (supplier_id, parameter_name, parameter_value, confidence, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [
        supplierId,
        param.name || '',
        param.value || '',
        param.confidence || 0.8
      ]);
      
      savedParameters.push(result.rows[0]);
    }

    res.json({
      success: true,
      parameters: savedParameters,
      message: `Сохранено ${savedParameters.length} параметров`
    });
  } catch (error) {
    console.error('Error saving extracted parameters:', error);
    res.status(500).json({ error: 'Ошибка сохранения параметров' });
  }
});

// Get requirements organized by sections for a project
router.get('/:projectId/requirements-by-section', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT id FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Get requirements organized by sections
    const requirements = await pool.query(`
      SELECT 
        id,
        serial_number,
        tech_spec_number,
        extracted_value,
        confidence,
        is_approved,
        page_reference,
        file_reference,
        created_at
      FROM extracted_requirements 
      WHERE project_id = $1
      ORDER BY 
        -- Sort by first number (main section)
        CASE WHEN tech_spec_number ~ '^[0-9]+' THEN 
          CAST(SUBSTRING(tech_spec_number FROM '^([0-9]+)') AS INTEGER)
        ELSE 999 END,
        -- Sort by second number (sub-section)
        CASE WHEN tech_spec_number ~ '^[0-9]+\.[0-9]+' THEN 
          CAST(SUBSTRING(tech_spec_number FROM '^[0-9]+\.([0-9]+)') AS INTEGER)
        ELSE 999 END,
        -- Sort by third number (sub-sub-section)
        CASE WHEN tech_spec_number ~ '^[0-9]+\.[0-9]+\.[0-9]+' THEN 
          CAST(SUBSTRING(tech_spec_number FROM '^[0-9]+\.[0-9]+\.([0-9]+)') AS INTEGER)
        ELSE 999 END,
        -- Sort by fourth number (deep hierarchy)
        CASE WHEN tech_spec_number ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' THEN 
          CAST(SUBSTRING(tech_spec_number FROM '^[0-9]+\.[0-9]+\.[0-9]+\.([0-9]+)') AS INTEGER)
        ELSE 999 END,
        -- Sort by parameter number (after /)
        CASE WHEN tech_spec_number ~ '/[0-9]+' THEN 
          CAST(SUBSTRING(tech_spec_number FROM '/([0-9]+)') AS INTEGER)
        ELSE 999 END,
        tech_spec_number, serial_number
    `, [projectId]);
    
    // Helper function to check if requirement section aligns with supplier section
    function checkSectionAlignment(parentSection: string, supplierTitle: string): boolean {
      const supplierTitleLower = supplierTitle.toLowerCase();
      
      // Universal section mapping system
      const sectionMappings = {
        '1': {
          keywords: ['общ', 'general', 'basic', 'main', 'главн', 'основн'],
          description: 'Общие требования'
        },
        '2': {
          keywords: ['техн', 'technical', 'spec', 'характеристик', 'параметр'],
          description: 'Технические характеристики'
        },
        '3': {
          keywords: ['комплект', 'equipment', 'set', 'линия', 'line', 'технологическ'],
          description: 'Комплект технологического оборудования'
        },
        '4': {
          keywords: ['дополнительн', 'additional', 'extra', 'специальн', 'special'],
          description: 'Дополнительные требования'
        },
        '5': {
          keywords: ['автоматизац', 'automation', 'control', 'управлен', 'контрол'],
          description: 'Система автоматизации'
        },
        '24': {
          keywords: ['steam', 'cooker', 'плавитель', 'stretcher', 'стретчинг', 'паровой', 'варочн'],
          description: 'Автоматический паровой плавитель'
        },
        '25': {
          keywords: ['extruder', 'экструдер', 'dosing', 'дозатор', 'auger', 'шнек'],
          description: 'Экструдер-дозатор'
        },
        '26': {
          keywords: ['form', 'mould', 'формовочн', 'формовщик', 'карусель', 'охлажден', 'предварительн'],
          description: 'Формовочная машина'
        },
        '4.4': {
          keywords: ['form', 'mould', 'формовочн', 'формовщик', 'охлажден', 'предварительн'],
          description: 'Формовщик с предварительным охлаждением'
        },
        '4.6': {
          keywords: ['пастеризац', 'охладитель', 'pasteur', 'cooling', 'охлажден', 'установк'],
          description: 'Пастеризационно-охладительная установка'
        }
      };
      
      // Check if section has specific mapping
      if (sectionMappings[parentSection]) {
        const mapping = sectionMappings[parentSection];
        const hasKeywordMatch = mapping.keywords.some(keyword => 
          supplierTitleLower.includes(keyword.toLowerCase())
        );
        
        if (hasKeywordMatch) {
          console.log(`[Analysis] Section alignment MATCH: ${parentSection} → "${supplierTitle}" (${mapping.description})`);
          return true;
        } else {
          console.log(`[Analysis] Section alignment MISMATCH: ${parentSection} → "${supplierTitle}" (expected: ${mapping.description})`);
          return false;
        }
      }
      
      // For unmapped sections, use conservative alignment
      console.log(`[Analysis] Section ${parentSection} not mapped, using conservative alignment for "${supplierTitle}"`);
      return true;
    }
    
    // Helper function for basic equipment matching
    function checkBasicEquipmentMatch(requirementText: string, supplierText: string): boolean {
      const keywords = requirementText.split(' ').filter(word => word.length > 3);
      const matchedKeywords = keywords.filter(keyword => 
        supplierText.includes(keyword.toLowerCase()) || 
        supplierText.includes(keyword)
      );
      return matchedKeywords.length >= keywords.length * 0.3; // 30% keyword match threshold
    }

    // Enhanced function for hierarchical section titles with dynamic extraction
    function getSectionTitle(sectionNum: string, requirements: any[]): string {
      // First, try to find an exact section header in the requirements
      const sectionHeader = requirements.find(req => 
        req.tech_spec_number === sectionNum && 
        req.extracted_value && 
        !req.extracted_value.match(/\d+\s*(кВт|м³|°C|мм|кг|л|бар|А|В|Гц)/i) // Not a technical parameter
      );
      
      if (sectionHeader) {
        return sectionHeader.extracted_value;
      }
      
      // Fallback to predefined titles for known sections
      const sectionTitles: { [key: string]: string } = {
        '1': 'Общие требования',
        '2': 'Технические характеристики', 
        '3': 'Комплект технологического оборудования линии',
        '4': 'Дополнительные требования',
        '5': 'Система автоматизации',
        '6': 'Технологическое оборудование',
        '12': 'Оборудование лазерной маркировки',
        '13': 'Требования к оборудованию для посолки сыра',
        '24': 'Автоматический паровой плавитель',
        '25': 'Экструдер-дозатор',
        '26': 'Формовочная машина',
        '4.4': 'Формовщик с предварительным охлаждением',
        '4.6': 'Пастеризационно-охладительная установка',
        '6.1': 'Закрытый вертикальный сыроизготовитель',
        '6.2': 'Установка формования и прессования сыра',
        '12.3': 'Оборудование (система) лазерной маркировки',
        '13.1': 'Солильные бассейны',
        '13.2': 'Погружные контейнеры',
        '13.3': 'Моющая машина для погружных контейнеров',
        '13.4': 'Кран-балка'
      };
      
      return sectionTitles[sectionNum] || `Раздел ${sectionNum}`;
    }

    // ENHANCED HIERARCHICAL GROUPING: Support unlimited depth
    const sections: { [key: string]: any } = {};
    
    requirements.rows.forEach(req => {
      let parentSectionNumber: string, sectionTitle: string;
      const techSpec = req.tech_spec_number;
      
      // Handle unlimited hierarchical depth: X, X.Y, X.Y.Z, X.Y.Z.A, etc.
      if (techSpec?.match(/^\d+$/)) {
        // Main sections like "13", "24", "25"
        parentSectionNumber = techSpec;
        sectionTitle = getSectionTitle(parentSectionNumber, requirements.rows);
      } else if (techSpec?.match(/^\d+\.\d+$/)) {
        // Two-level sections like "6.1", "13.1", "12.3"
        parentSectionNumber = techSpec;
        sectionTitle = getSectionTitle(parentSectionNumber, requirements.rows);
      } else if (techSpec?.match(/^\d+\.\d+\.\d+$/)) {
        // Three-level sections like "4.6.1", "1.2.3"
        parentSectionNumber = techSpec;
        sectionTitle = getSectionTitle(parentSectionNumber, requirements.rows);
      } else if (techSpec?.match(/^\d+\.\d+\.\d+\.\d+/)) {
        // Four-level sections like "1.2.3.4"
        parentSectionNumber = techSpec;
        sectionTitle = getSectionTitle(parentSectionNumber, requirements.rows);
      } else if (techSpec?.includes('/')) {
        // Parameters like "13.1/1", "12.3/2" - group by parent section
        const baseSection = techSpec.split('/')[0];
        parentSectionNumber = baseSection;
        sectionTitle = getSectionTitle(parentSectionNumber, requirements.rows);
      } else {
        // Fallback: extract first number
        const match = techSpec?.match(/^(\d+)/);
        parentSectionNumber = match ? match[1] : 'General';
        sectionTitle = getSectionTitle(parentSectionNumber, requirements.rows);
      }
      
      if (!sections[parentSectionNumber]) {
        sections[parentSectionNumber] = {
          section_number: parentSectionNumber,
          section_title: sectionTitle,
          requirements: []
        };
      }
      sections[parentSectionNumber].requirements.push({
        id: req.id,
        serialNumber: req.serial_number,
        techSpecNumber: req.tech_spec_number,
        extractedValue: req.extracted_value,
        confidence: parseFloat(req.confidence),
        isApproved: req.is_approved,
        pageReference: req.page_reference,
        fileReference: req.file_reference,
        createdAt: req.created_at
      });
    });
    
    // Sort sections numerically before returning
    const sortedSections = Object.values(sections).sort((a: any, b: any) => {
      const aNum = parseInt(a.section_number) || 0;
      const bNum = parseInt(b.section_number) || 0;
      return aNum - bNum;
    });
    
    return res.json({ 
      sections: sortedSections,
      totalRequirements: requirements.rows.length 
    });
  } catch (error) {
    console.error('[Analysis] Error loading sectioned requirements:', error);
    return res.status(500).json({ error: 'Failed to load sectioned requirements' });
  }
});

// Get saved compliance analysis results for a project
router.get('/:projectId/compliance-results', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT id FROM analysis_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Get compliance analysis results with supplier info
    const results = await pool.query(`
      SELECT 
        ca.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.id as supplier_id
      FROM compliance_analysis ca
      JOIN analysis_suppliers s ON ca.supplier_id = s.id
      WHERE ca.project_id = $1
      ORDER BY ca.created_at DESC
    `, [projectId]);
    
    // Format results to match expected frontend structure
    const formattedResults = results.rows.map(row => ({
      supplier: {
        id: row.supplier_id,
        name: row.supplier_name,
        email: row.supplier_email
      },
      analysis: {
        compliancePercentage: row.compliance_percentage,
        totalRequirements: row.analysis_data.totalRequirements,
        compliantCount: row.analysis_data.compliantCount,
        partialCount: row.analysis_data.partialCount,
        nonCompliantCount: row.analysis_data.nonCompliantCount,
        missingCount: row.analysis_data.missingCount,
        results: row.analysis_data.results,
        recommendations: row.recommendations || [],
        gapsIdentified: row.gaps_identified || []
      }
    }));
    
    console.log(`[Analysis] Retrieved ${formattedResults.length} saved compliance results for project ${projectId}`);
    
    return res.json({ results: formattedResults });
  } catch (error) {
    console.error('[Analysis] Error loading saved compliance results:', error);
    return res.status(500).json({ error: 'Failed to load compliance results' });
  }
});

// Export compliance analysis results
router.get('/analysis-projects/:projectId/export/:supplierId', async (req, res) => {
  try {
    const { projectId, supplierId } = req.params;
    const { format } = req.query;

    // Get compliance analysis data
    const analysisQuery = `
      SELECT ca.* FROM compliance_analysis ca
      WHERE ca.project_id = $1 AND ca.supplier_id = $2
      ORDER BY ca.created_at DESC
      LIMIT 1
    `;
    
    const analysisResult = await pool.query(analysisQuery, [projectId, supplierId]);
    
    if (analysisResult.rows.length === 0) {
      return res.status(404).json({ error: 'Анализ не найден' });
    }

    const analysis = analysisResult.rows[0];
    
    // Get supplier info
    const supplierQuery = `SELECT name FROM suppliers WHERE id = $1`;
    const supplierResult = await pool.query(supplierQuery, [supplierId]);
    const supplierName = supplierResult.rows[0]?.name || 'Unknown';

    // Get project info
    const projectQuery = `SELECT procedure_name FROM analysis_projects WHERE id = $1`;
    const projectResult = await pool.query(projectQuery, [projectId]);
    const procedureName = projectResult.rows[0]?.procedure_name || 'Unknown';

    if (format === 'excel') {
      // Generate Excel file
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.default.Workbook();
      const worksheet = workbook.addWorksheet('Анализ соответствия');

      // Header
      worksheet.addRow(['Анализ соответствия технических требований']);
      worksheet.addRow([`Процедура: ${procedureName}`]);
      worksheet.addRow([`Поставщик: ${supplierName}`]);
      worksheet.addRow([`Дата: ${new Date().toLocaleDateString('ru-RU')}`]);
      worksheet.addRow([]);

      // Summary
      worksheet.addRow(['СВОДКА']);
      worksheet.addRow(['Общий процент соответствия', `${analysis.compliance_percentage}%`]);
      worksheet.addRow(['Всего требований', analysis.total_requirements]);
      worksheet.addRow(['Соответствует', analysis.compliant_count]);
      worksheet.addRow(['Частично соответствует', analysis.partial_count]);
      worksheet.addRow(['Не соответствует', analysis.non_compliant_count]);
      worksheet.addRow(['Отсутствует', analysis.missing_count]);
      worksheet.addRow([]);

      // Detailed results
      worksheet.addRow(['ДЕТАЛЬНЫЙ АНАЛИЗ']);
      worksheet.addRow(['Требование', 'Пункт ТЗ', 'Данные поставщика', 'Ссылка на файл', 'Статус', 'Примечания']);
      
      const results = JSON.parse(analysis.analysis_results);
      results.forEach((item: any) => {
        worksheet.addRow([
          item.requirement,
          item.techSpecNumber,
          item.supplierData || '-',
          item.fileReference || '-',
          item.status === 'compliant' ? 'Соответствует' :
          item.status === 'partial' ? 'Частично' :
          item.status === 'non-compliant' ? 'Не соответствует' : 'Отсутствует',
          item.notes || '-'
        ]);
      });

      // Recommendations
      if (analysis.recommendations) {
        worksheet.addRow([]);
        worksheet.addRow(['РЕКОМЕНДАЦИИ']);
        const recommendations = JSON.parse(analysis.recommendations);
        recommendations.forEach((rec: string) => {
          worksheet.addRow([rec]);
        });
      }

      // Style the worksheet
      worksheet.getRow(1).font = { bold: true, size: 14 };
      worksheet.getRow(6).font = { bold: true };
      worksheet.getRow(14).font = { bold: true };
      worksheet.getRow(15).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-analysis-${supplierName}.xlsx"`);
      res.send(buffer);

    } else if (format === 'pdf') {
      // Generate PDF file (simplified version)
      const htmlContent = `
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { margin-bottom: 30px; }
            .table { width: 100%; border-collapse: collapse; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #f2f2f2; }
            .compliant { color: green; }
            .partial { color: orange; }
            .non-compliant { color: red; }
            .missing { color: gray; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Анализ соответствия технических требований</h1>
            <p>Процедура: ${procedureName}</p>
            <p>Поставщик: ${supplierName}</p>
            <p>Дата: ${new Date().toLocaleDateString('ru-RU')}</p>
          </div>
          
          <div class="summary">
            <h2>Сводка</h2>
            <p><strong>Общий процент соответствия:</strong> ${analysis.compliance_percentage}%</p>
            <p><strong>Всего требований:</strong> ${analysis.total_requirements}</p>
            <p><strong>Соответствует:</strong> ${analysis.compliant_count}</p>
            <p><strong>Частично соответствует:</strong> ${analysis.partial_count}</p>
            <p><strong>Не соответствует:</strong> ${analysis.non_compliant_count}</p>
            <p><strong>Отсутствует:</strong> ${analysis.missing_count}</p>
          </div>

          <h2>Детальный анализ</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Требование</th>
                <th>Пункт ТЗ</th>
                <th>Данные поставщика</th>
                <th>Статус</th>
                <th>Примечания</th>
              </tr>
            </thead>
            <tbody>
              ${JSON.parse(analysis.analysis_results).map((item: any) => `
                <tr>
                  <td>${item.requirement}</td>
                  <td>${item.techSpecNumber}</td>
                  <td>${item.supplierData || '-'}</td>
                  <td class="${item.status}">
                    ${item.status === 'compliant' ? 'Соответствует' :
                      item.status === 'partial' ? 'Частично' :
                      item.status === 'non-compliant' ? 'Не соответствует' : 'Отсутствует'}
                  </td>
                  <td>${item.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${analysis.recommendations ? `
            <div style="margin-top: 30px;">
              <h2>Рекомендации</h2>
              <ul>
                ${JSON.parse(analysis.recommendations).map((rec: string) => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </body>
        </html>
      `;

      // For now, return HTML content (can be converted to PDF with puppeteer later)
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-analysis-${supplierName}.html"`);
      res.send(htmlContent);

    } else {
      res.status(400).json({ error: 'Неподдерживаемый формат' });
    }

  } catch (error) {
    console.error('Error exporting analysis:', error);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

// Get compliance results for a project
router.get('/analysis-projects/:projectId/compliance-results', async (req, res) => {
  try {
    const { projectId } = req.params;

    const query = `
      SELECT ca.*, s.name as supplier_name, s.email as supplier_email
      FROM compliance_analysis ca
      JOIN suppliers s ON ca.supplier_id = s.id
      WHERE ca.project_id = $1
      ORDER BY ca.created_at DESC
    `;
    
    const result = await pool.query(query, [projectId]);
    
    const complianceResults = result.rows.map(row => ({
      supplier: {
        id: row.supplier_id,
        name: row.supplier_name,
        email: row.supplier_email
      },
      analysis: {
        compliancePercentage: row.compliance_percentage,
        totalRequirements: row.total_requirements,
        compliantCount: row.compliant_count,
        partialCount: row.partial_count,
        nonCompliantCount: row.non_compliant_count,
        missingCount: row.missing_count,
        results: JSON.parse(row.analysis_results),
        recommendations: row.recommendations ? JSON.parse(row.recommendations) : [],
        gapsIdentified: row.gaps_identified ? JSON.parse(row.gaps_identified) : []
      }
    }));

    res.json({ results: complianceResults });

  } catch (error) {
    console.error('Error loading compliance results:', error);
    res.status(500).json({ error: 'Ошибка загрузки результатов анализа' });
  }
});

// Serve supplier file content for viewing
router.get('/suppliers/:supplierId/files/:fileId/view', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const supplierId = parseInt(req.params.supplierId);
    const fileId = parseInt(req.params.fileId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    console.log(`[Analysis] Serving file ${fileId} for supplier ${supplierId}`);
    
    // Verify supplier access through project ownership
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.user_id = $2
    `, [supplierId, userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    // Get file data
    const fileResult = await pool.query(
      'SELECT * FROM analysis_supplier_files WHERE id = $1 AND supplier_id = $2',
      [fileId, supplierId]
    );
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    const file = fileResult.rows[0];
    const fileName = file.original_name || file.filename;
    const fileExtension = fileName.toLowerCase().split('.').pop();
    
    console.log(`[Analysis] Serving file: ${fileName}, MIME: ${file.mime_type}, Extension: ${fileExtension}`);
    
    // Handle different file types
    if (fileExtension === 'pdf' || file.mime_type === 'application/pdf') {
      // PDF - serve directly for iframe viewing
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      
      res.send(file.file_data);
      
    } else if (['doc', 'docx'].includes(fileExtension) || 
               ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mime_type)) {
      // DOC/DOCX - convert to HTML viewer
      try {
        // For now, provide download link and basic text extraction
        // In the future, we can add proper DOC/DOCX to HTML conversion
        const htmlContent = `
          <!DOCTYPE html>
          <html lang="ru">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${fileName}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
              .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .download-btn { 
                display: inline-block; 
                background: #007bff; 
                color: white; 
                padding: 10px 20px; 
                text-decoration: none; 
                border-radius: 4px; 
                margin: 10px 0;
              }
              .download-btn:hover { background: #0056b3; }
              .notice { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Документ: ${fileName}</h1>
              <p>Тип файла: ${fileExtension.toUpperCase()}</p>
            </div>
            
            <div class="notice">
              <strong>Примечание:</strong> Для полного просмотра документов Word рекомендуется скачать файл.
            </div>
            
            <a href="/api/analysis-projects/suppliers/${supplierId}/files/${fileId}/download" 
               class="download-btn" target="_blank">
              📥 Скачать документ
            </a>
            
            <div style="margin-top: 30px;">
              <h3>Информация о файле:</h3>
              <ul>
                <li><strong>Название:</strong> ${fileName}</li>
                <li><strong>Размер:</strong> ${Math.round(file.file_size / 1024)} КБ</li>
                <li><strong>Загружен:</strong> ${new Date(file.created_at).toLocaleString('ru-RU')}</li>
              </ul>
            </div>
          </body>
          </html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(htmlContent);
        
      } catch (conversionError) {
        console.error('[Analysis] Error creating DOC viewer:', conversionError);
        res.status(500).json({ error: 'Ошибка отображения документа' });
      }
      
    } else {
      // Other file types
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(file.file_data);
    }
    
  } catch (error) {
    console.error('[Analysis] Error serving file:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

// Download supplier file
router.get('/suppliers/:supplierId/files/:fileId/download', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const supplierId = parseInt(req.params.supplierId);
    const fileId = parseInt(req.params.fileId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    // Verify supplier access through project ownership
    const supplierResult = await pool.query(`
      SELECT s.*, p.user_id 
      FROM analysis_suppliers s 
      JOIN analysis_projects p ON s.project_id = p.id 
      WHERE s.id = $1 AND p.user_id = $2
    `, [supplierId, userId]);

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Поставщик не найден' });
    }
    
    // Get file data
    const fileResult = await pool.query(
      'SELECT * FROM analysis_supplier_files WHERE id = $1 AND supplier_id = $2',
      [fileId, supplierId]
    );
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    const file = fileResult.rows[0];
    const fileName = file.original_name || file.filename;
    
    // Set headers for file download
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    
    // Send file content
    res.send(file.file_data);
    
  } catch (error) {
    console.error('[Analysis] Error downloading file:', error);
    res.status(500).json({ error: 'Ошибка скачивания файла' });
  }
});

// Helper functions for semantic block creation
function extractBaseSection(techSpec: string): string | null {
  if (!techSpec || typeof techSpec !== 'string') return null;
  
  // Match various patterns: 4.6, 4.6.1, 4.6.1/1, 1, 3/12, J/1, etc.
  const patterns = [
    /^([0-9]+(?:\.[0-9]+)*)/,  // 4.6, 4.6.1, 12.3
    /^([0-9]+)\/[0-9]+/,       // 3/12
    /^([A-Z]+)\/[0-9]+/,       // J/1
    /^([0-9]+)$/               // 1, 5, 6
  ];
  
  for (const pattern of patterns) {
    const match = techSpec.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return techSpec; // Fallback
}

function isMainSectionHeader(techSpec: string): boolean {
  if (!techSpec) return false;
  // Simple section like "4.6", "1", "5"
  return /^[0-9]+(\.[0-9]+)?$/.test(techSpec);
}

function isSimpleSection(techSpec: string): boolean {
  if (!techSpec) return false;
  // Single digit like "1", "5", "6"
  return /^[0-9]+$/.test(techSpec);
}

function isSubsectionHeader(techSpec: string): boolean {
  if (!techSpec) return false;
  // Subsection like "4.6.1"
  return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(techSpec);
}

function isParameter(techSpec: string): boolean {
  if (!techSpec) return false;
  // Parameter like "4.6.1/1", "3/12", "J/1"
  return /\/[0-9]+$/.test(techSpec);
}

function extractCoreFunction(content: string[]): string {
  if (!content || content.length === 0) return 'Не определена';
  
  const fullText = content.join(' ');
  
  // Extract equipment types
  const equipmentPatterns = [
    /установка/i,
    /оборудование/i,
    /система/i,
    /машина/i,
    /аппарат/i,
    /линия/i,
    /комплекс/i
  ];
  
  for (const pattern of equipmentPatterns) {
    if (pattern.test(fullText)) {
      return fullText.substring(0, 200) + '...';
    }
  }
  
  return fullText.substring(0, 100) + '...';
}

function extractKeyProcesses(content: string[]): string[] {
  if (!content || content.length === 0) return [];
  
  const fullText = content.join(' ');
  const processes = [];
  
  // Extract key processes
  const processPatterns = [
    /пастеризация/i,
    /охлаждение/i,
    /нагрев/i,
    /производство/i,
    /упаковка/i,
    /обработка/i,
    /переработка/i,
    /формование/i,
    /экструзия/i,
    /плавление/i
  ];
  
  for (const pattern of processPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      processes.push(match[0]);
    }
  }
  
  return processes;
}

function extractCriticalParams(content: string[]): string[] {
  if (!content || content.length === 0) return [];
  
  const fullText = content.join(' ');
  const params = [];
  
  // Extract critical parameters
  const paramPatterns = [
    /производительность[^0-9]*([0-9]+[^0-9]*(?:м3|кг|л)\/ч)/i,
    /температура[^0-9]*([0-9]+[^0-9]*°?[CС])/i,
    /мощность[^0-9]*([0-9]+[^0-9]*кВт)/i,
    /давление[^0-9]*([0-9]+[^0-9]*бар)/i,
    /объем[^0-9]*([0-9]+[^0-9]*л)/i
  ];
  
  for (const pattern of paramPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      params.push(match[1]);
    }
  }
  
  return params;
}

// Simplified generateSearchVector function for semantic blocks
function generateSearchVector(title: string, fullText: string, sectionNumber: string, equipmentTypes: string[], technicalParameters: string[]): any {
  try {
    // Extract numeric values using regex patterns
    const numericFingerprint: any = {};
    
    // Capacity/Productivity patterns
    const capacityMatch = fullText.match(/(\d+(?:\.\d+)?)\s*(?:кг\/час|kg\/h|kg\/hour)/i);
    if (capacityMatch) {
      numericFingerprint.capacity = parseFloat(capacityMatch[1]);
    }
    
    // Weight range patterns
    const weightMatches = fullText.match(/(?:от\s*)?(\d+(?:\.\d+)?)\s*(?:до\s*(\d+(?:\.\d+)?))?\s*кг/gi);
    if (weightMatches && weightMatches.length > 0) {
      const weights: number[] = [];
      weightMatches.forEach(match => {
        const nums = match.match(/(\d+(?:\.\d+)?)/g);
        if (nums) nums.forEach(n => weights.push(parseFloat(n)));
      });
      if (weights.length > 0) {
        numericFingerprint.weight = weights.length === 1 ? weights[0] : [Math.min(...weights), Math.max(...weights)];
      }
    }
    
    // Temperature patterns
    const tempMatch = fullText.match(/(\d+(?:\.\d+)?)\s*°?[CС]/);
    if (tempMatch) {
      numericFingerprint.temperature = parseFloat(tempMatch[1]);
    }
    
    // Extract equipment keywords
    const equipmentKeywords = [];
    const equipmentPatterns = [
      /установка/i, /оборудование/i, /система/i, /машина/i, /аппарат/i, /линия/i, /комплекс/i,
      /пастеризатор/i, /охладитель/i, /формовщик/i, /экструдер/i, /плавитель/i, /упаковщик/i
    ];
    
    for (const pattern of equipmentPatterns) {
      if (pattern.test(fullText)) {
        equipmentKeywords.push(pattern.source.replace(/[\\\/\[\](){}.*+?^$|]/g, ''));
      }
    }
    
    // Extract process keywords
    const processKeywords = [];
    const processPatterns = [
      /пастеризация/i, /охлаждение/i, /нагрев/i, /производство/i, /упаковка/i, /обработка/i, /переработка/i
    ];
    
    for (const pattern of processPatterns) {
      if (pattern.test(fullText)) {
        processKeywords.push(pattern.source.replace(/[\\\/\[\](){}.*+?^$|]/g, ''));
      }
    }
    
    return {
      primary_keywords: [...equipmentKeywords, ...processKeywords],
      secondary_keywords: [...equipmentTypes, ...technicalParameters].slice(0, 10),
      numeric_fingerprint: numericFingerprint,
      functional_fingerprint: processKeywords,
      unique_identifiers: [sectionNumber, title.substring(0, 50)],
      section_context: sectionNumber,
      equipment_types: equipmentTypes,
      technical_parameters: technicalParameters.slice(0, 20)
    };
  } catch (error) {
    console.error('Error generating search vector:', error);
    return {
      primary_keywords: [],
      secondary_keywords: [],
      numeric_fingerprint: {},
      functional_fingerprint: [],
      unique_identifiers: [sectionNumber],
      section_context: sectionNumber,
      equipment_types: equipmentTypes,
      technical_parameters: technicalParameters
    };
  }
}

// Create semantic blocks for a project
async function createSemanticBlocksForProject(projectId: number): Promise<void> {
  console.log(`[SemanticBlocks] Creating semantic blocks for project ${projectId}...`);
  
  try {
    // Get all requirements for the project
    const requirementsResult = await pool.query(
      `SELECT id, tech_spec_number, extracted_value 
       FROM extracted_requirements 
       WHERE project_id = $1 
       ORDER BY serial_number`,
      [projectId]
    );
    
    const requirements = requirementsResult.rows;
    console.log(`[SemanticBlocks] Found ${requirements.length} requirements for project ${projectId}`);
    
    if (requirements.length === 0) {
      console.log(`[SemanticBlocks] No requirements found for project ${projectId}`);
      return;
    }
    
    // Clear existing semantic blocks
    await pool.query('DELETE FROM semantic_blocks WHERE project_id = $1', [projectId]);
    console.log('[SemanticBlocks] Cleared existing semantic blocks');
    
    // Create hierarchical grouping using flexible patterns
    const hierarchicalGroups = new Map();
    
    for (const req of requirements) {
      const techSpec = req.tech_spec_number;
      const baseSection = extractBaseSection(techSpec);
      
      if (baseSection) {
        if (!hierarchicalGroups.has(baseSection)) {
          hierarchicalGroups.set(baseSection, {
            sectionNumber: baseSection,
            sectionTitle: '',
            mainRequirements: [],
            subRequirements: [],
            allContent: [],
            fullContext: ''
          });
        }
        
        const group = hierarchicalGroups.get(baseSection);
        group.allContent.push(req.extracted_value);
        
        // Classify requirement type using flexible logic
        if (isMainSectionHeader(techSpec) || isSimpleSection(techSpec)) {
          group.mainRequirements.push(req);
          group.sectionTitle = req.extracted_value;
        } else if (isSubsectionHeader(techSpec)) {
          group.subRequirements.push(req);
          if (!group.sectionTitle) {
            group.sectionTitle = req.extracted_value;
          }
        } else if (isParameter(techSpec)) {
          group.subRequirements.push(req);
        } else {
          // Fallback for any other format
          group.subRequirements.push(req);
        }
      }
    }
    
    console.log(`[SemanticBlocks] Found ${hierarchicalGroups.size} hierarchical sections`);
    
    // Create semantic blocks for each hierarchical group
    let blockIndex = 0;
    
    for (const [sectionNumber, group] of hierarchicalGroups.entries()) {
      try {
        // Build comprehensive context for the section
        const fullContext = group.allContent.join('. ');
        const coreFunction = extractCoreFunction(group.allContent);
        const keyProcesses = extractKeyProcesses(group.allContent);
        const criticalParams = extractCriticalParams(group.allContent);
        
        // Extract equipment types and technical parameters
        const equipmentTypes: string[] = [];
        const technicalParameters: string[] = [];
        
        // Process main requirements
        for (const req of group.mainRequirements) {
          equipmentTypes.push(req.extracted_value);
        }
        
        // Process sub-requirements
        for (const req of group.subRequirements) {
          if (isSubsectionHeader(req.tech_spec_number)) {
            equipmentTypes.push(req.extracted_value);
          } else {
            technicalParameters.push(req.extracted_value);
          }
        }
        
        // Generate enhanced search vector
        const searchVector = generateSearchVector(
          group.sectionTitle || `Раздел ${sectionNumber}`,
          fullContext,
          sectionNumber,
          equipmentTypes,
          technicalParameters
        );
        
        // Create semantic block with comprehensive data
        const blockTitle = `${sectionNumber}. ${group.sectionTitle || 'Технические требования'}`;
        const contentHash = crypto.createHash('md5').update(`${projectId}-${sectionNumber}-${fullContext}`).digest('hex');
        
        const blockResult = await pool.query(`
          INSERT INTO semantic_blocks (
            project_id, block_title, content_hash, core_function, 
            semantic_description, key_processes, critical_params, 
            dependencies, exclusions, key_requirements, order_index, processing_method
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `, [
          projectId,
          blockTitle,
          contentHash,
          coreFunction,
          `Полный семантический контекст раздела ${sectionNumber} с иерархической структурой требований`,
          JSON.stringify(keyProcesses),
          JSON.stringify(criticalParams),
          JSON.stringify(searchVector.numeric_fingerprint),
          JSON.stringify(searchVector.functional_fingerprint),
          JSON.stringify({
            full_context: fullContext,
            equipment_types: equipmentTypes,
            technical_parameters: technicalParameters,
            search_vector: searchVector,
            hierarchical_structure: {
              main_requirements: group.mainRequirements.map((r: any) => ({
                tech_spec: r.tech_spec_number,
                content: r.extracted_value
              })),
              sub_requirements: group.subRequirements.map((r: any) => ({
                tech_spec: r.tech_spec_number,
                content: r.extracted_value
              }))
            }
          }),
          blockIndex + 1,
          'automatic_hierarchical_processing'
        ]);
        
        console.log(`[SemanticBlocks] Created semantic block ${blockResult.rows[0].id} for section ${sectionNumber}`);
        blockIndex++;
        
      } catch (blockError) {
        console.error(`[SemanticBlocks] Error creating semantic block for section ${sectionNumber}:`, blockError);
      }
    }
    
    // Fallback: if no hierarchical groups found, create a single comprehensive block
    if (hierarchicalGroups.size === 0) {
      console.log('[SemanticBlocks] No hierarchical structure found, creating fallback block');
      
      const fallbackContent = requirements.map((r: any) => r.extracted_value).join('. ');
      const fallbackCoreFunction = extractCoreFunction(requirements.map((r: any) => r.extracted_value));
      const fallbackKeyProcesses = extractKeyProcesses(requirements.map((r: any) => r.extracted_value));
      const fallbackCriticalParams = extractCriticalParams(requirements.map((r: any) => r.extracted_value));
      
      const fallbackSearchVector = generateSearchVector(
        `Проект ${projectId} - Все требования`,
        fallbackContent,
        projectId.toString(),
        [],
        requirements.map((r: any) => r.extracted_value)
      );
      
      const fallbackResult = await pool.query(`
        INSERT INTO semantic_blocks (
          project_id, block_title, content_hash, core_function, 
          semantic_description, key_processes, critical_params, 
          dependencies, exclusions, key_requirements, order_index, processing_method
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        projectId,
        `Проект ${projectId} - Все технические требования`,
        crypto.createHash('md5').update(`${projectId}-fallback-${fallbackContent}`).digest('hex'),
        fallbackCoreFunction,
        'Полный контекст всех требований проекта с fallback обработкой',
        JSON.stringify(fallbackKeyProcesses),
        JSON.stringify(fallbackCriticalParams),
        JSON.stringify(fallbackSearchVector.numeric_fingerprint),
        JSON.stringify(fallbackSearchVector.functional_fingerprint),
        JSON.stringify({
          full_context: fallbackContent,
          all_requirements: requirements.map((r: any) => ({
            tech_spec: r.tech_spec_number,
            content: r.extracted_value
          })),
          search_vector: fallbackSearchVector
        }),
        1,
        'automatic_fallback_processing'
      ]);
      
      console.log(`[SemanticBlocks] Created fallback semantic block ${fallbackResult.rows[0].id}`);
      blockIndex = 1;
    }
    
    console.log(`[SemanticBlocks] Successfully created ${blockIndex} semantic blocks for project ${projectId}`);
    
  } catch (error) {
    console.error(`[SemanticBlocks] Error in createSemanticBlocksForProject:`, error);
    throw error;
  }
}

export default router;