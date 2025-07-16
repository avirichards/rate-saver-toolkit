import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, DollarSign, Package, TruckIcon, AlertCircle, Filter, CheckCircle2, XCircle, Calendar, Zap, Target, TrendingUp, TrendingDown, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn, formatCurrency, formatPercentage, getSavingsColor } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { MarkupConfiguration, MarkupData } from '@/components/ui-lov/MarkupConfiguration';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { ClientCombobox } from '@/components/ui-lov/ClientCombobox';
import { 
  processNormalViewData, 
  formatShipmentData, 
  generateExportData,
  handleDataProcessingError,
  ProcessedShipmentData,
  ProcessedAnalysisData 
} from '@/utils/dataProcessing';

// Custom slider component for All/Wins/Losses
const ResultFilter = ({ value, onChange }: { value: 'all' | 'wins' | 'losses', onChange: (value: 'all' | 'wins' | 'losses') => void }) => {
  const options = [
    { value: 'all', label: 'All' },
    { value: 'wins', label: 'Wins' },
    { value: 'losses', label: 'Losses' }
  ] as const;

  return (
    <div className="flex items-center bg-muted rounded-lg p-1">
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

interface ResultsSectionProps {
  analysisResults: any;
  reportId?: string;
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  analysisResults,
  reportId
}) => {
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<ProcessedAnalysisData | null>(null);
  const [shipmentData, setShipmentData] = useState<ProcessedShipmentData[]>([]);
  const [orphanedData, setOrphanedData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedServicesOverview, setSelectedServicesOverview] = useState<string[]>([]);
  const [snapshotDays, setSnapshotDays] = useState(30);
  const [markupData, setMarkupData] = useState<MarkupData | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const hasTriedAutoSave = useRef(false);

  // Function to generate unique file name with numbering
  const generateUniqueFileName = async (baseName: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return baseName;

    // Get existing analyses for this user to check for name conflicts
    const { data: existingAnalyses } = await supabase
      .from('shipping_analyses')
      .select('file_name, report_name')
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    if (!existingAnalyses) return baseName;

    const existingNames = new Set([
      ...existingAnalyses.map(a => a.file_name),
      ...existingAnalyses.map(a => a.report_name).filter(Boolean)
    ]);
    
    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let counter = 1;
    let uniqueName: string;
    const cleanBaseName = baseName.replace(/\s*\(\d+\)$/, '');
    
    do {
      uniqueName = `${cleanBaseName} (${counter})`;
      counter++;
    } while (existingNames.has(uniqueName));
    
    return uniqueName;
  };

  // Function to auto-save analysis data to database
  const autoSaveAnalysis = async (isManualSave = false) => {
    if (!analysisData || currentAnalysisId) {
      console.log('⚠️ Auto-save skipped:', { 
        hasAnalysisData: !!analysisData, 
        currentAnalysisId,
        reason: !analysisData ? 'No analysis data' : 'Already saved'
      });
      return currentAnalysisId;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (isManualSave) {
        toast.error('Please log in to save reports');
      }
      return null;
    }

    try {
      console.log('💾 Starting auto-save for analysis:', analysisData.file_name);
      
      const baseName = analysisData.file_name || 'Untitled Analysis';
      const uniqueFileName = await generateUniqueFileName(baseName);

      const savingsAnalysisData = {
        totalSavings: analysisData.totalPotentialSavings || 0,
        completedShipments: analysisData.totalShipments || 0,
        savingsPercentage: analysisData.totalPotentialSavings && analysisData.totalShipments ? 
          (analysisData.totalPotentialSavings / (analysisData.totalShipments * 10)) * 100 : 0
      };

      const analysisRecord = {
        user_id: user.id,
        file_name: uniqueFileName,
        total_shipments: analysisData.totalShipments || 0,
        total_savings: Math.max(0, analysisData.totalPotentialSavings || 0),
        status: 'completed',
        original_data: analysisData.recommendations as any,
        recommendations: analysisData.recommendations as any,
        markup_data: markupData as any,
        savings_analysis: savingsAnalysisData as any
      };

      const { data, error } = await supabase
        .from('shipping_analyses')
        .insert(analysisRecord)
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Analysis auto-saved successfully:', data.id);
      setCurrentAnalysisId(data.id);
      return data.id;
    } catch (error) {
      console.error('❌ Error saving analysis:', error);
      if (isManualSave) {
        toast.error('Failed to save analysis to database');
      }
      return null;
    }
  };

  // Load clients for client assignment
  const loadClients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('clients')
      .select('id, company_name')
      .eq('user_id', user.id)
      .order('company_name');

    setClients(data || []);
  };

  // Calculate markup for individual shipment
  const getShipmentMarkup = (shipment: any) => {
    if (!markupData) return { markedUpPrice: shipment.newRate, margin: 0, marginPercent: 0 };
    
    const shipProsCost = shipment.newRate || 0;
    let markupPercent = 0;
    
    if (markupData.markupType === 'global') {
      markupPercent = markupData.globalMarkup;
    } else {
      markupPercent = markupData.perServiceMarkup[shipment.service] || 0;
    }
    
    const markedUpPrice = shipProsCost * (1 + markupPercent / 100);
    const margin = markedUpPrice - shipProsCost;
    const marginPercent = shipProsCost > 0 ? (margin / shipProsCost) * 100 : 0;
    
    return { markedUpPrice, margin, marginPercent };
  };

  // Export functionality
  const exportToCSV = () => {
    const csvData = generateExportData(filteredData, getShipmentMarkup);
    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shipping_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Advanced export with markup data
  const exportAdvancedCSV = () => {
    const csvData = filteredData.map(item => {
      const markupInfo = getShipmentMarkup(item);
      const savings = item.currentRate - markupInfo.markedUpPrice;
      const savingsPercent = item.currentRate > 0 ? (savings / item.currentRate) * 100 : 0;
      
      return {
        'Tracking ID': item.trackingId,
        'Origin ZIP': item.originZip,
        'Destination ZIP': item.destinationZip,
        'Weight (lbs)': item.weight,
        'Carrier': item.carrier,
        'Service': item.service,
        'Current Rate': `$${item.currentRate.toFixed(2)}`,
        'UPS Rate': `$${item.newRate.toFixed(2)}`,
        'Ship Pros Rate': `$${markupInfo.markedUpPrice.toFixed(2)}`,
        'UPS Savings': `$${(item.currentRate - item.newRate).toFixed(2)}`,
        'Ship Pros Savings': `$${savings.toFixed(2)}`,
        'Savings Percentage': `${savingsPercent.toFixed(1)}%`,
        'Margin': `$${markupInfo.margin.toFixed(2)}`,
        'Margin Percentage': `${markupInfo.marginPercent.toFixed(1)}%`
      };
    });

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shipping_analysis_detailed_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Assign to client functionality
  const assignToClient = async (clientId: string) => {
    if (!currentAnalysisId) {
      toast.error('Please save the analysis first');
      return;
    }

    try {
      const { error } = await supabase
        .from('shipping_analyses')
        .update({ client_id: clientId })
        .eq('id', currentAnalysisId);

      if (error) throw error;
      
      const client = clients.find(c => c.id === clientId);
      toast.success(`Analysis assigned to ${client?.company_name}`);
    } catch (error) {
      console.error('Error assigning to client:', error);
      toast.error('Failed to assign analysis to client');
    }
  };

  useEffect(() => {
    if (analysisResults) {
      try {
        // Process the analysis results using the data processing utilities
        let processedData: ProcessedAnalysisData;
        
        if (analysisResults.recommendations && Array.isArray(analysisResults.recommendations)) {
          // Direct recommendations array
          processedData = processNormalViewData(analysisResults.recommendations);
        } else if (analysisResults.totalSavings !== undefined) {
          // Already processed analysis data
          processedData = {
            totalCurrentCost: analysisResults.totalCurrentCost || 0,
            totalPotentialSavings: analysisResults.totalSavings || 0,
            recommendations: analysisResults.recommendations || [],
            savingsPercentage: analysisResults.savingsPercentage || 0,
            totalShipments: analysisResults.totalShipments || 0,
            analyzedShipments: analysisResults.analyzedShipments || 0,
            orphanedShipments: analysisResults.orphanedShipments || [],
            completedShipments: analysisResults.completedShipments || 0,
            errorShipments: analysisResults.errorShipments || 0
          };
        } else {
          // Raw analysis results, process them
          processedData = processNormalViewData(analysisResults || []);
        }
        
        setAnalysisData(processedData);
        
        // Format shipment data
        const formattedShipmentData = formatShipmentData(processedData.recommendations || []);
        setShipmentData(formattedShipmentData);
        setOrphanedData(processedData.orphanedShipments || []);
        
        // Initialize service data
        const services = [...new Set(formattedShipmentData.map(item => item.service).filter(Boolean))] as string[];
        setAvailableServices(services);
        setSelectedServicesOverview([]);
        
      } catch (error) {
        handleDataProcessingError(error, 'results processing');
      }
    }
  }, [analysisResults]);

  // Auto-save effect
  useEffect(() => {
    const performAutoSave = async () => {
      if (analysisData && !currentAnalysisId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('🔄 Auto-saving analysis data...');
          const savedId = await autoSaveAnalysis(false);
          if (savedId) {
            console.log('✅ Analysis auto-saved with ID:', savedId);
          }
        }
      }
    };

    if (analysisData && !currentAnalysisId && !hasTriedAutoSave.current) {
      hasTriedAutoSave.current = true;
      const timer = setTimeout(performAutoSave, 2000);
      return () => clearTimeout(timer);
    }
  }, [analysisData, currentAnalysisId]);

  // Load clients on component mount
  useEffect(() => {
    loadClients();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...shipmentData];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.trackingId?.toLowerCase().includes(searchLower) ||
        item.service?.toLowerCase().includes(searchLower) ||
        item.originZip?.includes(searchTerm) ||
        item.destinationZip?.includes(searchTerm)
      );
    }

    // Result filter
    if (resultFilter === 'wins') {
      filtered = filtered.filter(item => (item.savings || 0) > 0);
    } else if (resultFilter === 'losses') {
      filtered = filtered.filter(item => (item.savings || 0) <= 0);
    }

    // Service filter
    if (selectedService !== 'all') {
      filtered = filtered.filter(item => item.service === selectedService);
    }

    // Sort
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = (a as any)[sortConfig.key];
        const bValue = (b as any)[sortConfig.key];
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(filtered);
  }, [shipmentData, searchTerm, resultFilter, selectedService, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (!analysisData) {
    return (
      <div className="text-center py-12">
        <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Results to Display</h2>
        <p className="text-muted-foreground">Complete the analysis to see your results here.</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalSavings = filteredData.reduce((sum, item) => sum + (item.savings || 0), 0);
  const totalShipments = filteredData.length;
  const winningShipments = filteredData.filter(item => (item.savings || 0) > 0).length;
  const averageSavings = totalShipments > 0 ? totalSavings / totalShipments : 0;
  const winRate = totalShipments > 0 ? (winningShipments / totalShipments) * 100 : 0;

  // Prepare chart data
  const serviceData = availableServices.map(service => {
    const serviceShipments = filteredData.filter(item => item.service === service);
    const serviceSavings = serviceShipments.reduce((sum, item) => sum + (item.savings || 0), 0);
    return {
      service,
      savings: serviceSavings,
      count: serviceShipments.length
    };
  });

  const savingsDistribution = [
    { name: 'Wins', value: winningShipments, color: '#10b981' },
    { name: 'Losses/Break-even', value: totalShipments - winningShipments, color: '#ef4444' }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(analysisData.totalPotentialSavings || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Shipments</p>
                <p className="text-2xl font-bold">{analysisData.totalShipments || 0}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatPercentage(winRate)}
                </p>
              </div>
              <Target className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Savings</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(averageSavings)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Savings by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serviceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="service" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="savings" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Win/Loss Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={savingsDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {savingsDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Markup Configuration */}
      <MarkupConfiguration
        shipmentData={shipmentData}
        analysisId={currentAnalysisId}
        onMarkupChange={setMarkupData}
        initialMarkupData={markupData}
      />

      {/* Client Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Client Assignment</CardTitle>
          <CardDescription>
            Assign this analysis to a client for sharing and organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex gap-2 items-center">
              <select 
                className="border rounded px-3 py-2"
                onChange={(e) => e.target.value && assignToClient(e.target.value)}
                defaultValue=""
              >
                <option value="">Select a client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={loadClients}>
              Refresh Clients
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Shipment Details</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export Basic CSV
              </Button>
              <Button variant="outline" onClick={exportAdvancedCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export Detailed CSV
              </Button>
              <Button variant="outline" onClick={() => autoSaveAnalysis(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Save Analysis
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <Input
              placeholder="Search tracking, service, or ZIP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            
            <ResultFilter value={resultFilter} onChange={setResultFilter} />

            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {availableServices.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleSort('trackingId')}
                  >
                    Tracking ID
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleSort('service')}
                  >
                    Service
                  </TableHead>
                  <TableHead>Origin → Destination</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted text-right"
                    onClick={() => handleSort('weight')}
                  >
                    Weight
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted text-right"
                    onClick={() => handleSort('currentRate')}
                  >
                    Current Cost
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted text-right"
                    onClick={() => handleSort('newRate')}
                  >
                    UPS Rate
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted text-right"
                    onClick={() => handleSort('savings')}
                  >
                    Savings
                  </TableHead>
                  {markupData && (
                    <TableHead className="text-right">
                      Ship Pros Rate
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((shipment) => {
                  const markupInfo = getShipmentMarkup(shipment);
                  return (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-mono text-sm">
                        {shipment.trackingId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{shipment.service}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {shipment.originZip} → {shipment.destinationZip}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {shipment.weight} lbs
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(shipment.currentRate || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(shipment.newRate || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-semibold",
                          getSavingsColor(shipment.savings || 0)
                        )}>
                          {shipment.savings && shipment.savings > 0 ? '+' : ''}
                          {formatCurrency(shipment.savings || 0)}
                        </span>
                      </TableCell>
                      {markupData && (
                        <TableCell className="text-right">
                          {formatCurrency(markupInfo.markedUpPrice)}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No shipments match your current filters.
            </div>
          )}

          {/* Orphaned Shipments */}
          {orphanedData.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Orphaned Shipments ({orphanedData.length})
              </h3>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-700 mb-3">
                  These shipments couldn't be processed due to missing or invalid data:
                </p>
                <div className="space-y-2">
                  {orphanedData.slice(0, 5).map((orphan, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-mono">{orphan.trackingId}</span>
                      <span className="text-orange-600 ml-2">- {orphan.error}</span>
                    </div>
                  ))}
                  {orphanedData.length > 5 && (
                    <p className="text-sm text-orange-600">
                      ... and {orphanedData.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};