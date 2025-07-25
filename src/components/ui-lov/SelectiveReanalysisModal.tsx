import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UniversalServiceSelector } from '@/components/ui-lov/UniversalServiceSelector';
import { AccountSelector } from '@/components/ui-lov/AccountSelector';
import { Plus, Replace, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
interface ServiceMappingCorrection {
  from: string;
  to: string;
  affectedCount: number;
  isResidential?: boolean;
  accountId?: string;
  weightFilter?: {
    enabled: boolean;
    operator: 'under' | 'over' | 'equal';
    value: number;
  };
  dimFilter?: {
    enabled: boolean;
    operator: 'under' | 'over' | 'equal';
    value: number;
  };
}
interface SelectiveReanalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCorrections: (corrections: ServiceMappingCorrection[]) => void;
  selectedShipments: any[];
  allShipments: any[];
}
export function SelectiveReanalysisModal({
  isOpen,
  onClose,
  onApplyCorrections,
  selectedShipments,
  allShipments
}: SelectiveReanalysisModalProps) {
  const [findValue, setFindValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [accountValue, setAccountValue] = useState('');
  const [weightFilterEnabled, setWeightFilterEnabled] = useState(false);
  const [weightOperator, setWeightOperator] = useState<'under' | 'over' | 'equal'>('under');
  const [weightValue, setWeightValue] = useState(10);
  const [dimFilterEnabled, setDimFilterEnabled] = useState(false);
  const [dimOperator, setDimOperator] = useState<'under' | 'over' | 'equal'>('under');
  const [dimValue, setDimValue] = useState(650);
  const [corrections, setCorrections] = useState<ServiceMappingCorrection[]>([]);

  // Get unique current service types from all shipments
  const currentServices = useMemo(() => {
    const services = [...new Set(allShipments.map(s => {
      // Try multiple field names for service
      const serviceValue = s.customer_service;
      return serviceValue;
    }).filter(Boolean))];
    return services.sort();
  }, [allShipments]);

  // Calculate how many shipments match current criteria
  const matchingShipments = useMemo(() => {
    return allShipments.filter(s => {
      const currentService = s.customer_service || '';
      const weight = parseFloat(s.weight) || 0;
      const length = parseFloat(s.length) || 12;
      const width = parseFloat(s.width) || 12;
      const height = parseFloat(s.height) || 6;
      const dim = length * width * height;
      let serviceMatch = !findValue || currentService === findValue;
      let weightMatch = true;
      let dimMatch = true;
      if (weightFilterEnabled && weightValue > 0) {
        switch (weightOperator) {
          case 'under':
            weightMatch = weight < weightValue;
            break;
          case 'over':
            weightMatch = weight > weightValue;
            break;
          case 'equal':
            weightMatch = weight === weightValue;
            break;
        }
      }
      if (dimFilterEnabled && dimValue > 0) {
        switch (dimOperator) {
          case 'under':
            dimMatch = dim < dimValue;
            break;
          case 'over':
            dimMatch = dim > dimValue;
            break;
          case 'equal':
            dimMatch = dim === dimValue;
            break;
        }
      }
      return serviceMatch && weightMatch && dimMatch;
    });
  }, [allShipments, findValue, weightFilterEnabled, weightOperator, weightValue, dimFilterEnabled, dimOperator, dimValue]);
  const handleAddCorrection = () => {
    if (!findValue.trim() || !replaceValue.trim()) {
      toast.error('Please enter both find and replace values');
      return;
    }
    const affectedCount = matchingShipments.length;
    if (affectedCount === 0) {
      toast.error('No shipments found with the specified criteria');
      return;
    }
    const newCorrection: ServiceMappingCorrection = {
      from: findValue.trim(),
      to: replaceValue.trim(),
      affectedCount,
      accountId: accountValue || undefined,
      weightFilter: weightFilterEnabled ? {
        enabled: true,
        operator: weightOperator,
        value: weightValue
      } : undefined,
      dimFilter: dimFilterEnabled ? {
        enabled: true,
        operator: dimOperator,
        value: dimValue
      } : undefined
    };
    setCorrections([...corrections, newCorrection]);
    setFindValue('');
    setReplaceValue('');
    setAccountValue('');
    setWeightFilterEnabled(false);
    setWeightValue(10);
    setDimFilterEnabled(false);
    setDimValue(650);
  };
  const handleRemoveCorrection = (index: number) => {
    setCorrections(corrections.filter((_, i) => i !== index));
  };
  const handleApply = () => {
    if (corrections.length === 0) {
      toast.error('Please add at least one correction');
      return;
    }
    onApplyCorrections(corrections);
    onClose();
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Replace className="h-5 w-5" />
            Batch Service Mapping Corrections
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Selection Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Batch Service Correction
                </span>
              </div>
              <Badge variant="outline" className="text-sm">
                {matchingShipments.length} shipments match criteria
              </Badge>
            </div>
          </div>

          {/* Service Mapping Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Service Mapping</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="find-service">Find Current Service</Label>
                <Select value={findValue} onValueChange={setFindValue}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select current service to replace" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border max-h-60 overflow-y-auto z-50">
                    {currentServices.map(service => {
                    const serviceCount = allShipments.filter(s => s.customer_service === service).length;
                    return <SelectItem key={service} value={service} className="hover:bg-accent">
                          <div className="flex items-center justify-between w-full">
                            <span>{service}</span>
                            <div className="text-xs text-muted-foreground ml-4">
                              {serviceCount} shipments
                            </div>
                          </div>
                        </SelectItem>;
                  })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="replace-service">Replace With Service</Label>
                <UniversalServiceSelector value={replaceValue} onValueChange={setReplaceValue} placeholder="Select Service" className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-select">Use Account (Optional)</Label>
                <AccountSelector value={accountValue} onValueChange={setAccountValue} placeholder="Select Account" className="w-full" />
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Filters (Optional)</h3>
            <div className="grid grid-cols-2 gap-6">
              
              {/* Weight Filter */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="weight-filter" checked={weightFilterEnabled} onChange={e => setWeightFilterEnabled(e.target.checked)} className="rounded border-gray-300" />
                  <Label htmlFor="weight-filter" className="text-sm font-medium">Weight</Label>
                </div>
                
                {weightFilterEnabled && <div className="flex items-center gap-2 pl-6 space-x-2">
                    <Label className="text-sm whitespace-nowrap">Weight</Label>
                    <Select value={weightOperator} onValueChange={(value: 'under' | 'over' | 'equal') => setWeightOperator(value)}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border z-50">
                        <SelectItem value="under">Under</SelectItem>
                        <SelectItem value="over">Over</SelectItem>
                        <SelectItem value="equal">Equal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" value={weightValue} onChange={e => setWeightValue(parseFloat(e.target.value) || 0)} className="w-16" min="0" step="0.1" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">lbs</span>
                  </div>}
              </div>

              {/* DIM Filter */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="dim-filter" checked={dimFilterEnabled} onChange={e => setDimFilterEnabled(e.target.checked)} className="rounded border-gray-300" />
                  <Label htmlFor="dim-filter" className="text-sm font-medium">DIM</Label>
                </div>
                
                {dimFilterEnabled && <div className="flex items-center gap-2 pl-6 space-x-2">
                    <Label className="text-sm whitespace-nowrap">DIM</Label>
                    <Select value={dimOperator} onValueChange={(value: 'under' | 'over' | 'equal') => setDimOperator(value)}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border z-50">
                        <SelectItem value="under">Under</SelectItem>
                        <SelectItem value="over">Over</SelectItem>
                        <SelectItem value="equal">Equal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" value={dimValue} onChange={e => setDimValue(parseFloat(e.target.value) || 0)} className="w-20" min="0" step="1" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">in³</span>
                  </div>}
              </div>
            </div>
          </div>

          <Button onClick={handleAddCorrection} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Correction
          </Button>


          {/* Current Services Preview */}
          {currentServices.length > 0 && <div>
              <Label className="text-sm font-medium">Available Current Services:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {currentServices.slice(0, 8).map((service, index) => <Badge key={index} variant="outline" className="text-xs">
                    {service}
                  </Badge>)}
                {currentServices.length > 8 && <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{currentServices.length - 8} more...
                  </Badge>}
              </div>
            </div>}

          {/* Corrections List */}
          {corrections.length > 0 && <div className="space-y-2">
              <Label className="text-sm font-medium">Pending Corrections:</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                 {corrections.map((correction, index) => <div key={index} className="bg-muted/30 p-3 rounded-md space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2 text-sm">
                         <span className="font-mono bg-muted px-2 py-1 rounded">
                           {correction.from}
                         </span>
                         <Replace className="h-3 w-3 text-muted-foreground" />
                         <span className="font-mono bg-muted px-2 py-1 rounded">
                           {correction.to}
                         </span>
                         <Badge variant="secondary" className="text-xs">
                           {correction.affectedCount} shipments
                         </Badge>
                       </div>
                       <Button size="sm" variant="ghost" onClick={() => handleRemoveCorrection(index)} className="h-8 w-8 p-0">
                         ×
                       </Button>
                     </div>
                      
                       {/* Weight filter info */}
                       {correction.weightFilter && <div className="flex items-center gap-2">
                           <Label className="text-xs text-muted-foreground">Weight Filter:</Label>
                           <Badge variant="outline" className="text-xs">
                             {correction.weightFilter.operator} {correction.weightFilter.value}lbs
                           </Badge>
                         </div>}
                       
                       {/* DIM filter info */}
                       {correction.dimFilter && <div className="flex items-center gap-2">
                           <Label className="text-xs text-muted-foreground">DIM Filter:</Label>
                           <Badge variant="outline" className="text-xs">
                             {correction.dimFilter.operator} {correction.dimFilter.value} cubic inches
                           </Badge>
                         </div>}
                       
                       {/* Account info */}
                       {correction.accountId && <div className="flex items-center gap-2">
                           <Label className="text-xs text-muted-foreground">Account:</Label>
                           <Badge variant="outline" className="text-xs">
                             Account Selected
                           </Badge>
                         </div>}
                       
                       {/* Residential/Commercial options for this correction */}
                       <div className="flex items-center gap-2">
                         <Label className="text-xs text-muted-foreground">Mark as:</Label>
                         <div className="flex gap-1">
                           <Button size="sm" variant={correction.isResidential === true ? "default" : "outline"} onClick={() => {
                    const updated = [...corrections];
                    updated[index] = {
                      ...correction,
                      isResidential: true
                    };
                    setCorrections(updated);
                  }} className="h-6 px-2 text-xs">
                             Residential
                           </Button>
                           <Button size="sm" variant={correction.isResidential === false ? "default" : "outline"} onClick={() => {
                    const updated = [...corrections];
                    updated[index] = {
                      ...correction,
                      isResidential: false
                    };
                    setCorrections(updated);
                  }} className="h-6 px-2 text-xs">
                             Commercial
                           </Button>
                           <Button size="sm" variant={correction.isResidential === undefined ? "default" : "outline"} onClick={() => {
                    const updated = [...corrections];
                    updated[index] = {
                      ...correction,
                      isResidential: undefined
                    };
                    setCorrections(updated);
                  }} className="h-6 px-2 text-xs">
                             No Change
                           </Button>
                         </div>
                       </div>
                   </div>)}
              </div>
            </div>}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleApply} className="flex-1" disabled={corrections.length === 0}>
              Apply & Re-analyze ({corrections.reduce((sum, c) => sum + c.affectedCount, 0)} shipments)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
}