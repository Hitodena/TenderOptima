import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BusinessCardPreview } from "./business-card-preview";

// Response schema for form validation
const followUpSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

type FollowUpFormValues = z.infer<typeof followUpSchema>;

// Define the component props
interface SupplierFollowUpProps {
  supplierId: number;
  supplierName?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  requestId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  content: string;
  isDefault: boolean;
}

export function SupplierFollowUp({ 
  supplierId, 
  supplierName = "Поставщик",
  supplierEmail = "",
  supplierPhone = "",
  requestId, 
  onSuccess, 
  onCancel 
}: SupplierFollowUpProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch email templates from API
  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ['/api/email-improvement-templates'],
    queryFn: async () => {
      return await apiRequest<EmailTemplate[]>('/api/email-improvement-templates', 'GET');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Debug logging
  console.log('[SupplierFollowUp] Initializing with props:', {
    supplierId,
    supplierIdType: typeof supplierId,
    supplierName,
    supplierEmail,
    requestId,
    requestIdType: typeof requestId
  });

  // Format request reference
  const orderRef = `REQ-${requestId}`;
  
  // Function to add business card to email if available
  const getBusinessCardSignature = () => {
    if (user?.businessCard) {
      console.log("Adding business card to email:", user.businessCard);
      return `\n\n${user.businessCard}`;
    }
    return '';
  };
  
  // Define default form values - will be set by template selection
  const defaultValues: Partial<FollowUpFormValues> = {
    subject: "",
    message: ""
  };

  // Initialize form with validation
  const form = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpSchema),
    defaultValues,
  });

  // Apply template to form
  const applyTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    form.setValue('subject', template.subject);
    form.setValue('message', `${template.content}${getBusinessCardSignature()}`);
  };

  // Update form when templates load - apply default template automatically
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const defaultTemplate = templates.find(t => t.isDefault) || templates[0];
      if (defaultTemplate) {
        console.log('[SupplierFollowUp] Auto-applying default template:', defaultTemplate.name);
        applyTemplate(defaultTemplate);
      }
    }
  }, [templates, selectedTemplate]);

  // Form submission handler
  async function onSubmit(data: FollowUpFormValues) {
    setIsSubmitting(true);
    try {
      // Log submission data for debugging
      console.log('[SupplierFollowUp] Submitting form with data:', {
        supplierId,
        supplierIdType: typeof supplierId,
        requestId,
        subject: data.subject,
        messageLength: data.message.length
      });
      
      // Make API request with authentication
      const response = await apiRequest<{requestSupplierId?: number}>(
        "/api/supplier-follow-up", 
        "POST", 
        {
          supplierId: String(supplierId),
          requestId,
          subject: data.subject,
          message: data.message
        }
      );
      
      console.log('[SupplierFollowUp] Success response:', response);

      // Show success message
      toast({
        title: "Сообщение отправлено",
        description: `Ваше сообщение было отправлено поставщику ${supplierName}`,
      });

      // Execute success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Invalidate queries to refresh message list
      if (response && typeof response === 'object' && 'requestSupplierId' in response) {
        console.log('[SupplierFollowUp] Invalidating messages for requestSupplierId:', response.requestSupplierId);
        queryClient.invalidateQueries({ 
          queryKey: ['/api/request-suppliers', response.requestSupplierId, 'messages'] 
        });
      }
    } catch (error) {
      // Handle errors
      console.error("Ошибка при отправке сообщения:", error);
      toast({
        title: "Ошибка при отправке сообщения",
        description: error instanceof Error ? error.message : "Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте еще раз.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Render the component
  return (
    <div className="border p-4 rounded-md bg-white">
      <h3 className="text-lg font-medium mb-4">Отправить уточнение поставщику {supplierName}</h3>

      <div className="mb-4 text-sm">
        <div><strong>Email:</strong> {supplierEmail}</div>
        {supplierPhone && <div><strong>Телефон:</strong> {supplierPhone}</div>}
      </div>

      {/* Template Selection */}
      {templates.length > 0 && (
        <div className="mb-4 space-y-2">
          <label className="text-sm font-medium">Выберите шаблон:</label>
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                size="sm"
                onClick={() => applyTemplate(template)}
                className="text-xs"
              >
                <FileText className="w-3 h-3 mr-1" />
                {template.name}
                {template.isDefault && (
                  <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded">По умолчанию</span>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    {...field} 
                    rows={10}
                    className="resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Business Card Preview - Hidden for follow-up emails */}
          <BusinessCardPreview hidden={true} />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Отправить
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}