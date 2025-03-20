
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui-lov/Button';
import { Home } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  React.useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="bg-white p-8 rounded-xl shadow-subtle border">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-red-500 text-4xl font-bold">404</span>
          </div>
          
          <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
          <p className="text-muted-foreground mb-6">
            Sorry, we couldn't find the page you're looking for. The page might have been removed or the URL might be incorrect.
          </p>
          
          <Button 
            variant="primary" 
            className="mx-auto"
            iconLeft={<Home className="h-4 w-4" />}
            asChild
          >
            <Link to="/">Return Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
