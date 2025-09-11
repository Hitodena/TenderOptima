import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from "@/components/ui/dialog";
import { 
  Mail, 
  Phone, 
  Globe, 
  Info, 
  Check 
} from "lucide-react";
import type { Supplier } from "@shared/schema";
import { useLanguage } from "@/contexts/language-context";

interface SupplierCompactCardProps {
  supplier: Supplier;
  isSelected: boolean;
  onSelect: (checked: boolean, supplierId: number | string) => void;
}

export function SupplierCompactCard({ supplier, isSelected, onSelect }: SupplierCompactCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string>(supplier.email);
  const { t } = useLanguage();
  
  // Если у поставщика несколько email-адресов, разделим их и создадим массив
  const emails = typeof supplier.email === 'string' 
    ? supplier.email.split(/[,;]/).map(e => e.trim()).filter(Boolean)
    : [supplier.email].filter(Boolean);

  return (
    <div className="flex items-center p-3 border rounded-md bg-card hover:bg-accent/10 transition-colors">
      <Checkbox
        id={`supplier-${supplier.id}`}
        checked={isSelected}
        onCheckedChange={(checked) => {
          onSelect(!!checked, supplier.id);
        }}
        className="h-4 w-4 flex-shrink-0"
      />
      
      <Label 
        htmlFor={`supplier-${supplier.id}`} 
        className="ml-2 text-sm font-medium cursor-pointer truncate flex-shrink-0 w-48"
      >
        {supplier.name}
      </Label>
      
      <div className="flex-1 flex items-center px-2 min-w-0">
        <Mail className="h-3.5 w-3.5 mr-1 flex-shrink-0 text-muted-foreground" />
        <span className="truncate text-sm text-muted-foreground">{selectedEmail}</span>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="flex-shrink-0 h-7 w-7 rounded-full p-0" 
        onClick={() => setDialogOpen(true)}
      >
        <Info className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{supplier.name}</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            {supplier.description && (
              <div>
                <h4 className="text-sm font-medium mb-1">{t("description")}:</h4>
                <p className="text-sm text-muted-foreground">{supplier.description}</p>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium mb-1">{t("contact_info")}:</h4>
              
              {emails.length > 0 && (
                <div className="space-y-2 mt-2">
                  <h5 className="text-xs font-medium">{t("email")}:</h5>
                  {emails.map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Checkbox 
                        id={`email-${supplier.id}-${index}`}
                        checked={selectedEmail === email}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedEmail(email);
                        }}
                      />
                      <Label 
                        htmlFor={`email-${supplier.id}-${index}`}
                        className="flex items-center text-sm cursor-pointer"
                      >
                        <Mail className="h-3.5 w-3.5 mr-2" />
                        <a href={`mailto:${email}`} className="text-primary hover:underline">
                          {email}
                        </a>
                        {selectedEmail === email && (
                          <span className="ml-2 text-xs text-green-600 flex items-center">
                            <Check className="h-3 w-3 mr-1" />
                            {t("selected")}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
              
              {supplier.phone && (
                <div className="flex items-center gap-2 mt-3">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">{supplier.phone}</span>
                </div>
              )}
              
              {supplier.website && (
                <div className="flex items-center gap-2 mt-3">
                  <Globe className="h-4 w-4" />
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {supplier.website}
                  </a>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <DialogClose asChild>
              <Button variant="outline">{t("close")}</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}