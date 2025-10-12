import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Users } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { 
  getContactGroups,
  type ContactGroup,
  type ContactItem,
  type ContactInGroup
} from "@/api/contact-groups";

// Version 1: Dialog component for multiple contacts
interface AddToContactGroupProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: any[]; // Поставщики или контакты для добавления
}

export function AddToContactGroupDialog({ isOpen, onClose, contacts }: AddToContactGroupProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupError, setNewGroupError] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAddingToGroup, setIsAddingToGroup] = useState<number | null>(null);
  const { toast } = useToast();

  // Получаем список существующих групп контактов
  const { data: contactGroups = [], refetch: refetchGroups } = useQuery<ContactGroup[]>({
    queryKey: ["contact-groups"],
    queryFn: () => apiRequest('/api/contact-groups', 'GET'),
    enabled: isOpen,
    staleTime: 1000, // Short stale time to ensure fresh data
  });

  // Очищаем ошибку при вводе нового имени группы
  useEffect(() => {
    if (newGroupName) {
      setNewGroupError("");
    }
  }, [newGroupName]);

  // Преобразуем поставщиков в формат контактов
  const contactsToAdd: Partial<ContactItem>[] = contacts.map(supplier => ({
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone || "",
    organization: supplier.organization || supplier.website || ""
  }));

  // Добавление контактов в существующую группу
  const handleAddToGroup = async (groupId: number) => {
    try {
      setIsAddingToGroup(groupId);
      
      // Получаем существующие контакты в группе
      const existingContacts = await apiRequest<ContactInGroup[]>(`/api/contact-groups/${groupId}/contacts`, 'GET');
      
      // Проверка на дубликаты email
      const existingEmails = new Set();
      if (Array.isArray(existingContacts)) {
        existingContacts.forEach(contact => {
          if (contact.email) {
            existingEmails.add(contact.email.toLowerCase().trim());
          }
        });
      }
      
      // Проверяем каждый контакт на дубликаты
      const duplicateEmails: string[] = [];
      const uniqueContacts = contactsToAdd.filter(contact => {
        if (!contact.email) return true; // Контакты без email всегда добавляем
        
        const normalizedEmail = contact.email.toLowerCase().trim();
        const isDuplicate = existingEmails.has(normalizedEmail);
        
        if (isDuplicate) {
          duplicateEmails.push(normalizedEmail);
        }
        
        return !isDuplicate;
      });
      
      if (uniqueContacts.length === 0) {
        toast({
          title: "Контакт с таким емайлом уже есть в группе",
          description: "Все выбранные контакты уже существуют в этой группе.",
          variant: "default",
        });
        setIsAddingToGroup(null);
        return;
      }
      
      // Если некоторые контакты уже существуют, показываем предупреждение
      if (uniqueContacts.length < contactsToAdd.length) {
        toast({
          title: "Внимание",
          description: `Некоторые из выбранных контактов уже есть в группе (${duplicateEmails.slice(0, 2).join(', ')}${duplicateEmails.length > 2 ? '...' : ''}). Будут добавлены только уникальные.`,
          variant: "default",
        });
      }
      
      // Добавляем только уникальные контакты
      const response = await apiRequest(`/api/contact-groups/${groupId}/add-contacts`, 'POST', {
        contacts: uniqueContacts
      });
      
      // Инвалидируем кеш для обновления данных
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contact-groups"] }),
        queryClient.invalidateQueries({ queryKey: [`contact-group-${groupId}`] }),
        queryClient.invalidateQueries({ queryKey: [`contact-group-contacts-${groupId}`] })
      ]);
      
      // Показываем уведомление об успехе
      toast({
        title: "Успешно",
        description: `${uniqueContacts.length} контактов добавлено в группу`,
      });
      
      // Закрываем диалог
      onClose();
    } catch (error) {
      console.error("Ошибка при добавлении контактов в группу:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить контакты в группу. Проверьте соединение.",
        variant: "destructive",
      });
      
      // Повторяем запрос на получение групп
      setTimeout(() => {
        refetchGroups();
        setIsAddingToGroup(null);
      }, 1000);
    }
  };

  // Создание новой группы и добавление в нее контактов
  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      setNewGroupError("Заполните данное поле");
      return;
    }
    
    try {
      setIsCreatingGroup(true);
      
      // Показываем уведомление о начале процесса
      toast({
        title: "Информация",
        description: `Создание группы "${newGroupName}"...`,
        variant: "default",
      });
      
      // Создаем новую группу
      console.log("Создаем группу:", newGroupName.trim());
      const newGroup = await apiRequest<ContactGroup>('/api/contact-groups', 'POST', {
        name: newGroupName.trim(),
        description: "" // Убираем надпись "Группа создана"
      });
      
      // Добавляем контакты в новую группу
      await apiRequest(`/api/contact-groups/${newGroup.id}/add-contacts`, 'POST', {
        contacts: contactsToAdd
      });
      
      // Инвалидируем кеш для обновления данных
      await queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
      
      // Показываем уведомление об успехе
      toast({
        title: "Успешно",
        description: `Создана новая группа "${newGroupName}" с ${contactsToAdd.length} контактами`,
      });
      
      // Закрываем диалог и очищаем форму
      setNewGroupName("");
      setIsCreatingGroup(false);
      onClose();
    } catch (error) {
      console.error("Ошибка при создании новой группы:", error);
      
      // Показываем сообщение об ошибке
      toast({
        title: "Ошибка",
        description: "Не удалось создать группу. Проверьте соединение.",
        variant: "destructive",
      });
      
      // Повторяем запрос на получение групп после паузы
      setTimeout(() => {
        refetchGroups();
        setIsCreatingGroup(false);
      }, 1000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-xl font-semibold mb-4">
          Добавить поставщиков в группу контактов
        </DialogTitle>
        <DialogClose className="absolute right-4 top-4">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
        
        <div className="space-y-4 my-4">
          <div>
            <p className="text-sm mb-2">Выбрано поставщиков: {contacts.length}</p>
          </div>
          
          {/* Создание новой группы */}
          <div>
            <Label htmlFor="new-group-name">Придумайте название группы</Label>
            <div className="flex gap-3 mt-2">
              <Input
                id="new-group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Название новой группы"
                className={newGroupError ? "border-destructive" : ""}
              />
              <Button 
                onClick={handleCreateNewGroup}
                className="flex items-center gap-2 whitespace-nowrap"
                disabled={isCreatingGroup}
              >
                {isCreatingGroup ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-1" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Создать новую группу
                  </>
                )}
              </Button>
            </div>
            {newGroupError && (
              <p className="text-destructive text-sm mt-1">{newGroupError}</p>
            )}
          </div>
          
          {/* Список существующих групп */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Добавить в группу</h3>
            {contactGroups.length > 0 ? (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2">
                {contactGroups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        {group.contactCount || 0} контактов
                      </p>
                    </div>
                    <Button 
                      onClick={() => handleAddToGroup(group.id)}
                      variant="default"
                      className="ml-4"
                      disabled={isAddingToGroup === group.id}
                    >
                      {isAddingToGroup === group.id ? (
                        <div className="flex items-center">
                          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                          <span>Добавление...</span>
                        </div>
                      ) : (
                        "Добавить"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">У вас пока нет групп контактов</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Version 2: Button component for single supplier from response details
interface AddToContactGroupButtonProps {
  supplierId: number;
  supplierName: string;
  supplierEmail: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined;
}

export function AddToContactGroup({ 
  supplierId, 
  supplierName, 
  supplierEmail,
  variant = "default" 
}: AddToContactGroupButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupError, setNewGroupError] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAddingToGroup, setIsAddingToGroup] = useState<number | null>(null);
  const { toast } = useToast();

  // Преобразуем поставщика в формат контакта
  const supplierContact: Partial<ContactItem> = {
    name: supplierName,
    email: supplierEmail,
    organization: ""
  };

  const handleOpenDialog = async () => {
    setIsOpen(true);
    setIsLoading(true);
    
    try {
      // Используем apiRequest для получения групп контактов с авторизацией
      const groups = await apiRequest<ContactGroup[]>('/api/contact-groups', 'GET');
      setContactGroups(groups || []);
    } catch (error) {
      console.error('Ошибка при получении групп контактов:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить группы контактов",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Добавление поставщика в существующую группу
  const handleAddToGroup = async (groupId: number) => {
    try {
      setIsAddingToGroup(groupId);
      
      // Получаем существующие контакты в группе
      const existingContacts = await apiRequest<ContactInGroup[]>('GET', `/api/contact-groups/${groupId}/contacts`);
      
      // Проверка на дубликат email
      const existingEmails = new Set((existingContacts || []).map(contact => 
        contact.email?.toLowerCase() || ''
      ));
      
      if (supplierEmail && existingEmails.has(supplierEmail.toLowerCase())) {
        toast({
          title: "Внимание",
          description: "Поставщик с указанным email уже есть в группе",
          variant: "default",
        });
        setIsAddingToGroup(null);
        return;
      }
      
      // Добавляем поставщика в группу
      await apiRequest<void>('POST', `/api/contact-groups/${groupId}/add-contacts`, {
        contacts: [supplierContact]
      });
      
      // Инвалидируем кеш для обновления данных
      queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
      
      // Показываем уведомление об успехе
      toast({
        title: "Успешно",
        description: `Поставщик ${supplierName} добавлен в группу`,
      });
      
      // Закрываем диалог
      setIsOpen(false);
      setIsAddingToGroup(null);
    } catch (error) {
      console.error("Ошибка при добавлении поставщика в группу:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить поставщика в группу",
        variant: "destructive"
      });
      setIsAddingToGroup(null);
    }
  };

  // Создание новой группы и добавление в нее поставщика
  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      setNewGroupError("Заполните данное поле");
      return;
    }
    
    try {
      setIsCreatingGroup(true);
      
      // Создаем новую группу
      console.log("Создаем группу:", newGroupName.trim());
      const newGroup = await apiRequest<ContactGroup>('POST', '/api/contact-groups', {
        name: newGroupName.trim(),
        description: ""
      });
      
      if (newGroup && newGroup.id) {
        // Добавляем поставщика в новую группу
        await apiRequest<void>('POST', `/api/contact-groups/${newGroup.id}/add-contacts`, {
          contacts: [supplierContact]
        });
        
        // Инвалидируем кеш для обновления данных
        queryClient.invalidateQueries({ queryKey: ["contact-groups"] });
        
        // Показываем уведомление об успехе
        toast({
          title: "Успешно",
          description: `Создана новая группа "${newGroupName}" с поставщиком ${supplierName}`,
        });
        
        // Закрываем диалог и очищаем форму
        setNewGroupName("");
        setIsOpen(false);
      } else {
        throw new Error("Не удалось создать группу");
      }
    } catch (error) {
      console.error("Ошибка при создании новой группы:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать группу контактов",
        variant: "destructive"
      });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <>
      <Button 
        variant={variant || "outline"} 
        onClick={handleOpenDialog}
        className="flex items-center gap-2"
      >
        <Users className="h-4 w-4" />
        Добавить в группу
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-semibold mb-4">
            Добавить поставщика в группу контактов
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          
          <div className="space-y-4 my-4">
            <div>
              <p className="text-sm mb-2">Поставщик: <span className="font-medium">{supplierName}</span></p>
              {supplierEmail && <p className="text-xs text-muted-foreground">{supplierEmail}</p>}
            </div>
            
            {/* Создание новой группы */}
            <div>
              <Label htmlFor="new-group-name">Придумайте название группы</Label>
              <div className="flex gap-3 mt-2">
                <Input
                  id="new-group-name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Название новой группы"
                  className={newGroupError ? "border-destructive" : ""}
                />
                <Button 
                  onClick={handleCreateNewGroup}
                  className="flex items-center gap-2 whitespace-nowrap"
                  disabled={isCreatingGroup}
                >
                  {isCreatingGroup ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-1" />
                      Создание...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Создать группу
                    </>
                  )}
                </Button>
              </div>
              {newGroupError && (
                <p className="text-destructive text-sm mt-1">{newGroupError}</p>
              )}
            </div>
            
            {/* Список существующих групп */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Добавить в группу</h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                  <span className="ml-2">Загрузка групп...</span>
                </div>
              ) : contactGroups.length > 0 ? (
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2">
                  {contactGroups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex-1">
                        <p className="font-medium">{group.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {group.contactCount || 0} контактов
                        </p>
                      </div>
                      <Button 
                        onClick={() => handleAddToGroup(group.id)}
                        variant="default"
                        className="ml-4"
                        disabled={isAddingToGroup === group.id}
                      >
                        {isAddingToGroup === group.id ? (
                          <div className="flex items-center">
                            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                            <span>Добавление...</span>
                          </div>
                        ) : (
                          "Добавить"
                        )}
                      </Button>
                    </div>
                  ))}
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