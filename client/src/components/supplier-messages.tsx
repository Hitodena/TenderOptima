import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SupplierResponseAttachments } from "./supplier-response-attachments";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Paperclip, Send, File, X } from "lucide-react";

interface SupplierMessage {
  id: number;
  requestSupplierId: number;
  content: string;
  subject: string;
  direction: string;
  sentDate: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content?: string;
    size?: number;
  }>;
}

interface SupplierMessagesProps {
  // ID может быть разных типов в зависимости от контекста
  // - ID поставщика в базе данных (supplier.id)
  // - ID связи поставщик-запрос (requestSupplierId)
  supplierId: number;
  supplierName?: string;
  supplierEmail?: string;
  // Указывает, является ли supplierId на самом деле requestSupplierId
  isRequestSupplierId?: boolean;
  // Указывает, находимся ли мы в листе поставщиков (где не нужна возможность ответа)
  isInSuppliersList?: boolean;
}

export default function SupplierMessages({ supplierId, supplierName, supplierEmail, isRequestSupplierId = false, isInSuppliersList = false }: SupplierMessagesProps) {
  // Добавляем подробное логирование
  console.log('[SupplierMessages] Initializing with:', {
    supplierId,
    supplierIdType: typeof supplierId,
    supplierName,
    isRequestSupplierId
  });
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [attachments, setAttachments] = useState<Array<File>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Получение сообщений только для конкретного поставщика
  const { data: messages, isLoading, error } = useQuery<SupplierMessage[]>({
    queryKey: ['/api/request-suppliers', supplierId, 'messages'],
        queryFn: async () => {
          try {
            const data = await apiRequest<SupplierMessage[]>(`/api/request-suppliers/${supplierId}/messages`, 'GET');
            return data;
          } catch (error) {
            console.error(`Ошибка при загрузке сообщений:`, error);
            throw error;
          }
        },
    // Обновляем данные только при фокусе окна, без постоянного опроса
    refetchOnWindowFocus: true,
    staleTime: 30000, // Данные считаются актуальными 30 секунд
  });

  // State for tracking loading and success states
  const [isSending, setIsSending] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  // Мутация для отправки сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, attachments }: { text: string, attachments: File[] }) => {
      console.log(`Отправка сообщения поставщику (requestSupplierId=${supplierId})`);
      
      const formData = new FormData();
      formData.append("content", text);
      
      // Добавление файлов вложений
      attachments.forEach((file) => {
        formData.append("attachments", file);
      });
      
      try {
        // Using session-based authentication with credentials
        const response = await fetch(`/api/request-suppliers/${supplierId}/add-message`, {
          method: "POST",
          credentials: 'include', // Important for session-based auth
          body: formData
        });
        
        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ошибка отправки сообщения');
          } else {
            const errorText = await response.text();
            throw new Error(`Ошибка отправки сообщения: ${response.status} ${errorText.substring(0, 100)}`);
          }
        }
        
        const data = await response.json();
        console.log(`Сообщение успешно сохранено с ID ${data.id}`);
        return data;
      } catch (error) {
        console.error("Произошла ошибка при отправке:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Сообщение успешно отправлено", data);
      setMessage("");
      setAttachments([]);
      setIsSending(false);
      setMessageSent(true);
      
      // Обновляем список сообщений
      queryClient.invalidateQueries({ 
        queryKey: ['/api/request-suppliers', supplierId, 'messages'] 
      });
      
      toast({
        title: "Сообщение отправлено",
        description: "Ваше сообщение успешно отправлено поставщику",
      });
    },
    onError: (error) => {
      setIsSending(false);
      toast({
        title: "Ошибка",
        description: error instanceof Error 
          ? error.message 
          : "Не удалось отправить сообщение. Пожалуйста, попробуйте еще раз.",
        variant: "destructive",
      });
      console.error("Ошибка отправки сообщения:", error);
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() && attachments.length === 0) {
      toast({
        title: "Пустое сообщение",
        description: "Пожалуйста, введите текст сообщения или прикрепите файл",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    
    // We'll set messageSent to true in onSuccess callback
    
    sendMessageMutation.mutate({
      text: message,
      attachments,
    });
    
    // Hide the form after sending
    const formElement = document.getElementById('message-reply-form');
    if (formElement) {
      // Add a visual delay for better UX
      setTimeout(() => {
        formElement.style.display = 'none';
        formElement.classList.add('hidden');
      }, 500);
    }
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Удалена форма для ответа на экране 2

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <span>Отправленные</span>
          {messages && messages.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({messages.filter(msg => msg.direction === 'outbound').length})
            </span>
          )}
        </CardTitle>
        {!isInSuppliersList && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setMessageSent(false); // Show the form again if it was hidden
              // Make the form visible explicitly
              const formElement = document.getElementById('message-reply-form');
              if (formElement) {
                formElement.style.display = 'block';
                formElement.classList.remove('hidden');
                formElement.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <polyline points="9 17 4 12 9 7"></polyline>
              <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
            </svg>
            Ответить
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {!messages || messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Нет сообщений</p>
            <p className="text-sm mt-1">Начните переписку с поставщиком</p>
          </div>
        ) : (
          <div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto p-2 mb-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.direction === 'inbound' ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-[80%] ${
                      msg.direction === 'inbound'
                        ? "bg-muted rounded-tr-2xl rounded-br-2xl rounded-bl-2xl"
                        : "bg-primary text-primary-foreground rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl"
                    } p-3 shadow-sm`}
                  >
                    <div className="flex items-center mb-1 gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        {msg.direction === 'inbound' && (
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {supplierName
                                ? supplierName.substring(0, 2).toUpperCase()
                                : "SP"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <span className="text-xs font-medium">
                          {msg.direction === 'inbound'
                            ? supplierName || "Поставщик"
                            : "Вы"}
                        </span>
                        <span className="text-xs opacity-70">
                          {format(new Date(msg.sentDate), "dd.MM.yyyy HH:mm")}
                        </span>
                      </div>
                      {msg.direction === 'inbound' && !isInSuppliersList && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs h-6 px-2 py-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Set reply content in the textarea below
                            setMessage(`\n\n---\nНа сообщение от ${format(new Date(msg.sentDate), "dd.MM.yyyy HH:mm")}:\n${msg.content?.substring(0, 100)}${msg.content?.length > 100 ? '...' : ''}`);
                            // Scroll to the reply form
                            document.getElementById('message-reply-form')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                            <polyline points="9 17 4 12 9 7"></polyline>
                            <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                          </svg>
                          Ответить
                        </Button>
                      )}
                    </div>
                    
                    {/* Тема сообщения */}
                    {msg.subject && msg.direction === 'outbound' && (
                      <div className="mb-2 text-sm font-medium">
                        {msg.subject || `Ваш ответ на сообщение от ${format(new Date(msg.sentDate), "dd.MM.yyyy")}`}
                      </div>
                    )}
                    
                    {/* Тема для входящих сообщений */}
                    {msg.subject && msg.direction === 'inbound' && (
                      <div className="mb-2 text-sm font-medium">
                        {msg.subject}
                      </div>
                    )}
                    
                    {/* Отображение вложений - для всех сообщений - теперь перемещено перед содержимым сообщения */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-3 mt-2 p-2 border border-dashed rounded-md border-gray-200">
                        <div className="text-xs font-medium mb-1">Вложения:</div>
                        <SupplierResponseAttachments 
                          responseId={msg.id} 
                          attachments={msg.attachments}
                          maxToShow={5}
                        />
                      </div>
                    )}
                    
                    {/* Display message content */}
                    {msg.content ? (
                      <div className="whitespace-pre-wrap text-sm">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        [Содержимое сообщения пустое]
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Форма ответа на сообщение - показываем только если не в "Листе поставщиков" */}
            {!isInSuppliersList && (
              <div id="message-reply-form" className={`border-t pt-4 ${messageSent ? 'hidden' : ''}`}>
                <h3 className="text-sm font-medium mb-3">Новое сообщение</h3>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Напишите ваше сообщение здесь..."
                  className="min-h-[100px] mb-3"
                />
                
                {/* Отображение прикрепленных файлов */}
                {attachments.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium mb-2">Прикрепленные файлы:</h4>
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                          <span className="text-xs truncate max-w-[150px]">{file.name}</span>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <div>
                    <input
                      type="file"
                      id="file-attachment"
                      className="hidden"
                      multiple
                      onChange={handleAttachFile}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => document.getElementById('file-attachment')?.click()}
                      disabled={isLoadingAttachments || isSending}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Прикрепить файлы
                    </Button>
                  </div>
                  
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSending || !message.trim()}
                    onClick={handleSendMessage}
                  >
                    {isSending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                        Отправка...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Отправить
                      </>
                    )}
                  </Button>
                </div>
                
                {messageSent && (
                  <div className="mt-3 p-2 bg-green-50 text-green-600 rounded-md text-sm">
                    Сообщение успешно отправлено
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}