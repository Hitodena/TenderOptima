import fetch from 'node-fetch';

async function testSubscriptionAPI() {
  try {
    console.log('Testing subscription API...');
    
    // Test getting subscriptions
    const response = await fetch('http://localhost:3000/api/admin/subscriptions', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3A123' // Mock session
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API is working!');
      console.log('Subscriptions found:', data.length);
      
      if (data.length > 0) {
        const sub = data[0];
        console.log('First subscription:');
        console.log('- ID:', sub.id);
        console.log('- Plan:', sub.plan);
        console.log('- Status:', sub.status);
        console.log('- End Date:', sub.endDate);
        console.log('- Start Date:', sub.startDate);
        console.log('- Requests Limit:', sub.requestsLimit);
        console.log('- Requests Used:', sub.requestsUsed);
      }
    } else {
      const error = await response.text();
      console.log('❌ API Error:', response.status, error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSubscriptionAPI();
