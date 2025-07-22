
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisStatus {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  processing_metadata?: {
    currentShipment?: number;
    completedShipments?: number;
    errorShipments?: number;
    progressPercentage?: number;
    error?: string;
    status?: string;
  };
  total_shipments: number;
  total_savings?: number;
}

export const useBackgroundAnalysis = (analysisId: string | null) => {
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysisStatus = async () => {
    if (!analysisId) return;

    try {
      const { data, error } = await supabase
        .from('shipping_analyses')
        .select('id, status, processing_metadata, total_shipments, total_savings')
        .eq('id', analysisId)
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      setAnalysisStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!analysisId) return;

    // Initial fetch
    fetchAnalysisStatus();

    // Set up polling interval (every 5 seconds)
    const interval = setInterval(fetchAnalysisStatus, 5000);

    // Set up real-time subscription
    const channel = supabase
      .channel(`analysis-${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipping_analyses',
          filter: `id=eq.${analysisId}`
        },
        (payload) => {
          console.log('Real-time analysis update:', payload);
          setAnalysisStatus(payload.new as AnalysisStatus);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [analysisId]);

  return {
    analysisStatus,
    isLoading,
    error,
    refetch: fetchAnalysisStatus
  };
};
