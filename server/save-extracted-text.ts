import { storage } from './storage';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

/**
 * Сохраняет извлеченный текст из DOC файла для тестирования
 */
async function saveExtractedText(responseId: number, filename: string): Promise<void> {
  console.log(`💾 Saving extracted text for testing: ${filename} (response ${responseId})`);
  
  try {
    // Получаем attachments
    const attachments = await storage.getSupplierResponseAttachments(responseId);
    
    for (const attachment of attachments) {
      if (attachment.filename === filename && attachment.extractedText) {
        console.log(`📄 Found extracted text: ${attachment.extractedText.length} chars`);
        
        // Создаем временный файл
        const tempDir = join(tmpdir(), 'extracted-text-testing');
        mkdirSync(tempDir, { recursive: true });
        const outputFile = join(tempDir, `${filename}.txt`);
        
        // Сохраняем извлеченный текст
        writeFileSync(outputFile, attachment.extractedText, 'utf8');
        console.log(`✅ Extracted text saved to: ${outputFile}`);
        
        // Запускаем Python тест
        console.log('\n🧪 Running improved parameter extraction test...');
        
        const pythonProcess = spawn('python', [
          'server/improved-doc-parameter-extraction.py',
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
            console.log('✅ Improved parameter extraction test completed!');
          } else {
            console.log('❌ Improved parameter extraction test failed!');
          }
        });
        
        return;
      }
    }
    
    console.log('❌ No extracted text found for this file');
    
  } catch (error) {
    console.error('❌ Error saving extracted text:', error);
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
  
  saveExtractedText(responseId, filename);
} else {
  console.log('💾 Save Extracted Text for Testing');
  console.log('Usage: node save-extracted-text.ts <responseId> <filename>');
  console.log('Example: node save-extracted-text.ts 405 "1_КП от 05.09.2025 (D 40мм)  плёнка.doc"');
}
