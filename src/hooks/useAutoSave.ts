
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { convertToDatabaseFormat, UnifiedAnalysisData } from '@/utils/dataProcessing';

interface AutoSaveOptions {
  debounceMs?: number;
  showSuccessToast?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useAutoSave(
  analysisId: string | null,
  unifiedData: UnifiedAnalysisData | null,
  enabled: boolean = true,
  options: AutoSaveOptions = {}
) {
  const {
    debounceMs = 1500,
    showSuccessToast = false,
    onError,
    onSuccess
  } = options;

  const timeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const saveData = useCallback(async () => {
    if (!analysisId || !enabled || !unifiedData || !isMountedRef.current) return;

    try {
      console.log('💾 Auto-saving unified data for analysis:', analysisId);
      
      // Convert unified data to database format
      const dbFormat = convertToDatabaseFormat(unifiedData);
      
      const updateData = {
        ...dbFormat,
        status: 'completed',
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('shipping_analyses')
        .update(updateData)
        .eq('id', analysisId);

      if (error) throw error;

      console.log('✅ Auto-save completed successfully');
      
      if (showSuccessToast && isMountedRef.current) {
        toast.success('Auto-saved', { duration: 1500 });
      }
      
      onSuccess?.();
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      if (isMountedRef.current) {
        onError?.(error as Error);
      }
    }
  }, [analysisId, unifiedData, enabled, showSuccessToast, onError, onSuccess]);

  const triggerSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveData();
    }, debounceMs);
  }, [saveData, debounceMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { triggerSave, saveNow: saveData };
}
