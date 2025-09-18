import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { emailTemplateSchema, type Supplier, type SearchRequest } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Paperclip, X, File } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BusinessCardPreview } from "./business-card-preview";

// Format deadline to more user-friendly format
const formatDeadline = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year} до 18 часов (GMT+3)`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return isoDate;
  }
};

interface Props {
  suppliers: Supplier[];
  selectedSuppliers: Supplier[];
  searchRequest: SearchRequest;
  comingFromGroup?: boolean;
  groupId?: number | null;
}

export function EmailForm({ suppliers, selectedSuppliers, searchRequest, comingFromGroup, groupId }: Props) {
  // Define regex pattern for parameter section - avoiding /s flag for compatibility
  const paramSectionRegex = /1\..*?\n\nКонтактный телефон/;
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [productName, setProductName] = useState(searchRequest.productName || sessionStorage.getItem('productName') || '');
  const [productDescription, setProductDescription] = useState(searchRequest.productDescription || sessionStorage.getItem('productDescription') || '');
  const [deadline, setDeadline] = useState(searchRequest.timeline || '');
  const [attachments, setAttachments] = useState<Array<{
    filename: string;
    contentType: string;
    content: string;
    size: number;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get parameters from session storage if available
  const getParametersFromStorage = () => {
    try {
      const savedParams = sessionStorage.getItem('requestParameters');
      console.log("Loaded parameters from sessionStorage:", savedParams);
      if (savedParams) {
        return JSON.parse(savedParams);
      }
      // If no parameters in requestParameters, check if we have parameters in parametersSelected
      const parametersSelected = sessionStorage.getItem('parametersSelected');
      if (parametersSelected === 'true') {
        // Try to get parameters from the API
        const requestId = searchRequest?.id || sessionStorage.getItem('requestId');
        if (requestId) {
          // In componentDidMount we'll fetch these parameters
          console.log("Will attempt to fetch parameters for request ID:", requestId);
        }
      }
    } catch (error) {
      console.error("Ошибка при чтении параметров из sessionStorage:", error);
    }
    return [];
  };
  
  // Generate parameter list for email
  const generateParameterList = () => {
    const params = getParametersFromStorage();
    if (!params || (Array.isArray(params) && params.length === 0)) {
      console.log("No saved parameters found, using defaults");
      // Default parameters if none are selected
      return `1.Общая стоимость предложения без НДС: 
2.Общая стоимость предложения с НДС: 
3.Условия оплаты:
4.Сроки поставки:
5.Условия доставки:
6.Гарантия:
7.Иные условия:`;
    }
    
    console.log("Using saved parameters:", params);
    
    // Check the format of parameters
    if (Array.isArray(params)) {
      // Check if it's an array of objects with {label, selected} format
      if (params.length > 0 && typeof params[0] === 'object' && params[0] !== null && 'label' in params[0]) {
        // Array format: filter selected parameters and generate numbered list
        return params
          .filter((p: any) => p.selected)
          .map((p: any, index: number) => `${index + 1}.${p.label}:`)
          .join('\n');
      } 
      // Check if it's an array of strings (direct parameter names)
      else if (params.length > 0 && typeof params[0] === 'string') {
        // String array format: directly use the parameter names
        return params
          .map((param: string, index: number) => `${index + 1}.${param}:`)
          .join('\n');
      }
    } else if (typeof params === 'object' && params !== null) {
      // Object format with key-value pairs (from extracted parameters)
      return Object.entries(params)
        .map(([key, value], index: number) => `${index + 1}.${key}:`)
        .join('\n');
    }
    
    // Default return if structure is unknown
    console.warn("Unknown parameter format, using defaults:", params);
    return `1.Общая стоимость предложения без НДС: 
2.Общая стоимость предложения с НДС: 
3.Условия оплаты:
4.Сроки поставки:
5.Условия доставки:
6.Гарантия:
7.Иные условия:`;
  };
  
  // Function to add business card to email if available
  const getBusinessCardSignature = () => {
    console.log("Current user data:", user);
    if (user?.businessCard) {
      console.log("Adding business card to email:", user.businessCard);
      return `\n\n${user.businessCard}`;
    }
    return '';
  };

  const defaultMessage = `
