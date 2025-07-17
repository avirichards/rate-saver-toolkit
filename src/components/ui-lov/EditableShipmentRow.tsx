import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui-lov/Button';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { UpsServiceSelector } from '@/components/ui-lov/UpsServiceSelector';
import { RotateCw, AlertCircle } from 'lucide-react';
import { formatCurrency, getSavingsColor } from '@/lib/utils';
import { getStateFromZip } from '@/utils/zipToStateMapping';

interface EditableShipmentRowProps {
  shipment: any;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onFieldUpdate: (shipmentId: number, field: string, value: string) => void;
  onReanalyze: (shipmentId: number) => void;
  isReanalyzing: boolean;
  editMode: boolean;
}

export function EditableShipmentRow({
  shipment,
  isSelected,
  onSelect,
  onFieldUpdate,
  onReanalyze,
  isReanalyzing,
  editMode
}: EditableShipmentRowProps) {
  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});

  const handleFieldSave = async (field: string, value: string) => {
    setLocalChanges(prev => ({ ...prev, [field]: value }));
    onFieldUpdate(shipment.id, field, value);
  };

  const getDisplayValue = (field: string) => {
    return localChanges[field] ?? shipment[field] ?? '';
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  return (
    <TableRow className={`${isSelected ? 'bg-muted/50' : ''} ${hasChanges ? 'border-l-4 border-l-primary/50' : ''}`}>
      <TableCell className="px-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
          />
          {hasChanges && (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      </TableCell>
      
      <TableCell className="font-medium px-2">
        {shipment.trackingId || `Shipment-${shipment.id}`}
      </TableCell>
      
      <TableCell className="px-2">
        {editMode ? (
          <InlineEditableField
            value={getDisplayValue('originZip')}
            onSave={(value) => handleFieldSave('originZip', value)}
            placeholder="Origin ZIP"
            className="min-w-[60px] max-w-[80px] text-xs"
          />
        ) : (
          <>
            {getDisplayValue('originZip')}
            {getDisplayValue('originZip') && (
              <div className="text-xs text-muted-foreground">
                {getStateFromZip(getDisplayValue('originZip'))?.state || ''}
              </div>
            )}
          </>
        )}
      </TableCell>
      
      <TableCell className="px-2">
        {editMode ? (
          <InlineEditableField
            value={getDisplayValue('destinationZip')}
            onSave={(value) => handleFieldSave('destinationZip', value)}
            placeholder="Dest ZIP"
            className="min-w-[60px] max-w-[80px] text-xs"
          />
        ) : (
          <>
            {getDisplayValue('destinationZip')}
            {getDisplayValue('destinationZip') && (
              <div className="text-xs text-muted-foreground">
                {getStateFromZip(getDisplayValue('destinationZip'))?.state || ''}
              </div>
            )}
          </>
        )}
      </TableCell>
      
      <TableCell className="px-2">
        {editMode ? (
          <InlineEditableField
            value={getDisplayValue('weight')}
            onSave={(value) => handleFieldSave('weight', value)}
            placeholder="Weight"
            className="min-w-[40px] max-w-[60px] text-xs"
          />
        ) : (
          `${getDisplayValue('weight')} lbs`
        )}
      </TableCell>
      
      <TableCell className="px-2">
        {editMode ? (
          <div className="flex gap-1 text-xs">
            <InlineEditableField
              value={getDisplayValue('length') || '12'}
              onSave={(value) => handleFieldSave('length', value)}
              placeholder="L"
              className="min-w-[30px] max-w-[35px]"
            />
            ×
            <InlineEditableField
              value={getDisplayValue('width') || '12'}
              onSave={(value) => handleFieldSave('width', value)}
              placeholder="W"
              className="min-w-[30px] max-w-[35px]"
            />
            ×
            <InlineEditableField
              value={getDisplayValue('height') || '6'}
              onSave={(value) => handleFieldSave('height', value)}
              placeholder="H"
              className="min-w-[30px] max-w-[35px]"
            />
          </div>
        ) : (
          `${getDisplayValue('length') || 12}×${getDisplayValue('width') || 12}×${getDisplayValue('height') || 6}`
        )}
      </TableCell>
      
      {/* Current Service - NOT editable */}
      <TableCell className="px-2">
        <Badge variant="outline" className="text-xs">
          {getDisplayValue('service') || getDisplayValue('originalService')}
        </Badge>
      </TableCell>
      
      {/* Ship Pros Service - Editable */}
      <TableCell className="px-2">
        {editMode ? (
          <UpsServiceSelector
            value={shipment.newService || shipment.bestService || 'UPS Ground'}
            onValueChange={(value) => handleFieldSave('newService', value)}
            placeholder="Select Service"
            className="min-w-[120px] max-w-[140px] text-xs"
          />
        ) : (
          <Badge variant="outline" className="text-xs text-primary">
            {shipment.newService || shipment.bestService || 'UPS Ground'}
          </Badge>
        )}
      </TableCell>
      
      <TableCell className="text-right px-2">
        {formatCurrency(shipment.currentRate)}
      </TableCell>
      
      <TableCell className="text-right px-2">
        {formatCurrency(shipment.newRate)}
      </TableCell>
      
      <TableCell className="text-right px-2">
        <div className={getSavingsColor(shipment.savings)}>
          {formatCurrency(shipment.savings)}
        </div>
      </TableCell>
      
      <TableCell className="text-right px-2">
        <div className={getSavingsColor(shipment.savings)}>
          {shipment.savingsPercent?.toFixed(1)}%
        </div>
      </TableCell>
      
      <TableCell className="px-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReanalyze(shipment.id)}
          disabled={isReanalyzing}
          className="h-8"
        >
          {isReanalyzing ? (
            <RotateCw className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RotateCw className="h-3 w-3 mr-1" />
          )}
          Re-analyze
        </Button>
      </TableCell>
    </TableRow>
  );
}