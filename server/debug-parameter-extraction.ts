import { storage } from './storage';
import { extractParameterFromContent } from './services/parameter-extraction';

/**
 * Отладка извлечения параметров из конкретного response
 */
async function debugParameterExtraction(responseId: number): Promise<void> {
  console.log(`🔍 Debugging parameter extraction for response ID: ${responseId}`);
  
  try {
    // Получаем response
    const response = await storage.getSupplierResponseById(responseId);
    if (!response) {
      console.log('❌ Response not found');
      return;
    }
    
    console.log(`📄 Response found: ${response.supplierEmail}`);
    console.log(`   Message: ${response.message?.substring(0, 200)}...`);
    
    // Получаем attachments
    const attachments = await storage.getSupplierResponseAttachments(responseId);
    console.log(`📎 Attachments: ${attachments.length}`);
    
    // Проверяем каждый attachment
    for (const attachment of attachments) {
      console.log(`\n📎 Attachment: ${attachment.filename}`);
      console.log(`   Content Type: ${attachment.contentType}`);
      console.log(`   Size: ${attachment.content.length} chars (base64)`);
      
      // Декодируем base64 для проверки
      const buffer = Buffer.from(attachment.content, 'base64');
      console.log(`   Decoded size: ${buffer.length} bytes`);
      
      // Проверяем, есть ли извлеченный текст
      if (attachment.extractedText) {
        console.log(`   ✅ Extracted text: ${attachment.extractedText.length} chars`);
        console.log(`   Text preview: ${attachment.extractedText.substring(0, 300)}...`);
        
        // Тестируем извлечение параметров из этого текста
        const testParams = [
          'Общая стоимость без НДС',
          'Цена за единицу без НДС', 
          'Условия оплаты',
          'Сроки поставки',
          'Описание товара'
        ];
        
        console.log(`\n🧪 Testing parameter extraction from attachment text:`);
        for (const param of testParams) {
          const result = extractParameterFromContent(
            response.message || '', 
            [{ extractedText: attachment.extractedText }], 
            param
          );
          console.log(`   ${param}: "${result.value}" (confidence: ${result.confidence}, source: ${result.source})`);
        }
      } else {
        console.log(`   ❌ No extracted text found`);
      }
    }
    
    // Проверяем извлеченные параметры в базе
    const extractedParams = await storage.getExtractedParametersByResponseId(responseId);
    if (extractedParams) {
      console.log(`\n📊 Stored parameters:`);
      const params = extractedParams.parameters as Record<string, any>;
      Object.entries(params).forEach(([key, value]) => {
        console.log(`   ${key}: "${value}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error debugging parameter extraction:', error);
  }
}

// Запуск
const args = process.argv.slice(2);

if (args.length === 1) {
  const responseId = parseInt(args[0]);
  
  if (isNaN(responseId)) {
    console.error('❌ Invalid response ID');
    process.exit(1);
  }
  
  debugParameterExtraction(responseId).then(() => {
    console.log('✅ Debug completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });
} else {
  console.log('🔍 Debug Parameter Extraction');
  console.log('Usage: node debug-parameter-extraction.ts <responseId>');
  console.log('Example: node debug-parameter-extraction.ts 399');
}
