import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, FileDown, X, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

interface Attachment {
  filename: string;
  contentType: string;
  content?: string;
  size?: number;
}

interface SupplierResponseAttachmentsProps {
  responseId: number;
  attachments: Attachment[];
  maxToShow?: number;
}

export function SupplierResponseAttachments({
  responseId,
  attachments,
  maxToShow = 3,
}: SupplierResponseAttachmentsProps) {
  const { toast } = useToast();
  const [expandedView, setExpandedView] = useState(false);

  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  const handleDownloadClick = (index: number) => {
    toast({
      title: "Загрузка файла",
      description: "Началась загрузка вложения",
    });
  };

  // Отображаем только первые maxToShow вложений (если не в расширенном режиме)
  const visibleAttachments = expandedView ? attachments : attachments.slice(0, maxToShow);
  const hasMoreAttachments = !expandedView && attachments.length > maxToShow;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">
          Файлы ({attachments.length})
        </div>
        {attachments.length > maxToShow && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setExpandedView(!expandedView)}
          >
            {expandedView ? (
              <>
                <Minimize2 className="h-3 w-3 mr-1" />
                <span className="text-xs">Свернуть</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3 mr-1" />
                <span className="text-xs">Показать все</span>
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleAttachments.map((attachment, index) => (
          <AttachmentButton
            key={index}
            attachment={attachment}
            index={index}
            responseId={responseId}
            onDownloadClick={handleDownloadClick}
          />
        ))}

        {hasMoreAttachments && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setExpandedView(true)}
          >
            Ещё {attachments.length - maxToShow} файл(ов)...
          </Button>
        )}
      </div>
    </div>
  );
}

interface AttachmentButtonProps {
  attachment: Attachment;
  index: number;
  responseId: number;
  onDownloadClick: (index: number) => void;
}

function AttachmentButton({
  attachment,
  index,
  responseId,
  onDownloadClick,
}: AttachmentButtonProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  // Add timestamp to prevent caching issues
  const timestamp = Date.now();
  
  // Get authentication token from localStorage or sessionStorage
  let authToken = '';
  try {
    authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
  } catch (e) {
    console.error('Error accessing storage for auth token:', e);
  }
  
  // Using supplier attachments endpoint for response attachments
  const attachmentUrl = `/api/attachments/${responseId}/${index}/${encodeURIComponent(attachment.filename || `file-${index}.bin`)}?t=${timestamp}&token=${authToken}`;
  const fileType = getFileType(attachment.contentType);
  
  // Debug logging
  console.log(`[AttachmentButton] Rendering attachment:`, {
    responseId,
    index,
    filename: attachment.filename, 
    contentType: attachment.contentType,
    hasContent: !!attachment.content,
    size: attachment.size || 'unknown',
    url: attachmentUrl
  });
  
  const handleDownload = () => {
    console.log(`[AttachmentButton] Downloading attachment:`, {
      responseId,
      index,
      filename: attachment.filename
    });
    
    // Create a direct link for more reliable downloading
    const link = document.createElement('a');
    link.href = attachmentUrl;
    link.download = attachment.filename || `file-${index}.bin`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    
    // Remove the link after a delay
    setTimeout(() => {
      document.body.removeChild(link);
    }, 2000);
    
    onDownloadClick(index);
  };
  
  const handleFileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (fileType === "image" && !downloadError) {
      // Reset any previous error state when opening the preview
      setDownloadError(false);
      setPreviewOpen(true);
    } else {
      handleDownload();
    }
  };
  
  // Reset download error when component unmounts
  React.useEffect(() => {
    return () => setDownloadError(false);
  }, []);
  
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs flex items-center gap-1"
        onClick={handleFileClick}
      >
        <Paperclip className="h-3 w-3" />
        {attachment.filename || `файл ${index + 1}`}
        {fileType === "image" && (
          <span className="ml-1 text-xs underline cursor-pointer">
            (предпросмотр)
          </span>
        )}
      </Button>

      {fileType === "image" && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{attachment.filename || `Изображение ${index + 1}`}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Скачать
                  </Button>
                  <DialogClose asChild>
                    <Button variant="outline" size="sm">
                      <X className="h-4 w-4 mr-1" />
                      Закрыть
                    </Button>
                  </DialogClose>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-center overflow-auto max-h-[80vh]">
              {!downloadError ? (
                <img
                  src={attachmentUrl}
                  alt={attachment.filename || `Изображение ${index + 1}`}
                  className="max-w-full object-contain"
                  onError={() => {
                    console.error(`Failed to load image: ${attachmentUrl}`);
                    setDownloadError(true);
                  }}
                  key={`${responseId}-${index}-${timestamp}`} // Force image refresh on dialog open
                />
              ) : (
                <div className="text-center text-red-500 p-4">
                  <p>Ошибка загрузки изображения</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={handleDownload}
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Скачать файл
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 ml-2"
                    onClick={() => {
                      setDownloadError(false); // Reset error state
                      // Force reload by updating timestamp
                      const newTimestamp = Date.now();
                      const newUrl = `/api/attachments/${responseId}/${index}/${encodeURIComponent(attachment.filename || `file-${index}.bin`)}?t=${newTimestamp}`;
                      const img = new Image();
                      img.src = newUrl;
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Повторить
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function getFileType(contentType: string): "image" | "document" | "other" {
  if (!contentType) return "other";
  
  if (contentType.startsWith("image/")) {
    return "image";
  } else if (
    contentType.includes("pdf") ||
    contentType.includes("document") ||
    contentType.includes("msword") ||
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    contentType.includes("powerpoint") ||
    contentType.includes("presentation")
  ) {
    return "document";
  }
  
  return "other";
}