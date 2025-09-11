import { SupplierSearchForm } from "@/components/supplier-search-form";
import { SupplierResults } from "@/components/supplier-results";
import { EmailForm } from "@/components/email-form";
import { DirectEmailForm } from "@/components/direct-email-form";
import { LastViewedRequest } from "@/components/last-viewed-request";
import { MainNavigation } from "@/components/main-navigation";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { SubscriptionAlerts } from "@/components/subscription-alerts";
import { RequestLockdown } from "@/components/request-lockdown";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { Search, Send, ListFilter } from "lucide-react";
import { Link } from "wouter";
import type { SearchRequest, Supplier } from "@shared/schema";

export default function Home() {
  const [searchRequest, setSearchRequest] = useState<SearchRequest | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  const [showDirectEmailForm, setShowDirectEmailForm] = useState(false);
  const { isActiveOrLoading } = useSubscription();

  // Check if user should see welcome page (first time user)
  React.useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
    
    if (!hasSeenWelcome) {
      localStorage.setItem('has_seen_welcome', 'true');
      window.location.href = '/welcome';
      return;
    }
  }, []);

  // Function to create empty request for direct email
  const createEmptyRequest = (): SearchRequest => {
    return {
      id: 0, // Will be assigned on server
      orderNumber: '',
      productName: '',
      productDescription: '',
      timeline: '',
      additionalRequirements: null,
      status: 'pending',
      createdAt: null,
      matchedSuppliers: null,
      useDbSearch: false,
      useApiSearch: false
    } as SearchRequest;
  };

  return (
    <RequestLockdown pageName="Найти поставщиков">
      <div className="min-h-screen bg-background">
        <SubscriptionAlerts />
        <SubscriptionGuard isActive={isActiveOrLoading}>
          <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          
        </div>
        
        {/* Show last viewed requests for returning users */}
        <LastViewedRequest />

        {!searchRequest && !showDirectEmailForm ? (
          <>
            <SupplierSearchForm onComplete={setSearchRequest} />
          </>
        ) : showDirectEmailForm ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">Отправить запрос поставщикам</h2>
              <button 
                onClick={() => setShowDirectEmailForm(false)} 
                className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Вернуться к поиску
              </button>
            </div>
            <DirectEmailForm searchRequest={createEmptyRequest()} />
          </div>
        ) : (
          <div className="space-y-8">
            {searchRequest && (
              <>
                <SupplierResults
                  searchRequest={searchRequest}
                  selectedSuppliers={selectedSuppliers}
                  onSuppliersSelected={setSelectedSuppliers}
                />
                {selectedSuppliers.length > 0 && (
                  <EmailForm
                    suppliers={selectedSuppliers}
                    selectedSuppliers={selectedSuppliers}
                    searchRequest={searchRequest}
                  />
                )}
              </>
            )}
          </div>
        )}
          </div>
        </SubscriptionGuard>
      </div>
    </RequestLockdown>
  );
}
