import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/language-context";
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
import { CalendarIcon, SearchIcon, FilterIcon, RefreshCwIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientRequest {
  id: number;
  userName: string;
  userEmail: string;
  query: string;
  createdAt: string;
  resultsCount: number;
  sentRequestsCount: number;
}

interface ClientRequestsResponse {
  requests: ClientRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ClientRequestsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);

  // Build query parameters
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (startDate) {
    // Format date as YYYY-MM-DD in local timezone
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    queryParams.append('startDate', `${year}-${month}-${day}`);
  }
  if (endDate) {
    // Format date as YYYY-MM-DD in local timezone
    const year = endDate.getFullYear();
    const month = String(endDate.getMonth() + 1).padStart(2, '0');
    const day = String(endDate.getDate()).padStart(2, '0');
    queryParams.append('endDate', `${year}-${month}-${day}`);
  }

  // Fetch client requests
  const { data, isLoading, error, refetch } = useQuery<ClientRequestsResponse>({
    queryKey: ['admin-client-requests', page, limit, startDate, endDate, searchTerm],
    queryFn: async () => {
      console.log('[Client] Request params:', queryParams.toString());
      const response = await apiRequest(`/api/admin/client-requests?${queryParams.toString()}`);
      console.log('[Client] Response:', response);
      return response;
    },
    staleTime: 30000, // 30 seconds
  });

  // Filter requests by search term (client-side filtering for now)
  const filteredRequests = data?.requests?.filter(request => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      request.userName.toLowerCase().includes(searchLower) ||
      request.userEmail.toLowerCase().includes(searchLower) ||
      request.query.toLowerCase().includes(searchLower)
    );
  }) || [];

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchTerm("");
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
        <h2 className="text-2xl font-bold mb-2">Запросы клиентов</h2>
        <p className="text-muted-foreground">
          Просмотр и анализ всех запросов клиентов с детализацией результатов и отправленных запросов
        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Поиск</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Поиск по клиенту или запросу..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

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
                      <TableHead>Клиент</TableHead>
                      <TableHead>Запрос</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead className="text-center">Результаты</TableHead>
                      <TableHead className="text-center">Отправлено запросов</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Запросы не найдены
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{request.userName}</div>
                              <div className="text-sm text-muted-foreground">{request.userEmail}</div>
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
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(request.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 font-medium text-blue-600 hover:text-blue-800"
                              onClick={() => {
                                // Navigate to results page
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
                                // Navigate to sent requests page
                                window.open(`/admin/client-requests/${request.id}/sent-requests`, '_blank');
                              }}
                            >
                              {request.sentRequestsCount}
                              <ExternalLinkIcon className="ml-1 h-3 w-3" />
                            </Button>
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
