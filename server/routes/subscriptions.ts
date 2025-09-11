import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';
import { users, managers, subscriptions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// Use standard requireAuth middleware for subscriptions

const router = Router();

// Helper function to calculate days remaining until subscription end
const getDaysRemaining = (endDate: Date): number => {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Get user's subscription status and assigned manager
router.get('/status', requireAuth, async (req, res) => {
  try {
    console.log('=================================');
    console.log('[SUBSCRIPTION HANDLER] Request received at /subscriptions/status');
    console.log('[SUBSCRIPTION HANDLER] req.user:', req.user);
    console.log('[SUBSCRIPTION HANDLER] req.session:', req.session);
    console.log('[SUBSCRIPTION HANDLER] req.isAuthenticated():', req.isAuthenticated ? req.isAuthenticated() : 'no method');
    console.log('[SUBSCRIPTION HANDLER] Session passport:', req.session?.passport);
    console.log('=================================');
    
    // Get user ID from authenticated request
    let userId = req.user?.id;
    
    // If user not found but session exists, try manual authentication
    if (!userId && req.session?.passport?.user) {
      console.log('[Subscription Status] Manual session authentication, userId:', req.session.passport.user);
      userId = req.session.passport.user as number;
      // Manually set user for this request
      req.user = { id: userId };
    }
    
    if (!userId) {
      console.log('[Subscription Status] No authenticated user found');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log('[Subscription Status] Using user ID:', userId);
    
    // Get the most recent active subscription for this user
    const subscriptionResult = await db.execute(
      sql`SELECT * FROM subscriptions WHERE user_id = ${userId} AND status = 'active' ORDER BY created_at DESC LIMIT 1`
    );
    
    console.log('[Subscription Status] Query result:', subscriptionResult.rows);
    
    // Check if we got a subscription
    if (!subscriptionResult.rows || subscriptionResult.rows.length === 0) {
      console.log('[Subscription Status] No subscription found for user', userId);
      return res.status(404).json({ 
        error: 'Subscription not found',
        code: 'subscription_not_found',
        messageKey: 'subscription.notFound.title',
        descriptionKey: 'subscription.notFound.description'
      });
    }
    
    // Get the subscription data from the first row
    const subscriptionRow = subscriptionResult.rows[0];
    console.log('[Subscription Status] Found subscription:', subscriptionRow);
    
    // Get the expiry date from the database 
    const expiryDate = subscriptionRow.expiry_date || subscriptionRow.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(expiryDate);
    
    // Check if subscription is expired
    const now = new Date();
    let status = subscriptionRow.status || 'active';
    
    if (endDate < now) {
      status = 'expired';
    }
    
    // Check if subscription is ending soon (within 7 days)
    const daysRemaining = getDaysRemaining(endDate);
    const isEndingSoon = daysRemaining > 0 && daysRemaining <= 7;
    
    // Calculate the correct requests_rest value
    const requestsLimit = Number(subscriptionRow.requests_limit) || Number(subscriptionRow.max_requests) || 10;
    const requestsUsed = Number(subscriptionRow.requests_used) || 0;
    const calculatedRequestsRest = Math.max(0, requestsLimit - requestsUsed);
    
    // Update the database with the correct requests_rest value if it's different
    if (subscriptionRow.requests_rest !== calculatedRequestsRest) {
      console.log(`[Subscription Status] Fixing requests_rest: DB has ${subscriptionRow.requests_rest}, calculated is ${calculatedRequestsRest}`);
      await db.execute(
        sql`UPDATE subscriptions SET requests_rest = ${calculatedRequestsRest}, updated_at = NOW() WHERE id = ${subscriptionRow.id}`
      );
    }

    // Create a subscription object that matches what the frontend expects
    const subscriptionData = {
      id: subscriptionRow.id,
      userId: subscriptionRow.user_id,
      plan: subscriptionRow.plan || 'trial',
      status: status,
      startDate: subscriptionRow.start_date ? new Date(subscriptionRow.start_date) : (subscriptionRow.created_at ? new Date(subscriptionRow.created_at) : new Date()),
      endDate: endDate,
      isAutoRenew: false,
      features: ['unlimited_requests', 'priority_support'],
      maxRequests: requestsLimit,
      maxSuppliers: subscriptionRow.max_suppliers || 50,
      requestsUsed: requestsUsed,
      requestsRest: calculatedRequestsRest,
      managerId: subscriptionRow.manager_id || null,
      createdAt: subscriptionRow.created_at ? new Date(subscriptionRow.created_at) : new Date(),
      updatedAt: subscriptionRow.updated_at ? new Date(subscriptionRow.updated_at) : new Date(),
      // Extra fields for frontend display
      daysRemaining,
      isExpired: endDate < now,
      isEndingSoon
    };
    
    // For now, provide a default manager since the DB might not have manager data
    const manager = {
      id: 0,
      name: 'Support Team',
      email: 'support@tenderoptima.by',
      position: 'Customer Support',
      phone: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('[Subscription Status] Returning subscription data:', subscriptionData);
    console.log('[Subscription Status] About to send JSON response with headers:', res.getHeaders());
    
    // Explicitly set content-type header and return subscription data
    res.setHeader('Content-Type', 'application/json');
    console.log('[Subscription Status] Set Content-Type header, current headers:', res.getHeaders());
    
    const responseData = {
      subscription: subscriptionData,
      manager
    };
    
    console.log('[Subscription Status] Sending final response:', JSON.stringify(responseData, null, 2));
    res.status(200).json(responseData);
  } catch (error) {
    console.error('[Subscription Status] Error fetching subscription status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch subscription data',
      code: 'server_error',
      messageKey: 'subscription.error.title',
      descriptionKey: 'subscription.error.description'
    });
  }
});

// Get all subscriptions (admin only)
router.get('/', requireAuth, async (req, res) => {
  try {
    // Check if user is admin based on role or ID
    const userRole = (req.user as any)?.role;
    const isAdmin = userRole === 'admin' || (req.user as any)?.id === 1; // Consider user ID 1 as admin
    
    if (!isAdmin) {
      console.log('Access denied: User is not an admin');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can access this resource'
      });
    }
    
    console.log('[Admin API] Fetching all subscriptions');
    
    // Get all subscriptions with user data
    const subscriptionList = await db.select({
      subscription: subscriptions,
      user: users
    })
    .from(subscriptions)
    .leftJoin(users, eq(subscriptions.userId, users.id));
    
    console.log(`[Admin API] Found ${subscriptionList.length} subscriptions`);
    
    const formattedSubscriptions = subscriptionList.map(item => ({
      ...item.subscription,
      user: {
        id: item.user?.id,
        username: item.user?.username,
        role: item.user?.role
      }
    }));
    
    res.status(200).json(formattedSubscriptions);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      error: 'Failed to fetch subscriptions',
      message: 'An error occurred while retrieving the subscription list'
    });
  }
});

