import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Phone, Building, User, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ContactItem {
  id: number;
  groupId: number;
  email: string;
  name: string;
  phone?: string;
  organization?: string | null;
  position?: string | null;
  createdAt?: string;
}

interface ContactsListRowProps {
  contacts: ContactItem[];
  selectedContactIds: number[];
  onContactSelectionChange: (contactId: number, isSelected: boolean) => void;
  selectAll?: boolean;
  onSelectAllChange?: (selectAll: boolean) => void;
}

export function ContactsListRow({
  contacts,
  selectedContactIds,
  onContactSelectionChange,
  selectAll,
  onSelectAllChange
}: ContactsListRowProps) {
  
  if (!contacts || contacts.length === 0) {
    return (
      <div className="text-center p-8 border rounded-md bg-muted/20">
        <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">В этой группе нет контактов</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 border rounded-md">
      {/* Заголовок для таблицы контактов */}
      {selectAll !== undefined && onSelectAllChange && (
        <div className="flex items-center p-3 bg-muted/30 border-b">
          <Checkbox 
            id="select-all-contacts" 
            checked={selectAll} 
            onCheckedChange={(checked) => onSelectAllChange(!!checked)}
            className="mr-3"
          />
          <label 
            htmlFor="select-all-contacts" 
            className="text-sm font-medium leading-none cursor-pointer select-none"
          >
            Выбрать все контакты
          </label>
          <Badge variant="outline" className="ml-auto">
            {selectedContactIds.length} из {contacts.length} выбрано
          </Badge>
        </div>
      )}
      
      {/* Строки контактов */}
      {contacts.map((contact, index) => (
        <div 
          key={contact.id} 
          className={`flex items-center p-3 gap-2 hover:bg-muted/10 transition-colors ${
            index < contacts.length - 1 ? 'border-b' : ''
          }`}
        >
          <Checkbox
            id={`contact-${contact.id}`}
            checked={selectedContactIds.includes(contact.id)}
            onCheckedChange={(checked) => onContactSelectionChange(contact.id, !!checked)}
            className="mr-1"
          />
          
          <div className="flex-grow min-w-0 grid grid-cols-4 gap-2 items-center">
            {/* Имя контакта */}
            <div className="flex items-center col-span-1 overflow-hidden">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-2" />
              <span className="font-medium truncate">
                {contact.name || "Без имени"}
              </span>
            </div>
            
            {/* Email */}
            <div className="flex items-center col-span-1 overflow-hidden">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-2" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-primary hover:underline truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contact.email}
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    {contact.email}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Организация */}
            <div className="flex items-center col-span-1 overflow-hidden">
              {contact.organization ? (
                <>
                  <Building className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-2" />
                  <span className="text-muted-foreground truncate" title={contact.organization}>
                    {contact.organization}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground/50 italic truncate">
                  Нет организации
                </span>
              )}
            </div>
            
            {/* Телефон или должность */}
            <div className="flex items-center col-span-1 overflow-hidden">
              {contact.phone ? (
                <>
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-2" />
                  <span className="text-muted-foreground truncate">
                    {contact.phone}
                  </span>
                </>
              ) : contact.position ? (
                <>
                  <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-2" />
                  <span className="text-muted-foreground truncate">
                    {contact.position}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground/50 italic truncate">
                  Нет дополнительной информации
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}