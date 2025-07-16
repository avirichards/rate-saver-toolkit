import React from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Download, Edit, DollarSign, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InlineEditableField } from '@/components/ui-lov/InlineEditableField';
import { ClientCombobox } from '@/components/ui-lov/ClientCombobox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  onReportUpdate?: () => void;
}

export function ReportsTable({ reports, getMarkupStatus, onReportUpdate }: ReportsTableProps) {
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
                        title="Edit report"
                      >
                        <Edit className="h-4 w-4" />
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