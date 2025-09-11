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
import { CalendarIcon, Plus, Globe, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { universalSearchService } from "@/services/universal-search";

// Import the regions list from the file
const regionsList = [
  // Верхнеуровневые регионы
  "Австралия и Океания", "Азия", "Африка", "Европа", "Россия", "Северный Кавказ", "Республика Крым", "Северо-Запад", "Поволжье",
  
  // Азия
  "Грузия", "Израиль", "Индия", "Камбоджа", "Китай", "Объединённые Арабские Эмираты", "Таиланд", "Южная Корея", "Япония",
  
  // Африка
  "Египет",
  
  // Европа
  "Австрия", "Бельгия", "Болгария", "Великобритания", "Венгрия", "Германия", "Греция", "Дания", "Испания", "Италия", 
  "Кипр", "Латвия", "Литва", "Нидерланды", "Норвегия", "Польша", "Португалия", "Румыния", "Сербия", "Словакия", 
  "Словения", "Турция", "Финляндия", "Франция", "Хорватия", "Черногория", "Чехия", "Швейцария", "Швеция", "Эстония",
  
  // Россия - Дальний Восток
  "Дальний Восток", "Амурская область", "Белогорск", "Благовещенск", "Свободный", "Тында", 
  "Еврейская автономная область", "Забайкальский край", "Чита", "Камчатский край", "Петропавловск-Камчатский", 
  "Магаданская область", "Магадан", "Приморский край", "Арсеньев", "Артём", "Владивосток", "Дальнегорск", 
  "Находка", "Уссурийск", "Республика Бурятия", "Северобайкальск", "Улан-Удэ", "Республика Саха (Якутия)", 
  "Нерюнгринский район", "Якутск", "Сахалинская область", "Южно-Сахалинск", "Хабаровский край", 
  "Амурский район", "Амурск", "Комсомольск-на-Амуре", "Хабаровск", "Чукотский автономный округ",
  
  // Россия - Поволжье
  "Кировская область", "Вятские Поляны", "Киров", "Кирово-Чепецк", "Нижегородская область", "Арзамас", 
  "Выкса", "Дзержинск", "Кстовский район", "Кстово", "Нижний Новгород", "Павловский район", "Павлово", "Саров", 
  "Оренбургская область", "Бузулук", "Гай", "Новотроицк", "Оренбург", "Орск", "Пензенская область", 
  "Кузнецк", "Пенза", "Пермский край", "Березники", "Лысьва", "Пермь", "Соликамск", "Чайковский район", "Чайковский", 
  "Республика Башкортостан", "Белебеевский район", "Белебей", "Белорецкий район", "Белорецк", "Ишимбайский район", 
  "Ишимбай", "Кумертау", "Мелеузовский район", "Мелеуз", "Нефтекамск", "Октябрьский", "Салават", "Сибай", 
  "Стерлитамак", "Туймазинский район", "Туймазы", "Уфа", "Учалинский район", "Учалы",
  
  // И другие регионы из файла...
];

interface Props {
  onComplete: (request: SearchRequest) => void;
}

export function SupplierSearchForm({ onComplete }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States for the new features
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(Array(10).fill(""));
  const [displayedKeywords, setDisplayedKeywords] = useState("");
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
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };
  
  // Handle confirm button click in the keywords dialog
  const handleKeywordConfirm = () => {
    const filteredKeywords = keywords.filter(k => k.trim() !== "");
    const keywordString = filteredKeywords.join(", ");
    setDisplayedKeywords(keywordString);
    form.setValue("productName", keywordString);
    setKeywordDialogOpen(false);
  };
  
  // Handle region selection with limit check
  const handleRegionSelect = (region: string, checked: boolean) => {
    if (checked) {
      if (selectedRegions.length >= 5) {
        setRegionError("Можно выбрать не более 5-ти регионов");
        return;
      }
      setSelectedRegions([...selectedRegions, region]);
      setRegionError("");
    } else {
      setSelectedRegions(selectedRegions.filter(r => r !== region));
      setRegionError("");
    }
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
        
        const response: any = await apiRequest("/api/supplier-search", "POST", {
          query: searchKeywords,
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
      
      toast({
        title: suppliersCount > 0 ? "Поиск завершен" : "Результаты не найдены",
        description: suppliersCount > 0 
          ? `Найдено ${suppliersCount} поставщиков`
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
              <FormLabel>Ключевые слова</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input 
                    placeholder="Введите ключевые слова для поиска поставщиков" 
                    value={displayedKeywords || field.value}
                    onChange={(e) => {
                      field.onChange(e);
                      setDisplayedKeywords(e.target.value);
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
                        Введите до 10 ключевых слов для выполнения смешанного поиска
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {keywords.map((keyword, index) => (
                          <Input
                            key={index}
                            value={keyword}
                            onChange={(e) => handleKeywordChange(index, e.target.value)}
                            placeholder={`Ключевое слово ${index + 1}`}
                            className="mb-2"
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
              <div className="ml-6 pl-4 border-l-2 border-muted">
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
                  <div className="space-y-2">
                    {regionsList.map((region) => (
                      <FormItem
                        key={region}
                        className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2"
                      >
                        <FormControl>
                          <Checkbox
                            checked={selectedRegions.includes(region)}
                            onCheckedChange={(checked) => handleRegionSelect(region, checked === true)}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{region}</FormLabel>
                        </div>
                      </FormItem>
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
          
          <div className="bg-muted/50 p-4 rounded-lg space-y-1 border">
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