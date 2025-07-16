import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui-lov/Button';

interface ClientLayoutProps {
  children: React.ReactNode;
  onBack?: () => void;
  title?: string;
  showBackButton?: boolean;
}

export const ClientLayout: React.FC<ClientLayoutProps> = ({ 
  children, 
  onBack, 
  title = "Shipping Analysis Results",
  showBackButton = false 
}) => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {showBackButton && onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <h1 className="text-xl font-semibold">{title}</h1>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};