import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { File, Download } from 'lucide-react';

interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  extractedText?: string;
  processingStatus?: string;
}

interface AttachmentsListProps {
  responseId: number;
  initialAttachments?: Attachment[];
}

export function AttachmentsList({ responseId, initialAttachments = [] }: AttachmentsListProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Load attachments metadata with caching for faster switching
  const { data: attachmentsData, isLoading: isQueryLoading } = useQuery({
    queryKey: ['/api/supplier-responses', responseId, 'attachments'],
    queryFn: async () => {
      console.log(`[AttachmentsList] Loading attachments for response ${responseId}`);
      const response = await apiRequest<Attachment[]>(`/api/supplier-responses/${responseId}/attachments`, 'GET');
      console.log(`[AttachmentsList] Loaded ${response?.length || 0} attachments for response ${responseId}`);
      return response;
    },
    enabled: !!responseId, // Always load attachments metadata
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes for faster switching
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Use cached data or initial attachments
  const attachments = attachmentsData || initialAttachments;

  const handleDownload = async (filename: string) => {
    try {
      setIsLoading(true);
      console.log(`[AttachmentsList] Downloading attachment ${filename} for response ${responseId}`);
      
      // Create download URL with proper encoding
      const encodedFilename = encodeURIComponent(filename);
      const downloadUrl = `/api/attachments/${responseId}/${encodedFilename}`;
      
      console.log(`[AttachmentsList] Download URL: ${downloadUrl}`);
      
      // Create a temporary link element for download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.target = '_blank';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download Started",
        description: `Downloading ${filename}...`,
      });
    } catch (error: any) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download attachment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType?.includes('pdf')) return '📄';
    if (contentType?.includes('image')) return '🖼️';
    if (contentType?.includes('word') || contentType?.includes('document')) return '📝';
    if (contentType?.includes('excel') || contentType?.includes('spreadsheet')) return '📊';
    if (contentType?.includes('zip') || contentType?.includes('archive')) return '📦';
    return '📎';
  };

  // Show loading state when query is loading and we have no attachments
  if (isQueryLoading && attachments.length === 0) {
    return (
      <div className="mb-4 p-3 border rounded-md bg-muted/10">
        <div className="flex items-center justify-center py-4">
          <Spinner className="h-4 w-4 mr-2" />
          <span className="text-sm text-muted-foreground">Загрузка вложений...</span>
        </div>
      </div>
    );
  }

  // Don't render anything if no attachments
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 p-3 border rounded-md bg-muted/10">
      <h4 className="text-sm font-medium mb-2">
        Вложения ({attachments.length})
      </h4>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 px-3 py-2 hover:bg-primary/5 hover:border-primary/40 transition-colors"
            onClick={() => handleDownload(attachment.filename)}
            disabled={isLoading}
          >
            <span className="text-lg">{getFileIcon(attachment.contentType)}</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium truncate max-w-[150px]">
                {attachment.filename}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(attachment.size)}
              </span>
            </div>
            <Download className="h-3 w-3 ml-1" />
          </Button>
        ))}
      </div>
    </div>
  );
}
