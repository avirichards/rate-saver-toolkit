import React from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, DollarSign, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  };
}

export function ReportsTable({ reports, getMarkupStatus }: ReportsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-2">Report Name</th>
            <th className="text-left py-3 px-2">Client</th>
            <th className="text-left py-3 px-2">Date</th>
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
          {reports.map((report) => {
            const markupStatus = getMarkupStatus(report.markup_data);
            return (
              <tr key={report.id} className="border-b hover:bg-muted/50">
                <td className="py-3 px-2 font-medium">
                  {report.report_name || report.file_name}
                </td>
                <td className="py-3 px-2">
                  {report.client?.company_name ? (
                    <Badge variant="outline">{report.client.company_name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">No client</span>
                  )}
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
                <td className="py-3 px-2 text-right">{report.total_shipments}</td>
                <td className="py-3 px-2 text-right font-medium">
                  {report.total_savings ? `$${report.total_savings.toFixed(2)}` : '-'}
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
  );
}