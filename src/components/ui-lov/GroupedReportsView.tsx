import React from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Users, Download, Eye, DollarSign, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';

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

interface GroupedReportsViewProps {
  groupedReports: { [key: string]: ShippingAnalysis[] };
  expandedClients: Set<string>;
  toggleClientExpansion: (clientName: string) => void;
  getMarkupStatus: (markupData: any) => {
    hasMarkup: boolean;
    totalMargin: number;
    marginPercentage: number;
    savingsAmount: number;
    savingsPercentage: number;
  };
}

export function GroupedReportsView({ 
  groupedReports, 
  expandedClients, 
  toggleClientExpansion, 
  getMarkupStatus 
}: GroupedReportsViewProps) {
  const getClientSummary = (reports: ShippingAnalysis[]) => {
    const totalReports = reports.length;
    const totalSavings = reports.reduce((sum, report) => sum + (report.total_savings || 0), 0);
    const totalShipments = reports.reduce((sum, report) => sum + report.total_shipments, 0);
    const reportsWithMarkup = reports.filter(report => getMarkupStatus(report.markup_data).hasMarkup).length;
    
    return { totalReports, totalSavings, totalShipments, reportsWithMarkup };
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedReports).map(([clientName, reports]) => {
        const isExpanded = expandedClients.has(clientName);
        const summary = getClientSummary(reports);
        
        return (
          <div key={clientName} className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
              onClick={() => toggleClientExpansion(clientName)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">{clientName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {summary.totalReports} reports • {summary.totalShipments} shipments
                    {summary.reportsWithMarkup > 0 && ` • ${summary.reportsWithMarkup} with markup`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="font-medium">
                    {formatCurrency(summary.totalSavings)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Savings</div>
                </div>
                {summary.reportsWithMarkup > 0 && (
                  <Badge variant="outline">
                    {summary.reportsWithMarkup} with markup
                  </Badge>
                )}
              </div>
            </div>
            
            {isExpanded && (
              <div className="border-t bg-background/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2 px-4">Report Name</th>
                         <th className="text-left py-2 px-4">Date</th>
                         <th className="text-left py-2 px-4">Time</th>
                         <th className="text-left py-2 px-4">Status</th>
                        <th className="text-right py-2 px-4">Success Rate</th>
                        <th className="text-right py-2 px-4">Savings</th>
                        <th className="text-right py-2 px-4">Margin</th>
                        <th className="text-right py-2 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => {
                        const markupStatus = getMarkupStatus(report.markup_data);
                        
                         // Calculate success rate: processed vs total (processed + orphaned)
                         const getSuccessRateData = (report: ShippingAnalysis) => {
                           const processedCount = (report as any).processed_shipments?.length || 0;
                           const orphanedCount = (report as any).orphaned_shipments?.length || 0;
                           const totalUploaded = processedCount + orphanedCount || report.total_shipments || 0;
                           return { completed: processedCount, total: totalUploaded };
                         };

                        const getSavingsPercentage = (report: ShippingAnalysis) => {
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
                          
                          return 0;
                        };

                        const { completed, total } = getSuccessRateData(report);
                        const savingsPercentage = getSavingsPercentage(report);
                        
                        return (
                          <tr key={report.id} className="border-b hover:bg-muted/30">
                            <td className="py-2 px-4 font-medium">
                              {report.report_name || report.file_name}
                            </td>
                             <td className="py-2 px-4">
                               {new Date(report.analysis_date).toLocaleDateString()}
                             </td>
                             <td className="py-2 px-4">
                               {new Date(report.analysis_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </td>
                             <td className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                                  {report.status}
                                </Badge>
                                {markupStatus.hasMarkup && (
                                  <Badge variant="outline">Markup</Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-right">{`${completed}/${total}`}</td>
                                <td className="py-2 px-4 text-right">
                                  {(() => {
                                    // Use savings_analysis data if available (same as Results page)
                                    const savingsAmount = report.savings_analysis?.totalSavings ?? report.total_savings ?? 0;
                                    const savingsPercentage = report.savings_analysis?.savingsPercentage ?? 0;
                                    
                                    return (
                                      <div className="text-right">
                                        <div className="font-medium">{formatCurrency(savingsAmount)}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {savingsPercentage.toFixed(1)}%
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </td>
                            <td className="py-2 px-4 text-right">
                              {markupStatus.hasMarkup ? (
                                <div className="text-right">
                                  <div className="font-medium">
                                    {formatCurrency(markupStatus.totalMargin)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {markupStatus.marginPercentage.toFixed(1)}%
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-2 px-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    console.log('Export report:', report.id);
                                  }}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                                <Link to={`/results?analysisId=${report.id}`}>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-7 w-7"
                                  >
                                    <Eye className="h-3 w-3" />
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}