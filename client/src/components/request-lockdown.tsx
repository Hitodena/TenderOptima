import { useQuery } from "@tanstack/react-query";
import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MainNavigation } from "@/components/main-navigation";
import { Lock, CreditCard } from "lucide-react";

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

interface RequestLockdownProps {
  children: ReactNode;
  pageName: string;
}

export function RequestLockdown({ children, pageName }: RequestLockdownProps) {
  const { data, isLoading } = useQuery<SubscriptionResponse>({
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
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error("Error fetching subscription status:", error);
        return { subscription: null, manager: null };
      }
    },
  });

  const subscription = data?.subscription;
  const manager = data?.manager;
  const isRequestsExhausted = subscription && subscription.requestsRest === 0;
  const isSubscriptionExpired = subscription && subscription.isExpired;

  if (isLoading) {
    return <div className="flex justify-center p-8">Загрузка...</div>;
  }

  if (isRequestsExhausted) {
    // If both subscription expired and requests exhausted, show "Подписка истекла"
    const showExpiredMessage = isSubscriptionExpired && isRequestsExhausted;
    
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="flex items-center justify-center p-4 mt-8">
          <Card className="max-w-md w-full border border-gray-200">
            <CardContent className="p-6 text-center space-y-4">
              <div className="flex justify-center mb-4">
                <div className={showExpiredMessage ? "bg-orange-100 p-3 rounded-full" : "bg-red-100 p-3 rounded-full"}>
                  <Lock className={showExpiredMessage ? "h-8 w-8 text-orange-600" : "h-8 w-8 text-red-600"} />
                </div>
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900">
                {showExpiredMessage ? "Подписка истекла" : "Лимит запросов исчерпан"}
              </h2>
              
              <p className="text-gray-600 text-sm">
                {showExpiredMessage 
                  ? "Для продолжения работы с платформой необходимо продлить подписку или связаться с нашей командой поддержки."
                  : `В текущем тарифном плане "${subscription.plan}" закончился лимит запросов. Страница "${pageName}" временно недоступна.`
                }
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg text-left">
                <p className="text-sm font-medium text-blue-800 mb-2">
                  Что вы можете делать:
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Просматривать существующие запросы на странице "Запросы"</li>
                  <li>• Работать с контактами на странице "Контакты"</li>
                  <li>• Обновить тарифный план для получения дополнительных запросов</li>
                </ul>
              </div>
              
              <div className="space-y-3 pt-4">
                <Button 
                  className={showExpiredMessage 
                    ? "w-full bg-orange-600 hover:bg-orange-700 text-white" 
                    : "w-full bg-blue-600 hover:bg-blue-700 text-white"
                  }
                  onClick={() => window.location.href = '/settings'}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {showExpiredMessage ? "Продлить подписку" : "Обновить тарифный план"}
                </Button>
                
                {!showExpiredMessage && (
                  <Button 
                    variant="outline" 
                    className="w-full border-gray-300"
                    onClick={() => window.location.href = '/dashboard'}
                  >
                    Перейти к запросам
                  </Button>
                )}
              </div>
              
              {manager && (
                <div className="bg-gray-50 p-3 rounded text-center mt-4">
                  <div className="text-xs text-gray-600 mb-2">Ваш менеджер</div>
                  <div className="text-sm font-medium text-gray-900">{manager.name}</div>
                  <div className="text-sm">
                    <p>Email: {manager.email}</p>
                    {manager.phone && <p>Телефон: {manager.phone}</p>}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-gray-500 pt-2">
                Запросов использовано: {subscription.requestsUsed} из {subscription.maxRequests}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}