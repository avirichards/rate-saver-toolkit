import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { RefreshCw, Save, Edit3, Target, TrendingUp, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ServiceAssignment {
  serviceType: string;
  serviceName: string;
  currentCarrierId: string;
  currentCarrierName: string;
  currentAccountName: string;
  currentAverageRate: number;
  totalShipments: number;
  totalVolume: number;
  availableCarriers: Array<{
    carrierId: string;
    carrierName: string;
    accountName: string;
    averageRate: number;
    shipmentCount: number;
    estimatedSavings: number;
    hasNegotiatedRates: boolean;
  }>;
}

interface EditableServiceAssignmentsProps {
  initialAssignments: ServiceAssignment[];
  analysisResults: any[];
  onReassignmentComplete: (newAssignments: ServiceAssignment[], impactAnalysis: any) => void;
  onReanalyze?: (serviceTypes: string[], newCarrierIds: string[]) => void;
  isReanalyzing?: boolean;
}

export function EditableServiceAssignments({
  initialAssignments,
  analysisResults,
  onReassignmentComplete,
  onReanalyze,
  isReanalyzing = false
}: EditableServiceAssignmentsProps) {
  const [assignments, setAssignments] = useState<ServiceAssignment[]>(initialAssignments);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false);
  const [impactData, setImpactData] = useState<any>(null);

  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  // Track changes and calculate impact
  useEffect(() => {
    if (Object.keys(pendingChanges).length > 0) {
      calculateImpact();
    }
  }, [pendingChanges, assignments]);

  const handleCarrierChange = (serviceType: string, newCarrierId: string) => {
    const assignment = assignments.find(a => a.serviceType === serviceType);
    if (!assignment) return;

    const newCarrier = assignment.availableCarriers.find(c => 
      `${c.carrierId}-${c.accountName}` === newCarrierId
    );
    
    if (!newCarrier) return;

    // Update pending changes
    setPendingChanges(prev => ({
      ...prev,
      [serviceType]: newCarrierId
    }));

    // Update assignments preview
    setAssignments(prev => prev.map(assignment => {
      if (assignment.serviceType === serviceType) {
        return {
          ...assignment,
          currentCarrierId: newCarrier.carrierId,
          currentCarrierName: newCarrier.carrierName,
          currentAccountName: newCarrier.accountName,
          currentAverageRate: newCarrier.averageRate
        };
      }
      return assignment;
    }));

    setShowImpactAnalysis(true);
  };

  const calculateImpact = () => {
    const changedServices = assignments.filter(a => pendingChanges[a.serviceType]);
    
    const totalSavingsChange = changedServices.reduce((sum, assignment) => {
      const originalRate = initialAssignments.find(ia => ia.serviceType === assignment.serviceType)?.currentAverageRate || 0;
      const newRate = assignment.currentAverageRate;
      const shipments = assignment.totalShipments;
      return sum + ((originalRate - newRate) * shipments);
    }, 0);

    const totalShipmentsAffected = changedServices.reduce((sum, a) => sum + a.totalShipments, 0);

    const carrierDistribution = changedServices.reduce((acc, assignment) => {
      const carrierKey = assignment.currentAccountName;
      if (!acc[carrierKey]) {
        acc[carrierKey] = { shipments: 0, services: [] };
      }
      acc[carrierKey].shipments += assignment.totalShipments;
      acc[carrierKey].services.push(assignment.serviceType);
      return acc;
    }, {} as Record<string, { shipments: number; services: string[] }>);

    setImpactData({
      changedServices: changedServices.length,
      totalSavingsChange,
      totalShipmentsAffected,
      carrierDistribution,
      riskFactors: analyzeRiskFactors(changedServices)
    });
  };

  const analyzeRiskFactors = (changedServices: ServiceAssignment[]) => {
    const risks = [];
    
    // Check for significant rate increases
    changedServices.forEach(service => {
      const original = initialAssignments.find(ia => ia.serviceType === service.serviceType);
      if (original && service.currentAverageRate > original.currentAverageRate * 1.1) {
        risks.push({
          type: 'rate_increase',
          service: service.serviceType,
          message: `${service.serviceType} rate increased by ${(((service.currentAverageRate - original.currentAverageRate) / original.currentAverageRate) * 100).toFixed(1)}%`
        });
      }
    });

    // Check for carrier concentration
    const carrierCounts = changedServices.reduce((acc, service) => {
      acc[service.currentAccountName] = (acc[service.currentAccountName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(carrierCounts).forEach(([carrier, count]) => {
      if (count > 3) {
        risks.push({
          type: 'concentration',
          carrier,
          message: `High concentration: ${carrier} assigned to ${count} service types`
        });
      }
    });

    return risks;
  };

  const applyChanges = () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.error('No changes to apply');
      return;
    }

    console.log('✅ Applying service type reassignments:', {
      changedServices: Object.keys(pendingChanges),
      newAssignments: assignments.filter(a => pendingChanges[a.serviceType])
    });

    onReassignmentComplete(assignments, impactData);
    setPendingChanges({});
    setShowImpactAnalysis(false);
    
    toast.success(`Applied changes to ${Object.keys(pendingChanges).length} service types`);
  };

  const triggerReanalysis = () => {
    if (!onReanalyze) {
      toast.error('Reanalysis not available');
      return;
    }

    const changedServiceTypes = Object.keys(pendingChanges);
    const newCarrierIds = assignments
      .filter(a => pendingChanges[a.serviceType])
      .map(a => a.currentCarrierId);

    console.log('🔄 Triggering reanalysis for changed assignments:', {
      serviceTypes: changedServiceTypes,
      carrierIds: newCarrierIds
    });

    onReanalyze(changedServiceTypes, [...new Set(newCarrierIds)]);
  };

  const resetChanges = () => {
    setAssignments(initialAssignments);
    setPendingChanges({});
    setShowImpactAnalysis(false);
    setImpactData(null);
    toast.info('Changes reset');
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Edit Service Assignments
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Adjust carrier assignments by service type and see the impact in real-time
              </p>
            </div>
            <div className="flex gap-2">
              {hasChanges && (
                <>
                  <Button onClick={resetChanges} variant="outline">
                    Reset
                  </Button>
                  {onReanalyze && (
                    <Button 
                      onClick={triggerReanalysis} 
                      variant="outline"
                      disabled={isReanalyzing}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isReanalyzing ? 'animate-spin' : ''}`} />
                      Re-analyze
                    </Button>
                  )}
                  <Button onClick={applyChanges} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Apply Changes ({Object.keys(pendingChanges).length})
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList>
          <TabsTrigger value="assignments">Service Assignments</TabsTrigger>
          {showImpactAnalysis && (
            <TabsTrigger value="impact" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Impact Analysis
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="assignments">
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const isPendingChange = !!pendingChanges[assignment.serviceType];
              const originalAssignment = initialAssignments.find(ia => ia.serviceType === assignment.serviceType);
              
              return (
                <Card key={assignment.serviceType} className={isPendingChange ? 'border-orange-200 bg-orange-50/50' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          {assignment.serviceName}
                          {isPendingChange && (
                            <Badge variant="secondary" className="text-xs">
                              <Edit3 className="h-3 w-3 mr-1" />
                              Modified
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {assignment.totalShipments} shipments • {formatCurrency(assignment.totalVolume)} volume
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Current Assignment</div>
                          <div className="font-medium">{assignment.currentAccountName}</div>
                          <div className="text-sm text-green-600">{formatCurrency(assignment.currentAverageRate)}</div>
                        </div>
                        <Select
                          value={`${assignment.currentCarrierId}-${assignment.currentAccountName}`}
                          onValueChange={(value) => handleCarrierChange(assignment.serviceType, value)}
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assignment.availableCarriers.map((carrier) => {
                              const carrierKey = `${carrier.carrierId}-${carrier.accountName}`;
                              const isCurrentSelection = carrierKey === `${assignment.currentCarrierId}-${assignment.currentAccountName}`;
                              
                              return (
                                <SelectItem key={carrierKey} value={carrierKey}>
                                  <div className="flex items-center justify-between w-full">
                                    <div>
                                      <div className="font-medium">{carrier.accountName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {carrier.shipmentCount} shipments • {formatCurrency(carrier.averageRate)} avg
                                      </div>
                                    </div>
                                    {isCurrentSelection && (
                                      <CheckCircle className="h-4 w-4 text-green-600 ml-2" />
                                    )}
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
                          <TableHead>Account Option</TableHead>
                          <TableHead>Avg Rate</TableHead>
                          <TableHead>Coverage</TableHead>
                          <TableHead>Est. Savings</TableHead>
                          <TableHead>Rate Type</TableHead>
                          <TableHead>Impact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignment.availableCarriers.map((carrier) => {
                          const isSelected = `${carrier.carrierId}-${carrier.accountName}` === `${assignment.currentCarrierId}-${assignment.currentAccountName}`;
                          const savingsVsOriginal = originalAssignment ? 
                            (originalAssignment.currentAverageRate - carrier.averageRate) * assignment.totalShipments : 0;
                          
                          return (
                            <TableRow key={`${carrier.carrierId}-${carrier.accountName}`} className={isSelected ? 'bg-green-50' : ''}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div>
                                    <div className="font-medium">{carrier.accountName}</div>
                                    <div className="text-xs text-muted-foreground">{carrier.carrierName}</div>
                                  </div>
                                  {isSelected && <CheckCircle className="h-4 w-4 text-green-600" />}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(carrier.averageRate)}
                              </TableCell>
                              <TableCell>
                                {carrier.shipmentCount} of {assignment.totalShipments}
                                <div className="text-xs text-muted-foreground">
                                  {((carrier.shipmentCount / assignment.totalShipments) * 100).toFixed(1)}% coverage
                                </div>
                              </TableCell>
                              <TableCell className={savingsVsOriginal > 0 ? 'text-green-600' : savingsVsOriginal < 0 ? 'text-red-600' : ''}>
                                {formatCurrency(Math.abs(savingsVsOriginal))}
                                {savingsVsOriginal !== 0 && (
                                  <div className="text-xs">
                                    {savingsVsOriginal > 0 ? 'savings' : 'increase'}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={carrier.hasNegotiatedRates ? 'default' : 'secondary'}>
                                  {carrier.hasNegotiatedRates ? 'Negotiated' : 'Published'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isSelected && (
                                  <Badge variant="default" className="flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    Active
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
        </TabsContent>

        {showImpactAnalysis && impactData && (
          <TabsContent value="impact">
            <div className="space-y-6">
              {/* Impact Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Impact Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{impactData.changedServices}</div>
                      <div className="text-sm text-muted-foreground">Services Modified</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${impactData.totalSavingsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(impactData.totalSavingsChange))}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {impactData.totalSavingsChange >= 0 ? 'Additional Savings' : 'Cost Increase'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{impactData.totalShipmentsAffected}</div>
                      <div className="text-sm text-muted-foreground">Shipments Affected</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Factors */}
              {impactData.riskFactors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-5 w-5" />
                      Risk Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {impactData.riskFactors.map((risk: any, index: number) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                          <div>
                            <div className="font-medium text-orange-800">
                              {risk.type === 'rate_increase' ? 'Rate Increase' : 'Carrier Concentration'}
                            </div>
                            <div className="text-sm text-orange-700">{risk.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Carrier Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>New Carrier Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(impactData.carrierDistribution).map(([carrier, data]: [string, any]) => (
                      <div key={carrier} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{carrier}</div>
                          <div className="text-sm text-muted-foreground">
                            Services: {data.services.join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{data.shipments} shipments</div>
                          <div className="text-sm text-muted-foreground">{data.services.length} service types</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}