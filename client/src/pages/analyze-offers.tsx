import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, Trash2, Plus, FileText, ArrowLeft, ArrowRight, Download, Info, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAnalysisThemeClasses } from '@/styles/analysis-theme';
import { useLocation, useParams } from 'wouter';

interface Supplier {
  id?: number;
  name: string;
}

interface SupplierFile {
  id?: number;
  filename: string;
  original_name: string;
  file_path?: string;
  upload_date?: string;
  created_at: string;
  file_size: number;
}

interface AnalysisProject {
  id?: number;
  procedureName?: string;
  description?: string;
  status?: string;
}

export function AnalyzeOffersPage() {
  const [project, setProject] = useState<AnalysisProject>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierFiles, setSupplierFiles] = useState<SupplierFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [activeTab, setActiveTab] = useState('suppliers');
  const [showInstructions, setShowInstructions] = useState(false);

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams();
  const themeClasses = getAnalysisThemeClasses();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get project ID from URL parameters
  const projectId = params.projectId ? parseInt(params.projectId) : null;

  const loadProject = async (id: number) => {
    try {
      const response = await fetch(`/api/analysis-projects/${id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        console.log('[ProjectLoad] Loaded project data:', data.project);
      } else {
        console.error('[ProjectLoad] Failed to load project:', response.status);
      }
    } catch (error) {
      console.error('[ProjectLoad] Error loading project:', error);
    }
  };

  // Load project data based on URL parameter
  useEffect(() => {
    if (projectId) {
      console.log('[ProjectLoad] Loading project from URL parameter:', projectId);
      loadProject(projectId);
      loadSuppliers(projectId);
    } else {
      // Fallback to localStorage for backward compatibility
      const savedProject = localStorage.getItem('currentAnalysisProject');
      console.log('[ProjectLoad] No URL projectId, checking localStorage:', savedProject);
      
      if (savedProject) {
        try {
          const projectData = JSON.parse(savedProject);
          console.log('[ProjectLoad] Parsed project data:', projectData);
          setProject(projectData);
          if (projectData.id) {
            loadSuppliers(projectData.id);
          }
        } catch (error) {
          console.error('[ProjectLoad] Error parsing saved project:', error);
          createDefaultProject();
        }
      } else {
        console.log('[ProjectLoad] No saved project, creating default');
        createDefaultProject();
      }
    }
  }, [projectId]);

  const createDefaultProject = async () => {
    try {
      const response = await fetch('/api/analysis-projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          procedureName: 'Анализ предложений',
          description: 'Автоматически созданный проект для анализа'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newProject = data.project;
        console.log('[ProjectLoad] Created default project:', newProject);
        if (newProject && newProject.id) {
          setProject(newProject);
          localStorage.setItem('currentAnalysisProject', JSON.stringify(newProject));
          // Ensure we have the project ID before any operations
          console.log('[ProjectLoad] Project ID set:', newProject.id);
        } else {
          console.error('[ProjectLoad] Project created but missing ID:', newProject);
        }
      } else {
        console.error('[ProjectLoad] Failed to create default project:', response.status);
        const errorText = await response.text();
        console.error('[ProjectLoad] Error details:', errorText);
      }
    } catch (error) {
      console.error('[ProjectLoad] Error creating default project:', error);
    }
  };

  const loadSuppliers = async (projectId: number) => {
    try {
      const response = await fetch(`/api/analysis-projects/${projectId}/suppliers`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
        if (data.suppliers && data.suppliers.length > 0) {
          setSelectedSupplier(data.suppliers[0]);
          loadSupplierFiles(data.suppliers[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadSupplierFiles = async (supplierId: number) => {
    try {
      const response = await fetch(`/api/analysis-projects/suppliers/${supplierId}/files`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded supplier files with IDs:', data.files?.map(f => ({ id: f.id, name: f.original_name })));
        setSupplierFiles(data.files || []);
      }
    } catch (error) {
      console.error('Error loading supplier files:', error);
    }
  };

  const addSupplier = async () => {
    console.log('[AddSupplier] Button clicked, checking conditions...');
    console.log('[AddSupplier] newSupplierName:', newSupplierName);
    console.log('[AddSupplier] project.id:', project.id);
    
    if (!newSupplierName.trim() || !project.id) {
      console.log('[AddSupplier] Validation failed - missing name or project ID');
      return;
    }

    console.log('[AddSupplier] Starting API request...');
    try {
      const response = await fetch(`/api/analysis-projects/${project.id}/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newSupplierName.trim()
        })
      });

      console.log('[AddSupplier] Response status:', response.status);
      console.log('[AddSupplier] Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('[AddSupplier] Response data:', data);
        const newSupplier = data.supplier;
        setSuppliers(prev => [...prev, newSupplier]);
        setSelectedSupplier(newSupplier);
        setSupplierFiles([]);
        setNewSupplierName('');
        setShowAddSupplier(false);
        
        toast({
          title: "Поставщик добавлен",
          description: `${newSupplier.name} успешно добавлен в проект`
        });
      } else {
        const errorData = await response.text();
        console.log('[AddSupplier] Error response:', errorData);
        throw new Error(`Failed to add supplier: ${response.status}`);
      }
    } catch (error) {
      console.error('[AddSupplier] Exception:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить поставщика",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    console.log('[FileUpload] Starting file upload...', {
      selectedSupplierId: selectedSupplier?.id,
      projectId: project.id,
      filesCount: files.length
    });

    if (!selectedSupplier?.id || !project.id || files.length === 0) {
      console.log('[FileUpload] Missing required data:', {
        supplierId: selectedSupplier?.id,
        projectId: project.id,
        filesCount: files.length
      });
      
      if (!project.id) {
        toast({
          title: "Проект не создан",
          description: "Сначала создайте проект",
          variant: "destructive"
        });
      }
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      console.log('[FileUpload] Uploading to:', `/api/analysis-projects/${project.id}/suppliers/${selectedSupplier.id}/files`);

      const response = await fetch(`/api/analysis-projects/${project.id}/suppliers/${selectedSupplier.id}/files`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('[FileUpload] Response status:', response.status);
      console.log('[FileUpload] Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('[FileUpload] Upload response:', data);
        await loadSupplierFiles(selectedSupplier.id);
        
        toast({
          title: "Файлы загружены",
          description: `Загружено ${files.length} файлов для ${selectedSupplier.name}`
        });
      } else {
        const errorData = await response.text();
        console.log('[FileUpload] Error response:', errorData);
        throw new Error(`Failed to upload files: ${response.status}`);
      }
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить файлы",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedSupplier, toast]);

  const deleteFile = async (fileId: number) => {
    if (!selectedSupplier?.id) return;
    
    try {
      const response = await fetch(`/api/analysis-projects/suppliers/${selectedSupplier.id}/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setSupplierFiles(prev => prev.filter(f => f.id !== fileId));
        toast({
          title: "Файл удален",
          description: "Файл успешно удален"
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить файл",
        variant: "destructive"
      });
    }
  };

  const deleteSupplierFile = async (fileIndex: number) => {
    if (!selectedSupplier?.id || fileIndex < 0 || fileIndex >= supplierFiles.length) return;

    try {
      const response = await fetch(`/api/analysis-projects/suppliers/${selectedSupplier.id}/files/${fileIndex}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setSupplierFiles(prev => prev.filter((_, index) => index !== fileIndex));
        toast({
          title: "Файл удален",
          description: "Файл успешно удален"
        });
      } else {
        throw new Error('Failed to delete file');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить файл",
        variant: "destructive"
      });
    }
  };

  const extractSupplierParameters = async () => {
    if (!selectedSupplier?.id) return;

    setIsAnalyzing(true);

    try {
      const response = await fetch(`/api/analysis-projects/suppliers/${selectedSupplier.id}/extract-parameters`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        toast({
          title: "Извлечение параметров запущено",
          description: `Параметры извлекаются из файлов поставщика ${selectedSupplier.name}`
        });
      } else {
        throw new Error('Failed to extract parameters');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось запустить извлечение параметров",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Menu */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const currentProjectId = projectId || project.id;
                  if (currentProjectId) {
                    setLocation(`/analyze/technical/${currentProjectId}/workspace`);
                  }
                }}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Назад к шагу 1</span>
              </Button>
              <div className="h-6 border-l border-gray-300" />
              <h1 className={`text-xl font-semibold ${themeClasses.textPrimary}`}>
                Шаг 2: Загрузка технических предложений поставщиков
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              {/* Removed "Перейти к шагу 3" button as requested */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="suppliers">
              Поставщики ({suppliers.length})
            </TabsTrigger>
            <TabsTrigger value="files">
              Файлы
            </TabsTrigger>
            <TabsTrigger value="extraction">
              Извлечение параметров
            </TabsTrigger>
          </TabsList>

          {/* Suppliers Tab */}
          <TabsContent value="suppliers" className="space-y-6">
            <div className="flex gap-1 h-[calc(100vh-200px)]">
              {/* Left Panel - Suppliers List - Narrower */}
              <Card className="w-80 min-w-80 max-w-80 flex-shrink-0">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className={themeClasses.textPrimary}>Поставщики</CardTitle>
                  <Button
                    onClick={() => setShowAddSupplier(true)}
                    size="sm"
                    className={themeClasses.buttonSecondary}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {suppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedSupplier?.id === supplier.id
                            ? `${themeClasses.backgroundLight} ${themeClasses.borderColor}`
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          if (supplier.id) {
                            loadSupplierFiles(supplier.id);
                          }
                        }}
                      >
                        <div className="font-medium">{supplier.name}</div>
                      </div>
                    ))}

                    {suppliers.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>Поставщики не добавлены</p>
                        <p className="text-sm">Добавьте поставщика с помощью кнопки "+" выше</p>
                      </div>
                    )}
                  </div>

                  {showAddSupplier && (
                    <div className="mt-4 space-y-3 p-4 border rounded-lg bg-gray-50">
                      <div>
                        <Label htmlFor="supplierName">Название поставщика *</Label>
                        <Input
                          id="supplierName"
                          value={newSupplierName}
                          onChange={(e) => setNewSupplierName(e.target.value)}
                          placeholder="Введите название поставщика"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={addSupplier}
                          size="sm"
                          className={`bg-cyan-600 hover:bg-cyan-700 text-white ${!newSupplierName.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!newSupplierName.trim()}
                        >
                          Добавить
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowAddSupplier(false);
                            setNewSupplierName('');
                          }}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right Panel - File Upload for Selected Supplier - Takes remaining space */}
              <Card className="flex-1 min-w-0">
                <CardHeader className="flex flex-row items-center space-x-2">
                  <CardTitle className={themeClasses.textPrimary}>
                    {selectedSupplier ? `Файлы поставщика: ${selectedSupplier.name}` : 'Загрузка файлов'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-6 w-6 rounded-full hover:bg-gray-100"
                    onClick={() => setShowInstructions(!showInstructions)}
                  >
                    <Info className="h-4 w-4 text-gray-500" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {selectedSupplier ? (
                    <div className="space-y-4">
                      {/* File Upload Area */}
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          isUploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-cyan-400 hover:bg-cyan-50'
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                          multiple
                          accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.jpg,.jpeg,.png"
                          className="hidden"
                        />
                        {isUploading ? (
                          <div className="space-y-2">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-cyan-600" />
                            <p className="text-sm text-gray-600">Загрузка файлов...</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-8 w-8 mx-auto text-gray-400" />
                            <p className="text-sm text-gray-600">
                              Перетащите файлы сюда или{' '}
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-cyan-600 hover:text-cyan-700 underline"
                              >
                                выберите файлы
                              </button>
                            </p>
                            <p className="text-xs text-gray-500">
                              Поддерживаются: PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, PNG
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Uploaded Files List */}
                      {supplierFiles.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-gray-900">Загруженные файлы:</h4>
                          <div className="space-y-2">
                            {supplierFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                <div className="flex items-center space-x-3">
                                  <FileText className="h-4 w-4 text-gray-500" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{file.original_name}</p>
                                    <p className="text-xs text-gray-500">
                                      {formatFileSize(file.file_size)} • {file.created_at ? formatDate(file.created_at) : 'Недавно'}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteSupplierFile(index)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Выберите поставщика для загрузки файлов</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Instructions Popup */}
            {showInstructions && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowInstructions(false)}>
                <div className="bg-white rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Инструкции</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowInstructions(false)}
                      className="p-1 h-6 w-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Как добавить поставщика:</h4>
                      <ol className="text-sm text-blue-800 space-y-1">
                        <li>1. Нажмите кнопку "+" в левой панели</li>
                        <li>2. Введите название поставщика</li>
                        <li>3. Нажмите "Добавить"</li>
                      </ol>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">Загрузка файлов:</h4>
                      <ol className="text-sm text-green-800 space-y-1">
                        <li>1. Выберите поставщика в левой панели</li>
                        <li>2. Перетащите файлы или нажмите "выберите файлы"</li>
                        <li>3. Поддерживаются: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="space-y-6">
            {selectedSupplier ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* File Upload Area */}
                <Card>
                  <CardHeader>
                    <CardTitle className={themeClasses.textPrimary}>
                      Загрузка файлов для: {selectedSupplier.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        Перетащите файлы сюда или нажмите для выбора
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        Поддерживаются PDF, DOC, DOCX, XLS, XLSX, TXT, JPG, PNG
                      </p>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            handleFileUpload(e.target.files);
                          }
                        }}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={isUploading}
                        className={themeClasses.buttonPrimary}
                      >
                        {isUploading ? 'Загрузка...' : 'Выбрать файлы'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Files List */}
                <Card>
                  <CardHeader>
                    <CardTitle className={themeClasses.textPrimary}>
                      Загруженные файлы ({supplierFiles.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {supplierFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FileText className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="font-medium">{file.original_name || file.filename}</div>
                              <div className="text-sm text-gray-500">
                                {formatFileSize(file.file_size)} • {file.created_at ? formatDate(file.created_at) : 'Недавно'}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              console.log('Deleting file with ID:', file.id, 'File:', file);
                              file.id && deleteFile(file.id);
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {supplierFiles.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <p>Файлы не загружены</p>
                          <p className="text-sm">Загрузите файлы предложений поставщика</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500 mb-4">Выберите поставщика для загрузки файлов</p>
                  <p className="text-sm text-gray-400">
                    Добавьте поставщика с помощью кнопки "+" в левой панели
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Parameter Extraction Tab */}
          <TabsContent value="extraction" className="space-y-6">
            {selectedSupplier && supplierFiles.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className={themeClasses.textPrimary}>
                    Извлечение параметров для: {selectedSupplier.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-blue-900 mb-2">
                        Готов извлекать параметры из {supplierFiles.length} файлов
                      </p>
                      <p className="text-sm text-blue-700">
                        ИИ проанализирует загруженные файлы и извлечёт ключевые параметры предложения
                      </p>
                    </div>
                    <Button
                      onClick={extractSupplierParameters}
                      disabled={isAnalyzing}
                      className={`${themeClasses.buttonPrimary} w-full`}
                    >
                      {isAnalyzing ? 'Извлекаются параметры...' : 'Извлечь параметры поставщика'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500 mb-4">
                    {!selectedSupplier 
                      ? 'Выберите поставщика для извлечения параметров'
                      : 'Загрузите файлы поставщика для извлечения параметров'
                    }
                  </p>
                  <p className="text-sm text-gray-400">
                    Для извлечения параметров необходимо выбрать поставщика и загрузить его файлы
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}