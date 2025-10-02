import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeftIcon, ExternalLinkIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StagingSupplier {
  id: number;
  sourceEngine: string;
  searchQuery: string;
  region: string | null;
  rawTitle: string | null;
  rawDescription: string | null;
  rawUrl: string;
  rawEmails: string[] | null;
  rawPhones: string[] | null;
  status: string;
  createdAt: string;
}

interface ClientRequestResultsResponse {
  requestId: number;
  searchQuery: string;
  results: StagingSupplier[];
}

export default function ClientRequestResults() {
  const [, params] = useRoute("/admin/client-requests/:id/results");
  const requestId = params?.id ? parseInt(params.id) : null;

  const { data, isLoading, error, refetch } = useQuery<ClientRequestResultsResponse>({
    queryKey: ['admin-client-request-results', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');
      const response = await apiRequest(`/api/admin/client-requests/${requestId}/results`);
      return response;
    },
    enabled: !!requestId,
    staleTime: 30000,
  });

  // Get request details for header
  const { data: requestDetails } = useQuery({
    queryKey: ['admin-client-request-details', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');
      const response = await apiRequest(`/api/admin/client-requests`);
      const request = response.requests.find((req: any) => req.id === requestId);
      return request;
    },
    enabled: !!requestId,
    staleTime: 30000,
  });

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: ru });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircleIcon className="mr-1 h-3 w-3" />Одобрен</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircleIcon className="mr-1 h-3 w-3" />Отклонен</Badge>;
      case 'in_review':
        return <Badge variant="secondary"><ClockIcon className="mr-1 h-3 w-3" />На рассмотрении</Badge>;
      default:
        return <Badge variant="outline">Новый</Badge>;
    }
  };

  const getSourceEngineBadge = (engine: string) => {
    switch (engine) {
      case 'google':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Google</Badge>;
      case 'yandex':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Yandex</Badge>;
      default:
        return <Badge variant="outline">{engine}</Badge>;
    }
  };

  if (!requestId) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-red-600">Неверный ID запроса</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Назад к списку запросов
          </Button>
        </div>
        
        {/* Request Information Header */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Информация о запросе</CardTitle>
          </CardHeader>
          <CardContent>
            {requestDetails ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Клиент</Label>
                  <div className="text-lg font-semibold">{requestDetails.userName}</div>
                  <div className="text-sm text-muted-foreground">{requestDetails.userEmail}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Текст запроса</Label>
                  <div className="text-lg font-semibold">{requestDetails.query}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Дата создания</Label>
                  <div className="text-lg font-semibold">{formatDate(requestDetails.createdAt)}</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Spinner />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Найденные поставщики</CardTitle>
              <CardDescription>
                Всего результатов: {data?.results.length || 0}
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название компании</TableHead>
                    <TableHead>Сайт</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Статус модерации</TableHead>
                    <TableHead>Источник</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.results || data.results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Результаты не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          <div className="font-medium">
                            {result.rawTitle || 'Без названия'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-blue-600 hover:text-blue-800"
                            onClick={() => window.open(result.rawUrl, '_blank')}
                          >
                            Перейти
                            <ExternalLinkIcon className="ml-1 h-3 w-3" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          {result.rawEmails && result.rawEmails.length > 0 ? (
                            <div className="text-sm">
                              {result.rawEmails.join(', ')}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Не указан</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(result.status)}
                        </TableCell>
                        <TableCell>
                          {getSourceEngineBadge(result.sourceEngine)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(result.createdAt)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
