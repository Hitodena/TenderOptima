
#!/usr/bin/env node

/**
 * Скрипт для тестирования IMAP подключения
 */

const { ImapService } = require('./server/imap-service.ts');
require('dotenv').config();

async function testImapConnection() {
  console.log('🧪 Testing IMAP connection...\n');
  
  // Проверяем переменные окружения
  const requiredVars = ['IMAP_USER', 'IMAP_PASSWORD', 'IMAP_HOST', 'IMAP_PORT'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  console.log('✅ Environment variables configured');
  console.log(`Host: ${process.env.IMAP_HOST}:${process.env.IMAP_PORT}`);
  console.log(`User: ${process.env.IMAP_USER}\n`);
  
  try {
    const imapService = new ImapService();
    
    // Даем время на подключение
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('📧 Testing email check...');
    const result = await imapService.checkEmailsOnDemand();
    
    console.log('Result:', result);
    
    if (result.success) {
      console.log('✅ IMAP connection test successful!');
    } else {
      console.log('❌ IMAP connection test failed:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
  
  process.exit(0);
}

testImapConnection();
