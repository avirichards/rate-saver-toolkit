
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, FileText } from 'lucide-react';

interface ValidationSummaryProps {
  fileName: string;
  csvData: any[];
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({ 
  fileName, 
  csvData 
}) => {
  const totalShipments = csvData?.length || 0;
  
  // Basic validation - check for required fields
  const validShipments = csvData?.filter(shipment => 
    shipment.originZip && shipment.destZip && shipment.weight
  ).length || 0;
  
  const invalidShipments = totalShipments - validShipments;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Data Validation Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <div className="font-medium">File Name</div>
              <div className="text-sm text-muted-foreground">{fileName}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <div className="font-medium">Valid Shipments</div>
              <div className="text-sm text-muted-foreground">{validShipments} of {totalShipments}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <div className="font-medium">Issues Found</div>
              <div className="text-sm text-muted-foreground">{invalidShipments} shipments</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          {invalidShipments === 0 ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              All shipments valid
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {invalidShipments} shipments need attention
            </Badge>
          )}
        </div>

        {invalidShipments > 0 && (
          <div className="bg-amber-50 p-3 rounded-lg">
            <p className="text-sm text-amber-800">
              Some shipments are missing required data (origin zip, destination zip, or weight). 
              These will be skipped during analysis.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
