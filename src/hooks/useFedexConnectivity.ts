import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface FedexTestResult {
  success: boolean;
  message: string;
  details?: {
    config?: {
      sandbox: boolean;
      hasAccount: boolean;
    };
    testRates?: any[];
  };
}

export const useFedexConnectivity = () => {
  const [testing, setTesting] = useState(false);
  const { user } = useAuth();

  const testFedexConnection = async (configId?: string): Promise<FedexTestResult> => {
    if (!user) {
      return {
        success: false,
        message: 'User not authenticated'
      };
    }

    setTesting(true);

    try {
      // First, verify we have FedEx carrier configuration
      let query = supabase
        .from('carrier_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('carrier_type', 'fedex')
        .eq('is_active', true);

      if (configId) {
        query = query.eq('id', configId);
      }

      const { data: carrierConfig, error: configError } = await query.maybeSingle();

      if (configError) {
        console.error('Error fetching FedEx config:', configError);
        return {
          success: false,
          message: `Error fetching FedEx configuration: ${configError.message}`
        };
      }

      if (!carrierConfig) {
        return {
          success: false,
          message: configId 
            ? `FedEx configuration not found for the specified account`
            : 'No active FedEx configuration found. Please add your FedEx API credentials in Settings.'
        };
      }

      if (!carrierConfig.fedex_key || !carrierConfig.fedex_password) {
        return {
          success: false,
          message: 'FedEx API credentials are missing. Please update your FedEx configuration with API Key and Password.'
        };
      }

      if (!carrierConfig.fedex_account_number) {
        return {
          success: false,
          message: 'FedEx account number is missing. Please update your FedEx configuration with your account number.'
        };
      }

      // Test FedEx authentication
      console.log('Testing FedEx authentication...');
      const { data: authData, error: authError } = await supabase.functions.invoke('fedex-auth', {
        body: { 
          action: 'get_token',
          config_id: carrierConfig.id
        }
      });

      if (authError || !authData?.access_token) {
        console.error('FedEx auth failed:', authError);
        return {
          success: false,
          message: `FedEx authentication failed: ${authError?.message || 'Unable to obtain access token'}`
        };
      }

      console.log('✅ FedEx authentication successful');

      // Test a sample rate quote
      console.log('Testing FedEx rate quote...');
      const testShipment = {
        shipFrom: {
          name: 'Test Shipper',
          address: '123 Test St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        },
        shipTo: {
          name: 'Test Recipient',
          address: '456 Test Ave',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'US'
        },
        package: {
          weight: 1,
          weightUnit: 'LBS',
          length: 10,
          width: 8,
          height: 6,
          dimensionUnit: 'IN',
          packageType: '02'
        },
        serviceTypes: ['FEDEX_GROUND', 'FEDEX_EXPRESS_SAVER', 'FEDEX_2_DAY'],
        equivalentServiceCode: 'FEDEX_GROUND',
        isResidential: false,
        residentialSource: 'test'
      };

      const { data: rateData, error: rateError } = await supabase.functions.invoke('fedex-rate-quote', {
        body: { 
          shipment: testShipment,
          configId: carrierConfig.id
        }
      });

      if (rateError) {
        console.error('FedEx rate test failed:', rateError);
        return {
          success: false,
          message: `FedEx rate quote test failed: ${rateError.message}`
        };
      }

      if (!rateData?.rates || rateData.rates.length === 0) {
        return {
          success: false,
          message: 'FedEx API connection successful, but no rates were returned. This may indicate an issue with your account configuration or service availability.'
        };
      }

      console.log('✅ FedEx rate quote test successful', rateData);

      return {
        success: true,
        message: `FedEx connection test successful! Found ${rateData.rates.length} rate(s) for test shipment.`,
        details: {
          config: {
            sandbox: carrierConfig.is_sandbox,
            hasAccount: !!carrierConfig.fedex_account_number
          },
          testRates: rateData.rates.slice(0, 3) // Show first 3 rates as preview
        }
      };

    } catch (error) {
      console.error('Unexpected error during FedEx connectivity test:', error);
      return {
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      };
    } finally {
      setTesting(false);
    }
  };

  return {
    testing,
    testFedexConnection
  };
};