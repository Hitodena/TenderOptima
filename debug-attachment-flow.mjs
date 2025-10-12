/**
 * Отладка потока обработки вложений
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function debugAttachmentFlow() {
  console.log('🔍 Отладка потока обработки вложений...\n');
  
  try {
    // Создаем тестовый ответ с вложением
    const testResponse = {
      id: 999,
      supplierName: 'Test Supplier',
      supplierEmail: 'test@example.com',
      subject: 'Тестовое письмо с вложением',
      content: 'Тестовое письмо с коммерческим предложением в приложении',
      attachments: [
        {
          filename: 'test-proposal.txt',
          contentType: 'text/plain',
          content: Buffer.from(`КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ

Товар: Картонные коробки
Количество: 1000 штук
Размер: 25x25x10 см

ЦЕНЫ:
- Цена за единицу без НДС: 150 рублей
- Общая стоимость без НДС: 150000 рублей
- Общая стоимость с НДС: 180000 рублей

УСЛОВИЯ:
- Сроки поставки: 14 дней
- Условия оплаты: 30% предоплата, 70% по факту поставки
- Гарантия: 12 месяцев

Поставщик: ООО "Тестовый поставщик"
Контактное лицо: Иванов Иван Иванович
Телефон: +7 (999) 123-45-67
Email: test@supplier.com`).toString('base64'),
          size: 500
        }
      ]
    };
    
    // Сохраняем тестовый ответ в файл
    const testFilePath = path.join(process.cwd(), 'test-response-debug.json');
    fs.writeFileSync(testFilePath, JSON.stringify(testResponse, null, 2));
    
    console.log('✅ Создан тестовый файл:', testFilePath);
    
    // Запускаем Python обработчик
    console.log('🔄 Запуск Python обработчика...');
    
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'server', 'file-processing', 'attachment_analyzer.py'),
      '--input', testFilePath,
      '--output-dir', path.join(process.cwd(), 'server', 'file-processing', 'processed_attachments')
    ], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log('📤 Python stdout:', chunk.trim());
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      console.log('⚠️ Python stderr:', chunk.trim());
    });
    
    pythonProcess.on('close', (code) => {
      console.log(`\n📊 Python процесс завершен с кодом: ${code}`);
      
      if (code === 0) {
        console.log('✅ Python обработчик работает');
        
        try {
          // Парсим JSON результат
          const result = JSON.parse(output);
          console.log('\n📋 Результат обработки:');
          console.log(JSON.stringify(result, null, 2));
          
          // Проверяем, есть ли извлеченный текст
          if (result.processed_attachments && result.processed_attachments.length > 0) {
            result.processed_attachments.forEach((attachment, index) => {
              console.log(`\n📎 Вложение ${index + 1}:`);
              console.log(`  - Файл: ${attachment.filename}`);
              console.log(`  - Извлеченный текст: ${attachment.extracted_text ? 'Да' : 'Нет'}`);
              if (attachment.extracted_text) {
                console.log(`  - Длина: ${attachment.extracted_text.length} символов`);
                console.log(`  - Превью: ${attachment.extracted_text.substring(0, 200)}...`);
                
                // Проверяем, есть ли параметры в тексте
                const text = attachment.extracted_text;
                const hasPrice = text.includes('150 рублей') || text.includes('150000 рублей');
                const hasDelivery = text.includes('14 дней');
                const hasPayment = text.includes('30% предоплата');
                
                console.log(`  - Содержит цену: ${hasPrice ? 'Да' : 'Нет'}`);
                console.log(`  - Содержит сроки: ${hasDelivery ? 'Да' : 'Нет'}`);
                console.log(`  - Содержит условия оплаты: ${hasPayment ? 'Да' : 'Нет'}`);
              }
            });
          }
          
        } catch (parseError) {
          console.log('❌ Ошибка парсинга JSON:', parseError.message);
          console.log('Сырой вывод:', output);
        }
        
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
    
  } catch (error) {
    console.error('❌ Ошибка при отладке:', error);
  }
}

// Запускаем отладку
debugAttachmentFlow().then(() => {
  console.log('\n🏁 Отладка завершена');
  process.exit(0);
}).catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
