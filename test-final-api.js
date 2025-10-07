import fetch from 'node-fetch';

async function testFinalAPI() {
  try {
    console.log('🧪 Final API Testing...\n');
    
    // Test 1: Registration
    console.log('1. Testing registration...');
    const regResponse = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'finaltest@example.com',
        password: 'testpassword123',
        confirmPassword: 'testpassword123'
      })
    });
    
    if (regResponse.ok) {
      const regData = await regResponse.json();
      console.log('✅ Registration successful, user ID:', regData.id);
      
      // Test 2: Login with token
      console.log('\n2. Testing subscription status with token...');
      const subResponse = await fetch('http://localhost:5001/api/subscriptions/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${regData.accessToken}`
        }
      });
      
      if (subResponse.ok) {
        const subData = await subResponse.json();
        console.log('✅ Subscription status retrieved');
        console.log('Subscription details:');
        console.log('- Plan:', subData.subscription.plan);
        console.log('- Status:', subData.subscription.status);
        console.log('- End Date:', subData.subscription.endDate);
        console.log('- Requests Limit:', subData.subscription.maxRequests);
        console.log('- Requests Used:', subData.subscription.requestsUsed);
      } else {
        console.log('❌ Subscription status failed:', subResponse.status);
      }
    } else {
      console.log('❌ Registration failed:', regResponse.status);
    }
    
    // Test 3: Health check
    console.log('\n3. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:5001/api/health');
    console.log('Health status:', healthResponse.status);
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFinalAPI();
