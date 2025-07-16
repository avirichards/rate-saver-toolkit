import React from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: string;
  label: string;
  description: string;
}

interface ProgressIndicatorProps {
  title?: string;
  description?: string;
  value?: number;
  max?: number;
  showPercentage?: boolean;
  status?: 'processing' | 'completed' | 'error' | 'pending';
  className?: string;
  children?: React.ReactNode;
  // For AppLayout compatibility
  steps?: Step[];
  currentStep?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  title,
  description,
  value = 0,
  max = 100,
  showPercentage = true,
  status = 'processing',
  className,
  children,
  steps,
  currentStep
}) => {
  // If steps are provided, render step-based progress (for AppLayout)
  if (steps && currentStep) {
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isCompleted && "border-green-500 bg-green-500 text-white",
                  !isActive && !isCompleted && "border-muted-foreground text-muted-foreground"
                )}>
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="ml-3 text-sm">
                  <div className={cn(
                    "font-medium",
                    isActive && "text-primary",
                    isCompleted && "text-green-600",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}>
                    {step.label}
                  </div>
                  <div className="text-muted-foreground text-xs">{step.description}</div>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-px bg-border mx-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Original progress indicator functionality
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'pending':
        return 'text-muted-foreground';
      default:
        return 'text-primary';
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <h3 className={cn("font-medium", getStatusColor())}>{title}</h3>
        </div>
        {showPercentage && (
          <span className="text-sm text-muted-foreground">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      
      <div className="space-y-2">
        <Progress 
          value={percentage} 
          className={cn(
            "w-full",
            status === 'error' && "bg-red-100",
            status === 'completed' && "bg-green-100"
          )}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{value} of {max}</span>
          <span>{max - value} remaining</span>
        </div>
      </div>
      
      {children}
    </div>
  );
};