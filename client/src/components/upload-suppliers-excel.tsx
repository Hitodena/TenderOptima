import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FileSpreadsheet, Upload, Info, X } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Supplier } from "@shared/schema";

// Define expected Excel structure
interface ExcelSupplier {
  name: string;
  email: string;
  description?: string;
  website?: string;
  phone?: string;
  categories?: string[];
}

interface Props {
  onSuppliersUploaded: (suppliers: Supplier[]) => void;
}

export function UploadSuppliersExcel({ onSuppliersUploaded }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isFormatWarningOpen, setIsFormatWarningOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log("File selected:", file.name);  // Debug log

    // Check file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'xls' && fileExt !== 'xlsx') {
      setIsFormatWarningOpen(true);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Close the upload dialog since we have a file now
    setIsUploadDialogOpen(false);
    
    // Start processing
    setIsUploading(true);
    console.log("Starting file processing...");

    try {
      // Process the file and extract suppliers
      const suppliers = await processExcelFile(file);
      
      // Let parent component know we have suppliers
      onSuppliersUploaded(suppliers);
      
      toast({
        title: "Поставщики загружены",
        description: `Успешно загружено ${suppliers.length} поставщиков.`,
      });
    } catch (error) {
      console.error("Excel processing error:", error);
      
      let errorMessage = "Failed to process Excel file. Please check the format and try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Ошибка обработки файла",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      
      // Clear the input for future uploads
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Process Excel file and extract suppliers
  const processExcelFile = async (file: File): Promise<Supplier[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          if (!e.target || !e.target.result) {
            throw new Error("Failed to read file");
          }
          
          const data = e.target.result;
          let workbook: XLSX.WorkBook;
          
          try {
            workbook = XLSX.read(data, { 
              type: 'array', // Using array instead of binary
              cellText: false,
              cellDates: true,
              cellNF: false,
              cellStyles: false
            });
          } catch (err) {
            console.error("XLSX parsing error:", err);
            throw new Error("Invalid Excel format");
          }
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error("No sheets found in Excel file");
          }
          
          // Use the first sheet by default
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON with header row
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, {
            raw: false, // Convert everything to string
            defval: '', // Default value for empty cells
            blankrows: false // Skip blank rows
          });
          
          if (!jsonData || jsonData.length === 0) {
            throw new Error("No data found in Excel file");
          }
          
          console.log("Excel data:", jsonData); // Debug output
          
          // Map to supplier objects
          const suppliers: Supplier[] = [];
          let nextId = -1000; // Use negative IDs for imported suppliers
          
          for (const row of jsonData) {
            console.log("Processing row:", row); // Debug each row
            const keys = Object.keys(row);
            
            // Important: First scan all cells for specific patterns to identify data
            let name = '';
            let email = '';
            let website = '';
            let phone = '';
            
            // First, try to identify the supplier name
            // Check if first column contains organization type (ООО, ЧУП, etc)
            if (row['Примененные фильтры'] && (
                String(row['Примененные фильтры']).includes('ООО') || 
                String(row['Примененные фильтры']).includes('ЧУП') || 
                String(row['Примененные фильтры']).includes('ИП') || 
                String(row['Примененные фильтры']).includes('ЗАО')
            )) {
              name = String(row['Примененные фильтры']);
            }
            
            // Scan through all cells to find patterns
            // Look for email pattern
            for (const key of keys) {
              const value = String(row[key] || '');
              
              // Look for email in a cell that contains @ and .
              if (value.includes('@') && value.includes('.')) {
                if (!email) {
                  email = value;
                }
              }
              
              // Look for website in a cell that contains http or domain extensions
              if ((value.includes('http') || value.includes('.by') || 
                  value.includes('.com') || value.includes('.ru')) && 
                  !value.includes('@')) {
                if (!website) {
                  website = value;
                }
              }
              
              // Look for phone pattern
              if ((value.includes('+') || value.includes('(') || value.includes('-')) && 
                   /\d/.test(value) && 
                   !value.includes('@') && 
                   !value.includes('http')) {
                if (!phone) {
                  phone = value;
                }
              }
            }
            
            // Check if this row is a real supplier entry or just a header/empty row
            if (!name) {
              console.log("Skipping row due to missing name");
              continue;
            }
            
            // Skip header rows
            if (name === "Наименование" || name === "Список сформирован сервисом" || 
                name.toLowerCase().includes("список") || name.toLowerCase().includes("роль")) {
              console.log("Skipping header row:", name);
              continue;
            }
            
            // Skip rows that don't have organization name patterns
            if (!name.includes('ООО') && !name.includes('ЧУП') && !name.includes('ИП') && 
                !name.includes('ЗАО') && !name.includes('ОАО')) {
              console.log("Skipping row - not a company name:", name);
              continue;
            }
            
            // Create the supplier object
            const supplier: Supplier = {
              id: nextId--,
              name: name, // Using the detected name
              description: '', // Default empty description
              website: website,
              email: email,
              phone: phone,
              categories: [] as string[], // Default empty categories array
              responseRate: null,
              totalRequests: null, 
              successfulMatches: null,
              keywordStrength: null,
              lastResponseTime: null
            };
            
            console.log("Created supplier:", supplier); // Debug
            suppliers.push(supplier);
          }
          
          if (suppliers.length === 0) {
            throw new Error("No valid supplier data found in Excel file");
          }
          
          console.log("Total suppliers processed:", suppliers.length);
          resolve(suppliers);
        } catch (error) {
          console.error("Processing error:", error);
          reject(error instanceof Error ? error : new Error("Unknown error processing Excel file"));
        }
      };
      
      reader.onerror = (e) => {
        console.error("FileReader error:", e);
        reject(new Error("Error reading file"));
      };
      
      reader.readAsArrayBuffer(file); // Use ArrayBuffer instead of binary string
    });
  };

  // Auto-open file dialog effect
  const handleButtonClick = () => {
    setIsUploadDialogOpen(true);
    // Add a slight delay to ensure dialog is rendered first
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
  };
  
  return (
    <>
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={handleButtonClick}
      >
        <FileSpreadsheet className="h-4 w-4" />
        Загрузить из файла
      </Button>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Загрузить из файла</DialogTitle>
            <DialogDescription>
              Загрузите Excel файл со списком поставщиков для отправки запроса.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-center mb-4">
              Перетащите Excel файл сюда или нажмите кнопку ниже, чтобы выбрать файл
            </p>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }} 
                disabled={isUploading}
                type="button"
              >
                {isUploading ? (
                  <>
                    <span className="animate-spin mr-2">○</span>
                    Обработка...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Выбрать файл
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsInfoDialogOpen(true)}
                className="w-9 h-9 p-0"
                title="Информация"
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground mt-4">
              Поддерживаемые форматы: .xls, .xlsx
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info Dialog with Sample Format */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Формат файла</DialogTitle>
            <DialogDescription>
              Excel файл должен содержать следующие столбцы:
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-md overflow-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-2 text-left text-sm font-medium border-b">Имя поставщика*</th>
                  <th className="px-3 py-2 text-left text-sm font-medium border-b">Email*</th>
                  <th className="px-3 py-2 text-left text-sm font-medium border-b">Телефон</th>
                  <th className="px-3 py-2 text-left text-sm font-medium border-b">Сайт</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 text-sm">ООО "Пример"</td>
                  <td className="px-3 py-2 text-sm">example@mail.ru</td>
                  <td className="px-3 py-2 text-sm">+7 999 123-45-67</td>
                  <td className="px-3 py-2 text-sm">example.ru</td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="px-3 py-2 text-sm">ИП Иванов</td>
                  <td className="px-3 py-2 text-sm">ivanov@test.com</td>
                  <td className="px-3 py-2 text-sm">+7 999 765-43-21</td>
                  <td className="px-3 py-2 text-sm">ivanov-company.ru</td>
                </tr>
              </tbody>
            </table>
            <div className="px-3 py-2">
              <p className="text-xs text-muted-foreground">
                * - обязательные поля
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Format Warning Alert */}
      <AlertDialog open={isFormatWarningOpen} onOpenChange={setIsFormatWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Неверный формат файла</AlertDialogTitle>
            <AlertDialogDescription>
              Загрузите файл в формате Excel (.xls или .xlsx)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Закрыть</AlertDialogCancel>
            <AlertDialogAction onClick={() => fileInputRef.current?.click()}>
              Выбрать другой файл
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}