const { db } = require('./server/db');
const { excludedDomains } = require('./shared/schema');

async function testStoplist() {
  try {
    console.log('Checking excluded domains...');
    const result = await db.select().from(excludedDomains);
    console.log('Excluded domains found:', result.length);
    result.forEach(domain => {
      console.log(`- ${domain.domain} (${domain.reason})`);
    });
    
    if (result.length === 0) {
      console.log('No excluded domains found. Adding a test domain...');
      await db.insert(excludedDomains).values({
        domain: 'example.com',
        reason: 'Test domain for stoplist integration',
        addedById: 1
      });
      console.log('Test domain added successfully');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testStoplist();
