import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/components/ui/toast";

type User = {
  id: number;
  username: string;
  role?: string;
  businessCard?: string;
  logoUrl?: string;
  language?: string;
  onboardingCompleted?: boolean;
};

type LoginCredentials = {
  username: string;
  password: string;
};

type RegisterCredentials = {
  username: string;
  password: string;
};

export function useAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading, error, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      console.log('Выполняем вход с пользователем:', credentials.username);
      
      try {
        console.log('Вызываем apiRequest для входа...');
        const userData = await apiRequest<{ accessToken?: string; tokenExpiry?: number }>("/api/auth/login", "POST", credentials);
        console.log('apiRequest завершен, получены данные:', userData);
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
        
        return userData;
      } catch (error) {
        console.error('Ошибка при выполнении входа:', error);
        throw error;
      }
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Успешный вход",
        description: "Вы успешно вошли в систему",
      });
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      toast({
        title: "Ошибка входа",
        description: error.message || "Не удалось войти в систему. Проверьте введенные данные.",
        variant: "destructive",
      });
    }
  });

  const registerMutation = useMutation({
    mutationFn: (credentials: RegisterCredentials) => 
      apiRequest("/api/auth/register", "POST", credentials),
    onSuccess: () => {
      refetch();
      toast({
        title: "Успешная регистрация",
        description: "Вы успешно зарегистрировались в системе",
      });
    },
    onError: (error: any) => {
      console.error("Registration error:", error);
      toast({
        title: "Ошибка регистрации",
        description: error.message || "Не удалось зарегистрироваться. Возможно, пользователь с таким email уже существует.",
        variant: "destructive",
      });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('/api/auth/logout', 'POST'),
    onSuccess: () => {
      // Clear all user-related cached data
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
      
      // Clear any localStorage that might contain user data
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tokenExpiry');
      localStorage.removeItem('rememberMe');
      
      toast({
        title: "Выход выполнен",
        description: "Вы успешно вышли из системы",
      });
      
      // Force immediate redirect to auth page
      window.location.replace('/auth');
    },
    onError: (error) => {
      console.error('Logout error:', error);
      
      // Clear data even on error
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tokenExpiry');
      localStorage.removeItem('rememberMe');
      
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось выйти из системы",
      });
      
      // Force redirect even on error
      window.location.replace('/auth');
    }
  });

  // Business card update mutation
  const updateBusinessCardMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('[BusinessCard] Sending update request:', data);
      
      // Send data directly as JSON instead of FormData
      return apiRequest('/api/auth/business-card', 'PUT', data);
    },
    onSuccess: (response) => {
      console.log('[BusinessCard] Update successful, response:', response);
      
      // Invalidate and refetch user data to get fresh data from database
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      refetch();
      
      toast({
        title: "Успех",
        description: "Визитная карточка обновлена",
      });
    },
    onError: (error) => {
      console.error('Business card update error:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить визитную карточку",
      });
    }
  });

  // Admin privileges removed - админ панель отдельная система
  const isAdmin = false; // Всегда false для основной системы

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin,
    logoutMutation,
    updateBusinessCardMutation,
    refetch,
    loginMutation,
    registerMutation
  };
}