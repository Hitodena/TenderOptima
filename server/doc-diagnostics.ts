import { storage } from './storage';
import { db } from './db';
import { supplierResponses } from '@shared/schema';
import { isNotNull } from 'drizzle-orm';

/**
 * Диагностика DOC файлов
 */
class DOCDiagnostics {
  /**
   * Проверяет все DOC файлы в базе данных
   */
  static async checkAllDOCFiles(): Promise<void> {
    console.log('🔍 [DOC DIAGNOSTICS] Starting DOC files check...');
    
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
      
      console.log(`📊 [DOC DIAGNOSTICS] Found ${responses.length} responses with attachments`);
      
      let totalDOCFiles = 0;
      let corruptedDOCFiles = 0;
      let validDOCFiles = 0;
      const docFiles: Array<{
        responseId: number;
        supplierName: string;
        filename: string;
        size: number;
        signature: string;
        isValid: boolean;
        error?: string;
      }> = [];
      
      for (const response of responses) {
        const attachments = response.attachments as any[];
        if (!Array.isArray(attachments)) continue;
        
        for (const attachment of attachments) {
          const filename = attachment.filename || '';
          const extension = filename.split('.').pop()?.toLowerCase();
          
          // Проверяем только DOC файлы
          if (extension === 'doc') {
            totalDOCFiles++;
            
            const result = await this.checkDOCFileIntegrity(
              response.id, 
              attachment.filename, 
              attachment.content,
              attachment.contentType
            );
            
            docFiles.push({
              responseId: response.id,
              supplierName: response.supplierName,
              filename: attachment.filename,
              size: attachment.content ? attachment.content.length : 0,
              signature: result.signature || 'unknown',
              isValid: result.isValid,
              error: result.error
            });
            
            if (result.isValid) {
              validDOCFiles++;
              console.log(`   ✅ ${attachment.filename}: ${result.details}`);
            } else {
              corruptedDOCFiles++;
              console.log(`   ❌ ${attachment.filename}: ${result.error}`);
            }
          }
        }
      }
      
      console.log(`\n📈 [DOC DIAGNOSTICS] DOC Files Summary:`);
      console.log(`   Total DOC files: ${totalDOCFiles}`);
      console.log(`   Valid DOC files: ${validDOCFiles}`);
      console.log(`   Corrupted DOC files: ${corruptedDOCFiles}`);
      console.log(`   Success rate: ${totalDOCFiles > 0 ? ((validDOCFiles / totalDOCFiles) * 100).toFixed(1) : 0}%`);
      
      // Детальный анализ проблемных файлов
      const corruptedFiles = docFiles.filter(f => !f.isValid);
      if (corruptedFiles.length > 0) {
        console.log(`\n❌ [DOC DIAGNOSTICS] Corrupted DOC files details:`);
        corruptedFiles.forEach(file => {
          console.log(`   Response ${file.responseId} (${file.supplierName}): ${file.filename}`);
          console.log(`     Size: ${file.size} chars, Signature: ${file.signature}, Error: ${file.error}`);
        });
      }
      
      // Анализ сигнатур
      const signatures = docFiles.reduce((acc, file) => {
        acc[file.signature] = (acc[file.signature] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
      
      console.log(`\n🔍 [DOC DIAGNOSTICS] DOC file signatures:`);
      Object.entries(signatures).forEach(([sig, count]) => {
        const type = this.getDOCSignatureType(sig);
        console.log(`   ${sig}: ${count} files (${type})`);
      });
      
    } catch (error) {
      console.error('❌ [DOC DIAGNOSTICS] Error during DOC files check:', error);
    }
  }
  
  /**
   * Проверяет целостность одного DOC файла
   */
  static async checkDOCFileIntegrity(
    responseId: number, 
    filename: string, 
    base64Content: string,
    contentType: string
  ): Promise<{ 
    isValid: boolean; 
    error?: string; 
    details?: string;
    signature?: string;
    decodedSize?: number;
  }> {
    
    try {
      // 1. Проверяем наличие контента
      if (!base64Content || typeof base64Content !== 'string') {
        return { isValid: false, error: 'No content or invalid content type', signature: 'none' };
      }
      
      // 2. Проверяем длину base64
      if (base64Content.length === 0) {
        return { isValid: false, error: 'Empty content', signature: 'none' };
      }
      
      // 3. Проверяем валидность base64
      const isValidBase64 = (str: string): boolean => {
        if (str.length % 4 !== 0) return false;
        return /^[A-Za-z0-9+/=]+$/.test(str);
      };
      
      if (!isValidBase64(base64Content)) {
        return { isValid: false, error: 'Invalid base64 format', signature: 'invalid' };
      }
      
      // 4. Пытаемся декодировать
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Content, 'base64');
      } catch (error) {
        return { isValid: false, error: `Base64 decode failed: ${error}`, signature: 'decode_error' };
      }
      
      // 5. Проверяем размер декодированного файла
      if (buffer.length === 0) {
        return { isValid: false, error: 'Decoded file is empty', signature: 'empty' };
      }
      
      // 6. Проверяем сигнатуру DOC файла
      const signature = buffer.slice(0, 8).toString('hex');
      const docSignature = this.getDOCSignatureType(signature);
      
      // 7. Специальные проверки для DOC файлов
      const isDOCSignature = signature.startsWith('d0cf11e0') || signature.startsWith('504b0304');
      
      if (!isDOCSignature) {
        return { 
          isValid: false, 
          error: `Not a valid DOC signature: ${signature}`, 
          signature,
          decodedSize: buffer.length
        };
      }
      
      // 8. Проверяем минимальный размер DOC файла (должен быть больше 1KB)
      if (buffer.length < 1024) {
        return { 
          isValid: false, 
          error: `DOC file too small: ${buffer.length} bytes`, 
          signature,
          decodedSize: buffer.length
        };
      }
      
      // 9. Проверяем соответствие Content-Type
      const expectedTypes = ['application/msword', 'application/vnd.ms-word', 'application/octet-stream'];
      const typeMatch = expectedTypes.some(type => contentType.includes(type));
      
      const details = `${buffer.length} bytes, signature: ${signature}, type: ${docSignature}, content-type match: ${typeMatch}`;
      
      return { 
        isValid: true, 
        details, 
        signature,
        decodedSize: buffer.length
      };
      
    } catch (error) {
      return { isValid: false, error: `Unexpected error: ${error}`, signature: 'error' };
    }
  }
  
