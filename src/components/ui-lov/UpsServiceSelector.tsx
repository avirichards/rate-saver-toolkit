import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface UpsServiceSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface UpsService {
  service_code: string;
  service_name: string;
  description: string;
  is_international: boolean;
}

export function UpsServiceSelector({ 
  value, 
  onValueChange, 
  placeholder = "Select UPS Service",
  className 
}: UpsServiceSelectorProps) {
  const [services, setServices] = useState<UpsService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUpsServices = async () => {
      try {
        const { data, error } = await supabase
          .from('ups_services')
          .select('service_code, service_name, description, is_international')
          .eq('is_active', true)
          .order('service_name');

        if (error) {
          console.error('Error loading UPS services:', error);
          return;
        }

        setServices(data || []);
      } catch (error) {
        console.error('Failed to load UPS services:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUpsServices();
  }, []);

  const selectedService = services.find(s => 
    s.service_name === value || s.service_code === value
  );

  return (
    <Select value={value} onValueChange={onValueChange} disabled={loading}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={loading ? "Loading services..." : placeholder}>
          {selectedService && (
            <div className="flex items-center gap-2">
              <span>{selectedService.service_name}</span>
              {selectedService.is_international && (
                <Badge variant="outline" className="text-xs">Intl</Badge>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover border border-border max-h-60 overflow-y-auto z-50">
        {services.map((service) => (
          <SelectItem 
            key={service.service_code} 
            value={service.service_name}
            className="hover:bg-accent"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="font-medium">{service.service_name}</span>
                {service.description && (
                  <span className="text-xs text-muted-foreground">
                    {service.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 ml-4">
                <Badge variant="outline" className="text-xs">
                  {service.service_code}
                </Badge>
                {service.is_international && (
                  <Badge variant="outline" className="text-xs">Intl</Badge>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}