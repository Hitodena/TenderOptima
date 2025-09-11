import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus, Edit, Edit3, Trash2, ArrowLeft, Save, AlertCircle, FileText, Info, X, Check } from 'lucide-react';
import { apiRequest } from '../lib/api-client';
import { toast } from '@/hooks/use-toast';
import { DocumentViewer } from './DocumentViewer';

interface AnalysisWorkspaceProps {
  mode: 'technical' | 'parameter';
}

interface Project {
  id: number;
  procedure_name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Requirement {
  id: number;
  serialNumber: number;
  techSpecNumber: string;
  extractedValue: string;
  confidence: number;
  isApproved: boolean;
  section_number?: string;
  section_title?: string;
  fullSectionPath?: string;
  page_reference?: string;
  file_reference?: string;
}

interface RequirementSection {
  id: number;
  sectionNumber: string;
  sectionTitle: string;
  parentSectionId?: number;
  orderIndex: number;
  parameters: Requirement[];
}

interface SectionedRequirements {
  section_number: string;
  section_title: string;
  requirements: Requirement[];
}

interface UploadedFile {
  id: number;
  name?: string;
  filename?: string;
  original_name?: string;
  file_size?: number;
  created_at?: string;
}

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

const AnalysisWorkspace: React.FC<AnalysisWorkspaceProps> = ({ mode }) => {
  const [location, setLocation] = useLocation();
  const params = useParams();
  
  // Extract project ID with fallback logic
  let projectId = params.projectId;
  if (!projectId) {
    // Fallback: extract from URL path manually
    const pathSegments = location.split('/');
    const technicalIndex = pathSegments.indexOf('technical');
    if (technicalIndex !== -1 && pathSegments[technicalIndex + 1]) {
      projectId = pathSegments[technicalIndex + 1];
    }
  }
  
  const [project, setProject] = useState<Project | null>(null);
  
  // Debug project ID extraction
  console.log('[AnalysisWorkspace] Location:', location);
  console.log('[AnalysisWorkspace] Params:', params);
  console.log('[AnalysisWorkspace] Project ID:', projectId);
  
  // Check URL for tab parameter, default to requirements
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const initialTab = urlParams.get('tab') || 'requirements';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [procedureName, setProcedureName] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [sectionedRequirements, setSectionedRequirements] = useState<SectionedRequirements[]>([]);
  const [showSectionedView, setShowSectionedView] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEditingActive, setIsEditingActive] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [completedRequests, setCompletedRequests] = useState<Project[]>([]);
  const [isRequestCompleted, setIsRequestCompleted] = useState(false);
  const editingRowRef = useRef<HTMLTableRowElement>(null);
  
