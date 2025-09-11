import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

interface CancelWinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  winnerName: string;
  isLoading?: boolean;
}

export const CancelWinnerModal: React.FC<CancelWinnerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  winnerName,
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">
                Отменить выбор победителя
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-2">
            <p className="text-sm text-gray-500 mb-4">
              Вы уверены, что хотите отменить выбор победителя?
            </p>
            
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4">
              <div className="text-sm">
                <p className="font-medium text-orange-800 mb-1">Текущий победитель:</p>
                <p className="text-orange-700">{winnerName}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              После отмены выбора вы сможете выбрать другого поставщика в качестве победителя.
            </p>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Нет, оставить
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Отменяем...
                </>
              ) : (
                'Да, отменить'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};