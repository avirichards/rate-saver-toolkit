import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { ClientCombobox } from '@/components/ui-lov/ClientCombobox';
import { useNavigate } from 'react-router-dom';

interface PostUploadNamingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  defaultReportName?: string;
  onComplete?: (analysisId: string) => void;
}

export function PostUploadNamingDialog({ 
  open, 
  onOpenChange, 
  analysisId,
  defaultReportName = '',
  onComplete
}: PostUploadNamingDialogProps) {
  const [reportName, setReportName] = useState(defaultReportName);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setReportName(defaultReportName);
      setSelectedClientId('');
    }
  }, [open, defaultReportName]);

  const handleComplete = async () => {
    if (!reportName.trim()) {
      toast.error("Report name is required");
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        report_name: reportName.trim(),
        client_id: selectedClientId || null,
        report_status: 'saved',
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('shipping_analyses')
        .update(updateData)
        .eq('id', analysisId);

      if (error) throw error;

      toast.success("Report saved successfully");
      onOpenChange(false);
      
      // Navigate to results page
      navigate(`/results?analysisId=${analysisId}`);
      
      onComplete?.(analysisId);
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error("Failed to save report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Name Your Analysis Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-name">Report Name *</Label>
            <Input
              id="report-name"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Enter report name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && reportName.trim()) {
                  handleComplete();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-select">Client (Optional)</Label>
            <ClientCombobox
              value={selectedClientId}
              onValueChange={setSelectedClientId}
              placeholder="Select or create client"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            type="button"
            onClick={handleComplete}
            disabled={loading || !reportName.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}