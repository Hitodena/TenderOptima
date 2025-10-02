import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { searchRequestFormSchema, type SearchRequest, type Supplier } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Globe, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from "wouter";

// Импортируем общие данные регионов
import { regionsData, type Country, type Region, type City, type SelectedRegion } from "@/data/regions";

interface Props {
  onComplete: (request: SearchRequest) => void;
}

export function SupplierSearchForm({ onComplete }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(Array(10).fill(""));
  const [displayedKeywords, setDisplayedKeywords] = useState("");

  const [selectedRegions, setSelectedRegions] = useState<SelectedRegion[]>([]);
  const [showRegionDialog, setShowRegionDialog] = useState(false);
  const [regionSearchTerm, setRegionSearchTerm] = useState("");

  const [useRegistrySearch, setUseRegistrySearch] = useState(true);
  const [searchYandex, setSearchYandex] = useState(true);  // Включить Yandex по умолчанию
  const [searchGoogle, setSearchGoogle] = useState(false);
  const [language, setLanguage] = useState("русский");
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [regionError, setRegionError] = useState("");
  const [includeAds, setIncludeAds] = useState(false);

  const form = useForm({
    resolver: zodResolver(searchRequestFormSchema),
    defaultValues: { 
      productName: "",
      timeline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
  });

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...keywords];
    newKeywords[index] = value;
    setKeywords(newKeywords);
  };

  const handleKeywordConfirm = () => {
    const filteredKeywords = keywords.filter(k => k.trim() !== "");
    setDisplayedKeywords(filteredKeywords.join(", "));
    form.setValue("productName", filteredKeywords.join(", "));
    setKeywordDialogOpen(false);
  };

  const handleRegionSelect = (item: { name: string; googleCode?: string; yandexId: number }, type: 'country' | 'region' | 'city', country: Country, checked: boolean) => {
    const regionObject: SelectedRegion = {
      name: item.name, googleCode: type === 'country' ? item.googleCode! : country.googleCode,
      yandexId: item.yandexId, type: type
    };
    if (checked) {
      if (selectedRegions.length >= 5) { setRegionError("Можно выбрать не более 5-ти регионов"); return; }
      setSelectedRegions(prev => [...prev, regionObject]);
      setRegionError("");
    } else {
      setSelectedRegions(prev => prev.filter(r => r.name !== regionObject.name));
      setRegionError("");
    }
  };

  const filteredRegionsData = useMemo(() => {
    if (!regionSearchTerm) return regionsData;
    const lowercasedFilter = regionSearchTerm.toLowerCase();
    return regionsData.map(country => {
      const filteredRegions = country.regions.map(region => {
        const filteredCities = region.cities.filter(city => city.name.toLowerCase().includes(lowercasedFilter));
        if (filteredCities.length > 0 || region.name.toLowerCase().includes(lowercasedFilter)) return { ...region, cities: filteredCities };
        return null;
      }).filter((r): r is Region => r !== null);
      if (filteredRegions.length > 0 || country.name.toLowerCase().includes(lowercasedFilter)) return { ...country, regions: filteredRegions };
      return null;
    }).filter((c): c is Country => c !== null);
  }, [regionSearchTerm]);

  const unifiedSearchMutation = useMutation({
      mutationFn: async (): Promise<any> => {
        const isDbOnly = useRegistrySearch && !searchGoogle && !searchYandex;
        const searchKeywords = displayedKeywords || form.getValues("productName");
        const regionsToSubmit = selectedRegions;

        if (isDbOnly) {
            console.log("=== DB ONLY SEARCH ===");
            return await apiRequest("/api/search-requests", "POST", { 
              productName: searchKeywords, 
              timeline: form.getValues("timeline"),
              useDbSearch: true, 
              useApiSearch: false 
            });
        }

        console.log("=== MIXED SEARCH ===");
        
        // Преобразуем ключевые слова в массив для параллельного поиска
        const keywordsArray = searchKeywords
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword.length > 0);
        
        console.log(`[Frontend] Sending ${keywordsArray.length} keywords for parallel search:`, keywordsArray);
        
        const sources = {
            registry: useRegistrySearch,
            google: searchGoogle,
            yandex: searchYandex,
            includeAds: includeAds,
        };
        
        return await apiRequest("/api/supplier-search", "POST", {
            queries: keywordsArray, // Отправляем массив запросов
            query: searchKeywords, // Оставляем для совместимости назад
            sources, 
            maxResults: 50,
            regions: regionsToSubmit, 
            language: language,
        });
    },
    onSuccess: (data: any) => {
        const suppliersCount = data.suppliers?.length || data.matchedSuppliers?.length || 0;
        if (suppliersCount > 0) {
            // Формируем сообщение с учетом статистики параллельного поиска
            let successMessage = `Найдено ${suppliersCount} поставщиков`;
            if (data.parallelSearchStats) {
                const stats = data.parallelSearchStats;
                successMessage += ` (из ${stats.totalResultsBeforeDedup} результатов по ${stats.totalQueriesProcessed} запросам)`;
            }
            toast({ title: "Поиск завершен", description: successMessage });
            const searchRequest: SearchRequest = {
                id: Date.now(), orderNumber: `REQ-${Date.now()}`,
                productName: displayedKeywords || form.getValues("productName"),
                productDescription: "", 
                quantity: null,
                budget: null,
                timeline: new Date().toISOString(), 
                additionalRequirements: "",
                matchedSuppliers: data.suppliers || data.matchedSuppliers,
                createdAt: new Date(), status: 'active', userId: null,
                useDbSearch: true, useApiSearch: true,
            };
            onComplete(searchRequest);
        } else {
            toast({ title: "Результаты не найдены", variant: "destructive" });
        }
    },
    onError: () => toast({ title: "Ошибка поиска", variant: "destructive" })
  });

  const handleUnifiedSearch = () => {
    if (!displayedKeywords && !form.getValues("productName")) { toast({ title: "Требуются ключевые слова", variant: "destructive" }); return; }
    if (!useRegistrySearch && !searchGoogle && !searchYandex) { toast({ title: "Выберите источник поиска", variant: "destructive" }); return; }
    if ((searchGoogle || searchYandex) && selectedRegions.length === 0) { toast({ title: "Для поиска в интернете требуется регион", variant: "destructive" }); return; }
    unifiedSearchMutation.mutate();
  };

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <FormField
          control={form.control} name="productName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ключевые слова</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input placeholder="Введите ключевые слова" value={displayedKeywords || field.value} onChange={(e) => { field.onChange(e); setDisplayedKeywords(e.target.value); }} />
                </FormControl>
                <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" type="button"><Plus className="h-4 w-4" /></Button>
                  </DialogTrigger>
                   <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавление ключевых слов</DialogTitle>
                        <DialogDescription>Введите до 10 слов для смешанного поиска.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {keywords.map((keyword, index) => (
                          <Input key={index} value={keyword} onChange={(e) => handleKeywordChange(index, e.target.value)} placeholder={`Слово ${index + 1}`} />
                        ))}
                    </div>
                    <DialogFooter><Button type="button" onClick={handleKeywordConfirm}>Подтвердить</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </FormItem>
          )}
        />

        <div className="bg-muted/50 p-3 rounded-lg space-y-3 border">
          <FormLabel>Источники поиска</FormLabel>
          <FormItem className="flex items-center space-x-3"><FormControl><Checkbox id="use-registry-search" checked={useRegistrySearch} onCheckedChange={(c) => setUseRegistrySearch(c === true)} /></FormControl><FormLabel htmlFor="use-registry-search" className="cursor-pointer">Поиск по реестру</FormLabel></FormItem>
          <FormItem className="flex items-center space-x-3"><FormControl><Checkbox id="search-yandex" checked={searchYandex} onCheckedChange={(c) => setSearchYandex(c === true)} /></FormControl><FormLabel htmlFor="search-yandex" className="cursor-pointer">Поиск по Yandex</FormLabel></FormItem>
          {searchYandex && (<div className="ml-6 pl-4 border-l-2 hidden"><FormItem className="flex items-center justify-between"><FormLabel className="text-sm">Включать рекламу</FormLabel><FormControl><Switch checked={includeAds} onCheckedChange={setIncludeAds} /></FormControl></FormItem></div>)}
          <FormItem className="flex items-center space-x-3"><FormControl><Checkbox id="search-google" checked={searchGoogle} onCheckedChange={(c) => setSearchGoogle(c === true)} /></FormControl><FormLabel htmlFor="search-google" className="cursor-pointer">Поиск по Google</FormLabel></FormItem>
        </div>

        <div className="bg-muted/50 p-3 rounded-lg space-y-3 border">
            <FormLabel>Регионы поиска</FormLabel>
            <Button type="button" variant="outline" className="w-full" onClick={() => setShowRegionDialog(true)}>
              {selectedRegions.length > 0 ? `Выбрано: ${selectedRegions.length}` : "Выбрать регионы"}
            </Button>
            {selectedRegions.length > 0 && (<div className="max-h-20 overflow-y-auto p-2 text-sm">{selectedRegions.map(r => r.name).join(", ")}</div>)}
            <Dialog open={showRegionDialog} onOpenChange={setShowRegionDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Выберите регионы</DialogTitle></DialogHeader>
                {regionError && (<Alert variant="destructive" className="mt-2"><AlertDescription>{regionError}</AlertDescription></Alert>)}
                <div className="relative my-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                  <Input placeholder="Поиск..." value={regionSearchTerm} onChange={(e) => setRegionSearchTerm(e.target.value)} className="pl-10"/>
                </div>
                <ScrollArea className="h-[400px] pr-4">
                  <Accordion type="multiple" className="w-full">
                    {/* Топ-3 страны */}
                    {(() => {
                      const topCountries = ['Беларусь', 'Россия', 'Казахстан'];
                      const topCountriesData = topCountries.map(name => 
                        filteredRegionsData.find(country => country.name === name)
                      ).filter(Boolean);
                      
                      return topCountriesData.map((country) => (
                        <AccordionItem value={country.name} key={country.name}>
                          <div className="flex items-center space-x-2 py-0.5">
                            <Checkbox 
                              id={`c-${country.name}`} 
                              checked={selectedRegions.some(r=>r.name===country.name)} 
                              onCheckedChange={(c)=>handleRegionSelect(country,'country',country,c===true)} 
                            />
                            <div className="flex items-center flex-1">
                              <label htmlFor={`c-${country.name}`} className="cursor-pointer text-sm font-bold whitespace-nowrap">
                                {country.name}
                              </label>
                              {country.regions.length > 0 && (
                                <AccordionTrigger className="py-0 h-auto hover:no-underline ml-1">
                                  <span className="sr-only">Развернуть</span>
                                </AccordionTrigger>
                              )}
                            </div>
                          </div>
                        <AccordionContent className="pl-4 pb-0">
                          <div className="space-y-0 border-l-2 border-gray-100 pl-2">
                            {country.regions.map(region => (
                              <div key={region.name}>
                                <div className="flex items-center space-x-2 py-0.5">
                                  <Checkbox 
                                    id={`r-${region.name}`} 
                                    checked={selectedRegions.some(r=>r.name===region.name)} 
                                    onCheckedChange={(c)=>handleRegionSelect(region,'region',country,c===true)} 
                                  />
                                  <label htmlFor={`r-${region.name}`} className="cursor-pointer text-sm flex-1 whitespace-nowrap text-gray-700">
                                    {region.name}
                                  </label>
                                  {region.cities.length > 0 && (
                                    <Accordion type="multiple" className="w-full">
                                      <AccordionItem value={region.name} className="border-none">
                                        <AccordionTrigger className="py-0 h-auto hover:no-underline">
                                          <span className="sr-only">Развернуть</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="pl-4 pb-0">
                                          <div className="space-y-0 border-l-2 border-gray-100 pl-2">
                                            {region.cities.map(city => (
                                              <div key={city.name} className="flex items-center space-x-2 py-0.5">
                                                <Checkbox 
                                                  id={`t-${city.name}`} 
                                                  checked={selectedRegions.some(r=>r.name===city.name)} 
                                                  onCheckedChange={(c)=>handleRegionSelect(city,'city',country,c===true)}
                                                />
                                                <label htmlFor={`t-${city.name}`} className="cursor-pointer text-sm whitespace-nowrap text-gray-600">
                                                  {city.name}
                                                </label>
                                              </div>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    </Accordion>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      ));
                    })()}
                    
                    
                    {/* Остальные страны */}
                    {filteredRegionsData
                      .filter(country => !['Беларусь', 'Россия', 'Казахстан'].includes(country.name))
                      .map((country) => (
                        <AccordionItem value={country.name} key={country.name}>
                          <div className="flex items-center space-x-2 py-0.5">
                            <Checkbox 
                              id={`c-${country.name}`} 
                              checked={selectedRegions.some(r=>r.name===country.name)} 
                              onCheckedChange={(c)=>handleRegionSelect(country,'country',country,c===true)} 
                            />
                            <div className="flex items-center flex-1">
                              <label htmlFor={`c-${country.name}`} className="cursor-pointer text-sm whitespace-nowrap">
                                {country.name}
                              </label>
                              {country.regions.length > 0 && (
                                <AccordionTrigger className="py-0 h-auto hover:no-underline ml-1">
                                  <span className="sr-only">Развернуть</span>
                                </AccordionTrigger>
                              )}
                            </div>
                          </div>
                        <AccordionContent className="pl-4 pb-0">
                          <div className="space-y-0 border-l-2 border-gray-100 pl-2">
                            {country.regions.map(region => (
                              <div key={region.name}>
                                <div className="flex items-center space-x-2 py-0.5">
                                  <Checkbox 
                                    id={`r-${region.name}`} 
                                    checked={selectedRegions.some(r=>r.name===region.name)} 
                                    onCheckedChange={(c)=>handleRegionSelect(region,'region',country,c===true)} 
                                  />
                                  <label htmlFor={`r-${region.name}`} className="cursor-pointer text-sm flex-1 whitespace-nowrap text-gray-700">
                                    {region.name}
                                  </label>
                                  {region.cities.length > 0 && (
                                    <Accordion type="multiple" className="w-full">
                                      <AccordionItem value={region.name} className="border-none">
                                        <AccordionTrigger className="py-0 h-auto hover:no-underline">
                                          <span className="sr-only">Развернуть</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="pl-4 pb-0">
                                          <div className="space-y-0 border-l-2 border-gray-100 pl-2">
                                            {region.cities.map(city => (
                                              <div key={city.name} className="flex items-center space-x-2 py-0.5">
                                                <Checkbox 
                                                  id={`t-${city.name}`} 
                                                  checked={selectedRegions.some(r=>r.name===city.name)} 
                                                  onCheckedChange={(c)=>handleRegionSelect(city,'city',country,c===true)}
                                                />
                                                <label htmlFor={`t-${city.name}`} className="cursor-pointer text-sm whitespace-nowrap text-gray-600">
                                                  {city.name}
                                                </label>
                                              </div>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    </Accordion>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
                <DialogFooter><Button type="button" onClick={()=>setShowRegionDialog(false)}>Подтвердить</Button></DialogFooter>
              </DialogContent>
            </Dialog>
        </div>

        <div className="bg-muted/50 p-3 rounded-lg space-y-1 border hidden">
          <div className="flex items-center justify-between">
            <FormLabel>Язык поиска</FormLabel>
            <Button type="button" variant="ghost" className="gap-2" onClick={()=>setShowLanguageDialog(true)}><span className="text-sm">{language}</span><Globe className="h-4 w-4" /></Button>
          </div>
          <Dialog open={showLanguageDialog} onOpenChange={setShowLanguageDialog}>
            <DialogContent className="max-w-xs">
              <DialogHeader><DialogTitle>Выберите язык</DialogTitle></DialogHeader>
              <div className="py-4">
                {["русский", "английский"].map(lang => (<FormItem key={lang} className="flex items-center space-x-3 p-2 cursor-pointer" onClick={()=>{setLanguage(lang);setShowLanguageDialog(false);}}>
                    <FormControl><Checkbox checked={language === lang} /></FormControl>
                    <FormLabel className="cursor-pointer">{lang}</FormLabel>
                  </FormItem>))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Button type="button" className="w-full" onClick={handleUnifiedSearch} disabled={unifiedSearchMutation.isPending}>
            {unifiedSearchMutation.isPending ? "Поиск..." : "Найти поставщиков"}
        </Button>
      </form>
    </Form>
  );
}

export function SupplierSearchPage() {
  const [, navigate] = useLocation();
  const handleSearchComplete = (request: SearchRequest) => {
    if (request.matchedSuppliers && request.matchedSuppliers.length > 0) {
      console.log("Search completed, matchedSuppliers sample:", request.matchedSuppliers[0]);
      console.log("Email format in matchedSuppliers:", (request.matchedSuppliers[0] as any)?.email, Array.isArray((request.matchedSuppliers[0] as any)?.email));
      localStorage.setItem('sendRequestSuppliers', JSON.stringify(request.matchedSuppliers));
      localStorage.setItem('sendRequestId', request.id.toString());
      localStorage.setItem('searchQuery', request.productName || '');
      navigate(`/send-request?requestId=${request.id}&orderNumber=${request.orderNumber}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h1 className="text-3xl font-bold">Поиск поставщиков</h1>
          <p className="text-gray-600">Найдите подходящих поставщиков для ваших потребностей</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <SupplierSearchForm onComplete={handleSearchComplete} />
        </div>
      </div>
    </div>
  );
}
