import React from 'react';
import { Card, CardContent } from './Card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { Save, Undo2, TrendingUp, TrendingDown, DollarSign, Package } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface RecalcDelta {
  shipmentCount: number;
  costDelta: number;
  savingsDelta: number;
  savingsPercentDelta: number;
}

interface StickyRecalcBarProps {
  delta: RecalcDelta;
  isVisible: boolean;
  onSave: () => void;
  onUndo: () => void;
  isSaving?: boolean;
  className?: string;
}

export const StickyRecalcBar: React.FC<StickyRecalcBarProps> = ({
  delta,
  isVisible,
  onSave,
  onUndo,
  isSaving = false,
  className
}) => {
  if (!isVisible) return null;

  const getDeltaColor = (value: number) => {
    if (value > 0) return 'text-emerald-600';
    if (value < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getDeltaIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-3 w-3" />;
    if (value < 0) return <TrendingDown className="h-3 w-3" />;
    return null;
  };

  const formatDelta = (value: number, isPercentage = false) => {
    const sign = value >= 0 ? '+' : '';
    return isPercentage ? 
      `${sign}${formatPercentage(value)}` : 
      `${sign}${formatCurrency(Math.abs(value))}`;
  };

  return (
    <div className={cn(
      "fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4",
      className
    )}>
      <Card className="shadow-lg border-2 bg-background/95 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {delta.shipmentCount} shipments modified
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cost Impact:</span>
                  <span className={cn("text-sm font-medium", getDeltaColor(delta.costDelta))}>
                    {formatDelta(delta.costDelta)}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  {getDeltaIcon(delta.savingsDelta)}
                  <span className="text-sm text-muted-foreground">Savings:</span>
                  <span className={cn("text-sm font-medium", getDeltaColor(delta.savingsDelta))}>
                    {formatDelta(delta.savingsDelta)}
                  </span>
                  <Badge variant="outline" className={cn("text-xs", getDeltaColor(delta.savingsPercentDelta))}>
                    {formatDelta(delta.savingsPercentDelta, true)}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onUndo}
                disabled={isSaving}
                className="gap-1"
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={isSaving}
                className="gap-1"
              >
                <Save className="h-3 w-3" />
                {isSaving ? 'Saving...' : 'Save Assignments'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};