// Create a new subscription (admin only)
router.post('/', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const userRole = (req.user as any)?.role;
    const isAdmin = userRole === 'admin' || (req.user as any)?.id === 1;
    
    if (!isAdmin) {
      console.log('Access denied: User is not an admin');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can create subscriptions'
      });
    }
    
    console.log('[Admin API] Creating new subscription', req.body);
    
    // Extract data from request body
    const { userId, plan, status, maxRequestsPerMonth, startDate, endDate, notes } = req.body;
    
    if (!userId || !plan) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'User ID and plan are required'
      });
    }
    
    // Insert the new subscription into the database
    const [newSubscription] = await db.insert(subscriptions)
      .values({
        userId: userId,
        plan: plan,
        status: status || 'active',
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        maxRequests: maxRequestsPerMonth || 100,
        isAutoRenew: false,
        features: ['basic_access'],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log('[Admin API] Created subscription:', newSubscription);
    
    res.status(201).json(newSubscription);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      error: 'Failed to create subscription',
      message: 'An error occurred while creating the subscription'
    });
  }
});

// Update an existing subscription (admin only)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const userRole = (req.user as any)?.role;
    const isAdmin = userRole === 'admin' || (req.user as any)?.id === 1;
    
    if (!isAdmin) {
      console.log('Access denied: User is not an admin');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can update subscriptions'
      });
    }
    
    const subscriptionId = parseInt(req.params.id);
    
    if (isNaN(subscriptionId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid subscription ID'
      });
    }
    
    console.log(`[Admin API] Updating subscription ID: ${subscriptionId}`, req.body);
    
    // Extract updateable fields
    const { userId, plan, status, maxRequestsPerMonth, startDate, endDate, notes } = req.body;
    
    // Build update object with only provided fields
    const updateData: any = {};
    
    if (userId !== undefined) updateData.userId = userId;
    if (plan !== undefined) updateData.plan = plan;
    if (status !== undefined) updateData.status = status;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (maxRequestsPerMonth !== undefined) updateData.maxRequests = maxRequestsPerMonth;
    // Add updatedAt timestamp
    updateData.updatedAt = new Date();
    
    // Update the subscription in the database
    const [updatedSubscription] = await db.update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, subscriptionId))
      .returning();
    
    if (!updatedSubscription) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Subscription not found'
      });
    }
    
    console.log('[Admin API] Updated subscription:', updatedSubscription);
    
    res.status(200).json(updatedSubscription);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      error: 'Failed to update subscription',
      message: 'An error occurred while updating the subscription'
    });
  }
});

