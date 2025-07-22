
import React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useBackgroundAnalysis } from '@/hooks/useBackgroundAnalysis';

interface BackgroundAnalysisProgressProps {
  analysisId: string;
  onComplete?: (analysisId: string) => void;
  onError?: (error: string) => void;
}

export const BackgroundAnalysisProgress: React.FC<BackgroundAnalysisProgressProps> = ({
  analysisId,
  onComplete,
  onError
}) => {
  const { analysisStatus, error } = useBackgroundAnalysis(analysisId);

  React.useEffect(() => {
    if (analysisStatus?.status === 'completed' && onComplete) {
      onComplete(analysisId);
    }
    if (analysisStatus?.status === 'failed' && onError) {
      onError(analysisStatus.processing_metadata?.error || 'Analysis failed');
    }
    if (error && onError) {
      onError(error);
    }
  }, [analysisStatus?.status, error, analysisId, onComplete, onError]);

  if (!analysisStatus) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>
            <h3 className="font-medium">Initializing Analysis</h3>
            <p className="text-sm text-muted-foreground">Setting up background processing...</p>
          </div>
        </div>
      </Card>
    );
  }

  const metadata = analysisStatus.processing_metadata || {};
  const progressPercentage = metadata.progressPercentage || 0;
  const currentShipment = metadata.currentShipment || 0;
  const completedShipments = metadata.completedShipments || 0;
  const errorShipments = metadata.errorShipments || 0;
  const totalShipments = analysisStatus.total_shipments;

  const getStatusIcon = () => {
    switch (analysisStatus.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (analysisStatus.status) {
      case 'completed':
        return 'Analysis Complete';
      case 'failed':
        return 'Analysis Failed';
      case 'processing':
        return metadata.status === 'finalizing' ? 'Finalizing Results' : 'Processing Shipments';
      default:
        return 'Preparing Analysis';
    }
  };

  const getProgressText = () => {
    if (analysisStatus.status === 'completed') {
      return `Completed ${completedShipments} of ${totalShipments} shipments`;
    }
    if (analysisStatus.status === 'failed') {
      return metadata.error || 'Analysis failed';
    }
    if (metadata.status === 'finalizing') {
      return 'Saving results and generating recommendations...';
    }
    return `Processing shipment ${currentShipment} of ${totalShipments}`;
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-medium">{getStatusText()}</h3>
            <p className="text-sm text-muted-foreground">{getProgressText()}</p>
          </div>
        </div>

        {analysisStatus.status === 'processing' && (
          <div className="space-y-2">
            <Progress value={progressPercentage} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progressPercentage}% complete</span>
              <span>{completedShipments} processed, {errorShipments} errors</span>
            </div>
          </div>
        )}

        {analysisStatus.status === 'completed' && analysisStatus.total_savings && (
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-green-800">
              Total Potential Savings: ${analysisStatus.total_savings.toFixed(2)}
            </p>
          </div>
        )}

        {analysisStatus.status === 'failed' && (
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-red-800">
              {metadata.error || 'An error occurred during processing'}
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Analysis ID: {analysisId}
        </div>
      </div>
    </Card>
  );
};
