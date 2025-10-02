import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useLocation } from "wouter";

interface SubscriptionData {
  id: number;
  userId: number;
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isExpired: boolean;
  isEndingSoon: boolean;
  maxRequests: number;
  requestsUsed: number;
  requestsRest: number;
}

interface SubscriptionResponse {
  subscription: SubscriptionData | null;
  manager: any;
}

export function SubscriptionAlerts() {
  const [location] = useLocation();
  
  // Hide alerts on auth page and admin panel
  if (location === '/auth' || location.startsWith('/admpanel') || location.startsWith('/admin-login')) {
    return null;
  }
  
  const [dismissedAlerts, setDismissedAlerts] = useState<{
    days: number;
    requests: number;
  }>({ days: 0, requests: 0 });

  const { data } = useQuery<SubscriptionResponse>({
    queryKey: ["subscription", "status"],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        const response = await fetch("/api/subscriptions/status", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 404) {
            return { subscription: null, manager: null };
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (err: any) {
        console.error('[SubscriptionAlerts] Error:', err);
        throw err;
      }
    },
  });

  // Load dismissed alerts from localStorage on component mount
  useEffect(() => {
    const stored = localStorage.getItem('dismissedSubscriptionAlerts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        
        // Check if 24 hours have passed for each alert
        const newDismissed = {
          days: (parsed.days && (now - parsed.days < 24 * 60 * 60 * 1000)) ? parsed.days : 0,
          requests: (parsed.requests && (now - parsed.requests < 24 * 60 * 60 * 1000)) ? parsed.requests : 0,
        };
        
        setDismissedAlerts(newDismissed);
        
        // Update localStorage with cleaned data
        if (newDismissed.days === 0 && newDismissed.requests === 0) {
          localStorage.removeItem('dismissedSubscriptionAlerts');
        } else {
          localStorage.setItem('dismissedSubscriptionAlerts', JSON.stringify(newDismissed));
        }
      } catch (e) {
        // Invalid JSON, remove it
        localStorage.removeItem('dismissedSubscriptionAlerts');
      }
    }
  }, []);

  const dismissAlert = (type: 'days' | 'requests') => {
    const now = Date.now();
    const newDismissed = {
      ...dismissedAlerts,
      [type]: now
    };
    
    setDismissedAlerts(newDismissed);
    localStorage.setItem('dismissedSubscriptionAlerts', JSON.stringify(newDismissed));
  };

  const subscription = data?.subscription;
  
  // Don't show alerts if no subscription data
  if (!subscription) {
    return null;
  }

  const showDaysAlert = subscription.daysRemaining <= 7 && dismissedAlerts.days === 0;
  const showRequestsAlert = subscription.requestsRest <= 2 && dismissedAlerts.requests === 0;

  // Don't show alerts if none are needed
  if (!showDaysAlert && !showRequestsAlert) {
    return null;
  }

  return (
    <div className="bg-white border-b border-red-200">
      <div className="container mx-auto px-6 py-2 space-y-2">
        {showDaysAlert && (
          <div className="flex items-center justify-between bg-white border border-red-200 rounded-md px-4 py-2 text-red-700">
            <span className="text-sm font-normal">
              {subscription.daysRemaining <= 0 
                ? "Срок вашей подписки закончился, необходимо продление"
                : `До окончания подписки осталось ${subscription.daysRemaining} дней.`
              }
            </span>
            <button
              onClick={() => dismissAlert('days')}
              className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0 font-normal"
              aria-label="Закрыть уведомление"
            >
              <X className="h-4 w-4 font-normal stroke-1" />
            </button>
          </div>
        )}
        
        {showRequestsAlert && (
          <div className="flex items-center justify-between bg-white border border-red-200 rounded-md px-4 py-2 text-red-700">
            <span className="text-sm font-normal">
              Осталось запросов: {subscription.requestsRest}
            </span>
            <button
              onClick={() => dismissAlert('requests')}
              className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0 font-normal"
              aria-label="Закрыть уведомление"
            >
              <X className="h-4 w-4 font-normal stroke-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}