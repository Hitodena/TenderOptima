// Test API endpoint to check subscription data
const response = await fetch('http://localhost:5000/api/admin/subscriptions', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-Admin-Token': 'admin-token-123456' // Use the admin token
  },
  credentials: 'include'
});

if (response.ok) {
  const data = await response.json();
  console.log('API Response:');
  console.log('Total subscriptions:', data.length);
  
  // Find subscription with ID 27
  const sub27 = data.find(sub => sub.id === 27);
  if (sub27) {
    console.log('\n=== Subscription ID 27 ===');
    console.log('ID:', sub27.id);
    console.log('Username:', sub27.username);
    console.log('Status:', sub27.status);
    console.log('Actual Status:', sub27.actualStatus);
    console.log('Is Expired:', sub27.isExpired);
    console.log('Start Date:', sub27.startDate);
    console.log('End Date:', sub27.endDate);
    console.log('Expiry Date:', sub27.expiryDate);
    console.log('Requests Limit:', sub27.requestsLimit);
    console.log('Requests Used:', sub27.requestsUsed);
  } else {
    console.log('❌ Subscription ID 27 not found');
  }
} else {
  console.error('API Error:', response.status, response.statusText);
  const errorText = await response.text();
  console.error('Error details:', errorText);
}
