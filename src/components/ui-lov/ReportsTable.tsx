import React, { useState } from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Edit, DollarSign, Percent, Trash2, Clipboard, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { ClientCombobox } from '@/components/ui-lov/ClientCombobox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getOrCreateReportShare, copyShareUrl, getShareUrl } from '@/utils/shareUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

interface ReportsTableProps {
  reports: ShippingAnalysis[];
  getMarkupStatus: (markupData: any) => {
    hasMarkup: boolean;
    totalMargin: number;
    marginPercentage: number;
    savingsAmount: number;
    savingsPercentage: number;
  };
  onReportUpdate?: () => void;
}

export function ReportsTable({ reports, getMarkupStatus, onReportUpdate }: ReportsTableProps) {
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [sharingReports, setSharingReports] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReports(new Set(reports.map(r => r.id)));
    } else {
      setSelectedReports(new Set());
    }
  };

  const handleSelectReport = (reportId: string, checked: boolean) => {
    const newSelected = new Set(selectedReports);
    if (checked) {
      newSelected.add(reportId);
    } else {
      newSelected.delete(reportId);
    }
    setSelectedReports(newSelected);
  };

  const deleteSelectedReports = async () => {
    try {
      const { error } = await supabase
        .from('shipping_analyses')
        .update({ 
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedReports));

      if (error) throw error;
      
      toast.success(`${selectedReports.size} report(s) deleted`);
      setSelectedReports(new Set());
      onReportUpdate?.();
    } catch (error) {
      console.error('Error deleting reports:', error);
      toast.error('Failed to delete reports');
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('shipping_analyses')
        .update({ 
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;
      
      toast.success('Report deleted');
      onReportUpdate?.();
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  const handleShareReport = async (reportId: string) => {
    try {
      setSharingReports(prev => new Set(prev).add(reportId));
      
      const shareData = await getOrCreateReportShare(reportId);
      if (!shareData) {
        throw new Error('Failed to create share link');
      }

      const success = await copyShareUrl(shareData.shareToken);
      if (success) {
        toast.success('Share link copied to clipboard!');
      } else {
        toast.error('Failed to copy link to clipboard');
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      toast.error('Failed to create share link');
    } finally {
      setSharingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  };

  const handlePreviewReport = async (reportId: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    
    try {
      console.log('🔍 Creating share for report:', reportId);
      const shareData = await getOrCreateReportShare(reportId);
      console.log('📊 Share data received:', shareData);
      
      if (!shareData) {
        throw new Error('Failed to create share link');
      }

      const shareUrl = getShareUrl(shareData.shareToken);
      console.log('🔗 Generated share URL:', shareUrl);
      window.open(shareUrl, '_blank');
    } catch (error) {
      console.error('❌ Error opening preview:', error);
      toast.error('Failed to open preview: ' + (error as Error).message);
    }
  };

  // Helper function to get success rate data - shows processed vs. original total
  const getSuccessRateData = (report: ShippingAnalysis) => {
    console.log('📊 SUCCESS RATE DEBUG for report:', report.id, {
      savingsAnalysis: report.savings_analysis,
      totalShipments: report.total_shipments
    });
    
    if (report.savings_analysis?.completedShipments !== undefined) {
      // Use completed vs. total from original CSV (not just valid ones)
      const completed = report.savings_analysis.completedShipments || 0;
      const total = report.total_shipments || 0; // This is the original CSV total
      return { completed, total };
    }
    // Fallback - if no savings_analysis, assume all shipments were successful
    return { completed: report.total_shipments || 0, total: report.total_shipments || 0 };
  };

  // Helper function to get savings percentage - use Results page calculation logic
  const getSavingsPercentage = (report: ShippingAnalysis) => {
    console.log('📊 SAVINGS PERCENTAGE DEBUG for report:', report.id, {
      totalSavings: report.total_savings,
      savingsAnalysis: report.savings_analysis,
      totalShipments: report.total_shipments
    });
    
    // PRIORITY 1: Use the savings percentage from savings_analysis (calculated in Results page)
    if (report.savings_analysis?.savingsPercentage !== undefined) {
      return report.savings_analysis.savingsPercentage;
    }
    
    // PRIORITY 2: Calculate using savings_analysis data (same as Results page logic)
    if (report.savings_analysis?.totalCurrentCost && report.savings_analysis?.totalSavings !== undefined) {
      const totalCost = report.savings_analysis.totalCurrentCost;
      const savings = report.savings_analysis.totalSavings; // Use savings from analysis, not database total_savings
      return totalCost > 0 ? (savings / totalCost) * 100 : 0;
    }
    
    // FALLBACK: Calculate from database total_savings and cost data
    if (report.savings_analysis?.totalCurrentCost) {
      const totalCost = report.savings_analysis.totalCurrentCost;
      const savings = report.total_savings || 0;
      return totalCost > 0 ? (savings / totalCost) * 100 : 0;
    }
    
    // Last resort fallback
    return 0;
  };

  const isAllSelected = selectedReports.size === reports.length && reports.length > 0;
  const isSomeSelected = selectedReports.size > 0 && selectedReports.size < reports.length;

  return (
    <div className="space-y-4">
      {selectedReports.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">
            {selectedReports.size} report(s) selected
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" size="sm" iconLeft={<Trash2 className="h-4 w-4" />} className="text-destructive hover:text-destructive">
                Delete Selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Reports</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedReports.size} report(s)? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteSelectedReports} className="bg-red-600 text-white hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-2 w-10">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th className="text-left py-3 px-2">Report Name</th>
              <th className="text-left py-3 px-2">Client</th>
              <th className="text-left py-3 px-2">Date</th>
              <th className="text-left py-3 px-2">Status</th>
              <th className="text-right py-3 px-2">Success Rate</th>
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
            {reports.map((report) => {
              const markupStatus = getMarkupStatus(report.markup_data);
              const isSelected = selectedReports.has(report.id);
              return (
                <tr key={report.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectReport(report.id, !!checked)}
                    />
                  </td>
                  <td className="py-3 px-2 font-medium">
                    <InlineEditableField
                      value={report.report_name || report.file_name}
                      onSave={async (value) => {
                        const { error } = await supabase
                          .from('shipping_analyses')
                          .update({ 
                            report_name: value,
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', report.id);
                        
                        if (error) throw error;
                        toast.success('Report name updated');
                        onReportUpdate?.();
                      }}
                      placeholder="Click to edit name"
                      required
                    />
                  </td>
                  <td className="py-3 px-2">
                    <div className="min-w-[150px]">
                      <ClientCombobox
                        value={report.client_id || ''}
                        onValueChange={async (clientId) => {
                          const { error } = await supabase
                            .from('shipping_analyses')
                            .update({ 
                              client_id: clientId || null,
                              updated_at: new Date().toISOString()
                            })
                            .eq('id', report.id);
                          
                          if (error) throw error;
                          toast.success('Client updated');
                          onReportUpdate?.();
                        }}
                        placeholder="No client"
                      />
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    {new Date(report.analysis_date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                        {report.status}
                      </Badge>
                      {markupStatus.hasMarkup && (
                        <Badge variant="outline">With Markup</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    {(() => {
                      const { completed, total } = getSuccessRateData(report);
                      return `${completed}/${total}`;
                    })()}
                  </td>
                   <td className="py-3 px-2 text-right">
                     {(() => {
                       // Check if report has markup data with calculated savings
                       const markupStatus = getMarkupStatus(report.markup_data);
                       if (markupStatus.hasMarkup && report.markup_data?.savingsAmount && report.markup_data?.savingsPercentage) {
                         return (
                           <div className="text-right">
                             <div className="font-medium">${report.markup_data.savingsAmount.toFixed(2)}</div>
                             <div className="text-xs text-muted-foreground">{report.markup_data.savingsPercentage.toFixed(1)}%</div>
                           </div>
                         );
                       }
                       
                       // Fallback to savings_analysis or total_savings
                       const savingsAmount = report.savings_analysis?.totalSavings ?? report.total_savings ?? 0;
                       const savingsPercentage = report.savings_analysis?.savingsPercentage ?? 0;
                       
                       return (
                         <div className="text-right">
                           <div className="font-medium">${savingsAmount.toFixed(2)}</div>
                           <div className="text-xs text-muted-foreground">{savingsPercentage.toFixed(1)}%</div>
                         </div>
                       );
                     })()}
                   </td>
                  <td className="py-3 px-2 text-right">
                    {markupStatus.hasMarkup ? (
                      <div className="text-right">
                        <div className="font-medium">
                          ${markupStatus.totalMargin.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {markupStatus.marginPercentage.toFixed(1)}%
                        </div>
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
                       <Button 
                         variant="ghost" 
                         size="icon"
                         className="h-8 w-8"
                         onClick={() => handleShareReport(report.id)}
                         disabled={sharingReports.has(report.id)}
                         title="Copy client link"
                       >
                         {sharingReports.has(report.id) ? (
                           <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            <Clipboard className="h-4 w-4" />
                          )}
                       </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handlePreviewReport(report.id, e)}
                          title="Preview client version"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          title="Edit report"
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.href = `/results?analysisId=${report.id}`;
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete report"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Report</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{report.report_name || report.file_name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteReport(report.id)} className="bg-red-600 text-white hover:bg-red-700">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}