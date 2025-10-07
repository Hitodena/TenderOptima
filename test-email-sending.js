import fetch from 'node-fetch';

async function testEmailSending() {
  try {
    console.log('🧪 Testing email sending functionality...\n');
    
    // Test 1: Check SMTP configuration
    console.log('1. Checking SMTP configuration...');
    console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
    console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}`);
    console.log(`   SMTP_USER: ${process.env.SMTP_USER ? 'SET' : 'NOT SET'}`);
    console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? 'SET' : 'NOT SET'}`);
    
    // Test 2: Test send-email endpoint
    console.log('\n2. Testing /api/send-email endpoint...');
    try {
      const response = await fetch('http://localhost:5000/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          suppliers: ['test@example.com'],
          subject: 'Test Email',
          message: 'This is a test email',
          requestId: 0
        })
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   Response:`, data);
        console.log(`   Success: ${data.success}`);
        console.log(`   Success Count: ${data.successCount}`);
        console.log(`   Total Count: ${data.totalCount}`);
      } else {
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n🎉 Email sending test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEmailSending();
