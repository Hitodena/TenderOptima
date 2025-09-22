import React, { useState, useEffect } from 'react';
import { Link, useLocation } from "wouter";
import { Settings } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { useAuth } from "@/hooks/use-auth";

type ProcurementType = 'quick' | 'tender' | null;

export function NewNavigation() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [activeProcurementType, setActiveProcurementType] = useState<ProcurementType>(null);

  // New navigation should always be shown

  // Determine active procurement type based on current route
  useEffect(() => {
    if (location.startsWith('/analyze') || location.startsWith('/tender-procurement')) {
      setActiveProcurementType('tender');
    } else if (location.startsWith('/send-request') || location.startsWith('/contact-groups') || location.startsWith('/dashboard') || location.startsWith('/quick-procurement')) {
      setActiveProcurementType('quick');
    } else if (location === '/welcome' || location === '/' || location === '/login-landing') {
      setActiveProcurementType(null);
    } else {
      // Check stored preference for other pages
      const storedType = localStorage.getItem('last_procurement_type') as ProcurementType;
      setActiveProcurementType(storedType);
    }
  }, [location]);

  // Hide navigation on auth page
  if (location === '/auth') {
    return null;
  }

  // Save user preference when they select a procurement type
  const handleProcurementTypeChange = (type: ProcurementType) => {
    setActiveProcurementType(type);
    if (type) {
      localStorage.setItem('last_procurement_type', type);
    }
  };

  // Get sub-menu items based on active procurement type
  const getSubMenuItems = (type: ProcurementType) => {
    if (type === 'quick') {
      return [
        {
          href: '/search',
          label: t('search_suppliers'),
          isActive: location === '/search'
        },
        {
          href: '/send-request',
          label: t('send_requests'), 
          isActive: location.startsWith('/send-request')
        },
        {
          href: '/dashboard',
          label: t('supplier_selection'),
          isActive: location.startsWith('/dashboard')
        },
        {
          href: '/contact-groups',
          label: t('contact_database'),
          isActive: location.startsWith('/contact-groups')
        }
      ];
    } else if (type === 'tender') {
      return [
        {
          href: '/analyze/technical', // TODO: implement spec creator
          label: t('create_specification'),
          isActive: false,
          disabled: true
        },
        {
          href: '/analyze/technical', // TODO: implement spec improvement
          label: t('improve_specification'),
          isActive: false,
          disabled: true
        },
        {
          href: '/analyze/technical',
          label: t('technical_analysis'),
          isActive: location.startsWith('/analyze')
        },
        {
          href: '/analyze/technical', // TODO: implement final selection
          label: t('final_supplier_selection'),
          isActive: false,
          disabled: true
        }
      ];
    }
    return [];
  };

  const subMenuItems = getSubMenuItems(activeProcurementType);

  return (
    <header className="border-b sticky top-0 z-50 bg-white shadow-sm">
      <div className="container mx-auto">
        {/* Main Navigation Bar */}
        <div className="flex items-center h-16 px-6">
          <Link href="/" className="text-xl font-semibold mr-8 text-gray-800">
            TenderOptima
          </Link>

          <div className="flex space-x-8 flex-1">
            {/* Quick Procurement */}
            <Link 
              href="/quick-procurement"
              className={`flex items-center h-full px-4 border-b-2 transition-colors ${
                activeProcurementType === 'quick' 
                ? "border-slate-500 text-slate-800 bg-slate-50" 
                : "border-transparent hover:text-slate-800 text-gray-800"
              }`}
              onClick={() => handleProcurementTypeChange('quick')}
            >
              <span className="font-medium">{t('quick_procurement')}</span>
            </Link>

            {/* Admin Panel - Only show for admin users with localStorage check */}
            {user?.role === 'admin' && localStorage.getItem('isAdmin') === 'true' && (
              <Link 
                href="/admin/email"
                className={`flex items-center h-full px-4 border-b-2 transition-colors ${
                  location.startsWith('/admin')
                  ? "border-blue-500 text-blue-800 bg-blue-50" 
                  : "border-transparent hover:text-blue-800 text-gray-800"
                }`}
              >
                <span className="font-medium">Админ панель</span>
              </Link>
            )}

            {/* Tender Procurement */}
            <Link 
              href="/tender-procurement"
              className={`flex items-center h-full px-4 border-b-2 transition-colors ${
                activeProcurementType === 'tender' 
                  ? "border-slate-500 text-slate-800 bg-slate-50" 
                  : "border-transparent hover:text-slate-800 text-gray-800"
              }`}
              onClick={() => handleProcurementTypeChange('tender')}
            >
              <span className="font-medium">{t('tender_procurement')}</span>
            </Link>
          </div>

          <div className="ml-auto">
            {/* Settings Link */}
            <Link 
              href="/settings" 
              className={`flex items-center h-full px-3 border-b-2 ${
                location.startsWith("/settings") 
                  ? "border-gray-500 text-gray-800"
                  : "border-transparent hover:text-gray-800 text-gray-800"
              }`}
            >
              <Settings className="h-4 w-4 mr-2" />
              <span>{t("settings")}</span>
            </Link>
          </div>
        </div>

        {/* Sub Navigation Bar - Always visible when procurement type is selected */}
        {activeProcurementType && subMenuItems.length > 0 && (
          <div className={`border-b px-6 py-2 ${
            activeProcurementType === 'quick' ? 'bg-slate-50' : 'bg-slate-50'
          }`}>
            <div className="flex space-x-6">
              {subMenuItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.disabled ? '#' : item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    item.disabled 
                      ? 'text-gray-400 cursor-not-allowed'
                      : item.isActive
                        ? activeProcurementType === 'quick'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-slate-100 text-slate-700'
                        : activeProcurementType === 'quick'
                          ? 'text-gray-600 hover:bg-gray-200'
                          : 'text-slate-800 hover:bg-slate-100'
                  }`}
                  onClick={(e) => {
                    if (item.disabled) {
                      e.preventDefault();
                    }
                  }}
                >
                  {item.label}
                  {item.disabled && <span className="ml-1 text-xs">(скоро)</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}