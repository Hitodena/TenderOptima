import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Edit,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Building,
  FileText,
  User,
  PlusCircleIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SupplierFormDialog from '@/components/SupplierFormDialog';

// Интерфейс для поставщика
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

// Интерфейс для пагинации
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Интерфейс для ответа API
interface SuppliersResponse {
  success: boolean;
  data: Supplier[];
  pagination: PaginationInfo;
}

// Функция для debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Компонент пагинации
interface PaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ pagination, onPageChange }) => {
  const { page, totalPages, hasNextPage, hasPrevPage } = pagination;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, page - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) {
          pages.push('...');
        }
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push('...');
        }
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-gray-600">
        Показано {((page - 1) * pagination.limit) + 1}-{Math.min(page * pagination.limit, pagination.total)} из {pagination.total} поставщиков
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevPage}
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Button>
        
        <div className="flex items-center space-x-1">
          {getPageNumbers().map((pageNum, index) => (
            <Button
              key={index}
              variant={pageNum === page ? "default" : "outline"}
              size="sm"
              onClick={() => typeof pageNum === 'number' && onPageChange(pageNum)}
              disabled={pageNum === '...'}
              className="w-8 h-8 p-0"
            >
              {pageNum}
            </Button>
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
        >
          Вперед
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const VerifiedListPage: React.FC = () => {
  const { toast } = useToast();
  
  // Состояние для поиска и пагинации
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Debounced поиск
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Состояние для модального окна редактирования
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Состояние для модального окна создания поставщика
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Запрос данных
  const { data, isLoading, error, refetch } = useQuery<SuppliersResponse>({
    queryKey: ['verified-suppliers', currentPage, pageSize, debouncedSearchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      
      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim());
      }
      
      const response = await fetch(`/api/admin/suppliers?${params}`, {
        headers: {
          'X-Admin-Token': localStorage.getItem('adminToken') || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      
      return response.json();
    },
  });

  // Сброс страницы при изменении поиска
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // Обработчики
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingSupplier(null);
  };

  const handleEditSuccess = () => {
    // Обновляем данные после успешного редактирования
    refetch();
  };

  const handleCreateSupplier = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreateSuccess = () => {
    // Обновляем данные после успешного создания
    refetch();
    handleCloseCreateModal();
  };

  // Форматирование даты
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Обработка ошибок
  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Ошибка загрузки данных: {error.message}
            </div>
            <div className="text-center mt-4">
              <Button onClick={() => refetch()}>
                Попробовать снова
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Реестр поставщиков</h1>
          <p className="text-gray-600 mt-2">
            Управление верифицированными поставщиками
          </p>
        </div>
        <Button
          onClick={handleCreateSupplier}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <PlusCircleIcon className="h-4 w-4 mr-2" />
          Создать поставщика вручную
        </Button>
      </div>

      {/* Поиск */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Поиск по названию, описанию, категориям, сайту или ИНН..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Таблица */}
      <Card>
        <CardHeader>
          <CardTitle>Список поставщиков</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Spinner className="h-8 w-8" />
              <span className="ml-2">Загрузка...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">№</TableHead>
                      <TableHead className="min-w-[200px]">Название</TableHead>
                      <TableHead className="min-w-[250px]">Описание</TableHead>
                      <TableHead className="min-w-[150px]">Категории</TableHead>
                      <TableHead className="min-w-[150px]">Сайт</TableHead>
                      <TableHead className="min-w-[150px]">Email</TableHead>
                      <TableHead className="min-w-[120px]">Телефон</TableHead>
                      <TableHead className="min-w-[120px]">ИНН/УНП</TableHead>
                      <TableHead className="min-w-[150px]">Регион</TableHead>
                      <TableHead className="min-w-[100px]">Запросов</TableHead>
                      <TableHead className="min-w-[100px]">Ответов</TableHead>
                      <TableHead className="min-w-[100px]">Верифицировано</TableHead>
                      <TableHead className="min-w-[120px]">Дата создания</TableHead>
                      <TableHead className="w-24 sticky right-0 bg-white">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((supplier, index) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">
                          {(currentPage - 1) * pageSize + index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{supplier.name}</div>
                            {supplier.legalName && supplier.legalName !== supplier.name && (
                              <div className="text-sm text-gray-500">{supplier.legalName}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {supplier.description ? (
                            <div 
                              className="text-sm text-gray-600 line-clamp-3"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                              title={supplier.description}
                            >
                              {supplier.description}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.categories && Array.isArray(supplier.categories) && supplier.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {supplier.categories.map((category, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {category}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.website && (
                            <a
                              href={`https://${supplier.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              {supplier.website}
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.email && (
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="text-sm">{supplier.email}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.phone && (
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="text-sm">{supplier.phone}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.taxId && (
                            <div className="flex items-center">
                              <Building className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="text-sm font-mono">{supplier.taxId}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.region && (
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="text-sm">{supplier.region}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {supplier.totalRequests || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {(supplier.verifiedResponses || 0) + (supplier.unverifiedResponses || 0)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">
                            {supplier.verifiedResponses || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(supplier.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="sticky right-0 bg-white">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSupplier(supplier)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Редактировать
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Пагинация */}
              {data?.pagination && (
                <Pagination
                  pagination={data.pagination}
                  onPageChange={handlePageChange}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Модальное окно редактирования */}
      <SupplierFormDialog
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        supplier={editingSupplier}
        onSuccess={handleEditSuccess}
      />

      {/* Модальное окно создания поставщика */}
      <SupplierFormDialog
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        supplier={null}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default VerifiedListPage;
