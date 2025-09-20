import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import RegionSelector from "@/components/RegionSelector";
import { X } from "lucide-react";

/**
 * Нормализация URL для унифицированного поиска и сохранения
 * Удаляет протокол, www, путь и параметры, оставляя только домен
 * @param url - исходный URL
 * @returns нормализованный домен
 */
function normalizeWebsite(url: string): string {
  try {
    if (!url) return '';
    
    // Удаляем протокол
    let normalized = url.replace(/^https?:\/\//, '');
    
    // Удаляем www
    normalized = normalized.replace(/^www\./, '');
    
    // Удаляем путь и параметры
    normalized = normalized.split('/')[0].split('?')[0].split('#')[0];
    
    return normalized.toLowerCase();
  } catch (error) {
    console.error('[normalizeWebsite] Error normalizing URL:', url, error);
    return url;
  }
}

interface Supplier {
  id: number;
  name: string;
  description: string;
  website: string;
  email: string;
  phone: string;
  region: string;
  categories: string[] | null;
  legalName: string;
  taxId: string;
  legalAddress: string;
  bankDetails: string;
  contactPerson: string;
  verifiedResponses: number;
  unverifiedResponses: number;
  totalRequests: number;
  createdAt: string;
  updatedAt: string;
}

interface SupplierFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null; // Если передан, то режим редактирования
  onSuccess?: () => void; // Колбэк при успешном сохранении
}

