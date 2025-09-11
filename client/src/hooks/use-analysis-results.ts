import { useState, useEffect } from 'react';
import { AnalysisResult } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

/**
 * Custom hook for fetching and managing analysis results
 */
export const useAnalysisResults = (requestId: number) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<AnalysisResult[]>([]);

  const fetchResults = async () => {
    if (!requestId) return [];
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use apiRequest from queryClient to include authentication headers
      const results = await apiRequest(`/api/analysis-results/request/${requestId}`, 'GET');
      setData(results);
      return results;
    } catch (err) {
      console.error('Error fetching analysis results:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch results on initial load
  useEffect(() => {
    fetchResults();
  }, [requestId]);

  return {
    isLoading,
    error,
    data,
    refetch: fetchResults
  };
};

/**
 * Custom hook for saving analysis results
 */
export const useSaveAnalysisResult = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<any>(null);

  const mutate = async (data: any) => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      console.log('Saving analysis result:', data);
      
      // Use apiRequest from queryClient to include authentication headers
      const result = await apiRequest('/api/analysis-results', 'POST', data);
      
      setIsLoading(false);
      return result;
    } catch (err) {
      console.error('Error saving analysis result:', err);
      setIsError(true);
      setError(err);
      setIsLoading(false);
      throw err;
    }
  };

  return {
    mutate,
    isLoading,
    isError,
    error
  };
};

export default useAnalysisResults;