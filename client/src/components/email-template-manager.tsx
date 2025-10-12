import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  message: string;
}

interface EmailTemplateManagerProps {
  onTemplateSelect: (template: EmailTemplate) => void;
  selectedTemplate?: EmailTemplate | null;
}

export function EmailTemplateManager({ onTemplateSelect, selectedTemplate }: EmailTemplateManagerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", message: "" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Load templates from localStorage on component mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem('emailTemplates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    } else {
      // Initialize with default templates
      const defaultTemplates: EmailTemplate[] = [
        {
          id: '1',
          name: 'Стандартный запрос',
          subject: 'Предложение об улучшении условий',
          message: `В рамках процедуры закупки предлагаем улучшить условия вашего предложения и предоставить финальную цену.

Просим предоставить улучшенное предложение в течение 3 рабочих дней.

С уважением,
Отдел закупок

! При ответе на наш запрос не изменяйте название письма (Subject), иначе мы не сможем обработать ваш ответ!`
        },
        {
          id: '2',
          name: 'Краткий запрос',
          subject: 'Уточнение условий',
          message: `Добрый день!

Просим уточнить и улучшить условия вашего предложения.

Срок ответа: 2 рабочих дня.

С уважением,
Отдел закупок`
        },
        {
          id: '3',
          name: 'Детальный запрос',
          subject: 'Детализация предложения',
          message: `Уважаемые коллеги!

В рамках конкурентной процедуры закупки просим предоставить детализированное предложение с улучшенными условиями по следующим параметрам:

• Цена - возможность предложить более конкурентные условия
• Сроки поставки - сокращение времени выполнения заказа  
• Условия оплаты - более гибкие варианты расчетов
• Гарантийные обязательства - расширение гарантийного покрытия
• Дополнительные услуги - предложение сопутствующих сервисов

Просим предоставить улучшенное предложение в течение 3 рабочих дней.

С уважением,
Отдел закупок

! При ответе на наш запрос не изменяйте название письма (Subject), иначе мы не сможем обработать ваш ответ!`
        }
      ];
      setTemplates(defaultTemplates);
      localStorage.setItem('emailTemplates', JSON.stringify(defaultTemplates));
    }
  }, []);

  // Save templates to localStorage whenever templates change
  useEffect(() => {
    localStorage.setItem('emailTemplates', JSON.stringify(templates));
  }, [templates]);

  const handleTemplateSelect = (template: EmailTemplate) => {
    onTemplateSelect(template);
  };

  const handleAddTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.subject.trim() || !newTemplate.message.trim()) {
      toast({
        title: "Ошибка",
        description: "Все поля должны быть заполнены",
        variant: "destructive"
      });
      return;
    }

    const template: EmailTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name.trim(),
      subject: newTemplate.subject.trim(),
      message: newTemplate.message.trim()
    };

    setTemplates(prev => [...prev, template]);
    setNewTemplate({ name: "", subject: "", message: "" });
    setIsDialogOpen(false);
    
    toast({
      title: "Шаблон добавлен",
      description: `Шаблон "${template.name}" успешно создан`
    });
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;

    if (!editingTemplate.name.trim() || !editingTemplate.subject.trim() || !editingTemplate.message.trim()) {
      toast({
        title: "Ошибка",
        description: "Все поля должны быть заполнены",
        variant: "destructive"
      });
      return;
    }

    setTemplates(prev => prev.map(t => 
      t.id === editingTemplate.id 
        ? { ...editingTemplate, name: editingTemplate.name.trim(), subject: editingTemplate.subject.trim(), message: editingTemplate.message.trim() }
        : t
    ));
    
    setIsEditing(false);
    setEditingTemplate(null);
    setIsDialogOpen(false);
    
    toast({
      title: "Шаблон обновлен",
      description: `Шаблон "${editingTemplate.name}" успешно обновлен`
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast({
        title: "Шаблон удален",
        description: `Шаблон "${template.name}" удален`
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTemplate(null);
    setIsDialogOpen(false);
  };

  const handleStartAdd = () => {
    setNewTemplate({ name: "", subject: "", message: "" });
    setIsEditing(false);
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold">Шаблоны писем</h3>
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
                  value={isEditing ? editingTemplate?.message || "" : newTemplate.message}
                  onChange={(e) => {
                    if (isEditing && editingTemplate) {
                      setEditingTemplate({ ...editingTemplate, message: e.target.value });
                    } else {
                      setNewTemplate({ ...newTemplate, message: e.target.value });
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
                <Button onClick={isEditing ? handleUpdateTemplate : handleAddTemplate}>
                  {isEditing ? "Сохранить" : "Добавить"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[400px]">
        <div className="space-y-2">
          {templates.map((template) => (
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
                    {template.message.substring(0, 100)}...
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
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
