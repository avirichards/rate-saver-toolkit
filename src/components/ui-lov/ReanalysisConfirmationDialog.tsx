import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { UniversalServiceCategory, UNIVERSAL_SERVICES } from '@/utils/universalServiceCategories';

interface ReanalysisConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  shipment: any;
  pendingChanges: Record<string, string>;
  accountName?: string;
}

export function ReanalysisConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  shipment,
  pendingChanges,
  accountName
}: ReanalysisConfirmationDialogProps) {
  const getValue = (field: string) => pendingChanges[field] ?? shipment[field] ?? '';
  
  const getServiceDisplayName = (serviceValue: string): string => {
    if (!serviceValue) return 'Ground';
    
    if (Object.values(UniversalServiceCategory).includes(serviceValue as UniversalServiceCategory)) {
      return UNIVERSAL_SERVICES[serviceValue as UniversalServiceCategory]?.displayName || serviceValue;
    }
    
    return serviceValue;
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Re-analysis</AlertDialogTitle>
          <AlertDialogDescription>
            Re-analyze this shipment with the following values:
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-3 text-sm">
          {hasChanges && (
            <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
              <div className="font-medium text-amber-800 mb-2">Pending Changes:</div>
              {Object.entries(pendingChanges).map(([field, value]) => (
                <div key={field} className="flex justify-between items-center">
                  <span className="text-amber-700 capitalize">{field}:</span>
                  <Badge variant="secondary" className="text-xs">
                    {field === 'ShipPros_service' ? getServiceDisplayName(value) : value}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>Origin ZIP:</span>
              <Badge variant="outline">{getValue('originZip')}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Destination ZIP:</span>
              <Badge variant="outline">{getValue('destinationZip')}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Weight:</span>
              <Badge variant="outline">{getValue('weight')} lbs</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Dimensions:</span>
              <Badge variant="outline">
                {getValue('length') || 12}×{getValue('width') || 12}×{getValue('height') || 6}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Service:</span>
              <Badge variant="secondary">
                {getServiceDisplayName(getValue('ShipPros_service') || 'GROUND')}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Residential:</span>
              <Badge variant={getValue('isResidential') === 'true' ? 'default' : 'outline'}>
                {getValue('isResidential') === 'true' ? 'Yes' : 'No'}
              </Badge>
            </div>
            {accountName && (
              <div className="flex justify-between items-center">
                <span>Account:</span>
                <Badge variant="secondary">{accountName}</Badge>
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Re-analyze with these values
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}