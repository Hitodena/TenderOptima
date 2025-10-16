import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Edit2, Trash2, FileText, Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/queryClient";

interface EmailImprovementTemplate {
  id: number;
  userId: number;
  name: string;
  subject: string;
  content: string;
  type: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailImprovementTemplateManagerProps {
  onTemplateSelect: (template: EmailImprovementTemplate) => void;
  selectedTemplate?: EmailImprovementTemplate | null;
}

export function EmailImprovementTemplateManager({ 
  onTemplateSelect, 
  selectedTemplate 
}: EmailImprovementTemplateManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailImprovementTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", content: "" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch templates from API
  const { data: templates = [], isLoading, error } = useQuery<EmailImprovementTemplate[]>({
    queryKey: ['/api/email-improvement-templates'],
    queryFn: async () => {
      return await apiRequest<EmailImprovementTemplate[]>('/api/email-improvement-templates', 'GET');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (template: { name: string; subject: string; content: string; isDefault?: boolean }) => {
      return await apiRequest<EmailImprovementTemplate>('/api/email-improvement-templates', 'POST', template);
    },
    onSuccess: (newTemplate) => {
      queryClient.setQueryData(['/api/email-improvement-templates'], (old: EmailImprovementTemplate[] = []) => [...old, newTemplate]);
      setNewTemplate({ name: "", subject: "", content: "" });
      setIsDialogOpen(false);
      toast({
        title: "Шаблон добавлен",
        description: `Шаблон "${newTemplate.name}" успешно создан`
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка при создании шаблона",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...template }: { id: number; name: string; subject: string; content: string; isDefault?: boolean }) => {
      return await apiRequest<EmailImprovementTemplate>(`/api/email-improvement-templates/${id}`, 'PUT', template);
    },
    onSuccess: (updatedTemplate) => {
      queryClient.setQueryData(['/api/email-improvement-templates'], (old: EmailImprovementTemplate[] = []) => 
        old.map(t => t.id === updatedTemplate.id ? updatedTemplate : t)
      );
      setIsEditing(false);
      setIsDialogOpen(false);
      toast({
        title: "Шаблон обновлен",
        description: `Шаблон "${updatedTemplate.name}" успешно обновлен`
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка при обновлении шаблона",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return await apiRequest(`/api/email-improvement-templates/${templateId}`, 'DELETE');
    },
    onSuccess: (_, templateId) => {
      queryClient.setQueryData(['/api/email-improvement-templates'], (old: EmailImprovementTemplate[] = []) => 
        old.filter(t => t.id !== templateId)
      );
      toast({
        title: "Шаблон удален",
        description: "Шаблон успешно удален"
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка при удалении шаблона",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Reset to defaults mutation
  const resetToDefaultsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<EmailImprovementTemplate[]>('/api/email-improvement-templates/reset-to-defaults', 'POST');
    },
    onSuccess: (templates) => {
      queryClient.setQueryData(['/api/email-improvement-templates'], templates);
      toast({
        title: "Шаблоны сброшены",
        description: "Все шаблоны восстановлены к базовым значениям"
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка при сбросе шаблонов",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleTemplateSelect = (template: EmailImprovementTemplate) => {
    onTemplateSelect(template);
  };

  const handleAddTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.subject.trim() || !newTemplate.content.trim()) {
      toast({
        title: "Ошибка",
        description: "Все поля должны быть заполнены",
        variant: "destructive"
      });
      return;
    }

    createTemplateMutation.mutate(newTemplate);
  };

  const handleEditTemplate = (template: EmailImprovementTemplate) => {
    setEditingTemplate(template);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;

    if (!editingTemplate.name.trim() || !editingTemplate.subject.trim() || !editingTemplate.content.trim()) {
      toast({
        title: "Ошибка",
        description: "Все поля должны быть заполнены",
        variant: "destructive"
      });
      return;
    }

    updateTemplateMutation.mutate({
      id: editingTemplate.id,
      name: editingTemplate.name.trim(),
      subject: editingTemplate.subject.trim(),
      content: editingTemplate.content.trim(),
      isDefault: editingTemplate.isDefault
    });
  };

  const handleDeleteTemplate = (templateId: number) => {
    if (confirm('Вы уверены, что хотите удалить этот шаблон?')) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  const handleResetToDefaults = () => {
    if (confirm('Вы уверены, что хотите сбросить все шаблоны к базовым значениям? Это действие нельзя отменить.')) {
      resetToDefaultsMutation.mutate();
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTemplate(null);
    setIsDialogOpen(false);
  };

  const handleStartAdd = () => {
    setNewTemplate({ name: "", subject: "", content: "" });
    setIsEditing(false);
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Загрузка шаблонов...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-600">
        <span>Ошибка загрузки шаблонов</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold">Шаблоны</h3>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleStartAdd}>
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {isEditing ? "Редактировать шаблон" : "Добавить шаблон"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Название шаблона</label>
                  <Input
                    value={isEditing ? editingTemplate?.name || "" : newTemplate.name}
                    onChange={(e) => {
                      if (isEditing && editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, name: e.target.value });
                      } else {
                        setNewTemplate({ ...newTemplate, name: e.target.value });
                      }
                    }}
                    placeholder="Введите название шаблона"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Тема письма</label>
                  <Input
                    value={isEditing ? editingTemplate?.subject || "" : newTemplate.subject}
                    onChange={(e) => {
                      if (isEditing && editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, subject: e.target.value });
                      } else {
                        setNewTemplate({ ...newTemplate, subject: e.target.value });
                      }
                    }}
                    placeholder="Введите тему письма"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Текст письма</label>
                  <Textarea
                    value={isEditing ? editingTemplate?.content || "" : newTemplate.content}
                    onChange={(e) => {
                      if (isEditing && editingTemplate) {
                        setEditingTemplate({ ...editingTemplate, content: e.target.value });
                      } else {
                        setNewTemplate({ ...newTemplate, content: e.target.value });
                      }
                    }}
                    rows={8}
                    placeholder="Введите текст письма"
                    className="resize-none"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Отмена
                  </Button>
                  <Button 
                    onClick={isEditing ? handleUpdateTemplate : handleAddTemplate}
                    disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                  >
                    {createTemplateMutation.isPending || updateTemplateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    {isEditing ? "Сохранить" : "Добавить"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleResetToDefaults}
                  variant="outline"
                  size="sm"
                  disabled={resetToDefaultsMutation.isPending}
                  className="h-8 w-8 p-0 bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
                >
                  {resetToDefaultsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p>Сброс шаблонов до базовых значений</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm text-gray-500">Загрузка шаблонов...</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-4">
            <p className="text-sm">Ошибка загрузки шаблонов</p>
            <p className="text-xs">Попробуйте обновить страницу</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates && Array.isArray(templates) && templates.map((template) => (
            <div
              key={template.id}
              className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                selectedTemplate?.id === template.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
              onClick={() => handleTemplateSelect(template)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <h4 className="font-medium text-sm truncate">{template.name}</h4>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{template.subject}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {template.content.substring(0, 100)}...
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTemplate(template);
                    }}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                    disabled={deleteTemplateMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
            {(!templates || !Array.isArray(templates) || templates.length === 0) && (
              <div className="text-center text-gray-500 py-4">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет шаблонов</p>
                <p className="text-xs">Создайте первый шаблон</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}