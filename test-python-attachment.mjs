/**
 * Тест Python обработчика вложений
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function testPythonAttachmentProcessor() {
  console.log('🐍 Тестирование Python обработчика вложений...\n');
  
  try {
    // Создаем тестовый PDF файл
    const testPdfPath = path.join(process.cwd(), 'test-attachment.pdf');
    
    // Проверяем, есть ли тестовый PDF
    if (!fs.existsSync(testPdfPath)) {
      console.log('❌ Тестовый PDF файл не найден. Создаем простой тест...');
      
      // Создаем простой тестовый файл
      const testData = {
        id: 999,
        supplierName: 'Test Supplier',
        supplierEmail: 'test@example.com',
        attachments: [
          {
            filename: 'test.txt',
            contentType: 'text/plain',
            content: Buffer.from('Тестовый текст с параметрами:\nЦена за единицу: 1000 рублей\nСроки поставки: 30 дней\nУсловия оплаты: 50% предоплата').toString('base64'),
            size: 100
          }
        ]
      };
      
      const testFilePath = path.join(process.cwd(), 'test-response.json');
      fs.writeFileSync(testFilePath, JSON.stringify(testData, null, 2));
      
      console.log('✅ Создан тестовый файл:', testFilePath);
      
      // Запускаем Python обработчик
      console.log('🔄 Запуск Python обработчика...');
      
      const pythonProcess = spawn('python', [
        path.join(process.cwd(), 'server', 'file-processing', 'attachment_analyzer.py'),
        testFilePath
      ], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        console.log(`\n📊 Python процесс завершен с кодом: ${code}`);
        
        if (code === 0) {
          console.log('✅ Python обработчик работает');
          console.log('Вывод:', output);
        } else {
          console.log('❌ Python обработчик завершился с ошибкой');
          console.log('Ошибка:', errorOutput);
        }
        
        // Очищаем тестовый файл
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.log('❌ Ошибка запуска Python процесса:', error.message);
        
        // Очищаем тестовый файл
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      });
      
    } else {
      console.log('✅ Тестовый PDF найден, используем его');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании Python обработчика:', error);
  }
}

// Запускаем тест
testPythonAttachmentProcessor().then(() => {
  console.log('\n🏁 Тестирование завершено');
  process.exit(0);
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
