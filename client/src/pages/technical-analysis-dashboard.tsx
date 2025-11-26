import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { MainNavigation } from '@/components/main-navigation';
import { getAnalysisThemeClasses } from '@/styles/analysis-theme';
import { apiRequest } from '@/lib/queryClient';
import { 
  Plus, 
  FileText, 
  Calendar, 
  Search,
  Eye,
  Edit,
  Trash2,
  Check
} from 'lucide-react';

interface AnalysisRequest {
  id: number;
  name: string;
  description?: string;
  procedure_name?: string;
  project_description?: string;
  project_id?: number;
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  type: 'technical_analysis';
  technical_analysis_id?: number;
  analysis_status?: 'pending' | 'completed';
  tz_file_path?: string;
  kp_file_path?: string;
  result_json?: any;
  analysis_completed_at?: string;
}

export function TechnicalAnalysisDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const themeClasses = getAnalysisThemeClasses();
  
  const [requests, setRequests] = useState<AnalysisRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newRequestName, setNewRequestName] = useState('');
  const [activeTab, setActiveTab] = useState<string>('active');
  const [isCreating, setIsCreating] = useState(false);
  const [animatingItems, setAnimatingItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await apiRequest<{ requests: AnalysisRequest[] }>('/api/analysis-requests?type=technical_analysis');
      setRequests(data.requests || []);
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
    if (!newRequestName.trim()) {
      toast({
        title: "Название обязательно",
        description: "Введите название запроса перед созданием",
        variant: "destructive"
      });
      return;
    }

    if (isCreating) {
      return; // Prevent double-clicks
    }

    setIsCreating(true);

    try {
      // First create the analysis request for dashboard tracking
      const requestData = await apiRequest<{ request: AnalysisRequest }>('/api/analysis-requests', 'POST', {
        name: newRequestName.trim(),
        description: 'Новый запрос на технический анализ',
        type: 'technical_analysis'
      });

      const newRequest = requestData.request;

      // Now create the analysis project for the step workflow
      const projectData = await apiRequest<{ project: any }>('/api/analysis-projects', 'POST', {
        procedure_name: newRequestName.trim(),
        description: 'Новый запрос на технический анализ',
        analysis_request_id: newRequest.id
      });

      const newProject = projectData.project;
        
        // Save both request and project to localStorage for step navigation
        localStorage.setItem('currentAnalysisRequest', JSON.stringify(newRequest));
        localStorage.setItem('currentAnalysisProject', JSON.stringify(newProject));
        
        // Clear the request name field after successful creation
        setNewRequestName('');
        
        // Refresh the requests list to show the new request
        loadRequests();
        
        // Redirect to step 1 with project ID (not request ID)
        setLocation(`/analyze/technical/${newProject.id}/requirements`);
        
        toast({
          title: "Запрос создан",
          description: "Переход к загрузке технических требований"
        });
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: "Ошибка создания",
        description: "Не удалось создать новый запрос",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const openRequest = async (request: AnalysisRequest) => {
    try {
      // Save request to localStorage for step navigation
      localStorage.setItem('currentAnalysisRequest', JSON.stringify(request));
      
      // First check if there's already an analysis project for this request
      const projectCheckResponse = await fetch(`/api/analysis-projects?analysis_request_id=${request.id}`, {
        credentials: 'include'
      });
      
      let projectId = null;
      
      if (projectCheckResponse.ok) {
        const projectData = await projectCheckResponse.json();
        if (projectData.projects && projectData.projects.length > 0) {
          projectId = projectData.projects[0].id;
          localStorage.setItem('currentAnalysisProject', JSON.stringify(projectData.projects[0]));
        }
      }
      
      // If no project exists, create one
      if (!projectId) {
        const projectResponse = await fetch('/api/analysis-projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            procedure_name: request.name,
            description: request.description || 'Анализ технических требований',
            analysis_request_id: request.id
          })
        });

        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          projectId = projectData.project.id;
          localStorage.setItem('currentAnalysisProject', JSON.stringify(projectData.project));
        } else {
          throw new Error('Failed to create analysis project');
        }
      }
      
      // Redirect existing requests to workspace (tabbed interface)
      setLocation(`/analyze/technical/${projectId}/workspace`);
    } catch (error) {
      console.error('Error opening request:', error);
      toast({
        title: "Ошибка открытия",
        description: "Не удалось открыть запрос",
        variant: "destructive"
      });
    }
  };

  const completeRequest = async (requestId: number) => {
    try {
      // Start animation
      setAnimatingItems(prev => new Set(prev).add(requestId));
      
      const response = await fetch(`/api/analysis-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed' })
      });

      if (response.ok) {
        // Wait for animation to complete before updating data
        setTimeout(() => {
          setRequests(prev => prev.map(req => 
            req.id === requestId ? { ...req, status: 'completed' } : req
          ));
          setAnimatingItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(requestId);
            return newSet;
          });
        }, 300); // Match animation duration
        
        toast({
          title: "Запрос завершен",
          description: "Запрос перенесен в раздел \"Завершенные запросы\""
        });
      } else {
        throw new Error('Failed to complete request');
      }
    } catch (error) {
      console.error('Error completing request:', error);
      // Remove from animating items on error
      setAnimatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
      toast({
        title: "Ошибка завершения",
        description: "Не удалось завершить запрос",
        variant: "destructive"
      });
    }
  };

  const activateRequest = async (requestId: number) => {
    try {
      // Start animation
      setAnimatingItems(prev => new Set(prev).add(requestId));
      
      const response = await fetch(`/api/analysis-requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'in_progress' })
      });

      if (response.ok) {
        // Wait for animation to complete before updating data
        setTimeout(() => {
          setRequests(prev => prev.map(req => 
            req.id === requestId ? { ...req, status: 'in_progress' } : req
          ));
          setAnimatingItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(requestId);
            return newSet;
          });
        }, 300); // Match animation duration
        
        toast({
          title: "Запрос активирован",
          description: "Запрос перенесен в раздел \"Активные запросы\""
        });
      } else {
        throw new Error('Failed to activate request');
      }
    } catch (error) {
      console.error('Error activating request:', error);
      // Remove from animating items on error
      setAnimatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
      toast({
        title: "Ошибка активации",
        description: "Не удалось активировать запрос",
        variant: "destructive"
      });
    }
  };

  const getAnalysisStatusBadge = (request: AnalysisRequest) => {
    // Если есть technical_analysis_id, показываем статус анализа
    if (request.technical_analysis_id) {
      if (request.analysis_status === 'completed') {
        return <Badge variant="default" className="bg-green-600 text-white">Готов</Badge>;
      } else {
        return <Badge variant="default" className="bg-blue-600 text-white">В процессе</Badge>;
      }
    }
    // Если нет анализа, показываем статус запроса
    if (request.status === 'draft') {
      return <Badge variant="secondary">Черновик</Badge>;
    } else if (request.status === 'in_progress') {
      return <Badge variant="default">В работе</Badge>;
    } else {
      return <Badge variant="outline">Завершен</Badge>;
    }
  };

  const filteredRequests = requests.filter(request =>
    request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Separate active and completed requests
  const activeRequests = filteredRequests.filter(request => 
    request.status === 'draft' || request.status === 'in_progress'
  );
  
  const completedRequests = filteredRequests.filter(request => 
    request.status === 'completed'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50">
      <MainNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Технический анализ
            </h1>
            <p className="text-gray-600">
              Анализ технических требований и предложений поставщиков
            </p>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-col gap-4 mb-6">
            {/* New Request Creation and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 max-w-md">
                <Label htmlFor="request-name" className="text-sm font-medium text-gray-700 mb-2 block">
                  Название запроса
                </Label>
                <Input
                  id="request-name"
                  placeholder="Введите название нового запроса..."
                  value={newRequestName}
                  onChange={(e) => setNewRequestName(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button 
                onClick={createNewRequest}
                disabled={isCreating}
                className="bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white flex items-center gap-2 whitespace-nowrap"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                    Создание запроса...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Создать новый запрос
                  </>
                )}
              </Button>
              
              {/* Temporary: Test Gemini Button */}
              <Button 
                onClick={() => setLocation('/test-gemini')}
                variant="outline"
                className="bg-yellow-50 hover:bg-yellow-100 border-yellow-300 text-yellow-700 hover:text-yellow-800 flex items-center gap-2 whitespace-nowrap"
              >
                🧪 Тест Gemini API
              </Button>
              
              {/* Search Bar - moved to same line, reduced width */}
              <div className="max-w-xs">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Поиск запросов..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-48"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation - Dashboard Style */}
          <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="active">
                Активные запросы ({activeRequests.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Завершенные запросы ({completedRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {isLoading ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-4"></div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Идет загрузка
                    </h3>
                    <p className="text-gray-600">
                      Запросы проверяются и загружаются...
                    </p>
                  </CardContent>
                </Card>
              ) : activeRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Нет активных запросов
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Создайте первый запрос на технический анализ
                    </p>
                    <Button 
                      onClick={createNewRequest}
                      disabled={!newRequestName.trim()}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Создать запрос
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {activeRequests.map((request, index) => (
                    <div 
                      key={request.id} 
                      className={`bg-white border border-gray-300 rounded-md overflow-hidden mb-1 hover:shadow-sm transition-shadow ${
                        animatingItems.has(request.id) ? 'animate-slide-out' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between p-3 h-14">
                        <div className="flex flex-col gap-1">
                          <div className="font-medium">
                            {request.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            Дата создания: {new Date(request.created_at).toLocaleDateString('ru-RU')} • Запрос №: {request.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Анимированная линия */}
                          <div 
                            className="relative flex-1 h-px bg-gray-200 animate-draw-line"
                            style={{ animationDelay: `${(activeRequests.length + index) * 100}ms` }}
                          ></div>
                          
                          <div 
                            className="flex items-center gap-3 animate-fade-in-element"
                            style={{ animationDelay: `${(activeRequests.length + index) * 100 + 400}ms` }}
                          >
                            {getAnalysisStatusBadge(request)}
                            <Button
                              onClick={() => {
                                // Всегда переходим на страницу результатов
                                // Если есть technical_analysis_id, используем его
                                // Если нет, используем analysis_request_id для поиска
                                if (request.technical_analysis_id) {
                                  setLocation(`/analysis/results?requestId=${request.technical_analysis_id}`);
                                } else {
                                  // Используем analysis_request_id для поиска technical_analysis_request
                                  setLocation(`/analysis/results?analysisRequestId=${request.id}`);
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="text-slate-600 hover:text-slate-700 border-slate-600 hover:border-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Открыть
                            </Button>
                            <Button
                              onClick={() => completeRequest(request.id)}
                              variant="outline"
                              size="sm"
                              className="text-gray-500 hover:text-gray-600 border-gray-300 hover:border-gray-400"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Завершить
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {isLoading ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-4"></div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Идет загрузка
                    </h3>
                    <p className="text-gray-600">
                      Запросы проверяются и загружаются...
                    </p>
                  </CardContent>
                </Card>
              ) : completedRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Нет завершенных запросов
                    </h3>
                    <p className="text-gray-600">
                      Используйте кнопку "Завершить" для перемещения запросов сюда
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {completedRequests.map((request, index) => (
                    <div 
                      key={request.id} 
                      className={`bg-white border border-gray-300 rounded-md overflow-hidden mb-1 hover:shadow-sm transition-shadow ${
                        animatingItems.has(request.id) ? 'animate-slide-out' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between p-3 h-14">
                        <div className="flex flex-col gap-1">
                          <div className="font-medium">
                            {request.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            Дата создания: {new Date(request.created_at).toLocaleDateString('ru-RU')} • Запрос №: {request.id}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Анимированная линия */}
                          <div 
                            className="relative flex-1 h-px bg-gray-200 animate-draw-line"
                            style={{ animationDelay: `${(activeRequests.length + index) * 100}ms` }}
                          ></div>
                          
                          <div 
                            className="flex items-center gap-3 animate-fade-in-element"
                            style={{ animationDelay: `${(activeRequests.length + index) * 100 + 400}ms` }}
                          >
                            {getAnalysisStatusBadge(request)}
                            <Button
                              onClick={() => {
                                // Всегда переходим на страницу результатов
                                // Если есть technical_analysis_id, используем его
                                // Если нет, используем analysis_request_id для поиска
                                if (request.technical_analysis_id) {
                                  setLocation(`/analysis/results?requestId=${request.technical_analysis_id}`);
                                } else {
                                  // Используем analysis_request_id для поиска technical_analysis_request
                                  setLocation(`/analysis/results?analysisRequestId=${request.id}`);
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="text-slate-600 hover:text-slate-700 border-slate-600 hover:border-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Открыть
                            </Button>
                            <Button
                              onClick={() => activateRequest(request.id)}
                              variant="outline"
                              size="sm"
                              className="text-gray-500 hover:text-gray-600 border-gray-300 hover:border-gray-400"
                            >
                              Сделать активным
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}