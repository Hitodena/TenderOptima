import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { MainNavigation } from "@/components/main-navigation";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { SubscriptionAlerts } from "@/components/subscription-alerts";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { type SearchRequest, type SupplierResponse } from "@shared/schema";
import { Check, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

export default function Dashboard() {
  const [showActiveRequests, setShowActiveRequests] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const { isActiveOrLoading } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();

  // 1. Запрос списка всех запросов - User-specific caching for security
  const { data: searchRequests, isLoading, error, isFetching } = useQuery<SearchRequest[]>({
    queryKey: ['/api/search-requests', 'dashboard', user?.id], // ✅ ИСПРАВЛЕНО: уникальный ключ для dashboard
    enabled: !!user?.id && isActiveOrLoading,
    refetchOnMount: true,
    queryFn: async () => {
      console.log('🚀 DASHBOARD: Loading all search requests...');
      const result = await apiRequest<SearchRequest[]>('/api/search-requests', 'GET');
      console.log('🚀 DASHBOARD: Loaded', result?.length || 0, 'requests');
      return result;
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

  // Dashboard показывает только список запросов - ответы загружаются только при клике на конкретный запрос

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
        queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'dashboard', user?.id] });
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
        queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'dashboard', user?.id] });
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

  // Filter requests based on the toggle state and search query
  const allFilteredRequests = searchRequests?.filter(request => {
    // Only show requests that have been sent to suppliers
    if (request.status === 'pending') {
      return false;
    }

    // Filter by toggle state
    let matchesToggle = false;
    if (showActiveRequests) {
      matchesToggle = request.status !== "completed";
    } else {
      matchesToggle = request.status === "completed";
    }

    // Filter by search query
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      matchesSearch = 
        request.productName?.toLowerCase().includes(query) ||
        request.orderNumber?.toLowerCase().includes(query) ||
        request.id.toString().includes(query);
    }

    return matchesToggle && matchesSearch;
  }) || [];

  // Pagination logic
  const ITEMS_PER_PAGE = 30;
  const totalPages = Math.ceil(allFilteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const filteredRequests = allFilteredRequests.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [showActiveRequests, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <SubscriptionAlerts />
      <SubscriptionGuard isActive={isActiveOrLoading}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            {/* Removed Request Dashboard title */}
          </div>

          {/* Content with header inside card */}
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader className="pb-4">
                {/* Header with toggle and search in one line */}
                <div className="flex items-center justify-between max-w-full">
                  {/* Left side - Title */}
                  <div className="flex items-center flex-shrink-0">
                    <h2 className="text-lg font-medium text-gray-900">
                      {showActiveRequests ? 'Активные запросы' : 'Завершенные запросы'}
                    </h2>
                  </div>

                  {/* Right side - Search and Toggle */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Search bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Поиск..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-48 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Toggle switch */}
                    <ToggleSwitch
                      checked={showActiveRequests}
                      onCheckedChange={setShowActiveRequests}
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {isLoading ? (
                  <div className="text-center py-8">Загрузка запросов...</div>
                ) : error ? (
                  <div className="text-center py-8 text-red-500">
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <p className="text-red-500 mb-2">Ошибка загрузки запросов</p>
                      <p className="text-sm text-muted-foreground">Пожалуйста, обновите страницу или попробуйте позже</p>
                    </div>
                  </div>
                ) : filteredRequests && filteredRequests.length > 0 ? (
                  <div>
                    <div className="grid gap-4">
                      {filteredRequests.map((request) => (
                        <RequestCard 
                          key={request.id} 
                          request={request} 
                          tab={showActiveRequests ? "active" : "completed"}
                          onComplete={completeRequest}
                          onActivate={activateRequest}
                        />
                      ))}
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 px-4">
                        <div className="text-sm text-gray-500">
                          Показано {startIndex + 1}-{Math.min(endIndex, allFilteredRequests.length)} из {allFilteredRequests.length} запросов
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Предыдущая
                          </Button>
                          
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1"
                          >
                            Следующая
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      {searchQuery.trim() ? 'Запросы не найдены' : `Нет ${showActiveRequests ? 'активных' : 'завершенных'} запросов`}
                    </p>
                    {searchQuery.trim() && (
                      <p className="text-sm text-muted-foreground">
                        Попробуйте изменить поисковый запрос
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SubscriptionGuard>
    </div>
  );
}

interface RequestCardProps {
  request: SearchRequest;
  tab: string;
  onComplete: (requestId: number) => void;
  onActivate: (requestId: number) => void;
}

function RequestCard({ request, tab, onComplete, onActivate }: RequestCardProps) {
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

  // Загружаем данные о количестве ответов для каждого запроса
  const { data: responsesData } = useQuery<SupplierResponse[]>({
    queryKey: ['/api/supplier-responses', request.id],
    enabled: !!request.id,
    queryFn: async () => {
      try {
        const response = await apiRequest<SupplierResponse[]>(`/api/supplier-responses?requestId=${request.id}`, 'GET');
        return response || [];
      } catch (error) {
        console.error('Error loading responses for request', request.id, error);
        return [];
      }
    },
    staleTime: 30000, // 30 seconds
  });

  const responseCount = responsesData?.length || 0;
  const newResponseCount = responsesData?.filter(r => !r.isRead).length || 0;

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

  const handleRowClick = (e: React.MouseEvent) => {
    // Предотвращаем клик, если кликнули на кнопку
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    
    // Находим кнопку "Смотреть" и кликаем по ней
    const viewButton = e.currentTarget.querySelector('a[href*="/requests/"]') as HTMLAnchorElement;
    if (viewButton) {
      viewButton.click();
    }
  };

  return (
    <div 
      className="overflow-hidden mb-1 hover:shadow-sm transition-all duration-200 cursor-pointer hover:bg-gray-50 rounded-md"
      onClick={handleRowClick}
    >
      <div className="flex items-center justify-between p-3 h-14 relative">
        <div className="flex flex-col gap-1 flex-1">
          <div className="font-medium">
            {request.productName}
          </div>
          <div className="text-xs text-gray-400 relative">
            {/* Тонкая линия между названием и датой */}
            <div className="absolute -top-1 left-0 right-0 h-px bg-gray-200"></div>
            <div className="relative z-10 bg-white pr-2 inline-block">
              Дата создания: {formattedCreationDate} Запрос № {request.orderNumber}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Кружок с количеством входящих email */}
          {responseCount > 0 && (
            <div className="relative">
              <div className="flex items-center justify-center w-8 h-8 border border-gray-300 rounded-full bg-white">
                <span className="text-sm font-semibold text-gray-700">
                  {responseCount}
                </span>
              </div>
              {/* Красная циферка для новых email */}
              {newResponseCount > 0 && (
                <div className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-white">
                  {newResponseCount}
                </div>
              )}
            </div>
          )}
          
          <Button
            asChild
            size="sm"
            variant="outline"
            className="bg-white text-primary border-primary hover:bg-white hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <Link href={`/requests/${request.id}?tab=responses`}>Смотреть</Link>
          </Button>
          
          {/* Context-specific status buttons */}
          {tab === "active" && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onComplete(request.id);
              }}
              variant="outline"
              size="sm"
              className="text-gray-500 hover:text-gray-600 border-gray-300 hover:border-gray-400"
            >
              Завершить
            </Button>
          )}
          
          {tab === "completed" && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onActivate(request.id);
              }}
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