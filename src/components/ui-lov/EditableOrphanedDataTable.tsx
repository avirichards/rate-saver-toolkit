import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui-lov/Button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Edit3, RotateCw, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { EditableOrphanedShipmentRow } from './EditableOrphanedShipmentRow';

interface EditableOrphanedDataTableProps {
  orphanedData: any[];
  onFixOrphaned: (shipmentId: number, updatedData: any) => Promise<void>;
  isReanalyzing: boolean;
  reanalyzingShipments: Set<number>;
}

export function EditableOrphanedDataTable({
  orphanedData,
  onFixOrphaned,
  isReanalyzing,
  reanalyzingShipments
}: EditableOrphanedDataTableProps) {
  const [editMode, setEditMode] = useState(false);
  const [selectedShipments, setSelectedShipments] = useState<Set<number>>(new Set());

  // Clear selections when exiting edit mode
  useEffect(() => {
    if (!editMode) {
      setSelectedShipments(new Set());
    }
  }, [editMode]);

  const handleSelectShipment = (shipmentId: number, selected: boolean) => {
    setSelectedShipments(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(shipmentId);
      } else {
        next.delete(shipmentId);
      }
      return next;
    });
  };

  const handleSelectAllShipments = (selected: boolean) => {
    if (selected) {
      setSelectedShipments(new Set(orphanedData.map(item => item.id)));
    } else {
      setSelectedShipments(new Set());
    }
  };

  const handleBatchFixAttempt = () => {
    if (selectedShipments.size === 0) {
      toast.error('Please select shipments to fix');
      return;
    }

    // Check if all selected shipments have required data
    const selectedData = orphanedData.filter(item => selectedShipments.has(item.id));
    const unfixableShipments = selectedData.filter(shipment => {
      const missingFields = [];
      if (!shipment.originZip) missingFields.push('Origin ZIP');
      if (!shipment.destinationZip) missingFields.push('Destination ZIP');
      if (!shipment.weight || shipment.weight === '0') missingFields.push('Weight');
      if (!shipment.service) missingFields.push('Service Type');
      return missingFields.length > 0;
    });

    if (unfixableShipments.length > 0) {
      toast.error(`${unfixableShipments.length} selected shipments still have missing data. Please fix all required fields first.`);
      return;
    }

    toast.info('Please fix shipments individually by clicking the "Fix & Analyze" button on each row.');
  };

  if (orphanedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orphaned Shipments</CardTitle>
          <CardDescription>
            Shipments that encountered errors during processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Perfect Processing!</h3>
            <p className="text-muted-foreground">
              All shipments were successfully analyzed with no errors.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Orphaned Shipments ({orphanedData.length})
            </CardTitle>
            <CardDescription>
              Shipments that encountered errors during processing. Fix missing data and re-analyze to move them to the Shipment Data tab.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {editMode && selectedShipments.size > 0 && (
              <Button
                variant="outline"
                onClick={handleBatchFixAttempt}
                disabled={isReanalyzing}
                className="h-8 text-xs"
              >
                Fix Selected ({selectedShipments.size})
              </Button>
            )}
            <Button
              variant={editMode ? "default" : "outline"}
              onClick={() => setEditMode(!editMode)}
              disabled={isReanalyzing}
              className="h-8 text-xs"
            >
              {editMode ? (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Exit Edit
                </>
              ) : (
                <>
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit Mode
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-b border-border">
                {editMode && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedShipments.size === orphanedData.length && orphanedData.length > 0}
                      onCheckedChange={handleSelectAllShipments}
                    />
                  </TableHead>
                )}
                <TableHead className="text-foreground">Tracking ID</TableHead>
                <TableHead className="text-foreground">Origin ZIP</TableHead>
                <TableHead className="text-foreground">Dest ZIP</TableHead>
                <TableHead className="text-foreground">Weight</TableHead>
                <TableHead className="text-foreground">Dimensions</TableHead>
                <TableHead className="text-foreground">Service Type</TableHead>
                <TableHead className="text-foreground">Status</TableHead>
                <TableHead className="text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-background">
              {orphanedData.map((shipment, index) => (
                <EditableOrphanedShipmentRow
                  key={shipment.id}
                  shipment={shipment}
                  isSelected={selectedShipments.has(shipment.id)}
                  onSelect={(selected) => handleSelectShipment(shipment.id, selected)}
                  onFixAndAnalyze={onFixOrphaned}
                  isFixing={reanalyzingShipments.has(shipment.id)}
                  editMode={editMode}
                  rowIndex={index}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        
        {editMode && (
          <div className="mt-4 p-4 bg-muted/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium mb-1">Editing Orphaned Shipments</div>
                <div className="text-muted-foreground space-y-1">
                  <div>• Fill in missing data (marked in red) to enable the "Fix & Analyze" button</div>
                  <div>• Required fields: Origin ZIP, Destination ZIP, Weight, Service Type</div>
                  <div>• Successfully fixed shipments will be moved to the Shipment Data tab</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}