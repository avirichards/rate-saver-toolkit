import React, { useState, useMemo } from 'react';
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

  // Calculate estimated savings based on changed service
  const estimatedSavings = useMemo(() => {
    const changedService = getDisplayValue('newService');
    if (!changedService || changedService === (shipment.newService || shipment.bestService)) {
      // No service change, use original savings
      return {
        savings: shipment.savings,
        savingsPercent: shipment.savingsPercent,
        newRate: shipment.newRate
      };
    }

    // If service changed, show estimated savings as "Pending Re-analysis"
    // In a real implementation, you might want to estimate based on historical data
    return {
      savings: 0,
      savingsPercent: 0,
      newRate: 0,
      isPending: true
    };
  }, [localChanges, shipment]);

  return (
    <TableRow className={`${isSelected ? 'bg-muted/50' : ''} ${hasChanges ? 'border-l-4 border-l-primary/50' : ''}`}>
      <TableCell>
        <div className="flex items-center gap-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
          />
          {hasChanges && (
            <AlertCircle className="h-3 w-3 text-amber-500" />
          )}
        </div>
      </TableCell>
      
      <TableCell className="font-medium">
        <div className="truncate w-32">
          {shipment.trackingId || `Shipment-${shipment.id}`}
        </div>
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <InlineEditableField
            value={getDisplayValue('originZip')}
            onSave={(value) => handleFieldSave('originZip', value)}
            placeholder="Origin ZIP"
            className="w-16 text-xs"
          />
        ) : (
          <div className="w-16">
            {getDisplayValue('originZip')}
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
            onSave={(value) => handleFieldSave('destinationZip', value)}
            placeholder="Dest ZIP"
            className="w-16 text-xs"
          />
        ) : (
          <div className="w-16">
            {getDisplayValue('destinationZip')}
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
            onSave={(value) => handleFieldSave('weight', value)}
            placeholder="Weight"
            className="w-12 text-xs"
          />
        ) : (
          `${getDisplayValue('weight')} lbs`
        )}
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div className="flex items-center gap-0.5 text-xs min-w-[90px]">
            <InlineEditableField
              value={getDisplayValue('length') || '12'}
              onSave={(value) => handleFieldSave('length', value)}
              placeholder="L"
              className="w-7 text-xs p-1 h-6"
            />
            <span className="text-muted-foreground">×</span>
            <InlineEditableField
              value={getDisplayValue('width') || '12'}
              onSave={(value) => handleFieldSave('width', value)}
              placeholder="W"
              className="w-7 text-xs p-1 h-6"
            />
            <span className="text-muted-foreground">×</span>
            <InlineEditableField
              value={getDisplayValue('height') || '6'}
              onSave={(value) => handleFieldSave('height', value)}
              placeholder="H"
              className="w-7 text-xs p-1 h-6"
            />
          </div>
        ) : (
          <span className="text-xs">{`${getDisplayValue('length') || 12}×${getDisplayValue('width') || 12}×${getDisplayValue('height') || 6}`}</span>
        )}
      </TableCell>
      
      {/* Current Service - NOT editable */}
      <TableCell>
        <Badge variant="outline" className="text-xs truncate">
          {getDisplayValue('service') || getDisplayValue('originalService')}
        </Badge>
      </TableCell>
      
      {/* Ship Pros Service - Editable */}
      <TableCell>
        {editMode ? (
          <UpsServiceSelector
            value={getDisplayValue('newService') || shipment.newService || shipment.bestService || 'UPS Ground'}
            onValueChange={(value) => handleFieldSave('newService', value)}
            placeholder="Select Service"
            className="w-32 text-xs"
          />
        ) : (
          <Badge variant="outline" className="text-xs text-primary truncate">
            {shipment.newService || shipment.bestService || 'UPS Ground'}
          </Badge>
        )}
      </TableCell>
      
      <TableCell className="text-right">
        {formatCurrency(shipment.currentRate)}
      </TableCell>
      
      <TableCell className="text-right">
        {estimatedSavings.isPending ? (
          <span className="text-xs text-muted-foreground italic">Pending</span>
        ) : (
          formatCurrency(estimatedSavings.newRate)
        )}
      </TableCell>
      
      <TableCell className="text-right">
        {estimatedSavings.isPending ? (
          <span className="text-xs text-orange-500 italic">Re-analyze needed</span>
        ) : (
          <div className={getSavingsColor(estimatedSavings.savings)}>
            {formatCurrency(estimatedSavings.savings)}
          </div>
        )}
      </TableCell>
      
      <TableCell className="text-right">
        {estimatedSavings.isPending ? (
          <span className="text-xs text-orange-500 italic">-%</span>
        ) : (
          <div className={getSavingsColor(estimatedSavings.savings)}>
            {estimatedSavings.savingsPercent?.toFixed(1)}%
          </div>
        )}
      </TableCell>
      
      <TableCell>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReanalyze(shipment.id)}
          disabled={isReanalyzing}
          className="h-8 text-xs"
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