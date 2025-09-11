import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Supplier } from "@shared/schema";
import type { ContactGroup, ContactItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  onContactsLoaded: (suppliers: Supplier[], groupName: string, groupId: number) => void;
}

export function LoadFromContacts({ onContactsLoaded }: Props) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Загрузить группы контактов при открытии диалога
  const handleOpenDialog = async () => {
    setIsDialogOpen(true);
    setIsLoading(true);
    
    try {
      // Используем apiRequest вместо fetch для добавления авторизации
      const groups = await apiRequest<ContactGroup[]>('/api/contact-groups', 'GET');
      
      setContactGroups(groups);
      console.log('Contact groups data:', groups);
    } catch (error) {
      console.error('Ошибка загрузки групп контактов:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить группы контактов',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузить контакты из выбранной группы
  const handleSelectGroup = async (groupId: number, groupName: string) => {
    setIsLoading(true);
    
    try {
      // Используем apiRequest вместо fetch для добавления авторизации
      const contacts = await apiRequest<ContactItem[]>(`/api/contact-groups/${groupId}/contacts`, 'GET');
      
      if (!contacts || contacts.length === 0) {
        toast({
          title: 'Внимание',
          description: 'В выбранной группе нет контактов',
          variant: 'destructive'
        });
        return;
      }
      
      // Преобразуем контакты в формат поставщиков
      const suppliers = convertContactsToSuppliers(contacts);
      
      // Вызываем функцию-обработчик с загруженными поставщиками
      onContactsLoaded(suppliers, groupName, groupId);
      
      toast({
        title: 'Контакты загружены',
        description: `Загружено ${suppliers.length} контактов из группы "${groupName}"`,
      });
      
      // Закрываем диалог
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Ошибка загрузки контактов:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить контакты',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Преобразовать контакты в формат поставщиков
  const convertContactsToSuppliers = (contacts: ContactItem[]): Supplier[] => {
    return contacts.map((contact) => ({
      id: contact.id || Math.floor(Math.random() * 100000),
      name: contact.name || 'Компания',
      email: contact.email || '',
      phone: contact.phone || '',
      website: '',
      categories: [] as string[],
      description: contact.organization || '',
      responseRate: null,
      totalRequests: null,
      successfulMatches: null,
      keywordStrength: null,
      lastResponseTime: null,
      userId: contact.userId || null  // Add userId field required by Supplier type
    }));
  };

  return (
    <>
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={handleOpenDialog}
      >
        <Users className="h-4 w-4" />
        Загрузить из контактов
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Выберите группу контактов</DialogTitle>
            <DialogDescription>
              Выберите группу контактов для загрузки
            </DialogDescription>
          </DialogHeader>

          <div className="pb-4">
            {isLoading ? (
              <div className="text-center py-6">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Загрузка...</p>
              </div>
            ) : contactGroups.length === 0 ? (
              <div className="text-center py-6">
                <p>Нет доступных групп контактов</p>
              </div>
            ) : (
              <div className="border-t overflow-y-auto max-h-[60vh]">
                {contactGroups.map((group) => (
                  <div 
                    key={group.id}
                    className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectGroup(group.id, group.name)}
                  >
                    <div>
                      <div className="font-medium">{group.name}</div>
                      {group.contactCount !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          Контактов: {group.contactCount}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}