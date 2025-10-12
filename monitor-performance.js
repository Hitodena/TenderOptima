#!/usr/bin/env node

/**
 * Мониторинг производительности SupplierFinder
 */

const os = require('os');
const fs = require('fs');

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: formatBytes(totalMem),
    freeMemory: formatBytes(freeMem),
    usedMemory: formatBytes(usedMem),
    memoryUsage: ((usedMem / totalMem) * 100).toFixed(2) + '%',
    uptime: Math.floor(os.uptime() / 60) + ' minutes',
    loadAverage: os.loadavg().map(load => load.toFixed(2)).join(', ')
  };
}

function getProcessInfo() {
  const memUsage = process.memoryUsage();
  return {
    rss: formatBytes(memUsage.rss),
    heapTotal: formatBytes(memUsage.heapTotal),
    heapUsed: formatBytes(memUsage.heapUsed),
    external: formatBytes(memUsage.external),
    arrayBuffers: formatBytes(memUsage.arrayBuffers)
  };
}

function displayInfo() {
  console.clear();
  console.log('📊 Мониторинг производительности SupplierFinder\n');
  
  const systemInfo = getSystemInfo();
  const processInfo = getProcessInfo();
  
  console.log('🖥️  Системная информация:');
  console.log(`   Платформа: ${systemInfo.platform} (${systemInfo.arch})`);
  console.log(`   CPU: ${systemInfo.cpus} ядер`);
  console.log(`   Память: ${systemInfo.usedMemory} / ${systemInfo.totalMemory} (${systemInfo.memoryUsage})`);
  console.log(`   Время работы: ${systemInfo.uptime}`);
  console.log(`   Нагрузка: ${systemInfo.loadAverage}`);
  
  console.log('\n🔧 Информация о процессе:');
  console.log(`   RSS: ${processInfo.rss}`);
  console.log(`   Heap Total: ${processInfo.heapTotal}`);
  console.log(`   Heap Used: ${processInfo.heapUsed}`);
  console.log(`   External: ${processInfo.external}`);
  console.log(`   Array Buffers: ${processInfo.arrayBuffers}`);
  
  console.log('\n⏰ ' + new Date().toLocaleString());
  console.log('\nНажмите Ctrl+C для выхода');
}

// Запускаем мониторинг
console.log('🚀 Запуск мониторинга производительности...');
console.log('Нажмите Ctrl+C для выхода\n');

displayInfo();
const interval = setInterval(displayInfo, 2000);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n✅ Мониторинг остановлен');
  process.exit(0);
});
