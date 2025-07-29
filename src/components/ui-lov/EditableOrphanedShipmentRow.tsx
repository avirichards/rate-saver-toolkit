import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { UniversalServiceSelector } from '@/components/ui-lov/UniversalServiceSelector';
import { CheckCircle, AlertTriangle, RotateCw } from 'lucide-react';
import { getStateFromZip } from '@/utils/zipToStateMapping';
import { cn } from '@/lib/utils';

interface EditableOrphanedShipmentRowProps {
  shipment: any;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onFixAndAnalyze: (shipmentId: number, updatedData: any) => Promise<void>;
  isFixing: boolean;
  editMode: boolean;
  rowIndex: number;
}

export function EditableOrphanedShipmentRow({
  shipment,
  isSelected,
  onSelect,
  onFixAndAnalyze,
  isFixing,
  editMode,
  rowIndex
}: EditableOrphanedShipmentRowProps) {
  const [updatedData, setUpdatedData] = useState<Record<string, string>>({});

  const handleFieldUpdate = (field: string, value: string) => {
    setUpdatedData(prev => ({ ...prev, [field]: value }));
  };

  const getDisplayValue = (field: string) => {
    return updatedData[field] ?? shipment[field] ?? '';
  };

  const handleFixAndAnalyze = async () => {
    await onFixAndAnalyze(shipment.id, {
      ...shipment,
      ...updatedData
    });
  };

  // Determine what data is missing or invalid
  const getMissingFields = () => {
    const missingFields = [];
    if (!getDisplayValue('originZip')) missingFields.push('Origin ZIP');
    if (!getDisplayValue('destinationZip')) missingFields.push('Destination ZIP');
    if (!getDisplayValue('weight') || getDisplayValue('weight') === '0') missingFields.push('Weight');
    if (!getDisplayValue('service')) missingFields.push('Service Type');
    return missingFields;
  };

  const missingFields = getMissingFields();
  const canFix = missingFields.length === 0;
  const hasChanges = Object.keys(updatedData).length > 0;

  // Check if a field is missing/invalid
  const isFieldMissing = (field: string) => {
    if (field === 'originZip') return !getDisplayValue('originZip');
    if (field === 'destinationZip') return !getDisplayValue('destinationZip');
    if (field === 'weight') return !getDisplayValue('weight') || getDisplayValue('weight') === '0';
    if (field === 'service') return !getDisplayValue('service');
    return false;
  };

  // Get error styling for missing fields
  const getFieldErrorClass = (field: string) => {
    return isFieldMissing(field) ? 'border-destructive bg-destructive/5' : '';
  };

  return (
    <TableRow className={cn(
      "border-l-4 border-l-amber-500/50",
      isSelected ? 'bg-muted/50' : '',
      hasChanges ? 'bg-blue-50/50' : '',
      rowIndex % 2 === 0 ? "bg-background" : "bg-muted/20"
    )}>
      {editMode && (
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
          />
        </TableCell>
      )}
      
      <TableCell>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="font-medium">
            {shipment.trackingId || `Orphan-${shipment.id}`}
          </span>
        </div>
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div>
            <InlineEditableField
              value={getDisplayValue('originZip')}
              onSave={(value) => handleFieldUpdate('originZip', value)}
              placeholder="Enter Origin ZIP"
              className={cn("min-w-[80px] text-xs", getFieldErrorClass('originZip'))}
            />
            {getDisplayValue('originZip') && (
              <div className="text-xs text-muted-foreground mt-1">
                {getStateFromZip(getDisplayValue('originZip'))?.state || ''}
              </div>
            )}
            {isFieldMissing('originZip') && (
              <div className="text-xs text-destructive mt-1">Required</div>
            )}
          </div>
        ) : (
          <div>
            {getDisplayValue('originZip') || (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            )}
            {getDisplayValue('originZip') && (
              <div className="text-xs text-muted-foreground">
                {getStateFromZip(getDisplayValue('originZip'))?.state || ''}
              </div>
            )}
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div>
            <InlineEditableField
              value={getDisplayValue('destinationZip')}
              onSave={(value) => handleFieldUpdate('destinationZip', value)}
              placeholder="Enter Dest ZIP"
              className={cn("min-w-[80px] text-xs", getFieldErrorClass('destinationZip'))}
            />
            {getDisplayValue('destinationZip') && (
              <div className="text-xs text-muted-foreground mt-1">
                {getStateFromZip(getDisplayValue('destinationZip'))?.state || ''}
              </div>
            )}
            {isFieldMissing('destinationZip') && (
              <div className="text-xs text-destructive mt-1">Required</div>
            )}
          </div>
        ) : (
          <div>
            {getDisplayValue('destinationZip') || (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            )}
            {getDisplayValue('destinationZip') && (
              <div className="text-xs text-muted-foreground">
                {getStateFromZip(getDisplayValue('destinationZip'))?.state || ''}
              </div>
            )}
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div>
            <InlineEditableField
              value={getDisplayValue('weight')}
              onSave={(value) => handleFieldUpdate('weight', value)}
              placeholder="Enter Weight"
              className={cn("min-w-[60px] text-xs", getFieldErrorClass('weight'))}
            />
            {isFieldMissing('weight') && (
              <div className="text-xs text-destructive mt-1">Required</div>
            )}
          </div>
        ) : (
          <div>
            {(getDisplayValue('weight') && parseFloat(getDisplayValue('weight')) > 0) ? (
              `${parseFloat(getDisplayValue('weight')).toFixed(1)} lbs`
            ) : (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            )}
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div className="flex gap-1">
            <InlineEditableField
              value={getDisplayValue('length') || '12'}
              onSave={(value) => handleFieldUpdate('length', value)}
              placeholder="L"
              className="min-w-[40px] text-xs"
            />
            ×
            <InlineEditableField
              value={getDisplayValue('width') || '12'}
              onSave={(value) => handleFieldUpdate('width', value)}
              placeholder="W"
              className="min-w-[40px] text-xs"
            />
            ×
            <InlineEditableField
              value={getDisplayValue('height') || '6'}
              onSave={(value) => handleFieldUpdate('height', value)}
              placeholder="H"
              className="min-w-[40px] text-xs"
            />
          </div>
        ) : (
          <span className="text-xs">
            {(() => {
              const length = getDisplayValue('length') || '12';
              const width = getDisplayValue('width') || '12';
              const height = getDisplayValue('height') || '6';
              return `${length}×${width}×${height}`;
            })()}
          </span>
        )}
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div>
            <UniversalServiceSelector
              value={getDisplayValue('service')}
              onValueChange={(value) => handleFieldUpdate('service', value)}
              placeholder="Select Service"
              className={cn("min-w-[120px] text-xs", getFieldErrorClass('service'))}
            />
            {isFieldMissing('service') && (
              <div className="text-xs text-destructive mt-1">Required</div>
            )}
          </div>
        ) : (
          <div>
            {getDisplayValue('service') || (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            )}
          </div>
        )}
      </TableCell>
      
      <TableCell>
        <div className="space-y-1">
          <Badge variant="destructive" className="text-xs">
            Failed
          </Badge>
          {missingFields.length > 0 && (
            <div className="text-xs text-amber-600">
              Missing: {missingFields.join(', ')}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {shipment.error || 'Processing failed'}
          </div>
        </div>
      </TableCell>
      
      <TableCell>
        <div className="space-y-2">
          {!canFix && (
            <div className="text-xs text-amber-600">
              Missing: {missingFields.join(', ')}
            </div>
          )}
          <Button
            size="sm"
            onClick={handleFixAndAnalyze}
            disabled={!canFix || isFixing}
            className="h-8 text-xs"
          >
            {isFixing ? (
              <>
                <RotateCw className="h-3 w-3 mr-1 animate-spin" />
                Fixing...
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Fix & Analyze
              </>
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}