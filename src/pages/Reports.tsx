
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, Filter, Search, Calendar, ArrowUpDown, Download, Eye, Share, Edit, Trash2, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useShippingAnalyses } from '@/hooks/useShippingAnalyses';
import type { Database } from '@/integrations/supabase/types';

type ShippingAnalysis = Database['public']['Tables']['shipping_analyses']['Row'];

const ReportsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { analyses, loading, fetchAnalyses, deleteAnalysis, getShareLink } = useShippingAnalyses();
  
  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const filteredReports = analyses.filter(analysis => 
    analysis.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (analysis.client_id && analysis.client_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getFilteredReports = () => {
    switch (activeTab) {
      case 'recent':
        return filteredReports.slice(0, 10);
      case 'saved':
        return filteredReports.filter(a => a.report_status === 'published');
      default:
        return filteredReports;
    }
  };

  const handleCopyShareLink = async (analysisId: string) => {
    const shareLink = await getShareLink(analysisId);
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      toast.success('Share link copied to clipboard');
    }
  };

  const handleDelete = async (analysisId: string, fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
      await deleteAnalysis(analysisId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
              <CardTitle>Saved Reports</CardTitle>
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
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Reports</TabsTrigger>
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="saved">Saved</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-0">
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
                        <th className="text-left py-3 px-2">Carrier</th>
                        <th className="text-right py-3 px-2">Items</th>
                        <th className="text-right py-3 px-2">Savings</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                     <tbody>
                       {getFilteredReports().map((analysis) => (
                         <tr key={analysis.id} className="border-b hover:bg-muted/50">
                           <td className="py-3 px-2 font-medium">{analysis.file_name}</td>
                           <td className="py-3 px-2">{formatDate(analysis.created_at)}</td>
                           <td className="py-3 px-2">
                             <Badge variant="secondary">UPS</Badge>
                           </td>
                           <td className="py-3 px-2 text-right">{analysis.total_shipments}</td>
                           <td className="py-3 px-2 text-right font-medium">
                             {formatCurrency(analysis.total_savings || 0)}
                           </td>
                           <td className="py-3 px-2">
                             <div className="flex items-center justify-end gap-1">
                               <Button 
                                 variant="ghost" 
                                 size="icon"
                                 className="h-8 w-8"
                                 onClick={() => handleCopyShareLink(analysis.id)}
                                 title="Copy share link"
                               >
                                 <Copy className="h-4 w-4" />
                               </Button>
                               <Button 
                                 variant="ghost" 
                                 size="icon"
                                 className="h-8 w-8"
                                 onClick={() => handleDelete(analysis.id, analysis.file_name)}
                                 title="Delete report"
                               >
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                               <Link to={`/reports/${analysis.id}`}>
                                 <Button 
                                   variant="ghost" 
                                   size="icon"
                                   className="h-8 w-8"
                                   title="View report"
                                 >
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               </Link>
                             </div>
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              
              <TabsContent value="recent" className="mt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Report Name</th>
                        <th className="text-left py-3 px-2">Date</th>
                        <th className="text-left py-3 px-2">Carrier</th>
                        <th className="text-right py-3 px-2">Items</th>
                        <th className="text-right py-3 px-2">Savings</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                     <tbody>
                       {getFilteredReports().map((analysis) => (
                         <tr key={analysis.id} className="border-b hover:bg-muted/50">
                           <td className="py-3 px-2 font-medium">{analysis.file_name}</td>
                           <td className="py-3 px-2">{formatDate(analysis.created_at)}</td>
                           <td className="py-3 px-2">
                             <Badge variant="secondary">UPS</Badge>
                           </td>
                           <td className="py-3 px-2 text-right">{analysis.total_shipments}</td>
                           <td className="py-3 px-2 text-right font-medium">
                             {formatCurrency(analysis.total_savings || 0)}
                           </td>
                           <td className="py-3 px-2">
                             <div className="flex items-center justify-end gap-1">
                               <Button 
                                 variant="ghost" 
                                 size="icon"
                                 className="h-8 w-8"
                                 onClick={() => handleCopyShareLink(analysis.id)}
                                 title="Copy share link"
                               >
                                 <Copy className="h-4 w-4" />
                               </Button>
                               <Link to={`/reports/${analysis.id}`}>
                                 <Button 
                                   variant="ghost" 
                                   size="icon"
                                   className="h-8 w-8"
                                   title="View report"
                                 >
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               </Link>
                             </div>
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              
              <TabsContent value="saved" className="mt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Report Name</th>
                        <th className="text-left py-3 px-2">Date</th>
                        <th className="text-left py-3 px-2">Carrier</th>
                        <th className="text-right py-3 px-2">Items</th>
                        <th className="text-right py-3 px-2">Savings</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                     <tbody>
                       {getFilteredReports().map((analysis) => (
                         <tr key={analysis.id} className="border-b hover:bg-muted/50">
                           <td className="py-3 px-2 font-medium">{analysis.file_name}</td>
                           <td className="py-3 px-2">{formatDate(analysis.created_at)}</td>
                           <td className="py-3 px-2">
                             <Badge variant="secondary">UPS</Badge>
                           </td>
                           <td className="py-3 px-2 text-right">{analysis.total_shipments}</td>
                           <td className="py-3 px-2 text-right font-medium">
                             {formatCurrency(analysis.total_savings || 0)}
                           </td>
                           <td className="py-3 px-2">
                             <div className="flex items-center justify-end gap-1">
                               <Button 
                                 variant="ghost" 
                                 size="icon"
                                 className="h-8 w-8"
                                 onClick={() => handleCopyShareLink(analysis.id)}
                                 title="Copy share link"
                               >
                                 <Copy className="h-4 w-4" />
                               </Button>
                               <Link to={`/reports/${analysis.id}`}>
                                 <Button 
                                   variant="ghost" 
                                   size="icon"
                                   className="h-8 w-8"
                                   title="View report"
                                 >
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               </Link>
                             </div>
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
