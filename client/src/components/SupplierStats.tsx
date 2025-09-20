import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";

interface SupplierStatsProps {
  supplierId: number;
}

interface SupplierStatsData {
  totalRequests: number;
  totalResponses: number;
  verifiedResponses: number;
  unverifiedResponses: number;
}

export default function SupplierStats({ supplierId }: SupplierStatsProps) {
  const { data: stats, isLoading, error } = useQuery<SupplierStatsData>({
    queryKey: ["supplier-stats", supplierId],
    queryFn: async () => {
      const adminToken = localStorage.getItem('adminToken') || 'admin-token-123456';
      const response = await fetch(`/api/admin/suppliers/${supplierId}/stats`, {
        headers: {
          'X-Admin-Token': adminToken,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Ошибка загрузки статистики: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!supplierId,
    staleTime: 30000 // 30 секунд
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-500">
        Ошибка
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-xs text-muted-foreground">
        —
      </div>
    );
  }

  return (
    <div className="text-sm space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Запросов:</span>
        <span className="font-medium">{stats.totalRequests}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Ответов:</span>
        <span className="font-medium">{stats.totalResponses}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Верифицировано:</span>
        <span className="font-medium text-green-600">{stats.verifiedResponses}</span>
      </div>
    </div>
  );
}
