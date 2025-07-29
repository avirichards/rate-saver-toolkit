import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { UniversalServiceSelector } from '@/components/ui-lov/UniversalServiceSelector';
import { AccountSelector } from '@/components/ui-lov/AccountSelector';
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
  
  const hasLocalChanges = Object.keys(updatedData).length > 0;

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
    <TableRow className={`${isSelected ? 'bg-muted/50' : ''} ${hasLocalChanges ? 'border-l-4 border-l-primary/50' : ''}`}>
      {editMode && (
        <TableCell>
          <div className="flex items-center gap-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
            />
            {hasLocalChanges && (
              <AlertCircle className="h-3 w-3 text-amber-500" />
            )}
          </div>
        </TableCell>
      )}
      
      <TableCell className="font-medium">
        <div className="flex items-center gap-2 truncate w-24">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="truncate">{getDisplayValue('trackingId') || shipment.trackingId || `Orphan-${shipment.id}`}</span>
        </div>
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <InlineEditableField
            value={getDisplayValue('originZip')}
            onSave={(value) => handleFieldUpdate('originZip', value)}
            placeholder="Origin ZIP"
            className="w-20 text-xs"
            minWidth="80px"
            required
          />
        ) : (
          <div className="w-16">
            {getDisplayValue('originZip') || 'Missing'}
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
          <InlineEditableField
            value={getDisplayValue('destinationZip')}
            onSave={(value) => handleFieldUpdate('destinationZip', value)}
            placeholder="Dest ZIP"
            className="w-20 text-xs"
            minWidth="80px"
            required
          />
        ) : (
          <div className="w-16">
            {getDisplayValue('destinationZip') || 'Missing'}
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
          <InlineEditableField
            value={getDisplayValue('weight')}
            onSave={(value) => handleFieldUpdate('weight', value)}
            placeholder="Weight"
            className="w-16 text-xs"
            minWidth="64px"
            required
          />
        ) : (
          getDisplayValue('weight') ? `${getDisplayValue('weight')} lbs` : 'Missing'
        )}
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div className="flex items-center gap-0.5 text-xs w-24">
            <InlineEditableField
              value={getDisplayValue('length') || '12'}
              onSave={(value) => handleFieldUpdate('length', value)}
              placeholder="L"
              className="w-7 text-xs p-1 h-6"
              minWidth="28px"
              showIcon={false}
              required
            />
            <span className="text-muted-foreground">×</span>
            <InlineEditableField
              value={getDisplayValue('width') || '12'}
              onSave={(value) => handleFieldUpdate('width', value)}
              placeholder="W"
              className="w-7 text-xs p-1 h-6"
              minWidth="28px"
              showIcon={false}
              required
            />
            <span className="text-muted-foreground">×</span>
            <InlineEditableField
              value={getDisplayValue('height') || '6'}
              onSave={(value) => handleFieldUpdate('height', value)}
              placeholder="H"
              className="w-7 text-xs p-1 h-6"
              minWidth="28px"
              showIcon={false}
              required
            />
          </div>
        ) : (
          <span className="text-xs">
            {getDisplayValue('length') && getDisplayValue('width') && getDisplayValue('height')
              ? `${getDisplayValue('length')}×${getDisplayValue('width')}×${getDisplayValue('height')}`
              : 'Missing'}
          </span>
        )}
      </TableCell>

      {/* Residential Column */}
      <TableCell>
        {editMode ? (
          <Checkbox
            checked={getDisplayValue('isResidential') === 'true' || getDisplayValue('isResidential') === true}
            onCheckedChange={(checked) => handleFieldUpdate('isResidential', checked ? 'true' : 'false')}
          />
        ) : (
          <Badge variant="outline" className="text-xs">
            Unknown
          </Badge>
        )}
      </TableCell>

      {/* Current Service Column */}
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {getDisplayValue('originalService') || getDisplayValue('service') || 'Unknown'}
        </Badge>
      </TableCell>
      
      {/* Ship Pros Service Column */}
      <TableCell>
        {editMode ? (
          <UniversalServiceSelector
            value={getDisplayValue('service') || 'GROUND'}
            onValueChange={(value) => handleFieldUpdate('service', value)}
            placeholder="Select Service"
            className="w-24 text-xs"
          />
        ) : (
          <Badge variant="outline" className="text-xs text-primary">
            {getDisplayValue('service') || 'Ground'}
          </Badge>
        )}
      </TableCell>
      
      {editMode && (
        <TableCell>
          <AccountSelector
            value={getDisplayValue('accountId') || ''}
            onValueChange={(value) => handleFieldUpdate('accountId', value)}
            placeholder="Select Account"
            className="w-32 text-xs"
          />
        </TableCell>
      )}

      {/* Current Rate Column */}
      <TableCell className="text-right">
        <span className="text-muted-foreground text-xs">N/A</span>
      </TableCell>

      {/* Ship Pros Cost Column */}
      <TableCell className="text-right">
        <span className="text-muted-foreground text-xs">N/A</span>
      </TableCell>

      {/* Savings Column */}
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <Badge variant="destructive" className="text-xs mb-1">
            Failed
          </Badge>
          {shipment.errorMessage && (
            <span className="text-xs text-muted-foreground">
              Needs fixing
            </span>
          )}
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
          className="h-8 text-xs"
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