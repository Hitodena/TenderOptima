import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Supplier, SearchRequest, emailTemplateSchema } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Globe, Mail, Phone } from "lucide-react";
import { MainNavigation } from "@/components/main-navigation";

type CloneRequestParams = {
  id: string;
};

// Schema for the form
const cloneRequestSchema = emailTemplateSchema.extend({
  suppliers: z.array(z.union([z.number(), z.string()])).min(1, "Please select at least one supplier")
});

// Format deadline to more user-friendly format
const formatDeadline = (isoDate: string | null | undefined): string => {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year} до 18 часов (GMT+3)`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return isoDate;
  }
};

export default function CloneRequest() {
  const [, setLocation] = useLocation();
  const params = useParams<CloneRequestParams>();
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [customSuppliers, setCustomSuppliers] = useState<Supplier[]>([]);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    keywords: ''
  });

  // Get the original request and its suppliers
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/search-requests", "clone", id], // ✅ ИСПРАВЛЕНО: уникальный ключ
    queryFn: async () => {
      if (!id) throw new Error("Invalid request ID");
      
      // Get the request details including contacted suppliers
      const response = await apiRequest<{
        request: SearchRequest;
        requestSuppliers: any[];
        supplierResponses: any[];
      }>(`/api/search-requests/${id}`, "GET");
      
      // Get all available suppliers from the database for this request
      const suppliersResponse = await apiRequest<{
        request: SearchRequest;
        matchedSuppliers: Supplier[];
      }>(`/api/search-requests/${id}/suppliers`, "GET");
      
      console.log("Original request with suppliers:", response);
      console.log("All available suppliers:", suppliersResponse.matchedSuppliers);
      
      // Create the combined data with both supplier lists
      const result = {
        ...response,
        matchedSuppliers: suppliersResponse.matchedSuppliers || []
      };
      
      console.log("Combined data:", result);
      
      return result;
    },
    enabled: !!id,
    staleTime: Infinity
  });

  // Setup form with default values
  const form = useForm({
    // resolver: zodResolver(cloneRequestSchema),
    defaultValues: {
      suppliers: [] as Array<number|string>,
      subject: "",
      message: "",
      requestId: id,
      attachments: []
    }
  });

  // Create a custom email message when data is loaded
  useEffect(() => {
    if (data?.request) {
      const request = data.request;
      
      // Build a default subject and message
      const subject = `Request for Quotation: ${request.productName}`;
      
      const message = `
Dear Supplier,

We are seeking quotations for the following product:

Product: ${request.productName}
Description: ${request.productDescription}
Timeline: ${formatDeadline(request.timeline)}

Please respond with your best offer, including:
- Price per unit
- Delivery time
- Payment terms
- Warranty information
- Product quality specifications
- Minimum order quantity

We look forward to your response.

