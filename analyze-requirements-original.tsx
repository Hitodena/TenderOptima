import React, { useState, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { MainNavigation } from '@/components/main-navigation';
import { getAnalysisThemeClasses } from '@/styles/analysis-theme';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { 
  Upload, 
  FileText, 
  Edit3, 
  Save, 
  Plus, 
  Trash2,
  CheckCircle,
  AlertCircle 
} from 'lucide-react';

interface ExtractedRequirement {
  id?: number;
  serialNumber: number;
  techSpecNumber: string;
  extractedValue: string;
  confidence?: number;
  isApproved?: boolean;
}

interface AnalysisProject {
  id?: number;
  procedureName: string;
  description?: string;
  status: string;
}

export function AnalyzeRequirementsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const themeClasses = getAnalysisThemeClasses();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [project, setProject] = useState<AnalysisProject>({
    procedureName: '',
    description: '',
    status: 'step1_requirements'
  });
  
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedRequirements, setExtractedRequirements] = useState<ExtractedRequirement[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Supported file formats
  const supportedFormats = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/bmp',
    'image/gif'
  ];

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    Array.from(files).forEach(file => {
      if (supportedFormats.includes(file.type) || 
          file.name.toLowerCase().match(/\.(pdf|doc|docx|txt|xls|xlsx|jpg|jpeg|png|bmp|gif)$/)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Некоторые файлы не поддерживаются",
        description: `Неподдерживаемые файлы: ${invalidFiles.join(', ')}`,
        variant: "destructive"
      });
    }

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
      
      if (project.procedureName.trim()) {
        await processFiles(validFiles);
      } else {
        toast({
          title: "Укажите название процедуры",
          description: "Пожалуйста, введите название процедуры перед загрузкой файлов",
          variant: "destructive"
        });
      }
    }
  }, [project.procedureName, toast]);

  const processFiles = async (files: File[]) => {
    if (!project.procedureName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название процедуры",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setIsExtracting(true);

    try {
      // Create project if it doesn't exist
      let projectId = project.id;
      if (!projectId) {
        const projectData = {
          procedureName: project.procedureName,
          description: project.description,
          status: 'step1_requirements' as const
        };
        
        const createdProject = await apiRequest('/api/analyze/projects', 'POST', projectData) as any;
        projectId = createdProject.id;
        setProject(prev => ({ ...prev, id: projectId }));
      }

      // Upload and process files
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId!.toString());

        const response = await apiRequest('/api/analyze/requirements/upload', 'POST', formData) as any;
        
        if (response.extractedRequirements) {
          const newRequirements = response.extractedRequirements.map((req: any, index: number) => ({
            ...req,
            serialNumber: extractedRequirements.length + index + 1
          }));
          setExtractedRequirements(prev => [...prev, ...newRequirements]);
        }
      }

      toast({
        title: "Файлы обработаны",
        description: `Извлечено ${extractedRequirements.length} параметров`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error processing files:', error);
      toast({
        title: "Ошибка обработки файлов",
        description: "Попробуйте еще раз",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addNewRequirement = () => {
    const newReq: ExtractedRequirement = {
      serialNumber: extractedRequirements.length + 1,
      techSpecNumber: '',
      extractedValue: '',
      confidence: 1.0,
      isApproved: false
    };
    setExtractedRequirements(prev => [...prev, newReq]);
    setEditingIndex(extractedRequirements.length);
  };

  const updateRequirement = (index: number, field: keyof ExtractedRequirement, value: string | number) => {
    setExtractedRequirements(prev => 
      prev.map((req, i) => 
        i === index ? { ...req, [field]: value } : req
      )
    );
  };

  const deleteRequirement = (index: number) => {
    setExtractedRequirements(prev => 
      prev.filter((_, i) => i !== index)
        .map((req, i) => ({ ...req, serialNumber: i + 1 }))
    );
  };

  const saveRequirement = async (index: number) => {
    const requirement = extractedRequirements[index];
    
    if (!requirement.techSpecNumber.trim() || !requirement.extractedValue.trim()) {
      toast({
        title: "Заполните все поля",
        description: "Номер пункта и значение обязательны",
        variant: "destructive"
      });
      return;
    }

    try {
      if (requirement.id) {
        await apiRequest(`/api/analyze/requirements/${requirement.id}`, 'PUT', requirement);
      } else {
        const created = await apiRequest('/api/analyze/requirements', 'POST', {
          ...requirement,
          projectId: project.id
        }) as any;
        updateRequirement(index, 'id', created.id);
      }
      
      setEditingIndex(null);
      toast({
        title: "Параметр сохранен",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Ошибка сохранения",
        variant: "destructive"
      });
    }
  };

  const confirmParameters = async () => {
    if (!project.procedureName.trim()) {
      toast({
        title: "Укажите название процедуры",
        variant: "destructive"
      });
      return;
    }

    if (extractedRequirements.length === 0) {
      toast({
        title: "Добавьте параметры",
        description: "Необходимо добавить хотя бы один параметр",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiRequest(`/api/analyze/projects/${project.id}`, 'PUT', {
        ...project,
        status: 'step2_offers'
      });

      toast({
        title: "Параметры подтверждены",
        description: "Переход к загрузке предложений поставщиков",
        variant: "default"
      });

      setLocation('/analyze/offers');
    } catch (error) {
      toast({
        title: "Ошибка подтверждения",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={`min-h-screen ${themeClasses.bgBackground}`}>
      <MainNavigation />
      
      <div className="container mx-auto py-6 px-4">
        {/* Step Navigation */}
        <div className="mb-6">
          <div className="flex space-x-1">
            <div className={`px-4 py-2 rounded-t-lg ${themeClasses.bgAccent} ${themeClasses.textMain} font-medium`}>
              Шаг 1
            </div>
            <div className={`px-4 py-2 rounded-t-lg bg-gray-200 text-gray-500`}>
              Шаг 2
            </div>
            <div className={`px-4 py-2 rounded-t-lg bg-gray-200 text-gray-500`}>
              Шаг 3
            </div>
          </div>
        </div>

        <Card className={`${themeClasses.borderColor}`}>
          <CardHeader>
            <CardTitle className={themeClasses.textPrimary}>
              Загрузка технических требований
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Procedure Name Input */}
            <div className="space-y-2">
              <Label htmlFor="procedure-name" className={themeClasses.textMain}>
                Название процедуры *
              </Label>
              <Input
                id="procedure-name"
                value={project.procedureName}
                onChange={(e) => setProject(prev => ({ ...prev, procedureName: e.target.value }))}
                placeholder="Введите название процедуры"
                className={`${themeClasses.borderColor} focus:${themeClasses.borderColor}`}
              />
            </div>

            {/* File Upload Area */}
            <div className="space-y-4">
              <Label className={themeClasses.textMain}>
                Загрузить файлы с техническими требованиями
              </Label>
              
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed ${themeClasses.borderColor} rounded-lg p-8 text-center hover:${themeClasses.bgBackground} transition-colors cursor-pointer`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={`mx-auto h-12 w-12 ${themeClasses.textAccent} mb-4`} />
                <p className={`${themeClasses.textMain} mb-2`}>
                  Перетащите файлы или нажмите для выбора
                </p>
                <p className="text-sm text-gray-500">
                  Поддерживаемые форматы: PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, JPEG, PNG, BMP, GIF
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.jpg,.jpeg,.png,.bmp,.gif"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className={`font-medium ${themeClasses.textMain}`}>Загруженные файлы:</h4>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 ${themeClasses.bgBackground} rounded border ${themeClasses.borderColor}`}>
                      <div className="flex items-center space-x-2">
                        <FileText className={`h-4 w-4 ${themeClasses.textAccent}`} />
                        <span className={themeClasses.textMain}>{file.name}</span>
                        <span className="text-sm text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className={`${themeClasses.textAccent} hover:${themeClasses.bgAccent}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {isUploading && (
                <div className="flex items-center space-x-2 text-sm">
                  <Spinner className="h-4 w-4" />
                  <span className={themeClasses.textMain}>
                    {isExtracting ? 'Извлечение параметров...' : 'Загрузка файлов...'}
                  </span>
                </div>
              )}
            </div>

            {/* Extracted Parameters Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-medium ${themeClasses.textMain}`}>
                  Извлеченные параметры:
                </h3>
                <Button
                  onClick={addNewRequirement}
                  variant="outline"
                  size="sm"
                  className={`${themeClasses.borderColor} ${themeClasses.textAccent} hover:${themeClasses.bgAccent}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить параметр
                </Button>
              </div>

              {extractedRequirements.length > 0 ? (
                <div className={`border ${themeClasses.borderColor} rounded-lg overflow-hidden`}>
                  <table className="w-full">
                    <thead className={`${themeClasses.bgBackground}`}>
                      <tr>
                        <th className={`px-4 py-3 text-left ${themeClasses.textMain} font-medium`}>№</th>
                        <th className={`px-4 py-3 text-left ${themeClasses.textMain} font-medium`}>№пункта тех.задания</th>
                        <th className={`px-4 py-3 text-left ${themeClasses.textMain} font-medium`}>Извлеченное значение</th>
                        <th className={`px-4 py-3 text-left ${themeClasses.textMain} font-medium`}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedRequirements.map((req, index) => (
                        <tr key={index} className={`border-t ${themeClasses.borderColor}`}>
                          <td className={`px-4 py-3 ${themeClasses.textMain}`}>
                            {req.serialNumber}
                          </td>
                          <td className="px-4 py-3">
                            {editingIndex === index ? (
                              <Input
                                value={req.techSpecNumber}
                                onChange={(e) => updateRequirement(index, 'techSpecNumber', e.target.value)}
                                placeholder="2.1.3"
                                className="w-full"
                              />
                            ) : (
                              <span className={themeClasses.textMain}>{req.techSpecNumber}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {editingIndex === index ? (
                              <Input
                                value={req.extractedValue}
                                onChange={(e) => updateRequirement(index, 'extractedValue', e.target.value)}
                                placeholder="Мощность 100 кВт"
                                className="w-full"
                              />
                            ) : (
                              <span className={themeClasses.textMain}>{req.extractedValue}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              {editingIndex === index ? (
                                <>
                                  <Button
                                    onClick={() => saveRequirement(index)}
                                    variant="ghost"
                                    size="sm"
                                    className={`${themeClasses.textAccent} hover:${themeClasses.bgAccent}`}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={() => setEditingIndex(null)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-500 hover:bg-gray-100"
                                  >
                                    ✕
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    onClick={() => setEditingIndex(index)}
                                    variant="ghost"
                                    size="sm"
                                    className={`${themeClasses.textAccent} hover:${themeClasses.bgAccent}`}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={() => deleteRequirement(index)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`text-center py-8 ${themeClasses.bgBackground} rounded-lg border ${themeClasses.borderColor}`}>
                  <AlertCircle className={`mx-auto h-12 w-12 ${themeClasses.textAccent} mb-4`} />
                  <p className={`${themeClasses.textMain} mb-2`}>Параметры не извлечены</p>
                  <p className="text-sm text-gray-500">
                    Загрузите файлы с техническими требованиями или добавьте параметры вручную
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={confirmParameters}
                disabled={!project.procedureName.trim() || extractedRequirements.length === 0}
                className={`${themeClasses.bgPrimary} ${themeClasses.hoverPrimary} text-white`}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Подтвердить параметры
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}