import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader, Upload } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";

// Form schema
const businessCardSchema = z.object({
  businessCard: z.string().min(1, "Визитная карточка обязательна"),
  logoUrl: z.string().optional(),
});

type BusinessCardFormData = z.infer<typeof businessCardSchema>;

interface BusinessCardSetupProps {
  onComplete?: () => void;
  initialBusinessCard?: string;
  initialLogoUrl?: string;
}

export function BusinessCardSetup({ onComplete, initialBusinessCard = "", initialLogoUrl = "" }: BusinessCardSetupProps) {
  const { t } = useLanguage();
  const { updateBusinessCardMutation, user } = useAuth();
  
  // Ensure mutation is available
  if (!updateBusinessCardMutation) {
    console.error('[BusinessCard] updateBusinessCardMutation is undefined');
    return <div>Loading...</div>;
  }
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(user?.logoUrl || initialLogoUrl || null);

  const form = useForm<BusinessCardFormData>({
    resolver: zodResolver(businessCardSchema),
    defaultValues: {
      businessCard: user?.businessCard || initialBusinessCard,
      logoUrl: user?.logoUrl || initialLogoUrl,
    },
  });

  // Обновляем форму при изменении начальных значений (например, при загрузке данных пользователя)
  useEffect(() => {
    console.log('[BusinessCard] Initial values changed:', {
      initialBusinessCard,
      initialLogoUrl,
      userBusinessCard: user?.businessCard,
      userLogoUrl: user?.logoUrl
    });
    
    // Use user data if available, otherwise use initial props
    const businessCard = user?.businessCard || initialBusinessCard;
    const logoUrl = user?.logoUrl || initialLogoUrl;
    
    if (businessCard) {
      form.setValue("businessCard", businessCard);
    }
    if (logoUrl) {
      form.setValue("logoUrl", logoUrl);
      setLogoPreview(logoUrl);
    }
  }, [initialBusinessCard, initialLogoUrl, user?.businessCard, user?.logoUrl, form]);

  // Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoPreview(event.target.result as string);
          
          // Set the base64 encoded image to the form
          form.setValue("logoUrl", event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const onSubmit = (data: BusinessCardFormData) => {
    console.log('[BusinessCard] Form submitted with data:', {
      businessCardLength: data.businessCard?.length || 0,
      hasLogoUrl: !!data.logoUrl,
      logoUrlPreview: data.logoUrl?.substring(0, 50) + '...' || 'none',
      rawData: data,
      allFormValues: form.getValues()
    });
    
    console.log('[BusinessCard] Calling mutation with data:', JSON.stringify(data, null, 2));
    
    if (updateBusinessCardMutation?.mutate) {
      updateBusinessCardMutation.mutate(data, {
        onSuccess: () => {
          console.log('[BusinessCard] Update successful');
          if (onComplete) {
            onComplete();
          }
        },
      });
    } else {
      console.error('[BusinessCard] updateBusinessCardMutation.mutate is not available');
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t("business_card_setup")}</CardTitle>
        <CardDescription>
          {t("business_card_setup_description")}
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {/* Logo upload */}
          <div className="space-y-2">
            <Label htmlFor="logo-upload">{t("company_logo")} ({t("optional")})</Label>
            <div className="flex flex-col items-center space-y-4">
              {logoPreview ? (
                <div className="relative w-40 h-40 mb-2">
                  <img 
                    src={logoPreview} 
                    alt={t("logo_preview")} 
                    className="w-full h-full object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                      form.setValue("logoUrl", "");
                    }}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <div className="w-40 h-40 border-2 border-dashed rounded-md flex items-center justify-center bg-muted">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="logo-upload" className="cursor-pointer text-center p-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md">
                  {logoPreview ? t("change_logo") : t("upload_logo")}
                </Label>
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </div>
            </div>
          </div>

          {/* Business card text */}
          <div className="space-y-2">
            <Label htmlFor="business-card">{t("business_card_text")}</Label>
            <Textarea
              id="business-card"
              placeholder={t("enter_business_card_text")}
              className="min-h-[120px]"
              {...form.register("businessCard")}
            />
            {form.formState.errors.businessCard && (
              <p className="text-sm text-destructive">
                {form.formState.errors.businessCard.message}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t("business_card_description_extended")}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={updateBusinessCardMutation?.isPending || false}
          >
            {updateBusinessCardMutation?.isPending ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}