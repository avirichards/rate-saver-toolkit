import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle, DollarSign, TrendingDown, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ProcessedShipment {
  id: number;
  trackingId?: string;
  service?: string;
  weight?: string;
  cost?: string;
  originZip?: string;
  destZip?: string;
  length?: string;
  width?: string;
  height?: string;
}

interface AnalysisResult {
  shipment: ProcessedShipment;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentCost?: number;
  upsRates?: any[];
  bestRate?: any;
  savings?: number;
  error?: string;
}

const Analysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [shipments, setShipments] = useState<ProcessedShipment[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [currentShipmentIndex, setCurrentShipmentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalCurrentCost, setTotalCurrentCost] = useState(0);
  
  useEffect(() => {
    const state = location.state as { 
      readyForAnalysis?: boolean, 
      processedShipments?: ProcessedShipment[],
      fileName?: string,
      csvUploadId?: string
    } | null;
    
    if (!state || !state.readyForAnalysis || !state.processedShipments) {
      toast.error('Please map columns first');
      navigate('/mapping');
      return;
    }
    
    console.log('Analysis received shipments:', state.processedShipments.slice(0, 2));
    setShipments(state.processedShipments);
    
    // Initialize analysis results
    const initialResults = state.processedShipments.map(shipment => ({
      shipment,
      status: 'pending' as const
    }));
    setAnalysisResults(initialResults);
    
    // Auto-start analysis
    startAnalysis(state.processedShipments);
  }, [location, navigate]);
  
  const startAnalysis = async (shipmentsToAnalyze: ProcessedShipment[]) => {
    setIsAnalyzing(true);
    setCurrentShipmentIndex(0);
    setError(null);
    
    try {
      // Validate UPS configuration first
      await validateUpsConfiguration();
      
      // Process shipments one by one
      for (let i = 0; i < shipmentsToAnalyze.length; i++) {
        setCurrentShipmentIndex(i);
        await processShipment(i, shipmentsToAnalyze[i]);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setIsComplete(true);
      await saveAnalysisToDatabase();
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const validateUpsConfiguration = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to run analysis');
    }

    const { data: config, error } = await supabase
      .from('ups_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      throw new Error('UPS configuration not found. Please configure UPS API in Settings.');
    }

    // Test UPS connection
    const { data, error: authError } = await supabase.functions.invoke('ups-auth', {
      body: { action: 'get_token' }
    });

    if (authError || !data?.access_token) {
      throw new Error('Failed to authenticate with UPS. Please check your API credentials.');
    }
  };
  
  const processShipment = async (index: number, shipment: ProcessedShipment) => {
    // Update status to processing
    setAnalysisResults(prev => prev.map((result, i) => 
      i === index ? { ...result, status: 'processing' } : result
    ));
    
    try {
      // Validate required fields
      if (!shipment.originZip || !shipment.destZip || !shipment.weight) {
        throw new Error('Missing required fields for UPS rate quote');
      }
      
      const currentCost = parseFloat(shipment.cost || '0');
      
      // Fetch UPS rates
      const { data, error } = await supabase.functions.invoke('ups-rate-quote', {
        body: {
          shipment: {
            shipFrom: {
              name: 'Sample Shipper',
              address: '123 Main St',
              city: 'Atlanta',
              state: 'GA',
              zipCode: shipment.originZip,
              country: 'US'
            },
            shipTo: {
              name: 'Sample Recipient',
              address: '456 Oak Ave',
              city: 'Chicago',
              state: 'IL',
              zipCode: shipment.destZip,
              country: 'US'
            },
            package: {
              weight: parseFloat(shipment.weight),
              weightUnit: 'LBS',
              length: parseFloat(shipment.length || '12'),
              width: parseFloat(shipment.width || '12'),
              height: parseFloat(shipment.height || '6'),
              dimensionUnit: 'IN'
            },
            serviceTypes: ['01', '02', '03', '12', '13']
          }
        }
      });

      if (error || !data?.rates) {
        throw new Error('Failed to fetch UPS rates');
      }
      
      // Find best rate
      const bestRate = data.rates.reduce((best: any, current: any) => 
        current.totalCharges < best.totalCharges ? current : best
      );
      
      const savings = Math.max(0, currentCost - bestRate.totalCharges);
      
      // Update totals
      setTotalCurrentCost(prev => prev + currentCost);
      setTotalSavings(prev => prev + savings);
      
      // Update result
      setAnalysisResults(prev => prev.map((result, i) => 
        i === index ? {
          ...result,
          status: 'completed',
          currentCost,
          upsRates: data.rates,
          bestRate,
          savings
        } : result
      ));
      
    } catch (error: any) {
      console.error(`Error processing shipment ${index}:`, error);
      setAnalysisResults(prev => prev.map((result, i) => 
        i === index ? {
          ...result,
          status: 'error',
          error: error.message
        } : result
      ));
    }
  };
  
  const saveAnalysisToDatabase = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const state = location.state as any;
    const completedResults = analysisResults.filter(r => r.status === 'completed');
    
    const recommendations = completedResults
      .filter(r => r.savings && r.savings > 0)
      .map(r => ({
        shipment: r.shipment,
        currentCost: r.currentCost,
        recommendedCost: r.bestRate?.totalCharges,
        savings: r.savings,
        recommendedService: r.bestRate?.serviceName
      }));
    
    const { error } = await supabase
      .from('shipping_analyses')
      .insert({
        user_id: user.id,
        file_name: state?.fileName || 'Real-time Analysis',
        original_data: shipments as any,
        ups_quotes: completedResults.map(r => r.upsRates) as any,
        savings_analysis: {
          totalCurrentCost,
          totalPotentialSavings: totalSavings,
          savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0
        } as any,
        recommendations: recommendations as any,
        total_shipments: shipments.length,
        total_savings: totalSavings,
        status: 'completed'
      });

    if (error) {
      console.error('Error saving analysis:', error);
    }
  };
  
  const handleViewResults = () => {
    const completedResults = analysisResults.filter(r => r.status === 'completed');
    const recommendations = completedResults
      .filter(r => r.savings && r.savings > 0)
      .map(r => ({
        shipment: r.shipment,
        currentCost: r.currentCost,
        recommendedCost: r.bestRate?.totalCharges,
        savings: r.savings,
        recommendedService: r.bestRate?.serviceName
      }));
    
    navigate('/results', { 
      state: { 
        analysisComplete: true,
        analysisData: {
          totalCurrentCost,
          totalPotentialSavings: totalSavings,
          recommendations,
          savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
          totalShipments: shipments.length,
          analyzedShipments: completedResults.length
        }
      } 
    });
  };
  
  const progress = shipments.length > 0 ? (currentShipmentIndex / shipments.length) * 100 : 0;
  const completedCount = analysisResults.filter(r => r.status === 'completed').length;
  const errorCount = analysisResults.filter(r => r.status === 'error').length;
  
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">Real-Time Shipping Analysis</h1>
          <p className="text-muted-foreground">
            Processing {shipments.length} shipments and comparing current rates with UPS optimization.
          </p>
        </div>
        
        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{shipments.length}</p>
                  <p className="text-sm text-muted-foreground">Total Shipments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{completedCount}</p>
                  <p className="text-sm text-muted-foreground">Analyzed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">${totalCurrentCost.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Current Cost</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">${totalSavings.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Potential Savings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Progress Bar */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between mb-2 items-center">
              <div className="text-sm font-medium">
                {isComplete 
                  ? 'Analysis Complete!' 
                  : isAnalyzing 
                    ? `Processing shipment ${currentShipmentIndex + 1} of ${shipments.length}...` 
                    : 'Ready to analyze'
                }
              </div>
              <div className="text-sm font-medium">
                {Math.round(progress)}%
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
        
        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Analysis Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Real-time Results */}
        <Card>
          <CardHeader>
            <CardTitle>Live Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysisResults.map((result, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {result.status === 'pending' && (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-xs">{index + 1}</span>
                        </div>
                      )}
                      {result.status === 'processing' && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <RotateCw className="w-4 h-4 text-primary animate-spin" />
                        </div>
                      )}
                      {result.status === 'completed' && (
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                      {result.status === 'error' && (
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <p className="font-medium text-sm">
                        {result.shipment.trackingId || `Shipment ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.shipment.originZip} → {result.shipment.destZip} | {result.shipment.weight}lbs
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {result.status === 'completed' && (
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            ${result.currentCost?.toFixed(2)} → ${result.bestRate?.totalCharges?.toFixed(2)}
                          </p>
                          {result.savings && result.savings > 0 ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Save ${result.savings.toFixed(2)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No savings</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {result.status === 'error' && (
                      <Badge variant="destructive">Error</Badge>
                    )}
                    
                    {result.status === 'processing' && (
                      <Badge variant="secondary">Processing...</Badge>
                    )}
                    
                    {result.status === 'pending' && (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {isComplete && (
              <div className="flex justify-end mt-6">
                <Button 
                  variant="primary" 
                  onClick={handleViewResults}
                  iconRight={<CheckCircle className="ml-1 h-4 w-4" />}
                >
                  View Detailed Results
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analysis;