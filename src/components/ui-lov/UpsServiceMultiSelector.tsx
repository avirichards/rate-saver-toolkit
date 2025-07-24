import React, { useState, useEffect } from 'react';
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select';
import { supabase } from '@/integrations/supabase/client';

interface UpsServiceMultiSelectorProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

interface UpsService {
  service_code: string;
  service_name: string;
  description: string;
  is_international: boolean;
}

export function UpsServiceMultiSelector({ 
  values = [], 
  onValuesChange, 
  placeholder = "Select UPS Services",
  className 
}: UpsServiceMultiSelectorProps) {
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

  const options: MultiSelectOption[] = services.map(service => ({
    value: service.service_name,
    label: `${service.service_name}${service.is_international ? ' (Intl)' : ''}`
  }));

  if (loading) {
    return (
      <div className={`h-9 bg-muted animate-pulse rounded-md ${className}`}>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm text-muted-foreground">Loading services...</span>
        </div>
      </div>
    );
  }

  return (
    <MultiSelect
      options={options}
      values={values}
      onValuesChange={onValuesChange}
      placeholder={placeholder}
      className={className}
    />
  );
}