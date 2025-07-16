import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle, Database, Info } from 'lucide-react';

interface DataIntegrityIndicatorProps {
  hasProcessedShipments: boolean;
  hasOrphanedShipments: boolean;
  totalShipments: number;
  processedCount: number;
  orphanedCount: number;
  totalSavings?: number;
  calculatedSavings?: number;
}

export const DataIntegrityIndicator: React.FC<DataIntegrityIndicatorProps> = ({
  hasProcessedShipments,
  hasOrphanedShipments,
  totalShipments,
  processedCount,
  orphanedCount,
  totalSavings = 0,
  calculatedSavings = 0
}) => {
  const accountedShipments = processedCount + orphanedCount;
  const missingShipments = Math.max(0, totalShipments - accountedShipments);
  const hasCentralizedData = hasProcessedShipments || hasOrphanedShipments;
  const savingsMismatch = Math.abs(totalSavings - calculatedSavings) > 1;

  const getStatus = () => {
    if (!hasCentralizedData) {
      return {
        variant: 'destructive' as const,
        icon: Database,
        label: 'Legacy Format',
        description: 'This analysis uses the old data format and needs migration'
      };
    }

    if (missingShipments > 0 || savingsMismatch) {
      return {
        variant: 'secondary' as const,
        icon: AlertTriangle,
        label: 'Data Issues',
        description: `${missingShipments > 0 ? `${missingShipments} missing shipments` : ''}${
          missingShipments > 0 && savingsMismatch ? ', ' : ''
        }${savingsMismatch ? 'savings calculation mismatch' : ''}`
      };
    }

    return {
      variant: 'default' as const,
      icon: CheckCircle,
      label: 'Validated',
      description: 'All data is accounted for and calculations are correct'
    };
  };

  const status = getStatus();
  const Icon = status.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={status.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {status.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{status.description}</p>
            <div className="text-xs space-y-1">
              <p>Total Shipments: {totalShipments}</p>
              <p>Processed: {processedCount}</p>
              <p>Orphaned: {orphanedCount}</p>
              {missingShipments > 0 && (
                <p className="text-destructive">Missing: {missingShipments}</p>
              )}
              {savingsMismatch && (
                <p className="text-destructive">
                  Savings: DB ${totalSavings.toFixed(2)} vs Calc ${calculatedSavings.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};