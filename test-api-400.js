import fetch from 'node-fetch';

async function testAPI400() {
  try {
    console.log('🔍 Testing API endpoints for 400 errors...\n');
    
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    try {
      const healthResponse = await fetch('http://localhost:5000/api/health');
      console.log(`   Status: ${healthResponse.status}`);
      if (!healthResponse.ok) {
        const errorText = await healthResponse.text();
        console.log(`   Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 2: Subscriptions endpoint
    console.log('\n2. Testing subscriptions endpoint...');
    try {
      const subsResponse = await fetch('http://localhost:5000/api/subscriptions/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'connect.sid=s%3Atest' // Mock session
        }
      });
      console.log(`   Status: ${subsResponse.status}`);
      if (!subsResponse.ok) {
        const errorText = await subsResponse.text();
        console.log(`   Error: ${errorText}`);
      } else {
        const data = await subsResponse.json();
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 3: Admin subscriptions
    console.log('\n3. Testing admin subscriptions endpoint...');
    try {
      const adminResponse = await fetch('http://localhost:5000/api/admin/subscriptions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'connect.sid=s%3Atest' // Mock session
        }
      });
      console.log(`   Status: ${adminResponse.status}`);
      if (!adminResponse.ok) {
        const errorText = await adminResponse.text();
        console.log(`   Error: ${errorText}`);
      } else {
        const data = await adminResponse.json();
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 4: Registration endpoint
    console.log('\n4. Testing registration endpoint...');
    try {
      const regResponse = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword123',
          confirmPassword: 'testpassword123'
        })
      });
      console.log(`   Status: ${regResponse.status}`);
      if (!regResponse.ok) {
        const errorText = await regResponse.text();
        console.log(`   Error: ${errorText}`);
      } else {
        const data = await regResponse.json();
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI400();
