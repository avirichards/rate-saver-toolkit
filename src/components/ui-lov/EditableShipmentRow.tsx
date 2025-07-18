import React, { useState, useMemo, useEffect } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui-lov/Button';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { UpsServiceSelector } from '@/components/ui-lov/UpsServiceSelector';
import { RotateCw, AlertCircle } from 'lucide-react';
import { formatCurrency, getSavingsColor } from '@/lib/utils';
import { getStateFromZip } from '@/utils/zipToStateMapping';
import { ExpandableRateRow } from './ExpandableRateRow';

interface EditableShipmentRowProps {
  shipment: any;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onFieldUpdate: (shipmentId: number, field: string, value: string) => void;
  onReanalyze: (shipmentId: number) => void;
  isReanalyzing: boolean;
  editMode: boolean;
  getShipmentMarkup: (shipment: any) => { markedUpPrice: number; margin: number; marginPercent: number };
}

export function EditableShipmentRow({
  shipment,
  isSelected,
  onSelect,
  onFieldUpdate,
  onReanalyze,
  isReanalyzing,
  editMode,
  getShipmentMarkup
}: EditableShipmentRowProps) {
  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});

  // Clear local changes when shipment data is updated (after re-analysis)
  useEffect(() => {
    setLocalChanges({});
  }, [shipment.savings, shipment.newRate, shipment.savingsPercent]);

  const handleFieldSave = async (field: string, value: string) => {
    setLocalChanges(prev => ({ ...prev, [field]: value }));
    onFieldUpdate(shipment.id, field, value);
  };

  const getDisplayValue = (field: string) => {
    return localChanges[field] ?? shipment[field] ?? '';
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  // Calculate estimated savings using the same logic as non-edit mode
  const estimatedSavings = useMemo(() => {
    // If there are ANY local changes, show pending state
    if (Object.keys(localChanges).length > 0) {
      return {
        savings: 0,
        savingsPercent: 0,
        newRate: 0,
        isPending: true
      };
    }

    // If no local changes, use the same calculation as non-edit mode
    const markupInfo = getShipmentMarkup(shipment);
    const savings = shipment.currentRate - markupInfo.markedUpPrice;
    const savingsPercent = shipment.currentRate > 0 ? (savings / shipment.currentRate) * 100 : 0;
    
    return {
      savings,
      savingsPercent,
      newRate: markupInfo.markedUpPrice
    };
  }, [localChanges, shipment, getShipmentMarkup]);

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
      
      {/* Residential Column */}
      <TableCell>
        {editMode ? (
          <Checkbox
            checked={getDisplayValue('isResidential') === 'true' || getDisplayValue('isResidential') === true}
            onCheckedChange={(checked) => handleFieldSave('isResidential', checked ? 'true' : 'false')}
          />
        ) : (
          <Badge variant={shipment.isResidential ? "default" : "outline"} className="text-xs">
            {shipment.isResidential ? 'Residential' : 'Commercial'}
          </Badge>
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
      
      <TableCell className="text-center">
        <ExpandableRateRow
          shipment={shipment}
          rates={[
            {
              account: 'Ship Pros Account',
              rate: estimatedSavings.newRate || shipment.newRate || 0,
              savings: 0,
              savingsPercent: 0,
              isBest: true,
              isSelected: true
            }
          ]}
          onRateSelect={() => {}} // Disabled in edit mode
        />
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