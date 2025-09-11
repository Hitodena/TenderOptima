const { Pool } = require('pg');
const fs = require('fs');
const { spawn } = require('child_process');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function debugTextExtraction() {
  try {
    console.log('🔍 Debugging text extraction for project 225...');
    
    // Get the file data from database
    const result = await pool.query(
      'SELECT id, filename, file_data, mime_type FROM analysis_project_files WHERE project_id = 225'
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No files found for project 225');
      return;
    }
    
    const file = result.rows[0];
    console.log(`📄 Found file: ${file.filename}`);
    console.log(`📏 File size: ${file.file_data.length} bytes`);
    console.log(`🔧 MIME type: ${file.mime_type}`);
    
    // Write binary data to temporary file
    const tempFilePath = `/tmp/debug_${Date.now()}_${file.filename}`;
    fs.writeFileSync(tempFilePath, file.file_data);
    console.log(`💾 Wrote file to: ${tempFilePath}`);
    
    // Test text extraction
    console.log('🚀 Starting text extraction...');
    
    const python = spawn('python3', ['extract_text_optimized.py', tempFilePath, file.mime_type], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString('utf8');
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString('utf8');
    });
    
    python.on('close', (code) => {
      console.log(`\n📋 Text extraction finished with code: ${code}`);
      console.log(`📝 Extracted text length: ${output.trim().length} characters`);
      
      if (output.trim().length > 0) {
        console.log(`✅ Text extraction successful!`);
        console.log(`📖 First 500 chars: ${output.trim().substring(0, 500)}...`);
        
        // Update database with extracted text
        pool.query(
          'UPDATE analysis_project_files SET extracted_text = $1 WHERE id = $2',
          [output.trim(), file.id]
        ).then(() => {
          console.log('💾 Updated database with extracted text');
        }).catch(updateError => {
          console.error('❌ Database update error:', updateError);
        });
      } else {
        console.log('❌ Text extraction failed or returned empty');
        if (error) {
          console.log('🔴 Error output:', error);
        }
      }
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      console.log('🗑️ Cleaned up temporary file');
      
      process.exit(0);
    });
    
  } catch (error) {
    console.error('💥 Debug script error:', error);
    process.exit(1);
  }
}

debugTextExtraction();