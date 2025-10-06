// Test script for subscription update functionality
const fetch = require('node-fetch');

async function testSubscriptionUpdate() {
  try {
    console.log('Testing subscription update...');
    
    // Test data
    const subscriptionId = 1; // Replace with actual subscription ID
    const updateData = {
      plan: 'basic',
      status: 'active',
      maxRequestsPerMonth: 100,
      startDate: '2025-01-01',
      endDate: '2025-12-31'
    };
    
    const response = await fetch(`http://localhost:5000/api/admin/subscriptions/${subscriptionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': 'admin-token-123456'
      },
      body: JSON.stringify(updateData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.text();
    console.log('Response body:', result);
    
    if (response.ok) {
      console.log('✅ Subscription update successful!');
    } else {
      console.log('❌ Subscription update failed!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSubscriptionUpdate();
