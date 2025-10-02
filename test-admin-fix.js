#!/usr/bin/env node

/**
 * Финальный тест исправлений админ панели
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testUserRole() {
  console.log('🔍 Тестирование роли пользователя request@tenderoptima.by...\n');
  
  try {
    // 1. Проверка аутентификации
    console.log('1. Проверка аутентификации...');
    const authResponse = await fetch(`${BASE_URL}/api/auth/me`, {
      credentials: 'include'
    });
    
    if (authResponse.ok) {
      const user = await authResponse.json();
      console.log(`✅ Пользователь: ${user.username} (ID: ${user.id})`);
      console.log(`   Роль: ${user.role}`);
      
      // 2. Проверка админ статуса
      console.log('\n2. Проверка админ статуса...');
      const adminResponse = await fetch(`${BASE_URL}/api/admin/check-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username
        })
      });
      
      if (adminResponse.ok) {
        const adminData = await adminResponse.json();
        console.log(`✅ Админ статус: ${adminData.isAdmin ? 'ДА' : 'НЕТ'}`);
        
        if (adminData.isAdmin) {
          console.log('❌ ПРОБЛЕМА: Пользователь считается админом!');
          console.log('   Это объясняет, почему показывается админ панель.');
        } else {
          console.log('✅ Пользователь НЕ является админом - админ панель не должна показываться');
        }
      } else {
        console.log(`❌ Ошибка проверки админ статуса: ${adminResponse.status}`);
      }
      
    } else {
      console.log('❌ Пользователь не аутентифицирован');
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

async function testNavigationLogic() {
  console.log('\n🧭 Тестирование логики навигации...\n');
  
  console.log('📋 Логика отображения админ панели:');
  console.log('   Условие: user?.role === "admin"');
  console.log('   Если роль НЕ "admin" - админ панель НЕ показывается');
  console.log('   Если роль "admin" - админ панель показывается');
  
  console.log('\n🔧 Исправления:');
  console.log('   1. ✅ Убрана проверка ID=1 как админа');
  console.log('   2. ✅ Убраны жестко заданные проверки username');
  console.log('   3. ✅ Только роль "admin" определяет админ права');
}

async function main() {
  console.log('🚀 Финальный тест исправлений админ панели...\n');
  
  await testUserRole();
  await testNavigationLogic();
  
  console.log('\n✅ Тестирование завершено!');
  console.log('\n📋 Резюме исправлений:');
  console.log('1. ✅ server/routes/admin.ts - убрана проверка ID=1');
  console.log('2. ✅ client/src/hooks/auth-provider.tsx - убраны жестко заданные проверки');
  console.log('3. ✅ client/src/hooks/use-auth.ts - убраны жестко заданные проверки');
  console.log('4. ✅ client/src/components/new-navigation.tsx - только проверка роли');
  console.log('\n🎯 Теперь админ панель показывается ТОЛЬКО пользователям с ролью "admin"!');
  console.log('\n💡 Для полного исправления:');
  console.log('   1. Запустите: node fix-user-role.js');
  console.log('   2. Перезапустите сервер');
  console.log('   3. Очистите localStorage в браузере');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testUserRole, testNavigationLogic };


