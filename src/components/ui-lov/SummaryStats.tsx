
import React from 'react';
import { Card, CardContent } from './Card';
import { cn } from '@/lib/utils';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

export interface SummaryStatsProps {
  title?: string;
  value?: string | number;
  description?: string;
  trend?: string;
  icon?: React.ReactNode;
  color?: string;
  className?: string;
}

export const SummaryStats: React.FC<SummaryStatsProps> = ({
  title,
  value,
  description,
  trend,
  icon,
  color = 'blue',
  className,
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    
    if (trend === 'up') {
      return <ArrowUpIcon className="h-3 w-3 text-emerald-500" />;
    } else if (trend === 'down') {
      return <ArrowDownIcon className="h-3 w-3 text-red-500" />;
    }
    return null;
  };
  
  const getColorClasses = () => {
    switch (color) {
      case 'blue':
        return {
          iconBg: 'bg-blue-100 dark:bg-blue-900/30',
          iconColor: 'text-blue-500 dark:text-blue-400',
        };
      case 'green':
        return {
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
          iconColor: 'text-emerald-500 dark:text-emerald-400',
        };
      case 'red':
        return {
          iconBg: 'bg-red-100 dark:bg-red-900/30',
          iconColor: 'text-red-500 dark:text-red-400',
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-100 dark:bg-amber-900/30',
          iconColor: 'text-amber-500 dark:text-amber-400',
        };
      case 'purple':
        return {
          iconBg: 'bg-purple-100 dark:bg-purple-900/30',
          iconColor: 'text-purple-500 dark:text-purple-400',
        };
      default:
        return {
          iconBg: 'bg-gray-100 dark:bg-gray-800',
          iconColor: 'text-gray-500 dark:text-gray-400',
        };
    }
  };
  
  const { iconBg, iconColor } = getColorClasses();
  
  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <h4 className="text-2xl font-bold tracking-tight">{value}</h4>
            
            {description && (
              <div className="flex items-center mt-1 space-x-1">
                {getTrendIcon()}
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            )}
          </div>
          
          {icon && (
            <div className={cn("p-2 rounded-full", iconBg)}>
              <div className={cn("h-5 w-5", iconColor)}>
                {icon}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
