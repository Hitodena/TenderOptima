import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainNavigation } from "@/components/main-navigation";
import { CustomSupplierInput } from "@/components/custom-supplier-input";
import { UploadSuppliersExcel } from "@/components/upload-suppliers-excel";
import { LoadFromContacts } from "@/components/load-from-contacts";
import { apiRequest } from "@/lib/queryClient";

import { EmailForm } from "@/components/email-form";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { SubscriptionAlerts } from "@/components/subscription-alerts";
import { RequestLockdown } from "@/components/request-lockdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Mail, X, Users, ArrowLeft, Info, Globe, Search } from "lucide-react";
import type { SearchRequest, Supplier } from "@shared/schema";

// Extended supplier type for handling multiple emails
type ExtendedSupplier = Omit<Supplier, 'email'> & {
  email: string[] | string;
  selectedEmail?: string; // Выбранный email (только один на поставщика)
  pageTitle?: string;
};

// Helper function to convert ExtendedSupplier to Supplier for compatibility
// КРИТИЧНО: Сохраняем selectedEmail в результате
const convertToSupplier = (extended: ExtendedSupplier): Supplier & { selectedEmail?: string } => {
  const emailToUse = Array.isArray(extended.email) 
    ? (extended.selectedEmail || extended.email[0] || '') 
    : extended.email;
  return {
    ...extended,
    email: emailToUse,
    selectedEmail: extended.selectedEmail || (Array.isArray(extended.email) ? extended.email[0] : extended.email) // Сохраняем selectedEmail
  };
};

// Helper function to convert ExtendedSupplier to SupplierTooltip format
const convertToTooltipSupplier = (extended: ExtendedSupplier) => ({
  name: extended.name,
  email: Array.isArray(extended.email) ? (extended.selectedEmail || extended.email[0] || '') : extended.email,
  phone: extended.phone,
  website: extended.website,
  description: extended.description,
  categories: extended.categories
});
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useLocation, Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SupplierTooltip } from "@/components/ui/supplier-tooltip";
import punycode from "punycode/";

