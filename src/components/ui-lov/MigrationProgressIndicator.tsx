import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from './Button';
import { Database, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { validateAllAnalysesDataIntegrity } from '@/utils/dataIntegrityValidator';
import { migrateAllLegacyAnalyses } from '@/utils/migrateLegacyAnalyses';
import { toast } from 'sonner';

interface MigrationProgressIndicatorProps {
  onRefresh?: () => void;
}

export const MigrationProgressIndicator: React.FC<MigrationProgressIndicatorProps> = ({ onRefresh }) => {
  const [validationData, setValidationData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const checkDataIntegrity = async () => {
    setLoading(true);
    try {
      const result = await validateAllAnalysesDataIntegrity();
      setValidationData(result);
    } catch (error) {
      console.error('Data integrity check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const performMigration = async () => {
    setMigrating(true);
    try {
      const result = await migrateAllLegacyAnalyses();
      
      if (result.success > 0) {
        toast.success(`Successfully migrated ${result.success} analyses`);
        await checkDataIntegrity(); // Refresh data
        onRefresh?.();
      } else if (result.failed > 0) {
        toast.error(`Failed to migrate ${result.failed} analyses`);
      } else {
        toast.info('All analyses are already migrated');
      }
    } catch (error: any) {
      toast.error(`Migration failed: ${error.message}`);
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    checkDataIntegrity();
  }, []);

  if (!validationData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Checking data integrity...
          </div>
        </CardContent>
      </Card>
    );
  }

  const { totalAnalyses, passedValidation, failedValidation, criticalIssues } = validationData;
  const validationPercentage = totalAnalyses > 0 ? (passedValidation / totalAnalyses) * 100 : 100;
  const needsMigration = criticalIssues.filter((issue: string) => issue.includes('migration')).length;
  const hasDataIssues = criticalIssues.filter((issue: string) => issue.includes('missing')).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Health Dashboard
        </CardTitle>
        <CardDescription>
          Monitor and maintain data integrity across all analyses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{totalAnalyses}</div>
            <div className="text-sm text-muted-foreground">Total Analyses</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{passedValidation}</div>
            <div className="text-sm text-muted-foreground">Validated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{failedValidation}</div>
            <div className="text-sm text-muted-foreground">Need Attention</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Data Integrity</span>
            <span>{validationPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={validationPercentage} className="h-2" />
        </div>

        {criticalIssues.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Critical Issues ({criticalIssues.length})
            </div>
            <div className="space-y-1">
              {needsMigration > 0 && (
                <Badge variant="secondary" className="mr-2">
                  {needsMigration} need migration
                </Badge>
              )}
              {hasDataIssues > 0 && (
                <Badge variant="destructive" className="mr-2">
                  {hasDataIssues} missing data
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkDataIntegrity}
            disabled={loading}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Check
          </Button>
          
          {needsMigration > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={performMigration}
              disabled={migrating}
              className="flex-1"
            >
              <Database className="h-4 w-4 mr-2" />
              {migrating ? 'Migrating...' : 'Migrate All'}
            </Button>
          )}
        </div>

        {validationPercentage === 100 && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="h-4 w-4" />
            All analyses are healthy and up-to-date
          </div>
        )}
      </CardContent>
    </Card>
  );
};