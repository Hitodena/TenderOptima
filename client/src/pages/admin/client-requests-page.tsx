import React, { useState } from "react";
import { useTranslation } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import ClientsListPage from "./clients-list-page";
import ClientDetailsPage from "./client-details-page";

interface Client {
  userId: number;
  userName: string;
  userEmail: string;
  requestCount: number;
  lastRequestDate: string;
}

export default function ClientRequestsPage() {
  const { t } = useTranslation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<'list' | 'details'>('list');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Check authentication and admin role
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/auth" />;
  }

  if (user.role !== 'admin') {
    return <Redirect to="/" />;
  }

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setCurrentView('details');
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedClient(null);
  };

  if (currentView === 'details' && selectedClient) {
    return (
      <ClientDetailsPage 
        client={selectedClient} 
        onBack={handleBackToList}
      />
    );
  }

  return (
    <ClientsListPage 
      onClientSelect={handleClientSelect}
      onBack={() => {}} // No back action needed for main view
    />
  );
}
