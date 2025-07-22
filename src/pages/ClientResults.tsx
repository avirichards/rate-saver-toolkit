import React from 'react';
import { useParams } from 'react-router-dom';
import Results from './Results';

interface ClientResultsProps {
  isClientView?: boolean;
  shareToken?: string;
}

const ClientResults: React.FC<ClientResultsProps> = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  
  return <Results isClientView={true} shareToken={shareToken} />;
};

export default ClientResults;