Добрый день,

${productDescription ? `${productDescription}` : ''}

! В Вашем ответе обязательно укажите:
---------------------------------------------
${generateParameterList()}
---------------------------------------------
!При ответе на наш запрос не изменяйте тему письма (Subject), иначе мы не сможем обработать ваш ответ!
${getBusinessCardSignature()}
`.trim();

  // Handle the IDs - convert negative IDs (from DeepSeek API) to string representations
  const supplierIds = (selectedSuppliers || []).map((s: Supplier) => {
    if (typeof s.id === 'number' && s.id < 0) {
      return `api-${Math.abs(s.id)}`;
    }
    return typeof s.id === 'string' ? s.id : String(s.id);
  });

  type EmailFormValues = {
    suppliers: (number | string)[];
    subject: string;
    message: string;
    requestId: number;
    attachments: Array<{
      filename: string;
      contentType: string;
      content: string;
      size: number;
    }>;
  };

  // Generate subject line with "Запрос" + key words from description
  // HIDDEN: Enhanced subject generation functionality - commented out as requested
  /*
  const generateSubject = () => {
    const description = productDescription || searchRequest.productDescription || '';
    const productNameVal = productName || searchRequest.productName || '';
    
    if (!description && !productNameVal) {
      return "Запрос";
    }
    
    if (!description) {
      return `Запрос ${productNameVal}`.trim();
    }
    
    // Extract 2-4 key words from description
    const words = description.split(/\s+/).filter(word => 
      word.length > 3 && 
      !/^(и|в|на|по|для|от|до|из|с|к|о|при|без|под|над|за|через|между|перед|после|около|вокруг|внутри|снаружи|вдоль|против|среди|благодаря|согласно|несмотря|вместо|кроме|включая)$/i.test(word)
    );
    
    const keyWords = words.slice(0, 4).join(' ');
    return `Запрос ${keyWords || productNameVal}`.trim();
  };
  */
  
  // Simple subject generation - just returns "Запрос"
  const generateSubject = () => {
    return "Запрос";
  };

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      suppliers: supplierIds,
      subject: generateSubject(),
      message: defaultMessage,
      requestId: searchRequest?.id || 0, // Убеждаемся что requestId всегда число
      attachments: [],
    },
  });
  
  // Update email template when product description or other data changes
  useEffect(() => {
    const updateEmailTemplate = () => {
      // Regenerate the default message with current data
      const updatedDefaultMessage = `
Добрый день,

Направляем запрос для получения вашего коммерческого предложения на:

${productDescription ? `${productDescription}` : ''}

