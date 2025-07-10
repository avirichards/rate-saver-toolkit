import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  lastChecked?: Date;
}

interface SystemHealthIndicatorProps {
  healthChecks: HealthCheck[];
  className?: string;
}

export const SystemHealthIndicator: React.FC<SystemHealthIndicatorProps> = ({
  healthChecks,
  className
}) => {
  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-800 bg-green-100 border-green-200';
      case 'warning':
        return 'text-yellow-800 bg-yellow-100 border-yellow-200';
      case 'error':
        return 'text-red-800 bg-red-100 border-red-200';
    }
  };

  const overallStatus = healthChecks.some(check => check.status === 'error') 
    ? 'error' 
    : healthChecks.some(check => check.status === 'warning')
    ? 'warning'
    : 'healthy';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon(overallStatus)}
          System Health
          <Badge 
            variant="outline" 
            className={getStatusColor(overallStatus)}
          >
            {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {healthChecks.map((check, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
              <div className="flex items-center gap-3">
                {getStatusIcon(check.status)}
                <div>
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
              {check.lastChecked && (
                <p className="text-xs text-muted-foreground">
                  {check.lastChecked.toLocaleTimeString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};