
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent } from '@/components/ui-lov/Card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, RotateCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Simulated analysis steps
const ANALYSIS_STEPS = [
  { id: 'parsing', label: 'Parsing shipping data', duration: 2000 },
  { id: 'rates', label: 'Retrieving current rates', duration: 3000 },
  { id: 'calculating', label: 'Calculating potential savings', duration: 2500 },
  { id: 'comparing', label: 'Comparing service options', duration: 2000 },
  { id: 'generating', label: 'Generating optimization report', duration: 1500 },
];

const Analysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    // In a real application, we would get the mapping and data from the state or context
    const state = location.state as { readyForAnalysis?: boolean } | null;
    
    if (!state || !state.readyForAnalysis) {
      // If no mapping was done, redirect to mapping page
      toast.error('Please map columns first');
      navigate('/mapping');
      return;
    }
    
    // Auto-start the analysis
    startAnalysis();
  }, [location, navigate]);
  
  const startAnalysis = () => {
    setIsAnalyzing(true);
    setCurrentStep(0);
    setProgress(0);
    setError(null);
    setIsComplete(false);
    
    // Simulate analysis process
    runAnalysisStep();
  };
  
  const runAnalysisStep = () => {
    if (currentStep >= ANALYSIS_STEPS.length) {
      setIsComplete(true);
      setIsAnalyzing(false);
      setProgress(100);
      return;
    }
    
    const step = ANALYSIS_STEPS[currentStep];
    const stepProgress = 100 / ANALYSIS_STEPS.length;
    let stepProgressInternal = 0;
    
    // Simulate progress within this step
    const progressInterval = setInterval(() => {
      stepProgressInternal += 5;
      const calculatedProgress = Math.min(
        ((currentStep * stepProgress) + (stepProgressInternal * stepProgress / 100)),
        100
      );
      setProgress(calculatedProgress);
      
      if (stepProgressInternal >= 100) {
        clearInterval(progressInterval);
        setCurrentStep(prev => prev + 1);
        
        // Simulate rare random error
        const randomError = Math.random() > 0.95;
        if (randomError) {
          setError('An error occurred during analysis. Please try again.');
          setIsAnalyzing(false);
          clearInterval(progressInterval);
          return;
        }
        
        // Move to next step
        setTimeout(() => {
          runAnalysisStep();
        }, 100);
      }
    }, step.duration / 20);
  };
  
  const handleViewResults = () => {
    navigate('/results');
  };
  
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-semibold mb-2">Analyzing Shipping Data</h1>
        <p className="text-muted-foreground mb-6">
          Please wait while we analyze your shipping data and calculate potential savings.
        </p>
        
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="mb-6">
              <div className="flex justify-between mb-2 items-center">
                <div className="text-sm font-medium">
                  {isComplete 
                    ? 'Analysis complete!' 
                    : isAnalyzing 
                      ? `${ANALYSIS_STEPS[currentStep]?.label || 'Processing'}...` 
                      : 'Ready to analyze'
                  }
                </div>
                <div className="text-sm font-medium">
                  {Math.round(progress)}%
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            <div className="space-y-4 mb-6">
              {ANALYSIS_STEPS.map((step, index) => {
                const isActive = index === currentStep && isAnalyzing;
                const isCompleted = index < currentStep || isComplete;
                
                return (
                  <div key={step.id} className="flex items-center">
                    <div className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center mr-3 ${
                      isActive ? 'bg-primary/20 text-primary' : 
                      isCompleted ? 'bg-green-100 text-green-600' : 
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : isActive ? (
                        <RotateCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>
                    <span className={`text-sm ${
                      isActive ? 'text-primary font-medium' : 
                      isCompleted ? 'text-green-600' : 
                      'text-muted-foreground'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-start mb-4">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Analysis Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              {error && (
                <Button onClick={startAnalysis} variant="primary">
                  Retry Analysis
                </Button>
              )}
              
              {isComplete && (
                <Button 
                  variant="primary" 
                  onClick={handleViewResults}
                  iconRight={<CheckCircle className="ml-1 h-4 w-4" />}
                >
                  View Results
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Analysis;
