import { BrowserRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { EnhancedAuthProvider } from "@/hooks/use-enhanced-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { Routes } from "./routes";
import "./index.css";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 401 (unauthorized) errors
        if (error?.response?.status === 401) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry on client errors (4xx)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <EnhancedAuthProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-background">
              <Routes />
              <Toaster />
            </div>
          </BrowserRouter>
        </EnhancedAuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;


