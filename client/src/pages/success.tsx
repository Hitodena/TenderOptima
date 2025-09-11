import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { type SearchRequest, type RequestSupplier } from "@shared/schema";

interface RequestData {
  request: SearchRequest;
  requestSuppliers: RequestSupplier[];
}

export default function SuccessPage() {
  const [, params] = useRoute<{ orderNumber: string }>("/success/:orderNumber");
  const orderNumber = params?.orderNumber || '';
  
  // Fetch request details - for temporary requests (direct emails), this will fail with 404
  // but we still want to show the success page
  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/search-requests/order/${orderNumber}`],
    enabled: !!orderNumber,
    retry: 2,
    retryDelay: 1000,
    staleTime: 60000 // Cache for a minute
  }) as { data: RequestData | undefined, isLoading: boolean, isError: boolean };
  
  // Determine if this is a temporary request
  // orderNumber "0" indicates a temporary/direct request from the client
  const isTemporaryRequest = orderNumber === "0" || (!isLoading && isError);
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            Запрос успешно отправлен!
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            {isTemporaryRequest 
              ? "Ваш прямой запрос отправлен поставщикам" 
              : `Ваш запрос #${orderNumber} отправлен поставщикам`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Загрузка деталей запроса...</p>
          ) : isTemporaryRequest ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Прямой запрос отправлен</h3>
                <p className="text-sm text-blue-700">
                  Ваш прямой запрос был успешно отправлен выбранным поставщикам.
                  Они получат ваш запрос в ближайшее время и ответят вам напрямую.
                </p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium text-amber-800 mb-2">Что происходит дальше?</h3>
                <ul className="space-y-2 text-sm text-amber-700">
                  <li>• Поставщики получат ваш запрос и рассмотрят ваши требования</li>
                  <li>• Они свяжутся с вами напрямую по указанному вами email</li>
                  <li>• Вы можете отправить еще запросы другим поставщикам</li>
                </ul>
              </div>
            </div>
          ) : data && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-2">Сводка запроса</h3>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Название:</span> {data.request.productName}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">Поставщиков получило запрос:</span> {data.requestSuppliers.length}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Что происходит дальше?</h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li>• Поставщики получат ваш запрос и рассмотрят ваши требования</li>
                  <li>• Когда они ответят, вы получите уведомление и сможете просмотреть их ответы</li>
                  <li>• Вся коммуникация будет отслеживаться в вашей панели управления запросами</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {!isTemporaryRequest && data ? (
              <Button className="flex-1" asChild>
                <Link href={`/requests/${data.request.id}`}>
                  Просмотр деталей запроса
                </Link>
              </Button>
            ) : (
              <Button className="flex-1" asChild>
                <Link href="/dashboard">
                  Просмотр всех запросов
                </Link>
              </Button>
            )}
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/dashboard">
                Перейти в панель управления
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}