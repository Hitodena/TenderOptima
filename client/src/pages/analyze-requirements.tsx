import React, { useState, useCallback, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { MainNavigation } from '@/components/main-navigation';
import { getAnalysisThemeClasses } from '@/styles/analysis-theme';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Upload, 
  FileText, 
  Edit3, 
  Save, 
  Plus, 
  Trash2,
  CheckCircle,
  AlertCircle,
  GripVertical,
  ExternalLink,
  Download,
  X
} from 'lucide-react';


interface ExtractedRequirement {
  id?: number;
  serialNumber: number;
  techSpecNumber: string;
  extractedValue: string;
  confidence?: number;
  isApproved?: boolean;
  page_reference?: string;
  file_reference?: string;
}

interface AnalysisProject {
  id?: number;
  procedureName: string;
  description?: string;
  status: string;
  requestName?: string;
  analysisRequestId?: number;
}

interface SemanticBlock {
  id: number;
  block_title: string;
  content_hash: string;
  semantic_essence: {
    core_function: string;
    semantic_description: string;
    key_processes: string[];
    critical_params: Record<string, string>;
    dependencies: string[];
    exclusions: string[];
    key_requirements: string[];
  };
  token_count: number;
  processing_method: 'direct' | 'compressed' | 'recursive';
  order_index: number;
  created_at: string;
}

