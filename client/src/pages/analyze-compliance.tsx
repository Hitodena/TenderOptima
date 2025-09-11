import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAnalysisThemeClasses } from '@/styles/analysis-theme';

interface Supplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface ComplianceResult {
  requirement: string;
  techSpecNumber: string;
  supplierData: string;
  fileReference: string;
  status: 'compliant' | 'partial' | 'non-compliant' | 'missing';
  notes: string;
}

interface ComplianceAnalysis {
  supplier: Supplier;
  compliancePercentage: number;
  totalRequirements: number;
  compliantCount: number;
  partialCount: number;
  nonCompliantCount: number;
  missingCount: number;
  results: ComplianceResult[];
  recommendations: string[];
  gapsIdentified: string[];
}

interface AnalysisProject {
  id?: number;
  procedureName?: string;
  description?: string;
  status?: string;
}

export function AnalyzeCompliancePage() {
  const [project, setProject] = useState<AnalysisProject>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [complianceAnalysis, setComplianceAnalysis] = useState<ComplianceAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);

  const { toast } = useToast();
  const themeClasses = getAnalysisThemeClasses();

  // Extract project ID from URL and check for force regeneration
  useEffect(() => {
    const pathSegments = window.location.pathname.split('/');
    const technicalIndex = pathSegments.indexOf('technical');
    if (technicalIndex !== -1 && pathSegments[technicalIndex + 1]) {
      const id = parseInt(pathSegments[technicalIndex + 1]);
      if (!isNaN(id)) {
        setProjectId(id);
        loadProject(id);
        loadSuppliers(id);
        
        // Check if we should force regeneration (coming from "Начать анализ")
        const urlParams = new URLSearchParams(window.location.search);
        const forceRegenerate = urlParams.get('regenerate') === 'true';
        
        if (forceRegenerate) {
          // Clear URL parameter to avoid repeated regeneration
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          
          // Will force regeneration when suppliers are loaded
          (window as any).forceRegenerate = true;
        }
      }
    }
  }, []);

  const loadProject = async (id: number) => {
    try {
      const response = await fetch(`/api/analysis-projects/${id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const loadSuppliers = async (projectId: number) => {
    try {
      const response = await fetch(`/api/analysis-projects/${projectId}/suppliers`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const suppliersList = data.suppliers || [];
        setSuppliers(suppliersList);
        
        if (suppliersList.length > 0) {
          setSelectedSupplier(suppliersList[0]);
          
          // Check if we should force regeneration
          const forceRegenerate = (window as any).forceRegenerate === true;
          if (forceRegenerate) {
            (window as any).forceRegenerate = false; // Clear flag
          }
          
          loadComplianceAnalysis(projectId, suppliersList[0].id, forceRegenerate);
        }
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadComplianceAnalysis = async (projectId: number, supplierId: number, forceRegenerate: boolean = false) => {
    setIsLoading(true);
    
    try {
      if (forceRegenerate) {
        // Force regeneration with new requirements
        await generateComplianceAnalysis(projectId, supplierId);
        return;
      }
      
      const response = await fetch(`/api/analysis-projects/${projectId}/compliance/${supplierId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const analysis = data.analysis;
        // Ensure recommendations and gapsIdentified are arrays
        if (analysis) {
          analysis.recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
          analysis.gapsIdentified = Array.isArray(analysis.gapsIdentified) ? analysis.gapsIdentified : [];
        }
        setComplianceAnalysis(analysis);
      } else {
        // If analysis doesn't exist, generate it
        await generateComplianceAnalysis(projectId, supplierId);
      }
    } catch (error) {
      console.error('Error loading compliance analysis:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить результаты анализа",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateComplianceAnalysis = async (projectId: number, supplierId: number) => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/analysis-projects/${projectId}/compliance/${supplierId}/generate`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const analysis = data.analysis;
        // Ensure recommendations and gapsIdentified are arrays
        if (analysis) {
          analysis.recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
          analysis.gapsIdentified = Array.isArray(analysis.gapsIdentified) ? analysis.gapsIdentified : [];
        }
        setComplianceAnalysis(analysis);
        
        toast({
          title: "Анализ завершен",
          description: `Соответствие: ${analysis.compliancePercentage}%`
        });
      } else {
        throw new Error('Failed to generate analysis');
      }
    } catch (error) {
      console.error('Error generating compliance analysis:', error);
      toast({
        title: "Ошибка анализа",
        description: "Не удалось выполнить анализ соответствия",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportResults = async (format: 'pdf' | 'excel') => {
    if (!project.id || !selectedSupplier?.id) return;

    setIsExporting(true);

    try {
      const response = await fetch(`/api/analysis-projects/${project.id}/export/${selectedSupplier.id}?format=${format}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance-analysis-${selectedSupplier.name}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Экспорт завершен",
          description: `Файл ${format.toUpperCase()} успешно загружен`
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: "Ошибка экспорта",
        description: "Не удалось экспортировать результаты",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusColor = (status: ComplianceResult['status']) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'non-compliant':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'missing':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: ComplianceResult['status']) => {
    switch (status) {
      case 'compliant':
        return '🟢 Соответствует';
      case 'partial':
        return '🟡 Частично';
      case 'non-compliant':
        return '🔴 Не соответствует';
      case 'missing':
        return '⚪ Отсутствует';
      default:
        return 'Неизвестно';
    }
  };

  const getComplianceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Menu */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className={`text-xl font-semibold ${themeClasses.textPrimary}`}>
                Шаг 3: Анализ соответствия
              </h1>
              {project.procedureName && (
                <span className="text-gray-600">• {project.procedureName}</span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  const currentProjectId = projectId || project.id;
                  if (currentProjectId) {
                    window.location.href = `/analyze/technical/${currentProjectId}/workspace`;
                  }
                }}
              >
                Назад к рабочему пространству
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 h-screen flex flex-col">
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Section - Suppliers List (Smaller) */}
          <div className="w-64 flex-shrink-0 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium ${themeClasses.textPrimary}`}>Поставщики</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-3">
                <div className="space-y-1">
                  {suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className={`p-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                        selectedSupplier?.id === supplier.id
                          ? `${themeClasses.backgroundLight} ${themeClasses.borderColor} ${themeClasses.textAccent}`
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                      onClick={() => {
                        setSelectedSupplier(supplier);
                        if (project.id) {
                          loadComplianceAnalysis(project.id, supplier.id);
                        }
                      }}
                    >
                      <div className="font-medium truncate">{supplier.name}</div>
                      {supplier.email && (
                        <div className="text-xs text-gray-500 truncate">{supplier.email}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Section - Compliance Analysis */}
          <div className="flex-1 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className={themeClasses.textPrimary}>
                    Анализ соответствия
                    {selectedSupplier && (
                      <span className="ml-2 text-base font-normal">
                        - {selectedSupplier.name}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportResults('excel')}
                      disabled={!complianceAnalysis || isExporting}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportResults('pdf')}
                      disabled={!complianceAnalysis || isExporting}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Анализ соответствия...</p>
                    </div>
                  </div>
                ) : complianceAnalysis ? (
                  <>
                    {/* Compliance Summary */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Общая оценка соответствия</h3>
                        <div className={`text-2xl font-bold ${getComplianceColor(complianceAnalysis.compliancePercentage)}`}>
                          {complianceAnalysis.compliancePercentage}%
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-green-600">{complianceAnalysis.compliantCount}</div>
                          <div className="text-sm text-gray-600">Соответствует</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-yellow-600">{complianceAnalysis.partialCount}</div>
                          <div className="text-sm text-gray-600">Частично</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-600">{complianceAnalysis.nonCompliantCount}</div>
                          <div className="text-sm text-gray-600">Не соответствует</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-gray-600">{complianceAnalysis.missingCount}</div>
                          <div className="text-sm text-gray-600">Отсутствует</div>
                        </div>
                      </div>
                    </div>

                    {/* Compliance Table */}
                    <div className="flex-1 overflow-auto">
                      <table className="w-full border-collapse border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="border border-gray-200 p-3 text-left">Требование</th>
                            <th className="border border-gray-200 p-3 text-left">Данные из предложения</th>
                            <th className="border border-gray-200 p-3 text-left">Ссылка</th>
                            <th className="border border-gray-200 p-3 text-left">Статус</th>
                            <th className="border border-gray-200 p-3 text-left">Примечания</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Sort results by techSpecNumber for proper numerical order */}
                          {[...complianceAnalysis.results].sort((a, b) => {
                            // Convert techSpecNumber to sortable format
                            const parseSpecNumber = (spec: string) => {
                              // Handle formats like "4.2", "4.2.1", "4.2.20/2", etc.
                              const parts = spec.split(/[./]/).map(part => {
                                const num = parseInt(part, 10);
                                return isNaN(num) ? 0 : num;
                              });
                              // Pad array to ensure consistent comparison
                              while (parts.length < 4) parts.push(0);
                              return parts;
                            };
                            
                            const aSpec = parseSpecNumber(a.techSpecNumber);
                            const bSpec = parseSpecNumber(b.techSpecNumber);
                            
                            // Compare each part numerically
                            for (let i = 0; i < Math.max(aSpec.length, bSpec.length); i++) {
                              const aPart = aSpec[i] || 0;
                              const bPart = bSpec[i] || 0;
                              if (aPart !== bPart) {
                                return aPart - bPart;
                              }
                            }
                            return 0;
                          }).map((result, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-200 p-3">
                                <div className="font-medium">{result.requirement}</div>
                                <div className="text-sm text-gray-500">п. {result.techSpecNumber}</div>
                              </td>
                              <td className="border border-gray-200 p-3">
                                {result.supplierData || '-'}
                              </td>
                              <td className="border border-gray-200 p-3">
                                  {result.fileReference ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      {result.fileReference}
                                    </Button>
                                  ) : (
                                    '-'
                                  )}
                              </td>
                              <td className="border border-gray-200 p-3">
                                <Badge className={getStatusColor(result.status)}>
                                  {getStatusText(result.status)}
                                </Badge>
                              </td>
                              <td className="border border-gray-200 p-3">
                                {result.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Recommendations */}
                    {(complianceAnalysis.recommendations || []).length > 0 && (
                      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold mb-2">Рекомендации:</h4>
                        <ul className="space-y-1">
                          {(complianceAnalysis.recommendations || []).map((rec, index) => (
                            <li key={index} className="text-sm">• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Gaps Identified */}
                    {(complianceAnalysis.gapsIdentified || []).length > 0 && (
                      <div className="mt-4 p-4 bg-red-50 rounded-lg">
                        <h4 className="font-semibold mb-2">Выявленные несоответствия:</h4>
                        <ul className="space-y-1">
                          {(complianceAnalysis.gapsIdentified || []).map((gap, index) => (
                            <li key={index} className="text-sm">• {gap}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : !selectedSupplier ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg text-gray-500">
                        Выберите поставщика для анализа
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg text-gray-500 mb-4">
                        Анализ соответствия недоступен для выбранного поставщика
                      </p>
                      <Button
                        onClick={() => project.id && selectedSupplier.id && generateComplianceAnalysis(project.id, selectedSupplier.id)}
                        className={themeClasses.buttonPrimary}
                      >
                        Запустить анализ
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}