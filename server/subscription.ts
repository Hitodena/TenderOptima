import { db } from "./db";
import { subscriptions, users, type User, type Subscription, type InsertSubscription } from "@shared/schema";
import { eq, and, lt, gte } from "drizzle-orm";
import * as luxon from "luxon";
const { DateTime } = luxon;

export interface SubscriptionService {
  getSubscription(userId: number): Promise<Subscription | null>;
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: number, data: Partial<InsertSubscription>): Promise<Subscription | null>;
  getAllSubscriptions(): Promise<(Subscription & { user: Pick<User, "id" | "username" | "role"> })[]>;
  checkSubscriptionStatus(userId: number): Promise<{
    isActive: boolean;
    plan: string;
    requestsLeft: number | null;
    expiry: Date | null;
    message: string;
  }>;
  incrementRequestCount(userId: number): Promise<boolean>;
  resetMonthlyRequestCounts(): Promise<number>;
}

export class SubscriptionServiceImpl implements SubscriptionService {
  async getSubscription(userId: number): Promise<Subscription | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    
    return subscription || null;
  }

  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    // Set default values for subscription tiers
    let requestsLimit: number | undefined = data.requestsLimit || undefined;
    
    if (!requestsLimit) {
      switch (data.plan) {
        case 'trial':
          requestsLimit = 5;
          break;
        case 'basic':
          requestsLimit = 50;
          break;
        case 'premium':
          requestsLimit = 500;
          break;
        default:
          requestsLimit = 5; // Default to trial
      }
    }

    // Set default expiry date for trial subscriptions if not provided
    let endDate = data.endDate;
    let expiryDate = data.expiryDate;
    
    if (!endDate && data.plan === 'trial') {
      // Trial subscription expires in 14 days by default
      endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);
    }
    
    // Set expiryDate to match endDate if not provided
    if (!expiryDate) {
      expiryDate = endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
    }

    const [subscription] = await db
      .insert(subscriptions)
      .values({
        ...data,
        requestsLimit,
        endDate,
        expiryDate
      })
      .returning();
    
    return subscription;
  }

  async updateSubscription(id: number, data: Partial<InsertSubscription>): Promise<Subscription | null> {
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.id, id))
      .returning();
    
    return updatedSubscription || null;
  }

  async getAllSubscriptions(): Promise<(Subscription & { user: Pick<User, "id" | "username" | "role"> })[]> {
    const results = await db
      .select({
        subscription: subscriptions,
        user: {
          id: users.id,
          username: users.username,
          role: users.role
        }
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id));
    
    return results.map(({ subscription, user }) => ({
      ...subscription,
      user: user || { id: 0, username: 'Unknown', role: 'user' }
    }));
  }

  async checkSubscriptionStatus(userId: number): Promise<{
    isActive: boolean;
    plan: string;
    requestsLeft: number | null;
    expiry: Date | null;
    message: string;
  }> {
    const subscription = await this.getSubscription(userId);
    
    if (!subscription) {
      // Create a default trial subscription for the user
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      
      const newSubscription = await this.createSubscription({
        userId,
        plan: 'trial',
        status: 'active',
        requestsLimit: 5,
        requestsUsed: 0,
        startDate: new Date(),
        endDate: trialEndDate,
        expiryDate: trialEndDate
      });
      
      return {
        isActive: true,
        plan: 'trial',
        requestsLeft: 5,
        expiry: newSubscription.endDate || null,
        message: 'Пробная подписка активирована'
      };
    }

    const now = new Date();
    const isExpired = subscription.endDate && subscription.endDate < now;
    const isActive = subscription.status === 'active' && !isExpired;
    const requestsLeft = subscription.requestsLimit 
      ? subscription.requestsLimit - (subscription.requestsUsed || 0)
      : null;
    
    let message = '';
    if (!isActive) {
      if (isExpired) {
        message = 'Ваша подписка истекла';
      } else {
        message = 'Ваша подписка неактивна';
      }
    } else if (requestsLeft !== null && requestsLeft <= 0) {
      message = 'Вы исчерпали лимит запросов в этом месяце';
    } else {
      message = `У вас активна подписка "${subscription.plan}"`;
      if (requestsLeft !== null) {
        message += `, осталось запросов: ${requestsLeft}`;
      }
    }

    return {
      isActive: isActive && (requestsLeft === null || requestsLeft > 0),
      plan: subscription.plan,
      requestsLeft,
      expiry: subscription.endDate,
      message
    };
  }

  async incrementRequestCount(userId: number): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    
    if (!subscription) {
      return false;
    }

    // Check if subscription is still active
    const { isActive } = await this.checkSubscriptionStatus(userId);
    if (!isActive) {
      return false;
    }

    // Update requests_used and recalculate requests_rest
    const newRequestsUsed = (subscription.requestsUsed || 0) + 1;
    const newRequestsRest = (subscription.requestsLimit || subscription.maxRequests || 0) - newRequestsUsed;

    await db
      .update(subscriptions)
      .set({
        requestsUsed: newRequestsUsed,
        requestsRest: newRequestsRest,
        updatedAt: new Date()
      })
      .where(eq(subscriptions.id, subscription.id));

    return true;
  }

  async resetMonthlyRequestCounts(): Promise<number> {
    // Reset request counts for all subscriptions that were updated more than a month ago
    const oneMonthAgo = DateTime.now().minus({ months: 1 }).toJSDate();
    
    const result = await db
      .update(subscriptions)
      .set({
        requestsUsed: 0,
        updatedAt: new Date()
      })
      .where(lt(subscriptions.updatedAt, oneMonthAgo))
      .returning();
    
    return result.length;
  }
}

export const subscriptionService = new SubscriptionServiceImpl();