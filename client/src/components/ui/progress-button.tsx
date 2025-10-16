import React, { useState, useEffect, useRef } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface ProgressButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  externalLoading?: boolean; // Для внешнего управления состоянием загрузки
}

// Конфигурация прогресса согласно требованиям
const PROGRESS_CONFIG = [
  { time: 10, progress: 10 },   // 10% через 10 секунд
  { time: 15, progress: 20 },   // 20% через 15 секунд
  { time: 25, progress: 30 },   // 30% через 25 секунд
  { time: 35, progress: 50 },   // 50% через 35 секунд
  { time: 45, progress: 70 },   // 70% через 45 секунд
  { time: 60, progress: 90 },   // 90% через 60 секунд
];

export function ProgressButton({
  onClick,
  disabled = false,
  children,
  loadingText = "Поиск...",
  className,
  variant = "default",
  size = "default",
  externalLoading = false
}: ProgressButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startProgress = () => {
    setIsLoading(true);
    setProgress(0);
    setCurrentStep(0);
    startTimeRef.current = Date.now();

    // Запускаем интервал для обновления прогресса каждые 100мс
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000; // в секундах
      
      // Находим текущий этап прогресса
      let newProgress = 0;
      let newStep = 0;
      
      for (let i = 0; i < PROGRESS_CONFIG.length; i++) {
        if (elapsed >= PROGRESS_CONFIG[i].time) {
          newProgress = PROGRESS_CONFIG[i].progress;
          newStep = i;
        } else {
          // Интерполяция между этапами
          if (i > 0) {
            const prevConfig = PROGRESS_CONFIG[i - 1];
            const currentConfig = PROGRESS_CONFIG[i];
            const timeDiff = currentConfig.time - prevConfig.time;
            const progressDiff = currentConfig.progress - prevConfig.progress;
            const elapsedInStage = elapsed - prevConfig.time;
            
            if (elapsedInStage > 0) {
              newProgress = prevConfig.progress + (progressDiff * elapsedInStage / timeDiff);
              newStep = i - 1;
            }
          }
          break;
        }
      }
      
      setProgress(Math.min(newProgress, 90)); // Максимум 90% до завершения
      setCurrentStep(newStep);
    }, 100);
  };

  const stopProgress = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Анимация завершения - быстро доходим до 100%
    setProgress(100);
    
    // Небольшая задержка перед сбросом для показа завершения
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
      setCurrentStep(0);
    }, 500);
  };

  const handleClick = () => {
    if (!isLoading && !disabled) {
      startProgress();
      onClick();
    }
  };

  // Обработка внешнего состояния загрузки
  useEffect(() => {
    if (externalLoading && !isLoading) {
      startProgress();
    } else if (!externalLoading && isLoading) {
      stopProgress();
    }
  }, [externalLoading, isLoading]);

  // Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Функция для получения текста текущего этапа
  const getStepText = () => {
    const stepTexts = [
      "Инициализация поиска...",
      "Анализ ключевых слов...",
      "Поиск в базе данных...",
      "Поиск в интернете...",
      "Обработка результатов...",
      "Финализация..."
    ];
    return stepTexts[currentStep] || loadingText;
  };

  return (
    <div className="relative w-full">
      <Button
        onClick={handleClick}
        disabled={disabled || isLoading}
        variant={variant}
        size={size}
        className={cn(
          "relative overflow-hidden transition-all duration-300 transform",
          isLoading && "pointer-events-none scale-[0.98]",
          !isLoading && "hover:scale-[1.02] active:scale-[0.98]",
          className
        )}
      >
        {/* Прогресс-бар */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-600/20 animate-pulse">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 transition-all duration-500 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* Блестящий эффект */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          </div>
        )}
        
        {/* Контент кнопки */}
        <div className="relative z-10 flex items-center justify-center gap-2">
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-sm font-medium animate-pulse">
                {getStepText()}
              </span>
              <span className="text-xs opacity-75 bg-white/20 px-2 py-1 rounded-full transition-all duration-300">
                {Math.round(progress)}%
              </span>
            </>
          ) : (
            <span className="transition-all duration-300">
              {children}
            </span>
          )}
        </div>
      </Button>
    </div>
  );
}
