import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { UniversalServiceSelector } from '@/components/ui-lov/UniversalServiceSelector';
import { CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { getStateFromZip } from '@/utils/zipToStateMapping';

interface OrphanedShipmentRowProps {
  shipment: any;
  onFixAndAnalyze: (shipmentId: number, updatedData: any) => void;
  isFixing: boolean;
  editMode?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onFieldUpdate?: (shipmentId: number, field: string, value: string) => void;
}

export function OrphanedShipmentRow({
  shipment,
  onFixAndAnalyze,
  isFixing,
  editMode = false,
  isSelected = false,
  onSelect,
  onFieldUpdate
}: OrphanedShipmentRowProps) {
  const [updatedData, setUpdatedData] = useState<Record<string, string>>({});

  const handleFieldUpdate = (field: string, value: string) => {
    setUpdatedData(prev => ({ ...prev, [field]: value }));
    
    // Call parent handler if provided (for edit mode)
    if (onFieldUpdate && editMode) {
      onFieldUpdate(shipment.id, field, value);
    }
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
      {editMode && (
        <TableCell>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
            />
            {Object.keys(updatedData).length > 0 && (
              <div title="Unsaved changes">
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </div>
            )}
          </div>
        </TableCell>
      )}
      <TableCell className="w-24">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-xs">
            {shipment.trackingId || `Orphan-${shipment.id}`}
          </span>
        </div>
      </TableCell>
      
      <TableCell className="w-16">
        <InlineEditableField
          value={getDisplayValue('originZip')}
          onSave={(value) => handleFieldUpdate('originZip', value)}
          placeholder="Origin"
          className="min-w-[60px] text-xs"
        />
        {getDisplayValue('originZip') && (
          <div className="text-xs text-muted-foreground">
            {getStateFromZip(getDisplayValue('originZip'))?.state || ''}
          </div>
        )}
      </TableCell>
      
      <TableCell className="w-16">
        <InlineEditableField
          value={getDisplayValue('destinationZip')}
          onSave={(value) => handleFieldUpdate('destinationZip', value)}
          placeholder="Dest"
          className="min-w-[60px] text-xs"
        />
        {getDisplayValue('destinationZip') && (
          <div className="text-xs text-muted-foreground">
            {getStateFromZip(getDisplayValue('destinationZip'))?.state || ''}
          </div>
        )}
      </TableCell>
      
      <TableCell className="w-14">
        <InlineEditableField
          value={getDisplayValue('weight')}
          onSave={(value) => handleFieldUpdate('weight', value)}
          placeholder="Weight"
          className="min-w-[50px] text-xs"
        />
      </TableCell>
      
      <TableCell className="w-24">
        <div className="flex gap-1">
          <InlineEditableField
            value={getDisplayValue('length') || '12'}
            onSave={(value) => handleFieldUpdate('length', value)}
            placeholder="L"
            className="min-w-[30px] text-xs"
          />
          ×
          <InlineEditableField
            value={getDisplayValue('width') || '12'}
            onSave={(value) => handleFieldUpdate('width', value)}
            placeholder="W"
            className="min-w-[30px] text-xs"
          />
          ×
          <InlineEditableField
            value={getDisplayValue('height') || '6'}
            onSave={(value) => handleFieldUpdate('height', value)}
            placeholder="H"
            className="min-w-[30px] text-xs"
          />
        </div>
      </TableCell>
      
      <TableCell className="w-16">
        <Badge variant="outline" className="text-xs">
          Commercial
        </Badge>
      </TableCell>
      
      <TableCell className="w-20">
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {shipment.customer_service || shipment.service || 'Unknown'}
        </Badge>
      </TableCell>
      
      <TableCell className="w-24">
        <UniversalServiceSelector
          value={getDisplayValue('service')}
          onValueChange={(value) => handleFieldUpdate('service', value)}
          placeholder="Select Service"
          className="min-w-[100px] text-xs"
        />
      </TableCell>
      
      {editMode && (
        <TableCell className="w-32">
          <InlineEditableField
            value={getDisplayValue('accountId') || getDisplayValue('account')}
            onSave={(value) => handleFieldUpdate('accountId', value)}
            placeholder="Account"
            className="min-w-[80px] text-xs"
          />
        </TableCell>
      )}
      
      <TableCell className="text-right w-20">
        <span className="text-xs text-muted-foreground">-</span>
      </TableCell>
      
      <TableCell className="text-right w-20">
        <span className="text-xs text-muted-foreground">-</span>
      </TableCell>
      
      <TableCell className="text-right w-20">
        <div className="space-y-1">
          <Badge variant="destructive" className="text-xs">
            Failed
          </Badge>
          <div className="text-xs text-muted-foreground">
            {shipment.error || 'Processing failed'}
          </div>
        </div>
      </TableCell>
      
      {editMode && (
        <TableCell className="w-16">
          {missingFields.length > 0 && (
            <div className="text-xs text-amber-600 mb-2">
              Missing: {missingFields.join(', ')}
            </div>
          )}
          <Button
            size="sm"
            onClick={handleFixAndAnalyze}
            disabled={!canFix || isFixing}
            className="h-7 text-xs"
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
      )}
      
      {!editMode && (
        <TableCell className="w-20">
          <Badge variant="secondary" className="text-xs">
            Unknown Account
          </Badge>
        </TableCell>
      )}
    </TableRow>
  );
}