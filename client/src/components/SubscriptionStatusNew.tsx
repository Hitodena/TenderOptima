import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";

interface SubscriptionStatusProps {
  className?: string;
}

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

interface ManagerData {
  id: number;
  name: string;
  email: string;
  position?: string;
  phone?: string;
}

interface SubscriptionResponse {
  subscription: SubscriptionData | null;
  manager: ManagerData | null;
}

// Helper function to format dates
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export function SubscriptionStatusNew({ className }: SubscriptionStatusProps) {
  const { data, isLoading, error } = useQuery<SubscriptionResponse>({
    queryKey: ["subscription", "status"],
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache data
    refetchOnMount: true, // Always refetch on component mount
    refetchOnWindowFocus: true, // Refetch when user returns to window
    queryFn: async () => {
      console.log('[SubscriptionStatusNew] Starting API request...');
      
      try {
        const response = await fetch("/api/subscriptions/status", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          credentials: "include",
        });

        console.log('[SubscriptionStatusNew] Response status:', response.status);
        console.log('[SubscriptionStatusNew] Response ok:', response.ok);
        console.log('[SubscriptionStatusNew] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          if (response.status === 404) {
            console.log('[SubscriptionStatusNew] Subscription not found (404)');
            return { subscription: null, manager: null };
          }
          if (response.status === 401) {
            console.log('[SubscriptionStatusNew] Authentication required (401)');
            return { subscription: null, manager: null };
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[SubscriptionStatusNew] Parsed JSON response:', result);
        
        return result;
      } catch (err: any) {
        console.error('[SubscriptionStatusNew] Error:', err);
        throw err;
      }
    },
  });

  console.log('[SubscriptionStatusNew] Query state:', { data, isLoading, error });

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Статус подписки</CardTitle>
          <CardDescription>Загрузка...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Error state
  if (error) {
    console.log('[SubscriptionStatusNew] Error state:', error);
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Статус подписки</CardTitle>
          <CardDescription>Ошибка загрузки данных подписки</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Произошла ошибка при загрузке данных подписки</p>
        </CardContent>
      </Card>
    );
  }

  // No subscription found
  if (!data?.subscription) {
    console.log('[SubscriptionStatusNew] No subscription data found:', data);
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Статус подписки</CardTitle>
          <CardDescription>Подписка не найдена</CardDescription>
        </CardHeader>
        <CardContent>
          <p>У вас нет активной подписки</p>
        </CardContent>
      </Card>
    );
  }

  const { subscription, manager } = data;
  
  console.log('[SubscriptionStatusNew] Rendering subscription:', subscription);
  
  // Determine status text and styling
  const statusText = subscription.status === "active" 
    ? "Активна" 
    : subscription.isExpired
      ? "Истекла"
      : "Неактивна";
  
  const statusClass = subscription.status === "active" 
    ? "text-green-600 bg-green-100 px-2 py-1 rounded text-sm" 
    : "text-red-600 bg-red-100 px-2 py-1 rounded text-sm";

  const planName = subscription.plan === "trial" ? "Пробная" : 
                   subscription.plan === "basic" ? "Базовая" : 
                   subscription.plan === "premium" ? "Премиум" : subscription.plan;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Статус подписки</CardTitle>
        <CardDescription>
          Управление подпиской
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Статус:</p>
          <span className={statusClass}>{statusText}</span>
        </div>

        {/* Plan details */}
        <div>
          <h3 className="text-lg font-semibold mb-2">
            План: {planName}
          </h3>
          <p className="text-sm text-gray-600">
            {subscription.requestsRest === 0 ? 
              "В текущем тарифе у вас закончился лимит запросов" : 
              `Запросов осталось: ${subscription.requestsRest || (subscription.maxRequests - subscription.requestsUsed)}`
            }
          </p>
        </div>

        {/* Dates */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-1">Период действия</h4>
          <p className="text-sm">
            {formatDate(subscription.startDate)} — {formatDate(subscription.endDate)}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {subscription.daysRemaining <= 0 
              ? "Срок подписки закончился"
              : `Осталось дней: ${subscription.daysRemaining}`
            }
          </p>
        </div>

        {/* Warnings for expired or ending soon */}
        {subscription.isExpired && (
          <Alert variant="destructive">
            <AlertTitle>Подписка истекла</AlertTitle>
            <AlertDescription>
              Ваша подписка истекла. Обратитесь к менеджеру для продления.
            </AlertDescription>
          </Alert>
        )}
        
        {subscription.isEndingSoon && !subscription.isExpired && (
          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTitle>Подписка заканчивается</AlertTitle>
            <AlertDescription>
              Ваша подписка заканчивается через {subscription.daysRemaining} дней. Рекомендуем продлить заранее.
            </AlertDescription>
          </Alert>
        )}

        {/* Manager information if available */}
        {manager && (
          <div className="pt-3 border-t mt-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">
              Свяжитесь с Вашим менеджером
            </h4>
            <div className="space-y-1">
              <div className="text-sm">
                <p>Email: support@tenderoptima.by</p>
                <p className="sr-only">Тел: +375 29 1111111</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SubscriptionStatusNew;