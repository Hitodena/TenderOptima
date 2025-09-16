import { storage } from './storage';

/**
 * Показывает полный извлеченный текст из attachment
 */
async function viewFullText(responseId: number): Promise<void> {
  console.log(`🔍 Viewing full extracted text for response ID: ${responseId}`);
  
  try {
    // Получаем attachments
    const attachments = await storage.getSupplierResponseAttachments(responseId);
    
    for (const attachment of attachments) {
      if (attachment.extractedText) {
        console.log(`\n📄 Full extracted text from: ${attachment.filename}`);
        console.log(`Length: ${attachment.extractedText.length} characters`);
        console.log('=' * 80);
        console.log(attachment.extractedText);
        console.log('=' * 80);
      }
    }
    
  } catch (error) {
    console.error('❌ Error viewing full text:', error);
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
  
  viewFullText(responseId).then(() => {
    console.log('✅ View completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ View failed:', error);
    process.exit(1);
  });
} else {
  console.log('🔍 View Full Extracted Text');
  console.log('Usage: node view-full-text.ts <responseId>');
  console.log('Example: node view-full-text.ts 399');
}
