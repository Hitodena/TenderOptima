import { useLanguage } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";
import { Language } from "@/utils/translations";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Settings, Check, LogOut, User, CreditCard, Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { BusinessCardSetup } from "@/components/business-card-setup";
import { MainNavigation } from "@/components/main-navigation";
import ContactForm from "@/components/ContactForm";
import SubscriptionStatus from "@/components/SubscriptionStatusNew";

export default function SettingsPageWrapper() {
  const { language, setLanguage, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const { logoutMutation, user } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Determine active tab based on current location
  const getInitialTab = () => {
    if (location.includes('/settings/contact')) return "contact";
    if (location.includes('/settings/business-card')) return "business-card";
    if (location.includes('/settings/subscription')) return "subscription";
    if (location === '/settings') return "subscription"; // Default tab
    return "subscription";
  };
  
  const [activeTab, setActiveTab] = useState<string>(getInitialTab());
  
  // Update URL when tab changes
  useEffect(() => {
    if (activeTab === "subscription" && location !== "/settings" && location !== "/settings/subscription") {
      setLocation("/settings/subscription");
    } else if (activeTab === "business-card" && location !== "/settings/business-card") {
      setLocation("/settings/business-card");
    } else if (activeTab === "contact" && location !== "/settings/contact") {
      setLocation("/settings/contact");
    } else if (activeTab === "language" && location !== "/settings") {
      setLocation("/settings");
    }
  }, [activeTab, location, setLocation]);

  // Save language settings
  const handleSaveLanguage = () => {
    setLanguage(selectedLanguage);
    toast({
      title: t("settings_saved"),
      description: t("language_changed_successfully"),
    });
  };

  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Handle business card update
  const handleBusinessCardUpdate = () => {
    toast({
      title: t("settings_saved"),
      description: t("business_card_updated_successfully"),
    });
  };

  return (
    <>
      <MainNavigation />
      <div className="container mx-auto py-6 px-4">
        

        <Card className="max-w-4xl mx-auto mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              {t("settings")}
            </CardTitle>
            <CardDescription>
              {t("settings_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 mb-6 w-full">
                <TabsTrigger value="subscription" className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {t("subscription.title")}
                </TabsTrigger>
                <TabsTrigger value="business-card" className="flex items-center">
                  <CreditCard className="w-4 h-4 mr-2" />
                  {t("business_card")}
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  {t("contact.form.title")}
                </TabsTrigger>
                <TabsTrigger value="account" className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  {t("account")}
                </TabsTrigger>
                <TabsTrigger value="language" className="flex items-center hidden">
                  <User className="w-4 h-4 mr-2 hidden" />
                  {t("language")}
                </TabsTrigger>
                
              </TabsList>
              
              <TabsContent value="language" className="space-y-6 hidden">
                <div>
                  <h3 className="text-lg font-medium mb-3 hidden">{t("language")}</h3>
                  
                  <RadioGroup 
                    value={selectedLanguage} 
                    onValueChange={(val) => setSelectedLanguage(val as Language)} 
                    className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                  >
                    <div>
                      <RadioGroupItem 
                        value="en" 
                        id="language-en" 
                        className="peer sr-only" 
                      />
                      <Label 
                        htmlFor="language-en" 
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <div className="mb-2 text-center font-medium">English</div>
                        {selectedLanguage === "en" && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </Label>
                    </div>

                    <div>
                      <RadioGroupItem 
                        value="ru" 
                        id="language-ru" 
                        className="peer sr-only" 
                      />
                      <Label 
                        htmlFor="language-ru" 
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <div className="mb-2 text-center font-medium">Русский</div>
                        {selectedLanguage === "ru" && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </Label>
                    </div>
                    
                    <div>
                      <RadioGroupItem 
                        value="de" 
                        id="language-de" 
                        className="peer sr-only" 
                      />
                      <Label 
                        htmlFor="language-de" 
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <div className="mb-2 text-center font-medium">Deutsch</div>
                        {selectedLanguage === "de" && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex justify-end space-x-2">
                  <Link href="/">
                    <Button variant="outline">{t("cancel")}</Button>
                  </Link>
                  <Button onClick={handleSaveLanguage}>{t("save")}</Button>
                </div>
              </TabsContent>
              
              <TabsContent value="business-card">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-3">{t("business_card")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("business_card_description")}
                  </p>
                  
                  <BusinessCardSetup 
                    onComplete={handleBusinessCardUpdate} 
                    initialBusinessCard={user?.businessCard || ""} 
                    initialLogoUrl={user?.logoUrl || ""}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="subscription">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-3">{t("subscription.title")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("subscription.management")}
                  </p>
                  
                  <SubscriptionStatus />
                </div>
              </TabsContent>
              
              <TabsContent value="contact">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium mb-3">{t("contact.form.title")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("contact.form.description")}
                  </p>
                  
                  <ContactForm />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Account card */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center">
              <LogOut className="h-5 w-5 mr-2" />
              {t("account")}
            </CardTitle>
            <CardDescription>
              {user ? t("logged_in_as") + ": " + user.username : t("not_logged_in")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("logout_description")}
            </p>
            <Button 
              variant="destructive" 
              onClick={handleLogout} 
              disabled={false}
              className="w-full md:w-auto"
            >
              {t("logout")}
              <LogOut className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}