import React from 'react';
import { useParams } from 'react-router-dom';
import Results from './Results';

const ClientResults = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  
  return <Results isClientView={true} shareToken={shareToken} />;
};

export default ClientResults;