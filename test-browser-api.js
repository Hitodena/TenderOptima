import fetch from 'node-fetch';

async function testBrowserAPI() {
  try {
    console.log('🧪 Testing browser API endpoints...\n');
    
    // Test 1: Health check
    console.log('1. Testing health endpoint on port 5000...');
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
    
    // Test 2: Supplier search endpoint
    console.log('\n2. Testing supplier search endpoint on port 5000...');
    try {
      const searchResponse = await fetch('http://localhost:5000/api/supplier-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          keywords: 'test',
          sources: ['google'],
          regions: ['belarus']
        })
      });
      console.log(`   Status: ${searchResponse.status}`);
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.log(`   Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 3: Check if port 5001 is accessible
    console.log('\n3. Testing if port 5001 is accessible...');
    try {
      const port5001Response = await fetch('http://localhost:5001/api/health');
      console.log(`   Port 5001 Status: ${port5001Response.status}`);
    } catch (error) {
      console.log(`   Port 5001 Error: ${error.message}`);
    }
    
    console.log('\n🎉 Browser API tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBrowserAPI();
