import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Globe, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  FileText, 
  Calendar
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface SupplierDetails {
  id: number;
  name: string;
  description: string;
  website: string;
  email: string;
  phone: string;
  region?: string;
  categories?: string[];
  legalName?: string;
  taxId?: string;
  legalAddress?: string;
  bankDetails?: string;
  contactPerson?: string;
  responseRate?: number;
  totalRequests?: number;
  successfulMatches?: number;
  verifiedResponses?: number;
  unverifiedResponses?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface SupplierDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestSupplierId: number;
  supplierEmail?: string;
  supplierName?: string;
}

export function SupplierDetailsModal({ 
  isOpen, 
  onClose, 
  requestSupplierId,
  supplierEmail, 
  supplierName 
}: SupplierDetailsModalProps) {
  const { data: requestSupplier, isLoading, error } = useQuery({
    queryKey: ['request-supplier-details', requestSupplierId],
    queryFn: async (): Promise<any | null> => {
      if (!requestSupplierId) return null;
      
      try {
        // Получаем данные поставщика из request_suppliers
        const response = await apiRequest('GET', `/api/request-suppliers/${requestSupplierId}/details`);
        return response;
      } catch (error) {
        console.error('Error fetching request supplier details:', error);
        return null;
      }
    },
    enabled: isOpen && !!requestSupplierId
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Не указано';
    try {
      return format(new Date(dateString), 'dd.MM.yyyy');
    } catch {
      return 'Не указано';
    }
  };

  const formatResponseRate = (rate?: number) => {
    if (!rate) return 'Не указано';
    return `${(rate * 100).toFixed(1)}%`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Информация о поставщике</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Загрузка информации...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8">
            <div className="text-destructive">Ошибка загрузки данных</div>
          </div>
        )}

        {!isLoading && !error && !requestSupplier && (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">
              Информация о поставщике не найдена
            </div>
          </div>
        )}

        {requestSupplier && (
          <div className="space-y-6">
            {/* Основная информация */}
            <div className="space-y-4">
              {/* Контактная информация */}
              <div className="space-y-3">
                
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{requestSupplier.supplierEmail}</span>
                </div>

                {requestSupplier.supplierPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{requestSupplier.supplierPhone}</span>
                  </div>
                )}

                {requestSupplier.supplierWebsite && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={requestSupplier.supplierWebsite.startsWith('http') ? requestSupplier.supplierWebsite : `https://${requestSupplier.supplierWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {requestSupplier.supplierWebsite}
                    </a>
                  </div>
                )}
              </div>

              {/* Информация о запросе */}
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold text-lg">Информация о запросе</h4>
                
                <div>
                  <span className="text-sm text-muted-foreground">Тема письма:</span>
                  <span className="ml-2 text-sm">{requestSupplier.emailSubject}</span>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Отправлено:</span>
                  <span className="ml-2 text-sm">{formatDate(requestSupplier.sentAt)}</span>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Статус ответа:</span>
                  <span className="ml-2 text-sm">
                    {requestSupplier.hasResponded ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Получен ответ
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700">
                        Ожидается ответ
                      </Badge>
                    )}
                  </span>
                </div>

              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
