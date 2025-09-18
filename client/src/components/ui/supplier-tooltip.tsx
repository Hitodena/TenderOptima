import React, { useState, useRef, useEffect } from 'react';
import { Badge } from './badge';
import { Label } from './label';

interface SupplierTooltipProps {
  supplier: {
    name: string;
    email?: string;
    phone?: string;
    website?: string;
    description?: string;
    categories?: string[];
  };
  children: React.ReactNode;
  className?: string;
}

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export function SupplierTooltip({ supplier, children, className = '' }: SupplierTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showTimeout, setShowTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);
  const [position, setPosition] = useState<TooltipPosition>('top');
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculateOptimalPosition = (): TooltipPosition => {
    if (!triggerRef.current) return 'top';

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = Math.min(320, viewportWidth - 32);
    const tooltipHeight = 280;
    const margin = 16;

    // Проверяем, есть ли элементы справа от trigger (например, кнопки)
    const elementsToRight = document.elementsFromPoint(
      triggerRect.right + 50, 
      triggerRect.top + triggerRect.height / 2
    );
    const hasElementsToRight = elementsToRight.some(el => 
      el !== triggerRef.current && 
      !el.closest('[data-tooltip]') &&
      el.tagName !== 'HTML' && 
      el.tagName !== 'BODY' &&
      el.tagName !== 'TD' && // Игнорируем ячейки таблицы
      el.tagName !== 'TH'    // Игнорируем заголовки таблицы
    );

    // Дополнительная проверка: ищем кнопки или другие интерактивные элементы справа
    const buttonElements = document.querySelectorAll('button, [role="button"], .btn');
    const hasButtonsToRight = Array.from(buttonElements).some(btn => {
      const btnRect = btn.getBoundingClientRect();
      return btnRect.left > triggerRect.right && 
             btnRect.top < triggerRect.bottom && 
             btnRect.bottom > triggerRect.top;
    });

    // Проверяем возможность размещения сверху
    const canPlaceTop = triggerRect.top >= tooltipHeight + margin;
    
    // Проверяем возможность размещения снизу  
    const canPlaceBottom = triggerRect.bottom + tooltipHeight + margin <= viewportHeight;
    
    // Проверяем возможность размещения слева
    const canPlaceLeft = triggerRect.left >= tooltipWidth + margin;
    
    // Проверяем возможность размещения справа (с учетом элементов справа)
    const canPlaceRight = triggerRect.right + tooltipWidth + margin <= viewportWidth && 
                         !hasElementsToRight && !hasButtonsToRight;

    // Проверяем, хватает ли места по горизонтали для центрирования tooltip
    const centerX = triggerRect.left + triggerRect.width / 2;
    const canCenterHorizontally = centerX >= tooltipWidth / 2 + margin && 
                                  centerX <= viewportWidth - tooltipWidth / 2 - margin;

    // Проверяем, находимся ли мы в таблице
    const isInTable = triggerRef.current.closest('table') !== null;
    
    // Приоритет: избегаем размещения справа если там есть элементы
    // В таблице предпочитаем позиционирование слева для избежания перекрытия кнопок
    if (isInTable && canPlaceLeft) return 'left';
    if (canPlaceTop && canCenterHorizontally) return 'top';
    if (canPlaceBottom && canCenterHorizontally) return 'bottom';
    
    // Если вертикальное позиционирование невозможно, используем горизонтальное
    if (canPlaceLeft) return 'left';
    if (canPlaceRight) return 'right';
    
    // Fallback: используем вертикальное позиционирование даже без центрирования
    if (canPlaceTop) return 'top';
    if (canPlaceBottom) return 'bottom';
    
    // Если совсем мало места, выбираем позицию с максимальным доступным пространством
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = (hasElementsToRight || hasButtonsToRight) ? 0 : viewportWidth - triggerRect.right;
    
    const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);
    
    if (maxSpace === spaceTop) return 'top';
    if (maxSpace === spaceBottom) return 'bottom';
    if (maxSpace === spaceRight) return 'right';
    return 'left';
  };

  const handleMouseEnter = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
    
    const timeout = setTimeout(() => {
      setPosition(calculateOptimalPosition());
      setIsVisible(true);
    }, 300); // Задержка 300ms перед показом
    
    setShowTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      setShowTimeout(null);
    }
    
    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, 150); // Задержка 150ms перед скрытием
    
    setHideTimeout(timeout);
  };

  // Обработчик изменения размера окна для пересчета позиции
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        setPosition(calculateOptimalPosition());
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible]);


  const formatWebsiteUrl = (website: string) => {
    if (!website) return '';
    return website.startsWith('http') ? website : `http://${website}`;
  };

  const extractDomain = (website: string) => {
    if (!website) return '';
    try {
      const url = formatWebsiteUrl(website);
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return website;
    }
  };

  const getPositionClasses = () => {
    const baseClasses = "absolute z-50 w-80 max-w-sm bg-white border border-gray-200 rounded-lg shadow-xl p-4 animate-in fade-in-0 zoom-in-95 duration-200 max-h-80 overflow-y-auto";
    
    switch (position) {
      case 'top':
        return `${baseClasses} bottom-full mb-2 left-1/2 transform -translate-x-1/2`;
      case 'bottom':
        return `${baseClasses} top-full mt-2 left-1/2 transform -translate-x-1/2`;
      case 'left':
        return `${baseClasses} right-full mr-2 top-1/2 transform -translate-y-1/2`;
      case 'right':
        return `${baseClasses} left-full ml-2 top-1/2 transform -translate-y-1/2`;
      default:
        return `${baseClasses} bottom-full mb-2 left-1/2 transform -translate-x-1/2`;
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return {
          container: "absolute top-full left-1/2 transform -translate-x-1/2",
          outer: "border-4 border-transparent border-t-gray-200",
          inner: "absolute -top-[1px] left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white"
        };
      case 'bottom':
        return {
          container: "absolute bottom-full left-1/2 transform -translate-x-1/2",
          outer: "border-4 border-transparent border-b-gray-200",
          inner: "absolute -bottom-[1px] left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-white"
        };
      case 'left':
        return {
          container: "absolute left-full top-1/2 transform -translate-y-1/2",
          outer: "border-4 border-transparent border-l-gray-200",
          inner: "absolute -left-[1px] top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-white"
        };
      case 'right':
        return {
          container: "absolute right-full top-1/2 transform -translate-y-1/2",
          outer: "border-4 border-transparent border-r-gray-200",
          inner: "absolute -right-[1px] top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-white"
        };
      default:
        return {
          container: "absolute top-full left-1/2 transform -translate-x-1/2",
          outer: "border-4 border-transparent border-t-gray-200",
          inner: "absolute -top-[1px] left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white"
        };
    }
  };

  return (
    <div 
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-tooltip="true"
    >
      {children}
      
      {isVisible && (
        <div ref={tooltipRef} className={getPositionClasses()} data-tooltip="true">
          {/* Стрелка */}
          <div className={getArrowClasses().container}>
            <div className={getArrowClasses().outer}></div>
            <div className={getArrowClasses().inner}></div>
          </div>
          
          {/* Содержимое */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-700">Название компании</Label>
              <p className="text-sm text-gray-900">{supplier.name}</p>
            </div>
            
            {supplier.email && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Email</Label>
                <p className="text-sm text-gray-900">{supplier.email}</p>
              </div>
            )}
            
            {supplier.phone && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Телефон</Label>
                <p className="text-sm text-gray-900">{supplier.phone}</p>
              </div>
            )}
            
            {supplier.website && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Веб-сайт</Label>
                <a 
                  href={formatWebsiteUrl(supplier.website)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {supplier.website}
                </a>
              </div>
            )}
            
            {supplier.description && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Описание</Label>
                <p className="text-sm text-gray-900">{supplier.description}</p>
              </div>
            )}
            
            {supplier.categories && supplier.categories.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-700">Категории</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {supplier.categories.map((category, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}