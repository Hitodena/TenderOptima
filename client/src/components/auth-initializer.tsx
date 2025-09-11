import { useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/auth-provider";
import { Loader } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface AuthInitializerProps {
  children: ReactNode;
}

/**
 * Component that waits for authentication state to be initialized
 * before rendering children. This prevents errors when trying to
 * access auth context before it's ready.
 * 
 * Also handles token validation on startup.
 */
export function AuthInitializer({ children }: AuthInitializerProps) {
  const { isLoading, user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(false);

  // Первым делом проверяем токен при загрузке
  useEffect(() => {
    const checkToken = () => {
      try {
        // Проверяем есть ли токен и не истек ли он
        const accessToken = localStorage.getItem('accessToken');
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        
        if (accessToken && tokenExpiry) {
          const expiryTime = parseInt(tokenExpiry);
          
          // Если токен истек, удаляем его
          if (expiryTime <= Date.now()) {
            console.log('[Auth] Токен доступа истек, удаляем');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('tokenExpiry');
          } else {
            console.log('[Auth] Найден действующий токен доступа');
          }
        }
      } catch (error) {
        console.error('[Auth] Ошибка при проверке токена:', error);
        // При ошибке очищаем токен для безопасности
        localStorage.removeItem('accessToken');
        localStorage.removeItem('tokenExpiry');
      } finally {
        // Отмечаем, что проверка токена завершена
        setTokenChecked(true);
      }
    };
    
    checkToken();
  }, []);

  // Затем ждем инициализации аутентификации
  useEffect(() => {
    if (!isLoading && tokenChecked) {
      // Если мы завершили загрузку и проверили токен, приложение готово
      setIsReady(true);
      
      // Если пользователь не авторизован, но есть токен, попробуем запросить данные еще раз
      if (!user) {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
          console.log('[Auth] Есть токен, но нет пользователя. Повторный запрос данных.');
          // Инвалидируем кэш запроса пользователя, чтобы заставить его перезагрузиться
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        }
      }
    }
  }, [isLoading, tokenChecked, user]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}