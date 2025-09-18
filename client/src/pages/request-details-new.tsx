import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast, toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type SearchRequest, type RequestSupplier, type SupplierResponse, type EmailAttachment, type AnalysisResult } from "@shared/schema";
import SupplierMessages from "@/components/supplier-messages";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Split, BarChartHorizontal, FileText, Calendar, UserPlus, RefreshCw } from "lucide-react";
import { useAnalysisResults } from "@/hooks/use-analysis-results";
import { ResponsePanel } from "@/components/response-panel";
import { AddToGroupButton } from "@/components/add-to-group-button";
import { ParameterExtractionStatus } from "@/components/parameter-extraction-status";
import { useSocket } from "@/hooks/useSocket";
import { useUserId } from "@/hooks/useUserId";
import { useRequestParameters } from "@/hooks/use-request-parameters";

interface RequestDetailsData {
  request: SearchRequest;
  requestSuppliers: RequestSupplier[];
  supplierResponses: SupplierResponse[];
}

interface AnalysisResultsTabProps {
  requestId: number;
}

function AnalysisResultsTab({ requestId }: AnalysisResultsTabProps) {
  const { data: analysisResults, isLoading, error } = useAnalysisResults(requestId);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p>Загрузка результатов анализа...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Error loading analysis results</p>
      </div>
    );
  }

  if (!analysisResults || analysisResults.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No analysis results found for this request</p>
          <p className="text-sm text-muted-foreground">
            Compare supplier responses and generate an analysis to see results here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort results by date with most recent first
  const sortedResults = [...analysisResults].sort((a, b) => {
    const dateA = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
    const dateB = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Результаты анализа ({sortedResults.length})</h2>
      </div>

      <div className="grid gap-4">
        {sortedResults.map((result) => (
          <Card key={result.id} className="overflow-hidden">
            <div className="p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="font-medium">
                      {result.dateCreated && format(new Date(result.dateCreated), 'dd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/analysis/${result.id}`}>
                    <FileText className="h-4 w-4 mr-1" />
                    Смотреть
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function RequestDetails() {
  const [, params] = useRoute<{ id: string }>("/requests/:id");
  const [, navigate] = useLocation();
  const id = params?.id ? parseInt(params.id) : null;
  const [tab, setTab] = useState<string>("responses");
  const [selectedResponses, setSelectedResponses] = useState<number[]>([]);
  const [activeResponse, setActiveResponse] = useState<SupplierResponse | null>(null);
  const [forceParameterExtraction, setForceParameterExtraction] = useState(false);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  
  // Получаем userId для Socket.IO
  const userId = useUserId();
  
  // Socket.IO подключение для real-time уведомлений
  useSocket({
    userId: userId || undefined,
    onNewEmail: (data) => {
      console.log('📧 RequestDetails: Received new email notification:', data);
      console.log('📧 RequestDetails: Current request ID:', id);
      console.log('📧 RequestDetails: New email request ID:', data.requestId);
      
      // Если новый email относится к текущему запросу, обновляем данные
      if (data.requestId === id) {
        console.log('🔄 RequestDetails: New email for current request, refreshing data...');
        
        // Показываем уведомление
        toast({
          title: "Новое предложение получено!",
          description: `От ${data.supplier}: ${data.subject}`,
        });
        
        // Обновляем данные
        console.log('🔄 RequestDetails: Invalidating queries...');
        queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'single', id] });
        queryClient.invalidateQueries({ queryKey: ['/api/supplier-responses', id] });
      } else {
        console.log('📧 RequestDetails: New email for different request, ignoring');
      }
    }
  });
  
  // OPTIMIZED: Simplified auto-selection tracking
  const [hasAutoSelectedFirstEmail, setHasAutoSelectedFirstEmail] = useState(false);
  
  // OPTIMIZED: Lazy handler for supplier selection - no automatic parameter extraction
  const handleSupplierSelect = (responseId: number, response: SupplierResponse) => {
    setActiveResponse(response);
    console.log(`Selected supplier response: ${responseId}`);
    // NOTE: Parameter extraction will be triggered only when ParameterExtractionStatus component loads
  };

  // Track last viewed request in localStorage
  useEffect(() => {
    if (id) {
      console.log('RequestDetails: Starting to track request ID:', id);
      
      const existingIds = JSON.parse(localStorage.getItem('lastViewedRequestIds') || '[]');
      const filteredIds = existingIds.filter((existingId: number) => existingId !== id);
      const newIds = [id, ...filteredIds].slice(0, 3);
      
      localStorage.setItem('lastViewedRequestIds', JSON.stringify(newIds));
      localStorage.setItem('lastViewedAt', new Date().toISOString());
      
      console.log('RequestDetails: Saved IDs to localStorage:', newIds);
    }
  }, [id]);

  interface EmailCheckResponse {
    success: boolean;
    message: string;
    newResponses: number;
    request?: SearchRequest;
    requestSuppliers?: RequestSupplier[];
    supplierResponses?: SupplierResponse[];
  }
  
  // OPTIMIZED: Load request details with minimal automatic refetching
  const { data, isLoading, error, refetch } = useQuery<RequestDetailsData>({
    queryKey: ['/api/search-requests', 'single', id], // ✅ ИСПРАВЛЕНО: уникальный ключ для одного запроса
    queryFn: async () => {
      console.log('🚀 REQUEST-DETAILS: Loading single request', id);
      const response = await apiRequest<RequestDetailsData>(`/api/search-requests/${id}`, 'GET');
      console.log('🚀 REQUEST-DETAILS: Loaded request', id, 'with', response?.supplierResponses?.length || 0, 'responses');
      // Cache supplier responses for potential future use
      if (response?.supplierResponses && id) {
        queryClient.setQueryData(['/api/supplier-responses', id], response.supplierResponses);
      }
      return response;
    },
    enabled: !!id,
    refetchInterval: false,
    staleTime: 600000, // 10 minutes - longer caching for better performance
    refetchOnWindowFocus: false,
    refetchOnMount: true
  });

  // OPTIMIZED: Load request parameters only when activeResponse is selected (lazy loading)
  const { data: parametersData } = useRequestParameters(
    id, 
    !!activeResponse // Only load when a response is actively selected
  );

  // Check emails mutation - optimized cache handling
  const checkEmailsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<EmailCheckResponse>('/api/check-emails', 'POST', {
        requestId: id
      });
    },
    onSuccess: async (data: EmailCheckResponse) => {
      if (data.newResponses > 0) {
        // Force immediate data refresh by invalidating and refetching
        await queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'single', id] });
        await queryClient.invalidateQueries({ queryKey: ['/api/supplier-responses', id] });
        await queryClient.invalidateQueries({ queryKey: ['/api/supplier-responses-batch'] });
        
        // Force refetch the current request data immediately
        try {
          await refetch();
          console.log('Data refetched successfully after email check');
        } catch (refetchError) {
          console.error('Error refetching data after email check:', refetchError);
        }
        
        toast({
          title: "Email Check Complete",
          description: `Found ${data.newResponses} new supplier responses`,
          variant: "default"
        });
        setTab("responses");
        
        // Reset auto-selection for new emails
        setHasAutoSelectedFirstEmail(false);
        setActiveResponse(null);
      } else {
        toast({
          title: "Email Check Complete",
          description: "No new supplier responses found",
          variant: "default"
        });
      }
    },
    onError: (error) => {
      console.error('Email check failed:', error);
      toast({
        title: "Email Check Failed",
        description: error instanceof Error ? error.message : "Failed to check emails",
        variant: "destructive"
      });
    }
  });

  // OPTIMIZED: Simplified auto-selection - only when switching to responses tab
  useEffect(() => {
    if (tab === "responses" && !hasAutoSelectedFirstEmail && data?.supplierResponses && data.supplierResponses.length > 0) {
      const firstResponse = data.supplierResponses[0];
      
      // Use simplified selection without automatic parameter extraction
      handleSupplierSelect(firstResponse.id, firstResponse);
      setHasAutoSelectedFirstEmail(true);
      
      console.log("Auto-selected first email:", firstResponse.id);
    }
  }, [tab, data?.supplierResponses, hasAutoSelectedFirstEmail, handleSupplierSelect]);

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest('/api/search-requests/' + id + '/status', 'PATCH', {
        status
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'single', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'dashboard'] });
    },
  });

  // OPTIMIZED: Simplified mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (responseId: number) => {
      return apiRequest('/api/supplier-responses/' + responseId + '/read', 'PATCH');
    },
    onSuccess: (_, responseId) => {
      // Optimistic update - update cache immediately
      const currentData = queryClient.getQueryData<RequestDetailsData>(['/api/search-requests', 'single', id]);
      if (currentData?.supplierResponses) {
        const updatedResponses = currentData.supplierResponses.map(response => 
          response.id === responseId ? { ...response, isRead: true } : response
        );

        queryClient.setQueryData(['/api/search-requests', 'single', id], {
          ...currentData,
          supplierResponses: updatedResponses
        });
      }
    },
  });

  // Clone request mutation
  const cloneRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await apiRequest<{success: boolean, request: SearchRequest}>(`/api/search-requests/${requestId}/clone`, 'POST');
      return response as {success: boolean, request: SearchRequest};
    },
    onSuccess: (response) => {
      toast({
        title: "Request cloned",
        description: `New request created with order number ${response.request.orderNumber}`,
      });
      if (response.request?.id) {
        navigate(`/requests/${response.request.id}`);
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to clone request",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p>Загрузка...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-red-500 mb-4">Error loading request details</p>
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const getDefaultRequest = (): SearchRequest => ({
    id: 0,
    orderNumber: '',
    productName: '',
    productDescription: '',
    timeline: '',
    additionalRequirements: null,
    status: 'pending',
    createdAt: null,
    matchedSuppliers: null
  } as SearchRequest);

  const { 
    request = getDefaultRequest(), 
    requestSuppliers = [], 
    supplierResponses = [] 
  } = data || {};

  const unreadResponsesCount = supplierResponses.filter(r => !r.isRead).length;
  // Считаем только уникальных поставщиков по email (первые запросы)
  const uniqueContactedSuppliers = new Set(requestSuppliers.map(rs => rs.supplierEmail)).size;
  const uniqueSupplierEmails = new Set(supplierResponses.map(r => r.supplierEmail)).size;
  const responseRate = uniqueContactedSuppliers > 0 ? Math.round((uniqueSupplierEmails / uniqueContactedSuppliers) * 100) : 0;
  const formattedDate = request?.createdAt 
    ? format(new Date(request.createdAt), 'dd.MM.yyyy')
    : "Unknown date";

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 pt-1 pb-1">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Назад
            </Link>
          </Button>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
                <TabsTrigger value="overview">Общее</TabsTrigger>
                <TabsTrigger value="responses" className="relative">
                  Ответы поставщиков ({uniqueSupplierEmails})
                  {unreadResponsesCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0">
                      {unreadResponsesCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="suppliers">Лист поставщиков</TabsTrigger>
                <TabsTrigger value="analysis" className="hidden">Анализ результатов</TabsTrigger>
              </TabsList>
          </Tabs>
          <h1 className="text-2xl font-bold">
            {request?.productName || 'НОСОК'}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 h-full">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsContent value="overview" className="mt-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{request.productName}</CardTitle>
                    <CardDescription>Создано: {formattedDate}</CardDescription>
                    <CardDescription>Запрос: № {request?.id || 'N/A'}</CardDescription>
                    <CardDescription>Код запроса: REQ-{request?.orderNumber || 'N/A'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Separator />
                    <div>
                      <h3 className="font-medium">Статус</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge className="px-3 py-1">
                          {request.status === "completed" ? "completed" : "active"}
                        </Badge>
                        <div className="flex gap-2">
                          {request.status !== "completed" ? (
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => updateStatusMutation.mutate({ id: request.id, status: "completed" })}
                              disabled={updateStatusMutation.isPending}
                            >
                              Отметить как завершенное
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: request.id, status: "active" })}
                              disabled={updateStatusMutation.isPending}
                            >
                              Сделать активным
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="mt-3">
                  <CardHeader>
                    <CardTitle>Статистика</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{uniqueContactedSuppliers}</p>
                        <p className="text-sm text-muted-foreground">Отправлено запросов</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{uniqueSupplierEmails}</p>
                        <p className="text-sm text-muted-foreground">Получено ответов</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{responseRate}%</p>
                        <p className="text-sm text-muted-foreground">конверсия</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="responses" className="mt-2">
                <ResponsePanel
                  supplierResponses={supplierResponses}
                  selectedResponses={selectedResponses}
                  setSelectedResponses={setSelectedResponses}
                  markAsReadMutation={markAsReadMutation}
                  requestId={request?.id}
                  onActiveResponseChange={handleSupplierSelect}
                  onExtractParameters={() => {
                    if (activeResponse) {
                      setForceParameterExtraction(true);
                    }
                  }}
                  onCheckNewOffers={() => checkEmailsMutation.mutate()}
                  isCheckingOffers={checkEmailsMutation.isPending}
                  onCompare={() => {
                    if (selectedResponses.length < 1) {
                      toast({
                        title: "Выберите поставщиков",
                        description: "Выберите хотя бы одного поставщика для анализа",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    const selectedSupplierResponses = supplierResponses.filter(
                      r => selectedResponses.includes(r.id)
                    );
                    
                    const processComparison = async () => {
                      try {
                        setIsCompareLoading(true);
                        localStorage.setItem("compareSuppliers", JSON.stringify(selectedSupplierResponses));
                        
                        // Добавляем информацию о сортировке по цене за единицу без НДС
                        localStorage.setItem("compareSortBy", "Цена за единицу без НДС");
                        localStorage.setItem("compareSortOrder", "asc");
                        
                        if (request?.id) {
                          localStorage.setItem("compareRequestId", request.id.toString());
                          navigate(`/compare-results/${request.id}`);
                        }
                      } catch (error) {
                        console.error("Error preparing comparison:", error);
                        toast({
                          title: "Ошибка",
                          description: "Не удалось подготовить сравнение поставщиков",
                          variant: "destructive"
                        });
                      } finally {
                        setIsCompareLoading(false);
                      }
                    };
                    
                    processComparison();
                  }}
                />
              </TabsContent>

              <TabsContent value="suppliers" className="mt-2">
                <ScrollArea className="h-[600px] rounded-md border p-4">
                  <div className="space-y-4">
                    {requestSuppliers.map((supplier) => (
                      <Card key={supplier.id} className={`${supplier.hasResponded ? "border-primary/50" : ""} mb-3`}>
                        <div className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold">{supplier.supplierName}</h3>
                                {supplier.hasResponded && (
                                  <Badge className="bg-primary/20 text-primary h-5">
                                    Есть ответ
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{supplier.supplierEmail}</p>
                              <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-muted-foreground">
                                {(supplier as any).supplierWebsite && (
                                  <a href={(supplier as any).supplierWebsite} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                                    {(supplier as any).supplierWebsite}
                                  </a>
                                )}
                                {(supplier as any).supplierPhone && (
                                  <span className="text-xs">
                                    {(supplier as any).supplierPhone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Accordion type="single" collapsible className="mt-2">
                            <AccordionItem value="messages" className="border-b-0">
                              <AccordionTrigger className="py-2 text-sm">История сообщений</AccordionTrigger>
                              <AccordionContent>
                                <div className="pt-2">
                                  <SupplierMessages 
                                    supplierId={supplier.id} 
                                    supplierName={supplier.supplierName}
                                    supplierEmail={supplier.supplierEmail}
                                    isRequestSupplierId={true}
                                    isInSuppliersList={true}
                                  />
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="analysis" className="mt-2">
                <AnalysisResultsTab requestId={request.id} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex flex-col justify-end">
            {/* OPTIMIZED: Parameter extraction panel - loads only when response is selected */}
            {tab === 'responses' && (
              <Card className="border-primary/30 h-[600px] overflow-hidden flex flex-col">
                <CardHeader className="bg-primary/5 flex-shrink-0">
                  <CardTitle className="font-semibold normal-case">Извлеченные параметры</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden min-h-0">
                  <div className="space-y-3 h-full min-h-0">
                    {activeResponse ? (
                      <ParameterExtractionStatus
                        key={`parameters-${activeResponse.id}`} // Force re-render when responseId changes
                        requestId={request?.id || 0}
                        responseId={activeResponse.id}
                        supplierEmail={activeResponse.supplierEmail || ''}
                        supplierName={activeResponse.supplierName || ''}
                        requestParameters={parametersData?.parameters || []}
                        forceExtract={forceParameterExtraction} 
                        onParametersExtracted={(parameters) => {
                          console.log('Parameters extracted:', parameters);
                          setForceParameterExtraction(false);
                        }}
                      />
                    ) : (
                      <div>
                        <p className="text-sm font-medium">Выберите ответ поставщика</p>
                        <p className="text-sm text-muted-foreground">
                          Чтобы увидеть статус извлечения параметров, выберите ответ поставщика из списка
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
