import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw,
  Mail,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Layout from '@/components/layout';

interface EmailReplyTemplate {
  id: number;
  userId: number | null;
  name: string;
  subject: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailReplyTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
    isDefault: false
  });

  // Check admin access
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    const isAdminValue = localStorage.getItem('isAdmin');
    setIsAdmin(isAdminValue === 'true');
    
    if (isAdminValue === 'true') {
      fetchTemplates();
    }
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/email-reply-templates');
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить шаблоны',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/admin/email-reply-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Шаблон создан'
        });
        setShowCreateDialog(false);
        setFormData({ name: '', subject: '', content: '', isDefault: false });
        fetchTemplates();
      } else {
        throw new Error('Failed to create template');
      }
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать шаблон',
        variant: 'destructive'
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;
    
    try {
      const response = await fetch(`/api/admin/email-reply-templates/${selectedTemplate.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Шаблон обновлен'
        });
        setShowEditDialog(false);
        setSelectedTemplate(null);
        setFormData({ name: '', subject: '', content: '', isDefault: false });
        fetchTemplates();
      } else {
        throw new Error('Failed to update template');
      }
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить шаблон',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (templateId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) return;
    
    try {
      const response = await fetch(`/api/admin/email-reply-templates/${templateId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast({
          title: 'Успешно',
          description: 'Шаблон удален'
        });
        fetchTemplates();
      } else {
        throw new Error('Failed to delete template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить шаблон',
        variant: 'destructive'
      });
    }
  };

  const openEditDialog = (template: EmailReplyTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      content: template.content,
      isDefault: template.isDefault
    });
    setShowEditDialog(true);
  };

  const openCreateDialog = () => {
    setFormData({ name: '', subject: '', content: '', isDefault: false });
    setShowCreateDialog(true);
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Доступ запрещен</h1>
            <p className="mt-2">У вас нет прав для доступа к этой странице.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="flex justify-center">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Шаблоны ответов</h1>
            <p className="text-muted-foreground mt-1">
              Управление шаблонами для ответов на неразобранные письма
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchTemplates} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Создать шаблон
            </Button>
          </div>
        </div>

        {/* Templates List */}
        <div className="space-y-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Нет шаблонов</h3>
                <p className="text-muted-foreground">
                  Создайте первый шаблон для ответов на письма
                </p>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {template.name}
                        {template.isDefault && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            По умолчанию
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <div className="flex items-center gap-2">
                          <span>Тема: {template.subject}</span>
                          <span className="text-muted-foreground">•</span>
                          <span>Создан: {format(new Date(template.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Редактировать
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Удалить
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {template.content.length > 200 
                      ? `${template.content.substring(0, 200)}...`
                      : template.content
                    }
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Create Template Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Создать шаблон ответа</DialogTitle>
              <DialogDescription>
                Создание нового шаблона для ответов на неразобранные письма
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Название шаблона</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Название шаблона"
                />
              </div>
              
              <div>
                <Label htmlFor="subject">Тема письма</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="Тема письма"
                />
              </div>
              
              <div>
                <Label htmlFor="content">Содержимое</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Содержимое письма"
                  rows={8}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({...formData, isDefault: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="isDefault">Использовать по умолчанию</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate}>
                Создать шаблон
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Template Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Редактировать шаблон</DialogTitle>
              <DialogDescription>
                Редактирование шаблона ответа
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Название шаблона</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Название шаблона"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-subject">Тема письма</Label>
                <Input
                  id="edit-subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="Тема письма"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-content">Содержимое</Label>
                <Textarea
                  id="edit-content"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Содержимое письма"
                  rows={8}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({...formData, isDefault: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="edit-isDefault">Использовать по умолчанию</Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Отмена
              </Button>
              <Button onClick={handleUpdate}>
                Сохранить изменения
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
