import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
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
  preferredMode?: string;
  onboardingCompleted?: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AuthContextType = {
  user: UserData | null;
  isLoading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  loginMutation: UseMutationResult<UserData, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserData, Error, RegisterData>;
  updateBusinessCardMutation: UseMutationResult<UserData, Error, BusinessCardData>;
  forgotPasswordMutation: UseMutationResult<{ message: string }, Error, ForgotPasswordData>;
  resetPasswordMutation: UseMutationResult<{ message: string }, Error, ResetPasswordData>;
  isOnboardingCompleted: boolean;
  onboardingCompletedMutation: UseMutationResult<{ completed: boolean }, Error, void>;
  // Enhanced features
  loginAttempts: number;
  isBlocked: boolean;
  blockTimeRemaining: number;
  lastLoginAttempt: Date | null;
  securityAlerts: SecurityAlert[];
  clearSecurityAlerts: () => void;
};

type LoginData = {
  username: string;
  password: string;
  rememberMe?: boolean;
};

type RegisterData = {
  username: string;
  password: string;
  language?: string;
  acceptTerms?: boolean;
};

type BusinessCardData = {
  businessCard: string;
  logoUrl?: string;
};

type ForgotPasswordData = {
  username: string;
};

type ResetPasswordData = {
  token: string;
  password: string;
  confirmPassword: string;
};

type SecurityAlert = {
  id: string;
  type: 'failed_login' | 'suspicious_activity' | 'ip_blocked' | 'rate_limit';
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  dismissed: boolean;
};

export const EnhancedAuthContext = createContext<AuthContextType | null>(null);

