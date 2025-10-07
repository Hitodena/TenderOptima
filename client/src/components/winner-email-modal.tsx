import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { Send, X, Paperclip } from 'lucide-react';

interface WinnerEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    subject: string;
    content: string;
    attachments: File[];
  }) => void;
  supplier: {
    name: string;
    email: string;
  };
  isLoading?: boolean;
}

export const WinnerEmailModal: React.FC<WinnerEmailModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  supplier,
  isLoading = false
}) => {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const { user } = useAuth();

  React.useEffect(() => {
    if (isOpen) {
      // Initialize default values when modal opens
      const defaultSubject = 'Поздравляем! Ваше предложение признано лучшим';
      
      const businessCardSignature = user?.businessCard ? `\n\n${user.businessCard}` : '';
      
      const defaultContent = `Уважаемый ${supplier.name}!

Поздравляем! Ваше коммерческое предложение признано лучшим в рамках проведенного тендера.

Мы готовы заключить с вами договор на поставку товаров/услуг на условиях, указанных в вашем предложении.

В ближайшее время наш менеджер свяжется с вами для обсуждения деталей договора.

${businessCardSignature}`;

      setSubject(defaultSubject);
      setContent(defaultContent);
    }
  }, [isOpen, supplier.name, user?.businessCard]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (subject.trim() && content.trim()) {
      onSubmit({
        subject: subject.trim(),
        content: content.trim(),
        attachments
      });
    }
  };

  const handleClose = () => {
    setSubject('');
    setContent('');
    setAttachments([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" 
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh',
        position: 'fixed'
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <h2 className="text-xl font-semibold text-gray-900">
              Отправить уведомление победителю
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              disabled={isLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-800">Выбранный победитель:</span>
                <span className="text-green-700">{supplier.name}</span>
              </div>
              <div className="mt-1 text-sm text-green-600">
                Email: {supplier.email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тема письма
              </label>
              <Input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full"
                disabled={isLoading}
              />
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Текст письма
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[200px]"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Вложения
              </label>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="attachment-input"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="attachment-input"
                    className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Paperclip className="w-4 h-4 mr-2" />
                    Добавить файлы
                  </label>
                  <span className="text-sm text-gray-500">
                    (договор, спецификация и др.)
                  </span>
                </div>
                
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-red-500 hover:text-red-700"
                          disabled={isLoading}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Отменить
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !subject.trim() || !content.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Отправить уведомление
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};