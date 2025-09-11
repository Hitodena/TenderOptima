import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { apiRequest } from "@/lib/queryClient";

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

export function SubscriptionStatus({ className }: SubscriptionStatusProps) {
  const { data, isLoading, error } = useQuery<SubscriptionResponse>({
    queryKey: ["subscription", "status"],
    queryFn: async () => {
      try {
        console.log('[SubscriptionStatus] Fetching subscription data...');
        const result = await apiRequest("/api/subscriptions/status", "GET");
        console.log('[SubscriptionStatus] Response status:', result?.status || 'unknown');
        console.log('[SubscriptionStatus] Response ok:', result?.ok || 'unknown');
        console.log('[SubscriptionStatus] API Response received:', result);
        return result;
      } catch (err: any) {
        console.error('[SubscriptionStatus] Error fetching subscription status:', err);
        
        // If it's a 404 error, return empty data
        if (err.message && err.message.includes("404")) {
          return { subscription: null, manager: null };
        }
        
        throw err;
      }
    },
  });

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
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Статус подписки</CardTitle>
          <CardDescription>Ошибка загрузки данных подписки</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // No subscription found
  if (!data?.subscription) {
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
            Запросов осталось: {subscription.requestsRest || (subscription.maxRequests - subscription.requestsUsed)}
          </p>
        </div>

        {/* Dates */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-1">Период действия</h4>
          <p className="text-sm">
            {formatDate(subscription.startDate)} — {formatDate(subscription.endDate)}
          </p>
          {subscription.daysRemaining > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Осталось дней: {subscription.daysRemaining}
            </p>
          )}
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
              Ваш менеджер
            </h4>
            <div className="space-y-1">
              <p className="font-medium">{manager.name}</p>
              {manager.position && (
                <p className="text-sm text-gray-500">{manager.position}</p>
              )}
              <div className="text-sm">
                <p>Email: {manager.email}</p>
                {manager.phone && <p>Телефон: {manager.phone}</p>}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SubscriptionStatus;