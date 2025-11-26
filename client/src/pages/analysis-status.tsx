import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MainNavigation } from '@/components/main-navigation';
import { getAnalysisThemeClasses } from '@/styles/analysis-theme';
import { CheckCircle2, Clock, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AnalysisStatusPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const themeClasses = getAnalysisThemeClasses();
  
  const requestId = params.requestId ? parseInt(params.requestId) : null;
  const [isLoading, setIsLoading] = useState(false);

  if (!requestId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainNavigation />
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardContent className="pt-8 pb-8">
              <Alert variant="destructive">
                <AlertDescription>
                  ID запроса не указан
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MainNavigation />
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <Card className={`border-2 ${themeClasses.borderColor} w-full max-w-2xl`}>
          <CardHeader className="pb-4">
            <CardTitle className={`text-xl font-bold ${themeClasses.textMain} flex items-center gap-2`}>
              <Clock className="h-5 w-5 text-blue-600" />
              Анализ в процессе
            </CardTitle>
            <CardDescription className="text-sm">
              Ваши документы отправлены на анализ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
              <div className="text-center space-y-3">
                <h3 className="text-xl font-bold text-gray-900">
                  Данные отправлены на анализ
                </h3>
                <p className="text-base text-gray-700">
                  Результат будет готов в течение <span className="font-semibold text-blue-600">2 часов</span>
                </p>
                <p className="text-xs text-gray-600">
                  Мы отправим уведомление на ваш email, когда анализ будет завершен
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <h4 className="font-semibold text-gray-900 text-sm">Что происходит сейчас:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Файлы загружены и сохранены</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Идет анализ данных</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>Результаты будут доступны после завершения</span>
                </li>
              </ul>
            </div>

            <div className="flex justify-between items-center pt-3 border-t gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation('/analyze/technical')}
                size="sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Вернуться к запросам
              </Button>
              <Button
                onClick={() => setLocation(`/analysis/results?requestId=${requestId}`)}
                className={`${themeClasses.bgPrimary} ${themeClasses.hoverPrimary} text-white`}
                size="sm"
              >
                Проверить статус
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

