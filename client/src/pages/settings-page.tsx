import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Settings as SettingsIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/language-context";
import { Language } from "@/utils/translations";

export default function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);

  // Функция для сохранения выбранного языка
  const handleSaveLanguage = () => {
    setLanguage(selectedLanguage);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Link href="/">
          <Button variant="ghost" className="mr-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("back_to_groups")}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{t("settings")}</h1>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SettingsIcon className="h-5 w-5 mr-2" />
            {t("settings")}
          </CardTitle>
          <CardDescription>
            {t("language")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-3">{t("language")}</h3>
              
              <RadioGroup value={selectedLanguage} onValueChange={(val) => setSelectedLanguage(val as Language)} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}