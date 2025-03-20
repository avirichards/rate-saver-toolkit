
import React from 'react';
import { cn } from '@/lib/utils';
import { Toaster } from 'sonner';
import { useLocation, Link } from 'react-router-dom';
import { ProgressIndicator, type Step } from '../ui-lov/ProgressIndicator';
import { Package, ArrowLeft } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  showProgress?: boolean;
  showBackButton?: boolean;
  backButtonUrl?: string;
  className?: string;
}

const steps: Step[] = [
  { id: 'upload', label: 'Upload', description: 'Upload shipping data' },
  { id: 'mapping', label: 'Map Columns', description: 'Match CSV columns' },
  { id: 'analysis', label: 'Analysis', description: 'Process data' },
  { id: 'results', label: 'Results', description: 'View savings' },
];

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  showProgress = false,
  showBackButton = true,
  backButtonUrl = '/',
  className,
}) => {
  const location = useLocation();
  
  // Determine the current step based on the URL path
  const getCurrentStep = () => {
    const path = location.pathname;
    if (path.includes('/upload')) return 'upload';
    if (path.includes('/mapping')) return 'mapping';
    if (path.includes('/analysis')) return 'analysis';
    if (path.includes('/results')) return 'results';
    return 'upload'; // Default to upload if not found
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="layout-container py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-app-blue-500 text-white p-1.5 rounded">
              <Package className="h-5 w-5" />
            </div>
            <span className="font-medium text-lg tracking-tight">ShipRate Optimizer</span>
          </Link>
        </div>
      </header>
      
      <main className={cn("layout-container py-8", className)}>
        {showProgress && (
          <div className="mb-8">
            <ProgressIndicator 
              steps={steps} 
              currentStep={getCurrentStep()} 
            />
          </div>
        )}
        
        {showBackButton && location.pathname !== '/' && (
          <Link 
            to={backButtonUrl} 
            className="inline-flex items-center mb-4 text-sm text-muted-foreground hover:text-app-blue-500 transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        )}
        
        {children}
      </main>
      
      <footer className="mt-auto border-t bg-white">
        <div className="layout-container py-6">
          <div className="text-sm text-muted-foreground text-center">
            <p>© {new Date().getFullYear()} ShipRate Optimizer. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      <Toaster 
        position="top-right"
        closeButton
        toastOptions={{
          duration: 4000,
          className: 'toast-style',
        }}
      />
    </div>
  );
};
