import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { db } from '../db';
import { users, subscriptions } from '@shared/schema';
import { eq, sql, and, gt, lt, desc } from 'drizzle-orm';
import { storage } from '../storage';

const router = Router();

// Middleware to verify admin access
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const userRole = (req.user as any)?.role;
    const isAdmin = userRole === 'admin' || (req.user as any)?.id === 1; // User ID 1 is considered admin
    
    if (!isAdmin) {
      console.log('[Admin API] Access denied: User is not an admin');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can access this resource'
      });
    }
    
    next();
  } catch (error) {
    console.error('[Admin API] Error in admin verification:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify admin privileges'
    });
  }
};

// Check if user is admin
router.post('/check-admin', requireAuth, async (req, res) => {
  try {
    const userRole = (req.user as any)?.role;
    const isAdmin = userRole === 'admin' || (req.user as any)?.id === 1; // User ID 1 is considered admin
    
    console.log(`[Admin API] Admin check for user ${(req.user as any)?.id}: ${isAdmin}`);
    
    res.status(200).json({
      isAdmin,
      user: req.user
    });
  } catch (error) {
    console.error('[Admin API] Error checking admin status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check admin status'
    });
  }
});

// Get all users (admin only)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin API] Fetching all users');
    
    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const userList = await db.select().from(users);
    
    console.log(`[Admin API] Found ${userList.length} users at ${new Date().toISOString()}`);
    
    res.status(200).json(userList);
  } catch (error) {
    console.error('[Admin API] Error fetching users:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch users'
    });
  }
});

// Get admin dashboard stats
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin API] Fetching admin dashboard stats');
    
    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Get user count
    const userCountResult = await db.select({ count: sql<number>`count(*)` }).from(users);
    const userCount = userCountResult[0]?.count || 0;
    
    // Get active subscription count
    const activeSubscriptionResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));
    const activeSubscriptionCount = activeSubscriptionResult[0]?.count || 0;
    
    // Get expired subscription count
    const expiredSubscriptionResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'expired'));
    const expiredSubscriptionCount = expiredSubscriptionResult[0]?.count || 0;
    
    // Get pending subscription count
    const pendingSubscriptionResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'pending'));
    const pendingSubscriptionCount = pendingSubscriptionResult[0]?.count || 0;
    
    const stats = {
      userCount,
      subscriptions: {
        active: activeSubscriptionCount,
        expired: expiredSubscriptionCount,
        pending: pendingSubscriptionCount,
        total: activeSubscriptionCount + expiredSubscriptionCount + pendingSubscriptionCount
      },
      lastUpdated: new Date().toISOString()
    };
    
    console.log('[Admin API] Admin stats generated at:', stats.lastUpdated);
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('[Admin API] Error fetching admin stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch admin dashboard statistics'
    });
  }
});

// Reset all subscription usage counts
router.post('/subscriptions/reset-counts', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin API] Resetting all subscription usage counts');
    
    // Update all subscriptions to reset requestsUsed counter - using the correct field name
    const result = await db.update(subscriptions)
      .set({ 
        requestsUsed: 0,
        updatedAt: new Date()
      })
      .returning();
    
    console.log(`[Admin API] Reset usage counts for ${result.length} subscriptions`);
    
    res.status(200).json({ 
      success: true,
      message: 'All subscription usage counts have been reset',
      count: result.length
    });
  } catch (error) {
    console.error('[Admin API] Error resetting subscription counts:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset subscription usage counts'
    });
  }
});

