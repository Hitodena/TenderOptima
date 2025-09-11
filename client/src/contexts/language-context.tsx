import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TranslationKey, translations } from '@/utils/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const DEFAULT_LANGUAGE: Language = 'ru';
const STORAGE_KEY = 'supplier-search-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Пытаемся получить сохраненный язык из localStorage, если доступно
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem(STORAGE_KEY) as Language;
      return savedLanguage || DEFAULT_LANGUAGE;
    }
    return DEFAULT_LANGUAGE;
  });

  // Функция для установки языка и сохранения его в localStorage
  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLanguage);
      // Устанавливаем атрибут lang в html элементе для доступности
      document.documentElement.lang = newLanguage;
    }
  };

  // Функция для получения перевода по ключу
  const t = (key: TranslationKey): string => {
    const translation = translations[language][key];
    // If translation is missing, return the key for debugging but with a prefix
    return translation !== undefined ? translation : `[Missing: ${key}]`;
  };

  // Устанавливаем атрибут lang при первом рендере
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Alias for useLanguage for consistency with naming conventions
export const useTranslation = useLanguage;