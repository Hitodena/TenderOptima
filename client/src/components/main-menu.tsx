import { Button } from "@/components/ui/button";
import { Search, Send, ListFilter, Users } from "lucide-react";
import { Link, useLocation } from "wouter";

export function MainMenu() {
  const [location] = useLocation();

  // Pages where old main menu should be hidden
  const hiddenPages = [
    '/dashboard',
    '/send-request', 
    '/contact-groups',
    '/compare-results',
    '/select-request-parameters',
    '/analyze/technical',
    '/settings',
    '/auth'
  ];

  // Check if current page should hide old menu
  const shouldHideMenu = hiddenPages.some(page => location.startsWith(page));

  // Don't render old menu on hidden pages
  if (shouldHideMenu) {
    return null;
  }

  const menuItems = [
    {
      title: "Найти поставщиков",
      icon: <Search className="h-4 w-4 mr-2" />,
      path: "/search",
      active: location === "/search"
    },
    {
      title: "Отправить запрос",
      icon: <Send className="h-4 w-4 mr-2" />,
      path: "/send-request",
      active: location === "/send-request"
    },
    {
      title: "Запросы",
      icon: <ListFilter className="h-4 w-4 mr-2" />,
      path: "/dashboard",
      active: location === "/dashboard"
    },
    {
      title: "Контакты",
      icon: <Users className="h-4 w-4 mr-2" />,
      path: "/contact-groups",
      active: location === "/contact-groups" || location.startsWith("/contact-groups/")
    }
  ];

  return (
    <div className="flex items-center space-x-2 mb-6">
      {menuItems.map((item) => (
        <Link href={item.path} key={item.path}>
          <Button 
            variant={item.active ? "default" : "outline"} 
            className="flex items-center"
          >
            {item.icon}
            {item.title}
          </Button>
        </Link>
      ))}
    </div>
  );
}