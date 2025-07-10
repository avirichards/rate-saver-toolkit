import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, DollarSign, Clock, Calendar } from "lucide-react";

interface Rate {
  serviceCode: string;
  serviceName: string;
  description?: string;
  totalCharges: number;
  currency: string;
  transitTime?: number;
  deliveryDate?: string;
  rateType?: string;
  hasNegotiatedRates?: boolean;
  publishedRate?: number;
  negotiatedRate?: number;
  savingsAmount?: number;
  savingsPercentage?: number;
}

interface RateDisplayProps {
  rates: Rate[];
  className?: string;
}

export function RateDisplay({ rates, className }: RateDisplayProps) {
  if (!rates || rates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No rates available
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {rates.map((rate, index) => (
        <Card key={`${rate.serviceCode}-${index}`} className="hover:bg-accent/5 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium text-foreground">{rate.serviceName}</h3>
                  {rate.description && (
                    <p className="text-sm text-muted-foreground">{rate.description}</p>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-lg font-semibold text-foreground">
                    ${rate.totalCharges.toFixed(2)}
                  </span>
                  <Badge 
                    variant={rate.rateType === 'negotiated' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {rate.rateType === 'negotiated' ? 'Negotiated' : 'Published'}
                  </Badge>
                </div>
                
                {rate.hasNegotiatedRates && rate.savingsAmount && rate.savingsAmount > 0 && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    Saved ${rate.savingsAmount.toFixed(2)} ({rate.savingsPercentage?.toFixed(1)}%)
                  </div>
                )}
                
                {!rate.hasNegotiatedRates && rate.publishedRate && (
                  <div className="text-xs text-muted-foreground">
                    Published rate
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
              {rate.transitTime && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {rate.transitTime} day{rate.transitTime !== 1 ? 's' : ''}
                </div>
              )}
              {rate.deliveryDate && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {rate.deliveryDate}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}