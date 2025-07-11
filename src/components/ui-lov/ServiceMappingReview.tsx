import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, CheckCircle, Edit3, Users } from 'lucide-react';
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
  isResidential?: boolean;
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

    const extendedMappings = initialMappings.map(mapping => ({
      ...mapping,
      upsServiceCode: mapping.upsServiceCode || standardizedToUpsCode(mapping.standardized),
      shipmentCount: serviceCounts[mapping.original] || 0,
      isEdited: false,
      isResidential: mapping.isResidential || false
    }));

    setMappings(extendedMappings);
  }, [csvData, serviceColumn, initialMappings]);

  useEffect(() => {
    // Check if all mappings have confidence > 0.5 or have been edited
    const allValid = mappings.every(m => m.confidence > 0.5 || m.isEdited);
    setAllMapped(allValid);
  }, [mappings]);

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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBadge = (confidence: number, isEdited: boolean) => {
    if (isEdited) {
      return <Badge variant="default" className="bg-blue-100 text-blue-700">User Confirmed</Badge>;
    }
    if (confidence >= 0.8) {
      return <Badge variant="default" className="bg-green-100 text-green-700">High Confidence</Badge>;
    }
    if (confidence >= 0.5) {
      return <Badge variant="secondary">Medium Confidence</Badge>;
    }
    return <Badge variant="destructive">Low Confidence</Badge>;
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
  const lowConfidenceCount = mappings.filter(m => m.confidence < 0.5 && !m.isEdited).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="h-5 w-5" />
          Service Mapping Review
        </CardTitle>
        <CardDescription>
          Review and confirm how your shipping services map to UPS services. 
          This ensures accurate rate comparisons.
        </CardDescription>
        
        {/* Summary Stats */}
        <div className="flex gap-4 text-sm text-muted-foreground mt-4">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {totalShipments} total shipments
          </div>
          <div className="flex items-center gap-1">
            {lowConfidenceCount > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                {lowConfidenceCount} need review
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                All mappings confirmed
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {mappings.map((mapping, index) => (
          <div 
            key={mapping.original} 
            className={`p-4 border rounded-lg transition-colors ${
              mapping.confidence < 0.5 && !mapping.isEdited 
                ? 'border-yellow-200 bg-yellow-50' 
                : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium truncate">{mapping.original}</span>
                  {getConfidenceBadge(mapping.confidence, mapping.isEdited)}
                  <Badge variant="outline" className="text-xs">
                    {mapping.shipmentCount} shipment{mapping.shipmentCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Current mapping: <span className="font-medium">{mapping.standardized}</span>
                  {mapping.upsServiceCode && (
                    <span className="ml-2">({UPS_SERVICE_CODES[mapping.upsServiceCode as keyof typeof UPS_SERVICE_CODES]})</span>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 w-64">
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select UPS service" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map(group => (
                      <div key={group.group}>
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                          {group.group}
                        </div>
                        {group.services.map(service => (
                          <SelectItem key={service.code} value={service.code}>
                            <div className="flex flex-col">
                              <span>{service.name}</span>
                              <span className="text-xs text-muted-foreground">Code: {service.code}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Residential/Commercial Checkbox for All Services */}
              <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                <Checkbox
                  id={`residential-${index}`}
                  checked={mapping.isResidential || false}
                  onCheckedChange={(checked) => updateResidentialSetting(index, checked as boolean)}
                />
                <label 
                  htmlFor={`residential-${index}`} 
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Residential
                </label>
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-between items-center pt-6 border-t">
          <div className="text-sm text-muted-foreground">
            {lowConfidenceCount > 0 && (
              <div className="flex items-center gap-1 text-yellow-700">
                <AlertTriangle className="h-4 w-4" />
                Please review {lowConfidenceCount} low-confidence mapping{lowConfidenceCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          
          <Button 
            onClick={handleConfirm}
            disabled={!allMapped}
            size="lg"
          >
            {allMapped ? 'Continue to Analysis' : 'Review Required Services'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};