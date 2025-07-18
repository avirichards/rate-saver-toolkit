import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Award, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui-lov/Button';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface RateOption {
  account: string;
  rate: number;
  savings: number;
  savingsPercent: number;
  isBest: boolean;
  isSelected: boolean;
}

interface ExpandableRateRowProps {
  shipment: any;
  rates: RateOption[];
  onRateSelect?: (shipmentId: number, account: string) => void;
  className?: string;
}

export const ExpandableRateRow: React.FC<ExpandableRateRowProps> = ({
  shipment,
  rates,
  onRateSelect,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getRateStatusColor = (rate: RateOption) => {
    if (rate.isBest) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (rate.isSelected) return 'text-blue-700 bg-blue-50 border-blue-200';
    return 'text-muted-foreground bg-muted/30 border-muted';
  };

  const getRateStatusIcon = (rate: RateOption) => {
    if (rate.isBest) return <Award className="h-3 w-3" />;
    if (rate.isSelected) return <DollarSign className="h-3 w-3" />;
    return null;
  };

  return (
    <div className={cn("", className)}>
      {/* Main row with expand button */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 w-6 p-0 flex-shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
        <span className="text-sm text-muted-foreground">
          {rates.length} rates available
        </span>
      </div>

      {/* Expanded rate comparison table */}
      {isExpanded && (
        <div className="mt-2 ml-8 border border-muted rounded-md bg-muted/20">
          <div className="p-3">
            <h4 className="text-sm font-medium mb-3">Rate Comparison</h4>
            <div className="space-y-2">
              {rates.map((rate, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center justify-between p-2 rounded border",
                    getRateStatusColor(rate)
                  )}
                >
                  <div className="flex items-center gap-2">
                    {getRateStatusIcon(rate)}
                    <span className="font-medium text-sm">{rate.account}</span>
                    {rate.isBest && (
                      <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">
                        Best
                      </Badge>
                    )}
                    {rate.isSelected && !rate.isBest && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                        Selected
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium">
                      {formatCurrency(rate.rate)}
                    </span>
                    
                    <div className="text-right min-w-20">
                      <div className={cn(
                        "text-xs font-medium",
                        rate.savings > 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {rate.savings > 0 ? "+" : ""}{formatCurrency(rate.savings)}
                      </div>
                      <div className={cn(
                        "text-xs",
                        rate.savings > 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {formatPercentage(rate.savingsPercent)}
                      </div>
                    </div>
                    
                    {onRateSelect && (
                      <Button
                        variant={rate.isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => onRateSelect(shipment.id, rate.account)}
                        className="h-7 text-xs"
                        disabled={rate.isSelected}
                      >
                        {rate.isSelected ? "Selected" : "Select"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {rates.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No rate data available for this shipment
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};