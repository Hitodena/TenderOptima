import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import SupplierStats from "@/components/SupplierStats";
import ResponseHistoryModal from "@/components/ResponseHistoryModal";
import RegionSelector from "@/components/RegionSelector";
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  LinkIcon, 
  ExternalLinkIcon,
  AlertCircleIcon,
  MessageSquareIcon,
  PlusCircleIcon,
  X,
  BanIcon
} from "lucide-react";

// CSS стили для анимации удаления
const slideOutStyles = `
  @keyframes slideOut {
    0% {
      transform: translateX(0) scaleY(1);
      opacity: 1;
      max-height: 100px;
      margin-bottom: 0;
    }
    50% {
      transform: translateX(20px) scaleY(0.8);
      opacity: 0.7;
      max-height: 80px;
      margin-bottom: 0;
    }
    100% {
      transform: translateX(100px) scaleY(0);
      opacity: 0;
      max-height: 0;
      margin-bottom: -1px;
      padding-top: 0;
      padding-bottom: 0;
    }
  }
  
  .animate-slide-out {
    animation: slideOut 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    overflow: hidden;
  }
`;

// Добавляем стили в head документа
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = slideOutStyles;
  if (!document.head.querySelector('style[data-moderation-animation]')) {
    styleElement.setAttribute('data-moderation-animation', 'true');
    document.head.appendChild(styleElement);
  }
}

/**
 * Нормализация URL для унифицированного поиска и сохранения
 * Удаляет протокол, www, путь и параметры, оставляя только домен
 * @param url - исходный URL
 * @returns нормализованный домен
 */
