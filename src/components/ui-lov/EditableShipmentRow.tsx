import React, { useState, useMemo, useEffect } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui-lov/Button';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { UniversalServiceSelector } from '@/components/ui-lov/UniversalServiceSelector';
import { AccountSelector } from '@/components/ui-lov/AccountSelector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RotateCw, AlertCircle, Flag } from 'lucide-react';
import { formatCurrency, getSavingsColor } from '@/lib/utils';
import { getStateFromZip } from '@/utils/zipToStateMapping';
import { supabase } from '@/integrations/supabase/client';
import { UniversalServiceCategory, UNIVERSAL_SERVICES } from '@/utils/universalServiceCategories';
import { mapServiceToServiceCode } from '@/utils/serviceMapping';
import { toast } from 'sonner';

interface EditableShipmentRowProps {
  shipment: any;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onFieldUpdate: (shipmentId: number, field: string, value: string) => void;
  onReanalyze: (shipmentId: number) => void;
  isReanalyzing: boolean;
  editMode: boolean;
  getShipmentMarkup: (shipment: any) => { markedUpPrice: number; margin: number; marginPercent: number };
  isClientView?: boolean;
}

export function EditableShipmentRow({
  shipment,
  isSelected,
  onSelect,
  onFieldUpdate,
  onReanalyze,
  isReanalyzing,
  editMode,
  getShipmentMarkup,
  isClientView = false
}: EditableShipmentRowProps) {
  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});

  // Clear local changes when shipment data is updated (after re-analysis)
  // Only clear on actual re-analysis, not on user edits
  useEffect(() => {
    setLocalChanges({});
  }, [shipment.savings, shipment.ShipPros_cost, shipment.savingsPercent, shipment.reanalyzedAt]);

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
    console.log('🔧 Field update:', { 
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

  // Check if this is an orphaned shipment (has error/errorType AND no valid rate)
  const isOrphanedShipment = (shipment.error || shipment.errorType) && (!shipment.ShipPros_cost || shipment.ShipPros_cost === 0);

  // Check if a field is missing or invalid for orphaned shipments
  const isFieldMissing = (field: string) => {
    if (!isOrphanedShipment) return false;
    
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

  // Calculate estimated savings using the same logic as non-edit mode
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

    // If no local changes, use the same calculation as non-edit mode
    const markupInfo = getShipmentMarkup(shipment);
    const savings = shipment.currentRate - markupInfo.markedUpPrice;
    const savingsPercent = shipment.currentRate > 0 ? (savings / shipment.currentRate) * 100 : 0;
    
    return {
      savings,
      savingsPercent,
      ShipPros_cost: markupInfo.markedUpPrice
    };
  }, [localChanges, shipment, getShipmentMarkup]);

  return (
    <TableRow className={`${isSelected ? 'bg-muted/50' : ''} ${hasChanges ? 'border-l-4 border-l-primary/50' : ''} ${isOrphanedShipment ? 'border-l-4 border-l-amber-500/50' : ''}`}>
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
          {isOrphanedShipment && <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />}
          {shipment.trackingId || `${isOrphanedShipment ? 'Orphan' : 'Shipment'}-${shipment.id}`}
        </div>
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div>
            <InlineEditableField
              value={getDisplayValue('originZip')}
              onSave={(value) => handleFieldSave('originZip', value)}
              placeholder="Origin ZIP"
              className={`w-20 text-xs ${getFieldErrorClass('originZip')}`}
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
            <div className={`flex items-center gap-1 ${
              (getDisplayValue('originZip') && getDisplayValue('originZip').toString().length <= 4) ? 'text-red-500 font-medium' : ''
            }`}>
              {getDisplayValue('originZip') || (isOrphanedShipment ? (
                <Badge variant="destructive" className="text-xs">Missing</Badge>
              ) : '')}
              {getDisplayValue('originZip') && getDisplayValue('originZip').toString().length <= 4 && (
                <Flag className="h-3 w-3 text-red-500" />
              )}
            </div>
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
              className={`w-20 text-xs ${getFieldErrorClass('destinationZip')}`}
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
            <div className={`flex items-center gap-1 ${
              (getDisplayValue('destinationZip') && getDisplayValue('destinationZip').toString().length <= 4) ? 'text-red-500 font-medium' : ''
            }`}>
              {getDisplayValue('destinationZip') || (isOrphanedShipment ? (
                <Badge variant="destructive" className="text-xs">Missing</Badge>
              ) : '')}
              {getDisplayValue('destinationZip') && getDisplayValue('destinationZip').toString().length <= 4 && (
                <Flag className="h-3 w-3 text-red-500" />
              )}
            </div>
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
              className={`w-16 text-xs ${getFieldErrorClass('weight')}`}
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
            ) : isOrphanedShipment ? (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            ) : '0 lbs'}
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {editMode ? (
          <div className="flex items-center gap-0.5 text-xs w-24">
            <InlineEditableField
              value={getDisplayValue('length')}
              onSave={(value) => handleFieldSave('length', value)}
              placeholder="L"
              className="w-7 text-xs p-1 h-6"
              minWidth="28px"
              showIcon={false}
            />
            <span className="text-muted-foreground">×</span>
            <InlineEditableField
              value={getDisplayValue('width')}
              onSave={(value) => handleFieldSave('width', value)}
              placeholder="W"
              className="w-7 text-xs p-1 h-6"
              minWidth="28px"
              showIcon={false}
            />
            <span className="text-muted-foreground">×</span>
            <InlineEditableField
              value={getDisplayValue('height')}
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
              // Get dimensions from shipment object (from recommendations) or fallback to processed shipment data
              const length = shipment.originalShipment?.length || shipment.length;
              const width = shipment.originalShipment?.width || shipment.width;
              const height = shipment.originalShipment?.height || shipment.height;
              
              const formatDimension = (dim: any) => {
                if (!dim || dim === '' || dim === null || dim === undefined) {
                  return <Badge variant="destructive" className="text-xs">Missing</Badge>;
                }
                return dim;
              };
              
              return (
                <div className="flex items-center gap-0.5">
                  {formatDimension(length)}
                  <span className="text-muted-foreground">×</span>
                  {formatDimension(width)}
                  <span className="text-muted-foreground">×</span>
                  {formatDimension(height)}
                </div>
              );
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
      
      {/* Current Service - NOT editable */}
      <TableCell>
        {(() => {
          const currentService = getDisplayValue('customer_service') || getDisplayValue('service') || shipment.customer_service || shipment.service;
          const displayService = currentService === 'Unknown' ? null : currentService;
          
          if (!displayService) {
            return <Badge variant="destructive" className="text-xs">Missing</Badge>;
          }
          
          return displayService;
        })()}
      </TableCell>
      
      {/* Ship Pros Service - Editable */}
      <TableCell>
        {editMode ? (
          <div>
            <UniversalServiceSelector
              value={getServiceEnumValue(getDisplayValue('ShipPros_service') || shipment.ShipPros_service || getDisplayValue('service') || 'GROUND')}
              onValueChange={(value) => {
                console.log('Service changed:', { from: getDisplayValue('ShipPros_service'), to: value });
                handleFieldSave('ShipPros_service', value);
              }}
              placeholder="Select Service"
              className={`w-24 text-xs ${getFieldErrorClass('ShipPros_service')}`}
            />
            {isFieldMissing('ShipPros_service') && isFieldMissing('service') && (
              <div className="text-xs text-destructive mt-1">Required</div>
            )}
          </div>
        ) : (
          <div>
            {getDisplayValue('ShipPros_service') || shipment.ShipPros_service || getDisplayValue('service') || (isOrphanedShipment ? (
              <Badge variant="destructive" className="text-xs">Missing</Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-primary truncate">Ground</Badge>
            ))}
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
          // Handle the weird currentRate structure from database
          let actualRate = shipment.currentRate;
          if (actualRate && typeof actualRate === 'object' && actualRate._type === 'undefined') {
            actualRate = null;
          }
          
          return actualRate ? formatCurrency(actualRate) : (isOrphanedShipment ? (
            <Badge variant="secondary" className="text-xs">No Rate</Badge>
          ) : formatCurrency(0));
        })()}
      </TableCell>
      
      {/* Ship Pros Rate - Only in Edit Mode */}
      {editMode && (
        <TableCell className="text-right">
          {estimatedSavings.isPending ? (
            <span className="text-xs text-muted-foreground italic">Pending</span>
          ) : shipment.ShipPros_cost ? formatCurrency(shipment.ShipPros_cost) : (
            <Badge variant="secondary" className="text-xs">No Rate</Badge>
          )}
        </TableCell>
      )}
      
      {/* Savings - Only in Edit Mode */}
      {editMode && (
        <TableCell className="text-right">
          {estimatedSavings.isPending ? (
            <span className="text-xs text-muted-foreground italic">Pending</span>
          ) : isOrphanedShipment ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="text-xs cursor-help">Failed</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{shipment.error || 'Processing failed due to missing or invalid data'}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className={`${getSavingsColor(estimatedSavings.savings)} flex flex-col items-end`}>
              <div className="font-medium">
                {formatCurrency(estimatedSavings.savings)}
              </div>
              <div className="text-xs">
                {estimatedSavings.savingsPercent?.toFixed(1)}%
              </div>
            </div>
          )}
        </TableCell>
      )}
      
      {/* Ship Pros Rate - Always show, but different positioning */}
      {!editMode && (
        <TableCell className="text-right">
          {shipment.ShipPros_cost ? formatCurrency(shipment.ShipPros_cost) : (
            <Badge variant="secondary" className="text-xs">No Rate</Badge>
          )}
        </TableCell>
      )}
      
      {/* Status/Savings - Only in Non-Edit Mode */}
      {!editMode && (
        <TableCell className="text-right">
          {estimatedSavings.isPending ? (
            <span className="text-xs text-muted-foreground italic">Pending</span>
          ) : isOrphanedShipment ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="text-xs cursor-help">Failed</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{shipment.error || 'Processing failed due to missing or invalid data'}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className={`${getSavingsColor(estimatedSavings.savings)} flex flex-col items-end`}>
              <div className="font-medium">
                {formatCurrency(estimatedSavings.savings)}
              </div>
              <div className="text-xs">
                {estimatedSavings.savingsPercent?.toFixed(1)}%
              </div>
            </div>
          )}
        </TableCell>
      )}
      
      {/* Account - Only in Non-Edit Mode and Non-Client View */}
      {!editMode && !isClientView && (
        <TableCell>
          {accountNames[shipment.accountId] || shipment.analyzedWithAccount || 'Unknown'}
        </TableCell>
      )}
      
      {editMode && (
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
      )}
    </TableRow>
  );
}