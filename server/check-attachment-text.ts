import { storage } from './storage';

/**
 * Проверяет извлеченный текст в attachments
 */
async function checkAttachmentText(responseId: number): Promise<void> {
  console.log(`🔍 Checking attachment text for response ID: ${responseId}`);
  
  try {
    // Получаем response с attachments
    const response = await storage.getSupplierResponseById(responseId);
    if (!response) {
      console.log('❌ Response not found');
      return;
    }
    
    console.log(`📄 Response found: ${response.supplierEmail}`);
    console.log(`   Message: ${response.message?.substring(0, 200)}...`);
    
    // Получаем attachments с полным содержимым
    const attachments = await storage.getSupplierResponseAttachments(responseId);
    console.log(`📎 Attachments: ${attachments.length}`);
    
    // Проверяем каждый attachment
    for (const attachment of attachments) {
      console.log(`\n📎 Attachment: ${attachment.filename}`);
      console.log(`   Content Type: ${attachment.contentType}`);
      console.log(`   Size: ${attachment.content ? attachment.content.length : 'No content'} chars (base64)`);
      
      // Проверяем, есть ли извлеченный текст
      if (attachment.extractedText) {
        console.log(`   ✅ Extracted text: ${attachment.extractedText.length} chars`);
        console.log(`   Text preview: ${attachment.extractedText.substring(0, 500)}...`);
        
        // Проверяем, содержит ли текст полезную информацию
        const text = attachment.extractedText.toLowerCase();
        const hasPrice = text.includes('цена') || text.includes('стоимость') || text.includes('руб') || text.includes('$');
        const hasDelivery = text.includes('срок') || text.includes('поставк') || text.includes('доставк');
        const hasPayment = text.includes('оплат') || text.includes('платеж') || text.includes('предоплат');
        
        console.log(`   📊 Content analysis:`);
        console.log(`      Has price info: ${hasPrice}`);
        console.log(`      Has delivery info: ${hasDelivery}`);
        console.log(`      Has payment info: ${hasPayment}`);
        
        // Ищем конкретные значения
        const priceMatch = text.match(/(\d+[\s\d]*(?:[.,]\d+)?)[\s]*(руб|р|\$|€|евро|долларов|рублей)/i);
        if (priceMatch) {
          console.log(`      Found price: ${priceMatch[1]} ${priceMatch[2]}`);
        }
        
      } else {
        console.log(`   ❌ No extracted text found`);
        
        // Проверяем, есть ли content для извлечения
        if (attachment.content) {
          console.log(`   🔍 Content available for extraction`);
        } else {
          console.log(`   ❌ No content available`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking attachment text:', error);
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
  
  checkAttachmentText(responseId).then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
} else {
  console.log('🔍 Check Attachment Text');
  console.log('Usage: node check-attachment-text.ts <responseId>');
  console.log('Example: node check-attachment-text.ts 399');
}