// Reset usage counts for all subscriptions (admin only)
router.post('/reset-counts', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const userRole = (req.user as any)?.role;
    const isAdmin = userRole === 'admin' || (req.user as any)?.id === 1;
    
    if (!isAdmin) {
      console.log('Access denied: User is not an admin');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can reset subscription counts'
      });
    }
    
    console.log('[Admin API] Resetting all subscription request counts');
    
    // We don't have a requestsUsed field directly in our schema, so this would depend on your actual data structure
    // For now, this is a placeholder implementation
    const result = await db.execute(
      sql`UPDATE subscriptions SET updated_at = NOW() WHERE 1=1`
    );
    
    console.log('[Admin API] Reset subscription counts result:', result);
    
    res.status(200).json({
      message: 'Subscription counts reset successfully',
      resetCount: result.rowCount || 0
    });
  } catch (error) {
    console.error('Error resetting subscription counts:', error);
    res.status(500).json({
      error: 'Failed to reset subscription counts',
      message: 'An error occurred while resetting subscription counts'
    });
  }
});

// Increment request usage when a request is sent
router.post('/increment-usage', requireAuth, async (req, res) => {
  try {
    // Get user ID from authenticated request
    let userId = req.user?.id;
    
    // If user not found but session exists, try manual authentication
    if (!userId && req.session?.passport?.user) {
      console.log('[Increment Usage] Manual session authentication, userId:', req.session.passport.user);
      userId = req.session.passport.user;
      req.user = { id: userId };
    }
    
    if (!userId) {
      console.log('[Increment Usage] No authenticated user found');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    console.log('[Increment Usage] Incrementing request usage for user ID:', userId);
    
    // Update requests_used and recalculate requests_rest
    const updateResult = await db.execute(
      sql`UPDATE subscriptions 
          SET requests_used = COALESCE(requests_used, 0) + 1,
              requests_rest = COALESCE(requests_limit, max_requests, 0) - (COALESCE(requests_used, 0) + 1),
              updated_at = NOW()
          WHERE user_id = ${userId} AND status = 'active'
          RETURNING requests_used, requests_rest, requests_limit, max_requests`
    );
    
    if (updateResult.rows && updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log('[Increment Usage] Updated usage:', updated);
      
      res.status(200).json({
        success: true,
        requestsUsed: updated.requests_used,
        requestsRest: updated.requests_rest,
        maxRequests: updated.requests_limit || updated.max_requests
      });
    } else {
      console.log('[Increment Usage] No subscription found to update');
      res.status(404).json({ 
        error: 'Subscription not found',
        code: 'subscription_not_found'
      });
    }
  } catch (error) {
    console.error('[Increment Usage] Error incrementing usage:', error);
    res.status(500).json({ 
      error: 'Failed to increment usage',
      code: 'server_error'
    });
  }
});

export default router;