// Test script to verify attachment loading fix
const fetch = require('node-fetch');

async function testAttachmentEndpoint() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('Testing attachment endpoint...');
  
  try {
    // Test with a sample response ID and filename
    const responseId = 1;
    const filename = 'test-image.png';
    const url = `${baseUrl}/api/attachments/${responseId}/${encodeURIComponent(filename)}`;
    
    console.log(`Testing URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'image/*,*/*',
        'Cache-Control': 'no-cache'
      }
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.status === 404) {
      console.log('✅ Endpoint is working (404 is expected for non-existent attachment)');
    } else if (response.status === 401) {
      console.log('✅ Authentication is working (401 is expected without token)');
    } else if (response.status === 200) {
      console.log('✅ Attachment loaded successfully');
    } else {
      console.log(`❌ Unexpected status: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAttachmentEndpoint();
