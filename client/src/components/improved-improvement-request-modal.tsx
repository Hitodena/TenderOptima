import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { EmailImprovementTemplateManager } from "./email-improvement-template-manager";
import { BusinessCardPreview } from "./business-card-preview";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface EmailTemplate {
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

interface ImprovedImprovementRequestModalProps {
  supplier: {
    name: string;
    email: string;
  };
  requestId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImprovedImprovementRequestModal({
  supplier,
  requestId,
  isOpen,
  onClose,
  onSuccess
}: ImprovedImprovementRequestModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch templates to auto-apply default template
  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/email-improvement-templates'],
    queryFn: async () => {
      return await apiRequest<EmailTemplate[]>('/api/email-improvement-templates', 'GET');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Auto-apply default template when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const defaultTemplate = templates.find(t => t.isDefault) || templates[0];
      if (defaultTemplate) {
        handleTemplateSelect(defaultTemplate);
      }
    }
  }, [templates, selectedTemplate]);

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setMessage(template.content + (user?.businessCard ? `\n\n${user.businessCard}` : ''));
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Ошибка",
        description: "Тема и сообщение обязательны для заполнения",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest(
        "/api/improvement-request",
        "POST",
        {
          requestId,
          supplierEmail: supplier.email,
          supplierName: supplier.name,
          subject: subject.trim(),
          message: message.trim()
        }
      );

      if (response) {
        toast({
          title: "Запрос отправлен",
          description: `Запрос на улучшение условий отправлен поставщику ${supplier.name}`,
          variant: "default"
        });
        onSuccess();
        onClose();
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending improvement request:', error);
      toast({
        title: "Ошибка отправки",
        description: "Не удалось отправить запрос. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" 
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh',
        position: 'fixed'
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-xl font-semibold">
            Запрос на улучшение условий - {supplier.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left column - Email form */}
          <div className="flex-1 p-6 flex flex-col">
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Email field - compact single line */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Email:
                </label>
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md flex-1">
                  {supplier.email}
                </div>
              </div>

              {/* Subject field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тема
                </label>
                <Input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Message field - increased height for better visibility */}
              <div className="flex-1 flex flex-col min-h-[300px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Сообщение
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 resize-none min-h-[280px]"
                  placeholder="Введите текст сообщения..."
                />
              </div>

              {/* Business Card Preview - Hidden for improvement request emails */}
              <BusinessCardPreview hidden={true} />

              {/* Action buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Отправить запрос
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Right column - Template manager */}
          <div className="w-80 border-l bg-gray-50 p-4 flex flex-col">
            <EmailImprovementTemplateManager
              onTemplateSelect={handleTemplateSelect}
              selectedTemplate={selectedTemplate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
