import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle, TruckIcon, Package, Target } from 'lucide-react';

interface ServiceTypeRate {
  serviceType: string;
  serviceName: string;
  carrierRates: Array<{
    carrierId: string;
    carrierName: string;
    accountName: string;
    rate: number;
    currency: string;
    transitTime?: string;
    hasNegotiatedRates?: boolean;
    averageRate: number;
    shipmentCount: number;
    totalVolume: number;
  }>;
}

interface ServiceTypeAssignment {
  serviceType: string;
  assignedCarrierId: string;
  assignedCarrierName: string;
  assignedAccountName: string;
  averageRate: number;
  estimatedSavings: number;
  affectedShipments: number;
}

interface ServiceTypeCarrierAssignmentProps {
  analysisResults: any[];
  onAssignmentComplete: (assignments: ServiceTypeAssignment[]) => void;
  onBack?: () => void;
}

export function ServiceTypeCarrierAssignment({ 
  analysisResults, 
  onAssignmentComplete,
  onBack 
}: ServiceTypeCarrierAssignmentProps) {
  const [serviceTypeData, setServiceTypeData] = useState<ServiceTypeRate[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    processAnalysisResults();
  }, [analysisResults]);

  const processAnalysisResults = () => {
    console.log('🔄 Processing analysis results for service-type assignment:', analysisResults.length);
    
    // Group results by service type and calculate carrier performance
    const serviceTypeMap: Record<string, {
      serviceName: string;
      carriers: Record<string, {
        carrierId: string;
        carrierName: string;
        accountName: string;
        rates: number[];
        shipmentCount: number;
        totalCurrentCost: number;
      }>;
    }> = {};

    analysisResults.forEach(result => {
      if (result.status === 'completed' && result.allRates && result.originalService) {
        const serviceType = result.originalService;
        
        if (!serviceTypeMap[serviceType]) {
          serviceTypeMap[serviceType] = {
            serviceName: serviceType,
            carriers: {}
          };
        }

        // Process each carrier's rates for this service type
        result.carrierResults?.forEach((carrierResult: any) => {
          if (carrierResult.success && carrierResult.rates) {
            carrierResult.rates.forEach((rate: any) => {
              const carrierId = carrierResult.carrierId || rate.carrierId;
              const carrierKey = `${carrierId}-${carrierResult.name}`;
              
              if (!serviceTypeMap[serviceType].carriers[carrierKey]) {
                serviceTypeMap[serviceType].carriers[carrierKey] = {
                  carrierId,
                  carrierName: rate.carrier || 'UPS',
                  accountName: carrierResult.name,
                  rates: [],
                  shipmentCount: 0,
                  totalCurrentCost: 0
                };
              }

              serviceTypeMap[serviceType].carriers[carrierKey].rates.push(rate.totalCharges || 0);
              serviceTypeMap[serviceType].carriers[carrierKey].shipmentCount++;
              serviceTypeMap[serviceType].carriers[carrierKey].totalCurrentCost += result.currentCost || 0;
            });
          }
        });
      }
    });

    // Convert to ServiceTypeRate format
    const processedData: ServiceTypeRate[] = Object.entries(serviceTypeMap).map(([serviceType, data]) => {
      const carrierRates = Object.entries(data.carriers).map(([carrierKey, carrier]) => {
        const averageRate = carrier.rates.length > 0 
          ? carrier.rates.reduce((sum, rate) => sum + rate, 0) / carrier.rates.length 
          : 0;
        
        return {
          carrierId: carrier.carrierId,
          carrierName: carrier.carrierName,
          accountName: carrier.accountName,
          rate: averageRate,
          currency: 'USD',
          averageRate,
          shipmentCount: carrier.shipmentCount,
          totalVolume: carrier.totalCurrentCost,
          hasNegotiatedRates: averageRate > 0
        };
      }).sort((a, b) => a.averageRate - b.averageRate); // Sort by best rate first

      return {
        serviceType,
        serviceName: data.serviceName,
        carrierRates
      };
    }).filter(service => service.carrierRates.length > 0);

    console.log('📊 Processed service type data:', processedData);
    setServiceTypeData(processedData);

    // Auto-assign best rates
    const autoAssignments: Record<string, string> = {};
    processedData.forEach(service => {
      if (service.carrierRates.length > 0) {
        const bestCarrier = service.carrierRates[0];
        autoAssignments[service.serviceType] = `${bestCarrier.carrierId}-${bestCarrier.accountName}`;
      }
    });
    setAssignments(autoAssignments);
  };

  const handleAssignmentChange = (serviceType: string, carrierKey: string) => {
    setAssignments(prev => ({
      ...prev,
      [serviceType]: carrierKey
    }));
  };

  const calculateAssignmentImpact = (): ServiceTypeAssignment[] => {
    return serviceTypeData.map(service => {
      const assignedCarrierKey = assignments[service.serviceType];
      const assignedCarrier = service.carrierRates.find(c => 
        `${c.carrierId}-${c.accountName}` === assignedCarrierKey
      );

      if (!assignedCarrier) {
        return {
          serviceType: service.serviceType,
          assignedCarrierId: '',
          assignedCarrierName: '',
          assignedAccountName: '',
          averageRate: 0,
          estimatedSavings: 0,
          affectedShipments: 0
        };
      }

      // Calculate potential savings vs current costs
      const currentAverageRate = service.carrierRates.reduce((sum, c) => 
        sum + (c.totalVolume / c.shipmentCount), 0
      ) / service.carrierRates.length;

      const estimatedSavings = Math.max(0, currentAverageRate - assignedCarrier.averageRate) * assignedCarrier.shipmentCount;

      return {
        serviceType: service.serviceType,
        assignedCarrierId: assignedCarrier.carrierId,
        assignedCarrierName: assignedCarrier.carrierName,
        assignedAccountName: assignedCarrier.accountName,
        averageRate: assignedCarrier.averageRate,
        estimatedSavings,
        affectedShipments: assignedCarrier.shipmentCount
      };
    });
  };

  const handleComplete = () => {
    const finalAssignments = calculateAssignmentImpact();
    console.log('✅ Final service type assignments:', finalAssignments);
    setIsComplete(true);
    onAssignmentComplete(finalAssignments);
  };

  const totalEstimatedSavings = calculateAssignmentImpact().reduce(
    (sum, assignment) => sum + assignment.estimatedSavings, 0
  );

  const totalAffectedShipments = calculateAssignmentImpact().reduce(
    (sum, assignment) => sum + assignment.affectedShipments, 0
  );

  if (serviceTypeData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No service type data available for carrier assignment.</p>
          {onBack && (
            <Button onClick={onBack} variant="outline" className="mt-4">
              Go Back
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Service Type Carrier Assignment
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign the best carrier account for each service type based on your analysis results. 
            This approach is more operationally realistic than per-shipment assignments.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{serviceTypeData.length}</div>
              <div className="text-sm text-muted-foreground">Service Types</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalEstimatedSavings)}</div>
              <div className="text-sm text-muted-foreground">Est. Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalAffectedShipments}</div>
              <div className="text-sm text-muted-foreground">Total Shipments</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {serviceTypeData.map((service) => {
          const assignedCarrierKey = assignments[service.serviceType];
          const assignedCarrier = service.carrierRates.find(c => 
            `${c.carrierId}-${c.accountName}` === assignedCarrierKey
          );

          return (
            <Card key={service.serviceType}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{service.serviceName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {service.carrierRates.reduce((sum, c) => sum + c.shipmentCount, 0)} shipments
                    </p>
                  </div>
                  <div className="text-right">
                    <Select
                      value={assignedCarrierKey || ''}
                      onValueChange={(value) => handleAssignmentChange(service.serviceType, value)}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select carrier account" />
                      </SelectTrigger>
                      <SelectContent>
                        {service.carrierRates.map((carrier) => {
                          const carrierKey = `${carrier.carrierId}-${carrier.accountName}`;
                          return (
                            <SelectItem key={carrierKey} value={carrierKey}>
                              <div className="flex items-center justify-between w-full">
                                <span>{carrier.accountName}</span>
                                <span className="ml-2 font-medium">
                                  {formatCurrency(carrier.averageRate)}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Avg Rate</TableHead>
                      <TableHead>Shipments</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {service.carrierRates.map((carrier) => {
                      const carrierKey = `${carrier.carrierId}-${carrier.accountName}`;
                      const isAssigned = assignedCarrierKey === carrierKey;
                      
                      return (
                        <TableRow key={carrierKey} className={isAssigned ? 'bg-green-50' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TruckIcon className="h-4 w-4" />
                              <span className="font-medium">{carrier.accountName}</span>
                              {carrier.hasNegotiatedRates && (
                                <Badge variant="secondary" className="text-xs">Negotiated</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(carrier.averageRate)}
                          </TableCell>
                          <TableCell>{carrier.shipmentCount}</TableCell>
                          <TableCell>{formatCurrency(carrier.totalVolume)}</TableCell>
                          <TableCell>
                            {isAssigned && (
                              <Badge variant="default" className="flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Selected
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Assignment Summary</h3>
              <p className="text-sm text-muted-foreground">
                {serviceTypeData.filter(s => assignments[s.serviceType]).length} of {serviceTypeData.length} service types assigned
              </p>
            </div>
            <div className="flex gap-2">
              {onBack && (
                <Button onClick={onBack} variant="outline">
                  Back
                </Button>
              )}
              <Button 
                onClick={handleComplete}
                disabled={Object.keys(assignments).length !== serviceTypeData.length || isComplete}
                className="min-w-32"
              >
                {isComplete ? 'Assignments Complete' : 'Apply Assignments'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}