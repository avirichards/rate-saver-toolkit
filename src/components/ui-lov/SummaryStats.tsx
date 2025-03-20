
import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './Card';
import { TrendingDown, TrendingUp, DollarSign, Package, Truck } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  trend,
  trendValue,
  icon,
  className,
}) => {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h4 className="text-2xl font-bold mt-1">{value}</h4>
            
            {trend && trendValue && (
              <div className="flex items-center mt-1">
                {trend === 'up' && (
                  <TrendingUp className="h-4 w-4 text-app-green-500 mr-1" />
                )}
                {trend === 'down' && (
                  <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span 
                  className={cn(
                    "text-xs font-medium",
                    trend === 'up' && "text-app-green-500",
                    trend === 'down' && "text-red-500",
                    trend === 'neutral' && "text-muted-foreground"
                  )}
                >
                  {trendValue}
                </span>
              </div>
            )}
            
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface SummaryStatsProps {
  currentCost: number;
  potentialCost: number;
  savings: number;
  savingsPercentage: number;
  shipmentCount: number;
  className?: string;
}

export const SummaryStats: React.FC<SummaryStatsProps> = ({
  currentCost,
  potentialCost,
  savings,
  savingsPercentage,
  shipmentCount,
  className,
}) => {
  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      <StatCard
        title="Current Cost"
        value={formatCurrency(currentCost)}
        description="Total shipping spend"
        icon={<DollarSign className="h-5 w-5 text-amber-500" />}
      />
      <StatCard
        title="Optimized Cost"
        value={formatCurrency(potentialCost)}
        description="Potential new rate"
        icon={<DollarSign className="h-5 w-5 text-app-blue-500" />}
      />
      <StatCard
        title="Total Savings"
        value={formatCurrency(savings)}
        trend="down"
        trendValue={`${savingsPercentage.toFixed(1)}%`}
        description="Potential cost reduction"
        icon={<TrendingDown className="h-5 w-5 text-app-green-500" />}
      />
      <StatCard
        title="Shipments Analyzed"
        value={shipmentCount}
        description="Total packages reviewed"
        icon={<Package className="h-5 w-5 text-purple-500" />}
      />
    </div>
  );
};
