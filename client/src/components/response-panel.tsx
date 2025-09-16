import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AddToGroupButton } from "@/components/add-to-group-button";
import { ParameterViewer } from "@/components/parameter-viewer";
import { ParameterExtractionStatus } from "@/components/parameter-extraction-status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { 
  BarChartHorizontal, 
  Paperclip, 
  X, 
  File, 
  Star,
  Calendar,
  Mail,
  User,
  Users,
  ChevronsUpDown,
  SlidersHorizontal,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
  ListFilter,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { type SupplierResponse, type RequestSupplier } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { AddToContactGroup } from "@/components/add-to-contact-group";
import { AttachmentsList } from "@/components/attachments-list";
// Импортируем функцию для работы с избранными ответами
import * as SupplierResponsesAPI from "@/api/supplier-responses";

interface ResponsePanelProps {
  supplierResponses: SupplierResponse[];
  selectedResponses: number[];
  setSelectedResponses: (ids: number[]) => void;
  markAsReadMutation: any;
  onCompare: () => void;
  requestId?: number; // Optional request ID for parameter extraction
  onActiveResponseChange?: (responseId: number, response: SupplierResponse) => void;
  onExtractParameters?: () => void; // Callback for when "Extract Parameters" button is clicked
  onCheckNewOffers?: () => void; // Callback for checking new offers
  isCheckingOffers?: boolean; // Loading state for checking offers
}

