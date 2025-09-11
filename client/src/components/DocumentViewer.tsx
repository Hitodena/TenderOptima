import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Download, Search } from 'lucide-react';

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  fileName: string;
  supplierName?: string;
  targetPage?: number;
  searchTerm?: string;
}

export function DocumentViewer({
  isOpen,
  onClose,
  documentUrl,
  fileName,
  supplierName,
  targetPage,
  searchTerm
}: DocumentViewerProps) {
  const [scale, setScale] = useState(100);
  const [searchQuery, setSearchQuery] = useState(searchTerm || '');
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (searchTerm) {
      setSearchQuery(searchTerm);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (documentUrl && isOpen) {
      setIsLoading(true);
    }
  }, [documentUrl, isOpen]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 25, 50));
  };

  const handleDownload = () => {
    if (documentUrl) {
      const link = document.createElement('a');
      link.href = documentUrl;
      link.download = fileName || 'document.pdf';
      link.click();
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery && iframeRef.current) {
      const url = `${documentUrl}#search=${encodeURIComponent(searchQuery)}`;
      iframeRef.current.src = url;
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    
    // If we have a target page, try to navigate to it
    if (targetPage && iframeRef.current) {
      setTimeout(() => {
        const url = `${documentUrl}#page=${targetPage}`;
        if (searchQuery) {
          iframeRef.current!.src = `${url}&search=${encodeURIComponent(searchQuery)}`;
        } else {
          iframeRef.current!.src = url;
        }
      }, 500);
    }
  };

  if (!isOpen) return null;

  const pdfUrl = targetPage 
    ? `${documentUrl}#page=${targetPage}&zoom=${scale}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`
    : `${documentUrl}#zoom=${scale}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold truncate">
              {fileName}
            </h3>
            {supplierName && (
              <span className="text-sm text-gray-500">
                от {supplierName}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center space-x-2">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center space-x-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск в документе..."
                  className="pl-8 pr-3 py-1 border border-gray-300 rounded text-sm w-48"
                />
                <Search className="h-4 w-4 absolute left-2 top-1.5 text-gray-400" />
              </div>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Найти
              </button>
            </form>
          </div>

          <div className="flex items-center space-x-2">
            {/* Zoom controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handleZoomOut}
                className="p-1 hover:bg-gray-200 rounded"
                title="Уменьшить"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium min-w-[3rem] text-center">
                {scale}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1 hover:bg-gray-200 rounded"
                title="Увеличить"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="flex items-center px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
            >
              <Download className="h-4 w-4 mr-1" />
              Скачать
            </button>
          </div>
        </div>

        {/* Document content */}
        <div className="flex-1 relative bg-gray-100">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Загрузка документа...</p>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            title={fileName}
            onLoad={handleIframeLoad}
            onError={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}