Best regards,
Procurement Team
`;
      
      // Extract all supplier IDs from both the requested suppliers and matched suppliers
      const requestedSupplierIds = data.requestSuppliers?.map(rs => Number(rs.supplierId)) || [];
      const matchedSupplierIds = data.matchedSuppliers?.map(s => s.id) || [];
      
      // Combine all supplier IDs and remove duplicates
      const allSupplierIds = Array.from(new Set([...requestedSupplierIds, ...matchedSupplierIds]));
      
      console.log("Setting form with suppliers:", allSupplierIds);
      
      form.reset({
        suppliers: allSupplierIds,
        subject,
        message,
        requestId: id,
        attachments: []
      });
    }
  }, [data, form, id]);

  // Handle form submission to send request
  const sendRequestMutation = useMutation({
    mutationFn: async (formData: z.infer<typeof cloneRequestSchema>) => {
      // First create the clone with a new order number
      const cloneResponse = await apiRequest<{success: boolean, request: SearchRequest}>(`/api/search-requests/${id}/clone`, 'POST');
      
      // Handle both database and API suppliers
      const selectedSupplierIds = formData.suppliers;
      const apiSuppliers = customSuppliers.filter(s => selectedSupplierIds.includes(s.id));
      
      console.log("Cloned request:", cloneResponse);
      console.log("Selected supplier IDs:", selectedSupplierIds);
      console.log("API suppliers:", apiSuppliers);
      
      // Then send emails to all selected suppliers
      const emailResponse = await apiRequest<{
        success: boolean,
        orderNumber: string,
        successCount: number,
        totalCount: number
      }>("/api/send-email", "POST", {
        ...formData,
        requestId: cloneResponse.request.id,
        suppliers: selectedSupplierIds,
        apiSuppliers: apiSuppliers
      });
      
      return {
        ...emailResponse,
        orderNumber: emailResponse.orderNumber || cloneResponse.request.orderNumber
      };
    },
    onSuccess: (data) => {
      // Show success message
      toast({
        title: "Request Sent",
        description: `Your request has been successfully sent to ${data.successCount} suppliers.`
      });
      
      // Navigate to success page
      setLocation(`/success/${data.orderNumber}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send request",
        variant: "destructive"
      });
    }
  });

  // Handle adding a custom supplier
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
    
    // Add to selected suppliers in the form
    const currentSuppliers = form.getValues("suppliers");
    form.setValue("suppliers", [...currentSuppliers, customId]);
    
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

  // Handle supplier selection
  const handleSupplierSelection = (checked: boolean, supplierId: number | string) => {
    const currentSuppliers = form.getValues("suppliers") || [];
    
    if (checked) {
      const newSuppliers = [...currentSuppliers];
      if (!newSuppliers.includes(supplierId)) {
        newSuppliers.push(supplierId);
      }
      form.setValue("suppliers", newSuppliers);
    } else {
      form.setValue("suppliers", currentSuppliers.filter(id => id !== supplierId));
    }
    
    // Trigger validation after selection
    form.trigger("suppliers");
  };

  const handleSubmit = form.handleSubmit((formData) => {
    sendRequestMutation.mutate(formData);
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p>Loading request details...</p>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-red-500 mb-4">Error loading request details</p>
        <Button asChild>
          <a href="/dashboard">Back to Dashboard</a>
        </Button>
      </div>
    );
  }

  // Convert requestSuppliers from the API into proper Supplier objects
  const requestSupplierList: Supplier[] = data.requestSuppliers?.map(rs => ({
    id: Number(rs.supplierId), // Convert to number for consistency
    name: rs.supplierName,
    email: rs.supplierEmail,
    website: rs.supplierWebsite || 'N/A',
    phone: rs.supplierPhone || 'N/A',
    description: `Previously contacted supplier for request #${id}`,
    categories: [],
    responseRate: null,
    totalRequests: 0,
    successfulMatches: 0,
    keywordStrength: null,
    lastResponseTime: null
  })) || [];
  
  console.log("Original requested suppliers:", requestSupplierList);
  
  // Combine all suppliers (requested + matched + custom)
  const allSuppliers = [
    ...requestSupplierList,
    ...(data.matchedSuppliers || []), 
    ...customSuppliers
  ];
  
  // Remove duplicates (suppliers might appear in both lists)
  const uniqueSuppliers = allSuppliers.filter((supplier, index, self) =>
    index === self.findIndex(s => s.id === supplier.id)
  );
  
  console.log("All unique suppliers:", uniqueSuppliers);
  
  const selectedSupplierIds = form.watch("suppliers");

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Matching Suppliers ({uniqueSuppliers.length})</h2>
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
        
        {/* Select All checkbox */}
        <div className="flex justify-between items-center mb-4 bg-muted p-2 rounded-md">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="select-all"
              checked={uniqueSuppliers.length > 0 && uniqueSuppliers.length === selectedSupplierIds.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  form.setValue("suppliers", uniqueSuppliers.map(s => s.id));
                } else {
                  form.setValue("suppliers", []);
                }
              }}
            />
            <Label htmlFor="select-all">Select All</Label>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedSupplierIds.length} of {uniqueSuppliers.length} suppliers selected
          </div>
        </div>
        
        {/* Supplier List - Compact Design */}
        <div className="space-y-2 mb-6">
          {uniqueSuppliers.map((supplier) => (
            <Card key={supplier.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`supplier-${supplier.id}`}
                    checked={selectedSupplierIds.includes(supplier.id)}
                    onCheckedChange={(checked) => {
                      handleSupplierSelection(!!checked, supplier.id);
                    }}
                  />
                  <div className="space-y-1 w-full">
                    <div>
                      <Label htmlFor={`supplier-${supplier.id}`} className="font-medium text-base">
                        {supplier.name}
                      </Label>
                      <p className="text-sm text-muted-foreground line-clamp-2">{supplier.description}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <a
                          href={supplier.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate"
                        >
                          {supplier.website}
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <a
                          href={`mailto:${supplier.email}`}
                          className="text-sm text-primary hover:underline truncate"
                        >
                          {supplier.email}
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm truncate">{supplier.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Send Request Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-xl font-semibold">Send Request to Selected Suppliers</h2>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              {...form.register("subject")}
              placeholder="Enter email subject"
            />
            {form.formState.errors.subject && (
              <p className="text-sm text-red-500">
                {form.formState.errors.subject.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              {...form.register("message")}
              placeholder="Enter your message to suppliers"
              className="min-h-[300px]"
            />
            {form.formState.errors.message && (
              <p className="text-sm text-red-500">
                {form.formState.errors.message.message}
              </p>
            )}
          </div>
          
          <div className="pt-4 space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={sendRequestMutation.isPending}
            >
              {sendRequestMutation.isPending
                ? "Sending..."
                : `Send Request to ${selectedSupplierIds.length} Suppliers`}
            </Button>
            
            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={() => setLocation(`/requests/${id}`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}