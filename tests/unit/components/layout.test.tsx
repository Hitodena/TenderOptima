import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Layout } from '../../../client/src/components/layout';
import { MainNavigation } from '../../../client/src/components/main-navigation';
import { SubscriptionAlerts } from '../../../client/src/components/subscription-alerts';

// Моки для компонентов
vi.mock('../../../client/src/components/main-navigation', () => ({
  MainNavigation: () => <div data-testid="main-navigation">Main Navigation</div>
}));

vi.mock('../../../client/src/components/subscription-alerts', () => ({
  SubscriptionAlerts: () => <div data-testid="subscription-alerts">Subscription Alerts</div>
}));

vi.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

describe('Layout Component', () => {
  it('should render children content', () => {
    render(
      <Layout>
        <div data-testid="test-content">Test Content</div>
      </Layout>
    );
    
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render main navigation', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );
    
    expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
  });

  it('should render subscription alerts', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );
    
    expect(screen.getByTestId('subscription-alerts')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    render(
      <Layout title="Test Title">
        <div>Test Content</div>
      </Layout>
    );
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toHaveClass('text-2xl', 'font-bold');
  });

  it('should not render title when not provided', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );
    
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
  });

  it('should render footer with current year', () => {
    render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );
    
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`© ${currentYear} TenderOptima`)).toBeInTheDocument();
  });

  it('should have proper layout structure', () => {
    const { container } = render(
      <Layout title="Test Title">
        <div>Test Content</div>
      </Layout>
    );
    
    // Проверяем структуру layout
    const mainElement = container.querySelector('main');
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveClass('flex-1');
    
    const footerElement = container.querySelector('footer');
    expect(footerElement).toBeInTheDocument();
    expect(footerElement).toHaveClass('border-t', 'py-6', 'bg-background');
  });

  it('should handle multiple children', () => {
    render(
      <Layout>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </Layout>
    );
    
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });

  it('should have proper CSS classes', () => {
    const { container } = render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );
    
    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement).toHaveClass('min-h-screen', 'bg-background', 'flex', 'flex-col');
  });
});


