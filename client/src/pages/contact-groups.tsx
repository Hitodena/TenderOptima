import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Trash2, Edit, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";

interface ContactGroup {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  contactCount?: number;
  contactsCount?: number; // Added to handle potential inconsistencies
}

export default function ContactGroupsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isActiveOrLoading } = useSubscription();

  // Fetch all contact groups with frequent refetching
  const { data: contactGroups, isLoading } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
    queryFn: async () => {
      // apiRequest already returns the parsed JSON data
      const data = await apiRequest("/api/contact-groups", "GET");
      console.log("Contact groups data:", data); // Log for debugging
      return data;
    },
    // Add shorter staleTime and refetchInterval to ensure data stays fresh
    staleTime: 5000, // Consider data stale after 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds in the background
    refetchOnWindowFocus: true, // Refetch when the window regains focus
  });

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout title="Группы контактов">
      <SubscriptionGuard isActive={isActiveOrLoading}>
        <div className="flex justify-between items-center mb-6">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Новая группа
          </Button>
        </div>

      {contactGroups && contactGroups.length > 0 ? (
        <div className="space-y-2">
          {contactGroups.map((group) => (
            <Card key={group.id} className="shadow-sm hover:shadow transition-shadow">
              <div className="flex items-center p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{group.name}</div>
                      <p className="text-sm text-muted-foreground truncate">
                        {group.description || "Нет описания"}
                      </p>
                    </div>
                    
                    <div className="flex items-center text-muted-foreground text-sm mr-4">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{group.contactCount || group.contactsCount || 0} контактов</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button asChild size="sm">
                    <Link href={`/contact-groups/${group.id}`}>
                    Просмотр</Link>
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingGroup(group);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
                          onClick={() => deleteGroupMutation.mutate(group.id)}
                        >
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/50 rounded-lg">
          <h3 className="text-xl font-medium mb-2">Нет групп контактов</h3>
          <p className="text-muted-foreground mb-4">Создайте новую группу, чтобы начать организовывать ваши контакты.</p>
          
        </div>
      )}

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
    </Layout>
  );
}