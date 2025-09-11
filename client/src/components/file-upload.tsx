import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, File, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  maxSize?: number; // Size in MB
  maxFiles?: number;
}

export function FileUpload({
  onFilesSelected,
  selectedFiles,
  maxSize = 5, // Default to 5MB
  maxFiles = 10,
}: FileUploadProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert MB to bytes
  const maxSizeBytes = maxSize * 1024 * 1024;
  const maxTotalSize = maxFiles * maxSizeBytes;

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    processFiles(Array.from(files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processFiles = (files: File[]) => {
    setIsUploading(true);
    
    try {
      // Check for file size limits
      const oversizedFiles = files.filter(file => file.size > maxSizeBytes);
      
      // Check if any single file is too large
      if (oversizedFiles.length > 0) {
        toast({
          title: "Файлы слишком большие",
          description: `Некоторые файлы превышают лимит ${formatFileSize(maxSizeBytes)} на файл.`,
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      
      // Check how many files we can add (limit to maxFiles total)
      const remainingSlots = maxFiles - selectedFiles.length;
      
      if (remainingSlots <= 0) {
        toast({
          title: "Достигнут лимит файлов",
          description: `Вы можете прикрепить не более ${maxFiles} файлов. Удалите существующие файлы, чтобы добавить новые.`,
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      
      // Limit to remaining slots
      const filesToAdd = files.slice(0, remainingSlots);
      
      // Calculate total size
      const currentSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      const newFilesSize = filesToAdd.reduce((sum, file) => sum + file.size, 0);
      
      if (currentSize + newFilesSize > maxTotalSize) {
        toast({
          title: "Превышен общий размер файлов",
          description: `Общий размер файлов превышает ${formatFileSize(maxTotalSize)}.`,
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }
      
      onFilesSelected(filesToAdd);
      
      if (filesToAdd.length > 0) {
        toast({
          title: "Файлы прикреплены",
          description: `Добавлено ${filesToAdd.length} файл(ов).`,
        });
      }
      
      // If we had to truncate the list of files
      if (filesToAdd.length < files.length) {
        toast({
          title: "Предупреждение",
          description: `Добавлено только ${filesToAdd.length} из ${files.length} файлов из-за ограничения на количество файлов.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error processing files:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обработать файлы. Пожалуйста, попробуйте снова.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear the input to allow re-selection of the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    onFilesSelected(newFiles);
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <UploadCloud className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">
              Перетащите файлы сюда или нажмите, чтобы выбрать
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              До {maxFiles} файлов, максимум {formatFileSize(maxSizeBytes)} каждый
            </p>
          </div>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
            ref={fileInputRef}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mt-2"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            {isUploading ? "Загрузка..." : "Выбрать файлы"}
          </Button>
        </div>
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <div className="border rounded-md p-4 space-y-2">
          <div className="text-xs text-muted-foreground pb-2 flex justify-between items-center border-b">
            <span>
              {selectedFiles.length} файл{selectedFiles.length !== 1 ? 'ов' : ''} прикреплено
            </span>
            <span>
              Общий размер: {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))}
            </span>
          </div>
          
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between text-sm py-1 border-b last:border-b-0">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}