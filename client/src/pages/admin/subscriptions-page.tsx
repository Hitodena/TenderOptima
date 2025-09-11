import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, EditIcon, PlusCircleIcon, RefreshCwIcon, XCircleIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";

interface Subscription {
  id: number;
  userId: number;
  plan: string;
  status: string;
  startDate: string;
  endDate: string | null;
  requestsLimit: number | null;
  requestsUsed: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  username: string;
  userRole: string;
}

interface SubscriptionFormData {
  userId: number;
  userEmail?: string; // For creating new users
  emailAccount?: string; // Email account for user
  emailPassword?: string; // Email password for user
  plan: string;
  status: string;
  maxRequestsPerMonth: number | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
}

export default function SubscriptionsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    // Check if user is admin using localStorage
    const isAdminValue = localStorage.getItem('isAdmin');
    setIsAdmin(isAdminValue === 'true');
    
    // Auto-refresh data when admin accesses the page
    if (isAdminValue === 'true') {
      console.log("Admin access detected, auto-refreshing data");
    }
  }, []);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [formData, setFormData] = useState<SubscriptionFormData>({
    userId: 0,
    userEmail: "",
    emailAccount: "",
    emailPassword: "",
    plan: "trial",
    status: "active",
    maxRequestsPerMonth: 10,
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    notes: null
  });
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [confirmResetDialog, setConfirmResetDialog] = useState(false);
  const [isCreatingNewUser, setIsCreatingNewUser] = useState(false);

  // State for last update tracking
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State for sorting
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Fetch all subscriptions
  const { data: subscriptions, isLoading, error, refetch } = useQuery<Subscription[]>({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      try {
        // Create headers object with admin token and cache busting
        const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
        const timestamp = new Date().getTime();
        const headers = {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken,
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        };
        
        // Pass headers as part of request options with cache busting
        const response = await fetch(`/api/admin/subscriptions?t=${timestamp}`, {
          method: "GET",
          headers,
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching subscriptions: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Fetched subscriptions at:", new Date().toISOString());
        setLastUpdated(new Date());
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("Error fetching admin subscriptions:", err);
        throw err;
      }
    },
    enabled: isAdmin,
    staleTime: 0, // Data is always stale, forcing fresh requests
    refetchOnWindowFocus: true, // Refresh when window regains focus
    refetchOnMount: true // Always refetch on mount
  });

  // Manual refresh function
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Данные обновлены",
        description: "Информация о подписках успешно обновлена",
      });
    } catch (error) {
      toast({
        title: "Ошибка обновления",
        description: "Не удалось обновить данные",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Sorting function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort subscriptions
  const sortedSubscriptions = React.useMemo(() => {
    if (!subscriptions) return [];
    
    return [...subscriptions].sort((a, b) => {
      let aValue = a[sortField as keyof Subscription];
      let bValue = b[sortField as keyof Subscription];
      
      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      // Convert to strings for comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      let comparison = 0;
      if (aStr < bStr) comparison = -1;
      if (aStr > bStr) comparison = 1;
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [subscriptions, sortField, sortDirection]);

  // Fetch all users for the dropdown
  const { data: users = [] } = useQuery<{id: number, username: string}[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      try {
        // Create headers object with admin token
        const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
        const headers = {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken
        };
        
        // Pass headers as part of request options
        const response = await fetch("/api/admin/users", {
          method: "GET",
          headers,
          credentials: "include"
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching users: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Fetched users:", data);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Error fetching users:", error);
        return [];
      }
    },
    enabled: isAdmin
  });

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: SubscriptionFormData) => {
      console.log("Creating subscription with data:", data);
      
      // Create headers object with admin token
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const headers = {
        "Content-Type": "application/json",
        "X-Admin-Token": adminToken
      };
      
      // If creating new user, send userEmail instead of userId
      const requestData = isCreatingNewUser && data.userEmail 
        ? { ...data, userId: undefined, userEmail: data.userEmail }
        : data;
      
      // Use fetch directly since apiRequest doesn't support additionalHeaders properly
      const response = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers,
        body: JSON.stringify(requestData),
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Error creating subscription: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t("subscription.createSuccess"),
        description: t("subscription.createSuccessMessage")
      });
      setShowCreateDialog(false);
      // Invalidate both regular and admin subscription queries
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("subscription.createError"),
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async (data: { id: number, data: Partial<SubscriptionFormData> }) => {
      console.log(`Updating subscription ${data.id} with data:`, data.data);
      
      // Create headers object with admin token
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const headers = {
        "Content-Type": "application/json",
        "X-Admin-Token": adminToken
      };
      
      // Use fetch directly for proper admin authentication
      const response = await fetch(`/api/admin/subscriptions/${data.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(data.data),
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Error updating subscription: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t("subscription.updateSuccess"),
        description: t("subscription.updateSuccessMessage")
      });
      setShowEditDialog(false);
      // Invalidate both regular and admin subscription queries 
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("subscription.updateError"),
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Reset all subscription counts
  const resetSubscriptionsMutation = useMutation({
    mutationFn: async () => {
      // Create headers object with admin token
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const headers = {
        "Content-Type": "application/json",
        "X-Admin-Token": adminToken
      };
      
      // Use fetch directly for proper admin authentication
      const response = await fetch("/api/admin/subscriptions/reset-counts", {
        method: "POST",
        headers,
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Error resetting subscription counts: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t("subscription.resetSuccess"),
        description: t("subscription.resetSuccessMessage")
      });
      setConfirmResetDialog(false);
      // Invalidate both regular and admin subscription queries
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("subscription.resetError"),
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle creating a new subscription
  const handleCreateSubscription = () => {
    createSubscriptionMutation.mutate(formData);
  };

  // Handle updating a subscription
  const handleUpdateSubscription = () => {
    if (selectedSubscription) {
      updateSubscriptionMutation.mutate({
        id: selectedSubscription.id,
        data: formData
      });
    }
  };

  // Reset the form when opening the create dialog
  const openCreateDialog = () => {
    setFormData({
      userId: users && users.length > 0 ? users[0].id : 0,
      plan: "trial",
      status: "active",
      maxRequestsPerMonth: 10,
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      notes: null,
      emailAccount: "",
      emailPassword: ""
    });
    setShowCreateDialog(true);
  };

  // Set the form data when opening the edit dialog
  const openEditDialog = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setFormData({
      userId: subscription.userId,
      plan: subscription.plan,
      status: subscription.status,
      maxRequestsPerMonth: subscription.requestsLimit,
      startDate: subscription.startDate.split('T')[0],
      endDate: subscription.endDate ? subscription.endDate.split('T')[0] : null,
      notes: null, // Not available in current interface  
      emailAccount: "",
      emailPassword: ""
    });
    setShowEditDialog(true);
  };

  // Handle form field changes
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd.MM.yyyy", { locale: ru });
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t("subscription.accessDenied")}</h1>
            <p className="mt-2">{t("subscription.adminOnly")}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("subscription.management")}</h1>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground mt-1">
                Последнее обновление: {format(lastUpdated, "dd.MM.yyyy HH:mm:ss", { locale: ru })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefreshData} 
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCwIcon size={16} className={isRefreshing ? "animate-spin" : ""} /> 
              {isRefreshing ? "Обновление..." : "Обновить данные"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setConfirmResetDialog(true)} 
              className="flex items-center gap-2"
            >
              <RefreshCwIcon size={16} /> {t("subscription.resetCounts")}
            </Button>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <PlusCircleIcon size={16} /> {t("subscription.createNew")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center my-8">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="bg-destructive/20 p-4 rounded-md text-destructive">
            <p>{t("subscription.loadError")}: {(error as Error).message}</p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("subscription.list")}</CardTitle>
              <CardDescription>{t("subscription.listDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('id')}
                    >
                      ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('username')}
                    >
                      {t("subscription.user")} {sortField === 'username' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('plan')}
                    >
                      {t("subscription.plan")} {sortField === 'plan' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('status')}
                    >
                      {t("subscription.status")} {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('startDate')}
                    >
                      {t("subscription.startDate")} {sortField === 'startDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('endDate')}
                    >
                      {t("subscription.endDate")} {sortField === 'endDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('requestsLimit')}
                    >
                      {t("subscription.requestsLimit")} {sortField === 'requestsLimit' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('requestsUsed')}
                    >
                      {t("subscription.requestsUsed")} {sortField === 'requestsUsed' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead>{t("subscription.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSubscriptions && sortedSubscriptions.length > 0 ? (
                    sortedSubscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell>{subscription.id}</TableCell>
                        <TableCell>{subscription.username || t("subscription.unknownUser")}</TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-1 rounded text-xs
                            ${subscription.plan === 'trial' ? 'bg-blue-100 text-blue-800' : ''}
                            ${subscription.plan === 'basic' ? 'bg-green-100 text-green-800' : ''}
                            ${subscription.plan === 'premium' ? 'bg-purple-100 text-purple-800' : ''}
                          `}>
                            {subscription.plan === 'trial' ? t('subscription.plans.trial') :
                             subscription.plan === 'basic' ? t('subscription.plans.basic') :
                             subscription.plan === 'premium' ? t('subscription.plans.premium') : 
                             subscription.plan}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-1 rounded text-xs
                            ${subscription.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                            ${subscription.status === 'expired' ? 'bg-red-100 text-red-800' : ''}
                            ${subscription.status === 'cancelled' ? 'bg-gray-100 text-gray-800' : ''}
                          `}>
                            {subscription.status === 'active' ? t('subscription.statuses.active') :
                             subscription.status === 'expired' ? t('subscription.statuses.expired') :
                             subscription.status === 'cancelled' ? t('subscription.statuses.cancelled') :
                             subscription.status}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(subscription.startDate)}</TableCell>
                        <TableCell>{formatDate(subscription.endDate)}</TableCell>
                        <TableCell>{subscription.requestsLimit || "∞"}</TableCell>
                        <TableCell>{subscription.requestsUsed || 0}</TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => openEditDialog(subscription)}
                            className="h-8 w-8 p-0"
                          >
                            <EditIcon size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4">
                        {t("subscription.noSubscriptions")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Create Subscription Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{t("subscription.createNew")}</DialogTitle>
              <DialogDescription>{t("subscription.createDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="user-type" className="text-right">
                  {t("subscription.user")}
                </Label>
                <div className="col-span-3 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="create-new-user"
                      checked={isCreatingNewUser}
                      onCheckedChange={(checked) => {
                        setIsCreatingNewUser(checked);
                        if (checked) {
                          setFormData(prev => ({ ...prev, userId: 0, userEmail: "" }));
                        } else {
                          setFormData(prev => ({ ...prev, userEmail: "" }));
                        }
                      }}
                    />
                    <Label htmlFor="create-new-user">Создать нового пользователя</Label>
                  </div>
                  
                  {isCreatingNewUser ? (
                    <Input
                      id="userEmail"
                      type="email"
                      placeholder="Email нового пользователя"
                      value={formData.userEmail || ""}
                      onChange={(e) => handleFormChange("userEmail", e.target.value)}
                      className="w-full"
                    />
                  ) : (
                    <Select 
                      value={String(formData.userId)} 
                      onValueChange={(value) => handleFormChange("userId", parseInt(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("subscription.selectUser")} />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="plan" className="text-right">
                  {t("subscription.plan")}
                </Label>
                <Select 
                  value={formData.plan} 
                  onValueChange={(value) => handleFormChange("plan", value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t("subscription.selectPlan")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">{t("subscription.plans.trial")}</SelectItem>
                    <SelectItem value="basic">{t("subscription.plans.basic")}</SelectItem>
                    <SelectItem value="premium">{t("subscription.plans.premium")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  {t("subscription.status")}
                </Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => handleFormChange("status", value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t("subscription.selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("subscription.statuses.active")}</SelectItem>
                    <SelectItem value="expired">{t("subscription.statuses.expired")}</SelectItem>
                    <SelectItem value="cancelled">{t("subscription.statuses.cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="maxRequestsPerMonth" className="text-right">
                  {t("subscription.requestsLimit")}
                </Label>
                <div className="col-span-3 flex items-center space-x-4">
                  <Input
                    id="maxRequestsPerMonth"
                    type="number"
                    value={formData.maxRequestsPerMonth !== null ? formData.maxRequestsPerMonth : ''}
                    onChange={(e) => handleFormChange("maxRequestsPerMonth", e.target.value ? parseInt(e.target.value) : null)}
                    disabled={!formData.maxRequestsPerMonth}
                    className="w-full"
                  />
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="unlimited-requests"
                      checked={formData.maxRequestsPerMonth === null}
                      onCheckedChange={(checked) => 
                        handleFormChange("maxRequestsPerMonth", checked ? null : 10)
                      }
                    />
                    <Label htmlFor="unlimited-requests">{t("subscription.unlimited")}</Label>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="startDate" className="text-right">
                  {t("subscription.startDate")}
                </Label>
                <div className="col-span-3">
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {formData.startDate ? (
                          format(new Date(formData.startDate), "dd.MM.yyyy", { locale: ru })
                        ) : (
                          <span>{t("subscription.pickDate")}</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.startDate ? new Date(formData.startDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            handleFormChange("startDate", date.toISOString().split('T')[0]);
                            setStartDateOpen(false);
                          }
                        }}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endDate" className="text-right">
                  {t("subscription.endDate")}
                </Label>
                <div className="col-span-3">
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {formData.endDate ? (
                          format(new Date(formData.endDate), "dd.MM.yyyy", { locale: ru })
                        ) : (
                          <span>{t("subscription.pickDate")}</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.endDate ? new Date(formData.endDate) : undefined}
                        onSelect={(date) => {
                          handleFormChange("endDate", date ? date.toISOString().split('T')[0] : null);
                          setEndDateOpen(false);
                        }}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="emailAccount" className="text-right">
                  Email аккаунт
                </Label>
                <Input
                  id="emailAccount"
                  value={formData.emailAccount || ''}
                  onChange={(e) => handleFormChange("emailAccount", e.target.value)}
                  className="col-span-3"
                  placeholder="user@example.com"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="emailPassword" className="text-right">
                  Пароль email
                </Label>
                <Input
                  id="emailPassword"
                  type="password"
                  value={formData.emailPassword || ''}
                  onChange={(e) => handleFormChange("emailPassword", e.target.value)}
                  className="col-span-3"
                  placeholder="Введите пароль"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  {t("subscription.notes")}
                </Label>
                <Input
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {t("subscription.cancel")}
              </Button>
              <Button 
                onClick={handleCreateSubscription} 
                disabled={createSubscriptionMutation.isPending}
              >
                {createSubscriptionMutation.isPending && <Spinner className="mr-2" size="sm" />}
                {t("subscription.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Subscription Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{t("subscription.edit")}</DialogTitle>
              <DialogDescription>
                {t("subscription.editDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-plan" className="text-right">
                  {t("subscription.plan")}
                </Label>
                <Select 
                  value={formData.plan} 
                  onValueChange={(value) => handleFormChange("plan", value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t("subscription.selectPlan")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">{t("subscription.plans.trial")}</SelectItem>
                    <SelectItem value="basic">{t("subscription.plans.basic")}</SelectItem>
                    <SelectItem value="premium">{t("subscription.plans.premium")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  {t("subscription.status")}
                </Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => handleFormChange("status", value)}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t("subscription.selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("subscription.statuses.active")}</SelectItem>
                    <SelectItem value="expired">{t("subscription.statuses.expired")}</SelectItem>
                    <SelectItem value="cancelled">{t("subscription.statuses.cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-maxRequestsPerMonth" className="text-right">
                  {t("subscription.requestsLimit")}
                </Label>
                <div className="col-span-3 flex items-center space-x-4">
                  <Input
                    id="edit-maxRequestsPerMonth"
                    type="number"
                    value={formData.maxRequestsPerMonth !== null ? formData.maxRequestsPerMonth : ''}
                    onChange={(e) => handleFormChange("maxRequestsPerMonth", e.target.value ? parseInt(e.target.value) : null)}
                    disabled={formData.maxRequestsPerMonth === null}
                    className="w-full"
                  />
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-unlimited-requests"
                      checked={formData.maxRequestsPerMonth === null}
                      onCheckedChange={(checked) => 
                        handleFormChange("maxRequestsPerMonth", checked ? null : 10)
                      }
                    />
                    <Label htmlFor="edit-unlimited-requests">{t("subscription.unlimited")}</Label>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-startDate" className="text-right">
                  {t("subscription.startDate")}
                </Label>
                <div className="col-span-3">
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {formData.startDate ? (
                          format(new Date(formData.startDate), "dd.MM.yyyy", { locale: ru })
                        ) : (
                          <span>{t("subscription.pickDate")}</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.startDate ? new Date(formData.startDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            handleFormChange("startDate", date.toISOString().split('T')[0]);
                            setStartDateOpen(false);
                          }
                        }}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-endDate" className="text-right">
                  {t("subscription.endDate")}
                </Label>
                <div className="col-span-3">
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        {formData.endDate ? (
                          format(new Date(formData.endDate), "dd.MM.yyyy", { locale: ru })
                        ) : (
                          <span>{t("subscription.pickDate")}</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.endDate ? new Date(formData.endDate) : undefined}
                        onSelect={(date) => {
                          handleFormChange("endDate", date ? date.toISOString().split('T')[0] : null);
                          setEndDateOpen(false);
                        }}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-emailAccount" className="text-right">
                  Email аккаунт
                </Label>
                <Input
                  id="edit-emailAccount"
                  value={formData.emailAccount || ''}
                  onChange={(e) => handleFormChange("emailAccount", e.target.value)}
                  className="col-span-3"
                  placeholder="user@example.com"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-emailPassword" className="text-right">
                  Пароль email
                </Label>
                <Input
                  id="edit-emailPassword"
                  type="password"
                  value={formData.emailPassword || ''}
                  onChange={(e) => handleFormChange("emailPassword", e.target.value)}
                  className="col-span-3"
                  placeholder="Введите новый пароль"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-notes" className="text-right">
                  {t("subscription.notes")}
                </Label>
                <Input
                  id="edit-notes"
                  value={formData.notes || ''}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                {t("subscription.cancel")}
              </Button>
              <Button 
                onClick={handleUpdateSubscription} 
                disabled={updateSubscriptionMutation.isPending}
              >
                {updateSubscriptionMutation.isPending && <Spinner className="mr-2" size="sm" />}
                {t("subscription.update")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Confirm Dialog */}
        <AlertDialog open={confirmResetDialog} onOpenChange={setConfirmResetDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("subscription.confirmReset")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("subscription.confirmResetDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("subscription.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => resetSubscriptionsMutation.mutate()}
                disabled={resetSubscriptionsMutation.isPending}
              >
                {resetSubscriptionsMutation.isPending && <Spinner className="mr-2" size="sm" />}
                {t("subscription.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}