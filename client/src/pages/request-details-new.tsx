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
import { Split, BarChartHorizontal, FileText, Calendar, UserPlus } from "lucide-react";
import { useAnalysisResults } from "@/hooks/use-analysis-results";
import { ResponsePanel } from "@/components/response-panel";
import { AddToGroupButton } from "@/components/add-to-group-button";
import { extractParametersInBackground } from "@/services/background-parameter-extraction";
import { ParameterExtractionStatus } from "@/components/parameter-extraction-status";

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
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [activeResponse, setActiveResponse] = useState<SupplierResponse | null>(null);
  const [forceParameterExtraction, setForceParameterExtraction] = useState(false);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  
  // Track if first email has been auto-selected to avoid multiple selections
  const [hasAutoSelectedFirstEmail, setHasAutoSelectedFirstEmail] = useState(false);

  // Track last viewed request in localStorage
  useEffect(() => {
    if (id) {
      console.log('RequestDetails: Starting to track request ID:', id);
      
      // Get existing list of last viewed request IDs
      const existingIds = JSON.parse(localStorage.getItem('lastViewedRequestIds') || '[]');
      console.log('RequestDetails: Current localStorage IDs:', existingIds);
      
      // Remove current ID if it exists and add it to the beginning
      const filteredIds = existingIds.filter((existingId: number) => existingId !== id);
      const newIds = [id, ...filteredIds].slice(0, 3); // Keep only first 3
      
      console.log('RequestDetails: New IDs to save:', newIds);
      
      // Save updated list
      localStorage.setItem('lastViewedRequestIds', JSON.stringify(newIds));
      localStorage.setItem('lastViewedAt', new Date().toISOString());
      
      // Verify it was saved
      const saved = localStorage.getItem('lastViewedRequestIds');
      console.log('RequestDetails: Verification - saved in localStorage:', saved);
    }
  }, [id]);

  // Define type for the email check response
  interface EmailCheckResponse {
    success: boolean;
    message: string;
    newResponses: number;
    request?: SearchRequest;
    requestSuppliers?: RequestSupplier[];
    supplierResponses?: SupplierResponse[];
  }

  // Track background parameter extraction progress
  const [parameterExtractionProgress, setParameterExtractionProgress] = useState({ completed: 0, total: 0 });
  const [parameterExtractionStatus, setParameterExtractionStatus] = useState<'idle' | 'extracting' | 'completed' | 'failed'>('idle');
  
  // Function to start parameter extraction with progress tracking
  const startBackgroundParameterExtraction = (requestId: number, responses: SupplierResponse[]) => {
    // Filter out responses that might have been deleted
    const validResponses = responses.filter(response => response && response.id && response.id > 0);
    
    if (validResponses.length === 0) return;
    
    setParameterExtractionStatus('extracting');
    setParameterExtractionProgress({ completed: 0, total: validResponses.length });
    
    console.log(`Starting background parameter extraction for ${validResponses.length} responses in request ${requestId}`);
    
    extractParametersInBackground(requestId, validResponses, (completed, total) => {
      // Update extraction progress
      setParameterExtractionProgress({ completed, total });
      
      // Mark as completed when done
      if (completed === total) {
        setParameterExtractionStatus('completed');
      }
      
      console.log(`Parameter extraction progress: ${completed}/${total}`);
    }).catch(error => {
      console.error('Error in background parameter extraction:', error);
      setParameterExtractionStatus('failed');
    });
  };
  
  // Query to load request details with auto-refreshing
  const { data, isLoading, error, refetch } = useQuery<RequestDetailsData>({
    queryKey: ['/api/search-requests', id],
    queryFn: async () => {
      const response = await apiRequest<RequestDetailsData>(`/api/search-requests/${id}`, 'GET');
      if (response?.supplierResponses && id) {
        queryClient.setQueryData(['/api/supplier-responses', id], response.supplierResponses);
        
        // Start background parameter extraction for all responses with the saved request parameters
        if (response.supplierResponses.length > 0) {
          startBackgroundParameterExtraction(id, response.supplierResponses);
        }
      }
      return response;
    },
    enabled: !!id,
    // Disable automatic polling to prevent unwanted refreshes
    refetchInterval: false,
    staleTime: 300000, // Consider data stale after 5 minutes
    refetchOnWindowFocus: false // Only refetch when user manually checks emails
  });

                // Check emails mutation
                        const checkEmailsMutation = useMutation({
                          mutationFn: async () => {
                            return apiRequest<EmailCheckResponse>('/api/check-emails', 'POST', {
                              requestId: id
                            });
                          },
                          onSuccess: async (data: EmailCheckResponse) => {
                            if (data.newResponses > 0) {
                              // Clear all related caches comprehensively
                              await Promise.all([
                                queryClient.invalidateQueries({ queryKey: ['/api/search-requests', id] }),
                                queryClient.invalidateQueries({ queryKey: ['/api/supplier-responses'] }),
                                queryClient.invalidateQueries({ queryKey: ['/api/supplier-responses-batch'] }),
                                queryClient.removeQueries({ queryKey: ['/api/search-requests', id] })
                              ]);
                              
                              // Wait for cache clearing to complete
                              await new Promise(resolve => setTimeout(resolve, 200));
                              
                              // Force multiple refetches to ensure fresh data
                              const freshData = await refetch();
                              
                              // Also invalidate the query cache again after refetch
                              await queryClient.invalidateQueries({ queryKey: ['/api/search-requests', id] });
                              
                              // If we have fresh data, ensure the background extraction starts
                              if (freshData.data && freshData.data.supplierResponses && id) {
                                startBackgroundParameterExtraction(id, freshData.data.supplierResponses);
                              }
                              
                              toast({
                                title: "Email Check Complete",
                                description: `Found ${data.newResponses} new supplier responses`,
                                variant: "default"
                              });
                              setTab("responses");
                              
                              // Reset auto-selection flag so new emails can be auto-selected
                              setHasAutoSelectedFirstEmail(false);
                              
                              // Force immediate UI update by triggering a fresh refetch
                              await refetch();
                            } else {
                              toast({
                                title: "Email Check Complete",
                                description: "No new supplier responses found",
                                variant: "default"
                              });
                            }
                          }
                        });
                // Remove auto-check emails to prevent unwanted page refreshes
                // User will manually check emails when needed
                
                // Auto-select the first email when the tab is set to "responses"
                useEffect(() => {
                  if (tab === "responses" && !hasAutoSelectedFirstEmail && data && data.supplierResponses && data.supplierResponses.length > 0) {
                    // Get the first response
                    const firstResponse = data.supplierResponses[0];
                    
                    // Set this response as active
                    setActiveResponse(firstResponse);
                    
                    // Mark that we've auto-selected to prevent doing it again
                    setHasAutoSelectedFirstEmail(true);
                    
                    console.log("Auto-selected first email:", firstResponse.id);
                  }
                }, [tab, data?.supplierResponses, hasAutoSelectedFirstEmail]);

                // Update status mutation
                const updateStatusMutation = useMutation({
                  mutationFn: async ({ id, status }: { id: number; status: string }) => {
                    return apiRequest('/api/search-requests/' + id + '/status', 'PATCH', {
                      status
                    });
                  },
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: ['/api/search-requests', id] });
                    queryClient.invalidateQueries({ queryKey: ['/api/search-requests'] });
                  },
                });

                // Mark as read mutation
                const markAsReadMutation = useMutation({
                  mutationFn: async (responseId: number) => {
                    return apiRequest('/api/supplier-responses/' + responseId + '/read', 'PATCH');
                  },
                  onSuccess: async (_, responseId) => {
                    // Обновляем оба кеша для обеспечения консистентности данных
                    const requestIdNumber = typeof id === 'string' ? parseInt(id) : id;

                    // Получаем текущие данные из кеша для основного запроса
                    const currentData = queryClient.getQueryData<RequestDetailsData>(['/api/search-requests', id]);
                    if (currentData && currentData.supplierResponses) {
                      // Обновляем isRead у нужного ответа в кеше
                      const updatedResponses = currentData.supplierResponses.map(response => 
                        response.id === responseId ? { ...response, isRead: true } : response
                      );

                      // Обновляем данные в основном кеше
                      queryClient.setQueryData(['/api/search-requests', id], {
                        ...currentData,
                        supplierResponses: updatedResponses
                      });

                      // Обновляем также кеш для supplier-responses
                      queryClient.setQueryData(['/api/supplier-responses', requestIdNumber], updatedResponses);
                      
                      // Force invalidation to trigger re-renders
                      await queryClient.invalidateQueries({ queryKey: ['/api/search-requests', id], exact: false });
                    } else {
                      // Если по каким-то причинам у нас нет данных в кеше, используем полную инвалидацию
                      await queryClient.invalidateQueries({ queryKey: ['/api/search-requests', id] });
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
                    // Navigate to the new request
                    if (response.request && response.request.id) {
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

                // Create a cast function for default properties
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

                // Create default request and use it for the data
                const { 
                  request = getDefaultRequest(), 
                  requestSuppliers = [], 
                  supplierResponses = [] 
                } = data || {};
                const unreadResponsesCount = supplierResponses ? supplierResponses.filter(r => !r.isRead).length : 0;

                // Calculate response stats - count unique supplier emails
                const totalContacted = requestSuppliers.length;
                const uniqueSupplierEmails = new Set(supplierResponses.map(r => r.supplierEmail)).size;
                const responseRate = totalContacted > 0 ? Math.round((uniqueSupplierEmails / totalContacted) * 100) : 0;

                // Format date - with additional safety checks
                const formattedDate = request && request.createdAt 
                  ? format(new Date(request.createdAt), 'dd.MM.yyyy')
                  : "Unknown date";

                return (
                  <div className="min-h-screen bg-background">
                    <div className="container mx-auto px-4 py-8">
                      <div className="flex items-center mb-8">
                        <Button variant="outline" asChild className="mr-4">
                          <Link href="/dashboard">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                              <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Назад
                          </Link>
                        </Button>
                        <div>
                          <h1 className="text-3xl font-bold">
                            {request?.productName || 'НОСОК'}
                          </h1>
                          <div className="flex items-center mt-1 text-muted-foreground">


                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="md:col-span-3">
                          <Tabs value={tab} onValueChange={setTab}>
                            <TabsList>
                              <TabsTrigger value="overview">Общее</TabsTrigger>
                              <TabsTrigger value="responses" className="relative">
                                Ответы поставщиков ({new Set(supplierResponses.map(r => r.supplierEmail)).size})
                                {unreadResponsesCount > 0 && (
                                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0">
                                    {unreadResponsesCount}
                                  </Badge>
                                )}
                              </TabsTrigger>
                              <TabsTrigger value="suppliers">Лист поставщиков</TabsTrigger>
                              <TabsTrigger value="analysis">Анализ результатов</TabsTrigger>
                            </TabsList>
                            
                            

                            <TabsContent value="overview" className="mt-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    {request.productName}
                                  </CardTitle>
                                  <CardDescription>Создано: {formattedDate}</CardDescription>
                                  <CardDescription>Запрос: № {request?.id || 'N/A'}</CardDescription>
                                  <CardDescription>Код запроса:  REQ-{request?.orderNumber || 'N/A'}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">

                                  <Separator />

                                  <div className="grid grid-cols-1 gap-4 hidden">
                                    <div>
                                      <h3 className="font-medium ">Срок подачи предложений до:</h3>
                                      <span className="text-muted-foreground">
                                        {request.timeline && new Date(request.timeline).toLocaleDateString('ru-RU', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric'
                                        }).replace(/\./g, '-')}
                                      </span>
                                      <span className="text-xs text-gray-400"> (время по умолчанию: до 18 часов GMT+3)</span>
                                    </div>
                                    {/* Additional Requirements section removed */}
                                  </div>

                                  <Separator />

                                  <div>
                                    <h3 className="font-medium">Статус</h3>
                                    <div className="flex items-center gap-4 mt-2 ">
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

                              <Card className="mt-6">
                                <CardHeader>
                                  <CardTitle>Статистика</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="p-4 bg-muted rounded-lg">
                                      <p className="text-2xl font-bold">{totalContacted}</p>
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

                            <TabsContent value="responses" className="mt-6">
                              <ResponsePanel
                                supplierResponses={supplierResponses}
                                selectedResponses={selectedResponses}
                                setSelectedResponses={setSelectedResponses}
                                markAsReadMutation={markAsReadMutation}
                                requestId={request?.id}
                                onActiveResponseChange={(responseId, response) => {
                                  setActiveResponse(response);
                                }}
                                onExtractParameters={() => {
                                  if (activeResponse) {
                                    setForceParameterExtraction(true);
                                  }
                                }}
                                onCompare={() => {
                                  if (selectedResponses.length < 1) {
                                    toast({
                                      title: "Выберите поставщиков",
                                      description: "Выберите хотя бы одного поставщика для анализа",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  
                                  // Get selected responses
                                  const selectedSupplierResponses = supplierResponses.filter(
                                    r => selectedResponses.includes(r.id)
                                  );
                                  
                                  // Get original request parameters if available
                                  // If not, we'll use default parameters from the server
                                  const processComparison = async () => {
                                    try {
                                      setIsCompareLoading(true);
                                      
                                      // Save to localStorage (for backward compatibility)
                                      localStorage.setItem("compareSuppliers", JSON.stringify(selectedSupplierResponses));
                                      
                                      if (request?.id) {
                                        localStorage.setItem("compareRequestId", request.id.toString());
                                        
                                        // Skip the parameters page and go directly to results
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
                                  
                                  // Start the process
                                  processComparison();
                                }}
                              />
                            </TabsContent>
                            <TabsContent value="suppliers" className="mt-6">
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
                                          <AccordionItem value="messages" defaultValue="messages" className="border-b-0">
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

                            <TabsContent value="analysis" className="mt-6">
                              <AnalysisResultsTab requestId={request.id} />
                            </TabsContent>
                          </Tabs>
                        </div>

                        <div>
                          <Card>
                            <CardHeader>
                              <CardTitle>Действия</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              
                              
                              <Button 
                                className="w-full"
                                onClick={() => checkEmailsMutation.mutate()}
                                disabled={checkEmailsMutation.isPending}
                              >
                                {checkEmailsMutation.isPending ? "Проверка..." : "Проверить новые предложения"}
                              </Button>

                {/* Added button here */}
                {/* Заменяем кнопку на наш компонент для улучшения функциональности */}
                
              </CardContent>
            </Card>

            {/* Only show the "Статус контрагента" panel on the "Ответы поставщиков" tab */}
            {tab === 'responses' && (
              <Card className="mt-6 border-primary/30">
                <CardHeader className="bg-primary/5">
                  <CardTitle>Извлеченные параметры</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeResponse && (
                      <ParameterExtractionStatus
                        requestId={request?.id || 0}
                        responseId={activeResponse.id}
                        supplierEmail={activeResponse.supplierEmail || ''}
                        supplierName={activeResponse.supplierName || ''}
                        // Only force extraction when the user explicitly requests it
                        forceExtract={forceParameterExtraction} 
                        onParametersExtracted={(parameters) => {
                          console.log('Parameters extracted in supplier status section:', parameters);
                          // Additional analytics or actions can be added here if needed
                          setForceParameterExtraction(false);
                        }}
                      />
                    )}
                    {!activeResponse && (
                      <div>
                        <p className="text-sm font-medium">Выберите ответ поставщика</p>
                        <p className="text-sm text-muted-foreground">Чтобы увидеть статус извлечения параметров, выберите ответ поставщика из списка</p>
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