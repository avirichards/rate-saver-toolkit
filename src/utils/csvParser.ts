import { UniversalServiceCategory } from './universalServiceCategories';
import { mapServiceToServiceCode } from './serviceMapping';
import { getCarrierServiceCode, CarrierType } from './carrierServiceRegistry';

export interface CSVParseResult {
  headers: string[];
  data: any[];
  rowCount: number;
}

export interface FieldMapping {
  fieldName: string;
  csvHeader: string;
  confidence: number;
  isAutoDetected: boolean;
}

export interface ServiceMapping {
  original: string;
  standardized: string;
  standardizedService: UniversalServiceCategory; // Add enum for new system
  confidence: number;
  serviceCode?: string; // Backward compatibility - will be removed once all components updated
  isResidential?: boolean; // For all services
  residentialSource?: string; // How residential status was determined
  isResidentialDetected?: boolean; // Auto-detected from service name
  residentialDetectionSource?: 'service_name' | 'address_pattern' | 'csv_data' | 'manual';
}

// Removed auto-detection patterns - manual mapping only

export function parseCSV(csvContent: string): CSVParseResult {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse headers from first line
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const data = lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });

  return {
    headers,
    data,
    rowCount: data.length
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Removed auto-detection functions - manual mapping only

export function detectServiceTypes(data: any[], serviceColumn: string): ServiceMapping[] {
  const uniqueServices = [...new Set(data.map(row => row[serviceColumn]).filter(Boolean))];
  
  return uniqueServices.map(service => {
    const serviceMapping = mapServiceToServiceCode(service);
    
    // Get UPS service code for backward compatibility
    const upsCode = getCarrierServiceCode(CarrierType.UPS, serviceMapping.standardizedService);
    
    return {
      original: service,
      standardized: serviceMapping.serviceName,
      standardizedService: serviceMapping.standardizedService, // Add enum value
      confidence: serviceMapping.confidence,
      serviceCode: upsCode || '03', // Populate UPS service code for backward compatibility
      isResidential: undefined,
      isResidentialDetected: false,
      residentialDetectionSource: 'service_name' as const
    };
  });
}

// New function to detect residential/commercial from address patterns
export function detectResidentialFromAddress(address: string): { isResidential: boolean; confidence: number } {
  if (!address || typeof address !== 'string') {
    return { isResidential: false, confidence: 0 };
  }
  
  const addressLower = address.toLowerCase().trim();
  
  // Strong residential indicators
  const residentialPatterns = [
    /apt\s*\d+/i, /apartment\s*\d+/i, /unit\s*\d+/i, /suite\s*\d+/i,
    /#\s*\d+/i, /\d+[a-z]\s*$/i, // apartment/unit numbers
    /house/i, /home/i, /residence/i
  ];
  
  // Strong commercial indicators  
  const commercialPatterns = [
    /\b(llc|inc|corp|ltd|company|co\.|corporation|incorporated)\b/i,
    /\b(office|building|plaza|center|centre|tower|floor|fl\s*\d+)\b/i,
    /\b(warehouse|distribution|fulfillment|dock|bay\s*\d+)\b/i,
    /\b(business|store|shop|retail|mall)\b/i
  ];
  
  // Check for commercial patterns first (higher confidence)
  for (const pattern of commercialPatterns) {
    if (pattern.test(addressLower)) {
      return { isResidential: false, confidence: 0.8 };
    }
  }
  
  // Check for residential patterns
  for (const pattern of residentialPatterns) {
    if (pattern.test(addressLower)) {
      return { isResidential: true, confidence: 0.7 };
    }
  }
  
  // Default to commercial with low confidence if unclear
  return { isResidential: false, confidence: 0.2 };
}

// New function to determine residential status with hierarchical logic
export function determineResidentialStatus(
  shipment: any,
  serviceMapping: ServiceMapping,
  csvResidentialField?: string
): { isResidential: boolean; source: string; confidence: number } {
  
  console.log('🏠 Determining residential status:', {
    shipmentId: shipment.trackingId || 'unknown',
    hasManualSetting: serviceMapping.isResidential !== undefined,
    manualSetting: serviceMapping.isResidential,
    residentialSource: serviceMapping.residentialSource,
    hasResidentialDetected: serviceMapping.isResidentialDetected,
    csvResidentialField: csvResidentialField,
    recipientAddress: shipment.recipientAddress
  });
  
  // 1. Primary: Use explicit CSV column data if available
  if (csvResidentialField && shipment[csvResidentialField] !== undefined) {
    const csvValue = shipment[csvResidentialField];
    const isResidential = parseResidentialValue(csvValue);
    console.log('🏠 Using CSV data for residential status:', { csvValue, isResidential });
    return { 
      isResidential, 
      source: 'csv_data', 
      confidence: 0.95 
    };
  }
  
  // 2. Secondary: Use manual settings from service mapping page (HIGHEST PRIORITY for user control)
  if (serviceMapping.isResidential !== undefined && serviceMapping.residentialSource === 'manual') {
    console.log('🏠 Using MANUAL residential setting from service mapping page:', { 
      isResidential: serviceMapping.isResidential,
      source: 'manual'
    });
    return { 
      isResidential: serviceMapping.isResidential, 
      source: 'manual', 
      confidence: 0.9 
    };
  }
  
  // 3. Tertiary: Use service name intelligence (if detected from service name)
  if (serviceMapping.isResidentialDetected && serviceMapping.isResidential !== undefined) {
    console.log('🏠 Using service name intelligence for residential status:', { 
      isResidential: serviceMapping.isResidential,
      source: 'service_name'
    });
    return { 
      isResidential: serviceMapping.isResidential, 
      source: 'service_name', 
      confidence: 0.8 
    };
  }
  
  // 4. Quaternary: Use address pattern analysis
  if (shipment.recipientAddress) {
    const addressAnalysis = detectResidentialFromAddress(shipment.recipientAddress);
    if (addressAnalysis.confidence > 0.6) {
      console.log('🏠 Using address pattern analysis for residential status:', { 
        isResidential: addressAnalysis.isResidential,
        confidence: addressAnalysis.confidence,
        address: shipment.recipientAddress,
        source: 'address_pattern'
      });
      return {
        isResidential: addressAnalysis.isResidential,
        source: 'address_pattern',
        confidence: addressAnalysis.confidence
      };
    }
  }
  
  // 5. Fallback: Use any other service mapping settings
  if (serviceMapping.isResidential !== undefined) {
    console.log('🏠 Using fallback service mapping residential setting:', { 
      isResidential: serviceMapping.isResidential,
      source: 'fallback_mapping'
    });
    return { 
      isResidential: serviceMapping.isResidential, 
      source: 'fallback_mapping', 
      confidence: 0.5 
    };
  }
  
  // 6. Ultimate fallback: assume commercial
  console.log('🏠 Using default commercial setting (no other data available)');
  return { 
    isResidential: false, 
    source: 'default', 
    confidence: 0.1 
  };
}

// Helper function to parse residential values from CSV data
function parseResidentialValue(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return ['yes', 'y', 'true', '1', 'residential', 'home'].includes(lower);
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

export function standardizeService(service: string): { service: string; confidence: number; isResidential?: boolean; residentialSource?: string } {
  const serviceLower = service.toLowerCase().trim();
  
  // Detect residential vs commercial from service names
  let isResidential: boolean | undefined = undefined;
  let residentialSource = 'service_name';
  
  // UNIVERSAL RESIDENTIAL DETECTION (applies to all carriers)
  if (serviceLower.includes('home delivery') || serviceLower.includes('home') || 
      serviceLower.includes('residential')) {
    isResidential = true;
  }
  
  // FEDEX-SPECIFIC RESIDENTIAL DETECTION
  if (serviceLower.includes('fedex')) {
    if (serviceLower.includes('fedex home')) {
      isResidential = true;
    } else if (serviceLower.includes('fedex ground') && !serviceLower.includes('home')) {
      isResidential = false;
    }
  }
  
  // USPS RESIDENTIAL DETECTION
  if (serviceLower.includes('usps') || serviceLower.includes('postal') || serviceLower.includes('mail')) {
    // Most USPS services are residential by nature
    if (serviceLower.includes('priority mail') || serviceLower.includes('first-class') || 
        serviceLower.includes('media mail') || serviceLower.includes('parcel select')) {
      isResidential = true;
    }
  }

  // Use the new universal service mapping function
  const mapping = mapServiceToServiceCode(service);
  
  return {
    service: mapping.serviceName,
    confidence: mapping.confidence,
    isResidential,
    residentialSource
  };
}