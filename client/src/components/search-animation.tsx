import React, { useEffect, useState } from 'react';
import { Loader2, Search, Database, Globe, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/language-context';

interface SearchAnimationProps {
  isSearching: boolean;
  searchType: {
    useDbSearch: boolean;
    useApiSearch: boolean;
  };
  onSearchComplete?: () => void;
}

export function SearchAnimation({ isSearching, searchType, onSearchComplete }: SearchAnimationProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  
  // Reset animation when search starts
  useEffect(() => {
    if (isSearching) {
      setStep(0);
      setProgress(0);
    }
  }, [isSearching]);
  
  // Animate the search process
  useEffect(() => {
    if (!isSearching) return;
    
    // Step 1: Initializing search (0-10%)
    const timer1 = setTimeout(() => {
      setStep(1);
      setProgress(10);
    }, 500);
    
    // Step 2: Searching database (10-40%)
    const timer2 = setTimeout(() => {
      if (searchType.useDbSearch) {
        setStep(2);
        setProgress(40);
      } else {
        setStep(3);
        setProgress(40);
      }
    }, 1500);
    
    // Step 3: Searching internet (API) (40-80%)
    const timer3 = setTimeout(() => {
      if (searchType.useApiSearch) {
        setStep(3);
        setProgress(80);
      } else {
        setStep(4);
        setProgress(80);
      }
    }, 3000);
    
    // Step 4: Finalizing results (80-100%)
    const timer4 = setTimeout(() => {
      setStep(4);
      setProgress(100);
    }, 4000);
    
    // Step 5: Complete (call callback)
    const timer5 = setTimeout(() => {
      if (onSearchComplete) {
        onSearchComplete();
      }
    }, 4500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
    };
  }, [isSearching, searchType, onSearchComplete]);
  
  if (!isSearching && progress === 0) return null;
  
  return (
    <div className="bg-muted/30 rounded-lg p-6 mb-6 border">
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{progress}%</span>
          <span>Обработка поиска</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center">
          {step === 0 ? (
            <Loader2 className="h-5 w-5 mr-3 text-primary animate-spin" />
          ) : (
            <CheckCircle className="h-5 w-5 mr-3 text-primary" />
          )}
          <span className={step === 0 ? "font-medium" : "text-muted-foreground"}>
            {t("search_initializing")}
          </span>
        </div>
        
        {(searchType.useDbSearch || step > 1) && (
          <div className="flex items-center">
            {step === 1 ? (
              <Loader2 className="h-5 w-5 mr-3 text-primary animate-spin" />
            ) : step > 1 ? (
              <CheckCircle className="h-5 w-5 mr-3 text-primary" />
            ) : (
              <Database className="h-5 w-5 mr-3 text-muted-foreground" />
            )}
            <span className={step === 1 ? "font-medium" : 
                             step > 1 ? "text-muted-foreground" : "text-muted-foreground/50"}>
              {t("search_database")}
            </span>
          </div>
        )}
        
        {(searchType.useApiSearch || step > 2) && (
          <div className="flex items-center">
            {step === 2 ? (
              <Loader2 className="h-5 w-5 mr-3 text-primary animate-spin" />
            ) : step > 2 ? (
              <CheckCircle className="h-5 w-5 mr-3 text-primary" />
            ) : (
              <Globe className="h-5 w-5 mr-3 text-muted-foreground" />
            )}
            <span className={step === 2 ? "font-medium" : 
                             step > 2 ? "text-muted-foreground" : "text-muted-foreground/50"}>
              {t("search_internet")}
            </span>
          </div>
        )}
        
        <div className="flex items-center">
          {step === 3 ? (
            <Loader2 className="h-5 w-5 mr-3 text-primary animate-spin" />
          ) : step > 3 ? (
            <CheckCircle className="h-5 w-5 mr-3 text-primary" />
          ) : (
            <Search className="h-5 w-5 mr-3 text-muted-foreground" />
          )}
          <span className={step === 3 ? "font-medium" : 
                           step > 3 ? "text-muted-foreground" : "text-muted-foreground/50"}>
            {t("search_finalizing")}
          </span>
        </div>
      </div>
    </div>
  );
}