export default function SupplierFormDialog({ 
  isOpen, 
  onClose, 
  supplier = null, 
  onSuccess 
}: SupplierFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    description: "",
    website: "",
    email: "",
    phone: "",
    categories: "",
    regions: [] as string[],
    legalName: "",
    taxId: "",
    legalAddress: "",
    bankDetails: "",
    contactPerson: ""
  });

  const isEditingMode = !!supplier;

  // Заполняем форму данными поставщика при редактировании
  useEffect(() => {
    if (supplier && isOpen) {
      const regions = supplier.region ? supplier.region.split(',').map(r => r.trim()).filter(r => r) : [];
      
      setSupplierForm({
        name: supplier.name || "",
        description: supplier.description || "",
        website: supplier.website || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        categories: supplier.categories ? supplier.categories.join(', ') : "",
        regions: regions,
        legalName: supplier.legalName || "",
        taxId: supplier.taxId || "",
        legalAddress: supplier.legalAddress || "",
        bankDetails: supplier.bankDetails || "",
        contactPerson: supplier.contactPerson || ""
      });
    } else if (!supplier && isOpen) {
      // Сбрасываем форму при создании нового поставщика
      setSupplierForm({
        name: "",
        description: "",
        website: "",
        email: "",
        phone: "",
        categories: "",
        regions: [],
        legalName: "",
        taxId: "",
        legalAddress: "",
        bankDetails: "",
        contactPerson: ""
      });
    }
  }, [supplier, isOpen]);

  const handleSupplierFormChange = (field: string, value: string) => {
    setSupplierForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRegionsChange = (selectedRegions: string[]) => {
    setSupplierForm(prev => ({
      ...prev,
      regions: selectedRegions
    }));
  };

  const handleRemoveRegion = (regionNameToRemove: string) => {
    const updatedRegions = supplierForm.regions.filter(r => r !== regionNameToRemove);
    setSupplierForm(prev => ({
      ...prev,
      regions: updatedRegions
    }));
  };

  const resetSupplierForm = () => {
    setSupplierForm({
      name: "",
      description: "",
      website: "",
      email: "",
      phone: "",
      categories: "",
      regions: [],
      legalName: "",
      taxId: "",
      legalAddress: "",
      bankDetails: "",
      contactPerson: ""
    });
  };

  const handleCreateSupplier = async () => {
    // Валидация обязательных полей
    if (!supplierForm.name || !supplierForm.description || !supplierForm.website || 
        !supplierForm.email || !supplierForm.phone || !supplierForm.categories) {
      toast({
        title: "Ошибка валидации",
        description: "Пожалуйста, заполните все обязательные поля",
        variant: "destructive"
      });
      return;
    }

    // Преобразуем categories из строки в массив
    const categoriesArray = supplierForm.categories
      .split(',')
      .map(cat => cat.trim())
      .filter(cat => cat.length > 0);

    if (categoriesArray.length === 0) {
      toast({
        title: "Ошибка валидации",
        description: "Пожалуйста, укажите хотя бы одну категорию",
        variant: "destructive"
      });
      return;
    }

    const supplierData = {
      name: supplierForm.name,
      description: supplierForm.description,
      website: normalizeWebsite(supplierForm.website),
      email: supplierForm.email,
      phone: supplierForm.phone,
      categories: categoriesArray,
      region: supplierForm.regions.length > 0 ? supplierForm.regions.join(', ') : null,
      legalName: supplierForm.legalName || null,
      taxId: supplierForm.taxId || null,
      legalAddress: supplierForm.legalAddress || null,
      bankDetails: supplierForm.bankDetails || null,
      contactPerson: supplierForm.contactPerson || null
    };

    if (isEditingMode && supplier) {
      updateSupplierMutation.mutate({ supplierId: supplier.id, supplierData });
    } else {
      createSupplierMutation.mutate(supplierData);
    }
  };

  // Мутация для создания поставщика
  const createSupplierMutation = useMutation({
    mutationFn: async (supplierData: any) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supplierData),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `Ошибка создания: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Поставщик создан",
        description: "Поставщик успешно добавлен в реестр",
      });
      onClose();
      resetSupplierForm();
      onSuccess?.();
      // Инвалидируем кеш списка поставщиков
      queryClient.invalidateQueries({ queryKey: ["verified-suppliers"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка создания поставщика",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для обновления поставщика
  const updateSupplierMutation = useMutation({
    mutationFn: async ({ supplierId, supplierData }: { supplierId: number; supplierData: any }) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch(`/api/admin/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supplierData),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `Ошибка обновления: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Поставщик обновлен",
        description: "Данные поставщика успешно обновлены",
      });
      onClose();
      resetSupplierForm();
      onSuccess?.();
      // Инвалидируем кеш списка поставщиков
      queryClient.invalidateQueries({ queryKey: ["verified-suppliers"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка обновления поставщика",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const isLoading = createSupplierMutation.isPending || updateSupplierMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditingMode ? "Редактировать поставщика" : "Создать поставщика"}
          </DialogTitle>
          <DialogDescription>
            {isEditingMode 
              ? "Внесите изменения в данные поставщика" 
              : "Заполните форму для добавления нового поставщика в реестр"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Обязательные поля */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Основная информация</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Название компании *</Label>
                <Input
                  id="name"
                  value={supplierForm.name}
                  onChange={(e) => handleSupplierFormChange('name', e.target.value)}
                  placeholder="Введите название компании"
                />
              </div>
              <div>
                <Label htmlFor="website">Сайт *</Label>
                <Input
                  id="website"
                  value={supplierForm.website}
                  onChange={(e) => handleSupplierFormChange('website', e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Описание *</Label>
              <Textarea
                id="description"
                value={supplierForm.description}
                onChange={(e) => handleSupplierFormChange('description', e.target.value)}
                placeholder="Описание деятельности компании"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => handleSupplierFormChange('email', e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Телефон *</Label>
                <Input
                  id="phone"
                  value={supplierForm.phone}
                  onChange={(e) => handleSupplierFormChange('phone', e.target.value)}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="categories">Категории *</Label>
              <Input
                id="categories"
                value={supplierForm.categories}
                onChange={(e) => handleSupplierFormChange('categories', e.target.value)}
                placeholder="техника, оборудование, услуги (через запятую)"
              />
            </div>

            {/* Регионы */}
            <div>
              <Label>Регионы</Label>
              {supplierForm.regions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {supplierForm.regions.map((region, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {region}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => handleRemoveRegion(region)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
              <RegionSelector 
                isMulti={true} 
                selectedRegions={supplierForm.regions}
                onRegionsChange={handleRegionsChange}
              />
            </div>
          </div>

          {/* Дополнительные поля */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Дополнительная информация</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="legalName">Юридическое наименование</Label>
                <Input
                  id="legalName"
                  value={supplierForm.legalName}
                  onChange={(e) => handleSupplierFormChange('legalName', e.target.value)}
                  placeholder="ООО Название компании"
                />
              </div>
              <div>
                <Label htmlFor="taxId">ИНН/УНП</Label>
                <Input
                  id="taxId"
                  value={supplierForm.taxId}
                  onChange={(e) => handleSupplierFormChange('taxId', e.target.value)}
                  placeholder="1234567890"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="legalAddress">Юридический адрес</Label>
              <Textarea
                id="legalAddress"
                value={supplierForm.legalAddress}
                onChange={(e) => handleSupplierFormChange('legalAddress', e.target.value)}
                placeholder="Полный юридический адрес"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="bankDetails">Банковские реквизиты</Label>
              <Textarea
                id="bankDetails"
                value={supplierForm.bankDetails}
                onChange={(e) => handleSupplierFormChange('bankDetails', e.target.value)}
                placeholder="Банковские реквизиты"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="contactPerson">Контактное лицо</Label>
              <Input
                id="contactPerson"
                value={supplierForm.contactPerson}
                onChange={(e) => handleSupplierFormChange('contactPerson', e.target.value)}
                placeholder="Имя и должность контактного лица"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button 
            onClick={handleCreateSupplier} 
            disabled={isLoading}
          >
            {isLoading ? "Сохранение..." : (isEditingMode ? "Обновить" : "Создать")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
