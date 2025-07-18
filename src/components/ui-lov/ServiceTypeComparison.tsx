import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Award, Edit3 } from 'lucide-react';
import { formatCurrency, getSavingsColor } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ServiceTypePerformance {
  serviceType: string;
  bestAccount: {
    name: string;
    cost: number;
    savings: number;
    savingsPercent: number;
  };
  shipmentCount: number;
  competitors: Array<{
    name: string;
    cost: number;
    savings: number;
    savingsPercent: number;
  }>;
  weightBands?: Array<{
    range: string;
    bestAccount: string;
    savings: number;
  }>;
}

interface ServiceTypeComparisonProps {
  services: ServiceTypePerformance[];
  onServiceSelect: (serviceType: string) => void;
  onAccountAssign: (serviceType: string, accountName: string) => void;
  onDrillDown: (level: 3, serviceType?: string) => void;
  onBack: () => void;
}

export function ServiceTypeComparison({ 
  services, 
  onServiceSelect, 
  onAccountAssign,
  onDrillDown,
  onBack 
}: ServiceTypeComparisonProps) {
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  const toggleExpand = (serviceType: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceType)) {
      newExpanded.delete(serviceType);
    } else {
      newExpanded.add(serviceType);
    }
    setExpandedServices(newExpanded);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Service Type Comparison</h2>
          <p className="text-sm text-muted-foreground">Performance breakdown by service type</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            ← Back to Summary
          </Button>
          <Button
            variant="outline"
            onClick={() => onDrillDown(3)}
            className="gap-2"
          >
            View All Shipments
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-6 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
          <div>Service Type</div>
          <div>Best Account</div>
          <div className="text-right">Shipments</div>
          <div className="text-right">Ship Pros Cost</div>
          <div className="text-right">Savings</div>
          <div className="text-center">Actions</div>
        </div>

        {services.map((service) => (
          <Collapsible key={service.serviceType}>
            <div className="border rounded-lg">
              <div className="grid grid-cols-6 gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger
                    onClick={() => toggleExpand(service.serviceType)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {expandedServices.has(service.serviceType) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>
                  <div>
                    <span className="font-medium text-foreground">{service.serviceType}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-500" />
                  <div>
                    <div className="font-medium text-foreground">{service.bestAccount.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {service.bestAccount.savingsPercent.toFixed(1)}% savings
                    </div>
                  </div>
                </div>
                
                <div className="text-right font-mono text-sm">
                  {service.shipmentCount.toLocaleString()}
                </div>
                
                <div className="text-right font-mono text-sm">
                  {formatCurrency(service.bestAccount.cost)}
                </div>
                
                <div className={`text-right font-mono text-sm ${getSavingsColor(service.bestAccount.savings)}`}>
                  {formatCurrency(service.bestAccount.savings)}
                </div>
                
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAccountAssign(service.serviceType, service.bestAccount.name)}
                    className="gap-1 h-7 text-xs"
                  >
                    <Edit3 className="h-3 w-3" />
                    Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDrillDown(3, service.serviceType)}
                    className="h-7 text-xs"
                  >
                    Details
                  </Button>
                </div>
              </div>

              <CollapsibleContent>
                <div className="px-4 pb-3 border-t bg-muted/20">
                  <div className="py-3">
                    <h4 className="text-sm font-medium text-foreground mb-2">Competing Accounts</h4>
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      {service.competitors.map((competitor) => (
                        <div key={competitor.name} className="flex justify-between">
                          <span className="text-muted-foreground">{competitor.name}</span>
                          <div className="text-right">
                            <div>{formatCurrency(competitor.cost)}</div>
                            <div className={getSavingsColor(competitor.savings)}>
                              {competitor.savingsPercent.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {service.weightBands && (
                    <div className="py-3 border-t">
                      <h4 className="text-sm font-medium text-foreground mb-2">Weight Band Analysis</h4>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        {service.weightBands.map((band, index) => (
                          <div key={index} className="flex justify-between">
                            <span className="text-muted-foreground">{band.range}</span>
                            <div className="text-right">
                              <div className="font-medium">{band.bestAccount}</div>
                              <div className={getSavingsColor(band.savings)}>
                                {formatCurrency(band.savings)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {services.length} service types analyzed
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              services.forEach(service => 
                onAccountAssign(service.serviceType, service.bestAccount.name)
              );
            }}
          >
            Assign All Best Accounts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDrillDown(3)}
          >
            View Shipment Details
          </Button>
        </div>
      </div>
    </Card>
  );
}