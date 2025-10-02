import fetch from 'node-fetch';

async function debugHeaders() {
  try {
    console.log('Testing headers...');
    
    const response = await fetch('http://localhost:5000/api/admin/excluded-domains', {
      method: 'GET',
      headers: {
        'x-admin-token': 'admin-token-123456',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.text();
    console.log('Response body:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugHeaders();
