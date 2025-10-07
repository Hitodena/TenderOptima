import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/supplierfinder'
});

async function checkSubscription() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const result = await client.query(`
      SELECT id, user_id, status, start_date, end_date, requests_limit, requests_used 
      FROM subscriptions 
      WHERE id = 27
    `);
    
    if (result.rows.length > 0) {
      const sub = result.rows[0];
      console.log('\n=== Subscription ID 27 ===');
      console.log('ID:', sub.id);
      console.log('User ID:', sub.user_id);
      console.log('Status:', sub.status);
      console.log('Start Date:', sub.start_date);
      console.log('End Date:', sub.end_date);
      console.log('Requests Limit:', sub.requests_limit);
      console.log('Requests Used:', sub.requests_used);
      
      // Check if subscription is expired
      const now = new Date();
      const endDate = sub.end_date ? new Date(sub.end_date) : null;
      
      console.log('\n=== Date Analysis ===');
      console.log('Current time:', now.toISOString());
      console.log('End Date:', endDate ? endDate.toISOString() : 'NULL');
      
      if (endDate && endDate < now) {
        console.log('❌ Subscription is EXPIRED');
        console.log('Days expired:', Math.ceil((now - endDate) / (1000 * 60 * 60 * 24)));
      } else {
        console.log('✅ Subscription is ACTIVE');
        if (endDate) {
          console.log('Days remaining:', Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
        }
      }
    } else {
      console.log('❌ Subscription not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkSubscription();
