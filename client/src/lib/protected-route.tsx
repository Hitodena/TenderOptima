import { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  component: () => React.JSX.Element;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ 
  component: Component,
  requireAdmin = false 
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log('[ProtectedRoute] User not authenticated, redirecting to /auth');
    return <Redirect to="/auth" />;
  }

  if (requireAdmin && user.role !== 'admin') {
    console.log('[ProtectedRoute] User not admin, redirecting to /admin-login');
    return <Redirect to="/admin-login" />;
  }

  console.log('[ProtectedRoute] User authenticated, rendering component');
  return <Component />;
}