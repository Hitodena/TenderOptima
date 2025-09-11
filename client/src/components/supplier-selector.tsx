import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search, User, Mail, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { Spinner } from "@/components/ui/spinner";

interface Supplier {
  id: number | string;
  name: string;
  email: string;
  organization?: string;
}

interface SupplierSelectorProps {
  onSelect: (suppliers: Supplier[]) => void;
  buttonText?: string;
  multi?: boolean;
}

export function SupplierSelector({ onSelect, buttonText = "Выбрать поставщиков", multi = true }: SupplierSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch suppliers from backend
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['/api/suppliers', searchQuery],
    queryFn: async () => {
      // Use URLSearchParams for GET requests
      const url = searchQuery ? 
        `/api/suppliers?search=${encodeURIComponent(searchQuery)}` : 
        '/api/suppliers';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }
      return response.json();
    },
    staleTime: 60000,
  });

  const handleSelectSupplier = (supplier: Supplier) => {
    if (multi) {
      // If multi-select, toggle the supplier
      setSelectedSuppliers(prev => {
        const exists = prev.some(s => s.id === supplier.id);
        if (exists) {
          return prev.filter(s => s.id !== supplier.id);
        } else {
          return [...prev, supplier];
        }
      });
    } else {
      // If single-select, replace the selection
      setSelectedSuppliers([supplier]);
      setOpen(false);
    }
  };

  const confirmSelection = () => {
    onSelect(selectedSuppliers);
    setOpen(false);

    // Only clear selection if in single-select mode
    if (!multi) {
      setSelectedSuppliers([]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between w-full md:w-auto"
        >
          {selectedSuppliers.length > 0 
            ? `${buttonText} (${selectedSuppliers.length} выбрано)` 
            : buttonText}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder="Поиск поставщика..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="h-9 border-0 outline-none focus-visible:ring-0"
            />
          </div>

          {isLoading ? (
            <div className="py-6 text-center">
              <Spinner className="mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Загрузка поставщиков...</p>
            </div>
          ) : (
            <>
              <CommandEmpty>
                {searchQuery
                  ? "Поставщики не найдены"
                  : "Введите название или адрес эл. почты для поиска"}
              </CommandEmpty>

              <CommandGroup>
                <ScrollArea className="h-[25vh]"> {/* This line was changed */}
                  {suppliers && suppliers.map((supplier: Supplier) => (
                    <CommandItem
                      key={supplier.id}
                      onSelect={() => handleSelectSupplier(supplier)}
                      className="flex items-center"
                    >
                      {multi && (
                        <Checkbox
                          checked={selectedSuppliers.some(s => s.id === supplier.id)}
                          className="mr-2 h-4 w-4"
                          onCheckedChange={() => handleSelectSupplier(supplier)}
                        />
                      )}

                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center">
                          <User className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="font-medium truncate">{supplier.name}</span>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                          <Mail className="mr-1 h-3 w-3" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                        {supplier.organization && (
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <Building className="mr-1 h-3 w-3" />
                            <span className="truncate">{supplier.organization}</span>
                          </div>
                        )}
                      </div>

                      {selectedSuppliers.some(s => s.id === supplier.id) && !multi && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </>
          )}

          {multi && (
            <div className="flex items-center justify-between border-t p-2">
              <div className="text-sm text-muted-foreground">
                Выбрано: {selectedSuppliers.length}
              </div>
              <Button size="sm" disabled={selectedSuppliers.length === 0} onClick={confirmSelection}>
                Добавить
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}