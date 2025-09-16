import { storage } from './storage';
import { testDOCProcessing } from './test-doc-processing';

/**
 * Тестирует обработку конкретного DOC файла из базы данных
 */
async function testSpecificDOCFromDB(responseId: number, filename: string): Promise<void> {
  console.log(`🧪 Testing DOC file from database: ${filename} (response ${responseId})`);
  
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
    
    // Тестируем обработку
    await testDOCProcessing(attachmentData.content, filename);
    
  } catch (error) {
    console.error('❌ Error testing DOC file from database:', error);
  }
}

// Экспорт для использования
export { testSpecificDOCFromDB };

// Запуск теста
const args = process.argv.slice(2);

if (args.length === 2) {
  const responseId = parseInt(args[0]);
  const filename = args[1];
  
  if (isNaN(responseId)) {
    console.error('❌ Invalid response ID');
    process.exit(1);
  }
  
  testSpecificDOCFromDB(responseId, filename).then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
} else {
  console.log('🧪 Specific DOC Processing Test');
  console.log('Usage: node test-specific-doc.ts <responseId> <filename>');
  console.log('Example: node test-specific-doc.ts 123 "Микробиом круг 40 пленка.doc"');
}
