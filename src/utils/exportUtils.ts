import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

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
  processed_shipments?: any;
}

// Generate Excel workbook from report data with markup applied
export const generateReportExcel = (report: ExportableReportData): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  
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
  
  // Create Analyzed Shipments worksheet
  const analysisData = [];
  
  // Header information
  analysisData.push(['Shipping Analysis Report']);
  analysisData.push(['Report Name:', report.report_name || report.file_name]);
  if (report.client_name) {
    analysisData.push(['Client:', report.client_name]);
  }
  analysisData.push(['Analysis Date:', new Date(report.analysis_date).toLocaleDateString()]);
  analysisData.push(['Total Shipments:', report.total_shipments]);
  analysisData.push(['Total Savings:', `$${(report.total_savings || 0).toFixed(2)}`]);
  analysisData.push([]);
  
  // Column headers
  analysisData.push([
    'Tracking ID', 'Origin ZIP', 'Destination ZIP', 'Weight', 
    'Current Service', 'Current Cost', 'Recommended Service', 
    'Ship Pros Cost', 'Savings', 'Savings %', 'Margin', 'Margin %'
  ]);
  
  // Get shipment data from recommendations
  const shipments = report.recommendations || [];
  
  // Shipment data
  if (Array.isArray(shipments) && shipments.length > 0) {
    shipments.forEach((shipment: any) => {
      const currentCost = shipment.currentRate || shipment.current_rate || 0;
      const markupInfo = getShipmentMarkup(shipment);
      const savings = currentCost - markupInfo.markedUpPrice;
      const savingsPercent = currentCost > 0 ? (savings / currentCost) * 100 : 0;
      
      analysisData.push([
        shipment.trackingId || shipment.tracking_id || '',
        shipment.originZip || shipment.origin_zip || '',
        shipment.destZip || shipment.dest_zip || '',
        shipment.weight || '',
        shipment.currentService || shipment.current_service || '',
        currentCost,
        shipment.service || shipment.recommended_service || '',
        markupInfo.markedUpPrice,
        savings,
        savingsPercent / 100, // Excel percentage format
        markupInfo.margin,
        markupInfo.marginPercent / 100 // Excel percentage format
      ]);
    });
  } else {
    // If no shipment data, add a row indicating no data
    analysisData.push(['No shipment data available', '', '', '', '', '', '', '', '', '', '', '']);
  }
  
  const analysisWorksheet = XLSX.utils.aoa_to_sheet(analysisData);
  
  // Format currency and percentage columns
  const range = XLSX.utils.decode_range(analysisWorksheet['!ref'] || 'A1');
  for (let row = 8; row <= range.e.r; row++) { // Start from data rows (after headers)
      // Current Cost (column F)
      const currentCostCell = XLSX.utils.encode_cell({ r: row, c: 5 });
      if (analysisWorksheet[currentCostCell]) {
        analysisWorksheet[currentCostCell].z = '"$"#,##0.00';
      }
      
      // Ship Pros Cost (column H)
      const shipProsCostCell = XLSX.utils.encode_cell({ r: row, c: 7 });
      if (analysisWorksheet[shipProsCostCell]) {
        analysisWorksheet[shipProsCostCell].z = '"$"#,##0.00';
      }
      
      // Savings (column I)
      const savingsCell = XLSX.utils.encode_cell({ r: row, c: 8 });
      if (analysisWorksheet[savingsCell]) {
        analysisWorksheet[savingsCell].z = '"$"#,##0.00';
      }
      
      // Savings % (column J)
      const savingsPercentCell = XLSX.utils.encode_cell({ r: row, c: 9 });
      if (analysisWorksheet[savingsPercentCell]) {
        analysisWorksheet[savingsPercentCell].z = '0.00%';
      }
      
      // Margin (column K)
      const marginCell = XLSX.utils.encode_cell({ r: row, c: 10 });
      if (analysisWorksheet[marginCell]) {
        analysisWorksheet[marginCell].z = '"$"#,##0.00';
      }
      
      // Margin % (column L)
      const marginPercentCell = XLSX.utils.encode_cell({ r: row, c: 11 });
      if (analysisWorksheet[marginPercentCell]) {
        analysisWorksheet[marginPercentCell].z = '0.00%';
      }
  }
  
  XLSX.utils.book_append_sheet(workbook, analysisWorksheet, 'Analyzed Shipments');
  
  // Create Orphaned Shipments worksheet
  if (report.orphaned_shipments && Array.isArray(report.orphaned_shipments) && report.orphaned_shipments.length > 0) {
    const orphanedData = [];
    
    // Header information
    orphanedData.push(['Orphaned Shipments (Unable to Quote)']);
    orphanedData.push(['Report Name:', report.report_name || report.file_name]);
    if (report.client_name) {
      orphanedData.push(['Client:', report.client_name]);
    }
    orphanedData.push(['Analysis Date:', new Date(report.analysis_date).toLocaleDateString()]);
    orphanedData.push([]);
    
    // Column headers
    orphanedData.push([
      'Tracking ID', 'Origin ZIP', 'Destination ZIP', 'Weight', 
      'Current Service', 'Current Cost', 'Reason'
    ]);
    
    // Orphaned shipment data
    report.orphaned_shipments.forEach((shipment: any) => {
      orphanedData.push([
        shipment.trackingId || '',
        shipment.originZip || '',
        shipment.destZip || '',
        shipment.weight || '',
        shipment.currentService || '',
        shipment.currentRate || 0,
        shipment.reason || 'Unable to quote'
      ]);
    });
    
    const orphanedWorksheet = XLSX.utils.aoa_to_sheet(orphanedData);
    
    // Format currency column
    const range = XLSX.utils.decode_range(orphanedWorksheet['!ref'] || 'A1');
    for (let row = 5; row <= range.e.r; row++) { // Start from data rows (after headers)
      // Current Cost (column F)
      const currentCostCell = XLSX.utils.encode_cell({ r: row, c: 5 });
      if (orphanedWorksheet[currentCostCell]) {
        orphanedWorksheet[currentCostCell].z = '"$"#,##0.00';
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, orphanedWorksheet, 'Orphaned Shipments');
  }
  
  return workbook;
};

// Download report as Excel
export const downloadReportExcel = async (reportId: string): Promise<void> => {
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

    // Generate Excel workbook
    const workbook = generateReportExcel(exportData);
    
    // Write workbook to buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    
    // Create and trigger download
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${report.report_name || report.file_name}_${new Date().toISOString().split('T')[0]}.xlsx`);
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

// Legacy CSV function for backward compatibility
export const downloadReportCSV = downloadReportExcel;

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