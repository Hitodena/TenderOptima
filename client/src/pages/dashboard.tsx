import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { MainNavigation } from "@/components/main-navigation";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { SubscriptionAlerts } from "@/components/subscription-alerts";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type SearchRequest, type SupplierResponse } from "@shared/schema";
import { Check } from "lucide-react";

export default function Dashboard() {
  const [tab, setTab] = useState<string>("active");
  const { isActiveOrLoading } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();

  // 1. Запрос списка всех запросов - User-specific caching for security
  const { data: searchRequests, isLoading, error, isFetching } = useQuery<SearchRequest[]>({
    queryKey: ['/api/search-requests', user?.id],
    enabled: !!user?.id && isActiveOrLoading,
    refetchOnMount: true,
    queryFn: async () => {
      return apiRequest<SearchRequest[]>('/api/search-requests', 'GET');
    },
    select: (data) => {
      if (!data || !Array.isArray(data)) return [];
      
      // SECURITY: Filter by current user ID to prevent cross-user data leakage
      const filteredData = data.filter(request => {
        if (user?.id && request.userId && request.userId !== user.id) {
          console.warn(`[SECURITY] Blocked cross-user data: Request ${request.id} belongs to user ${request.userId}, current user is ${user.id}`);
          return false;
        }
        return true;
      });
      
      return [...filteredData].sort((a, b) => b.id - a.id);
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: 10000, // 10 seconds - reasonable caching
    gcTime: 60000     // 1 minute - allow some caching
  });

  const activeRequestIds = searchRequests?.filter(req => req.status !== 'pending')
    .map(req => req.id) || [];

  // Use batch endpoint instead of individual calls - Balanced caching
  const { data: batchResponsesData } = useQuery<Record<string, SupplierResponse[]>>({
    queryKey: ['/api/supplier-responses-batch', activeRequestIds],
    enabled: activeRequestIds.length > 0,
    staleTime: 15000,  // 15 seconds - reasonable caching
    refetchOnWindowFocus: false,
    refetchInterval: false,
    gcTime: 60000,     // 1 minute - allow some caching
    queryFn: async () => {
      console.log("Batch loading responses for", activeRequestIds.length, "requests");
      // Используем apiRequest, который добавит токен для авторизации
      // Поскольку сервер ожидает GET-запрос с параметрами в URL, преобразуем параметры соответствующим образом
      return await apiRequest<Record<string, SupplierResponse[]>>('/api/supplier-responses-batch', 'GET', {
        requestIds: JSON.stringify(activeRequestIds)
      });
    }
  });

  // 4. Предзагружаем данные о ответах поставщиков в кэш QueryClient
  // Removed automatic responses prefetching effect

  // Status management functions
  const completeRequest = async (requestId: number) => {
    try {
      const response = await fetch(`/api/search-requests/${requestId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed' })
      });

      if (response.ok) {
        // Invalidate and refetch the search requests query
        queryClient.invalidateQueries({ queryKey: ['/api/search-requests', user?.id] });
        toast({
          title: "Запрос завершен",
          description: "Запрос перенесен в раздел \"Завершенные запросы\""
        });
      } else {
        throw new Error('Failed to complete request');
      }
    } catch (error) {
      console.error('Error completing request:', error);
      toast({
        title: "Ошибка завершения",
        description: "Не удалось завершить запрос",
        variant: "destructive"
      });
    }
  };

  const activateRequest = async (requestId: number) => {
    try {
      const response = await fetch(`/api/search-requests/${requestId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'sent' })
      });

      if (response.ok) {
        // Invalidate and refetch the search requests query
        queryClient.invalidateQueries({ queryKey: ['/api/search-requests', user?.id] });
        toast({
          title: "Запрос активирован",
          description: "Запрос перенесен в раздел \"Активные запросы\""
        });
      } else {
        throw new Error('Failed to activate request');
      }
    } catch (error) {
      console.error('Error activating request:', error);
      toast({
        title: "Ошибка активации",
        description: "Не удалось активировать запрос",
        variant: "destructive"
      });
    }
  };

  // Filter requests based on the active tab (simplified to just active or completed)
  const filteredRequests = searchRequests?.filter(request => {
    // Only show requests that have been sent to suppliers
    if (request.status === 'pending') {
      return false;
    }

    if (tab === "active") {
      return request.status !== "completed";
    } else if (tab === "completed") {
      return request.status === "completed";
    } else {
      return true;
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <SubscriptionAlerts />
      <SubscriptionGuard isActive={isActiveOrLoading}>
        <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          {/* Removed Request Dashboard title */}
        </div>

        <Tabs defaultValue="active" value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="active">Активные запросы</TabsTrigger>
            <TabsTrigger value="completed">Завершенные запросы</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            {isLoading ? (
              <div className="text-center py-8">Загрузка запросов...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-500"><div className="flex flex-col items-center justify-center p-8 text-center">
  <p className="text-red-500 mb-2">Ошибка загрузки запросов</p>
  <p className="text-sm text-muted-foreground">Пожалуйста, обновите страницу или попробуйте позже</p>
</div></div>
            ) : filteredRequests && filteredRequests.length > 0 ? (
              <div className="grid gap-4">
                {filteredRequests.map((request) => (
                  <RequestCard 
                    key={request.id} 
                    request={request} 
                    batchResponsesData={batchResponsesData || {}} 
                    tab={tab}
                    onComplete={completeRequest}
                    onActivate={activateRequest}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No {tab} requests found</p>
                
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </SubscriptionGuard>
    </div>
  );
}

interface RequestCardProps {
  request: SearchRequest;
  batchResponsesData: Record<string, SupplierResponse[]>;
  tab: string;
  onComplete: (requestId: number) => void;
  onActivate: (requestId: number) => void;
}

function RequestCard({ request, batchResponsesData, tab, onComplete, onActivate }: RequestCardProps) {
  // Format the created date
  const formattedDate = request.createdAt 
    ? formatDistanceToNow(new Date(request.createdAt), { addSuffix: true }) 
    : "Unknown date";

  // Get formatted creation date in the format "MM/DD/YYYY"
  const formattedCreationDate = request.createdAt
    ? new Date(request.createdAt).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      })
    : "Unknown date";

  // Получаем ответы из кэша, которые были предзагружены в основном компоненте
  // Это предотвращает дополнительные запросы к API
  const responses = batchResponsesData?.[request.id] || [];
  const responseCount = responses.length;

  // Get status badge color - simplified to just active or completed
  const getStatusColor = (status: string) => {
    if (status === "completed") {
      return "bg-green-100 text-green-800 border-green-300";
    } else {
      // All non-completed statuses are considered "active"
      return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  // Simplify status display to just "active" or "completed"
  const displayStatus = request.status === "completed" ? "completed" : "active";

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden mb-1 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between p-3 h-14">
        <div className="flex flex-col gap-1">
          <div className="font-medium ">
            {request.productName}
          </div>
          <div className="text-xs text-gray-400">
            Дата создания: {formattedCreationDate} Запрос № {request.orderNumber}
          </div>


        </div>

        <div className="flex items-center gap-3">
          {responseCount > 0 && (
            <div className="flex items-center">

            </div>
          )}

          <Button asChild size="sm">
            <Link href={`/requests/${request.id}?tab=responses`}>Смотреть</Link>
          </Button>
          
          {/* Context-specific status buttons */}
          {tab === "active" && (
            <Button
              onClick={() => onComplete(request.id)}
              variant="outline"
              size="sm"
              className="text-gray-500 hover:text-gray-600 border-gray-300 hover:border-gray-400"
            >
              <Check className="w-4 h-4 mr-1" />
              Завершить
            </Button>
          )}
          
          {tab === "completed" && (
            <Button
              onClick={() => onActivate(request.id)}
              variant="outline"
              size="sm"
              className="text-gray-500 hover:text-gray-600 border-gray-300 hover:border-gray-400"
            >
              Сделать активным
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}