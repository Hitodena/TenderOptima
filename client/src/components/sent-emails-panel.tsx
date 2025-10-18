import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { type RequestSupplier, type SearchRequest } from "@shared/schema";
import { cleanEmailSubject } from "@/lib/email-utils";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { apiRequest } from "@/lib/queryClient";
import { Paperclip, Download, Info, RefreshCw } from "lucide-react";
import { SupplierDetailsModal } from "@/components/supplier-details-modal";

interface SentEmailsPanelProps {
  requestSuppliers: RequestSupplier[];
  onEmailSelect?: (supplier: RequestSupplier) => void;
  activeSupplierId?: number | null;
  onToggleBack?: () => void;
  request?: SearchRequest;
  forceRefresh?: boolean; // Флаг для принудительного обновления
  sentCount?: number; // Количество отправленных сообщений
}

export function SentEmailsPanel({
  requestSuppliers,
  onEmailSelect,
  activeSupplierId,
  onToggleBack,
  request,
  forceRefresh = false,
  sentCount = 0
}: SentEmailsPanelProps) {
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedSupplierForDetails, setSelectedSupplierForDetails] = useState<{
    requestSupplierId: number;
    email: string;
    name?: string;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  
  // Функция для принудительного обновления данных
  const refreshMessages = async () => {
    const now = Date.now();
    
    if (isRefreshing) {
      console.log('SentEmailsPanel: refreshMessages already in progress, skipping');
      return; // Защита от множественных вызовов
    }
    
    // Защита от частых вызовов - не чаще чем раз в 2 секунды
    if (now - lastRefreshTime < 2000) {
      console.log('SentEmailsPanel: refreshMessages called too frequently, skipping');
      return;
    }
    
    console.log('SentEmailsPanel: Starting refreshMessages');
    setLastRefreshTime(now);
    setIsRefreshing(true);
    try {
      await refetchMessages();
      // Также инвалидируем кэш для всех связанных запросов
      queryClient.invalidateQueries({ queryKey: ['/api/search-requests', 'all-messages', request?.id, 'v3'] });
    } finally {
      console.log('SentEmailsPanel: Finished refreshMessages');
      setIsRefreshing(false);
    }
  };
  
  // Экспортируем функцию обновления через window для доступа извне
  useEffect(() => {
    (window as any).refreshSentEmails = refreshMessages;
    return () => {
      delete (window as any).refreshSentEmails;
    };
  }, [refreshMessages]);

  // Принудительное обновление при изменении forceRefresh
  useEffect(() => {
    if (forceRefresh && !isRefreshing) {
      console.log('SentEmailsPanel: forceRefresh triggered');
      refreshMessages();
    }
  }, [forceRefresh, isRefreshing]);
  
  // Получаем все сообщения для всех поставщиков запроса одним запросом
  const { data: allMessages, isLoading: messagesLoading, error: messagesError, refetch: refetchMessages } = useQuery({
    queryKey: ['/api/search-requests', 'all-messages', request?.id, 'v3'],
    queryFn: async () => {
      if (!request?.id) {
        return [];
      }
      
      // Получаем все сообщения запроса одним запросом
      const data = await apiRequest('GET', `/api/search-requests/${request.id}/all-messages`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!request?.id && requestSuppliers.length > 0,
    staleTime: 10 * 60 * 1000, // Данные актуальны 10 минут
    gcTime: 30 * 60 * 1000, // Кэшируем данные 30 минут
    refetchOnWindowFocus: false, // Не обновляем при фокусе окна
    refetchOnMount: false // Не обновляем при монтировании, если данные свежие
  });
  

  // Сортируем все сообщения по дате (новые вверху)
  const sortedMessages = allMessages ? [...allMessages].sort((a, b) => {
    const dateA = new Date(a.sentDate).getTime();
    const dateB = new Date(b.sentDate).getTime();
    return dateB - dateA; // Newest first
  }) : [];


  // Автоматически выбираем первое сообщение при загрузке
  useEffect(() => {
    if (sortedMessages.length > 0 && !selectedMessageId) {
      // Выбираем первое сообщение
      const firstMessage = sortedMessages[0];
      setSelectedMessageId(firstMessage.id);
      
      // Также уведомляем родительский компонент о выборе поставщика
      if (onEmailSelect) {
        const supplier = requestSuppliers.find(s => s.id === firstMessage.requestSupplierId);
        if (supplier) {
          onEmailSelect(supplier);
        }
      }
    }
  }, [sortedMessages, selectedMessageId, onEmailSelect, requestSuppliers]);

  return (
    <div>
      {/* Two-panel layout for sent emails */}
      <div className="grid grid-cols-1 md:grid-cols-5 h-[600px] border rounded-md">
        {/* Left panel - Sent emails list */}
        <div className="border-r md:col-span-1 overflow-hidden">
          {/* Folder toggle header */}
          <div className="p-3 bg-muted/20 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Отправленные ({sentCount})</span>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={refreshMessages}
                        disabled={isRefreshing}
                      >
                        <RefreshCw 
                          size={12} 
                          className={isRefreshing ? 'animate-spin' : ''} 
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isRefreshing ? 'Обновление...' : 'Обновить сообщения'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ToggleSwitch
                        checked={true}
                        onCheckedChange={(checked) => {
                          if (!checked && onToggleBack) {
                            onToggleBack();
                          }
                        }}
                        size="sm"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Переключить на Входящие</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Messages list */}
          <ScrollArea className="h-[calc(600px-100px)]">
            {messagesLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">Загрузка сообщений...</p>
              </div>
            ) : sortedMessages.length > 0 ? (
              <div className="space-y-1">
                {sortedMessages.map((message) => {
                  const isActive = selectedMessageId === message.id;
                  
                  // Проверяем, ответил ли поставщик (используем hasResponded из данных поставщика)
                  const supplier = requestSuppliers.find(s => s.id === message.requestSupplierId);
                  const hasResponded = supplier?.hasResponded || false;
                  
                  return (
                    <div 
                      key={`${message.supplierId}-${message.id}`}
                      className={`
                        p-3 border-b cursor-pointer flex items-start gap-2 hover:bg-muted/20 transition-colors
                        ${isActive ? "bg-primary/10 hover:bg-primary/15" : ""}
                      `}
                      onClick={() => {
                        setSelectedMessageId(message.id);
                        
                        // Также уведомляем родительский компонент о выборе поставщика
                        const supplier = requestSuppliers.find(s => s.id === message.requestSupplierId);
                        if (supplier && onEmailSelect) {
                          onEmailSelect(supplier);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm truncate">{message.supplierName}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <span className="truncate flex-1">{message.supplierEmail}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 rounded-full hover:bg-muted"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSupplierForDetails({
                                requestSupplierId: message.requestSupplierId,
                                email: message.supplierEmail,
                                name: message.supplierName
                              });
                            }}
                          >
                            <Info className={`h-3 w-3 ${hasResponded ? 'text-green-600' : ''}`} />
                          </Button>
                        </div>
                        <div className="text-xs mt-1 flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {format(new Date(message.sentDate), "dd.MM.yyyy HH:mm")}
                          </span>
                          {message.attachments && message.attachments.length > 0 && (
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        {message.subject && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {message.subject}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">Нет сообщений</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel - Selected message content */}
        <div className="md:col-span-4 overflow-hidden flex flex-col">
          {selectedMessageId ? (
            (() => {
              // Находим выбранное сообщение
              const selectedMessage = sortedMessages.find(m => m.id === selectedMessageId);
              if (!selectedMessage) return null;
              
              const selectedSupplier = requestSuppliers.find(s => s.id === selectedMessage.requestSupplierId);
              if (!selectedSupplier) return null;
              
              // Находим все сообщения для выбранного поставщика
              const supplierMessages = sortedMessages.filter(m => m.requestSupplierId === selectedMessage.requestSupplierId);
              
              // Показываем конкретное выбранное сообщение и связанное с ним входящее письмо
              const messagesToShow = [];
              
              if (selectedMessage.direction === 'outbound') {
                // Если выбрано исходящее сообщение, ищем входящее письмо, на которое был дан ответ
                const inboundMessages = supplierMessages.filter(m => m.direction === 'inbound');
                const relatedInboundMessage = inboundMessages.find(inbound => 
                  new Date(inbound.sentDate) < new Date(selectedMessage.sentDate)
                ) || inboundMessages[0]; // Если не найдено, берем самое последнее входящее
                
                if (relatedInboundMessage) messagesToShow.push(relatedInboundMessage);
                messagesToShow.push(selectedMessage);
              } else {
                // Если выбрано входящее сообщение, ищем исходящий ответ на него
                const outboundMessages = supplierMessages.filter(m => m.direction === 'outbound');
                const relatedOutboundMessage = outboundMessages.find(outbound => 
                  new Date(outbound.sentDate) > new Date(selectedMessage.sentDate)
                ) || outboundMessages[0]; // Если не найдено, берем самое последнее исходящее
                
                messagesToShow.push(selectedMessage);
                if (relatedOutboundMessage) messagesToShow.push(relatedOutboundMessage);
              }
              
              // Сортируем по дате (старые сверху, новые снизу)
              messagesToShow.sort((a, b) => new Date(a.sentDate).getTime() - new Date(b.sentDate).getTime());
              
              
              return (
                <>
                  <div className="px-4 pb-1 border-b bg-muted/20">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-0">
                        <div className="text-muted-foreground text-sm">
                          <span className="font-bold">Кому:</span> {selectedSupplier.supplierName} &lt;{selectedSupplier.supplierEmail}&gt;
                        </div>
                        {selectedMessage && (
                          <div className="text-muted-foreground text-sm">
                            <span className="font-bold">Тема:</span> {selectedMessage.subject || '(No subject)'} • {format(new Date(selectedMessage.sentDate), "dd.MM.yyyy HH:mm")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-3">
                      {/* Показываем только последний ответ и входящее письмо */}
                      {messagesToShow.length > 0 ? (
                        messagesToShow.map((message, index) => (
                          <div key={message.id} className={`border rounded p-3 ${message.direction === 'outbound' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm">
                                {message.direction === 'outbound' ? 'Отправленное сообщение' : 'Полученное сообщение'}
                              </h4>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.sentDate), "dd.MM.yyyy HH:mm")}
                              </span>
                            </div>
                            
                            {message.subject && (
                              <div className="text-sm font-medium mb-2">
                                Тема: {message.subject}
                              </div>
                            )}
                            
                            <div className="whitespace-pre-line text-sm mb-3">
                              {message.content}
                            </div>
                            
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-muted-foreground mb-1">
                                  Вложения ({message.attachments.length}):
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {message.attachments.map((attachment: any, attIndex: number) => (
                                    <Button
                                      key={attIndex}
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = `data:${attachment.contentType};base64,${attachment.content}`;
                                        link.download = attachment.filename || `attachment-${attIndex}`;
                                        link.target = '_blank';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }}
                                    >
                                      <Paperclip className="h-3 w-3 mr-1" />
                                      {attachment.filename}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="border rounded p-3">
                          <h4 className="font-medium text-sm mb-2">Содержимое отправленного письма</h4>
                          <div className="whitespace-pre-line text-sm">
                            {(request as any)?.emailTemplate || (selectedSupplier as any).emailContent || 'Содержимое письма не найдено'}
                          </div>
                        </div>
                      )}
                      
                      {/* Визитка на момент отправки */}
                      <div className="border rounded p-3">
                        <h4 className="font-medium text-sm mb-2">Визитка на момент отправки</h4>
                        <div className="whitespace-pre-line text-sm">
                          {selectedSupplier.businessCard || 'Визитка не найдена'}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="mb-2">Выберите сообщение</p>
              <p className="text-sm">
                Выберите сообщение из списка, чтобы просмотреть его содержимое
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно с детальной информацией о поставщике */}
      <SupplierDetailsModal
        isOpen={!!selectedSupplierForDetails}
        onClose={() => setSelectedSupplierForDetails(null)}
        requestSupplierId={selectedSupplierForDetails?.requestSupplierId || 0}
        supplierEmail={selectedSupplierForDetails?.email}
        supplierName={selectedSupplierForDetails?.name}
      />
    </div>
  );
}
