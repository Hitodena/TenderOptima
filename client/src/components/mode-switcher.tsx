import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { getAnalysisThemeClasses } from '@/styles/analysis-theme';
import { useLocation } from 'wouter';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type AppMode = 'supplier_search' | 'analyze_offers';

interface ModeSwitcherProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ModeSwitcher({ currentMode, onModeChange }: ModeSwitcherProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const [location, navigate] = useLocation();

  // Determine if we're on analysis pages to prevent flickering
  const isOnAnalysisPage = location.startsWith('/analyze') || location.startsWith('/analyze/parameters');

  const handleModeToggle = async (checked: boolean) => {
    if (isLoading) return;
    
    setIsLoading(true);
    const newMode: AppMode = checked ? 'analyze_offers' : 'supplier_search';
    
    try {
      // Save mode preference to database
      if (user) {
        await apiRequest('/api/user/mode', 'POST', { mode: newMode });
      }
      
      // Update local state immediately for responsive UI
      onModeChange(newMode);
      
      // Navigate to default page based on mode
      if (newMode === 'analyze_offers') {
        navigate('/analyze/technical');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to save mode preference:', error);
      // Revert local state on error
      onModeChange(currentMode);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center justify-center">
        <div className="relative flex items-center">
          {/* Left side tooltip for supplier search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="absolute left-0 w-6 h-8 cursor-pointer z-10"
                onClick={() => !isLoading && handleModeToggle(false)}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Поиск поставщиков</p>
            </TooltipContent>
          </Tooltip>

          {/* Custom styled switch */}
          <Switch
            id="mode-switch"
            checked={currentMode === 'analyze_offers' || isOnAnalysisPage}
            onCheckedChange={handleModeToggle}
            disabled={isLoading}
            className={`
              transition-all duration-200 
              data-[state=unchecked]:bg-slate-700 data-[state=unchecked]:border-slate-700
              data-[state=checked]:bg-cyan-400 data-[state=checked]:border-cyan-400
              hover:data-[state=unchecked]:bg-slate-800
              hover:data-[state=checked]:bg-cyan-500
            `}
          />

          {/* Right side tooltip for analysis */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="absolute right-0 w-6 h-8 cursor-pointer z-10"
                onClick={() => !isLoading && handleModeToggle(true)}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Анализ предложений</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Hook for managing app mode
export function useAppMode() {
  const [mode, setMode] = useState<AppMode>('supplier_search');
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Load user's preferred mode on component mount
  useEffect(() => {
    const loadUserMode = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiRequest('/api/user/mode', 'GET');
        if (response && typeof response === 'object' && 'mode' in response) {
          setMode(response.mode as AppMode);
        }
      } catch (error) {
        console.error('Failed to load user mode:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserMode();
  }, [user]);

  return {
    mode,
    setMode,
    isLoading
  };
}