  /**
   * Определяет тип DOC файла по сигнатуре
   */
  private static getDOCSignatureType(signature: string): string {
    if (signature.startsWith('d0cf11e0')) {
      return 'Microsoft Office (old format)';
    } else if (signature.startsWith('504b0304')) {
      return 'Microsoft Office (new format)';
    } else if (signature.startsWith('ffd8ffe0')) {
      return 'JPEG (wrong type)';
    } else if (signature.startsWith('25504446')) {
      return 'PDF (wrong type)';
    } else if (signature.startsWith('89504e47')) {
      return 'PNG (wrong type)';
    } else if (signature === 'none' || signature === 'invalid' || signature === 'decode_error' || signature === 'empty' || signature === 'error') {
      return signature;
    } else {
      return `Unknown (${signature})`;
    }
  }
  
  /**
   * Проверяет конкретный DOC файл
   */
  static async checkSpecificDOCFile(responseId: number, filename: string): Promise<void> {
    console.log(` [DOC DIAGNOSTICS] Checking specific DOC file: ${filename} in response ${responseId}`);
    
    try {
      const attachmentData = await storage.getSupplierResponseAttachmentContent(responseId, filename);
      
      if (!attachmentData) {
        console.log('❌ DOC file not found in database');
        return;
      }
      
      const result = await this.checkDOCFileIntegrity(
        responseId,
        filename,
        attachmentData.content,
        attachmentData.contentType
      );
      
      if (result.isValid) {
        console.log(`✅ DOC file is valid: ${result.details}`);
      } else {
        console.log(`❌ DOC file is corrupted: ${result.error}`);
        console.log(`   Signature: ${result.signature}`);
        console.log(`   Decoded size: ${result.decodedSize} bytes`);
      }
      
    } catch (error) {
      console.error('❌ Error checking specific DOC file:', error);
    }
  }
  
