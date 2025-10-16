import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Plus, Trash2, Edit, Loader2, User, Mail, Phone, Building, ChevronRight, Search, ChevronLeft, Info } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailRequestList } from "@/components/email-request-list";
import { CreateEmailRequest } from "@/components/create-email-request";
import { SendGroupEmailLink } from "@/components/send-group-email-link";
import { MainNavigation } from "@/components/main-navigation";
import { SubscriptionAlerts } from "@/components/subscription-alerts";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { useSubscription } from "@/hooks/useSubscription";
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
import { format, formatDistanceToNow } from "date-fns";

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
  website?: string | null;
  organization: string | null;
  position: string | null;
  createdAt: string;
}

interface ContactGroupDetails {
  group: ContactGroup;
  contacts: ContactItem[];
}

interface ContactCardProps {
  contact: ContactItem;
  onEdit: () => void;
  onDelete: () => void;
}

function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  return (
    <div className="overflow-hidden mb-1 hover:shadow-sm transition-all duration-200 rounded-md border">
      <div className="flex items-center justify-between p-3 h-14 relative">
        <div className="flex flex-col gap-1 flex-1">
          <div className="font-medium">
            {contact.name || "Без названия"}
          </div>
          <div className="text-xs text-gray-400 relative">
            {/* Тонкая линия между названием и организацией */}
            <div className="absolute -top-1 left-0 right-0 h-px bg-gray-200"></div>
            {contact.organization && (
              <div className="relative z-10 bg-white pr-2 inline-block">
                {contact.organization}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-center">
          {/* Email */}
          <div className="flex items-center text-sm text-gray-600 min-w-0 flex-1 max-w-xs">
            <Mail className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
            <a href={`mailto:${contact.email}`} className="hover:underline truncate text-left">
              {contact.email}
            </a>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Информация о контакте"
          >
            <Info className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
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
                  onClick={onDelete}
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

export default function ContactGroupDetailsPage() {
  const [, params] = useRoute<{ id: string }>("/contact-groups/:id");
  const groupId = params ? parseInt(params.id) : 0;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isActiveOrLoading } = useSubscription();

  const { data, isLoading, error } = useQuery<ContactGroupDetails>({
    queryKey: ["/api/contact-groups", groupId],
    queryFn: async () => {
      const result = await apiRequest<ContactGroupDetails>(`/api/contact-groups/${groupId}`, "GET");
      console.log("Загрузка данных для группы " + groupId + "...");
      console.log("Загружено контактов для группы " + groupId + ":", result.contacts?.length);
      return result;
    },
    enabled: groupId > 0,
  });

  // Filter contacts based on search query
  const filteredContacts = data?.contacts?.filter((contact: ContactItem) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.organization?.toLowerCase().includes(query)
    );
  }) || [];

  // Pagination logic
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Mutation for creating contact items
  const createContactMutation = useMutation({
    mutationFn: async (formData: {
      groupId: number;
      name: string;
      email: string;
      phone: string;
      website?: string;
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
      website?: string;
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
    const website = formData.get("website") as string;
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
      website: website || undefined,
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
    const website = formData.get("website") as string;
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
      website: website || undefined,
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
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <SubscriptionAlerts />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <SubscriptionAlerts />
        <div className="container mx-auto py-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Группа не найдена</h1>
          <p className="mb-4">Группа контактов с ID {groupId} не существует или была удалена.</p>
          <Link href="/contact-groups">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" /> Назад к группам
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { group, contacts } = data || { group: null, contacts: [] };

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <SubscriptionAlerts />
      <SubscriptionGuard isActive={isActiveOrLoading}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-4">
            {/* Removed title - will be in card header */}
          </div>

          {/* Content with header inside card */}
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader className="pb-4">
                {/* Header with search and actions */}
                <div className="flex items-center justify-between max-w-full">
                  {/* Left side - Breadcrumbs */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {/* Breadcrumbs */}
                    <nav className="flex items-center space-x-1 text-xs text-muted-foreground">
                      <Link href="/contact-groups" className="hover:text-foreground transition-colors">
                        База контактов
                      </Link>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-foreground font-medium">{group?.name}</span>
                    </nav>
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {group?.createdAt && (
                        <span>Создана: {format(new Date(group.createdAt), 'dd.MM.yyyy')}</span>
                      )}
                      {group?.updatedAt && (
                        <span>Обновлена: {format(new Date(group.updatedAt), 'dd.MM.yyyy')}</span>
                      )}
                    </div>
                  </div>

                  {/* Right side - Search and Actions */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Search bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Поиск контактов..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-48 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                        <Plus className="w-4 h-4 mr-2" /> Добавить контакт
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Contacts count */}
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-700">
                      Контакты
                    </h3>
                    <div className="flex items-center justify-center w-6 h-6 border border-gray-300 rounded-full bg-white">
                      <span className="text-xs font-semibold text-gray-700">
                        {filteredContacts.length}
                      </span>
                    </div>
                  </div>
                </div>

                {paginatedContacts && paginatedContacts.length > 0 ? (
                  <div>
                    <div className="grid gap-4">
                      {paginatedContacts.map((contact: ContactItem) => (
                        <ContactCard 
                          key={contact.id} 
                          contact={contact} 
                          onEdit={() => {
                            setEditingContact(contact);
                            setEditDialogOpen(true);
                          }}
                          onDelete={() => deleteContactMutation.mutate(contact.id)}
                        />
                      ))}
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 px-4">
                        <div className="text-sm text-gray-500">
                          Показано {startIndex + 1}-{Math.min(endIndex, filteredContacts.length)} из {filteredContacts.length} контактов
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Предыдущая
                          </Button>
                          
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                              
                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1"
                          >
                            Следующая
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <User className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {searchQuery.trim() ? 'Контакты не найдены' : 'В этой группе пока нет контактов'}
                    </p>
                    {!searchQuery.trim() && (
                      <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Добавить первый контакт
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
                <Label htmlFor="website">Веб-сайт</Label>
                <Input id="website" name="website" placeholder="https://example.com" />
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
            <DialogTitle>Информация о контакте</DialogTitle>
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
                    defaultValue={editingContact?.name || ""}
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
                    defaultValue={editingContact?.email || ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Телефоны</Label>
                  <Input
                    id="edit-phone"
                    name="phone"
                    placeholder=""
                    defaultValue={editingContact?.phone || ""}
                  />
                  <p className="text-xs text-muted-foreground">Несколько телефонов вводите через запятую</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-website">Веб-сайт</Label>
                  <Input
                    id="edit-website"
                    name="website"
                    placeholder="https://example.com"
                    defaultValue={editingContact.website || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-organization">Описание</Label>
                  <Input
                    id="edit-organization"
                    name="organization"
                    placeholder="Дополнительная информация"
                    defaultValue={editingContact?.organization || ""}
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
                  Сохранить изменения
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
        </Dialog>
      </SubscriptionGuard>
    </div>
  );
}