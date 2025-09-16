import { DOCFileDiagnostics } from './storage';

/**
 * Запуск диагностики DOC файлов
 */
async function runDOCDiagnostics() {
  console.log('🚀 Starting DOC files diagnostics...\n');
  
  try {
    // 1. Анализ статистики DOC файлов
    await DOCFileDiagnostics.analyzeDOCFileStatistics();
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // 2. Проверка целостности всех DOC файлов
    await DOCFileDiagnostics.checkAllDOCFiles();
    
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
  await DOCFileDiagnostics.checkSpecificDOCFile(responseId, filename);
}

// Экспорт функций для использования
export { runDOCDiagnostics, checkSpecificDOCFile };

// Если файл запускается напрямую
if (require.main === module) {
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
}