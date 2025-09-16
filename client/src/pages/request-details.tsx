import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link, useRoute } from 'wouter';

// Импортируем все необходимые компоненты и типы
import { type SearchRequest, type SupplierResponse, type EmailCheckResponse, type RequestDetailsData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ResponsePanel } from "@/components/response-panel";
import { Separator } from "@/components/ui/separator";
import SupplierMessages from "@/components/supplier-messages";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ParameterExtractionStatus } from "@/components/parameter-extraction-status";
import { useRequestParameters } from "@/hooks/use-request-parameters";
import { AnalysisResultsTab } from './AnalysisResultsTab'; // Предполагается, что этот компонент вынесен
import { RefreshCw } from "lucide-react";

// Основной компонент страницы
export default function RequestDetails() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/requests/:id");
  const id = params?.id ? parseInt(params.id) : 0;

  const [tab, setTab] = useState("overview");
  const [selectedResponses, setSelectedResponses] = useState<number[]>([]);
  const [activeResponse, setActiveResponse] = useState<SupplierResponse | null>(null);

  // Основной запрос для получения всех данных страницы
  const { data, isLoading, error } = useQuery<RequestDetailsData>({
    queryKey: ['/api/search-requests', 'single', id], // ✅ ИСПРАВЛЕНО: уникальный ключ
    queryFn: () => apiRequest(`/api/search-requests/${id}`, 'GET'),
    enabled: !!id,
  });

  // Мутация для проверки новых email
  const checkEmailsMutation = useMutation<EmailCheckResponse, Error, number>({
    mutationFn: (requestId: number) => apiRequest('/api/check-emails', 'POST', { requestId }),
    onSuccess: (response) => {
      if (response.newResponses > 0) {
        toast({
          title: "Найдены новые ответы",
          description: `Получено ${response.newResponses} новых ответа. Список будет обновлен.`,
        });
        // Инвалидируем основной запрос, чтобы React Query автоматически его обновил
        queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'single', id] });
      }
      // Если новых ответов нет, можно не показывать уведомление, чтобы не мешать пользователю
    },
    onError: (error) => {
      toast({
        title: "Ошибка проверки почты",
        description: error.message || "Не удалось выполнить проверку.",
        variant: "destructive",
      });
    }
  });

  // --- НОВАЯ ЛОГИКА АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ ---
  useEffect(() => {
    if (!id) return; // Не запускаем, если нет ID

    // Функция для вызова мутации, если она не занята
    const check = () => {
      if (!checkEmailsMutation.isPending) {
        checkEmailsMutation.mutate(id);
      }
    };

    // Запускаем проверку один раз при загрузке страницы
    check();

    // Устанавливаем интервал для последующих проверок каждые 20 секунд
    const intervalId = setInterval(check, 20000);

    // Очищаем интервал, когда пользователь уходит со страницы
    return () => clearInterval(intervalId);

  }, [id]); // Зависимость только от ID запроса

  // Мутация для отметки ответов как прочитанных
  const markAsReadMutation = useMutation({
    mutationFn: async (responseId: number) => apiRequest(`/api/supplier-responses/${responseId}/read`, 'PATCH'),
    onSuccess: (_, responseId) => {
        queryClient.setQueryData<RequestDetailsData>(['/api/search-requests', id], (oldData) => {
            if (!oldData) return oldData;
            return {
                ...oldData,
                supplierResponses: oldData.supplierResponses.map(r => r.id === responseId ? { ...r, isRead: true } : r)
            };
        });
    },
  });

  if (isLoading) {
    return <div className="text-center p-10">Загрузка...</div>;
  }

  if (error || !data) {
    return <div className="text-center p-10 text-red-500">Ошибка загрузки деталей запроса.</div>;
  }
  
  const { request, requestSuppliers = [], supplierResponses = [] } = data;
  const unreadResponsesCount = supplierResponses.filter(r => !r.isRead).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="outline" asChild className="mr-4">
            <Link href="/dashboard">Назад</Link>
          </Button>
          <h1 className="text-3xl font-bold">{request?.productName || 'Запрос'}</h1>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Общее</TabsTrigger>
            <TabsTrigger value="responses" className="relative">
              Ответы поставщиков ({supplierResponses.length})
              {unreadResponsesCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0">
                  {unreadResponsesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suppliers">Лист поставщиков ({requestSuppliers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {/* Содержимое вкладки "Общее" */}
          </TabsContent>

          <TabsContent value="responses" className="mt-6">
            <ResponsePanel
              supplierResponses={supplierResponses}
              selectedResponses={selectedResponses}
              setSelectedResponses={setSelectedResponses}
              markAsReadMutation={markAsReadMutation}
              requestId={request?.id}
              onActiveResponseChange={(responseId, response) => setActiveResponse(response)}
              onCompare={() => { /* Логика сравнения */ }}
            />
          </TabsContent>
          
          <TabsContent value="suppliers" className="mt-6">
            {/* Содержимое вкладки "Лист поставщиков" */}
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <Button 
            variant="outline" 
            size="icon" 
            className="w-10 h-10"
            onClick={() => checkEmailsMutation.mutate(id)}
            disabled={checkEmailsMutation.isPending}
            title="Проверить новые предложения"
          >
            <RefreshCw 
              size={16} 
              className={checkEmailsMutation.isPending ? 'animate-spin' : ''} 
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

