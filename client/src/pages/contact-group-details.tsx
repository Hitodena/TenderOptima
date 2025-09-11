import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Plus, Trash2, Edit, Loader2, User, Mail, Phone, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailRequestList } from "@/components/email-request-list";
import { CreateEmailRequest } from "@/components/create-email-request";
import { SendGroupEmailLink } from "@/components/send-group-email-link";
import { Layout } from "@/components/layout";
import { SupplierSelector } from "@/components/supplier-selector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";

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

interface ContactGroupDetails {
  group: ContactGroup;
  contacts: ContactItem[];
}

export default function ContactGroupDetailsPage() {
  const [, params] = useRoute<{ id: string }>("/contact-groups/:id");
  const groupId = params ? parseInt(params.id) : 0;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ContactGroupDetails>({
    queryKey: ["/api/contact-groups", groupId],
    queryFn: async () => {
      const result = await apiRequest(`/api/contact-groups/${groupId}`, "GET") as ContactGroupDetails;
      console.log("Загрузка данных для группы " + groupId + "...");
      console.log("Загружено контактов для группы " + groupId + ":", result.contacts?.length);
      return result;
    },
    enabled: groupId > 0,
  });

  // Mutation for creating contact items
  const createContactMutation = useMutation({
    mutationFn: async (formData: {
      groupId: number;
      name: string;
      email: string;
      phone: string;
      organization?: string;
    }) => {
      return await apiRequest("/api/contact-items", "POST", formData) as ContactItem;
    },
    onSuccess: () => {
      // Update both the current contact group detail and the contact groups list
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      setCreateDialogOpen(false);
      toast({
        title: "Контакт добавлен",
        description: "Новый контакт успешно добавлен в группу.",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось добавить контакт: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating contact items
  const updateContactMutation = useMutation({
    mutationFn: async (formData: {
      id: number;
      name: string;
      email: string;
      phone: string;
      organization?: string;
    }) => {
      const { id, ...data } = formData;
      const response = await apiRequest(`/api/contact-items/${id}`, "PUT", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", groupId] });
      setEditDialogOpen(false);
      setEditingContact(null);
      toast({
        title: "Контакт обновлен",
        description: "Контакт успешно обновлен.",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось обновить контакт: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting contact items
  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/contact-items/${id}`, "DELETE");
    },
    onSuccess: () => {
      // Выполняем запрос, чтобы обновить все связанные данные
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", groupId] });
      // Инвалидируем список групп, так как счетчик контактов может измениться
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      // Инвалидируем список контактов для конкретной группы
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/contacts`] });
      toast({
        title: "Контакт удален",
        description: "Контакт успешно удален из группы.",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось удалить контакт: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission for creating a new contact
  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const organization = formData.get("organization") as string;

    if (!name.trim() || !email.trim()) {
      toast({
        title: "Необходимо заполнить обязательные поля",
        description: "Пожалуйста, укажите название компании и email контакта.",
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
    });
  };

  // Handle form submission for updating a contact
  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingContact) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const organization = formData.get("organization") as string;

    if (!name.trim() || !email.trim()) {
      toast({
        title: "Необходимо заполнить обязательные поля",
        description: "Пожалуйста, укажите название компании и email контакта.",
        variant: "destructive",
      });
      return;
    }

    updateContactMutation.mutate({
      id: editingContact.id,
      name,
      email,
      phone,
      organization: organization || undefined,
    });
  };

  if (!groupId) {
    return (
      <div className="container mx-auto py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Ошибка: Группа не найдена</h1>
        <Link href="/contact-groups">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад к группам
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Группа не найдена</h1>
        <p className="mb-4">Группа контактов с ID {groupId} не существует или была удалена.</p>
        <Link href="/contact-groups">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад к группам
          </Button>
        </Link>
      </div>
    );
  }

  const { group, contacts } = data || { group: null, contacts: [] };

  return (
    <Layout title="Группа"> <h1 className="text-3xl font-bold">{group?.name}</h1>
      {group?.description && <p className="text-muted-foreground mt-1">{group.description}</p>}
Контакты ({contacts?.length || 0})
     
      

      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          
          <div className="flex space-x-2">
            <Link href="/contact-groups">
              <Button variant="outline" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" /> Назад к группам  
              </Button>
            </Link>

            <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Добавить контакт
            </Button>
             
            
            <Button className="w-4 h-4 mr-2 hidden">
             <div>
                            {group && <SendGroupEmailLink groupId={group.id} groupName={group.name} />}
                          </div>
            </Button>

          </div>
        </div>

        {contacts && contacts.length > 0 ? (
          <div className="divide-y border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 py-3 px-4 font-medium text-muted-foreground text-sm bg-muted/10">
              <div className="col-span-4">Компания / Описание</div>
              <div className="col-span-5">Email</div>
              <div className="col-span-3 text-right">Действия</div>
            </div>
            {contacts.map((contact) => (
              <div key={contact.id} className="grid grid-cols-12 py-3 px-4 items-center hover:bg-muted/20">
                <div className="col-span-4">
                  <div className="font-medium">{contact.name || "Без названия"}</div>
                  {contact.organization && (
                    <div className="text-xs text-muted-foreground">{contact.organization}</div>
                  )}
                </div>
                <div className="col-span-5 flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <a href={`mailto:${contact.email}`} className="text-sm hover:underline truncate">
                    {contact.email}
                  </a>
                </div>
                <div className="col-span-3 flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingContact(contact);
                      setEditDialogOpen(true);
                    }}
                    className="h-8 w-8"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить контакт</AlertDialogTitle>
                        <AlertDialogDescription>
                          Вы уверены, что хотите удалить контакт "{contact.name}"? Это действие невозможно отменить.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteContactMutation.mutate(contact.id)}
                        >
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/50 rounded-lg">
            <User className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
           
            <p className="text-muted-foreground mb-6">В этой группе пока нет контактов.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-2">
               
              
            </div>
          </div>
        )}
      </div>

      {/* Email Request List */}
      {group && <EmailRequestList groupId={groupId} groupName={group.name} />}

     
      

      {/* Dialog for creating a new contact */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить новый контакт</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Компания *</Label>
                <Input id="name" name="name" placeholder="Название компании" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" placeholder="email@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефоны</Label>
                <Input id="phone" name="phone" placeholder="+7 (999) 123-45-67, +7 (999) 765-43-21" />
                <p className="text-xs text-muted-foreground">Несколько телефонов вводите через запятую</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization">Описание</Label>
                <Input id="organization" name="organization" placeholder="Дополнительная информация" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Отмена
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createContactMutation.isPending}>
                {createContactMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Добавить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for editing a contact */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать контакт</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Компания *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    placeholder="Название компании"
                    defaultValue={editingContact.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    defaultValue={editingContact.email}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Телефоны</Label>
                  <Input
                    id="edit-phone"
                    name="phone"
                    placeholder=""
                    defaultValue={editingContact.phone}
                  />
                  <p className="text-xs text-muted-foreground">Несколько телефонов вводите через запятую</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-organization">Описание</Label>
                  <Input
                    id="edit-organization"
                    name="organization"
                    placeholder="Дополнительная информация"
                    defaultValue={editingContact.organization || ""}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={() => setEditingContact(null)}>
                    Отмена
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={updateContactMutation.isPending}>
                  {updateContactMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}