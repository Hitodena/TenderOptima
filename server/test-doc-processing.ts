import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Тестирует обработку DOC файла
 */
async function testDOCProcessing(base64Content: string, filename: string): Promise<void> {
  console.log(`🧪 Testing DOC file processing: ${filename}`);
  
  try {
    // Создаем временный файл с base64 контентом
    const tempDir = join(tmpdir(), 'supplier-finder-test');
    mkdirSync(tempDir, { recursive: true });
    const inputFile = join(tempDir, `test_${Date.now()}.json`);
    
    const inputData = {
      attachments: [{
        filename: filename,
        contentType: 'application/msword',
        content: base64Content,
        size: Buffer.from(base64Content, 'base64').length
      }]
    };
    
    writeFileSync(inputFile, JSON.stringify(inputData, null, 2), 'utf8');
    
    console.log(`   Created test input file: ${inputFile}`);
    
    // Запускаем Python процессор
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
        console.log('   Output:', output);
      } else {
        console.log('❌ DOC processing failed!');
        console.log(' Error:', errorOutput);
      }
      
      // Очищаем временный файл
      try {
        unlinkSync(inputFile);
        console.log('   Cleaned up temporary file');
      } catch (cleanupError) {
        console.log('⚠️ Could not clean up temporary file:', cleanupError);
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing DOC processing:', error);
  }
}

// Экспорт для использования
export { testDOCProcessing };

// Если файл запускается напрямую
const args = process.argv.slice(2);

if (args.length === 2) {
  const base64Content = args[0];
  const filename = args[1];
  
  testDOCProcessing(base64Content, filename).then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
} else {
  console.log('🧪 DOC Processing Test');
  console.log('Usage: node test-doc-processing.js <base64_content> <filename>');
  console.log('Example: node test-doc-processing.js "UEsDBBQAAAAIAA..." "test.doc"');
}