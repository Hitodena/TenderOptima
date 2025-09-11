import React from 'react';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Edit, BarChart3, CheckCircle, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

export default function TenderProcurementHome() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const features = [
    {
      icon: FileText,
      title: t('create_specification'),
      description: 'Создание технического задания для тендера',
      href: '/analyze/technical',
      color: 'slate',
      available: false // Will be available later
    },
    {
      icon: Edit,
      title: t('improve_specification'),
      description: 'Улучшение существующего технического задания',
      href: '/analyze/technical',
      color: 'slate',
      available: false // Will be available later
    },
    {
      icon: BarChart3,
      title: t('technical_analysis'),
      description: 'Технический анализ поступивших предложений',
      href: '/analyze/technical',
      color: 'slate'
    },
    {
      icon: CheckCircle,
      title: t('final_supplier_selection'),
      description: 'Финальный выбор поставщика по результатам тендера',
      href: '/analyze/technical',
      color: 'slate',
      available: false // Will be available later
    }
  ];

  const getColorClasses = (color: string, available: boolean = true) => {
    const base = {
      slate: {
        bg: available ? 'bg-slate-100' : 'bg-gray-100',
        text: available ? 'text-slate-600' : 'text-gray-400',
        button: available ? 'bg-slate-600 hover:bg-slate-700' : 'bg-gray-400 cursor-not-allowed'
      }
    };
    
    return base[color as keyof typeof base] || base.slate;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t('tender_procurement_home_title')}
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            {t('tender_procurement_home_description')}
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colors = getColorClasses(feature.color, feature.available !== false);
            const isAvailable = feature.available !== false;
            
            return (
              <Card key={index} className={`${isAvailable ? 'hover:shadow-lg' : ''} transition-shadow ${!isAvailable ? 'opacity-60' : ''}`}>
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
                  {isAvailable ? (
                    <Button 
                      className={`w-full ${colors.button}`}
                      onClick={() => navigate(feature.href)}
                    >
                      Перейти
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      className={`w-full ${colors.button}`}
                      disabled
                    >
                      Скоро доступно
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tender Process Guide */}
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-800">Процесс тендерной закупки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <div>
                  <h4 className="font-medium text-slate-800">Подготовка технического задания</h4>
                  <p className="text-slate-600 text-sm">Создание детального технического задания с требованиями к поставщикам</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <div>
                  <h4 className="font-medium text-slate-800">Технический анализ предложений</h4>
                  <p className="text-slate-600 text-sm">Анализ поступивших предложений на соответствие техническим требованиям</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                <div>
                  <h4 className="font-medium text-slate-800">Комплексная оценка и выбор</h4>
                  <p className="text-slate-600 text-sm">Сравнение предложений по техническим и коммерческим критериям</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Available Features */}
        <Card className="mt-6 bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">Доступно сейчас</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700">
              <strong>Технический анализ предложений</strong> - полнофункциональный модуль для анализа соответствия предложений поставщиков техническим требованиям.
            </p>
            <p className="text-green-600 text-sm mt-2">
              Остальные модули будут добавлены в ближайших обновлениях.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}