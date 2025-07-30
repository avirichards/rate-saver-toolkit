import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const FedexDebugTest = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { user } = useAuth();

  const runDebugTest = async () => {
    if (!user) {
      setResult({ error: 'User not authenticated' });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      // 1. Check FedEx config
      console.log('🔍 Step 1: Checking FedEx configuration...');
      const { data: configs, error: configError } = await supabase
        .from('carrier_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('carrier_type', 'fedex')
        .eq('is_active', true);

      if (configError || !configs || configs.length === 0) {
        setResult({ 
          error: 'No active FedEx configuration found',
          step: 'config_check',
          details: { configError, configs }
        });
        return;
      }

      const config = configs[0];
      console.log('✅ FedEx config found:', { 
        id: config.id, 
        account: config.account_name,
        hasCredentials: !!(config.fedex_key && config.fedex_password && config.fedex_account_number)
      });

      // 2. Test authentication
      console.log('🔍 Step 2: Testing FedEx authentication...');
      const { data: authData, error: authError } = await supabase.functions.invoke('fedex-auth', {
        body: { 
          action: 'get_token',
          config_id: config.id
        }
      });

      if (authError || !authData?.access_token) {
        setResult({
          error: 'FedEx authentication failed',
          step: 'auth_test',
          details: { authError, authData }
        });
        return;
      }

      console.log('✅ FedEx auth successful');

      // 3. Test multiple service rate quotes with detailed logging
      console.log('🔍 Step 3: Testing FedEx rate quotes for all enabled services...');
      
      const enabledServices = Array.isArray(config.enabled_services) ? config.enabled_services : [];
      console.log('Enabled services:', enabledServices);
      
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
          weight: 5,
          weightUnit: 'LBS',
          length: 12,
          width: 10,
          height: 8,
          dimensionUnit: 'IN',
          packageType: '02'
        },
        serviceTypes: enabledServices.slice(0, 5), // Test first 5 enabled services
        equivalentServiceCode: enabledServices[0] || 'FEDEX_GROUND',
        isResidential: false,
        residentialSource: 'debug_test'
      };

      const { data: rateData, error: rateError } = await supabase.functions.invoke('fedex-rate-quote', {
        body: { 
          shipment: testShipment,
          configId: config.id
        }
      });

      if (rateError) {
        setResult({
          error: 'Rate quote failed',
          step: 'rate_test',
          details: { rateError, rateData }
        });
        return;
      }

      // 4. Check carrier services table
      console.log('🔍 Step 4: Checking carrier services...');
      const { data: services, error: servicesError } = await supabase
        .from('carrier_services')
        .select('*')
        .eq('carrier_type', 'fedex');

      // 5. Test multi-carrier quote to see service filtering
      console.log('🔍 Step 5: Testing multi-carrier quote service filtering...');
      const multiCarrierTest = {
        shipFrom: testShipment.shipFrom,
        shipTo: testShipment.shipTo,
        package: testShipment.package,
        serviceTypes: ['GROUND'], // Universal service code
        equivalentServiceCode: 'GROUND',
        isResidential: false,
        residentialSource: 'debug_test',
        carrierConfigIds: [config.id]
      };

      const { data: multiCarrierData, error: multiCarrierError } = await supabase.functions.invoke('multi-carrier-quote', {
        body: { 
          shipment: multiCarrierTest
        }
      });

      setResult({
        success: true,
        step: 'complete',
        details: {
          config: {
            id: config.id,
            name: config.account_name,
            sandbox: config.is_sandbox,
            account: config.fedex_account_number,
            enabledServices: config.enabled_services,
            serviceCount: enabledServices.length
          },
          auth: {
            success: !!authData?.access_token,
            cached: authData?.cached
          },
          directRateQuote: {
            servicesToTest: testShipment.serviceTypes,
            returned: rateData?.rates?.length || 0,
            data: rateData,
            error: rateError
          },
          multiCarrierQuote: {
            success: !multiCarrierError,
            error: multiCarrierError,
            data: multiCarrierData
          },
          carrierServices: {
            found: services?.length || 0,
            enabled: services?.filter(s => enabledServices.includes(s.service_code)) || [],
            data: services
          }
        }
      });

    } catch (error) {
      console.error('Debug test error:', error);
      setResult({
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        step: 'exception',
        details: { error }
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>FedEx Debug Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDebugTest} 
          disabled={testing}
          className="w-full"
        >
          {testing ? 'Running Debug Test...' : 'Run FedEx Debug Test'}
        </Button>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-semibold">
                  {result.success ? '✅ Test Completed' : '❌ Test Failed'}
                </div>
                <div>Step: {result.step}</div>
                {result.error && <div>Error: {result.error}</div>}
                <details className="text-xs">
                  <summary className="cursor-pointer">Debug Details</summary>
                  <pre className="mt-2 whitespace-pre-wrap">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};