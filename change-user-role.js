// Скрипт для изменения роли пользователя с admin на user
const { postgres } = require('postgres');

async function changeUserRole() {
  const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'supplier_finder',
    username: 'postgres',
    password: 'postgres'
  });

  try {
    console.log('🔍 Ищем пользователей с ролью admin...');
    
    // Найдем всех пользователей с ролью admin
    const adminUsers = await sql`
      SELECT id, email, username, role 
      FROM users 
      WHERE role = 'admin'
    `;
    
    console.log(`📊 Найдено ${adminUsers.length} пользователей с ролью admin:`);
    adminUsers.forEach(user => {
      console.log(`   - ID: ${user.id}, Email: ${user.email}, Username: ${user.username}`);
    });
    
    if (adminUsers.length === 0) {
      console.log('✅ Пользователей с ролью admin не найдено');
      return;
    }
    
    // Изменим роль всех admin пользователей на user
    console.log('\n🔄 Изменяем роль с admin на user...');
    
    for (const user of adminUsers) {
      await sql`
        UPDATE users 
        SET role = 'user' 
        WHERE id = ${user.id}
      `;
      
      console.log(`✅ Пользователь ${user.email || user.username} (ID: ${user.id}) теперь имеет роль 'user'`);
    }
    
    console.log('\n🎉 Все пользователи успешно изменены на роль "user"');
    console.log('💡 Теперь ссылка "Админ панель" не будет отображаться в навигации');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

changeUserRole();
