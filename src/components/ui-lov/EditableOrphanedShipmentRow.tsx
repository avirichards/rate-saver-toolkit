import React, { useState, useMemo, useEffect } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui-lov/Button';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { UniversalServiceSelector } from '@/components/ui-lov/UniversalServiceSelector';
import { AccountSelector } from '@/components/ui-lov/AccountSelector';
import { RotateCw, AlertCircle } from 'lucide-react';
import { formatCurrency, getSavingsColor, cn } from '@/lib/utils';
import { getStateFromZip } from '@/utils/zipToStateMapping';
import { supabase } from '@/integrations/supabase/client';
import { UniversalServiceCategory, UNIVERSAL_SERVICES } from '@/utils/universalServiceCategories';
import { mapServiceToServiceCode } from '@/utils/serviceMapping';
import { toast } from 'sonner';

interface EditableOrphanedShipmentRowProps {
  shipment: any;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onFieldUpdate: (shipmentId: number, field: string, value: string) => void;
  onReanalyze: (shipmentId: number) => void;
  isReanalyzing: boolean;
  editMode: boolean;
  getShipmentMarkup: (shipment: any) => { markedUpPrice: number; margin: number; marginPercent: number };
}

export function EditableOrphanedShipmentRow({
  shipment,
  isSelected,
  onSelect,
  onFieldUpdate,
  onReanalyze,
  isReanalyzing,
  editMode,
  getShipmentMarkup
}: EditableOrphanedShipmentRowProps) {
  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});

  // Clear local changes when shipment data is updated (after re-analysis)
  useEffect(() => {
    setLocalChanges({});
  }, [shipment.savings, shipment.ShipPros_cost, shipment.savingsPercent, shipment.reanalyzedAt, shipment.weight, shipment.length, shipment.width, shipment.height]);

  // Load account names when accountId changes
  useEffect(() => {
    const loadAccountName = async () => {
      if (shipment.accountId && !accountNames[shipment.accountId]) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('carrier_configs')
          .select('id, account_name')
          .eq('user_id', user.id)
          .eq('id', shipment.accountId)
          .single();

        if (data) {
          setAccountNames(prev => ({
            ...prev,
            [data.id]: data.account_name
          }));
        }
      }
    };

    loadAccountName();
  }, [shipment.accountId, accountNames]);

  const handleFieldSave = async (field: string, value: string) => {
    console.log('🔧 Orphaned field update:', { 
      shipmentId: shipment.id, 
      field, 
      oldValue: shipment[field], 
      newValue: value 
    });
    
    // Validate key fields
    if (field === 'weight' && value) {
      const weightNum = parseFloat(value);
      if (isNaN(weightNum) || weightNum <= 0) {
        toast.error('Weight must be a positive number');
        return;
      }
    }
    
    if ((field === 'length' || field === 'width' || field === 'height') && value) {
      const dimNum = parseFloat(value);
      if (isNaN(dimNum) || dimNum <= 0) {
        toast.error('Dimensions must be positive numbers');
        return;
      }
    }
    
    setLocalChanges(prev => ({ ...prev, [field]: value }));
    onFieldUpdate(shipment.id, field, value);
  };

  const getDisplayValue = (field: string) => {
    const value = localChanges[field] ?? shipment[field] ?? '';
    return value;
  };

  // Check if a field is missing or invalid for orphaned shipments
  const isFieldMissing = (field: string) => {
    const value = getDisplayValue(field);
    switch (field) {
      case 'originZip':
      case 'destinationZip':
        return !value || value.toString().trim() === '';
      case 'weight':
        return !value || parseFloat(value.toString()) <= 0;
      case 'service':
      case 'ShipPros_service':
        return !value || value.toString().trim() === '';
      default:
        return false;
    }
  };

  // Get error styling for missing fields
  const getFieldErrorClass = (field: string) => {
    return isFieldMissing(field) ? 'border-destructive bg-destructive/5' : '';
  };

  // Convert string service names to UniversalServiceCategory and vice versa
  const getServiceEnumValue = (serviceName: string): UniversalServiceCategory => {
    if (!serviceName) return UniversalServiceCategory.GROUND;
    
    // If it's already an enum value, return it
    if (Object.values(UniversalServiceCategory).includes(serviceName as UniversalServiceCategory)) {
      return serviceName as UniversalServiceCategory;
    }
    
    // Try to find by display name
    const serviceByDisplayName = Object.values(UNIVERSAL_SERVICES).find(
      s => s.displayName.toLowerCase() === serviceName.toLowerCase()
    );
    if (serviceByDisplayName) {
      return serviceByDisplayName.category;
    }
    
    // Use mapping utility as fallback
    const mapping = mapServiceToServiceCode(serviceName);
    return mapping.standardizedService;
  };

  const getServiceDisplayName = (serviceValue: string): string => {
    if (!serviceValue) return 'Ground';
    
    // If it's an enum value, get the display name
    if (Object.values(UniversalServiceCategory).includes(serviceValue as UniversalServiceCategory)) {
      return UNIVERSAL_SERVICES[serviceValue as UniversalServiceCategory]?.displayName || serviceValue;
    }
    
    // Otherwise return as-is (it's likely already a display name)
    return serviceValue;
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  // For orphaned shipments, show error states
  const estimatedSavings = useMemo(() => {
    // If there are ANY local changes, show pending state
    if (Object.keys(localChanges).length > 0) {
      return {
        savings: 0,
        savingsPercent: 0,
        ShipPros_cost: 0,
        isPending: true
      };
    }

    // For orphaned shipments, show error state
    return {
      savings: 0,
      savingsPercent: 0,
      ShipPros_cost: 0,
      isError: true
    };
  }, [localChanges, shipment, getShipmentMarkup]);

  // Check if all required fields are present for re-analysis
  const canReanalyze = !isFieldMissing('originZip') && 
                      !isFieldMissing('destinationZip') && 
                      !isFieldMissing('weight') && 
                      (!isFieldMissing('service') || !isFieldMissing('ShipPros_service'));

  return (
    <TableRow className={cn(
      "border-l-4 border-l-amber-500/50",
      isSelected ? 'bg-muted/50' : '',
      hasChanges ? 'border-l-primary/50' : ''
    )}>
      {editMode && (
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
      )}
      
      <TableCell className="font-medium">
        <div className="flex items-center gap-2 truncate w-24">
          <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
          {shipment.trackingId || `Orphan-${shipment.id}`}
        </div>
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div>
            <InlineEditableField
              value={getDisplayValue('originZip')}
              onSave={(value) => handleFieldSave('originZip', value)}
              placeholder="Origin ZIP"
              className={cn("w-20 text-xs", getFieldErrorClass('originZip'))}
              minWidth="80px"
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
          <div className="w-16">
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
              onSave={(value) => handleFieldSave('destinationZip', value)}
              placeholder="Dest ZIP"
              className={cn("w-20 text-xs", getFieldErrorClass('destinationZip'))}
              minWidth="80px"
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
          <div className="w-16">
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
              onSave={(value) => handleFieldSave('weight', value)}
              placeholder="Weight"
              className={cn("w-16 text-xs", getFieldErrorClass('weight'))}
              minWidth="64px"
            />
            {isFieldMissing('weight') && (
              <div className="text-xs text-destructive mt-1">Required</div>
            )}
          </div>
        ) : (
          <div>
            {(getDisplayValue('weight') && parseFloat(getDisplayValue('weight')) > 0) ? (
              `${getDisplayValue('weight')} lbs`
            ) : (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            )}
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div className="flex items-center gap-0.5 text-xs w-24">
            <InlineEditableField
              value={getDisplayValue('length') || '12'}
              onSave={(value) => handleFieldSave('length', value)}
              placeholder="L"
              className="w-7 text-xs p-1 h-6"
              minWidth="28px"
              showIcon={false}
            />
            <span className="text-muted-foreground">×</span>
            <InlineEditableField
              value={getDisplayValue('width') || '12'}
              onSave={(value) => handleFieldSave('width', value)}
              placeholder="W"
              className="w-7 text-xs p-1 h-6"
              minWidth="28px"
              showIcon={false}
            />
            <span className="text-muted-foreground">×</span>
            <InlineEditableField
              value={getDisplayValue('height') || '6'}
              onSave={(value) => handleFieldSave('height', value)}
              placeholder="H"
              className="w-7 text-xs p-1 h-6"
              minWidth="28px"
              showIcon={false}
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
      
      {/* Current Service - NOT editable, shows original service */}
      <TableCell>
        {getDisplayValue('customer_service') || getDisplayValue('service') || (
          <Badge variant="destructive" className="text-xs">Missing</Badge>
        )}
      </TableCell>
      
      {/* Ship Pros Service - Editable */}
      <TableCell>
        {editMode ? (
          <div>
            <UniversalServiceSelector
              value={getServiceEnumValue(getDisplayValue('ShipPros_service') || getDisplayValue('service') || 'GROUND')}
              onValueChange={(value) => {
                console.log('Service changed:', { from: getDisplayValue('ShipPros_service'), to: value });
                handleFieldSave('ShipPros_service', value);
              }}
              placeholder="Select Service"
              className={cn("w-24 text-xs", getFieldErrorClass('ShipPros_service'))}
            />
            {isFieldMissing('ShipPros_service') && isFieldMissing('service') && (
              <div className="text-xs text-destructive mt-1">Required</div>
            )}
          </div>
        ) : (
          <div>
            {getDisplayValue('ShipPros_service') || getDisplayValue('service') || (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            )}
          </div>
        )}
      </TableCell>
      
      {/* Account Selection */}
      {editMode && (
        <TableCell>
          <AccountSelector
            value={getDisplayValue('accountId') || shipment.accountId || ''}
            onValueChange={(value) => {
              console.log('Account changed:', { from: getDisplayValue('accountId'), to: value });
              handleFieldSave('accountId', value);
            }}
            placeholder="Select Account"
            className="w-32 text-xs"
          />
        </TableCell>
      )}
      
      <TableCell className="text-right">
        {(() => {
          return shipment.currentRate && shipment.currentRate !== 0 ? 
            formatCurrency(shipment.currentRate) : 
            <Badge variant="secondary" className="text-xs">No Rate</Badge>;
        })()}
      </TableCell>
      
      <TableCell className="text-right">
        {estimatedSavings.isPending ? (
          <span className="text-xs text-muted-foreground italic">Pending</span>
        ) : estimatedSavings.isError ? (
          <Badge variant="destructive" className="text-xs">Error</Badge>
        ) : (
          formatCurrency(shipment.ShipPros_cost || 0)
        )}
      </TableCell>
      
      <TableCell className="text-right">
        {estimatedSavings.isPending ? (
          <span className="text-xs text-orange-500 italic">Re-analyze needed</span>
        ) : estimatedSavings.isError ? (
          <Badge variant="destructive" className="text-xs">Failed</Badge>
        ) : (
          <div className="text-destructive flex flex-col items-end">
            <div className="font-medium">
              {formatCurrency(0)}
            </div>
            <div className="text-xs">
              0.0%
            </div>
          </div>
        )}
      </TableCell>
      
      {editMode && (
        <TableCell>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReanalyze(shipment.id)}
            disabled={!canReanalyze || isReanalyzing}
            className="h-8 text-xs"
          >
            {isReanalyzing ? (
              <RotateCw className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RotateCw className="h-3 w-3 mr-1" />
            )}
            Fix & Analyze
          </Button>
        </TableCell>
      )}
      
      {!editMode && (
        <TableCell>
          <Badge variant="destructive" className="text-xs">
            Failed
          </Badge>
        </TableCell>
      )}
    </TableRow>
  );
}
