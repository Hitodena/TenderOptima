import fetch from 'node-fetch';

async function testSimple() {
  try {
    console.log('Testing simple endpoint...');
    
    const response = await fetch('http://localhost:5000/api/csrf-token', {
      method: 'GET'
    });
    
    console.log('Response status:', response.status);
    const data = await response.text();
    console.log('Response body:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSimple();







