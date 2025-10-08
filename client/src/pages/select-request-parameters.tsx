import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Trash2, PlusCircle, Mail, Loader2 } from 'lucide-react';
import { MainNavigation } from '@/components/main-navigation';
import { apiRequest } from '@/lib/queryClient';
import type { Supplier, SearchRequest } from '@shared/schema';

// Default request parameters - some unselected by default
const DEFAULT_PARAMETERS = [
  { id: 'product_description', label: 'Описание товара', selected: true },
  { id: 'total_price_no_vat', label: 'Общая стоимость без НДС', selected: true },
  { id: 'total_price_with_vat', label: 'Общая стоимость с НДС', selected: true },
  { id: 'price_no_vat', label: 'Цена за единицу без НДС', selected: true },
  { id: 'payment_terms', label: 'Условия оплаты', selected: true },
  { id: 'delivery_time', label: 'Сроки поставки', selected: true },
  { id: 'delivery_terms', label: 'Условия поставки', selected: false }, // Выключено по умолчанию
  { id: 'warranty', label: 'Гарантия', selected: false }, // Выключено по умолчанию
  { id: 'supplier_name', label: 'Наименование поставщика', selected: true },
  { id: 'supplier_residency', label: 'Резидентство поставщика (страна)', selected: false }, // Выключено по умолчанию
  { id: 'supplier_inn_unp', label: 'ИНН / УНП', selected: true },
];

interface SelectRequestParametersProps {
  suppliers?: Supplier[];
  searchRequest?: SearchRequest;
  requestId?: number;
}