! В Вашем ответе обязательно укажите:
---------------------------------------------
${generateParameterList()}
---------------------------------------------
!При ответе на наш запрос не изменяйте тему письма (Subject), иначе мы не сможем обработать ваш ответ!
${getBusinessCardSignature()}
`.trim();

      // Update the form message
      form.setValue('message', updatedDefaultMessage);
    };

    // Update template when component mounts or when product data changes
    updateEmailTemplate();
  }, [productName, productDescription, searchRequest.timeline, form]);

  // Fetch parameters from API if they're not in session storage
  useEffect(() => {
    const fetchParameters = async () => {
      const savedParams = sessionStorage.getItem('requestParameters');
      if (savedParams) {
        console.log("Parameters already loaded from session storage");
        return; // Parameters already loaded
      }
      
      const parametersSelected = sessionStorage.getItem('parametersSelected');
      if (parametersSelected === 'true') {
        const requestId = searchRequest?.id || sessionStorage.getItem('requestId');
        if (requestId) {
          try {
            console.log("Fetching parameters for request ID:", requestId);
            const response = await apiRequest(`/api/parameters/${requestId}`, "GET");
            
            if (response && (response as any).parameters) {
              console.log("Loaded parameters from API:", (response as any).parameters);
              sessionStorage.setItem('requestParameters', JSON.stringify((response as any).parameters));
              
              // Regenerate parameter list with the updated parameters
              const parameterList = generateParameterList();
              
              // Get the current message
              const currentMessage = form.getValues('message');
              
              // Replace the parameter section in the message
              const updatedMessage = currentMessage.replace(
                paramSectionRegex, 
                parameterList
              );
              
              // Update the form
              form.setValue('message', updatedMessage);
            } else {
              console.warn("API returned no parameters for request ID:", requestId);
            }
          } catch (error) {
            console.error("Failed to fetch parameters:", error);
          }
        }
      }
    };
    
    fetchParameters();
  }, [searchRequest?.id, form]);

  // ВАЖНО: Обновляем suppliers в форме при изменении props selectedSuppliers
  useEffect(() => {
    if (!selectedSuppliers || selectedSuppliers.length === 0) {
      console.log("Нет выбранных поставщиков для обновления формы");
      return;
    }
    
    console.log("Обновление поставщиков в форме:", selectedSuppliers.length);
    
    const updatedSupplierIds = selectedSuppliers.map(s => {
      if (typeof s.id === 'number' && s.id < 0) {
        return `api-${Math.abs(s.id)}`;
      }
      return typeof s.id === 'string' ? s.id : String(s.id);
    });
    
    form.setValue('suppliers', updatedSupplierIds);
  }, [selectedSuppliers, form]);

  // Maximum file size - 15MB per file, 30MB total
  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const MAX_TOTAL_ATTACHMENT_SIZE = 30 * 1024 * 1024;
  
  // Handler for file uploads
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      // Check for file size limits
      let totalSize = attachments.reduce((sum, file) => sum + file.size, 0);
      let oversizedFiles = Array.from(files).filter(file => file.size > MAX_FILE_SIZE);
      
      // Check if any single file is too large
      if (oversizedFiles.length > 0) {
        toast({
          title: "Файлы слишком большие",
          description: `Некоторые файлы превышают лимит ${formatFileSize(MAX_FILE_SIZE)} на файл.`,
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
          description: `Общий размер вложений превысит ${formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE)}. Удалите несколько файлов.`,
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
      
      // Update form values with the updated array
      form.setValue('attachments', updatedAttachments);
      
      toast({
        title: "Files attached",
        description: `Added ${newAttachments.length} file(s) to your email.`,
      });
    } catch (error) {
      console.error("Error processing files:", error);
      toast({
        title: "Error",
        description: "Failed to attach files. Please try again.",
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
    form.setValue('attachments', newAttachments);
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Define response type for better type safety
  interface EmailResponse {
    success: boolean;
    orderNumber: string;
    requestId?: number;
    totalCount?: number;
    successCount?: number;
    results?: Array<{
      supplierEmail: string;
      supplierName: string;
      success: boolean;
      trackingId?: string;
      error?: string;
    }>;
  }

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("=== НАЧАЛО МУТАЦИИ ===");
      console.log("Mutation data:", data);
      console.log("Selected suppliers:", selectedSuppliers);
      console.log("Selected suppliers count:", selectedSuppliers.length);
      console.log("Selected suppliers details:", selectedSuppliers.map(s => ({ id: s.id, name: s.name, email: s.email })));
      
      if (!selectedSuppliers || selectedSuppliers.length === 0) {
        console.error("Ошибка: не выбран ни один поставщик");
        throw new Error("Не выбрано ни одного поставщика для отправки");
      }
      
      console.log("Отправка данных, количество поставщиков:", selectedSuppliers.length);
      
      // Make sure we're using the latest supplier IDs from the selectedSuppliers prop
      // This ensures the server gets all the selected suppliers
      const currentSupplierIds = selectedSuppliers.map(s => {
        // Convert negative IDs (from DeepSeek API) to string representations with api- prefix
        if (typeof s.id === 'number' && s.id < 0) {
          return `api-${Math.abs(s.id)}`;
        }
        return typeof s.id === 'string' ? s.id : String(s.id);
      });
      
      console.log("ID выбранных поставщиков:", currentSupplierIds);
      
      // Проверим, откуда пришли контакты - из группы контактов или обычные поставщики
      // Корректно определяем источник контактов по надежным признакам:
      // 1. Параметр URL from=group (когда переход произошел явно из группы контактов)
      // 2. Наличие groupId в localStorage (также признак работы с группой контактов)
      // 3. Prop comingFromGroup (передается из родительского компонента)
      const isFromContactGroup = 
        (window.location.pathname.includes('send-request') && window.location.search.includes('from=group')) || 
        window.localStorage.getItem('groupId') !== null ||
        comingFromGroup;
      
      console.log("Источник контактов - группа контактов:", isFromContactGroup);
      
      // Get parameters from session storage to include in the request
      const getSelectedParameters = () => {
        try {
          const savedParams = sessionStorage.getItem('requestParameters');
          if (savedParams) {
            const parsedParams = JSON.parse(savedParams);
            console.log("Including selected parameters in email request:", parsedParams);
            return parsedParams;
          }
        } catch (error) {
          console.error("Error parsing parameters from sessionStorage:", error);
        }
        return null;
      };

      // Add the full supplier details for API-sourced suppliers that are selected
      const formData = {
        ...data,
        suppliers: currentSupplierIds, // Override with the latest selected IDs
        apiSuppliers: selectedSuppliers.filter(s => typeof s.id === 'number' && s.id < 0),
        fromContactGroup: isFromContactGroup, // Добавляем флаг для определения источника контактов
        parameters: getSelectedParameters() // Include selected parameters
      };
      
      console.log("Sending email request with data:", {
        ...formData,
        suppliers: formData.suppliers, // Log the supplier IDs we're sending
        suppliersCount: formData.suppliers.length, // Добавляем количество поставщиков для отладки
        attachments: formData.attachments?.map((a: any) => ({
          ...a,
          content: `${a.content.substring(0, 20)}... (truncated)`, // Don't log the full base64 content
        })),
      });
      
      console.log("КРИТИЧЕСКАЯ ОТЛАДКА - suppliers array:", formData.suppliers);
      console.log("КРИТИЧЕСКАЯ ОТЛАДКА - suppliers length:", formData.suppliers.length);
      console.log("КРИТИЧЕСКАЯ ОТЛАДКА - selected suppliers length:", selectedSuppliers.length);
      
      // Убедимся, что у нас есть подтверждение отправки от сервера, добавим дополнительные проверки
      try {
        console.log("Отправляем запрос на сервер...");
        const response = await apiRequest<EmailResponse>("/api/send-email", "POST", formData);
        console.log("Email sending response:", response);
        
        if (!response) {
          console.error("Пустой ответ от сервера");
          throw new Error("Получен пустой ответ от сервера");
        }
        
        if (!response.success && !response.orderNumber) {
          console.error("Сервер вернул ошибку:", response);
          throw new Error("Сервер вернул ошибку при отправке email");
        }
        
        // Сохраняем сообщение для каждого поставщика
        if (response.success && response.results) {
          for (const result of response.results) {
            if (result.success) {
              try {
                // Найдем ID поставщика по его email
                const supplier = selectedSuppliers.find(s => s.email === result.supplierEmail);
                if (supplier && supplier.id) {
                  const supplierId = typeof supplier.id === 'string' ? parseInt(supplier.id) : supplier.id;
                  
                  // Если это обычный (не API) поставщик и ID положительный
                  if (!isNaN(supplierId) && supplierId > 0) {
                    // Сохраняем сообщение в истории
                    await apiRequest(`/api/request-suppliers/${supplierId}/add-message`, "POST", {
                      content: data.message,
                      sentDate: new Date().toISOString(),
                      direction: "outbound",
                      attachments: data.attachments?.map((a: any) => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size
                      })) || []
                    });
                    console.log(`Сообщение сохранено для поставщика ${supplierId}`);
                  }
                }
              } catch (saveError) {
                // Логируем ошибку, но не прерываем общий процесс отправки
                console.error(`Не удалось сохранить сообщение для поставщика ${result.supplierEmail}:`, saveError);
              }
            }
          }
        }
        
        return response;
      } catch (err) {
        console.error("Email sending failed:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      // Расширенный вывод информации о результате отправки
      console.log("Email sending succeeded:", data);
      
      // Invalidate subscription status query to refresh request counter
      queryClient.invalidateQueries({ queryKey: ["subscription", "status"] });
      
      // Показываем детальную информацию об успешности
      toast({
        title: "Успешно",
        description: `Ваш запрос был отправлен ${data.successCount} из ${data.totalCount} выбранным поставщикам.`,
      });
      
      // Очищаем localStorage после успешной отправки
      localStorage.removeItem('groupId');
      localStorage.removeItem('groupName');
      
      // Проверяем и направляем пользователя на правильную страницу
      if (data && data.orderNumber) {
        setLocation(`/success/${data.orderNumber}`);
      } else if (data && data.requestId) {
        // Если номер заказа отсутствует, но есть ID запроса, перенаправляем на страницу этого запроса
        setLocation(`/requests/${data.requestId}`);
      } else {
        // Fallback to dashboard if neither is available
        setLocation('/dashboard');
      }
    },
    onError: (error: any) => {
      console.error("API Request failed:", error);
      let errorMessage = "Не удалось отправить email. Пожалуйста, попробуйте снова.";
      
      // Check for specific error messages from the server
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.status === 404 && searchRequest.id === 0) {
        errorMessage = "Невозможно отправить email для запросов, которые не были сохранены. Пожалуйста, сначала выполните полный поиск.";
      }
      
      // Очищаем localStorage при ошибке отправки
      localStorage.removeItem('groupId');
      localStorage.removeItem('groupName');
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update form data when product info changes
  const updateFormData = () => {
    // Update the subject
    form.setValue('subject', productName);
    
    // Update the message with the new product info
    const updatedMessage = defaultMessage
      .replace(`Продукт: ${searchRequest.productName}`, `Продукт: ${productName}`)
      .replace(`Описание: ${searchRequest.productDescription}`, `Описание: ${productDescription}`)
      .replace(`Конечный срок подачи предложения: ${formatDeadline(searchRequest.timeline)}`, 
               `Конечный срок подачи предложения: ${formatDeadline(deadline)}`);
    
    form.setValue('message', updatedMessage);
  };

  return (
    <Card>
      
      <CardContent>
        {/* Product name and deadline fields have been moved to the first screen */}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(
            (data) => {
              console.log("=== ФОРМА ОТПРАВЛЕНА ===");
              console.log("Form data:", data);
              console.log("Selected suppliers:", selectedSuppliers?.length);
              mutation.mutate(data as any);
            },
            (errors) => {
              console.log("=== ОШИБКИ ВАЛИДАЦИИ ФОРМЫ ===");
              console.log("Validation errors:", errors);
              toast({
                title: "Ошибка валидации",
                description: "Проверьте правильность заполнения формы",
                variant: "destructive",
              });
            }
          )} className="space-y-6">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тема</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сообщение</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[300px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Business Card Preview */}
            <BusinessCardPreview />
            
            {/* File attachments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Paperclip className="h-4 w-4" />
                  Вложения
                </div>
                <div>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    ref={fileInputRef}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? "Загрузка..." : "Прикрепить файлы"}
                  </Button>
                </div>
              </div>
              
              {/* Attachment list */}
              {attachments.length > 0 ? (
                <div className="border rounded-md p-4 space-y-2">
                  {/* Display total attachment size */}
                  <div className="text-xs text-muted-foreground pb-2 flex justify-between items-center border-b">
                    <span>
                      {attachments.length} файл{attachments.length !== 1 ? (attachments.length < 5 ? 'а' : 'ов') : ''} прикреплено
                    </span>
                    <span>
                      Общий размер: {formatFileSize(attachments.reduce((sum, file) => sum + file.size, 0))} 
                      / {formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE)}
                    </span>
                  </div>
                  
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between text-sm py-1 border-b last:border-b-0">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{file.filename}</span>
                        <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Файлы не прикреплены. Нажмите "Прикрепить файлы" для добавления документов к запросу.</p>
                  <p className="mt-1 text-xs">Максимальный размер файла: {formatFileSize(MAX_FILE_SIZE)} на файл, {formatFileSize(MAX_TOTAL_ATTACHMENT_SIZE)} общий.</p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
              onClick={(e) => {
                console.log("=== КНОПКА ОТПРАВИТЬ НАЖАТА ===");
                console.log("Disabled:", mutation.isPending);
                console.log("Selected suppliers:", selectedSuppliers?.length || 0);
                console.log("Form values:", form.getValues());
                // Don't prevent default - let form submission handle it
              }}
            >
              {mutation.isPending ? "Отправка..." : "Отправить запрос"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}