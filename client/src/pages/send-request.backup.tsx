import { useState, useEffect } from "react";
import { MainNavigation } from "@/components/main-navigation";
import { CustomSupplierInput } from "@/components/custom-supplier-input";
import { UploadSuppliersExcel } from "@/components/upload-suppliers-excel";
import { EmailForm } from "@/components/email-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Mail, X, Users, ArrowLeft } from "lucide-react";
import type { SearchRequest, Supplier } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function SendRequest() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [comingFromGroup, setComingFromGroup] = useState(false);
  
  const { toast } = useToast();
  const [location] = useLocation();


  // Function to create empty request object
  const createEmptyRequest = (): SearchRequest => {
    return {
      id: 0, // Will be assigned on server
      orderNumber: '',
      productName: productName,
      productDescription: productDescription,
      timeline: deadline,
      additionalRequirements: null,
      status: 'pending',
      createdAt: null,
      matchedSuppliers: null,
      useDbSearch: false,
      useApiSearch: false
    } as SearchRequest;
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handleAddSupplier = (supplier: Supplier) => {
    setSuppliers(prev => [...prev, supplier]);
  };

  const handleBulkUpload = (newSuppliers: Supplier[]) => {
    setSuppliers(prev => [...prev, ...newSuppliers]);
  };

  const handleRemoveSupplier = (id: number | string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setSelectedSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const handleSelectSupplier = (supplier: Supplier, checked: boolean) => {
    if (checked) {
      setSelectedSuppliers(prev => [...prev, supplier]);
    } else {
      setSelectedSuppliers(prev => prev.filter(s => s.id !== supplier.id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSuppliers([...suppliers]);
    } else {
      setSelectedSuppliers([]);
    }
  };

  // Функция для получения параметров из URL
  const getSearchParam = (param: string): string | null => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      return url.searchParams.get(param);
    }
    return null;
  };

  // Загрузка контактов из группы при первом рендере
  useEffect(() => {
    console.log("Текущий URL:", location);
    console.log("window.location:", window.location.href);
    
    // Проверяем, есть ли в URL параметр from=group
    const isFromGroup = getSearchParam('from') === 'group';
    console.log("Переход из группы (из параметра URL):", isFromGroup);
    setComingFromGroup(isFromGroup);
    
    // Проверяем данные в sessionStorage
    console.log("Проверяем данные в sessionStorage");
    try {
      // Получаем данные из sessionStorage
      const storedContacts = sessionStorage.getItem('groupContacts');
      const storedGroupId = sessionStorage.getItem('groupId');
      const storedGroupName = sessionStorage.getItem('groupName');
      
      const contactsExist = !!storedContacts;
      const contactsLength = contactsExist && storedContacts ? JSON.parse(storedContacts).length : 0;
      
      console.log("Найдены данные в sessionStorage:", {
        contacts: contactsExist,
        contactsLength: contactsLength,
        groupId: storedGroupId,
        groupName: storedGroupName
      });
      
      // Если есть данные в sessionStorage, используем их, даже если параметр URL отсутствует
      if (storedContacts && storedGroupId && storedGroupName) {
        // Если не было установлено через URL, установим состояние
        if (!isFromGroup) {
          console.log("Данные найдены в sessionStorage, но параметр URL отсутствует. Устанавливаем comingFromGroup = true");
          setComingFromGroup(true);
        }
        
        console.log("Парсим данные контактов");
        const parsedContacts = JSON.parse(storedContacts);
        console.log("Количество контактов:", parsedContacts.length);
        
        // Преобразуем контакты в формат поставщиков
        const suppliersFromContacts = parsedContacts.map((contact: any) => ({
          id: contact.id,
          name: contact.name || 'Поставщик',
          email: contact.email,
          phone: contact.phone || null,
          website: null,
          categories: [],
          description: null,
          responseRate: null,
          successRate: null,
          keywords: []
        }));
        
        console.log("Преобразованные поставщики:", suppliersFromContacts.length);
        
        // Устанавливаем поставщиков и выбранных поставщиков
        setSuppliers(suppliersFromContacts);
        setSelectedSuppliers(suppliersFromContacts);
        
        // Устанавливаем информацию о группе
        setGroupId(parseInt(storedGroupId));
        setGroupName(storedGroupName);
        
        // Удаляем данные из sessionStorage, чтобы они не использовались повторно
        sessionStorage.removeItem('groupContacts');
        sessionStorage.removeItem('groupId');
        sessionStorage.removeItem('groupName');
        
        console.log("Данные контактов успешно загружены");
        
        // Выводим сообщение об успешной загрузке контактов
        toast({
          title: "Контакты загружены",
          description: `Загружено ${suppliersFromContacts.length} контактов из группы "${storedGroupName}"`,
        });
      } else {
        console.log("Не найдены необходимые данные в sessionStorage");
      }
    } catch (error) {
      console.error("Ошибка при загрузке контактов из группы:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить контакты из группы",
        variant: "destructive",
      });
    }
  }, [location, toast]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <MainNavigation />

        <div className="mt-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Отправить запрос поставщикам</h2>
            
            {comingFromGroup && groupName && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Группа: {groupName}
                </Badge>
                <Link href={`/contact-groups/${groupId}`}>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Вернуться к группе
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {!showEmailForm ? (
            <>
              {/* Product info and deadline fields */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="productName">Название продукта</Label>
                  <Input
                    id="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Введите название продукта"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">Предложения подать до</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="выберете дату окончания приема предложений"
                    className="text-muted-foreground"
                  />
                  <div className="text-xs text-muted-foreground max-w-[600px] whitespace-nowrap">
                    время по умолчанию: до 18 часов (GMT+3)
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-6">
                <CustomSupplierInput onSupplierAdded={handleAddSupplier} />
                <UploadSuppliersExcel onSuppliersUploaded={handleBulkUpload} />
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Выбранные поставщики</CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="select-all" 
                          checked={suppliers.length > 0 && selectedSuppliers.length === suppliers.length}
                          onCheckedChange={handleSelectAll}
                          disabled={suppliers.length === 0}
                        />
                        <label 
                          htmlFor="select-all" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {selectedSuppliers.length === suppliers.length 
                            ? "Deselect All" 
                            : selectedSuppliers.length > 0 
                              ? "Select All" 
                              : "Select All Suppliers"}
                        </label>
                      </div>
                      <Button
                        variant="default"
                        className="flex items-center gap-2"
                        disabled={selectedSuppliers.length === 0}
                        onClick={() => setShowEmailForm(true)}
                      >
                        <Mail className="h-4 w-4" />
                        Отправить запрос ({selectedSuppliers.length})
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {suppliers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Нет выбранных поставщиков. Добавьте поставщиков для отправки запроса.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] rounded-md">
                      <div className="space-y-4">
                        {suppliers.map((supplier) => (
                          <div 
                            key={supplier.id} 
                            className="flex items-start justify-between p-4 rounded-lg border"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox 
                                id={`supplier-${supplier.id}`}
                                checked={selectedSuppliers.some(s => s.id === supplier.id)}
                                onCheckedChange={(checked) => 
                                  handleSelectSupplier(supplier, checked as boolean)
                                }
                              />
                              <div>
                                <p className="font-medium">{supplier.name}</p>
                                {supplier.email && (
                                  <p className="text-sm text-muted-foreground">{supplier.email}</p>
                                )}
                                {supplier.phone && (
                                  <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                                )}
                                {supplier.website && (
                                  <p className="text-sm text-muted-foreground">
                                    {supplier.website.startsWith('http') ? supplier.website : `http://${supplier.website}`}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveSupplier(supplier.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Отправка запроса {selectedSuppliers.length} поставщикам</h3>
                <Button 
                  variant="outline" 
                  onClick={() => setShowEmailForm(false)}
                  className="flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Вернуться к выбору поставщиков
                </Button>
              </div>
              <EmailForm suppliers={selectedSuppliers} searchRequest={createEmptyRequest()} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}