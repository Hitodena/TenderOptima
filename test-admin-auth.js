import fetch from 'node-fetch';

async function testAdminAuth() {
  try {
    console.log('Testing admin authentication...');
    
    const response = await fetch('http://localhost:5000/api/admin/excluded-domains', {
      method: 'GET',
      headers: {
        'X-Admin-Token': 'admin-token-123456',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());
    
    const data = await response.text();
    console.log('Response body:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAdminAuth();