// Get all subscriptions (admin only)
router.get('/subscriptions', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin API] Fetching all subscriptions');
    
    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Fetch subscriptions with user details separately to avoid column ambiguity
    const subscriptionsList = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        plan: subscriptions.plan,
        status: subscriptions.status,
        requestsLimit: subscriptions.requestsLimit,
        requestsUsed: subscriptions.requestsUsed,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        expiryDate: subscriptions.expiryDate,
        maxRequests: subscriptions.maxRequests,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        username: users.username,
        userRole: users.role
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .orderBy(desc(subscriptions.id));
    
    // Calculate actual status based on end date for each subscription
    const now = new Date();
    const subscriptionsWithActualStatus = subscriptionsList.map(subscription => {
      // Use endDate if available, otherwise use expiryDate
      const endDate = subscription.endDate ? new Date(subscription.endDate) : 
                     subscription.expiryDate ? new Date(subscription.expiryDate) : null;
      const isExpired = endDate && endDate < now;
      const actualStatus = isExpired ? 'expired' : subscription.status;
      
      console.log(`[Admin API] Subscription ${subscription.id}:`, {
        endDate: subscription.endDate,
        expiryDate: subscription.expiryDate,
        calculatedEndDate: endDate,
        isExpired,
        actualStatus
      });
      
      return {
        ...subscription,
        actualStatus, // Add calculated status
        isExpired
      };
    });
    
    console.log(`[Admin API] Found ${subscriptionsWithActualStatus.length} subscriptions at ${new Date().toISOString()}`);
    
    // Debug: Log subscription data for debugging
    console.log('[Admin API] DEBUG - Subscription data:');
    subscriptionsWithActualStatus.forEach((sub, index) => {
      console.log(`[Admin API] Subscription ${index + 1}:`, {
        id: sub.id,
        username: sub.username,
        status: sub.status,
        actualStatus: sub.actualStatus,
        isExpired: sub.isExpired,
        endDate: sub.endDate,
        expiryDate: sub.expiryDate
      });
    });
    
    res.status(200).json(subscriptionsWithActualStatus);
  } catch (error) {
    console.error('[Admin API] Error fetching subscriptions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch subscriptions'
    });
  }
});

// Get user email configuration (admin only)
router.get('/users/:id/email-config', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    console.log(`[Admin API] Fetching email config for user ${userId}`);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }
    
    // Get user email configuration
    const emailConfig = await storage.getUserEmailConfig(userId);
    
    console.log(`[Admin API] Raw email config from storage for user ${userId}:`, emailConfig);
    
    if (!emailConfig) {
      console.log(`[Admin API] No email configuration found for user ${userId}`);
      return res.status(404).json({
        error: 'Not Found',
        message: 'Email configuration not found for this user'
      });
    }
    
    // Decrypt password if it's encrypted
    let decryptedPassword = emailConfig.emailPassword;
    if (emailConfig.emailPassword && emailConfig.emailPassword.includes(':') && emailConfig.emailPassword.split(':').length === 3) {
      try {
        const { decryptEmailPassword } = await import('../utils/email-encryption');
        decryptedPassword = decryptEmailPassword(emailConfig.emailPassword);
      } catch (error) {
        console.error('Error decrypting password for user', userId, ':', error);
        // Keep encrypted password if decryption fails
      }
    }
    
    console.log(`[Admin API] Email config for user ${userId}:`, {
      emailAccount: emailConfig.emailAccount,
      hasPassword: !!emailConfig.emailPassword,
      emailConfigured: emailConfig.emailConfigured
    });
    
    // Return config with decrypted password
    res.status(200).json({
      ...emailConfig,
      emailPassword: decryptedPassword
    });
  } catch (error) {
    console.error('[Admin API] Error fetching user email config:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user email configuration'
    });
  }
});

// Get user system data (admin only)
router.get('/users/:id/system-data', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    console.log(`[Admin API] Fetching system data for user ${userId}`);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }
    
    // Get user system data
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      role: users.role
    }).from(users).where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    console.log(`[Admin API] System data for user ${userId}:`, {
      username: user.username,
      role: user.role
    });
    
    res.status(200).json({
      systemLogin: user.username,
      systemPassword: '[HIDDEN]' // Don't expose system password
    });
  } catch (error) {
    console.error('[Admin API] Error fetching user system data:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user system data'
    });
  }
});

