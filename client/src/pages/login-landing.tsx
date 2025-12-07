import React from 'react';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, BarChart3, ArrowRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useSubscription } from '@/hooks/useSubscription';
import { RecentQueriesSidebar } from '@/components/recent-queries-sidebar';

export default function LoginLanding() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { subscription, isLoading } = useSubscription();

  const procurementSections = [
    {
      icon: Search,
      title: 'Выбор поставщика',
      description: 'Инструменты и возможности для быстрого поиска поставщиков и отправки запросов',
      href: '/quick-procurement',
      color: 'blue'
    },
    {
      icon: BarChart3,
      title: 'Технический анализ',
      description: 'Полный цикл тендерных процедур с техническим анализом и сравнением предложений',
      href: '/tender-procurement',
      color: 'slate'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-600',
          button: 'bg-slate-600 hover:bg-slate-700'
        };
      case 'slate':
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          button: 'bg-slate-600 hover:bg-slate-700'
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-600',
          button: 'bg-slate-600 hover:bg-slate-700'
        };
    }
  };

  const getSubscriptionStatusColor = (subscription: any) => {
    if (!subscription) return 'bg-gray-100 text-gray-600';
    if (subscription.isExpired) return 'bg-red-100 text-red-600';
    if (subscription.isEndingSoon) return 'bg-yellow-100 text-yellow-600';
    return 'bg-green-100 text-green-600';
  };

  const getSubscriptionStatusIcon = (subscription: any) => {
    if (!subscription) return AlertCircle;
    if (subscription.isExpired) return AlertCircle;
    if (subscription.isEndingSoon) return Clock;
    return CheckCircle;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="flex gap-12 container mx-auto px-4 max-w-8xl">
        {/* Main content area */}
        <div className="flex-1 max-w-5xl mx-auto ml-64">
          {/* Header */}
          <div className="text-center mb-8" data-onboarding-id="login-landing-hero">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Добро пожаловать в TenderOptima
            </h1>
            <p className="text-lg text-gray-600">
              Современная платформа для управления закупками и поиска поставщиков
            </p>
          </div>

          {/* Subscription Status Card */}
          {!isLoading && subscription && (
            <Card className="mb-8">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-normal">Управление подпиской</CardTitle>
                  </div>
                  <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSubscriptionStatusColor(subscription)}`}>
                    {React.createElement(getSubscriptionStatusIcon(subscription), { className: "w-4 h-4 mr-2" })}
                    {subscription.status === 'active' ? 'Активна' : 'Неактивна'}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {subscription.plan === 'trial' ? 'Пробная' : subscription.plan}
                    </div>
                    <div className="text-sm text-gray-600">План</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {subscription.requestsRest || 0}
                    </div>
                    <div className="text-sm text-gray-600">Запросов осталось</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {subscription.daysRemaining <= 0 ? "-" : (subscription.daysRemaining || 0)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {subscription.daysRemaining <= 0 ? "Срок подписки закончился" : "Осталось дней"}
                    </div>
                  </div>
                </div>
                {subscription.isEndingSoon && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-sm text-yellow-800">
                      Ваша подписка заканчивается через {subscription.daysRemaining} дней. Рекомендуем продлить заранее.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Main Procurement Sections */}
          <div className="grid md:grid-cols-2 gap-8 mb-8" data-onboarding-id="login-landing-primary-cta">
            {procurementSections.map((section, index) => {
              const Icon = section.icon;
              const colors = getColorClasses(section.color);
              
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow flex flex-col">
                  <CardHeader className="text-center pb-4">
                    <div className={`w-16 h-16 ${colors.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                      <Icon className={`w-8 h-8 ${colors.text}`} />
                    </div>
                    <CardTitle className="text-xl">{section.title}</CardTitle>
                    <CardDescription className="text-base">
                      {section.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex items-end">
                    <Button 
                      className={`w-full ${colors.button}`}
                      onClick={() => navigate(section.href)}
                    >
                      Перейти
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Start Guide */}
          <Card data-onboarding-id="login-landing-guide">
            <CardHeader>
              <CardTitle className="text-xl">Быстрый старт</CardTitle>
              <CardDescription>Основные этапы работы с платформой</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Выберите тип закупки</h4>
                    <p className="text-gray-600">Определите подходящий способ поиска поставщиков для вашего товара или услуги</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Создайте и отправьте запросы</h4>
                    <p className="text-gray-600">Сформулируйте запрос и отправьте его на коммерческие предложения выбранным поставщикам</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Сравните предложения и выберите лучшее</h4>
                    <p className="text-gray-600">Сравните полученные предложения и выберите наиболее подходящего поставщика</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Recent queries sidebar inline (no background) */}
        <aside className="hidden lg:block w-[300px] mt-24 ml-16">
          <RecentQueriesSidebar />
        </aside>
      </div>
    </div>
  );
}