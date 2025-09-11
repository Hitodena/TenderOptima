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
    const tooltipWidth = Math.min(320, viewportWidth - 32); // Адаптивная ширина с минимальным отступом 
    const tooltipHeight = 250; // Более точная высота tooltip
    const margin = 12; // Отступ от края экрана

    // Проверяем возможность размещения сверху
    const canPlaceTop = triggerRect.top >= tooltipHeight + margin;
    
    // Проверяем возможность размещения снизу  
    const canPlaceBottom = triggerRect.bottom + tooltipHeight + margin <= viewportHeight;
    
    // Проверяем возможность размещения слева
    const canPlaceLeft = triggerRect.left >= tooltipWidth + margin;
    
    // Проверяем возможность размещения справа
    const canPlaceRight = triggerRect.right + tooltipWidth + margin <= viewportWidth;

    // Проверяем, хватает ли места по горизонтали для центрирования tooltip
    const centerX = triggerRect.left + triggerRect.width / 2;
    const canCenterHorizontally = centerX >= tooltipWidth / 2 + margin && 
                                  centerX <= viewportWidth - tooltipWidth / 2 - margin;

    // Приоритет: top/bottom (если можно центрировать) > right > left > top/bottom (без центрирования)
    if (canPlaceTop && canCenterHorizontally) return 'top';
    if (canPlaceBottom && canCenterHorizontally) return 'bottom';
    if (canPlaceRight) return 'right';
    if (canPlaceLeft) return 'left';
    if (canPlaceTop) return 'top';
    if (canPlaceBottom) return 'bottom';
    
    // Если совсем мало места, выбираем наименьшее зло
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;
    
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
    const baseClasses = "absolute z-50 w-80 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-in fade-in-0 zoom-in-95 duration-200";
    
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
    >
      {children}
      
      {isVisible && (
        <div ref={tooltipRef} className={getPositionClasses()}>
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