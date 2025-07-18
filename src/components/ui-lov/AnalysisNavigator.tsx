import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui-lov/Button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Home, BarChart3, Table2 } from 'lucide-react';

export type AnalysisLevel = 1 | 2 | 3;

interface AnalysisNavigatorProps {
  currentLevel: AnalysisLevel;
  onLevelChange: (level: AnalysisLevel, filter?: string) => void;
  breadcrumb?: {
    accountName?: string;
    serviceType?: string;
  };
  versionInfo?: {
    current: number;
    total: number;
    hasUnsavedChanges: boolean;
  };
}

export function AnalysisNavigator({ 
  currentLevel, 
  onLevelChange, 
  breadcrumb = {},
  versionInfo
}: AnalysisNavigatorProps) {
  const levels = [
    {
      level: 1 as const,
      icon: Home,
      title: "Account Summary",
      description: "Overall performance ranking"
    },
    {
      level: 2 as const,
      icon: BarChart3,
      title: "Service Comparison",
      description: "Performance by service type"
    },
    {
      level: 3 as const,
      icon: Table2,
      title: "Shipment Details",
      description: "Individual shipment rates"
    }
  ];

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {levels.map((level, index) => (
            <React.Fragment key={level.level}>
              <Button
                variant={currentLevel === level.level ? "default" : "ghost"}
                size="sm"
                onClick={() => onLevelChange(level.level)}
                className="gap-2 h-8"
              >
                <level.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{level.title}</span>
              </Button>
              {index < levels.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {/* Breadcrumb */}
          {(breadcrumb.accountName || breadcrumb.serviceType) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Filtered by:</span>
              {breadcrumb.accountName && (
                <Badge variant="outline">{breadcrumb.accountName}</Badge>
              )}
              {breadcrumb.serviceType && (
                <Badge variant="outline">{breadcrumb.serviceType}</Badge>
              )}
            </div>
          )}

          {/* Version Info */}
          {versionInfo && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Version:</span>
              <Badge variant={versionInfo.hasUnsavedChanges ? "secondary" : "outline"}>
                {versionInfo.current} of {versionInfo.total}
                {versionInfo.hasUnsavedChanges && " (unsaved)"}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Level Description */}
      <div className="mt-2 text-sm text-muted-foreground">
        {levels.find(l => l.level === currentLevel)?.description}
      </div>
    </Card>
  );
}