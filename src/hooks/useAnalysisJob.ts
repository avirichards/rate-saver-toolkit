import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AnalysisJobStatus {
  total_shipments: number;
  processed_shipments: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  progress_percentage: number;
}

export const useAnalysisJob = () => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<AnalysisJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Start a new analysis job
  const startAnalysis = useCallback(async (shipments: any[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to start analysis');
      }

      const response = await supabase.functions.invoke('start-analysis', {
        body: { shipments },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.jobId) {
        setJobId(response.data.jobId);
        console.log('Analysis job started:', response.data.jobId);
      } else {
        throw new Error('No job ID returned from analysis service');
      }
    } catch (err: any) {
      console.error('Error starting analysis:', err);
      setError(err.message || 'Failed to start analysis');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get status of current job
  const getJobStatus = useCallback(async (currentJobId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to check analysis status');
      }

      const url = `https://olehfhquezzfkdgilkut.supabase.co/functions/v1/get-analysis-status?jobId=${currentJobId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data) {
        setStatus(data);
        return data;
      }
    } catch (err: any) {
      console.error('Error getting job status:', err);
      setError(err.message || 'Failed to get analysis status');
      return null;
    }
  }, []);

  // Poll for status updates
  useEffect(() => {
    if (!jobId || !status || status.status === 'completed' || status.status === 'failed') {
      return;
    }

    const pollInterval = setInterval(async () => {
      await getJobStatus(jobId);
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, status, getJobStatus]);

  // Get final results when job is completed
  const getResults = useCallback(async (analysisJobId: string) => {
    try {
      const { data: rates, error } = await supabase
        .from('shipment_rates')
        .select(`
          *,
          carrier_configs!inner(account_name, carrier_type)
        `)
        .eq('analysis_id', analysisJobId);

      if (error) {
        throw new Error(error.message);
      }

      return rates || [];
    } catch (err: any) {
      console.error('Error getting results:', err);
      setError(err.message || 'Failed to get analysis results');
      return [];
    }
  }, []);

  return {
    startAnalysis,
    getJobStatus,
    getResults,
    jobId,
    status,
    error,
    isLoading,
    resetJob: () => {
      setJobId(null);
      setStatus(null);
      setError(null);
    }
  };
};