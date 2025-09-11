import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, UserPlus, Users, ChevronDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Supplier } from "@shared/schema";
import { getContactGroups, createContactGroup, addContactsToGroup, type ContactGroup, type ContactItem } from "@/api/contact-groups";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Validation schema for custom supplier
const customSupplierSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Must be a valid email address"),
  description: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
});

type CustomSupplierFormValues = z.infer<typeof customSupplierSchema>;

interface Props {
  onSupplierAdded: (supplier: Supplier) => void;
}

export function CustomSupplierInput({ onSupplierAdded }: Props) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Состояние для работы с группами контактов
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ContactGroup | null>(null);
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupError, setNewGroupError] = useState("");
  const [isGroupSelectorOpen, setIsGroupSelectorOpen] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  
  const form = useForm<CustomSupplierFormValues>({
    resolver: zodResolver(customSupplierSchema),
    defaultValues: {
      name: "",
      email: "",
      description: "",
      website: "",
      phone: "",
    },
  });

  // Загрузка групп контактов при открытии диалога
  useEffect(() => {
    if (isDialogOpen) {
      loadContactGroups();
    }
  }, [isDialogOpen]);

  // Очистка ошибки при вводе названия новой группы
  useEffect(() => {
    if (newGroupName) {
      setNewGroupError("");
    }
  }, [newGroupName]);

  const loadContactGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const groups = await getContactGroups();
      setContactGroups(groups);
    } catch (error) {
      console.error('Ошибка при загрузке групп контактов:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить группы контактов",
        variant: "destructive"
      });
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      setNewGroupError("Заполните данное поле");
      return;
    }
    
    setIsCreatingGroup(true);
    try {
      const newGroup = await createContactGroup({
        name: newGroupName.trim(),
        description: ""
      });
      
      // Обновляем список групп и автоматически выбираем новую группу
      setContactGroups(prev => [newGroup, ...prev]);
      setSelectedGroup(newGroup);
      setIsCreatingNewGroup(false);
      setNewGroupName("");
      setNewGroupError("");
      
      toast({
        title: "Группа создана",
        description: `Группа "${newGroup.name}" создана и выбрана. Теперь добавьте поставщика.`,
      });
      // НЕ закрываем диалог! Оставляем открытым для завершения создания поставщика
    } catch (error) {
      console.error("Ошибка при создании группы:", error);
      setNewGroupError("Не удалось создать группу");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const onSubmit = async (values: CustomSupplierFormValues) => {
    const newSupplier: Supplier = {
      id: -Math.floor(Math.random() * 10000) - 1, // Generate a unique negative ID
      userId: null, // Add required userId field
      name: values.name,
      email: values.email,
      description: values.description || '', // Empty string if undefined
      website: values.website || '', // Empty string if undefined
      phone: values.phone || '', // Empty string if undefined
      categories: [],
      responseRate: null,
      totalRequests: null,
      successfulMatches: null,
      keywordStrength: null,
      lastResponseTime: null,
    };

    // Добавляем поставщика в список
    onSupplierAdded(newSupplier);
    
    // Если выбрана группа контактов, добавляем туда поставщика
    if (selectedGroup) {
      setIsAddingContact(true);
      try {
        const contactToAdd: Partial<ContactItem> = {
          name: values.name,
          email: values.email,
          phone: values.phone || "",
          organization: values.website || ""
        };
        
        await addContactsToGroup(selectedGroup.id, [contactToAdd]);
        
        toast({
          title: "Поставщик добавлен",
          description: `${values.name} добавлен в список поставщиков и в группу "${selectedGroup.name}"`,
        });
      } catch (error) {
        console.error("Ошибка при добавлении в группу:", error);
        toast({
          title: "Поставщик добавлен",
          description: `${values.name} добавлен в список, но не удалось добавить в группу контактов`,
          variant: "destructive"
        });
      } finally {
        setIsAddingContact(false);
      }
    } else {
      toast({
        title: "Поставщик добавлен",
        description: `${values.name} добавлен в список поставщиков`,
      });
    }
    
    // Сбрасываем форму и закрываем диалог
    setIsDialogOpen(false);
    form.reset();
    setSelectedGroup(null);
    setIsCreatingNewGroup(false);
    setNewGroupName("");
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Добавить поставщика
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить поставщика</DialogTitle>
          <DialogDescription>
            Введите информацию о поставщике для отправки запроса.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название компании*</FormLabel>
                  <FormControl>
                    <Input placeholder="ООО 'Компания'" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Электронная почта*</FormLabel>
                  <FormControl>
                    <Input placeholder="contact@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Телефон</FormLabel>
                  <FormControl>
                    <Input placeholder="+7 (XXX) XXX-XX-XX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Веб-сайт</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Краткое описание компании..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Добавление в группу контактов */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel className="text-sm font-medium">Добавить в базу контактов</FormLabel>
                <span className="text-xs text-muted-foreground">(необязательно)</span>
              </div>
              
              {/* Выбор существующей группы */}
              <Popover open={isGroupSelectorOpen} onOpenChange={setIsGroupSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isGroupSelectorOpen}
                    className="w-full justify-between"
                    disabled={isLoadingGroups}
                  >
                    {selectedGroup ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{selectedGroup.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({selectedGroup.contactCount || 0} контактов)
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Выберите группу контактов</span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Найти группу..." />
                    <CommandList>
                      <CommandEmpty>Группы не найдены</CommandEmpty>
                      <CommandGroup>
                        {/* Опция создания новой группы */}
                        <CommandItem
                          onSelect={() => {
                            setIsCreatingNewGroup(true);
                            setIsGroupSelectorOpen(false);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Создать новую группу
                        </CommandItem>
                        
                        {/* Опция очистки выбора */}
                        {selectedGroup && (
                          <CommandItem
                            onSelect={() => {
                              setSelectedGroup(null);
                              setIsGroupSelectorOpen(false);
                            }}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Не добавлять в группу
                          </CommandItem>
                        )}
                        
                        {/* Список существующих групп */}
                        {contactGroups.map((group) => (
                          <CommandItem
                            key={group.id}
                            onSelect={() => {
                              setSelectedGroup(group);
                              setIsGroupSelectorOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedGroup?.id === group.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <Users className="h-4 w-4" />
                              <span>{group.name}</span>
                              <span className="text-muted-foreground text-xs">
                                ({group.contactCount || 0} контактов)
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Inline создание новой группы */}
              {isCreatingNewGroup && (
                <div className="p-3 border rounded-md space-y-3 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Создать новую группу</span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Название группы"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className={newGroupError ? "border-destructive" : ""}
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateNewGroup}
                      disabled={!newGroupName.trim() || isCreatingGroup}
                    >
                      {isCreatingGroup ? "Создание..." : "Создать"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsCreatingNewGroup(false);
                        setNewGroupName("");
                        setNewGroupError("");
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                  {newGroupError && (
                    <p className="text-destructive text-sm">{newGroupError}</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                disabled={isAddingContact}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isAddingContact}>
                {isAddingContact ? "Добавление..." : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}