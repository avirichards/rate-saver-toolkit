import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, Download, AlertCircle } from 'lucide-react';

interface ViewRateCardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  carrierConfigId: string;
  accountName: string;
}

interface RateCardRate {
  id: string;
  service_code: string;
  service_name: string;
  zone: string;
  weight_break: number;
  rate_amount: number;
}

interface CarrierConfig {
  account_name: string;
  carrier_type: string;
  rate_card_filename: string;
  dimensional_divisor: number;
  fuel_surcharge_percent: number;
  rate_card_uploaded_at: string;
  column_mappings?: any;
}

export const ViewRateCardDialog: React.FC<ViewRateCardDialogProps> = ({
  isOpen,
  onClose,
  carrierConfigId,
  accountName
}) => {
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<RateCardRate[]>([]);
  const [config, setConfig] = useState<CarrierConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterZone, setFilterZone] = useState('');
  const [filterService, setFilterService] = useState('');
  const itemsPerPage = 20;

  useEffect(() => {
    if (isOpen && carrierConfigId) {
      loadRateCardData();
    }
  }, [isOpen, carrierConfigId]);

  const loadRateCardData = async () => {
    setLoading(true);
    try {
      // Load carrier config
      const { data: configData, error: configError } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('id', carrierConfigId)
        .single();

      if (configError) throw configError;
      setConfig(configData);

      // Load rate card rates
      const { data: ratesData, error: ratesError } = await supabase
        .from('rate_card_rates')
        .select('*')
        .eq('carrier_config_id', carrierConfigId)
        .order('zone', { ascending: true })
        .order('weight_break', { ascending: true });

      if (ratesError) throw ratesError;
      setRates(ratesData || []);
    } catch (error: any) {
      console.error('Error loading rate card data:', error);
      toast.error(`Failed to load rate card: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getUniqueValues = (field: keyof RateCardRate) => {
    return [...new Set(rates.map(rate => rate[field]))].filter(Boolean).sort();
  };

  const filteredRates = rates.filter(rate => {
    if (filterZone && rate.zone !== filterZone) return false;
    if (filterService && rate.service_code !== filterService) return false;
    return true;
  });

  const paginatedRates = filteredRates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredRates.length / itemsPerPage);

  const downloadCSV = () => {
    const headers = ['Service Code', 'Service Name', 'Zone', 'Weight Break (lbs)', 'Rate Amount'];
    const csvContent = [
      headers.join(','),
      ...filteredRates.map(rate => [
        rate.service_code,
        rate.service_name || '',
        rate.zone,
        rate.weight_break,
        rate.rate_amount
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${accountName}-rates.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            View Rate Card: {accountName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading rate card...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Rate Card Info */}
            {config && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Carrier:</span>
                    <Badge variant="outline" className="ml-2">
                      {config.carrier_type.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">File:</span>
                    <span className="ml-2">{config.rate_card_filename}</span>
                  </div>
                  <div>
                    <span className="font-medium">Dim Divisor:</span>
                    <span className="ml-2">{config.dimensional_divisor}</span>
                  </div>
                  <div>
                    <span className="font-medium">Fuel:</span>
                    <span className="ml-2">{config.fuel_surcharge_percent}%</span>
                  </div>
                </div>
                {config.column_mappings && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="text-xs font-medium text-muted-foreground">Column Mappings:</span>
                    <div className="text-xs text-muted-foreground mt-1">
                      Zone: {config.column_mappings.zone} | 
                      Weight: {config.column_mappings.weight_break} | 
                      Rate: {config.column_mappings.rate_amount}
                      {config.column_mappings.service_code && ` | Service: ${config.column_mappings.service_code}`}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filters and Stats */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Zone:</label>
                  <select
                    value={filterZone}
                    onChange={(e) => { setFilterZone(e.target.value); setCurrentPage(1); }}
                    className="px-2 py-1 border rounded text-sm bg-background"
                  >
                    <option value="">All Zones</option>
                    {getUniqueValues('zone').map(zone => (
                      <option key={zone} value={zone as string}>{zone}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Service:</label>
                  <select
                    value={filterService}
                    onChange={(e) => { setFilterService(e.target.value); setCurrentPage(1); }}
                    className="px-2 py-1 border rounded text-sm bg-background"
                  >
                    <option value="">All Services</option>
                    {getUniqueValues('service_code').map(service => (
                      <option key={service} value={service as string}>{service}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {filteredRates.length} rates
                </span>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Rates Table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              {filteredRates.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No rates found</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Code</TableHead>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-right">Weight Break (lbs)</TableHead>
                      <TableHead className="text-right">Rate Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRates.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-mono text-sm">{rate.service_code}</TableCell>
                        <TableCell>{rate.service_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{rate.zone}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {rate.weight_break.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${rate.rate_amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRates.length)} of {filteredRates.length} rates
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};