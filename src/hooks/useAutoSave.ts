import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AutoSaveOptions {
  debounceMs?: number;
  showSuccessToast?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useAutoSave(
  analysisId: string | null,
  updateData: any,
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
    if (!analysisId || !enabled || !isMountedRef.current) return;

    try {
      const { error } = await supabase
        .from('shipping_analyses')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', analysisId);

      if (error) throw error;

      if (showSuccessToast && isMountedRef.current) {
        toast.success('Auto-saved', { duration: 1500 });
      }
      
      onSuccess?.();
    } catch (error) {
      console.error('Auto-save failed:', error);
      if (isMountedRef.current) {
        onError?.(error as Error);
      }
    }
  }, [analysisId, updateData, enabled, showSuccessToast, onError, onSuccess]);

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