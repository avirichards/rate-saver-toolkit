import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

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
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadClients();
      setReportName(currentReportName);
      setSelectedClientId(currentClientId);
    }
  }, [open, currentReportName, currentClientId]);

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive"
      });
    } finally {
      setLoadingClients(false);
    }
  };

  const handleSave = async () => {
    if (!reportName.trim()) {
      toast({
        title: "Error",
        description: "Report name is required",
        variant: "destructive"
      });
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

      toast({
        title: "Success",
        description: "Report saved successfully",
      });

      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Error",
        description: "Failed to save report",
        variant: "destructive"
      });
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
            {loadingClients ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No client assigned</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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