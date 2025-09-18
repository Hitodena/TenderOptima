import React from 'react';
import { useAuth } from '@/hooks/use-auth';

interface BusinessCardPreviewProps {
  className?: string;
}

export function BusinessCardPreview({ className = '' }: BusinessCardPreviewProps) {
  const { user } = useAuth();

  if (!user?.businessCard && !user?.logoUrl) {
    return null;
  }

  return (
    <div className={`mt-4 p-4 border-t border-gray-200 ${className}`}>
      <div className="text-sm text-gray-600 mb-2">Визитная карточка:</div>
      <div className="bg-gray-50 p-3 rounded-md">
        {user.logoUrl && (
          <div className="mb-3">
            <img 
              src={user.logoUrl} 
              alt="Company Logo" 
              className="max-w-[150px] max-h-[60px] object-contain"
            />
          </div>
        )}
        {user.businessCard && (
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {user.businessCard}
          </div>
        )}
      </div>
    </div>
  );
}




