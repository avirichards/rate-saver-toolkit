
import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, Circle } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface ProgressIndicatorProps {
  steps: Step[];
  currentStep: string;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep,
  className,
}) => {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* Progress Bar */}
        <div className="absolute top-[22px] left-0 right-0 h-1 bg-gray-200">
          <div 
            className="h-full bg-app-blue-500 transition-all duration-500 ease-in-out" 
            style={{ 
              width: `${Math.max(0, ((currentStepIndex) / (steps.length - 1)) * 100)}%` 
            }}
          />
        </div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div key={step.id} className="flex flex-col items-center">
                <div className="relative">
                  {isCompleted ? (
                    <CheckCircle className="h-11 w-11 text-app-blue-500 bg-white rounded-full transition-all duration-300" />
                  ) : (
                    <div className={cn(
                      "h-11 w-11 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                      isCurrent 
                        ? "border-app-blue-500 text-app-blue-500 bg-app-blue-50" 
                        : "border-gray-300 text-gray-400"
                    )}>
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 text-center">
                  <p className={cn(
                    "text-sm font-medium transition-colors duration-300",
                    isCurrent ? "text-app-blue-700" : isCompleted ? "text-app-blue-500" : "text-gray-500"
                  )}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground max-w-[120px] text-center">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
