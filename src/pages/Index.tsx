
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui-lov/Button';
import { Card, CardContent } from '@/components/ui-lov/Card';
import { 
  Upload, 
  TrendingDown, 
  BarChart3, 
  FileText, 
  Share, 
  ArrowRight, 
  Package, 
  Truck 
} from 'lucide-react';
import { motion } from 'framer-motion';

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <Card className="h-full">
    <CardContent className="p-6">
      <div className="w-12 h-12 rounded-lg bg-app-blue-100 flex items-center justify-center text-app-blue-500 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </CardContent>
  </Card>
);

const Index = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.165, 0.84, 0.44, 1],
      },
    },
  };

  return (
    <AppLayout showProgress={false} showBackButton={false}>
      <motion.div
        className="flex flex-col items-center text-center max-w-3xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants} className="mb-2">
          <div className="inline-flex items-center px-3 py-1 bg-app-blue-100 text-app-blue-600 rounded-full text-sm mb-4">
            <Package className="w-4 h-4 mr-1" />
            Shipping Rate Optimization
          </div>
        </motion.div>
        
        <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl font-semibold mb-4 leading-tight">
          Analyze & Optimize <span className="text-app-blue-500">Shipping Costs</span>
        </motion.h1>

        <motion.p variants={itemVariants} className="text-xl text-muted-foreground mb-8 max-w-2xl">
          Upload your shipping data to discover potential savings and optimize your logistics spend.
        </motion.p>

        <motion.div variants={itemVariants}>
          <Button 
            variant="primary" 
            size="xl"
            iconRight={<ArrowRight className="ml-1 h-5 w-5" />}
            onClick={() => navigate('/upload')}
            className="mb-10"
          >
            Start Analysis
          </Button>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full mb-16">
          <div className="bg-gradient-to-b from-gray-50 to-white border rounded-xl overflow-hidden shadow-card">
            <img 
              src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
              alt="Shipping Analysis Dashboard" 
              className="w-full h-auto object-cover"
            />
          </div>
        </motion.div>

        <motion.h2 variants={itemVariants} className="text-2xl font-medium mb-8 mt-6">
          Powerful Features to Optimize Your Shipping
        </motion.h2>

        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          <FeatureCard 
            icon={<Upload className="h-6 w-6" />}
            title="Simple CSV Upload"
            description="Easily upload your shipping data in CSV format for quick analysis"
          />
          <FeatureCard 
            icon={<TrendingDown className="h-6 w-6" />}
            title="Cost Savings Analysis"
            description="Compare current rates against negotiated rates to identify savings"
          />
          <FeatureCard 
            icon={<BarChart3 className="h-6 w-6" />}
            title="Detailed Reporting"
            description="Visualize your shipping patterns and opportunities for optimization"
          />
          <FeatureCard 
            icon={<FileText className="h-6 w-6" />}
            title="Export & Share"
            description="Export analysis results as CSV or share them with your team"
          />
          <FeatureCard 
            icon={<Truck className="h-6 w-6" />}
            title="Service Comparison"
            description="Compare costs across different service types and shipping methods"
          />
          <FeatureCard 
            icon={<Share className="h-6 w-6" />}
            title="Real-time Rate API"
            description="Connect to shipping APIs for accurate real-time rate comparison"
          />
        </motion.div>
      </motion.div>
    </AppLayout>
  );
};

export default Index;
