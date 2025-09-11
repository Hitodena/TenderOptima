import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft, Mail, Phone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function RequestLimitExceededPage() {
  const [, setLocation] = useLocation();

  // Load subscription data to show current usage
  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await apiRequest<{
        subscription: {
          requestsUsed: number;
          requestsRest: number;
          maxRequests: number;
          plan: string;
        };
        manager: {
          name: string;
          email: string;
          phone?: string;
        };
      }>('/api/subscriptions/status');
      return response;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white border border-gray-200">
            <CardHeader className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-gray-800">
                Лимит запросов исчерпан
              </CardTitle>
            </CardHeader>
            
            <CardContent className="px-8 pb-8">
              <div className="text-center mb-6">
                <p className="text-gray-600 mb-4">
                  В текущем тарифном плане "{subscriptionData?.subscription?.plan || 'trial'}" закончился лимит 
                  запросов. Страница "Отправить запрос" временно недоступна.
                </p>
                
                {subscriptionData?.subscription && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-700">
                      <strong>Запросов использовано:</strong> {subscriptionData.subscription.requestsUsed} из {subscriptionData.subscription.maxRequests}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-blue-900 mb-3">
                  Что вы можете делать:
                </h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li>• Просматривать существующие запросы на странице "Запросы"</li>
                  <li>• Работать с контактами на странице "Контакты"</li>
                  <li>• Обратиться к тарифному плану для получения дополнительных запросов</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Перейти к запросам
                </h3>
                <Button 
                  onClick={() => setLocation('/send-request')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Перейти к запросам
                </Button>
              </div>

              {subscriptionData?.manager && (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <h3 className="font-semibold text-gray-800 mb-3">
                    Ваш менеджер
                  </h3>
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">{subscriptionData.manager.name}</p>
                    <div className="flex justify-center items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        <span>{subscriptionData.manager.email}</span>
                      </div>
                      {subscriptionData.manager.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          <span>{subscriptionData.manager.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}