  // Supplier management state
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierFiles, setSupplierFiles] = useState<any[]>([]);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [extractedParameters, setExtractedParameters] = useState<any[]>([]);
  const [showComplianceAnalysis, setShowComplianceAnalysis] = useState(false);
  const [complianceResults, setComplianceResults] = useState<any[]>([]);
  const [isGeneratingCompliance, setIsGeneratingCompliance] = useState(false);
  const [complianceResultsLoaded, setComplianceResultsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Split-screen document viewer state
  const [isSplitViewActive, setIsSplitViewActive] = useState(false);
  const [documentViewerUrl, setDocumentViewerUrl] = useState('');
  const [documentViewerFileName, setDocumentViewerFileName] = useState('');
  const [documentViewerSupplierName, setDocumentViewerSupplierName] = useState('');
  const [documentViewerTargetPage, setDocumentViewerTargetPage] = useState<number | undefined>();
  const [documentViewerSearchTerm, setDocumentViewerSearchTerm] = useState<string | undefined>();
  const [leftPanelWidth, setLeftPanelWidth] = useState(40); // Percentage width for left panel (60-40 split)
  const [isResizing, setIsResizing] = useState(false);

  // Resizer handlers - rebuilt for proper functionality
  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleResizerMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const container = document.querySelector('.split-view-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX;
    
    // Calculate new width percentage based on mouse position
    const newLeftPanelWidth = ((mouseX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain between 20% and 80% for better usability
    const constrainedWidth = Math.min(Math.max(newLeftPanelWidth, 20), 80);
    setLeftPanelWidth(constrainedWidth);
  }, [isResizing]);

  const handleResizerMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Add mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizerMouseMove);
      document.addEventListener('mouseup', handleResizerMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleResizerMouseMove);
        document.removeEventListener('mouseup', handleResizerMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizerMouseMove, handleResizerMouseUp]);

  // Function to handle supplier document link clicks - activate split-screen view with page targeting
  const handleSupplierDocumentClick = async (supplierId: number, supplierName: string, requirementText?: string, fileReference?: string) => {
    try {
      // Get supplier files
      const response = await apiRequest(`/api/analysis-projects/suppliers/${supplierId}/files`);

      if (response && (response as any).files && (response as any).files.length > 0) {
        const firstFile = (response as any).files[0];
        const documentUrl = `/api/analysis-projects/suppliers/${supplierId}/files/${firstFile.id}/view`;
        
        // Extract page number from fileReference if available
        let targetPage: number | undefined = undefined;
        if (fileReference) {
          // Look for patterns like "стр. 5", "страница 3", "page 7", "p. 2"
          const pageMatch = fileReference.match(/(?:стр\.?|страниц[ае]|page|p\.?)\s*(\d+)/i);
          if (pageMatch) {
            targetPage = parseInt(pageMatch[1]);
          }
        }
        
        setDocumentViewerUrl(documentUrl);
        setDocumentViewerFileName(firstFile.original_name || firstFile.filename);
        setDocumentViewerSupplierName(supplierName);
        setDocumentViewerSearchTerm(requirementText);
        setDocumentViewerTargetPage(targetPage);
        setIsSplitViewActive(true);
        setLeftPanelWidth(40); // Make left panel narrower when document is open
        
        // Show success message with page info
        if (targetPage) {
          toast({
            title: "Документ открыт",
            description: `Переход к странице ${targetPage} документа ${firstFile.original_name || firstFile.filename}`,
          });
        }
      } else {
        toast({
          title: "Документ не найден",
          description: `У поставщика ${supplierName} нет загруженных документов`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading supplier document:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось открыть документ поставщика",
        variant: "destructive"
      });
    }
  };

  // Function to close split-screen view
  const closeSplitView = () => {
    setIsSplitViewActive(false);
    setLeftPanelWidth(60); // Reset to default width
    setDocumentViewerUrl('');
    setDocumentViewerFileName('');
    setDocumentViewerSupplierName('');
    setDocumentViewerSearchTerm(undefined);
    setDocumentViewerTargetPage(undefined);
  };

  const themeClasses = mode === 'technical' 
    ? {
        bgAccent: 'bg-cyan-50',
        textAccent: 'text-cyan-600',
        borderColor: 'border-cyan-200',
        bgMain: 'bg-cyan-600',
        textMain: 'text-gray-900',
        bgBackground: 'bg-gray-50',
        textPrimary: 'text-cyan-900',
        buttonSecondary: 'bg-cyan-600 hover:bg-cyan-700 text-white',
        buttonPrimary: 'bg-cyan-600 hover:bg-cyan-700 text-white',
        backgroundLight: 'bg-cyan-50'
      }
    : {
        bgAccent: 'bg-blue-50',
        textAccent: 'text-blue-600',
        borderColor: 'border-blue-200',
        bgMain: 'bg-blue-600',
        textMain: 'text-gray-900',
        bgBackground: 'bg-gray-50',
        textPrimary: 'text-blue-900',
        buttonSecondary: 'bg-blue-600 hover:bg-blue-700 text-white',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
        backgroundLight: 'bg-blue-50'
      };

  // Load project data and handle URL tab parameter
  useEffect(() => {
    if (projectId) {
      loadProjectData();
      
      // Check for tab parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && ['requirements', 'suppliers', 'parameters'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, [projectId]);

  // Handle click outside to close edit dialog
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingIndex !== null && editingRowRef.current) {
        const target = event.target as Element;
        // Don't close if clicking on input fields or save button
        if (!editingRowRef.current.contains(target)) {
          setEditingIndex(null);
        }
      }
    };

    if (editingIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [editingIndex]);

  const loadProjectData = async () => {
    if (!projectId) return;

    try {
      const data = await apiRequest(`/api/analysis-projects/${projectId}`, 'GET') as any;
      console.log(`[AnalysisWorkspace] Loaded project data for ID ${projectId}:`, data.project);
      if (data.project) {
        setProject(data.project);
        setProcedureName(data.project.procedure_name || '');
        setDescription(data.project.description || '');
        console.log(`[AnalysisWorkspace] Set procedure_name: "${data.project.procedure_name}", description: "${data.project.description}"`);
      }
      
      // Load requirements, files, suppliers, and saved compliance results in parallel
      await Promise.all([
        loadRequirements(),
        loadFiles(),
        loadSuppliers()
      ]);
      
      // Load compliance results separately to ensure they're available for parameter extraction tab
      await loadSavedComplianceResults();
    } catch (error) {
      console.error('Error loading project data:', error);
    }
  };

  const loadRequirements = async () => {
    if (!projectId) return;
    
    try {
      // Try to load sectioned requirements first
      await loadSectionedRequirements();
      
      // Enable sectioned view after all data is loaded
      setTimeout(() => {
        console.log('Final check - sectioned requirements:', sectionedRequirements.length);
        if (sectionedRequirements.length > 0) {
          console.log('*** FINAL ENABLE SECTIONED VIEW ***');
          setShowSectionedView(true);
        }
      }, 200);
      
      // Also load the traditional flat requirements for backward compatibility
      const data = await apiRequest(`/api/analysis-projects/${projectId}/extracted-requirements`, 'GET') as any;
      console.log('Loaded requirements data:', data);
      
      if (data.requirements && Array.isArray(data.requirements)) {
        const mappedRequirements = data.requirements.map((req: any, index: number) => ({
          id: req.id,
          serialNumber: req.serial_number || index + 1,
          techSpecNumber: req.techSpecNumber || req.tech_spec_number || '',
          extractedValue: req.extractedValue || req.extracted_value || '',
          confidence: parseFloat(req.confidence) || 1,
          isApproved: req.isApproved || req.is_approved || false,
          section_number: req.section_number,
          section_title: req.section_title,
          fullSectionPath: req.full_section_path
        }));
        
        console.log('Mapped requirements:', mappedRequirements);
        setRequirements(mappedRequirements);
      } else {
        console.log('No requirements found in response');
        setRequirements([]);
      }
    } catch (error) {
      console.error('Error loading requirements:', error);
      setRequirements([]);
    }
  };

  const loadSectionedRequirements = async () => {
    if (!projectId) return;
    
    try {
      const data = await apiRequest(`/api/analysis-projects/${projectId}/requirements-by-section`, 'GET') as any;
      console.log('Loaded sectioned requirements:', data);
      
      if (data.sections && Array.isArray(data.sections)) {
        // Convert API response to expected format
        const convertedSections = data.sections.map((section: any) => ({
          section_number: section.section_number,
          section_title: section.section_title || `Раздел ${section.section_number}`,
          requirements: section.requirements.map((req: any) => ({
            id: req.id,
            serialNumber: req.serialNumber,
            techSpecNumber: req.techSpecNumber,
            extractedValue: req.extractedValue,
            confidence: req.confidence,
            isApproved: req.isApproved,
            pageReference: req.pageReference,
            fileReference: req.fileReference
          }))
        }));
        
        console.log('Converted sections:', convertedSections);
        
        setSectionedRequirements(convertedSections);
        
        // Auto-expand all sections initially
        const allSectionNumbers = new Set(convertedSections.map((section: any) => section.section_number));
        setExpandedSections(allSectionNumbers as Set<string>);
        
        // Force enable sectioned view when we have section data
        if (convertedSections.length > 0) {
          console.log('*** ENABLING SECTIONED VIEW with', convertedSections.length, 'sections ***');
          setShowSectionedView(true);
          
          // Force state update with a brief delay to ensure re-render
          setTimeout(() => {
            console.log('*** FORCE UPDATING SECTIONED VIEW STATE ***');
            setShowSectionedView(true);
          }, 50);
        } else {
          console.log('No sectioned data found, using flat view');
          setShowSectionedView(false);
        }
      } else {
        setShowSectionedView(false);
      }
    } catch (error) {
      console.error('Error loading sectioned requirements:', error);
      setShowSectionedView(false);
    }
  };

  const loadFiles = async () => {
    if (!projectId) return;
    
    try {
      const data = await apiRequest(`/api/analysis-projects/${projectId}/files`, 'GET') as any;
      if (data.files && Array.isArray(data.files)) {
        setUploadedFiles(data.files);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const loadSuppliers = async () => {
    if (!projectId) return;
    
    try {
      const data = await apiRequest(`/api/analysis-projects/${projectId}/suppliers`, 'GET') as any;
      if (data.suppliers && Array.isArray(data.suppliers)) {
        setSuppliers(data.suppliers);
        // Auto-select first supplier if none selected
        if (data.suppliers.length > 0 && !selectedSupplier) {
          setSelectedSupplier(data.suppliers[0]);
          loadSupplierFiles(data.suppliers[0].id);
          loadExtractedParameters(data.suppliers[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadSavedComplianceResults = async () => {
    if (!projectId) return;
    
    try {
      console.log('[Analysis] Loading saved compliance results for project', projectId);
      const data = await apiRequest(`/api/analysis-projects/${projectId}/compliance-results`, 'GET') as any;
      
      if (data.results && Array.isArray(data.results) && data.results.length > 0) {
        // Clear existing results first to prevent duplicates
        setComplianceResults([]);
        
        // Ensure recommendations and gapsIdentified are arrays
        const normalizedResults = data.results.map((result: any) => ({
          ...result,
          analysis: {
            ...result.analysis,
            recommendations: Array.isArray(result.analysis.recommendations) 
              ? result.analysis.recommendations 
              : (result.analysis.recommendations ? [result.analysis.recommendations] : []),
            gapsIdentified: Array.isArray(result.analysis.gapsIdentified) 
              ? result.analysis.gapsIdentified 
              : (result.analysis.gapsIdentified ? [result.analysis.gapsIdentified] : [])
          },
          supplierName: result.supplier?.name || result.supplierName || 'Неизвестный поставщик'
        }));
        
        // Deduplicate results by supplier ID
        const deduplicatedResults = normalizedResults.filter((result, index, self) => 
          index === self.findIndex(r => r.supplier.id === result.supplier.id)
        );
        
        setComplianceResults(deduplicatedResults);
        setShowComplianceAnalysis(true);
        console.log(`[Analysis] Loaded ${deduplicatedResults.length} saved compliance results`);
      } else {
        console.log('[Analysis] No saved compliance results found');
        setComplianceResults([]);
      }
      
      setComplianceResultsLoaded(true);
    } catch (error) {
      console.error('Error loading saved compliance results:', error);
      setComplianceResultsLoaded(true);
      setComplianceResults([]);
    }
  };

  const saveProjectDetails = async () => {
    if (!projectId) return;

    try {
      const data = await apiRequest(`/api/analysis-projects/${projectId}`, 'PUT', {
        procedure_name: procedureName,
        description: description
      });
      console.log('Project details saved successfully');
    } catch (error) {
      console.error('Error saving project details:', error);
    }
  };

  // Save project field immediately when changed
  const saveProjectField = async (field: string, value: string) => {
    if (!projectId) return;
    
    try {
      const updateData = { [field]: value };
      await apiRequest(`/api/analysis-projects/${projectId}`, 'PUT', updateData);
    } catch (error) {
      console.error(`Error saving ${field}:`, error);
    }
  };

  const handleBackToDashboard = () => {
    setLocation(mode === 'technical' ? '/analyze/technical' : '/analyze/parameters');
  };

  const handleProceedToSuppliers = () => {
    setLocation(`/analyze/technical/${projectId}/offers`);
  };

  const addNewRequirement = () => {
    const newReq: Requirement = {
      id: Date.now(), // Temporary ID
      serialNumber: requirements.length + 1,
      techSpecNumber: '',
      extractedValue: '',
      confidence: 0.8,
      isApproved: false
    };
    setRequirements([...requirements, newReq]);
    setEditingIndex(requirements.length);
  };

  const updateRequirement = (index: number, field: keyof Requirement, value: string | number | boolean) => {
    const updated = [...requirements];
    updated[index] = { ...updated[index], [field]: value };
    setRequirements(updated);
  };

  const deleteRequirement = async (index: number) => {
    const requirement = requirements[index];
    if (!requirement.id || !projectId) {
      // If no ID, just remove from local state
      setRequirements(requirements.filter((_, i) => i !== index));
      if (editingIndex === index) {
        setEditingIndex(null);
      }
      return;
    }

    try {
      const response = await apiRequest(`/api/analysis-projects/${projectId}/extracted-requirements/${requirement.id}`, 'DELETE');
      
      if (response.success) {
        // Update local state immediately
        const updatedRequirements = requirements.filter((_, i) => i !== index);
        setRequirements(updatedRequirements);
        
        // Also update sectioned requirements if they exist
        if (sectionedRequirements.length > 0) {
          const updatedSectioned = sectionedRequirements.map(section => ({
            ...section,
            requirements: section.requirements.filter(req => req.id !== requirement.id)
          })).filter(section => section.requirements.length > 0);
          setSectionedRequirements(updatedSectioned);
        }
        
        if (editingIndex === index) {
          setEditingIndex(null);
        }
        
        toast({
          title: "Параметр удален",
          description: "Параметр успешно удален",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error deleting requirement:', error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить параметр",
        variant: "destructive"
      });
    }
  };

  const saveRequirement = async (index: number) => {
    const requirement = requirements[index];
    
    if (!requirement.techSpecNumber.trim() || !requirement.extractedValue.trim()) {
      toast({
        title: "Заполните поля",
        description: "Укажите номер спецификации и значение параметра",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Saving requirement:', requirement);
      console.log('Project ID:', projectId);
      
      // Always use the working POST method to requirements endpoint (same as Screen 2)
      const response = await fetch(`/api/analysis-projects/${projectId}/requirements`, {
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
      setIsEditingActive(false);
      toast({
        title: "Параметр сохранен",
        description: "Требование успешно сохранено"
      });

      // Auto-refresh compliance analysis after parameter change
      if (complianceResults.length > 0) {
        console.log('[Analysis] Triggering auto-refresh after parameter change');
        await refreshComplianceAnalysis();
      }
    } catch (error) {
      console.error('Error saving requirement:', error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить параметр",
        variant: "destructive"
      });
    }
  };

  const [isExtracting, setIsExtracting] = useState(false);

  // Section management helper functions
  const toggleSectionExpansion = (sectionNumber: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionNumber)) {
      newExpanded.delete(sectionNumber);
    } else {
      newExpanded.add(sectionNumber);
    }
    setExpandedSections(newExpanded);
  };

  const expandAllSections = () => {
    const allSectionNumbers = new Set(sectionedRequirements.map(section => section.section_number));
    setExpandedSections(allSectionNumbers);
  };

  const collapseAllSections = () => {
    setExpandedSections(new Set());
  };

  const extractParameters = async () => {
    if (!projectId || uploadedFiles.length === 0) {
      toast({
        title: "Нет файлов",
        description: "Сначала загрузите файлы для анализа",
        variant: "destructive"
      });
      return;
    }

    setIsExtracting(true);
    console.log('Starting parameter extraction for project:', projectId);

    try {
      const response = await fetch(`/api/analysis-projects/${projectId}/extract-parameters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
        setRequirements(newRequirements);
        
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

  const handleOriginalFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      // Use fetch directly for file uploads
      const response = await fetch(`/api/analysis-projects/${projectId}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Файлы загружены',
          description: `Загружено ${data.files?.length || 0} файлов`
        });
        loadFiles();
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить файлы',
        variant: 'destructive'
      });
    }
  };

  const deleteOriginalFile = async (fileId: number) => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/analysis-projects/${projectId}/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setUploadedFiles(uploadedFiles.filter(f => f.id !== fileId));
        toast({
          title: "Файл удален",
          description: "Файл успешно удален",
          variant: "default"
        });
        // Don't reload files as this causes the file to reappear
        // The local state is already updated correctly
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить файл",
        variant: "destructive"
      });
    }
  };

  // Supplier management functions
  const addSupplier = async () => {
    if (!newSupplierName.trim() || !projectId) return;

    // Prevent duplicate requests by checking if already adding
    const addButton = document.querySelector('[data-add-supplier-btn]') as HTMLButtonElement;
    if (addButton?.disabled) return;
    
    // Disable button to prevent duplicates
    if (addButton) addButton.disabled = true;

    try {
      console.log('[AddSupplier] Button clicked, checking conditions...');
      console.log('[AddSupplier] newSupplierName:', newSupplierName.trim());
      console.log('[AddSupplier] project.id:', projectId);
      console.log('[AddSupplier] Starting API request...');

      const response = await fetch(`/api/analysis-projects/${projectId}/suppliers`, {
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
        
        if (data.supplier) {
          setSuppliers([...suppliers, data.supplier]);
          setNewSupplierName('');
          setShowAddSupplier(false);
          
          // Auto-select the newly created supplier and load their files immediately
          setSelectedSupplier(data.supplier);
          if (data.supplier.id) {
            loadSupplierFiles(data.supplier.id);
            loadExtractedParameters(data.supplier.id);
          }
          
          toast({
            title: "Поставщик добавлен",
            description: `${data.supplier.name} выбран для загрузки файлов`,
          });
        }
      } else {
        throw new Error('Failed to add supplier');
      }
    } catch (error) {
      console.error('Error adding supplier:', error);
      toast({
        title: "Ошибка добавления поставщика",
        description: "Попробуйте ещё раз",
        variant: "destructive"
      });
    } finally {
      // Re-enable button
      if (addButton) addButton.disabled = false;
    }
  };

  const loadSupplierFiles = async (supplierId: number) => {
    if (!projectId) return;

    try {
      const response = await apiRequest(`/api/analysis-projects/suppliers/${supplierId}/files`, 'GET');
      console.log('Loaded supplier files response:', response);
      console.log('Supplier files data:', response.files);
      
      if (response && response.files && Array.isArray(response.files)) {
        console.log('Setting supplier files:', response.files);
        setSupplierFiles(response.files);
      } else {
        console.log('No files found in response, setting empty array');
        setSupplierFiles([]);
      }
    } catch (error) {
      console.error('Error loading supplier files:', error);
      setSupplierFiles([]);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!selectedSupplier || !projectId || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch(`/api/analysis-projects/${projectId}/suppliers/${selectedSupplier.id}/files`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[FileUpload] Upload response:', result);
        
        if (result.files) {
          // Reload supplier files to get the updated list
          await loadSupplierFiles(selectedSupplier.id);
          toast({
            title: "Файлы загружены",
            description: `Загружено ${result.files.length} файлов для ${selectedSupplier.name}`,
            variant: "default"
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить файлы",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (fileId: number) => {
    if (!selectedSupplier || !projectId) return;

    try {
      // Use the correct API route pattern
      const response = await fetch(`/api/analysis-projects/suppliers/${selectedSupplier.id}/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        // Remove file from local state immediately
        setSupplierFiles(supplierFiles.filter(f => f.id !== fileId));
        toast({
          title: "Файл удален",
          description: "Файл успешно удален",
          variant: "default"
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить файл",
        variant: "destructive"
      });
    }
  };

  const deleteSupplierFile = async (fileId: number) => {
    if (!selectedSupplier || !projectId) return;

    try {
      const response = await fetch(`/api/analysis-projects/suppliers/${selectedSupplier.id}/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        // Remove file from local state immediately
        setSupplierFiles(supplierFiles.filter(f => f.id !== fileId));
        toast({
          title: "Файл удален",
          description: "Файл поставщика успешно удален",
          variant: "default"
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting supplier file:', error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить файл поставщика",
        variant: "destructive"
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const extractSupplierParameters = async () => {
    if (!selectedSupplier || !projectId || supplierFiles.length === 0) return;

    setIsAnalyzing(true);
    try {
      const response = await apiRequest(`/api/analysis-projects/${projectId}/suppliers/${selectedSupplier.id}/extract-parameters`, 'POST');

      if (response.success && response.parameters) {
        // Save extracted parameters to database
        await saveExtractedParameters(response.parameters);
        
        // Update local state
        setExtractedParameters(response.parameters);
        
        toast({
          title: "Параметры извлечены",
          description: `Извлечено ${response.parameters.length} параметров`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error extracting parameters:', error);
      toast({
        title: "Ошибка извлечения",
        description: "Не удалось извлечь параметры",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveExtractedParameters = async (parameters: any[]) => {
    if (!selectedSupplier) return;

    try {
      await fetch(`/api/analysis-projects/suppliers/${selectedSupplier.id}/save-extracted-parameters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ parameters })
      });
    } catch (error) {
      console.error('Error saving extracted parameters:', error);
    }
  };

  const loadExtractedParameters = async (supplierId: number) => {
    try {
      const response = await fetch(`/api/analysis-projects/suppliers/${supplierId}/extracted-parameters`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Transform database format to component format
        const transformedParameters = (data.parameters || []).map((param: any) => ({
          name: param.parameter_name,
          value: param.parameter_value,
          confidence: parseFloat(param.confidence) || 0.8
        }));
        setExtractedParameters(transformedParameters);
      }
    } catch (error) {
      console.error('Error loading extracted parameters:', error);
    }
  };

  const exportAnalysis = async (format: 'excel' | 'pdf', supplierId: number) => {
    if (!projectId) return;

    try {
      const response = await fetch(
        `/api/analysis-projects/${projectId}/export/${supplierId}?format=${format}`,
        {
          credentials: 'include'
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        const supplier = suppliers.find(s => s.id === supplierId);
        const fileName = `compliance-analysis-${supplier?.name || 'supplier'}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
        a.download = fileName;
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Экспорт завершен",
          description: `Файл ${fileName} загружен`,
          variant: "default"
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Error exporting analysis:', error);
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось экспортировать результаты анализа",
        variant: "destructive"
      });
    }
  };

  const startComplianceAnalysis = async () => {
    setShowComplianceAnalysis(true);
    await generateComplianceAnalysis();
  };

  const generateComplianceAnalysis = async () => {
    if (!projectId || suppliers.length === 0) return;

    setIsGeneratingCompliance(true);
    setComplianceResultsLoaded(false);
    // Clear previous results immediately to show loading state
    setComplianceResults([]);
    const results = [];

    try {
      for (const supplier of suppliers) {
        try {
          const response = await fetch(`/api/analysis-projects/${projectId}/compliance/${supplier.id}?regenerate=true`, {
            method: 'POST',
            credentials: 'include'
          });

          const data = await response.json();
          
          if (response.ok && data.analysis) {
            results.push({
              supplier,
              analysis: data.analysis
            });
            console.log(`Analysis completed for supplier ${supplier.name}:`, data.analysis);
          } else {
            console.error(`Analysis failed for supplier ${supplier.name}:`, data);
          }
        } catch (supplierError) {
          console.error(`Error analyzing supplier ${supplier.name}:`, {
            error: supplierError instanceof Error ? supplierError.message : String(supplierError),
            stack: supplierError instanceof Error ? supplierError.stack : undefined,
            supplier: supplier.name
          });
        }
      }

      if (results.length > 0) {
        // Deduplicate results by supplier ID before setting
        const deduplicatedResults = results.filter((result, index, self) => 
          index === self.findIndex(r => r.supplier.id === result.supplier.id)
        );
        
        setComplianceResults(deduplicatedResults);
        setComplianceResultsLoaded(true);
        toast({
          title: "Анализ завершен",
          description: `Проанализировано ${deduplicatedResults.length} поставщиков`,
          variant: "default"
        });
      } else {
        toast({
          title: "Анализ не удался",
          description: "Не удалось проанализировать ни одного поставщика",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error generating compliance analysis:', error);
      toast({
        title: "Ошибка анализа",
        description: "Не удалось выполнить анализ соответствия",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingCompliance(false);
      setComplianceResultsLoaded(true);
    }
  };

  // Auto-refresh compliance analysis when parameters change
  const refreshComplianceAnalysis = async () => {
    if (!projectId || suppliers.length === 0 || complianceResults.length === 0) return;

    console.log('[Analysis] Auto-refreshing compliance analysis after parameter change');
    
    const results = [];
    try {
      for (const supplier of suppliers) {
        try {
          const response = await fetch(`/api/analysis-projects/${projectId}/compliance/${supplier.id}?regenerate=true`, {
            method: 'POST',
            credentials: 'include'
          });

          const data = await response.json();
          
          if (response.ok && data.analysis) {
            results.push({
              supplier,
              analysis: data.analysis
            });
          }
        } catch (supplierError) {
          console.error(`Error refreshing analysis for supplier ${supplier.name}:`, supplierError);
        }
      }

      if (results.length > 0) {
        // Deduplicate results by supplier ID before setting
        const deduplicatedResults = results.filter((result, index, self) => 
          index === self.findIndex(r => r.supplier.id === result.supplier.id)
        );
        
        setComplianceResults(deduplicatedResults);
        console.log('[Analysis] Compliance analysis automatically updated');
      }
    } catch (error) {
      console.error('Error refreshing compliance analysis:', error);
    }
  };



  // Helper functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  // Complete current request function
  const completeCurrentRequest = async () => {
    try {
      const response = await fetch(`/api/analysis-projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed' })
      });

      if (response.ok) {
        setIsRequestCompleted(true);
        // Add current project to completed requests
        if (project) {
          const completedProject = { ...project, status: 'completed' };
          setCompletedRequests(prev => [...prev, completedProject]);
        }
        
        toast({
          title: "Запрос завершен",
          description: "Запрос перенесен в раздел \"Завершенные запросы\""
        });
      }
    } catch (error) {
      console.error('Error completing request:', error);
      toast({
        title: "Ошибка завершения",
        description: "Не удалось завершить запрос",
        variant: "destructive"
      });
    }
  };

  // Activate completed request function
  const activateRequest = async (requestId: number) => {
    try {
      const response = await fetch(`/api/analysis-projects/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status: 'in_progress' })
      });

      if (response.ok) {
        // Remove from completed requests
        setCompletedRequests(prev => prev.filter(req => req.id !== requestId));
        
        // If it's the current project, mark as active
        if (requestId === parseInt(projectId || '0')) {
          setIsRequestCompleted(false);
        }
        
        toast({
          title: "Запрос активирован",
          description: "Запрос перенесен в раздел \"Активные запросы\""
        });
      }
    } catch (error) {
      console.error('Error activating request:', error);
      toast({
        title: "Ошибка активации",
        description: "Не удалось активировать запрос",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={`${isSplitViewActive ? 'h-screen bg-gray-50' : 'min-h-screen bg-gray-50'}`}>
      <div className={`${isSplitViewActive ? 'flex h-full split-view-container' : 'max-w-7xl mx-auto px-4 py-6'}`}>
        {/* Left Panel - Main Content */}
        <div 
          className={`${isSplitViewActive ? 'overflow-y-auto border-r border-gray-300' : 'w-full'}`}
          style={isSplitViewActive ? { width: `${leftPanelWidth}%` } : {}}
        >
          <div className={`${isSplitViewActive ? 'px-4 py-6' : ''}`}>
            {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              onClick={handleBackToDashboard}
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>К списку запросов</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {project?.procedure_name || 'Загрузка...'}
              </h1>
              <p className="text-gray-600">{project?.description}</p>
            </div>
          </div>

        </div>



        {/* Tab Navigation Menu */}
        <div className="mb-6">
          <div className={`flex space-x-1 bg-gray-100 p-1 rounded-lg ${isEditingActive ? 'opacity-50 pointer-events-none' : ''}`}>
            <button
              onClick={() => isEditingActive ? null : setActiveTab('requirements')}
              disabled={isEditingActive}
              className={`flex-1 text-center px-4 py-2 font-medium rounded-md transition-all ${
                activeTab === 'requirements'
                  ? 'bg-white shadow-sm text-cyan-600'
                  : isEditingActive
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Технические требования
            </button>
            {!isSplitViewActive && (
              <button
                onClick={() => isEditingActive ? null : setActiveTab('suppliers')}
                disabled={isEditingActive}
                className={`flex-1 text-center px-4 py-2 font-medium rounded-md transition-all ${
                  activeTab === 'suppliers'
                    ? 'bg-white shadow-sm text-cyan-600'
                    : isEditingActive
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Поставщики ({suppliers.length})
              </button>
            )}
            <button
              onClick={() => (isEditingActive || requirements.length === 0 || suppliers.length === 0) ? null : setActiveTab('parameters')}
              disabled={isEditingActive || requirements.length === 0 || suppliers.length === 0}
              className={`${isSplitViewActive ? 'w-full' : 'flex-1'} text-center px-4 py-2 font-medium rounded-md transition-all ${
                activeTab === 'parameters'
                  ? 'bg-white shadow-sm text-cyan-600'
                  : (isEditingActive || requirements.length === 0 || suppliers.length === 0)
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Извлечение параметров
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="hidden">
            <TabsTrigger value="requirements">Технические требования</TabsTrigger>
            <TabsTrigger value="suppliers">Поставщики</TabsTrigger>
            <TabsTrigger value="parameters">Извлечение параметров</TabsTrigger>
          </TabsList>

          {/* Technical Requirements Tab */}
          <TabsContent value="requirements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    Название запроса:
                  </span>
                  <span className="text-sm text-gray-900 font-semibold">
                    {procedureName || 'Не указано'}
                  </span>
                </div>
                {/* Hidden description field - keep in code but hide from UI */}
                <div className="hidden">
                  <Label htmlFor="description">Описание (опционально)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      // Save immediately when user types
                      saveProjectField('description', e.target.value);
                    }}
                    placeholder="Краткое описание проекта"
                    className={`border-2 ${themeClasses.borderColor}`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Загруженные файлы</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Show only technical requirements files on screen 1 */}
                {uploadedFiles.length > 0 ? (
                  <div>
                    <h4 className="font-medium mb-3">Загруженные файлы:</h4>
                    <div className="space-y-2">
                      {/* Show only original requirement files */}
                      {uploadedFiles.map((file) => (
                        <div key={`req-${file.id}`} className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-green-100 rounded-md">
                              <FileText className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{file.name || file.original_name || file.filename || 'Файл'}</p>
                              <p className="text-sm text-green-600">
                                Техническое задание • {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'Размер неизвестен'} • {file.created_at ? new Date(file.created_at).toLocaleDateString('ru-RU') : 'Дата неизвестна'}
                              </p>
                            </div>
                          </div>
                          {/* Hide delete button but keep it in code */}
                          <Button
                            onClick={() => deleteOriginalFile(file.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 hidden"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Файлы не загружены</p>
                    <p className="text-sm text-gray-400">Загрузите файлы технических требований</p>
                  </div>
                )}

              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Извлеченные параметры
                  <div className="flex space-x-2">
                    <Button
                      onClick={extractParameters}
                      disabled={uploadedFiles.length === 0 || isExtracting}
                      className={`${themeClasses.bgMain} text-white hover:opacity-90 hidden`}
                    >
                      {isExtracting ? 'Извлечение...' : 'Извлечь параметры'}
                    </Button>
                    <Button
                      onClick={addNewRequirement}
                      variant="outline"
                      size="sm"
                      className={`${themeClasses.borderColor} ${themeClasses.textAccent} hover:${themeClasses.bgAccent} hidden`}
                    >
                      <Plus className="h-4 w-4 mr-2 " />
                      Добавить параметр
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Display sections directly without toggle button */}
                {(sectionedRequirements.length > 0 || requirements.length > 0) && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      {showSectionedView && sectionedRequirements.length > 0 && (
                        <div className="flex space-x-2">
                          <Button
                            onClick={expandAllSections}
                            variant="ghost"
                            size="sm"
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Развернуть все
                          </Button>
                          <Button
                            onClick={collapseAllSections}
                            variant="ghost"
                            size="sm"
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Свернуть все
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section-based display */}
                {showSectionedView && sectionedRequirements.length > 0 ? (
                  <div className="space-y-4">
                    {sectionedRequirements.map((section) => (
                      <div key={section.section_number} className={`border ${themeClasses.borderColor} rounded-lg overflow-hidden`}>
                        {/* Unified Section header with light blue background */}
                        <div
                          className="bg-cyan-400 px-4 py-3 cursor-pointer hover:bg-cyan-500 transition-colors"
                          onClick={() => toggleSectionExpansion(section.section_number)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                                <span className="text-white text-sm font-medium">
                                  {expandedSections.has(section.section_number) ? '−' : '+'}
                                </span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-white">
                                  Раздел {section.section_number} - {section.section_title || `Раздел ${section.section_number}`}
                                </h3>
                              </div>
                            </div>
                            <div className="text-sm text-white text-opacity-90">
                              {section.requirements.length} параметр{section.requirements.length === 1 ? '' : section.requirements.length < 5 ? 'а' : 'ов'}
                            </div>
                          </div>
                        </div>

                        {/* Section content */}
                        {expandedSections.has(section.section_number) && (
                          <div className="bg-white">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">№</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Номер спецификации</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Значение</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ссылка</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Действия</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white">
                                {section.requirements
                                  .sort((a, b) => {
                                    // Sort by tech spec number numerically (e.g., 3/1, 3/2, 3/10, 3/11)
                                    const aParts = a.techSpecNumber.split('/').map(n => parseInt(n) || 0);
                                    const bParts = b.techSpecNumber.split('/').map(n => parseInt(n) || 0);
                                    
                                    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                                      const aVal = aParts[i] || 0;
                                      const bVal = bParts[i] || 0;
                                      if (aVal !== bVal) return aVal - bVal;
                                    }
                                    return 0;
                                  })
                                  .map((req, reqIndex) => {
                                  // Find the global index for this requirement
                                  const globalIndex = requirements.findIndex(r => r.id === req.id);
                                  return (
                                    <tr 
                                      key={req.id} 
                                      className="border-t border-gray-200 hover:bg-gray-50"
                                      ref={editingIndex === globalIndex ? editingRowRef : null}
                                    >
                                      <td className="px-4 py-3 text-sm text-gray-600">
                                        {req.serialNumber}
                                      </td>
                                      <td className="px-4 py-3">
                                        {editingIndex === globalIndex ? (
                                          <Input
                                            value={req.techSpecNumber}
                                            onChange={(e) => updateRequirement(globalIndex, 'techSpecNumber', e.target.value)}
                                            placeholder="3.1"
                                            className="w-full"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                saveRequirement(globalIndex);
                                              } else if (e.key === 'Escape') {
                                                setEditingIndex(null);
                                              }
                                            }}
                                          />
                                        ) : (
                                          <span className="text-gray-900 font-medium">{req.techSpecNumber}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        {editingIndex === globalIndex ? (
                                          <Input
                                            value={req.extractedValue}
                                            onChange={(e) => updateRequirement(globalIndex, 'extractedValue', e.target.value)}
                                            placeholder="Значение параметра"
                                            className="w-full"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                saveRequirement(globalIndex);
                                              } else if (e.key === 'Escape') {
                                                setEditingIndex(null);
                                              }
                                            }}
                                          />
                                        ) : (
                                          <span className="text-gray-900">{req.extractedValue}</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        {req.file_reference ? (
                                          <Button
                                            onClick={() => {
                                              // Extract page number from file_reference (e.g., "стр. 5")
                                              const pageMatch = req.file_reference?.match(/\d+/);
                                              if (pageMatch && uploadedFiles.length > 0) {
                                                const pageNum = parseInt(pageMatch[0]);
                                                const firstFile = uploadedFiles[0];
                                                // Open document viewer with page navigation
                                                setDocumentViewerUrl(`/api/analysis-projects/${projectId}/files/${firstFile.id}/content`);
                                                setDocumentViewerFileName(firstFile.name || 'Документ');
                                                setDocumentViewerSupplierName('Техническое задание');
                                                setDocumentViewerTargetPage(pageNum);
                                                setIsSplitViewActive(true);
                                                setLeftPanelWidth(40);
                                              }
                                            }}
                                            variant="ghost"
                                            size="sm"
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 text-xs"
                                          >
                                            {req.file_reference}
                                          </Button>
                                        ) : (
                                          <span className="text-gray-400 text-xs">—</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center space-x-2">
                                          {editingIndex === globalIndex ? (
                                            <Button
                                              onClick={() => saveRequirement(globalIndex)}
                                              size="sm"
                                              variant="ghost"
                                              className="text-green-600 hover:bg-green-50 h-8 w-8 p-0"
                                            >
                                              <Check className="h-4 w-4" />
                                            </Button>
                                          ) : (
                                            <Button
                                              onClick={() => {
                                                setEditingIndex(globalIndex);
                                                setIsEditingActive(true);
                                              }}
                                              size="sm"
                                              variant="ghost"
                                              className="hover:bg-gray-50 h-8 w-8 p-0"
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                          )}
                                          <Button
                                            onClick={() => deleteRequirement(globalIndex)}
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Fallback to flat table view */
                  requirements.length > 0 ? (
                    <div className={`border ${themeClasses.borderColor} rounded-lg overflow-hidden`}>
                      <table className="w-full">
                        <thead className={`${themeClasses.bgBackground}`}>
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">№</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Номер спецификации</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Значение</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Ссылка</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requirements.map((req, index) => (
                            <tr 
                              key={req.id} 
                              className="border-t border-gray-200"
                              ref={editingIndex === index ? editingRowRef : null}
                            >
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {req.serialNumber}
                              </td>
                              <td className="px-4 py-3">
                                {editingIndex === index ? (
                                  <Input
                                    value={req.techSpecNumber}
                                    onChange={(e) => updateRequirement(index, 'techSpecNumber', e.target.value)}
                                    placeholder="2.1"
                                    className="w-full"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        saveRequirement(index);
                                      } else if (e.key === 'Escape') {
                                        setEditingIndex(null);
                                      }
                                    }}
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
                                    placeholder="Значение параметра"
                                    className="w-full"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        saveRequirement(index);
                                      } else if (e.key === 'Escape') {
                                        setEditingIndex(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className={themeClasses.textMain}>{req.extractedValue}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {req.file_reference ? (
                                  <Button
                                    onClick={() => {
                                      // Extract page number from file_reference (e.g., "стр. 5")
                                      const pageMatch = req.file_reference?.match(/\d+/);
                                      if (pageMatch && uploadedFiles.length > 0) {
                                        const pageNum = parseInt(pageMatch[0]);
                                        const firstFile = uploadedFiles[0];
                                        // Open document viewer with page navigation
                                        setDocumentViewerUrl(`/api/analysis-projects/${projectId}/files/${firstFile.id}/content`);
                                        setDocumentViewerFileName(firstFile.name || 'Документ');
                                        setDocumentViewerSupplierName('Техническое задание');
                                        setDocumentViewerTargetPage(pageNum);
                                        setIsSplitViewActive(true);
                                        setLeftPanelWidth(40);
                                      }
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 text-xs"
                                  >
                                    {req.file_reference}
                                  </Button>
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  {editingIndex === index ? (
                                    <Button
                                      onClick={() => saveRequirement(index)}
                                      size="sm"
                                      variant="ghost"
                                      className="text-green-600 hover:bg-green-50 h-8 w-8 p-0"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={() => {
                                        setEditingIndex(index);
                                        setIsEditingActive(true);
                                      }}
                                      size="sm"
                                    variant="ghost"
                                    className="text-gray-600 hover:text-gray-800"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  onClick={() => deleteRequirement(index)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>Параметры не извлечены</p>
                      <p className="text-sm">Загрузите файлы и нажмите "Извлечь параметры"</p>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suppliers Tab - Hidden when document viewer is active */}
          {!isSplitViewActive && (
            <TabsContent value="suppliers" className="space-y-6">
              <div className="flex gap-1 h-[calc(100vh-200px)]">
              {/* Left Panel - Suppliers List */}
              <Card className="w-80 min-w-80 max-w-80 flex-shrink-0">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className={themeClasses.textPrimary}>Поставщики</CardTitle>
                    
                  </div>
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
                            loadExtractedParameters(supplier.id);
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

                    {/* Analysis Start Button */}
                    {suppliers.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <Button
                          onClick={async () => {
                            if (projectId) {
                              console.log('[Analysis] Starting compliance analysis...');
                              // Switch to parameters tab and trigger compliance analysis
                              setActiveTab('parameters');
                              setShowComplianceAnalysis(true);
                              await generateComplianceAnalysis();
                            }
                          }}
                          className={`w-full ${themeClasses.buttonPrimary}`}
                          size="lg"
                          disabled={isGeneratingCompliance}
                        >
                          {isGeneratingCompliance ? 'Анализируем...' : 'Начать анализ'}
                        </Button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          Перейти к анализу соответствия
                        </p>
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
                          data-add-supplier-btn
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

              {/* Right Panel - File Upload for Selected Supplier */}
              <Card className="flex-1 min-w-0">
                <CardHeader className="flex flex-row items-center space-x-2">
                  <CardTitle className={themeClasses.textPrimary}>
                    {selectedSupplier ? `Файлы поставщика: ${selectedSupplier.name}` : 'Загрузка файлов'}
                  </CardTitle>
                  {selectedSupplier && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-6 w-6 rounded-full hover:bg-gray-100"
                      onClick={() => setShowInstructions(!showInstructions)}
                    >
                      <Info className="h-4 w-4 text-gray-500" />
                    </Button>
                  )}
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
                          onChange={(e) => {
                            if (e.target.files) {
                              handleFileUpload(e.target.files);
                            }
                          }}
                          multiple
                          accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.jpg,.jpeg,.png"
                          className="hidden"
                        />
                        {isUploading ? (
                          <div className="space-y-2">
                            <div className="h-8 w-8 animate-spin mx-auto border-2 border-cyan-600 border-t-transparent rounded-full" />
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

                      {/* Files List */}
                      <div className="space-y-3">
                        <h4 className="font-medium">Загруженные файлы ({supplierFiles.length})</h4>
                        {supplierFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-blue-100 rounded-md">
                                <FileText className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{file.original_name || file.filename}</p>
                                <p className="text-sm text-blue-600">
                                  Предложение поставщика • {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'Размер неизвестен'} • {file.created_at ? new Date(file.created_at).toLocaleDateString('ru-RU') : 'Недавно'}
                                </p>
                              </div>
                            </div>
                            {/* Show delete button for supplier files on screen 2 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => file.id && deleteSupplierFile(file.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
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

                      {/* Instructions popup for file upload */}
                      {showInstructions && (
                        <div className="mt-4 p-4 border rounded-lg bg-blue-50 border-blue-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-blue-900">Инструкции по загрузке файлов</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowInstructions(false)}
                              className="p-1 h-6 w-6"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-3">
                            <div className="p-3 bg-white rounded-lg">
                              <h5 className="font-medium text-green-900 mb-2">Загрузка файлов:</h5>
                              <ol className="text-sm text-green-800 space-y-1">
                                <li>• Перетащите файлы в область выше</li>
                                <li>• Или нажмите "выберите файлы" для выбора</li>
                                <li>• Поддерживаются: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG</li>
                                <li>• Файлы будут проанализированы для извлечения параметров</li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p className="mb-4">Выберите поставщика для загрузки файлов</p>
                      <p className="text-sm text-gray-400">
                        Добавьте поставщика с помощью кнопки "+" в левой панели
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            </TabsContent>
          )}

          {/* Parameters Tab */}
          <TabsContent value="parameters" className="space-y-6">
            {/* Show message if requirements or suppliers are missing */}
            {requirements.length === 0 || suppliers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="space-y-4">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Требуется подготовка данных
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {requirements.length === 0 
                        ? "Сначала извлеките технические требования в разделе 'Технические требования'"
                        : "Добавьте поставщиков в разделе 'Поставщики'"
                      }
                    </p>
                    <div className="text-sm text-gray-500">
                      <p>✓ Технические требования: {requirements.length > 0 ? `${requirements.length} извлечены` : 'Не извлечены'}</p>
                      <p>✓ Поставщики: {suppliers.length > 0 ? `${suppliers.length} добавлены` : 'Не добавлены'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Show compliance analysis results if available */}
                {showComplianceAnalysis && complianceResults.length > 0 ? (
                  <div className="flex gap-6">
                {/* Left Panel - Supplier List */}
                <Card className="w-64 flex-shrink-0">
                  <CardHeader>
                    <CardTitle className="text-lg">Поставщики</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {suppliers.map((supplier) => {
                        const hasResults = complianceResults.some(r => r.supplier.id === supplier.id);
                        return (
                          <div
                            key={supplier.id}
                            onClick={() => setSelectedSupplier(supplier)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              selectedSupplier?.id === supplier.id
                                ? 'bg-cyan-100 border-cyan-200 border'
                                : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <div className="font-medium">{supplier.name}</div>
                            {hasResults && (
                              <div className="text-sm text-green-600 mt-1">✓ Анализ готов</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Right Panel - Compliance Analysis Results */}
                <Card className="flex-1">
                  {(() => {
                    const selectedResult = complianceResults.find(r => r.supplier.id === selectedSupplier?.id);
                    if (!selectedResult) {
                      return (
                        <CardContent className="text-center py-12">
                          <p className="text-gray-500">Выберите поставщика для просмотра результатов анализа</p>
                        </CardContent>
                      );
                    }

                    return (
                      <>
                        <CardHeader>
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-lg">
                              Анализ соответствия - {selectedResult.supplier.name}
                            </CardTitle>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportAnalysis('excel', selectedResult.supplier.id)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Excel
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => exportAnalysis('pdf', selectedResult.supplier.id)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                PDF
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Overall Compliance Summary */}
                          <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-medium">Общая оценка соответствия</h3>
                              <div className={`text-3xl font-bold ${
                                selectedResult.analysis?.compliancePercentage >= 80 ? 'text-green-600' :
                                selectedResult.analysis?.compliancePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {selectedResult.analysis?.compliancePercentage}%
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-4 mb-6">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{selectedResult.analysis?.compliantCount}</div>
                                <div className="text-sm text-gray-600">Соответствует</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-yellow-600">{selectedResult.analysis?.partialCount}</div>
                                <div className="text-sm text-gray-600">Частично</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">{selectedResult.analysis?.nonCompliantCount}</div>
                                <div className="text-sm text-gray-600">Не соответствует</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-gray-600">{selectedResult.analysis?.missingCount}</div>
                                <div className="text-sm text-gray-600">Отсутствует</div>
                              </div>
                            </div>
                          </div>

                          {/* Detailed Requirements Table with Section Headers */}
                          <div className="overflow-x-auto mb-6">
                            {(() => {
                              // Debug: Log raw results
                              console.log('[DEBUG] Raw compliance results:', selectedResult.analysis?.results);
                              
                              // Remove duplicates first by creating a unique key
                              const uniqueResults = selectedResult.analysis?.results?.filter((item: any, index: number, self: any[]) => 
                                index === self.findIndex(r => r.techSpecNumber === item.techSpecNumber && r.requirement === item.requirement)
                              ) || [];
                              
                              console.log('[DEBUG] After deduplication:', uniqueResults);
                              
                              // FIXED: Group results by section properly - handle main section headers vs subsections
                              const groupedResults = uniqueResults.reduce((acc: any, item: any) => {
                                let sectionNum;
                                
                                // If tech spec is just a number (like "24", "25"), it's a main section header
                                if (item.techSpecNumber && /^\d+$/.test(item.techSpecNumber)) {
                                  sectionNum = item.techSpecNumber; // "24", "25"
                                } else {
                                  // If it's like "24.1/1", "25.1/2", extract the main section number
                                  sectionNum = item.techSpecNumber?.split('.')[0] || 'other';
                                }
                                
                                if (!acc[sectionNum]) {
                                  acc[sectionNum] = [];
                                }
                                acc[sectionNum].push(item);
                                return acc;
                              }, {});
                              
                              console.log('[DEBUG] Grouped results:', groupedResults);

                              // Section title mapping
                              const getSectionTitle = (sectionNum: string) => {
                                switch(sectionNum) {
                                  case '1': return 'Раздел 1 - Общие требования';
                                  case '2': return 'Раздел 2 - Технические характеристики';
                                  case '3': return 'Раздел 3 - Комплект технологического оборудования линии';
                                  case '4': return 'Раздел 4 - Дополнительные требования';
                                  case '5': return 'Раздел 5 - Требования к поставке';
                                  default: return `Раздел ${sectionNum}`;
                                }
                              };

                              let serialCounter = 1;

                              return Object.entries(groupedResults).map(([sectionNum, items]: [string, any]) => {
                                console.log(`[DEBUG] Rendering section ${sectionNum} with ${items.length} items`);
                                
                                return (
                                  <div key={`section-${sectionNum}`} className="mb-6">
                                    {/* Section Header */}
                                    <div className="bg-cyan-400 text-white px-4 py-2 font-medium rounded-t-lg">
                                      {getSectionTitle(sectionNum)} ({items.length} пунктов)
                                    </div>
                                  
                                  {/* Section Table */}
                                  <table className="w-full border-collapse border border-gray-300">
                                    <thead>
                                      <tr className="bg-gray-50">
                                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700 w-16">№</th>
                                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700 w-32">Номер спецификации</th>
                                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">Требование</th>
                                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">Данные из предложения</th>
                                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700 w-24">Ссылка</th>
                                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700 w-32">Статус</th>
                                        <th className="border border-gray-300 px-4 py-3 text-left font-medium text-gray-700">Примечания</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item: any, itemIndex: number) => {
                                        const currentSerial = serialCounter++;
                                        console.log(`[DEBUG] Rendering row ${currentSerial} for ${item.techSpecNumber}: ${item.requirement}`);
                                        
                                        return (
                                          <tr key={`row-${item.techSpecNumber}-${itemIndex}`} className="bg-white hover:bg-gray-50">
                                            <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">
                                              {currentSerial}
                                            </td>
                                          <td className="border border-gray-300 px-4 py-3 text-sm">
                                            {item.techSpecNumber}
                                          </td>
                                          <td className="border border-gray-300 px-4 py-3">
                                            <div className={`${
                                              // FIXED: Make key header rows (main section headers) bold
                                              item.techSpecNumber && /^\d+$/.test(item.techSpecNumber) 
                                                ? 'font-bold text-gray-900' 
                                                : 'font-medium'
                                            }`}>
                                              {item.requirement}
                                            </div>
                                          </td>
                                          <td className="border border-gray-300 px-4 py-3">
                                            {(() => {
                                              // FIXED: Show full context instead of just fragments like "stainless steel"
                                              const supplierData = typeof item.supplierData === 'object' ? JSON.stringify(item.supplierData) : (item.supplierData || '-');
                                              
                                              // If it's too short (like just "stainless steel"), it's likely missing context
                                              if (supplierData && supplierData.length < 50 && supplierData !== '-') {
                                                // Try to get more context from notes or section source
                                                const contextFromNotes = item.notes && item.notes.includes(':') ? 
                                                  item.notes.split(':').slice(1).join(':').trim() : '';
                                                
                                                if (contextFromNotes && contextFromNotes.length > supplierData.length) {
                                                  return (
                                                    <div>
                                                      <div className="font-medium text-gray-900">{supplierData}</div>
                                                      <div className="text-sm text-gray-600 mt-1">Контекст: {contextFromNotes}</div>
                                                    </div>
                                                  );
                                                }
                                              }
                                              
                                              return supplierData;
                                            })()}
                                          </td>
                                          <td className="border border-gray-300 px-4 py-3">
                                            {item.fileReference ? (
                                              <button 
                                                onClick={() => handleSupplierDocumentClick(
                                                  selectedResult.supplier.id, 
                                                  selectedResult.supplier.name,
                                                  item.requirement,
                                                  item.fileReference
                                                )}
                                                className="text-cyan-600 hover:text-cyan-700 text-sm flex items-center hover:underline cursor-pointer"
                                              >
                                                <FileText className="h-4 w-4 mr-1" />
                                                {item.fileReference}
                                              </button>
                                            ) : '-'}
                                          </td>
                                          <td className="border border-gray-300 px-4 py-3">
                                            <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                              item.status === 'compliant' ? 'bg-green-100 text-green-800' :
                                              item.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                              item.status === 'non-compliant' ? 'bg-red-100 text-red-800' :
                                              'bg-gray-100 text-gray-800'
                                            }`}>
                                              {item.status === 'compliant' ? 'Соответствует' :
                                               item.status === 'partial' ? 'Частично' :
                                               item.status === 'non-compliant' ? 'Не соответствует' : 'Отсутствует'}
                                            </span>
                                          </td>
                                          <td className="border border-gray-300 px-4 py-3 text-sm">
                                            {item.notes || '-'}
                                          </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                );
                              });
                            })()}
                          </div>

                          {/* Comments and Recommendations Section */}
                          <div className="space-y-4">
                            {/* Recommendations */}
                            {selectedResult.analysis?.recommendations && selectedResult.analysis.recommendations.length > 0 && (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <h4 className="font-medium text-green-800 mb-2">Рекомендации</h4>
                                <ul className="space-y-1">
                                  {selectedResult.analysis.recommendations.map((recommendation: string, index: number) => (
                                    <li key={index} className="text-green-700 text-sm">
                                      • {recommendation}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Gaps Identified */}
                            {selectedResult.analysis?.gapsIdentified && selectedResult.analysis.gapsIdentified.length > 0 && (
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <h4 className="font-medium text-yellow-800 mb-2">Выявленные несоответствия</h4>
                                <ul className="space-y-1">
                                  {selectedResult.analysis.gapsIdentified.map((gap: string, index: number) => (
                                    <li key={index} className="text-yellow-700 text-sm">
                                      • {gap}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* General Comments */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h4 className="font-medium text-blue-800 mb-2">Комментарии</h4>
                              <p className="text-blue-700 text-sm">
                                Анализ выполнен на основе технических требований и предоставленных документов поставщика. 
                                Рекомендуется дополнительная проверка критически важных параметров.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </>
                    );
                  })()}
                </Card>
              </div>
            ) : showComplianceAnalysis && isGeneratingCompliance ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="space-y-4">
                    <div className="h-8 w-8 animate-spin mx-auto border-2 border-cyan-600 border-t-transparent rounded-full" />
                    <p className="text-gray-600">Выполняется анализ соответствия...</p>
                    <p className="text-sm text-gray-500">
                      Это может занять несколько минут
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="space-y-4">
                    <p className="text-gray-600 mb-4">
                      Готово к анализу параметров соответствия
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Будет выполнен анализ соответствия технических требований файлам поставщиков
                    </p>
                    <Button 
                      onClick={startComplianceAnalysis}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3"
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? 'Анализирую...' : 'Начать анализ'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

                {/* Show parameter extraction section only when not in compliance analysis mode */}
                {!showComplianceAnalysis && (
                  <>
                    {/* Display compliance results if available in parameters tab */}
                    {activeTab === 'parameters' && complianceResults.length > 0 && (
                      <Card className="mb-6">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold text-gray-900">
                            Результаты анализа соответствия
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {complianceResults.map((result, index) => (
                              <div key={index} className="border border-gray-200 rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-2">
                                  Анализ соответствия - {result.supplierName}
                                </h4>
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">
                                      {result.analysis?.results?.filter(r => r.status === 'compliant').length || 0}
                                    </div>
                                    <div className="text-gray-600">Соответствует</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-yellow-600">
                                      {result.analysis?.results?.filter(r => r.status === 'partial').length || 0}
                                    </div>
                                    <div className="text-gray-600">Частично</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-red-600">
                                      {result.analysis?.results?.filter(r => r.status === 'non-compliant').length || 0}
                                    </div>
                                    <div className="text-gray-600">Не соответствует</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-600">
                                      {result.analysis?.results?.filter(r => r.status === 'missing').length || 0}
                                    </div>
                                    <div className="text-gray-600">Отсутствует</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Display extracted parameters if available */}
                    {extractedParameters.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className={themeClasses.textPrimary}>
                            Извлеченные параметры
                          </CardTitle>
                          <p className="text-sm text-gray-600">
                            Параметры извлечены из файлов поставщика {selectedSupplier?.name}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {extractedParameters.map((param, index) => (
                              <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">{param.name || `Параметр ${index + 1}`}</h4>
                                    <p className="text-gray-700 mt-1">{param.value}</p>
                                    {param.confidence && (
                                      <span className="text-xs text-gray-500 mt-1 block">
                                        Уверенность: {Math.round(param.confidence * 100)}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
          </div>
        </div>
        
        {/* Resizer - Rebuilt for proper full-height functionality */}
        {isSplitViewActive && (
          <div 
            className={`w-2 flex-shrink-0 relative group cursor-col-resize transition-all duration-200 h-full ${
              isResizing ? 'bg-cyan-500' : 'bg-gray-300 hover:bg-cyan-400'
            }`}
            onMouseDown={handleResizerMouseDown}
            style={{ 
              zIndex: 20,
              minWidth: '8px',
              maxWidth: '8px',
              height: '100vh'
            }}
          >
            {/* Center line indicator - full height */}
            <div className={`absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 w-0.5 transition-colors ${
              isResizing ? 'bg-cyan-700' : 'bg-gray-500 group-hover:bg-cyan-600'
            }`}></div>
            
            {/* Resize handle area - wider for easier interaction, full height */}
            <div 
              className="absolute top-0 bottom-0 cursor-col-resize"
              style={{
                left: '-4px',
                right: '-4px',
                height: '100vh'
              }}
              onMouseDown={handleResizerMouseDown}
            ></div>
          </div>
        )}
        
        {/* Right Panel - Document Viewer */}
        {isSplitViewActive && (
          <div 
            className="flex flex-col bg-white relative"
            style={{ width: `${100 - leftPanelWidth}%`, height: '100vh' }}
          >
            {/* Document Viewer Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50 flex-shrink-0">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold truncate">
                  {documentViewerFileName}
                </h3>
                {documentViewerSupplierName && (
                  <span className="text-sm text-gray-500">
                    от {documentViewerSupplierName}
                  </span>
                )}
              </div>
              <button
                onClick={closeSplitView}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Document Content */}
            <div className="flex-1 min-h-0">
              {documentViewerUrl && (
                <iframe
                  src={`${documentViewerUrl}${documentViewerTargetPage ? `#page=${documentViewerTargetPage}` : ''}`}
                  className="w-full h-full border-0"
                  title={documentViewerFileName}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisWorkspace;