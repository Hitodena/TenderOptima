import React from 'react';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Send, CheckCircle, Users, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

export default function QuickProcurementHome() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const features = [
    {
      icon: Search,
      title: t('search_suppliers'),
      description: 'Быстрый поиск поставщиков по товарам и услугам',
      href: '/search',
      color: 'blue'
    },
    {
      icon: Send,
      title: t('send_requests'),
      description: 'Отправка запросов на коммерческие предложения',
      href: '/send-request',
      color: 'green'
    },
    {
      icon: CheckCircle,
      title: t('supplier_selection'),
      description: 'Сравнение предложений и выбор поставщика',
      href: '/dashboard',
      color: 'orange'
    },
    {
      icon: Users,
      title: t('contact_database'),
      description: 'Управление базой контактов поставщиков',
      href: '/contact-groups',
      color: 'purple'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-600',
          button: 'bg-blue-600 hover:bg-blue-700'
        };
      case 'green':
        return {
          bg: 'bg-green-100',
          text: 'text-green-600',
          button: 'bg-green-600 hover:bg-green-700'
        };
      case 'orange':
        return {
          bg: 'bg-orange-100',
          text: 'text-orange-600',
          button: 'bg-orange-600 hover:bg-orange-700'
        };
      case 'purple':
        return {
          bg: 'bg-purple-100',
          text: 'text-purple-600',
          button: 'bg-purple-600 hover:bg-purple-700'
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-600',
          button: 'bg-gray-600 hover:bg-gray-700'
        };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t('quick_procurement_home_title')}
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            {t('quick_procurement_home_description')}
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colors = {
      bg: 'bg-slate-100',
      text: 'text-slate-600', 
      button: 'bg-slate-600 hover:bg-slate-700'
    };
            
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center pb-4">
                  <div className={`w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center mx-auto mb-3`}>
                    <Icon className={`w-6 h-6 ${colors.text}`} />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button 
                    className={`w-full ${colors.button}`}
                    onClick={() => navigate(feature.href)}
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
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-800">Быстрый старт</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <div>
                  <h4 className="font-medium text-slate-800">Найдите поставщиков</h4>
                  <p className="text-slate-600 text-sm">Используйте поиск для нахождения поставщиков по вашему товару или услуге</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <div>
                  <h4 className="font-medium text-slate-800">Отправьте запросы</h4>
                  <p className="text-slate-600 text-sm">Создайте и отправьте запросы на коммерческие предложения выбранным поставщикам</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                <div>
                  <h4 className="font-medium text-slate-800">Выберите лучшее предложение</h4>
                  <p className="text-slate-600 text-sm">Сравните полученные предложения и выберите наиболее подходящего поставщика</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}