export function AnalyzeRequirementsPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const themeClasses = getAnalysisThemeClasses();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Get project ID from URL parameters
  const projectId = params.projectId ? parseInt(params.projectId) : null;

  // State management
  const [project, setProject] = useState<AnalysisProject>({
    procedureName: '',
    description: '',
    status: 'step1_requirements'
  });
  const [procedureName, setProcedureName] = useState('');
  const [description, setDescription] = useState('');

  // Document viewer state
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<{
    name: string;
    url: string;
    type: string;
    page?: number;
  } | null>(null);
  const [splitPanelWidth, setSplitPanelWidth] = useState(40); // Left panel width percentage

  // Semantic blocks state
  const [semanticBlocks, setSemanticBlocks] = useState<SemanticBlock[]>([]);
  const [showSemanticBlocks, setShowSemanticBlocks] = useState(false);

  // Load project data based on URL parameter
  React.useEffect(() => {
    if (projectId) {
      console.log('[Requirements] Loading project from URL parameter:', projectId);
      // Set the project ID in state immediately
      setProject(prev => ({ ...prev, id: projectId }));
      // Load existing project data, requirements and files for existing projects
      loadProjectDetails(projectId);
      loadExistingRequirements(projectId);
      loadExistingFiles(projectId);
      loadSemanticBlocks(projectId);
    } else {
      // Fallback to localStorage for backward compatibility
      const savedProject = localStorage.getItem('currentAnalysisProject');
      console.log('[Requirements] No URL projectId, checking localStorage:', savedProject);
      
      if (savedProject) {
        try {
          const projectData = JSON.parse(savedProject);
          console.log('[Requirements] Parsed project data:', projectData);
          if (projectData && projectData.id) {
            setProject(projectData);
            console.log('[Requirements] Project ID loaded:', projectData.id);
            loadProjectDetails(projectData.id);
            loadExistingRequirements(projectData.id);
            loadExistingFiles(projectData.id);
            loadSemanticBlocks(projectData.id);
          }
        } catch (error) {
          console.error('[Requirements] Error parsing saved project:', error);
        }
      }
    }
  }, [projectId]);

  // Load user preference for confirmation dialog
  React.useEffect(() => {
    const loadUserPreference = async () => {
      try {
        const response = await fetch('/api/analysis-projects/user/preferences/skip_parameter_confirmation', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setSkipConfirmation(data.value || false);
        }
      } catch (error) {
        console.error('Error loading user preference:', error);
      }
    };
    loadUserPreference();
  }, []);

  // Save user preference for confirmation dialog
  const saveUserPreference = async (value: boolean) => {
    try {
      await fetch('/api/analysis-projects/user/preferences/skip_parameter_confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ value })
      });
    } catch (error) {
      console.error('Error saving user preference:', error);
    }
  };

  // Load existing requirements and project data for existing projects
  const loadExistingRequirements = async (projectId: number) => {
    try {
      const response = await apiRequest(`/api/analysis-projects/${projectId}/extracted-requirements`);
      if (response.ok) {
        const data = await response.json();
        if (data.requirements && Array.isArray(data.requirements)) {
          setExtractedRequirements(data.requirements);
        }
      }
    } catch (error) {
      console.error('[Requirements] Error loading existing requirements:', error);
    }
  };

  // Load project details from database
  const loadProjectDetails = async (projectId: number) => {
    try {
      const response = await apiRequest(`/api/analysis-projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.project) {
          setProject(prev => ({
            ...prev,
            procedureName: data.project.procedure_name || prev.procedureName,
            description: data.project.description || prev.description,
            status: data.project.status || prev.status,
            requestName: data.project.request_name,
            analysisRequestId: data.project.analysis_request_id
          }));
          // Update form fields with loaded data - use request name as fallback
          setProcedureName(data.project.request_name || data.project.procedure_name || '');
          setDescription(data.project.description || '');
          console.log('[Requirements] Loaded project details:', data.project);
          console.log('[Requirements] Request name from API:', data.project.request_name);
          console.log('[Requirements] Analysis request ID:', data.project.analysis_request_id);
        }
      }
    } catch (error) {
      console.error('[Requirements] Error loading project details:', error);
    }
  };

  // Save project details to database
  const saveProjectDetails = async () => {
    if (!project.id) return;

    try {
      const response = await apiRequest(`/api/analysis-projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          procedure_name: procedureName,
          description: description
        })
      });

      if (response.ok) {
        console.log('[Requirements] Project details saved successfully');
      }
    } catch (error) {
      console.error('[Requirements] Error saving project details:', error);
    }
  };



  // Load existing semantic blocks
  const loadSemanticBlocks = async (projectId: number) => {
    try {
      const response = await apiRequest(`/api/analysis-projects/${projectId}/semantic-blocks`);
      if (response.ok) {
        const data = await response.json();
        if (data.blocks && Array.isArray(data.blocks)) {
          setSemanticBlocks(data.blocks);
          setShowSemanticBlocks(data.blocks.length > 0);
        }
      }
    } catch (error) {
      console.error('[SemanticBlocks] Error loading semantic blocks:', error);
    }
  };

  // Load existing uploaded files for the project
  const loadExistingFiles = async (projectId: number) => {
    try {
      const response = await apiRequest(`/api/analysis-projects/${projectId}/files`);
      if (response.ok) {
        const data = await response.json();
        if (data.files && Array.isArray(data.files)) {
          // Convert to display format
          const fileList = data.files.map((file: any) => ({
            name: file.name,
            size: file.size || 0,
            type: file.mimeType || 'application/octet-stream'
          }));
          setUploadedFiles(fileList);
          console.log('[Requirements] Loaded existing files:', fileList);
        }
      }
    } catch (error) {
      console.error('[Requirements] Error loading existing files:', error);
    }
  };
  
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedRequirements, setExtractedRequirements] = useState<ExtractedRequirement[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);

  // Insert new requirement after specified index
  const insertRequirementAfter = (afterIndex: number) => {
    const newReq: ExtractedRequirement = {
      serialNumber: afterIndex + 2,
      techSpecNumber: '',
      extractedValue: '',
      confidence: 1.0,
      isApproved: false
    };

    setExtractedRequirements(prev => {
      const newReqs = [...prev];
      newReqs.splice(afterIndex + 1, 0, newReq);
      // Renumber all requirements
      return newReqs.map((req, index) => ({
        ...req,
        serialNumber: index + 1
      }));
    });

    // Auto-focus the new row for editing
    setTimeout(() => {
      setEditingIndex(afterIndex + 1);
    }, 100);
  };

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
      if (supportedFormats.includes(file.type)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Неподдерживаемые файлы",
        description: `Файлы ${invalidFiles.join(', ')} не поддерживаются`,
        variant: "destructive"
      });
    }

    if (validFiles.length > 0) {
      // Allow file upload without procedure name - will validate on parameter extraction
      
      await uploadFiles(validFiles);
    }
  }, [project.procedureName]);

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    
    try {
      let currentProjectId = projectId || project.id;
      
      // First, create or ensure we have a project
      if (!currentProjectId) {
        const response = await fetch('/api/analysis-projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            procedure_name: project.procedureName || 'Анализ предложений',
            description: project.description || 'Автоматически созданный проект'
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to create project' }));
          throw new Error(errorData.error || 'Failed to create project');
        }

        const projectData = await response.json();
        currentProjectId = projectData.id;
        setProject(prev => ({ ...prev, id: currentProjectId }));
      }
      
      // Now upload files to the project
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const uploadResponse = await fetch(`/api/analysis-projects/${currentProjectId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload files');
      }

      const uploadData = await uploadResponse.json();
      setUploadedFiles(prev => [...prev, ...files]);
      
      toast({
        title: "Файлы загружены",
        description: `Загружено ${files.length} файлов в проект`,
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Ошибка загрузки",
        description: error instanceof Error ? error.message : "Попробуйте еще раз",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
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

  const removeFile = async (index: number) => {
    const fileToRemove = uploadedFiles[index];
    const currentProjectId = projectId || project.id;
    
    if (currentProjectId && fileToRemove) {
      try {
        // For now, we'll need to get the actual file ID from the server
        // This is a simplified version - in production we'd track file IDs
        const response = await apiRequest(`/api/analysis-projects/${currentProjectId}/files/${index + 1}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          setUploadedFiles(prev => prev.filter((_, i) => i !== index));
          toast({
            title: "Файл удален",
            description: `${fileToRemove.name} удален из проекта`
          });
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        // Allow local removal even if server deletion fails
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
        toast({
          title: "Файл удален локально",
          description: "Файл удален из списка",
        });
      }
    } else {
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const extractParameters = async () => {
    // Ensure we have the latest project data before validation
    const currentProjectId = projectId || project.id;
    if (currentProjectId) {
      try {
        // Use direct fetch to bypass apiRequest wrapper that might be interfering
        const response = await fetch(`/api/analysis-projects/${currentProjectId}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          console.log('[Requirements] Fresh API response (direct fetch):', data);
          if (data.project && data.project.request_name) {
            // Use the fresh request name from the API
            console.log('[Requirements] Using fresh request name from API:', data.project.request_name);
            // Continue with extraction using the fresh data
            await performExtraction(data.project.request_name, currentProjectId);
            return;
          } else {
            console.log('[Requirements] No request_name found in fresh API response');
          }
        }
      } catch (error) {
        console.error('[Requirements] Error fetching fresh project data:', error);
      }
    }
    
    // Fallback to existing state if API call fails
    const currentProcedureName = project.requestName || procedureName || project.procedureName;
    console.log('[Requirements] Fallback validation check:');
    console.log('  - project.requestName:', project.requestName);
    console.log('  - procedureName:', procedureName);
    console.log('  - project.procedureName:', project.procedureName);
    console.log('  - currentProcedureName:', currentProcedureName);
    
    if (!currentProcedureName || !currentProcedureName.trim()) {
      toast({
        title: "Укажите название процедуры",
        description: "Пожалуйста, введите название процедуры перед извлечением параметров",
        variant: "destructive"
      });
      return;
    }
    
    await performExtraction(currentProcedureName, currentProjectId);
  };

  const performExtraction = async (procedureName: string, currentProjectId: any) => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "Нет файлов для обработки",
        description: "Сначала загрузите файлы с техническими требованиями",
        variant: "destructive"
      });
      return;
    }
    
    if (!currentProjectId || !Number.isInteger(Number(currentProjectId))) {
      toast({
        title: "Проект не создан",
        description: "Сначала загрузите файлы для создания проекта",
        variant: "destructive"
      });
      return;
    }

    setIsExtracting(true);

    try {
      console.log('Starting parameter extraction for project:', currentProjectId);
      
      // First, update the project with the procedure name
      const updateResponse = await fetch(`/api/analysis-projects/${currentProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          procedure_name: procedureName,
          description: description || project.description
        })
      });

      if (!updateResponse.ok) {
        console.warn('Failed to update project name, continuing with extraction...');
      }

      const response = await fetch(`/api/analysis-projects/${currentProjectId}/extract-parameters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Parameter extraction failed:', errorData);
        throw new Error(errorData.error || 'Failed to extract parameters');
      }

      const data = await response.json();
      console.log('Parameter extraction response:', data);
      
      if (data.extractedRequirements && Array.isArray(data.extractedRequirements)) {
        const newRequirements = data.extractedRequirements.map((req: any, index: number) => ({
          id: req.id || null,
          serialNumber: index + 1,
          techSpecNumber: req.tech_spec_number || `${index + 1}.1`,
          extractedValue: req.extracted_value || '',
          confidence: req.confidence || 0.8,
          isApproved: false
        }));
        setExtractedRequirements(newRequirements);
        
        // Load semantic blocks that were created during extraction
        if (data.semanticBlocks && Array.isArray(data.semanticBlocks)) {
          setSemanticBlocks(data.semanticBlocks);
          setShowSemanticBlocks(true);
        }
        
        toast({
          title: "Параметры извлечены",
          description: `Извлечено ${newRequirements.length} параметров из ${data.totalFiles || uploadedFiles.length} файлов`,
          variant: "default"
        });
      } else {
        console.warn('No requirements extracted or invalid format:', data);
        toast({
          title: "Параметры не найдены",
          description: "В загруженных файлах не найдено технических требований",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error extracting parameters:', error);
      toast({
        title: "Ошибка извлечения параметров",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз",
        variant: "destructive"
      });
    } finally {
      setIsExtracting(false);
    }
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

  const updateRequirement = (index: number, field: keyof ExtractedRequirement, value: any) => {
    setExtractedRequirements(prev => 
      prev.map((req, i) => 
        i === index ? { ...req, [field]: value } : req
      )
    );
  };

  const saveRequirement = async (index: number) => {
    const requirement = extractedRequirements[index];
    
    if (!requirement.techSpecNumber.trim() || !requirement.extractedValue.trim()) {
      toast({
        title: "Заполните поля",
        description: "Укажите номер спецификации и значение параметра",
        variant: "destructive"
      });
      return;
    }

    // Use projectId from URL parameters instead of project.id
    const currentProjectId = projectId || project.id;
    
    if (!currentProjectId) {
      toast({
        title: "Ошибка проекта",
        description: "ID проекта не найден",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Saving requirement:', requirement);
      console.log('Project ID:', currentProjectId);
      
      const response = await fetch(`/api/analysis-projects/${currentProjectId}/requirements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          requirements: [requirement]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save requirement');
      }

      const data = await response.json();
      if (data.savedRequirements && data.savedRequirements.length > 0) {
        const savedReq = data.savedRequirements[0];
        updateRequirement(index, 'id', savedReq.id);
      }

      setEditingIndex(null);
      toast({
        title: "Параметр сохранен",
        description: "Требование успешно сохранено"
      });
    } catch (error) {
      console.error('Error saving requirement:', error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить параметр",
        variant: "destructive"
      });
    }
  };

  const deleteRequirement = (index: number) => {
    setExtractedRequirements(prev => 
      prev.filter((_, i) => i !== index)
        .map((req, i) => ({ ...req, serialNumber: i + 1 }))
    );
  };

  const handleConfirmClick = () => {
    if (!project.id) {
      toast({
        title: "Проект не создан",
        description: "Сначала создайте проект",
        variant: "destructive"
      });
      return;
    }

    if (extractedRequirements.length === 0) {
      toast({
        title: "Нет параметров",
        description: "Добавьте хотя бы один параметр",
        variant: "destructive"
      });
      return;
    }

    // Check if user has disabled the confirmation dialog
    if (skipConfirmation) {
      confirmParameters();
    } else {
      setShowConfirmDialog(true);
    }
  };

  const confirmParameters = async () => {
    try {
      const response = await fetch(`/api/analyze/${project.id}/confirm-parameters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to confirm parameters');
      }

      // Invalidate subscription cache to refresh request count
      queryClient.invalidateQueries({ queryKey: ['subscription'] });

      toast({
        title: "Параметры подтверждены",
        description: "Переход к следующему этапу",
        variant: "default"
      });

      // Navigate to workspace with suppliers tab (screen 2)
      setLocation(`/analyze/technical/${project.id}/workspace?tab=suppliers`);
    } catch (error) {
      console.error('Error confirming parameters:', error);
      toast({
        title: "Ошибка подтверждения",
        description: error instanceof Error ? error.message : "Попробуйте ещё раз",
        variant: "destructive"
      });
    }
  };

  const handleConfirmDialogProceed = async () => {
    if (dontShowAgain) {
      await saveUserPreference(true);
      setSkipConfirmation(true);
    }
    setShowConfirmDialog(false);
    confirmParameters();
  };

  const handleConfirmDialogCancel = () => {
    setShowConfirmDialog(false);
    setDontShowAgain(false);
  };

  // Document viewer functions
  const openDocument = (fileName: string, pageReference?: string) => {
    if (!projectId) return;
    
    // Extract page number from reference (supports "стр. 5", "page 7", etc.)
    let pageNumber: number | undefined;
    if (pageReference) {
      const pageMatch = pageReference.match(/(\d+)/);
      if (pageMatch) {
        pageNumber = parseInt(pageMatch[1]);
      }
    }

    const documentUrl = `/api/analysis-projects/${projectId}/files/${encodeURIComponent(fileName)}`;
    
    setCurrentDocument({
      name: fileName,
      url: documentUrl,
      type: fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc',
      page: pageNumber
    });
    
    setShowDocumentViewer(true);
  };

  const closeDocumentViewer = () => {
    setShowDocumentViewer(false);
    setCurrentDocument(null);
  };

  // Panel resizing
  const handlePanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = splitPanelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const containerWidth = window.innerWidth;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.max(20, Math.min(80, startWidth + deltaPercent));
      setSplitPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [splitPanelWidth]);

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      
      {showDocumentViewer ? (
        <div className="h-screen flex flex-col">
          {/* Top Navigation Menu - Compact */}
          <div className="bg-white border-b flex-shrink-0">
            <div className="px-6 py-2">
              <div className="flex items-center justify-between">
                <h1 className={`text-lg font-semibold ${themeClasses.textPrimary}`}>
                  Анализ технических требований
                </h1>
                <Button
                  onClick={closeDocumentViewer}
                  variant="outline"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="w-4 h-4 mr-1" />
                  Закрыть просмотр
                </Button>
              </div>
            </div>
          </div>
          
          {/* Split Screen Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Requirements Table */}
            <div className="flex-shrink-0 overflow-y-auto bg-white border-r" style={{ width: `${splitPanelWidth}%` }}>
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-4">Извлеченные параметры</h3>
                
                {extractedRequirements.length > 0 ? (
                  <div className={`border ${themeClasses.borderColor} rounded-lg overflow-hidden`}>
                    <table className="w-full text-sm">
                      <thead className={`${themeClasses.bgBackground}`}>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">№</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Спецификация</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Значение</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 hidden">Ссылка</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedRequirements
                          .sort((a, b) => a.serialNumber - b.serialNumber)
                          .map((req, index) => (
                          <tr key={index} className={`border-t ${themeClasses.borderColor} hover:bg-gray-50`}>
                            <td className="px-3 py-2 text-xs">{req.serialNumber}</td>
                            <td className="px-3 py-2 text-xs">{req.techSpecNumber}</td>
                            <td className="px-3 py-2 text-xs">{req.extractedValue}</td>
                            <td className="px-3 py-2 hidden">
                              {req.page_reference && uploadedFiles.length > 0 && (
                                <Button
                                  onClick={() => openDocument(uploadedFiles[0].name, req.page_reference)}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs px-2 py-1 h-auto text-blue-600 hover:text-blue-800 border-blue-300 hover:border-blue-500"
                                  title={`Открыть документ на ${req.page_reference}`}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  {req.page_reference}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="mx-auto h-12 w-12 mb-4 text-gray-300" />
                    <p>Параметры не извлечены</p>
                  </div>
                )}
              </div>
            </div>

            {/* Resizer */}
            <div
              className="w-2 bg-gray-200 hover:bg-cyan-400 cursor-col-resize flex items-center justify-center"
              onMouseDown={handlePanelResize}
              title="Перетащите для изменения размера панели"
            >
              <div className="w-0.5 h-8 bg-gray-400"></div>
            </div>

            {/* Right Panel - Document Viewer */}
            <div className="flex-1 overflow-hidden bg-gray-100">
              {currentDocument ? (
                <div className="h-full flex flex-col">
                  {/* Document Header */}
                  <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{currentDocument.name}</h4>
                      {currentDocument.page && (
                        <p className="text-sm text-gray-600">Страница {currentDocument.page}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Document Content */}
                  <div className="flex-1 overflow-hidden">
                    {currentDocument.type === 'pdf' ? (
                      <iframe
                        src={`${currentDocument.url}${currentDocument.page ? `#page=${currentDocument.page}` : ''}`}
                        className="w-full h-full border-0"
                        title={currentDocument.name}
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-8">
                        <FileText className="h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{currentDocument.name}</h3>
                        <p className="text-gray-600 mb-4">Документ Word недоступен для просмотра</p>
                        <Button
                          onClick={() => window.open(currentDocument.url, '_blank')}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Скачать документ
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <FileText className="mx-auto h-16 w-16 mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2 hidden">Документ не выбран</h3>
                    <p>Нажмите на кнопку "Ссылка" в таблице параметров для просмотра документа</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Navigation Menu */}
          <div className="bg-white border-b">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h1 className={`text-xl font-semibold ${themeClasses.textPrimary}`}>
                    Шаг 1: Анализ технических требований
                  </h1>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Removed "Перейти к шагу 2" button - users should use "Подтвердить параметры" instead */}
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="container mx-auto px-6 py-8">
        <Card className={`border-2 ${themeClasses.borderColor}`}>
          <CardHeader>
            <CardTitle className={`text-2xl font-bold ${themeClasses.textMain}`}>
              Загрузка технических требований
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Project Information */}
            <div className="grid grid-cols-1 gap-4">
              
              {/* Hidden description field - keep in code but hide from UI */}
              <div className="hidden">
                <Label htmlFor="description" className={themeClasses.textMain}>
                  Описание (опционально)
                </Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setProject(prev => ({ ...prev, description: e.target.value }));
                    // Auto-save after a short delay
                    setTimeout(() => saveProjectDetails(), 1000);
                  }}
                  placeholder="Введите описание запроса"
                  className={`border-2 ${themeClasses.borderColor}`}
                />
              </div>
            </div>

              {/* File Upload Area */}
            <div 
              className={`border-2 border-dashed ${themeClasses.borderColor} rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className={`mx-auto h-12 w-12 ${themeClasses.textAccent} mb-4`} />
              <h3 className={`text-lg font-medium ${themeClasses.textMain} mb-2`}>
                Перетащите файлы или нажмите для выбора
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Поддерживаемые форматы: PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, JPEG, PNG, BMP, GIF
              </p>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.jpg,.jpeg,.png,.bmp,.gif"
                onChange={(e) => {
                  handleFileUpload(e.target.files);
                  // Reset the input so the same file can be selected again
                  if (e.target) e.target.value = '';
                }}
                className="hidden"
              />
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className={`text-lg font-medium ${themeClasses.textMain}`}>
                  Загруженные файлы:
                </h3>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className={`flex items-center justify-between p-3 border ${themeClasses.borderColor} rounded-lg bg-white`}>
                    <div className="flex items-center space-x-3">
                      <FileText className={`h-5 w-5 ${themeClasses.textAccent}`} />
                      <span className={themeClasses.textMain}>{file.name}</span>
                      <span className="text-sm text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      onClick={() => removeFile(index)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Loading State */}
            {(isUploading || isExtracting) && (
              <div className="flex items-center space-x-2 text-sm">
                <Spinner className="h-4 w-4" />
                <span className={themeClasses.textMain}>
                  {isExtracting ? 'Извлечение параметров...' : 'Загрузка файлов...'}
                </span>
              </div>
            )}

            {/* Extract Parameters Button */}
            <div className="flex justify-center py-6 border-t border-b border-gray-200 my-6 bg-blue-50">
              <Button
                onClick={extractParameters}
                disabled={uploadedFiles.length === 0 || isExtracting}
                size="lg"
                className="bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 text-lg font-medium"
              >
                {isExtracting ? (
                  <>
                    <Spinner className="h-5 w-5 mr-3" />
                    Извлечение параметров...
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5 mr-3" />
                    Извлечь параметры
                  </>
                )}
              </Button>
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
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">№</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Номер спецификации</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Значение</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Sort requirements by serialNumber for better user experience */}
                      {[...extractedRequirements].sort((a, b) => a.serialNumber - b.serialNumber).map((req, index) => (
                        <React.Fragment key={req.id || `req-${index}`}>
                          <tr className="border-t border-gray-200 group hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600 relative">
                              <div className="flex items-center space-x-2">
                                <button
                                  className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Перетащите для изменения порядка"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    let startY = e.clientY;
                                    let isDragging = false;
                                    
                                    const handleMouseMove = (e: MouseEvent) => {
                                      const deltaY = e.clientY - startY;
                                      if (Math.abs(deltaY) > 30 && !isDragging) {
                                        isDragging = true;
                                        const direction = deltaY > 0 ? 1 : -1;
                                        const newIndex = Math.max(0, Math.min(extractedRequirements.length - 1, index + direction));
                                        
                                        if (newIndex !== index) {
                                          const newReqs = [...extractedRequirements];
                                          const [movedItem] = newReqs.splice(index, 1);
                                          newReqs.splice(newIndex, 0, movedItem);
                                          
                                          // Renumber all requirements
                                          const renumbered = newReqs.map((req, i) => ({
                                            ...req,
                                            serialNumber: i + 1
                                          }));
                                          
                                          setExtractedRequirements(renumbered);
                                          
                                          // Update startY for continued dragging
                                          startY = e.clientY;
                                          isDragging = false;
                                        }
                                      }
                                    };
                                    
                                    const handleMouseUp = () => {
                                      document.removeEventListener('mousemove', handleMouseMove);
                                      document.removeEventListener('mouseup', handleMouseUp);
                                    };
                                    
                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                  }}
                                >
                                  <GripVertical className="h-4 w-4 text-gray-400" />
                                </button>
                                <span>{req.serialNumber}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {editingIndex === index ? (
                                <Input
                                  value={req.techSpecNumber}
                                  onChange={(e) => updateRequirement(index, 'techSpecNumber', e.target.value)}
                                  placeholder="2.1"
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
                                {req.page_reference && uploadedFiles.length > 0 && (
                                  <Button
                                    onClick={() => openDocument(uploadedFiles[0].name, req.page_reference)}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs px-2 py-1 h-auto text-blue-600 hover:text-blue-800 border-blue-300 hover:border-blue-500"
                                    title={`Открыть документ на ${req.page_reference}`}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    {req.page_reference}
                                  </Button>
                                )}
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
                        </React.Fragment>
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

            {/* Semantic Blocks Section */}
            {semanticBlocks.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-semibold ${themeClasses.textMain}`}>
                    Семантический анализ оборудования
                  </h3>
                  <div className="flex items-center space-x-3">
                    {semanticBlocks.length > 0 && (
                      <Button
                        onClick={() => setShowSemanticBlocks(!showSemanticBlocks)}
                        variant="ghost"
                        className="text-gray-600"
                      >
                        {showSemanticBlocks ? 'Скрыть' : 'Показать'} блоки
                      </Button>
                    )}
                  </div>
                </div>

                {showSemanticBlocks && semanticBlocks.length > 0 && (
                  <div className="space-y-4">
                    {semanticBlocks.map((block, index) => (
                      <Card key={block.id} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-medium text-gray-900">
                              {block.block_title}
                            </CardTitle>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                                {block.processing_method}
                              </span>
                              <span className="text-xs">
                                {block.token_count} токенов
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Core Function */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Основная функция:</h4>
                            <p className="text-gray-700 text-sm">
                              {block.semantic_essence.core_function}
                            </p>
                          </div>

                          {/* Semantic Description */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">Описание:</h4>
                            <p className="text-gray-700 text-sm">
                              {block.semantic_essence.semantic_description}
                            </p>
                          </div>

                          {/* Key Requirements */}
                          {block.semantic_essence.key_requirements.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Ключевые требования:</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {block.semantic_essence.key_requirements.map((req, idx) => (
                                  <li key={idx} className="text-gray-700 text-sm">{req}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Critical Parameters */}
                          {Object.keys(block.semantic_essence.critical_params).length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Критические параметры:</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {Object.entries(block.semantic_essence.critical_params).map(([key, value]) => (
                                  <div key={key} className="bg-gray-50 p-2 rounded">
                                    <span className="font-medium text-sm text-gray-900">{key}:</span>
                                    <span className="text-sm text-gray-700 ml-1">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Key Processes */}
                          {block.semantic_essence.key_processes.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2">Ключевые процессы:</h4>
                              <div className="flex flex-wrap gap-2">
                                {block.semantic_essence.key_processes.map((process, idx) => (
                                  <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                    {process}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dependencies and Exclusions */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {block.semantic_essence.dependencies.length > 0 && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Зависимости:</h4>
                                <ul className="list-disc list-inside space-y-1">
                                  {block.semantic_essence.dependencies.map((dep, idx) => (
                                    <li key={idx} className="text-gray-700 text-xs">{dep}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {block.semantic_essence.exclusions.length > 0 && (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Исключения:</h4>
                                <ul className="list-disc list-inside space-y-1">
                                  {block.semantic_essence.exclusions.map((exc, idx) => (
                                    <li key={idx} className="text-gray-700 text-xs">{exc}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {showSemanticBlocks && semanticBlocks.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-2">Семантические блоки не созданы</p>
                    <p className="text-sm text-gray-500">
                      Нажмите "Создать семантические блоки" для анализа требований
                    </p>
                  </div>
                )}
              </div>
            )}

              {/* Confirm Button for New Project */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleConfirmClick}
                  disabled={extractedRequirements.length === 0}
                  className={`${themeClasses.bgPrimary} ${themeClasses.hoverPrimary} text-white`}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Подтвердить параметры
                </Button>
              </div>
            </CardContent>
        </Card>
      </div>
      
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение параметров</AlertDialogTitle>
            <AlertDialogDescription>
              Нажав эту кнопку вы больше не сможете менять параметры для проверки. Убедитесь, что все параметры включены корректно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 py-4">
            <Checkbox 
              id="dont-show-again" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label htmlFor="dont-show-again" className="text-sm">
              Не показывать это больше
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmDialogCancel}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDialogProceed}>
              Данные корректны
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}
    </div>
  );
}