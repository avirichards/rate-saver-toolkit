import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, User, DollarSign, Percent } from 'lucide-react';
import type { ReportConfig, MarkupConfig } from '@/hooks/useShippingAnalyses';

interface ReportConfigurationProps {
  onSave: (config: ReportConfig) => void;
  onCancel: () => void;
  services: string[];
  loading?: boolean;
}

export function ReportConfiguration({ 
  onSave, 
  onCancel, 
  services, 
  loading = false 
}: ReportConfigurationProps) {
  const [reportName, setReportName] = useState('');
  const [clientName, setClientName] = useState('');
  const [markupType, setMarkupType] = useState<'global' | 'per-service'>('global');
  const [globalPercentage, setGlobalPercentage] = useState(15);
  const [serviceMarkups, setServiceMarkups] = useState<Record<string, number>>({});

  const handleSubmit = () => {
    if (!reportName.trim()) return;

    const markupConfig: MarkupConfig = {
      type: markupType,
      globalPercentage: markupType === 'global' ? globalPercentage : undefined,
      serviceMarkups: markupType === 'per-service' ? serviceMarkups : undefined
    };

    const config: ReportConfig = {
      reportName: reportName.trim(),
      clientName: clientName.trim() || undefined,
      markupConfig
    };

    onSave(config);
  };

  const handleServiceMarkupChange = (service: string, value: number) => {
    setServiceMarkups(prev => ({
      ...prev,
      [service]: value
    }));
  };

  const isValid = reportName.trim().length > 0;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Report Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reportName">Report Name *</Label>
            <Input
              id="reportName"
              placeholder="Enter report name"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name (Optional)</Label>
            <Input
              id="clientName"
              placeholder="Enter client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
        </div>

        {/* Markup Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <Label className="text-base font-medium">Markup Configuration</Label>
          </div>
          
          <Tabs value={markupType} onValueChange={(value) => setMarkupType(value as 'global' | 'per-service')}>
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
                      value={globalPercentage}
                      onChange={(e) => setGlobalPercentage(Number(e.target.value))}
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
                          value={serviceMarkups[service] || 0}
                          onChange={(e) => handleServiceMarkupChange(service, Number(e.target.value))}
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
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || loading}
            loading={loading}
          >
            Save Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}