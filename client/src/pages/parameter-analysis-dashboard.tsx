import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MainNavigation } from '@/components/main-navigation';
import { getAnalysisThemeClasses } from '@/styles/analysis-theme';
import { 
  Plus, 
  FileText, 
  Calendar, 
  Search,
  Eye,
  Edit,
  Trash2,
  BarChart3
} from 'lucide-react';

interface AnalysisRequest {
  id: number;
  name: string;
  description?: string;
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  type: 'parameter_analysis';
  parameters_count?: number;
  suppliers_count?: number;
}

export function ParameterAnalysisDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const themeClasses = getAnalysisThemeClasses();
  
  const [requests, setRequests] = useState<AnalysisRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await fetch('/api/analysis-requests?type=parameter_analysis', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить список запросов",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewRequest = async () => {
    try {
      const response = await fetch('/api/analysis-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: `Анализ по параметрам ${new Date().toLocaleDateString()}`,
          description: 'Новый запрос на анализ по параметрам',
          type: 'parameter_analysis'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newRequest = data.request;
        
        // Save request to localStorage for step navigation
        localStorage.setItem('currentAnalysisRequest', JSON.stringify(newRequest));
        
        // Redirect to step 1 - parameter selection
        setLocation('/analyze/parameters/select');
        
        toast({
          title: "Запрос создан",
          description: "Переход к выбору параметров для анализа"
        });
      } else {
        throw new Error('Failed to create request');
      }
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: "Ошибка создания",
        description: "Не удалось создать новый запрос",
        variant: "destructive"
      });
    }
  };

  const openRequest = (request: AnalysisRequest) => {
    // Save request to localStorage for step navigation
    localStorage.setItem('currentAnalysisRequest', JSON.stringify(request));
    
    // Determine which step to go to based on status
    if (request.status === 'draft') {
      setLocation('/analyze/parameters/select');
    } else if (request.status === 'in_progress') {
      setLocation('/analyze/parameters/compare');
    } else {
      setLocation('/analyze/parameters/results');
    }
  };

  const deleteRequest = async (requestId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот запрос?')) {
      return;
    }

    try {
      const response = await fetch(`/api/analysis-requests/${requestId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setRequests(prev => prev.filter(req => req.id !== requestId));
        toast({
          title: "Запрос удален",
          description: "Запрос успешно удален из системы"
        });
      } else {
        throw new Error('Failed to delete request');
      }
    } catch (error) {
      console.error('Error deleting request:', error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить запрос",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Черновик', variant: 'secondary' as const },
      in_progress: { label: 'В работе', variant: 'default' as const },
      completed: { label: 'Завершен', variant: 'outline' as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredRequests = requests.filter(request =>
    request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
      <MainNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Анализ по параметрам
            </h1>
            <p className="text-gray-600">
              Сравнение предложений поставщиков по ключевым параметрам
            </p>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Button 
              onClick={createNewRequest}
              className="bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Создать новый запрос
            </Button>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Поиск запросов..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Requests List */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Загрузка запросов...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'Запросы не найдены' : 'Нет запросов'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm 
                    ? 'Попробуйте изменить критерии поиска'
                    : 'Создайте первый запрос на анализ по параметрам'
                  }
                </p>
                {!searchTerm && (
                  <Button 
                    onClick={createNewRequest}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Создать запрос
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-medium text-gray-900 truncate">
                          {request.name}
                        </CardTitle>
                        {request.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {request.description}
                          </p>
                        )}
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(request.created_at).toLocaleDateString()}
                        </div>
                        {request.parameters_count && (
                          <div className="flex items-center">
                            <BarChart3 className="w-4 h-4 mr-1" />
                            {request.parameters_count} параметров
                          </div>
                        )}
                        {request.suppliers_count && (
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-1" />
                            {request.suppliers_count} поставщиков
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRequest(request)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Открыть
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteRequest(request.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}