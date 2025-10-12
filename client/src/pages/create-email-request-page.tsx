import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Layout } from "@/components/layout";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";

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
  name: string;
  email: string;
  phone: string;
  organization: string | null;
  position: string | null;
  createdAt: string;
}

export default function CreateEmailRequestPage() {
  const [, params] = useRoute<{ id: string }>("/contact-groups/:id/create-email");
  const groupId = params ? parseInt(params.id) : 0;
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Fetch group details
  const { data: group, isLoading: isLoadingGroup } = useQuery<ContactGroup>({
    queryKey: ["/api/contact-groups", groupId, "details"],
    queryFn: () => fetch(`/api/contact-groups/${groupId}/details`).then(res => res.json()),
    enabled: groupId > 0,
  });

  // Fetch contacts in the group
  const { data: contacts, isLoading: isLoadingContacts } = useQuery<ContactItem[]>({
    queryKey: ["/api/contact-groups", groupId, "contacts"],
    queryFn: () => fetch(`/api/contact-groups/${groupId}/contacts`).then(res => res.json()),
    enabled: groupId > 0,
  });

  // Mutation for creating email request
  const createEmailRequestMutation = useMutation({
    mutationFn: async (data: { groupId: number; name: string; description?: string }) => {
      setIsSaving(true);
      try {
        const response = await fetch("/api/email-requests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create email request: ${response.statusText}`);
        }
        
        return response.json();
      } finally {
        setIsSaving(false);
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Запрос создан",
        description: "Запрос на отправку e-mail успешно создан.",
      });
      navigate(`/email-requests/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось создать запрос: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Необходимо указать название",
        description: "Пожалуйста, введите название для запроса.",
        variant: "destructive",
      });
      return;
    }
    
    createEmailRequestMutation.mutate({
      groupId,
      name,
      description,
    });
  };

  if (!groupId) {
    return (
      <Layout title="Создание запроса">
        <div className="text-center py-12">
          <h2 className="text-xl font-medium mb-2">Группа не указана</h2>
          <p className="text-muted-foreground mb-4">Необходимо указать группу контактов для создания запроса.</p>
          <Link href="/contact-groups">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" /> К группам контактов
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (isLoadingGroup || isLoadingContacts) {
    return (
      <Layout title="Создание запроса">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout title="Создание запроса">
        <div className="text-center py-12">
          <h2 className="text-xl font-medium mb-2">Группа не найдена</h2>
          <p className="text-muted-foreground mb-4">Группа контактов с ID {groupId} не существует или была удалена.</p>
          <Link href="/contact-groups">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" /> К группам контактов
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const contactCount = contacts?.length || 0;

  return (
    <Layout title="Создание запроса">
      <div className="mb-6">
        <Link href={`/contact-groups/${groupId}`}>
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад к группе
          </Button>
        </Link>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Создаем рассылку по группе контактов {group.name}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-muted/50 p-3 rounded mb-4">
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
                    placeholder="Введите название запроса" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Описание
                  </label>
                  <Textarea 
                    placeholder="Введите описание запроса (необязательно)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="pt-4 flex justify-end">
                  <Link href={`/contact-groups/${groupId}`}>
                    <Button type="button" variant="outline" className="mr-2">
                      Отмена
                    </Button>
                  </Link>
                  <Button 
                    type="submit" 
                    disabled={isSaving}
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Создать и перейти к отправке
                  </Button>
                </div>
              </form>
            </div>
          </div>
          
          <div>
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Информация о группе</h3>
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2"><strong>Название:</strong> {group.name}</p>
                  {group.description && (
                    <p className="mb-2"><strong>Описание:</strong> {group.description}</p>
                  )}
                  <p className="mb-2">
                    <strong>Контактов в группе:</strong> {contactCount}
                  </p>
                  <p>
                    <strong>Создана:</strong> {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}