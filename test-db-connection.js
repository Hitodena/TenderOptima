import pkg from 'pg';
const { Client } = pkg;

async function testDatabaseConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/supplierfinder'
  });

  try {
    console.log('🔍 Testing database connection...');
    await client.connect();
    console.log('✅ Database connected successfully');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Basic query works:', result.rows[0].current_time);
    
    // Test subscriptions table
    const subsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Subscriptions table columns:');
    subsResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    // Test if we can insert a test subscription
    console.log('\n🧪 Testing subscription creation...');
    const testEndDate = new Date();
    testEndDate.setDate(testEndDate.getDate() + 14);
    
    const insertResult = await client.query(`
      INSERT INTO subscriptions (user_id, plan, status, end_date, requests_limit, requests_used, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [999, 'test', 'active', testEndDate, 5, 0, new Date(), new Date()]);
    
    console.log('✅ Test subscription created with ID:', insertResult.rows[0].id);
    
    // Clean up test data
    await client.query('DELETE FROM subscriptions WHERE user_id = 999');
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

testDatabaseConnection();
