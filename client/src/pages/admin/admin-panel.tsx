import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "@/contexts/language-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangleIcon, ShieldIcon, UsersIcon, CreditCardIcon, CheckSquareIcon, Building2Icon, BanIcon, FileSearchIcon, MailIcon } from "lucide-react";
import { Redirect } from "wouter";

// Lazy load admin features
const SubscriptionsPage = React.lazy(() => import('./subscriptions-page'));
const ModerationPage = React.lazy(() => import('./moderation-page'));
const VerifiedListPage = React.lazy(() => import('./verified-list-page'));
const ExcludedDomainsPage = React.lazy(() => import('./excluded-domains-page'));
const ClientRequestsPage = React.lazy(() => import('./client-requests-page'));
const UnprocessedEmailsPage = React.lazy(() => import('./unprocessed-emails'));

export default function AdminPanel() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string>("subscriptions");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminUsername, setAdminUsername] = useState("");

  useEffect(() => {
    // Check for admin access using localStorage
    const checkAdminStatus = () => {
      const isAdminValue = localStorage.getItem('isAdmin');
      const username = localStorage.getItem('adminUsername');
      
      if (isAdminValue === 'true') {
        setIsAdmin(true);
        setAdminUsername(username || 'admin');
      }
      
      setIsLoading(false);
    };
    
    checkAdminStatus();
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  // Redirect non-admin users
  if (!isAdmin) {
    console.error("Unauthorized access attempt to admin panel");
    return <Redirect to="/admin-login" />;
  }
  
  console.log("Admin panel accessed by admin user:", adminUsername);

  return (
    <div className="admin-panel bg-background min-h-screen">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShieldIcon className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">{t("admin.panel")}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {adminUsername}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  localStorage.removeItem('isAdmin');
                  localStorage.removeItem('adminUsername');
                  localStorage.removeItem('adminToken');
                  window.location.href = '/';
                }}
              >
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r shadow-sm">
          <nav className="p-4">
            <div className="space-y-2">
              <Button
                variant={activeSection === 'subscriptions' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('subscriptions')}
              >
                <CreditCardIcon className="mr-2 h-4 w-4" />
                Управление подписками
              </Button>
              <Button
                variant={activeSection === 'moderation' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('moderation')}
              >
                <CheckSquareIcon className="mr-2 h-4 w-4" />
                Модерация поставщиков
              </Button>
              <Button
                variant={activeSection === 'verified-list' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('verified-list')}
              >
                <Building2Icon className="mr-2 h-4 w-4" />
                Реестр поставщиков
              </Button>
              <Button
                variant={activeSection === 'excluded-domains' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('excluded-domains')}
              >
                <BanIcon className="mr-2 h-4 w-4" />
                Стоп-лист сайтов
              </Button>
              <Button
                variant={activeSection === 'client-requests' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('client-requests')}
              >
                <FileSearchIcon className="mr-2 h-4 w-4" />
                Запросы клиентов
              </Button>
              <Button
                variant={activeSection === 'unprocessed-emails' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setActiveSection('unprocessed-emails')}
              >
                <MailIcon className="mr-2 h-4 w-4" />
                Неразобранные письма
              </Button>
            </div>
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          <React.Suspense fallback={<div className="p-8 text-center">{t("loading")}</div>}>
            {activeSection === 'subscriptions' && <SubscriptionsPage />}
            {activeSection === 'moderation' && <ModerationPage />}
            {activeSection === 'verified-list' && <VerifiedListPage />}
            {activeSection === 'excluded-domains' && <ExcludedDomainsPage />}
            {activeSection === 'client-requests' && <ClientRequestsPage />}
            {activeSection === 'unprocessed-emails' && <UnprocessedEmailsPage />}
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}