import { storage } from './storage';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Простой тест обработки DOC файла
 */
async function simpleDOCTest(responseId: number, filename: string): Promise<void> {
  console.log(`🧪 Simple DOC test: ${filename} (response ${responseId})`);
  
  try {
    // Получаем данные файла из базы
    const attachmentData = await storage.getSupplierResponseAttachmentContent(responseId, filename);
    
    if (!attachmentData) {
      console.log('❌ DOC file not found in database');
      return;
    }
    
    console.log(`📄 File: ${filename}`);
    console.log(`   Size: ${Buffer.from(attachmentData.content, 'base64').length} bytes`);
    
    // Создаем входной файл
    const tempDir = join(tmpdir(), 'simple-doc-test');
    mkdirSync(tempDir, { recursive: true });
    const inputFile = join(tempDir, `input_${Date.now()}.json`);
    
    const inputData = {
      id: responseId,
      supplierName: "Test Supplier",
      supplierEmail: "test@example.com",
      responseDate: new Date().toISOString(),
      requestId: 1,
      attachments: [{
        filename: filename,
        contentType: attachmentData.contentType,
        content: attachmentData.content
      }]
    };
    
    writeFileSync(inputFile, JSON.stringify(inputData, null, 2), 'utf8');
    console.log(`📝 Input file: ${inputFile}`);
    
    // Запускаем Python процессор
    console.log('🚀 Starting Python processor...');
    const pythonProcess = spawn('python', [
      'server/file-processing/attachment_analyzer.py',
      '--input', inputFile
    ]);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('📤 Python output:', text.trim());
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.log('❌ Python error:', text.trim());
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`\n📊 Process finished with code: ${code}`);
      
      if (code === 0) {
        console.log('✅ DOC processing completed successfully!');
      } else {
        console.log('❌ DOC processing failed!');
      }
      
      // Очищаем временный файл
      try {
        unlinkSync(inputFile);
        console.log('🧹 Cleaned up');
      } catch (cleanupError) {
        console.log('⚠️ Cleanup error:', cleanupError);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Запуск
const args = process.argv.slice(2);

if (args.length === 2) {
  const responseId = parseInt(args[0]);
  const filename = args[1];
  
  if (isNaN(responseId)) {
    console.error('❌ Invalid response ID');
    process.exit(1);
  }
  
  simpleDOCTest(responseId, filename);
} else {
  console.log('🧪 Simple DOC Test');
  console.log('Usage: node simple-doc-test.ts <responseId> <filename>');
  console.log('Example: node simple-doc-test.ts 399 "Микробиом круг 40 пленка.doc"');
}
