
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { FileUpload } from '@/components/ui-lov/FileUpload';
import { Button } from '@/components/ui-lov/Button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { generateTestData, generateCSVContent, downloadCSV, TEST_SCENARIOS, saveTestSession } from '@/utils/testDataGenerator';
import { apiClient } from '@/lib/apiClient';
import { useTestMode } from '@/hooks/useTestMode';

const Upload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isTestMode } = useTestMode();
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-trigger test data if URL parameters are present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const testParam = urlParams.get('test');
    const scenario = urlParams.get('scenario') as keyof typeof TEST_SCENARIOS || 'mixed_weights';
    
    if (testParam === 'true' && user && !isProcessing) {
      toast.info('Auto-loading test data for development...');
      setTimeout(() => handleUseTestData(scenario), 500);
    }
  }, [user]);
  
  const handleFileUpload = async (file: File) => {
    if (!user) {
      toast.error('Please log in to upload files');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Upload CSV file to API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reportName', file.name.replace('.csv', ''));
      
      const { data, error } = await apiClient.createAnalysis(formData);
      
      if (error) {
        throw new Error(error.message);
      }

      toast.success(`File processed successfully! Analysis created with ID: ${data.analysisId}`);
      
      // Navigate to the mapping page with API data
      navigate('/mapping', { 
        state: { 
          analysisId: data.analysisId,
          fileName: file.name,
          headers: data.headers,
          data: data.data,
          rowCount: data.rowCount,
          fileUploaded: true,
          uploadTimestamp: Date.now(),
        } 
      });
      
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process the CSV file. Please check the format and try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleError = (error) => {
    console.error("Upload error:", error);
    toast.error(error || 'An error occurred while uploading the file.');
  };

  const handleUseTestData = async (scenario: keyof typeof TEST_SCENARIOS = 'mixed_weights') => {
    if (!user) {
      toast.error('Please log in to use test data');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Generate test data
      const testData = TEST_SCENARIOS[scenario]();
      
      // Save test session
      saveTestSession(testData, scenario);
      
      // Convert test data to CSV format and upload to API
      const csvContent = generateCSVContent(testData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], `test-data-${scenario}.csv`, { type: 'text/csv' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reportName', `Test Data - ${scenario}`);
      
      const { data, error } = await apiClient.createAnalysis(formData);
      
      if (error) {
        throw new Error(error.message);
      }

      toast.success(`Test data generated! Analysis created with ID: ${data.analysisId}`);
      
      // Navigate to the mapping page with API data
      navigate('/mapping', { 
        state: { 
          analysisId: data.analysisId,
          fileName: `test-data-${scenario}.csv`,
          headers: data.headers,
          data: data.data,
          rowCount: data.rowCount,
          fileUploaded: true,
          isTestData: true,
          uploadTimestamp: Date.now(),
        } 
      });
      
    } catch (error) {
      console.error('Error generating test data:', error);
      toast.error('Failed to generate test data');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const sampleData = generateTestData(10);
    const csvContent = generateCSVContent(sampleData);
    downloadCSV(csvContent, 'shipping-data-template.csv');
    toast.success('Sample CSV template downloaded');
  };
  
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Upload Shipping Data</h1>
          <p className="text-muted-foreground mt-2">
            Start by uploading your CSV file containing shipping data for analysis.
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Please upload a CSV file containing your shipping data. The file should include 
              information such as tracking numbers, weights, dimensions, and shipping costs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload 
              onUpload={handleFileUpload}
              onError={handleError}
              acceptedFileTypes={['.csv']}
              maxFileSizeMB={100}
            />
            
            {isProcessing && (
              <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                  <span className="text-sm text-primary font-medium">Processing CSV file...</span>
                </div>
                <p className="text-xs text-primary/70 mt-1">Analyzing headers and detecting field patterns</p>
              </div>
            )}
            
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Instructions:</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>File must be in CSV format</li>
                <li>Maximum file size is 100MB</li>
                <li>Headers should be included in the first row</li>
                <li>Required columns: tracking ID, weight, service type, origin ZIP, destination ZIP, dimensions</li>
                <li>Optional columns: cost, zones, and accessorial charges</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Sample Format</CardTitle>
            <CardDescription>
              If you're unsure about the format, use our sample template.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">tracking_id</th>
                    <th className="text-left py-2 px-3">service_type</th>
                    <th className="text-left py-2 px-3">weight_lbs</th>
                    <th className="text-left py-2 px-3">origin_zip</th>
                    <th className="text-left py-2 px-3">dest_zip</th>
                    <th className="text-left py-2 px-3">cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3">1Z999AA10123456784</td>
                    <td className="py-2 px-3">Ground</td>
                    <td className="py-2 px-3">5.25</td>
                    <td className="py-2 px-3">90210</td>
                    <td className="py-2 px-3">10001</td>
                    <td className="py-2 px-3">24.50</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">7901234567891</td>
                    <td className="py-2 px-3">FedEx Express</td>
                    <td className="py-2 px-3">10.0</td>
                    <td className="py-2 px-3">60606</td>
                    <td className="py-2 px-3">20001</td>
                    <td className="py-2 px-3">45.30</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-sm"
              >
                Download sample CSV template
              </Button>
            </div>
          </CardContent>
        </Card>
        
      </div>
    </DashboardLayout>
  );
};

export default Upload;
