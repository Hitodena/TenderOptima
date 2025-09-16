const { db } = require('./server/db');

async function checkIndexes() {
  try {
    console.log('Checking indexes on supplier_responses table...');
    
    const result = await db.execute(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'supplier_responses'
      ORDER BY indexname;
    `);
    
    console.log('Indexes found:');
    result.rows.forEach(row => {
      console.log(`- ${row.indexname}: ${row.indexdef}`);
    });
    
    if (result.rows.length === 0) {
      console.log('No indexes found on supplier_responses table!');
    }
    
    // Check table size
    const sizeResult = await db.execute(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE tablename = 'supplier_responses'
      ORDER BY attname;
    `);
    
    console.log('\nTable statistics:');
    sizeResult.rows.forEach(row => {
      console.log(`- ${row.attname}: n_distinct=${row.n_distinct}, correlation=${row.correlation}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkIndexes();