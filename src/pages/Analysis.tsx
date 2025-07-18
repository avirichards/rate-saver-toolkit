
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Progress } from '@/components/ui/progress';
import { Play, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const Analysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (id) {
      loadAnalysis();
    }
  }, [id]);

  const loadAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAnalysis(data);
    } catch (error: any) {
      console.error('Error loading analysis:', error);
      toast.error('Failed to load analysis');
    }
  };

  const processMultiCarrierAnalysis = async () => {
    if (!analysis) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessingStep('Initializing multi-carrier analysis...');

    try {
      // Get user's carrier configurations
      const { data: carrierConfigs, error: configError } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('is_active', true);

      if (configError || !carrierConfigs || carrierConfigs.length === 0) {
        throw new Error('No active carrier configurations found. Please set up your carrier accounts first.');
      }

      setProcessingStep('Processing shipments with multi-carrier quotes...');
      setProgress(20);

      const originalShipments = analysis.original_data || [];
      const processedShipments: any[] = [];
      const orphanedShipments: any[] = [];
      const carrierConfigIds = carrierConfigs.map(config => config.id);

      console.log('🚀 Starting multi-carrier analysis for', originalShipments.length, 'shipments');

      // Process shipments in batches
      const batchSize = 5;
      for (let i = 0; i < originalShipments.length; i += batchSize) {
        const batch = originalShipments.slice(i, i + batchSize);
        setProgress(20 + (i / originalShipments.length) * 60);
        setProcessingStep(`Processing shipments ${i + 1}-${Math.min(i + batchSize, originalShipments.length)} of ${originalShipments.length}...`);

        for (const shipment of batch) {
          try {
            // Validate shipment data
            if (!shipment.originZip || !shipment.destZip || !shipment.weight) {
              orphanedShipments.push({
                ...shipment,
                error: 'Missing required shipment data (origin, destination, or weight)',
                errorType: 'validation_error'
              });
              continue;
            }

            console.log('📦 Processing shipment:', {
              tracking: shipment.trackingId || shipment.tracking_id,
              from: shipment.originZip,
              to: shipment.destZip || shipment.destinationZip,
              weight: shipment.weight
            });

            // Call multi-carrier quote function
            const { data: multiCarrierResult, error: quoteError } = await supabase.functions.invoke('multi-carrier-quote', {
              body: {
                shipment: {
                  shipFrom: {
                    name: 'Shipper',
                    address: '123 Main St',
                    city: 'Any City',
                    state: 'FL',
                    zipCode: shipment.originZip,
                    country: 'US'
                  },
                  shipTo: {
                    name: 'Recipient',
                    address: '456 Oak Ave',
                    city: 'Any City',
                    state: 'CA',
                    zipCode: shipment.destZip || shipment.destinationZip,
                    country: 'US'
                  },
                  package: {
                    weight: parseFloat(shipment.weight),
                    weightUnit: 'LBS',
                    length: parseFloat(shipment.length) || 12,
                    width: parseFloat(shipment.width) || 12,
                    height: parseFloat(shipment.height) || 12,
                    dimensionUnit: 'IN'
                  },
                  carrierConfigIds,
                  serviceTypes: shipment.service ? [shipment.service] : ['03'], // Default to Ground
                  isResidential: false
                }
              }
            });

            if (quoteError) {
              console.error('❌ Multi-carrier quote error:', quoteError);
              orphanedShipments.push({
                ...shipment,
                error: `Multi-carrier quote failed: ${quoteError.message}`,
                errorType: 'quote_error'
              });
              continue;
            }

            console.log('✅ Multi-carrier result:', {
              totalRates: multiCarrierResult?.allRates?.length || 0,
              bestRatesCount: multiCarrierResult?.bestRates?.length || 0,
              carrierResults: multiCarrierResult?.carrierResults?.length || 0
            });

            // Find the best rate (lowest cost)
            const allRates = multiCarrierResult?.allRates || [];
            let bestRate = null;
            let currentRate = parseFloat(shipment.currentCost || shipment.current_rate || '0');

            if (allRates.length > 0) {
              bestRate = allRates.reduce((best, rate) => {
                const ratePrice = parseFloat(rate.rate || rate.cost || rate.totalCharges || '0');
                const bestPrice = parseFloat(best.rate || best.cost || best.totalCharges || '0');
                return ratePrice < bestPrice ? rate : best;
              });
            }

            const bestRatePrice = bestRate ? parseFloat(bestRate.rate || bestRate.cost || bestRate.totalCharges || '0') : currentRate;
            const savings = currentRate - bestRatePrice;

            // Create processed shipment with multi-carrier data
            const processedShipment = {
              id: i + 1,
              trackingId: shipment.trackingId || shipment.tracking_id || `SHIP-${String(i + 1).padStart(4, '0')}`,
              originZip: shipment.originZip,
              destinationZip: shipment.destZip || shipment.destinationZip,
              weight: parseFloat(shipment.weight),
              length: parseFloat(shipment.length) || undefined,
              width: parseFloat(shipment.width) || undefined,
              height: parseFloat(shipment.height) || undefined,
              carrier: shipment.carrier || 'Unknown',
              service: shipment.service || 'Standard',
              originalService: shipment.originalService || shipment.service || 'Unknown',
              currentRate: currentRate,
              newRate: bestRatePrice,
              savings: savings,
              savingsPercent: currentRate > 0 ? (savings / currentRate) * 100 : 0,
              
              // Enhanced multi-carrier data for Account Review tab
              accounts: allRates.map(rate => ({
                carrierId: rate.carrierId || 'default',
                carrierType: rate.carrierType || 'Unknown',
                accountName: rate.accountName || 'Default',
                displayName: rate.displayName || `${rate.carrierType || 'Unknown'} – ${rate.accountName || 'Default'}`,
                rate: parseFloat(rate.rate || rate.cost || rate.totalCharges || '0'),
                service: rate.serviceName || rate.serviceCode || 'Standard'
              })),
              
              allRates: allRates,
              carrierResults: multiCarrierResult?.carrierResults || [],
              
              // Store complete multi-carrier response for analysis
              multi_carrier_results: multiCarrierResult
            };

            processedShipments.push(processedShipment);

          } catch (error: any) {
            console.error('❌ Error processing shipment:', error);
            orphanedShipments.push({
              ...shipment,
              error: error.message,
              errorType: 'processing_error'
            });
          }
        }
      }

      setProgress(80);
      setProcessingStep('Calculating savings and updating analysis...');

      // Calculate totals
      const totalCurrentCost = processedShipments.reduce((sum, ship) => sum + ship.currentRate, 0);
      const totalNewCost = processedShipments.reduce((sum, ship) => sum + ship.newRate, 0);
      const totalSavings = totalCurrentCost - totalNewCost;

      // Update analysis with processed data
      const { error: updateError } = await supabase
        .from('shipping_analyses')
        .update({
          processed_shipments: processedShipments,
          orphaned_shipments: orphanedShipments,
          total_savings: totalSavings,
          total_shipments: originalShipments.length,
          status: 'completed',
          carrier_configs_used: carrierConfigIds,
          processing_metadata: {
            processed_count: processedShipments.length,
            orphaned_count: orphanedShipments.length,
            total_potential_savings: totalSavings,
            average_savings_percent: processedShipments.length > 0 ? 
              processedShipments.reduce((sum, ship) => sum + ship.savingsPercent, 0) / processedShipments.length : 0,
            carriers_used: carrierConfigs.map(config => ({
              id: config.id,
              name: config.account_name,
              type: config.carrier_type
            }))
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setProgress(100);
      setProcessingStep('Analysis complete!');

      console.log('✅ Multi-carrier analysis completed:', {
        processed: processedShipments.length,
        orphaned: orphanedShipments.length,
        totalSavings: totalSavings,
        averageSavingsPercent: processedShipments.length > 0 ? 
          processedShipments.reduce((sum, ship) => sum + ship.savingsPercent, 0) / processedShipments.length : 0
      });

      toast.success(`Analysis completed! Processed ${processedShipments.length} shipments with potential savings of $${totalSavings.toFixed(2)}`);
      
      setTimeout(() => {
        navigate(`/results/${id}`);
      }, 2000);

    } catch (error: any) {
      console.error('❌ Multi-carrier analysis error:', error);
      toast.error(error.message || 'Analysis failed');
      setProcessingStep('Analysis failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading analysis...</p>
        </div>
      </div>
    );
  }

  const canProcess = analysis.status === 'processing' || analysis.status === 'draft';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {analysis.status === 'completed' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : analysis.status === 'processing' ? (
                <Clock className="h-6 w-6 text-blue-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-orange-600" />
              )}
              Multi-Carrier Analysis: {analysis.report_name || analysis.file_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Analysis Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{analysis.total_shipments || 0}</div>
                <div className="text-sm text-muted-foreground">Total Shipments</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{analysis.processed_shipments?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{analysis.orphaned_shipments?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ${(analysis.total_savings || 0).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Potential Savings</div>
              </div>
            </div>

            {/* Processing Section */}
            {isProcessing && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">{processingStep}</div>
                  <Progress value={progress} className="w-full" />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              {canProcess && !isProcessing && (
                <Button 
                  onClick={processMultiCarrierAnalysis}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Multi-Carrier Analysis
                </Button>
              )}
              
              {analysis.status === 'completed' && (
                <Button 
                  onClick={() => navigate(`/results/${id}`)}
                  variant="outline"
                >
                  View Results
                </Button>
              )}
            </div>

            {/* Status Information */}
            <div className="text-sm text-muted-foreground">
              <p><strong>Status:</strong> {analysis.status}</p>
              <p><strong>Created:</strong> {new Date(analysis.created_at).toLocaleString()}</p>
              {analysis.updated_at && (
                <p><strong>Updated:</strong> {new Date(analysis.updated_at).toLocaleString()}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analysis;
