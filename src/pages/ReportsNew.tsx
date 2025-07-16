import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { NewReportDialog } from '@/components/ui-lov/NewReportDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCcw, Search, FileText, Clock, CheckCircle2, BarChart3, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Report {
  id: string;
  user_id: string;
  report_name: string;
  raw_csv_filename: string;
  total_rows: number;
  current_section: 'header_mapping' | 'service_mapping' | 'analysis' | 'results' | 'complete';
  sections_completed: string[];
  total_savings: number | null;
  total_shipments: number;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    company_name: string;
  } | null;
}

const SECTION_LABELS = {
  header_mapping: 'Header Mapping',
  service_mapping: 'Service Mapping', 
  analysis: 'Running Analysis',
  results: 'Viewing Results',
  complete: 'Complete'
};

const SECTION_ICONS = {
  header_mapping: Clock,
  service_mapping: Clock,
  analysis: BarChart3,
  results: FileText,
  complete: CheckCircle2
};

const ReportsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading reports from new reports table...');
      
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch client data for reports that have a client_id
      let reportsWithClients = data || [];
      if (reportsWithClients.length > 0) {
        const clientIds = [...new Set(reportsWithClients.map(r => r.client_id).filter(Boolean))];
        
        if (clientIds.length > 0) {
          const { data: clientsData } = await supabase
            .from('clients')
            .select('id, company_name')
            .in('id', clientIds);

          reportsWithClients = reportsWithClients.map(report => ({
            ...report,
            client: report.client_id 
              ? clientsData?.find(c => c.id === report.client_id) || null
              : null
          }));
        }
      }
      
      console.log(`Loaded ${reportsWithClients.length} reports`);
      setReports(reportsWithClients as Report[]);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    return (
      report.report_name.toLowerCase().includes(searchLower) ||
      report.raw_csv_filename.toLowerCase().includes(searchLower) ||
      (report.client?.company_name || '').toLowerCase().includes(searchLower)
    );
  });

  const getProgressPercentage = (report: Report) => {
    const totalSections = 4;
    const completedCount = report.sections_completed.length;
    return Math.round((completedCount / totalSections) * 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading reports...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-1">Reports</h1>
              <p className="text-muted-foreground">Your shipping analysis reports and projects</p>
            </div>
            <NewReportDialog onReportCreated={loadReports} />
          </div>
        </div>

        {/* Search and Controls */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
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
            onClick={loadReports}
            title="Refresh reports"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'No reports found' : 'No reports yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms' 
                  : 'Create your first shipping analysis to get started'
                }
              </p>
              {!searchTerm && <NewReportDialog onReportCreated={loadReports} />}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => {
              const CurrentIcon = SECTION_ICONS[report.current_section];
              const progress = getProgressPercentage(report);
              
              return (
                <Card 
                  key={report.id} 
                  className="cursor-pointer transition-all hover:shadow-md"
                  onClick={() => navigate(`/report/${report.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate mb-1">
                          {report.report_name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {report.raw_csv_filename}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={report.current_section === 'complete' ? 'default' : 'secondary'}
                        className="ml-2 shrink-0"
                      >
                        <CurrentIcon className="h-3 w-3 mr-1" />
                        {SECTION_LABELS[report.current_section]}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-secondary h-2 rounded-full">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Shipments</span>
                        <p className="font-medium">{report.total_shipments.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Savings</span>
                        <p className="font-medium">
                          {report.total_savings 
                            ? `$${report.total_savings.toLocaleString()}` 
                            : 'Pending'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Client */}
                    {report.client && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{report.client.company_name}</span>
                      </div>
                    )}

                    {/* Date */}
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDate(report.updated_at)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;