import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingDown, 
  Package, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Download,
  FileText,
  BarChart3,
  PieChart,
  ArrowLeft,
  Truck,
  MapPin,
  Weight,
  Calendar,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';

interface AnalysisData {
  totalShipments: number;
  completedShipments: number;
  errorShipments: number;
  totalCurrentCost: number;
  totalPotentialSavings: number;
  averageSavingsPercent: number;
  recommendations: any[];
  orphanedShipments: any[];
}

interface ServiceNote {
  id: string;
  service_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [serviceNotes, setServiceNotes] = useState<ServiceNote[]>([]);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isClientView, setIsClientView] = useState(false);

  // Load analysis from URL parameter first, then fallback to state
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const analysisIdFromUrl = searchParams.get('analysisId');
    
    if (analysisIdFromUrl) {
      console.log('🔍 Loading analysis from URL parameter:', analysisIdFromUrl);
      setCurrentAnalysisId(analysisIdFromUrl);
      loadAnalysisFromDatabase(analysisIdFromUrl);
      loadServiceNotes(analysisIdFromUrl);
      return;
    }

    // Fallback to state-based data (legacy support)
    const state = location.state as { 
      analysisComplete?: boolean, 
      analysisData?: any,
      fromReports?: boolean 
    } | null;
    
    if (state?.analysisComplete && state?.analysisData) {
      console.log('📊 Using analysis data from navigation state (legacy mode)');
      setAnalysisData(state.analysisData);
      setIsLoading(false);
      
      // Auto-save this analysis to database for future reference
      autoSaveAnalysis(state.analysisData);
    } else {
      console.log('⚠️ No analysis ID in URL and no state data available');
      setError('No analysis data found. Please run a new analysis from the upload page.');
      setIsLoading(false);
    }
  }, [location]);

  const autoSaveAnalysis = async (data: any) => {
    if (isClientView) {
      console.log('⚠️ Auto-save skipped: Client view mode');
      return null;
    }
    
    // Prevent multiple saves of the same analysis
    if (!data || currentAnalysisId) {
      console.log('⚠️ Auto-save skipped:', { 
        hasData: !!data, 
        hasCurrentId: !!currentAnalysisId 
      });
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('⚠️ Auto-save skipped: No authenticated user');
        return null;
      }

      console.log('💾 Auto-saving analysis to database...');

      const analysisRecord = {
        user_id: user.id,
        file_name: 'Real-time Analysis',
        total_shipments: data.totalShipments || 0,
        total_savings: data.totalPotentialSavings || 0,
        status: 'completed',
        original_data: data as any,
        recommendations: data.recommendations || [] as any,
        orphaned_shipments: data.orphanedShipments || [] as any,
        processed_shipments: (data.recommendations || []).map((rec: any, index: number) => ({
          id: index + 1,
          trackingId: rec.shipment?.trackingId || `Shipment-${index + 1}`,
          originZip: rec.shipment?.originZip || '',
          destinationZip: rec.shipment?.destZip || '',
          weight: parseFloat(rec.shipment?.weight || '0'),
          carrier: rec.carrier || 'UPS',
          service: rec.originalService || 'Unknown',
          currentRate: rec.currentCost || 0,
          newRate: rec.recommendedCost || 0,
          savings: rec.savings || 0,
          savingsPercent: rec.currentCost && rec.currentCost > 0 ? ((rec.savings || 0) / rec.currentCost) * 100 : 0
        })) as any,
        processing_metadata: {
          autoSaved: true,
          savedAt: new Date().toISOString(),
          totalCurrentCost: data.totalCurrentCost || 0,
          totalShipments: data.totalShipments || 0,
          completedShipments: data.completedShipments || 0,
          errorShipments: data.errorShipments || 0
        } as any
      };

      const { data: savedAnalysis, error } = await supabase
        .from('shipping_analyses')
        .insert(analysisRecord)
        .select()
        .single();

      if (error) {
        console.error('❌ Auto-save failed:', error);
        return null;
      }
      
      console.log('✅ Analysis auto-saved successfully:', savedAnalysis.id);
      setCurrentAnalysisId(savedAnalysis.id);
      
      // Load service notes for the newly saved analysis
      loadServiceNotes(savedAnalysis.id);
      
      return savedAnalysis.id;
    } catch (error) {
      console.error('❌ Auto-save error:', error);
      return null;
    }
  };

  const loadAnalysisFromDatabase = async (analysisId: string) => {
    try {
      setIsLoading(true);
      console.log('📊 Loading analysis from database:', analysisId);

      const { data: analysis, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (error) {
        console.error('❌ Error loading analysis:', error);
        setError('Failed to load analysis data');
        setIsLoading(false);
        return;
      }

      if (!analysis) {
        setError('Analysis not found');
        setIsLoading(false);
        return;
      }

      console.log('✅ Analysis loaded successfully:', {
        id: analysis.id,
        fileName: analysis.file_name,
        totalShipments: analysis.total_shipments,
        totalSavings: analysis.total_savings,
        hasRecommendations: !!analysis.recommendations,
        hasOrphanedShipments: !!analysis.orphaned_shipments
      });

      // Check if this is a client view (no user authentication)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsClientView(true);
      }

      // Transform database data to expected format
      const transformedData: AnalysisData = {
        totalShipments: analysis.total_shipments || 0,
        completedShipments: analysis.recommendations?.length || 0,
        errorShipments: analysis.orphaned_shipments?.length || 0,
        totalCurrentCost: analysis.processing_metadata?.totalCurrentCost || 
                         (analysis.recommendations || []).reduce((sum: number, rec: any) => sum + (rec.currentCost || 0), 0),
        totalPotentialSavings: analysis.total_savings || 0,
        averageSavingsPercent: 0, // Will be calculated below
        recommendations: analysis.recommendations || [],
        orphanedShipments: analysis.orphaned_shipments || []
      };

      // Calculate average savings percentage
      if (transformedData.totalCurrentCost > 0) {
        transformedData.averageSavingsPercent = (transformedData.totalPotentialSavings / transformedData.totalCurrentCost) * 100;
      }

      setAnalysisData(transformedData);
      setIsLoading(false);

    } catch (error) {
      console.error('❌ Error loading analysis:', error);
      setError('Failed to load analysis data');
      setIsLoading(false);
    }
  };

  const loadServiceNotes = async (analysisId: string) => {
    try {
      const { data: notes, error } = await supabase
        .from('service_notes')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading service notes:', error);
        return;
      }

      setServiceNotes(notes || []);
    } catch (error) {
      console.error('Error loading service notes:', error);
    }
  };

  const saveServiceNote = async (serviceName: string, notes: string) => {
    if (!currentAnalysisId || isClientView) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existingNote = serviceNotes.find(note => note.service_name === serviceName);

      if (existingNote) {
        // Update existing note
        const { error } = await supabase
          .from('service_notes')
          .update({ notes, updated_at: new Date().toISOString() })
          .eq('id', existingNote.id);

        if (error) {
          console.error('Error updating service note:', error);
          toast.error('Failed to save note');
          return;
        }
      } else {
        // Create new note
        const { error } = await supabase
          .from('service_notes')
          .insert({
            analysis_id: currentAnalysisId,
            user_id: user.id,
            service_name: serviceName,
            notes
          });

        if (error) {
          console.error('Error creating service note:', error);
          toast.error('Failed to save note');
          return;
        }
      }

      // Reload notes
      await loadServiceNotes(currentAnalysisId);
      toast.success('Note saved successfully');
    } catch (error) {
      console.error('Error saving service note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleEditNote = (serviceName: string) => {
    const existingNote = serviceNotes.find(note => note.service_name === serviceName);
    setEditingNote(serviceName);
    setNoteText(existingNote?.notes || '');
  };

  const handleSaveNote = async () => {
    if (!editingNote) return;
    
    await saveServiceNote(editingNote, noteText);
    setEditingNote(null);
    setNoteText('');
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setNoteText('');
  };

  const exportToCSV = () => {
    if (!analysisData) return;

    const csvData = analysisData.recommendations.map(rec => ({
      'Tracking ID': rec.shipment?.trackingId || '',
      'Origin ZIP': rec.shipment?.originZip || '',
      'Destination ZIP': rec.shipment?.destZip || '',
      'Weight (lbs)': rec.shipment?.weight || '',
      'Current Service': rec.originalService || '',
      'Current Cost': `$${rec.currentCost?.toFixed(2) || '0.00'}`,
      'Recommended Service': rec.recommendedService || '',
      'Recommended Cost': `$${rec.recommendedCost?.toFixed(2) || '0.00'}`,
      'Savings': `$${rec.savings?.toFixed(2) || '0.00'}`,
      'Savings %': rec.currentCost > 0 ? `${((rec.savings / rec.currentCost) * 100).toFixed(1)}%` : '0%'
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipping-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading analysis results...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto p-6">
          <Card className="border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" />
                <h2 className="text-lg font-semibold text-red-900">Error Loading Results</h2>
              </div>
              <p className="text-red-700 mb-4">{error}</p>
              <Button onClick={() => navigate('/upload')} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Start New Analysis
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!analysisData) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto p-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">No Analysis Data</h2>
                <p className="text-muted-foreground mb-4">
                  No analysis results found. Please run a new analysis.
                </p>
                <Button onClick={() => navigate('/upload')}>
                  Start New Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const savingsWithPositive = analysisData.recommendations.filter(rec => rec.savings > 0);
  const savingsWithNegative = analysisData.recommendations.filter(rec => rec.savings < 0);
  const savingsWithNeutral = analysisData.recommendations.filter(rec => rec.savings === 0);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Analysis Results</h1>
            <p className="text-muted-foreground">
              Comprehensive shipping cost analysis and optimization recommendations
            </p>
            {isClientView && (
              <Badge variant="secondary" className="mt-2">
                <FileText className="w-3 h-3 mr-1" />
                Client View
              </Badge>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/upload')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              New Analysis
            </Button>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{analysisData.totalShipments}</p>
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
                  <p className="text-2xl font-bold">{analysisData.completedShipments}</p>
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
                  <p className="text-2xl font-bold">${analysisData.totalCurrentCost.toFixed(2)}</p>
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
                  <p className="text-2xl font-bold">${analysisData.totalPotentialSavings.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">
                    Potential Savings ({analysisData.averageSavingsPercent.toFixed(1)}%)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Savings Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Savings Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{savingsWithPositive.length}</p>
                <p className="text-sm text-green-600">Shipments with Savings</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ${savingsWithPositive.reduce((sum, rec) => sum + rec.savings, 0).toFixed(2)} total
                </p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{savingsWithNegative.length}</p>
                <p className="text-sm text-red-600">Shipments with Increases</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ${Math.abs(savingsWithNegative.reduce((sum, rec) => sum + rec.savings, 0)).toFixed(2)} total
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-700">{savingsWithNeutral.length}</p>
                <p className="text-sm text-gray-600">No Change</p>
                <p className="text-xs text-muted-foreground mt-1">Same cost</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Results Tabs */}
        <Tabs defaultValue="recommendations" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recommendations">
              Recommendations ({analysisData.completedShipments})
            </TabsTrigger>
            <TabsTrigger value="orphaned">
              Issues ({analysisData.errorShipments})
            </TabsTrigger>
            <TabsTrigger value="insights">
              Insights & Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations">
            <Card>
              <CardHeader>
                <CardTitle>Shipping Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysisData.recommendations.map((rec, index) => (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">
                              {rec.shipment?.trackingId || `Shipment ${index + 1}`}
                            </h3>
                            {rec.savings > 0 && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                Save ${rec.savings.toFixed(2)}
                              </Badge>
                            )}
                            {rec.savings < 0 && (
                              <Badge variant="secondary" className="bg-red-100 text-red-800">
                                +${Math.abs(rec.savings).toFixed(2)}
                              </Badge>
                            )}
                            {rec.savings === 0 && (
                              <Badge variant="outline">No Change</Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {rec.shipment?.originZip} → {rec.shipment?.destZip}
                            </div>
                            <div className="flex items-center gap-1">
                              <Weight className="w-3 h-3" />
                              {rec.shipment?.weight} lbs
                            </div>
                            <div className="flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              {rec.originalService}
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              ${rec.currentCost?.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">Recommended: {rec.recommendedService}</p>
                            <p className="text-xs text-muted-foreground">
                              New cost: ${rec.recommendedCost?.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {rec.savings > 0 ? 'Savings: ' : rec.savings < 0 ? 'Increase: ' : 'No change: '}
                              <span className={rec.savings > 0 ? 'text-green-600' : rec.savings < 0 ? 'text-red-600' : 'text-gray-600'}>
                                ${Math.abs(rec.savings).toFixed(2)}
                              </span>
                            </p>
                            {rec.currentCost > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {((rec.savings / rec.currentCost) * 100).toFixed(1)}%
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orphaned">
            <Card>
              <CardHeader>
                <CardTitle>Shipments with Issues</CardTitle>
              </CardHeader>
              <CardContent>
                {analysisData.orphanedShipments.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">All Shipments Processed Successfully</h3>
                    <p className="text-muted-foreground">
                      No shipments encountered processing issues.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analysisData.orphanedShipments.map((orphan, index) => (
                      <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50/50">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h3 className="font-medium mb-1">
                              {orphan.shipment?.trackingId || `Shipment ${index + 1}`}
                            </h3>
                            <div className="text-sm text-muted-foreground mb-2">
                              {orphan.shipment?.originZip} → {orphan.shipment?.destZip} | 
                              {orphan.shipment?.weight} lbs | 
                              {orphan.originalService}
                            </div>
                            <div className="bg-white rounded p-2 border border-red-200">
                              <p className="text-sm text-red-700 font-medium">Error:</p>
                              <p className="text-sm text-red-600">{orphan.error}</p>
                              {orphan.errorType && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {orphan.errorType}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <div className="space-y-6">
              {/* Service Performance Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Service Performance Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const serviceStats = analysisData.recommendations.reduce((acc: any, rec) => {
                      const service = rec.originalService || 'Unknown';
                      if (!acc[service]) {
                        acc[service] = {
                          count: 0,
                          totalSavings: 0,
                          totalCurrentCost: 0,
                          avgSavings: 0
                        };
                      }
                      acc[service].count++;
                      acc[service].totalSavings += rec.savings || 0;
                      acc[service].totalCurrentCost += rec.currentCost || 0;
                      acc[service].avgSavings = acc[service].totalSavings / acc[service].count;
                      return acc;
                    }, {});

                    return (
                      <div className="space-y-4">
                        {Object.entries(serviceStats).map(([service, stats]: [string, any]) => {
                          const existingNote = serviceNotes.find(note => note.service_name === service);
                          
                          return (
                            <div key={service} className="border border-border rounded-lg p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="font-medium">{service}</h3>
                                  <div className="text-sm text-muted-foreground">
                                    {stats.count} shipments • Avg savings: ${stats.avgSavings.toFixed(2)} • 
                                    Total savings: ${stats.totalSavings.toFixed(2)}
                                  </div>
                                </div>
                                {!isClientView && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditNote(service)}
                                  >
                                    <Edit3 className="w-3 h-3 mr-1" />
                                    {existingNote ? 'Edit Note' : 'Add Note'}
                                  </Button>
                                )}
                              </div>
                              
                              {editingNote === service ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder="Add notes about this service..."
                                    className="min-h-[80px]"
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveNote}>
                                      <Save className="w-3 h-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                      <X className="w-3 h-3 mr-1" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : existingNote ? (
                                <div className="bg-muted/50 rounded p-3 mt-2">
                                  <p className="text-sm">{existingNote.notes}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Last updated: {new Date(existingNote.updated_at).toLocaleDateString()}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Key Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Key Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Cost Optimization Potential</h4>
                      <p className="text-sm text-blue-800">
                        You could save ${analysisData.totalPotentialSavings.toFixed(2)} ({analysisData.averageSavingsPercent.toFixed(1)}%) 
                        on your shipping costs by optimizing service selections.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">Success Rate</h4>
                      <p className="text-sm text-green-800">
                        {analysisData.completedShipments} out of {analysisData.totalShipments} shipments 
                        ({((analysisData.completedShipments / analysisData.totalShipments) * 100).toFixed(1)}%) 
                        were successfully analyzed.
                      </p>
                    </div>

                    {savingsWithPositive.length > 0 && (
                      <div className="p-4 bg-emerald-50 rounded-lg">
                        <h4 className="font-medium text-emerald-900 mb-2">Savings Opportunities</h4>
                        <p className="text-sm text-emerald-800">
                          {savingsWithPositive.length} shipments show potential savings, 
                          with an average savings of ${(savingsWithPositive.reduce((sum, rec) => sum + rec.savings, 0) / savingsWithPositive.length).toFixed(2)} per shipment.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Results;
