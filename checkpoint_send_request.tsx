import { useState, useEffect } from "react";
import { MainNavigation } from "@/components/main-navigation";
import { CustomSupplierInput } from "@/components/custom-supplier-input";
import { UploadSuppliersExcel } from "@/components/upload-suppliers-excel";
import { LoadFromContacts } from "@/components/load-from-contacts";

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
  selectedEmail?: string;
};

// Helper function to convert ExtendedSupplier to Supplier for compatibility
const convertToSupplier = (extended: ExtendedSupplier): Supplier => ({
  ...extended,
  email: Array.isArray(extended.email) ? (extended.selectedEmail || extended.email[0] || '') : extended.email
});

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

  // Helper function to apply trial limitations to suppliers
  const applyTrialLimitations = async (suppliers: ExtendedSupplier[]) => {
    try {
      const response = await fetch('/api/subscriptions/status');
      const subscription = response.ok ? await response.json() : null;
      const isTrialUser = subscription?.subscription?.plan === 'trial';
      const maxSuppliersForTrial = 10;
      
      if (isTrialUser && suppliers.length > maxSuppliersForTrial) {
        const limitedSuppliers = suppliers.slice(0, maxSuppliersForTrial);
        const message = `╨Э╨░╨╣╨┤╨╡╨╜╨╛ ╨▓╤Б╨╡╨│╨╛ ${suppliers.length} ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓. ╨Т ╨┐╤А╨╛╨▒╨╜╨╛╨╣ ╨▓╨╡╤А╤Б╨╕╨╕ ╨┤╨╛╤Б╤В╤Г╨┐╨╜╤Л ╨┐╨╡╤А╨▓╤Л╨╡ ${maxSuppliersForTrial} ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓`;
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
    if (selectedSuppliers.length === 0) {
      toast({
        title: "╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓",
        description: "╨Я╨╛╨╢╨░╨╗╤Г╨╣╤Б╤В╨░, ╨▓╤Л╨▒╨╡╤А╨╕╤В╨╡ ╤Е╨╛╤В╤П ╨▒╤Л ╨╛╨┤╨╜╨╛╨│╨╛ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░ ╨┤╨╗╤П ╨┐╤А╨╛╨┤╨╛╨╗╨╢╨╡╨╜╨╕╤П.",
        variant: "destructive",
      });
      return;
    }
    
    // Store selected suppliers in session storage for the parameters page
    try {
      sessionStorage.setItem('selectedSuppliers', JSON.stringify(selectedSuppliers));
      if (searchRequest?.id) {
        sessionStorage.setItem('requestId', searchRequest.id.toString());
      }
      
      // Redirect to parameter selection page
      setLocation(`/select-request-parameters`);
    } catch (error) {
      console.error('Error saving suppliers to session storage:', error);
      toast({
        title: "╨Ю╤И╨╕╨▒╨║╨░",
        description: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╤Б╨╛╤Е╤А╨░╨╜╨╕╤В╤М ╨▓╤Л╨▒╤А╨░╨╜╨╜╤Л╤Е ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓. ╨Я╨╛╨╢╨░╨╗╤Г╨╣╤Б╤В╨░, ╨┐╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨╡╤Й╨╡ ╤А╨░╨╖.",
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
  };

  const handleBulkUpload = (newSuppliers: ExtendedSupplier[]) => {
    setSuppliers(prev => [...prev, ...newSuppliers]);
  };

  const handleRemoveSupplier = (id: number | string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setSelectedSuppliers(prev => prev.filter(s => s.id !== id));
  };

  // Helper function to clean email address
  const cleanEmail = (email: string): string => {
    if (!email) return "";
    
    // Remove leading slashes, spaces, and other unwanted characters
    let cleaned = email.trim();
    
    // Remove common prefixes that shouldn't be in email
    cleaned = cleaned.replace(/^[\/\\\s]+/, ''); // Remove leading slashes and spaces
    cleaned = cleaned.replace(/^mailto:/i, ''); // Remove mailto: prefix
    cleaned = cleaned.replace(/^email:/i, ''); // Remove email: prefix
    
    // Remove any trailing slashes or spaces
    cleaned = cleaned.replace(/[\/\\\s]+$/, '');
    
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

  // Function to group suppliers by domain
  const groupSuppliersByDomain = (suppliers: ExtendedSupplier[]) => {
    const groups = new Map<string, ExtendedSupplier[]>();
    
    suppliers.forEach(supplier => {
      const website = supplier.website || '';
      const domain = getDomainFromWebsite(website);
      
      if (!domain) {
        // ╨Я╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╕ ╨▒╨╡╨╖ ╤Б╨░╨╣╤В╨░ - ╨╛╤В╨┤╨╡╨╗╤М╨╜╨░╤П ╨│╤А╤Г╨┐╨┐╨░
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
          const bestEmailA = findBestEmail(emailsA);
          const bestEmailB = findBestEmail(emailsB);
          
          const salesKeywords = ['sales', '╨┐╤А╨╛╨┤╨░╨╢╨╕', '╨╖╨░╨║╨░╨╖', 'order', 'commercial', '╨║╨╛╨╝╨╝╨╡╤А╤З╨╡╤Б╨║╨╕╨╣', 'info'];
          const aHasSalesKeyword = salesKeywords.some(keyword => cleanEmail(bestEmailA).toLowerCase().includes(keyword));
          const bHasSalesKeyword = salesKeywords.some(keyword => cleanEmail(bestEmailB).toLowerCase().includes(keyword));
          
          if (aHasSalesKeyword && !bHasSalesKeyword) return -1;
          if (!aHasSalesKeyword && bHasSalesKeyword) return 1;
          return 0;
        });
        
        // Select the best supplier and set their best email
        const bestSupplier = sortedGroup[0];
        const allEmails = Array.isArray(bestSupplier.email) ? bestSupplier.email : [bestSupplier.email];
        const bestEmail = findBestEmail(allEmails);
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
  const findBestEmail = (emails: string[]): string => {
    if (!emails || emails.length === 0) return '';
    if (emails.length === 1) return emails[0];
    
    const salesKeywords = ['sales', '╨┐╤А╨╛╨┤╨░╨╢╨╕', '╨╖╨░╨║╨░╨╖', 'order', 'commercial', '╨║╨╛╨╝╨╝╨╡╤А╤З╨╡╤Б╨║╨╕╨╣', 'info'];
    
    // First priority: sales-related emails
    for (const email of emails) {
      if (!email) continue;
      const cleanEmailLower = cleanEmail(email).toLowerCase();
      if (salesKeywords.some(keyword => cleanEmailLower.includes(keyword))) {
        return email;
      }
    }
    
    // Second priority: info emails
    for (const email of emails) {
      if (!email) continue;
      const cleanEmailLower = cleanEmail(email).toLowerCase();
      if (cleanEmailLower.includes('info')) {
        return email;
      }
    }
    
    // Default: return first non-empty email
    return emails.find(email => email && email.trim()) || emails[0];
  };

  // Function to handle email selection within a supplier
  const handleEmailSelection = (supplier: ExtendedSupplier, selectedEmail: string) => {
    // Update the supplier's selectedEmail
    const updatedSupplier = { ...supplier, selectedEmail: selectedEmail };
    
    // Update in the main suppliers list
    setSuppliers(prev => 
      prev.map(s => s.id === supplier.id ? updatedSupplier : s)
    );
    
    // If supplier is already selected, update the selection
    if (selectedSuppliers.some(s => s.id === supplier.id)) {
      setSelectedSuppliers(prev => 
        prev.map(s => s.id === supplier.id ? updatedSupplier : s)
      );
    }
    
    // Show a toast notification
    toast({
      title: "Email ╨▓╤Л╨▒╤А╨░╨╜",
      description: `╨Т╤Л╨▒╤А╨░╨╜ email: ${cleanEmail(selectedEmail)}`,
    });
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // ╨Э╨Ю╨Т╨Р╨п ╨Ы╨Ю╨У╨Ш╨Ъ╨Р: ╨Я╤А╨╕ ╨░╨║╤В╨╕╨▓╨░╤Ж╨╕╨╕ "╨Т╤Л╨┤╨╡╨╗╨╕╤В╤М ╨▓╤Б╨╡" ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕ ╨╛╤В╨║╨╗╤О╤З╨░╨╡╨╝ "╨в╨╛╨╗╤М╨║╨╛ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╡"
      if (uniqueEmailsOnly) {
        setUniqueEmailsOnly(false);
      }
      setSelectedSuppliers([...suppliers]);
    } else {
      // ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х: ╨Х╤Б╨╗╨╕ ╨▓╨║╨╗╤О╤З╨╡╨╜ ╤Д╨╕╨╗╤М╤В╤А "╤В╨╛╨╗╤М╨║╨╛ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╡", ╨┐╤А╨╕╨╝╨╡╨╜╤П╨╡╨╝ ╨╡╨│╨╛ ╨▓╨╝╨╡╤Б╤В╨╛ ╨┐╨╛╨╗╨╜╨╛╨╣ ╨╛╤З╨╕╤Б╤В╨║╨╕
      if (uniqueEmailsOnly) {
        const uniqueSuppliers = selectUniqueEmails();
        setSelectedSuppliers(uniqueSuppliers);
      } else {
        setSelectedSuppliers([]);
      }
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
      // ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х: ╨Я╤А╨╕ ╨▓╤Л╨║╨╗╤О╤З╨╡╨╜╨╕╨╕ "╤В╨╛╨╗╤М╨║╨╛ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╡" ╨╛╤З╨╕╤Й╨░╨╡╨╝ ╨▓╤Л╨▒╨╛╤А
      // ╨н╤В╨╛ ╨┐╨╛╨╖╨▓╨╛╨╗╤П╨╡╤В ╨┐╨╛╨╗╤М╨╖╨╛╨▓╨░╤В╨╡╨╗╤О ╨▓╤Л╨║╨╗╤О╤З╨╕╤В╤М ╨╛╨▒╨░ ╤З╨╡╨║╨▒╨╛╨║╤Б╨░ ╨┤╨╗╤П ╤А╤Г╤З╨╜╨╛╨│╨╛ ╨▓╤Л╨▒╨╛╤А╨░
      setSelectedSuppliers([]);
    }
  };

  // ╨д╤Г╨╜╨║╤Ж╨╕╤П ╨┤╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓ ╨╕╨╖ URL
  const getSearchParam = (param: string): string | null => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      return url.searchParams.get(param);
    }
    return null;
  };

  // ╨в╨╕╨┐╤Л ╨┤╨╗╤П ╤А╨░╨╖╨╜╤Л╤Е ╨╕╤Б╤В╨╛╤З╨╜╨╕╨║╨╛╨▓ ╨┤╨░╨╜╨╜╤Л╤Е
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

  // ╨д╤Г╨╜╨║╤Ж╨╕╤П ╨┤╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨┤╨░╨╜╨╜╤Л╤Е ╤З╨╡╤А╨╡╨╖ API ╤Б ╨║╨╗╤О╤З╨╛╨╝
  const fetchContactsWithKey = async (key: string): Promise<StorageData | null> => {
    try {
      console.log(`╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╡ ╨┤╨░╨╜╨╜╤Л╤Е ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┐╨╛ ╨║╨╗╤О╤З╤Г ${key} ╨╕╨╖ ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░`);
      
      const controller = new AbortController();
      // ╨г╤Б╤В╨░╨╜╨╛╨▓╨╕╨╝ ╤В╨░╨╣╨╝╨░╤Г╤В ╨▓ 10 ╤Б╨╡╨║╤Г╨╜╨┤
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
        console.error('╨Ю╤И╨╕╨▒╨║╨░ API:', errorData);
        throw new Error(`╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓: ${response.status}, ${errorData.error || ''}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.contacts || !Array.isArray(data.contacts)) {
        console.error('╨Э╨╡╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ ╤Д╨╛╤А╨╝╨░╤В ╨┤╨░╨╜╨╜╤Л╤Е ╨╛╤В API:', data);
        throw new Error('╨Э╨╡╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Л╨╣ ╤Д╨╛╤А╨╝╨░╤В ╨┤╨░╨╜╨╜╤Л╤Е ╨╛╤В ╤Б╨╡╤А╨▓╨╡╤А╨░');
      }
      
      console.log(`╨г╤Б╨┐╨╡╤И╨╜╨╛ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╤Л ╨┤╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░: ${data.contacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓`);
      
      if (data.contacts.length > 0) {
        console.log('╨Я╤А╨╕╨╝╨╡╤А ╨┐╨╡╤А╨▓╨╛╨│╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨░:', data.contacts[0]);
      }
      
      return {
        contacts: JSON.stringify(data.contacts),
        groupId: (data.groupId || '0').toString(),
        groupName: data.groupName || '╨У╤А╤Г╨┐╨┐╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓',
        source: 'server'
      };
    } catch (e) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╕ ╨┤╨░╨╜╨╜╤Л╤Е ╨╕╨╖ ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░:", e);
      // ╨Т╤Л╨▓╨╛╨┤╨╕╨╝ ╨▒╨╛╨╗╨╡╨╡ ╨┐╨╛╨┤╤А╨╛╨▒╨╜╤Г╤О ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛╨▒ ╨╛╤И╨╕╨▒╨║╨╡
      if (e instanceof Error) {
        console.error('╨б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡ ╨╛╤И╨╕╨▒╨║╨╕:', e.message);
        console.error('╨б╤В╨╡╨║ ╨▓╤Л╨╖╨╛╨▓╨╛╨▓:', e.stack);
      }
      return null;
    }
  };

  // ╨д╤Г╨╜╨║╤Ж╨╕╤П ╨┤╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨┤╨░╨╜╨╜╤Л╤Е ╨╕╨╖ URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓
  const getDataFromUrl = (): DataSource => {
    try {
      // ╨б╨╜╨░╤З╨░╨╗╨░ ╨┐╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╨╡╤Б╨╗╨╕ ╨╡╤Б╤В╤М ╨┐╨░╤А╨░╨╝╨╡╤В╤А key
      const keyParam = getSearchParam('key');
      if (keyParam) {
        console.log("╨Э╨░╨╣╨┤╨╡╨╜ ╨║╨╗╤О╤З ╨┤╨╗╤П ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░ ╨▓ URL");
        return {
          key: keyParam,
          source: 'serverKey'
        };
      }
      
      // ╨Ч╨░╤В╨╡╨╝ ╨┐╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨┐╨░╤А╨░╨╝╨╡╤В╤А data
      const dataParam = getSearchParam('data');
      if (dataParam) {
        console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л ╨▓ URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╡");
        const decodedData = decodeURIComponent(dataParam);
        return {
          rawData: decodedData,
          source: 'URL'
        };
      }
    } catch (e) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╕ ╨┤╨░╨╜╨╜╤Л╤Е ╨╕╨╖ URL:", e);
    }
    return null;
  };

  // ╨д╤Г╨╜╨║╤Ж╨╕╤П ╨┤╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╨┤╨░╨╜╨╜╤Л╤Е ╨╕╨╖ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░
  const getStorageData = (): DataSource => {
    // ╨б╨╜╨░╤З╨░╨╗╨░ ╨┐╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ URL
    const urlData = getDataFromUrl();
    if (urlData) {
      return urlData;
    }
    
    // ╨Ч╨░╤В╨╡╨╝ ╨┐╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ sessionStorage
    try {
      console.log("╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨▓ sessionStorage");
      const contactsFromSession = sessionStorage.getItem('groupContacts');
      const groupIdFromSession = sessionStorage.getItem('groupId');
      const groupNameFromSession = sessionStorage.getItem('groupName');
      
      if (contactsFromSession && groupIdFromSession && groupNameFromSession) {
        console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л ╨▓ sessionStorage");
        return {
          contacts: contactsFromSession,
          groupId: groupIdFromSession,
          groupName: groupNameFromSession,
          source: 'sessionStorage'
        } as StorageData;
      }
    } catch (e) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨┤╨╛╤Б╤В╤Г╨┐╨╡ ╨║ sessionStorage:", e);
    }
    
    // ╨Х╤Б╨╗╨╕ ╨╜╨╡ ╨╜╨░╤И╨╗╨╕ ╨▓ sessionStorage, ╨┐╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ localStorage
    try {
      console.log("╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨▓ localStorage");
      const contactsFromLocal = localStorage.getItem('groupContacts');
      const groupIdFromLocal = localStorage.getItem('groupId');
      const groupNameFromLocal = localStorage.getItem('groupName');
      
      if (contactsFromLocal && groupIdFromLocal && groupNameFromLocal) {
        console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л ╨▓ localStorage");
        return {
          contacts: contactsFromLocal,
          groupId: groupIdFromLocal,
          groupName: groupNameFromLocal,
          source: 'localStorage'
        } as StorageData;
      }
    } catch (e) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨┤╨╛╤Б╤В╤Г╨┐╨╡ ╨║ localStorage:", e);
    }
    
    return null;
  };
  
  // ╨д╤Г╨╜╨║╤Ж╨╕╤П ╨╛╤З╨╕╤Б╤В╨║╨╕ ╨┤╨░╨╜╨╜╤Л╤Е ╨╕╨╖ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й
  const clearStorageData = (source: string, preserveRequestData: boolean = false) => {
    try {
      if (source === 'sessionStorage' || source === 'both') {
        // ╨б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ ╨▓╨░╨╢╨╜╤Л╨╡ ╨┤╨░╨╜╨╜╤Л╨╡, ╨╡╤Б╨╗╨╕ ╤В╤А╨╡╨▒╤Г╨╡╤В╤Б╤П
        const requestId = preserveRequestData ? sessionStorage.getItem('requestId') : null;
        const selectedSuppliers = preserveRequestData ? sessionStorage.getItem('selectedSuppliers') : null;
        const requestParameters = preserveRequestData ? sessionStorage.getItem('requestParameters') : null;
        
        // ╨Ю╤З╨╕╤Й╨░╨╡╨╝ ╨▓╤Б╨╡ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ sessionStorage
        sessionStorage.clear();
        
        // ╨Т╨╛╤Б╤Б╤В╨░╨╜╨░╨▓╨╗╨╕╨▓╨░╨╡╨╝ ╨▓╨░╨╢╨╜╤Л╨╡ ╨┤╨░╨╜╨╜╤Л╨╡, ╨╡╤Б╨╗╨╕ ╤В╤А╨╡╨▒╤Г╨╡╤В╤Б╤П
        if (preserveRequestData) {
          if (requestId) sessionStorage.setItem('requestId', requestId);
          if (selectedSuppliers) sessionStorage.setItem('selectedSuppliers', selectedSuppliers);
          if (requestParameters) sessionStorage.setItem('requestParameters', requestParameters);
          console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╤Л ╨▓ sessionStorage ╨▓╨╛ ╨▓╤А╨╡╨╝╤П ╨╛╤З╨╕╤Б╤В╨║╨╕");
        } else {
          console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨╛╤З╨╕╤Й╨╡╨╜╤Л ╨╕╨╖ sessionStorage");
        }
      }
      
      if (source === 'localStorage' || source === 'both') {
        localStorage.removeItem('groupContacts');
        localStorage.removeItem('groupId');
        localStorage.removeItem('groupName');
        console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨╛╤З╨╕╤Й╨╡╨╜╤Л ╨╕╨╖ localStorage");
      }
    } catch (e) {
      console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╛╤З╨╕╤Б╤В╨║╨╡ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й:", e);
    }
  };

  // ╨Ю╤В╨┤╨╡╨╗╤М╨╜╤Л╨╣ ╤Н╤Д╤Д╨╡╨║╤В ╨┤╨╗╤П ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╕ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╜╨░ ╨╛╤Б╨╜╨╛╨▓╨╡ ╨╕╤Е ╨╛╤В╨╛╨▒╤А╨░╨╢╨╡╨╜╨╕╤П
  useEffect(() => {
    // ╨Х╤Б╨╗╨╕ ╨╝╤Л ╨┐╤А╨╕╤И╨╗╨╕ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓, ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕ ╨▓╤Л╨▒╨╕╤А╨░╨╡╨╝ ╨▓╤Б╨╡╤Е ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓
    if (comingFromGroup && suppliers.length > 0) {
      console.log(`╨Р╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕╨╣ ╨▓╤Л╨▒╨╛╤А ${suppliers.length} ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨┐╤А╨╕ ╨┐╨╡╤А╨╡╤Е╨╛╨┤╨╡ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓`);
      
      // ╨г╨▒╨╡╨┤╨╕╨╝╤Б╤П, ╤З╤В╨╛ ╨▓╤Б╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╕ ╨▓╤Л╨▒╤А╨░╨╜╤Л - ╤Г╤Б╤В╨░╨╜╨░╨▓╨╗╨╕╨▓╨░╨╡╨╝ ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╨╡ ╨╜╨░╨┐╤А╤П╨╝╤Г╤О ╨╖╨┤╨╡╤Б╤М
      setSelectedSuppliers([...suppliers]);
      
      // ╨Т╤Л╨▓╨╛╨┤╨╕╨╝ ╨▓ ╨║╨╛╨╜╤Б╨╛╨╗╤М ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╨╕╨╡ ╨▓╤Л╨▒╨╛╤А╨░
      console.log("╨Т╨л╨С╨а╨Р╨Э╨л ╨Т╨б╨Х ╨Я╨Ю╨б╨в╨Р╨Т╨й╨Ш╨Ъ╨Ш:", suppliers.length);
    }
  }, [comingFromGroup, suppliers]);

  // ╨Р╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕ ╨┐╤А╨╕╨╝╨╡╨╜╤П╨╡╨╝ ╤Д╨╕╨╗╤М╤В╤А "╤В╨╛╨╗╤М╨║╨╛ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╡" ╨┐╤А╨╕ ╨╖╨░╨│╤А╤Г╨╖╨║╨╡ ╨╜╨╛╨▓╤Л╤Е ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ (╨║╤А╨╛╨╝╨╡ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓)
  useEffect(() => {
    if (suppliers.length > 0 && uniqueEmailsOnly && !comingFromGroup && selectedSuppliers.length === 0) {
      console.log('╨Р╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨┐╤А╨╕╨╝╨╡╨╜╨╡╨╜╨╕╨╡ ╤Д╨╕╨╗╤М╤В╤А╨░ "╤В╨╛╨╗╤М╨║╨╛ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╡" ╨║ ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╨╜╤Л╨╝ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░╨╝');
      const uniqueSuppliers = selectUniqueEmails();
      setSelectedSuppliers(uniqueSuppliers);
    }
  }, [suppliers, uniqueEmailsOnly, comingFromGroup]);

  // ╨Ч╨░╨│╤А╤Г╨╖╨║╨░ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ╨┐╤А╨╕ ╨┐╨╡╤А╨▓╨╛╨╝ ╤А╨╡╨╜╨┤╨╡╤А╨╡
  useEffect(() => {
    console.log("╨в╨╡╨║╤Г╤Й╨╕╨╣ URL:", location);
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
              const emails = Array.isArray(supplier.email) ? supplier.email : [supplier.email];
              const selectedEmail = emails[0] || '';
              return {
                ...supplier,
                email: emails,
                selectedEmail: selectedEmail
              } as ExtendedSupplier;
            });
            
            const limitedSuppliers = await applyTrialLimitations(processedSuppliers);
            setSuppliers(limitedSuppliers);
            // ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х: ╨Э╨╡ ╨▓╤Л╨▒╨╕╤А╨░╨╡╨╝ ╨▓╤Б╨╡╤Е ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕
            setSelectedSuppliers([]);
            console.log(`Loaded ${limitedSuppliers.length} suppliers from localStorage (search results)`);
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
          if (!isNaN(requestId)) {
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
    
    // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╨╡╤Б╤В╤М ╨╗╨╕ ╨▓ URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А from=group ╨╕╨╗╨╕ from=parameters
    const fromParam = getSearchParam('from');
    const isFromGroup = fromParam === 'group';
    const isFromParameters = fromParam === 'parameters';
    const showSelection = getSearchParam('showSelection') === 'true';
    
    // ╨в╨░╨║╨╢╨╡ ╨┐╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨╜╨░╨╗╨╕╤З╨╕╨╡ ╤Д╨╗╨░╨│╨░ parametersSelected ╨▓ session storage
    // ╨Э╨Ю ╤В╨╛╨╗╤М╨║╨╛ ╨╡╤Б╨╗╨╕ ╨╡╤Б╤В╤М URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╤Л - ╨┤╨╗╤П ╨┐╤А╤П╨╝╨╛╨│╨╛ ╨┐╨╡╤А╨╡╤Е╨╛╨┤╨░ ╨╕╨╖ ╨╜╨░╨▓╨╕╨│╨░╤Ж╨╕╨╕ ╨╛╤З╨╕╤Й╨░╨╡╨╝ ╨▓╤Б╨╡
    const hasUrlParams = window.location.search.length > 0;
    const parametersSelected = hasUrlParams && (isFromParameters || sessionStorage.getItem('parametersSelected') === 'true');
    
    console.log("╨Я╨╡╤А╨╡╤Е╨╛╨┤ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л (╨╕╨╖ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░ URL):", isFromGroup);
    console.log("╨Я╨╡╤А╨╡╤Е╨╛╨┤ ╨┐╨╛╤Б╨╗╨╡ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓:", parametersSelected);
    console.log("╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╤В╤М ╨▓╤Л╨▒╨╛╤А ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ (╨╕╨╖ URL):", showSelection);
    
    // Check if we should show the supplier selection view
    if (hasUrlParams && (showSelection || sessionStorage.getItem('showSupplierSelectionView') === 'true')) {
      console.log("ЁЯУЛ ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╨▓╨╕╨┤ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨▓╨╝╨╡╤Б╤В╨╛ ╤Д╨╛╤А╨╝╤Л ╨╛╤В╨┐╤А╨░╨▓╨║╨╕");
      setShowEmailForm(false);
    }
    
    setComingFromGroup(isFromGroup);
    
    // ╨Х╤Б╨╗╨╕ ╨┐╤А╨╕╤И╨╗╨╕ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓, ╨╖╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ sessionStorage/localStorage
    if (isFromGroup) {
      console.log("╨Я╨╡╤А╨╡╤Е╨╛╨┤ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓, ╨╖╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й");
      
      // ╨Я╤А╨╛╨▒╤Г╨╡╨╝ ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╤М ╨╕╨╖ sessionStorage, ╨╖╨░╤В╨╡╨╝ ╨╕╨╖ localStorage ╨║╨░╨║ ╨╖╨░╨┐╨░╤Б╨╜╨╛╨╣ ╨▓╨░╤А╨╕╨░╨╜╤В
      let suppliersFromGroup;
      
      // ╨Я╨╡╤А╨▓╨░╤П ╨┐╨╛╨┐╤Л╤В╨║╨░ - sessionStorage
      const suppliersFromSession = sessionStorage.getItem('selectedSuppliers');
      if (suppliersFromSession) {
        try {
          suppliersFromGroup = JSON.parse(suppliersFromSession);
          console.log(`╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜╨╛ ${suppliersFromGroup.length} ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕╨╖ sessionStorage`);
        } catch (error) {
          console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╤З╤В╨╡╨╜╨╕╨╕ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕╨╖ sessionStorage:", error);
        }
      }
      
      // ╨Х╤Б╨╗╨╕ ╨╕╨╖ sessionStorage ╨╜╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М, ╨┐╤А╨╛╨▒╤Г╨╡╨╝ localStorage
      if (!suppliersFromGroup) {
        const suppliersFromLocal = localStorage.getItem('selectedSuppliers');
        if (suppliersFromLocal) {
          try {
            suppliersFromGroup = JSON.parse(suppliersFromLocal);
            console.log(`╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜╨╛ ${suppliersFromGroup.length} ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕╨╖ localStorage (╨╖╨░╨┐╨░╤Б╨╜╨╛╨╣ ╨▓╨░╤А╨╕╨░╨╜╤В)`);
          } catch (error) {
            console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╤З╤В╨╡╨╜╨╕╨╕ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕╨╖ localStorage:", error);
          }
        }
      }
      
      // ╨Я╤А╨╛╨▓╨╡╤А╨║╨░ groupId ╨╕╨╖ URL
      const urlGroupId = getSearchParam('groupId');
      if (urlGroupId) {
        setGroupId(parseInt(urlGroupId));
        console.log(`ID ╨│╤А╤Г╨┐╨┐╤Л ╨╕╨╖ URL: ${urlGroupId}`);
        
        // ╨Я╤А╨╛╨▒╤Г╨╡╨╝ ╨┐╨╛╨╗╤Г╤З╨╕╤В╤М ╨╕╨╝╤П ╨│╤А╤Г╨┐╨┐╤Л ╨╕╨╖ storage
        const groupNameFromStorage = sessionStorage.getItem('groupName') || localStorage.getItem('groupName');
        if (groupNameFromStorage) {
          setGroupName(groupNameFromStorage);
          console.log(`╨Ш╨╝╤П ╨│╤А╤Г╨┐╨┐╤Л ╨╕╨╖ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░: ${groupNameFromStorage}`);
        }
      }
      
      // ╨Х╤Б╨╗╨╕ ╨╜╨░╤И╨╗╨╕ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓, ╤Г╤Б╤В╨░╨╜╨░╨▓╨╗╨╕╨▓╨░╨╡╨╝ ╨╕╤Е ╨▓ ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╨╡ ╤Б ╨┐╤А╨╕╨╝╨╡╨╜╨╡╨╜╨╕╨╡╨╝ ╨╛╨│╤А╨░╨╜╨╕╤З╨╡╨╜╨╕╨╣
      if (suppliersFromGroup && suppliersFromGroup.length > 0) {
        console.log(`╨Ю╨▒╨╜╨╛╨▓╨╗╨╡╨╜╨╕╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨▓ ╤Д╨╛╤А╨╝╨╡:`, suppliersFromGroup.length);
        
        // Apply trial limitations before setting suppliers
        const processGroupSuppliers = async () => {
          const limitedSuppliers = await applyTrialLimitations(suppliersFromGroup);
          setSuppliers(limitedSuppliers);
          setSelectedSuppliers(limitedSuppliers);
        };
        
        processGroupSuppliers();
        
        // ╨Т╤Б╨╡╨│╨┤╨░ ╨┐╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╨▓╤Л╨▒╨╛╤А ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨┐╤А╨╕ ╨┐╨╡╤А╨╡╤Е╨╛╨┤╨╡ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓
        setShowEmailForm(false);
        
        console.log("╨Р╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕╨╣ ╨▓╤Л╨▒╨╛╤А", suppliersFromGroup.length, "╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨┐╤А╨╕ ╨┐╨╡╤А╨╡╤Е╨╛╨┤╨╡ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓");
      } else {
        console.error("╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╤М ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓");
        toast({
          title: "╨Ю╤И╨╕╨▒╨║╨░",
          description: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л. ╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╤Б╨╜╨╛╨▓╨░.",
          variant: "destructive"
        });
      }
      
      return; // ╨Я╤А╨╡╤А╤Л╨▓╨░╨╡╨╝ ╨┤╨░╨╗╤М╨╜╨╡╨╣╤И╨╡╨╡ ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╤Н╤Д╤Д╨╡╨║╤В╨░
    }
    
    // ╨Х╤Б╨╗╨╕ ╨┐╤А╨╕╤И╨╗╨╕ ╨┐╨╛╤Б╨╗╨╡ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓, ╤В╨╛ ╨╜╨╡ ╨╛╤З╨╕╤Й╨░╨╡╨╝ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░
    if (parametersSelected) {
      console.log("╨Я╨╡╤А╨╡╤Е╨╛╨┤ ╨┐╨╛╤Б╨╗╨╡ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓, ╤Б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨▓ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░╤Е");
      
      // ╨Я╤А╨╛╨┤╨╛╨╗╨╢╨░╨╡╨╝ ╤А╨░╨▒╨╛╤В╤Г ╤Б ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╜╤Л╨╝╨╕ ╨▓ session storage ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░╨╝╨╕ ╨╕ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░╨╝╨╕
      const savedParameters = sessionStorage.getItem('requestParameters');
      const savedSuppliers = sessionStorage.getItem('selectedSuppliers');
      const savedRequestId = sessionStorage.getItem('requestId');
      
      if (savedSuppliers) {
        try {
          const parsedSuppliers = JSON.parse(savedSuppliers);
          
          // Apply trial limitations before setting suppliers
          const processSessionSuppliers = async () => {
            const limitedSuppliers = await applyTrialLimitations(parsedSuppliers);
            setSuppliers(limitedSuppliers);
            // ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х: ╨Э╨╡ ╨▓╤Л╨▒╨╕╤А╨░╨╡╨╝ ╨▓╤Б╨╡╤Е ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕
            setSelectedSuppliers([]);
            console.log(`╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜╨╛ ${limitedSuppliers.length} ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕╨╖ sessionStorage`);
          };
          
          processSessionSuppliers();
        } catch (error) {
          console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╤З╤В╨╡╨╜╨╕╨╕ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕╨╖ sessionStorage:", error);
        }
      }
      
      // ╨Х╤Б╨╗╨╕ ╨╡╤Б╤В╤М ID ╨╖╨░╨┐╤А╨╛╤Б╨░, ╨╖╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨╡╨│╨╛
      if (savedRequestId) {
        try {
          const requestId = parseInt(savedRequestId);
          if (!isNaN(requestId)) {
            // ╨Ч╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░ ╨┐╨╛ ID
            const loadRequestData = async () => {
              try {
                const response = await fetch(`/api/search-requests/${requestId}`);
                if (response.ok) {
                  const requestData = await response.json();
                  setSearchRequest(requestData);
                  console.log("╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜ ╨╖╨░╨┐╤А╨╛╤Б ╤Б ID:", requestId);
                } else {
                  console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╖╨░╨│╤А╤Г╨╖╨║╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░:", response.statusText);
                }
              } catch (error) {
                console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╖╨░╨│╤А╤Г╨╖╨║╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░:", error);
              }
            };
            
            loadRequestData();
          }
        } catch (error) {
          console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╡ ID ╨╖╨░╨┐╤А╨╛╤Б╨░:", error);
        }
      }
      
      setShowEmailForm(true); // ╨б╤А╨░╨╖╤Г ╨┐╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╤Д╨╛╤А╨╝╤Г ╨┤╨╗╤П email
      setIsLoading(false);
      return; // ╨Я╤А╨╛╨┤╨╛╨╗╨╢╨░╨╡╨╝ ╤А╨░╨▒╨╛╤В╤Г ╤Б ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░╨╝╨╕
    }
    
    // ╨Х╤Б╨╗╨╕ ╨┐╨╡╤А╨╡╤Е╨╛╨┤ ╨┐╨╛╤Б╨╗╨╡ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓ ╨Ш ╨╡╤Б╤В╤М URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╤Л, ╨┐╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╤Д╨╛╤А╨╝╤Г email
    if (parametersSelected && (isFromParameters || getSearchParam('requestId'))) {
      console.log("╨Я╨╡╤А╨╡╤Е╨╛╨┤ ╨┐╨╛╤Б╨╗╨╡ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓, ╤Б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨▓ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░╤Е");
      
      // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ requestId ╨╕╨╖ URL ╨┤╨╗╤П ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╨┤╨░╨╜╨╜╤Л╤Е ╨╖╨░╨┐╤А╨╛╤Б╨░
      const requestIdParam = getSearchParam('requestId');
      if (requestIdParam) {
        try {
          const requestId = parseInt(requestIdParam);
          if (!isNaN(requestId)) {
            // ╨Ч╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░ ╨┐╨╛ ID
            const loadRequestData = async () => {
              try {
                const response = await fetch(`/api/search-requests/${requestId}`);
                if (response.ok) {
                  const requestData = await response.json();
                  setSearchRequest(requestData);
                  console.log("╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜ ╨╖╨░╨┐╤А╨╛╤Б ╤Б ID:", requestId);
                } else {
                  console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╖╨░╨│╤А╤Г╨╖╨║╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░:", response.statusText);
                }
              } catch (error) {
                console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╖╨░╨│╤А╤Г╨╖╨║╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░:", error);
              }
            };
            
            loadRequestData();
          }
        } catch (error) {
          console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╡ ID ╨╖╨░╨┐╤А╨╛╤Б╨░:", error);
        }
      }
      
      setShowEmailForm(true); // ╨б╤А╨░╨╖╤Г ╨┐╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╤Д╨╛╤А╨╝╤Г ╨┤╨╗╤П email
      setIsLoading(false);
      return; // ╨Я╤А╨╛╨┤╨╛╨╗╨╢╨░╨╡╨╝ ╤А╨░╨▒╨╛╤В╤Г ╤Б ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░╨╝╨╕
    }
    
    // ╨Х╤Б╨╗╨╕ ╤Н╤В╨╛ ╨┐╤А╤П╨╝╨╛╨╣ ╨┐╨╡╤А╨╡╤Е╨╛╨┤ ╨╕╨╖ ╨╜╨░╨▓╨╕╨│╨░╤Ж╨╕╨╕ (╨▒╨╡╨╖ URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓), ╨▓╤Б╨╡╨│╨┤╨░ ╨┐╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╨╜╨░╤З╨░╨╗╤М╨╜╤Л╨╣ ╤Н╨║╤А╨░╨╜
    if (!hasUrlParams) {
      // ╨Ю╤З╨╕╤Й╨░╨╡╨╝ ╨▓╤Б╨╡ ╨┤╨░╨╜╨╜╤Л╨╡ ╤Б╨╡╤Б╤Б╨╕╨╕ ╨┤╨╗╤П ╤З╨╕╤Б╤В╨╛╨│╨╛ ╤Б╤В╨░╤А╤В╨░
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
      
      console.log("╨Я╤А╤П╨╝╨╛╨╣ ╨┐╨╡╤А╨╡╤Е╨╛╨┤ ╨╕╨╖ ╨╜╨░╨▓╨╕╨│╨░╤Ж╨╕╨╕ - ╨▓╤Б╨╡ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╛╤З╨╕╤Й╨╡╨╜╤Л, ╨┐╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╨╜╨░╤З╨░╨╗╤М╨╜╤Л╨╣ ╤Н╨║╤А╨░╨╜ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓");
      
      // ╨Ю╤З╨╕╤Й╨░╨╡╨╝ ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕ ╤Д╨╛╤А╨╝
      setSuppliers([]);
      setSelectedSuppliers([]);
      setGroupId(null);
      setGroupName(null);
      setProductDescription('');
      setProductName('');
      setDeadline('');
      
      // ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╨╜╨░╤З╨░╨╗╤М╨╜╤Л╨╣ ╨▓╨╕╨┤ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓
      setShowEmailForm(false);
      setIsLoading(false);
      
      return; // ╨Я╤А╨╡╤А╤Л╨▓╨░╨╡╨╝ ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╤Н╤Д╤Д╨╡╨║╤В╨░
    }
    
    // ╨Х╤Б╨╗╨╕ ╨╜╨╡╤В ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░ from=group ╨╕ ╨╜╨╡ ╨┐╨╡╤А╨╡╤Е╨╛╨┤ ╨┐╨╛╤Б╨╗╨╡ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓, ╨┐╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨╡╤Б╤В╤М ╨╗╨╕ ╨┤╨░╨╜╨╜╤Л╨╡ ╨┐╨╛╨╕╤Б╨║╨░
    if (!isFromGroup && (!parametersSelected || !sessionStorage.getItem('selectedSuppliers'))) {
      // ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╨╡╤Б╤В╤М ╨╗╨╕ ╨┤╨░╨╜╨╜╤Л╨╡ ╨┐╨╛╨╕╤Б╨║╨░ ╨▓ localStorage
      const suppliersFromSearch = localStorage.getItem('sendRequestSuppliers');
      const requestIdFromSearch = localStorage.getItem('sendRequestId');
      
      if (!suppliersFromSearch && !requestIdFromSearch) {
        // ╨Ю╤З╨╕╤Й╨░╨╡╨╝ sessionStorage, ╨Э╨Х ╤Б╨╛╤Е╤А╨░╨╜╤П╤П ╨┤╨░╨╜╨╜╤Л╨╡ ╨╖╨░╨┐╤А╨╛╤Б╨░
        clearStorageData('both', false);
        console.log("╨Я╨╡╤А╨╡╤Е╨╛╨┤ ╤Б URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░╨╝╨╕ ╨╜╨╛ ╨▒╨╡╨╖ ╨┤╨░╨╜╨╜╤Л╤Е - ╨┤╨░╨╜╨╜╤Л╨╡ ╨╛╤З╨╕╤Й╨╡╨╜╤Л ╨╕╨╖ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й");
        
        // ╨Ю╤З╨╕╤Й╨░╨╡╨╝ ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓
        setSuppliers([]);
        setSelectedSuppliers([]);
        setGroupId(null);
        setGroupName(null);
        
        // ╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╨▓╨╕╨┤ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ (╨╜╨░╤З╨░╨╗╤М╨╜╤Л╨╣ ╤Н╨║╤А╨░╨╜ ╤Б ╨║╨╜╨╛╨┐╨║╨░╨╝╨╕ "╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░", "╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╨╕╨╖ ╤Д╨░╨╣╨╗╨░", "╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╨╕╨╖ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓")
        setShowEmailForm(false);
        console.log("╨Я╨╛╨║╨░╨╖╤Л╨▓╨░╨╡╨╝ ╨╜╨░╤З╨░╨╗╤М╨╜╤Л╨╣ ╨▓╨╕╨┤ ╨▓╤Л╨▒╨╛╤А╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓");
        
        return; // ╨Я╤А╨╡╤А╤Л╨▓╨░╨╡╨╝ ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╤Н╤Д╤Д╨╡╨║╤В╨░, ╤В.╨║. ╨╜╨╡╤В ╨╜╤Г╨╢╨┤╤Л ╨╖╨░╨│╤А╤Г╨╢╨░╤В╤М ╨┤╨░╨╜╨╜╤Л╨╡
      } else {
        console.log("╨Э╨░╨╣╨┤╨╡╨╜╤Л ╨┤╨░╨╜╨╜╤Л╨╡ ╨┐╨╛╨╕╤Б╨║╨░ ╨▓ localStorage, ╨┐╤А╨╛╨┤╨╛╨╗╨╢╨░╨╡╨╝ ╨╖╨░╨│╤А╤Г╨╖╨║╤Г ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓");
      }
    }
    
    // ╨Х╤Б╨╗╨╕ ╤Н╤В╨╛ ╨┐╤А╤П╨╝╨╛╨╣ ╨┐╨╡╤А╨╡╤Е╨╛╨┤ ╨▒╨╡╨╖ URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓, ╨╛╤З╨╕╤Й╨░╨╡╨╝ ╤Д╨╗╨░╨│ parametersSelected
    if (!hasUrlParams && parametersSelected) {
      console.log("╨Я╤А╤П╨╝╨╛╨╣ ╨┐╨╡╤А╨╡╤Е╨╛╨┤ ╨▒╨╡╨╖ URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨╛╨▓ - ╨╛╤З╨╕╤Й╨░╨╡╨╝ ╤Д╨╗╨░╨│ parametersSelected");
      sessionStorage.removeItem('parametersSelected');
      setShowEmailForm(false);
      return;
    }
    
    // ╨Ю╤Б╨╜╨╛╨▓╨╜╨░╤П ╤Д╤Г╨╜╨║╤Ж╨╕╤П ╨┤╨╗╤П ╨╛╨▒╤А╨░╨▒╨╛╤В╨║╨╕ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╨┤╨░╨╜╨╜╤Л╤Е
    const loadData = async () => {
      try {
        // ╨б╨╜╨░╤З╨░╨╗╨░ ╨┐╤А╨╛╨▓╨╡╤А╤П╨╡╨╝, ╨╡╤Б╤В╤М ╨╗╨╕ ╨║╨╗╤О╤З ╨┤╨╗╤П ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░
        const keyParam = getSearchParam('key');
        if (keyParam) {
          console.log(`╨Ю╨▒╨╜╨░╤А╤Г╨╢╨╡╨╜ ╨║╨╗╤О╤З ╨┤╨╗╤П ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░: ${keyParam}`);
          
          try {
            const serverData = await fetchContactsWithKey(keyParam);
            if (serverData) {
              console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╤Л ╨╕╨╖ ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░");
              
              const parsedContacts = JSON.parse(serverData.contacts || '[]');
              const groupNameValue = serverData.groupName || '╨У╤А╤Г╨┐╨┐╨░';
              const groupIdValue = parseInt(serverData.groupId) || 0;
              
              console.log(`╨Я╨╛╨╗╤Г╤З╨╡╨╜╨╛ ${parsedContacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╕╨╖ ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░`);
              
              // ╨Я╤А╨╡╨╛╨▒╤А╨░╨╖╤Г╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨▓ ╤Д╨╛╤А╨╝╨░╤В ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓
              const suppliersFromContacts = parsedContacts.map((contact: any) => ({
                id: contact.id || Math.floor(Math.random() * 100000),
                name: contact.name || '╨Я╨╛╤Б╤В╨░╨▓╤Й╨╕╨║',
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
                // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╨╜╨╡╨┤╨╛╤Б╤В╨░╤О╤Й╨╕╨╡ ╨┐╨╛╨╗╤П ╨┤╨╗╤П ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╤П ╤В╨╕╨┐╤Г Supplier
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
                const limitedSuppliers = await applyTrialLimitations(suppliersFromContacts);
                setSuppliers(limitedSuppliers);
                setSelectedSuppliers(limitedSuppliers);
              };
              
              processContactSuppliers();
              setGroupId(groupIdValue);
              setGroupName(groupNameValue);
              
              toast({
                title: "╨Ъ╨╛╨╜╤В╨░╨║╤В╤Л ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╤Л",
                description: `╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜╨╛ ${suppliersFromContacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л "${groupNameValue}"`,
              });
              
              return; // ╨Ч╨░╨▓╨╡╤А╤И╨░╨╡╨╝ ╤Д╤Г╨╜╨║╤Ж╨╕╤О, ╤В╨░╨║ ╨║╨░╨║ ╨┤╨░╨╜╨╜╤Л╨╡ ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╤Л
            }
          } catch (error) {
            console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╕ ╨┤╨░╨╜╨╜╤Л╤Е ╨╕╨╖ ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨│╨╛ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░:", error);
            // ╨Я╤А╨╛╨┤╨╛╨╗╨╢╨░╨╡╨╝ ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜╨╕╨╡ ╨╕ ╨┐╤А╨╛╨▒╤Г╨╡╨╝ ╨┤╤А╤Г╨│╨╕╨╡ ╨╝╨╡╤В╨╛╨┤╤Л
          }
        }
        
        // ╨Я╨╛╨╗╤Г╤З╨░╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ ╨┤╤А╤Г╨│╨╕╤Е ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й, ╨╡╤Б╨╗╨╕ ╤Б╨╡╤А╨▓╨╡╤А╨╜╨╛╨╡ ╨╜╨╡ ╤Б╤А╨░╨▒╨╛╤В╨░╨╗╨╛
        const storageData = getStorageData();
        
        if (storageData) {
          console.log(`╨Э╨░╨╣╨┤╨╡╨╜╤Л ╨┤╨░╨╜╨╜╤Л╨╡ ╨▓ ${storageData.source}`);
          
          // ╨Х╤Б╨╗╨╕ ╨╜╨╡ ╨▒╤Л╨╗╨╛ ╤Г╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜╨╛ ╤З╨╡╤А╨╡╨╖ URL, ╤Г╤Б╤В╨░╨╜╨╛╨▓╨╕╨╝ ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╨╡
          if (!isFromGroup) {
            console.log(`╨Ф╨░╨╜╨╜╤Л╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л ╨▓ ${storageData.source}, ╨╜╨╛ ╨┐╨░╤А╨░╨╝╨╡╤В╤А URL ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╤Г╨╡╤В. ╨г╤Б╤В╨░╨╜╨░╨▓╨╗╨╕╨▓╨░╨╡╨╝ comingFromGroup = true`);
            setComingFromGroup(true);
          }
          
          console.log("╨Я╨░╤А╤Б╨╕╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╕╨╖", storageData.source);
          
          let parsedData: any;
          let parsedContacts: any[] = [];
          let groupNameValue: string = '╨У╤А╤Г╨┐╨┐╨░';
          let groupIdValue: number = 0;
          
          // ╨Ю╨▒╤А╨░╨▒╨░╤В╤Л╨▓╨░╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨▓ ╨╖╨░╨▓╨╕╤Б╨╕╨╝╨╛╤Б╤В╨╕ ╨╛╤В ╨╕╤Б╤В╨╛╤З╨╜╨╕╨║╨░
          if (storageData.source === 'URL' && 'rawData' in storageData) {
            // ╨Х╤Б╨╗╨╕ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ URL, ╤А╨░╨╖╨▒╨╕╤А╨░╨╡╨╝ ╨╛╨▒╤К╨╡╨║╤В ╤Б ╨┤╨░╨╜╨╜╤Л╨╝╨╕
            parsedData = JSON.parse(storageData.rawData);
            parsedContacts = parsedData.contacts || [];
            groupNameValue = parsedData.groupName || '╨У╤А╤Г╨┐╨┐╨░';
            groupIdValue = parseInt(parsedData.groupId) || 0;
            
            console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ URL ╨┐╨░╤А╨░╨╝╨╡╤В╤А╨░:", {
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
            // ╨Ф╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░ - ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╡╨╝ ╤Б╤В╨░╤А╤Г╤О ╨╗╨╛╨│╨╕╨║╤Г
            parsedContacts = JSON.parse(storageData.contacts || '[]');
            groupNameValue = storageData.groupName || '╨У╤А╤Г╨┐╨┐╨░';
            groupIdValue = parseInt(storageData.groupId) || 0;
          }
          
          console.log("╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓:", parsedContacts.length);
          
          // ╨Я╤А╨╡╨╛╨▒╤А╨░╨╖╤Г╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨▓ ╤Д╨╛╤А╨╝╨░╤В ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓, ╤Б ╨┐╤А╨╛╨▓╨╡╤А╨║╨╛╨╣ ╨╜╨░ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╨╡ ╨┐╨╛╨╗╤П
          const suppliersFromContacts = parsedContacts.map((contact: any) => ({
            id: contact.id || Math.floor(Math.random() * 100000),
            name: contact.name || contact.company || '╨Я╨╛╤Б╤В╨░╨▓╤Й╨╕╨║',
            email: contact.email || '',
            phone: contact.phone || null,
            userId: contact.user_id || null, // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ userId ╨┤╨╗╤П ╨╝╤Г╨╗╤М╤В╨╕╤В╨╡╨╜╨░╨╜╤В╨╜╨╛╤Б╤В╨╕
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
            // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╨╜╨╡╨┤╨╛╤Б╤В╨░╤О╤Й╨╕╨╡ ╨┐╨╛╨╗╤П ╨┤╨╗╤П ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╤П ╤В╨╕╨┐╤Г Supplier
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
          
          console.log("╨Я╤А╨╡╨╛╨▒╤А╨░╨╖╨╛╨▓╨░╨╜╨╜╤Л╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╕:", suppliersFromContacts.length);
          
          // Apply trial limitations and set suppliers
          const processStorageSuppliers = async () => {
            const limitedSuppliers = await applyTrialLimitations(suppliersFromContacts);
            setSuppliers(limitedSuppliers);
            setSelectedSuppliers(limitedSuppliers);
          };
          
          processStorageSuppliers();
          
          // ╨г╤Б╤В╨░╨╜╨░╨▓╨╗╨╕╨▓╨░╨╡╨╝ ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛ ╨│╤А╤Г╨┐╨┐╨╡
          setGroupId(groupIdValue);
          setGroupName(groupNameValue);
          
          // ╨Ю╤З╨╕╤Й╨░╨╡╨╝ ╨┤╨░╨╜╨╜╤Л╨╡ ╨╕╨╖ ╨╛╨▒╨╛╨╕╤Е ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й ╤В╨╛╨╗╤М╨║╨╛ ╨┐╨╛╤Б╨╗╨╡ ╤Г╤Б╨┐╨╡╤И╨╜╨╛╨│╨╛ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╨║╨╛╨╝╨┐╨╛╨╜╨╡╨╜╤В╨╛╨▓
  // clearStorageData('both');
  console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й ╨╜╨╡ ╨╛╤З╨╕╤Й╨░╤О╤В╤Б╤П ╨┤╨╗╤П ╨╛╨▒╨╡╤Б╨┐╨╡╤З╨╡╨╜╨╕╤П ╨╜╨░╨┤╨╡╨╢╨╜╨╛╤Б╤В╨╕");
          
          console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╤Л");
          
          // ╨Т╤Л╨▓╨╛╨┤╨╕╨╝ ╤Б╨╛╨╛╨▒╤Й╨╡╨╜╨╕╨╡ ╨╛╨▒ ╤Г╤Б╨┐╨╡╤И╨╜╨╛╨╣ ╨╖╨░╨│╤А╤Г╨╖╨║╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓
          toast({
            title: "╨Ъ╨╛╨╜╤В╨░╨║╤В╤Л ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╤Л",
            description: `╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜╨╛ ${suppliersFromContacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л "${groupNameValue}"`,
          });
          return; // ╨Ч╨░╨▓╨╡╤А╤И╨░╨╡╨╝ ╤Д╤Г╨╜╨║╤Ж╨╕╤О, ╤В╨░╨║ ╨║╨░╨║ ╨┤╨░╨╜╨╜╤Л╨╡ ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╤Л
        } 
        
        console.log("╨Э╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╤Л╨╡ ╨┤╨░╨╜╨╜╤Л╨╡ ╨▓ ╤Е╤А╨░╨╜╨╕╨╗╨╕╤Й╨░╤Е");
        
        // ╨Х╤Б╨╗╨╕ ╨┐╨░╤А╨░╨╝╨╡╤В╤А URL ╤Г╨║╨░╨╖╤Л╨▓╨░╨╡╤В ╨╜╨░ ╨┐╨╡╤А╨╡╤Е╨╛╨┤ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л, ╨╜╨╛ ╨┤╨░╨╜╨╜╤Л╤Е ╨╜╨╡╤В,
        // ╨┐╨╛╨┐╤А╨╛╨▒╤Г╨╡╨╝ ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╤М ╨┤╨░╨╜╨╜╤Л╨╡ ╨│╤А╤Г╨┐╨┐╤Л ╨╜╨░╨┐╤А╤П╨╝╤Г╤О (╨╖╨░╨┐╨░╤Б╨╜╨╛╨╣ ╨▓╨░╤А╨╕╨░╨╜╤В)
        if (isFromGroup) {
          const groupIdFromUrl = getSearchParam('groupId');
          if (groupIdFromUrl) {
            console.log(`╨Я╨╛╨┐╤Л╤В╨║╨░ ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨┤╨╗╤П ╨│╤А╤Г╨┐╨┐╤Л ${groupIdFromUrl} ╨╜╨░╨┐╤А╤П╨╝╤Г╤О`);
            
            try {
              // ╨б╨╜╨░╤З╨░╨╗╨░ ╨╖╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛ ╨│╤А╤Г╨┐╨┐╨╡
              const groupResponse = await fetch(`/api/contact-groups/${groupIdFromUrl}`);
              if (!groupResponse.ok) {
                throw new Error(`╨Ю╤И╨╕╨▒╨║╨░ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╨│╤А╤Г╨┐╨┐╤Л: ${groupResponse.status}`);
              }
              
              const groupData = await groupResponse.json();
              console.log("╨Ф╨░╨╜╨╜╤Л╨╡ ╨│╤А╤Г╨┐╨┐╤Л:", groupData);
              
              if (groupData && groupData.group) {
                setGroupId(parseInt(groupIdFromUrl));
                setGroupName(groupData.group.name);
                console.log(`╨У╤А╤Г╨┐╨┐╨░ ${groupData.group.name} ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╨░`);
                
                // ╨Ч╨░╤В╨╡╨╝ ╨╖╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В╤Л
                const contactsResponse = await fetch(`/api/contact-groups/${groupIdFromUrl}/contacts`);
                if (!contactsResponse.ok) {
                  throw new Error(`╨Ю╤И╨╕╨▒╨║╨░ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓: ${contactsResponse.status}`);
                }
                
                const contacts = await contactsResponse.json();
                console.log(`╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜╨╛ ${contacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╜╨░╨┐╤А╤П╨╝╤Г╤О`, contacts);
                
                if (contacts && contacts.length > 0) {
                  // ╨Я╤А╨╡╨╛╨▒╤А╨░╨╖╤Г╨╡╨╝ ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨▓ ╤Д╨╛╤А╨╝╨░╤В ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓
                  const suppliersFromContacts = contacts.map((contact: any) => ({
                    id: contact.id || Math.floor(Math.random() * 100000),
                    name: contact.name || '╨Я╨╛╤Б╤В╨░╨▓╤Й╨╕╨║',
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
                    // ╨Ф╨╛╨▒╨░╨▓╨╗╤П╨╡╨╝ ╨╜╨╡╨┤╨╛╤Б╤В╨░╤О╤Й╨╕╨╡ ╨┐╨╛╨╗╤П ╨┤╨╗╤П ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╤П ╤В╨╕╨┐╤Г Supplier
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
                  
                  console.log("╨г╤Б╤В╨░╨╜╨╛╨▓╨║╨░ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓:", suppliersFromContacts.length);
                  
                  // Apply trial limitations and update component state
                  const processDirectSuppliers = async () => {
                    const limitedSuppliers = await applyTrialLimitations(suppliersFromContacts);
                    setSuppliers(limitedSuppliers);
                    // ╨Ш╨б╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х: ╨Э╨╡ ╨▓╤Л╨▒╨╕╤А╨░╨╡╨╝ ╨▓╤Б╨╡╤Е ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨░╨▓╤В╨╛╨╝╨░╤В╨╕╤З╨╡╤Б╨║╨╕
                    setSelectedSuppliers([]);
                  };
                  
                  processDirectSuppliers();
                  
                  toast({
                    title: "╨Ъ╨╛╨╜╤В╨░╨║╤В╤Л ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╤Л ╨╜╨░╨┐╤А╤П╨╝╤Г╤О",
                    description: `╨Ч╨░╨│╤А╤Г╨╢╨╡╨╜╨╛ ${suppliersFromContacts.length} ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л "${groupData.group.name}"`,
                  });
                } else {
                  console.log("╨б╨┐╨╕╤Б╨╛╨║ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨┐╤Г╤Б╤В");
                  toast({
                    title: "╨Т╨╜╨╕╨╝╨░╨╜╨╕╨╡",
                    description: "╨Т ╨│╤А╤Г╨┐╨┐╨╡ ╨╜╨╡╤В ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓",
                    variant: "destructive",
                  });
                }
              } else {
                console.error("╨У╤А╤Г╨┐╨┐╨░ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░");
                toast({
                  title: "╨Ю╤И╨╕╨▒╨║╨░",
                  description: "╨У╤А╤Г╨┐╨┐╨░ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╨░",
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨┐╤А╤П╨╝╨╛╨╣ ╨╖╨░╨│╤А╤Г╨╖╨║╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓:", error);
              toast({
                title: "╨Ю╤И╨╕╨▒╨║╨░ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕",
                description: typeof error === 'object' && error !== null 
                  ? (error as Error).message || "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В╤Л" 
                  : "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В╤Л",
                variant: "destructive",
              });
            }
          }
        }
      } catch (error) {
        console.error("╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╖╨░╨│╤А╤Г╨╖╨║╨╡ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓ ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л:", error);
        toast({
          title: "╨Ю╤И╨╕╨▒╨║╨░",
          description: "╨Э╨╡ ╤Г╨┤╨░╨╗╨╛╤Б╤М ╨╖╨░╨│╤А╤Г╨╖╨╕╤В╤М ╨║╨╛╨╜╤В╨░╨║╤В╤Л ╨╕╨╖ ╨│╤А╤Г╨┐╨┐╤Л",
          variant: "destructive",
        });
      }
    };
    
    // ╨Ч╨░╨┐╤Г╤Б╨║╨░╨╡╨╝ ╤Д╤Г╨╜╨║╤Ж╨╕╤О ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╨┤╨░╨╜╨╜╤Л╤Е
    loadData().finally(() => {
      setIsLoading(false);
    });
    
  }, [location, toast]);

  return (
    <RequestLockdown pageName="╨Ю╤В╨┐╤А╨░╨▓╨╕╤В╤М ╨╖╨░╨┐╤А╨╛╤Б">
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <SubscriptionAlerts />
        <SubscriptionGuard isActive={isActiveOrLoading}>
        <div className="container mx-auto px-4 py-8">
       
        <div className="mt-4">
          <div className="grid grid-cols-1">
            <h2 className="text-2xl font-semibold">╨Ю╤В╨┐╤А╨░╨▓╨╕╤В╤М ╨╖╨░╨┐╤А╨╛╤Б ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░╨╝</h2>
            <div className="text-m text-gray-400">
              ╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨╕ ╨╛╤В╨┐╤А╨░╨▓╤М╤В╨╡ ╨╖╨░╨┐╤А╨╛╤Б ╨╜╨░ ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╨╡ ╨║╨╛╨╝╨╝╨╡╤А╤З╨╡╤Б╨║╨╕╤Е ╨┐╤А╨╡╨┤╨╗╨╛╨╢╨╡╨╜╨╕╨╣
            </div>
            {comingFromGroup && groupName && (
      
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  ╨У╤А╤Г╨┐╨┐╨░: {groupName}
                </Badge>
                <Link href={`/contact-groups/${groupId}`}>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    ╨Т╨╡╤А╨╜╤Г╤В╤М╤Б╤П ╨║ ╨│╤А╤Г╨┐╨┐╨╡
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {!showEmailForm ? (
            <>
              {/* Product info and deadline fields */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
                <div className="space-y-2 hidden"> {/* ╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜ hidden */}
                  <Label htmlFor="productName">╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨┐╤А╨╛╨┤╤Г╨║╤В╨░</Label>
                  <Input
                    id="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨┐╤А╨╛╨┤╤Г╨║╤В╨░"
                  />
                </div>

                <div className="space-y-2 hidden"> {/* ╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜ hidden */}
                  <Label htmlFor="deadline">╨Я╤А╨╡╨┤╨╗╨╛╨╢╨╡╨╜╨╕╤П ╨┐╨╛╨┤╨░╤В╤М ╨┤╨╛</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="╨▓╤Л╨▒╨╡╤А╨╡╤В╨╡ ╨┤╨░╤В╤Г ╨╛╨║╨╛╨╜╤З╨░╨╜╨╕╤П ╨┐╤А╨╕╨╡╨╝╨░ ╨┐╤А╨╡╨┤╨╗╨╛╨╢╨╡╨╜╨╕╨╣"
                    className="text-muted-foreground"
                  />
                  <div className="text-xs text-muted-foreground max-w-[600px] whitespace-nowrap">
                    ╨▓╤А╨╡╨╝╤П ╨┐╨╛ ╤Г╨╝╨╛╨╗╤З╨░╨╜╨╕╤О: ╨┤╨╛ 18 ╤З╨░╤Б╨╛╨▓ (GMT+3)
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex gap-4 flex-wrap lg:flex-nowrap">
                  <CustomSupplierInput onSupplierAdded={handleAddSupplier} />
                  <UploadSuppliersExcel onSuppliersUploaded={handleBulkUpload} />
                  <LoadFromContacts onContactsLoaded={(suppliers, groupName, groupId) => {
                    handleBulkUpload(suppliers);
                    setGroupName(groupName);
                    setGroupId(groupId);
                    setComingFromGroup(true);
                    
                    // ╨б╨╛╤Е╤А╨░╨╜╤П╨╡╨╝ groupId ╨▓ localStorage ╨┤╨╗╤П ╨┐╨╛╤Б╨╗╨╡╨┤╤Г╤О╤Й╨╡╨╣ ╨┐╤А╨╛╨▓╨╡╤А╨║╨╕ ╨▓ email-form
                    if (groupId) {
                      localStorage.setItem('groupId', String(groupId));
                      localStorage.setItem('groupName', groupName);
                    }
                  }} />
                </div>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                      <CardTitle>╨Т╤Л╨▒╤А╨░╨╜╨╜╤Л╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╕</CardTitle>
                      {searchQuery && (
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
                            <Search className="h-4 w-4 text-blue-600 mr-2" />
                            <span className="text-sm font-medium text-blue-800">
                              ╨Я╨╛╨╕╤Б╨║: "{searchQuery}"
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
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
                          ╨в╨╛╨╗╤М╨║╨╛ ╤Г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╨╡
                        </label>
                        <Checkbox 
                          id="select-all" 
                          checked={!uniqueEmailsOnly && suppliers.length > 0 && selectedSuppliers.length === suppliers.length}
                          onCheckedChange={handleSelectAll}
                          disabled={suppliers.length === 0}
                        />
                        
                        <label 
                          htmlFor="select-all" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {selectedSuppliers.length === suppliers.length 
                            ? "╨Т╤Л╨┤╨╡╨╗╨╕╤В╤М ╨▓╤Б╨╡" 
                            : selectedSuppliers.length > 0 
                              ? "╨Т╤Л╨┤╨╡╨╗╨╕╤В╤М ╨▓╤Б╨╡" 
                              : "╨Т╤Л╨┤╨╡╨╗╨╕╤В╤М ╨▓╤Б╨╡"}
                        </label>
                      </div>
                      <Button
                        variant="default"
                        className="flex items-center gap-2"
                        disabled={selectedSuppliers.length === 0}
                        onClick={handleContinueToParameters}
                      >
                        <Mail className="h-4 w-4" />
                        ╨Ю╤В╨┐╤А╨░╨▓╨╕╤В╤М ╨╖╨░╨┐╤А╨╛╤Б ({selectedSuppliers.length})
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {suppliers.length === 0 && !comingFromGroup ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>╨Э╨╡╤В ╨▓╤Л╨▒╤А╨░╨╜╨╜╤Л╤Е ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓. ╨Ф╨╛╨▒╨░╨▓╤М╤В╨╡ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓ ╨┤╨╗╤П ╨╛╤В╨┐╤А╨░╨▓╨║╨╕ ╨╖╨░╨┐╤А╨╛╤Б╨░.</p>
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
                        <div className="rounded-md border">
                          <table className="w-full">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="w-[40px] px-3 py-2 text-sm font-medium">#</th>
                                <th className="w-[40px] px-3 py-2"></th>
                                <th className="text-left px-3 py-2 text-sm font-medium">╨Ъ╨╛╨╝╨┐╨░╨╜╨╕╤П</th>
                                <th className="text-left px-3 py-2 text-sm font-medium">Email</th>
                                <th className="text-left px-3 py-2 text-sm font-medium">╨б╨░╨╣╤В</th>
                                <th className="w-[40px] px-3 py-2"></th>
                                <th className="w-[60px] px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {suppliers
                                .sort((a, b) => {
                                  // ╨б╨╛╤А╤В╨╕╤А╤Г╨╡╨╝ ╨┐╨╛ ╨┤╨╛╨╝╨╡╨╜╨░╨╝, ╤З╤В╨╛╨▒╤Л ╨╛╨┤╨╕╨╜╨░╨║╨╛╨▓╤Л╨╡ ╨┤╨╛╨╝╨╡╨╜╤Л ╨▒╤Л╨╗╨╕ ╤А╤П╨┤╨╛╨╝
                                  const domainA = getDomainFromWebsite(a.website || '');
                                  const domainB = getDomainFromWebsite(b.website || '');
                                  
                                  if (domainA === domainB) return 0;
                                  if (!domainA) return 1;
                                  if (!domainB) return -1;
                                  
                                  return domainA.localeCompare(domainB);
                                })
                                .map((supplier, index) => (
                                <tr key={supplier.id} className={index % 2 === 1 ? "bg-muted/20" : ""}>
                                  <td className="px-3 py-1 text-center text-sm text-muted-foreground">
                                    {index + 1}
                                  </td>
                                  <td className="px-3 py-1 text-center">
                                    <Checkbox 
                                      id={`supplier-${supplier.id}`}
                                      checked={selectedSuppliers.some(s => s.id === supplier.id)}
                                      onCheckedChange={(checked) => 
                                        uniqueEmailsOnly 
                                          ? handleSelectSupplierInGroup(supplier, checked as boolean)
                                          : handleSelectSupplier(supplier, checked as boolean)
                                      }
                                    />
                                  </td>
                                  <td className="px-3 py-1">
                                    <p className="font-medium text-sm">{supplier.name}</p>
                                  </td>
                                  <td className="px-3 py-1">
                                    {supplier.email && (
                                      <div className="space-y-1">
                                        {Array.isArray(supplier.email) ? (
                                          supplier.email.map((email, idx) => (
                                            <p key={idx} className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer" 
                                               title="╨Э╨░╨╢╨╝╨╕╤В╨╡ ╨┤╨╗╤П ╨▓╤Л╨▒╨╛╤А╨░ ╤Н╤В╨╛╨│╨╛ email"
                                               onClick={() => handleEmailSelection(supplier, email)}>
                                              {cleanEmail(email)}
                                            </p>
                                          ))
                                        ) : (
                                          <p className="text-sm">{cleanEmail(supplier.email)}</p>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-1">
                                    {supplier.website ? (
                                      <a 
                                        href={supplier.website.startsWith('http') ? supplier.website : `http://${supplier.website}`}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {(() => {
                                          try {
                                            const url = supplier.website.startsWith('http') ? supplier.website : `http://${supplier.website}`;
                                            const domain = new URL(url).hostname;
                                            return domain.replace('www.', '');
                                          } catch {
                                            return supplier.website;
                                          }
                                        })()}
                                      </a>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">тАФ</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1 text-center">
                                    <SupplierTooltip supplier={convertToTooltipSupplier(supplier)}>
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 w-6 p-0 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-pointer"
                                            title="╨Ъ╨╗╨╕╨║╨╜╨╕╤В╨╡ ╨┤╨╗╤П ╨┐╤А╨╛╤Б╨╝╨╛╤В╤А╨░ ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╨╕ ╨╛ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╡"
                                          >
                                            <Info className="h-3 w-3" />
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                                          <DialogHeader className="flex-shrink-0">
                                            <DialogTitle>╨Ш╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤П ╨╛ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╡</DialogTitle>
                                          </DialogHeader>
                                          <ScrollArea className="flex-1 pr-4">
                                            <div className="space-y-3">
                                              <div>
                                                <Label className="text-sm font-medium">╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨║╨╛╨╝╨┐╨░╨╜╨╕╨╕</Label>
                                                <p className="text-sm">{supplier.name}</p>
                                              </div>
                                              {supplier.email && (
                                                <div>
                                                  <Label className="text-sm font-medium">Email</Label>
                                                  {Array.isArray(supplier.email) ? (
                                                    <div className="space-y-1">
                                                      {supplier.email.map((email, idx) => (
                                                        <p key={idx} className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                                                           title="╨Э╨░╨╢╨╝╨╕╤В╨╡ ╨┤╨╗╤П ╨▓╤Л╨▒╨╛╤А╨░ ╤Н╤В╨╛╨│╨╛ email"
                                                           onClick={() => handleEmailSelection(supplier, email)}>
                                                          {cleanEmail(email)}
                                                        </p>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="text-sm">{cleanEmail(supplier.email)}</p>
                                                  )}
                                                </div>
                                              )}
                                              {supplier.phone && (
                                                <div>
                                                  <Label className="text-sm font-medium">╨в╨╡╨╗╨╡╤Д╨╛╨╜</Label>
                                                  <p className="text-sm">{supplier.phone}</p>
                                                </div>
                                              )}
                                              {supplier.website && (
                                                <div>
                                                  <Label className="text-sm font-medium">╨Т╨╡╨▒-╤Б╨░╨╣╤В</Label>
                                                  <p className="text-sm break-all">
                                                    {supplier.website.startsWith('http') ? supplier.website : `http://${supplier.website}`}
                                                  </p>
                                                </div>
                                              )}
                                              {supplier.description && (
                                                <div>
                                                  <Label className="text-sm font-medium">╨Ю╨┐╨╕╤Б╨░╨╜╨╕╨╡</Label>
                                                  <p className="text-sm">{supplier.description}</p>
                                                </div>
                                              )}
                                              {supplier.categories && supplier.categories.length > 0 && (
                                                <div>
                                                  <Label className="text-sm font-medium">╨Ъ╨░╤В╨╡╨│╨╛╤А╨╕╨╕</Label>
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
                                          </ScrollArea>
                                        </DialogContent>
                                      </Dialog>
                                    </SupplierTooltip>
                                  </td>
                                  <td className="px-3 py-1 text-center">
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
                            ╨Ш╤В╨╛╨│╨╛ ╨╖╨░╨│╤А╤Г╨╢╨╡╨╜╨╛ ╨║╨╛╨╜╤В╨░╨║╤В╨╛╨▓: {suppliers.length}. ╨г╨╜╨╕╨║╨░╨╗╤М╨╜╤Л╤Е ╨┤╨╛╨╝╨╡╨╜╨╛╨▓: {
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
                <div>
                  <Alert className="mb-4">
                    <AlertTitle>╨Т╤Л╨▒╤А╨░╨╜╨╛ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨╛╨▓:  {selectedSuppliers.length}</AlertTitle>
                    <AlertDescription>
                      ╨Ч╨░╨┐╤А╨╛╤Б ╨▒╤Г╨┤╨╡╤В ╨╛╤В╨┐╤А╨░╨▓╨╗╨╡╨╜ ╨▓╤Б╨╡╨╝ ╨▓╤Л╨▒╤А╨░╨╜╨╜╤Л╨╝ ╨┐╨╛╤Б╤В╨░╨▓╤Й╨╕╨║╨░╨╝.
                    </AlertDescription>
                  </Alert>
                  <EmailForm 
                    suppliers={suppliers.map(convertToSupplier)} 
                    selectedSuppliers={selectedSuppliers.map(convertToSupplier)} 
                    searchRequest={searchRequest || createEmptyRequest()}
                    comingFromGroup={comingFromGroup}
                    groupId={groupId}
                  />
                </div>
              ) : (
                <div className="flex justify-center items-center" style={{ minHeight: '120px' }}>
                  <div className="text-gray-500">╨Ч╨░╨│╤А╤Г╨╖╨║╨░...</div>
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
