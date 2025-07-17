import { supabase } from '@/integrations/supabase/client';

export interface ExportableReportData {
  id: string;
  report_name: string | null;
  file_name: string;
  client_name?: string;
  analysis_date: string;
  total_shipments: number;
  total_savings: number | null;
  markup_data: any;
  savings_analysis: any;
  original_data: any;
  recommendations: any;
  orphaned_shipments: any;
}

// Generate CSV content from report data with markup applied
export const generateReportCSV = (report: ExportableReportData): string => {
  const rows: string[] = [];
  
  // Header information
  rows.push('Shipping Analysis Report');
  rows.push(`Report Name:,${report.report_name || report.file_name}`);
  if (report.client_name) {
    rows.push(`Client:,${report.client_name}`);
  }
  rows.push(`Analysis Date:,${new Date(report.analysis_date).toLocaleDateString()}`);
  rows.push(`Total Shipments:,${report.total_shipments}`);
  rows.push(`Total Savings:,$${(report.total_savings || 0).toFixed(2)}`);
  rows.push(''); // Empty row
  
  // Helper function to calculate markup
  const getShipmentMarkup = (shipment: any) => {
    const markupData = report.markup_data as any;
    if (!markupData) return { markedUpPrice: shipment.newRate, margin: 0, marginPercent: 0 };
    
    const shipProsCost = shipment.newRate || 0;
    let markupPercent = 0;
    
    if (markupData.markupType === 'global') {
      markupPercent = markupData.globalMarkup;
    } else {
      markupPercent = markupData.perServiceMarkup?.[shipment.service] || 0;
    }
    
    const markedUpPrice = shipProsCost * (1 + markupPercent / 100);
    const margin = markedUpPrice - shipProsCost;
    const marginPercent = shipProsCost > 0 ? (margin / shipProsCost) * 100 : 0;
    
    return { markedUpPrice, margin, marginPercent };
  };
  
  // Detailed shipment data if available
  if (report.recommendations && Array.isArray(report.recommendations)) {
    rows.push('ANALYZED SHIPMENTS');
    rows.push('Tracking ID,Origin ZIP,Destination ZIP,Weight,Current Service,Current Cost,Recommended Service,Ship Pros Cost,Savings,Savings %,Margin,Margin %');
    
    report.recommendations.forEach((shipment: any) => {
      const currentCost = shipment.currentRate || 0;
      const markupInfo = getShipmentMarkup(shipment);
      const savings = currentCost - markupInfo.markedUpPrice;
      const savingsPercent = currentCost > 0 ? (savings / currentCost) * 100 : 0;
      
      rows.push([
        shipment.trackingId || '',
        shipment.originZip || '',
        shipment.destZip || '',
        shipment.weight || '',
        shipment.currentService || '',
        `$${currentCost.toFixed(2)}`,
        shipment.service || '',
        `$${markupInfo.markedUpPrice.toFixed(2)}`,
        `$${savings.toFixed(2)}`,
        `${savingsPercent.toFixed(2)}%`,
        `$${markupInfo.margin.toFixed(2)}`,
        `${markupInfo.marginPercent.toFixed(2)}%`
      ].join(','));
    });
  }
  
  // Add orphaned shipments section
  if (report.orphaned_shipments && Array.isArray(report.orphaned_shipments) && report.orphaned_shipments.length > 0) {
    rows.push(''); // Empty row
    rows.push('ORPHANED SHIPMENTS (Unable to Quote)');
    rows.push('Tracking ID,Origin ZIP,Destination ZIP,Weight,Current Service,Current Cost,Reason');
    
    report.orphaned_shipments.forEach((shipment: any) => {
      rows.push([
        shipment.trackingId || '',
        shipment.originZip || '',
        shipment.destZip || '',
        shipment.weight || '',
        shipment.currentService || '',
        `$${(shipment.currentRate || 0).toFixed(2)}`,
        shipment.reason || 'Unable to quote'
      ].join(','));
    });
  }
  
  return rows.join('\n');
};

// Download report as CSV
export const downloadReportCSV = async (reportId: string): Promise<void> => {
  try {
    // Fetch full report data
    const { data: report, error } = await supabase
      .from('shipping_analyses')
      .select(`
        id,
        report_name,
        file_name,
        analysis_date,
        total_shipments,
        total_savings,
        markup_data,
        savings_analysis,
        original_data,
        recommendations,
        orphaned_shipments,
        client_id,
        clients (company_name)
      `)
      .eq('id', reportId)
      .single();

    if (error) throw error;
    
    if (!report) {
      throw new Error('Report not found');
    }

    // Prepare export data
    const exportData: ExportableReportData = {
      ...report,
      client_name: (report.clients as any)?.company_name || undefined
    };

    // Generate CSV content
    const csvContent = generateReportCSV(exportData);
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${report.report_name || report.file_name}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error downloading report:', error);
    throw error;
  }
};

// Generate summary PDF data (for future PDF export functionality)
export const generateReportSummary = (report: ExportableReportData) => {
  const markupData = report.markup_data || {};
  const savingsData = report.savings_analysis || {};
  
  return {
    reportName: report.report_name || report.file_name,
    clientName: report.client_name,
    analysisDate: new Date(report.analysis_date).toLocaleDateString(),
    totalShipments: report.total_shipments,
    totalSavings: report.total_savings || 0,
    hasMarkup: markupData.totalMargin > 0,
    totalMargin: markupData.totalMargin || 0,
    marginPercentage: markupData.marginPercentage || 0,
    completedShipments: savingsData.completedShipments || 0,
    failedShipments: (report.total_shipments || 0) - (savingsData.completedShipments || 0)
  };
};