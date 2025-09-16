import { storage } from './storage';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

/**
 * Сохраняет DOC файл из базы данных для тестирования
 */
async function saveDocForTesting(responseId: number, filename: string): Promise<void> {
  console.log(`💾 Saving DOC file for testing: ${filename} (response ${responseId})`);
  
  try {
    // Получаем данные файла из базы
    const attachmentData = await storage.getSupplierResponseAttachmentContent(responseId, filename);
    
    if (!attachmentData) {
      console.log('❌ DOC file not found in database');
      return;
    }
    
    console.log(`📄 File found: ${filename}`);
    console.log(`   Content-Type: ${attachmentData.contentType}`);
    console.log(`   Base64 size: ${attachmentData.content.length} chars`);
    
    // Декодируем base64
    const buffer = Buffer.from(attachmentData.content, 'base64');
    console.log(`   Decoded size: ${buffer.length} bytes`);
    
    // Создаем временный файл
    const tempDir = join(tmpdir(), 'doc-testing');
    mkdirSync(tempDir, { recursive: true });
    const outputFile = join(tempDir, filename);
    
    // Сохраняем файл
    writeFileSync(outputFile, buffer);
    console.log(`✅ File saved to: ${outputFile}`);
    
    // Запускаем Python тест
    console.log('\n🧪 Running extraction methods test...');
    
    const pythonProcess = spawn('python', [
      'server/test-doc-extraction-methods.py',
      outputFile
    ]);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(text.trim());
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.log('❌ Python error:', text.trim());
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`\n📊 Python test finished with code: ${code}`);
      if (code === 0) {
        console.log('✅ Extraction methods test completed successfully!');
      } else {
        console.log('❌ Extraction methods test failed!');
      }
    });
    
  } catch (error) {
    console.error('❌ Error saving DOC file:', error);
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
  
  saveDocForTesting(responseId, filename);
} else {
  console.log('💾 Save DOC File for Testing');
  console.log('Usage: node save-doc-for-testing.ts <responseId> <filename>');
  console.log('Example: node save-doc-for-testing.ts 405 "1_КП от 05.09.2025 (D 40мм)  плёнка.doc"');
}
