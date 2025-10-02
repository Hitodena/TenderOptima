import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MainMenu } from '../../../client/src/components/main-menu';

// Мок для wouter
vi.mock('wouter', () => ({
  useLocation: () => ['/'],
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

describe('MainMenu Component', () => {
  it('should render menu items', () => {
    render(<MainMenu />);
    
    expect(screen.getByText('Найти поставщиков')).toBeInTheDocument();
    expect(screen.getByText('Отправить запрос')).toBeInTheDocument();
    expect(screen.getByText('Запросы')).toBeInTheDocument();
    expect(screen.getByText('Контакты')).toBeInTheDocument();
  });

  it('should show active menu item', () => {
    const { useLocation } = require('wouter');
    useLocation.mockReturnValue(['/search']);
    
    render(<MainMenu />);
    
    const searchButton = screen.getByText('Найти поставщиков').closest('button');
    expect(searchButton).toHaveClass('bg-primary');
  });

  it('should hide menu on specific pages', () => {
    const { useLocation } = require('wouter');
    useLocation.mockReturnValue(['/dashboard']);
    
    const { container } = render(<MainMenu />);
    expect(container.firstChild).toBeNull();
  });

  it('should render all menu items with correct paths', () => {
    render(<MainMenu />);
    
    const menuItems = [
      { text: 'Найти поставщиков', path: '/search' },
      { text: 'Отправить запрос', path: '/send-request' },
      { text: 'Запросы', path: '/dashboard' },
      { text: 'Контакты', path: '/contact-groups' }
    ];
    
    menuItems.forEach(({ text, path }) => {
      const link = screen.getByText(text).closest('a');
      expect(link).toHaveAttribute('href', path);
    });
  });

  it('should handle contact groups subpages', () => {
    const { useLocation } = require('wouter');
    useLocation.mockReturnValue(['/contact-groups/123']);
    
    render(<MainMenu />);
    
    const contactsButton = screen.getByText('Контакты').closest('button');
    expect(contactsButton).toHaveClass('bg-primary');
  });

  it('should not hide menu on regular pages', () => {
    const { useLocation } = require('wouter');
    useLocation.mockReturnValue(['/some-other-page']);
    
    render(<MainMenu />);
    
    expect(screen.getByText('Найти поставщиков')).toBeInTheDocument();
  });
});


