import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UpsTestResult {
  success: boolean;
  message: string;
  details?: any;
}

export function useUpsConnectivity() {
  const [testing, setTesting] = useState(false);

  const testUpsConnection = useCallback(async (configId?: string): Promise<UpsTestResult> => {
    setTesting(true);
    
    try {
      console.log('Testing UPS connectivity...');

      // Test 1: Check if UPS config exists in carrier_configs
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, message: 'User not authenticated' };
      }

      // Build query to get UPS configuration
      let query = supabase
        .from('carrier_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('carrier_type', 'ups')
        .eq('is_active', true);

      // If configId is provided, use specific config
      if (configId) {
        query = query.eq('id', configId);
      }
      
      const { data: config, error: configError } = await query.maybeSingle();

      if (configError) {
        console.error('Error fetching UPS config:', configError);
        return { 
          success: false, 
          message: 'Error fetching UPS configuration',
          details: configError 
        };
      }

      if (!config) {
        return { 
          success: false, 
          message: configId 
            ? `UPS configuration not found for ID: ${configId}` 
            : 'UPS configuration not found. Please set up UPS carrier account in Settings.',
          details: { configId }
        };
      }

      // Test 2: Check UPS authentication
      const { data: authData, error: authError } = await supabase.functions.invoke('ups-auth', {
        body: { action: 'get_token', config_id: configId || config.id }
      });

      if (authError || !authData?.access_token) {
        return { 
          success: false, 
          message: 'Failed to authenticate with UPS API. Please check your credentials.',
          details: { authError, authData } 
        };
      }

      // Test 3: Test rate quote with sample data
      const testShipment = {
        shipFrom: {
          name: 'Test Shipper',
          address: '123 Main St',
          city: 'Atlanta',
          state: 'GA',
          zipCode: '30309',
          country: 'US'
        },
        shipTo: {
          name: 'Test Recipient',
          address: '456 Oak Ave',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'US'
        },
        package: {
          weight: 5,
          weightUnit: 'LBS',
          length: 12,
          width: 12,
          height: 6,
          dimensionUnit: 'IN'
        },
        serviceTypes: ['03'] // Ground only for test
      };

      const { data: rateData, error: rateError } = await supabase.functions.invoke('ups-rate-quote', {
        body: { 
          shipment: testShipment,
          configId: configId || config.id
        }
      });

      if (rateError) {
        return { 
          success: false, 
          message: `UPS Rate API test failed: ${rateError.message}`,
          details: { rateError, rateData } 
        };
      }

      if (!rateData || !rateData.rates || rateData.rates.length === 0) {
        return { 
          success: false, 
          message: 'UPS Rate API returned no rates for test shipment',
          details: rateData 
        };
      }

      return { 
        success: true, 
        message: `UPS connectivity test successful! Found ${rateData.rates.length} rate(s).`,
        details: { 
          config: { 
            sandbox: config.is_sandbox,
            hasAccount: !!config.ups_account_number 
          },
          testRates: rateData.rates 
        }
      };

    } catch (error: any) {
      console.error('UPS connectivity test error:', error);
      return { 
        success: false, 
        message: `Connectivity test failed: ${error.message}`,
        details: error 
      };
    } finally {
      setTesting(false);
    }
  }, []);

  return {
    testing,
    testUpsConnection
  };
}