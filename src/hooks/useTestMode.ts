import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useTestMode = () => {
  const [searchParams] = useSearchParams();
  const [isTestMode, setIsTestMode] = useState(false);
  
  useEffect(() => {
    const testParam = searchParams.get('test');
    const debugParam = searchParams.get('debug');
    const devParam = searchParams.get('dev');
    
    setIsTestMode(
      testParam === 'true' || 
      debugParam === 'true' || 
      devParam === 'true' ||
      process.env.NODE_ENV === 'development'
    );
  }, [searchParams]);
  
  return {
    isTestMode,
    isDevelopment: process.env.NODE_ENV === 'development'
  };
};