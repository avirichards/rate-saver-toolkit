import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Edit3, Users, Home, Building, HelpCircle, Package, Search } from 'lucide-react';
import { UPS_SERVICE_CODES } from '@/utils/serviceMapping';
import type { ServiceMapping } from '@/utils/csvParser';

interface ServiceMappingReviewProps {
  csvData: any[];
  serviceColumn: string;
  initialMappings: ServiceMapping[];
  onMappingsConfirmed: (confirmedMappings: ServiceMapping[]) => void;
}

interface ExtendedServiceMapping extends ServiceMapping {
  upsServiceCode: string;
  shipmentCount: number;
  isEdited: boolean;
  isConfirmed: boolean;
  isResidential?: boolean;
  residentialDetected?: number; // Count of shipments with auto-detected residential
  commercialDetected?: number; // Count of shipments with auto-detected commercial
}

export const ServiceMappingReview: React.FC<ServiceMappingReviewProps> = ({
  csvData,
  serviceColumn,
  initialMappings,
  onMappingsConfirmed
}) => {
  const [mappings, setMappings] = useState<ExtendedServiceMapping[]>([]);
  const [allMapped, setAllMapped] = useState(false);

  useEffect(() => {
    // Count shipments for each service and extend mappings
    const serviceCounts = csvData.reduce((acc, row) => {
      const service = row[serviceColumn];
      if (service) {
        acc[service] = (acc[service] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Map standardized service names to UPS service codes
    const standardizedToUpsCode = (standardized: string): string => {
      const mapping: Record<string, string> = {
        'NEXT_DAY_AIR': '01',
        'NEXT_DAY_AIR_SAVER': '13', 
        'NEXT_DAY_AIR_EARLY': '14',
        '2ND_DAY_AIR': '02',
        '3_DAY_SELECT': '12',
        'GROUND': '03',
        'WORLDWIDE_EXPRESS': '07',
        'WORLDWIDE_EXPRESS_PLUS': '54',
        'WORLDWIDE_EXPEDITED': '08',
        'UPS_STANDARD': '11',
        'UPS_SAVER': '65',
        'EXPRESS_SAVER': '13', // Map to Next Day Air Saver as closest equivalent
        'EXPRESS_AIR': '01', // Map to Next Day Air as closest equivalent
        'PRIORITY_MAIL': '02' // Map to 2nd Day Air as closest equivalent
      };
      return mapping[standardized] || '03'; // Default to Ground
    };

    const extendedMappings = initialMappings.map(mapping => {
      // Count residential vs commercial detection for this service
      const serviceShipments = csvData.filter(row => row[serviceColumn] === mapping.original);
      const residentialDetected = serviceShipments.filter(shipment => {
        // Simplified residential detection for display purposes
        const address = shipment.recipientAddress || shipment.recipient_address || '';
        return address.toLowerCase().includes('apt') || 
               address.toLowerCase().includes('unit') || 
               address.toLowerCase().includes('#');
      }).length;
      
      return {
        ...mapping,
        upsServiceCode: mapping.upsServiceCode || standardizedToUpsCode(mapping.standardized),
        shipmentCount: serviceCounts[mapping.original] || 0,
        isEdited: false,
        isConfirmed: false,
        isResidential: mapping.isResidential !== undefined ? mapping.isResidential : 
                      (mapping.isResidentialDetected ? true : false),
        residentialDetected,
        commercialDetected: (serviceCounts[mapping.original] || 0) - residentialDetected
      };
    });

    setMappings(extendedMappings);
  }, [csvData, serviceColumn, initialMappings]);

  useEffect(() => {
    // Check if all mappings are confirmed or edited
    const allValid = mappings.every(m => m.isConfirmed || m.isEdited || m.confidence > 0.5);
    setAllMapped(allValid);
  }, [mappings]);

  const confirmMapping = (index: number) => {
    setMappings(prev => prev.map((mapping, i) => 
      i === index 
        ? { ...mapping, isConfirmed: true }
        : mapping
    ));
  };

  const updateMapping = (index: number, newStandardized: string, newCarrier: string, upsServiceCode?: string) => {
    setMappings(prev => prev.map((mapping, i) => 
      i === index 
        ? { 
            ...mapping, 
            standardized: newStandardized, 
            carrier: newCarrier,
            upsServiceCode,
            confidence: 1.0, // User confirmed
            isEdited: true 
          }
        : mapping
    ));
  };

  const updateResidentialSetting = (index: number, isResidential: boolean) => {
    setMappings(prev => prev.map((mapping, i) => 
      i === index 
        ? { ...mapping, isResidential }
        : mapping
    ));
  };

  // Helper functions for improved UX
  const getStatusInfo = (mapping: ExtendedServiceMapping) => {
    if (mapping.isEdited || mapping.isConfirmed) {
      return {
        status: 'confirmed',
        label: 'Confirmed',
        needsReview: false,
        isConfirmed: true
      };
    } else if (mapping.confidence > 0.5) {
      return {
        status: 'good-match',
        label: 'Good Match',
        needsReview: false,
        isConfirmed: false
      };
    } else {
      return {
        status: 'needs-review',
        label: 'Needs Review',
        needsReview: true,
        isConfirmed: false
      };
    }
  };

  const getStatusBadge = (mapping: ExtendedServiceMapping) => {
    const statusInfo = getStatusInfo(mapping);
    
    if (mapping.isEdited) {
      return <Badge variant="default" className="bg-success/10 text-success border-success/20">✓ Confirmed</Badge>;
    }
    if (mapping.isConfirmed) {
      return <Badge variant="default" className="bg-success/10 text-success border-success/20">✓ Confirmed</Badge>;
    }
    if (statusInfo.needsReview) {
      return <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200">⚠ Needs Review</Badge>;
    }
    return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">Good Match</Badge>;
  };

  const getServiceDescription = (serviceCode: string): string => {
    const descriptions: Record<string, string> = {
      '01': 'Next business day by 10:30 AM',
      '13': 'Next business day by 3:00 PM (lower cost)',
      '14': 'Next business day by 8:00 AM',
      '02': '2nd business day by end of day',
      '12': '3rd business day by end of day',
      '03': '1-5 business days, most economical',
      '07': 'Express international, 1-3 business days',
      '54': 'Fastest international service',
      '08': 'Expedited international, 2-5 business days',
      '11': 'Standard international service',
      '65': 'Express international with savings'
    };
    return descriptions[serviceCode] || 'UPS service';
  };

  const serviceOptions = [
    { group: 'Next Day', services: [
      { code: '01', name: 'UPS Next Day Air', standardized: 'NEXT_DAY_AIR' },
      { code: '13', name: 'UPS Next Day Air Saver', standardized: 'NEXT_DAY_AIR_SAVER' },
      { code: '14', name: 'UPS Next Day Air Early', standardized: 'NEXT_DAY_AIR_EARLY' }
    ]},
    { group: '2-3 Day', services: [
      { code: '02', name: 'UPS 2nd Day Air', standardized: '2ND_DAY_AIR' },
      { code: '12', name: 'UPS 3 Day Select', standardized: '3_DAY_SELECT' }
    ]},
    { group: 'Ground', services: [
      { code: '03', name: 'UPS Ground', standardized: 'GROUND' }
    ]},
    { group: 'International', services: [
      { code: '07', name: 'UPS Worldwide Express', standardized: 'WORLDWIDE_EXPRESS' },
      { code: '54', name: 'UPS Worldwide Express Plus', standardized: 'WORLDWIDE_EXPRESS_PLUS' },
      { code: '08', name: 'UPS Worldwide Expedited', standardized: 'WORLDWIDE_EXPEDITED' },
      { code: '11', name: 'UPS Standard', standardized: 'UPS_STANDARD' },
      { code: '65', name: 'UPS Saver', standardized: 'UPS_SAVER' }
    ]}
  ];

  const handleConfirm = () => {
    const confirmedMappings = mappings.map(mapping => ({
      original: mapping.original,
      standardized: mapping.standardized,
      carrier: mapping.carrier,
      confidence: mapping.confidence,
      upsServiceCode: mapping.upsServiceCode,
      isResidential: mapping.isResidential
    }));
    onMappingsConfirmed(confirmedMappings);
  };

  const totalShipments = mappings.reduce((sum, m) => sum + m.shipmentCount, 0);
  const needsReviewCount = mappings.filter(m => getStatusInfo(m).needsReview).length;
  const confirmedCount = mappings.filter(m => getStatusInfo(m).isConfirmed).length;
  const progressPercentage = Math.round((confirmedCount / mappings.length) * 100);

  // Group mappings by status for better organization
  const needsReviewMappings = mappings.filter(m => getStatusInfo(m).needsReview);
  const confirmedMappings = mappings.filter(m => getStatusInfo(m).isConfirmed);
  const goodMappings = mappings.filter(m => getStatusInfo(m).status === 'good');

  return (
    <div className="space-y-6">
      {/* Progress and Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Service Mapping Review
          </CardTitle>
          <CardDescription>
            Review and confirm how your shipping services map to UPS services to ensure accurate rate comparisons.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {confirmedCount} of {mappings.length} services confirmed
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{progressPercentage}% complete</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-medium">{totalShipments}</div>
                <div className="text-xs text-muted-foreground">Total Shipments</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <CheckCircle className="h-4 w-4 text-success" />
              <div>
                <div className="text-sm font-medium">{confirmedCount}</div>
                <div className="text-xs text-muted-foreground">Confirmed</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div>
                <div className="text-sm font-medium">{needsReviewCount}</div>
                <div className="text-xs text-muted-foreground">Needs Review</div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          {needsReviewCount > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-red-700 mb-1">Review Required</div>
                  <div className="text-sm text-muted-foreground">
                    Please review the services marked below. Select the correct UPS service for each to ensure accurate rate comparisons.
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Needs Review Section */}
      {needsReviewMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Needs Review ({needsReviewMappings.length})
            </CardTitle>
            <CardDescription>
              These services need your attention to ensure accurate mapping.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {needsReviewMappings.map((mapping, originalIndex) => {
              const index = mappings.findIndex(m => m.original === mapping.original);
              return (
                <ServiceMappingCard 
                  key={mapping.original}
                  mapping={mapping}
                  index={index}
                  serviceOptions={serviceOptions}
                  updateMapping={updateMapping}
                  updateResidentialSetting={updateResidentialSetting}
                  getStatusBadge={getStatusBadge}
                  getServiceDescription={getServiceDescription}
                  priority="high"
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Confirmed Section */}
      {confirmedMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              Confirmed ({confirmedMappings.length})
            </CardTitle>
            <CardDescription>
              These services have been confirmed and are ready for analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {confirmedMappings.map((mapping, originalIndex) => {
              const index = mappings.findIndex(m => m.original === mapping.original);
              return (
                <ServiceMappingCard 
                  key={mapping.original}
                  mapping={mapping}
                  index={index}
                  serviceOptions={serviceOptions}
                  updateMapping={updateMapping}
                  updateResidentialSetting={updateResidentialSetting}
                  getStatusBadge={getStatusBadge}
                  getServiceDescription={getServiceDescription}
                  priority="confirmed"
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Good Matches Section */}
      {goodMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Good Matches ({goodMappings.length})
            </CardTitle>
            <CardDescription>
              These services have been automatically matched with good confidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {goodMappings.map((mapping, originalIndex) => {
              const index = mappings.findIndex(m => m.original === mapping.original);
              return (
                <ServiceMappingCard 
                  key={mapping.original}
                  mapping={mapping}
                  index={index}
                  serviceOptions={serviceOptions}
                  updateMapping={updateMapping}
                  updateResidentialSetting={updateResidentialSetting}
                  confirmMapping={confirmMapping}
                  getStatusBadge={getStatusBadge}
                  getServiceDescription={getServiceDescription}
                  priority="good"
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Action Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {needsReviewCount > 0 ? (
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">
                    {needsReviewCount} service{needsReviewCount !== 1 ? 's' : ''} need{needsReviewCount === 1 ? 's' : ''} review
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">All services confirmed</span>
                </div>
              )}
            </div>
            
            <Button 
              onClick={handleConfirm}
              disabled={!allMapped}
              size="lg"
              className="px-8"
            >
              {allMapped ? 'Continue to Analysis' : `Review ${needsReviewCount} Service${needsReviewCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Individual Service Mapping Card Component
interface ServiceMappingCardProps {
  mapping: ExtendedServiceMapping;
  index: number;
  serviceOptions: any[];
  updateMapping: (index: number, newStandardized: string, newCarrier: string, upsServiceCode?: string) => void;
  updateResidentialSetting: (index: number, isResidential: boolean) => void;
  confirmMapping?: (index: number) => void;
  getStatusBadge: (mapping: ExtendedServiceMapping) => JSX.Element;
  getServiceDescription: (serviceCode: string) => string;
  priority: 'high' | 'confirmed' | 'good';
}

const ServiceMappingCard: React.FC<ServiceMappingCardProps> = ({
  mapping,
  index,
  serviceOptions,
  updateMapping,
  updateResidentialSetting,
  getStatusBadge,
  getServiceDescription,
  priority
}) => {
  const priorityStyles = {
    high: 'border-warning/30 bg-warning/5 shadow-sm',
    confirmed: 'border-success/30 bg-success/5',
    good: 'border-border hover:border-border/60'
  };

  return (
    <div className={`p-4 border rounded-lg transition-all ${priorityStyles[priority]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-semibold text-base">{mapping.original}</span>
            {getStatusBadge(mapping)}
            <Badge variant="outline" className="text-xs">
              {mapping.shipmentCount} shipment{mapping.shipmentCount !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          <div className="text-sm mb-3 space-y-1">
            <div>
              <span className="text-muted-foreground">UPS Service:</span>
              <span className="font-medium text-foreground ml-2">
                {serviceOptions.flatMap(g => g.services).find(s => s.code === mapping.upsServiceCode)?.name || 'Not selected'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {getServiceDescription(mapping.upsServiceCode)}
            </div>
          </div>
          
          {/* Residential Detection Summary */}
          {(mapping.residentialDetected || mapping.commercialDetected) && (
            <div className="flex items-center gap-4 text-xs mb-2">
              {mapping.residentialDetected > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Home className="h-3 w-3" />
                  {mapping.residentialDetected} residential
                </div>
              )}
              {mapping.commercialDetected > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Building className="h-3 w-3" />
                  {mapping.commercialDetected} commercial
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="w-64">
            <Select
              value={mapping.upsServiceCode}
              onValueChange={(value) => {
                const selectedOption = serviceOptions
                  .flatMap(group => group.services)
                  .find(service => service.code === value);
                
                if (selectedOption) {
                  updateMapping(
                    index, 
                    selectedOption.standardized, 
                    'UPS',
                    selectedOption.code
                  );
                }
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select UPS service" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {serviceOptions.map(group => (
                  <div key={group.group}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 border-b">
                      {group.group}
                    </div>
                    {group.services.map(service => (
                      <SelectItem key={service.code} value={service.code}>
                        <div className="flex flex-col py-1">
                          <span className="font-medium">{service.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Code: {service.code}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={`residential-${index}`}
              checked={mapping.isResidential || false}
              onCheckedChange={(checked) => updateResidentialSetting(index, checked as boolean)}
            />
            <label 
              htmlFor={`residential-${index}`} 
              className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1"
            >
              <Home className="h-3 w-3" />
              Residential
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};