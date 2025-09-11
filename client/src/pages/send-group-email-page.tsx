import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { ArrowLeft, Mail, Loader2, Check, UserPlus, Paperclip, Upload, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUpload } from "@/components/file-upload";
import { Textarea } from "@/components/ui/textarea";
import { MainNavigation } from "@/components/main-navigation";

interface ContactGroup {
  id: number;
  name: string;
  description: string;
  contactCount?: number;
}

interface ContactItem {
  id: number;
  groupId: number;
  email: string;
  name: string;
  phone: string;
  organization: string | null;
  position?: string | null;
  createdAt: string;
}

export default function SendGroupEmailPage() {
  const [, params] = useRoute<{ id: string }>("/contact-groups/:id/send-email");
  const groupId = params ? parseInt(params.id) : 0;
  const [location, navigate] = useLocation();
  
  // Проверяем параметр reset для сброса состояния формы при повторном открытии
  const resetForm = new URLSearchParams(location.split('?')[1] || '').get('reset') === 'true';
  
  // Генерируем уникальный ID для запроса по формату REQ-YYMM-XXXXX (Год-Месяц-Случайное число)
  const [requestId] = useState(() => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `REQ-${year}${month}-${random}`;
  });

  // Генерируем уникальный ID для отслеживания по формату A-Z0-9 (8 символов)
  const [trackingId] = useState(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  });
  
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [fileAttachmentDialogOpen, setFileAttachmentDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  
  // Функция для удаления файла
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Fetch group details
  const { data: group, isLoading: isLoadingGroup } = useQuery<ContactGroup>({
    queryKey: ["/api/contact-groups", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/contact-groups/${groupId}`);
      const data = await res.json();
      return data.group;
    },
    enabled: groupId > 0,
  });

  // Fetch contacts in this group using alternative approach
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery<ContactItem[]>({
    queryKey: ["/api/contact-groups", groupId, "contacts"],
    queryFn: async () => {
      try {
        console.log(`Загрузка данных для группы ${groupId}...`);
        
        // Загружаем данные группы, которая уже содержит массив контактов
        const res = await fetch(`/api/contact-groups/${groupId}`);
        
        if (!res.ok) {
          console.error(`Ошибка при получении группы: ${res.status} ${res.statusText}`);
          throw new Error(`Failed to fetch group: ${res.statusText}`);
        }
        
        const data = await res.json();
        const groupContacts = data?.contacts || [];
        
        console.log(`Загружено контактов для группы ${groupId}:`, groupContacts?.length || 0);
        return groupContacts;
      } catch (error) {
        console.error("Ошибка при загрузке контактов:", error);
        return [];
      }
    },
    enabled: groupId > 0,
    staleTime: 0, // Всегда обновлять данные при переходе на страницу
    refetchOnWindowFocus: true,
  });

  // Сбрасываем форму при открытии страницы с параметром reset
  useEffect(() => {
    if (resetForm) {
      setEmailSent(false);
      setSubject('');
      setMessage('');
      setSelectedFiles([]);
      // Другие сбросы состояния формы по необходимости
    }
  }, [resetForm]);

  // Update selected contacts when contacts are loaded
  useEffect(() => {
    if (contacts?.length) {
      // По умолчанию выбираем все контакты
      setSelectedContactIds(contacts.map(contact => contact.id));
      setSelectAllChecked(true);
    }
  }, [contacts]);

  // Handle select all change
  const handleSelectAll = (checked: boolean) => {
    setSelectAllChecked(checked);
    
    if (checked && contacts) {
      setSelectedContactIds(contacts.map(contact => contact.id));
    } else {
      setSelectedContactIds([]);
    }
  };

  // Mutation for sending email
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { 
      groupId: number; 
      subject: string; 
      message: string;
      contactIds: number[];
      attachments?: Array<{
        name: string;
        type: string;
        size: number;
        content: string | null;
      }>;
      requestId: string;
      trackingId: string;
    }) => {
      setIsSending(true);
      try {
        const response = await fetch("/api/contact-groups/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to send email: ${response.statusText}`);
        }
        
        return response.json();
      } finally {
        setIsSending(false);
      }
    },
    onSuccess: (data) => {
      setEmailSent(true);
      
      const { sentSuccessfully, totalContacts } = data;
      
      toast({
        title: "Успешно",
        description: `Письмо было отправлено ${sentSuccessfully} из ${totalContacts} выбранных контактов`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", groupId] });
      
      // Не делаем редирект, чтобы пользователь мог видеть результаты отправки
      // и мог просмотреть сводную информацию об отправленных письмах
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: `Не удалось отправить письмо: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = async () => {
    if (!subject.trim()) {
      toast({
        title: "Необходимо указать тему",
        description: "Пожалуйста, введите тему письма.",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Необходимо указать сообщение",
        description: "Пожалуйста, введите текст сообщения.",
        variant: "destructive",
      });
      return;
    }

    if (selectedContactIds.length === 0) {
      toast({
        title: "Не выбраны получатели",
        description: "Выберите хотя бы одного получателя",
        variant: "destructive",
      });
      return;
    }
    
    // Добавляем информацию о запросе в конец сообщения
    const messageWithRef = `${message}\n\n!Request Reference: ${requestId}\nRequest Tracking ID: ${trackingId}\nPlease include this reference in your reply to ensure proper tracking of your response.`;
    
    // Формируем тему с номером запроса
    const emailSubject = `${subject} - [${requestId}] [TID:${trackingId}]`;
    
    // Подготовка вложений с содержимым файлов
    const attachments = await Promise.all(
      selectedFiles.map(async (file) => {
        // Преобразуем файл в base64
        const content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            // Получаем только часть строки после запятой, которая содержит данные base64
            const base64Data = base64.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(file);
        });
        
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          content
        };
      })
    );

    sendEmailMutation.mutate({ 
      groupId, 
      subject: emailSubject, 
      message: messageWithRef,
      contactIds: selectedContactIds,
      attachments,
      requestId,
      trackingId
    });
  };

  const isLoading = isLoadingGroup || isLoadingContacts;
  const contactCount = contacts?.length || 0;
  const selectedContactsCount = selectedContactIds.length;

  // Mutation для добавления временного контакта (не добавляется в группу)
  const createContactMutation = useMutation({
    mutationFn: async (formData: {
      groupId: number;
      name: string;
      email: string;
      phone: string;
      organization?: string;
      position?: string;
    }) => {
      // Создаем временный контакт с временным ID (отрицательное значение)
      // Это позволит нам добавить контакт локально без добавления в группу
      const tempContact = {
        id: -Math.floor(Math.random() * 10000) - 1, // Генерируем отрицательный ID
        groupId: formData.groupId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        organization: formData.organization || null,
        position: formData.position || null,
        createdAt: new Date().toISOString()
      };
      
      return tempContact;
    },
    onSuccess: (newContact) => {
      setCreateContactOpen(false);
      toast({
        title: "Контакт добавлен",
        description: "Контакт добавлен в список для отправки",
      });
      
      // Используем setState, чтобы обновить контакты
      queryClient.setQueryData(["/api/contact-groups", groupId, "contacts"], 
        (oldData: ContactItem[] | undefined) => {
          if (!oldData) return [newContact];
          return [...oldData, newContact];
        }
      );
      
      // Автоматически выбираем новый контакт
      setSelectedContactIds(prev => [...prev, newContact.id]);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось добавить контакт: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Обработчик формы для создания нового контакта
  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const organization = formData.get("organization") as string;
    const position = formData.get("position") as string;
    
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Необходимо заполнить обязательные поля",
        description: "Пожалуйста, укажите имя и email контакта",
        variant: "destructive",
      });
      return;
    }
    
    createContactMutation.mutate({
      groupId,
      name,
      email,
      phone,
      organization: organization || undefined,
      position: position || undefined,
    });
  };

  // Обработчик для выбора файлов вложений
  const handleFileSelection = (files: File[]) => {
    setSelectedFiles(files);
  };

  // Toggle selection of a single contact
  const toggleContactSelection = (contactId: number) => {
    setSelectedContactIds(prev => {
      if (prev.includes(contactId)) {
        setSelectAllChecked(false);
        return prev.filter(id => id !== contactId);
      } else {
        const newSelected = [...prev, contactId];
        if (contacts && newSelected.length === contacts.length) {
          setSelectAllChecked(true);
        }
        return newSelected;
      }
    });
  };

  return (
    <div>
      <MainNavigation />
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-6">Отправить email</h1>
        
        {emailSent && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <Check className="h-5 w-5 text-green-600" />
            <AlertTitle className="text-green-800">Сообщение отправлено!</AlertTitle>
            <AlertDescription className="text-green-700">
              Письмо успешно отправлено {sendEmailMutation.data?.sentSuccessfully} выбранным контактам в группе.
            </AlertDescription>
          </Alert>
        )}
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Верхняя часть формы с полями ввода */}
            <div>
              <div className="mb-2">Название продукта</div>
              <Input 
                placeholder="Введите название продукта" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="max-w-lg"
              />
            </div>
            
            {/* Кнопки добавления контакта */}
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                onClick={() => setCreateContactOpen(true)}
                className="flex items-center"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Добавить контакт
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setAttachmentDialogOpen(true)}
                className="flex items-center"
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Загрузить список контактов
              </Button>
            </div>
            
            {/* Блок с выбранными контактами перемещен вверх */}
            <div className="border rounded-lg overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <div className="text-lg font-bold">Выбранные контакты</div>
                <div className="flex items-center">
                  <Checkbox 
                    id="select-all"
                    checked={selectAllChecked}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="ml-2 text-sm">
                    Select All
                  </label>
                  <div className="ml-4 text-sm text-muted-foreground">
                    {selectedContactsCount} из {contactCount} контактов выбрано
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-0">
                {!contacts || contacts.length === 0 ? (
                  <div className="text-center py-8">
                    Нет контактов в группе. Добавьте контакты для отправки email.
                  </div>
                ) : (
                  <div>
                    {/* Заголовок таблицы */}
                    <div className="grid grid-cols-2 border-b py-3 font-medium text-muted-foreground text-sm">
                      <div>Имя / Организация</div>
                      <div>Email</div>
                    </div>
                    
                    {/* Список контактов из группы в стиле с экрана 3 */}
                    <div className="divide-y">
                      {contacts.map((contact) => (
                        <div key={contact.id} className="grid grid-cols-2 py-3 hover:bg-muted/20">
                          <div className="flex items-center">
                            <Checkbox 
                              className="mr-2"
                              checked={selectedContactIds.includes(contact.id)}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                            />
                            <div>
                              <div className="font-medium">{contact.name || "Без имени"}</div>
                              {contact.organization && (
                                <div className="text-xs text-muted-foreground">{contact.organization}</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            {contact.email}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Email form */}
            <div className="space-y-6 border rounded-lg p-6">
              <div className="grid gap-6">
                <div className="grid gap-3">
                  <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                  <Input 
                    id="subject" 
                    placeholder="Enter subject" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="grid gap-3">
                  <label htmlFor="message" className="text-sm font-medium">Message</label>
                  <Textarea 
                    id="message" 
                    placeholder="Enter your message here" 
                    className="min-h-[200px]"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                
                <div className="grid gap-3">
                  <label className="text-sm font-medium">Attachments</label>
                  <div className="border rounded-md p-4">
                    {selectedFiles.length > 0 ? (
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Paperclip className="h-4 w-4 mr-2" />
                              <span className="text-sm">{file.name}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleRemoveFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <div className="mb-2">No files attached. Click "Attach Files" to add documents to your request.</div>
                        <div className="text-xs">Maximum file size: 5 MB per file, 10 MB total.</div>
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <Button 
                        variant="secondary"
                        onClick={() => {
                          // Simulate click on file input
                          const fileInput = document.getElementById('attach-files-input');
                          if (fileInput) fileInput.click();
                        }}
                        className="flex items-center"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attach Files
                      </Button>
                      <input 
                        type="file" 
                        id="attach-files-input" 
                        className="hidden" 
                        multiple
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            const files = e.target.files;
                            const newFiles: File[] = [];
                            
                            for (let i = 0; i < files.length; i++) {
                              newFiles.push(files[i]);
                            }
                            
                            const totalSize = [...selectedFiles, ...newFiles].reduce((acc, file) => acc + file.size, 0);
                            
                            if (totalSize > 10 * 1024 * 1024) {
                              toast({
                                title: "Error",
                                description: "Total file size exceeds 10 MB limit",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            setSelectedFiles(prev => [...prev, ...newFiles]);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Кнопка отправки */}
            <div className="flex justify-end">
              <Button
                onClick={handleSendEmail}
                disabled={isSending || emailSent || selectedContactIds.length === 0}
                className="min-w-[200px]"
                variant="secondary"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Отправка...
                  </>
                ) : emailSent ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Отправлено
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Отправить email ({selectedContactsCount})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        
        {/* Диалоговое окно для добавления нового контакта */}
        <Dialog open={createContactOpen} onOpenChange={setCreateContactOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить новый контакт</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Имя <span className="text-red-500">*</span>
                  </label>
                  <Input 
                    id="name" 
                    name="name" 
                    placeholder="Введите имя" 
                    required 
                  />
                </div>
                
                <div className="grid gap-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    placeholder="Введите email" 
                    required 
                  />
                </div>
                
                <div className="grid gap-2">
                  <label htmlFor="phone" className="text-sm font-medium">
                    Телефон
                  </label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    placeholder="Введите телефон" 
                  />
                </div>
                
                <div className="grid gap-2">
                  <label htmlFor="organization" className="text-sm font-medium">
                    Организация
                  </label>
                  <Input 
                    id="organization" 
                    name="organization" 
                    placeholder="Введите название организации" 
                  />
                </div>
                
                <div className="grid gap-2">
                  <label htmlFor="position" className="text-sm font-medium">
                    Должность
                  </label>
                  <Input 
                    id="position" 
                    name="position" 
                    placeholder="Введите должность" 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateContactOpen(false)}>
                  Отмена
                </Button>
                <Button 
                  type="submit" 
                  disabled={createContactMutation.isPending}
                >
                  {createContactMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Добавить
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Contact list upload dialog */}
        <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                Загрузить список поставщиков
                <Button variant="ghost" size="icon" className="ml-2 rounded-full w-5 h-5 p-0">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Загрузите Excel файл со списком поставщиков для отправки запроса.
              </p>
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 text-center">
                <div className="mb-4">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p>Перетащите Excel файл сюда или нажмите кнопку ниже, чтобы выбрать файл</p>
                </div>
                <label htmlFor="file-selector">
                  <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Выбрать файл
                  </div>
                  <input 
                    type="file" 
                    id="file-selector" 
                    className="hidden" 
                    accept=".xls,.xlsx" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const fileArray: File[] = [];
                        for (let i = 0; i < e.target.files.length; i++) {
                          fileArray.push(e.target.files[i]);
                        }
                        handleFileSelection(fileArray);
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-2">Поддерживаемые форматы: .xls, .xlsx</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttachmentDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={() => setAttachmentDialogOpen(false)}>
                Загрузить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}