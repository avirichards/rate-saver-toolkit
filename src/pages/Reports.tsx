
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, Filter, Search, TrendingUp, TrendingDown, Percent, DollarSign, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NewReportDialog } from '@/components/ui-lov/NewReportDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ReportsTable } from '@/components/ui-lov/ReportsTable';
import { GroupedReportsView } from '@/components/ui-lov/GroupedReportsView';

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
  client?: {
    id: string;
    company_name: string;
  } | null;
}

const ReportsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [reports, setReports] = useState<ShippingAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupByClient, setGroupByClient] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  // Remove aggressive window focus refresh - it causes the random page refreshes

  const loadReports = async () => {
    try {
      setLoading(true);
      
      
      // Query both tables to get all reports (both old shipping_analyses and new reports)
      const [shipmentsData, reportsData] = await Promise.all([
        supabase
          .from('shipping_analyses')
          .select(`
            id, 
            file_name, 
            analysis_date, 
            total_shipments, 
            total_savings, 
            markup_data, 
            savings_analysis,
            created_at, 
            status, 
            updated_at,
            report_name,
            client_id,
            clients:client_id(id, company_name)
          `)
          .eq('user_id', user?.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('reports')
          .select(`
            id,
            report_name,
            raw_csv_filename,
            total_rows,
            total_shipments,
            total_savings,
            created_at,
            updated_at,
            current_section,
            sections_completed,
            client_id,
            clients:client_id(id, company_name)
          `)
          .eq('user_id', user?.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
      ]);

      if (shipmentsData.error) throw shipmentsData.error;
      if (reportsData.error) throw reportsData.error;

      // Combine and normalize both data sources
      const legacyReports = (shipmentsData.data || []).map(report => ({
        ...report,
        file_name: report.file_name,
        analysis_date: report.analysis_date || report.created_at,
        status: report.status || 'completed',
        client: report.clients || null,
        source: 'shipping_analyses'
      }));

      const newReports = (reportsData.data || []).map(report => ({
        ...report,
        file_name: report.raw_csv_filename,
        analysis_date: report.created_at,
        total_shipments: report.total_shipments || report.total_rows,
        status: report.current_section === 'complete' ? 'completed' : 'in_progress',
        report_name: report.report_name,
        client: report.clients || null,
        source: 'reports'
      }));

      // Combine both sources, with newer reports first
      const allReports = [...newReports, ...legacyReports];
      

      setReports(allReports as any);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (report.report_name || report.file_name).toLowerCase().includes(searchLower) ||
      (report.client?.company_name || '').toLowerCase().includes(searchLower)
    );
  });

  const getMarkupStatus = (markupData: any) => {
    if (!markupData) return { 
      hasMarkup: false, 
      totalMargin: 0, 
      marginPercentage: 0,
      savingsAmount: 0,
      savingsPercentage: 0
    };
    return {
      hasMarkup: markupData.totalMargin > 0,
      totalMargin: markupData.totalMargin || 0,
      marginPercentage: markupData.marginPercentage || 0,
      savingsAmount: markupData.savingsAmount || 0,
      savingsPercentage: markupData.savingsPercentage || 0
    };
  };

  const getWinsReports = () => {
    return filteredReports.filter(report => {
      const savings = report.total_savings || 0;
      return savings > 0;
    });
  };

  const getLossesReports = () => {
    return filteredReports.filter(report => {
      const savings = report.total_savings || 0;
      return savings <= 0;
    });
  };

  const getSavedReports = () => {
    return filteredReports.filter(report => 
      getMarkupStatus(report.markup_data).hasMarkup
    );
  };

  const getGroupedReports = () => {
    if (!groupByClient) return { ungrouped: filteredReports };
    
    const grouped: { [key: string]: ShippingAnalysis[] } = {};
    
    filteredReports.forEach(report => {
      const clientKey = report.client?.company_name || 'No Client Assigned';
      if (!grouped[clientKey]) {
        grouped[clientKey] = [];
      }
      grouped[clientKey].push(report);
    });
    
    return grouped;
  };

  const toggleClientExpansion = (clientName: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientName)) {
      newExpanded.delete(clientName);
    } else {
      newExpanded.add(clientName);
    }
    setExpandedClients(newExpanded);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Reports</h1>
          <p className="text-muted-foreground">View and manage your saved shipping analyses</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reports..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9"
                  onClick={loadReports}
                  title="Refresh reports"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
              <NewReportDialog onReportCreated={loadReports} />
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="group-by-client"
                  checked={groupByClient}
                  onCheckedChange={setGroupByClient}
                />
                <Label htmlFor="group-by-client" className="text-sm">
                  Group by Client
                </Label>
              </div>
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Reports ({filteredReports.length})</TabsTrigger>
                <TabsTrigger value="wins">Wins ({getWinsReports().length})</TabsTrigger>
                <TabsTrigger value="losses">Losses ({getLossesReports().length})</TabsTrigger>
                <TabsTrigger value="markup">With Markup ({getSavedReports().length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading reports...</div>
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileBarChart className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No reports found</h3>
                    <p className="text-muted-foreground mb-4">Create your first shipping report to see data here.</p>
                    <NewReportDialog onReportCreated={loadReports} />
                  </div>
                ) : groupByClient ? (
                  <GroupedReportsView
                    groupedReports={getGroupedReports()}
                    expandedClients={expandedClients}
                    toggleClientExpansion={toggleClientExpansion}
                    getMarkupStatus={getMarkupStatus}
                  />
                ) : (
                  <ReportsTable 
                    reports={filteredReports} 
                    getMarkupStatus={getMarkupStatus}
                    onReportUpdate={loadReports}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="wins" className="mt-0">
                {getWinsReports().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No winning reports</h3>
                    <p className="text-muted-foreground">Reports with positive savings will appear here.</p>
                  </div>
                ) : (
                  <ReportsTable 
                    reports={getWinsReports()} 
                    getMarkupStatus={getMarkupStatus}
                    onReportUpdate={loadReports}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="losses" className="mt-0">
                {getLossesReports().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <TrendingDown className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No reports with losses</h3>
                    <p className="text-muted-foreground">Reports with zero or negative savings will appear here.</p>
                  </div>
                ) : (
                  <ReportsTable 
                    reports={getLossesReports()} 
                    getMarkupStatus={getMarkupStatus}
                    onReportUpdate={loadReports}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="markup" className="mt-0">
                {getSavedReports().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Percent className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No reports with markup</h3>
                    <p className="text-muted-foreground">Reports with configured markup percentages will appear here.</p>
                  </div>
                ) : (
                  <ReportsTable 
                    reports={getSavedReports()} 
                    getMarkupStatus={getMarkupStatus}
                    onReportUpdate={loadReports}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
