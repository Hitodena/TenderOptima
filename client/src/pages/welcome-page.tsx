import React from 'react';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, FileText, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

export default function WelcomePage() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const handleQuickProcurementClick = () => {
    // Save user preference and navigate to quick procurement home
    localStorage.setItem('last_procurement_type', 'quick');
    navigate('/quick-procurement');
  };

  const handleTenderProcurementClick = () => {
    // Save user preference and navigate to tender procurement home
    localStorage.setItem('last_procurement_type', 'tender');
    navigate('/tender-procurement');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t('welcome_title')}
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {t('welcome_description')}
          </p>
        </div>

        {/* Procurement Type Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Quick Procurement Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200" onClick={handleQuickProcurementClick}>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-blue-600">
                {t('quick_procurement')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('quick_procurement_home_description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleQuickProcurementClick}>
                {t('quick_procurement')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Tender Procurement Card */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-slate-200" onClick={handleTenderProcurementClick}>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-600" />
              </div>
              <CardTitle className="text-2xl text-slate-600">
                {t('tender_procurement')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('tender_procurement_home_description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button className="w-full bg-slate-600 hover:bg-slate-700" onClick={handleTenderProcurementClick}>
                {t('tender_procurement')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer note */}
        <div className="text-center text-gray-500">
          <p>Вы можете изменить тип процедуры в любое время через главное меню</p>
        </div>
      </div>
    </div>
  );
}