import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { ChevronRight } from 'lucide-react';
import type { SearchRequest } from '@shared/schema';

interface RecentQueriesSidebarProps {
  className?: string;
}

export function RecentQueriesSidebar({ className }: RecentQueriesSidebarProps) {
  const [lastViewedRequests, setLastViewedRequests] = useState<SearchRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();

  const handleRequestClick = (requestId: number) => {
    navigate(`/requests/${requestId}`);
  };

  useEffect(() => {
    const loadLastViewedRequests = async () => {
      try {
        // Get last viewed request IDs from localStorage
        let lastViewedIds = JSON.parse(localStorage.getItem('lastViewedRequestIds') || '[]');
        
        // ВРЕМЕННО: Если нет данных, добавляем тестовые ID
        if (lastViewedIds.length === 0) {
          lastViewedIds = [567, 649];
          localStorage.setItem('lastViewedRequestIds', JSON.stringify(lastViewedIds));
        }
        
        if (lastViewedIds.length === 0) {
          setIsLoading(false);
          return;
        }

        // Get first 3 IDs and fetch their details
        const idsToFetch = lastViewedIds.slice(0, 3);
        const requests: SearchRequest[] = [];

        for (const id of idsToFetch) {
          try {
            const response: any = await apiRequest(`/api/search-requests/${id}`);
            if (response.request) {
              requests.push(response.request);
            }
          } catch (error) {
            console.error(`Failed to load request ${id}:`, error);
          }
        }

        setLastViewedRequests(requests);
      } catch (error) {
        console.error('Error loading requests:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLastViewedRequests();
  }, []);

  if (isLoading) return null;

  if (lastViewedRequests.length === 0) {
    return null;
  }

  return (
    <div className={`w-[300px] ${className}`}>
      <h3 className="text-sm text-muted-foreground mb-3">Последние запросы</h3>
      <div className="space-y-2">
        {lastViewedRequests.slice(0, 3).map((request) => (
          <button
            key={request.id}
            onClick={() => handleRequestClick(request.id)}
            className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:text-gray-900 transition-colors flex items-center justify-between rounded-full bg-white border border-gray-200 hover:bg-gray-50"
          >
            <div className="truncate">
              {request.productName || 'Запрос без названия'}
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
          </button>
        ))}
      </div>
    </div>
  );
}
