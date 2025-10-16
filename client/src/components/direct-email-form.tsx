import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CustomSupplierInput } from "./custom-supplier-input";
import { UploadSuppliersExcel } from "./upload-suppliers-excel";
import { EmailForm } from "./email-form";
import { SearchRequest, Supplier } from "@shared/schema";
import { X, Mail } from "lucide-react";

interface Props {
  searchRequest: SearchRequest;
}

export function DirectEmailForm({ searchRequest }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleAddSupplier = (supplier: Supplier) => {
    setSuppliers(prev => [...prev, supplier]);
  };

  const handleBulkUpload = (newSuppliers: Supplier[]) => {
    setSuppliers(prev => [...prev, ...newSuppliers]);
  };

  const handleRemoveSupplier = (id: number | string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setSelectedSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const handleSelectSupplier = (supplier: Supplier, checked: boolean) => {
    if (checked) {
      setSelectedSuppliers(prev => [...prev, supplier]);
    } else {
      setSelectedSuppliers(prev => prev.filter(s => s.id !== supplier.id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSuppliers([...suppliers]);
    } else {
      setSelectedSuppliers([]);
    }
  };

  return (
    <div className="space-y-6">
      {!showEmailForm ? (
        <>
          <div className="flex flex-wrap gap-4">
            <CustomSupplierInput onSupplierAdded={handleAddSupplier} />
            <div className="hidden">
              <UploadSuppliersExcel onSuppliersUploaded={handleBulkUpload} />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Выбранные поставщики</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="select-all" 
                      checked={suppliers.length > 0 && selectedSuppliers.length === suppliers.length}
                      onCheckedChange={handleSelectAll}
                      disabled={suppliers.length === 0}
                    />
                    <label 
                      htmlFor="select-all" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Выбрать все
                    </label>
                  </div>
                  <Button
                    variant="default"
                    className="flex items-center gap-2"
                    disabled={selectedSuppliers.length === 0}
                    onClick={() => setShowEmailForm(true)}
                  >
                    <Mail className="h-4 w-4" />
                    Отправить запрос ({selectedSuppliers.length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {suppliers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Нет выбранных поставщиков. Добавьте поставщиков для отправки запроса.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] rounded-md">
                  <div className="space-y-4">
                    {suppliers.map((supplier) => (
                      <div 
                        key={supplier.id} 
                        className="flex items-start justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            id={`supplier-${supplier.id}`}
                            checked={selectedSuppliers.some(s => s.id === supplier.id)}
                            onCheckedChange={(checked) => 
                              handleSelectSupplier(supplier, checked as boolean)
                            }
                          />
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            <p className="text-sm text-muted-foreground">{supplier.email}</p>
                            {supplier.phone && (
                              <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                            )}
                            {supplier.website && (
                              <p className="text-sm text-muted-foreground">{supplier.website}</p>
                            )}
                            {supplier.description && (
                              <p className="text-sm mt-1">{supplier.description}</p>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveSupplier(supplier.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
            <Button 
              variant="outline" 
              onClick={() => setShowEmailForm(false)}
              className="flex items-center gap-2 self-start"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Вернуться к выбору поставщиков
            </Button>
            <h3 className="text-lg font-medium">Отправка запроса {selectedSuppliers.length} поставщикам</h3>
          </div>
          <EmailForm suppliers={selectedSuppliers} selectedSuppliers={selectedSuppliers} searchRequest={searchRequest} />
        </div>
      )}
    </div>
  );
}