export default function SendRequest() {
  const [suppliers, setSuppliers] = useState<ExtendedSupplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<ExtendedSupplier[]>([]);
  // Default to showing email form, but check URL and session storage first
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [comingFromGroup, setComingFromGroup] = useState(false);
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [uniqueEmailsOnly, setUniqueEmailsOnly] = useState(true);
  const [trialLimitMessage, setTrialLimitMessage] = useState<string | null>(null);
  const [selectedSupplierInfo, setSelectedSupplierInfo] = useState<Supplier | null>(null);
  const [errorMessageShown, setErrorMessageShown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { isActiveOrLoading } = useSubscription();

  // Function to load full supplier data from database - REMOVED
  // This was causing 404 errors by trying to fetch suppliers from main table
  // when they only exist in staging_suppliers table

  // Helper function to apply trial limitations to suppliers
  const applyTrialLimitations = async (suppliers: ExtendedSupplier[]) => {
    try {
      const response = await fetch('/api/subscriptions/status');
      const subscription = response.ok ? await response.json() : null;
      const isTrialUser = subscription?.subscription?.plan === 'trial';
      const maxSuppliersForTrial = 10;
      
      if (isTrialUser && suppliers.length > maxSuppliersForTrial) {
        const limitedSuppliers = suppliers.slice(0, maxSuppliersForTrial);
        const message = `Найдено всего ${suppliers.length} поставщиков. В пробной версии доступны первые ${maxSuppliersForTrial} поставщиков`;
        setTrialLimitMessage(message);
        sessionStorage.setItem('trialLimitMessage', message);
        console.log(`Trial user: Limiting ${suppliers.length} suppliers to ${maxSuppliersForTrial}`);
        return limitedSuppliers;
      }
      
      // Clear trial message for non-trial users or when under limit
      setTrialLimitMessage(null);
      sessionStorage.removeItem('trialLimitMessage');
      return suppliers;
    } catch (error) {
      console.error('Error checking subscription for trial limitations:', error);
      return suppliers; // Return all suppliers if subscription check fails
    }
  };


  // Function to navigate to parameter selection
  const handleContinueToParameters = () => {
    if (getSelectedEmailsCount() === 0) {
      toast({
        title: "Выберите email",
        description: "Пожалуйста, выберите хотя бы один email для отправки запроса.",
        variant: "destructive",
      });
      return;
    }
    
    // Store selected suppliers in session storage for the parameters page
    try {
      // КРИТИЧНО: Убеждаемся, что selectedEmail сохраняется
      const suppliersToSave = selectedSuppliers.map(s => ({
        ...s,
        selectedEmail: s.selectedEmail || (Array.isArray(s.email) ? s.email[0] : s.email)
      }));
      console.log(`[CRITICAL] Saving selectedSuppliers to sessionStorage:`, suppliersToSave.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        selectedEmail: s.selectedEmail
      })));
      sessionStorage.setItem('selectedSuppliers', JSON.stringify(suppliersToSave));
      if (searchRequest?.id) {
        sessionStorage.setItem('requestId', searchRequest.id.toString());
      }
      
      // Redirect to parameter selection page
      setLocation(`/select-request-parameters`);
    } catch (error) {
      console.error('Error saving suppliers to session storage:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить выбранных поставщиков. Пожалуйста, попробуйте еще раз.",
        variant: "destructive",
      });
    }
  };
  
  // Function to create empty request object
  const createEmptyRequest = (): SearchRequest => {
    return {
      id: 0, // Will be assigned on server
      orderNumber: '',
      productName: productName,
      productDescription: productDescription,
      timeline: deadline,
      additionalRequirements: null,
      status: 'pending',
      createdAt: null,
      matchedSuppliers: null,
      useDbSearch: false,
      useApiSearch: false
    } as SearchRequest;
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handleAddSupplier = (supplier: ExtendedSupplier) => {
    setSuppliers(prev => [...prev, supplier]);
    // Автоматически выбираем нового поставщика
    setSelectedSuppliers(prev => [...prev, supplier]);
  };

  const handleBulkUpload = (newSuppliers: ExtendedSupplier[]) => {
    setSuppliers(prev => [...prev, ...newSuppliers]);
    // Автоматически выбираем первый email у каждого нового поставщика
    const newSuppliersWithFirstEmail = newSuppliers.map(supplier => ({
      ...supplier,
      selectedEmail: Array.isArray(supplier.email) ? supplier.email[0] : supplier.email
    }));
    setSelectedSuppliers(prev => [...prev, ...newSuppliersWithFirstEmail]);
  };

  const handleRemoveSupplier = (id: number | string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setSelectedSuppliers(prev => prev.filter(s => s.id !== id));
  };

  // Helper function to clean email address
  const cleanEmail = (email: string): string => {
    if (!email) return "";
    
    // Decode URL-encoded characters (e.g., %20 = space)
    let cleaned = decodeURIComponent(email);
    
    // Remove leading slashes, spaces, and other unwanted characters
    cleaned = cleaned.trim();
    
    // Remove common prefixes that shouldn't be in email
    cleaned = cleaned.replace(/^[\/\\\s]+/, ''); // Remove leading slashes and spaces
    cleaned = cleaned.replace(/^mailto:/i, ''); // Remove mailto: prefix
    cleaned = cleaned.replace(/^email:/i, ''); // Remove email: prefix
    
    // Remove any trailing slashes or spaces
    cleaned = cleaned.replace(/[\/\\\s]+$/, '');
    
    // Decode Punycode in email domain part
    try {
      const parts = cleaned.split('@');
      if (parts.length === 2) {
        const localPart = parts[0];
        const domainPart = parts[1];
        const decodedDomain = decodePunycode(domainPart);
        cleaned = `${localPart}@${decodedDomain}`;
      }
    } catch {
      // If decoding fails, return original
    }
    
    return cleaned;
  };

  // Helper function to get domain from email
  const getDomainFromEmail = (email: string): string => {
    if (!email) return "";
    const cleanedEmail = cleanEmail(email);
    const parts = cleanedEmail.split('@');
    return parts.length > 1 ? parts[1].toLowerCase() : "";
  };

  // List of public email domains that should NOT be deduplicated
  const publicEmailDomains = new Set([
    // International providers
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 
    'msn.com', 'aol.com', 'icloud.com', 'me.com', 'protonmail.com',
    'zoho.com', 'fastmail.com', 'tutanota.com', 'mailfence.com',
    
    // Russian providers
    'mail.ru', 'yandex.ru', 'yandex.com', 'ya.ru', 'list.ru',
    'inbox.ru', 'bk.ru', 'internet.ru', 'rambler.ru',
    
    // Other popular domains
    'qq.com', '163.com', '126.com', 'sina.com', 'sohu.com',
    'gmx.com', 'web.de', 't-online.de', 'freenet.de',
    'orange.fr', 'laposte.net', 'wanadoo.fr', 'free.fr',
    'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it',
    'wp.pl', 'o2.pl', 'interia.pl', 'gazeta.pl'
  ]);

  // Helper function to get domain from website URL
  const getDomainFromWebsite = (website: string): string => {
    if (!website) return "";
    try {
      // Add protocol if missing
      const url = website.startsWith('http') ? website : `http://${website}`;
      const domain = new URL(url).hostname.toLowerCase();
      return domain.replace('www.', '');
    } catch {
      // If URL parsing fails, try to extract domain from string
      const cleaned = website.replace(/^(https?:\/\/)?(www\.)?/, '').toLowerCase();
      return cleaned.split('/')[0].split('?')[0];
    }
  };

  // Helper function to decode Punycode domain to readable format
  const decodePunycode = (domain: string): string => {
    if (!domain) return "";
    try {
      // Remove protocol/paths to keep only hostname
      let cleaned = domain.trim();
      if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
        cleaned = cleaned.replace(/^https?:\/\//, "");
      }
      if (cleaned.startsWith("www.")) {
        cleaned = cleaned.substring(4);
      }
      cleaned = cleaned.split("/")[0];

      const lower = cleaned.toLowerCase();

      if (!lower.includes("xn--")) {
        return cleaned;
      }

      const decodedParts = lower
        .split(".")
        .map(part => (part.startsWith("xn--") ? punycode.toUnicode(part) : part));

      return decodedParts.join(".");
    } catch {
      return domain;
    }
  };

  // Function to group suppliers by domain
  const groupSuppliersByDomain = (suppliers: ExtendedSupplier[]) => {
    const groups = new Map<string, ExtendedSupplier[]>();
    
    suppliers.forEach(supplier => {
      const website = supplier.website || '';
      const domain = getDomainFromWebsite(website);
      
      if (!domain) {
        // Поставщики без сайта - отдельная группа
        const noDomainKey = 'no-domain';
        if (!groups.has(noDomainKey)) {
          groups.set(noDomainKey, []);
        }
        groups.get(noDomainKey)!.push(supplier);
      } else {
        if (!groups.has(domain)) {
          groups.set(domain, []);
        }
        groups.get(domain)!.push(supplier);
      }
    });
    
    return groups;
  };

  // Function to select unique suppliers with smart deduplication
  // Now works with domain groups - selects one supplier per domain group
  const selectUniqueEmails = () => {
    const groups = groupSuppliersByDomain(suppliers);
    const selected: ExtendedSupplier[] = [];
    
    groups.forEach((groupSuppliers, domain) => {
      if (groupSuppliers.length === 0) return;
      
      // Check if any supplier in group has public email domain
      const hasPublicEmail = groupSuppliers.some(s => {
        const emails = Array.isArray(s.email) ? s.email : [s.email];
        return emails.some(email => {
          if (!email) return false;
          const emailDomain = getDomainFromEmail(cleanEmail(email));
          return publicEmailDomains.has(emailDomain);
        });
      });
      
      if (hasPublicEmail) {
        // For groups with public emails - keep all suppliers
        selected.push(...groupSuppliers);
      } else {
        // For other groups - select only the best supplier with best email
        const sortedGroup = [...groupSuppliers].sort((a, b) => {
          const emailsA = Array.isArray(a.email) ? a.email : [a.email];
          const emailsB = Array.isArray(b.email) ? b.email : [b.email];
          
          // Find best email for each supplier
          const bestEmailA = findBestEmail(emailsA, a.website);
          const bestEmailB = findBestEmail(emailsB, b.website);
          
          const salesKeywords = ['sales', 'продажи', 'заказ', 'order', 'commercial', 'коммерческий', 'info'];
          const aHasSalesKeyword = salesKeywords.some(keyword => cleanEmail(bestEmailA).toLowerCase().includes(keyword));
          const bHasSalesKeyword = salesKeywords.some(keyword => cleanEmail(bestEmailB).toLowerCase().includes(keyword));
          
          if (aHasSalesKeyword && !bHasSalesKeyword) return -1;
          if (!aHasSalesKeyword && bHasSalesKeyword) return 1;
          return 0;
        });
        
        // Select the best supplier and set their best email
        const bestSupplier = sortedGroup[0];
        const allEmails = Array.isArray(bestSupplier.email) ? bestSupplier.email : [bestSupplier.email];
        const bestEmail = findBestEmail(allEmails, bestSupplier.website);
        selected.push({ ...bestSupplier, email: allEmails, selectedEmail: bestEmail });
      }
    });
    
    return selected;
  };

  const handleSelectSupplier = (supplier: ExtendedSupplier, checked: boolean) => {
    if (checked) {
      setSelectedSuppliers(prev => [...prev, supplier]);
    } else {
      setSelectedSuppliers(prev => prev.filter(s => s.id !== supplier.id));
    }
  };

  // Helper function to find the best email from a list
  const findBestEmail = (emails: string[], website?: string): string => {
    if (!emails || emails.length === 0) return '';
    if (emails.length === 1) return emails[0];
    
    // Filter out suspicious/strange email addresses
    const suspiciousDomains = [
      'sentry-next.wixpress.com',
      'wixpress.com',
      'sentry.io',
      'noreply',
      'no-reply',
      'donotreply',
      'mailer-daemon',
      'postmaster',
      'webmaster',
      'admin',
      'root',
      'system'
    ];
    
    const suspiciousPatterns = [
      /^[a-f0-9]{32}@/, // 32-character hex strings (like sentry IDs)
      /^[a-f0-9]{24}@/, // 24-character hex strings
      /^[a-f0-9]{16}@/, // 16-character hex strings
      /^[a-f0-9]{8}@/,  // 8-character hex strings
      /^[a-z0-9]{20,}@/ // Very long random-looking usernames
    ];
    
    // Filter out suspicious emails
    const cleanEmails = emails.filter(email => {
      if (!email) return false;
      const cleanEmailLower = cleanEmail(email).toLowerCase();
      const domain = cleanEmailLower.split('@')[1];
      
      // Check for suspicious domains
      if (suspiciousDomains.some(suspicious => domain?.includes(suspicious))) {
        return false;
      }
      
      // Check for suspicious patterns
      if (suspiciousPatterns.some(pattern => pattern.test(cleanEmailLower))) {
        return false;
      }
      
      return true;
    });
    
    // If no clean emails left, fall back to original list
    const emailsToCheck = cleanEmails.length > 0 ? cleanEmails : emails;
    
    // Extract website domain for matching
    let websiteDomain = '';
    if (website) {
      try {
        const url = new URL(website.startsWith('http') ? website : `https://${website}`);
        websiteDomain = url.hostname.replace(/^www\./, '').toLowerCase();
      } catch (e) {
        // If URL parsing fails, try to extract domain manually
        websiteDomain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      }
    }
    
    const salesKeywords = ['sales', 'продажи', 'заказ', 'order', 'commercial', 'коммерческий'];
    const infoKeywords = ['info'];
    
    // First priority: sales-related emails from the same domain as website
    if (websiteDomain) {
      for (const email of emailsToCheck) {
        if (!email) continue;
        const cleanEmailLower = cleanEmail(email).toLowerCase();
        const emailDomain = cleanEmailLower.split('@')[1];
        const emailUser = cleanEmailLower.split('@')[0];
        
        if (emailDomain === websiteDomain && salesKeywords.some(keyword => emailUser.includes(keyword))) {
          return email;
        }
      }
    }
    
    // Second priority: sales-related emails (any domain)
    for (const email of emailsToCheck) {
      if (!email) continue;
      const cleanEmailLower = cleanEmail(email).toLowerCase();
      const emailUser = cleanEmailLower.split('@')[0];
      if (salesKeywords.some(keyword => emailUser.includes(keyword))) {
        return email;
      }
    }
    
    // Third priority: info emails from the same domain as website
    if (websiteDomain) {
      for (const email of emailsToCheck) {
        if (!email) continue;
        const cleanEmailLower = cleanEmail(email).toLowerCase();
        const emailDomain = cleanEmailLower.split('@')[1];
        const emailUser = cleanEmailLower.split('@')[0];
        
        if (emailDomain === websiteDomain && infoKeywords.some(keyword => emailUser.includes(keyword))) {
          return email;
        }
      }
    }
    
    // Fourth priority: info emails (any domain)
    for (const email of emailsToCheck) {
      if (!email) continue;
      const cleanEmailLower = cleanEmail(email).toLowerCase();
      const emailUser = cleanEmailLower.split('@')[0];
      if (infoKeywords.some(keyword => emailUser.includes(keyword))) {
        return email;
      }
    }
    
    // Fifth priority: emails from the same domain as website
    if (websiteDomain) {
      for (const email of emailsToCheck) {
        if (!email) continue;
        const cleanEmailLower = cleanEmail(email).toLowerCase();
        const emailDomain = cleanEmailLower.split('@')[1];
        
        if (emailDomain === websiteDomain) {
          return email;
        }
      }
    }
    
    // Default: return first non-empty email from clean list
    return emailsToCheck.find(email => email && email.trim()) || emails[0];
  };

  // Function to handle email selection - только один email на поставщика
  const handleEmailSelection = (supplier: ExtendedSupplier, selectedEmail: string, checked: boolean) => {
    console.log(`[CRITICAL] handleEmailSelection called:`, {
      supplierId: supplier.id,
      supplierName: supplier.name,
      selectedEmail,
      checked,
      currentSelectedEmail: supplier.selectedEmail
    });
    
    if (checked) {
      // Выбираем email = выбираем поставщика с этим email
      // Если у поставщика уже был выбран другой email, заменяем его
      const updatedSupplier = { 
        ...supplier, 
        selectedEmail: selectedEmail 
      };
      
      console.log(`[CRITICAL] Updated supplier:`, {
        id: updatedSupplier.id,
        name: updatedSupplier.name,
        selectedEmail: updatedSupplier.selectedEmail
      });
      
      // Update in the main suppliers list
      setSuppliers(prev => 
        prev.map(s => {
          if (s.id === supplier.id) {
            return updatedSupplier;
          }
          return s;
        })
      );
      
      // Если включен режим "только уникальные", проверяем дубликаты по домену
      if (uniqueEmailsOnly) {
        const website = supplier.website || '';
        const domain = getDomainFromWebsite(website);
        
        if (domain) {
          // Удаляем других поставщиков с того же домена
          setSelectedSuppliers(prev => {
            const filtered = prev.filter(s => {
              const sDomain = getDomainFromWebsite(s.website || '');
              return sDomain !== domain;
            });
            return [...filtered, updatedSupplier];
          });
        } else {
          // Если нет домена, просто обновляем
          setSelectedSuppliers(prev => {
            const filtered = prev.filter(s => s.id !== supplier.id);
            return [...filtered, updatedSupplier];
          });
        }
      } else {
        // Обычный режим - обновляем поставщика
        setSelectedSuppliers(prev => {
          const filtered = prev.filter(s => s.id !== supplier.id);
          return [...filtered, updatedSupplier];
        });
      }
    } else {
      // Снимаем выбор - удаляем поставщика из выбранных
      setSelectedSuppliers(prev => prev.filter(s => s.id !== supplier.id));
      
      // Update in the main suppliers list
      setSuppliers(prev => 
        prev.map(s => {
          if (s.id === supplier.id) {
            return { ...s, selectedEmail: undefined };
          }
          return s;
        })
      );
    }
  };

  // Function to handle selection within a domain group
  const handleSelectSupplierInGroup = (supplier: ExtendedSupplier, checked: boolean) => {
    if (checked) {
      // If selecting a supplier in a group, first deselect other suppliers from the same domain
      const website = supplier.website || '';
      const domain = getDomainFromWebsite(website);
      
      if (domain) {
        // Remove other suppliers from the same domain
        setSelectedSuppliers(prev => prev.filter(s => {
          const sDomain = getDomainFromWebsite(s.website || '');
          return sDomain !== domain;
        }));
      }
      
      // If supplier has multiple emails, use the best one
      const emails = Array.isArray(supplier.email) ? supplier.email : [supplier.email];
      const bestEmail = findBestEmail(emails);
      const supplierWithBestEmail = { ...supplier, email: emails, selectedEmail: bestEmail };
      
      // Add the selected supplier
      setSelectedSuppliers(prev => [...prev, supplierWithBestEmail]);
    } else {
      setSelectedSuppliers(prev => prev.filter(s => s.id !== supplier.id));
    }
  };

  // Подсчет количества выбранных email (не поставщиков!)
  // Подсчет количества выбранных email (не поставщиков!)
  const getSelectedEmailsCount = () => {
    // Каждый выбранный поставщик = один выбранный email
    return selectedSuppliers.length;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Выбираем первый email у каждого поставщика
      const allSuppliersWithFirstEmail = suppliers.map(supplier => {
        const emails = Array.isArray(supplier.email) ? supplier.email : [supplier.email];
        const firstEmail = emails[0] || '';
        return { ...supplier, selectedEmail: firstEmail };
      });
      
      // Если включен режим "только уникальные", применяем фильтрацию
      if (uniqueEmailsOnly) {
        const uniqueSuppliers = selectUniqueEmails();
        setSelectedSuppliers(uniqueSuppliers);
      } else {
        setSelectedSuppliers(allSuppliersWithFirstEmail);
      }
    } else {
      // Снимаем все выборы
      setSelectedSuppliers([]);
    }
  };
  
  // Handle unique emails checkbox
  const handleUniqueEmailsToggle = (checked: boolean) => {
    setUniqueEmailsOnly(checked);
    if (checked) {
      // Select one email per domain
      const uniqueSuppliers = selectUniqueEmails();
      setSelectedSuppliers(uniqueSuppliers);
    } else {
      // ИСПРАВЛЕНИЕ: При выключении "только уникальные" очищаем выбор
      // Это позволяет пользователю выключить оба чекбокса для ручного выбора
      setSelectedSuppliers([]);
    }
  };

  // Функция для получения параметров из URL
  const getSearchParam = (param: string): string | null => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      return url.searchParams.get(param);
    }
    return null;
  };

  // Типы для разных источников данных
  type ServerKeyData = {
    key: string;
    source: 'serverKey';
  };
  
  type UrlData = {
    rawData: string;
    source: 'URL';
  };
  
  type StorageData = {
    contacts: string;
    groupId: string;
    groupName: string;
    source: 'sessionStorage' | 'localStorage' | 'server';
  };
  
  type DataSource = ServerKeyData | UrlData | StorageData | null;

  // Функция для получения данных через API с ключом
  const fetchContactsWithKey = async (key: string): Promise<StorageData | null> => {
    try {
      console.log(`Получение данных контактов по ключу ${key} из серверного хранилища`);
      
      const controller = new AbortController();
      // Установим таймаут в 10 секунд
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`/api/temp-contacts/${key}`, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Ошибка API:', errorData);
        throw new Error(`Ошибка получения контактов: ${response.status}, ${errorData.error || ''}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.contacts || !Array.isArray(data.contacts)) {
        console.error('Некорректный формат данных от API:', data);
        throw new Error('Некорректный формат данных от сервера');
      }
      
      console.log(`Успешно получены данные из серверного хранилища: ${data.contacts.length} контактов`);
      
      if (data.contacts.length > 0) {
        console.log('Пример первого контакта:', data.contacts[0]);
      }
      
      return {
        contacts: JSON.stringify(data.contacts),
        groupId: (data.groupId || '0').toString(),
        groupName: data.groupName || 'Группа контактов',
        source: 'server'
      };
    } catch (e) {
      console.error("Ошибка при получении данных из серверного хранилища:", e);
      // Выводим более подробную информацию об ошибке
      if (e instanceof Error) {
        console.error('Сообщение ошибки:', e.message);
        console.error('Стек вызовов:', e.stack);
      }
      return null;
    }
  };

  // Функция для получения данных из URL параметров
  const getDataFromUrl = (): DataSource => {
    try {
      // Сначала проверяем, если есть параметр key
      const keyParam = getSearchParam('key');
      if (keyParam) {
        console.log("Найден ключ для серверного хранилища в URL");
        return {
          key: keyParam,
          source: 'serverKey'
        };
      }
      
      // Затем проверяем параметр data
      const dataParam = getSearchParam('data');
      if (dataParam) {
        console.log("Данные найдены в URL параметре");
        const decodedData = decodeURIComponent(dataParam);
        return {
          rawData: decodedData,
          source: 'URL'
        };
      }
    } catch (e) {
      console.error("Ошибка при получении данных из URL:", e);
    }
    return null;
  };

  // Функция для получения данных из хранилища
  const getStorageData = (): DataSource => {
    // Сначала проверяем данные из URL
    const urlData = getDataFromUrl();
    if (urlData) {
      return urlData;
    }
    
    // Затем проверяем sessionStorage
    try {
      console.log("Проверяем данные в sessionStorage");
      const contactsFromSession = sessionStorage.getItem('groupContacts');
      const groupIdFromSession = sessionStorage.getItem('groupId');
      const groupNameFromSession = sessionStorage.getItem('groupName');
      
      if (contactsFromSession && groupIdFromSession && groupNameFromSession) {
        console.log("Данные найдены в sessionStorage");
        return {
          contacts: contactsFromSession,
          groupId: groupIdFromSession,
          groupName: groupNameFromSession,
          source: 'sessionStorage'
        } as StorageData;
      }
    } catch (e) {
      console.error("Ошибка при доступе к sessionStorage:", e);
    }
    
    // Если не нашли в sessionStorage, проверяем localStorage
    try {
      console.log("Проверяем данные в localStorage");
      const contactsFromLocal = localStorage.getItem('groupContacts');
      const groupIdFromLocal = localStorage.getItem('groupId');
      const groupNameFromLocal = localStorage.getItem('groupName');
      
      if (contactsFromLocal && groupIdFromLocal && groupNameFromLocal) {
        console.log("Данные найдены в localStorage");
        return {
          contacts: contactsFromLocal,
          groupId: groupIdFromLocal,
          groupName: groupNameFromLocal,
          source: 'localStorage'
        } as StorageData;
      }
    } catch (e) {
      console.error("Ошибка при доступе к localStorage:", e);
    }
    
    return null;
  };
  
  // Функция очистки данных из хранилищ
  const clearStorageData = (source: string, preserveRequestData: boolean = false) => {
    try {
      if (source === 'sessionStorage' || source === 'both') {
        // Сохраняем важные данные, если требуется
        const requestId = preserveRequestData ? sessionStorage.getItem('requestId') : null;
        const selectedSuppliers = preserveRequestData ? sessionStorage.getItem('selectedSuppliers') : null;
        const requestParameters = preserveRequestData ? sessionStorage.getItem('requestParameters') : null;
        
        // Очищаем все данные из sessionStorage
        sessionStorage.clear();
        
        // Восстанавливаем важные данные, если требуется
        if (preserveRequestData) {
          if (requestId) sessionStorage.setItem('requestId', requestId);
          if (selectedSuppliers) sessionStorage.setItem('selectedSuppliers', selectedSuppliers);
          if (requestParameters) sessionStorage.setItem('requestParameters', requestParameters);
          console.log("Данные запроса сохранены в sessionStorage во время очистки");
        } else {
          console.log("Данные очищены из sessionStorage");
        }
      }
      
      if (source === 'localStorage' || source === 'both') {
        localStorage.removeItem('groupContacts');
        localStorage.removeItem('groupId');
        localStorage.removeItem('groupName');
        console.log("Данные очищены из localStorage");
      }
    } catch (e) {
      console.error("Ошибка при очистке хранилищ:", e);
    }
  };

  // Отдельный эффект для обработки выбора поставщиков на основе их отображения
  useEffect(() => {
    // Если мы пришли из группы контактов, автоматически выбираем всех поставщиков
    if (comingFromGroup && suppliers.length > 0) {
      console.log(`Автоматический выбор ${suppliers.length} поставщиков при переходе из группы контактов`);
      
      // Убедимся, что все поставщики выбраны - устанавливаем состояние напрямую здесь
      setSelectedSuppliers([...suppliers]);
      
      // Выводим в консоль подтверждение выбора
      console.log("ВЫБРАНЫ ВСЕ ПОСТАВЩИКИ:", suppliers.length);
    }
  }, [comingFromGroup, suppliers]);

  // Автоматически применяем фильтр "только уникальные" при загрузке новых поставщиков (кроме группы контактов)
  useEffect(() => {
    if (suppliers.length > 0 && uniqueEmailsOnly && !comingFromGroup && selectedSuppliers.length === 0) {
      console.log('Автоматическое применение фильтра "только уникальные" к загруженным поставщикам');
      const uniqueSuppliers = selectUniqueEmails();
      setSelectedSuppliers(uniqueSuppliers);
    }
  }, [suppliers, uniqueEmailsOnly, comingFromGroup]);

  // Загрузка контактов из группы при первом рендере
  useEffect(() => {
    console.log("Текущий URL:", location);
    console.log("window.location:", window.location.href);
    
    // FIRST: Check if we have suppliers in localStorage from the SendRequestButton component
    const suppliersFromSearch = localStorage.getItem('sendRequestSuppliers');
    const requestIdFromSearch = localStorage.getItem('sendRequestId');
    const showSupplierSelectionView = localStorage.getItem('showSupplierSelectionView') === 'true';
    const searchQueryFromStorage = localStorage.getItem('searchQuery') || '';
    
    console.log("suppliersFromSearch:", suppliersFromSearch ? "EXISTS" : "NULL");
    console.log("requestIdFromSearch:", requestIdFromSearch ? "EXISTS" : "NULL");
    console.log("showSupplierSelectionView:", showSupplierSelectionView);
    
    if (suppliersFromSearch) {
      try {
        console.log("Found suppliers in localStorage from search results");
        const parsedSuppliers = JSON.parse(suppliersFromSearch);
        console.log("Parsed suppliers sample:", parsedSuppliers[0]);
        console.log("Email format check:", parsedSuppliers[0]?.email, Array.isArray(parsedSuppliers[0]?.email));
        console.log("All suppliers email formats:", parsedSuppliers.slice(0, 3).map((s: any) => ({ 
          name: s.name, 
          email: s.email, 
          isArray: Array.isArray(s.email),
          length: Array.isArray(s.email) ? s.email.length : 1,
          rawEmail: s.email
        })));
        
        // Check if any supplier has multiple emails
        const suppliersWithMultipleEmails = parsedSuppliers.filter((s: any) => 
          Array.isArray(s.email) && s.email.length > 1
        );
        console.log("Suppliers with multiple emails:", suppliersWithMultipleEmails.length);
        if (suppliersWithMultipleEmails.length > 0) {
          console.log("Sample supplier with multiple emails:", suppliersWithMultipleEmails[0]);
        }
        
        // Create async function to handle subscription check and apply trial limitations
        const processSuppliers = async () => {
          try {
            // Ensure all suppliers have proper email format
            const processedSuppliers = parsedSuppliers.map((supplier: any) => {
              // Используем все email из rawEmails, allEmails или email
              let emails: string[] = [];
              if (supplier.rawEmails && Array.isArray(supplier.rawEmails) && supplier.rawEmails.length > 0) {
                emails = supplier.rawEmails;
              } else if (supplier.allEmails && Array.isArray(supplier.allEmails) && supplier.allEmails.length > 0) {
                emails = supplier.allEmails;
              } else if (Array.isArray(supplier.email)) {
                emails = supplier.email;
              } else if (supplier.email) {
                emails = [supplier.email];
              }
              const selectedEmail = emails[0] || '';
              return {
                ...supplier,
                email: emails,
                selectedEmail: selectedEmail
              } as ExtendedSupplier;
            });
            
            // Use suppliers directly without trying to enrich from database
            console.log('Using suppliers directly from staging_suppliers data');
            
            const limitedSuppliers = await applyTrialLimitations(processedSuppliers);
            setSuppliers(limitedSuppliers);
            // Автоматически выбираем первый email у каждого поставщика
            const suppliersWithFirstEmail = limitedSuppliers.map(supplier => ({
              ...supplier,
              selectedEmail: Array.isArray(supplier.email) ? supplier.email[0] : supplier.email
            }));
            setSelectedSuppliers(suppliersWithFirstEmail);
            console.log(`Loaded ${limitedSuppliers.length} suppliers from localStorage (search results) with full DB data`);
          } catch (error) {
            console.error('Error processing suppliers:', error);
          }
        };
        
        processSuppliers();
        
        // Set search query if available
        if (searchQueryFromStorage) {
          setSearchQuery(searchQueryFromStorage);
        }
        
        // Show supplier selection view for found suppliers
        setShowEmailForm(false);
        
        // If we have a request ID, load that request
        if (requestIdFromSearch) {
          const requestId = parseInt(requestIdFromSearch);
          // Skip if requestId looks like a timestamp (too large)
          if (!isNaN(requestId) && requestId < 100000) {
            const loadRequestData = async () => {
              try {
                const response = await fetch(`/api/search-requests/${requestId}`);
                if (response.ok) {
                  const requestData = await response.json();
                  setSearchRequest(requestData.request);
                  console.log("Loaded request with ID:", requestId);
                } else {
                  console.error("Error loading request:", response.statusText);
                }
              } catch (error) {
                console.error("Error loading request:", error);
              }
            };
            
            loadRequestData();
          }
        }
        
        // Clean up localStorage after successful loading
        setTimeout(() => {
          localStorage.removeItem('sendRequestSuppliers');
          localStorage.removeItem('sendRequestId');
          localStorage.removeItem('showSupplierSelectionView');
          localStorage.removeItem('searchQuery');
          console.log("Cleaned up localStorage after successful loading");
        }, 1000);
        
        return; // Skip the rest of the effect
      } catch (error) {
        console.error("Error parsing suppliers from localStorage:", error);
      }
    }
    
    // Проверяем, есть ли в URL параметр from=group или from=parameters
    const fromParam = getSearchParam('from');
    const isFromGroup = fromParam === 'group';
    const isFromParameters = fromParam === 'parameters';
    const showSelection = getSearchParam('showSelection') === 'true';
    
    // Также проверяем наличие флага parametersSelected в session storage
    // НО только если есть URL параметры - для прямого перехода из навигации очищаем все
    const hasUrlParams = window.location.search.length > 0;
    const parametersSelected = hasUrlParams && (isFromParameters || sessionStorage.getItem('parametersSelected') === 'true');
    
    console.log("Переход из группы (из параметра URL):", isFromGroup);
    console.log("Переход после выбора параметров:", parametersSelected);
    console.log("Показывать выбор поставщиков (из URL):", showSelection);
    
    // Check if we should show the supplier selection view
    if (hasUrlParams && (showSelection || sessionStorage.getItem('showSupplierSelectionView') === 'true')) {
      console.log("📋 Показываем вид выбора поставщиков вместо формы отправки");
      setShowEmailForm(false);
    }
    
    setComingFromGroup(isFromGroup);
    
    // Если пришли из группы контактов, загружаем данные из sessionStorage/localStorage
    if (isFromGroup) {
      console.log("Переход из группы контактов, загружаем данные из хранилищ");
      
      // Пробуем загрузить из sessionStorage, затем из localStorage как запасной вариант
      let suppliersFromGroup;
      
      // Первая попытка - sessionStorage
      const suppliersFromSession = sessionStorage.getItem('selectedSuppliers');
      if (suppliersFromSession) {
        try {
          suppliersFromGroup = JSON.parse(suppliersFromSession);
          console.log(`Загружено ${suppliersFromGroup.length} поставщиков из sessionStorage`);
        } catch (error) {
          console.error("Ошибка при чтении поставщиков из sessionStorage:", error);
        }
      }
      
      // Если из sessionStorage не удалось, пробуем localStorage
      if (!suppliersFromGroup) {
        const suppliersFromLocal = localStorage.getItem('selectedSuppliers');
        if (suppliersFromLocal) {
          try {
            suppliersFromGroup = JSON.parse(suppliersFromLocal);
            console.log(`Загружено ${suppliersFromGroup.length} поставщиков из localStorage (запасной вариант)`);
          } catch (error) {
            console.error("Ошибка при чтении поставщиков из localStorage:", error);
          }
        }
      }
      
      // Проверка groupId из URL
      const urlGroupId = getSearchParam('groupId');
      if (urlGroupId) {
        setGroupId(parseInt(urlGroupId));
        console.log(`ID группы из URL: ${urlGroupId}`);
        
        // Пробуем получить имя группы из storage
        const groupNameFromStorage = sessionStorage.getItem('groupName') || localStorage.getItem('groupName');
        if (groupNameFromStorage) {
          setGroupName(groupNameFromStorage);
          console.log(`Имя группы из хранилища: ${groupNameFromStorage}`);
        }
      }
      
      // Если нашли поставщиков, устанавливаем их в состояние с применением ограничений
      if (suppliersFromGroup && suppliersFromGroup.length > 0) {
        console.log(`Обновление поставщиков в форме:`, suppliersFromGroup.length);
        
        // Apply trial limitations before setting suppliers
        const processGroupSuppliers = async () => {
          const limitedSuppliers = await applyTrialLimitations(suppliersFromGroup);
          setSuppliers(limitedSuppliers);
          // Автоматически выбираем первый email у каждого поставщика
          const suppliersWithFirstEmail = limitedSuppliers.map(supplier => ({
            ...supplier,
            selectedEmail: Array.isArray(supplier.email) ? supplier.email[0] : supplier.email
          }));
          setSelectedSuppliers(suppliersWithFirstEmail);
        };
        
        processGroupSuppliers();
        
        // Всегда показываем выбор поставщиков при переходе из группы контактов
        setShowEmailForm(false);
        
        console.log("Автоматический выбор", suppliersFromGroup.length, "поставщиков при переходе из группы контактов");
      } else {
        console.error("Не удалось загрузить поставщиков из группы контактов");
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить контакты из группы. Попробуйте снова.",
          variant: "destructive"
        });
      }
      
      return; // Прерываем дальнейшее выполнение эффекта
    }
    
    // Если пришли после выбора параметров, то не очищаем хранилища
    if (parametersSelected) {
      console.log("Переход после выбора параметров, сохраняем данные в хранилищах");
      
      // Продолжаем работу с сохраненными в session storage параметрами и поставщиками
      const savedParameters = sessionStorage.getItem('requestParameters');
      const savedSuppliers = sessionStorage.getItem('selectedSuppliers');
      const savedRequestId = sessionStorage.getItem('requestId');
      
      if (savedSuppliers) {
        try {
          const parsedSuppliers = JSON.parse(savedSuppliers);
          
          // КРИТИЧНО: Восстанавливаем selectedEmail из сохраненных данных
          const suppliersWithSelectedEmail = parsedSuppliers.map((s: any) => ({
            ...s,
            selectedEmail: s.selectedEmail || (Array.isArray(s.email) ? s.email[0] : s.email)
          }));
          
          console.log(`[CRITICAL] Loaded selectedSuppliers from sessionStorage:`, suppliersWithSelectedEmail.map((s: any) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            selectedEmail: s.selectedEmail
          })));
          
          // Apply trial limitations before setting suppliers
          const processSessionSuppliers = async () => {
            const limitedSuppliers = await applyTrialLimitations(suppliersWithSelectedEmail);
            setSuppliers(limitedSuppliers);
            // КРИТИЧНО: Восстанавливаем selectedSuppliers с selectedEmail
            setSelectedSuppliers(limitedSuppliers);
            console.log(`[CRITICAL] Restored ${limitedSuppliers.length} selectedSuppliers with selectedEmail from sessionStorage`);
          };
          
          processSessionSuppliers();
        } catch (error) {
          console.error("Ошибка при чтении поставщиков из sessionStorage:", error);
        }
      }
      
      // Если есть ID запроса, загружаем его
      if (savedRequestId) {
        try {
          const requestId = parseInt(savedRequestId);
          // Skip if requestId looks like a timestamp (too large)
          if (!isNaN(requestId) && requestId < 100000) {
            // Загружаем данные запроса по ID
            const loadRequestData = async () => {
              try {
                const response = await fetch(`/api/search-requests/${requestId}`);
                if (response.ok) {
                  const requestData = await response.json();
                  setSearchRequest(requestData);
                  console.log("Загружен запрос с ID:", requestId);
                } else {
                  console.error("Ошибка при загрузке запроса:", response.statusText);
                }
              } catch (error) {
                console.error("Ошибка при загрузке запроса:", error);
              }
            };
            
            loadRequestData();
          }
        } catch (error) {
          console.error("Ошибка при обработке ID запроса:", error);
        }
      }
      
      setShowEmailForm(true); // Сразу показываем форму для email
      setIsLoading(false);
      return; // Продолжаем работу с параметрами
    }
    
    // Если переход после выбора параметров И есть URL параметры, показываем форму email
    if (parametersSelected && (isFromParameters || getSearchParam('requestId'))) {
      console.log("Переход после выбора параметров, сохраняем данные в хранилищах");
      
      // Получаем requestId из URL для загрузки данных запроса
      const requestIdParam = getSearchParam('requestId');
      if (requestIdParam) {
        try {
          const requestId = parseInt(requestIdParam);
          // Skip if requestId looks like a timestamp (too large)
          if (!isNaN(requestId) && requestId < 100000) {
            // Загружаем данные запроса по ID
            const loadRequestData = async () => {
              try {
                const response = await fetch(`/api/search-requests/${requestId}`);
                if (response.ok) {
                  const requestData = await response.json();
                  setSearchRequest(requestData);
                  console.log("Загружен запрос с ID:", requestId);
                } else {
                  console.error("Ошибка при загрузке запроса:", response.statusText);
                }
              } catch (error) {
                console.error("Ошибка при загрузке запроса:", error);
              }
            };
            
            loadRequestData();
          }
        } catch (error) {
          console.error("Ошибка при обработке ID запроса:", error);
        }
      }
      
      setShowEmailForm(true); // Сразу показываем форму для email
      setIsLoading(false);
      return; // Продолжаем работу с параметрами
    }
    
    // Если это прямой переход из навигации (без URL параметров), всегда показываем начальный экран
    if (!hasUrlParams) {
      // Очищаем все данные сессии для чистого старта
      sessionStorage.removeItem('parametersSelected');
      sessionStorage.removeItem('showSupplierSelectionView');
      sessionStorage.removeItem('selectedSuppliers');
      sessionStorage.removeItem('selectedParameters');
      sessionStorage.removeItem('productDescription');
      sessionStorage.removeItem('productName');
      sessionStorage.removeItem('deadline');
      localStorage.removeItem('sendRequestSuppliers');
      localStorage.removeItem('sendRequestId');
      localStorage.removeItem('showSupplierSelectionView');
      
      console.log("Прямой переход из навигации - все данные очищены, показываем начальный экран выбора поставщиков");
      
      // Очищаем состояние поставщиков и форм
      setSuppliers([]);
      setSelectedSuppliers([]);
      setGroupId(null);
      setGroupName(null);
      setProductDescription('');
      setProductName('');
      setDeadline('');
      
      // Показываем начальный вид выбора поставщиков
      setShowEmailForm(false);
      setIsLoading(false);
      
      return; // Прерываем выполнение эффекта
    }
    
    // Если нет параметра from=group и не переход после выбора параметров, проверяем есть ли данные поиска
    if (!isFromGroup && (!parametersSelected || !sessionStorage.getItem('selectedSuppliers'))) {
      // Проверяем, есть ли данные поиска в localStorage
      const suppliersFromSearch = localStorage.getItem('sendRequestSuppliers');
      const requestIdFromSearch = localStorage.getItem('sendRequestId');
      
      if (!suppliersFromSearch && !requestIdFromSearch) {
        // Очищаем sessionStorage, НЕ сохраняя данные запроса
        clearStorageData('both', false);
        console.log("Переход с URL параметрами но без данных - данные очищены из хранилищ");
        
        // Очищаем состояние поставщиков
        setSuppliers([]);
        setSelectedSuppliers([]);
        setGroupId(null);
        setGroupName(null);
        
        // Показываем вид выбора поставщиков (начальный экран с кнопками "Добавить поставщика", "Добавить из файла", "Добавить из контактов")
        setShowEmailForm(false);
        console.log("Показываем начальный вид выбора поставщиков");
        
        return; // Прерываем выполнение эффекта, т.к. нет нужды загружать данные
      } else {
        console.log("Найдены данные поиска в localStorage, продолжаем загрузку поставщиков");
      }
    }
    
    // Если это прямой переход без URL параметров, очищаем флаг parametersSelected
    if (!hasUrlParams && parametersSelected) {
      console.log("Прямой переход без URL параметров - очищаем флаг parametersSelected");
      sessionStorage.removeItem('parametersSelected');
      setShowEmailForm(false);
      return;
    }
    
    // Основная функция для обработки загрузки данных
    const loadData = async () => {
      try {
        // Сначала проверяем, есть ли ключ для серверного хранилища
        const keyParam = getSearchParam('key');
        if (keyParam) {
          console.log(`Обнаружен ключ для серверного хранилища: ${keyParam}`);
          
          try {
            const serverData = await fetchContactsWithKey(keyParam);
            if (serverData) {
              console.log("Данные успешно получены из серверного хранилища");
              
              const parsedContacts = JSON.parse(serverData.contacts || '[]');
              const groupNameValue = serverData.groupName || 'Группа';
              const groupIdValue = parseInt(serverData.groupId) || 0;
              
              console.log(`Получено ${parsedContacts.length} контактов из серверного хранилища`);
              
              // Преобразуем контакты в формат поставщиков
              const suppliersFromContacts = parsedContacts.map((contact: any) => ({
                id: contact.id || Math.floor(Math.random() * 100000),
                name: contact.name || 'Поставщик',
                email: contact.email || '',
                phone: contact.phone || null,
                website: '',
                categories: [],
                description: '',
                responseRate: null,
                successRate: null,
                keywords: [],
                totalRequests: null,
                successfulMatches: null,
                keywordStrength: null,
                lastResponseTime: null,
                // Добавляем недостающие поля для соответствия типу Supplier
                createdAt: new Date(),
                updatedAt: new Date(),
                verifiedResponses: 0,
                unverifiedResponses: 0,
                contactPerson: null,
                companySize: null,
                industry: null,
                location: null,
                notes: null,
                region: null,
                legalName: null,
                taxId: null,
                legalAddress: null,
                bankDetails: null
              }));
              
              // Apply trial limitations and update state
              const processContactSuppliers = async () => {
                // Use contact suppliers directly without trying to enrich from database
                console.log('Using contact suppliers directly from contact data');
                
                const limitedSuppliers = await applyTrialLimitations(suppliersFromContacts);
                setSuppliers(limitedSuppliers);
                // Автоматически выбираем первый email у каждого поставщика
                const suppliersWithFirstEmail = limitedSuppliers.map(supplier => ({
                  ...supplier,
                  selectedEmail: Array.isArray(supplier.email) ? supplier.email[0] : supplier.email
                }));
                setSelectedSuppliers(suppliersWithFirstEmail);
              };
              
              processContactSuppliers();
              setGroupId(groupIdValue);
              setGroupName(groupNameValue);
              
              toast({
                title: "Контакты загружены",
                description: `Загружено ${suppliersFromContacts.length} контактов из группы "${groupNameValue}"`,
              });
              
              return; // Завершаем функцию, так как данные успешно загружены
            }
          } catch (error) {
            console.error("Ошибка при получении данных из серверного хранилища:", error);
            // Продолжаем выполнение и пробуем другие методы
          }
        }
        
        // Получаем данные из других хранилищ, если серверное не сработало
        const storageData = getStorageData();
        
        if (storageData) {
          console.log(`Найдены данные в ${storageData.source}`);
          
          // Если не было установлено через URL, установим состояние
          if (!isFromGroup) {
            console.log(`Данные найдены в ${storageData.source}, но параметр URL отсутствует. Устанавливаем comingFromGroup = true`);
            setComingFromGroup(true);
          }
          
          console.log("Парсим данные контактов из", storageData.source);
          
          let parsedData: any;
          let parsedContacts: any[] = [];
          let groupNameValue: string = 'Группа';
          let groupIdValue: number = 0;
          
          // Обрабатываем данные в зависимости от источника
          if (storageData.source === 'URL' && 'rawData' in storageData) {
            // Если данные из URL, разбираем объект с данными
            parsedData = JSON.parse(storageData.rawData);
            parsedContacts = parsedData.contacts || [];
            groupNameValue = parsedData.groupName || 'Группа';
            groupIdValue = parseInt(parsedData.groupId) || 0;
            
            console.log("Данные из URL параметра:", {
              contactsCount: parsedContacts.length,
              groupName: groupNameValue,
              groupId: groupIdValue
            });
          } else if (
            (storageData.source === 'sessionStorage' || 
             storageData.source === 'localStorage' || 
             storageData.source === 'server') && 
            'contacts' in storageData
          ) {
            // Данные из хранилища - используем старую логику
            parsedContacts = JSON.parse(storageData.contacts || '[]');
            groupNameValue = storageData.groupName || 'Группа';
            groupIdValue = parseInt(storageData.groupId) || 0;
          }
          
          console.log("Количество контактов:", parsedContacts.length);
          
          // Преобразуем контакты в формат поставщиков, с проверкой на обязательные поля
          const suppliersFromContacts = parsedContacts.map((contact: any) => ({
            id: contact.id || Math.floor(Math.random() * 100000),
            name: contact.name || contact.company || 'Поставщик',
            email: contact.email || '',
            phone: contact.phone || null,
            userId: contact.user_id || null, // Добавляем userId для мультитенантности
            website: '',
            categories: [],
            description: '',
            responseRate: null,
            successRate: null,
            keywords: [],
            totalRequests: null,
            successfulMatches: null, 
            keywordStrength: null,
            lastResponseTime: null,
            // Добавляем недостающие поля для соответствия типу Supplier
            createdAt: new Date(),
            updatedAt: new Date(),
            verifiedResponses: 0,
            unverifiedResponses: 0,
            contactPerson: null,
            companySize: null,
            industry: null,
            location: null,
            notes: null,
            region: null,
            legalName: null,
            taxId: null,
            legalAddress: null,
            bankDetails: null
          }));
          
          console.log("Преобразованные поставщики:", suppliersFromContacts.length);
          
          // Apply trial limitations and set suppliers
          const processStorageSuppliers = async () => {
            const limitedSuppliers = await applyTrialLimitations(suppliersFromContacts);
            setSuppliers(limitedSuppliers);
            // Автоматически выбираем первый email у каждого поставщика
            const suppliersWithFirstEmail = limitedSuppliers.map(supplier => ({
              ...supplier,
              selectedEmail: Array.isArray(supplier.email) ? supplier.email[0] : supplier.email
            }));
            setSelectedSuppliers(suppliersWithFirstEmail);
          };
          
          processStorageSuppliers();
          
          // Устанавливаем информацию о группе
          setGroupId(groupIdValue);
          setGroupName(groupNameValue);
          
          // Очищаем данные из обоих хранилищ только после успешного создания компонентов
  // clearStorageData('both');
  console.log("Данные хранилищ не очищаются для обеспечения надежности");
          
          console.log("Данные контактов успешно загружены");
          
          // Выводим сообщение об успешной загрузке контактов
          toast({
            title: "Контакты загружены",
            description: `Загружено ${suppliersFromContacts.length} контактов из группы "${groupNameValue}"`,
          });
          return; // Завершаем функцию, так как данные успешно загружены
        } 
        
        console.log("Не найдены необходимые данные в хранилищах");
        
        // Если параметр URL указывает на переход из группы, но данных нет,
        // попробуем загрузить данные группы напрямую (запасной вариант)
        if (isFromGroup) {
          const groupIdFromUrl = getSearchParam('groupId');
          if (groupIdFromUrl) {
            console.log(`Попытка загрузить контакты для группы ${groupIdFromUrl} напрямую`);
            
            try {
              // Сначала загружаем информацию о группе
              const groupResponse = await fetch(`/api/contact-groups/${groupIdFromUrl}`);
              if (!groupResponse.ok) {
                throw new Error(`Ошибка загрузки группы: ${groupResponse.status}`);
              }
              
              const groupData = await groupResponse.json();
              console.log("Данные группы:", groupData);
              
              if (groupData && groupData.group) {
                setGroupId(parseInt(groupIdFromUrl));
                setGroupName(groupData.group.name);
                console.log(`Группа ${groupData.group.name} успешно загружена`);
                
                // Затем загружаем контакты
                const contactsResponse = await fetch(`/api/contact-groups/${groupIdFromUrl}/contacts`);
                if (!contactsResponse.ok) {
                  throw new Error(`Ошибка загрузки контактов: ${contactsResponse.status}`);
                }
                
                const contacts = await contactsResponse.json();
                console.log(`Загружено ${contacts.length} контактов напрямую`, contacts);
                
                if (contacts && contacts.length > 0) {
                  // Преобразуем контакты в формат поставщиков
                  const suppliersFromContacts = contacts.map((contact: any) => ({
                    id: contact.id || Math.floor(Math.random() * 100000),
                    name: contact.name || 'Поставщик',
                    email: contact.email || '',
                    phone: contact.phone || null,
                    website: '',
                    categories: [],
                    description: '',
                    responseRate: null,
                    successRate: null,
                    keywords: [],
                    totalRequests: null,
                    successfulMatches: null,
                    keywordStrength: null,
                    lastResponseTime: null,
                    // Добавляем недостающие поля для соответствия типу Supplier
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    verifiedResponses: 0,
                    unverifiedResponses: 0,
                    contactPerson: null,
                    companySize: null,
                    industry: null,
                    location: null,
                    notes: null,
                    region: null,
                    legalName: null,
                    taxId: null,
                    legalAddress: null,
                    bankDetails: null
                  }));
                  
                  console.log("Установка поставщиков:", suppliersFromContacts.length);
                  
                  // Apply trial limitations and update component state
                  const processDirectSuppliers = async () => {
                    const limitedSuppliers = await applyTrialLimitations(suppliersFromContacts);
                    setSuppliers(limitedSuppliers);
                    // ИСПРАВЛЕНИЕ: Не выбираем всех поставщиков автоматически
                    setSelectedSuppliers([]);
                  };
                  
                  processDirectSuppliers();
                  
                  toast({
                    title: "Контакты загружены напрямую",
                    description: `Загружено ${suppliersFromContacts.length} контактов из группы "${groupData.group.name}"`,
                  });
                } else {
                  console.log("Список контактов пуст");
                  toast({
                    title: "Внимание",
                    description: "В группе нет контактов",
                    variant: "destructive",
                  });
                }
              } else {
                console.error("Группа не найдена");
                toast({
                  title: "Ошибка",
                  description: "Группа не найдена",
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error("Ошибка при прямой загрузке контактов:", error);
              toast({
                title: "Ошибка загрузки",
                description: typeof error === 'object' && error !== null 
                  ? (error as Error).message || "Не удалось загрузить контакты" 
                  : "Не удалось загрузить контакты",
                variant: "destructive",
              });
            }
          }
        }
      } catch (error) {
        console.error("Ошибка при загрузке контактов из группы:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить контакты из группы",
          variant: "destructive",
        });
      }
    };
    
    // Запускаем функцию загрузки данных
    loadData().finally(() => {
      setIsLoading(false);
    });
    
  }, [location, toast]);

  return (
    <RequestLockdown pageName="Отправить запрос">
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <SubscriptionAlerts />
        <SubscriptionGuard isActive={isActiveOrLoading}>
        <div className="container mx-auto px-4 py-8 max-w-[1500px]">
       
        <div className="mt-4">
          <div 
            className="grid grid-cols-1" 
            data-onboarding-id={
              showEmailForm || getSearchParam('requestId') ? "send-request-email-hero" : "send-request-hero"
            }
          >
            <h2 className="text-2xl font-semibold">Отправить запрос поставщикам</h2>
            <div className="text-m text-gray-400">
              Выберите поставщиков и отправьте запрос на получение коммерческих предложений
            </div>
            {comingFromGroup && groupName && (
      
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Группа: {groupName}
                </Badge>
                <Link href={`/contact-groups/${groupId}`}>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Вернуться к группе
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {!showEmailForm ? (
            <>
              {/* Product info and deadline fields */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
                <div className="space-y-2 hidden"> {/* Добавлен hidden */}
                  <Label htmlFor="productName">Название продукта</Label>
                  <Input
                    id="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Введите название продукта"
                  />
                </div>

                <div className="space-y-2 hidden"> {/* Добавлен hidden */}
                  <Label htmlFor="deadline">Предложения подать до</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="выберете дату окончания приема предложений"
                    className="text-muted-foreground"
                  />
                  <div className="text-xs text-muted-foreground max-w-[600px] whitespace-nowrap">
                    время по умолчанию: до 18 часов (GMT+3)
                  </div>
                </div>
              </div>

              <div className="mb-6" data-onboarding-id="send-request-add-suppliers">
                <div className="flex gap-4 flex-wrap lg:flex-nowrap items-stretch">
                  <CustomSupplierInput onSupplierAdded={handleAddSupplier} />
                  <div className="hidden">
                    <UploadSuppliersExcel onSuppliersUploaded={handleBulkUpload} />
                  </div>
                  <LoadFromContacts onContactsLoaded={(suppliers, groupName, groupId) => {
                    handleBulkUpload(suppliers);
                    setGroupName(groupName);
                    setGroupId(groupId);
                    setComingFromGroup(true);
                    
                    // Сохраняем groupId в localStorage для последующей проверки в email-form
                    if (groupId) {
                      localStorage.setItem('groupId', String(groupId));
                      localStorage.setItem('groupName', groupName);
                    }
                  }} />
                  <div className="flex-1 min-w-[280px]">
                    <div className="flex items-start gap-3 h-full rounded-md border border-blue-200 bg-blue-50/70 px-4 py-3 shadow-[0_1px_3px_rgba(59,130,246,0.15)]">
                      <div className="rounded-full bg-blue-100 p-1">
                        <Info className="h-4 w-4 text-blue-700" />
                      </div>
                      <div className="text-sm text-blue-900 space-y-1">
                        <p className="font-semibold leading-none">Внимание!</p>
                        <p className="leading-snug">
                          Отправляйте запросы только подходящим компаниям.
                          Отправка нерелевантных писем может оказывать негативное влияние на репутацию вашей компании.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Card data-onboarding-id="send-request-suppliers-list">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                      <CardTitle>Выбранные поставщики</CardTitle>
                      {searchQuery && (
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
                            <Search className="h-4 w-4 text-blue-600 mr-2" />
                            <span className="text-sm font-medium text-blue-800">
                              Поиск: "{searchQuery}"
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="unique-emails" 
                          checked={uniqueEmailsOnly}
                          onCheckedChange={handleUniqueEmailsToggle}
                          disabled={suppliers.length === 0}
                        />
                        <label 
                          htmlFor="unique-emails" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Только уникальные
                        </label>
                        {/* Скрыта кнопка "Выделить все", но код сохранен для возможного использования в будущем */}
                        <Checkbox
                          id="select-all"
                          checked={suppliers.length > 0 && selectedSuppliers.length === suppliers.length}
                          onCheckedChange={handleSelectAll}
                          disabled={suppliers.length === 0}
                          className="hidden"
                        />
                        
                        <label 
                          htmlFor="select-all" 
                          className="hidden text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Выделить все
                        </label>
                      </div>
                      <div data-onboarding-id="send-request-continue-button">
                        <Button
                          variant="default"
                          className="flex items-center gap-2"
                          disabled={getSelectedEmailsCount() === 0}
                          onClick={handleContinueToParameters}
                        >
                          <Mail className="h-4 w-4" />
                          Отправить запрос ({getSelectedEmailsCount()})
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {suppliers.length === 0 && !comingFromGroup ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Нет выбранных поставщиков. Добавьте поставщиков для отправки запроса.</p>
                    </div>
                  ) : suppliers.length > 0 ? (
                    <div className="space-y-4">
                      {/* Trial limitation message at top */}
                      {trialLimitMessage && (
                        <Alert className="bg-amber-50 border-amber-200">
                          <Info className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-700 font-medium">
                            {trialLimitMessage}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <ScrollArea className="h-[400px] rounded-md">
                        <div className="rounded-md border w-full max-w-[1500px]">
                          <table className="w-full">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="w-[40px] px-1 py-2 text-sm font-medium text-center">#</th>
                                <th className="text-left px-2 py-2 text-sm font-medium w-[100px]">Компания</th>
                                <th className="text-left px-2 py-2 text-sm font-medium w-[180px]">Email</th>
                                <th className="text-left px-2 py-2 text-sm font-medium w-[100px]">Сайт</th>
                                <th className="text-left px-2 py-2 text-sm font-medium hidden">Title</th>
                                <th className="text-left px-2 py-2 text-sm font-medium min-w-[350px]">Описание</th>
                                <th className="w-[25px] px-0 py-2"></th>
                                <th className="w-[30px] px-0 py-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {suppliers
                                .sort((a, b) => {
                                  // Сортируем по доменам, чтобы одинаковые домены были рядом
                                  const domainA = getDomainFromWebsite(a.website || '');
                                  const domainB = getDomainFromWebsite(b.website || '');
                                  
                                  if (domainA === domainB) return 0;
                                  if (!domainA) return 1;
                                  if (!domainB) return -1;
                                  
                                  return domainA.localeCompare(domainB);
                                })
                                .map((supplier, index) => (
                                <tr key={supplier.id} className={index % 2 === 1 ? "bg-muted/20" : ""}>
                                  <td className="px-1 py-1 text-center text-sm text-muted-foreground w-[40px]">
                                    {index + 1}
                                  </td>
                                  <td className="px-2 py-1 w-[100px]">
                                    <p className="font-medium text-sm truncate" title={decodePunycode(supplier.name || '')}>
                                      {decodePunycode(supplier.name || '')}
                                    </p>
                                  </td>
                                  <td className="px-2 py-1 w-[180px]">
                                    {supplier.email && (
                                      <div className="space-y-1">
                                        {Array.isArray(supplier.email) && supplier.email.length > 0 ? (
                                          supplier.email.map((email, idx) => {
                                            // Проверяем, выбран ли этот email
                                            const selectedSupplier = selectedSuppliers.find(s => s.id === supplier.id);
                                            const isEmailSelected = selectedSupplier?.selectedEmail === email;
                                            
                                            return (
                                              <div key={idx} className="flex items-center gap-2">
                                                <Checkbox
                                                  checked={isEmailSelected}
                                                  onCheckedChange={(checked) => {
                                                    handleEmailSelection(supplier, email, checked as boolean);
                                                  }}
                                                  className="h-3.5 w-3.5"
                                                />
                                                <p 
                                                  className={`text-xs flex-1 cursor-pointer transition-colors ${
                                                    isEmailSelected 
                                                      ? 'text-blue-700 font-semibold' 
                                                      : 'text-blue-600 hover:text-blue-800'
                                                  }`}
                                                  title={isEmailSelected ? "Выбранный email для отправки" : "Выберите этот email для отправки"}
                                                  onClick={() => handleEmailSelection(supplier, email, !isEmailSelected)}>
                                                  {cleanEmail(email)}
                                                </p>
                                              </div>
                                            );
                                          })
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <Checkbox
                                              checked={selectedSuppliers.some(s => s.id === supplier.id)}
                                              onCheckedChange={(checked) => {
                                                handleEmailSelection(supplier, supplier.email as string, checked as boolean);
                                              }}
                                              className="h-3.5 w-3.5"
                                            />
                                            <p className="text-sm text-blue-600">{cleanEmail(supplier.email)}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 w-[100px]">
                                    {supplier.website ? (
                                      <a 
                                        href={supplier.website.startsWith('http') ? supplier.website : `http://${supplier.website}`}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block"
                                        onClick={(e) => e.stopPropagation()}
                                        title={(() => {
                                          try {
                                            const url = supplier.website.startsWith('http') ? supplier.website : `http://${supplier.website}`;
                                            const domain = new URL(url).hostname;
                                            const cleaned = domain.replace('www.', '');
                                            return decodePunycode(cleaned);
                                          } catch {
                                            return decodePunycode(supplier.website);
                                          }
                                        })()}
                                      >
                                        {(() => {
                                          try {
                                            const url = supplier.website.startsWith('http') ? supplier.website : `http://${supplier.website}`;
                                            const domain = new URL(url).hostname;
                                            const cleaned = domain.replace('www.', '');
                                            // Decode Punycode domain
                                            return decodePunycode(cleaned);
                                          } catch {
                                            // If URL parsing fails, try to decode the website string directly
                                            return decodePunycode(supplier.website);
                                          }
                                        })()}
                                      </a>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 w-[180px] hidden">
                                    {supplier.pageTitle ? (
                                      <p
                                        className="text-sm text-muted-foreground break-words"
                                        title={supplier.pageTitle}
                                        style={{
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          wordBreak: 'break-word'
                                        }}
                                      >
                                        {supplier.pageTitle}
                                      </p>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1 min-w-[350px]">
                                    {supplier.description ? (
                                      <p 
                                        className="text-sm text-muted-foreground break-words" 
                                        title={supplier.description}
                                        style={{
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          wordBreak: 'break-word'
                                        }}
                                      >
                                        {supplier.description}
                                      </p>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                  </td>
                                  <td className="px-0 py-1 text-center w-[25px]">
                                    <SupplierTooltip supplier={convertToTooltipSupplier(supplier)}>
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 w-6 p-0 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-pointer"
                                            title="Кликните для просмотра информации о поставщике"
                                          >
                                            <Info className="h-3 w-3" />
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                                          <DialogHeader className="flex-shrink-0">
                                            <DialogTitle>Информация о поставщике</DialogTitle>
                                          </DialogHeader>
                                          <ScrollArea className="flex-1 pr-4">
                                            <div className="space-y-3">
                                              <div>
                                                <Label className="text-sm font-medium">Название компании</Label>
                                                <p className="text-sm">{supplier.name}</p>
                                              </div>
                                              {supplier.email && (
                                                <div>
                                                  <Label className="text-sm font-medium">
                                                    Email{Array.isArray(supplier.email) && supplier.email.length > 1 ? ` (${supplier.email.length})` : ''}
                                                  </Label>
                                                  {Array.isArray(supplier.email) && supplier.email.length > 0 ? (
                                                    <div className="space-y-2 mt-2">
                                                      {supplier.email.map((email, idx) => {
                                                        // Проверяем, выбран ли этот email
                                                        const selectedSupplier = selectedSuppliers.find(s => s.id === supplier.id);
                                                        const isEmailSelected = selectedSupplier?.selectedEmail === email;
                                                        
                                                        return (
                                                          <div key={idx} className="flex items-center gap-2">
                                                            <Checkbox
                                                              checked={isEmailSelected}
                                                              onCheckedChange={(checked) => {
                                                                handleEmailSelection(supplier, email, checked as boolean);
                                                              }}
                                                              className="h-4 w-4"
                                                            />
                                                            <p 
                                                              className={`text-sm flex-1 cursor-pointer transition-colors ${
                                                                isEmailSelected 
                                                                  ? 'text-blue-700 font-semibold' 
                                                                  : 'text-blue-600 hover:text-blue-800'
                                                              }`}
                                                              title={isEmailSelected ? "✓ Выбранный email для отправки" : "Выберите этот email для отправки"}
                                                              onClick={() => handleEmailSelection(supplier, email, !isEmailSelected)}>
                                                              {cleanEmail(email)}
                                                            </p>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center gap-2 mt-2">
                                                      <Checkbox
                                                        checked={selectedSuppliers.some(s => s.id === supplier.id)}
                                                        onCheckedChange={(checked) => {
                                                          handleEmailSelection(supplier, supplier.email as string, checked as boolean);
                                                        }}
                                                        className="h-4 w-4"
                                                      />
                                                      <p className="text-sm">{cleanEmail(supplier.email)}</p>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              {supplier.phone && (
                                                <div>
                                                  <Label className="text-sm font-medium">Телефон</Label>
                                                  <p className="text-sm">{supplier.phone}</p>
                                                </div>
                                              )}
                                              {supplier.website && (
                                                <div>
                                                  <Label className="text-sm font-medium">Веб-сайт</Label>
                                                  <p className="text-sm break-all">
                                                    {supplier.website.startsWith('http') ? supplier.website : `http://${supplier.website}`}
                                                  </p>
                                                </div>
                                              )}
                                              {supplier.description && (
                                                <div>
                                                  <Label className="text-sm font-medium">Описание</Label>
                                                  <p className="text-sm">{supplier.description}</p>
                                                </div>
                                              )}
                                            </div>
                                          </ScrollArea>
                                        </DialogContent>
                                      </Dialog>
                                    </SupplierTooltip>
                                  </td>
                                  <td className="px-0 py-1 text-center w-[30px]">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleRemoveSupplier(supplier.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="p-3 text-sm text-muted-foreground border-t">
                            Итого загружено контактов: {suppliers.length}. Уникальных доменов: {
                              Array.from(groupSuppliersByDomain(suppliers).keys()).length
                            }
                          </div>
                        </div>
                      </ScrollArea>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
                
                
              </div>
              {selectedSuppliers.length > 0 ? (
                <div data-onboarding-id="send-request-email-form">
                  <Alert className="mb-4">
                    <AlertTitle>Выбрано email:  {getSelectedEmailsCount()}</AlertTitle>
                    <AlertDescription>
                      Запрос будет отправлен на все выбранные email адреса.
                    </AlertDescription>
                  </Alert>
                  <EmailForm 
                    suppliers={suppliers.map(convertToSupplier)} 
                    selectedSuppliers={(() => {
                      const converted = selectedSuppliers.map(convertToSupplier);
                      console.log(`[CRITICAL] Passing selectedSuppliers to EmailForm:`, converted.map(s => ({
                        id: s.id,
                        name: s.name,
                        email: s.email,
                        selectedEmail: (s as any).selectedEmail
                      })));
                      return converted;
                    })()} 
                    searchRequest={searchRequest || createEmptyRequest()}
                    comingFromGroup={comingFromGroup}
                    groupId={groupId}
                  />
                </div>
              ) : (
                <div className="flex justify-center items-center" style={{ minHeight: '120px' }}>
                  <div className="text-gray-500">Загрузка...</div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </SubscriptionGuard>
      </div>
    </RequestLockdown>
  );
}