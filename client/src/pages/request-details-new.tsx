import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
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
import { RequestOverviewModal } from "@/components/request-overview-modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SentEmailsPanel } from "@/components/sent-emails-panel";

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
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white text-primary border-primary hover:bg-white hover:text-primary"
                  asChild
                >
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
  const [selectedResponses, setSelectedResponses] = useState<number[]>([]);
  const [activeResponse, setActiveResponse] = useState<SupplierResponse | null>(null);
  const [forceParameterExtraction, setForceParameterExtraction] = useState(false);
  const [parameterStatus, setParameterStatus] = useState<string>('idle');
  const [hasFilledParameters, setHasFilledParameters] = useState<boolean>(false);
  const [hasAttachmentParameters, setHasAttachmentParameters] = useState<boolean>(false);
  const [isParameterRefreshing, setIsParameterRefreshing] = useState(false);
  const [parameterRefreshHandler, setParameterRefreshHandler] = useState<(() => void) | null>(null);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [showSuppliersList, setShowSuppliersList] = useState(false);
  const [activeSupplierId, setActiveSupplierId] = useState<number | null>(null);
  const [forceRefreshSentEmails, setForceRefreshSentEmails] = useState(false);
  
  // Сброс флага forceRefresh после использования
  useEffect(() => {
    if (forceRefreshSentEmails) {
      const timer = setTimeout(() => {
        setForceRefreshSentEmails(false);
      }, 1000); // Сбрасываем через 1 секунду
      return () => clearTimeout(timer);
    }
  }, [forceRefreshSentEmails]);
  
  // Получаем userId для Socket.IO
  const userId = useUserId();
  
  // Socket.IO подключение для real-time уведомлений
  useSocket({
    userId: userId || undefined,
    onNewEmail: (data) => {
      console.log('🔔 RequestDetails: Received new email notification:', data);
      console.log('🔔 RequestDetails: Current request ID:', id);
      console.log('🔔 RequestDetails: New email request ID:', data.requestId);
      
      // Если новый email относится к текущему запросу, обновляем данные
      if (data.requestId === id) {
        console.log('✅ RequestDetails: New email for current request, refreshing data...');
        
        // Показываем уведомление
        toast({
          title: "Новое предложение получено!",
          description: `От ${data.supplier}: ${data.subject}`,
        });
        
        // Обновляем данные
        console.log('✅ RequestDetails: Invalidating queries...');
        queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'single', id] });
        queryClient.invalidateQueries({ queryKey: ['/api/supplier-responses', id] });
      } else {
        console.log('🔔 RequestDetails: New email for different request, ignoring');
      }
    }
  });
  
  // OPTIMIZED: Simplified auto-selection tracking
  const [hasAutoSelectedFirstEmail, setHasAutoSelectedFirstEmail] = useState(false);
  const [firstEmailViewStartTime, setFirstEmailViewStartTime] = useState<number | null>(null);
  const [hasUserManuallySelectedFirstEmail, setHasUserManuallySelectedFirstEmail] = useState(false);

  // OPTIMIZED: Simplified mark as read mutation (moved up so callbacks can depend on it)
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
      
      // Invalidate dashboard cache to sync unread counts
      queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/search-requests'] });
    },
  });

  // OPTIMIZED: Lazy handler for supplier selection - memoized to avoid re-renders
  const handleSupplierSelect = useCallback(async (responseId: number, response: SupplierResponse, isFirstEmailAutoSelected = false) => {
    setActiveResponse(response);
    console.log(`Selected supplier response: ${responseId}, isFirstEmailAutoSelected: ${isFirstEmailAutoSelected}`);
    
    // Special logic for first email: don't mark as read immediately if auto-selected
    if (!response.isRead) {
      if (isFirstEmailAutoSelected) {
        console.log(`First email auto-selected, keeping as unread for now: ${responseId}`);
        // Don't mark as read immediately for auto-selected first email
      } else {
        try {
          console.log(`Marking response ${responseId} as read`);
          // Add protection against duplicate calls
          if (!markAsReadMutation.isPending) {
            await markAsReadMutation.mutateAsync(responseId);
          }
        } catch (error) {
          console.error('Failed to mark as read:', error);
        }
      }
    }
    
    // NOTE: Parameter extraction will be triggered only when ParameterExtractionStatus component loads
  }, [markAsReadMutation]);

  // Function to clear active response (for when responses are deleted)
  const clearActiveResponse = useCallback(() => {
    setActiveResponse(null);
  }, []);

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
      console.log('🔍 REQUEST-DETAILS: Loading single request', id);
      const response = await apiRequest<RequestDetailsData>(`/api/search-requests/${id}`, 'GET');
      console.log('🔍 REQUEST-DETAILS: Loaded request', id, 'with', response?.supplierResponses?.length || 0, 'responses');
      // Cache supplier responses for potential future use
      if (response?.supplierResponses && id) {
        queryClient.setQueryData(['/api/supplier-responses', id], response.supplierResponses);
      }
      return response;
    },
    enabled: !!id,
    refetchInterval: false,
    staleTime: 30000, // 30 seconds - longer caching to reduce requests
    refetchOnWindowFocus: false, // Disable refetch on window focus to prevent loops
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
      }, {
        headers: {
          'x-manual-check': 'true'  // Помечаем как ручной запрос от пользователя
        }
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
          title: "Проверка email завершена",
          description: `Найдено ${data.newResponses} новых ответов от поставщиков`,
          variant: "default"
        });
        
        // Reset auto-selection for new emails
        setHasAutoSelectedFirstEmail(false);
        setActiveResponse(null);
      } else {
        toast({
          title: "Проверка email завершена",
          description: "Новых ответов от поставщиков не найдено",
          variant: "default"
        });
      }
    },
    onError: (error) => {
      console.error('Email check failed:', error);
      toast({
        title: "Ошибка проверки email",
        description: error instanceof Error ? error.message : "Не удалось проверить email",
        variant: "destructive"
      });
    }
  });

  // OPTIMIZED: Simplified auto-selection - when data loads
  useEffect(() => {
    if (!hasAutoSelectedFirstEmail && data?.supplierResponses && data.supplierResponses.length > 0) {
      const firstResponse = data.supplierResponses[0];
      
      // Use simplified selection without automatic parameter extraction
      handleSupplierSelect(firstResponse.id, firstResponse, true); // true = isFirstEmailAutoSelected
      setHasAutoSelectedFirstEmail(true);
      setFirstEmailViewStartTime(Date.now());
      
      console.log("Auto-selected first email:", firstResponse.id);
    }
  }, [data?.supplierResponses, hasAutoSelectedFirstEmail]);

  // Reset auto-select flag when request id changes to avoid loops across requests
  useEffect(() => {
    setHasAutoSelectedFirstEmail(false);
    setFirstEmailViewStartTime(null);
    setHasUserManuallySelectedFirstEmail(false);
  }, [id]);

  // Update activeResponse when supplierResponses change (new emails arrive)
  useEffect(() => {
    if (!data?.supplierResponses || !activeResponse) return;
    
    // Check if the currently active response still exists in the updated list
    const currentActiveResponse = data.supplierResponses.find(r => r.id === activeResponse.id);
    
    if (!currentActiveResponse) {
      // If the active response no longer exists, select the first one
      console.log('Active response no longer exists, selecting first response');
      const firstResponse = data.supplierResponses[0];
      if (firstResponse) {
        setActiveResponse(firstResponse);
      }
    } else {
      // Update the active response with fresh data from the server
      setActiveResponse(currentActiveResponse);
    }
  }, [data?.supplierResponses, activeResponse]);

  // Handle first email read logic
  useEffect(() => {
    if (!activeResponse || !data?.supplierResponses) return;
    
    const firstResponse = data.supplierResponses[0];
    if (activeResponse.id !== firstResponse.id) return;
    
    // If this is the first email and it's unread
    if (!firstResponse.isRead) {
      // If user manually selected it (not auto-selected), mark as read immediately
      if (hasUserManuallySelectedFirstEmail) {
        console.log(`User manually selected first email, marking as read: ${firstResponse.id}`);
        markAsReadMutation.mutate(firstResponse.id);
        return;
      }
      
      // If auto-selected, check if 10 seconds have passed
      if (firstEmailViewStartTime && Date.now() - firstEmailViewStartTime > 10000) {
        console.log(`10 seconds passed for first email, marking as read: ${firstResponse.id}`);
        markAsReadMutation.mutate(firstResponse.id);
      }
    }
  }, [activeResponse, data?.supplierResponses, hasUserManuallySelectedFirstEmail, firstEmailViewStartTime]);

  // Удалена автоматическая проверка email - теперь только по кнопке

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

  // (definition moved above)

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
      <div className="container mx-auto px-4 pt-0.5 pb-0.5">

        {/* Request signature only */}
        <div className="flex justify-end items-center pt-2 pb-2">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none">{request?.productName || '-'}</span>
            <RequestOverviewModal
              request={request}
              requestSuppliers={requestSuppliers}
              supplierResponses={supplierResponses}
              onStatusUpdate={(id, status) => updateStatusMutation.mutate({ id, status })}
              isUpdatingStatus={updateStatusMutation.isPending}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-3 h-full">

            {/* Main content - show ResponsePanel or Suppliers list */}
            {!showSuppliersList ? (
              <ResponsePanel
                supplierResponses={supplierResponses}
                selectedResponses={selectedResponses}
                setSelectedResponses={setSelectedResponses}
                markAsReadMutation={markAsReadMutation}
                requestId={request?.id}
                onActiveResponseChange={(responseId, response) => {
                  // Check if this is the first email and user is manually selecting it
                  const firstResponse = data?.supplierResponses?.[0];
                  if (firstResponse && responseId === firstResponse.id) {
                    setHasUserManuallySelectedFirstEmail(true);
                    setFirstEmailViewStartTime(Date.now()); // Reset timer for manual selection
                  }
                  handleSupplierSelect(responseId, response, false); // false = not auto-selected
                }}
                onExtractParameters={() => {
                  if (activeResponse) {
                    setForceParameterExtraction(true);
                  }
                }}
                onCheckNewOffers={() => checkEmailsMutation.mutate()}
                isCheckingOffers={checkEmailsMutation.isPending}
                onShowSuppliers={() => {
                  setShowSuppliersList(true);
                  setForceRefreshSentEmails(true); // Принудительно обновляем отправленные сообщения
                }}
                unreadCount={unreadResponsesCount}
                sentCount={requestSuppliers.length}
                requestName={request?.productName}
                request={request}
                requestSuppliers={requestSuppliers}
                onStatusUpdate={(id, status) => updateStatusMutation.mutate({ id, status })}
                isUpdatingStatus={updateStatusMutation.isPending}
                onClearActiveResponse={clearActiveResponse}
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
            ) : (
              /* Sent emails panel */
              <SentEmailsPanel
                requestSuppliers={requestSuppliers}
                onEmailSelect={(supplier) => setActiveSupplierId(supplier.id)}
                activeSupplierId={activeSupplierId}
                onToggleBack={() => {
                  setShowSuppliersList(false);
                  setActiveSupplierId(null);
                }}
                request={request}
                forceRefresh={forceRefreshSentEmails}
                sentCount={requestSuppliers.length}
              />
            )}
          </div>

          <div className="flex flex-col justify-end">
            {/* OPTIMIZED: Parameter extraction panel - loads only when response is selected and there are responses */}
            {!showSuppliersList && supplierResponses.length > 0 && (
              <Card className="border-primary/30 h-[600px] overflow-hidden flex flex-col rounded-md">
                <CardHeader className="bg-primary/5 flex-shrink-0 py-3">
                  <CardTitle className="text-sm font-medium normal-case h-6 flex items-center justify-between">
                    <span>Извлеченные параметры</span>
                    <div className="flex items-center space-x-2">
                      {parameterStatus === 'success' && (
                        <>
                          <div className="relative group">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              !hasFilledParameters 
                                ? 'bg-red-100' 
                                : hasAttachmentParameters 
                                  ? 'bg-yellow-100' 
                                  : 'bg-green-100'
                            }`}>
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="12" 
                                height="12" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="3" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                className={
                                  !hasFilledParameters 
                                    ? 'text-red-600' 
                                    : hasAttachmentParameters 
                                      ? 'text-yellow-600' 
                                      : 'text-green-600'
                                }
                              >
                                {!hasFilledParameters ? (
                                  <path d="M18 6L6 18M6 6l12 12" />
                                ) : hasAttachmentParameters ? (
                                  <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                ) : (
                                  <path d="M20 6L9 17l-5-5" />
                                )}
                              </svg>
                            </div>
                            {/* Tooltip on hover */}
                            <div className="absolute top-full right-0 transform-none mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 shadow">
                              {!hasFilledParameters 
                                ? 'Параметры не заполнены' 
                                : hasAttachmentParameters 
                                  ? 'Параметры из OCR/картинок - проверьте данные' 
                                  : 'Параметры заполнены'}
                            </div>
                          </div>
                          <div className="relative group">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="p-1.5 h-8 w-8 hover:bg-slate-100 rounded-full transition-colors duration-200"
                              onClick={parameterRefreshHandler || (() => {})}
                              disabled={isParameterRefreshing}
                              tabIndex={0}
                            >
                              <RefreshCw 
                                size={14} 
                                className={`text-slate-500 hover:text-slate-700 transition-colors duration-200 ${isParameterRefreshing ? 'animate-spin' : ''}`}
                              />
                            </Button>
                            {/* Tooltip on hover */}
                            <div className="absolute top-full right-0 transform-none mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 shadow">
                              Обновить параметры
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden min-h-0">
                  <div className="flex flex-col h-full min-h-0">
                    {activeResponse ? (
                      <ParameterExtractionStatus
                        key={`parameters-${activeResponse.id}`} // Force re-render when responseId changes
                        requestId={request?.id || 0}
                        responseId={activeResponse.id}
                        supplierEmail={activeResponse.supplierEmail || ''}
                        supplierName={activeResponse.supplierName || ''}
                        requestParameters={parametersData?.parameters || []}
                        forceExtract={forceParameterExtraction} 
                        onParametersExtracted={async (parameters) => {
                          console.log('Parameters extracted:', parameters);
                          setForceParameterExtraction(false);
                          
                          // Обновляем кэш для отображения новых параметров в UI
                          try {
                            console.log('🔄 Refreshing cache after parameter extraction...');
                            await queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'single', id] });
                            await queryClient.invalidateQueries({ queryKey: ['/api/supplier-responses', id] });
                            // НЕ вызываем refetch() - это может вызвать бесконечный цикл
                            console.log('✅ Cache refreshed after parameter extraction');
                          } catch (error) {
                            console.error('❌ Failed to refresh cache after parameter extraction:', error);
                          }
                        }}
                        onStatusChange={(status, isRefreshing, onRefresh) => {
                          setParameterStatus(status);
                          setIsParameterRefreshing(isRefreshing);
                          setParameterRefreshHandler(() => onRefresh);
                        }}
                        onParametersFilledChange={(hasFilled) => {
                          setHasFilledParameters(hasFilled);
                        }}
                        onAttachmentParametersChange={(hasAttachment) => {
                          setHasAttachmentParameters(hasAttachment);
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