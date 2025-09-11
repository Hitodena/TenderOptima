import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, Send, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { queryClient } from "@/lib/queryClient";

interface ContactGroup {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactItem {
  id: number;
  groupId: number;
  email: string;
  name: string;
  phone: string;
  organization: string | null;
  createdAt: string;
}

interface SendGroupEmailProps {
  groupId: number;
  groupName: string;
  requestId?: number | null;
  embedded?: boolean;
  triggerButton?: React.ReactNode;
  selectedContactIds?: number[]; // Added prop for selected contact IDs
}

export function SendGroupEmail({ 
  groupId, 
  groupName, 
  requestId = null,
  embedded = false,
  triggerButton,
  selectedContactIds = [] // Default to empty array
}: SendGroupEmailProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  // Fetch contacts in this group
  const { data: contacts, isLoading } = useQuery<ContactItem[]>({
    queryKey: ["/api/contact-groups", groupId, "contacts"],
    queryFn: () => fetch(`/api/contact-groups/${groupId}/contacts`).then(res => res.json()),
    enabled: open,
  });

  // Mutation for updating email request status
  const updateEmailRequestStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/email-requests/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update email request status: ${response.statusText}`);
      }

      return response.json();
    },
    onError: (error) => {
      console.error("Failed to update email request status:", error);
    }
  });

  // Mutation for sending email
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { groupId: number; subject: string; message: string; contactIds: number[]; requestId?: number | null }) => {
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
      setShowSuccessMessage(true);
      setEmailSent(true);

      // Update the email request status to "sent" if we have a requestId
      if (requestId) {
        updateEmailRequestStatusMutation.mutate({ 
          id: requestId, 
          status: "sent" 
        });
      }
      
      // Обновить кэш после создания новой карточки запроса
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", groupId, "email-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-requests"] });
      
      // Обрабатываем случай, когда был создан новый email request на сервере
      if (data.emailRequest) {
        console.log("Новый email request создан:", data.emailRequest);
        queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/email-requests`] });
        if (data.emailRequest.id) {
          queryClient.invalidateQueries({ queryKey: ["/api/email-requests", data.emailRequest.id] });
        }
      }
      
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ["/api/email-requests", requestId] });
        queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/email-requests`] });
      }
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось отправить письмо: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = () => {
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
        title: "No contacts selected",
        description: "Please select at least one contact to send the email",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate({ 
      groupId, 
      subject, 
      message,
      contactIds: selectedContactIds,
      requestId 
    });
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setShowSuccessMessage(false);
    setSubject("");
    setMessage("");
  };

  const renderDialogContent = () => {
    if (showSuccessMessage) {
      return (
        <div className="flex flex-col items-center py-6 text-center">
          <div className="bg-green-100 rounded-full p-3 mb-4">
            <Send className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Сообщение отправлено</h2>
          <p className="text-muted-foreground mb-6">
            Ваше сообщение было успешно отправлено всем контактам в группе.
          </p>
          <Button onClick={handleCloseDialog}>Закрыть</Button>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    const contactCount = contacts?.length || 0;

    return (
      <>
        <DialogHeader>
          <DialogTitle>Создаем рассылку по группе контактов {groupName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 p-3 rounded">
            <p className="text-sm flex items-center">
              <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
              Получатели: {contactCount} контактов
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Название запроса <span className="text-red-500">*</span>
            </label>
            <Input 
              placeholder="Введите тему письма" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Сообщение <span className="text-red-500">*</span>
            </label>
            <textarea 
              className="w-full rounded-md border border-input min-h-[120px] p-3 resize-none"
              placeholder="Введите текст сообщения..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Отмена
            </Button>
          </DialogClose>
          <Button 
            onClick={handleSendEmail} 
            disabled={isSending || emailSent}
            variant={emailSent ? "outline" : "default"}
          >
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {emailSent ? "Отправлено" : "Отправить"}
          </Button>
        </DialogFooter>
      </>
    );
  };

  // Initialize the dialog to be open if it's in embedded mode
  useEffect(() => {
    if (embedded) {
      setOpen(true);
    }
  }, [embedded]);

  // In embedded mode, just render the dialog content directly
  if (embedded) {
    return renderDialogContent();
  }

  // In standalone mode, render the button and dialog
  return (
    <>
      {triggerButton ? (
        <div onClick={() => setOpen(true)}>
          {triggerButton}
        </div>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center"
          onClick={() => setOpen(true)}
        >
          <Mail className="h-4 w-4 mr-2" />
          Отправить e-mail
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {renderDialogContent()}
        </DialogContent>
      </Dialog>
    </>
  );
}