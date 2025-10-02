import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtectedRoute } from '../../../client/src/components/protected-route';
import { useAuth } from '../../../client/src/hooks/use-auth';

// Мок для useAuth хука
vi.mock('../../../client/src/hooks/use-auth');

describe('ProtectedRoute Component', () => {
  const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when user is authenticated', () => {
    (useAuth as any).mockReturnValue({ 
      user: { id: 1, email: 'test@test.com' },
      isLoading: false 
    });
    
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should not render children when user is not authenticated', () => {
    (useAuth as any).mockReturnValue({ 
      user: null,
      isLoading: false 
    });
    
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should show loading state while checking authentication', () => {
    (useAuth as any).mockReturnValue({ 
      user: null,
      isLoading: true 
    });
    
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should handle custom redirect path', () => {
    (useAuth as any).mockReturnValue({ 
      user: null,
      isLoading: false 
    });
    
    render(
      <ProtectedRoute redirectTo="/custom-login">
        <TestComponent />
      </ProtectedRoute>
    );
    
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render children with different user roles', () => {
    const adminUser = { id: 1, email: 'admin@test.com', role: 'admin' };
    (useAuth as any).mockReturnValue({ 
      user: adminUser,
      isLoading: false 
    });
    
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should handle authentication state changes', () => {
    const { rerender } = render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    
    // Сначала не авторизован
    (useAuth as any).mockReturnValue({ 
      user: null,
      isLoading: false 
    });
    rerender(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    
    // Затем авторизован
    (useAuth as any).mockReturnValue({ 
      user: { id: 1, email: 'test@test.com' },
      isLoading: false 
    });
    rerender(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should handle multiple children', () => {
    (useAuth as any).mockReturnValue({ 
      user: { id: 1, email: 'test@test.com' },
      isLoading: false 
    });
    
    render(
      <ProtectedRoute>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <TestComponent />
      </ProtectedRoute>
    );
    
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should handle empty children', () => {
    (useAuth as any).mockReturnValue({ 
      user: { id: 1, email: 'test@test.com' },
      isLoading: false 
    });
    
    const { container } = render(
      <ProtectedRoute>
        {null}
      </ProtectedRoute>
    );
    
    expect(container.firstChild).toBeNull();
  });
});


