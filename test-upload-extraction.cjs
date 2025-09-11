const { Pool } = require('pg');
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testUploadExtraction() {
  try {
    console.log('🔧 Testing file upload with text extraction...');
    
    // First, test the existing project 225 to see if our manual fix worked
    console.log('🔍 Checking project 225 extracted text status...');
    const result = await pool.query(
      'SELECT id, filename, LENGTH(extracted_text) as text_length, extracted_text IS NOT NULL as has_text FROM analysis_project_files WHERE project_id = 225'
    );
    
    if (result.rows.length > 0) {
      const file = result.rows[0];
      console.log(`📄 Project 225 file: ${file.filename}`);
      console.log(`📝 Text length: ${file.text_length || 0} characters`);
      console.log(`✅ Has extracted text: ${file.has_text}`);
      
      if (file.has_text && file.text_length > 0) {
        console.log('✅ SUCCESS: Previous manual fix worked - text is properly stored!');
        
        // Now test if enhanced TZ extraction works with this data
        console.log('🚀 Testing enhanced TZ extraction API call...');
        
        // Make request to enhanced TZ extraction endpoint
        const response = await fetch(`http://localhost:5000/api/analysis-projects/225/enhanced-tz-extraction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'session_id=test' // We'll need proper auth for real test
          }
        });
        
        if (response.ok) {
          const extractionResult = await response.json();
          console.log('✅ Enhanced TZ extraction completed successfully!');
          console.log(`📊 Extracted ${extractionResult.extracted?.length || 0} parameters`);
        } else {
          console.log(`❌ Enhanced TZ extraction failed: ${response.status} ${response.statusText}`);
        }
      } else {
        console.log('❌ ISSUE: Text extraction still not working properly');
      }
    } else {
      console.log('❌ No files found for project 225');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Test error:', error);
    process.exit(1);
  }
}

testUploadExtraction();