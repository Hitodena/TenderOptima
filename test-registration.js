import fetch from 'node-fetch';

async function testRegistration() {
  try {
    console.log('🧪 Testing user registration...\n');
    
    const testData = {
      email: 'finalbrowsertest@example.com',
      password: 'testpassword123',
      confirmPassword: 'testpassword123'
    };
    
    console.log('📤 Sending registration request...');
    console.log('Data:', testData);
    
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    console.log(`\n📥 Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Registration successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Registration failed');
      console.log('Error response:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log('Parsed error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.log('Could not parse error as JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRegistration();
