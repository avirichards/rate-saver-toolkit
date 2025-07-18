import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, Package, Calculator, Filter } from 'lucide-react';
import { formatCurrency, formatPercentage, getSavingsColor } from '@/lib/utils';
import { AccountInfo, AccountAssignment } from '@/hooks/useAccountAssignments';

interface ShipmentDetailAssignmentProps {
  shipmentData: any[];
  availableAccounts: AccountInfo[];
  onAssignShipmentAccount: (shipmentId: number, account: AccountInfo) => void;
  getShipmentAssignment: (shipmentId: number) => AccountAssignment | null;
  selectedService?: string;
  selectedAccount?: AccountInfo;
  markupFunction?: (shipment: any) => any;
}

export const ShipmentDetailAssignment: React.FC<ShipmentDetailAssignmentProps> = ({
  shipmentData,
  availableAccounts,
  onAssignShipmentAccount,
  getShipmentAssignment,
  selectedService,
  selectedAccount,
  markupFunction
}) => {
  const [selectedShipments, setSelectedShipments] = useState<Set<number>>(new Set());
  const [expandedShipments, setExpandedShipments] = useState<Set<number>>(new Set());
  const [bulkAccount, setBulkAccount] = useState<string>('');

  // Filter shipments based on selected service/account
  const filteredShipments = shipmentData.filter(shipment => {
    if (selectedService && (shipment.service || shipment.originalService) !== selectedService) {
      return false;
    }
    if (selectedAccount) {
      const assignment = getShipmentAssignment(shipment.id);
      return assignment?.assignedAccount.carrierId === selectedAccount.carrierId;
    }
    return true;
  });

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

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedShipments(new Set(filteredShipments.map(s => s.id)));
    } else {
      setSelectedShipments(new Set());
    }
  };

  const handleBulkAssign = () => {
    if (!bulkAccount || selectedShipments.size === 0) return;
    
    const account = availableAccounts.find(acc => acc.carrierId === bulkAccount);
    if (!account) return;

    selectedShipments.forEach(shipmentId => {
      onAssignShipmentAccount(shipmentId, account);
    });

    setSelectedShipments(new Set());
    setBulkAccount('');
  };

  const toggleExpanded = (shipmentId: number) => {
    setExpandedShipments(prev => {
      const next = new Set(prev);
      if (next.has(shipmentId)) {
        next.delete(shipmentId);
      } else {
        next.add(shipmentId);
      }
      return next;
    });
  };

  const getShipmentRates = (shipment: any) => {
    const accounts = shipment.accounts || shipment.rates || [];
    return accounts.map((account: any) => ({
      account: {
        carrierId: account.carrierId || account.id,
        accountName: account.accountName || account.name,
        carrierType: account.carrier || account.carrierType,
        displayName: `${account.carrier || account.carrierType} – ${account.accountName || account.name}`
      },
      rate: account.rate || account.cost || 0,
      savings: shipment.currentRate - (account.rate || account.cost || 0)
    })).sort((a, b) => b.savings - a.savings);
  };

  if (filteredShipments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shipment Detail Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No shipments found matching the current filters
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            Shipment Detail Assignment
            <Badge variant="outline">{filteredShipments.length} Shipments</Badge>
            {selectedService && (
              <Badge variant="secondary">{selectedService}</Badge>
            )}
            {selectedAccount && (
              <Badge variant="outline">{selectedAccount.displayName}</Badge>
            )}
          </div>
          {selectedShipments.size > 0 && (
            <div className="flex items-center gap-2">
              <Select value={bulkAccount} onValueChange={setBulkAccount}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select account for bulk assign" />
                </SelectTrigger>
                <SelectContent>
                  {availableAccounts.map((account) => (
                    <SelectItem key={account.carrierId} value={account.carrierId}>
                      {account.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                size="sm" 
                onClick={handleBulkAssign}
                disabled={!bulkAccount}
              >
                Assign to {selectedShipments.size} shipments
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedShipments.size === filteredShipments.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead>Tracking Number</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Assigned Account</TableHead>
                <TableHead>Current Cost</TableHead>
                <TableHead>Ship Pros Cost</TableHead>
                <TableHead>Savings</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShipments.map((shipment) => {
                const assignment = getShipmentAssignment(shipment.id);
                const rates = getShipmentRates(shipment);
                const isExpanded = expandedShipments.has(shipment.id);
                const isSelected = selectedShipments.has(shipment.id);
                
                return (
                  <React.Fragment key={shipment.id}>
                    <TableRow className={isSelected ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectShipment(shipment.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(shipment.id)}
                          className="h-6 w-6 p-0"
                        >
                          {isExpanded ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {shipment.trackingId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{shipment.originZip} → {shipment.destinationZip}</div>
                          <div className="text-muted-foreground">
                            {shipment.weight} lbs
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{shipment.dimensions || `${shipment.length || 0}x${shipment.width || 0}x${shipment.height || 0}`}</div>
                          <div className="text-muted-foreground">
                            {shipment.isResidential ? 'Residential' : 'Commercial'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {shipment.service || shipment.originalService}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignment ? (
                          <Badge variant="default" className="bg-blue-100 text-blue-800">
                            {assignment.assignedAccount.displayName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(shipment.currentRate)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {assignment ? formatCurrency(assignment.rate) : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {assignment && (
                          <span className={`font-medium ${getSavingsColor(assignment.savings)}`}>
                            {formatCurrency(assignment.savings)}
                            <div className="text-xs text-muted-foreground">
                              {formatPercentage(assignment.rate > 0 ? (assignment.savings / shipment.currentRate) * 100 : 0)}
                            </div>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={assignment?.assignedAccount.carrierId || ""}
                          onValueChange={(value) => {
                            const account = availableAccounts.find(acc => acc.carrierId === value);
                            if (account) {
                              onAssignShipmentAccount(shipment.id, account);
                            }
                          }}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue placeholder="Assign" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableAccounts.map((account) => (
                              <SelectItem key={account.carrierId} value={account.carrierId}>
                                {account.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                    
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={11} className="p-0">
                          <div className="bg-muted/30 p-4 border-t">
                            <div className="text-sm font-medium mb-2">All Available Rates:</div>
                            <div className="grid gap-2">
                              {rates.map((rate, index) => (
                                <div 
                                  key={`${rate.account.carrierId}-${index}`}
                                  className="flex items-center justify-between p-2 bg-background rounded border"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{rate.account.displayName}</span>
                                    {index === 0 && (
                                      <Badge variant="default" className="text-xs">Best Rate</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span>{formatCurrency(rate.rate)}</span>
                                    <span className={`font-medium ${getSavingsColor(rate.savings)}`}>
                                      {formatCurrency(rate.savings)} savings
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onAssignShipmentAccount(shipment.id, rate.account)}
                                      className="text-xs"
                                    >
                                      Assign
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {selectedShipments.size > 0 && (
              <span>{selectedShipments.size} shipments selected</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Button size="sm" variant="outline" className="gap-2">
              <Calculator className="h-4 w-4" />
              Recalculate Totals
            </Button>
            <Button size="sm" variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Advanced Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};