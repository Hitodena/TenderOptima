import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Trash2, Edit, Loader2, Users, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { MainNavigation } from "@/components/main-navigation";
import { SubscriptionAlerts } from "@/components/subscription-alerts";
import { formatDistanceToNow } from "date-fns";

interface ContactGroup {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  contactCount?: number;
  contactsCount?: number; // Added to handle potential inconsistencies
}

interface ContactGroupCardProps {
  group: ContactGroup;
  onEdit: () => void;
  onDelete: () => void;
}

function ContactGroupCard({ group, onEdit, onDelete }: ContactGroupCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Предотвращаем клик, если кликнули на кнопку
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    
    // Находим кнопку "Просмотр" и кликаем по ней
    const viewButton = e.currentTarget.querySelector('a[href*="/contact-groups/"]') as HTMLAnchorElement;
    if (viewButton) {
      viewButton.click();
    }
  };

  // Format the created date
  const formattedDate = group.createdAt 
    ? formatDistanceToNow(new Date(group.createdAt), { addSuffix: true }) 
    : "Unknown date";

  // Get formatted creation date in the format "MM/DD/YYYY"
  const formattedCreationDate = group.createdAt
    ? new Date(group.createdAt).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      })
    : "Unknown date";

  const contactCount = group.contactCount || group.contactsCount || 0;

  return (
    <div 
      className="overflow-hidden mb-1 hover:shadow-sm transition-all duration-200 cursor-pointer hover:bg-gray-50 rounded-md"
      onClick={handleCardClick}
    >
      <div className="flex items-center justify-between p-3 h-14 relative">
        <div className="flex flex-col gap-1 flex-1">
          <div className="font-medium">
            {group.name}
          </div>
          <div className="text-xs text-gray-400 relative">
            {/* Тонкая линия между названием и датой */}
            <div className="absolute -top-1 left-0 right-0 h-px bg-gray-200"></div>
            <div className="relative z-10 bg-white pr-2 inline-block">
              Дата создания: {formattedCreationDate} • {group.description || "Нет описания"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Кружок с количеством контактов */}
          {contactCount > 0 && (
            <div className="relative">
              <div className="flex items-center justify-center w-8 h-8 border border-gray-300 rounded-full bg-white">
                <span className="text-sm font-semibold text-gray-700">
                  {contactCount}
                </span>
              </div>
            </div>
          )}
          
          <Button
            asChild
            size="sm"
            variant="outline"
            className="bg-white text-primary border-primary hover:bg-white hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <Link href={`/contact-groups/${group.id}`}>Просмотр</Link>
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit className="h-4 w-4" />
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
                <AlertDialogTitle>Удалить группу контактов?</AlertDialogTitle>
                <AlertDialogDescription>
                  Это действие невозможно отменить. Группа контактов и все связанные контакты будут удалены.
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

export default function ContactGroupsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isActiveOrLoading } = useSubscription();

  // Fetch all contact groups with frequent refetching
  const { data: contactGroups, isLoading } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
    queryFn: async () => {
      // apiRequest already returns the parsed JSON data
      const data = await apiRequest<ContactGroup[]>("/api/contact-groups", "GET");
      console.log("Contact groups data:", data); // Log for debugging
      return data;
    },
    // Add shorter staleTime and refetchInterval to ensure data stays fresh
    staleTime: 5000, // Consider data stale after 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds in the background
    refetchOnWindowFocus: true, // Refetch when the window regains focus
  });

  // Filter contact groups based on search query
  const filteredGroups = contactGroups?.filter((group: ContactGroup) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      group.name.toLowerCase().includes(query) ||
      group.description?.toLowerCase().includes(query)
    );
  }) || [];

  // Pagination logic
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedGroups = filteredGroups.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Mutation for creating contact groups
  const createGroupMutation = useMutation({
    mutationFn: async (formData: { name: string; description: string }) => {
      // apiRequest already returns the JSON data for success responses
      return await apiRequest("/api/contact-groups", "POST", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      setCreateDialogOpen(false);
      toast({
        title: "Группа контактов создана",
        description: "Новая группа контактов успешно создана.",
      });
    },
    onError: (error: any) => {
      console.error("Create group error:", error);
      const errorMsg = error?.message || "Неизвестная ошибка";
      toast({
        title: "Ошибка",
        description: `Не удалось создать группу контактов: ${errorMsg}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating contact groups
  const updateGroupMutation = useMutation({
    mutationFn: async (formData: { id: number; name: string; description: string }) => {
      const { id, ...data } = formData;
      const response = await apiRequest(`/api/contact-groups/${id}`, "PUT", {
        name: data.name,
        description: data.description || ""
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      setEditDialogOpen(false);
      setEditingGroup(null);
      toast({
        title: "Группа контактов обновлена",
        description: "Группа контактов успешно обновлена.",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось обновить группу контактов: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting contact groups
  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/contact-groups/${id}/delete`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      toast({
        title: "Группа контактов удалена",
        description: "Группа контактов успешно удалена.",
      });
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось удалить группу контактов: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle form submission for creating a new contact group
  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    if (!name.trim()) {
      toast({
        title: "Необходимо указать название",
        description: "Пожалуйста, введите название для группы контактов.",
        variant: "destructive",
      });
      return;
    }

    createGroupMutation.mutate({ name, description });
  };

  // Handle form submission for updating a contact group
  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGroup) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    if (!name.trim()) {
      toast({
        title: "Необходимо указать название",
        description: "Пожалуйста, введите название для группы контактов.",
        variant: "destructive",
      });
      return;
    }

    updateGroupMutation.mutate({ id: editingGroup.id, name, description });
  };

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
                {/* Header with search and create button */}
                <div className="flex items-center justify-between max-w-full">
                  {/* Left side - Title */}
                  <div className="flex items-center flex-shrink-0">
                    <h2 className="text-lg font-medium text-gray-900">
                      База контактов
                    </h2>
                  </div>

                  {/* Right side - Search and Create Button */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Search bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Поиск групп..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-48 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Create button */}
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Новая группа
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {paginatedGroups && paginatedGroups.length > 0 ? (
                  <div>
                    <div className="grid gap-4">
                      {paginatedGroups.map((group: ContactGroup) => (
                        <ContactGroupCard 
                          key={group.id} 
                          group={group} 
                          onEdit={() => {
                            setEditingGroup(group);
                            setEditDialogOpen(true);
                          }}
                          onDelete={() => deleteGroupMutation.mutate(group.id)}
                        />
                      ))}
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 px-4">
                        <div className="text-sm text-gray-500">
                          Показано {startIndex + 1}-{Math.min(endIndex, filteredGroups.length)} из {filteredGroups.length} групп
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
                    <p className="text-muted-foreground mb-4">
                      {searchQuery.trim() ? 'Группы не найдены' : 'Нет групп контактов'}
                    </p>
                    {!searchQuery.trim() && (
                      <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Создать первую группу
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      {/* Dialog for creating a new contact group */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать новую группу контактов</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название группы *</Label>
                <Input id="name" name="name" placeholder="Введите название группы" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Добавьте описание группы (необязательно)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Отмена
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createGroupMutation.isPending}>
                {createGroupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать группу
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for editing a contact group */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать группу контактов</DialogTitle>
          </DialogHeader>
          {editingGroup && (
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Название группы *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    placeholder="Введите название группы"
                    defaultValue={editingGroup.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Описание</Label>
                  <Textarea
                    id="edit-description"
                    name="description"
                    placeholder="Добавьте описание группы (необязательно)"
                    defaultValue={editingGroup.description}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={() => setEditingGroup(null)}>
                    Отмена
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={updateGroupMutation.isPending}>
                  {updateGroupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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