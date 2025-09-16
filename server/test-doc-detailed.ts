import { storage } from './storage';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Детальное тестирование обработки DOC файла
 */
async function testDOCDetailed(responseId: number, filename: string): Promise<void> {
  console.log(`🧪 Detailed DOC file processing test: ${filename} (response ${responseId})`);
  
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
    
    // Декодируем base64 для проверки
    const buffer = Buffer.from(attachmentData.content, 'base64');
    console.log(`   Decoded size: ${buffer.length} bytes`);
    console.log(`   Signature: ${buffer.slice(0, 4).toString('hex')}`);
    
    // Создаем временный файл
    const tempDir = join(tmpdir(), 'supplier-finder-detailed-test');
    mkdirSync(tempDir, { recursive: true });
    const inputFile = join(tempDir, `detailed_test_${Date.now()}.json`);
    
    const inputData = {
      attachments: [{
        filename: filename,
        contentType: attachmentData.contentType,
        content: attachmentData.content,
        size: buffer.length
      }]
    };
    
    writeFileSync(inputFile, JSON.stringify(inputData, null, 2), 'utf8');
    console.log(`📝 Created input file: ${inputFile}`);
    
    // Запускаем Python процессор
    console.log('🚀 Starting Python processor...');
    const pythonProcess = spawn('python', [
      'server/file-processing/attachment_analyzer.py',
      inputFile
    ]);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`\n📊 Python process exited with code: ${code}`);
      
      if (code === 0) {
        console.log('✅ DOC processing successful!');
        console.log('📤 Output:');
        console.log(output);
        
        // Пытаемся распарсить JSON результат
        try {
          const lines = output.split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
              const result = JSON.parse(line.trim());
              console.log('\n📋 Processing Results:');
              console.log(`   Response ID: ${result.response_id}`);
              console.log(`   Supplier: ${result.supplier_name}`);
              console.log(`   Attachments processed: ${result.attachments_processed}`);
              console.log(`   Text extracted: ${result.text_extracted}`);
              
              if (result.processed_attachments && result.processed_attachments.length > 0) {
                const attachment = result.processed_attachments[0];
                console.log(`   Filename: ${attachment.filename}`);
                console.log(`   Processing status: ${attachment.processing_status?.status || 'unknown'}`);
                console.log(`   Text length: ${attachment.text_content?.length || 0} characters`);
                
                if (attachment.text_content && attachment.text_content.length > 0) {
                  console.log(`   Text preview: ${attachment.text_content.substring(0, 200)}...`);
                }
              }
              break;
            }
          }
        } catch (parseError) {
          console.log('⚠️ Could not parse JSON result, showing raw output');
        }
      } else {
        console.log('❌ DOC processing failed!');
        console.log('📤 Error:');
        console.log(errorOutput);
      }
      
      // Очищаем временный файл
      try {
        unlinkSync(inputFile);
        console.log('🧹 Cleaned up temporary file');
      } catch (cleanupError) {
        console.log('⚠️ Could not clean up temporary file:', cleanupError);
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing DOC processing:', error);
  }
}

// Экспорт для использования
export { testDOCDetailed };

// Запуск теста
const args = process.argv.slice(2);

if (args.length === 2) {
  const responseId = parseInt(args[0]);
  const filename = args[1];
  
  if (isNaN(responseId)) {
    console.error('❌ Invalid response ID');
    process.exit(1);
  }
  
  testDOCDetailed(responseId, filename).then(() => {
    console.log('✅ Detailed test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
} else {
  console.log('🧪 Detailed DOC Processing Test');
  console.log('Usage: node test-doc-detailed.ts <responseId> <filename>');
  console.log('Example: node test-doc-detailed.ts 399 "Микробиом круг 40 пленка.doc"');
}
