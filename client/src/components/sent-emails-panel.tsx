import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Paperclip, Download } from "lucide-react";

interface SentEmailsPanelProps {
  requestSuppliers: RequestSupplier[];
  onEmailSelect?: (supplier: RequestSupplier) => void;
  activeSupplierId?: number | null;
  onToggleBack?: () => void;
  request?: SearchRequest;
}

export function SentEmailsPanel({
  requestSuppliers,
  onEmailSelect,
  activeSupplierId,
  onToggleBack,
  request
}: SentEmailsPanelProps) {
  
  // Получаем сообщения для выбранного поставщика
  console.log('activeSupplierId:', activeSupplierId);
  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['/api/request-suppliers', activeSupplierId, 'messages'],
    queryFn: async () => {
      console.log('Query function called with activeSupplierId:', activeSupplierId);
      if (!activeSupplierId) {
        console.log('No activeSupplierId, returning empty array');
        return [];
      }
      console.log('Making API request to:', `/api/request-suppliers/${activeSupplierId}/messages`);
      const data = await apiRequest('GET', `/api/request-suppliers/${activeSupplierId}/messages`);
      console.log('API response data:', data);
      return data;
    },
    enabled: !!activeSupplierId
  });
  
  console.log('useQuery result:', { messages, isLoading, error });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Автоматически выбираем первое письмо при загрузке
  useEffect(() => {
    if (requestSuppliers.length > 0 && !activeSupplierId && onEmailSelect) {
      console.log('Auto-selecting first supplier:', requestSuppliers[0]);
      onEmailSelect(requestSuppliers[0]);
    }
  }, [requestSuppliers, activeSupplierId, onEmailSelect]);

  // Filter suppliers based on favorites (if needed)
  const filteredSuppliers = showFavoritesOnly 
    ? requestSuppliers.filter(supplier => (supplier as any).isFavorite)
    : requestSuppliers;

  return (
    <div>
      {/* Two-panel layout for sent emails */}
      <div className="grid grid-cols-1 md:grid-cols-5 h-[600px] border rounded-md">
        {/* Left panel - Sent emails list */}
        <div className="border-r md:col-span-1 overflow-hidden">
          {/* Folder toggle header */}
          <div className="p-3 bg-muted/20 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Отправленные</span>
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

          {/* Emails list */}
          <ScrollArea className="h-[calc(600px-60px)]">
            {filteredSuppliers.length > 0 ? (
              <div className="space-y-1">
                {filteredSuppliers.map((supplier) => {
                  const isActive = activeSupplierId === supplier.id;
                  
                  return (
                    <div 
                      key={supplier.id}
                      className={`
                        p-3 border-b cursor-pointer flex items-start gap-2 hover:bg-muted/20 transition-colors
                        ${isActive ? "bg-primary/10 hover:bg-primary/15" : ""}
                      `}
                      onClick={() => onEmailSelect?.(supplier)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm truncate">{supplier.supplierName}</div>
                          {supplier.hasResponded && (
                            <Badge variant="outline" className="bg-primary/10 text-primary ml-2 flex-shrink-0">
                              Ответ
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {supplier.supplierEmail}
                        </div>
                        <div className="text-xs mt-1 flex justify-between items-center">
                           <span className="text-muted-foreground">
                             {(supplier as any).emailSentDate ? format(new Date((supplier as any).emailSentDate), "dd.MM.yyyy HH:mm") : "Неизвестно"}
                           </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">Нет отправленных писем</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel - Selected email content */}
        <div className="md:col-span-4 overflow-hidden flex flex-col">
          {activeSupplierId ? (
            (() => {
              const selectedSupplier = requestSuppliers.find(s => s.id === activeSupplierId);
              if (!selectedSupplier) return null;
              
              return (
                <>
                  <div className="px-4 pb-1 border-b bg-muted/20">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-0">
                        <div className="text-muted-foreground text-sm">
                          <span className="font-bold">Кому:</span> {selectedSupplier.supplierName} &lt;{selectedSupplier.supplierEmail}&gt; • {(selectedSupplier as any).sentAt ? format(new Date((selectedSupplier as any).sentAt), "dd.MM.yyyy HH:mm") : ""}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          <span className="font-bold">Тема:</span> {(selectedSupplier as any).emailSubject || '(No subject)'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <ScrollArea className="flex-1 p-3">
                    <div className="space-y-3">
                      {/* Блок 1: Содержимое отправленного письма */}
                      <div className="border rounded p-3">
                        <h4 className="font-medium text-sm mb-2">Содержимое отправленного письма</h4>
                        <div className="whitespace-pre-line text-sm">
                          {(request as any)?.emailTemplate || (selectedSupplier as any).emailContent || 'Содержимое письма не найдено'}
                        </div>
                      </div>
                      
                      {/* Блок 2: Визитка на момент отправки (без заголовка) */}
                      <div className="border rounded p-3">
                        <div className="whitespace-pre-line text-sm">
                          {selectedSupplier.businessCard || 'Визитка не найдена'}
                        </div>
                      </div>
                      
                      {/* Блок 3: Вложения отправленных писем */}
                      <div className="border rounded p-3">
                        <h4 className="font-medium text-sm mb-2">Отправленные вложения</h4>
                        {(() => {
                          console.log('Messages data:', messages);
                          console.log('Messages type:', typeof messages);
                          console.log('Messages length:', messages?.length);
                          console.log('isLoading:', isLoading);
                          console.log('error:', error);
                          
                          if (isLoading) {
                            return <div className="text-sm text-muted-foreground">Загрузка данных о вложениях...</div>;
                          }
                          
                          if (error) {
                            return <div className="text-sm text-red-500">Ошибка загрузки: {String(error)}</div>;
                          }
                          
                          if (!messages) {
                            return <div className="text-sm text-muted-foreground">Нет данных</div>;
                          }
                          
                          if (!Array.isArray(messages)) {
                            console.log('Messages is not an array:', messages);
                            return <div className="text-sm text-muted-foreground">Ошибка загрузки данных</div>;
                          }
                          
                          // Находим все исходящие сообщения с вложениями
                          const outboundMessages = messages.filter((msg: any) => {
                            console.log('Checking message:', msg);
                            console.log('Direction:', msg.direction);
                            console.log('Has attachments:', !!msg.attachments);
                            console.log('Attachments length:', msg.attachments?.length);
                            return msg.direction === 'outbound' && msg.attachments && msg.attachments.length > 0;
                          });
                          
                          console.log('Outbound messages with attachments:', outboundMessages);
                          
                          if (outboundMessages.length === 0) {
                            return <div className="text-sm text-muted-foreground">Нет отправленных вложений</div>;
                          }
                          
                          // Собираем все вложения из всех исходящих сообщений
                          const allAttachments = outboundMessages.flatMap((msg: any) => 
                            msg.attachments.map((att: any, index: number) => ({
                              ...att,
                              messageId: msg.id,
                              attachmentIndex: index
                            }))
                          );
                          
                          console.log('All attachments:', allAttachments);
                          
                          return (
                            <div>
                              <div className="text-xs text-muted-foreground mb-2">
                                Найдено вложений: {allAttachments.length}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {allAttachments.map((attachment: any, index: number) => (
                                  <Button
                                    key={`${attachment.messageId}-${attachment.attachmentIndex}`}
                                    variant="outline"
                                    size="sm"
                                    className="inline-flex items-center gap-2 px-3 py-2 hover:bg-primary/5 hover:border-primary/40 transition-colors"
                                    onClick={() => {
                                      // Создаем ссылку для скачивания
                                      const link = document.createElement('a');
                                      link.href = `data:${attachment.contentType};base64,${attachment.content}`;
                                      link.download = attachment.filename || `attachment-${index}`;
                                      link.target = '_blank';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    <div className="flex flex-col items-start">
                                      <span className="text-sm font-medium truncate max-w-[150px]">
                                        {attachment.filename}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {attachment.size ? `${Math.round(attachment.size / 1024)} KB` : 'Unknown size'}
                                      </span>
                                    </div>
                                    <Download className="h-3 w-3 ml-1" />
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </ScrollArea>
                </>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="mb-2">Выберите отправленное письмо</p>
              <p className="text-sm">
                Выберите письмо из списка, чтобы просмотреть его содержимое
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
