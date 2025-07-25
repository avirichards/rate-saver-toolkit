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
                updateMapping={updateMapping}
                updateResidentialStatus={updateResidentialStatus}
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
                <p className="text-sm text-muted-foreground">
                  Mapped to: {UNIVERSAL_SERVICES[mapping.serviceCategory]?.displayName}
                </p>
              </div>
              <div className="ml-auto">
                <span className="text-xs bg-muted px-2 py-1 rounded-full">
                  {mapping.count} shipments
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground">Service Category:</label>
                <div className="mt-1">
                  <UniversalServiceSelector
                    value={mapping.serviceCategory}
                    onValueChange={(value) => updateMapping(mapping.original, value)}
                    placeholder="Select service category"
                  />
                </div>
              </div>
            </div>
            
            {/* Residential Toggle */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                {mapping.isResidential ? (
                  <Home className="h-4 w-4 text-primary" />
                ) : (
                  <Building className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">
                  {mapping.isResidential ? 'Residential Delivery' : 'Commercial Delivery'}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({mapping.residentialSource})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={mapping.isResidential}
                  onCheckedChange={(checked) => updateResidentialStatus(mapping.original, checked)}
                />
                {showConfirmButton && confirmMapping && (
                  <Button
                    onClick={() => confirmMapping(mapping.original)}
                    variant="default"
                    size="sm"
                  >
                    Confirm as Correct
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