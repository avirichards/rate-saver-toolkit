import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui-lov/Button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, RotateCw, Settings } from 'lucide-react';
import { useUpsConnectivity } from '@/hooks/useUpsConnectivity';
import type { UpsTestResult } from '@/hooks/useUpsConnectivity';

interface UpsConnectivityStatusProps {
  className?: string;
  showDetails?: boolean;
  autoTest?: boolean;
}

export const UpsConnectivityStatus: React.FC<UpsConnectivityStatusProps> = ({ 
  className, 
  showDetails = true,
  autoTest = false 
}) => {
  const { testing, testUpsConnection } = useUpsConnectivity();
  const [testResult, setTestResult] = useState<UpsTestResult | null>(null);
  const [hasTestedOnMount, setHasTestedOnMount] = useState(false);

  const handleTest = async () => {
    setTestResult(null);
    const result = await testUpsConnection();
    setTestResult(result);
  };

  useEffect(() => {
    if (autoTest && !hasTestedOnMount && !testing) {
      setHasTestedOnMount(true);
      handleTest();
    }
  }, [autoTest, hasTestedOnMount, testing]);

  const getStatusVariant = () => {
    if (testing) return 'secondary';
    if (!testResult) return 'outline';
    return testResult.success ? 'default' : 'destructive';
  };

  const getStatusText = () => {
    if (testing) return 'Testing...';
    if (!testResult) return 'Not Tested';
    return testResult.success ? 'Connected' : 'Failed';
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant()} className="flex items-center gap-1">
            {testing ? (
              <RotateCw className="h-3 w-3 animate-spin" />
            ) : testResult?.success ? (
              <CheckCircle className="h-3 w-3" />
            ) : testResult && !testResult.success ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Settings className="h-3 w-3" />
            )}
            UPS API: {getStatusText()}
          </Badge>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testing}
          iconLeft={testing ? <RotateCw className="h-4 w-4 animate-spin" /> : undefined}
        >
          {testing ? 'Testing...' : 'Test'}
        </Button>
      </div>

      {showDetails && testResult && (
        <div className="mt-3">
          <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
              {testResult.message}
            </AlertDescription>
          </Alert>

          {testResult.details && (
            <div className="mt-2 p-3 bg-muted rounded-lg">
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
      )}
    </div>
  );
};