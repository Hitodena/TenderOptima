import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { useLocation } from "wouter";
import type { Supplier, SearchRequest } from "@shared/schema";

interface SendRequestButtonProps {
  selectedSuppliers: Supplier[];
  searchRequest: SearchRequest;
}

export function SendRequestButton({ selectedSuppliers, searchRequest }: SendRequestButtonProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    // Store selected suppliers in localStorage to pass to the send request page
    localStorage.setItem('sendRequestSuppliers', JSON.stringify(selectedSuppliers));
    if (searchRequest.id) {
      localStorage.setItem('sendRequestId', searchRequest.id.toString());
    }
    
    // Add a flag to indicate we want to show the supplier selection view, not the email form
    localStorage.setItem('showSupplierSelectionView', 'true');
    
    // Navigate to send request page
    setLocation('/send-request');
  };

  if (selectedSuppliers.length === 0) {
    return null;
  }

  return (
    <Button
      className="inline-flex items-center gap-1"
      onClick={handleClick}
    >
      <Mail className="h-4 w-4" />
      Создать рассылку
    </Button>
  );
}