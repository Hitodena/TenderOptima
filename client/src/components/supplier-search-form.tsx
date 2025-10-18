import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { searchRequestFormSchema, type SearchRequest, type Supplier } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Globe, ChevronDown, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { universalSearchService } from "@/services/universal-search";

// Структура регионов с подрегионами
import { regionsData, allRegionsList, type Country, type Region, type City } from "@/data/regions";

interface Props {
  onComplete: (request: SearchRequest) => void;
}

export function SupplierSearchForm({ onComplete }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States for the new features
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(Array(5).fill(""));
  const [displayedKeywords, setDisplayedKeywords] = useState("");
  const [infoPopoverOpen, setInfoPopoverOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showRegionDialog, setShowRegionDialog] = useState(false);
  const [useRegistrySearch, setUseRegistrySearch] = useState(true);
  const [searchYandex, setSearchYandex] = useState(true);
  const [useUniversalSearch, setUseUniversalSearch] = useState(false);
  const [searchGoogle, setSearchGoogle] = useState(true);
  const [includeAds, setIncludeAds] = useState(false);
  const [language, setLanguage] = useState("русский");
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [searchProgress, setSearchProgress] = useState("");
  const [searchProgressPercent, setSearchProgressPercent] = useState(0);
  const [regionError, setRegionError] = useState("");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  
  const form = useForm({
    resolver: zodResolver(searchRequestFormSchema),
    defaultValues: {
      productName: "",
      productDescription: "",
      // Используем текущую дату + 7 дней в качестве срока по умолчанию вместо пустого значения
      timeline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      additionalRequirements: "",
      useDbSearch: true, // DB search always enabled
      useApiSearch: false, // API search always disabled
    },
  });

  // Sync form value with useRegistrySearch checkbox
  useEffect(() => {
    form.setValue("useDbSearch", useRegistrySearch);
  }, [useRegistrySearch, form]);

  // Define response type for better type safety
  interface SearchRequestResponse {
    request: SearchRequest;
    matchedSuppliers: Supplier[];
  }
  
  // Handle keyword changes in the dialog
  const handleKeywordChange = (index: number, value: string) => {
    // Проверяем, есть ли запятые в значении
    if (value.includes(',')) {
      toast({ title: "Ошибка ввода", description: "В отдельных полях запятые недопустимы", variant: "destructive" });
      return;
    }
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };
  
  // Handle confirm button click in the keywords dialog
  const handleKeywordConfirm = () => {
    const filteredKeywords = keywords.filter(k => k.trim() !== "");
    if (filteredKeywords.length > 5) {
      toast({ title: "Превышен лимит", description: "Можно ввести не более 5 ключевых запросов", variant: "destructive" });
      return;
    }
    const keywordString = filteredKeywords.join(", ");
    setDisplayedKeywords(keywordString);
    form.setValue("productName", keywordString);
    setKeywordDialogOpen(false);
  };
  
  // Handle region selection with limit check
  const handleRegionSelect = (regionName: string, checked: boolean) => {
    if (checked) {
      if (selectedRegions.length >= 5) {
        setRegionError("Можно выбрать не более 5-ти регионов");
        return;
      }
      setSelectedRegions([...selectedRegions, regionName]);
      setRegionError("");
    } else {
      setSelectedRegions(selectedRegions.filter(r => r !== regionName));
      setRegionError("");
    }
  };

  // Handle region expansion toggle
  const toggleRegionExpansion = (regionName: string) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(regionName)) {
      newExpanded.delete(regionName);
    } else {
      newExpanded.add(regionName);
    }
    setExpandedRegions(newExpanded);
  };

  const mutation = useMutation({
    mutationFn: async (formData: any) => {
      console.log("Submitting data:", formData);

      // Use the current state of the checkbox
      const formattedData = {
        ...formData,
        useDbSearch: useRegistrySearch,
        useApiSearch: false
      };

      const result = await apiRequest<SearchRequestResponse>("/api/search-requests", "POST", formattedData);
      console.log("Response:", result);
      return result;
    },
    onSuccess: (data) => {
      // Invalidate subscription status query to refresh request counter
      queryClient.invalidateQueries({ queryKey: ["subscription", "status"] });
      
      const suppliersCount = data.matchedSuppliers?.length || 0;
      toast({
        title: suppliersCount > 0 ? "Запрос создан успешно" : "Запрос создан",
        description: suppliersCount > 0 ? `Найдено поставщиков: ${suppliersCount}` : "Запрос сохранен в системе",
      });

      console.log("Search completed successfully:", data.request);
      
      if (data.request) {
        // Add the matched suppliers to the request object
        const requestWithSuppliers = {
          ...data.request,
          matchedSuppliers: data.matchedSuppliers || []
        };
        
        console.log("request.matchedSuppliers:", requestWithSuppliers.matchedSuppliers);
        console.log("Type of matchedSuppliers:", typeof requestWithSuppliers.matchedSuppliers);
        console.log("Is array?", Array.isArray(requestWithSuppliers.matchedSuppliers));
        
        console.log("✅ CALLING onComplete with suppliers:", requestWithSuppliers.matchedSuppliers?.length || 0);
        onComplete(requestWithSuppliers as any);
      }
    },
    onError: (error) => {
      console.error("Mutation error:", error);
      toast({
        title: "Error",
        description: "Failed to submit search request. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Unified search mutation
  const unifiedSearchMutation = useMutation({
    mutationFn: async (): Promise<any> => {
      setSearchProgress("Инициализация поиска...");
      setSearchProgressPercent(0);
      
      const searchKeywords = displayedKeywords || form.getValues("productName");
      
      // Check if universal search is enabled
      if (useUniversalSearch) {
        console.log("=== USING ENHANCED UNIVERSAL SEARCH ===");
        setSearchProgress("Выполняется улучшенный поиск в базе...");
        setSearchProgressPercent(25);
        
        try {
          const searchResults = await universalSearchService.search(searchKeywords, {
            limit: 50,
            userType: 'expert', // Use expert mode for better results
            includeStats: true
          });
          
          setSearchProgress("Обработка результатов...");
          setSearchProgressPercent(75);
          
          // Format results for existing system
          const formattedSuppliers = universalSearchService.formatForExistingUI(searchResults.results);
          
          setSearchProgress("Завершение поиска...");
          setSearchProgressPercent(100);
          
          return {
            suppliers: formattedSuppliers,
            total: searchResults.results.length,
            stats: searchResults.stats,
            message: universalSearchService.getSearchExplanation(searchResults.results)
          };
        } catch (error) {
          console.error("Universal search error, falling back to database search:", error);
          // Fallback to database search if universal search fails
          setUseUniversalSearch(false);
          setUseRegistrySearch(true);
        }
      }
      // Check if we're doing only database search (registry only)
      else if (useRegistrySearch && !searchGoogle && !searchYandex) {
        console.log("=== USING DATABASE SEARCH API ===");
        
        const formattedData = {
          productName: searchKeywords,
          productDescription: "",
          timeline: form.getValues("timeline"),
          additionalRequirements: "",
          useDbSearch: true,
          useApiSearch: false
        };

        const response = await apiRequest<SearchRequestResponse>("/api/search-requests", "POST", formattedData);
        return response;
      } else {
        console.log("=== USING GOOGLE/YANDEX SEARCH API ===");
        
        // Сначала создаем searchRequest для отслеживания
        const searchRequestData = {
          productName: searchKeywords,
          productDescription: "",
          timeline: form.getValues("timeline"),
          additionalRequirements: "",
          useDbSearch: useRegistrySearch,
          useApiSearch: true
        };
        
        console.log("[Frontend] Creating search request first...");
        const searchRequest = await apiRequest<SearchRequestResponse>("/api/search-requests", "POST", searchRequestData);
        console.log("[Frontend] Search request created:", searchRequest);
        console.log("[Frontend] Search request ID:", searchRequest.id);
        console.log("[Frontend] Search request type:", typeof searchRequest.id);
        
        // Преобразуем ключевые слова в массив для параллельного поиска
        const keywordsArray = searchKeywords
          .split(',')
          .map(keyword => keyword.trim())
          .filter(keyword => keyword.length > 0);
        
        console.log(`[Frontend] Sending ${keywordsArray.length} keywords for parallel search:`, keywordsArray);
        
        console.log("[Frontend] Sending supplier search request with requestId:", searchRequest.id);
        const response: any = await apiRequest("/api/supplier-search", "POST", {
          queries: keywordsArray, // Отправляем массив запросов для параллельного поиска
          query: searchKeywords,  // Оставляем для обратной совместимости
          requestId: searchRequest.id, // Передаем ID созданного запроса
          sources: {
            registry: useRegistrySearch,
            google: searchGoogle,
            yandex: searchYandex,
            includeAds: includeAds
          },
          maxResults: 50,
          regions: selectedRegions,
          language: language
        });
        
        return response;
      }
    },
    onSuccess: (data: any) => {
      console.log("=== UNIFIED SEARCH SUCCESS ===", data);
      
      // Handle different response formats
      let suppliersCount = 0;
      let foundSuppliers = [];
      
      // Database search response format
      if (data.request && data.matchedSuppliers) {
        suppliersCount = data.matchedSuppliers?.length || 0;
        foundSuppliers = data.matchedSuppliers || [];
        
        console.log("Database search result:", { suppliersCount, foundSuppliers });
        
        // Use the existing database search success handler
        toast({
          title: suppliersCount > 0 ? "Запрос создан успешно" : "Запрос создан",
          description: suppliersCount > 0 ? `Найдено поставщиков: ${suppliersCount}` : "Запрос сохранен в системе",
        });
        
        // Invalidate subscription status query to refresh request counter
        queryClient.invalidateQueries({ queryKey: ["subscription", "status"] });
        
        // Always call onComplete to proceed to send-request page
        if (data.request) {
          // Add the matched suppliers to the request object (even if empty)
          const requestWithSuppliers = {
            ...data.request,
            matchedSuppliers: foundSuppliers
          };
          
          if (foundSuppliers.length > 0) {
            console.log("✅ CALLING onComplete with suppliers:", foundSuppliers.length);
          } else {
            console.log("✅ CALLING onComplete with 0 suppliers - will show 'no suppliers' message on send-request page");
          }
          onComplete(requestWithSuppliers);
        }
        
        return;
      }
      
      // Google/Yandex search response format
      suppliersCount = data.suppliers?.length || 0;
      foundSuppliers = data.suppliers || [];
      
      // Формируем сообщение с учетом статистики параллельного поиска
      let successMessage = suppliersCount > 0 ? `Найдено ${suppliersCount} поставщиков` : "Результаты не найдены";
      if (data.parallelSearchStats) {
        const stats = data.parallelSearchStats;
        successMessage += `\nОбработано запросов: ${stats.totalQueriesProcessed}`;
        successMessage += `\nОбщее количество результатов: ${stats.totalResultsBeforeDedup}`;
        successMessage += `\nУникальных результатов: ${stats.uniqueResultsAfterDedup}`;
      }
      
      toast({
        title: suppliersCount > 0 ? "Поиск завершен" : "Результаты не найдены",
        description: successMessage
          : data.message || "Поставщики с достоверной контактной информацией не найдены",
        variant: suppliersCount > 0 ? "default" : "destructive"
      });
      
      // Reset progress
      setSearchProgress("");
      setSearchProgressPercent(0);
      
      // Refresh suppliers list
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      
      // Create a search request if suppliers were found
      if (suppliersCount > 0) {
        // Debug what we're getting from the server
        console.log("DEBUG: data.suppliers:", data.suppliers);
        console.log("DEBUG: data.total:", data.total);
        
        // Create search request with found suppliers
        const searchRequest = {
          id: Date.now(),
          userId: null,
          orderNumber: `REQ-${Date.now()}`,
          productName: displayedKeywords || form.getValues("productName"),
          productDescription: "",
          quantity: null,
          budget: null,
          timeline: form.getValues("timeline"),
          additionalRequirements: "",
          status: "active" as const,
          createdAt: new Date(),
          matchedSuppliers: data.suppliers || [], // Use the actual suppliers array
          useDbSearch: useRegistrySearch,
          useApiSearch: searchGoogle || searchYandex
        };
        
        console.log("✅ SUCCESS: Mutation completed successfully", searchRequest);
        onComplete(searchRequest);
      }
    },
    onError: (error) => {
      console.error("Unified search error:", error);
      toast({
        title: "Ошибка поиска",
        description: "Не удалось выполнить поиск. Попробуйте снова.",
        variant: "destructive",
      });
      
      // Reset progress
      setSearchProgress("");
      setSearchProgressPercent(0);
    },
  });

  const handleUnifiedSearch = () => {
    if (!displayedKeywords && !form.getValues("productName")) {
      toast({
        title: "Требуются ключевые слова",
        description: "Пожалуйста, введите ключевые слова для поиска",
        variant: "destructive",
      });
      return;
    }
    
    if (!useRegistrySearch && !searchGoogle && !searchYandex) {
      toast({
        title: "Выберите источники поиска",
        description: "Пожалуйста, выберите хотя бы один источник для поиска",
        variant: "destructive",
      });
      return;
    }
    
    // Only require regions for non-registry searches
    if ((searchGoogle || searchYandex) && selectedRegions.length === 0 && !useRegistrySearch) {
      toast({
        title: "Требуется регион",
        description: "Пожалуйста, выберите хотя бы один регион для поиска через Google/Yandex",
        variant: "destructive",
      });
      return;
    }
    
    unifiedSearchMutation.mutate();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data: any) => mutation.mutate(data))} className="space-y-6">
        <FormField
          control={form.control}
          name="productName"
          rules={{ required: "Пожалуйста, введите название продукта" }}
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormLabel>Ключевые слова</FormLabel>
                <Popover open={infoPopoverOpen} onOpenChange={setInfoPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[768px] p-4" align="start">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Правила составления запросов</h4>
                      <div className="text-sm space-y-3">
                        <p>Чтобы получить наиболее точные результаты, используйте следующие рекомендации при вводе ключевых слов:</p>
                        
                        <div className="space-y-2">
                          <p className="font-medium">Выбирайте одну группу товара.</p>
                          <div className="pl-2 space-y-1">
                            <p className="text-gray-700">✓ Правильно: картон купить от производителя</p>
                            <p className="text-gray-700">✗ Неправильно: картон купить от производителя, флаконы купить от производителя</p>
                            <p className="text-xs text-gray-500">(в этом случае получите смешанную выдачу результата для разных групп товаров).</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="font-medium">Вы можете указать несколько однотипных запросов, перечислив их через запятую. Каждый запрос будет обработан как отдельный.</p>
                          <p className="text-xs text-gray-500">Например: картонные коробки от производителя, картонные коробки оптом купить.</p>
                          <p className="text-xs text-gray-500">Можно указать до 5-ти однотипных вариаций в одном запросе.</p>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input 
                    placeholder="Введите ключевые слова для поиска поставщиков" 
                    value={displayedKeywords || field.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      const commaCount = (value.match(/,/g) || []).length;
                      console.log("Input value:", value, "Comma count:", commaCount);
                      if (commaCount > 4) {
                        console.log("Showing toast for limit exceeded");
                        toast({ title: "Превышен лимит", description: "Можно ввести не более 5 ключевых запросов (максимум 4 запятые)", variant: "destructive" });
                        return;
                      }
                      field.onChange(e);
                      setDisplayedKeywords(value);
                    }} 
                  />
                </FormControl>
                <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => setKeywordDialogOpen(true)}
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Добавление ключевых слов</DialogTitle>
                      <DialogDescription>
                        Выберете до 5 ключевых запросов
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {keywords.map((keyword, index) => (
                          <Input
                            key={index}
                            value={keyword}
                            onChange={(e) => handleKeywordChange(index, e.target.value)}
                            placeholder={`Запрос ${index + 1}`}
                            className="mb-2 focus-visible:ring-1 focus-visible:ring-offset-0"
                          />
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" onClick={handleKeywordConfirm}>Подтвердить</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timeline"
          render={({ field }) => (
            <FormItem className="flex flex-col hidden">
              <FormLabel>Предложения подать до</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(new Date(field.value), "dd-MM-yyyy") + " до 18 часов (GMT+3)"
                      ) : (
                        <span>Выберите дату</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => {
                      // Всегда устанавливаем дату (текущую если пользователь отменил выбор)
                      field.onChange(date ? date.toISOString() : new Date().toISOString());
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription className="text-xs text-muted-foreground">
                время по умолчанию: до 18 часов (GMT+3)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="bg-muted/50 p-4 rounded-lg space-y-3 border">
          <h3 className="font-medium">Источники поиска поставщиков:</h3>

          <div className="space-y-3">
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
              <FormControl>
                <Checkbox
                  id="use-registry-search"
                  checked={useRegistrySearch}
                  onCheckedChange={(checked) => setUseRegistrySearch(checked === true)}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel htmlFor="use-registry-search">Поиск по реестру компаний</FormLabel>
                <FormDescription>
                  Поиск поставщиков в реестре компаний
                </FormDescription>
              </div>
            </FormItem>
            
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
              <FormControl>
                <Checkbox
                  id="search-yandex"
                  checked={searchYandex}
                  onCheckedChange={(checked) => setSearchYandex(checked === true)}
                />
              </FormControl>
              <div className="space-y-1 leading-none flex items-center">
                <FormLabel htmlFor="search-yandex" className="mr-2">Поиск по yandex</FormLabel>
                <img 
                  src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjZmMzZjFkIiBkPSJNMTQgN2gyLjU0MUwxMSAyMkg4LjUzNEwxNCA3eiIvPjwvc3ZnPg==" 
                  alt="Yandex logo" 
                  className="w-4 h-4" 
                />
              </div>
            </FormItem>
            
            {searchYandex && (
              <div className="ml-6 pl-4 border-l-2 border-muted hidden">
                <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md p-2">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Включать рекламу</FormLabel>
                    <FormDescription className="text-xs">
                      Показывать рекламные объявления в результатах поиска
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={includeAds}
                      onCheckedChange={setIncludeAds}
                    />
                  </FormControl>
                </FormItem>
              </div>
            )}
            
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
              <FormControl>
                <Checkbox
                  id="search-google"
                  checked={searchGoogle}
                  onCheckedChange={(checked) => setSearchGoogle(checked === true)}
                />
              </FormControl>
              <div className="space-y-1 leading-none flex items-center">
                <FormLabel htmlFor="search-google" className="mr-2">Поиск по google</FormLabel>
                <div className="flex">
                  <img 
                    src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjNDI4NWY0IiBkPSJNMjMuNzQ1IDEyLjI3YzAgLjc5LS4wNzggMS41Mi0uMjEyIDIuMjVIOTYuNDUydi00LjUyaDkuNjA3YzQuMTEgMCAzLjI0NCAyLjI3IDEuOTA3IDQuNDZjMS40MTUgMCAzLjM3NS0uNTEyIDYuODMzIDMuODM4Yy4zMjYuNDM4LjY4My44NyAxLjA3IDEuMjkzYy0xLjU4NCAxLjQ0NS0zLjUyNSAyLjUtNS42ODggMy4xMzJjLTIuMTI1LjYxMS00LjM5OS45MjUtNi43MzIuOTI1YTIwLjAyNCAyMC4wMjQgMCAwIDEtMTQuMTMtNS44MzNhMTkuOTYxIDE5Ljk2MSAwIDAgMS01LjgzMy0xNC4xMzNjMC0xLjkxMy4zMDgtMy43MDYuODktNS40YTIwLjAzOSAyMC4wMzkgMCAwIDEgNS40MjQtOC40NjRBMTkuOTMyIDE5LjkzMiAwIDAgMSAyMy43NDYgMS45NmMyLjMzNCAwIDQuNjA4LjMxNCA2LjczMy45MjUgMi4xNjMuNjMyIDQuMTA0IDEuNjg3IDUuNjg4IDMuMTMzYTEuMDQgMS4wNCAwIDAgMS0xLjM0MiAxLjU5M0wzNC4xNyA3LjI4QTEyLjk4NCAxMi45ODQgMCAwIDAgMjMuNzQ2IDRjLTMuNTQgMC02Ljc0NSAxLjQzNy05LjA3MSAzLjc2MmExMi44MyAxMi44MyAwIDAgMC0zLjc2MyA5LjA3YzAgMy41NC0xLjUzNCA2Ljc0NiAyLjQ2NCA5LjA3MWExMi44MzMgMTIuODMzIDAgMCAwIDEzLjEzNC0zLjc2MnY0LjVIOC4wMTlhMTIuODM3IDEyLjgzNyAwIDAgMC0yMS45MjQgOS4wNjhBMTIuODQxIDEyLjg0MSAwIDAgMCAuOTM3IDEyLjI3YzAtMy41NCAxLjQzNS02Ljc0MyAzLjc2MS05LjA3QTEyLjgzNSAxMi44MzUgMCAwIDAgMTMuNzY4IDQuMDJhMTIuNzg4IDEyLjc4OCAwIDAgMC05LjA3MSAzLjc2MUExMi44MzUgMTIuODM1IDAgMCAwIC45MzcgMTYuODUyYzAgMy41NC0xLjQzNSA2Ljc0NiAzLjc2MSA5LjA3YTEyLjgzOCAxMi44MzggMCAwIDAgOS4wNyAzLjc2M3YtMTcuNDE0WiIvPjxwYXRoIGZpbGw9IiMzNGE4NTMiIGQ9Ik02LjM0IDE3LjVhOC4xMzMgOC4xMzMgMCAwIDEtLjQ2LTIuNjdoMi4wOGEuOTEuOTEgMCAwIDEgLjYxLjIyYy4xODEuMTguMzcuMzQuNTcuNTEuNTkuNSAxLjIxLjk5IDEuODYgMS40N2E4Ljc2MSA4Ljc2MSAwIDAgMS04Ljc4IDAgOC41NTUgOC41NTUgMCAwIDEtMy4xOC0zLjEyYy0uNzgtMS4zMy0xLjExLTIuODgtMS4xMS00LjQxIDAtMi4wNy42NS0zLjg5IDEuOTYtNS40N0E4Ljc4NiA4Ljc4NiAwIDAgMSA2LjQgMGM1LjU3IDEuNyA2LjM5IDUuMTIgNi4zOSA4Ljc3YTguNjkxIDguNjkxIDAgMCAxLTIuMDEgNS41OWMtLjYtLjQ2LTEuMjQtMS0xLjkzLTEuNTctLjM3LS4zMS0uNzQtLjYyLTEuMS0uOTJsLS4zMS0uMjhINi41NGMuMDktMy4xNi0uNDQtNS43My0yLjczLTddPC9wYXRoPjwvc3ZnPg==" 
                    alt="Google logo" 
                    className="w-5 h-5" 
                  />
                </div>
              </div>
            </FormItem>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-3 border">
            <h3 className="font-medium">Регионы поиска:</h3>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={() => setShowRegionDialog(true)}
            >
              {selectedRegions.length > 0 
                ? `Выбрано регионов: ${selectedRegions.length}` 
                : "выбрать"
              }
            </Button>
            
            {selectedRegions.length > 0 && (
              <div className="max-h-20 overflow-y-auto p-2 bg-background/50 rounded text-sm">
                {selectedRegions.join(", ")}
              </div>
            )}
            
            <Dialog open={showRegionDialog} onOpenChange={setShowRegionDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Выберите регионы поиска</DialogTitle>
                  <DialogDescription>
                    Можно выбрать не более 5-ти регионов
                  </DialogDescription>
                </DialogHeader>
                
                {regionError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription>
                      {regionError}
                    </AlertDescription>
                  </Alert>
                )}
                
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-1">
                    {regionsData.map((country) => (
                      <div key={country.name}>
                        {/* Страна */}
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md py-1">
                          <FormControl>
                            <Checkbox
                              checked={selectedRegions.includes(country.name)}
                              onCheckedChange={(checked) => handleRegionSelect(country.name, checked === true)}
                            />
                          </FormControl>
                          <div className="flex items-center space-x-2 flex-1">
                            <FormLabel className="text-sm cursor-pointer font-medium" onClick={() => handleRegionSelect(country.name, !selectedRegions.includes(country.name))}>
                              {country.name}
                            </FormLabel>
                            {country.regions.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0"
                                onClick={() => toggleRegionExpansion(country.name)}
                              >
                                <ChevronDown 
                                  className={`h-3 w-3 transition-transform ${
                                    expandedRegions.has(country.name) ? 'rotate-180' : ''
                                  }`} 
                                />
                              </Button>
                            )}
                          </div>
                        </FormItem>
                        
                        {/* Регионы страны */}
                        {country.regions.length > 0 && expandedRegions.has(country.name) && (
                          <div className="ml-6 space-y-1">
                            {country.regions.map((region) => (
                              <div key={region.name}>
                                {/* Регион */}
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md py-1">
                                  <FormControl>
                                    <Checkbox
                                      checked={selectedRegions.includes(region.name)}
                                      onCheckedChange={(checked) => handleRegionSelect(region.name, checked === true)}
                                    />
                                  </FormControl>
                                  <div className="flex items-center space-x-2 flex-1">
                                    <FormLabel className="text-sm cursor-pointer" onClick={() => handleRegionSelect(region.name, !selectedRegions.includes(region.name))}>
                                      {region.name}
                                    </FormLabel>
                                    {region.cities.length > 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0"
                                        onClick={() => toggleRegionExpansion(region.name)}
                                      >
                                        <ChevronDown 
                                          className={`h-3 w-3 transition-transform ${
                                            expandedRegions.has(region.name) ? 'rotate-180' : ''
                                          }`} 
                                        />
                                      </Button>
                                    )}
                                  </div>
                                </FormItem>
                                
                                {/* Города региона */}
                                {region.cities.length > 0 && expandedRegions.has(region.name) && (
                                  <div className="ml-6 space-y-1">
                                    {region.cities.map((city) => (
                                      <FormItem
                                        key={city.name}
                                        className="flex flex-row items-center space-x-2 space-y-0 rounded-md py-1"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={selectedRegions.includes(city.name)}
                                            onCheckedChange={(checked) => handleRegionSelect(city.name, checked === true)}
                                          />
                                        </FormControl>
                                        <FormLabel 
                                          className="text-sm cursor-pointer" 
                                          onClick={() => handleRegionSelect(city.name, !selectedRegions.includes(city.name))}
                                        >
                                          {city.name}
                                        </FormLabel>
                                      </FormItem>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button 
                    type="button" 
                    onClick={() => setShowRegionDialog(false)}
                  >
                    Подтвердить
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg space-y-1 border hidden">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Язык:</h3>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm">{language}</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowLanguageDialog(true)}
                >
                  <Globe className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Dialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
              <DialogContent className="max-w-xs">
                <DialogHeader>
                  <DialogTitle>Выберите язык поиска</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  {["русский", "английский"].map((lang) => (
                    <FormItem
                      key={lang}
                      className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2"
                    >
                      <FormControl>
                        <Checkbox
                          checked={language === lang}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setLanguage(lang);
                              setShowLanguageDialog(false);
                            }
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{lang}</FormLabel>
                      </div>
                    </FormItem>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {(mutation.isPending || unifiedSearchMutation.isPending) && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {searchProgress || "Обработка запроса..."}
              </span>
              <span className="text-sm text-muted-foreground">
                {searchProgressPercent}%
              </span>
            </div>
            <div className="h-2 w-full bg-muted overflow-hidden rounded-full">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300" 
                style={{ width: `${searchProgressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button
            type="button"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={mutation.isPending || unifiedSearchMutation.isPending}
            onClick={() => {
              console.log("=== УНИВЕРСАЛЬНЫЙ ПОИСК CLICKED ===");
              console.log("Product name for universal search:", form.getValues("productName"));
              
              // Enable universal search with enhanced options
              setUseUniversalSearch(true);
              setUseRegistrySearch(true); // Также включаем поиск в базе
              setSearchGoogle(false);
              setSearchYandex(false);
              setIncludeAds(false);
              
              handleUnifiedSearch();
            }}
          >
            {unifiedSearchMutation.isPending ? "Универсальный поиск..." : "🔍 Универсальный поиск"}
          </Button>
          
          <Button
            type="button"
            className="w-full"
            disabled={mutation.isPending || unifiedSearchMutation.isPending}
            onClick={() => {
              console.log("=== НАЙТИ ПОСТАВЩИКОВ В БАЗЕ CLICKED ===");
              console.log("Product name for database search:", form.getValues("productName"));
              
              // Enable both universal search and database search for best results
              setUseUniversalSearch(true);
              setUseRegistrySearch(true);
              setSearchGoogle(false);
              setSearchYandex(false);
              setIncludeAds(false);
              
              // Call the unified search with enhanced database search
              handleUnifiedSearch();
            }}
          >
            {unifiedSearchMutation.isPending ? "Умный поиск в базе..." : "🔍 Найти поставщиков в базе"}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={mutation.isPending || unifiedSearchMutation.isPending}
            onClick={() => {
              console.log("=== НАЙТИ ПОСТАВЩИКОВ (UNIFIED) CLICKED ===");
              setUseUniversalSearch(false);
              handleUnifiedSearch();
            }}
          >
            {unifiedSearchMutation.isPending ? "Поиск поставщиков..." : "Найти поставщиков"}
          </Button>
        </div>
      </form>
    </Form>
  );
}