import axios from 'axios';

async function testEmailExtraction() {
  try {
    console.log('Testing parameter extraction from email content without attachments...');
    
    // Get the response ID from command line arguments or use a default
    const responseId = process.argv[2] || 99; // Using 99 as default, which appears to be Support email
    
    // Define parameters to extract
    const parameters = [
      "Общая стоимость без НДС", 
      "Общая стоимость с НДС", 
      "Цена за единицу без НДС"
    ];
    
    console.log(`Testing extraction from response ID: ${responseId}`);
    console.log(`Parameters to extract: ${parameters.join(', ')}`);
    
    // Call the parameter extraction endpoint
    const response = await axios.post('http://localhost:5000/api/extract-parameters', {
      responseId: Number(responseId),
      parameters,
      useAI: true
    });
    
    console.log('\n=== EXTRACTION RESULTS ===');
    if (response.data && response.data.parameters) {
      const results = response.data.parameters;
      console.log(`Found ${results.length} parameters:`);
      
      // Display the results in a table-like format
      console.log('\n| Parameter | Value | Source | Confidence |');
      console.log('|-----------|-------|--------|------------|');
      results.forEach(param => {
        console.log(`| ${param.name} | ${param.value} | ${param.source} | ${param.confidence} |`);
      });
      
      // Summary of extraction sources
      const fromContent = results.filter(p => p.source === 'content' && p.value !== '-').length;
      const fromAttachment = results.filter(p => p.source === 'attachment' && p.value !== '-').length;
      const unknown = results.filter(p => p.source === 'unknown' || p.value === '-').length;
      
      console.log('\n=== SOURCE SUMMARY ===');
      console.log(`Parameters from email content: ${fromContent}`);
      console.log(`Parameters from attachments: ${fromAttachment}`);
      console.log(`Parameters not found: ${unknown}`);
      
      if (fromContent > 0) {
        console.log('\n✅ Successfully extracted parameters from email content!');
      } else if (fromAttachment > 0) {
        console.log('\n✅ Successfully extracted parameters from attachments!');
      } else {
        console.log('\n❌ Failed to extract any parameters');
      }
    } else {
      console.log('No parameters returned in the response');
    }
  } catch (error) {
    console.error('Error testing parameter extraction:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testEmailExtraction();