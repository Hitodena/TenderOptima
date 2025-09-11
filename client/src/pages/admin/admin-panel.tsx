import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useTranslation } from "@/contexts/language-context";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangleIcon, ShieldIcon, UsersIcon } from "lucide-react";
import { Redirect } from "wouter";

// Lazy load admin features
const SubscriptionsPage = React.lazy(() => import('./subscriptions-page'));

export default function AdminPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("subscriptions");
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
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
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

       

        <React.Suspense fallback={<div className="p-8 text-center">{t("loading")}</div>}>
          <SubscriptionsPage />
        </React.Suspense>
      </div>
    </div>
  );
}