export function ResponsePanel({
  supplierResponses,
  selectedResponses,
  setSelectedResponses,
  markAsReadMutation,
  onCompare,
  requestId,
  onActiveResponseChange,
  onExtractParameters,
  onCheckNewOffers,
  isCheckingOffers = false
}: ResponsePanelProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState<boolean>(false);
  const [messageSent, setMessageSent] = useState<boolean>(false);
  const [activeResponseId, setActiveResponseId] = useState<number | null>(
    supplierResponses.length > 0 ? supplierResponses[0].id : null
  );
  const [localResponses, setLocalResponses] = useState<SupplierResponse[]>(supplierResponses);
  const [supplierResponsesState, setSupplierResponses] = useState<SupplierResponse[]>(supplierResponses);
  
  // Sorting options
  type SortField = 'date' | 'sender' | 'status' | 'favorite';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  
  // File attachment states
  const [attachments, setAttachments] = useState<Array<{
    filename: string;
    contentType: string;
    content: string;
    size: number;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAddToGroupOpen, setIsAddToGroupOpen] = useState(false);
  const [isParameterViewerOpen, setIsParameterViewerOpen] = useState(false);
  const [contactsToAdd, setContactsToAdd] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local responses when props change
  useEffect(() => {
    setLocalResponses(supplierResponses.map(r => {
      const existingResponse = localResponses.find(lr => lr.id === r.id);
      return {
        ...r,
        isRead: existingResponse?.isRead || r.isRead,
        replyDraft: (existingResponse as any)?.replyDraft
      };
    }));
  }, [supplierResponses]);

  // Keep read status in local state when responses update
  useEffect(() => {
    setLocalResponses(prevResponses => {
      return supplierResponses.map(newResponse => {
        const existingResponse = prevResponses.find(r => r.id === newResponse.id);
        return {
          ...newResponse,
          isRead: existingResponse?.isRead || newResponse.isRead || false
        };
      });
    });
  }, [supplierResponses]);
  
  // Find the active response from local state
  const activeResponse = localResponses.find(r => r.id === activeResponseId);

  // Function to update the active response (for reply drafts, etc.)
  const updateActiveResponse = (updatedResponse: SupplierResponse) => {
    setLocalResponses(prevResponses => 
      prevResponses.map(response => 
        response.id === updatedResponse.id ? updatedResponse : response
      )
    );
  };
  
  // Function to toggle favorite status
  const handleToggleFavorite = async (responseId: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevent row click
    }
    
    try {
      const result = await SupplierResponsesAPI.toggleSupplierResponseFavorite(responseId);
      
      // Update local state
      setLocalResponses(prevResponses => 
        prevResponses.map(response => 
          response.id === responseId ? {
            ...response,
            isFavorite: result.isFavorite
          } : response
        )
      );
    } catch (error) {
      console.error('Error toggling favorite status:', error);
      // Отключено уведомление об ошибке
    }
  };
  
  // Sorting function for responses
  const getSortedResponses = () => {
    let filteredResponses = [...localResponses];
    
    // Filter by favorites if needed
    if (showFavoritesOnly) {
      filteredResponses = filteredResponses.filter(r => r.isFavorite);
    }
    
    // Если есть сохраненный порядок отображения для сортировки по статусу, используем его
    if (sortField === 'status' && responseDisplayOrder.length > 0) {
      // Сначала возвращаем список в соответствии с сохраненным порядком
      const result = [...filteredResponses];
      result.sort((a, b) => {
        const indexA = responseDisplayOrder.indexOf(a.id);
        const indexB = responseDisplayOrder.indexOf(b.id);
        
        // Если оба элемента имеют позицию в сохраненном порядке
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        
        // Новые элементы (не в сохраненном порядке) сортируются по стандартной логике
        if (indexA === -1 && indexB === -1) {
          return sortDirection === 'asc' 
            ? (a.isRead ? 1 : 0) - (b.isRead ? 1 : 0)
            : (b.isRead ? 1 : 0) - (a.isRead ? 1 : 0);
        }
        
        // Элементы в сохраненном порядке имеют приоритет
        return indexA === -1 ? 1 : -1;
      });
      
      return result;
    }
    
    // Стандартная сортировка для других полей
    return filteredResponses.sort((a, b) => {
      switch (sortField) {
        case 'date':
          const dateA = a.responseDate ? new Date(a.responseDate).getTime() : 0;
          const dateB = b.responseDate ? new Date(b.responseDate).getTime() : 0;
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
          
        case 'sender':
          const nameA = a.supplierName || '';
          const nameB = b.supplierName || '';
          return sortDirection === 'asc' 
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA);
          
        case 'status':
          // Sort by read/unread status
          if (sortDirection === 'asc') {
            return (a.isRead ? 1 : 0) - (b.isRead ? 1 : 0);
          } else {
            return (b.isRead ? 1 : 0) - (a.isRead ? 1 : 0);
          }
          
        case 'favorite':
          // Sort by favorite status
          if (sortDirection === 'asc') {
            return (a.isFavorite ? 1 : 0) - (b.isFavorite ? 1 : 0);
          } else {
            return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
          }
          
        default:
          return 0;
      }
    });
  };

  // Храним порядок отображения сообщений для сортировки "НОВЫЕ"
  const [responseDisplayOrder, setResponseDisplayOrder] = useState<number[]>([]);
  
  // Функция для обновления порядка отображения если выбрана сортировка по статусу
  useEffect(() => {
    if (sortField === 'status') {
      // Обновляем порядок отображения сообщений на основе текущей сортировки
      setResponseDisplayOrder(getSortedResponses().map(r => r.id));
    }
  }, [sortField, sortDirection, localResponses]);
  
  // Handle selecting a single response for viewing
  const handleSelectForView = async (responseId: number) => {
    // Если выбирается другое сообщение, сбрасываем состояние отправки
    if (activeResponseId !== responseId) {
      setMessageSent(false);
      setIsSending(false);
    }
    
    setActiveResponseId(responseId);
    const response = localResponses.find(r => r.id === responseId);
    
    // Notify parent component about selected response
    if (response && onActiveResponseChange) {
      onActiveResponseChange(responseId, response);
    }

    if (response && !response.isRead) {
      try {
        // Mark as read on server first
        await markAsReadMutation.mutateAsync(responseId);
        
        // Update local state immediately for responsive UI
        setLocalResponses(prevResponses =>
          prevResponses.map(r =>
            r.id === responseId ? { ...r, isRead: true } : r
          )
        );
        
        // Update supplier responses state to ensure parent components get the update
        setSupplierResponses(prevResponses =>
          prevResponses.map(r =>
            r.id === responseId ? { ...r, isRead: true } : r
          )
        );
        
        // Если текущая сортировка по статусу, сохраняем текущий порядок отображения
        if (sortField === 'status') {
          setResponseDisplayOrder(previous => [...previous]);
        }
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
  };
  
  // Maximum file size - 25MB (increased for large presentations/documents)
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_TOTAL_ATTACHMENT_SIZE = 50 * 1024 * 1024;
  
  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Handler for file uploads
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      // Check for file size limits
      let totalSize = attachments.reduce((sum, file) => sum + file.size, 0);
      let oversizedFiles = Array.from(files).filter(file => file.size > MAX_FILE_SIZE);
      
      // Check for large files (warn but allow)
      const largeFiles = Array.from(files).filter(file => file.size > 10 * 1024 * 1024); // > 10MB
      if (largeFiles.length > 0) {
        toast({
          title: "Большие файлы обнаружены",
          description: `Файлы размером более 10MB могут замедлить отправку. Рекомендуется сжать файлы перед отправкой.`,
          variant: "default",
        });
      }
      
      // Check if any single file is too large
      if (oversizedFiles.length > 0) {
        toast({
          title: "Файлы слишком большие",
          description: `Некоторые файлы превышают лимит в ${formatFileSize(MAX_FILE_SIZE)} на файл.`,
          variant: "destructive",
        });
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      // Calculate total new size
      const newFilesTotalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
      
      // Check if total would exceed limit
      if (totalSize + newFilesTotalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
        toast({
          title: "Слишком много вложений",
          description: `Общий размер вложений превысит ${formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE)}. Пожалуйста, сначала удалите некоторые файлы.`,
          variant: "destructive",
        });
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
    
      const newAttachments = await Promise.all(
        Array.from(files).map(async (file) => {
          // Convert file to base64
          const base64Content = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              // Split by base64, and get the second part (the actual data)
              const base64 = (reader.result as string).split('base64,')[1];
              resolve(base64);
            };
            reader.readAsDataURL(file);
          });
          
          return {
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            content: base64Content,
            size: file.size,
          };
        })
      );
      
      // Create updated attachments array
      const updatedAttachments = [...attachments, ...newAttachments];
      
      // Add to existing attachments
      setAttachments(updatedAttachments);
      
      // Update activeResponse with attachment information
      if (activeResponse) {
        const updatedResponse = {
          ...activeResponse,
          replyAttachments: updatedAttachments
        };
        updateActiveResponse(updatedResponse);
      }
      
      toast({
        title: "Файлы прикреплены",
        description: `Добавлено ${newAttachments.length} файл(ов) к вашему письму.`,
      });
    } catch (error) {
      console.error("Ошибка обработки файлов:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось прикрепить файлы. Пожалуйста, попробуйте снова.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear the input to allow re-selection of the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Remove an attachment
  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
    
    // Update activeResponse with updated attachments
    if (activeResponse) {
      const updatedResponse = {
        ...activeResponse,
        replyAttachments: newAttachments
      };
      updateActiveResponse(updatedResponse);
    }
  };

  if (supplierResponses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">Пока нет ответов</p>
          <p className="text-sm text-center max-w-md">
            Когда поставщики ответят на ваш запрос - их ответы появятся здесь!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Two-panel layout for responses */}
      <div className="grid grid-cols-1 md:grid-cols-5 h-[600px] border rounded-md">
        {/* Left panel - Response list */}
        <div className="border-r md:col-span-1 overflow-hidden">
          {/* Панель инструментов */}
          <div className="p-3 bg-muted/30 border-b">
            {/* Кнопки действий */}
            <div className="flex items-center gap-2 mb-3">
              {/* Кнопка проверки новых предложений */}
              {onCheckNewOffers && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="w-8 h-8"
                  onClick={onCheckNewOffers}
                  disabled={isCheckingOffers}
                  title="Проверить новые предложения"
                >
                  <RefreshCw 
                    size={14} 
                    className={isCheckingOffers ? 'animate-spin' : ''} 
                  />
                </Button>
              )}
              
              {/* Кнопка сравнения выбранных */}
              <Button
                variant="default"
                className="flex items-center gap-1 flex-1 justify-center"
                onClick={onCompare}
                disabled={selectedResponses.length < 1}
                size="sm"
              >
                <span>Сравнить ({selectedResponses.length})</span>
              </Button>
            </div>
            

            {/* Чекбокс выбора всех и фильтры */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="select-all-responses"
                  checked={getSortedResponses().length > 0 && getSortedResponses().every(r => selectedResponses.includes(r.id))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Select all visible responses (respect filtering)
                      const visibleIds = getSortedResponses().map(r => r.id);
                      const alreadySelectedIds = selectedResponses.filter(id => !visibleIds.includes(id)); // Keep selected items that are not visible
                      setSelectedResponses([...alreadySelectedIds, ...visibleIds]);
                    } else {
                      // Deselect only visible responses
                      const visibleIds = getSortedResponses().map(r => r.id);
                      setSelectedResponses(selectedResponses.filter(id => !visibleIds.includes(id)));
                    }
                  }}
                />
                <Label htmlFor="select-all-responses" className="text-sm font-medium cursor-pointer">
                  {getSortedResponses().length > 0 && getSortedResponses().every(r => selectedResponses.includes(r.id))
                    ? "Снять" 
                    : "Все"}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                {/* Кнопка добавления в группу */}
                <AddToGroupButton
                  suppliers={selectedResponses.length > 0 
                    ? supplierResponses
                        .filter(r => selectedResponses.includes(r.id))
                        .map(r => ({
                          id: r.id,
                          requestSupplierId: r.requestSupplierId || undefined,
                          name: r.supplierName,
                          email: r.supplierEmail,
                          phone: ""
                        }))
                    : []
                  }
                  variant="outline"
                  className="w-full flex items-center gap-2 justify-center"
                  disabled={selectedResponses.length === 0}
                />
                
                
                {/* Кнопка избранных писем */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className={`h-8 w-8 ${showFavoritesOnly ? 'bg-primary/10' : ''}`}
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                      >
                        <Star 
                          className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'text-yellow-500 fill-yellow-500' : ''}`} 
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Показать только избранные</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                      <span className="mr-1">
                         
                      </span>
                      {sortDirection === 'asc' 
                        ? <ArrowUpNarrowWide className="w-3 h-3" /> 
                        : <ArrowDownNarrowWide className="w-3 h-3" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Сортировка</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup 
                      value={sortField} 
                      onValueChange={(value) => {
                        // Если меняется тип сортировки
                        if (value !== sortField) {
                          setSortField(value as SortField);
                          setSortDirection(value === 'date' || value === 'favorite' ? 'desc' : 'asc');

                          // Сбросить сохраненный порядок при переключении с status на другую сортировку
                          if (sortField === 'status' && value !== 'status') {
                            setResponseDisplayOrder([]);
                          }

                          // Если переключаемся на status, запомнить текущий порядок
                          if (value === 'status') {
                            // Сначала сортируем стандартной сортировкой и затем запоминаем
                            const sorted = [...localResponses].sort((a, b) => {
                              return sortDirection === 'asc' 
                                ? (a.isRead ? 1 : 0) - (b.isRead ? 1 : 0)
                                : (b.isRead ? 1 : 0) - (a.isRead ? 1 : 0);
                            });
                            setResponseDisplayOrder(sorted.map(r => r.id));
                          }
                        }
                      }}
                    >
                      <DropdownMenuRadioItem value="date">
                        <Calendar className="w-3 h-3 mr-2" /> Дата
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="sender">
                        <User className="w-3 h-3 mr-2" /> Отправитель
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="status">
                        <Mail className="w-3 h-3 mr-2" /> Новые
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="favorite">
                        <Star className="w-3 h-3 mr-2" /> Избранное
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                      setSortDirection(newDirection);

                      // Если меняем направление сортировки при выбранном status, обновляем порядок
                      if (sortField === 'status') {
                        // Сначала сортируем стандартной сортировкой и затем запоминаем
                        const sorted = [...localResponses].sort((a, b) => {
                          return newDirection === 'asc' 
                            ? (a.isRead ? 1 : 0) - (b.isRead ? 1 : 0)
                            : (b.isRead ? 1 : 0) - (a.isRead ? 1 : 0);
                        });
                        setResponseDisplayOrder(sorted.map(r => r.id));
                      }
                    }}>
                      {sortDirection === 'asc' 
                        ? <ArrowUpNarrowWide className="w-3 h-3 mr-2" /> 
                        : <ArrowDownNarrowWide className="w-3 h-3 mr-2" />}
                      {sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Sorting dropdown */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                
                {/* Сортировка */}
                
              </div>
            </div>
          </div>

          <ScrollArea className="h-[calc(100%-95px)]">
            {getSortedResponses().map((response) => {
              // Check if this response is currently selected for viewing
              const isActive = activeResponseId === response.id;

              return (
                <div 
                  key={response.id}
                  className={`
                    p-3 border-b cursor-pointer flex items-start gap-2 hover:bg-muted/20 transition-colors
                    ${!response.isRead ? "bg-primary/5" : ""}
                    ${isActive ? "bg-primary/10 hover:bg-primary/15" : ""}
                  `}
                  onClick={() => handleSelectForView(response.id)}
                >
                  <Checkbox
                    id={`response-${response.id}`}
                    checked={selectedResponses.includes(response.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedResponses([...selectedResponses, response.id]);
                      } else {
                        setSelectedResponses(selectedResponses.filter(id => id !== response.id));
                      }
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent row click when checkbox is clicked
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className={`text-sm truncate ${!response.isRead ? 'font-semibold' : ''}`}>
                        {response.supplierName}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0"
                        onClick={(e) => handleToggleFavorite(response.id, e)}
                      >
                        <Star 
                          className={`h-4 w-4 ${response.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} 
                        />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {(response as any).subject || '(No subject)'}
                    </div>
                    <div className="text-xs mt-1 flex justify-between items-center">
                      <span className="text-muted-foreground">
                        {response.responseDate ? format(new Date(response.responseDate), "dd.MM HH:mm") : ""}
                      </span>

                      {((response as any).attachments || []).length > 0 && (
                        <span className="flex items-center text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          <span className="ml-1">{((response as any).attachments || []).length}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        </div>

        {/* Right panel - Selected response content */}
        <div className="md:col-span-4 overflow-hidden flex flex-col">
          {activeResponse ? (
            <>
              <div className="p-4 border-b bg-muted/20">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">
                      {(activeResponse as any).subject || '(No subject)'}
                    </h3>
                    <div className="text-muted-foreground text-sm mt-1">
                      From: <span className="font-medium">{activeResponse.supplierName}</span> &lt;{activeResponse.supplierEmail}&gt;
                    </div>
                    <div className="text-muted-foreground text-xs mt-1">
                      {activeResponse.responseDate ? format(new Date(activeResponse.responseDate), "dd MMMM yyyy, HH:mm") : ""}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleToggleFavorite(activeResponse.id)}
                          >
                            <Star 
                              className={`h-4 w-4 ${activeResponse.isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} 
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{activeResponse.isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* We'll move the Parameter Extraction Status elsewhere */}
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              // Automatically open parameter viewer with current active response
                              
                              // Автоматический анализ вложений перед открытием просмотра параметров
                              if (activeResponse && activeResponse.attachments && 
                                  Array.isArray(activeResponse.attachments) &&
                                  activeResponse.attachments.length > 0) {
                                try {
                                  await fetch(`/api/supplier-responses/${activeResponse.id}/analyze-attachments`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                                      'X-Requested-With': 'XMLHttpRequest'
                                    },
                                    credentials: 'include',
                                  });
                                  console.log('Attachment analysis triggered successfully');
                                  
                                  // Notify parent component to force parameter extraction
                                  if (onExtractParameters) {
                                    onExtractParameters();
                                  }
                                } catch (error) {
                                  console.error('Error triggering attachment analysis:', error);
                                }
                              }
                              
                              setIsParameterViewerOpen(true);
                            }}
                          >
                            <ListFilter className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Извлечь параметры</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {/* Parameter Extraction Status Card removed - now shown in the main request details layout */}

                  {/* Attachments - Loaded on demand */}
                  <AttachmentsList 
                    key={`attachments-${activeResponse.id}`} // Force re-render when responseId changes
                    responseId={activeResponse.id}
                    initialAttachments={(activeResponse as any).attachments || []}
                  />
                  
                  {/* Email content */}
                  <div className="leading-relaxed whitespace-pre-wrap" 
                    dangerouslySetInnerHTML={{ __html: (activeResponse as any).content || '' }}
                  />
                  
                  {/* Reply section */}
                  <div className="mt-8 border-t pt-4">
                    <h3 className="text-sm font-medium mb-3">Ответить на письмо</h3>
                    <textarea 
                      rows={6}
                      className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Текст сообщения..."
                      value={(activeResponse as any).replyDraft || ''}
                      onChange={(e) => {
                        if (activeResponse) {
                          const updatedResponse = {
                            ...activeResponse,
                            replyDraft: e.target.value
                          };
                          updateActiveResponse(updatedResponse);
                        }
                      }}
                      disabled={messageSent || isSending}
                    />
                    
                    {/* Attachments for reply */}
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2 mt-2">
                        {attachments.map((file, i) => (
                          <div key={i} className="flex items-center bg-muted/30 px-2 py-1 rounded-md text-xs">
                            <File className="h-3 w-3 mr-1" />
                            <span className="max-w-[120px] truncate">{file.filename}</span>
                            <span className="text-muted-foreground ml-1">({formatFileSize(file.size)})</span>
                            <button 
                              className="ml-1 text-destructive hover:bg-muted/50 rounded-full p-0.5"
                              onClick={() => removeAttachment(i)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Hide the file upload and send button if message already sent */}
                    {!messageSent && (
                      <>
                        <div className="flex items-center justify-between mt-3">
                          <label 
                            className="inline-flex items-center gap-1 rounded-md cursor-pointer text-xs px-2 py-1.5 bg-muted/30 hover:bg-muted/50"
                            htmlFor="file-upload"
                          >
                            <Paperclip className="h-3 w-3" />
                            Прикрепить файл
                          </label>
                          <input 
                            type="file" 
                            id="file-upload" 
                            className="hidden"
                            multiple
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            disabled={isSending}
                          />
                          
                          <div className="flex gap-2">
                            <Button 
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => {
                                if (activeResponse) {
                                  const updatedResponse = {
                                    ...activeResponse,
                                    replyDraft: ''
                                  };
                                  updateActiveResponse(updatedResponse);
                                  setAttachments([]);
                                }
                              }}
                              disabled={
                                isSending || 
                                !activeResponse || 
                                !((activeResponse as any).replyDraft?.trim() || attachments.length > 0)
                              }
                            >
                              Очистить
                            </Button>
                            <Button 
                              size="sm"
                              variant="default"
                              className="text-xs"
                              disabled={
                                isSending || 
                                !activeResponse || 
                                (!(activeResponse as any).replyDraft?.trim() && attachments.length === 0)
                              }
                              onClick={async () => {
                                if (!activeResponse) return;
                                
                                try {
                                  setIsSending(true);
                                  
                                  const replyText = (activeResponse as any).replyDraft || '';
                                  
                                  // Use apiRequest from queryClient to include authentication
                                  const accessToken = localStorage.getItem('accessToken');
                                  console.log(`Sending reply with token: ${accessToken ? 'Present' : 'Missing'}`);
                                  
                                  const response = await fetch(`/api/supplier-responses/${activeResponse.id}/reply`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${accessToken || ''}`,
                                      'X-Requested-With': 'XMLHttpRequest'
                                    },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                      content: replyText,
                                      attachments,
                                    }),
                                  });
                                  
                                  if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                  }
                                  
                                  const result = await response.json();
                                  
                                  if (result.success) {
                                    // Update local state
                                    const updatedResponse = {
                                      ...activeResponse,
                                      replyDraft: '',
                                      isRepliedTo: true,
                                    };
                                    updateActiveResponse(updatedResponse);
                                    setAttachments([]);
                                    setMessageSent(true);
                                    
                                    toast({
                                      title: "Письмо отправлено",
                                      description: "Ваш ответ был успешно отправлен поставщику.",
                                    });
                                  } else {
                                    throw new Error(result.error || 'Unknown error');
                                  }
                                } catch (error) {
                                  console.error("Ошибка отправки ответа:", error);
                                  toast({
                                    title: "Ошибка отправки",
                                    description: "Не удалось отправить ответ. Пожалуйста, попробуйте снова.",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setIsSending(false);
                                }
                              }}
                            >
                              {isSending ? "Отправка..." : "Отправить ответ"}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {messageSent && (
                      <div className="mt-3 p-3 bg-primary/5 rounded-md">
                        <div className="flex items-center">
                          <Badge variant="outline" className="mr-2 bg-primary/10">Отправлено</Badge>
                          <span className="text-xs text-muted-foreground">Ваш ответ был успешно отправлен поставщику.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Выберите письмо для просмотра
            </div>
          )}
        </div>
      </div>
      
      {/* Action buttons */}
      
      {/* Parameter Viewer Dialog */}
      {activeResponse && (
        <ParameterViewer 
          open={isParameterViewerOpen}
          onOpenChange={setIsParameterViewerOpen}
          response={activeResponse}
        />
      )}
    </div>
  );
}