import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/queryClient";

interface ContactGroup {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  contactCount?: number;
}

interface ContactItem {
  id: number;
  groupId: number;
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  position?: string | null;
  createdAt: string;
}

export function useContactGroups() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Загрузка групп контактов
  const {
    data: contactGroups,
    isLoading,
    error
  } = useQuery<ContactGroup[]>({
    queryKey: ["/api/contact-groups"],
    queryFn: async () => {
      try {
        // Используем apiRequest, который добавляет токен авторизации
        const data = await apiRequest("/api/contact-groups", "GET");
        return data;
      } catch (error) {
        console.error("Error fetching contact groups:", error);
        throw new Error("Не удалось загрузить группы контактов");
      }
    },
    staleTime: 30000 // 30 секунд
  });

  // Получение контактов конкретной группы
  const getContactsForGroup = (groupId: number) => {
    return useQuery<ContactItem[]>({
      queryKey: ["/api/contact-groups", groupId, "contacts"],
      queryFn: async () => {
        try {
          // Используем apiRequest с токеном авторизации
          const data = await apiRequest(`/api/contact-groups/${groupId}/contacts`, "GET");
          return data;
        } catch (error) {
          console.error(`Error fetching contacts for group ${groupId}:`, error);
          throw new Error(`Не удалось загрузить контакты для группы ${groupId}`);
        }
      },
      staleTime: 30000
    });
  };

  // Добавление контакта в группу
  const addContactToGroup = useMutation({
    mutationFn: async ({
      groupId,
      contact
    }: {
      groupId: number;
      contact: {
        name: string;
        email: string;
        phone?: string;
        organization?: string;
        position?: string;
      };
    }) => {
      return apiRequest("/api/contact-items", "POST", {
        groupId,
        ...contact
      });
    },
    onSuccess: (response: any, variables) => {
      // Инвалидируем кеш для конкретной группы и общий список групп
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", variables.groupId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      
      // Проверяем, был ли это дубликат
      if (response && response.duplicate) {
        toast({
          title: "Контакт уже существует",
          description: `Контакт с таким емайлом уже есть в группе`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Контакт добавлен",
          description: `Контакт успешно добавлен в группу`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: `Не удалось добавить контакт: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
        variant: "destructive",
      });
    }
  });

  // Добавление поставщика в группу контактов
  const addSupplierToGroup = useMutation({
    mutationFn: async ({
      groupId,
      requestSupplierId,
      supplierData
    }: {
      groupId: number;
      requestSupplierId: number;
      supplierData: {
        name: string;
        email: string;
        phone?: string;
      };
    }) => {
      // Результат мутации
      type MutationResult = {
        success: boolean;
        duplicate?: boolean;
        email?: string;
        contactId?: number | null;
      };

      try {
        // Сначала добавляем поставщика как контакт в группу
        const response = await apiRequest("/api/contact-items", "POST", {
          groupId,
          name: supplierData.name,
          email: supplierData.email,
          phone: supplierData.phone || null,
          organization: "",
          position: ""
        });

        // Проверяем, что ответ не является HTML страницей
        if (response !== null && response !== undefined) {
          const responseStr = String(response);
          if (responseStr.indexOf('<!DOCTYPE html>') !== -1) {
            console.error('Получен HTML вместо JSON:', responseStr.slice(0, 100));
            throw new Error('Сервер вернул HTML вместо JSON. Возможно, произошла ошибка аутентификации.');
          }
        }
        
        // Проверяем, есть ли в ответе информация о дубликате
        const data = response as any;
        if (data && data.duplicate) {
          console.log(`Контакт с email ${supplierData.email} уже существует в группе ${groupId}`);
          return {
            success: true,
            duplicate: true,
            email: supplierData.email
          } as MutationResult;
        }

        // Получаем ID созданного контакта
        const contactId = data && data.id ? data.id : null;

        // Создаем связь с группой контактов
        await apiRequest("/api/supplier-contact-groups", "POST", {
          contactGroupId: groupId,
          requestSupplierId
        });

        return {
          success: true,
          duplicate: false,
          contactId
        } as MutationResult;
      } catch (err: any) {
        if (err.status === 409 || (err.response && err.response.status === 409)) {
          return {
            success: true,
            duplicate: true,
            email: supplierData.email
          } as MutationResult;
        }
        throw err;
      }
    },
    onSuccess: (result: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", variables.groupId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      
      if (result && result.duplicate) {
        toast({
          title: "Контакт уже существует",
          description: `Контакт с таким емайлом уже есть в группе`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Поставщик добавлен в группу",
          description: `Поставщик успешно добавлен в группу контактов`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: `Не удалось добавить поставщика в группу: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
        variant: "destructive",
      });
    }
  });

  // Удаление контакта из группы
  const removeContactFromGroup = useMutation({
    mutationFn: async (contactId: number) => {
      return apiRequest(`/api/contact-items/${contactId}`, "DELETE");
    },
    onSuccess: (_, contactId, context) => {
      // Обновляем все запросы на получение групп контактов
      queryClient.invalidateQueries({ queryKey: ["/api/contact-groups"] });
      
      // Если мы знаем groupId, можем обновить только его
      const groupId = context as unknown as number;
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: ["/api/contact-groups", groupId, "contacts"] });
      }
      
      toast({
        title: "Контакт удален",
        description: "Контакт успешно удален из группы",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: `Не удалось удалить контакт: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
        variant: "destructive",
      });
    }
  });

  return {
    contactGroups,
    isLoading,
    error,
    getContactsForGroup,
    addContactToGroup,
    addSupplierToGroup,
    removeContactFromGroup
  };
}