// Debug endpoint to check user data (admin only)
router.get('/users/:id/debug', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    console.log(`[Admin API] Debug: Checking user data for user ${userId}`);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }
    
    // Get full user data
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }
    
    console.log(`[Admin API] Debug: Full user data for user ${userId}:`, {
      id: user.id,
      username: user.username,
      emailAccount: user.emailAccount,
      emailPassword: user.emailPassword ? '[ENCRYPTED]' : null,
      emailConfigured: user.emailConfigured,
      smtpHost: user.smtpHost,
      smtpPort: user.smtpPort,
      imapHost: user.imapHost,
      imapPort: user.imapPort
    });
    
    res.status(200).json({
      id: user.id,
      username: user.username,
      emailAccount: user.emailAccount,
      emailPassword: user.emailPassword ? '[ENCRYPTED]' : null,
      emailConfigured: user.emailConfigured,
      smtpHost: user.smtpHost,
      smtpPort: user.smtpPort,
      imapHost: user.imapHost,
      imapPort: user.imapPort
    });
  } catch (error) {
    console.error('[Admin API] Error in debug endpoint:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user debug data'
    });
  }
});

// Update user system password (admin only)
router.put('/users/:id/system-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    console.log(`[Admin API] Updating system password for user ${userId}`);
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid user ID'
      });
    }
    
    const { systemPassword } = req.body;
    
    if (!systemPassword || systemPassword.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'System password must be at least 6 characters long'
      });
    }
    
    // Import password hashing function
    const { hashPassword } = await import('../auth');
    
    // Hash the new password
    const hashedPassword = await hashPassword(systemPassword);
    
    // Update user's system password
    await db.update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    console.log(`[Admin API] System password updated for user ${userId}`);
    
    res.status(200).json({
      message: 'System password updated successfully'
    });
  } catch (error) {
    console.error('[Admin API] Error updating system password:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update system password'
    });
  }
});

// Create a new subscription (admin only)
router.post('/subscriptions', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('[Admin API] Creating new subscription:', req.body);
    
    const { userId, userEmail, emailAccount, emailPassword, plan, status, maxRequestsPerMonth, startDate, endDate, notes } = req.body;
    
    let finalUserId = userId;
    
    // If userEmail is provided, create a new user or validate existing email
    if (userEmail) {
      // Check if user with this email already exists
      const existingUser = await db.select().from(users).where(eq(users.username, userEmail)).limit(1);
      
      if (existingUser.length > 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'User with such email already exists'
        });
      }
      
      // Create new user using Drizzle with minimal required fields
      try {
        const newUserData = {
          username: userEmail,
          password: `temp_${Date.now()}`,
          role: 'user' as const
        };
        
        const [newUser] = await db.insert(users).values(newUserData).returning({ id: users.id });
        
        if (newUser && newUser.id) {
          finalUserId = newUser.id;
          console.log('[Admin API] Created new user with ID:', finalUserId);
        } else {
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create user - no ID returned'
          });
        }
      } catch (dbError: any) {
        console.error('[Admin API] Database error creating user:', dbError);
        if (dbError.code === '23505') { // Unique constraint violation
          return res.status(400).json({
            error: 'Bad Request',
            message: 'User with such email already exists'
          });
        }
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Database error creating user: ' + dbError.message
        });
      }
    }
    
    if (!finalUserId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Either userId or userEmail must be provided'
      });
    }
    
    // Convert string dates to Date objects
    const startDateObj = startDate ? new Date(startDate) : new Date();
    const endDateObj = endDate ? new Date(endDate) : new Date(new Date().setMonth(new Date().getMonth() + 1));
    
    // Create new subscription using Drizzle ORM with correct field names
    const result = await db.insert(subscriptions).values({
      userId: finalUserId,
      plan: plan || 'trial',
      status: status || 'active',
      requestsLimit: maxRequestsPerMonth || 10,
      requestsUsed: 0,
      expiryDate: endDateObj,
      startDate: startDateObj,
      endDate: endDateObj,
      maxRequests: maxRequestsPerMonth || 10,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log('[Admin API] Created new subscription:', result[0]);
    
    // If email configuration is provided, save it for the user
    if (emailAccount && emailPassword) {
      try {
        const success = await storage.updateUserEmailConfig(finalUserId, {
          emailAccount: emailAccount,
          emailPassword: emailPassword,
          smtpHost: 'smtp.mail.ru',
          smtpPort: 587,
          imapHost: 'imap.mail.ru',
          imapPort: 993,
          emailConfigured: true
        });
        console.log('[Admin API] Email configuration saved for user:', finalUserId, 'Success:', success);
      } catch (emailError) {
        console.error('[Admin API] Failed to save email configuration:', emailError);
        // Don't fail the subscription creation if email config fails
      }
    }
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('[Admin API] Error creating subscription:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create subscription'
    });
  }
});

