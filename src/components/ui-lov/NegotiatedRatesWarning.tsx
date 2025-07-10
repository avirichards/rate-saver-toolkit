import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface NegotiatedRatesWarningProps {
  hasAccount: boolean;
  hasNegotiatedRates?: boolean;
  className?: string;
}

export function NegotiatedRatesWarning({ 
  hasAccount, 
  hasNegotiatedRates, 
  className 
}: NegotiatedRatesWarningProps) {
  if (hasAccount && hasNegotiatedRates) {
    return (
      <Alert className={`border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          Great! You're getting negotiated rates with additional savings.
        </AlertDescription>
      </Alert>
    );
  }

  if (!hasAccount) {
    return (
      <Alert className={`border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Missing UPS Account Number:</strong> Add your UPS account number in Settings to access negotiated rates and potential savings.
        </AlertDescription>
      </Alert>
    );
  }

  if (hasAccount && !hasNegotiatedRates) {
    return (
      <Alert className={`border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          You're seeing published rates. Contact UPS to set up negotiated rates for potential savings.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}