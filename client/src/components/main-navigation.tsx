import { Link, useLocation } from "wouter";
import { Search, Send, ListFilter, Users, Settings, Shield, BarChart3, FileText, List } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";
import { ModeSwitcher, useAppMode, type AppMode } from "@/components/mode-switcher";
import { getAnalysisThemeClasses } from "@/styles/analysis-theme";

export function MainNavigation() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { mode, setMode, isLoading } = useAppMode();
  const themeClasses = getAnalysisThemeClasses();

  // Pages where old navigation should be hidden
  const hiddenPages = [
    '/dashboard',
    '/send-request', 
    '/contact-groups',
    '/compare-results',
    '/select-request-parameters',
    '/analyze/technical',
    '/analyze/parameters',
    '/analyze',
    '/analysis',
    '/settings',
    '/auth',
    '/admin',
    '/admpanel'
  ];

  // Check if current page should hide old navigation
  const shouldHideNavigation = hiddenPages.some(page => location.startsWith(page));

  // Don't render old navigation on hidden pages
  if (shouldHideNavigation) {
    return null;
  }
  
  // Hide menu completely - not needed anymore
  return null;

  // Define menu items based on current mode
  const getMenuItems = (currentMode: AppMode) => {
    if (currentMode === 'analyze_offers') {
      return [
        {
          href: '/analyze/technical',
          icon: BarChart3,
          label: 'Технический анализ',
          isActive: location.startsWith('/analyze/technical') || (location.startsWith('/analyze') && !location.startsWith('/analyze/parameters'))
        },
        {
          href: '/analyze/parameters', 
          icon: FileText,
          label: 'Анализ по параметрам',
          isActive: location.startsWith('/analyze/parameters')
        }
      ];
    }
    
    // Default supplier search menu
    return [
      {
        href: '/',
        icon: Search,
        label: t("search_suppliers"),
        isActive: location === '/',
        onClick: () => {
          sessionStorage.removeItem('selectedSuppliers');
          sessionStorage.removeItem('requestId');
          sessionStorage.removeItem('parametersSelected');
          sessionStorage.removeItem('requestParameters');
        }
      },
      {
        href: '/send-request',
        icon: Send,
        label: t("send_request"),
        isActive: location === '/send-request',
        onClick: () => {
          sessionStorage.removeItem('selectedSuppliers');
          sessionStorage.removeItem('requestId');
          sessionStorage.removeItem('parametersSelected');
          sessionStorage.removeItem('requestParameters');
        }
      },
      {
        href: '/dashboard',
        icon: ListFilter,
        label: t("requests"),
        isActive: location.startsWith("/dashboard") || location.startsWith("/requests")
      },
      {
        href: '/contact-groups',
        icon: Users,
        label: t("contacts"),
        isActive: location.startsWith("/contact-groups")
      }
    ];
  };

  const menuItems = getMenuItems(mode);

  return (
    <header className="border-b sticky top-0 z-50 bg-white shadow-sm" style={{ backgroundColor: 'white' }}>
      <div className="flex items-center h-16 px-6 container mx-auto">
        <Link href="/" className="text-xl font-semibold mr-6">
          TenderOptima
        </Link>

        <div className="flex space-x-4 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const className = `flex items-center h-full px-3 border-b-2 ${
              item.isActive 
                ? mode === 'analyze_offers' 
                  ? `${themeClasses.borderColor} ${themeClasses.textAccent}` 
                  : "border-primary text-primary"
                : "border-transparent"
            }`;

            return (
              <Link 
                key={item.href}
                href={item.href} 
                className={className}
                onClick={item.onClick}
              >
                <Icon className="h-4 w-4 mr-2" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center space-x-4">
          {/* Mode Switcher */}
          <ModeSwitcher 
            currentMode={mode}
            onModeChange={setMode}
          />
          
          {/* Settings Link */}
          <Link 
            href="/settings" 
            className={`flex items-center h-full px-3 border-b-2 ${
              location.startsWith("/settings") 
                ? mode === 'analyze_offers'
                  ? `${themeClasses.borderColor} ${themeClasses.textAccent}`
                  : "border-primary text-primary"
                : "border-transparent"
            }`}
          >
            <Settings className="h-4 w-4 mr-2" />
            <span>{t("settings")}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}