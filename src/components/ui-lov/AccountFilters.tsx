import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui-lov/Button';
import { X, Filter } from 'lucide-react';

export interface FilterState {
  serviceType: string;
  carrier: string;
  weightRange: { min: number; max: number } | null;
  zone: string;
  residentialStatus: string;
  savingsThreshold: number;
  assignmentStatus: string;
}

interface AccountFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  availableServices: string[];
  availableCarriers: string[];
  availableZones: string[];
  onClearFilters: () => void;
}

export const AccountFilters: React.FC<AccountFiltersProps> = ({
  filters,
  onFiltersChange,
  availableServices,
  availableCarriers,
  availableZones,
  onClearFilters
}) => {
  const activeFilterCount = Object.values(filters).filter(value => {
    if (typeof value === 'string') return value !== 'all' && value !== '';
    if (typeof value === 'number') return value > 0;
    if (value && typeof value === 'object') return true;
    return false;
  }).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </CardTitle>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service Type Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Service Type</label>
          <Select 
            value={filters.serviceType} 
            onValueChange={(value) => onFiltersChange({ serviceType: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {availableServices.map(service => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Carrier Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Carrier</label>
          <Select 
            value={filters.carrier} 
            onValueChange={(value) => onFiltersChange({ carrier: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All carriers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Carriers</SelectItem>
              {availableCarriers.map(carrier => (
                <SelectItem key={carrier} value={carrier}>
                  {carrier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Weight Range Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Weight Range (lbs)</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.weightRange?.min || ''}
              onChange={(e) => onFiltersChange({
                weightRange: {
                  min: Number(e.target.value),
                  max: filters.weightRange?.max || 0
                }
              })}
              className="h-8"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="number"
              placeholder="Max"
              value={filters.weightRange?.max || ''}
              onChange={(e) => onFiltersChange({
                weightRange: {
                  min: filters.weightRange?.min || 0,
                  max: Number(e.target.value)
                }
              })}
              className="h-8"
            />
          </div>
        </div>

        {/* Zone Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Zone</label>
          <Select 
            value={filters.zone} 
            onValueChange={(value) => onFiltersChange({ zone: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {availableZones.map(zone => (
                <SelectItem key={zone} value={zone}>
                  Zone {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Residential Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Delivery Type</label>
          <Select 
            value={filters.residentialStatus} 
            onValueChange={(value) => onFiltersChange({ residentialStatus: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Savings Threshold Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Min Savings %</label>
          <Input
            type="number"
            placeholder="0"
            value={filters.savingsThreshold || ''}
            onChange={(e) => onFiltersChange({ savingsThreshold: Number(e.target.value) })}
            className="h-8"
          />
        </div>

        {/* Assignment Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Assignment Status</label>
          <Select 
            value={filters.assignmentStatus} 
            onValueChange={(value) => onFiltersChange({ assignmentStatus: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All assignments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="override">Manual Override</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};