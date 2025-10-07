import pkg from 'pg';
const { Client } = pkg;

async function testDatabaseSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/supplierfinder'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check if subscriptions table exists and has correct structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Subscriptions table structure:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check if expiry_date column exists (should not exist)
    const expiryCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions' AND column_name = 'expiry_date'
    `);
    
    if (expiryCheck.rows.length === 0) {
      console.log('\n✅ expiry_date column successfully removed');
    } else {
      console.log('\n❌ expiry_date column still exists');
    }
    
    // Check if end_date column exists
    const endDateCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions' AND column_name = 'end_date'
    `);
    
    if (endDateCheck.rows.length > 0) {
      console.log('\n✅ end_date column exists');
    } else {
      console.log('\n❌ end_date column missing');
    }
    
    // Test query with end_date
    const testQuery = await client.query(`
      SELECT id, user_id, status, start_date, end_date, requests_limit, requests_used 
      FROM subscriptions 
      LIMIT 1
    `);
    
    if (testQuery.rows.length > 0) {
      console.log('\n✅ Query with end_date works');
      console.log('Sample data:', testQuery.rows[0]);
    } else {
      console.log('\n⚠️ No subscriptions found in database');
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await client.end();
  }
}

testDatabaseSchema();
