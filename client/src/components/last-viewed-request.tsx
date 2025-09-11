import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import type { SearchRequest } from '@shared/schema';

interface LastViewedRequestProps {
  className?: string;
}

export function LastViewedRequest({ className }: LastViewedRequestProps) {
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

  if (isLoading || lastViewedRequests.length === 0) {
    return null;
  }

  return (
    <div className={`mb-6 ${className}`}>
      <h3 className="text-sm text-muted-foreground mb-3">Последние запросы</h3>
      <div className="space-y-2">
        {lastViewedRequests.map((request) => (
          <button
            key={request.id}
            onClick={() => handleRequestClick(request.id)}
            className="w-full text-left px-4 py-3 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors text-sm border border-gray-200 hover:border-gray-300"
          >
            <div className="font-medium text-gray-900 truncate">
              {request.productName || 'Запрос без названия'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}