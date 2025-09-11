// Test environment variables
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Testing environment variables...');
console.log('📁 Current directory:', process.cwd());
console.log('📁 Script directory:', __dirname);

// Try different .env paths
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '..', '.env')
];

console.log('🔧 Trying to load .env from:');
for (const envPath of envPaths) {
  console.log('  -', envPath);
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.log('    ❌ Error:', result.error.message);
  } else {
    console.log('    ✅ Loaded successfully');
  }
}

console.log('📋 Environment variables after loading:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  PORT:', process.env.PORT);
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
console.log('  DEV_MODE:', process.env.DEV_MODE);

// Check if .env file exists
import fs from 'fs';
for (const envPath of envPaths) {
  console.log(`📄 File exists ${envPath}:`, fs.existsSync(envPath) ? '✅ Yes' : '❌ No');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    console.log(`📄 Content preview (first 200 chars):`, content.substring(0, 200));
  }
}
