import React, { useState } from 'react';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Truck, CheckCircle, AlertCircle, RotateCw } from 'lucide-react';
import { useFedexConnectivity } from '@/hooks/useFedexConnectivity';
import type { FedexTestResult } from '@/hooks/useFedexConnectivity';

interface FedexTestButtonProps {
  className?: string;
}

export const FedexTestButton: React.FC<FedexTestButtonProps> = ({ className }) => {
  const { testing, testFedexConnection } = useFedexConnectivity();
  const [testResult, setTestResult] = useState<FedexTestResult | null>(null);

  const handleTest = async () => {
    setTestResult(null);
    const result = await testFedexConnection();
    setTestResult(result);
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            FedEx API Connectivity Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test your FedEx API connection and configuration before running analysis.
            </p>
            
            <Button
              onClick={handleTest}
              disabled={testing}
              iconLeft={testing ? <RotateCw className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            >
              {testing ? 'Testing Connection...' : 'Test FedEx Connection'}
            </Button>

            {testResult && (
              <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                    {testResult.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {testResult?.details && (
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <h4 className="font-medium text-sm mb-2">Test Details:</h4>
                <div className="space-y-2">
                  {testResult.details.config && (
                    <div className="flex items-center gap-2">
                      <Badge variant={testResult.details.config.sandbox ? 'secondary' : 'default'}>
                        {testResult.details.config.sandbox ? 'Sandbox' : 'Production'}
                      </Badge>
                      {testResult.details.config.hasAccount && (
                        <Badge variant="outline">Account Configured</Badge>
                      )}
                    </div>
                  )}
                  {testResult.details.testRates && (
                    <p className="text-xs text-muted-foreground">
                      Found {testResult.details.testRates.length} test rates
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};