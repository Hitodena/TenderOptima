import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Mail, Phone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function SubscriptionExpiredPage() {
  const [, setLocation] = useLocation();

  // Load subscription data to show expiry information
  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await apiRequest<{
        subscription: {
          plan: string;
          endDate: string;
          isExpired: boolean;
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
      {/* Only show top header, no navigation menu */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold text-gray-800">
              TenderOptima
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Настройки</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white border border-gray-200">
            <CardHeader className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
              <CardTitle className="text-2xl text-gray-800">
                Подписка истекла
              </CardTitle>
            </CardHeader>
            
            <CardContent className="px-8 pb-8">
              <div className="text-center mb-6">
                <p className="text-gray-600 mb-4">
                  Срок действия подписки "{subscriptionData?.subscription?.plan || 'trial'}" истёк. 
                  Страница "Отправить запрос" временно недоступна.
                </p>
                
                {subscriptionData?.subscription && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-700">
                      <strong>Дата окончания:</strong> {new Date(subscriptionData.subscription.endDate).toLocaleDateString('ru-RU')}
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
                  <li>• Обратиться к менеджеру для продления подписки</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Обратиться тарифный план
                </h3>
                <Button 
                  onClick={() => setLocation('/send-request')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Обратиться тарифный план
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