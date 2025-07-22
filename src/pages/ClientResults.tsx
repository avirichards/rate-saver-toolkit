import React from 'react';
import { useParams } from 'react-router-dom';
import Results from './Results';

const ClientResults = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  
  return <Results />;
};

export default ClientResults;