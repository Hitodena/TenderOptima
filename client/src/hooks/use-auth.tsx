import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type UserData = {
  id: number;
  username: string;
  role: string;
  businessCard?: string;
  logoUrl?: string;
  language?: string;
};

type AuthContextType = {
  user: UserData | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserData, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserData, Error, RegisterData>;
  updateBusinessCardMutation: UseMutationResult<UserData, Error, BusinessCardData>;
  isOnboardingCompleted: boolean;
  onboardingCompletedMutation: UseMutationResult<{ completed: boolean }, Error, void>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  language?: string;
};

type BusinessCardData = {
  businessCard: string;
  logoUrl?: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Константа для времени неактивности - 96 часов
  const INACTIVITY_TIMEOUT = 96 * 60 * 60 * 1000;
  // Ссылка для хранения таймера неактивности
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Query current user
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<UserData | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Query onboarding status
  const { data: onboardingData } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/auth/onboarding"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user, // Only run if user is logged in
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log('Выполняем вход с пользователем:', credentials.username);
      
      try {
        console.log('Вызываем apiRequest для входа...');
        // Используем apiRequest для консистентности
        const userData = await apiRequest<UserData & { accessToken?: string; tokenExpiry?: number }>('/api/auth/login', 'POST', credentials);
        console.log('apiRequest завершен, получены данные:', userData);
        console.log('Тип данных:', typeof userData);
        console.log('Успешный вход, получены данные пользователя:', userData);
        console.log('Проверяем токен в ответе:', {
          hasAccessToken: !!userData.accessToken,
          accessToken: userData.accessToken ? userData.accessToken.substring(0, 20) + '...' : 'НЕТ',
          hasTokenExpiry: !!userData.tokenExpiry,
          tokenExpiry: userData.tokenExpiry
        });
        
        // Сохраняем токен в localStorage, если он доступен
        if (userData.accessToken) {
          localStorage.setItem('accessToken', userData.accessToken);
          localStorage.setItem('tokenExpiry', String(userData.tokenExpiry || (Date.now() + 24*60*60*1000)));
          console.log('Токен доступа сохранен в localStorage');
        } else {
          console.warn('Токен не получен от сервера!');
        }
        
        // Возвращаем данные пользователя без токена
        const { accessToken, tokenExpiry, ...userDataWithoutToken } = userData;
        return userDataWithoutToken as UserData;
      } catch (error) {
        console.error('Ошибка при выполнении входа:', error);
        console.error('Тип ошибки:', typeof error);
        console.error('Стек ошибки:', error.stack);
        throw error;
      }
    },
    onSuccess: (userData: UserData) => {
      console.log('Вход успешен, обновляем кэш запросов');
      queryClient.setQueryData(["/api/auth/me"], userData);
      
      // Инвалидируем все запросы, чтобы они перезагрузились с новыми куками
      queryClient.invalidateQueries();
      
      toast({
        title: "Успешный вход",
        description: `Добро пожаловать, ${userData.username}!`,
      });
    },
    onError: (error: Error) => {
      console.error('Ошибка входа обработана в UI:', error);
      toast({
        title: "Ошибка входа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest<UserData>("/api/auth/register", "POST", credentials);
      return res;
    },
    onSuccess: (userData: UserData) => {
      queryClient.setQueryData(["/api/auth/me"], userData);
      toast({
        title: "Регистрация успешна",
        description: "Ваша учетная запись создана.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Очищаем токен из localStorage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('tokenExpiry');
        console.log('Токен доступа удален из localStorage');
        
        // Также отправляем запрос на сервер, чтобы уничтожить сессию
        await apiRequest("/api/auth/logout", "POST");
      } catch (error) {
        console.error("Ошибка при выходе:", error);
        // Даже если запрос не удался, мы все равно очистим локальное состояние
      }
    },
    onSuccess: () => {
      // Очищаем данные авторизации из кэша
      queryClient.setQueryData(["/api/auth/me"], null);
      // Инвалидируем все запросы, чтобы заставить их перезагрузиться
      queryClient.invalidateQueries();
      
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы.",
      });
    },
    onError: (error: Error) => {
      // Даже при ошибке очищаем локальное состояние
      queryClient.setQueryData(["/api/auth/me"], null);
      
      toast({
        title: "Предупреждение",
        description: "Выход выполнен локально, но могли возникнуть проблемы с сервером: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Update business card mutation
  const updateBusinessCardMutation = useMutation({
    mutationFn: async (data: BusinessCardData) => {
      console.log('[BusinessCard Mutation] === MUTATION FUNCTION CALLED ===');
      console.log('[BusinessCard Mutation] Raw data received:', data);
      console.log('[BusinessCard Mutation] Data type:', typeof data);
      console.log('[BusinessCard Mutation] Data keys:', Object.keys(data || {}));
      console.log('[BusinessCard Mutation] Data stringified:', JSON.stringify(data, null, 2));
      console.log('[BusinessCard Mutation] Sending data to server:', {
        businessCardLength: data.businessCard?.length || 0,
        hasLogoUrl: !!data.logoUrl,
        logoUrlPreview: data.logoUrl?.substring(0, 50) + '...' || 'none'
      });
      const res = await apiRequest<UserData>("/api/auth/business-card", "PUT", data);
      console.log('[BusinessCard Mutation] Server response received:', {
        id: res.id,
        hasBusinessCard: !!res.businessCard,
        hasLogoUrl: !!res.logoUrl
      });
      return res;
    },
    onSuccess: (userData: UserData) => {
      queryClient.setQueryData(["/api/auth/me"], userData);
      queryClient.setQueryData(["/api/auth/onboarding"], { completed: true });
      toast({
        title: "Визитная карточка обновлена",
        description: "Ваша визитная карточка успешно обновлена.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка обновления",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Complete onboarding mutation (if needed separately from business card update)
  const onboardingCompletedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest<{ completed: boolean }>("/api/auth/onboarding/complete", "POST");
      return res;
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/onboarding"], { completed: true });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Функция для сброса таймера неактивности
  const resetInactivityTimer = () => {
    // Очищаем предыдущий таймер, если он был
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Устанавливаем новый таймер, если пользователь авторизован
    if (user) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('[Auth] Автоматический выход из-за неактивности (96 часов)');
        logoutMutation.mutate();
      }, INACTIVITY_TIMEOUT);
    }
  };

  // Эффект для отслеживания активности пользователя
  useEffect(() => {
    if (user) {
      // Пользователь авторизован, запускаем таймер
      console.log('[Auth] Инициализация таймера автоматического выхода');
      resetInactivityTimer();
      
      // Сбрасываем таймер при действиях пользователя
      const resetTimerOnActivity = () => resetInactivityTimer();
      
      // Добавляем слушатели событий на различные действия
      window.addEventListener('click', resetTimerOnActivity);
      window.addEventListener('keypress', resetTimerOnActivity);
      window.addEventListener('scroll', resetTimerOnActivity);
      window.addEventListener('mousemove', resetTimerOnActivity);
      
      return () => {
        // Очищаем таймер и слушатели при размонтировании
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        window.removeEventListener('click', resetTimerOnActivity);
        window.removeEventListener('keypress', resetTimerOnActivity);
        window.removeEventListener('scroll', resetTimerOnActivity);
        window.removeEventListener('mousemove', resetTimerOnActivity);
      };
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        updateBusinessCardMutation,
        isOnboardingCompleted: onboardingData?.completed || false,
        onboardingCompletedMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}