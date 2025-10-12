import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircleIcon, XCircleIcon, MessageSquareIcon } from "lucide-react";

interface ResponseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: number;
  supplierName: string;
}

interface SupplierResponse {
  id: number;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  responseDate: string;
  subject: string;
  content: string;
  verificationStatus: "verified" | "unverified" | "pending";
  verificationNotes?: string;
  attachments: any[];
}

interface VerificationRequest {
  status: "verified" | "unverified";
  notes?: string;
}

export default function ResponseHistoryModal({ 
  isOpen, 
  onClose, 
  supplierId, 
  supplierName 
}: ResponseHistoryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  // Загрузка истории ответов
  const { data: responses, isLoading, error } = useQuery<SupplierResponse[]>({
    queryKey: ["supplier-responses", supplierId],
    queryFn: async () => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch(`/api/admin/suppliers/${supplierId}/responses`, {
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Ошибка загрузки ответов: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    enabled: isOpen && !!supplierId,
    staleTime: 30000
  });

  // Мутация для верификации ответа
  const verifyMutation = useMutation({
    mutationFn: async ({ responseId, status, notes }: { responseId: number; status: "verified" | "unverified"; notes?: string }) => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch(`/api/admin/supplier-responses/${responseId}/verify`, {
        method: 'PUT',
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, notes }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Ошибка верификации: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Ответ верифицирован",
        description: `Статус изменен на "${data.data.newStatus}"`,
      });
      
      // Инвалидируем кеш для обновления данных
      queryClient.invalidateQueries({ queryKey: ["supplier-responses", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["supplier-stats", supplierId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка верификации",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleVerify = async (responseId: number, status: "verified" | "unverified") => {
    setProcessingIds(prev => new Set(prev).add(responseId));
    try {
      await verifyMutation.mutateAsync({ responseId, status });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(responseId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800">Верифицирован</Badge>;
      case "unverified":
        return <Badge className="bg-red-100 text-red-800">Не верифицирован</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Ожидает</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareIcon className="h-5 w-5" />
            История ответов: {supplierName}
          </DialogTitle>
          <DialogDescription>
            Просмотр и верификация ответов поставщика
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <Spinner size="lg" />
                <span className="text-muted-foreground">Загрузка истории ответов...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">Ошибка загрузки: {(error as Error).message}</p>
            </div>
          ) : responses && responses.length > 0 ? (
            <div className="space-y-4">
              {responses.map((response) => {
                const isProcessing = processingIds.has(response.id);
                
                return (
                  <div key={response.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{response.subject}</h4>
                          {getStatusBadge(response.verificationStatus)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {formatDate(response.responseDate)} • {response.supplierEmail}
                        </p>
                        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                          {response.content}
                        </div>
                        {response.verificationNotes && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                            <strong>Заметки модератора:</strong> {response.verificationNotes}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {response.verificationStatus === "pending" && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleVerify(response.id, "verified")}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? (
                            <Spinner size="sm" />
                          ) : (
                            <CheckCircleIcon className="h-4 w-4" />
                          )}
                          Считать релевантным
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleVerify(response.id, "unverified")}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Spinner size="sm" />
                          ) : (
                            <XCircleIcon className="h-4 w-4" />
                          )}
                          Считать нерелевантным
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Нет ответов от этого поставщика</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
