import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Package,
  DollarSign,
  Percent,
  FileText,
  Download,
  Share2,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Users,
  Building2,
  Truck,
  Clock,
  Target,
  BarChart3,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SummaryStats } from '@/components/ui-lov/SummaryStats';
import { DataTable } from '@/components/ui-lov/DataTable';
import { MarkupConfiguration } from '@/components/ui-lov/MarkupConfiguration';
import { exportToExcel } from '@/utils/exportUtils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientCombobox } from '@/components/ui-lov/ClientCombobox';
import { AccountComparisonView } from '@/components/ui-lov/AccountComparisonView';
import { createShareableLink } from '@/utils/shareUtils';
import { RateDisplay } from '@/components/ui-lov/RateDisplay';

interface ShippingAnalysis {
  id: string;
  file_name: string;
  analysis_date: string;
  total_shipments: number;
  total_savings: number | null;
  markup_data: any;
  savings_analysis: any;
  created_at: string;
  status: string;
  updated_at: string;
  report_name: string | null;
  client_id: string | null;
  processed_shipments: any[];
  orphaned_shipments: any[];
  processing_metadata: any;
}

interface ResultsProps {
  isClientView?: boolean;
  shareToken?: string;
}

const Results: React.FC<ResultsProps> = ({ isClientView = false, shareToken }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<ShippingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get analysis ID from location state or URL parameter
  const analysisId = location.state?.analysisId || new URLSearchParams(location.search).get('id');

  useEffect(() => {
    if (isClientView && shareToken) {
      loadSharedAnalysis(shareToken);
    } else if (analysisId) {
      loadAnalysis(analysisId);
    } else {
      console.error('No analysis ID provided');
      setLoading(false);
    }
  }, [analysisId, shareToken, isClientView]);

  const loadSharedAnalysis = async (token: string) => {
    try {
      setLoading(true);
      console.log('🔗 Loading shared analysis with token:', token);
      
      const { data: shareData, error: shareError } = await supabase
        .from('report_shares')
        .select('analysis_id, is_active, expires_at')
        .eq('share_token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (shareError) {
        console.error('Error loading share:', shareError);
        throw new Error('Failed to load shared report');
      }

      if (!shareData) {
        throw new Error('Invalid or expired share link');
      }

      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        throw new Error('Share link has expired');
      }

      // Load the analysis
      const { data: analysisData, error: analysisError } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', shareData.analysis_id)
        .maybeSingle();

      if (analysisError) {
        console.error('Error loading analysis:', analysisError);
        throw new Error('Failed to load analysis');
      }

      if (!analysisData) {
        throw new Error('Analysis not found');
      }

      console.log('✅ Loaded shared analysis:', analysisData);
      
      // Cast Json types to proper arrays
      const processedAnalysis: ShippingAnalysis = {
        ...analysisData,
        processed_shipments: Array.isArray(analysisData.processed_shipments) ? analysisData.processed_shipments : [],
        orphaned_shipments: Array.isArray(analysisData.orphaned_shipments) ? analysisData.orphaned_shipments : []
      };
      
      setAnalysis(processedAnalysis);
      setSelectedClient(analysisData.client_id);
      setTempName(analysisData.report_name || analysisData.file_name);

      // Update view count
      await supabase
        .from('report_shares')
        .update({
          view_count: (shareData as any).view_count + 1,
          last_viewed_at: new Date().toISOString()
        })
        .eq('share_token', token);

    } catch (error: any) {
      console.error('Error loading shared analysis:', error);
      toast.error(error.message || 'Failed to load shared analysis');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysis = async (id: string) => {
    try {
      setLoading(true);
      console.log('📊 Loading analysis with ID:', id);
      
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading analysis:', error);
        throw new Error('Failed to load analysis');
      }

      if (!data) {
        throw new Error('Analysis not found');
      }

      console.log('✅ Loaded analysis:', data);
      
      // Cast Json types to proper arrays
      const processedAnalysis: ShippingAnalysis = {
        ...data,
        processed_shipments: Array.isArray(data.processed_shipments) ? data.processed_shipments : [],
        orphaned_shipments: Array.isArray(data.orphaned_shipments) ? data.orphaned_shipments : []
      };
      
      setAnalysis(processedAnalysis);
      setSelectedClient(data.client_id);
      setTempName(data.report_name || data.file_name);
    } catch (error: any) {
      console.error('Error loading analysis:', error);
      toast.error(error.message || 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  const updateAnalysis = async (updates: Partial<ShippingAnalysis>) => {
    if (!analysis || isClientView) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('shipping_analyses')
        .update(updates)
        .eq('id', analysis.id);

      if (error) throw error;

      setAnalysis(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Analysis updated successfully');
    } catch (error: any) {
      console.error('Error updating analysis:', error);
      toast.error('Failed to update analysis');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) {
      toast.error('Report name cannot be empty');
      return;
    }

    await updateAnalysis({ report_name: tempName });
    setEditingName(false);
  };

  const handleClientChange = async (clientId: string | null) => {
    setSelectedClient(clientId);
    await updateAnalysis({ client_id: clientId });
  };

  const handleShare = async () => {
    if (!analysis || isClientView) return;

    try {
      setIsSharing(true);
      const shareLink = await createShareableLink(analysis.id, selectedClient);
      setShareUrl(shareLink);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareLink);
      toast.success('Share link copied to clipboard!');
    } catch (error: any) {
      console.error('Error creating share link:', error);
      toast.error('Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  };

  const handleExport = () => {
    if (!analysis) return;

    const processedData = analysis.processed_shipments || [];
    const orphanedData = analysis.orphaned_shipments || [];
    
    exportToExcel(processedData, orphanedData, analysis.report_name || analysis.file_name);
  };

  const handleEdit = () => {
    if (!analysis || isClientView) return;
    
    navigate('/analysis', { 
      state: { 
        analysisId: analysis.id,
        editMode: true
      }
    });
  };

  const handleBackToReports = () => {
    navigate('/reports');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading analysis...</span>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Analysis Results Found</h2>
        <p className="text-muted-foreground mb-4">
          We couldn't find any analysis results to display. Please run an analysis first.
        </p>
        {!isClientView && (
          <Button onClick={() => navigate('/upload')}>
            Start New Analysis
          </Button>
        )}
      </div>
    );
  }

  const processedShipments = analysis.processed_shipments || [];
  const orphanedShipments = analysis.orphaned_shipments || [];
  const totalShipments = processedShipments.length + orphanedShipments.length;

  // Only show results if we have shipment data
  if (totalShipments === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">No Analysis Results Found</h2>
        <p className="text-muted-foreground mb-4">
          We couldn't find any analysis results to display. Please run an analysis first.
        </p>
        {!isClientView && (
          <Button onClick={() => navigate('/upload')}>
            Start New Analysis
          </Button>
        )}
      </div>
    );
  }

  const Layout = isClientView ? ClientLayout : DashboardLayout;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isClientView && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToReports}
                iconLeft={<ArrowLeft className="h-4 w-4" />}
              >
                Back to Reports
              </Button>
            )}
            <div className="flex items-center gap-2">
              {editingName && !isClientView ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
                    className="w-64"
                    placeholder="Enter report name"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={isSaving}
                    iconLeft={isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingName(false);
                      setTempName(analysis.report_name || analysis.file_name);
                    }}
                    iconLeft={<X className="h-4 w-4" />}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">
                    {analysis.report_name || analysis.file_name}
                  </h1>
                  {!isClientView && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingName(true)}
                      iconLeft={<Edit className="h-4 w-4" />}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {new Date(analysis.created_at).toLocaleDateString()}
            </Badge>
            {!isClientView && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  iconLeft={<Edit className="h-4 w-4" />}
                >
                  Edit Analysis
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  iconLeft={<Download className="h-4 w-4" />}
                >
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  disabled={isSharing}
                  iconLeft={isSharing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                >
                  Share
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Client Assignment */}
        {!isClientView && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Client Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label htmlFor="client-select">Assign to Client:</Label>
                <ClientCombobox
                  value={selectedClient}
                  onValueChange={handleClientChange}
                  placeholder="Select a client (optional)"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ${(analysis.total_savings || 0).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Total Savings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {processedShipments.length}
                </div>
                <div className="text-sm text-muted-foreground">Processed Shipments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {orphanedShipments.length}
                </div>
                <div className="text-sm text-muted-foreground">Orphaned Shipments</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="results" className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="results">Shipment Results</TabsTrigger>
            <TabsTrigger value="accounts">Account Comparison</TabsTrigger>
            <TabsTrigger value="orphaned">Orphaned Shipments</TabsTrigger>
            {!isClientView && <TabsTrigger value="markup">Markup Configuration</TabsTrigger>}
          </TabsList>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>Processed Shipments ({processedShipments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable 
                  data={processedShipments}
                  columns={[]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts">
            <AccountComparisonView 
              analysisId={analysis.id}
            />
          </TabsContent>

          <TabsContent value="orphaned">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Orphaned Shipments ({orphanedShipments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orphanedShipments.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No orphaned shipments found. All shipments were successfully processed!
                    </p>
                  </div>
                ) : (
                  <DataTable 
                    data={orphanedShipments}
                    columns={[]}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {!isClientView && (
            <TabsContent value="markup">
              <MarkupConfiguration 
                analysisId={analysis.id}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Results;
