import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, SearchIcon, FilterIcon, RefreshCwIcon, ExternalLinkIcon, ArrowLeftIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientRequest {
  id: number;
  userName: string;
  userEmail: string;
  query: string;
  createdAt: string;
  resultsCount: number;
  sentRequestsCount: number;
  responsesCount: number;
  hasWinner: boolean;
}

interface ClientRequestsResponse {
  userId: number;
  requests: ClientRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Client {
  userId: number;
  userName: string;
  userEmail: string;
  requestCount: number;
  lastRequestDate: string;
}

interface ClientDetailsPageProps {
  client: Client;
  onBack: () => void;
}

export default function ClientDetailsPage({ client, onBack }: ClientDetailsPageProps) {
  const { t } = useTranslation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);

  // Check authentication and admin role
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/auth" />;
  }

  if (user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  // Build query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (startDate) {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    queryParams.append('startDate', `${year}-${month}-${day}`);
  }
  if (endDate) {
    const year = endDate.getFullYear();
    const month = String(endDate.getMonth() + 1).padStart(2, '0');
    const day = String(endDate.getDate()).padStart(2, '0');
    queryParams.append('endDate', `${year}-${month}-${day}`);
  }

  // Fetch client requests
  const { data, isLoading, error, refetch } = useQuery<ClientRequestsResponse>({
    queryKey: ['admin-client-requests', client.userId, page, limit, startDate, endDate],
    queryFn: async () => {
      console.log('[Client] Request params:', queryParams.toString());
      const response = await apiRequest(`/api/admin/clients/${client.userId}/requests?${queryParams.toString()}`);
      console.log('[Client] Response:', response);
      return response;
    },
    staleTime: 30000, // 30 seconds
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: ru });
    } catch {
      return dateString;
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">Ошибка загрузки данных</p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCwIcon className="mr-2 h-4 w-4" />
                Попробовать снова
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Загрузка данных...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Назад к списку клиентов
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Запросы клиента</h2>
            <div className="text-muted-foreground">
              <div className="font-medium">{client.userName}</div>
              <div className="text-sm">{client.userEmail}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label>Дата от</Label>
              <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd.MM.yyyy") : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      setIsStartDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>Дата до</Label>
              <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd.MM.yyyy") : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      setIsEndDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Clear Filters */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full"
              >
                Очистить фильтры
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Список запросов</CardTitle>
              <CardDescription>
                Всего запросов: {data?.pagination?.total || 0}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCwIcon className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Обновить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Запрос</TableHead>
                      <TableHead className="text-center">Результаты</TableHead>
                      <TableHead className="text-center">Отправлено запросов</TableHead>
                      <TableHead className="text-center">Получено ответов</TableHead>
                      <TableHead className="text-center">Выбран победитель</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.requests?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Запросы не найдены
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.requests?.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(request.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div 
                              className="max-w-xs truncate cursor-help" 
                              title={`Полный запрос: ${request.query}`}
                            >
                              {request.query}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 font-medium text-blue-600 hover:text-blue-800"
                              onClick={() => {
                                window.open(`/admin/client-requests/${request.id}/results`, '_blank');
                              }}
                            >
                              {request.resultsCount}
                              <ExternalLinkIcon className="ml-1 h-3 w-3" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 font-medium text-blue-600 hover:text-blue-800"
                              onClick={() => {
                                window.open(`/admin/client-requests/${request.id}/sent-requests`, '_blank');
                              }}
                            >
                              {request.sentRequestsCount}
                              <ExternalLinkIcon className="ml-1 h-3 w-3" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">{request.responsesCount}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {request.hasWinner ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-600 mx-auto" />
                            ) : (
                              <XCircleIcon className="h-5 w-5 text-gray-400 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {data && data.pagination?.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Показано {((page - 1) * limit) + 1} - {Math.min(page * limit, data.pagination?.total || 0)} из {data.pagination?.total || 0}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                    >
                      Назад
                    </Button>
                    <span className="text-sm">
                      Страница {page} из {data.pagination?.totalPages || 0}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= (data.pagination?.totalPages || 0)}
                    >
                      Вперед
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
