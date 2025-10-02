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
import { ArrowLeftIcon, ExternalLinkIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, ClockIcon, MailIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SentRequest {
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  supplierWebsite: string | null;
  supplierPhone: string | null;
  sentAt: string;
  hasResponded: boolean;
  responseReceivedAt: string | null;
}

interface ClientRequestSentResponse {
  requestId: number;
  sentRequests: SentRequest[];
}

export default function ClientRequestSent() {
  const [, params] = useRoute("/admin/client-requests/:id/sent-requests");
  const requestId = params?.id ? parseInt(params.id) : null;

  const { data, isLoading, error, refetch } = useQuery<ClientRequestSentResponse>({
    queryKey: ['admin-client-request-sent', requestId],
    queryFn: async () => {
      if (!requestId) throw new Error('Request ID is required');
      const response = await apiRequest(`/api/admin/client-requests/${requestId}/sent-requests`);
      return response;
    },
    enabled: !!requestId,
    staleTime: 30000,
  });

  // Get request details for header
  const { data: requestDetails } = useQuery({
    queryKey: ['admin-client-request-details-sent', requestId],
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

  const getResponseStatusBadge = (hasResponded: boolean, responseReceivedAt: string | null) => {
    if (hasResponded && responseReceivedAt) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          ✅ Ответил
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-600">
        ⏳ Ожидает ответа
      </Badge>
    );
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
              <CardTitle>Список отправленных запросов</CardTitle>
              <CardDescription>
                Всего отправлено: {data?.sentRequests.length || 0}
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
                    <TableHead>Название поставщика</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Дата отправки</TableHead>
                    <TableHead>Статус ответа</TableHead>
                    <TableHead>Ответ получен</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.sentRequests || data.sentRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Отправленные запросы не найдены
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.sentRequests.map((sentRequest, index) => (
                      <TableRow key={`${sentRequest.supplierId}-${index}`}>
                        <TableCell>
                          <div className="font-medium">{sentRequest.supplierName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{sentRequest.supplierEmail}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(sentRequest.sentAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getResponseStatusBadge(sentRequest.hasResponded, sentRequest.responseReceivedAt)}
                        </TableCell>
                        <TableCell>
                          {sentRequest.responseReceivedAt ? (
                            <div className="text-sm">
                              {formatDate(sentRequest.responseReceivedAt)}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
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

      {/* Summary Statistics */}
      {data && data.sentRequests.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Статистика ответов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {data.sentRequests.length}
                </div>
                <div className="text-sm text-muted-foreground">Всего отправлено</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {data.sentRequests.filter(req => req.hasResponded).length}
                </div>
                <div className="text-sm text-muted-foreground">Получено ответов</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round((data.sentRequests.filter(req => req.hasResponded).length / data.sentRequests.length) * 100)}%
                </div>
                <div className="text-sm text-muted-foreground">Процент ответов</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
