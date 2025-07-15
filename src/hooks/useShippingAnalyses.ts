import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ShippingAnalysis = Database['public']['Tables']['shipping_analyses']['Row'];
type ShippingAnalysisInsert = Database['public']['Tables']['shipping_analyses']['Insert'];
type ShippingAnalysisUpdate = Database['public']['Tables']['shipping_analyses']['Update'];

export interface MarkupConfig {
  type: 'global' | 'per-service';
  globalPercentage?: number;
  serviceMarkups?: Record<string, number>;
}

export interface ReportConfig {
  reportName: string;
  clientId?: string;
  clientName?: string;
  salesRepId?: string;
  markupConfig: MarkupConfig;
}

export function useShippingAnalyses() {
  const [loading, setLoading] = useState(false);
  const [analyses, setAnalyses] = useState<ShippingAnalysis[]>([]);

  const fetchAnalyses = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setAnalyses(data || []);
    } catch (error: any) {
      console.error('Error fetching analyses:', error);
      toast.error('Failed to load analyses');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAnalysis = useCallback(async (
    analysisData: any,
    reportConfig: ReportConfig
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Generate unique share token
      const shareToken = crypto.randomUUID();

      const analysisRecord: ShippingAnalysisInsert = {
        user_id: user.id,
        file_name: reportConfig.reportName,
        client_id: reportConfig.clientId || null,
        markup_profile_id: null,
        sales_rep_id: reportConfig.salesRepId || null,
        total_shipments: analysisData.results?.length || 0,
        total_savings: analysisData.totalSavings || 0,
        original_data: analysisData,
        base_data: analysisData.results || null,
        markup_data: reportConfig.markupConfig as any,
        client_facing_data: null, // Will be calculated based on markup
        status: 'completed',
        report_status: 'published',
        analysis_date: new Date().toISOString(),
        recommendations: analysisData.recommendations || null,
        savings_analysis: {
          totalSavings: analysisData.totalSavings || 0,
          totalCurrentCost: analysisData.totalCurrentCost || 0,
          savingsPercentage: analysisData.savingsPercentage || 0
        },
        ups_quotes: analysisData.upsQuotes || null
      };

      const { data, error } = await supabase
        .from('shipping_analyses')
        .insert(analysisRecord)
        .select()
        .single();

      if (error) throw error;

      // Create share link
      await supabase
        .from('report_shares')
        .insert({
          analysis_id: data.id,
          client_id: reportConfig.clientId || null,
          share_token: shareToken,
          is_active: true
        });

      toast.success('Analysis saved successfully');
      return data;
    } catch (error: any) {
      console.error('Error saving analysis:', error);
      toast.error('Failed to save analysis');
      throw error;
    }
  }, []);

  const updateAnalysis = useCallback(async (
    analysisId: string,
    updates: ShippingAnalysisUpdate
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('shipping_analyses')
        .update(updates)
        .eq('id', analysisId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Analysis updated successfully');
      return data;
    } catch (error: any) {
      console.error('Error updating analysis:', error);
      toast.error('Failed to update analysis');
      throw error;
    }
  }, []);

  const deleteAnalysis = useCallback(async (analysisId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('shipping_analyses')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString() 
        })
        .eq('id', analysisId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Analysis deleted successfully');
      await fetchAnalyses(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting analysis:', error);
      toast.error('Failed to delete analysis');
    }
  }, [fetchAnalyses]);

  const getShareLink = useCallback(async (analysisId: string) => {
    try {
      const { data, error } = await supabase
        .from('report_shares')
        .select('share_token')
        .eq('analysis_id', analysisId)
        .eq('is_active', true)
        .single();

      if (error) throw error;

      const baseUrl = window.location.origin;
      return `${baseUrl}/share/${data.share_token}`;
    } catch (error: any) {
      console.error('Error getting share link:', error);
      toast.error('Failed to get share link');
      return null;
    }
  }, []);

  return {
    loading,
    analyses,
    fetchAnalyses,
    saveAnalysis,
    updateAnalysis,
    deleteAnalysis,
    getShareLink
  };
}