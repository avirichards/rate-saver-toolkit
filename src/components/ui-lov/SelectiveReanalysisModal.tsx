import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UpsServiceSelector } from '@/components/ui-lov/UpsServiceSelector';
import { Search, Replace, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ServiceMappingCorrection {
  from: string;
  to: string;
  affectedCount: number;
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
  const [corrections, setCorrections] = useState<ServiceMappingCorrection[]>([]);

  // Get unique current service types from all shipments
  const currentServices = useMemo(() => {
    console.log('🔍 Debug: All shipments for service extraction:', allShipments.slice(0, 3));
    const services = [...new Set(allShipments.map(s => {
      // Try multiple field names for service
      const serviceValue = s.service || s.originalService || s.currentService || s.currentServiceType || s.serviceType;
      console.log('🔍 Debug: Shipment service fields:', {
        id: s.id,
        service: s.service,
        originalService: s.originalService, 
        currentService: s.currentService,
        serviceType: s.serviceType,
        extractedValue: serviceValue
      });
      return serviceValue;
    }).filter(Boolean))];
    console.log('🔍 Debug: Extracted services:', services);
    return services.sort();
  }, [allShipments]);

  const handleAddCorrection = () => {
    if (!findValue.trim() || !replaceValue.trim()) {
      toast.error('Please enter both find and replace values');
      return;
    }

    // Count how many shipments will be affected (from all shipments, but corrections apply only to selected)
    const affectedCount = allShipments.filter(s => {
      const currentService = s.service || s.originalService || s.currentService || '';
      return currentService === findValue; // Exact match for dropdown selection
    }).length;

    if (affectedCount === 0) {
      toast.error('No shipments found with the specified service type');
      return;
    }

    const newCorrection: ServiceMappingCorrection = {
      from: findValue.trim(),
      to: replaceValue.trim(),
      affectedCount
    };

    setCorrections([...corrections, newCorrection]);
    setFindValue('');
    setReplaceValue('');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {selectedShipments.length} shipments selected for re-analysis
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Corrections will apply to matching services in all shipments, then re-analyze selected shipments
            </div>
          </div>

          {/* Find & Replace Interface */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="find-service">Find Current Service</Label>
              <Select value={findValue} onValueChange={setFindValue}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select current service to replace" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border max-h-60 overflow-y-auto z-50">
                  {currentServices.map((service) => {
                    // Count from all shipments, not just selected ones
                    const serviceCount = allShipments.filter(s => 
                      (s.service || s.originalService || s.currentService) === service
                    ).length;
                    
                    return (
                      <SelectItem 
                        key={service} 
                        value={service}
                        className="hover:bg-accent"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{service}</span>
                          <div className="text-xs text-muted-foreground ml-4">
                            {serviceCount} shipments
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-service">Replace With</Label>
              <UpsServiceSelector
                value={replaceValue}
                onValueChange={setReplaceValue}
                placeholder="Select UPS Service"
                className="w-full"
              />
            </div>
          </div>

          <Button onClick={handleAddCorrection} className="w-full" variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Add Correction
          </Button>

          {/* Current Services Preview */}
          {currentServices.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Available Current Services:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {currentServices.slice(0, 8).map((service, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {service}
                  </Badge>
                ))}
                {currentServices.length > 8 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{currentServices.length - 8} more...
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Corrections List */}
          {corrections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pending Corrections:</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {corrections.map((correction, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-muted/30 p-3 rounded-md"
                  >
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveCorrection(index)}
                      className="h-8 w-8 p-0"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleApply} 
              className="flex-1"
              disabled={corrections.length === 0}
            >
              Apply & Re-analyze ({corrections.reduce((sum, c) => sum + c.affectedCount, 0)} shipments)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}