
import { supabase } from '@/integrations/supabase/client';

interface StartBackgroundAnalysisParams {
  fileName: string;
  originalData: any[];
  carrierConfigIds: string[];
  serviceMappings: any[];
  clientId?: string;
  reportName?: string;
}

export const startBackgroundAnalysis = async (params: StartBackgroundAnalysisParams): Promise<string> => {
  console.log('Starting background analysis:', {
    fileName: params.fileName,
    shipmentCount: params.originalData.length,
    carrierConfigs: params.carrierConfigIds.length
  });

  const { data, error } = await supabase.functions.invoke('start-background-analysis', {
    body: params
  });

  if (error) {
    console.error('Error starting background analysis:', error);
    throw new Error(`Failed to start analysis: ${error.message}`);
  }

  if (!data?.success || !data?.analysisId) {
    throw new Error('Failed to start background analysis - no analysis ID returned');
  }

  console.log('Background analysis started with ID:', data.analysisId);
  return data.analysisId;
};
