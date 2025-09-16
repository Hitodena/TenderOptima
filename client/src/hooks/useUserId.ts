import { useState, useEffect } from 'react';

export const useUserId = (): number | null => {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    const getUserIdFromToken = () => {
      try {
        const token = localStorage.getItem('token');
        console.log('🔑 useUserId: Token found:', !!token);
        if (token) {
          // Простое декодирование JWT токена (без проверки подписи)
          const payload = JSON.parse(atob(token.split('.')[1]));
          const id = payload.userId || payload.id || null;
          console.log('🔑 useUserId: Extracted userId:', id);
          return id;
        }
      } catch (error) {
        console.error('❌ useUserId: Error decoding token:', error);
      }
      return null;
    };

    const id = getUserIdFromToken();
    console.log('🔑 useUserId: Setting userId to:', id);
    setUserId(id);

    // Слушаем изменения в localStorage
    const handleStorageChange = () => {
      const newId = getUserIdFromToken();
      console.log('🔑 useUserId: Storage changed, new userId:', newId);
      setUserId(newId);
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return userId;
};
