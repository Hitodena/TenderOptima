import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import ComplianceResultsTable from '@/components/ComplianceResultsTable';
import { MainNavigation } from '@/components/main-navigation';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download, FileText, Clock, ArrowLeft } from 'lucide-react';

interface ComplianceItem {
  requirement_id: string;
  requirement_text: string;
  supplier_value: string;
  compliance_status: string;
  reasoning: string;
}

interface AnalysisData {
  id: number;
  status: 'pending' | 'completed';
  result: any;
  createdAt: string;
  completedAt?: string;
  tzFilePath?: string;
  kpFilePath?: string;
  tzFileName?: string;
  kpFileName?: string;
  requestName?: string;
}

export default function AnalysisResults() {
  const [location, setLocation] = useLocation();
  const [results, setResults] = useState<ComplianceItem[] | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Получение результатов из БД
  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Получаем requestId или analysisRequestId из query параметров
        const urlParams = new URLSearchParams(window.location.search);
        const requestId = urlParams.get('requestId');
        const analysisRequestId = urlParams.get('analysisRequestId');
        
        let technicalAnalysisId: string | null = requestId;
        
        // Если передан analysisRequestId, ищем technical_analysis_request
        if (!requestId && analysisRequestId) {
          try {
            const searchResponse = await fetch(`/api/analysis-requests/${analysisRequestId}`, {
              credentials: 'include'
            });
            
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.request?.technical_analysis_id) {
                technicalAnalysisId = searchData.request.technical_analysis_id.toString();
              } else {
                // Если technical_analysis_request не найден, показываем сообщение о том, что анализ еще не начат
                setAnalysisData({
                  id: parseInt(analysisRequestId),
                  status: 'pending',
                  result: null,
                  createdAt: new Date().toISOString()
                });
                setIsLoading(false);
                return;
              }
            }
          } catch (searchError) {
            console.error('Ошибка при поиске technical_analysis_request:', searchError);
            setError('Не удалось найти запрос анализа');
            setIsLoading(false);
            return;
          }
        }
        
        if (!technicalAnalysisId) {
          setError('ID запроса не указан');
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/analyze-gemini/${technicalAnalysisId}`, {
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Ошибка при загрузке результатов');
        }

        // Сохраняем данные анализа
        setAnalysisData(data.data);

        if (!data.data || data.data.status !== 'completed') {
          // Анализ еще не завершен - показываем сообщение, но не ошибку
          setIsLoading(false);
          return;
        }

        if (!data.data.result) {
          setError('Результаты анализа не найдены');
          setIsLoading(false);
          return;
        }

        // Если результат в поле "result", если нет - используем весь массив
        let resultsArray: ComplianceItem[];
        
        if (Array.isArray(data.data.result)) {
          resultsArray = data.data.result;
        } else if (data.data.result.results && Array.isArray(data.data.result.results)) {
          resultsArray = data.data.result.results;
        } else if (typeof data.data.result === 'string') {
          // Если результат - JSON строка, парсим её
          try {
            const parsed = JSON.parse(data.data.result);
            resultsArray = Array.isArray(parsed) ? parsed : (parsed.results || []);
          } catch (parseError) {
            throw new Error('Не удалось распарсить результаты анализа');
          }
        } else {
          throw new Error('Неверный формат результатов');
        }

        if (resultsArray.length === 0) {
          setError('Результаты анализа пусты');
          setIsLoading(false);
          return;
        }

        setResults(resultsArray);
      } catch (err) {
        console.error('Ошибка при загрузке результатов:', err);
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainNavigation />
        <div className="p-8">
          <Card>
            <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center">
              <Spinner className="h-8 w-8 mb-4" />
              <p className="text-center text-lg font-medium">Загрузка результатов...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Если анализ еще не завершен
  if (analysisData && analysisData.status !== 'completed') {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainNavigation />
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-blue-600" />
                  Анализ в процессе
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Анализ еще не завершен. Результаты будут доступны после завершения анализа.
                  </AlertDescription>
                </Alert>
                <div className="flex justify-between items-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/analyze/technical')}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Вернуться к запросам
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainNavigation />
        <div className="p-8">
          <Card>
            <CardContent className="pt-8 pb-8">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error || 'Не удалось загрузить результаты анализа'}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Функция для скачивания файла
  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const response = await fetch(`/api/analyze-gemini/files?path=${encodeURIComponent(filePath)}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        // Пытаемся получить текст ошибки из ответа
        let errorMessage = 'Ошибка при скачивании файла';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Если не удалось распарсить JSON, используем статус
          errorMessage = `Ошибка ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // Проверяем, что ответ действительно содержит файл
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        // Если сервер вернул JSON вместо файла, это ошибка
        const errorData = await response.json();
        throw new Error(errorData.error || 'Сервер вернул ошибку вместо файла');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error);
      const errorMessage = error instanceof Error ? error.message : 'Не удалось скачать файл';
      alert(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Загруженные файлы - компактно */}
          {analysisData && (analysisData.tzFilePath || analysisData.kpFilePath) && (
            <div className="flex items-center gap-4 text-sm text-gray-600 pb-2 border-b border-gray-200">
              <span className="font-medium text-gray-700">Загруженные файлы:</span>
              {analysisData.tzFilePath && (
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-blue-600" />
                  <span className="text-xs">{analysisData.tzFileName || 'ТЗ'}</span>
                  <button
                    onClick={() => downloadFile(analysisData.tzFilePath!, analysisData.tzFileName || 'tz_file')}
                    className="text-blue-600 hover:text-blue-700 text-xs underline"
                  >
                    скачать
                  </button>
                </div>
              )}
              {analysisData.kpFilePath && (
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-green-600" />
                  <span className="text-xs">{analysisData.kpFileName || 'КП'}</span>
                  <button
                    onClick={() => downloadFile(analysisData.kpFilePath!, analysisData.kpFileName || 'kp_file')}
                    className="text-green-600 hover:text-green-700 text-xs underline"
                  >
                    скачать
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Результаты анализа */}
          <ComplianceResultsTable
            data={results}
            totalRequirements={results.length}
            requestName={analysisData?.requestName}
          />
        </div>
      </div>
    </div>
  );
}

