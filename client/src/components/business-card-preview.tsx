import React from 'react';
import { useAuth } from '@/hooks/use-auth';

interface BusinessCardPreviewProps {
  className?: string;
  hidden?: boolean; // New prop to hide business card
}

export function BusinessCardPreview({ className = '', hidden = false }: BusinessCardPreviewProps) {
  const { user } = useAuth();

  // Hide business card if hidden prop is true or if no data
  if (hidden || (!user?.businessCard && !user?.logoUrl)) {
    return null;
  }

  return (
    <div className={`mt-4 p-4 border-t border-gray-200 ${className}`}>
      <div className="text-sm text-gray-600 mb-2">Визитная карточка:</div>
      <div className="bg-gray-50 p-3 rounded-md">
        {/* Logo temporarily hidden */}
        {false && user.logoUrl && (
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




