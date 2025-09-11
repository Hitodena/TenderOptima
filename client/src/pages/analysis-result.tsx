import { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { MainNavigation } from '@/components/main-navigation';
import type { AnalysisResult } from '@shared/schema';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

import { jsPDF } from 'jspdf';
// @ts-ignore - add missing imports for PDF generation
import pdfMake from 'pdfmake/build/pdfmake';
import htmlToPdfmake from 'html-to-pdfmake';

// Helper function to format dates safely
const formatDate = (date: Date | string | null | undefined, formatStr: string): string => {
  if (!date) return format(new Date(), formatStr);
  return format(typeof date === 'string' ? new Date(date) : date, formatStr);
};

export default function AnalysisResultPage() {
  const [match, params] = useRoute<{ id?: string }>('/analysis/:id');
  const { toast } = useToast();
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load the analysis result when the page loads
  useEffect(() => {
    const loadAnalysisResult = async () => {
      if (!params?.id) {
        setError('No analysis ID provided');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        // Use apiRequest to include proper authentication headers
        const data = await apiRequest(`/api/analysis-results/${params.id}`, 'GET');
        setAnalysisResult(data);
      } catch (err) {
        console.error('Error loading analysis result:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analysis result');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAnalysisResult();
  }, [params?.id]);
  
  // Function to generate PDF from the analysis content
  const generatePDF = () => {
    if (!analysisResult) return;
    
    try {
      // Extract only the content we want to include in the PDF
      const contentElement = document.getElementById('analysis-content');
      if (!contentElement) {
        throw new Error('Analysis content element not found');
      }
      
      const html = contentElement.innerHTML;
      
      // Create the PDF document
      const doc = new jsPDF();
      
      // Add a title
      doc.setFontSize(16);
      doc.text(`Supplier Analysis Report - ${formatDate(analysisResult.dateCreated, 'yyyy-MM-dd')}`, 15, 15);
      
      // Add request details
      doc.setFontSize(12);
      doc.text(`Request ID: ${analysisResult.requestId}`, 15, 25);
      doc.text(`Generated: ${formatDate(analysisResult.dateCreated, 'yyyy-MM-dd HH:mm')}`, 15, 32);
      
      // Add the HTML content
      const parsedHtml = htmlToPdfmake(html);
      
      // @ts-ignore - pdfMake types are not properly defined
      pdfMake.createPdf({ content: parsedHtml }).getDataUrl((dataUrl: string) => {
        // Extract content from data URL and add it to the PDF
        const img = new Image();
        img.onload = function() {
          doc.addImage(img, 'JPEG', 15, 40, 180, 0);
          // Save the PDF
          doc.save(`supplier-analysis-${analysisResult.id}.pdf`);
        };
        img.src = dataUrl;
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error generating PDF',
        description: 'There was a problem creating the PDF. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="container mx-auto px-4 py-8">
          
          
        
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center">
            <Spinner className="h-8 w-8 mb-4" />
            <p className="text-center text-lg font-medium">Loading analysis result...</p>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }
  
  if (error || !analysisResult) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="container mx-auto px-4 py-8">
          
          
        
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-red-500 mb-2">Error Loading Analysis</h2>
              <p className="mb-4">{error || 'Failed to load analysis result'}</p>
              <Button asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="container mx-auto px-4 py-8">
        
        
      
      
      <div className="mb-6 flex justify-between items-center">
        <Button variant="outline" asChild>
          <Link href={`/requests/${analysisResult.requestId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Link>
        </Button>
        
        <Button variant="outline" onClick={generatePDF}>
          <Download className="mr-2 h-4 w-4" />
          Скачать PDF
        </Button>
      </div>
      </div>
      <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Результаты Анализа</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>
            Created on {formatDate(analysisResult.dateCreated, 'dd MMMM yyyy, HH:mm')}
          </CardDescription>
          <div 
            id="analysis-content" 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: analysisResult.analysisContent }}
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}