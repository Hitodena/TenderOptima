// Simple server test script
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

console.log('Environment variables loaded:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

// Test basic imports
try {
  console.log('Testing imports...');
  const express = await import('express');
  console.log('✅ Express imported successfully');
  
  const cors = await import('cors');
  console.log('✅ CORS imported successfully');
  
  console.log('✅ All basic imports successful');
  console.log('Server should be able to start');
} catch (error) {
  console.error('❌ Import error:', error.message);
  process.exit(1);
}
