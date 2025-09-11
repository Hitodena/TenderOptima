// Скрипт для тестирования производительности запуска сервера
const { spawn } = require('child_process');
const startTime = Date.now();

console.log('🚀 Тестирование производительности запуска сервера...');

const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true
});

let serverReady = false;
let output = '';

server.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  
  // Проверяем, что сервер готов
  if (text.includes('serving on port') && !serverReady) {
    serverReady = true;
    const endTime = Date.now();
    const startupTime = endTime - startTime;
    
    console.log(`✅ Сервер запущен за ${startupTime}ms`);
    console.log(`📊 Время запуска: ${(startupTime / 1000).toFixed(2)} секунд`);
    
    if (startupTime < 5000) {
      console.log('🎉 Отличная производительность!');
    } else if (startupTime < 10000) {
      console.log('👍 Хорошая производительность');
    } else {
      console.log('⚠️  Медленный запуск, требуется оптимизация');
    }
    
    // Останавливаем сервер
    server.kill();
    process.exit(0);
  }
});

server.stderr.on('data', (data) => {
  console.error('Ошибка:', data.toString());
});

server.on('error', (error) => {
  console.error('Ошибка запуска:', error);
  process.exit(1);
});

// Таймаут на случай, если сервер не запустится
setTimeout(() => {
  if (!serverReady) {
    console.log('⏰ Таймаут: сервер не запустился за 30 секунд');
    server.kill();
    process.exit(1);
  }
}, 30000);