  /**
   * Анализирует статистику DOC файлов
   */
  static async analyzeDOCFileStatistics(): Promise<void> {
    console.log('📊 [DOC DIAGNOSTICS] Analyzing DOC file statistics...');
    
    try {
      const responses = await db
        .select({ 
          id: supplierResponses.id,
          supplierName: supplierResponses.supplierName,
          attachments: supplierResponses.attachments
        })
        .from(supplierResponses)
        .where(isNotNull(supplierResponses.attachments));
      
      const stats = {
        totalResponses: responses.length,
        totalDOCFiles: 0,
        docSignatures: {} as { [key: string]: number },
        contentTypes: {} as { [key: string]: number },
        sizeRanges: {
          '0-1KB': 0,
          '1-10KB': 0,
          '10-100KB': 0,
          '100KB-1MB': 0,
          '1MB+': 0
        },
        suppliers: {} as { [key: string]: number }
      };
      
      for (const response of responses) {
        const attachments = response.attachments as any[];
        if (!Array.isArray(attachments)) continue;
        
        for (const attachment of attachments) {
          const filename = attachment.filename || '';
          const extension = filename.split('.').pop()?.toLowerCase();
          
          if (extension === 'doc') {
            stats.totalDOCFiles++;
            
            // Подсчет поставщиков
            stats.suppliers[response.supplierName] = (stats.suppliers[response.supplierName] || 0) + 1;
            
            // Подсчет MIME-типов
            const contentType = attachment.contentType || 'unknown';
            stats.contentTypes[contentType] = (stats.contentTypes[contentType] || 0) + 1;
            
            // Подсчет размеров
            if (attachment.content) {
              const sizeKB = attachment.content.length / 1024;
              if (sizeKB < 1) stats.sizeRanges['0-1KB']++;
              else if (sizeKB < 10) stats.sizeRanges['1-10KB']++;
              else if (sizeKB < 100) stats.sizeRanges['10-100KB']++;
              else if (sizeKB < 1024) stats.sizeRanges['100KB-1MB']++;
              else stats.sizeRanges['1MB+']++;
            }
          }
        }
      }
      
      console.log('\n📈 [DOC DIAGNOSTICS] DOC File Statistics:');
      console.log(`   Total responses with attachments: ${stats.totalResponses}`);
      console.log(`   Total DOC files: ${stats.totalDOCFiles}`);
      
      console.log('\n Suppliers with DOC files:');
      Object.entries(stats.suppliers)
        .sort(([,a], [,b]) => b - a)
        .forEach(([supplier, count]) => {
          console.log(`   ${supplier}: ${count} DOC files`);
        });
      
      console.log('\n🎯 DOC Content types:');
      Object.entries(stats.contentTypes)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`   ${type}: ${count} files`);
        });
      
      console.log('\n📏 DOC Size distribution:');
      Object.entries(stats.sizeRanges).forEach(([range, count]) => {
        console.log(`   ${range}: ${count} files`);
      });
      
    } catch (error) {
      console.error('❌ [DOC DIAGNOSTICS] Error analyzing DOC statistics:', error);
    }
  }
}

/**
 * Запуск диагностики DOC файлов
 */
async function runDOCDiagnostics() {
  console.log('🚀 Starting DOC files diagnostics...\n');
  
  try {
    // 1. Анализ статистики DOC файлов
    await DOCDiagnostics.analyzeDOCFileStatistics();
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // 2. Проверка целостности всех DOC файлов
    await DOCDiagnostics.checkAllDOCFiles();
    
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('✅ DOC diagnostics completed successfully!');
    
  } catch (error) {
    console.error('❌ DOC diagnostics failed:', error);
  }
}

/**
 * Проверка конкретного DOC файла
 */
async function checkSpecificDOCFile(responseId: number, filename: string) {
  console.log(`🔍 Checking specific DOC file: ${filename} in response ${responseId}\n`);
  await DOCDiagnostics.checkSpecificDOCFile(responseId, filename);
}

// Экспорт функций для использования
export { runDOCDiagnostics, checkSpecificDOCFile };

// Запуск диагностики
const args = process.argv.slice(2);

if (args.length === 2) {
  // Проверка конкретного DOC файла: node doc-diagnostics.js <responseId> <filename>
  const responseId = parseInt(args[0]);
  const filename = args[1];
  
  if (isNaN(responseId)) {
    console.error('❌ Invalid response ID');
    process.exit(1);
  }
  
  checkSpecificDOCFile(responseId, filename).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
} else {
  // Полная диагностика DOC файлов
  runDOCDiagnostics().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}