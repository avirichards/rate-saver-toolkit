import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, CheckCircle, Home, Building } from 'lucide-react';
import type { ServiceMapping } from '@/utils/csvParser';
import { standardizeService } from '@/utils/csvParser';
import { UniversalServiceSelector } from './UniversalServiceSelector';
import { UniversalServiceCategory, UNIVERSAL_SERVICES } from '@/utils/universalServiceCategories';
import { mapServiceToServiceCode } from '@/utils/serviceMapping';

interface ServiceMappingReviewProps {
  csvData: any[];
  serviceColumn: string;
  initialMappings: ServiceMapping[];
  onMappingsConfirmed: (confirmedMappings: ServiceMapping[]) => void;
}

interface ExtendedServiceMapping extends ServiceMapping {
  serviceCategory: UniversalServiceCategory;
  status: 'needs-review' | 'good-match';
  count: number;
  // Override only to make required for UI display
  isResidential: boolean;
  residentialSource: string;
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

    const extendedMappings = initialMappings.map(mapping => {
      // Get residential status from service analysis - but don't override existing manual settings
      const serviceAnalysis = standardizeService(mapping.original);
      
      // Preserve existing residential settings from initialMappings if they exist
      // Only use serviceAnalysis as fallback if no existing settings
      const hasExistingResidentialData = mapping.isResidential !== undefined || mapping.residentialSource;
      const residentialData = hasExistingResidentialData 
        ? {
            isResidential: mapping.isResidential || false,
            residentialSource: mapping.residentialSource || 'auto-detected'
          }
        : {
            isResidential: serviceAnalysis.isResidential || false,
            residentialSource: serviceAnalysis.residentialSource || 'auto-detected'
          };
      
      // Convert the old standardized service name to a universal service category
      const serviceMapping = mapServiceToServiceCode(mapping.original);
      const serviceCategory = serviceMapping.standardizedService;
      
      console.log('🔄 ServiceMappingReview - Processing mapping for:', {
        original: mapping.original,
        oldStandardized: mapping.standardized,
        newServiceCategory: serviceCategory,
        confidence: serviceMapping.confidence,
        hasExistingResidentialData,
        existingIsResidential: mapping.isResidential,
        existingResidentialSource: mapping.residentialSource,
        serviceAnalysisIsResidential: serviceAnalysis.isResidential,
        serviceAnalysisSource: serviceAnalysis.residentialSource,
        finalResidentialData: residentialData
      });
      
      return {
        ...mapping,
        standardized: UNIVERSAL_SERVICES[serviceCategory]?.displayName || serviceCategory,
        serviceCategory: serviceCategory,
        status: serviceMapping.confidence >= 0.8 ? 'good-match' as const : 'needs-review' as const,
        count: serviceCounts[mapping.original] || 0,
        confidence: serviceMapping.confidence,
        ...residentialData
      };
    });

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
    serviceCategory: UniversalServiceCategory
  ) => {
    setMappings(prev => prev.map(mapping => 
      mapping.original === originalService
        ? { 
            ...mapping, 
            serviceCategory: serviceCategory,
            standardized: UNIVERSAL_SERVICES[serviceCategory].displayName,
            status: 'good-match' as const 
          }
        : mapping
    ));
  };

  const updateResidentialStatus = (originalService: string, isResidential: boolean) => {
    console.log('🏠 ServiceMappingReview - Updating residential status:', { 
      originalService, 
      isResidential, 
      residentialSource: 'manual' 
    });
    setMappings(prev => prev.map(mapping => 
      mapping.original === originalService
        ? { ...mapping, isResidential, residentialSource: 'manual' }
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
      standardizedService: mapping.serviceCategory, // Use the universal service category
      confidence: mapping.confidence,
      isResidential: mapping.isResidential,
      residentialSource: mapping.residentialSource,
      isResidentialDetected: mapping.isResidentialDetected,
      residentialDetectionSource: mapping.residentialDetectionSource
    }));
    
    console.log('🏠 ServiceMappingReview - Confirmed mappings with residential data:', confirmedMappings);
    onMappingsConfirmed(confirmedMappings);
  };

  return (
    <div className="space-y-4">
      {/* Needs Review Section */}
      {groupedMappings['needs-review'].length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-base font-semibold">Needs Review ({groupedMappings['needs-review'].length})</h2>
          </div>
          
          <div className="space-y-2">
            {groupedMappings['needs-review'].map((mapping) => (
              <ServiceMappingCard 
                key={mapping.original}
                mapping={mapping}
                updateMapping={updateMapping}
                updateResidentialStatus={updateResidentialStatus}
                confirmMapping={confirmMapping}
                showConfirmButton={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Good Matches Section */}
      {groupedMappings['good-match'].length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <h2 className="text-base font-semibold">Good Matches ({groupedMappings['good-match'].length})</h2>
          </div>
          
          <div className="space-y-2">
            {groupedMappings['good-match'].map((mapping) => (
              <ServiceMappingCard 
                key={mapping.original}
                mapping={mapping}
                updateMapping={updateMapping}
                updateResidentialStatus={updateResidentialStatus}
                showConfirmButton={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Section */}
      <div className="pt-4">
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
  updateMapping: (originalService: string, serviceCategory: UniversalServiceCategory) => void;
  updateResidentialStatus: (originalService: string, isResidential: boolean) => void;
  confirmMapping?: (originalService: string) => void;
  showConfirmButton: boolean;
}

const ServiceMappingCard: React.FC<ServiceMappingCardProps> = ({
  mapping,
  updateMapping,
  updateResidentialStatus,
  confirmMapping,
  showConfirmButton
}) => {
  return (
    <Card className={`p-3 ${mapping.status === 'needs-review' ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* Service Info */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2 mb-1">
              {mapping.status === 'needs-review' ? (
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="font-medium text-sm truncate">{mapping.original}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  → {UNIVERSAL_SERVICES[mapping.serviceCategory]?.displayName}
                </p>
              </div>
            </div>
            <span className="text-xs bg-muted px-2 py-1 rounded-full">
              {mapping.count} shipments
            </span>
          </div>
          
          {/* Service Category Selector */}
          <div className="lg:col-span-4">
            <label className="text-xs text-muted-foreground">Service Category:</label>
            <div className="mt-1">
              <UniversalServiceSelector
                value={mapping.serviceCategory}
                onValueChange={(value) => updateMapping(mapping.original, value)}
                placeholder="Select service category"
              />
            </div>
          </div>
          
          {/* Residential Toggle & Actions */}
          <div className="lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {mapping.isResidential ? (
                  <Home className="h-3 w-3 text-primary flex-shrink-0" />
                ) : (
                  <Building className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="text-xs font-medium truncate">
                    {mapping.isResidential ? 'Residential' : 'Commercial'}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    ({mapping.residentialSource})
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  checked={mapping.isResidential}
                  onCheckedChange={(checked) => updateResidentialStatus(mapping.original, checked)}
                />
                {showConfirmButton && confirmMapping && (
                  <Button
                    onClick={() => confirmMapping(mapping.original)}
                    variant="default"
                    size="sm"
                    className="text-xs px-2 py-1 h-8"
                  >
                    Confirm
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};