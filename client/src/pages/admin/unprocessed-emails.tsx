import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Mail, 
  Clock, 
  User, 
  Eye, 
  Reply, 
  CheckCircle,
  Search,
  RefreshCw,
  Paperclip,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Layout from '@/components/layout';

interface UnprocessedEmail {
  id: number;
  userId: number | null;
  messageId: string;
  senderEmail: string;
  senderName: string | null;
  subject: string;
  content: string;
  attachments: any[];
  receivedAt: string;
  status: 'new' | 'replied';
  linkedRequestId: number | null;
  repliedAt: string | null;
  replyContent: string | null;
  processedBy: number | null;
  processedAt: string | null;
  createdAt: string;
  // User info
  userEmailAccount?: string;
  userEmailConfigured?: boolean;
}

const defaultReplyTemplate = `Ваше письмо НЕ было доставлено!
ПЕРЕШЛИТЕ письмо повторно УКАЗАВ в ТЕМЕ ПИСЬМА ТЕГИ ( REQ-XXXX TID YYYY), которые были во входящем письме.
Тема вашего письма должна выглядеть примерно так: "RE: Запрос  - [REQ-2520-00674] [TID:rIy1ks]"`;

export default function UnprocessedEmailsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [emails, setEmails] = useState<UnprocessedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState<UnprocessedEmail | null>(null);
  const [replyContent, setReplyContent] = useState<{ [key: number]: string }>({});
  const [sendingReply, setSendingReply] = useState<{ [key: number]: boolean }>({});

  // Check authentication and admin role
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/auth" />;
  }

  if (user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  // Load emails on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/unprocessed-emails');
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      const data = await response.json();
      setEmails(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching emails:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить список писем",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (emailId: number) => {
    try {
      setSendingReply(prev => ({ ...prev, [emailId]: true }));
      
      const content = replyContent[emailId] || defaultReplyTemplate;
      
      const response = await fetch(`/api/admin/unprocessed-emails/${emailId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reply');
      }

      toast({
        title: "Ответ отправлен",
        description: "Письмо успешно отправлено поставщику"
      });

      // Update email status to replied
      await updateEmailStatus(emailId, 'replied');
      
      // Обновляем список отправленных сообщений
      if ((window as any).refreshSentEmails) {
        (window as any).refreshSentEmails();
      }
      
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Ошибка отправки",
        description: "Не удалось отправить ответ",
        variant: "destructive"
      });
    } finally {
      setSendingReply(prev => ({ ...prev, [emailId]: false }));
    }
  };


  const updateEmailStatus = async (emailId: number, status: string) => {
    const response = await fetch(`/api/admin/unprocessed-emails/${emailId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error('Failed to update email status');
    }

    // Update local state
    setEmails(prev => prev.map(email => 
      email.id === emailId 
        ? { ...email, status: status as 'new' | 'replied' }
        : email
    ));
  };

  const handleDownloadAttachment = async (emailId: number, attachmentIndex: number, filename: string) => {
    try {
      const response = await fetch(`/api/admin/unprocessed-emails/${emailId}/attachments/${attachmentIndex}`);
      if (!response.ok) {
        throw new Error('Failed to download attachment');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast({
        title: "Ошибка скачивания",
        description: "Не удалось скачать вложение",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default" className="text-xs px-2 py-0.5">Новое</Badge>;
      case 'replied':
        return <Badge variant="secondary" className="text-xs px-2 py-0.5">Отвечено</Badge>;
      default:
        return <Badge variant="default" className="text-xs px-2 py-0.5">Новое</Badge>;
    }
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = searchTerm === '' || 
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.senderEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeTab === 'all' || email.status === activeTab;
    
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Неразобранные письма
            </CardTitle>
            <CardDescription>
              Управление письмами без тегов REQ/ID
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Action buttons */}
            <div className="flex gap-2 mb-6">
              <Button 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/check-emails', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'x-manual-check': 'true'  // Помечаем как ручной запрос от пользователя
                      },
                      body: JSON.stringify({})
                    });
                    const result = await response.json();
                    if (result.success) {
                      toast({ title: "Проверка email", description: `Найдено ${result.newResponses} новых ответов` });
                      fetchData();
                    } else {
                      toast({ title: "Ошибка проверки", description: result.message, variant: "destructive" });
                    }
                  } catch (error) {
                    toast({ title: "Ошибка", description: "Не удалось запустить проверку email", variant: "destructive" });
                  }
                }}
                variant="default"
              >
                Проверить email
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    // Сначала запускаем проверку emails
                    const response = await fetch('/api/check-emails', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'x-manual-check': 'true'  // Помечаем как ручной запрос от пользователя
                      },
                      body: JSON.stringify({})
                    });
                    const result = await response.json();
                    if (result.success) {
                      toast({ title: "Проверка email", description: `Найдено ${result.newResponses} новых ответов` });
                    } else {
                      toast({ title: "Ошибка проверки", description: result.message, variant: "destructive" });
                    }
                    // Затем обновляем список
                    await fetchData();
                  } catch (error) {
                    toast({ title: "Ошибка", description: "Не удалось запустить проверку email", variant: "destructive" });
                    // Все равно обновляем список
                    await fetchData();
                  }
                }}
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Обновить
              </Button>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Поиск по теме, отправителю или содержимому..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Tabs for filtering */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList>
                <TabsTrigger value="all">ВСЕ</TabsTrigger>
                <TabsTrigger value="new">НОВЫЕ</TabsTrigger>
                <TabsTrigger value="replied">ОТВЕЧЕНО</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Emails list */}
            <div className="space-y-4">
              {filteredEmails.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Нет писем для отображения
                </div>
              ) : (
                filteredEmails.map((email) => (
                  <Card key={email.id} className="p-2">
                    <div className="flex items-center justify-between">
                      {/* Left side - All info in one line */}
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {format(new Date(email.receivedAt), 'dd.MM.yyyy', { locale: ru })}
                        </span>
                        <span className="text-xs font-medium">ID {email.userId}</span>
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-gray-500" />
                          <span className="text-xs">
                            <strong>От:</strong> {email.senderName ? `${email.senderName} <${email.senderEmail.split(' <')[0]}>` : email.senderEmail.split(' <')[0]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium">Тема:</span>
                          <span className="text-xs">{email.subject}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEmail(email)}
                            className="h-5 w-5 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs font-medium text-gray-600">Ответ поставщику:</label>
                          <Textarea
                            placeholder={defaultReplyTemplate}
                            value={replyContent[email.id] || defaultReplyTemplate}
                            onChange={(e) => setReplyContent(prev => ({ ...prev, [email.id]: e.target.value }))}
                            className="min-h-[16px] max-h-[120px] overflow-y-auto resize-y w-60"
                            style={{ 
                              lineHeight: '1.1',
                              fontSize: '10px',
                              height: '16px'
                            }}
                          />
                        </div>
                      </div>

                      {/* Right side - Status and Actions */}
                      <div className="flex items-center gap-1 ml-2">
                        {getStatusBadge(email.status)}
                        <Button
                          onClick={() => handleReply(email.id)}
                          disabled={sendingReply[email.id] || email.status === 'replied'}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          {sendingReply[email.id] ? 'Отправка...' : 'Ответить'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Email content modal */}
        <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto resize">
            <DialogHeader>
              <DialogTitle>Содержание письма</DialogTitle>
              <DialogDescription>
                От: {selectedEmail?.senderName ? `${selectedEmail.senderName} <${selectedEmail.senderEmail}>` : selectedEmail?.senderEmail}
                <br />
                Тема: {selectedEmail?.subject}
                <br />
                Дата: {selectedEmail ? format(new Date(selectedEmail.receivedAt), 'dd.MM.yyyy HH:mm', { locale: ru }) : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <h4 className="font-medium mb-2">Содержание:</h4>
              <div className="bg-gray-50 p-4 rounded-lg max-h-[70vh] overflow-y-auto resize-y min-h-[200px] border-2 border-dashed border-gray-300">
                <pre className="whitespace-pre-wrap text-sm">
                  {selectedEmail?.content}
                </pre>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                💡 Перетащите уголок окна для изменения размера
              </div>
              
              {/* Attachments section */}
              {selectedEmail?.attachments && selectedEmail.attachments.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Вложения ({selectedEmail.attachments.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEmail.attachments.map((attachment: any, index: number) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="inline-flex items-center gap-2 px-3 py-2 hover:bg-primary/5 hover:border-primary/40 transition-colors"
                        onClick={() => handleDownloadAttachment(selectedEmail.id, index, attachment.filename || `attachment_${index + 1}`)}
                      >
                        <Paperclip className="h-3 w-3" />
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium truncate max-w-[150px]">
                            {attachment.filename || `Вложение ${index + 1}`}
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
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}