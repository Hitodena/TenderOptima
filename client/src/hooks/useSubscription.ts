import { useState, useEffect } from 'react';

interface Subscription {
  id: number;
  userId: number;
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  isAutoRenew: boolean;
  features: string[];
  maxRequests: number;
  maxSuppliers: number;
  requestsUsed: number;
  requestsRest: number;
  managerId: number | null;
  createdAt: string;
  updatedAt: string;
  daysRemaining: number;
  isExpired: boolean;
  isEndingSoon: boolean;
}

interface SubscriptionData {
  subscription: Subscription;
  manager: {
    name: string;
    email: string;
  };
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/subscriptions/status', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      if (response.ok) {
        const data: SubscriptionData = await response.json();
        setSubscription(data.subscription);
        setError(null);
      } else {
        throw new Error('Failed to fetch subscription');
      }
    } catch (err) {
      console.error('Subscription fetch error:', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        endpoint: '/api/subscriptions/status'
      });
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const isSubscriptionActive = subscription ? !subscription.isExpired && subscription.status === 'active' : false;

  return {
    subscription,
    isLoading,
    error,
    isActive: isSubscriptionActive,
    // During loading, assume active to prevent flash of subscription screen
    isActiveOrLoading: isLoading ? true : isSubscriptionActive,
    refresh: fetchSubscription
  };
}