export function EnhancedAuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  const [lastLoginAttempt, setLastLoginAttempt] = useState<Date | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const blockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced user query with better error handling
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user"],
    queryFn: getQueryFn<UserData>("/api/auth/me"),
    retry: (failureCount, error: any) => {
      // Don't retry on 401 (unauthorized) errors
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Enhanced login mutation with security features
  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await apiRequest("/api/auth/login", "POST", data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка входа в систему");
      }
      
      const userData = await response.json();
      
      // Store access token if provided
      if (userData.accessToken) {
        localStorage.setItem('accessToken', userData.accessToken);
        localStorage.setItem('tokenExpiry', userData.tokenExpiry?.toString() || '');
      }
      
      // Store remember me preference
      if (data.rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }
      
      return userData;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data);
      setLoginAttempts(0);
      setIsBlocked(false);
      setBlockTimeRemaining(0);
      setLastLoginAttempt(new Date());
      
      toast({
        title: "Добро пожаловать!",
        description: `Привет, ${data.username}! Вы успешно вошли в систему.`,
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Login error:', error);
      
      // Increment failed attempts
      setLoginAttempts(prev => prev + 1);
      setLastLoginAttempt(new Date());
      
      // Add security alert
      addSecurityAlert({
        type: 'failed_login',
        message: `Неудачная попытка входа: ${error.message}`,
        severity: 'medium',
      });
      
      // Block after 5 failed attempts
      if (loginAttempts >= 4) {
        setIsBlocked(true);
        setBlockTimeRemaining(300); // 5 minutes
        addSecurityAlert({
          type: 'ip_blocked',
          message: 'IP адрес заблокирован из-за множественных неудачных попыток входа',
          severity: 'critical',
        });
        
        // Start block timer
        if (blockTimerRef.current) {
          clearInterval(blockTimerRef.current);
        }
        blockTimerRef.current = setInterval(() => {
          setBlockTimeRemaining(prev => {
            if (prev <= 1) {
              setIsBlocked(false);
              setLoginAttempts(0);
              if (blockTimerRef.current) {
                clearInterval(blockTimerRef.current);
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      
      // Show specific error messages
      let errorMessage = "Произошла ошибка при входе";
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMessage = "Неверный email или пароль";
      } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        errorMessage = "Слишком много попыток входа. Попробуйте позже";
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        errorMessage = "Ваш IP адрес заблокирован";
      } else if (error.message.includes('Network')) {
        errorMessage = "Ошибка сети. Проверьте подключение к интернету";
      }
      
      toast({
        title: "Ошибка входа",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Enhanced register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await apiRequest("/api/auth/register", "POST", data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка регистрации");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data);
      
      toast({
        title: "Регистрация успешна!",
        description: "Добро пожаловать в TenderOptima! Ваш аккаунт создан.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Registration error:', error);
      
      let errorMessage = "Произошла ошибка при регистрации";
      if (error.message.includes('409') || error.message.includes('Conflict')) {
        errorMessage = "Пользователь с таким email уже существует";
      } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
        errorMessage = "Проверьте правильность введенных данных";
      } else if (error.message.includes('Network')) {
        errorMessage = "Ошибка сети. Проверьте подключение к интернету";
      }
      
      toast({
        title: "Ошибка регистрации",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Enhanced logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/auth/logout", "POST");
      
      if (!response.ok) {
        throw new Error("Ошибка выхода из системы");
      }
      
      // Clear local storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tokenExpiry');
      localStorage.removeItem('rememberMe');
      
      return;
    },
    onSuccess: () => {
      queryClient.setQueryData(["user"], null);
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      
      toast({
        title: "До свидания!",
        description: "Вы успешно вышли из системы",
        variant: "default",
      });
      
      // Force immediate redirect to auth page
      window.location.replace('/auth');
    },
    onError: (error: any) => {
      console.error('Logout error:', error);
      
      // Even if logout fails on server, clear local data
      queryClient.setQueryData(["user"], null);
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tokenExpiry');
      localStorage.removeItem('rememberMe');
      
      toast({
        title: "Выход выполнен",
        description: "Вы вышли из системы (возможны проблемы с сервером)",
        variant: "default",
      });
      
      // Force redirect even on error
      window.location.replace('/auth');
    },
  });

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      const response = await apiRequest("/api/auth/forgot-password", "POST", data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка отправки запроса на восстановление пароля");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Инструкции отправлены",
        description: data.message || "Проверьте вашу почту для получения ссылки сброса пароля",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Forgot password error:', error);
      
      let errorMessage = "Не удалось отправить запрос на восстановление пароля";
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        errorMessage = "Пользователь с таким email не найден";
      } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        errorMessage = "Слишком много запросов. Попробуйте позже";
      } else if (error.message.includes('Network')) {
        errorMessage = "Ошибка сети. Проверьте подключение к интернету";
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const response = await apiRequest("/api/auth/reset-password", "POST", data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка сброса пароля");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Пароль изменен",
        description: data.message || "Ваш пароль успешно изменен. Теперь вы можете войти в систему",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Reset password error:', error);
      
      let errorMessage = "Не удалось сбросить пароль";
      if (error.message.includes('400') || error.message.includes('Bad Request')) {
        errorMessage = "Неверный токен сброса пароля или пароль не соответствует требованиям";
      } else if (error.message.includes('410') || error.message.includes('Gone')) {
        errorMessage = "Токен сброса пароля истек. Запросите новый";
      } else if (error.message.includes('Network')) {
        errorMessage = "Ошибка сети. Проверьте подключение к интернету";
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update business card mutation
  const updateBusinessCardMutation = useMutation({
    mutationFn: async (data: BusinessCardData) => {
      const response = await apiRequest("/api/auth/business-card", "POST", data);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка обновления визитки");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], data);
      
      toast({
        title: "Визитка обновлена",
        description: "Информация о вашей компании успешно сохранена",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Business card update error:', error);
      
      toast({
        title: "Ошибка обновления",
        description: error.message || "Не удалось обновить визитку",
        variant: "destructive",
      });
    },
  });

  // Onboarding completed mutation
  const onboardingCompletedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/auth/onboarding", "POST");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка завершения онбординга");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user"], (old: UserData | null) => 
        old ? { ...old, onboardingCompleted: data.completed } : null
      );
      
      toast({
        title: "Онбординг завершен",
        description: "Добро пожаловать в TenderOptima!",
        variant: "default",
      });
    },
    onError: (error: any) => {
      console.error('Onboarding completion error:', error);
      
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось завершить онбординг",
        variant: "destructive",
      });
    },
  });

  // Helper function to add security alerts
  const addSecurityAlert = (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'dismissed'>) => {
    const newAlert: SecurityAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      dismissed: false,
    };
    
    setSecurityAlerts(prev => [newAlert, ...prev.slice(0, 9)]); // Keep only last 10 alerts
  };

  // Clear security alerts
  const clearSecurityAlerts = () => {
    setSecurityAlerts([]);
  };

  // Check if onboarding is completed
  const isOnboardingCompleted = user?.onboardingCompleted ?? false;

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blockTimerRef.current) {
        clearInterval(blockTimerRef.current);
      }
    };
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    error,
    isAuthenticated,
    loginMutation,
    logoutMutation,
    registerMutation,
    updateBusinessCardMutation,
    forgotPasswordMutation,
    resetPasswordMutation,
    isOnboardingCompleted,
    onboardingCompletedMutation,
    // Enhanced features
    loginAttempts,
    isBlocked,
    blockTimeRemaining,
    lastLoginAttempt,
    securityAlerts,
    clearSecurityAlerts,
  };

  return (
    <EnhancedAuthContext.Provider value={value}>
      {children}
    </EnhancedAuthContext.Provider>
  );
}

export function useEnhancedAuth() {
  const context = useContext(EnhancedAuthContext);
  if (!context) {
    throw new Error("useEnhancedAuth must be used within an EnhancedAuthProvider");
  }
  return context;
}


