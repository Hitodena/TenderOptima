import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MainNavigation } from '../../../client/src/components/main-navigation';
import { useLanguage } from '../../../client/src/contexts/language-context';
import { useAuth } from '../../../client/src/hooks/use-auth';
import { useAppMode } from '../../../client/src/components/mode-switcher';

// Моки для хуков
vi.mock('../../../client/src/contexts/language-context');
vi.mock('../../../client/src/hooks/use-auth');
vi.mock('../../../client/src/components/mode-switcher');
vi.mock('wouter', () => ({
  useLocation: () => ['/'],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

describe('MainNavigation Component', () => {
  const mockT = vi.fn((key: string) => key);
  const mockUser = { id: 1, email: 'test@test.com', name: 'Test User' };
  const mockSetMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useLanguage as any).mockReturnValue({ t: mockT });
    (useAuth as any).mockReturnValue({ user: mockUser });
    (useAppMode as any).mockReturnValue({ 
      mode: 'supplier_search', 
      setMode: mockSetMode, 
      isLoading: false 
    });
  });

  it('should render navigation menu', () => {
    render(<MainNavigation />);
    
    expect(screen.getByText('Найти поставщиков')).toBeInTheDocument();
    expect(screen.getByText('Отправить запрос')).toBeInTheDocument();
    expect(screen.getByText('Запросы')).toBeInTheDocument();
    expect(screen.getByText('Контакты')).toBeInTheDocument();
  });

  it('should hide navigation on specific pages', () => {
    (useLocation as any).mockReturnValue(['/dashboard']);
    
    const { container } = render(<MainNavigation />);
    expect(container.firstChild).toBeNull();
  });

  it('should show active menu item', () => {
    (useLocation as any).mockReturnValue(['/search']);
    
    render(<MainNavigation />);
    
    const searchButton = screen.getByText('Найти поставщиков').closest('button');
    expect(searchButton).toHaveClass('bg-primary');
  });

  it('should render mode switcher', () => {
    render(<MainNavigation />);
    
    expect(screen.getByText('supplier_search')).toBeInTheDocument();
  });

  it('should handle user authentication state', () => {
    (useAuth as any).mockReturnValue({ user: null });
    
    render(<MainNavigation />);
    
    // Проверяем, что компонент рендерится даже без пользователя
    expect(screen.getByText('Найти поставщиков')).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    (useAppMode as any).mockReturnValue({ 
      mode: 'supplier_search', 
      setMode: mockSetMode, 
      isLoading: true 
    });
    
    render(<MainNavigation />);
    
    // Компонент должен рендериться даже в состоянии загрузки
    expect(screen.getByText('Найти поставщиков')).toBeInTheDocument();
  });

  it('should render different menu items based on mode', () => {
    (useAppMode as any).mockReturnValue({ 
      mode: 'analyze_offers', 
      setMode: mockSetMode, 
      isLoading: false 
    });
    
    render(<MainNavigation />);
    
    // В режиме анализа должны быть другие пункты меню
    expect(screen.getByText('Анализ предложений')).toBeInTheDocument();
  });

  it('should handle language switching', () => {
    mockT.mockImplementation((key: string) => {
      const translations: Record<string, string> = {
        'nav.find_suppliers': 'Find Suppliers',
        'nav.send_request': 'Send Request',
        'nav.requests': 'Requests',
        'nav.contacts': 'Contacts'
      };
      return translations[key] || key;
    });
    
    render(<MainNavigation />);
    
    expect(screen.getByText('Find Suppliers')).toBeInTheDocument();
  });
});


