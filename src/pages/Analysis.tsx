import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Package, 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Clock
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/utils';

interface ProcessingStats {
  totalShipments: number;
  validShipments: number;
  analyzedShipments: number;
  invalidShipments: number;
  withWarnings: number;
  currentCost: number;
  potentialSavings: number;
}

interface LiveResult {
  id: string;
  trackingId: string;
  service: string;
  weight: number;
  dimensions: string;
  currentRate: number;
  newRate: number;
  savings: number;
  status: 'processing' | 'completed' | 'error';
  carrierResults?: any[];
}

const Analysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [availableCarriers, setAvailableCarriers] = useState<any[]>([]);
  const [selectedCarrierConfigs, setSelectedCarrierConfigs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentShipmentIndex, setCurrentShipmentIndex] = useState(0);
  const [processingStats, setProcessingStats] = useState<ProcessingStats>({
    totalShipments: 0,
    validShipments: 0,
    analyzedShipments: 0,
    invalidShipments: 0,
    withWarnings: 0,
    currentCost: 0,
    potentialSavings: 0
  });
  const [liveResults, setLiveResults] = useState<LiveResult[]>([]);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const processingRef = useRef<boolean>(false);

  useEffect(() => {
    loadCarrierConfigs();
  }, []);

  useEffect(() => {
    // Check if we have fresh data from navigation state first
    const state = location.state as any;
    if (state && state.readyForAnalysis) {
      console.log('📊 Analysis page - Received fresh data from service mapping:', state);
      
      // Process and validate the shipment data
      const shipmentData = state.csvData || [];
      const validationResults = validateShipmentData(shipmentData);
      
      setAnalysisData({
        id: 'new-analysis',
        status: 'ready',
        csvUploadId: state.csvUploadId,
        fileName: state.fileName,
        mappings: state.mappings,
        serviceMappings: state.serviceMappings,
        csvData: shipmentData,
        rowCount: state.rowCount,
        originZipOverride: state.originZipOverride,
        uploadTimestamp: state.uploadTimestamp
      });

      setValidationResults(validationResults);
      
      // Calculate initial stats
      const validShipments = validationResults.filter(r => r.isValid);
      const invalidShipments = validationResults.filter(r => !r.isValid);
      const withWarnings = validationResults.filter(r => r.warnings?.length > 0);
      const currentCost = validShipments.reduce((sum, ship) => sum + (parseFloat(ship.currentRate) || 0), 0);
      
      setProcessingStats({
        totalShipments: shipmentData.length,
        validShipments: validShipments.length,
        analyzedShipments: 0,
        invalidShipments: invalidShipments.length,
        withWarnings: withWarnings.length,
        currentCost: currentCost,
        potentialSavings: 0
      });
      
    } else if (id) {
      // Fallback to loading existing analysis from database
      loadAnalysis();
    }
  }, [id, location.state]);

  const validateShipmentData = (shipmentData: any[]) => {
    return shipmentData.map((shipment, index) => {
      const warnings = [];
      const errors = [];
      
      // Required field validation
      if (!shipment.trackingId) errors.push('Missing tracking ID');
      if (!shipment.originZip) errors.push('Missing origin ZIP');
      if (!shipment.destZip) errors.push('Missing destination ZIP');
      if (!shipment.weight || parseFloat(shipment.weight) <= 0) errors.push('Invalid weight');
      if (!shipment.service) errors.push('Missing service type');
      
      // Warnings for potential issues
      if (parseFloat(shipment.weight) > 150) warnings.push('Heavy package - verify weight');
      if (!shipment.currentRate) warnings.push('Missing current rate');
      
      return {
        id: index + 1,
        trackingId: shipment.trackingId || `SHIP-${String(index + 1).padStart(4, '0')}`,
        isValid: errors.length === 0,
        errors,
        warnings,
        ...shipment
      };
    });
  };

  const loadCarrierConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setAvailableCarriers(data || []);
    } catch (error) {
      console.error('Error loading carrier configs:', error);
    }
  };

  const loadAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAnalysisData(data);
    } catch (error: any) {
      console.error('Error loading analysis:', error);
      toast.error('Failed to load analysis');
    }
  };

  const startAnalysis = async () => {
    if (!analysisData || selectedCarrierConfigs.length === 0) {
      toast.error('Please select at least one carrier configuration');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    processingRef.current = true;
    
    const validShipments = validationResults.filter(r => r.isValid);
    
    try {
      // Process shipments one by one
      for (let i = 0; i < validShipments.length; i++) {
        if (!processingRef.current || isPaused) break;
        
        setCurrentShipmentIndex(i + 1);
        
        const shipment = validShipments[i];
        
        // Add to live results as processing
        const liveResult: LiveResult = {
          id: shipment.id,
          trackingId: shipment.trackingId,
          service: shipment.service,
          weight: parseFloat(shipment.weight),
          dimensions: `${shipment.length || 0}" x ${shipment.width || 0}" x ${shipment.height || 0}"`,
          currentRate: parseFloat(shipment.currentRate) || 0,
          newRate: 0,
          savings: 0,
          status: 'processing'
        };
        
        setLiveResults(prev => [liveResult, ...prev]);
        
        try {
          // Call multi-carrier quote API
          const response = await fetch(`https://olehfhquezzfkdgilkut.supabase.co/functions/v1/multi-carrier-quote`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              carrierConfigs: selectedCarrierConfigs,
              shipFromZip: shipment.originZip,
              shipToZip: shipment.destZip,
              weight: parseFloat(shipment.weight),
              length: parseFloat(shipment.length) || 12,
              width: parseFloat(shipment.width) || 12,
              height: parseFloat(shipment.height) || 6,
              serviceTypes: [shipment.serviceCode || '03']
            })
          });

          const result = await response.json();
          
          if (result.success && result.bestRates?.length > 0) {
            const bestRate = result.bestRates[0];
            const newRate = parseFloat(bestRate.rate || bestRate.cost || 0);
            const savings = liveResult.currentRate - newRate;
            
            // Update live result
            setLiveResults(prev => prev.map(lr => 
              lr.id === liveResult.id 
                ? { ...lr, newRate, savings, status: 'completed', carrierResults: result.carrierResults }
                : lr
            ));
            
            // Update stats
            setProcessingStats(prev => ({
              ...prev,
              analyzedShipments: prev.analyzedShipments + 1,
              potentialSavings: prev.potentialSavings + Math.max(0, savings)
            }));
            
          } else {
            // Mark as error
            setLiveResults(prev => prev.map(lr => 
              lr.id === liveResult.id 
                ? { ...lr, status: 'error' }
                : lr
            ));
          }
          
        } catch (error) {
          console.error('Error processing shipment:', error);
          setLiveResults(prev => prev.map(lr => 
            lr.id === liveResult.id 
              ? { ...lr, status: 'error' }
              : lr
          ));
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (processingRef.current && !isPaused) {
        toast.success('Analysis completed successfully!');
        setIsProcessing(false);
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed');
      setIsProcessing(false);
    }
  };

  const pauseAnalysis = () => {
    setIsPaused(true);
    processingRef.current = false;
  };

  const resumeAnalysis = () => {
    setIsPaused(false);
    startAnalysis();
  };

  const stopAnalysis = () => {
    setIsProcessing(false);
    setIsPaused(false);
    processingRef.current = false;
    
    // Navigate to results with current data
    navigate('/results', {
      state: {
        analysisComplete: true,
        analysisData: {
          recommendations: liveResults,
          totalShipments: processingStats.totalShipments,
          totalPotentialSavings: processingStats.potentialSavings,
          orphanedShipments: []
        }
      }
    });
  };

  const startOver = () => {
    setIsProcessing(false);
    setIsPaused(false);
    processingRef.current = false;
    setCurrentShipmentIndex(0);
    setLiveResults([]);
    setProcessingStats(prev => ({
      ...prev,
      analyzedShipments: 0,
      potentialSavings: 0
    }));
  };

  if (!analysisData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading analysis...</p>
        </div>
      </div>
    );
  }

  const progressPercentage = processingStats.totalShipments > 0 
    ? (currentShipmentIndex / processingStats.totalShipments) * 100 
    : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">Real-Time Shipping Analysis</h1>
        <p className="text-center text-muted-foreground">
          Processing {processingStats.totalShipments} shipments and comparing current rates with UPS optimization.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">{processingStats.totalShipments}</div>
            <div className="text-sm text-muted-foreground">Total Shipments</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">{processingStats.validShipments}</div>
            <div className="text-sm text-muted-foreground">Valid Shipments</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="h-6 w-6 mx-auto mb-2 text-purple-500" />
            <div className="text-2xl font-bold">{processingStats.analyzedShipments}</div>
            <div className="text-sm text-muted-foreground">Analyzed</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-6 w-6 mx-auto mb-2 text-orange-500" />
            <div className="text-2xl font-bold">{formatCurrency(processingStats.currentCost)}</div>
            <div className="text-sm text-muted-foreground">Current Cost</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold">{formatCurrency(processingStats.potentialSavings)}</div>
            <div className="text-sm text-muted-foreground">Potential Savings</div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Validation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold text-green-700">{processingStats.validShipments}</div>
              <div className="text-sm text-green-600">Valid Shipments</div>
              <div className="text-xs text-green-500">Ready for analysis</div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <div className="text-2xl font-bold text-red-700">{processingStats.invalidShipments}</div>
              <div className="text-sm text-red-600">Invalid Shipments</div>
              <div className="text-xs text-red-500">Will be skipped</div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <div className="text-2xl font-bold text-yellow-700">{processingStats.withWarnings}</div>
              <div className="text-sm text-yellow-600">With Warnings</div>
              <div className="text-xs text-yellow-500">May have issues</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Carrier Account Selection */}
      {!isProcessing && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Select Carrier Accounts</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Available Carrier Accounts</h3>
            {availableCarriers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No carrier accounts configured.</p>
                <Button variant="outline" onClick={() => navigate('/settings')}>
                  Configure Carrier Accounts
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableCarriers.map((carrier) => (
                  <div key={carrier.id} className="flex items-center space-x-2 p-4 border rounded-lg">
                    <Checkbox
                      id={carrier.id}
                      checked={selectedCarrierConfigs.includes(carrier.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCarrierConfigs(prev => [...prev, carrier.id]);
                        } else {
                          setSelectedCarrierConfigs(prev => prev.filter(id => id !== carrier.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{carrier.account_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {carrier.carrier_type.toUpperCase()} • {carrier.account_group || 'Default Group'}
                      </div>
                    </div>
                    <Badge variant={carrier.connection_status === 'connected' ? 'default' : 'secondary'}>
                      {carrier.connection_status || 'Unknown'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Progress */}
      {isProcessing && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-medium">
                Processing shipment {currentShipmentIndex} of {processingStats.totalShipments}...
              </div>
              <div className="text-lg font-bold">{Math.round(progressPercentage)}%</div>
            </div>
            <Progress value={progressPercentage} className="mb-4" />
            
            <div className="flex gap-2">
              {isPaused ? (
                <Button onClick={resumeAnalysis} className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              ) : (
                <Button onClick={pauseAnalysis} variant="outline" className="flex items-center gap-2">
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              
              <Button onClick={stopAnalysis} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Square className="h-4 w-4" />
                Stop & View Results
              </Button>
              
              <Button onClick={startOver} variant="outline" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Start Over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Analysis Button */}
      {!isProcessing && (
        <Card className="mb-8">
          <CardContent className="p-6 text-center">
            <Button 
              onClick={startAnalysis} 
              size="lg" 
              className="flex items-center gap-2"
              disabled={selectedCarrierConfigs.length === 0}
            >
              <Play className="h-5 w-5" />
              Start Multi-Carrier Analysis
            </Button>
            {selectedCarrierConfigs.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Please select at least one carrier configuration above
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live Analysis Results */}
      {liveResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Live Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {liveResults.map((result) => (
                <div key={result.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      result.status === 'completed' ? 'bg-green-500' :
                      result.status === 'error' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
                    }`} />
                    <div>
                      <div className="font-medium">{result.trackingId}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.service} • {result.weight} lbs • {result.dimensions}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {result.status === 'completed' ? (
                      <>
                        <div className="text-lg font-bold">
                          {formatCurrency(result.currentRate)} → {formatCurrency(result.newRate)}
                        </div>
                        <Badge variant={result.savings > 0 ? "default" : "secondary"}>
                          {result.savings > 0 ? `Save ${formatCurrency(result.savings)}` : 'No savings'}
                        </Badge>
                      </>
                    ) : result.status === 'error' ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="outline">Processing...</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Analysis;