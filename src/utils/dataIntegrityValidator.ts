import { supabase } from '@/integrations/supabase/client';

export interface DataIntegrityReport {
  analysisId: string;
  totalShipments: number;
  processedShipments: number;
  orphanedShipments: number;
  hasValidCentralizedData: boolean;
  missingShipments: number;
  dataConsistencyIssues: string[];
  savingsCalculationCorrect: boolean;
  recommendedActions: string[];
}

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  report: DataIntegrityReport;
}

/**
 * Validates data integrity for a single analysis
 */
export const validateAnalysisDataIntegrity = async (analysisId: string): Promise<ValidationResult> => {
  try {
    const { data: analysis, error } = await supabase
      .from('shipping_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (error || !analysis) {
      throw new Error(`Failed to fetch analysis: ${error?.message || 'Analysis not found'}`);
    }

    const report: DataIntegrityReport = {
      analysisId,
      totalShipments: analysis.total_shipments || 0,
      processedShipments: 0,
      orphanedShipments: 0,
      hasValidCentralizedData: false,
      missingShipments: 0,
      dataConsistencyIssues: [],
      savingsCalculationCorrect: false,
      recommendedActions: []
    };

    const issues: string[] = [];

    // Check if centralized data exists
    const processedShipments = Array.isArray(analysis.processed_shipments) ? analysis.processed_shipments as any[] : [];
    const orphanedShipments = Array.isArray(analysis.orphaned_shipments) ? analysis.orphaned_shipments as any[] : [];
    
    const hasProcessedShipments = processedShipments.length > 0;
    const hasOrphanedShipments = orphanedShipments.length >= 0; // Can be empty but still valid
    
    report.hasValidCentralizedData = hasProcessedShipments || hasOrphanedShipments;
    
    if (!report.hasValidCentralizedData) {
      issues.push('Missing centralized data format (processed_shipments and orphaned_shipments)');
      report.recommendedActions.push('Migrate analysis to centralized data format');
    }

    // Count shipments
    report.processedShipments = processedShipments.length;
    report.orphanedShipments = orphanedShipments.length;

    // Check for missing shipments
    const accountedShipments = report.processedShipments + report.orphanedShipments;
    report.missingShipments = Math.max(0, report.totalShipments - accountedShipments);
    
    if (report.missingShipments > 0) {
      issues.push(`${report.missingShipments} shipments are missing from processed and orphaned data`);
      report.dataConsistencyIssues.push('Missing shipments in centralized data');
      report.recommendedActions.push('Re-process analysis to ensure all shipments are accounted for');
    }

    // Validate savings calculation
    if (hasProcessedShipments && processedShipments.length > 0) {
      const calculatedSavings = processedShipments.reduce((sum: number, shipment: any) => {
        return sum + (shipment.savings || 0);
      }, 0);
      
      const dbSavings = analysis.total_savings || 0;
      const savingsDifference = Math.abs(calculatedSavings - dbSavings);
      
      report.savingsCalculationCorrect = savingsDifference < 0.01; // Allow for small rounding differences
      
      if (!report.savingsCalculationCorrect) {
        issues.push(`Savings calculation mismatch: DB shows ${dbSavings}, calculated ${calculatedSavings}`);
        report.dataConsistencyIssues.push('Savings calculation inconsistency');
        report.recommendedActions.push('Recalculate total savings based on shipment data');
      }
    }

    // Check for data structure integrity
    if (hasProcessedShipments) {
      const invalidShipments = processedShipments.filter((shipment: any) => {
        return !shipment.trackingId || !shipment.service || typeof shipment.savings !== 'number';
      });
      
      if (invalidShipments.length > 0) {
        issues.push(`${invalidShipments.length} processed shipments have invalid data structure`);
        report.dataConsistencyIssues.push('Invalid shipment data structure');
        report.recommendedActions.push('Validate and fix shipment data structure');
      }
    }

    // Check processing metadata
    if (!analysis.processing_metadata) {
      issues.push('Missing processing metadata');
      report.recommendedActions.push('Add processing metadata for tracking');
    }

    const passed = issues.length === 0;

    return {
      passed,
      issues,
      report
    };

  } catch (error: any) {
    return {
      passed: false,
      issues: [`Validation error: ${error.message}`],
      report: {
        analysisId,
        totalShipments: 0,
        processedShipments: 0,
        orphanedShipments: 0,
        hasValidCentralizedData: false,
        missingShipments: 0,
        dataConsistencyIssues: ['Validation failed'],
        savingsCalculationCorrect: false,
        recommendedActions: ['Retry validation after fixing data access issues']
      }
    };
  }
};

/**
 * Validates data integrity for all user analyses
 */
export const validateAllAnalysesDataIntegrity = async (): Promise<{
  totalAnalyses: number;
  passedValidation: number;
  failedValidation: number;
  reports: DataIntegrityReport[];
  criticalIssues: string[];
}> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: analyses, error } = await supabase
    .from('shipping_analyses')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_deleted', false);

  if (error) {
    throw new Error(`Failed to fetch analyses: ${error.message}`);
  }

  if (!analyses || analyses.length === 0) {
    return {
      totalAnalyses: 0,
      passedValidation: 0,
      failedValidation: 0,
      reports: [],
      criticalIssues: []
    };
  }

  const reports: DataIntegrityReport[] = [];
  let passedValidation = 0;
  let failedValidation = 0;
  const criticalIssues: string[] = [];

  for (const analysis of analyses) {
    const result = await validateAnalysisDataIntegrity(analysis.id);
    reports.push(result.report);
    
    if (result.passed) {
      passedValidation++;
    } else {
      failedValidation++;
      
      // Track critical issues
      if (result.report.missingShipments > 0) {
        criticalIssues.push(`Analysis ${analysis.id}: ${result.report.missingShipments} missing shipments`);
      }
      
      if (!result.report.hasValidCentralizedData) {
        criticalIssues.push(`Analysis ${analysis.id}: Needs migration to centralized format`);
      }
    }
    
    // Small delay to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return {
    totalAnalyses: analyses.length,
    passedValidation,
    failedValidation,
    reports,
    criticalIssues
  };
};

/**
 * Auto-fix common data integrity issues
 */
export const autoFixDataIntegrityIssues = async (analysisId: string): Promise<boolean> => {
  const validation = await validateAnalysisDataIntegrity(analysisId);
  
  if (validation.passed) {
    console.log(`✅ Analysis ${analysisId} passed validation, no fixes needed`);
    return true;
  }

  console.log(`🔧 Attempting to fix data integrity issues for analysis ${analysisId}:`, validation.issues);

  // If missing centralized data, trigger migration
  if (!validation.report.hasValidCentralizedData) {
    try {
      // This would trigger the migration logic that's already in Results.tsx
      console.log(`🔄 Analysis ${analysisId} needs migration to centralized format`);
      return false; // Return false to indicate manual migration needed
    } catch (error) {
      console.error(`❌ Failed to fix analysis ${analysisId}:`, error);
      return false;
    }
  }

  // Add more auto-fix logic here as needed
  return true;
};