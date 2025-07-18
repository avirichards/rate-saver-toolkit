import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  Edit3, 
  Calculator,
  Download
} from 'lucide-react';
import { formatCurrency, getSavingsColor } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ShipmentRate {
  accountName: string;
  rate: number;
  savings: number;
  savingsPercent: number;
  isBest: boolean;
  isAssigned: boolean;
}

interface ShipmentDetail {
  id: number;
  trackingId: string;
  origin: string;
  destination: string;
  weight: number;
  zone: string;
  residential: boolean;
  serviceType: string;
  assignedAccount: string;
  currentRate: number;
  rates: ShipmentRate[];
}

interface ShipmentDetailViewProps {
  shipments: ShipmentDetail[];
  accounts: string[];
  onAccountAssign: (shipmentIds: number[], accountName: string) => void;
  onBulkEdit: (shipmentIds: number[]) => void;
  onRecalculate: () => void;
  onBack: () => void;
  filterServiceType?: string;
}

export function ShipmentDetailView({ 
  shipments, 
  accounts,
  onAccountAssign,
  onBulkEdit,
  onRecalculate,
  onBack,
  filterServiceType
}: ShipmentDetailViewProps) {
  const [selectedShipments, setSelectedShipments] = useState<Set<number>>(new Set());
  const [expandedShipments, setExpandedShipments] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState({
    serviceType: filterServiceType || '',
    weightMin: '',
    weightMax: '',
    zone: '',
    account: '',
    savingsMin: ''
  });
  const [showTopNAccounts, setShowTopNAccounts] = useState(3);

  const filteredShipments = shipments.filter(shipment => {
    if (filters.serviceType && shipment.serviceType !== filters.serviceType) return false;
    if (filters.weightMin && shipment.weight < Number(filters.weightMin)) return false;
    if (filters.weightMax && shipment.weight > Number(filters.weightMax)) return false;
    if (filters.zone && shipment.zone !== filters.zone) return false;
    if (filters.account && shipment.assignedAccount !== filters.account) return false;
    if (filters.savingsMin) {
      const bestRate = shipment.rates.find(r => r.isBest);
      if (!bestRate || bestRate.savingsPercent < Number(filters.savingsMin)) return false;
    }
    return true;
  });

  const toggleShipmentSelection = (shipmentId: number) => {
    const newSelected = new Set(selectedShipments);
    if (newSelected.has(shipmentId)) {
      newSelected.delete(shipmentId);
    } else {
      newSelected.add(shipmentId);
    }
    setSelectedShipments(newSelected);
  };

  const toggleShipmentExpansion = (shipmentId: number) => {
    const newExpanded = new Set(expandedShipments);
    if (newExpanded.has(shipmentId)) {
      newExpanded.delete(shipmentId);
    } else {
      newExpanded.add(shipmentId);
    }
    setExpandedShipments(newExpanded);
  };

  const selectAllVisible = () => {
    setSelectedShipments(new Set(filteredShipments.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedShipments(new Set());
  };

  const getTopAccountsForShipment = (shipment: ShipmentDetail) => {
    return shipment.rates
      .sort((a, b) => a.rate - b.rate)
      .slice(0, showTopNAccounts);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Shipment Detail View</h2>
          <p className="text-sm text-muted-foreground">
            Individual shipment rates across all accounts
            {filterServiceType && ` • Filtered by ${filterServiceType}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Sticky Filter Bar */}
      <div className="sticky top-0 bg-background border rounded-lg p-4 mb-4 z-10">
        <div className="flex items-center gap-4 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({
              serviceType: filterServiceType || '',
              weightMin: '',
              weightMax: '',
              zone: '',
              account: '',
              savingsMin: ''
            })}
          >
            Clear All
          </Button>
        </div>
        
        <div className="grid grid-cols-6 gap-3">
          <Input
            placeholder="Service Type"
            value={filters.serviceType}
            onChange={(e) => setFilters(prev => ({ ...prev, serviceType: e.target.value }))}
          />
          <Input
            placeholder="Min Weight"
            type="number"
            value={filters.weightMin}
            onChange={(e) => setFilters(prev => ({ ...prev, weightMin: e.target.value }))}
          />
          <Input
            placeholder="Max Weight"
            type="number"
            value={filters.weightMax}
            onChange={(e) => setFilters(prev => ({ ...prev, weightMax: e.target.value }))}
          />
          <Input
            placeholder="Zone"
            value={filters.zone}
            onChange={(e) => setFilters(prev => ({ ...prev, zone: e.target.value }))}
          />
          <Input
            placeholder="Account"
            value={filters.account}
            onChange={(e) => setFilters(prev => ({ ...prev, account: e.target.value }))}
          />
          <Input
            placeholder="Min Savings %"
            type="number"
            value={filters.savingsMin}
            onChange={(e) => setFilters(prev => ({ ...prev, savingsMin: e.target.value }))}
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {filteredShipments.length} of {shipments.length} shipments
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show top</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {showTopNAccounts} accounts
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setShowTopNAccounts(3)}>3 accounts</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowTopNAccounts(5)}>5 accounts</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowTopNAccounts(10)}>All accounts</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {selectedShipments.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedShipments.size} selected
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Edit3 className="h-4 w-4" />
                    Bulk Assign
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {accounts.map(account => (
                    <DropdownMenuItem 
                      key={account}
                      onClick={() => onAccountAssign(Array.from(selectedShipments), account)}
                    >
                      {account}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Header Row */}
      <div className="grid grid-cols-8 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b mb-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedShipments.size === filteredShipments.length && filteredShipments.length > 0}
            onCheckedChange={(checked) => checked ? selectAllVisible() : clearSelection()}
          />
          <span>Tracking</span>
        </div>
        <div>Route</div>
        <div>Weight/Zone</div>
        <div>Service</div>
        <div>Assigned Account</div>
        <div className="text-right">Current Rate</div>
        <div className="text-right">Best Rate</div>
        <div className="text-center">Compare</div>
      </div>

      {/* Shipment Rows */}
      <div className="space-y-2">
        {filteredShipments.map((shipment) => {
          const topAccounts = getTopAccountsForShipment(shipment);
          const bestRate = shipment.rates.find(r => r.isBest);
          const isExpanded = expandedShipments.has(shipment.id);
          const isSelected = selectedShipments.has(shipment.id);

          return (
            <div key={shipment.id} className={`border rounded-lg ${isSelected ? 'ring-2 ring-primary/20' : ''}`}>
              <div className="grid grid-cols-8 gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleShipmentSelection(shipment.id)}
                  />
                  <div className="truncate">
                    <div className="font-medium text-sm">{shipment.trackingId}</div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <div>{shipment.origin}</div>
                  <div className="text-muted-foreground">→ {shipment.destination}</div>
                </div>
                
                <div className="text-sm">
                  <div>{shipment.weight} lbs</div>
                  <div className="text-muted-foreground">Zone {shipment.zone}</div>
                  {shipment.residential && (
                    <Badge variant="outline" className="text-xs mt-1">Residential</Badge>
                  )}
                </div>
                
                <div>
                  <Badge variant="outline" className="text-xs">
                    {shipment.serviceType}
                  </Badge>
                </div>
                
                <div>
                  <Badge variant="default" className="text-xs">
                    {shipment.assignedAccount}
                  </Badge>
                </div>
                
                <div className="text-right font-mono text-sm">
                  {formatCurrency(shipment.currentRate)}
                </div>
                
                <div className={`text-right font-mono text-sm ${bestRate ? getSavingsColor(bestRate.savings) : ''}`}>
                  {bestRate ? formatCurrency(bestRate.rate) : 'N/A'}
                </div>
                
                <div className="flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleShipmentExpansion(shipment.id)}
                    className="gap-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-3 border-t bg-muted/20">
                  <div className="py-3">
                    <h4 className="text-sm font-medium text-foreground mb-3">All Account Rates</h4>
                    <div className="grid grid-cols-5 gap-3 text-xs font-medium text-muted-foreground mb-2">
                      <div>Account</div>
                      <div className="text-right">Rate</div>
                      <div className="text-right">Savings</div>
                      <div className="text-right">Savings %</div>
                      <div className="text-center">Action</div>
                    </div>
                    {shipment.rates.map((rate) => (
                      <div key={rate.accountName} className="grid grid-cols-5 gap-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={rate.isAssigned ? 'font-medium' : ''}>{rate.accountName}</span>
                          {rate.isBest && <Badge variant="outline" className="text-xs">Best</Badge>}
                          {rate.isAssigned && <Badge variant="default" className="text-xs">Assigned</Badge>}
                        </div>
                        <div className="text-right font-mono">{formatCurrency(rate.rate)}</div>
                        <div className={`text-right font-mono ${getSavingsColor(rate.savings)}`}>
                          {formatCurrency(rate.savings)}
                        </div>
                        <div className={`text-right font-mono ${getSavingsColor(rate.savings)}`}>
                          {rate.savingsPercent.toFixed(1)}%
                        </div>
                        <div className="text-center">
                          {!rate.isAssigned && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onAccountAssign([shipment.id], rate.accountName)}
                              className="text-xs h-6"
                            >
                              Select
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredShipments.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No shipments match the current filters
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {filteredShipments.length} shipments displayed
        </div>
        
        <Button
          onClick={onRecalculate}
          className="gap-2"
        >
          <Calculator className="h-4 w-4" />
          Recalculate Totals
        </Button>
      </div>
    </Card>
  );
}