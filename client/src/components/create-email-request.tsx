import { ReactNode } from "react";
import { Link } from "wouter";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateEmailRequestProps {
  groupId: number;
  groupName: string;
  triggerButton?: ReactNode;
}

export function CreateEmailRequest({ 
  groupId, 
  groupName, 
  triggerButton 
}: CreateEmailRequestProps) {
  const path = `/contact-groups/${groupId}/create-email`;
  
  if (triggerButton) {
    return (
      <Link href={path}>
        <div>{triggerButton}</div>
      </Link>
    );
  }
  
  return (
    <Link href={path}>
      <Button variant="outline" size="sm" className="flex items-center">
        <Mail className="h-4 w-4 mr-2" />
        Создать e-mail запрос
      </Button>
    </Link>
  );
}