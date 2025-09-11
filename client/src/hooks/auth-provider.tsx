import React, { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  role?: string;
  businessCard?: string;
  logoUrl?: string;
  language?: string;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  logout: () => Promise<boolean>;
  refetch: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  const { 
    data: user, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    initialData: null
  });

  const logout = async () => {
    try {
      await apiRequest("/api/auth/logout", "POST");
    } catch (error) {
      console.error("Logout request failed:", error);
    }
    
    // Always clear local storage and cache
    localStorage.removeItem("accessToken");
    localStorage.removeItem("tokenExpiry");
    localStorage.removeItem("rememberMe");
    
    // Clear all cached data
    queryClient.clear();
    
    // Set user data to null immediately
    queryClient.setQueryData(["/api/auth/me"], null);
    
    // Force immediate redirect to auth page
    window.location.replace('/auth');
    
    return true;
  };

  // Check if user has admin privileges
  const isAdmin = 
    user?.role === "admin" || 
    user?.username === "admin@example.com" || 
    user?.username === "admin";

  const value = {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin,
    logout,
    refetch
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}