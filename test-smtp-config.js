import nodemailer from 'nodemailer';

async function testSMTPConfig() {
  try {
    console.log('🧪 Testing SMTP configuration...\n');
    
    console.log('SMTP Settings:');
    console.log(`  Host: ${process.env.SMTP_HOST}`);
    console.log(`  Port: ${process.env.SMTP_PORT}`);
    console.log(`  User: ${process.env.SMTP_USER}`);
    console.log(`  Pass: ${process.env.SMTP_PASS ? 'SET' : 'NOT SET'}`);
    
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('❌ SMTP configuration is incomplete');
      return;
    }
    
    console.log('\nCreating transporter...');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    
    console.log('\nTesting email send...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'test@example.com',
      subject: 'Test Email from SupplierFinder',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<p>This is a test email to verify SMTP configuration.</p>'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    
  } catch (error) {
    console.error('❌ SMTP test failed:', error.message);
    console.error('Full error:', error);
  }
}

testSMTPConfig();
