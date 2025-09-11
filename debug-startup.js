// Debug startup script
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 DEBUG: Starting diagnostic...');
console.log('📁 Current directory:', process.cwd());
console.log('📁 Script directory:', __dirname);

// Load environment
const envPath = path.join(__dirname, '.env');
console.log('🔧 Loading .env from:', envPath);
dotenv.config({ path: envPath });

console.log('📋 Environment variables:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  PORT:', process.env.PORT);
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
console.log('  DEV_MODE:', process.env.DEV_MODE);

// Test file existence
import fs from 'fs';
const serverPath = path.join(__dirname, 'server', 'index.ts');
console.log('📄 Server file exists:', fs.existsSync(serverPath) ? '✅ Yes' : '❌ No');
console.log('📄 Server file path:', serverPath);

// Test imports step by step
console.log('🧪 Testing imports...');
try {
  console.log('  Importing express...');
  const express = await import('express');
  console.log('  ✅ Express imported');
  
  console.log('  Importing cors...');
  const cors = await import('cors');
  console.log('  ✅ CORS imported');
  
  console.log('  Importing dotenv...');
  const dotenv2 = await import('dotenv');
  console.log('  ✅ Dotenv imported');
  
  console.log('✅ All imports successful');
} catch (error) {
  console.error('❌ Import error:', error.message);
  console.error('Stack:', error.stack);
}

console.log('🎯 Ready to start server...');
