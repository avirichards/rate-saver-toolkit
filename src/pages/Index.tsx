
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent } from '@/components/ui-lov/Card';
import { Package, TrendingUp, FileBarChart, Settings, ArrowRight } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded">
              <Package className="h-5 w-5" />
            </div>
            <span className="font-semibold text-lg tracking-tight">ShipRate Pro</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">Dashboard</Link>
            <Link to="/upload" className="text-sm font-medium hover:text-primary transition-colors">Analysis</Link>
            <Link to="/reports" className="text-sm font-medium hover:text-primary transition-colors">Reports</Link>
            <Link to="/settings" className="text-sm font-medium hover:text-primary transition-colors">Settings</Link>
          </div>
          <div>
            <Link to="/dashboard">
              <Button variant="primary" size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto">
        <section className="py-16 md:py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  Optimize Your 
                  <span className="text-primary"> Shipping Costs</span>
                </h1>
                
                <p className="text-lg text-muted-foreground max-w-lg">
                  Analyze your shipping data to identify cost-saving opportunities 
                  and negotiate better rates with carriers.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link to="/upload">
                    <Button 
                      variant="primary" 
                      size="lg"
                      iconRight={<ArrowRight className="ml-2 h-5 w-5" />}
                    >
                      Start Analysis
                    </Button>
                  </Link>
                  <Link to="/dashboard">
                    <Button 
                      variant="outline" 
                      size="lg"
                    >
                      View Dashboard
                    </Button>
                  </Link>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-3xl -z-10"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Cost Analysis</h3>
                      <p className="text-sm text-muted-foreground">Identify savings on all carrier services and routes</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <FileBarChart className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Detailed Reports</h3>
                      <p className="text-sm text-muted-foreground">Get comprehensive shipping performance metrics</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/80 backdrop-blur-sm md:translate-y-4">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Service Optimization</h3>
                      <p className="text-sm text-muted-foreground">Find the right carrier services for each package</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/80 backdrop-blur-sm md:translate-y-4">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Settings className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Custom Settings</h3>
                      <p className="text-sm text-muted-foreground">Configure analysis parameters to your needs</p>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="border-t py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="bg-primary text-primary-foreground p-1 rounded">
              <Package className="h-4 w-4" />
            </div>
            <span className="font-medium">ShipRate Pro</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ShipRate Pro. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
