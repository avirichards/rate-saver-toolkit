import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { ClientCombobox } from '@/components/ui-lov/ClientCombobox';

interface Client {
  id: string;
  company_name: string;
}

interface SaveReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisId: string;
  currentReportName?: string;
  currentClientId?: string;
  onSaved?: () => void;
}

export function SaveReportDialog({ 
  open, 
  onOpenChange, 
  analysisId, 
  currentReportName = '',
  currentClientId = '',
  onSaved 
}: SaveReportDialogProps) {
  const [reportName, setReportName] = useState(currentReportName);
  const [selectedClientId, setSelectedClientId] = useState(currentClientId);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  

  useEffect(() => {
    if (open) {
      setReportName(currentReportName);
      setSelectedClientId(currentClientId);
    }
  }, [open, currentReportName, currentClientId]);

  const handleSave = async () => {
    if (!reportName.trim()) {
      toast.error("Report name is required");
      return;
    }

    if (!analysisId || analysisId.trim() === '') {
      toast.error("No analysis data available to save");
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        report_name: reportName.trim(),
        client_id: selectedClientId || null,
        report_status: 'saved',
        updated_at: new Date().toISOString()
      };

      if (description.trim()) {
        updateData.recommendations = { description: description.trim() };
      }

      const { error } = await supabase
        .from('shipping_analyses')
        .update(updateData)
        .eq('id', analysisId);

      if (error) throw error;

      toast.success("Report saved successfully");

      onSaved?.();
      onOpenChange(false);
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
          <DialogTitle>Save Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-name">Report Name *</Label>
            <Input
              id="report-name"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Enter report name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-select">Client</Label>
            <ClientCombobox
              value={selectedClientId}
              onValueChange={setSelectedClientId}
              placeholder="Select or create client (optional)"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any notes about this report..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || !reportName.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}