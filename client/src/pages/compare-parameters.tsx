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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Trash2, PlusCircle, FileDown } from 'lucide-react';
import { MainNavigation } from '@/components/main-navigation';
import type { Supplier } from '@shared/schema';

// Default comparison parameters
const DEFAULT_PARAMETERS = [
  { id: 'total_price_no_vat', label: 'Общая стоимость без НДС', selected: true },
  { id: 'total_price_with_vat', label: 'Общая стоимость с НДС', selected: true },
  { id: 'price_no_vat', label: 'Цена за единицу без НДС', selected: true },
  { id: 'price_with_vat', label: 'Цена за единицу с НДС', selected: true },
  { id: 'delivery_time', label: 'Сроки поставки', selected: true },
  { id: 'delivery_terms', label: 'Условия поставки', selected: true },
  { id: 'payment_terms', label: 'Условия оплаты', selected: true },
  { id: 'warranty', label: 'Гарантия', selected: true },
  { id: 'service', label: 'Сервис', selected: true },
  { id: 'resident', label: 'Резидент РБ', selected: true },
  { id: 'offer_validity', label: 'Срок действия предложения', selected: true },
  
];

interface CompareParametersProps {
  suppliers?: Supplier[];
  requestId?: number;
}

export default function CompareParameters({ suppliers = [], requestId }: CompareParametersProps) {
  const [, setLocation] = useLocation();
  const [storedSuppliers, setStoredSuppliers] = useState([]);
  
  // State for request ID
  const [localRequestId, setLocalRequestId] = useState<number | undefined>(requestId);
  
  // Get suppliers from local storage if not provided as props
  useEffect(() => {
    try {
      const storedSuppliersJson = localStorage.getItem('compareSuppliers');
      const storedRequestId = localStorage.getItem('compareRequestId');
      
      if (storedSuppliersJson) {
        const parsedSuppliers = JSON.parse(storedSuppliersJson);
        setStoredSuppliers(parsedSuppliers);
      }
      
      if (storedRequestId && !localRequestId) {
        const parsedRequestId = parseInt(storedRequestId);
        if (!isNaN(parsedRequestId)) {
          setLocalRequestId(parsedRequestId);
        }
      }
      
      if (!storedSuppliersJson && suppliers.length === 0) {
        toast({
          title: "No suppliers selected",
          description: "Please select suppliers to compare first.",
          variant: "destructive"
        });
        setLocation('/dashboard');
      }
    } catch (error) {
      console.error("Error retrieving suppliers from storage:", error);
      toast({
        title: "Error",
        description: "Could not retrieve supplier data.",
        variant: "destructive"
      });
      setLocation('/dashboard');
    }
  }, [suppliers, localRequestId, setLocation]);
  
  // State for comparison parameters
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [newParameter, setNewParameter] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Count selected parameters
  const selectedCount = parameters.filter(p => p.selected).length;
  
  // Toggle parameter selection
  const toggleParameter = (id: string) => {
    setParameters(parameters.map(p => 
      p.id === id ? { ...p, selected: !p.selected } : p
    ));
  };
  
  // Add custom parameter
  const addCustomParameter = () => {
    if (!newParameter.trim()) {
      toast({
        title: "Необходимо название пераметра",
        description: "Пожалуйста, введите название параметра, который необходимо добавить.",
        variant: "destructive"
      });
      return;
    }
    
    // Create a sanitized ID
    const id = 'custom_' + newParameter.trim().toLowerCase().replace(/\s+/g, '_');
    
    // Check if parameter with this ID already exists
    if (parameters.some(p => p.id === id)) {
      toast({
        title: "Параметр уже существует",
        description: "Параметр с таким названием уже существует.",
        variant: "destructive"
      });
      return;
    }
    
    setParameters([
      ...parameters,
      { id, label: newParameter.trim(), selected: true }
    ]);
    
    setNewParameter('');
    
    toast({
      title: "Parameter added",
      description: `"${newParameter.trim()}" added to comparison parameters.`
    });
  };
  
  // Remove custom parameter
  const removeParameter = (id: string) => {
    setParameters(parameters.filter(p => p.id !== id));
  };
  
  // Start comparison process
  const startComparison = () => {
    const selectedParameters = parameters.filter(p => p.selected);
    
    if (selectedParameters.length === 0) {
      toast({
        title: "Не выбрано ни одного параметра",
        description: "Пожалуйста, выберете хотябы один параметр",
        variant: "destructive"
      });
      return;
    }
    
    // Проверяем, что у нас есть поставщики для сравнения
    const suppliersToCompare = suppliers.length > 0 ? suppliers : storedSuppliers;
    
    if (!suppliersToCompare || suppliersToCompare.length === 0) {
      toast({
        title: "Не выбраны поставщики",
        description: "Пожалуйста, выберите поставщиков для сравнения",
        variant: "destructive"
      });
      return;
    }
    
    console.log("Starting comparison with suppliers:", suppliersToCompare.length);
    
    setIsProcessing(true);
    
    // Store selected parameters in local storage
    localStorage.setItem('compareParameters', JSON.stringify(selectedParameters));
    
    // Store suppliers in local storage
    localStorage.setItem('compareSuppliers', JSON.stringify(suppliersToCompare));
    
    // Store request ID if available for the comparison process
    if (localRequestId) {
      localStorage.setItem('compareRequestId', localRequestId.toString());
      // Navigate to comparison results page with request ID
      setLocation(`/compare-results/${localRequestId}`);
    } else {
      // Navigate to comparison results page without request ID
      setLocation('/compare-results');
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="container mx-auto px-4 py-8">
        
          
      
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Выбор параметров для сравнения</CardTitle>
          <CardDescription>
            Выберете параметры, по которым необходимо провести сравнение {storedSuppliers.length || suppliers.length} выбранных поставщиков. 
            Вы можете добавить свои параметры или выбрать из списка.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="font-medium">Выбранных парамертов: {selectedCount}</div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Добавить свой параметр..."
                value={newParameter}
                onChange={(e) => setNewParameter(e.target.value)}
                className="w-64"
                onKeyDown={(e) => e.key === 'Enter' && addCustomParameter()}
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={addCustomParameter}
                title="Добавить свой параметр"
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Separator />
          
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {parameters.map((parameter) => {
                const isCustom = parameter.id.startsWith('custom_');
                
                return (
                  <div 
                    key={parameter.id} 
                    className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 h-4"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        id={parameter.id}
                        checked={parameter.selected}
                        onCheckedChange={() => toggleParameter(parameter.id)}
                      />
                      <Label 
                        htmlFor={parameter.id} 
                        className="cursor-pointer font-medium"
                      >
                        {parameter.label}
                      </Label>
                      {isCustom && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Custom
                        </span>
                      )}
                    </div>
                    
                    {isCustom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => removeParameter(parameter.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
          >
            Отмена
          </Button>
          <Button 
            onClick={startComparison}
            disabled={selectedCount === 0 || isProcessing}
            className="gap-2"
          >
            {isProcessing ? "Processing..." : (
              <>
                <FileDown className="h-4 w-4" />
                Сравнить
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}