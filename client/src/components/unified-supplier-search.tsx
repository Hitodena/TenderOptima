import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Supplier } from "@shared/schema";

interface UnifiedSupplierSearchProps {
  onSuppliersFound: (suppliers: Supplier[]) => void;
  selectedRegions: string[]; // <-- Добавлено
}

export function UnifiedSupplierSearch({ onSuppliersFound, selectedRegions }: UnifiedSupplierSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [elements, setElements] = useState(50);
  const [useRegistrySearch, setUseRegistrySearch] = useState(true);
  const [useYandexSearch, setUseYandexSearch] = useState(true);
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const [includeAds, setIncludeAds] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите поисковый запрос",
        variant: "destructive",
      });
      return;
    }

    // Check if at least one search source is selected
    if (!useRegistrySearch && !useYandexSearch && !useGoogleSearch) {
      toast({
        title: "Ошибка",
        description: "Выберите хотя бы один источник поиска",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);

    try {
      console.log(`[UnifiedSearch] Starting unified search for: "${searchQuery}"`);
      console.log(`[UnifiedSearch] Sources: Registry=${useRegistrySearch}, Yandex=${useYandexSearch}, Google=${useGoogleSearch}`);

      // Преобразуем ключевые слова в массив для параллельного поиска
      const keywordsArray = searchQuery
        .split(',')
        .map(keyword => keyword.trim())
        .filter(keyword => keyword.length > 0);
      
      console.log(`[UnifiedSearch] Sending ${keywordsArray.length} keywords for parallel search:`, keywordsArray);

      const response = await fetch('/api/supplier-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queries: keywordsArray, // Отправляем массив запросов для параллельного поиска
          query: searchQuery,     // Оставляем для обратной совместимости
          elements: elements,
          userId: 1, // Use authenticated user ID in production
          sources: {
            registry: useRegistrySearch,
            yandex: useYandexSearch,
            google: useGoogleSearch
          },
          includeAds: includeAds,
          regions: selectedRegions,
          language: 'ru'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`[UnifiedSearch] Search completed:`, data);

      if (data.suppliers && data.suppliers.length > 0) {
        // Transform API response to match Supplier interface
        const transformedSuppliers: Supplier[] = data.suppliers.map((supplier: any) => ({
          id: supplier.id,
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone || '',
          website: supplier.website || '',
          description: supplier.description || '',
          categories: supplier.categories || [],
          userId: supplier.userId,
          responseRate: supplier.responseRate,
          totalRequests: supplier.totalRequests,
          successfulMatches: supplier.successfulMatches,
          keywordStrength: supplier.keywordStrength,
          lastResponseTime: supplier.lastResponseTime ? new Date(supplier.lastResponseTime) : null,
          // Add search metadata
          searchEngine: supplier.searchEngine,
          allEmails: supplier.allEmails || [supplier.email],
          allPhones: supplier.allPhones || [supplier.phone].filter(Boolean),
          searchDate: supplier.searchDate,
        }));

        onSuppliersFound(transformedSuppliers);

        toast({
          title: "Поиск завершен",
          description: `Найдено ${transformedSuppliers.length} поставщиков с контактной информацией`,
        });
      } else {
        toast({
          title: "Результаты не найдены",
          description: data.message || "Не удалось найти поставщиков с подлинной контактной информацией",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[UnifiedSearch] Search failed:', error);
      toast({
        title: "Ошибка поиска",
        description: error instanceof Error ? error.message : "Произошла ошибка при поиске поставщиков",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Найти поставщиков
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="search-query">Поисковый запрос</Label>
          <Input
            id="search-query"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Например: купить перчатки медицинские"
            onKeyPress={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
          />
        </div>

        <div className="bg-muted/50 p-4 rounded-lg space-y-3 border">
          <h3 className="font-medium">Источники поиска:</h3>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="use-registry-search"
                checked={useRegistrySearch}
                onCheckedChange={(checked) => setUseRegistrySearch(checked as boolean)}
                disabled={isSearching}
              />
              <Label htmlFor="use-registry-search" className="text-sm">
                Поиск по реестру компаний
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="use-yandex-search"
                checked={useYandexSearch}
                onCheckedChange={(checked) => setUseYandexSearch(checked as boolean)}
                disabled={isSearching}
              />
              <Label htmlFor="use-yandex-search" className="text-sm">
                Поиск через Yandex
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="use-google-search"
                checked={useGoogleSearch}
                onCheckedChange={(checked) => setUseGoogleSearch(checked as boolean)}
                disabled={isSearching}
              />
              <Label htmlFor="use-google-search" className="text-sm">
                Поиск через Google
              </Label>
            </div>

            <div className="flex items-center space-x-3 hidden">
              <Checkbox
                id="include-ads"
                checked={includeAds}
                onCheckedChange={(checked) => setIncludeAds(checked as boolean)}
                disabled={isSearching}
              />
              <Label htmlFor="include-ads" className="text-sm">
                Включать рекламу
              </Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="elements">Количество результатов</Label>
          <Input
            id="elements"
            type="number"
            min="10"
            max="100"
            value={elements}
            onChange={(e) => setElements(parseInt(e.target.value) || 50)}
          />
        </div>

        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !searchQuery.trim()}
          className="w-full"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Поиск в Google и Yandex...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Найти поставщиков
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground">
          Поиск выполняется по выбранным источникам с извлечением подлинной контактной информации
        </div>
      </CardContent>
    </Card>
  );
}