import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useToast, toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  type SearchRequest,
  type RequestSupplier,
  type SupplierResponse,
  type EmailAttachment,
  type AnalysisResult,
} from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check,
  ArrowUpDown,
  ChevronRight,
  Split,
  FileText,
  Calendar,
  BarChart2,
} from "lucide-react";
import { useAnalysisResults } from "@/hooks/use-analysis-results";
// Import the AddToContactGroup component for single supplier
import { AddToContactGroup } from "@/components/add-to-contact-group";

interface RequestDetailsData {
  request: SearchRequest;
  requestSuppliers: RequestSupplier[];
  supplierResponses: SupplierResponse[];
}

export default function RequestDetails() {
  const [, params] = useRoute<{ id: string }>("/requests/:id");
  const id = params?.id ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  
  // Функция для чтения параметра tab из URL
  const getTabFromUrl = () => {
    const searchString = window.location.search;
    const params = new URLSearchParams(searchString);
    return params.get('tab') || "overview";
  };
  
  // Изначально устанавливаем tab в соответствии с параметром URL
  const [tab, setTab] = useState<string>(getTabFromUrl());
  
  // Обновляем URL при изменении вкладки
  const updateTabInUrl = (newTab: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', newTab);
    window.history.replaceState({}, '', url.toString());
  };
  
  // Этот эффект запускается при монтировании компонента и изменении URL
  useEffect(() => {
    console.log("Initial tab from URL:", getTabFromUrl());
    
    // Принудительно устанавливаем tab из URL при первой загрузке
    const initialTab = getTabFromUrl();
    setTab(initialTab);
    console.log("Setting initial tab to:", initialTab);
    
    // Добавляем слушатель события на изменение URL
    const handleLocationChange = () => {
      const newTab = getTabFromUrl();
      console.log(`URL changed, new tab: ${newTab}`);
      setTab(newTab);
    };
    
    // Добавить обработчик события
    window.addEventListener('popstate', handleLocationChange);
    
    // Очистка при размонтировании
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);
  
  // Обновляем URL при переключении табов через TabsTrigger
  useEffect(() => {
    if (tab) {
      console.log("Tab changed to:", tab);
      updateTabInUrl(tab);
    }
  }, [tab]);
  const [selectedResponses, setSelectedResponses] = useState<number[]>([]);
  const [showCompareDialog, setShowCompareDialog] = useState(false);

  // Define type for the email check response
  interface EmailCheckResponse {
    success: boolean;
    message: string;
    newResponses: number;
    request?: SearchRequest;
    requestSuppliers?: RequestSupplier[];
    supplierResponses?: SupplierResponse[];
  }

  // Query to load request details
  const { data, isLoading, error, refetch } = useQuery<RequestDetailsData>({
    queryKey: ["/api/search-requests", id],
    queryFn: async () => {
      const response = await apiRequest<RequestDetailsData>(
        `/api/search-requests/${id}`,
        "GET",
      );
      return response;
    },
    enabled: !!id,
    retry: 3,
    retryDelay: 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 0,
  });

  // Check emails mutation
  const checkEmailsMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return apiRequest<EmailCheckResponse>("/api/check-emails", "POST", {
        requestId,
      });
    },
    onSuccess: (data: EmailCheckResponse) => {
      // Use the response data directly if provided instead of refetching
      if (data.request && data.requestSuppliers && data.supplierResponses) {
        // Update the QueryClient cache with the new data
        queryClient.setQueryData(["/api/search-requests", id], {
          request: data.request,
          requestSuppliers: data.requestSuppliers,
          supplierResponses: data.supplierResponses,
        });

        // Show toast for new responses
        if (data.newResponses > 0) {
          toast({
            title: "Email Check Complete",
            description: (
              <div className="flex flex-col gap-2">
                <p>{`Found ${data.newResponses} new supplier ${data.newResponses === 1 ? "response" : "responses"}`}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTab("responses")}
                  className="mt-1"
                >
                  Посмотреть ответы
                </Button>
              </div>
            ),
            variant: "default",
          });
        } else {
          toast({
            title: "Email Check Complete",
            description: "No new supplier responses found",
            variant: "default",
          });
        }
      } else {
        // Fallback to refetching if the data isn't provided in the response
        refetch();

        // Show success message with the number of new responses found
        if (data.newResponses > 0) {
          toast({
            title: "Email Check Complete",
            description: (
              <div className="flex flex-col gap-2">
                <p>{`Found ${data.newResponses} new supplier ${data.newResponses === 1 ? "response" : "responses"}`}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTab("responses")}
                  className="mt-1"
                >
                  Посмотреть ответы
                </Button>
              </div>
            ),
            variant: "default",
          });
        } else {
          toast({
            title: "Email Check Complete",
            description: "No new supplier responses found",
            variant: "default",
          });
        }
      }
    },
  });

  // Get last check time from localStorage
  const getLastCheckTime = (requestId: number) => {
    const stored = localStorage.getItem(`last_email_check_${requestId}`);
    return stored ? parseInt(stored) : 0;
  };

  // Store last check time
  const setLastCheckTime = (requestId: number) => {
    localStorage.setItem(`last_email_check_${requestId}`, Date.now().toString());
  };

  // Check emails based on time threshold
  useEffect(() => {
    if (data?.request?.id) {
      const lastCheck = getLastCheckTime(data.request.id);
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
      const timeSinceLastCheck = Date.now() - lastCheck;

      if (timeSinceLastCheck >= fiveMinutes) {
        console.log("Checking emails - more than 5 minutes since last check");
        checkEmailsMutation.mutate(data.request.id);
        setLastCheckTime(data.request.id);
      }
    }
  }, [data?.request?.id]);

  // Store check time after manual check
  const handleManualCheck = () => {
    if (data?.request?.id) {
      checkEmailsMutation.mutate(data.request.id);
      setLastCheckTime(data.request.id);
    }
  };

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("/api/search-requests/" + id + "/status", "PATCH", {
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/search-requests", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/search-requests"] });
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (responseId: number) => {
      return apiRequest(
        "/api/supplier-responses/" + responseId + "/read",
        "PATCH",
      );
    },
      onSuccess: (_, responseId) => {
        queryClient.invalidateQueries({ queryKey: ['/api/search-requests'] });
        queryClient.invalidateQueries({ queryKey: ['/api/supplier-responses'] });
    },
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
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-red-500 font-medium">
                Ошибка загрузки данных
              </div>
              <p className="text-muted-foreground text-sm">
                {error instanceof Error
                  ? error.message
                  : "Unexpected error occurred"}
              </p>
              <Button
                variant="secondary"
                onClick={() => setLocation("/dashboard")}
                className="mt-2"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create a cast function for default properties
  const getDefaultRequest = (): SearchRequest =>
    ({
      id: 0,
      orderNumber: "",
      productName: "",
      productDescription: "",
      timeline: "",
      additionalRequirements: null,
      status: "pending",
      createdAt: null,
      matchedSuppliers: null,
    }) as SearchRequest;

  // Create default request and use it for the data
  const {
    request = getDefaultRequest(),
    requestSuppliers = [],
    supplierResponses = [],
  } = data || {};
  const unreadResponsesCount = supplierResponses
    ? supplierResponses.filter((r) => !r.isRead).length
    : 0;

  // Calculate response stats
  const totalContacted = requestSuppliers.length;

  // Count only unique email addresses in responses
  const uniqueEmails = new Set(
    supplierResponses.map((response) => response.supplierEmail),
  );
  const totalResponded = uniqueEmails.size;

  const responseRate =
    totalContacted > 0
      ? Math.round((totalResponded / totalContacted) * 100)
      : 0;

  // Format date - with additional safety checks
  const formattedDate =
    request && request.createdAt
      ? format(new Date(request.createdAt), "dd.MM.yyyy")
      : "Unknown date";

  const handleComplete = () => {
    updateStatusMutation.mutate({ id: request.id, status: "completed" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button variant="outline" asChild className="mr-4">
            <Link href="/dashboard">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">
            {request?.productName || "Request Details"}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Tabs 
              value={tab} 
              onValueChange={(newValue) => {
                setTab(newValue);
                updateTabInUrl(newValue);
              }}>
              <TabsList>
                <TabsTrigger value="overview">Обзор</TabsTrigger>
                  <TabsTrigger value="responses" className="relative">
                    Ответы поставщиков ({supplierResponses.length})
                  {unreadResponsesCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0"
                    >
                      {unreadResponsesCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="suppliers">Поставщики</TabsTrigger>
                <TabsTrigger value="analysis">Результаты анализа</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{request.productName}</CardTitle>
                    <CardDescription>Создано {formattedDate}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-medium">Описание</h3>
                      <p className="mt-1 text-muted-foreground">
                        {request.productDescription || "Нет описания"}
                      </p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <h3 className="font-medium">
                          Срок подачи предложений до:
                        </h3>
                        <p className="mt-1 text-muted-foreground">
                          {request.timeline && request.timeline.indexOf("T") > 0
                            ? format(new Date(request.timeline), "dd-MM-yyyy")
                            : request.timeline}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          время по умолчанию: до 18 часов (GMT+3)
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-medium">Статус</h3>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge
                          className="px-3 py-1"
                          variant={
                            request.status === "active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {request.status === "completed"
                            ? "completed"
                            : "active"}
                        </Badge>
                        <div className="flex gap-2">
                          {request.status !== "completed" ? (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={handleComplete}
                              disabled={updateStatusMutation.isPending}
                            >
                              Отметить как завершенный
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: request.id,
                                  status: "active",
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              Отметить как активный
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Response Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{totalContacted}</p>
                        <p className="text-sm text-muted-foreground">
                          Suppliers Contacted
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{totalResponded}</p>
                        <p className="text-sm text-muted-foreground">
                          Unique Suppliers Responded
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{responseRate}%</p>
                        <p className="text-sm text-muted-foreground">
                          Response Rate
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="responses" className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">
                    Ответы поставщиков ({supplierResponses.length})
                  </h2>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCompareDialog(true)}
                      disabled={selectedResponses.length < 2}
                    >
                      <BarChart2 className="h-4 w-4 mr-2" />
                      Сравнить выбранных ({selectedResponses.length})
                    </Button>

                    {selectedResponses.length === 1 &&
                      (() => {
                        const activeResponse = supplierResponses.find(
                          (r) => r.id === selectedResponses[0],
                        );
                        if (!activeResponse) return null;

                        // Parse supplierId as number if possible, or use a fallback (1)
                        const numericSupplierId =
                          parseInt(activeResponse.supplierId) || 1;

                        return (
                          <AddToContactGroup
                            supplierId={numericSupplierId}
                            supplierName={
                              activeResponse.supplierName || "Unknown Supplier"
                            }
                            supplierEmail={activeResponse.supplierEmail || ""}
                            variant="outline"
                          />
                        );
                      })()}
                  </div>
                </div>

                {supplierResponses.length > 0 ? (
                  <div className="space-y-4">
                    <Dialog
                      open={showCompareDialog}
                      onOpenChange={setShowCompareDialog}
                    >
                      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Сравнить ответы поставщиков</DialogTitle>
                        </DialogHeader>

                        {selectedResponses.length >= 2 ? (
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            {selectedResponses.slice(0, 2).map((responseId) => {
                              const response = supplierResponses.find(
                                (r) => r.id === responseId,
                              );
                              if (!response) return null;

                              return (
                                <Card
                                  key={responseId}
                                  className="overflow-hidden"
                                >
                                  <CardHeader className="pb-2 bg-muted/50">
                                    <CardTitle className="text-base">
                                      {response.supplierName}
                                    </CardTitle>
                                    <CardDescription>
                                      {response.supplierEmail}
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent className="p-4">
                                    <p className="font-medium">
                                      {(response as any).subject ||
                                        "(No subject)"}
                                    </p>
                                    <div className="mt-2 text-sm text-muted-foreground whitespace-pre-line max-h-[300px] overflow-y-auto border rounded-md p-2">
                                      {typeof (response as any).content ===
                                      "string"
                                        ? (response as any).content
                                        : "(No content)"}
                                    </div>

                                    {/* Attachments summary */}
                                    {(() => {
                                      const attachments =
                                        (response as any).attachments || [];
                                      if (attachments.length > 0) {
                                        return (
                                          <div className="mt-4 pt-4 border-t">
                                            <p className="text-sm font-medium">
                                              Attachments: {attachments.length}
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                              {attachments.map(
                                                (att: any, i: number) => (
                                                  <a
                                                    key={i}
                                                    href={`/api/attachments/${response.id}/${i}/download`}
                                                    download={att.filename}
                                                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                  >
                                                    <svg
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      width="16"
                                                      height="16"
                                                      viewBox="0 0 24 24"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      strokeWidth="2"
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                    >
                                                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                                    </svg>
                                                    <span>{att.filename}</span>
                                                    <span className="text-gray-400">
                                                      (
                                                      {Math.round(
                                                        att.size / 1024,
                                                      )}
                                                      KB)
                                                    </span>
                                                  </a>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-center p-4">
                            Выберете не менее двух поставщиков для сравнения
                          </p>
                        )}

                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setShowCompareDialog(false)}
                          >
                            Close
                          </Button>
                          <Button
                            onClick={() => {
                              // Navigate to comparison page with selected responses
                              const selectedResponsesParam = selectedResponses.join(',');
                              setLocation(`/compare-results/${id}?responses=${selectedResponsesParam}`);
                            }}
                            disabled={selectedResponses.length < 2}
                          >
                            <BarChart2 className="h-4 w-4 mr-2" />
                            Перейти к сравнению
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Two-panel layout for responses */}
                    <div className="grid grid-cols-[2fr_250px] h-[600px] border rounded-md">
                      {/* Left panel - Response list */}
                      <div className="border-r overflow-hidden">
                        <div className="p-3 bg-muted/30 border-b">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="select-all-responses"
                              checked={
                                selectedResponses.length ===
                                supplierResponses.length
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  // Select all responses
                                  setSelectedResponses(
                                    supplierResponses.map((r) => r.id),
                                  );
                                } else {
                                  // Deselect all responses
                                  setSelectedResponses([]);
                                }
                              }}
                            />
                            <label
                              htmlFor="select-all-responses"
                              className="text-sm font-medium cursor-pointer"
                            >
                              {selectedResponses.length ===
                              supplierResponses.length
                                ? "Снять выбор"
                                : "Выбрать всех"}
                            </label>
                          </div>
                        </div>

                        <ScrollArea className="h-[calc(600px-48px)]">
                          {supplierResponses.map((response) => {
                            // Check if this response is currently selected for viewing
                            const isActive =
                              selectedResponses.length === 1 &&
                              selectedResponses[0] === response.id;

                            return (
                              <div
                                key={response.id}
                                className={`
                                  p-3 border-b cursor-pointer flex items-start gap-2 hover:bg-muted/20 transition-colors
                                  ${!response.isRead ? "bg-primary/5" : ""}
                                  ${isActive ? "bg-primary/10 hover:bg-primary/15" : ""}
                                `}
                                onClick={() => {
                                  // When clicked, select only this response for viewing
                                  setSelectedResponses([response.id]);
                                }}
                              >
                                <Checkbox
                                  id={`response-${response.id}`}
                                  checked={selectedResponses.includes(
                                    response.id,
                                  )}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedResponses((prev) => [
                                        ...prev,
                                        response.id,
                                      ]);
                                    } else {
                                      setSelectedResponses((prev) =>
                                        prev.filter((id) => id !== response.id),
                                      );
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()} // Prevent row click when checkbox is clicked
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-sm truncate">
                                      {response.supplierName}
                                    </div>
                                    {!response.isRead && (
                                      <Badge
                                        variant="outline"
                                        className="bg-primary/10 text-primary ml-2 flex-shrink-0"
                                      >
                                        New
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate mt-1">
                                    {(response as any).subject ||
                                      "(No subject)"}
                                  </div>
                                  <div className="text-xs mt-1 flex justify-between items-center">
                                    <span className="text-muted-foreground">
                                      {response.responseDate
                                        ? format(
                                            new Date(response.responseDate),
                                            "dd.MM HH:mm",
                                          )
                                        : ""}
                                    </span>

                                    {((response as any).attachments || [])
                                      .length > 0 && (
                                      <span className="flex items-center text-muted-foreground">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="12"
                                          height="12"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </svg>
                                        <span className="ml-1">
                                          {
                                            (
                                              (response as any).attachments ||
                                              []
                                            ).length
                                          }
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </ScrollArea>
                      </div>

                      {/* Right panel - Selected response content */}
                      <div className="overflow-hidden flex flex-col">
                        {selectedResponses.length === 1 ? (
                          (() => {
                            // Find the selected response
                            const response = supplierResponses.find(
                              (r) => r.id === selectedResponses[0],
                            );
                            if (!response) return null;

                            // If response exists and is unread, mark it as read
                            if (!response.isRead) {
                              markAsReadMutation.mutate(response.id);
                            }

                            return (
                              <>
                                <div className="p-4 border-b bg-muted/20">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h3 className="font-medium">
                                        {(response as any).subject ||
                                          "(No subject)"}
                                      </h3>
                                      <div className="text-muted-foreground text-sm mt-1">
                                        From:{" "}
                                        <span className="font-medium">
                                          {response.supplierName}
                                        </span>{" "}
                                        &lt;{response.supplierEmail}&gt;
                                      </div>
                                      <div className="text-muted-foreground text-xs mt-1">
                                        {response.responseDate
                                          ? format(
                                              new Date(response.responseDate),
                                              "dd MMMM yyyy, HH:mm",
                                            )
                                          : ""}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <ScrollArea className="flex-1 p-4">
                                  <div className="space-y-4">
                                    {/* Email content */}
                                    <div className="whitespace-pre-line text-sm">
                                      {typeof (response as any).content ===
                                      "string"
                                        ? (response as any).content
                                        : "(No content)"}
                                    </div>

                                    {/* Attachments */}
                                    {(() => {
                                      const attachments =
                                        (response as any).attachments || [];
                                      if (attachments.length > 0) {
                                        return (
                                          <div className="mt-8 border-t pt-4">
                                            <h4 className="text-sm font-medium mb-2">
                                              Attachments ({attachments.length})
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                              {attachments.map(
                                                (
                                                  attachment: any,
                                                  i: number,
                                                ) => (
                                                  <a
                                                    key={i}
                                                    href="#"
                                                    className="inline-flex items-center gap-2 px-3 py-2 border border-primary/20 rounded-lg hover:bg-primary/5 hover:border-primary/40 transition-colors"
                                                    onClick={async (e) => {
                                                      e.preventDefault();
                                                      try {
                                                        window.open(
                                                          `/api/attachments/${response.id}/${i}/download`,
                                                          "_blank",
                                                        );
                                                      } catch (error) {
                                                        console.error(
                                                          "Download failed:",
                                                          error,
                                                        );
                                                        toast({
                                                          title:
                                                            "Download Failed",
                                                          description:
                                                            "Failed to download attachment. Please try again.",
                                                          variant:
                                                            "destructive",
                                                        });
                                                      }
                                                    }}
                                                  >
                                                    <svg
                                                      className="text-primary"
                                                      xmlns="http://www.w3.org/2000/svg"
                                                      width="16"
                                                      height="16"
                                                      viewBox="0 0 24 24"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      strokeWidth="2"
                                                      strokeLinecap="round"
                                                      strokeLinejoin="round"
                                                    >
                                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                      <polyline points="7 10 12 15 17 10" />
                                                      <line
                                                        x1="12"
                                                        y1="15"
                                                        x2="12"
                                                        y2="3"
                                                      />
                                                    </svg>
                                                    <div>
                                                      <span className="text-sm font-medium">
                                                        {attachment.filename}
                                                      </span>
                                                      <span className="text-xs text-muted-foreground ml-2">
                                                        (
                                                        {Math.round(
                                                          attachment.size /
                                                            1024,
                                                        )}
                                                        KB)
                                                      </span>
                                                    </div>
                                                  </a>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </ScrollArea>
                              </>
                            );
                          })()
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <p className="mb-2">
                              {selectedResponses.length > 1
                                ? "Multiple responses selected"
                                : "No response selected"}
                            </p>
                            <p className="text-sm">
                              {selectedResponses.length > 1
                                ? 'Click "Compare Selected" to view a comparison'
                                : "Select a response from the list to view its contents"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <p className="text-muted-foreground mb-4">
                        No responses received yet
                      </p>
                      <p className="text-sm text-center max-w-md">
                        Когда поставщики ответят на ваш запрос, их ответы
                        появятся здесь.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="suppliers" className="mt-6">
                <ScrollArea className="h-[600px] rounded-md border p-4">
                  <div className="space-y-4">
                    {requestSuppliers.map((supplier) => (
                      <Card
                        key={supplier.id}
                        className={
                          supplier.hasResponded ? "border-primary/50" : ""
                        }
                      >
                        <CardHeader className="pb-2">
                          <div className="flex justify-between">
                            <CardTitle className="text-base">
                              {supplier.supplierName}
                            </CardTitle>
                            {supplier.hasResponded && (
                              <Badge className="bg-primary/20 text-primary">
                                Responded
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 mt-1">
                            <CardDescription>
                              {supplier.supplierEmail}
                            </CardDescription>
                            {(supplier as any).supplierWebsite && (
                              <CardDescription className="text-xs">
                                Website:{" "}
                                <a
                                  href={(supplier as any).supplierWebsite}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {(supplier as any).supplierWebsite}
                                </a>
                              </CardDescription>
                            )}
                            {(supplier as any).supplierPhone && (
                              <CardDescription className="text-xs">
                                Phone: {(supplier as any).supplierPhone}
                              </CardDescription>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Accordion type="single" collapsible>
                            <AccordionItem value="email">
                              <AccordionTrigger>
                                Посмотреть отправленный емайл{" "}
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="p-4 bg-muted rounded-md mt-2">
                                  <p className="font-medium mb-2">
                                    Subject: {supplier.emailSubject}
                                  </p>
                                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                                    {supplier.emailContent}
                                  </p>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </CardContent>
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
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={handleManualCheck}
                  disabled={checkEmailsMutation.isPending}
                >
                  {checkEmailsMutation.isPending
                    ? "Checking..."
                    : "Check for New Emails"}
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Tracking Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Номер запроса</p>
                    <p className="text-sm text-muted-foreground">
                      {request.orderNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Создано</p>
                    <p className="text-sm text-muted-foreground">
                      {formattedDate}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Analysis Results Tab Component
interface AnalysisResultsTabProps {
  requestId: number;
}

function AnalysisResultsTab({ requestId }: AnalysisResultsTabProps) {
  const {
    data: analysisResults,
    isLoading,
    error,
  } = useAnalysisResults(requestId);

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p>Loading analysis results...</p>
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
          <p className="text-muted-foreground mb-4">
            No analysis results found for this request
          </p>
          <p className="text-sm text-muted-foreground">
            Compare supplier responses and generate an analysis to see results
            here.
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
        <h2 className="text-xl font-semibold">
          Результаты анализа ({sortedResults.length})
        </h2>
        
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
                      {result.dateCreated &&
                        format(
                          new Date(result.dateCreated),
                          "dd MMM yyyy, HH:mm",
                        )}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/analysis/${result.id}`}>
                    <FileText className="h-4 w-4 mr-1" />
                    Результаты анализа
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