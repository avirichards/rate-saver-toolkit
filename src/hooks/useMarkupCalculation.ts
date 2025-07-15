import { useMemo } from 'react';
import type { MarkupConfig } from './useShippingAnalyses';

export interface ShipmentResult {
  shipment: any;
  currentCost: number;
  bestRate?: {
    service: string;
    serviceCode: string;
    cost: number;
    savings: number;
  };
  upsRates?: any[];
}

export interface CalculatedResult extends ShipmentResult {
  baseUpsRate: number;
  markupAmount: number;
  finalRate: number;
  savings: number;
  markupPercentage: number;
}

export function useMarkupCalculation(
  results: ShipmentResult[],
  markupConfig: MarkupConfig
) {
  const calculatedResults = useMemo(() => {
    return results.map((result): CalculatedResult => {
      const baseUpsRate = result.bestRate?.cost || 0;
      let markupPercentage = 0;

      if (markupConfig.type === 'global') {
        markupPercentage = markupConfig.globalPercentage || 0;
      } else if (markupConfig.type === 'per-service' && result.bestRate?.service) {
        markupPercentage = markupConfig.serviceMarkups?.[result.bestRate.service] || 0;
      }

      const markupAmount = (baseUpsRate * markupPercentage) / 100;
      const finalRate = baseUpsRate + markupAmount;
      const savings = result.currentCost - finalRate;

      return {
        ...result,
        baseUpsRate,
        markupAmount,
        finalRate,
        savings,
        markupPercentage
      };
    });
  }, [results, markupConfig]);

  const totals = useMemo(() => {
    const totalCurrentCost = calculatedResults.reduce((sum, r) => sum + r.currentCost, 0);
    const totalBaseUpsRate = calculatedResults.reduce((sum, r) => sum + r.baseUpsRate, 0);
    const totalMarkupAmount = calculatedResults.reduce((sum, r) => sum + r.markupAmount, 0);
    const totalFinalRate = calculatedResults.reduce((sum, r) => sum + r.finalRate, 0);
    const totalSavings = calculatedResults.reduce((sum, r) => sum + r.savings, 0);

    return {
      totalCurrentCost,
      totalBaseUpsRate,
      totalMarkupAmount,
      totalFinalRate,
      totalSavings,
      savingsPercentage: totalCurrentCost > 0 ? (totalSavings / totalCurrentCost) * 100 : 0,
      totalMargin: totalMarkupAmount,
      marginPercentage: totalFinalRate > 0 ? (totalMarkupAmount / totalFinalRate) * 100 : 0
    };
  }, [calculatedResults]);

  return {
    calculatedResults,
    totals
  };
}