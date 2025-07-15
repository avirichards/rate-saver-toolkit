import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Users, DollarSign, TrendingDown, Package, Target, TrendingUp, Calendar } from 'lucide-react';
import { useMarkupCalculation } from '@/hooks/useMarkupCalculation';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { MarkupConfig } from '@/hooks/useShippingAnalyses';

interface AnalysisViewerProps {
  results: any[];
  markupConfig: MarkupConfig;
  reportName: string;
  clientName?: string;
  onUpdateMarkup?: (config: MarkupConfig) => void;
  showEditOptions?: boolean;
  activeView: 'internal' | 'client';
  availableServices: string[];
  chartData?: {
    serviceChartData: any[];
    serviceCostData: any[];
    weightChartData: any[];
    zoneChartData: any[];
  };
  // New props for filtering
  selectedServices?: string[];
  onSelectedServicesChange?: (services: string[]) => void;
  resultFilter?: 'all' | 'wins' | 'losses';
  onResultFilterChange?: (filter: 'all' | 'wins' | 'losses') => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  snapshotDays?: number;
  onSnapshotDaysChange?: (days: number) => void;
}

export function AnalysisViewer({ 
  results, 
  markupConfig, 
  reportName, 
  clientName,
  onUpdateMarkup,
  showEditOptions = true,
  activeView,
  availableServices,
  chartData,
  selectedServices = [],
  onSelectedServicesChange,
  resultFilter = 'all',
  onResultFilterChange,
  searchTerm = '',
  onSearchChange,
  snapshotDays = 30,
  onSnapshotDaysChange
}: AnalysisViewerProps) {
  const { calculatedResults, totals } = useMarkupCalculation(results, markupConfig);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  // Filter results based on service selection and result filter
  const filteredResults = useMemo(() => {
    let filtered = calculatedResults;
    
    // Apply service filter (if any services are selected)
    if (selectedServices.length > 0) {
      filtered = filtered.filter(result => {
        const service = result.bestRate?.service || 'Unknown';
        return selectedServices.includes(service);
      });
    }
    
    // Apply result filter
    if (resultFilter === 'wins') {
      filtered = filtered.filter(result => result.savings > 0);
    } else if (resultFilter === 'losses') {
      filtered = filtered.filter(result => result.savings <= 0);
    }
    
    return filtered;
  }, [calculatedResults, selectedServices, resultFilter]);

  // Aggregate results by service type for overview table (using filtered results)
  const serviceAnalysisData = useMemo(() => {
    const serviceGroups = new Map();
    
    filteredResults.forEach(result => {
      const service = result.bestRate?.service || 'Unknown';
      if (!serviceGroups.has(service)) {
        serviceGroups.set(service, {
          currentService: service,
          shipProsService: service, // Using same service for now
          totalCurrentCost: 0,
          totalFinalRate: 0,
          totalBaseUpsRate: 0,
          totalMarkupAmount: 0,
          shipmentCount: 0,
          totalWeight: 0,
          totalSavings: 0
        });
      }
      
      const group = serviceGroups.get(service);
      group.totalCurrentCost += result.currentCost;
      group.totalFinalRate += result.finalRate;
      group.totalBaseUpsRate += result.baseUpsRate;
      group.totalMarkupAmount += result.markupAmount;
      group.shipmentCount += 1;
      group.totalWeight += (result.shipment?.weight || 0);
      group.totalSavings += result.savings;
    });

    return Array.from(serviceGroups.values()).map(group => ({
      ...group,
      avgCurrentCost: group.totalCurrentCost / group.shipmentCount,
      avgFinalRate: group.totalFinalRate / group.shipmentCount,
      avgBaseUpsRate: group.totalBaseUpsRate / group.shipmentCount,
      avgMarkupAmount: group.totalMarkupAmount / group.shipmentCount,
      avgWeight: group.totalWeight / group.shipmentCount,
      avgSavings: group.totalSavings / group.shipmentCount,
      avgSavingsPercent: group.totalCurrentCost > 0 ? (group.totalSavings / group.totalCurrentCost) * 100 : 0,
      volumePercent: calculatedResults.length > 0 ? (group.shipmentCount / calculatedResults.length) * 100 : 0,
      markupPercentage: markupConfig.type === 'global' ? markupConfig.globalPercentage || 0 : markupConfig.serviceMarkups?.[group.currentService] || 0
    }));
  }, [filteredResults, calculatedResults, markupConfig]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

  const handleMarkupChange = (service: string, value: number) => {
    if (!onUpdateMarkup) return;
    
    if (markupConfig.type === 'global') {
      onUpdateMarkup({ ...markupConfig, globalPercentage: value });
    } else {
      onUpdateMarkup({
        ...markupConfig,
        serviceMarkups: {
          ...markupConfig.serviceMarkups,
          [service]: value
        }
      });
    }
  };

  const handleGlobalMarkupChange = (value: number) => {
    if (!onUpdateMarkup) return;
    onUpdateMarkup({ ...markupConfig, globalPercentage: value });
  };

  const handleMarkupTypeChange = (type: 'global' | 'per-service') => {
    if (!onUpdateMarkup) return;
    onUpdateMarkup({ ...markupConfig, type });
  };

  // Components for filtering
  const ResultFilter = ({ value, onChange }: { value: 'all' | 'wins' | 'losses', onChange: (value: 'all' | 'wins' | 'losses') => void }) => {
    const options = [
      { value: 'all', label: 'All' },
      { value: 'wins', label: 'Wins' },
      { value: 'losses', label: 'Losses' }
    ] as const;

    return (
      <div className="inline-flex items-center bg-muted rounded-lg p-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              value === option.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  };

  const ServiceCheckboxFilters = () => {
    const toggleService = (service: string) => {
      if (!onSelectedServicesChange) return;
      const newSelection = selectedServices.includes(service) 
        ? selectedServices.filter(s => s !== service)
        : [...selectedServices, service];
      onSelectedServicesChange(newSelection);
    };

    return (
      <div className="flex flex-wrap gap-4 mb-6">
        {availableServices.map((service) => (
          <label
            key={service}
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedServices.includes(service)}
              onChange={() => toggleService(service)}
              className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
            />
            <span className="text-sm font-medium">{service}</span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Markup Configuration (Internal View Only) */}
      {activeView === 'internal' && onUpdateMarkup && (
        <Card>
          <CardHeader>
            <CardTitle>Markup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="markup-type">Markup Type</Label>
                <Select 
                  value={markupConfig.type} 
                  onValueChange={(value: 'global' | 'per-service') => handleMarkupTypeChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global Markup</SelectItem>
                    <SelectItem value="per-service">Per-Service Markup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {markupConfig.type === 'global' && (
                <div>
                  <Label htmlFor="global-markup">Global Markup %</Label>
                  <Input
                    id="global-markup"
                    type="number"
                    value={markupConfig.globalPercentage || 0}
                    onChange={(e) => handleGlobalMarkupChange(Number(e.target.value))}
                    min="0"
                    max="100"
                    step="0.1"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Margin Summary</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Total Margin:</span>
                    <span className="font-medium">{formatCurrency(totals.totalMargin)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Margin %:</span>
                    <span className="font-medium">{formatPercentage(totals.marginPercentage)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day Snapshot - Colored Summary Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {activeView === 'client' ? `${snapshotDays} Day Snapshot` : 'Day Snapshot'}
          </h2>
          {activeView === 'internal' && onSnapshotDaysChange && (
            <div className="flex items-center gap-2">
              <Label htmlFor="snapshot-days" className="text-sm">Days:</Label>
              <Input
                id="snapshot-days"
                type="number"
                value={snapshotDays}
                onChange={(e) => onSnapshotDaysChange(Number(e.target.value))}
                min="1"
                max="365"
                className="w-20"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Total Shipments</span>
              </div>
              <div className="text-2xl font-bold mt-2">
                {selectedServices.length > 0 || resultFilter !== 'all'
                  ? `${filteredResults.length} of ${calculatedResults.length}`
                  : calculatedResults.length
                }
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Current Cost</span>
              </div>
              <div className={cn(
                "text-2xl font-bold mt-2",
                totals.totalSavings >= 0 ? "text-foreground" : "text-red-600"
              )}>
                {formatCurrency(totals.totalCurrentCost)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Ship Pros Cost</span>
              </div>
              <div className="text-2xl font-bold mt-2">{formatCurrency(totals.totalFinalRate)}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Total Savings</span>
              </div>
              <div className={cn(
                "text-2xl font-bold mt-2",
                totals.totalSavings >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(totals.totalSavings)}
              </div>
              <div className={cn(
                "text-sm text-muted-foreground",
                totals.totalSavings >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatPercentage(totals.savingsPercentage)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-medium">Est. Annual Savings</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-green-600">{formatCurrency(totals.totalSavings * (snapshotDays || 365))}</div>
              <div className="text-sm text-muted-foreground">Based on {snapshotDays || 365} day projection</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Service Analysis Overview - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle>Service Analysis Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Result Filter positioned right above the table */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <ResultFilter value={resultFilter} onChange={onResultFilterChange || (() => {})} />
          </div>
          <div className="px-6 pb-6">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 w-8"></th>
                  <th className="text-left py-3 px-2">Current Service</th>
                  <th className="text-right py-3 px-2">Avg Cost Current</th>
                  <th className="text-right py-3 px-2">Ship Pros Cost</th>
                  <th className="text-right py-3 px-2">Ship Pros Service</th>
                  <th className="text-right py-3 px-2">Shipment Count</th>
                  <th className="text-right py-3 px-2">Volume %</th>
                  <th className="text-right py-3 px-2">Avg Weight</th>
                  <th className="text-right py-3 px-2">Avg Savings ($)</th>
                  <th className="text-right py-3 px-2">Avg Savings (%)</th>
                  {activeView === 'internal' && (
                    <th className="text-right py-3 px-2">Markup %</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {serviceAnalysisData.map((service, index) => {
                  const isSelected = selectedServices.includes(service.currentService);
                  const toggleService = () => {
                    if (!onSelectedServicesChange) return;
                    const newSelection = selectedServices.includes(service.currentService) 
                      ? selectedServices.filter(s => s !== service.currentService)
                      : [...selectedServices, service.currentService];
                    onSelectedServicesChange(newSelection);
                  };
                  
                  return (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        {onSelectedServicesChange && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={toggleService}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
                          />
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary">{service.currentService}</Badge>
                      </td>
                      <td className={cn(
                        "py-3 px-2 text-right",
                        service.avgCurrentCost >= service.avgFinalRate ? "text-foreground" : "text-red-600"
                      )}>
                        {formatCurrency(service.avgCurrentCost)}
                      </td>
                      <td className={cn(
                        "py-3 px-2 text-right",
                        service.avgFinalRate <= service.avgCurrentCost ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(service.avgFinalRate)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Badge variant="outline">{service.shipProsService}</Badge>
                      </td>
                      <td className="py-3 px-2 text-right">{service.shipmentCount}</td>
                      <td className="py-3 px-2 text-right">{formatPercentage(service.volumePercent)}</td>
                      <td className="py-3 px-2 text-right">{service.avgWeight.toFixed(1)} lbs</td>
                      <td className={cn(
                        "py-3 px-2 text-right font-medium",
                        service.avgSavings >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(service.avgSavings)}
                      </td>
                      <td className={cn(
                        "py-3 px-2 text-right font-medium",
                        service.avgSavingsPercent >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatPercentage(service.avgSavingsPercent)}
                      </td>
                      {activeView === 'internal' && (
                      <td className="py-3 px-2 text-right">
                        {markupConfig.type === 'per-service' ? (
                          <Input
                            type="number"
                            value={service.markupPercentage}
                            onChange={(e) => handleMarkupChange(service.currentService, Number(e.target.value))}
                            className="w-16 text-right"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                        ) : (
                          <span>{formatPercentage(service.markupPercentage)}</span>
                        )}
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Service Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Service Distribution</CardTitle>
            <p className="text-sm text-muted-foreground">Shows the percentage breakdown of shipments by service type</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData?.serviceChartData || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                    label={({name, value}) => `${name}: ${value}`}
                  >
                    {(chartData?.serviceChartData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'white'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Comparison by Service</CardTitle>
            <p className="text-sm text-muted-foreground">Compares current shipping costs vs Ship Pros rates by service type</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData?.serviceCostData || []}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="service" tick={{ fill: 'white', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'white', fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [formatCurrency(Number(value)), name === 'currentCost' ? 'Current Cost' : 'Ship Pros Cost']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="currentCost" fill="hsl(var(--destructive))" name="Current Cost" />
                  <Bar dataKey="shipProsCost" fill="hsl(var(--primary))" name="Ship Pros Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rate Comparison by Weight */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Comparison by Weight</CardTitle>
            <p className="text-sm text-muted-foreground">Shows rate differences across various weight ranges</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData?.weightChartData || []}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" tick={{ fill: 'white', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'white', fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [formatCurrency(Number(value)), name === 'current' ? 'Current Rate' : 'Ship Pros Rate']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="current" fill="hsl(var(--destructive))" name="Current Rate" />
                  <Bar dataKey="shipPros" fill="hsl(var(--primary))" name="Ship Pros Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rate Comparison by Zone */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Comparison by Zone</CardTitle>
            <p className="text-sm text-muted-foreground">Analyzes shipping rate performance across different delivery zones</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(chartData?.zoneChartData || []).map(item => ({
                    ...item,
                    zoneDisplay: `Zone ${item.zone}\n${item.shipmentCount || 0} Shipments`
                  }))}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="zoneDisplay" 
                    tick={{ fill: 'white', fontSize: 11 }} 
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: 'white', fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [formatCurrency(Number(value)), name === 'current' ? 'Current Rate' : 'Ship Pros Rate']}
                    labelFormatter={(label) => {
                      const zone = label.split('\n')[0];
                      const shipments = label.split('\n')[1];
                      return `${zone} (${shipments})`;
                    }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="current" fill="hsl(var(--destructive))" name="Current Rate" />
                  <Bar dataKey="shipPros" fill="hsl(var(--primary))" name="Ship Pros Rate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}