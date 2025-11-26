import React from 'react';
import { Lock, Calendar, CreditCard, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SubscriptionGuardProps {
  isActive: boolean;
  children: React.ReactNode;
  onUpgrade?: () => void;
}

export function SubscriptionGuard({ isActive, children, onUpgrade }: SubscriptionGuardProps) {
  const { t } = useTranslation();

  // When subscription is active, render children normally
  if (isActive) {
    return <>{children}</>;
  }

  // When subscription is expired, show only white background with centered alert
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg border border-orange-200">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-orange-600" />
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Подписка истекла
          </h3>
          
          <p className="text-gray-600 mb-6">
            Для продолжения работы с платформой необходимо продлить подписку или связаться с нашей командой поддержки.
          </p>
          
          <div className="space-y-3" style={{ display: 'none' }}>
            <button
              onClick={() => window.location.href = '/settings'}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Продлить подписку
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="bg-gray-50 p-3 rounded text-center mt-4">
            <div className="text-xs text-gray-600 mb-2">Свяжитесь с Вашим менеджером</div>
            <div className="text-sm">
              <p>Email: support@tenderoptima.by</p>
              <p className="sr-only">Тел: +375 29 1111111</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}