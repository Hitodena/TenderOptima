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
  const [searchGoogle, setSearchGoogle] = useState(false);
  const [language, setLanguage] = useState("русский");
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [regionError, setRegionError] = useState("");
  const [includeAds, setIncludeAds] = useState(false);
  const [searchProgress, setSearchProgress] = useState("");
  const [searchProgressPercent, setSearchProgressPercent] = useState(0);
  
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
    stats?: {
      totalSuppliers: number;
      newSuppliers: number;
      skippedSuppliers: number;
      errors: number;
    };
  }

  const mutation = useMutation<SearchRequestResponse, Error, any>({
    mutationFn: (data) => apiRequest("/api/search-requests", { method: "POST", body: data }),
    onSuccess: (data) => {
      if (data.request) {
        onComplete(data.request);
        
        // Show success toast with stats if available
        if (data.stats) {
          toast({
            title: "Поиск завершен",
            description: `Найдено поставщиков: ${data.stats.totalSuppliers}, новых: ${data.stats.newSuppliers}`,
          });
        } else {
          toast({
            title: "Запрос создан",
            description: "Поиск поставщиков завершен",
          });
        }
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось получить данные запроса",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Search request error:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось выполнить поиск",
        variant: "destructive",
      });
    },
  });

  // Add unified search mutation
  const unifiedSearchMutation = useMutation<SearchRequestResponse, Error, any>({
    mutationFn: async (searchData) => {
      console.log('Starting unified search with data:', searchData);
      
      // First create a search request
      const requestData = {
        ...searchData,
        useDbSearch: false, // Unified search doesn't use DB
        useApiSearch: true  // Unified search uses API
      };
      
      // Reset progress
      setSearchProgress("Создаем запрос...");
      setSearchProgressPercent(10);
      
      // Create the search request first
      const requestResponse = await apiRequest("/api/search-requests", { 
        method: "POST", 
        body: requestData 
      });
      
      if (!requestResponse.request?.id) {
        throw new Error("Не удалось создать запрос");
      }
      
      // Now perform unified search
      setSearchProgress("Начинаем поиск поставщиков...");
      setSearchProgressPercent(30);
      
      const searchPayload = {
        requestId: requestResponse.request.id,
        searchQuery: searchData.productName,
        searchYandex,
        searchGoogle,
        selectedRegions,
        includeAds,
        language,
        keywords: keywords.filter(k => k.trim() !== "")
      };
      
      console.log('Unified search payload:', searchPayload);
      
      setSearchProgress("Выполняем поиск в интернете...");
      setSearchProgressPercent(60);
      
      const searchResponse = await apiRequest("/api/supplier-search/unified", {
        method: "POST",
        body: searchPayload
      });
      
      setSearchProgress("Обработка результатов...");
      setSearchProgressPercent(90);
      
      console.log('Unified search response:', searchResponse);
      
      setSearchProgress("Завершено!");
      setSearchProgressPercent(100);
      
      return requestResponse; // Return the original request for onComplete
    },
    onSuccess: (data) => {
      if (data.request) {
        onComplete(data.request);
        toast({
          title: "Поиск завершен", 
          description: "Поиск поставщиков в интернете выполнен"
        });
      }
      setSearchProgress("");
      setSearchProgressPercent(0);
    },
    onError: (error) => {
      console.error("Unified search error:", error);
      toast({
        title: "Ошибка поиска",
        description: error.message || "Не удалось выполнить поиск в интернете",
        variant: "destructive",
      });
      setSearchProgress("");
      setSearchProgressPercent(0);
    },
  });

  const handleUnifiedSearch = () => {
    const formData = form.getValues();
    
    // Validate required fields
    if (!formData.productName?.trim()) {
      toast({
        title: "Ошибка",
        description: "Укажите название товара или услуги",
        variant: "destructive",
      });
      return;
    }
    
    // Check if at least one search source is selected
    if (!searchYandex && !searchGoogle) {
      toast({
        title: "Ошибка", 
        description: "Выберите хотя бы один источник поиска (Yandex или Google)",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Triggering unified search...');
    unifiedSearchMutation.mutate(formData);
  };

  function onSubmit(data: any) {
    // Add the additional search parameters to the submission data
    const submissionData = {
      ...data,
      selectedRegions,
      keywords: keywords.filter(k => k.trim() !== ""),
      searchYandex,
      searchGoogle,
      language,
      includeAds,
    };
    
    mutation.mutate(submissionData);
  }

  // Handle keywords update
  const updateKeywords = (newKeywords: string[]) => {
    setKeywords(newKeywords);
    const nonEmptyKeywords = newKeywords.filter(k => k.trim() !== "");
    setDisplayedKeywords(nonEmptyKeywords.join(", "));
  };

  // Handle regions update
  const updateRegions = (regions: string[]) => {
    setSelectedRegions(regions);
    if (regions.length > 3) {
      setRegionError("Максимум 3 региона");
    } else {
      setRegionError("");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Search Methods Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {/* Yandex Card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">Я</span>
              </div>
              <h3 className="font-semibold">Yandex поиск</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Поиск по российским компаниям через Яндекс
            </p>
          </div>

          {/* Google Card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <h3 className="font-semibold">Google поиск</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Международный поиск поставщиков
            </p>
          </div>

          {/* Registry Card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">Р</span>
              </div>
              <h3 className="font-semibold">Реестр компаний</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Поиск в официальных реестрах
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center">
            <span className="mr-2">🔍</span>
            Найти поставщиков
          </h2>

          <FormField
            control={form.control}
            name="productName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Поисковый запрос</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Например: купить перчатки медицинские"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Search Sources */}
          <div className="space-y-4">
            <FormLabel>Источники поиска:</FormLabel>
            
            <FormField
              control={form.control}
              name="useDbSearch"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
                  <FormControl>
                    <Checkbox
                      checked={useRegistrySearch}
                      onCheckedChange={setUseRegistrySearch}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Поиск по реестру компаний</FormLabel>
                    <FormDescription>
                      Поиск поставщиков в реестре компаний
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="useApiSearch"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
                  <FormControl>
                    <Checkbox
                      checked={searchYandex}
                      onCheckedChange={setSearchYandex}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Поиск через Yandex</FormLabel>
                    <FormDescription>
                      Расширенный поиск через поисковые системы
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
              <Checkbox
                checked={searchGoogle}
                onCheckedChange={setSearchGoogle}
              />
              <div className="space-y-1 leading-none">
                <FormLabel>Поиск через Google</FormLabel>
                <FormDescription>
                  Международный поиск поставщиков
                </FormDescription>
              </div>
            </div>

            <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
              <Checkbox
                checked={includeAds}
                onCheckedChange={setIncludeAds}
              />
              <div className="space-y-1 leading-none">
                <FormLabel>Включать рекламу</FormLabel>
                <FormDescription>
                  Включить рекламные объявления в результаты поиска
                </FormDescription>
              </div>
            </div>
          </div>

          {/* Keywords Dialog */}
          <div className="space-y-2">
            <FormLabel>Ключевые слова</FormLabel>
            <div className="flex items-center space-x-2">
              <Input
                value={displayedKeywords}
                placeholder="Дополнительные ключевые слова"
                readOnly
                className="flex-1"
              />
              <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Добавить ключевые слова</DialogTitle>
                    <DialogDescription>
                      Укажите до 10 дополнительных ключевых слов для более точного поиска
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {keywords.map((keyword, index) => (
                      <Input
                        key={index}
                        value={keyword}
                        onChange={(e) => {
                          const newKeywords = [...keywords];
                          newKeywords[index] = e.target.value;
                          updateKeywords(newKeywords);
                        }}
                        placeholder={`Ключевое слово ${index + 1}`}
                      />
                    ))}
                  </div>
                  <DialogFooter>
                    <Button type="button" onClick={() => setKeywordDialogOpen(false)}>
                      Готово
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Regions Dialog */}
          <div className="space-y-2">
            <FormLabel>Регионы поиска</FormLabel>
            <div className="flex items-center space-x-2">
              <Input
                value={selectedRegions.join(", ")}
                placeholder="Выберите регионы (максимум 3)"
                readOnly
                className="flex-1"
              />
              <Dialog open={showRegionDialog} onOpenChange={setShowRegionDialog}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Выберите регионы</DialogTitle>
                    <DialogDescription>
                      Выберите до 3 регионов для поиска поставщиков
                    </DialogDescription>
                  </DialogHeader>
                  {regionError && (
                    <Alert variant="destructive">
                      <AlertDescription>{regionError}</AlertDescription>
                    </Alert>
                  )}
                  <ScrollArea className="h-60">
                    <div className="space-y-1">
                      {regionsList.map((region) => (
                        <div key={region} className="flex items-center space-x-2 p-1">
                          <Checkbox
                            checked={selectedRegions.includes(region)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                if (selectedRegions.length < 3) {
                                  updateRegions([...selectedRegions, region]);
                                }
                              } else {
                                updateRegions(selectedRegions.filter(r => r !== region));
                              }
                            }}
                            disabled={!selectedRegions.includes(region) && selectedRegions.length >= 3}
                          />
                          <span className="text-sm">{region}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <DialogFooter>
                    <Button type="button" onClick={() => setShowRegionDialog(false)}>
                      Готово
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <FormLabel>Язык поиска</FormLabel>
            <div className="flex items-center space-x-2">
              <Input
                value={language}
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowLanguageDialog(true)}
              >
                <Globe className="h-4 w-4" />
              </Button>
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
            type="submit"
            className="w-full"
            disabled={mutation.isPending || unifiedSearchMutation.isPending}
          >
            {mutation.isPending ? "Обработка запроса..." : "Найти поставщиков в базе"}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={mutation.isPending || unifiedSearchMutation.isPending}
            onClick={handleUnifiedSearch}
          >
            {unifiedSearchMutation.isPending ? "Поиск поставщиков..." : "Найти поставщиков"}
          </Button>
        </div>
      </form>
    </Form>
  );
}