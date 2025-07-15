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
      <div className="flex items-center bg-muted rounded-lg p-1 mb-4">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
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

  const RadialServiceFilters = () => {
    const toggleService = (service: string) => {
      if (!onSelectedServicesChange) return;
      const newSelection = selectedServices.includes(service) 
        ? selectedServices.filter(s => s !== service)
        : [...selectedServices, service];
      onSelectedServicesChange(newSelection);
    };

    return (
      <div className="flex flex-wrap gap-3 mb-6">
        {availableServices.map((service, index) => {
          const isSelected = selectedServices.includes(service);
          const colors = [
            'border-red-500 bg-red-500', 
            'border-blue-500 bg-blue-500', 
            'border-green-500 bg-green-500',
            'border-orange-500 bg-orange-500',
            'border-purple-500 bg-purple-500',
            'border-pink-500 bg-pink-500',
            'border-indigo-500 bg-indigo-500',
            'border-teal-500 bg-teal-500'
          ];
          const colorClass = colors[index % colors.length];
          
          return (
            <button
              key={service}
              onClick={() => toggleService(service)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                isSelected 
                  ? `${colorClass} text-white shadow-md` 
                  : "border-muted bg-background hover:border-muted-foreground/50"
              )}
            >
              <div 
                className={cn(
                  "w-3 h-3 rounded-full border-2",
                  isSelected 
                    ? "bg-white border-white" 
                    : `${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]}/20`
                )}
              />
              {service}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Global Markup Configuration (Internal View Only) - Moved Above */}
      {activeView === 'internal' && onUpdateMarkup && (
        <Card>
          <CardHeader>
            <CardTitle>Global Markup Configuration</CardTitle>
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
          <h2 className="text-xl font-semibold">Day Snapshot</h2>
          {onSnapshotDaysChange && (
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
              <div className="text-2xl font-bold mt-2">{formatCurrency(totals.totalCurrentCost)}</div>
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
              <div className="text-2xl font-bold mt-2 text-green-600">{formatCurrency(totals.totalSavings)}</div>
              <div className="text-sm text-muted-foreground">{formatPercentage(totals.savingsPercentage)}</div>
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

      {/* Radial Service Filters */}
      {onSelectedServicesChange && <RadialServiceFilters />}

      {/* Service Analysis Overview - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle>Service Analysis Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Result Filter positioned right above the table */}
          <div className="px-6 pt-6 pb-4">
            <ResultFilter value={resultFilter} onChange={onResultFilterChange || (() => {})} />
          </div>
          <div className="px-6 pb-6">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
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
                {serviceAnalysisData.map((service, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <Badge variant="secondary">{service.currentService}</Badge>
                    </td>
                    <td className="py-3 px-2 text-right">{formatCurrency(service.avgCurrentCost)}</td>
                    <td className="py-3 px-2 text-right">{formatCurrency(service.avgFinalRate)}</td>
                    <td className="py-3 px-2 text-right">
                      <Badge variant="outline">{service.shipProsService}</Badge>
                    </td>
                    <td className="py-3 px-2 text-right">{service.shipmentCount}</td>
                    <td className="py-3 px-2 text-right">{formatPercentage(service.volumePercent)}</td>
                    <td className="py-3 px-2 text-right">{service.avgWeight.toFixed(1)} lbs</td>
                    <td className="py-3 px-2 text-right font-medium text-green-600">
                      {formatCurrency(service.avgSavings)}
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-green-600">
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      {chartData && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Analytics Overview</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Service Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Service Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData.serviceChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {chartData.serviceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: any) => [`${value} shipments`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Comparison by Service */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Comparison by Service</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.serviceCostData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="currentService" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any, name: any, props: any) => {
                        const { payload } = props;
                        if (name === 'avgCurrentCost') return [`$${value.toFixed(2)}`, 'Current Avg Cost'];
                        if (name === 'avgNewCost') return [`$${value.toFixed(2)}`, `${payload.shipProsService} Avg Cost`];
                        return [value, name];
                      }}
                      labelFormatter={(label: any) => `Service: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="avgCurrentCost" fill="#dc2626" name="Current Avg Cost" />
                    <Bar dataKey="avgNewCost" fill="#22c55e" name="Ship Pros Avg Cost" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Rate Comparison by Weight */}
            <Card>
              <CardHeader>
                <CardTitle>Rate Comparison by Weight</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.weightChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weightRange" />
                    <YAxis />
                    <Tooltip formatter={(value: any, name: any) => [`$${value.toFixed(2)}`, name]} />
                    <Legend />
                    <Bar dataKey="avgCurrentCost" fill="#dc2626" name="Current Avg Cost" />
                    <Bar dataKey="avgNewCost" fill="#22c55e" name="UPS Avg Cost" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Rate Comparison by Zone */}
            <Card>
              <CardHeader>
                <CardTitle>Rate Comparison by Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.zoneChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="zone" />
                    <YAxis />
                    <Tooltip formatter={(value: any, name: any) => [`$${value.toFixed(2)}`, name]} />
                    <Legend />
                    <Bar dataKey="avgCurrentCost" fill="#dc2626" name="Current Avg Cost" />
                    <Bar dataKey="avgNewCost" fill="#22c55e" name="UPS Avg Cost" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}