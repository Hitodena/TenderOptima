
/**
 * Тест векторизации семантических блоков
 */

const { Pool } = require('pg');
require('dotenv').config();

async function testVectorization() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔍 Проверяем существующие семантические блоки...');
    
    // Проверяем наличие семантических блоков
    const blocksResult = await pool.query(`
      SELECT 
        project_id,
        COUNT(*) as blocks_count,
        SUM(CASE WHEN search_vector IS NOT NULL THEN 1 ELSE 0 END) as vectorized_count
      FROM semantic_blocks 
      GROUP BY project_id 
      ORDER BY project_id
    `);
    
    if (blocksResult.rows.length === 0) {
      console.log('❌ Семантические блоки не найдены');
      return;
    }
    
    console.log('\n📊 Статус семантических блоков:');
    for (const row of blocksResult.rows) {
      console.log(`Project ${row.project_id}: ${row.blocks_count} блоков, ${row.vectorized_count} векторизованы`);
    }
    
    // Выбираем первый проект для тестирования
    const firstProject = blocksResult.rows[0];
    const projectId = firstProject.project_id;
    
    console.log(`\n🧪 Тестируем векторизацию для проекта ${projectId}...`);
    
    // Показываем пример блока до векторизации
    const beforeResult = await pool.query(`
      SELECT 
        id,
        block_title,
        semantic_essence,
        search_vector,
        optimized_requirements
      FROM semantic_blocks 
      WHERE project_id = $1 
      LIMIT 1
    `, [projectId]);
    
    if (beforeResult.rows.length > 0) {
      const block = beforeResult.rows[0];
      console.log('\n📋 Пример блока до векторизации:');
      console.log(`ID: ${block.id}`);
      console.log(`Заголовок: ${block.block_title}`);
      console.log(`Векторизован: ${block.search_vector ? 'Да' : 'Нет'}`);
      
      if (block.semantic_essence && block.semantic_essence.key_requirements) {
        console.log('\n🔧 Исходные требования:');
        block.semantic_essence.key_requirements.slice(0, 3).forEach((req, i) => {
          console.log(`  ${i + 1}. ${req}`);
        });
        if (block.semantic_essence.key_requirements.length > 3) {
          console.log(`  ... и еще ${block.semantic_essence.key_requirements.length - 3} требований`);
        }
      }
    }
    
    // Выполняем векторизацию через API
    console.log('\n🚀 Запускаем векторизацию...');
    
    try {
      const response = await fetch(`http://localhost:5000/api/semantic/projects/${projectId}/vectorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token' // Для тестирования
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Векторизация завершена: обработано ${result.processedBlocks} блоков`);
        
        // Показываем результат после векторизации
        const afterResult = await pool.query(`
          SELECT 
            id,
            block_title,
            search_vector,
            optimized_requirements
          FROM semantic_blocks 
          WHERE project_id = $1 AND search_vector IS NOT NULL
          LIMIT 1
        `, [projectId]);
        
        if (afterResult.rows.length > 0) {
          const vectorizedBlock = afterResult.rows[0];
          console.log('\n📊 Результат векторизации:');
          console.log(`ID: ${vectorizedBlock.id}`);
          console.log(`Заголовок: ${vectorizedBlock.block_title}`);
          console.log(`Поисковый вектор: ${vectorizedBlock.search_vector.substring(0, 100)}...`);
          
          if (vectorizedBlock.optimized_requirements) {
            console.log('\n🎯 Оптимизированные требования:');
            const opt = vectorizedBlock.optimized_requirements;
            if (opt.deduped_requirements) {
              console.log(`  Дедуплицированные требования: ${opt.deduped_requirements.length}`);
              opt.deduped_requirements.slice(0, 3).forEach((req, i) => {
                console.log(`    ${i + 1}. ${req}`);
              });
            }
            if (opt.technical_keywords) {
              console.log(`  Технические ключевые слова: ${opt.technical_keywords.join(', ')}`);
            }
          }
        }
        
      } else {
        console.log('❌ Ошибка векторизации через API, пробуем прямой вызов...');
        
        // Прямой вызов VectorizationService
        const { VectorizationService } = require('./server/services/vectorizationService');
        const vectorizationService = new VectorizationService();
        
        const directResult = await vectorizationService.optimizeSemanticBlocks(projectId);
        console.log(`✅ Прямая векторизация завершена: обработано ${directResult.length} блоков`);
      }
      
    } catch (apiError) {
      console.log('⚠️ API недоступен, выполняем прямую векторизацию...');
      
      // Прямой вызов VectorizationService
      const { VectorizationService } = require('./server/services/vectorizationService');
      const vectorizationService = new VectorizationService();
      
      const directResult = await vectorizationService.optimizeSemanticBlocks(projectId);
      console.log(`✅ Прямая векторизация завершена: обработано ${directResult.length} блоков`);
    }
    
    // Финальная статистика
    console.log('\n📈 Финальная статистика:');
    const finalResult = await pool.query(`
      SELECT 
        project_id,
        COUNT(*) as total_blocks,
        SUM(CASE WHEN search_vector IS NOT NULL THEN 1 ELSE 0 END) as vectorized_blocks,
        AVG(LENGTH(search_vector)) as avg_vector_length
      FROM semantic_blocks 
      WHERE project_id = $1
      GROUP BY project_id
    `, [projectId]);
    
    if (finalResult.rows.length > 0) {
      const stats = finalResult.rows[0];
      console.log(`Проект ${stats.project_id}:`);
      console.log(`  Всего блоков: ${stats.total_blocks}`);
      console.log(`  Векторизовано: ${stats.vectorized_blocks}`);
      console.log(`  Средняя длина вектора: ${Math.round(stats.avg_vector_length || 0)} символов`);
      console.log(`  Покрытие: ${Math.round(stats.vectorized_blocks / stats.total_blocks * 100)}%`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testVectorization()
    .then(() => {
      console.log('\n🎉 Тестирование векторизации завершено!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = { testVectorization };
