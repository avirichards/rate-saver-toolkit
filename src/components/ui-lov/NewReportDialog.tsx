import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Plus } from 'lucide-react';

interface NewReportDialogProps {
  onReportCreated?: () => void;
}

export const NewReportDialog: React.FC<NewReportDialogProps> = ({ onReportCreated }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportName, setReportName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      // Auto-generate report name from filename if empty
      if (!reportName) {
        const nameWithoutExtension = selectedFile.name.replace(/\.csv$/i, '');
        setReportName(nameWithoutExtension);
      }
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a CSV file",
        variant: "destructive",
      });
    }
  };

  const parseCSV = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return {
      headers,
      rowCount: lines.length - 1 // Subtract header row
    };
  };

  const createReport = async () => {
    if (!file || !reportName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a report name and select a CSV file",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Read CSV content
      const csvText = await file.text();
      const { headers, rowCount } = parseCSV(csvText);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create new report
      const { data: report, error } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          report_name: reportName.trim(),
          raw_csv_data: csvText,
          raw_csv_filename: file.name,
          total_rows: rowCount,
          detected_headers: headers,
          current_section: 'header_mapping',
          sections_completed: []
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Report created",
        description: `${reportName} has been created successfully`,
      });

      // Close dialog and navigate to report workflow
      setOpen(false);
      onReportCreated?.();
      navigate(`/report/${report.id}`);
    } catch (error) {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: "Failed to create report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReportName('');
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Analysis</DialogTitle>
          <DialogDescription>
            Upload a CSV file and give your analysis a name to get started.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Report Name */}
          <div className="space-y-2">
            <Label htmlFor="report-name">Analysis Name</Label>
            <Input
              id="report-name"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Enter analysis name..."
              disabled={loading}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm text-muted-foreground mb-2">
                  {file ? (
                    <span className="font-medium text-foreground">
                      {file.name}
                    </span>
                  ) : (
                    "Select a CSV file to upload"
                  )}
                </div>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={loading}
                  className="hidden"
                />
                <Label
                  htmlFor="csv-file"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer"
                >
                  Choose File
                </Label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={createReport}
              disabled={loading || !file || !reportName.trim()}
            >
              {loading ? "Creating..." : "Create Analysis"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};