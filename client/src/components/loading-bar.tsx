import { useState, useEffect } from 'react';

interface LoadingBarProps {
  isLoading: boolean;
}

export function LoadingBar({ isLoading }: LoadingBarProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    let progressTimer: NodeJS.Timeout;
    let visibilityTimer: NodeJS.Timeout;
    
    if (isLoading) {
      // Немедленно показываем полосу загрузки
      setVisible(true);
      
      // Сбрасываем прогресс в начальное состояние
      setProgress(5);
      
      // Имитируем прогресс загрузки плавно
      progressTimer = setInterval(() => {
        setProgress(oldProgress => {
          if (oldProgress >= 90) {
            return oldProgress + (Math.random() * 0.1); // Очень медленно в конце
          }
          return oldProgress + (Math.random() * 8); // Быстрее в начале
        });
      }, 150);
    } else {
      // Когда загрузка завершена - быстро доводим до 100%
      setProgress(100);
      
      // Через небольшую задержку скрываем компонент
      visibilityTimer = setTimeout(() => {
        setVisible(false);
        // После того как скрыли, сбрасываем прогресс
        setTimeout(() => setProgress(0), 300);
      }, 400);
    }
    
    return () => {
      clearInterval(progressTimer);
      clearTimeout(visibilityTimer);
    };
  }, [isLoading]);
  
  // Если компонент не должен быть видимым, не отображаем его совсем
  if (!visible && !isLoading) return null;
  
  return (
    <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-[100] overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"
        style={{ 
          width: `${progress}%`,
          transition: 'width 0.2s ease-out',
          boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
        }}
      />
    </div>
  );
}