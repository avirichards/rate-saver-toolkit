import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { RateCardUploadDialog } from './RateCardUploadDialog';
import { ViewRateCardDialog } from './ViewRateCardDialog';

interface RateCard {
  id: string;
  account_name: string;
  service_code: string;
  service_name?: string;
  rate_card_filename: string;
  rate_card_uploaded_at: string;
  weight_unit: string;
  dimensional_divisor: number;
  fuel_surcharge_percent: number;
}

interface ServiceType {
  service_code: string;
  service_name: string;
  description?: string;
}

interface RateCardManagerProps {
  carrierType: 'ups' | 'fedex' | 'dhl' | 'usps';
}

export function RateCardManager({ carrierType }: RateCardManagerProps) {
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [availableServices, setAvailableServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedServiceCode, setSelectedServiceCode] = useState<string>('');
  const [selectedRateCard, setSelectedRateCard] = useState<RateCard | null>(null);
  const [editingRateCard, setEditingRateCard] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [carrierType]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load available services for this carrier type
      const { data: services, error: servicesError } = await supabase
        .from('carrier_services')
        .select('service_code, service_name, description')
        .eq('carrier_type', carrierType)
        .eq('is_active', true);

      if (servicesError) throw servicesError;
      setAvailableServices(services || []);

      // Load existing rate cards for this carrier type
      const { data: configs, error: configsError } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('carrier_type', carrierType)
        .eq('is_rate_card', true)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (configsError) throw configsError;
      
      // Get service codes from rate_card_rates for each config
      const rateCardsWithServices = await Promise.all(
        (configs || []).map(async (config) => {
          const { data: rates } = await supabase
            .from('rate_card_rates')
            .select('service_code, service_name')
            .eq('carrier_config_id', config.id)
            .limit(1);
          
          return {
            ...config,
            service_code: rates?.[0]?.service_code || '',
            service_name: rates?.[0]?.service_name || ''
          };
        })
      );

      setRateCards(rateCardsWithServices);
    } catch (error) {
      console.error('Error loading rate card data:', error);
      toast.error('Failed to load rate card data');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadRateCard = (serviceCode: string) => {
    setSelectedServiceCode(serviceCode);
    setEditingRateCard(null);
    setUploadDialogOpen(true);
  };

  const handleEditRateCard = (rateCard: RateCard) => {
    setSelectedServiceCode(rateCard.service_code);
    setEditingRateCard({
      id: rateCard.id,
      carrier_type: carrierType,
      account_name: rateCard.account_name,
      weight_unit: rateCard.weight_unit,
      dimensional_divisor: rateCard.dimensional_divisor,
      fuel_surcharge_percent: rateCard.fuel_surcharge_percent,
      is_rate_card: true,
      is_active: true
    });
    setUploadDialogOpen(true);
  };

  const handleViewRateCard = (rateCard: RateCard) => {
    setSelectedRateCard(rateCard);
    setViewDialogOpen(true);
  };

  const handleDeleteRateCard = async (rateCard: RateCard) => {
    if (!confirm('Are you sure you want to delete this rate card?')) {
      return;
    }

    try {
      // Delete rate card rates first
      const { error: ratesError } = await supabase
        .from('rate_card_rates')
        .delete()
        .eq('carrier_config_id', rateCard.id);

      if (ratesError) throw ratesError;

      // Delete the carrier config
      const { error: configError } = await supabase
        .from('carrier_configs')
        .delete()
        .eq('id', rateCard.id);

      if (configError) throw configError;

      toast.success('Rate card deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting rate card:', error);
      toast.error('Failed to delete rate card');
    }
  };

  const getRateCardForService = (serviceCode: string) => {
    return rateCards.find(rc => rc.service_code === serviceCode);
  };

  if (loading) {
    return <div className="text-center py-8">Loading rate cards...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {carrierType.toUpperCase()} Rate Cards by Service Type
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableServices.map((service) => {
            const existingRateCard = getRateCardForService(service.service_code);
            
            return (
              <div key={service.service_code} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <h4 className="font-medium">{service.service_name}</h4>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {service.service_code}
                    </Badge>
                  </div>
                  
                  {existingRateCard && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">Account:</span> {existingRateCard.account_name} • 
                      <span className="font-medium"> Uploaded:</span> {new Date(existingRateCard.rate_card_uploaded_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {existingRateCard ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewRateCard(existingRateCard)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRateCard(existingRateCard)}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteRateCard(existingRateCard)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUploadRateCard(service.service_code)}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Rate Card
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {availableServices.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No services available for {carrierType.toUpperCase()}
            </div>
          )}
        </CardContent>
      </Card>

      <RateCardUploadDialog
        isOpen={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
          setSelectedServiceCode('');
          setEditingRateCard(null);
        }}
        onSuccess={() => {
          setUploadDialogOpen(false);
          setSelectedServiceCode('');
          setEditingRateCard(null);
          loadData();
        }}
        editConfig={editingRateCard}
        preSelectedCarrierType={carrierType}
        preSelectedServiceCode={selectedServiceCode}
      />

      {selectedRateCard && (
        <ViewRateCardDialog
          isOpen={viewDialogOpen}
          onClose={() => {
            setViewDialogOpen(false);
            setSelectedRateCard(null);
          }}
          carrierConfigId={selectedRateCard.id}
          accountName={selectedRateCard.account_name}
        />
      )}
    </div>
  );
}