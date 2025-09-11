import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/language-context";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { LoadingBar } from "@/components/loading-bar";
import { apiRequest } from "@/lib/queryClient";

interface SendGroupEmailLinkProps {
  groupId: number;
  groupName: string;
}

export function SendGroupEmailLink({ 
  groupId, 
  groupName
}: SendGroupEmailLinkProps) {
  const { t } = useLanguage();
  const [_, setLocation] = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Получаем количество контактов в группе
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["/api/contact-groups", groupId, "contacts"],
    queryFn: async () => {
      return await apiRequest(`/api/contact-groups/${groupId}/contacts`, "GET");
    },
    staleTime: 30000, // Результат запроса валиден 30 секунд
  });
  
  const contactsCount = Array.isArray(contacts) ? contacts.length : 0;
  
  // Обработчик перехода на страницу отправки запроса с контактами группы
  const handleSendToRequestPage = async () => {
    // Предотвращаем двойные клики
    if (isRedirecting) return;
    
    // Установим состояние редиректа для отображения LoadingBar
    setIsRedirecting(true);
    
    console.log("===== НАЧАЛО ПРОЦЕССА ОТПРАВКИ EMAIL =====");
    console.log(`Нажата кнопка отправки email для группы ${groupId} (${groupName})`);
    
    try {
      // Добавляем небольшую задержку для индикатора загрузки
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Запрашиваем актуальные контакты
      console.log(`Получаем контакты для группы ${groupId}...`);
      await queryClient.invalidateQueries({
        queryKey: ["/api/contact-groups", groupId, "contacts"]
      });
      
      // После инвалидации ждем новые данные
      const freshContacts = await apiRequest(
        `/api/contact-groups/${groupId}/contacts`, 
        "GET"
      );
      const contactCount = Array.isArray(freshContacts) ? freshContacts.length : 0;
      console.log(`Получено ${contactCount} контактов для группы ${groupId}`);
      
      const freshContactsArray = Array.isArray(freshContacts) ? freshContacts : [];
      
      if (freshContactsArray.length === 0) {
        toast({
          title: "Нет контактов",
          description: "В этой группе нет контактов для отправки запроса",
          variant: "destructive"
        });
        setIsRedirecting(false);
        return;
      }
      
      // Успешно получили контакты, сохраняем их в sessionStorage
      // (Подход, который работал в версии bbaa64b3)
      try {
        // Сначала очистим существующие данные
        sessionStorage.removeItem('groupContacts');
        sessionStorage.removeItem('groupId');
        sessionStorage.removeItem('groupName');
        
        // Очистим также данные выбранных поставщиков, чтобы избежать смешивания со старыми
        sessionStorage.removeItem('selectedSuppliers');
        localStorage.removeItem('selectedSuppliers');
        
        // Преобразуем контакты в формат поставщиков для правильной обработки на странице отправки
        const suppliersFromContacts = freshContactsArray.map((contact) => ({
          id: contact.id || Math.floor(Math.random() * 100000),
          name: contact.name || contact.company || 'Поставщик',
          email: contact.email || '',
          phone: contact.phone || null,
          user_id: contact.user_id, // Сохраняем user_id для мультитенантности
          // Дополнительные поля для совместимости с типом Supplier
          website: '',
          categories: [],
          description: '',
          responseRate: null,
          successRate: null,
          keywords: [],
          totalRequests: null,
          successfulMatches: null,
          keywordStrength: null,
          lastResponseTime: null
        }));
        
        // Затем сохраним в формате поставщиков в sessionStorage
        sessionStorage.setItem('groupContacts', JSON.stringify(freshContactsArray));
        sessionStorage.setItem('selectedSuppliers', JSON.stringify(suppliersFromContacts)); // Добавляем готовых поставщиков
        sessionStorage.setItem('groupId', groupId.toString());
        sessionStorage.setItem('groupName', groupName);
        
        console.log(`Данные сохранены в sessionStorage: ${freshContactsArray.length} контактов и ${suppliersFromContacts.length} поставщиков`);
        
        // Дублируем в localStorage как запасной вариант
        localStorage.setItem('groupContacts', JSON.stringify(freshContactsArray));
        localStorage.setItem('selectedSuppliers', JSON.stringify(suppliersFromContacts)); // Та же копия в localStorage
        localStorage.setItem('groupId', groupId.toString());
        localStorage.setItem('groupName', groupName);
        
        console.log("Данные также сохранены в localStorage");
      } catch (storageError) {
        console.error("Ошибка при сохранении в хранилище:", storageError);
        toast({
          title: "Предупреждение",
          description: "Возможны проблемы с локальным хранилищем браузера",
          variant: "destructive"
        });
      }
      
      // Добавляем задержку перед редиректом для анимации
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Добавляем флаг, что это страница выбора поставщиков, а не форма email
      sessionStorage.setItem('showSupplierSelectionView', 'true');
      
      // Редирект на страницу отправки запроса с параметрами
      const redirectUrl = `/send-request?from=group&groupId=${groupId}&showSelection=true&timestamp=${Date.now()}`;
      console.log(`Перенаправление на: ${redirectUrl}`);
      
      // Используем прямое перенаправление для надежности
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("Ошибка при подготовке к отправке запроса:", error);
      
      toast({
        title: "Ошибка загрузки контактов",
        description: "Не удалось загрузить контакты группы. Попробуйте еще раз.",
        variant: "destructive"
      });
      
      setIsRedirecting(false);
    }
  };
  
  return (
    <>
      {/* Индикатор загрузки */}
      <LoadingBar isLoading={isRedirecting} />
      
      <Button 
        variant="default" 
        size="sm" 
        className="flex items-center"
        onClick={handleSendToRequestPage}
        disabled={isRedirecting}
      >
        <Mail className="h-4 w-4 mr-2" />
        
        {isLoading || isRedirecting ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {isRedirecting ? t('redirecting') : t('create_mailing')}
          </>
        ) : (
          <>
            {t('create_mailing')}
            {contactsCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {contactsCount}
              </Badge>
            )}
          </>
        )}
      </Button>
    </>
  );
}