
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileUpload } from '@/components/ui-lov/FileUpload';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { toast } from 'sonner';
import { ArrowRight, FileType } from 'lucide-react';

const Upload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
  };

  const handleContinue = () => {
    if (!file) {
      toast.error('Please upload a CSV file first');
      return;
    }

    setIsProcessing(true);

    // Simulate CSV parsing
    setTimeout(() => {
      // In a real application, we would parse the CSV file here
      // and store the data in a state or context
      setIsProcessing(false);
      
      // For this prototype, we'll simulate successful parsing and
      // navigate to the mapping page
      navigate('/mapping', { 
        state: { 
          headers: ['tracking_id', 'package_weight', 'service_type', 'shipping_cost', 'destination', 'length', 'width', 'height'],
          fileUploaded: true
        } 
      });
    }, 1500);
  };

  return (
    <AppLayout showProgress={true} backButtonUrl="/">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">Upload Shipping Data</h1>
        <p className="text-muted-foreground mb-6">
          Upload your shipping CSV file to begin analysis. We'll help you map the columns in the next step.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">CSV File Upload</CardTitle>
            <CardDescription>
              Upload your shipping data CSV file with information about your shipments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              accept=".csv"
              maxSize={20}
              onFileSelect={handleFileSelect}
            />
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">CSV Format Guidelines</CardTitle>
            <CardDescription>
              For best results, ensure your CSV includes the following data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Required Fields:</p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                  <li>Tracking Numbers</li>
                  <li>Package Weight</li>
                  <li>Service Type (e.g., Ground, Express)</li>
                  <li>Shipping Cost</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Optional Fields:</p>
                <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                  <li>Package Dimensions (L x W x H)</li>
                  <li>Destination Address/Zip</li>
                  <li>Residential/Commercial Indicator</li>
                  <li>Shipment Date</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-md">
              <div className="flex items-center mb-2">
                <FileType className="h-4 w-4 mr-2 text-muted-foreground" />
                <p className="text-sm font-medium">Sample CSV Format</p>
              </div>
              <code className="text-xs">
                tracking_id,package_weight,service_type,shipping_cost,destination,length,width,height<br />
                1Z999AA10123456784,5.2,Ground,12.50,90210,12,8,6<br />
                1Z999AA10123456785,10.7,Express,25.75,10001,14,10,8
              </code>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="primary"
            iconRight={<ArrowRight className="h-4 w-4" />}
            onClick={handleContinue}
            disabled={!file || isProcessing}
            loading={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Continue to Column Mapping'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Upload;
