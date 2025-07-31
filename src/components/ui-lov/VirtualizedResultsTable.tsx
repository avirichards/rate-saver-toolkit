import React, { memo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { TableRow, TableCell } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Edit3 } from 'lucide-react';

interface VirtualizedShipmentRow {
  id: number;
  trackingId?: string;
  originZip?: string;
  destinationZip?: string;
  weight?: number;
  currentRate?: number;
  ShipPros_cost?: number;
  savings?: number;
  savingsPercent?: number;
  customer_service?: string;
  ShipPros_service?: string;
  analyzedWithAccount?: string;
  status?: 'completed' | 'error';
}

interface VirtualizedResultsTableProps {
  shipments: VirtualizedShipmentRow[];
  height: number;
  onRowClick?: (shipment: VirtualizedShipmentRow) => void;
  showOnlyWins?: boolean;
  showOnlyLosses?: boolean;
}

const ROW_HEIGHT = 60;

const ShipmentRow = memo(({ 
  index, 
  style, 
  data 
}: { 
  index: number; 
  style: React.CSSProperties; 
  data: { 
    shipments: VirtualizedShipmentRow[]; 
    onRowClick?: (shipment: VirtualizedShipmentRow) => void;
  }; 
}) => {
  const { shipments, onRowClick } = data;
  const shipment = shipments[index];
  
  if (!shipment) return null;

  const savings = shipment.savings || 0;
  const savingsPercent = shipment.savingsPercent || 0;
  const isWin = savings > 0;
  const isLoss = savings < 0;

  const handleClick = useCallback(() => {
    onRowClick?.(shipment);
  }, [shipment, onRowClick]);

  return (
    <div 
      style={style} 
      className="flex items-center border-b hover:bg-muted/50 cursor-pointer px-4"
      onClick={handleClick}
    >
      <div className="grid grid-cols-12 gap-2 w-full items-center text-sm">
        {/* Tracking ID */}
        <div className="col-span-2 truncate">
          <div className="font-medium">{shipment.trackingId || `#${shipment.id}`}</div>
          <div className="text-xs text-muted-foreground">
            {shipment.originZip} → {shipment.destinationZip}
          </div>
        </div>

        {/* Weight */}
        <div className="col-span-1 text-center">
          {shipment.weight ? `${shipment.weight} lbs` : '-'}
        </div>

        {/* Current Cost */}
        <div className="col-span-1 text-right font-medium">
          {formatCurrency(shipment.currentRate || 0)}
        </div>

        {/* ShipPros Cost */}
        <div className="col-span-1 text-right font-medium text-green-600">
          {formatCurrency(shipment.ShipPros_cost || 0)}
        </div>

        {/* Savings */}
        <div className="col-span-1 text-right">
          <div className={`font-medium ${isWin ? 'text-green-600' : isLoss ? 'text-red-600' : 'text-muted-foreground'}`}>
            {formatCurrency(Math.abs(savings))}
          </div>
          <div className="text-xs text-muted-foreground">
            {savingsPercent.toFixed(1)}%
          </div>
        </div>

        {/* Status */}
        <div className="col-span-1 flex justify-center">
          {shipment.status === 'completed' ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>

        {/* Original Service */}
        <div className="col-span-2 truncate">
          <Badge variant="outline" className="text-xs">
            {shipment.customer_service || 'Unknown'}
          </Badge>
        </div>

        {/* Recommended Service */}
        <div className="col-span-2 truncate">
          <Badge variant="secondary" className="text-xs">
            {shipment.ShipPros_service || 'Ground'}
          </Badge>
        </div>

        {/* Account */}
        <div className="col-span-1 truncate text-xs text-muted-foreground">
          {shipment.analyzedWithAccount || 'Unknown'}
        </div>
      </div>
    </div>
  );
});

ShipmentRow.displayName = 'ShipmentRow';

export const VirtualizedResultsTable: React.FC<VirtualizedResultsTableProps> = memo(({
  shipments,
  height,
  onRowClick,
  showOnlyWins = false,
  showOnlyLosses = false
}) => {
  // Filter shipments based on wins/losses
  const filteredShipments = shipments.filter(shipment => {
    const savings = shipment.savings || 0;
    if (showOnlyWins) return savings > 0;
    if (showOnlyLosses) return savings <= 0;
    return true;
  });

  if (filteredShipments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <div className="text-lg font-medium mb-2">No shipments found</div>
          <div className="text-sm">
            {showOnlyWins ? 'No winning shipments in this analysis.' : 
             showOnlyLosses ? 'No losing shipments in this analysis.' : 
             'No shipment data available.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="bg-muted/50 border-b px-4 py-3">
        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="col-span-2">Tracking / Route</div>
          <div className="col-span-1 text-center">Weight</div>
          <div className="col-span-1 text-right">Current</div>
          <div className="col-span-1 text-right">ShipPros</div>
          <div className="col-span-1 text-right">Savings</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-2">Original Service</div>
          <div className="col-span-2">Recommended</div>
          <div className="col-span-1">Account</div>
        </div>
      </div>

      {/* Virtualized List */}
      <List
        height={height}
        itemCount={filteredShipments.length}
        itemSize={ROW_HEIGHT}
        itemData={{ shipments: filteredShipments, onRowClick }}
        overscanCount={10}
      >
        {ShipmentRow}
      </List>

      {/* Footer Stats */}
      <div className="bg-muted/50 border-t px-4 py-2 text-xs text-muted-foreground">
        Showing {filteredShipments.length.toLocaleString()} of {shipments.length.toLocaleString()} shipments
      </div>
    </div>
  );
});

VirtualizedResultsTable.displayName = 'VirtualizedResultsTable';