import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useContactGroups } from "@/hooks/use-contact-groups";
import { Input } from "@/components/ui/input";
import { UserPlus, Plus, Users, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogDescription
} from "@/components/ui/dialog";

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone?: string;
  website?: string;
  organization?: string;
  requestSupplierId?: number; // ID связи между запросом и поставщиком
}

interface AddToGroupButtonProps {
  suppliers: Supplier[];
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AddToGroupButton({
  suppliers,
  disabled = false,
  variant = "default",
  size = "default",
  className = "",
}: AddToGroupButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupError, setNewGroupError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Получаем список существующих групп контактов
  const { data: contactGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/contact-groups"],
    enabled: isDialogOpen,
  });

  // Очищаем ошибку при вводе нового имени группы
  useEffect(() => {
    if (newGroupName) {
      setNewGroupError("");
    }
  }, [newGroupName]);

  // Проверяем валидность выбранных поставщиков
  const validSuppliers = suppliers.filter(s => s.email && s.name);
  
  // Преобразуем поставщиков в формат контактов
  const contactsToAdd = validSuppliers.map(supplier => ({
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone || "",
    organization: supplier.organization || supplier.website || ""
  }));

  // Добавление контактов в существующую группу
  const handleAddToGroup = async (groupId: number) => {
    try {
      setIsLoading(true);
      
      // Получаем существующие контакты в группе
      const existingContacts = await apiRequest(`/api/contact-groups/${groupId}/contacts`, "GET");
      
      // Проверка на дубликаты email
      const existingEmails = new Set();
      
      if (Array.isArray(existingContacts)) {
        existingContacts.forEach((contact: any) => {
          if (contact.email) {
            existingEmails.add(contact.email.toLowerCase().trim());
          }
        });
      } else {
        console.log("Не удалось получить существующие контакты как массив:", existingContacts);
      }
      
      const uniqueContacts = contactsToAdd.filter(contact => 
        !existingEmails.has(contact.email?.toLowerCase() || '')
      );
      
      if (uniqueContacts.length === 0) {
        toast({
          title: "Информация",
          description: "Все выбранные контакты уже есть в группе",
        });
        setIsLoading(false);
        return;
      }
      
      console.log("Добавляем контакты:", uniqueContacts);
      
      // Добавляем только уникальные контакты
      const result = await apiRequest(`/api/contact-groups/${groupId}/add-contacts`, "POST", { 
        contacts: uniqueContacts
      });
      
      console.log("Результат добавления контактов:", result);
      
      // Инвалидируем кеш для обновления данных
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] }),
        queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/contacts`] })
      ]);
      
      // Показываем уведомление об успехе
      toast({
        title: "Успешно",
        description: `${uniqueContacts.length} контактов добавлено в группу`,
      });
      
      // Успешно и без закрытия диалога, чтобы пользователь мог добавить те же контакты в другие группы
      
    } catch (error) {
      console.error("Ошибка при добавлении контактов в группу:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить контакты в группу",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Создание новой группы и добавление в нее контактов
  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      setNewGroupError("Заполните данное поле");
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log("Создаем группу:", newGroupName.trim());
      
      // Создаем новую группу
      const newGroup = await apiRequest<{id: number; name: string}>("/api/contact-groups", "POST", { 
        name: newGroupName.trim(),
        description: "" // Убираем описание "Группа создана"
      });
      
      if (!newGroup || !newGroup.id) {
        console.error("Не удалось создать группу контактов:", newGroup);
        throw new Error("Ошибка создания группы: не получен ID новой группы");
      }
      
      console.log("Создана новая группа:", newGroup);
      
      // Добавляем контакты в новую группу
      if (contactsToAdd.length > 0) {
        console.log(`Добавляем ${contactsToAdd.length} контактов в новую группу ${newGroup.id}`);
        
        try {
          const result = await apiRequest(`/api/contact-groups/${newGroup.id}/add-contacts`, "POST", { 
            contacts: contactsToAdd
          });
          
          console.log("Результат добавления контактов:", result);
          
        } catch (error) {
          console.error("Ошибка при добавлении контактов в новую группу:", error);
          // Группа уже создана, так что покажем предупреждение, но не прерываем операцию
          toast({
            title: "Внимание",
            description: "Группа создана, но возникли проблемы при добавлении контактов",
            variant: "default",
          });
        }
      }
      
      // Инвалидируем кеш для обновления данных
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${newGroup.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${newGroup.id}/contacts`] });
      
      // Показываем уведомление об успехе
      toast({
        title: "Успешно",
        description: `Создана группа "${newGroupName.trim()}" с ${contactsToAdd.length} контактами`,
      });
      
      // Очищаем поле ввода имени, но оставляем диалог открытым
      setNewGroupName("");
    } catch (error) {
      console.error("Ошибка при создании новой группы:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать новую группу",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={disabled || validSuppliers.length === 0}
        onClick={() => setIsDialogOpen(true)}
      >
        <UserPlus className="flex items-center gap-2" />
        
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && setIsDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="text-xl font-semibold mb-2">
            Добавить поставщиков в группу контактов
          </DialogTitle>
          <DialogDescription className="text-sm mb-4">
            Выбрано поставщиков: {validSuppliers.length}
          </DialogDescription>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          
          <div className="space-y-4 my-2">
            {validSuppliers.length === 0 && (
              <p className="text-sm text-destructive">
                Не выбрано ни одного поставщика с действительным email
              </p>
            )}
            
            {/* Создание новой группы */}
            <div className="flex gap-3 items-center">
              <Input
                id="new-group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Придумайте название группы"
                className={`${newGroupError ? "border-destructive" : ""}`}
              />
              <Button 
                onClick={handleCreateNewGroup}
                variant="outline"
                className="flex items-center gap-2 whitespace-nowrap text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                disabled={isLoading}
              >
                <Plus className="h-4 w-4" />
                Создать новую группу
              </Button>
            </div>
            {newGroupError && (
              <p className="text-destructive text-sm -mt-2">{newGroupError}</p>
            )}
            
            {/* Список существующих групп */}
            <div>
              
              {contactGroups.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <div className="max-h-[240px] overflow-y-auto">
                    <table className="w-full">
                      <tbody>
                        {contactGroups.map((group: any) => (
                          <tr key={group.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-2 px-3">
                              <div className="flex flex-row items-center">
                                <div className="flex-1">
                                  <p className="font-medium">{group.name}</p>
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center ml-2 mr-4">
                                  <Users className="h-3 w-3 mr-1" />
                                  {group.contactCount || group.contactsCount || 0} контактов
                                </div>
                                <Button 
                                  onClick={() => handleAddToGroup(group.id)}
                                  variant="default"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  disabled={isLoading}
                                >
                                  <Plus className="h-4 w-4" />
                                  <span className="sr-only">Добавить</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">У вас пока нет групп контактов</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}