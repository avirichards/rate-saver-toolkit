
import React from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Package, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui-lov/Button';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="border-b bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between h-16 px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <Link to="/" className="flex md:hidden items-center gap-2">
                  <div className="bg-primary text-primary-foreground p-1 rounded">
                    <Package className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-base">ShipRate Pro</span>
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline"
                  size="sm"
                  iconLeft={<Menu className="h-4 w-4" />}
                >
                  Menu
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
