import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Database, AlertCircle } from 'lucide-react';

interface SimpleStatusIndicatorProps {
  status: 'ready' | 'needs-migration' | 'no-data';
  className?: string;
}

export const SimpleStatusIndicator: React.FC<SimpleStatusIndicatorProps> = ({ 
  status, 
  className = '' 
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'ready':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          label: 'Ready',
          color: 'text-green-600'
        };
      case 'needs-migration':
        return {
          variant: 'secondary' as const,
          icon: Database,
          label: 'Legacy Format',
          color: 'text-amber-600'
        };
      case 'no-data':
        return {
          variant: 'destructive' as const,
          icon: AlertCircle,
          label: 'No Data',
          color: 'text-red-600'
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: AlertCircle,
          label: 'Unknown',
          color: 'text-gray-600'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`gap-1 ${className}`}>
      <Icon className={`h-3 w-3 ${config.color}`} />
      {config.label}
    </Badge>
  );
};