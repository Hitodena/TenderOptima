#!/usr/bin/env node

/**
 * Test script to debug attachment encoding issues
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function testAttachmentEncoding() {
  console.log('🧪 Testing attachment encoding...');
  
  // Create a test text file with Russian content
  const testContent = '1. Стоимость за 1 шт без НДС 1500 рублей';
  const testFilePath = path.join(__dirname, 'test_attachment.txt');
  
  try {
    // Write test file with different encodings
    console.log('📝 Creating test file with UTF-8 encoding...');
    await fs.promises.writeFile(testFilePath, testContent, 'utf8');
    
    // Read and show content
    const content = await fs.promises.readFile(testFilePath, 'utf8');
    console.log('📖 File content (UTF-8):', content);
    
    // Test base64 encoding/decoding
    const base64Content = Buffer.from(testContent, 'utf8').toString('base64');
    console.log('🔤 Base64 encoded:', base64Content);
    
    const decodedContent = Buffer.from(base64Content, 'base64').toString('utf8');
    console.log('🔓 Base64 decoded:', decodedContent);
    
    // Test with CP1251 encoding
    console.log('📝 Creating test file with CP1251 encoding...');
    const cp1251Buffer = Buffer.from(testContent, 'cp1251');
    await fs.promises.writeFile(testFilePath + '.cp1251', cp1251Buffer);
    
    const cp1251Content = await fs.promises.readFile(testFilePath + '.cp1251', 'utf8');
    console.log('📖 File content (CP1251->UTF8):', cp1251Content);
    
    // Test Python processor
    console.log('🐍 Testing Python processor...');
    const inputData = {
      attachments: [{
        filename: 'test_attachment.txt',
        contentType: 'text/plain',
        content: base64Content,
        size: testContent.length
      }]
    };
    
    const inputFilePath = path.join(__dirname, 'test_input.json');
    await fs.promises.writeFile(inputFilePath, JSON.stringify(inputData, null, 2), 'utf8');
    
    // Run Python processor
    const pythonProcess = spawn('python', [
      'server/file-processing/file_processor.py',
      inputFilePath
    ], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      console.log('🐍 Python process finished with code:', code);
      if (output) {
        console.log('📤 Python output:', output);
      }
      if (errorOutput) {
        console.log('❌ Python error:', errorOutput);
      }
      
      // Cleanup
      fs.unlink(testFilePath, () => {});
      fs.unlink(testFilePath + '.cp1251', () => {});
      fs.unlink(inputFilePath, () => {});
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAttachmentEncoding();
