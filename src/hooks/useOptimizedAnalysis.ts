import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisSummary {
  id: string;
  file_name: string;
  total_shipments: number;
  total_savings: number | null;
  created_at: string;
  status: string;
  report_name: string | null;
  processing_metadata?: any;
}

interface AnalysisDetails {
  id: string;
  processed_shipments: any[];
  orphaned_shipments: any[];
  original_data: any[];
  recommendations: any[];
  savings_analysis: any;
  markup_data: any;
  carrier_configs_used: string[];
  service_mappings: any[];
}

interface UseOptimizedAnalysisProps {
  analysisId?: string;
  pageSize?: number;
}

export function useOptimizedAnalysis({ 
  analysisId, 
  pageSize = 1000 
}: UseOptimizedAnalysisProps = {}) {
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [hasLoadedDetails, setHasLoadedDetails] = useState(false);

  // Load analysis summary (lightweight)
  const loadSummary = useCallback(async (id: string) => {
    setLoading(true);
    try {
      console.log('📊 Loading analysis summary for:', id);
      
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select(`
          id,
          file_name,
          total_shipments,
          total_savings,
          created_at,
          status,
          report_name,
          processing_metadata
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setSummary(data);
      
      // Calculate pagination
      const totalShipments = data.total_shipments || 0;
      const pages = Math.ceil(totalShipments / pageSize);
      setTotalPages(pages);
      
      console.log(`✅ Loaded summary: ${totalShipments} shipments, ${pages} pages`);
      
    } catch (error) {
      console.error('Error loading analysis summary:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  // Load specific page of shipment details
  const loadShipmentPage = useCallback(async (id: string, page: number) => {
    if (!summary) return;
    
    setLoading(true);
    try {
      console.log(`📊 Loading shipment page ${page + 1}/${totalPages} for analysis:`, id);
      
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('processed_shipments')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const allShipments = Array.isArray(data.processed_shipments) ? data.processed_shipments : [];
      const startIndex = page * pageSize;
      const endIndex = Math.min(startIndex + pageSize, allShipments.length);
      const pageShipments = allShipments.slice(startIndex, endIndex);
      
      setShipments(pageShipments);
      setCurrentPage(page);
      
      console.log(`✅ Loaded page ${page + 1}: ${pageShipments.length} shipments`);
      
    } catch (error) {
      console.error('Error loading shipment page:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [summary, pageSize, totalPages]);

  // Load full analysis details (heavy operation)
  const loadFullDetails = useCallback(async (id: string) => {
    if (hasLoadedDetails) return;
    
    setDetailsLoading(true);
    try {
      console.log('📊 Loading full analysis details for:', id);
      
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select(`
          id,
          processed_shipments,
          orphaned_shipments,
          original_data,
          recommendations,
          savings_analysis,
          markup_data,
          carrier_configs_used,
          service_mappings
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Load first page of shipments
      const allShipments = Array.isArray(data.processed_shipments) ? data.processed_shipments : [];
      const firstPageShipments = allShipments.slice(0, pageSize);
      setShipments(firstPageShipments);
      
      setHasLoadedDetails(true);
      console.log(`✅ Loaded full details: ${allShipments.length} total shipments`);
      
      return data;
      
    } catch (error) {
      console.error('Error loading full analysis details:', error);
      throw error;
    } finally {
      setDetailsLoading(false);
    }
  }, [hasLoadedDetails, pageSize]);

  // Navigate to specific page
  const goToPage = useCallback(async (page: number) => {
    if (!analysisId || page < 0 || page >= totalPages) return;
    await loadShipmentPage(analysisId, page);
  }, [analysisId, totalPages, loadShipmentPage]);

  // Navigation helpers
  const nextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const firstPage = useCallback(() => {
    goToPage(0);
  }, [goToPage]);

  const lastPage = useCallback(() => {
    goToPage(totalPages - 1);
  }, [totalPages, goToPage]);

  // Auto-load summary when analysisId changes
  useEffect(() => {
    if (analysisId) {
      loadSummary(analysisId);
    }
  }, [analysisId, loadSummary]);

  return {
    // Data
    summary,
    shipments,
    
    // Pagination
    currentPage,
    totalPages,
    pageSize,
    
    // State
    loading,
    detailsLoading,
    hasLoadedDetails,
    
    // Actions
    loadSummary,
    loadShipmentPage,
    loadFullDetails,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    
    // Computed
    hasNextPage: currentPage < totalPages - 1,
    hasPrevPage: currentPage > 0,
    startRecord: currentPage * pageSize + 1,
    endRecord: Math.min((currentPage + 1) * pageSize, summary?.total_shipments || 0),
    totalRecords: summary?.total_shipments || 0
  };
}