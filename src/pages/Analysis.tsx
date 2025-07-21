
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui-lov/Button';
import { FileBarChart, Upload, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateSavings } from '@/utils/analysisUtils';

interface AnalysisResult {
  processedShipments: any[];
  orphanedShipments: any[];
  summary: any;
  originalData: any[];
}

const AnalysisPage = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<any[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [existingAnalysisId, setExistingAnalysisId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    // Check if we're in edit mode and have an existing analysis ID
    if (location.state?.analysisId && location.state?.editMode) {
      setEditMode(true);
      setExistingAnalysisId(location.state.analysisId);
      console.log('📝 ANALYSIS: Entering edit mode for analysis ID:', location.state.analysisId);
    } else {
      setEditMode(false);
      setExistingAnalysisId(null);
    }
  }, [location.state]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const binaryStr = e.target.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { raw: true });
      setFileData(data);
    };
    reader.readAsBinaryString(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleAnalyze = async () => {
    if (!fileData.length) {
      toast.error('Please upload a file to analyze.');
      return;
    }

    setLoading(true);
    try {
      // Simulate delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));

      const { processedShipments, orphanedShipments, summary } = calculateSavings(fileData);
      setAnalysisResults({ 
        processedShipments, 
        orphanedShipments, 
        summary,
        originalData: fileData // Keep original data for later use
      });

      toast.success('Analysis complete!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalysisComplete = async (analysisResults: any) => {
    try {
      console.log('📊 ANALYSIS: Analysis completed, saving results...');
      
      if (!analysisResults || !analysisResults.processedShipments) {
        throw new Error('Invalid analysis results');
      }

      const { processedShipments, orphanedShipments, summary } = analysisResults;
      
      // Create or update the analysis record with all data
      const analysisData = {
        user_id: user?.id,
        file_name: fileName || 'Unknown File',
        report_name: fileName || 'Unknown File',
        analysis_date: new Date().toISOString(),
        total_shipments: processedShipments.length + (orphanedShipments?.length || 0),
        total_savings: summary?.totalSavings || 0,
        status: 'completed',
        processed_shipments: processedShipments,
        orphaned_shipments: orphanedShipments || [],
        processing_metadata: {
          processedAt: new Date().toISOString(),
          totalProcessed: processedShipments.length,
          totalOrphaned: orphanedShipments?.length || 0,
          averageSavings: summary?.averageSavings || 0,
          totalCost: summary?.totalCost || 0
        },
        original_data: analysisResults.originalData || {},
        savings_analysis: summary || {},
        client_id: null // Will be set in Results if needed
      };

      let analysisId;
      
      if (editMode && existingAnalysisId) {
        // Update existing analysis
        const { error } = await supabase
          .from('shipping_analyses')
          .update(analysisData)
          .eq('id', existingAnalysisId);
          
        if (error) throw error;
        analysisId = existingAnalysisId;
        console.log('✅ ANALYSIS: Updated existing analysis:', analysisId);
      } else {
        // Create new analysis
        const { data, error } = await supabase
          .from('shipping_analyses')
          .insert([analysisData])
          .select()
          .single();

        if (error) throw error;
        analysisId = data.id;
        console.log('✅ ANALYSIS: Created new analysis:', analysisId);
      }

      // Navigate to Results with the analysis ID
      navigate('/results', {
        state: { analysisId }
      });

    } catch (error) {
      console.error('❌ ANALYSIS: Error saving analysis:', error);
      toast.error('Failed to save analysis results');
    }
  };

  const handleClearData = () => {
    setFileData([]);
    setAnalysisResults(null);
    setFileName(null);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Shipping Analysis</h1>
          <p className="text-muted-foreground">Upload your shipping data to analyze and identify potential savings.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div {...getRootProps()} className="relative border-dashed border-2 rounded-md p-6 cursor-pointer hover:bg-gray-50">
              <input {...getInputProps()} />
              <div className="text-center">
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isDragActive ? "Drop the file here..." : `Click to upload or drag and drop your .xlsx file`}
                </p>
                {fileName && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <FileBarChart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{fileName}</span>
                    <Button variant="ghost" size="icon" onClick={handleClearData}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4">
              <Button 
                onClick={handleAnalyze} 
                disabled={loading || fileData.length === 0}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze Data'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {analysisResults && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${analysisResults.summary.totalSavings.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Savings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {analysisResults.processedShipments.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Processed Shipments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {analysisResults.orphanedShipments.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Orphaned Shipments</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4">
              <Button onClick={() => handleAnalysisComplete(analysisResults)} className="w-full">
                Save & View Results
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AnalysisPage;
