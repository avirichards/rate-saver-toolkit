import { useState, useCallback } from 'react';
import { validateShipmentData, ShipmentValidationResult } from '@/utils/addressValidation';

export interface ValidationState {
  isValidating: boolean;
  results: Record<number, ShipmentValidationResult>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
}

export function useShipmentValidation() {
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: false,
    results: {},
    summary: { total: 0, valid: 0, invalid: 0, warnings: 0 }
  });

  const validateShipments = useCallback(async (shipments: any[]) => {
    setValidationState(prev => ({ ...prev, isValidating: true }));

    const results: Record<number, ShipmentValidationResult> = {};
    let valid = 0;
    let invalid = 0;
    let warnings = 0;

    // Validate each shipment
    for (let i = 0; i < shipments.length; i++) {
      const result = validateShipmentData(shipments[i]);
      results[i] = result;

      if (result.isValid) {
        valid++;
      } else {
        invalid++;
      }

      if (Object.keys(result.warnings).length > 0) {
        warnings++;
      }

      // Add small delay for UI responsiveness with large datasets
      if (i % 100 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    setValidationState({
      isValidating: false,
      results,
      summary: {
        total: shipments.length,
        valid,
        invalid,
        warnings
      }
    });

    return results;
  }, []);

  const getValidShipments = useCallback((shipments: any[]) => {
    return shipments.filter((_, index) => {
      const result = validationState.results[index];
      return result && result.isValid;
    });
  }, [validationState.results]);

  const getInvalidShipments = useCallback((shipments: any[]) => {
    const invalidShipments: any[] = [];
    shipments.forEach((shipment, index) => {
      const result = validationState.results[index];
      if (result && !result.isValid) {
        invalidShipments.push({
          shipment,
          errors: result.errors || {},
          warnings: result.warnings || {},
          originalIndex: index
        });
      }
    });
    return invalidShipments;
  }, [validationState.results]);

  const clearValidation = useCallback(() => {
    setValidationState({
      isValidating: false,
      results: {},
      summary: { total: 0, valid: 0, invalid: 0, warnings: 0 }
    });
  }, []);

  return {
    validationState,
    validateShipments,
    getValidShipments,
    getInvalidShipments,
    clearValidation
  };
}