import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { ServiceMapping } from '@/utils/csvParser';

interface ServiceMappingReviewProps {
  csvData: any[];
  serviceColumn: string;
  initialMappings: ServiceMapping[];
  onMappingsConfirmed: (confirmedMappings: ServiceMapping[]) => void;
}

interface ExtendedServiceMapping extends ServiceMapping {
  serviceCode: string;
  status: 'needs-review' | 'good-match';
  count: number;
}

export const ServiceMappingReview: React.FC<ServiceMappingReviewProps> = ({
  csvData,
  serviceColumn,
  initialMappings,
  onMappingsConfirmed
}) => {
  const [mappings, setMappings] = useState<ExtendedServiceMapping[]>([]);

  useEffect(() => {
    // Count shipments for each service
    const serviceCounts = csvData.reduce((acc, row) => {
      const service = row[serviceColumn];
      if (service) {
        acc[service] = (acc[service] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Map standardized service names to service codes
    const standardizedToServiceCode = (standardized: string): string => {
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
        'EXPRESS_SAVER': '13',
        'EXPRESS_AIR': '01',
        'PRIORITY_MAIL': '02'
      };
      return mapping[standardized] || '03';
    };

    const extendedMappings = initialMappings.map(mapping => ({
      ...mapping,
      serviceCode: mapping.serviceCode || standardizedToServiceCode(mapping.standardized),
      status: mapping.confidence >= 0.8 ? 'good-match' as const : 'needs-review' as const,
      count: serviceCounts[mapping.original] || 0
    }));

    setMappings(extendedMappings);
  }, [csvData, serviceColumn, initialMappings]);

  // Group mappings by status - only two sections
  const groupedMappings = useMemo(() => {
    const groups = {
      'needs-review': mappings.filter(m => m.status === 'needs-review'),
      'good-match': mappings.filter(m => m.status === 'good-match')
    };
    return groups;
  }, [mappings]);

  const updateMapping = (
    originalService: string, 
    serviceCode: string | null
  ) => {
    setMappings(prev => prev.map(mapping => 
      mapping.original === originalService
        ? { ...mapping, serviceCode: serviceCode || '', status: 'good-match' as const }
        : mapping
    ));
  };

  const confirmMapping = (originalService: string) => {
    setMappings(prev => prev.map(mapping => 
      mapping.original === originalService
        ? { ...mapping, status: 'good-match' as const }
        : mapping
    ));
  };

  const handleConfirmAll = () => {
    const confirmedMappings: ServiceMapping[] = mappings.map(mapping => ({
      original: mapping.original,
      standardized: mapping.standardized,
      serviceCode: mapping.serviceCode || '',
      confidence: mapping.confidence,
      count: mapping.count,
      carrier: mapping.carrier
    }));
    
    onMappingsConfirmed(confirmedMappings);
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

  const allServiceOptions = serviceOptions.flatMap(g => g.services);

  return (
    <div className="space-y-6">
      {/* Needs Review Section */}
      {groupedMappings['needs-review'].length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Needs Review ({groupedMappings['needs-review'].length})</h2>
          </div>
          
          <div className="space-y-3">
            {groupedMappings['needs-review'].map((mapping) => (
              <ServiceMappingCard 
                key={mapping.original}
                mapping={mapping}
                serviceOptions={allServiceOptions}
                updateMapping={updateMapping}
                confirmMapping={confirmMapping}
                showConfirmButton={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Good Matches Section */}
      {groupedMappings['good-match'].length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <h2 className="text-lg font-semibold">Good Matches ({groupedMappings['good-match'].length})</h2>
          </div>
          
          <div className="space-y-3">
            {groupedMappings['good-match'].map((mapping) => (
              <ServiceMappingCard 
                key={mapping.original}
                mapping={mapping}
                serviceOptions={allServiceOptions}
                updateMapping={updateMapping}
                showConfirmButton={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Section */}
      <div className="pt-6">
        <Button 
          onClick={handleConfirmAll}
          size="lg"
          className="w-full"
        >
          Continue to Analysis
        </Button>
      </div>
    </div>
  );
};

// Individual Service Mapping Card Component
interface ServiceMappingCardProps {
  mapping: ExtendedServiceMapping;
  serviceOptions: any[];
  updateMapping: (originalService: string, serviceCode: string | null) => void;
  confirmMapping?: (originalService: string) => void;
  showConfirmButton: boolean;
}

const ServiceMappingCard: React.FC<ServiceMappingCardProps> = ({
  mapping,
  serviceOptions,
  updateMapping,
  confirmMapping,
  showConfirmButton
}) => {
  const selectedService = serviceOptions.find(s => s.code === mapping.serviceCode);
  
  return (
    <Card className={`p-4 ${mapping.status === 'needs-review' ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {mapping.status === 'needs-review' ? (
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
              )}
              <div>
                <h3 className="font-semibold text-base">{mapping.original}</h3>
                <p className="text-sm text-muted-foreground">Carrier: {mapping.carrier}</p>
              </div>
              <div className="ml-auto">
                <span className="text-xs bg-muted px-2 py-1 rounded-full">
                  {mapping.count} shipments
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground">Mapped Service:</label>
                <Select
                  value={mapping.serviceCode}
                  onValueChange={(value) => updateMapping(mapping.original, value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border shadow-lg z-50">
                    {serviceOptions.map(service => (
                      <SelectItem key={service.code} value={service.code}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {showConfirmButton && confirmMapping && (
                <Button
                  onClick={() => confirmMapping(mapping.original)}
                  variant="default"
                  size="sm"
                  className="mt-6"
                >
                  Confirm as Correct
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};