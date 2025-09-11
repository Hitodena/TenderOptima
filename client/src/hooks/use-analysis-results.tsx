import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "./use-toast";

// Simplified interface for analysis results
interface AnalysisResult {
  id: number;
  requestId: number;
  title: string;
  content: string;
  dateCreated: string;
  userId: number;
}

// Hook to fetch analysis results
export function useAnalysisResults(requestId: number) {
  return useQuery<AnalysisResult[]>({
    queryKey: ['/api/analysis-results/request', requestId],
    queryFn: async () => {
      try {
        // Using apiRequest instead of fetch to include auth token
        const data = await apiRequest<AnalysisResult[]>('GET', `/api/analysis-results/request/${requestId}`);
        return data;
      } catch (error) {
        console.error("Error fetching analysis results:", error);
        return [];
      }
    },
    enabled: !!requestId,
  });
}

// Hook to fetch a specific analysis result
export function useAnalysisResult(id: number) {
  return useQuery<AnalysisResult>({
    queryKey: ['/api/analysis-results', id],
    queryFn: async () => {
      try {
        // Using apiRequest instead of fetch to include auth token
        const data = await apiRequest<AnalysisResult>('GET', `/api/analysis-results/${id}`);
        return data;
      } catch (error) {
        console.error("Error fetching analysis detail:", error);
        throw error;
      }
    },
    enabled: !!id,
  });
}

// Hook to create analysis results
export function useSaveAnalysisResult() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<AnalysisResult, 'id' | 'dateCreated'>) => {
      try {
        // Using apiRequest instead of fetch to include auth token
        const result = await apiRequest<AnalysisResult>('POST', '/api/analysis-results', data);
        return result;
      } catch (error) {
        console.error("Error saving analysis:", error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate the query for this request to reload the data
      queryClient.invalidateQueries({ queryKey: ['/api/analysis-results/request', variables.requestId] });

      toast({
        title: "Analysis saved",
        description: "Your comparison analysis has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save analysis",
        description: error.message || "An error occurred while saving analysis",
        variant: "destructive",
      });
    },
  });
}