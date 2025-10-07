import { db } from './server/db.ts';
import { subscriptions } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function checkSubscription() {
  try {
    console.log('Checking subscription ID 27...');
    
    const result = await db.select().from(subscriptions).where(eq(subscriptions.id, 27));
    
    if (result.length > 0) {
      const sub = result[0];
      console.log('Subscription data:');
      console.log('ID:', sub.id);
      console.log('User ID:', sub.userId);
      console.log('Status:', sub.status);
      console.log('Start Date:', sub.startDate);
      console.log('End Date:', sub.endDate);
      console.log('Requests Limit:', sub.requestsLimit);
      console.log('Requests Used:', sub.requestsUsed);
      
      // Check if subscription is expired
      const now = new Date();
      const endDate = sub.endDate ? new Date(sub.endDate) : null;
      
      console.log('\nDate analysis:');
      console.log('Current time:', now);
      console.log('End Date:', endDate);
      
      if (endDate && endDate < now) {
        console.log('❌ Subscription is EXPIRED');
      } else {
        console.log('✅ Subscription is ACTIVE');
      }
    } else {
      console.log('❌ Subscription not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkSubscription();
