import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Lock, Eye } from 'lucide-react';
import { AnalysisViewer } from '@/components/AnalysisViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui-lov/DataTable';
import { useToast } from '@/hooks/use-toast';

export default function SharedReport() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);

  useEffect(() => {
    if (token) {
      fetchSharedReport();
    }
  }, [token]);

  const fetchSharedReport = async () => {
    try {
      setLoading(true);
      
      // First, get the share record
      const { data: shareRecord, error: shareError } = await supabase
        .from('report_shares')
        .select('*')
        .eq('share_token', token)
        .eq('is_active', true)
        .single();

      if (shareError || !shareRecord) {
        setError('Report not found or access has been revoked');
        return;
      }

      // Check if password is required
      if (shareRecord.password_hash && !password) {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }

      // TODO: Verify password if provided (implement bcrypt comparison in edge function)

      // Check if expired
      if (shareRecord.expires_at && new Date(shareRecord.expires_at) < new Date()) {
        setError('This shared report has expired');
        return;
      }

      // Update view count and last viewed
      await supabase
        .from('report_shares')
        .update({ 
          view_count: (shareRecord.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString()
        })
        .eq('id', shareRecord.id);

      // Get the analysis data
      const { data: analysis, error: analysisError } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('id', shareRecord.analysis_id)
        .single();

      if (analysisError || !analysis) {
        setError('Analysis data not found');
        return;
      }

      setShareData(shareRecord);
      setAnalysisData(analysis);
    } catch (err) {
      console.error('Error fetching shared report:', err);
      setError('Failed to load shared report');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = () => {
    fetchSharedReport();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading shared report...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="password">Enter password to view this report</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="mt-1"
              />
            </div>
            <Button onClick={handlePasswordSubmit} className="w-full">
              Access Report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysisData) {
    return null;
  }

  const results = analysisData.original_data || [];
  const markupConfig = analysisData.markup_data || { type: 'global', globalPercentage: 0 };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Shipping Analysis Report</h1>
            <Badge variant="secondary">Client View</Badge>
          </div>
          <p className="text-muted-foreground">
            Shared on {new Date(shareData.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shipment-data">Shipment Data</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AnalysisViewer
              results={results}
              markupConfig={markupConfig}
              reportName={analysisData.file_name}
              activeView="client"
              showEditOptions={false}
              availableServices={[...new Set(results.map((r: any) => r.bestRate?.service || 'Unknown'))].filter(Boolean) as string[]}
            />
          </TabsContent>

          <TabsContent value="shipment-data">
            <Card>
              <CardHeader>
                <CardTitle>Shipment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={results}
                  columns={[
                    { header: 'Origin', key: 'origin' },
                    { header: 'Destination', key: 'destination' },
                    { header: 'Weight', key: 'weight', format: (value) => `${value} lbs` },
                    { header: 'Current Service', key: 'currentService' },
                    { header: 'Current Cost', key: 'currentCost', format: (value) => `$${value?.toFixed(2)}` },
                    { header: 'Recommended Service', key: 'bestRate.service' },
                    { header: 'Recommended Cost', key: 'bestRate.cost', format: (value) => `$${value?.toFixed(2)}` },
                    { header: 'Savings', key: 'savings', format: (value) => `$${value?.toFixed(2)}` }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}