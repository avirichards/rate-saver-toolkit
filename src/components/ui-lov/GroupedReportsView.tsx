import React from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Users, Download, Eye, DollarSign, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';

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
                    ${summary.totalSavings.toFixed(2)}
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
                        <th className="text-left py-2 px-4">Status</th>
                        <th className="text-right py-2 px-4">Success Rate</th>
                        <th className="text-right py-2 px-4">Savings</th>
                        <th className="text-right py-2 px-4">Savings %</th>
                        <th className="text-right py-2 px-4">Margin</th>
                        <th className="text-right py-2 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => {
                        const markupStatus = getMarkupStatus(report.markup_data);
                        
                        // Helper functions matching ReportsTable
                        const getSuccessRateData = (report: ShippingAnalysis) => {
                          if (report.savings_analysis) {
                            const completed = report.savings_analysis.completedShipments || 0;
                            const total = report.savings_analysis.totalShipments || report.total_shipments || 0;
                            return { completed, total };
                          }
                          return { completed: report.total_shipments || 0, total: report.total_shipments || 0 };
                        };

                        const getSavingsPercentage = (report: ShippingAnalysis) => {
                          if (report.savings_analysis && report.savings_analysis.savingsPercentage) {
                            return report.savings_analysis.savingsPercentage;
                          }
                          if (report.savings_analysis && report.savings_analysis.totalCurrentCost) {
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
                            <td className="py-2 px-4 text-right font-medium">
                              {report.total_savings ? `$${report.total_savings.toFixed(2)}` : '-'}
                            </td>
                            <td className="py-2 px-4 text-right">
                              {savingsPercentage > 0 ? `${savingsPercentage.toFixed(1)}%` : '-'}
                            </td>
                            <td className="py-2 px-4 text-right">
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