function normalizeWebsite(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  try {
    // Удаляем протокол (http://, https://)
    let normalized = url.replace(/^https?:\/\//, '');
    
    // Удаляем www.
    normalized = normalized.replace(/^www\./, '');
    
    // Удаляем все после первого слэша (путь, параметры, якоря)
    normalized = normalized.split('/')[0];
    
    // Удаляем порт если есть
    normalized = normalized.split(':')[0];
    
    // Приводим к нижнему регистру
    normalized = normalized.toLowerCase();
    
    return normalized.trim();
  } catch (error) {
    console.error('[normalizeWebsite] Error normalizing URL:', url, error);
    return url;
  }
}

interface StagingSupplier {
  id: number;
  sourceEngine: string;
  searchQuery: string;
  region: string;
  rawTitle: string;
  rawDescription: string;
  rawUrl: string;
  rawEmails: string[];
  rawPhones: string[];
  status: string;
  createdAt: string;
  isDuplicate: boolean;
  matchedSupplierId: number | null;
  domain: string;
}

export default function ModerationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    supplierId: number;
    supplierName: string;
  }>({
    isOpen: false,
    supplierId: 0,
    supplierName: ""
  });

  const [searchDialog, setSearchDialog] = useState(false);
  const [formDialog, setFormDialog] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [initialFormData, setInitialFormData] = useState<any>(null);
  
  // Состояние для модального окна стоп-листа
  const [stopListDialog, setStopListDialog] = useState(false);
  const [stopListSupplier, setStopListSupplier] = useState<StagingSupplier | null>(null);
  const [stopListReason, setStopListReason] = useState('');
  const [stopListCustomReason, setStopListCustomReason] = useState('');
  
  // Состояние для пагинации
  const [currentPage, setCurrentPage] = useState(1);
  const [searchForm, setSearchForm] = useState({
    website: "",
    taxId: ""
  });
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
    contactPerson: ""
  });

  // Загрузка данных
  const { data: stagingSuppliers, isLoading, error } = useQuery<{
    data: StagingSupplier[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ["staging-suppliers", currentPage],
    queryFn: async () => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch(`/api/admin/staging-suppliers?page=${currentPage}&limit=30`, {
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Ошибка загрузки данных: ${response.status}`);
      }

      const result = await response.json();
      return result;
    },
    refetchOnWindowFocus: true,
    staleTime: 30000 // 30 секунд
  });

  // Поиск поставщика (отключен по умолчанию)
  const findSupplierQuery = useQuery({
    queryKey: ["find-supplier", searchForm.website, searchForm.taxId],
    queryFn: async () => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const params = new URLSearchParams();
      
      if (searchForm.website) {
        params.append('website', searchForm.website);
      }
      if (searchForm.taxId) {
        params.append('taxId', searchForm.taxId);
      }

      const response = await fetch(`/api/admin/suppliers/find?${params.toString()}`, {
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.status === 404) {
        throw new Error('NOT_FOUND');
      }

      if (!response.ok) {
        throw new Error(`Ошибка поиска: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    enabled: false, // Отключен по умолчанию
    retry: false // Не повторять запрос при ошибке
  });

  // Мутация для одобрения поставщика
  const approveMutation = useMutation({
    mutationFn: async (stagingId: number) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch('/api/admin/approve-supplier', {
        method: 'POST',
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stagingId }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Ошибка одобрения: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Поставщик одобрен",
        description: `Поставщик "${data.data?.supplierName}" успешно одобрен`,
      });
      // Данные обновятся только после анимации в обработчике
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка одобрения",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для отклонения поставщика
  const rejectMutation = useMutation({
    mutationFn: async (stagingId: number) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch('/api/admin/reject-supplier', {
        method: 'POST',
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stagingId }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Ошибка отклонения: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Поставщик отклонен",
        description: `Поставщик "${data.data?.supplierName}" отклонен`,
      });
      // Данные обновятся только после анимации в обработчике
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка отклонения",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для привязки к существующему поставщику
  const mergeMutation = useMutation({
    mutationFn: async ({ stagingId, existingSupplierId }: { stagingId: number; existingSupplierId: number }) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch('/api/admin/merge-supplier', {
        method: 'POST',
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stagingId, existingSupplierId }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Ошибка привязки: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Поставщик привязан",
        description: `Поставщик привязан к "${data.data?.supplierName}"`,
      });
      // Данные обновятся только после анимации в обработчике
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка привязки",
        description: error.message,
        variant: "destructive"
      });
    }
  });

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
      setFormDialog(false);
      resetSupplierForm();
      // Инвалидируем кеш поиска поставщиков, чтобы новый поставщик был найден при поиске
      queryClient.invalidateQueries({ queryKey: ["find-supplier"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка создания поставщика",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для добавления в стоп-лист
  const addToStopListMutation = useMutation({
    mutationFn: async ({ domain, reason }: { domain: string; reason: string }) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch('/api/admin/excluded-domains', {
        method: 'POST',
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain, reason }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Ошибка добавления в стоп-лист: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Добавлено в стоп-лист",
        description: "Домен успешно добавлен в стоп-лист",
      });
      setStopListDialog(false);
      setStopListSupplier(null);
      // Не сбрасываем причину исключения - оставляем выбранную для следующих добавлений
      setStopListCustomReason('');
      // Также отклоняем поставщика после добавления в стоп-лист
      if (stopListSupplier) {
        // Не вызываем rejectMutation.mutate здесь, чтобы избежать двойного обновления
        // Удаляем из списка анимации и обновляем данные через 800ms
        setTimeout(() => {
          setRemovingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(stopListSupplier.id);
            return newSet;
          });
          // Обновляем данные после завершения анимации
          queryClient.invalidateQueries({ queryKey: ["staging-suppliers"] });
        }, 800);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка добавления в стоп-лист",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для обновления поставщика
  const updateSupplierMutation = useMutation({
    mutationFn: async ({ supplierId, supplierData }: { supplierId: number; supplierData: any }) => {
      console.log('🔄 [DEBUG] updateSupplierMutation.mutationFn:', {
        supplierId,
        supplierData
      });
      
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

      console.log('📥 [DEBUG] updateSupplierMutation response:', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log('❌ [DEBUG] updateSupplierMutation error:', errorData);
        throw new Error(errorData.details || errorData.error || `Ошибка обновления: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [DEBUG] updateSupplierMutation success:', result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Поставщик обновлен",
        description: "Данные поставщика успешно обновлены",
      });
      setFormDialog(false);
      resetSupplierForm();
      // Инвалидируем кеш поиска поставщиков, чтобы при повторном поиске показывались обновленные данные
      queryClient.invalidateQueries({ queryKey: ["find-supplier"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка обновления поставщика",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Обработка результатов поиска поставщика
  useEffect(() => {
    if (findSupplierQuery.isSuccess && findSupplierQuery.data) {
      // Поставщик найден - закрываем SearchDialog и открываем FormDialog в режиме редактирования
      const supplier = findSupplierQuery.data;
      setSearchDialog(false);
      
      // Подготавливаем данные для FormDialog
      setInitialFormData({
        ...supplier,
        categories: Array.isArray(supplier.categories) ? supplier.categories.join(", ") : "",
        regions: supplier.region ? supplier.region.split(", ").filter(Boolean) : []
      });
      
      setIsEditingMode(true);
      setEditingSupplierId(supplier.id);
      setFormDialog(true);

      toast({
        title: "Поставщик найден",
        description: `Найден существующий поставщик "${supplier.name}". Открывается форма редактирования.`,
      });
    } else if (findSupplierQuery.isError && findSupplierQuery.error?.message === 'NOT_FOUND') {
      // Поставщик не найден - закрываем SearchDialog и открываем FormDialog в режиме создания
      setSearchDialog(false);
      
      // Подготавливаем данные для FormDialog (только то, что ввели в поиске)
      setInitialFormData({
        website: searchForm.website,
        taxId: searchForm.taxId,
        name: "",
        description: "",
        email: "",
        phone: "",
        categories: "",
        regions: [],
        legalName: "",
        legalAddress: "",
        contactPerson: ""
      });
      
      setIsEditingMode(false);
      setEditingSupplierId(null);
      setFormDialog(true);
      
      toast({
        title: "Поставщик не найден",
        description: "Поставщик с указанными данными не найден. Открывается форма для создания нового поставщика.",
      });
    }
  }, [findSupplierQuery.isSuccess, findSupplierQuery.isError, findSupplierQuery.data, findSupplierQuery.error, searchForm.website, searchForm.taxId, toast]);

  // Инициализация FormDialog с переданными данными
  useEffect(() => {
    if (formDialog && initialFormData) {
      setSupplierForm({
        name: initialFormData.name || "",
        description: initialFormData.description || "",
        website: initialFormData.website || "",
        email: initialFormData.email || "",
        phone: initialFormData.phone || "",
        categories: initialFormData.categories || "",
        regions: initialFormData.regions || [],
        legalName: initialFormData.legalName || "",
        taxId: initialFormData.taxId || "",
        legalAddress: initialFormData.legalAddress || "",
        contactPerson: initialFormData.contactPerson || ""
      });
    }
  }, [formDialog, initialFormData]);

  // Функция для смены страницы
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Обработчики действий
  const handleApprove = async (stagingId: number) => {
    if (processingIds.has(stagingId)) return; // Предотвращаем множественные нажатия
    
    setProcessingIds(prev => new Set(prev).add(stagingId));
    try {
      await approveMutation.mutateAsync(stagingId);
      // Добавляем анимацию удаления
      setRemovingIds(prev => new Set(prev).add(stagingId));
      // Обновляем данные и удаляем из списка анимации через 800ms
      setTimeout(() => {
        setRemovingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(stagingId);
          return newSet;
        });
        // Обновляем данные после завершения анимации
        queryClient.invalidateQueries({ queryKey: ["staging-suppliers"] });
      }, 800);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(stagingId);
        return newSet;
      });
    }
  };

  const handleReject = async (stagingId: number) => {
    if (processingIds.has(stagingId)) return; // Предотвращаем множественные нажатия
    
    setProcessingIds(prev => new Set(prev).add(stagingId));
    try {
      await rejectMutation.mutateAsync(stagingId);
      // Добавляем анимацию удаления
      setRemovingIds(prev => new Set(prev).add(stagingId));
      // Обновляем данные и удаляем из списка анимации через 800ms
      setTimeout(() => {
        setRemovingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(stagingId);
          return newSet;
        });
        // Обновляем данные после завершения анимации
        queryClient.invalidateQueries({ queryKey: ["staging-suppliers"] });
      }, 800);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(stagingId);
        return newSet;
      });
    }
  };

  const handleMerge = async (stagingId: number, existingSupplierId: number) => {
    if (processingIds.has(stagingId)) return; // Предотвращаем множественные нажатия
    
    setProcessingIds(prev => new Set(prev).add(stagingId));
    try {
      await mergeMutation.mutateAsync({ stagingId, existingSupplierId });
      // Добавляем анимацию удаления
      setRemovingIds(prev => new Set(prev).add(stagingId));
      // Обновляем данные и удаляем из списка анимации через 800ms
      setTimeout(() => {
        setRemovingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(stagingId);
          return newSet;
        });
        // Обновляем данные после завершения анимации
        queryClient.invalidateQueries({ queryKey: ["staging-suppliers"] });
      }, 800);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(stagingId);
        return newSet;
      });
    }
  };

  const handleAddToStopList = (supplier: StagingSupplier) => {
    setStopListSupplier(supplier);
    setStopListDialog(true);
  };

  const handleStopListSubmit = () => {
    if (!stopListSupplier) return;

    const finalReason = stopListReason === 'Другое...' ? stopListCustomReason : stopListReason;
    if (!finalReason.trim()) {
      toast({
        title: "Ошибка валидации",
        description: "Выберите или введите причину",
        variant: "destructive"
      });
      return;
    }

    // Нормализуем домен из URL поставщика
    const normalizedDomain = normalizeWebsite(stopListSupplier.rawUrl);
    if (!normalizedDomain) {
      toast({
        title: "Ошибка валидации",
        description: "Не удалось извлечь домен из URL поставщика",
        variant: "destructive"
      });
      return;
    }

    // Добавляем анимацию удаления перед добавлением в стоп-лист
    setRemovingIds(prev => new Set(prev).add(stopListSupplier.id));
    
    addToStopListMutation.mutate({
      domain: normalizedDomain,
      reason: finalReason
    });
  };

  const openHistoryModal = (supplierId: number, supplierName: string) => {
    setHistoryModal({
      isOpen: true,
      supplierId,
      supplierName
    });
  };

  const closeHistoryModal = () => {
    setHistoryModal({
      isOpen: false,
      supplierId: 0,
      supplierName: ""
    });
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
      contactPerson: ""
    });
    setSearchForm({
      website: "",
      taxId: ""
    });
    setIsEditingMode(false);
    setEditingSupplierId(null);
    setInitialFormData(null);
    setSearchDialog(false);
    setFormDialog(false);
  };

  // Обработчики для searchForm
  const handleSearchFormChange = (field: string, value: string) => {
    setSearchForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    if (!searchForm.website.trim() && !searchForm.taxId.trim()) {
      toast({
        title: "Ошибка валидации",
        description: "Пожалуйста, введите хотя бы один параметр для поиска (сайт или ИНН/УНП)",
        variant: "destructive"
      });
      return;
    }
    
    // Нормализуем website перед поиском для консистентности с бэкендом
    if (searchForm.website.trim()) {
      const normalizedWebsite = normalizeWebsite(searchForm.website);
      setSearchForm(prev => ({
        ...prev,
        website: normalizedWebsite
      }));
    }
    
    findSupplierQuery.refetch();
  };

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
    handleRegionsChange(updatedRegions);
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
      website: supplierForm.website,
      email: supplierForm.email,
      phone: supplierForm.phone,
      categories: categoriesArray,
      region: supplierForm.regions.length > 0 ? supplierForm.regions.join(', ') : null,
      legalName: supplierForm.legalName || null,
      taxId: supplierForm.taxId || null,
      legalAddress: supplierForm.legalAddress || null,
      contactPerson: supplierForm.contactPerson || null
    };

    // Выбираем мутацию в зависимости от режима
    console.log('🔍 [DEBUG] handleCreateSupplier:', {
      isEditingMode,
      editingSupplierId,
      supplierData
    });
    
    if (isEditingMode && editingSupplierId) {
      console.log('🔄 [DEBUG] Выполняем обновление поставщика:', editingSupplierId);
      await updateSupplierMutation.mutateAsync({ 
        supplierId: editingSupplierId, 
        supplierData 
      });
    } else {
      console.log('➕ [DEBUG] Выполняем создание нового поставщика');
      await createSupplierMutation.mutateAsync(supplierData);
    }
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <Spinner size="lg" />
            <span className="text-muted-foreground">Загрузка данных модерации...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircleIcon className="h-5 w-5" />
              Ошибка загрузки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{(error as Error).message}</p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["staging-suppliers"] })}
              className="mt-4"
            >
              Попробовать снова
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Модерация поставщиков</h2>
          <p className="text-muted-foreground">
            Управление поставщиками, ожидающими модерации
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Поставщики на модерацию</CardTitle>
          <CardDescription>
            Всего записей: {stagingSuppliers?.pagination?.total || 0}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stagingSuppliers?.data && stagingSuppliers.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">№</TableHead>
                    <TableHead className="w-64">Запрос</TableHead>
                    <TableHead>Название компании</TableHead>
                    <TableHead>Сайт</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-80">Описание</TableHead>
                    <TableHead>Дата создания</TableHead>
                    <TableHead className="w-40">Статистика</TableHead>
                    <TableHead className="w-20 sticky right-0 bg-white z-10">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagingSuppliers?.data?.map((supplier, index) => {
                    const isProcessing = processingIds.has(supplier.id);
                    const isRemoving = removingIds.has(supplier.id);
                    
                    return (
                      <TableRow 
                        key={supplier.id}
                        className={`
                          ${supplier.isDuplicate ? "bg-yellow-50" : ""} 
                          ${isRemoving ? "animate-slide-out" : ""}
                        `}
                        style={{
                          transition: isRemoving ? 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'all 0.3s ease-in-out'
                        }}
                      >
                        <TableCell className="text-center text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{supplier.searchQuery}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{supplier.rawTitle}</span>
                            {supplier.isDuplicate && (
                              <LinkIcon className="h-4 w-4 text-yellow-600" title="Дубликат" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <a 
                              href={supplier.rawUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm truncate max-w-[200px]"
                            >
                              {supplier.rawUrl}
                            </a>
                            <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell>
                          {supplier.rawEmails && supplier.rawEmails.length > 0 ? (
                            <div className="space-y-1">
                              {supplier.rawEmails.slice(0, 2).map((email, emailIndex) => (
                                <div key={emailIndex} className="text-sm text-blue-600">
                                  {email}
                                </div>
                              ))}
                              {supplier.rawEmails.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  +{supplier.rawEmails.length - 2} еще
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.rawDescription ? (
                            <p className="text-sm text-muted-foreground max-w-80 overflow-hidden" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {supplier.rawDescription}
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(supplier.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {supplier.matchedSupplierId ? (
                            <SupplierStats supplierId={supplier.matchedSupplierId} />
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Нет в реестре
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={`sticky right-0 z-10 ${supplier.isDuplicate ? "bg-yellow-50" : "bg-white"}`}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleApprove(supplier.id)}
                              disabled={isProcessing}
                              className="p-1.5 rounded-md bg-green-50 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Одобрить поставщика"
                            >
                              {isProcessing ? (
                                <Spinner size="sm" />
                              ) : (
                                <CheckCircleIcon className="h-3 w-3 text-green-600" />
                              )}
                            </button>
                            
                            <button
                              onClick={() => handleReject(supplier.id)}
                              disabled={isProcessing}
                              className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Отклонить поставщика"
                            >
                              {isProcessing ? (
                                <Spinner size="sm" />
                              ) : (
                                <XCircleIcon className="h-3 w-3 text-red-600" />
                              )}
                            </button>
                            
                            {supplier.isDuplicate && supplier.matchedSupplierId && (
                              <button
                                onClick={() => handleMerge(supplier.id, supplier.matchedSupplierId!)}
                                disabled={isProcessing}
                                className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Привязать к существующему поставщику"
                              >
                                {isProcessing ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <LinkIcon className="h-3 w-3 text-blue-600" />
                                )}
                              </button>
                            )}
                            
                            {supplier.matchedSupplierId && (
                              <button
                                onClick={() => openHistoryModal(supplier.matchedSupplierId!, supplier.rawTitle)}
                                className="p-1.5 rounded-md bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
                                title="Просмотреть историю ответов"
                              >
                                <MessageSquareIcon className="h-3 w-3 text-purple-600" />
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleAddToStopList(supplier)}
                              disabled={isProcessing}
                              className="p-1.5 rounded-md bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Добавить в стоп-лист"
                            >
                              <BanIcon className="h-3 w-3 text-orange-600" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Нет поставщиков на модерацию</p>
            </div>
          )}
        </CardContent>
        
        {/* Пагинация */}
        {stagingSuppliers?.data && stagingSuppliers.data.length > 0 && stagingSuppliers.pagination && (
          <Pagination
            currentPage={stagingSuppliers.pagination.page}
            totalPages={stagingSuppliers.pagination.totalPages}
            onPageChange={handlePageChange}
            hasNext={stagingSuppliers.pagination.hasNext}
            hasPrev={stagingSuppliers.pagination.hasPrev}
          />
        )}
      </Card>

      {/* Модальное окно истории ответов */}
      <ResponseHistoryModal
        isOpen={historyModal.isOpen}
        onClose={closeHistoryModal}
        supplierId={historyModal.supplierId}
        supplierName={historyModal.supplierName}
      />

      {/* SearchDialog - окно поиска поставщика */}
      <Dialog open={searchDialog} onOpenChange={setSearchDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Поиск поставщика</DialogTitle>
            <DialogDescription>
              Введите данные для поиска существующего поставщика или создания нового
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="search-website">Сайт</Label>
              <Input
                id="search-website"
                value={searchForm.website}
                onChange={(e) => handleSearchFormChange('website', e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div>
              <Label htmlFor="search-taxId">ИНН/УНП</Label>
              <Input
                id="search-taxId"
                value={searchForm.taxId}
                onChange={(e) => handleSearchFormChange('taxId', e.target.value)}
                placeholder="1234567890"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setSearchDialog(false)}
                disabled={findSupplierQuery.isFetching}
              >
                Отмена
              </Button>
              <Button
                onClick={handleSearch}
                disabled={findSupplierQuery.isFetching}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {findSupplierQuery.isFetching ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Поиск...
                  </>
                ) : (
                  'Проверить'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FormDialog - окно редактирования/создания поставщика */}
      <Dialog open={formDialog} onOpenChange={setFormDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>
                {isEditingMode ? 'Редактировать поставщика' : 'Создать поставщика вручную'}
              </DialogTitle>
              {isEditingMode && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Режим редактирования
                </Badge>
              )}
            </div>
            <DialogDescription>
              {isEditingMode 
                ? 'Обновить данные существующего поставщика в реестре'
                : 'Добавить нового поставщика напрямую в основной реестр'
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
                    placeholder="info@company.com"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categories">Категории *</Label>
                  <Input
                    id="categories"
                    value={supplierForm.categories}
                    onChange={(e) => handleSupplierFormChange('categories', e.target.value)}
                    placeholder="Категория 1, Категория 2, Категория 3"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Разделяйте категории запятыми
                  </p>
                </div>
                <div>
                  <Label htmlFor="region">Регионы</Label>
                  
                  {/* Отображение выбранных регионов */}
                  {supplierForm.regions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {supplierForm.regions.map(region => (
                        <Badge key={region} variant="secondary" className="flex items-center gap-1">
                          {region}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
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
                    placeholder="Выберите регионы"
                  />
                </div>
              </div>
            </div>

            {/* Дополнительные поля */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Юридическая информация</h3>
              
              <div>
                <Label htmlFor="legalName">Юридическое наименование</Label>
                <Input
                  id="legalName"
                  value={supplierForm.legalName}
                  onChange={(e) => handleSupplierFormChange('legalName', e.target.value)}
                  placeholder="ООО 'Название компании'"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxId">ИНН/УНП</Label>
                  <Input
                    id="taxId"
                    value={supplierForm.taxId}
                    onChange={(e) => handleSupplierFormChange('taxId', e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPerson">Контактное лицо</Label>
                  <Input
                    id="contactPerson"
                    value={supplierForm.contactPerson}
                    onChange={(e) => handleSupplierFormChange('contactPerson', e.target.value)}
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="legalAddress">Юридический адрес</Label>
                <Input
                  id="legalAddress"
                  value={supplierForm.legalAddress}
                  onChange={(e) => handleSupplierFormChange('legalAddress', e.target.value)}
                  placeholder="123456, г. Москва, ул. Примерная, д. 1"
                />
              </div>

            </div>

            {/* Кнопки действий */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setFormDialog(false);
                  resetSupplierForm();
                }}
                disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                onClick={handleCreateSupplier}
                disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {(createSupplierMutation.isPending || updateSupplierMutation.isPending) ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    {isEditingMode ? 'Обновление...' : 'Создание...'}
                  </>
                ) : (
                  isEditingMode ? 'Обновить поставщика' : 'Создать поставщика'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* StopListDialog - окно добавления в стоп-лист */}
      <Dialog open={stopListDialog} onOpenChange={setStopListDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить в стоп-лист</DialogTitle>
            <DialogDescription>
              Укажите причину добавления домена "{stopListSupplier?.rawUrl}" в стоп-лист
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="stopListReason">Причина исключения</Label>
              <Select value={stopListReason} onValueChange={setStopListReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите причину" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Маркетплейс/Агрегатор">Маркетплейс/Агрегатор</SelectItem>
                  <SelectItem value="Магазин-агрегатор">Магазин-агрегатор</SelectItem>
                  <SelectItem value="Бизнес-справочник">Бизнес-справочник</SelectItem>
                  <SelectItem value="Информационный сайт/Блог">Информационный сайт/Блог</SelectItem>
                  <SelectItem value="Форум/Социальная сеть">Форум/Социальная сеть</SelectItem>
                  <SelectItem value="Спам/Низкое качество">Спам/Низкое качество</SelectItem>
                  <SelectItem value="Государственный сайт">Государственный сайт</SelectItem>
                  <SelectItem value="Другое...">Другое...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {stopListReason === 'Другое...' && (
              <div>
                <Label htmlFor="stopListCustomReason">Укажите причину</Label>
                <Textarea
                  id="stopListCustomReason"
                  placeholder="Введите причину исключения домена..."
                  value={stopListCustomReason}
                  onChange={(e) => setStopListCustomReason(e.target.value)}
                  disabled={addToStopListMutation.isPending}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setStopListDialog(false);
                  setStopListSupplier(null);
                  setStopListReason('');
                  setStopListCustomReason('');
                }}
                disabled={addToStopListMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                onClick={handleStopListSubmit}
                disabled={addToStopListMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {addToStopListMutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Добавление...
                  </>
                ) : (
                  'Добавить в стоп-лист'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
