import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { getStateFromZip } from '@/utils/zipToStateMapping';

interface OrphanedShipmentRowProps {
  shipment: any;
  onFixAndAnalyze: (shipmentId: number, updatedData: any) => void;
  isFixing: boolean;
}

export function OrphanedShipmentRow({
  shipment,
  onFixAndAnalyze,
  isFixing
}: OrphanedShipmentRowProps) {
  const [updatedData, setUpdatedData] = useState<Record<string, string>>({});

  const handleFieldUpdate = (field: string, value: string) => {
    setUpdatedData(prev => ({ ...prev, [field]: value }));
  };

  const getDisplayValue = (field: string) => {
    return updatedData[field] ?? shipment[field] ?? '';
  };

  const handleFixAndAnalyze = () => {
    onFixAndAnalyze(shipment.id, {
      ...shipment,
      ...updatedData
    });
  };

  // Determine what data is missing
  const missingFields = [];
  if (!getDisplayValue('originZip')) missingFields.push('Origin ZIP');
  if (!getDisplayValue('destinationZip')) missingFields.push('Destination ZIP');
  if (!getDisplayValue('weight') || getDisplayValue('weight') === '0') missingFields.push('Weight');
  if (!getDisplayValue('service')) missingFields.push('Service Type');

  const canFix = missingFields.length === 0;

  return (
    <TableRow className="border-l-4 border-l-amber-500/50">
      <TableCell>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="font-medium">
            {shipment.trackingId || `Orphan-${shipment.id}`}
          </span>
        </div>
      </TableCell>
      
      <TableCell>
        <InlineEditableField
          value={getDisplayValue('originZip')}
          onSave={(value) => handleFieldUpdate('originZip', value)}
          placeholder="Enter Origin ZIP"
          className="min-w-[80px]"
        />
        {getDisplayValue('originZip') && (
          <div className="text-xs text-muted-foreground">
            {getStateFromZip(getDisplayValue('originZip'))?.state || ''}
          </div>
        )}
      </TableCell>
      
      <TableCell>
        <InlineEditableField
          value={getDisplayValue('destinationZip')}
          onSave={(value) => handleFieldUpdate('destinationZip', value)}
          placeholder="Enter Dest ZIP"
          className="min-w-[80px]"
        />
        {getDisplayValue('destinationZip') && (
          <div className="text-xs text-muted-foreground">
            {getStateFromZip(getDisplayValue('destinationZip'))?.state || ''}
          </div>
        )}
      </TableCell>
      
      <TableCell>
        <InlineEditableField
          value={getDisplayValue('weight')}
          onSave={(value) => handleFieldUpdate('weight', value)}
          placeholder="Enter Weight"
          className="min-w-[60px]"
        />
      </TableCell>
      
      <TableCell>
        <div className="flex gap-1">
          <InlineEditableField
            value={getDisplayValue('length') || '12'}
            onSave={(value) => handleFieldUpdate('length', value)}
            placeholder="L"
            className="min-w-[40px]"
          />
          ×
          <InlineEditableField
            value={getDisplayValue('width') || '12'}
            onSave={(value) => handleFieldUpdate('width', value)}
            placeholder="W"
            className="min-w-[40px]"
          />
          ×
          <InlineEditableField
            value={getDisplayValue('height') || '6'}
            onSave={(value) => handleFieldUpdate('height', value)}
            placeholder="H"
            className="min-w-[40px]"
          />
        </div>
      </TableCell>
      
      <TableCell>
        <InlineEditableField
          value={getDisplayValue('service')}
          onSave={(value) => handleFieldUpdate('service', value)}
          placeholder="Enter Service Type"
          className="min-w-[120px]"
        />
      </TableCell>
      
      <TableCell>
        <div className="space-y-1">
          <Badge variant="destructive" className="text-xs">
            Failed
          </Badge>
          <div className="text-xs text-muted-foreground">
            {shipment.error || 'Processing failed'}
          </div>
        </div>
      </TableCell>
      
      <TableCell>
        {missingFields.length > 0 && (
          <div className="text-xs text-amber-600 mb-2">
            Missing: {missingFields.join(', ')}
          </div>
        )}
        <Button
          size="sm"
          onClick={handleFixAndAnalyze}
          disabled={!canFix || isFixing}
          className="h-8"
        >
          {isFixing ? (
            <>
              <CheckCircle className="h-3 w-3 mr-1 animate-pulse" />
              Fixing...
            </>
          ) : (
            <>
              <CheckCircle className="h-3 w-3 mr-1" />
              Fix & Analyze
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}