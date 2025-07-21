import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { generateExportData, processAnalysisData } from '@/utils/dataProcessing';

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

// Generate Excel workbook from processed shipment data (same as Results page)
export const generateReportExcelFromProcessedData = (
  report: ExportableReportData, 
  processedShipments: any[], 
  orphanedShipments: any[], 
  getShipmentMarkup: (shipment: any) => any
): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  
  // Create Analyzed Shipments worksheet using the same data structure as Results page
  const analysisData = [];
  
  // Header information
  analysisData.push(['Shipping Analysis Report']);
  analysisData.push(['Report Name:', report.report_name || report.file_name]);
  if (report.client_name) {
    analysisData.push(['Client:', report.client_name]);
  }
  analysisData.push(['Analysis Date:', new Date(report.analysis_date).toLocaleDateString()]);
  analysisData.push(['Total Shipments:', report.total_shipments]);
  
  // Calculate marked up total savings for overview
  const markupData = report.markup_data || {};
  const totalSavings = report.total_savings || 0;
  const markupAdjustment = markupData.totalMargin || 0;
  const adjustedSavings = totalSavings - markupAdjustment;
  
  analysisData.push(['Total Savings (with markup):', `$${adjustedSavings.toFixed(2)}`]);
  analysisData.push([]);
  
  // Use the same export data generation as Results page
  if (processedShipments && processedShipments.length > 0) {
    const exportDataFromResults = generateExportData(processedShipments, getShipmentMarkup);
    
    // Column headers (from the generateExportData function)
    analysisData.push([
      'Tracking ID', 'Origin ZIP', 'Destination ZIP', 'Weight', 'Dimensions',
      'Current Service', 'Ship Pros Service', 'Current Rate', 'Ship Pros Cost', 
      'Savings', 'Savings Percentage'
    ]);
    
    // Shipment data
    exportDataFromResults.forEach((row: any) => {
      analysisData.push([
        row['Tracking ID'],
        row['Origin ZIP'],
        row['Destination ZIP'],
        row['Weight'],
        row['Dimensions'],
        row['Current Service'],
        row['Ship Pros Service'],
        row['Current Rate'],
        row['Ship Pros Cost'],
        row['Savings'],
        row['Savings Percentage']
      ]);
    });
  } else {
    analysisData.push(['No analyzed shipment data available', '', '', '', '', '', '', '', '', '']);
  }
  
  const analysisWorksheet = XLSX.utils.aoa_to_sheet(analysisData);
  XLSX.utils.book_append_sheet(workbook, analysisWorksheet, 'Analyzed Shipments');
  
  // Create Orphaned Shipments worksheet
  if (orphanedShipments && Array.isArray(orphanedShipments) && orphanedShipments.length > 0) {
    const orphanedData = [];
    
    // Header information
    orphanedData.push(['Orphaned Shipments (Unable to Quote)']);
    orphanedData.push(['Report Name:', report.report_name || report.file_name]);
    if (report.client_name) {
      orphanedData.push(['Client:', report.client_name]);
    }
    orphanedData.push(['Analysis Date:', new Date(report.analysis_date).toLocaleDateString()]);
    orphanedData.push([]);
    
    // Column headers - spread original data fields
    orphanedData.push([
      'Tracking ID', 'Origin ZIP', 'Destination ZIP', 'Weight', 'Length', 'Width', 'Height',
      'Current Service', 'Current Cost', 'Reason'
    ]);
    
    // Orphaned shipment data spread across individual columns
    orphanedShipments.forEach((shipment: any) => {
      // Try multiple ways to access the original data
      let data = shipment;
      
      // Check for nested shipment data first (most common case)
      if (shipment.shipment && typeof shipment.shipment === 'object') {
        data = shipment.shipment;
      }
      // If originalData exists as a nested object, use it
      else if (shipment.originalData && typeof shipment.originalData === 'object') {
        data = shipment.originalData;
      }
      // Handle case where originalData might be a JSON string
      else if (typeof shipment.originalData === 'string') {
        try {
          data = JSON.parse(shipment.originalData);
        } catch (e) {
          data = shipment;
        }
      }
      
      orphanedData.push([
        data.trackingId || data.tracking_id || shipment.trackingId || '',
        data.originZip || data.origin_zip || shipment.originZip || '',
        data.destZip || data.dest_zip || shipment.destZip || '',
        data.weight || shipment.weight || '',
        data.length || shipment.length || '',
        data.width || shipment.width || '',
        data.height || shipment.height || '',
        data.service || data.currentService || shipment.currentService || shipment.service || '',
        data.cost || data.currentRate || shipment.currentRate || shipment.cost || 0,
        shipment.reason || data.reason || 'Unable to quote'
      ]);
    });
    
    const orphanedWorksheet = XLSX.utils.aoa_to_sheet(orphanedData);
    XLSX.utils.book_append_sheet(workbook, orphanedWorksheet, 'Orphaned Shipments');
  }
  
  return workbook;
};

// Simple Excel export function for basic data
export const exportToExcel = (processedData: any[], orphanedData: any[], fileName: string) => {
  const workbook = XLSX.utils.book_new();
  
  // Create processed shipments sheet
  if (processedData && processedData.length > 0) {
    const processedSheet = XLSX.utils.json_to_sheet(processedData);
    XLSX.utils.book_append_sheet(workbook, processedSheet, 'Processed Shipments');
  }
  
  // Create orphaned shipments sheet
  if (orphanedData && orphanedData.length > 0) {
    const orphanedSheet = XLSX.utils.json_to_sheet(orphanedData);
    XLSX.utils.book_append_sheet(workbook, orphanedSheet, 'Orphaned Shipments');
  }
  
  // Write and download
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
  });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Generate Excel workbook from report data with markup applied (legacy function for compatibility)

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
        processed_shipments,
        orphaned_shipments,
        client_id,
        clients (company_name)
      `)
      .eq('id', reportId)
      .maybeSingle();

    if (error) throw error;
    
    if (!report) {
      throw new Error('Report not found');
    }

    // Process the analysis data using the same function as Results page
    const analysisData = processAnalysisData(report);
    
    // Create markup function
    const getShipmentMarkup = (shipment: any) => {
      const markupData = report.markup_data as any;
      if (!markupData) return { markedUpPrice: shipment.newRate || 0, margin: 0, marginPercent: 0 };
      
      const shipProsCost = shipment.newRate || 0;
      let markupPercent = 0;
      
      if (markupData.markupType === 'global') {
        markupPercent = markupData.globalMarkup || 0;
      } else if (markupData.markupType === 'per_service') {
        markupPercent = markupData.perServiceMarkup?.[shipment.service] || 0;
      }
      
      const markedUpPrice = shipProsCost * (1 + markupPercent / 100);
      const margin = markedUpPrice - shipProsCost;
      const marginPercent = shipProsCost > 0 ? (margin / shipProsCost) * 100 : 0;
      
      return { markedUpPrice, margin, marginPercent };
    };

    // Prepare export data using the same function as Results page
    const exportData: ExportableReportData = {
      ...report,
      client_name: (report.clients as any)?.company_name || undefined
    };

    // Generate Excel workbook using processed data
    const orphanedData = Array.isArray(report.orphaned_shipments) ? report.orphaned_shipments : [];
    const workbook = generateReportExcelFromProcessedData(exportData, analysisData.recommendations, orphanedData, getShipmentMarkup);
    
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