export default function SelectRequestParameters({ suppliers = [], searchRequest, requestId }: SelectRequestParametersProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [parameters, setParameters] = useState<{ id: string; label: string; selected: boolean; }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  const [newParameter, setNewParameter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [productDescription, setProductDescription] = useState('');

  // Fetch existing suppliers if not provided
  useEffect(() => {
    // First try to get suppliers from props
    if (suppliers.length > 0) {
      setSelectedSuppliers(suppliers);
      return;
    }

    // Then try to get from session storage
    try {
      const suppliersFromSession = sessionStorage.getItem('selectedSuppliers');
      if (suppliersFromSession) {
        const parsedSuppliers = JSON.parse(suppliersFromSession);
        if (Array.isArray(parsedSuppliers) && parsedSuppliers.length > 0) {
          console.log('Loaded suppliers from session storage:', parsedSuppliers.length);
          setSelectedSuppliers(parsedSuppliers);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading suppliers from session storage:', error);
    }

    // Finally try to fetch from API if we have a requestId
    if (requestId) {
      fetchRequestSuppliers();
    }
  }, [suppliers, requestId]);

  // Initialize parameters from defaults and clear old session data
  useEffect(() => {
    setParameters([...DEFAULT_PARAMETERS]);
    
    // Clear any old session data to prevent form pre-filling issues
    try {
      sessionStorage.removeItem('productDescription');
      // Keep essential data but clear old form data
    } catch (error) {
      console.error('Error clearing session storage:', error);
    }
    
    // Initialize with empty description
    setProductDescription('');
  }, []);

  // Fetch suppliers for this request from the API
  const fetchRequestSuppliers = async () => {
    if (!requestId) return;

    try {
      setLoading(true);

      interface SupplierResponse {
        suppliers: Supplier[];
      }

      const response = await apiRequest<SupplierResponse>(`/api/request-suppliers?requestId=${requestId}`, 'GET');

      if (response && response.suppliers) {
        setSelectedSuppliers(response.suppliers);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить поставщиков.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Count selected parameters
  const selectedCount = parameters.filter(p => p.selected).length;

  // Toggle parameter selection
  const toggleParameter = (id: string) => {
    // Get the parameter we're toggling
    const paramToToggle = parameters.find(p => p.id === id);

    // Count how many parameters would be selected after toggle
    const wouldDeselect = paramToToggle?.selected === true;
    const wouldHaveSelected = selectedCount + (wouldDeselect ? -1 : 1);

    // Don't allow deselecting if it's the last selected parameter
    if (wouldDeselect && wouldHaveSelected < 1) {
      toast({
        title: "Ошибка",
        description: "Выберете хотябы один параметр",
        variant: "destructive"
      });
      return;
    }

    // Proceed with the toggle
    setParameters(parameters.map(p => 
      p.id === id ? { ...p, selected: !p.selected } : p
    ));
  };

  // Add custom parameter
  const addCustomParameter = () => {
    const trimmedParam = newParameter.trim();

    if (!trimmedParam) {
      toast({
        title: "Необходимо название параметра",
        description: "Пожалуйста, введите название параметра, который необходимо добавить.",
        variant: "destructive"
      });
      return;
    }

    // Create a sanitized ID with timestamp to ensure uniqueness
    const timestamp = new Date().getTime();
    const id = `custom_${timestamp}_${trimmedParam.toLowerCase().replace(/\s+/g, '_')}`;

    // Check if parameter with similar label already exists (case insensitive)
    if (parameters.some(p => p.label.toLowerCase() === trimmedParam.toLowerCase())) {
      toast({
        title: "Параметр уже существует",
        description: "Параметр с таким названием уже существует.",
        variant: "destructive"
      });
      return;
    }

    // Add the new parameter
    const updatedParameters = [
      ...parameters,
      { id, label: trimmedParam, selected: true }
    ];

    setParameters(updatedParameters);
    setNewParameter('');

    toast({
      title: "Параметр добавлен",
      description: `"${trimmedParam}" добавлен в список.`
    });
  };

  // Remove custom parameter
  const removeParameter = (id: string) => {
    // Only allow removing custom parameters
    if (!id.startsWith('custom_')) {
      return;
    }

    setParameters(parameters.filter(p => p.id !== id));

    toast({
      title: "Параметр удален",
      description: "Пользовательский параметр удален из списка."
    });
  };

  // Handle form submission with reliability improvements
  const saveParametersAndContinue = async () => {
    console.log("saveParametersAndContinue called");

    // Validate product description first
    if (!productDescription.trim()) {
      toast({
        title: "Пожалуйста заполните Описание товара/ услуги.",
        description: "Описание товара/услуги обязательно для создания запроса.",
        variant: "destructive"
      });
      return;
    }

    // Ensure we have suppliers
    if (selectedSuppliers.length === 0) {
      toast({
        title: "Нет выбранных поставщиков",
        description: "Пожалуйста, выберите поставщиков для запроса.",
        variant: "destructive"
      });
      return;
    }

    console.log("Selected suppliers count:", selectedSuppliers.length);

    // Get selected parameters
    const selectedParams = parameters.filter(p => p.selected);

    if (selectedParams.length === 0) {
      toast({
        title: "Нет выбранных параметров",
        description: "Пожалуйста, выберите хотя бы один параметр для запроса.",
        variant: "destructive"
      });
      return;
    }

    console.log("Selected parameters count:", selectedParams.length);

    try {
      // Set loading state to prevent multiple clicks
      setIsLoading(true);
      toast({
        title: "Обработка",
        description: "Подождите, сохраняем параметры и создаем запрос..."
      });

      // Save parameters to session storage and prepare for database
      const selectedParamLabels = selectedParams.map(p => p.label);
      const fullSelectedParams = selectedParams.map(p => ({
        id: p.id,
        label: p.label,
        selected: true
      }));

      sessionStorage.setItem('requestParameters', JSON.stringify(selectedParamLabels));
      sessionStorage.setItem('parametersSelected', 'true');

      // Log the selected parameters for debugging
      console.log('Selected parameters for request:', selectedParamLabels);

      console.log('Starting navigation to email form...');

      // Create search request first if we don't have one
      if (!searchRequest && !requestId) {
        console.log('No existing request - creating new one');

        // This is a new search request
        const createRequestData = {
          productName: sessionStorage.getItem('productName') || 'Не указано',
          productDescription: productDescription || sessionStorage.getItem('productDescription') || '',
          timeline: sessionStorage.getItem('timeline') || 'Стандартные сроки',
          status: 'pending',
          parameters: selectedParamLabels, // Add selected parameters to the request
          suppliers: selectedSuppliers.map(s => ({ id: s.id, email: s.email }))
        };

        console.log("Request data being sent:", JSON.stringify(createRequestData));

        interface SearchRequestResponse {
          id: number;
          orderNumber?: string;
        }

        try {
          console.log('Sending API request to create search request');
          const response = await apiRequest<SearchRequestResponse>('/api/search-requests', 'POST', createRequestData);

          if (response && response.id) {
            // Save the request ID
            console.log('Created request with ID:', response.id);
            sessionStorage.setItem('requestId', response.id.toString());

            // Parameters are now automatically saved during request creation
            console.log('Parameters saved automatically during request creation');

            // Show success message
            toast({
              title: "Запрос создан",
              description: "Запрос успешно создан, переходим к форме отправки."
            });

            // Force delay before redirect to ensure user sees the message
            setTimeout(() => {
              // Use history-based or hash-based routing depending on environment
              setLocation(`/send-request?requestId=${response.id}`);
            }, 1000);
          } else {
            throw new Error('Failed to create search request: no ID returned');
          }
        } catch (error) {
          console.error('API error creating search request:', error);
          toast({
            title: "Ошибка",
            description: "Не удалось создать запрос на сервере. Пожалуйста, попробуйте еще раз.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
      } else {
        // We already have a search request ID
        console.log('Using existing request');
        const reqId = searchRequest?.id || requestId;
        if (reqId) {
          console.log('Using request ID:', reqId);
          sessionStorage.setItem('requestId', reqId.toString());

          // Save parameters to database for existing request
          try {
            console.log('Saving parameters to database for existing request ID:', reqId);
            const paramSaveResponse = await apiRequest(`/api/parameters/${reqId}`, 'POST', {
              parameters: fullSelectedParams
            });

            console.log('Parameters saved to database for existing request:', paramSaveResponse);
          } catch (paramError) {
            console.error('Error saving parameters to database for existing request:', paramError);
            // Continue anyway since we have parameters in sessionStorage as backup
          }

          // Show success message
          toast({
            title: "Параметры сохранены",
            description: "Переходим к форме отправки запроса."
          });

          // Force delay before redirect
          setTimeout(() => {
            // Use wouter's setLocation for proper routing
            setLocation(`/send-request${reqId ? `?requestId=${reqId}` : ''}`);
          }, 1000);
        } else {
          // This should rarely happen
          console.error("No request ID available");
          toast({
            title: "Ошибка",
            description: "Идентификатор запроса не найден.",
            variant: "destructive"
          });
          setIsLoading(false);
        }
      }

    } catch (error) {
      console.error('Error processing request:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить параметры. Пожалуйста, попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-background">
      <MainNavigation />
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Левая колонка - Выбор параметров (40%) */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                <span className="text-sm font-normal text-muted-foreground mr-2">1/3</span>
                Выбор параметров для запроса
              </CardTitle>
              <CardDescription className="text-sm">
                {selectedSuppliers.length > 0 
                  ? `Выберите параметры, которые будут включены в письмо с запросом для ${selectedSuppliers.length} выбранных поставщиков.`
                  : 'Загрузка поставщиков...'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="mb-2">
                <div className="text-sm text-muted-foreground mb-2">
                  Выбранных параметров: {selectedCount}
                </div>
                
                {/* Список параметров с уменьшенными отступами */}
                <div className="space-y-0.5">
                  {parameters.map((parameter) => {
                    const isCustom = parameter.id.startsWith('custom_');
                    return (
                      <div key={parameter.id} className="flex items-center justify-between py-0.5 border-b border-gray-100">
                        <div className="flex items-center">
                          <Checkbox 
                            id={parameter.id}
                            checked={parameter.selected}
                            onCheckedChange={() => toggleParameter(parameter.id)}
                          />
                          <Label 
                            htmlFor={parameter.id}
                            className="ml-3 cursor-pointer text-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              toggleParameter(parameter.id);
                            }}
                          >
                            {parameter.label}
                          </Label>
                        </div>

                        {isCustom && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-700"
                            onClick={() => removeParameter(parameter.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Добавление своего параметра - как обычная строка */}
              <div className="flex items-center justify-between py-0.5 border-b border-gray-100">
                <div className="flex items-center flex-1">
                  <Input
                    placeholder="Добавить свой параметр..."
                    value={newParameter}
                    onChange={(e) => setNewParameter(e.target.value)}
                    className="border-0 shadow-none p-0 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && addCustomParameter()}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-500 hover:text-gray-700"
                  onClick={addCustomParameter}
                  disabled={!newParameter.trim()}
                >
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Правая колонка - Описание товара/услуги (60%) */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                <span className="text-sm font-normal text-muted-foreground mr-2">2/3</span>
                Описание товара/услуги
              </CardTitle>
              <CardDescription className="text-sm">
                Предоставьте подробное описание товара или услуги, которую вы хотите закупить. Эта информация будет включена в письмо поставщикам.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <Textarea
                placeholder="Опишите детально товар или услугу, технические характеристики, объемы, особые требования..."
                value={productDescription}
                onChange={(e) => {
                  setProductDescription(e.target.value);
                  sessionStorage.setItem('productDescription', e.target.value);
                }}
                className="min-h-[200px]"
              />
            </CardContent>
          </Card>
        </div>

        {/* Кнопки внизу страницы */}
        <div className="flex justify-between mt-6 pb-4">
          <Button 
            variant="outline"
            onClick={() => {
              setLocation('/send-request');
            }}
          >
            Назад
          </Button>
          <Button 
            variant="default" 
            onClick={saveParametersAndContinue}
            disabled={isLoading || !productDescription.trim()}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Обработка...
              </>
            ) : (
              "Создать запрос"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}