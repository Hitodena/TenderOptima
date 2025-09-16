import { db } from './db';
import { supplierResponses } from '@shared/schema';
import { isNotNull } from 'drizzle-orm';

/**
 * Находит response ID для DOC файлов
 */
async function findDOCResponses(): Promise<void> {
  console.log('🔍 Finding response IDs for DOC files...\n');
  
  try {
    // Получаем все ответы с вложениями
    const responses = await db
      .select({ 
        id: supplierResponses.id,
        supplierName: supplierResponses.supplierName,
        attachments: supplierResponses.attachments
      })
      .from(supplierResponses)
      .where(isNotNull(supplierResponses.attachments));
    
    console.log(`📊 Found ${responses.length} responses with attachments\n`);
    
    for (const response of responses) {
      const attachments = response.attachments as any[];
      if (!Array.isArray(attachments)) continue;
      
      for (const attachment of attachments) {
        const filename = attachment.filename || '';
        const extension = filename.split('.').pop()?.toLowerCase();
        
        // Проверяем только DOC файлы
        if (extension === 'doc') {
          console.log(`📄 DOC file found:`);
          console.log(`   Response ID: ${response.id}`);
          console.log(`   Supplier: ${response.supplierName}`);
          console.log(`   Filename: ${filename}`);
          console.log(`   Base64 size: ${attachment.content ? attachment.content.length : 0} chars`);
          console.log('');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error finding DOC responses:', error);
  }
}

// Запуск
findDOCResponses().then(() => {
  console.log('✅ Search completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
