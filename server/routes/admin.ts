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
    
    console.log(`[Admin API] Found ${subscriptionsList.length} subscriptions at ${new Date().toISOString()}`);
    
    res.status(200).json(subscriptionsList);
  } catch (error) {
    console.error('[Admin API] Error fetching subscriptions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch subscriptions'
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
    
    // Add anti-caching headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const { userId, emailAccount, emailPassword, plan, status, maxRequestsPerMonth, startDate, endDate, managerId, notes } = req.body;
    
    // Convert string dates to Date objects if provided
    const endDateObj = endDate ? new Date(endDate) : undefined;
    const startDateObj = startDate ? new Date(startDate) : undefined;
    
    // Update subscription using SQL for flexibility with column names
    let updateQuery = 'UPDATE subscriptions SET updated_at = NOW()';
    const updateValues: any[] = [];
    let paramIndex = 1;
    
    if (userId !== undefined) {
      updateQuery += `, user_id = $${paramIndex}`;
      updateValues.push(userId);
      paramIndex++;
    }
    if (plan) {
      updateQuery += `, plan = $${paramIndex}`;
      updateValues.push(plan);
      paramIndex++;
    }
    if (status) {
      updateQuery += `, status = $${paramIndex}`;
      updateValues.push(status);
      paramIndex++;
    }
    if (maxRequestsPerMonth !== undefined) {
      updateQuery += `, requests_limit = $${paramIndex}`;
      updateValues.push(maxRequestsPerMonth);
      paramIndex++;
    }
    if (endDateObj) {
      updateQuery += `, expiry_date = $${paramIndex}`;
      updateValues.push(endDateObj);
      paramIndex++;
    }
    
    // Add WHERE clause and RETURNING *
    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    updateValues.push(subscriptionId);
    
    const result = await db.execute(sql.raw(updateQuery, updateValues));
    
    const updatedSubscription = Array.isArray(result) ? result[0] : result;
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
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update subscription'
    });
  }
});



export default router;