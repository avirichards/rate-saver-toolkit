import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Percent, DollarSign } from 'lucide-react';
import type { MarkupConfig } from '@/hooks/useShippingAnalyses';

interface MarkupEditorProps {
  markupConfig: MarkupConfig;
  onUpdateMarkup: (config: MarkupConfig) => void;
  services: string[];
}

export function MarkupEditor({ markupConfig, onUpdateMarkup, services }: MarkupEditorProps) {
  const handleGlobalChange = (percentage: number) => {
    onUpdateMarkup({
      type: 'global',
      globalPercentage: percentage
    });
  };

  const handleServiceChange = (service: string, percentage: number) => {
    const newServiceMarkups = {
      ...markupConfig.serviceMarkups,
      [service]: percentage
    };
    
    onUpdateMarkup({
      type: 'per-service',
      serviceMarkups: newServiceMarkups
    });
  };

  const handleTypeChange = (type: 'global' | 'per-service') => {
    if (type === 'global') {
      onUpdateMarkup({
        type: 'global',
        globalPercentage: markupConfig.globalPercentage || 15
      });
    } else {
      onUpdateMarkup({
        type: 'per-service',
        serviceMarkups: markupConfig.serviceMarkups || {}
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Markup Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs 
          value={markupConfig.type} 
          onValueChange={(value) => handleTypeChange(value as 'global' | 'per-service')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global">Global Markup</TabsTrigger>
            <TabsTrigger value="per-service">Per Service</TabsTrigger>
          </TabsList>
          
          <TabsContent value="global" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="globalPercentage">Global Markup Percentage</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="globalPercentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={markupConfig.globalPercentage || 0}
                    onChange={(e) => handleGlobalChange(Number(e.target.value))}
                    className="w-24"
                  />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                This percentage will be applied to all services uniformly.
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="per-service" className="mt-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Set individual markup percentages for each service type.
              </div>
              <div className="space-y-3">
                {services.map((service) => (
                  <div key={service} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{service}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={markupConfig.serviceMarkups?.[service] || 0}
                        onChange={(e) => handleServiceChange(service, Number(e.target.value))}
                        className="w-20"
                      />
                      <Percent className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}