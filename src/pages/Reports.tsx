
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, Filter, Search, Calendar, ArrowUpDown, Download, Eye, Percent, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ShippingAnalysis {
  id: string;
  file_name: string;
  analysis_date: string;
  total_shipments: number;
  total_savings: number | null;
  markup_data: any;
  created_at: string;
  status: string;
  updated_at: string;
}

const ReportsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [reports, setReports] = useState<ShippingAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('id, file_name, analysis_date, total_shipments, total_savings, markup_data, created_at, status, updated_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(report => 
    report.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMarkupStatus = (markupData: any) => {
    if (!markupData) return { hasMarkup: false, totalMargin: 0, marginPercentage: 0 };
    return {
      hasMarkup: markupData.totalMargin > 0,
      totalMargin: markupData.totalMargin || 0,
      marginPercentage: markupData.marginPercentage || 0
    };
  };

  const getRecentReports = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return filteredReports.filter(report => 
      new Date(report.created_at) > thirtyDaysAgo
    );
  };

  const getSavedReports = () => {
    return filteredReports.filter(report => 
      getMarkupStatus(report.markup_data).hasMarkup
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Reports</h1>
            <p className="text-muted-foreground">View and manage your saved shipping analyses</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link to="/upload">
              <Button 
                variant="primary" 
                iconLeft={<FileBarChart className="h-4 w-4" />}
              >
                New Analysis
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>Shipping Analysis Reports</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
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
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Reports ({filteredReports.length})</TabsTrigger>
                <TabsTrigger value="recent">Recent ({getRecentReports().length})</TabsTrigger>
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
                    <p className="text-muted-foreground mb-4">Create your first shipping analysis to see reports here.</p>
                    <Link to="/upload">
                      <Button variant="primary">
                        <FileBarChart className="h-4 w-4 mr-2" />
                        New Analysis
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">
                            <div className="flex items-center gap-1">
                              Report Name
                              <ArrowUpDown className="h-3 w-3" />
                            </div>
                          </th>
                          <th className="text-left py-3 px-2">
                            <div className="flex items-center gap-1">
                              Date
                              <Calendar className="h-3 w-3" />
                            </div>
                          </th>
                          <th className="text-left py-3 px-2">Status</th>
                          <th className="text-right py-3 px-2">Items</th>
                          <th className="text-right py-3 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <DollarSign className="h-3 w-3" />
                              Savings
                            </div>
                          </th>
                          <th className="text-right py-3 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <Percent className="h-3 w-3" />
                              Margin
                            </div>
                          </th>
                          <th className="text-right py-3 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReports.map((report) => {
                          const markupStatus = getMarkupStatus(report.markup_data);
                          return (
                            <tr key={report.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2 font-medium">{report.file_name}</td>
                              <td className="py-3 px-2">{new Date(report.analysis_date).toLocaleDateString()}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                                    {report.status}
                                  </Badge>
                                  {markupStatus.hasMarkup && (
                                    <Badge variant="outline">
                                      With Markup
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">{report.total_shipments}</td>
                              <td className="py-3 px-2 text-right font-medium">
                                {report.total_savings ? `$${report.total_savings.toFixed(2)}` : '-'}
                              </td>
                              <td className="py-3 px-2 text-right">
                                {markupStatus.hasMarkup ? (
                                  <div className="text-right">
                                    <div className="font-medium">${markupStatus.totalMargin.toFixed(2)}</div>
                                    <div className="text-xs text-muted-foreground">{markupStatus.marginPercentage.toFixed(1)}%</div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      // TODO: Implement export functionality
                                      console.log('Export report:', report.id);
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Link to={`/results?analysisId=${report.id}`}>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="recent" className="mt-0">
                {getRecentReports().length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No recent reports</h3>
                    <p className="text-muted-foreground">Reports from the last 30 days will appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Report Name</th>
                          <th className="text-left py-3 px-2">Date</th>
                          <th className="text-left py-3 px-2">Status</th>
                          <th className="text-right py-3 px-2">Items</th>
                          <th className="text-right py-3 px-2">Savings</th>
                          <th className="text-right py-3 px-2">Margin</th>
                          <th className="text-right py-3 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getRecentReports().map((report) => {
                          const markupStatus = getMarkupStatus(report.markup_data);
                          return (
                            <tr key={report.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2 font-medium">{report.file_name}</td>
                              <td className="py-3 px-2">{new Date(report.analysis_date).toLocaleDateString()}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                                    {report.status}
                                  </Badge>
                                  {markupStatus.hasMarkup && (
                                    <Badge variant="outline">
                                      With Markup
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">{report.total_shipments}</td>
                              <td className="py-3 px-2 text-right font-medium">
                                {report.total_savings ? `$${report.total_savings.toFixed(2)}` : '-'}
                              </td>
                              <td className="py-3 px-2 text-right">
                                {markupStatus.hasMarkup ? (
                                  <div className="text-right">
                                    <div className="font-medium">${markupStatus.totalMargin.toFixed(2)}</div>
                                    <div className="text-xs text-muted-foreground">{markupStatus.marginPercentage.toFixed(1)}%</div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      console.log('Export report:', report.id);
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Link to={`/results?analysisId=${report.id}`}>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Report Name</th>
                          <th className="text-left py-3 px-2">Date</th>
                          <th className="text-left py-3 px-2">Status</th>
                          <th className="text-right py-3 px-2">Items</th>
                          <th className="text-right py-3 px-2">Original Savings</th>
                          <th className="text-right py-3 px-2">Margin Revenue</th>
                          <th className="text-right py-3 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSavedReports().map((report) => {
                          const markupStatus = getMarkupStatus(report.markup_data);
                          return (
                            <tr key={report.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2 font-medium">{report.file_name}</td>
                              <td className="py-3 px-2">{new Date(report.analysis_date).toLocaleDateString()}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                                    {report.status}
                                  </Badge>
                                  <Badge variant="outline">
                                    {markupStatus.marginPercentage.toFixed(1)}% Markup
                                  </Badge>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">{report.total_shipments}</td>
                              <td className="py-3 px-2 text-right font-medium">
                                {report.total_savings ? `$${report.total_savings.toFixed(2)}` : '-'}
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="text-right">
                                  <div className="font-medium text-primary">${markupStatus.totalMargin.toFixed(2)}</div>
                                  <div className="text-xs text-muted-foreground">{markupStatus.marginPercentage.toFixed(1)}% margin</div>
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      console.log('Export report:', report.id);
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Link to={`/results?analysisId=${report.id}`}>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      className="h-8 w-8"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
