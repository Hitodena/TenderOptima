import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchRequest, Supplier } from "@shared/schema";
import { Globe, Mail, Phone, Plus, UserPlus, BarChartHorizontal } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogClose,
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { SupplierCompactCard } from "@/components/supplier-compact-card";
import { SearchAnimation } from "@/components/search-animation";
import { useLanguage } from "@/contexts/language-context";
import { SendRequestButton } from "@/components/send-request-button";

interface Props {
  searchRequest: SearchRequest;
  selectedSuppliers: Supplier[];
  onSuppliersSelected: (suppliers: Supplier[]) => void;
}

export function SupplierResults({ searchRequest, selectedSuppliers, onSuppliersSelected }: Props) {
  const [, setLocation] = useLocation();

  // Define response type for better type safety
  interface SearchResultsResponse {
    request: SearchRequest;
    matchedSuppliers: Supplier[];
  }

  const { data: searchData, isLoading, error } = useQuery<SearchResultsResponse>({
    // Use separate endpoint to get suppliers for an existing request
    queryKey: ["/api/search-requests/suppliers", searchRequest.id],
    queryFn: async () => {
      console.log("Fetching suppliers for existing request ID:", searchRequest.id);

      // Use GET request to fetch suppliers for an existing request
      const data = await apiRequest<SearchResultsResponse>(
        `/api/search-requests/${searchRequest.id}/suppliers`, 
        "GET"
      );

      console.log("Received supplier data:", data);
      if (!data || !data.matchedSuppliers) {
        throw new Error("No suppliers data received from server");
      }
      return data;
    },
    enabled: !!searchRequest && !!searchRequest.id,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: 1
  });

  const [selectedIds, setSelectedIds] = useState<Array<number|string>>([]);
  const [customSuppliers, setCustomSuppliers] = useState<Supplier[]>([]);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    keywords: ''
  });
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  
  // Separate suppliers by source type
  const dbSuppliers = (searchData?.matchedSuppliers || []).filter(s => typeof s.id === 'number' && s.id > 0);
  const apiSuppliers = (searchData?.matchedSuppliers || []).filter(s => typeof s.id === 'number' && s.id < 0 && !customSuppliers.some(cs => cs.id === s.id));
  // Combine all suppliers for selection functionality
  const matchedSuppliers = [...dbSuppliers, ...apiSuppliers, ...customSuppliers];
  
  // Handle navigation to comparison parameters page
  const handleCompareSelected = () => {
    const selectedSuppliers = matchedSuppliers.filter(s => selectedIds.includes(s.id));
    
    if (selectedSuppliers.length < 2) {
      toast({
        title: "Select at least two suppliers",
        description: "Please select at least two suppliers to compare.",
        variant: "destructive"
      });
      return;
    }
    
    // Store selected suppliers in localStorage to pass to comparison page
    localStorage.setItem('compareSuppliers', JSON.stringify(selectedSuppliers));
    if (searchRequest.id) {
      localStorage.setItem('compareRequestId', searchRequest.id.toString());
    }
    
    // Navigate to comparison parameters page
    setLocation('/compare-parameters');
  };

  // Handle sending emails to selected suppliers
  const handleSendEmails = () => {
    // Store selected suppliers in localStorage to pass to the send request page
    const selectedSuppliers = matchedSuppliers.filter(s => selectedIds.includes(s.id));
    localStorage.setItem('sendRequestSuppliers', JSON.stringify(selectedSuppliers));
    if (searchRequest.id) {
      localStorage.setItem('sendRequestId', searchRequest.id.toString());
    }
    // Navigate to send request page
    setLocation('/send-request');
  };

  const handleSupplierSelection = useCallback((checked: boolean | string, supplierId: number | string) => {
    setSelectedIds(ids => {
      const newIds = checked === true
        ? [...ids, supplierId]
        : ids.filter(id => id !== supplierId);
      const selectedSuppliers = matchedSuppliers.filter(s => newIds.includes(s.id));
      onSuppliersSelected(selectedSuppliers);
      return newIds;
    });
  }, [matchedSuppliers, onSuppliersSelected]);
  
  const handleCustomSupplierChange = (field: string, value: string) => {
    setNewSupplier(prev => ({ ...prev, [field]: value }));
  };
  
  const addCustomSupplier = () => {
    // Validate required fields
    if (!newSupplier.email) {
      toast({
        title: "Email is required",
        description: "Please provide an email address for the supplier.",
        variant: "destructive"
      });
      return;
    }
    
    // Create a unique negative ID for custom suppliers
    const customId = -1000 - customSuppliers.length;
    
    // Create supplier object
    const supplier: Supplier = {
      id: customId,
      userId: null, // Add required field
      name: newSupplier.name || 'Custom Supplier',
      email: newSupplier.email,
      phone: newSupplier.phone || 'N/A',
      website: newSupplier.website || 'N/A',
      description: `Custom supplier with keywords: ${newSupplier.keywords || 'None provided'}`,
      categories: newSupplier.keywords ? newSupplier.keywords.split(',') : [],
      responseRate: null,
      totalRequests: 0,
      successfulMatches: 0,
      keywordStrength: null,
      lastResponseTime: null
    };
    
    // Add to custom suppliers list
    setCustomSuppliers(prev => [...prev, supplier]);
    
    // Clear the form
    setNewSupplier({
      name: '',
      email: '',
      phone: '',
      website: '',
      keywords: ''
    });
    
    // Close the dialog
    setIsAddingSupplier(false);
    
    toast({
      title: "Supplier added",
      description: "Custom supplier has been added to your list."
    });
  };


  // Используем useRef чтобы отслеживать предыдущие выбранные поставщики и избежать лишних обновлений
  const prevSelectedRef = React.useRef<string>('');
  
  useEffect(() => {
    // Только обновляем родителя, если matchedSuppliers или selectedIds действительно изменились
    const selected = matchedSuppliers.filter(s => selectedIds.includes(s.id));
    
    // Создаем стабильное представление выбранных ID для сравнения
    const selectedJson = JSON.stringify(selected.map(s => s.id).sort());
    
    // Вызываем колбэк только если выбор действительно изменился
    if (selectedJson !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedJson;
      onSuppliersSelected(selected);
    }
  }, [selectedIds, matchedSuppliers, onSuppliersSelected]);

  // Get translations
  const { t } = useLanguage();
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Matching Suppliers</h2>
        
        {/* Add the animated search process */}
        <SearchAnimation 
          isSearching={true} 
          searchType={{
            useDbSearch: true,
            useApiSearch: true
          }}
        />
        
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p>Error fetching supplier data: {error.message}</p>; // Added error handling
  }

  if (!matchedSuppliers || matchedSuppliers.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No suppliers found matching your requirements.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Handle "select all" functionality
  const allSelected = matchedSuppliers.length > 0 && selectedIds.length === matchedSuppliers.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < matchedSuppliers.length;
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all suppliers
      setSelectedIds(matchedSuppliers.map(s => s.id));
    } else {
      // Deselect all suppliers
      setSelectedIds([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold">Найдено контактов ({matchedSuppliers.length})</h2>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              className="inline-flex items-center gap-1 bg-blue-600"
              onClick={handleCompareSelected}
            >
              <BarChartHorizontal className="h-4 w-4" />
              Сравнить поставщиков
            </Button>
          )}
          <Button
            className="inline-flex items-center gap-1"
            onClick={() => {
              // Only proceed if suppliers are selected
              if (selectedIds.length === 0) {
                toast({
                  title: "Выберите поставщиков",
                  description: "Пожалуйста, выберите хотя бы одного поставщика для продолжения.",
                  variant: "destructive",
                });
                return;
              }
              
              // Store selected suppliers in localStorage to pass to the send request page
              const selectedSuppliers = matchedSuppliers.filter(s => selectedIds.includes(s.id));
              localStorage.setItem('sendRequestSuppliers', JSON.stringify(selectedSuppliers));
              if (searchRequest.id) {
                localStorage.setItem('sendRequestId', searchRequest.id.toString());
              }
              
              // Add flag to show supplier selection view, not the email form
              localStorage.setItem('showSupplierSelectionView', 'true');
              
              // Navigate to send request page
              setLocation('/send-request');
            }}
          >
            <Mail className="h-4 w-4" />
            Создать рассылку
          </Button>
          <Dialog open={isAddingSupplier} onOpenChange={setIsAddingSupplier}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="inline-flex items-center gap-1"
                onClick={() => setIsAddingSupplier(true)}
              >
                <UserPlus className="h-4 w-4" />
                Add Custom Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Custom Supplier</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input 
                    id="company-name" 
                    placeholder="Enter company name" 
                    value={newSupplier.name}
                    onChange={(e) => handleCustomSupplierChange('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address<span className="text-red-500">*</span></Label>
                  <Input 
                    id="email" 
                    placeholder="Enter email address" 
                    value={newSupplier.email}
                    onChange={(e) => handleCustomSupplierChange('email', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    placeholder="Enter phone number" 
                    value={newSupplier.phone}
                    onChange={(e) => handleCustomSupplierChange('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input 
                    id="website" 
                    placeholder="Enter website URL" 
                    value={newSupplier.website}
                    onChange={(e) => handleCustomSupplierChange('website', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                  <Input 
                    id="keywords" 
                    placeholder="Enter keywords, separated by commas" 
                    value={newSupplier.keywords}
                    onChange={(e) => handleCustomSupplierChange('keywords', e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddingSupplier(false)}
                >
                  Cancel
                </Button>
                <Button onClick={addCustomSupplier}>Add Supplier</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Select All checkbox */}
      <div className="flex justify-between items-center mb-4 bg-muted p-2 rounded-md">
        <div className="flex items-center gap-2">
          <Checkbox 
            id="select-all"
            checked={allSelected}
            className={someSelected ? "opacity-80" : ""}
            onCheckedChange={handleSelectAll}
          />
          <Label htmlFor="select-all" className="cursor-pointer">Select All</Label>
        </div>
        <div className="text-sm text-muted-foreground">
          {selectedIds.length} of {matchedSuppliers.length} suppliers selected
        </div>
      </div>
      
      {/* Supplier List - Tabbed by Source */}
      <div className="mb-4 border rounded-lg overflow-hidden shadow-sm">
        <div className="max-h-[600px] overflow-y-auto">
          {/* Database Suppliers Section */}
          {dbSuppliers.length > 0 && (
            <div className="bg-card">
              <div className="bg-muted/50 p-2">
                <h3 className="text-md font-medium flex items-center">
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Поиск по реестру компаний ({dbSuppliers.length})
                </h3>
              </div>
              <div className="divide-y">
                {dbSuppliers.map((supplier) => (
                  <SupplierCompactCard 
                    key={supplier.id}
                    supplier={supplier}
                    isSelected={selectedIds.includes(supplier.id)}
                    onSelect={handleSupplierSelection}
                  />
                ))}
              </div>
            </div>
          )}

          {/* API Suppliers Section */}
          {apiSuppliers.length > 0 && (
            <div className="bg-card border-t">
              <div className="bg-muted/50 p-2">
                <h3 className="text-md font-medium flex items-center">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  AI поиск в интернет ({apiSuppliers.length})
                </h3>
              </div>
              <div className="divide-y">
                {apiSuppliers.map((supplier) => (
                  <SupplierCompactCard 
                    key={supplier.id}
                    supplier={supplier}
                    isSelected={selectedIds.includes(supplier.id)}
                    onSelect={handleSupplierSelection}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom Suppliers Section */}
          {customSuppliers.length > 0 && (
            <div className="bg-card border-t">
              <div className="bg-muted/50 p-2">
                <h3 className="text-md font-medium flex items-center">
                  <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  Свои поставщики ({customSuppliers.length})
                </h3>
              </div>
              <div className="divide-y">
                {customSuppliers.map((supplier) => (
                  <SupplierCompactCard 
                    key={supplier.id}
                    supplier={supplier}
                    isSelected={selectedIds.includes(supplier.id)}
                    onSelect={handleSupplierSelection}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {matchedSuppliers.length === 0 && (
            <Card className="p-6">
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  {t("no_suppliers_found") || "Не найдено поставщиков, соответствующих вашим требованиям."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}