// Update a subscription (admin only)
router.put('/subscriptions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.id);
    console.log(`[Admin API] Updating subscription ${subscriptionId}:`, req.body);
    
    // Validate subscription ID
    if (isNaN(subscriptionId) || subscriptionId <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid subscription ID'
      });
    }
    
    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const { userId, emailAccount, emailPassword, plan, status, maxRequestsPerMonth, startDate, endDate, managerId, notes } = req.body;
    
    // Validate required fields if provided
    if (plan && !['trial', 'basic', 'premium', 'professional'].includes(plan)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid plan. Must be one of: trial, basic, premium, professional'
      });
    }
    
    if (status && !['active', 'expired', 'canceled', 'pending'].includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status. Must be one of: active, expired, canceled, pending'
      });
    }
    
    if (maxRequestsPerMonth !== undefined && (maxRequestsPerMonth < 0 || !Number.isInteger(maxRequestsPerMonth))) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid maxRequestsPerMonth. Must be a non-negative integer'
      });
    }
    
    // Convert string dates to Date objects if provided
    const endDateObj = endDate ? new Date(endDate) : undefined;
    const startDateObj = startDate ? new Date(startDate) : undefined;
    
    // Build update data object with only provided fields
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (userId !== undefined) updateData.userId = userId;
    if (plan) updateData.plan = plan;
    if (status) updateData.status = status;
    if (maxRequestsPerMonth !== undefined) {
      updateData.requestsLimit = maxRequestsPerMonth;
      updateData.maxRequests = maxRequestsPerMonth;
    }
    if (endDateObj) {
      updateData.expiryDate = endDateObj;
      updateData.endDate = endDateObj;
    }
    if (startDateObj) updateData.startDate = startDateObj;
    
    console.log(`[Admin API] Update data for subscription ${subscriptionId}:`, updateData);
    
    // Update the subscription using Drizzle ORM
    const [updatedSubscription] = await db.update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, subscriptionId))
      .returning();
    
    if (!updatedSubscription) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Subscription with ID ${subscriptionId} not found`
      });
    }
    
    console.log(`[Admin API] Updated subscription ${subscriptionId}:`, updatedSubscription);
    
    // If email configuration is provided, save it for the user
    if (emailAccount && emailPassword && userId) {
      try {
        await storage.updateUserEmailConfig(userId, {
          emailAccount: emailAccount,
          emailPassword: emailPassword,
          smtpHost: 'smtp.mail.ru',
          smtpPort: 587,
          imapHost: 'imap.mail.ru',
          imapPort: 993,
          emailConfigured: true
        });
        console.log('[Admin API] Email configuration updated for user:', userId);
      } catch (emailError) {
        console.error('[Admin API] Failed to update email configuration:', emailError);
        // Don't fail the subscription update if email config fails
      }
    }
    
    res.status(200).json(updatedSubscription);
  } catch (error) {
    console.error('[Admin API] Error updating subscription:', error);
    console.error('[Admin API] Error details:', {
      subscriptionId: req.params.id,
      body: req.body,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



export default router;