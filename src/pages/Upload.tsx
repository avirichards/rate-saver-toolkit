
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { FileUpload } from '@/components/ui-lov/FileUpload';
import { toast } from 'sonner';

const Upload = () => {
  const navigate = useNavigate();
  
  const handleFileUpload = (file) => {
    // In a real app, this would process the file
    console.log("File uploaded:", file);
    toast.success('File uploaded successfully!');
    
    // Navigate to the mapping page
    setTimeout(() => {
      navigate('/mapping', { 
        state: { 
          fileName: file.name,
          fileUploaded: true,
        } 
      });
    }, 1000);
  };
  
  const handleError = (error) => {
    console.error("Upload error:", error);
    toast.error(error || 'An error occurred while uploading the file.');
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
              maxFileSizeMB={10}
            />
            
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Instructions:</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>File must be in CSV format</li>
                <li>Maximum file size is 10MB</li>
                <li>Headers should be included in the first row</li>
                <li>Required columns: tracking ID, weight, service type, and cost</li>
                <li>Optional columns: dimensions, zones, and accessorial charges</li>
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
                    <td className="py-2 px-3">UPS Ground</td>
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
              <a 
                href="#"
                className="text-sm text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  toast.success('Sample CSV downloaded');
                }}
              >
                Download sample CSV template
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Upload;
