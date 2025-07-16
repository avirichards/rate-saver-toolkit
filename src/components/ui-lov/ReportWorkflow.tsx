import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { ChevronLeft, ChevronRight, Check, Upload, Settings, BarChart3, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IntelligentColumnMapper } from '@/components/ui-lov/IntelligentColumnMapper';
import { ServiceMappingReview } from '@/components/ui-lov/ServiceMappingReview';
import { AnalysisSection } from '@/components/ui-lov/AnalysisSection';
import { ResultsSection } from '@/components/ui-lov/ResultsSection';
import { parseCSV, type ServiceMapping } from '@/utils/csvParser';
import { toast } from 'sonner';

interface Report {
  id: string;
  user_id: string;
  report_name: string;
  raw_csv_data: string;
  raw_csv_filename: string;
  total_rows: number;
  current_section: 'header_mapping' | 'service_mapping' | 'analysis' | 'results' | 'complete';
  sections_completed: string[];
  header_mappings: any;
  detected_headers: string[];
  service_mappings: any;
  analysis_results: any;
  ups_rate_quotes: any;
  total_savings: number | null;
  total_shipments: number;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

const SECTIONS = [
  { id: 'header_mapping', label: 'Header Mapping', icon: Settings, description: 'Map CSV headers to data fields' },
  { id: 'service_mapping', label: 'Service Mapping', icon: Upload, description: 'Map shipping services' },
  { id: 'analysis', label: 'Analysis', icon: BarChart3, description: 'Run rate analysis' },
  { id: 'results', label: 'Results', icon: FileText, description: 'View analysis results' }
] as const;

interface ReportWorkflowProps {
  reportId?: string;
}

export const ReportWorkflow: React.FC<ReportWorkflowProps> = ({ reportId }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  
  // Section-specific state
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  const finalReportId = reportId || id;

  useEffect(() => {
    if (finalReportId) {
      loadReport();
    }
  }, [finalReportId]);

  // Initialize section data when report is loaded
  useEffect(() => {
    if (report) {
      initializeSectionData();
    }
  }, [report]);

  const initializeSectionData = () => {
    if (!report) return;

    try {
      // Parse CSV data if available
      if (report.raw_csv_data) {
        console.log('Parsing CSV data...');
        const parsed = parseCSV(report.raw_csv_data);
        console.log('CSV parsed successfully:', { 
          dataLength: parsed.data.length, 
          headers: parsed.headers 
        });
        setCsvData(parsed.data);
        setCsvHeaders(parsed.headers);
      } else {
        console.warn('No raw CSV data available in report');
      }

      // Load existing mappings
      if (report.header_mappings && typeof report.header_mappings === 'object') {
        console.log('Loading existing header mappings:', report.header_mappings);
        setFieldMappings(report.header_mappings);
      }

      // Load existing service mappings
      if (report.service_mappings && Array.isArray(report.service_mappings)) {
        console.log('Loading existing service mappings:', report.service_mappings);
        setServiceMappings(report.service_mappings);
      }

      // Load analysis results
      if (report.analysis_results && typeof report.analysis_results === 'object') {
        console.log('Loading existing analysis results:', report.analysis_results);
        setAnalysisResults(report.analysis_results);
      }
    } catch (error) {
      console.error('Error initializing section data:', error);
      toast.error('Failed to parse CSV data');
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', finalReportId)
        .single();

      if (error) throw error;

      setReport(data as Report);
      
      // Set current section based on report state
      const sectionIndex = SECTIONS.findIndex(s => s.id === data.current_section);
      setCurrentSectionIndex(sectionIndex >= 0 ? sectionIndex : 0);
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error("Failed to load report");
      navigate('/reports');
    } finally {
      setLoading(false);
    }
  };

  const updateReportSection = async (newSection: string, updatedData: Partial<Report> = {}) => {
    if (!report) return;

    try {
      const sectionsCompleted = [...new Set([...report.sections_completed, newSection])];
      
      const { error } = await supabase
        .from('reports')
        .update({
          current_section: newSection,
          sections_completed: sectionsCompleted,
          ...updatedData
        })
        .eq('id', report.id);

      if (error) throw error;

      setReport(prev => prev ? {
        ...prev,
        current_section: newSection as any,
        sections_completed: sectionsCompleted,
        ...updatedData
      } : null);
    } catch (error) {
      console.error('Error updating report section:', error);
      toast.error("Failed to update report progress");
    }
  };

  const navigateToSection = (sectionIndex: number) => {
    if (sectionIndex >= 0 && sectionIndex < SECTIONS.length) {
      setCurrentSectionIndex(sectionIndex);
      const section = SECTIONS[sectionIndex];
      updateReportSection(section.id);
    }
  };

  const goToNextSection = () => {
    if (currentSectionIndex < SECTIONS.length - 1) {
      navigateToSection(currentSectionIndex + 1);
    }
  };

  const goToPreviousSection = () => {
    if (currentSectionIndex > 0) {
      navigateToSection(currentSectionIndex - 1);
    }
  };

  const isSectionCompleted = (sectionId: string) => {
    return report?.sections_completed.includes(sectionId) || false;
  };

  // Section completion handlers
  const handleMappingComplete = async (mappings: Record<string, string>, serviceMappings: ServiceMapping[], originZipOverride?: string) => {
    try {
      await updateReportSection('service_mapping', {
        header_mappings: mappings,
        service_mappings: serviceMappings
      });
      
      setFieldMappings(mappings);
      setServiceMappings(serviceMappings);
      
      toast.success('Header mapping completed!');
      goToNextSection();
    } catch (error) {
      console.error('Error saving header mappings:', error);
      toast.error('Failed to save header mappings');
    }
  };

  const handleServiceMappingsConfirmed = async (confirmedMappings: ServiceMapping[]) => {
    try {
      await updateReportSection('analysis', {
        service_mappings: confirmedMappings
      });
      
      setServiceMappings(confirmedMappings);
      
      toast.success('Service mappings confirmed!');
      goToNextSection();
    } catch (error) {
      console.error('Error saving service mappings:', error);
      toast.error('Failed to save service mappings');
    }
  };

  const handleAnalysisComplete = async (results: any) => {
    try {
      await updateReportSection('results', {
        analysis_results: results,
        total_savings: results.totalSavings || 0,
        total_shipments: results.totalShipments || 0
      });
      
      setAnalysisResults(results);
      
      toast.success('Analysis completed!');
      goToNextSection();
    } catch (error) {
      console.error('Error saving analysis results:', error);
      toast.error('Failed to save analysis results');
    }
  };

  const renderSectionContent = () => {
    const currentSection = SECTIONS[currentSectionIndex];
    if (!currentSection) {
      return (
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground mb-4">
            Invalid section
          </p>
        </div>
      );
    }
    
    switch (currentSection.id) {
      case 'header_mapping':
        if (!csvHeaders.length || !csvData.length) {
          return (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                {report?.raw_csv_data ? 'Processing CSV data...' : 'No CSV data available'}
              </p>
              {!report?.raw_csv_data && (
                <Button variant="outline" onClick={() => navigate('/upload')}>
                  Upload CSV File
                </Button>
              )}
            </div>
          );
        }
        
        return (
          <IntelligentColumnMapper
            csvHeaders={csvHeaders}
            csvData={csvData}
            onMappingComplete={handleMappingComplete}
          />
        );

      case 'service_mapping':
        console.log('Service mapping section - checking prerequisites:', {
          hasServiceMapping: !!fieldMappings.service,
          serviceMappingValue: fieldMappings.service,
          csvDataLength: csvData.length,
          fieldMappings
        });
        
        if (!fieldMappings.service || !csvData.length) {
          return (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                Please complete header mapping first and ensure a service column is mapped.
              </p>
              <Button variant="outline" onClick={() => navigateToSection(0)}>
                Go to Header Mapping
              </Button>
            </div>
          );
        }
        
        return (
          <ServiceMappingReview
            csvData={csvData}
            serviceColumn={fieldMappings.service}
            initialMappings={serviceMappings}
            onMappingsConfirmed={handleServiceMappingsConfirmed}
          />
        );

      case 'analysis':
        if (!serviceMappings.length) {
          return (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                Please complete service mapping first.
              </p>
              <Button variant="outline" onClick={() => navigateToSection(1)}>
                Go to Service Mapping
              </Button>
            </div>
          );
        }
        
        // Run analysis directly in the workflow
        return <AnalysisSection 
          csvData={csvData}
          fieldMappings={fieldMappings}
          serviceMappings={serviceMappings}
          reportId={report?.id}
          onAnalysisComplete={handleAnalysisComplete}
        />;

      case 'results':
        if (!analysisResults) {
          return (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                Please complete analysis first.
              </p>
              <Button variant="outline" onClick={() => navigateToSection(2)}>
                Go to Analysis
              </Button>
            </div>
          );
        }
        
        // Show results directly in the workflow
        return <ResultsSection 
          analysisResults={analysisResults}
          reportId={report?.id}
        />;

      default:
        return (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">
              Unknown section
            </p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-medium mb-4">Report not found</p>
          <Button onClick={() => navigate('/reports')}>
            Back to Reports
          </Button>
        </div>
      </div>
    );
  }

  const currentSection = SECTIONS[currentSectionIndex];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/reports')}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Reports
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{report.report_name}</h1>
                <p className="text-muted-foreground">
                  {report.raw_csv_filename} • {report.total_rows} rows
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {SECTIONS.map((section, index) => {
              const Icon = section.icon;
              const isActive = index === currentSectionIndex;
              const isCompleted = isSectionCompleted(section.id);
              const isAccessible = index <= currentSectionIndex || isCompleted;

              return (
                <div key={section.id} className="flex items-center">
                  <button
                    onClick={() => isAccessible && navigateToSection(index)}
                    disabled={!isAccessible}
                    className={cn(
                      "flex flex-col items-center p-4 rounded-lg transition-all",
                      isActive && "bg-primary text-primary-foreground",
                      isCompleted && !isActive && "bg-green-100 text-green-700",
                      !isActive && !isCompleted && "text-muted-foreground hover:bg-muted",
                      !isAccessible && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-full border-2 mb-2",
                      isActive && "border-primary-foreground bg-primary-foreground text-primary",
                      isCompleted && !isActive && "border-green-500 bg-green-500 text-white",
                      !isActive && !isCompleted && "border-muted-foreground"
                    )}>
                      {isCompleted && !isActive ? (
                        <Check className="h-6 w-6" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-center">
                      {section.label}
                    </span>
                    <span className="text-xs text-center opacity-75">
                      {section.description}
                    </span>
                  </button>
                  {index < SECTIONS.length - 1 && (
                    <div className="flex-1 h-px bg-border mx-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section Content */}
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <currentSection.icon className="h-6 w-6" />
              {currentSection.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderSectionContent()}
          </CardContent>
        </Card>

        {/* Single Continue button - always show */}
        <div className="flex justify-end mt-8">
          {currentSectionIndex < SECTIONS.length - 1 ? (
            <Button
              onClick={goToNextSection}
              disabled={!isSectionCompleted(currentSection.id)}
              className="flex items-center gap-2"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-2"
            >
              Back to Reports
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};