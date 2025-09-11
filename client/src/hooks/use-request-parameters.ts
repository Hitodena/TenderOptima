import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Hook для кэширования параметров запроса
 * Предотвращает множественные запросы к /api/parameters/{requestId}
 */
export function useRequestParameters(requestId: number | null, enabled = false) {
  return useQuery({
    queryKey: ['request-parameters', requestId],
    queryFn: async () => {
      if (!requestId) {
        return { parameters: [] };
      }
      
      console.log(`[Cache] Loading request parameters for request ${requestId}`);
      const response = await apiRequest<{parameters: string[]}>(`/api/parameters/${requestId}`, 'GET');
      return response || { parameters: [] };
    },
    enabled: enabled && !!requestId, // Загружать только по требованию
    staleTime: 5 * 60 * 1000, // 5 минут кэширования
    gcTime: 10 * 60 * 1000, // 10 минут в памяти
    retry: 2,
  });
}
