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
  carrier: string;
  confidence: number;
  serviceCode?: string;
  isResidential?: boolean; // For all services
  residentialSource?: string; // How residential status was determined
  isResidentialDetected?: boolean; // Auto-detected from service name
  residentialDetectionSource?: 'service_name' | 'address_pattern' | 'csv_data' | 'manual';
}

// Enhanced field patterns with priority-based matching
const FIELD_PATTERNS: Record<string, { 
  exact: string[]; 
  strong: string[]; 
  partial: string[]; 
}> = {
  trackingId: {
    exact: ['tracking_id', 'trackingid', 'tracking_number', 'track_number', 'shipment_tracking_number'],
    strong: ['tracking', 'track', 'shipment_id', 'trackno', 'track_num'],
    partial: ['number', 'id', 'ref', 'reference', 'pkg', 'package']
  },
  service: {
    exact: ['service_type', 'shipping_service', 'carrier_service', 'service', 'carrier_service_selected'],
    strong: ['ship_service', 'method', 'delivery_method', 'ship_method', 'shipping_method'],
    partial: ['type', 'delivery']
  },
  carrier: {
    exact: ['carrier', 'carrier_name', 'shipping_carrier', 'shipper_carrier', 'provider'],
    strong: ['shipper', 'courier', 'company', 'vendor', 'ship_via'],
    partial: ['ups', 'fedex', 'usps', 'dhl', 'mail']
  },
  weight: {
    exact: ['weight', 'package_weight', 'pkg_weight', 'shipment_weight_lbs', 'weight_lbs'],
    strong: ['wt', 'weight_oz', 'mass', 'pkg_wt'],
    partial: ['lbs', 'pounds', 'kg', 'kilos', 'oz', 'ounces', 'lb', 'kgs']
  },
  cost: {
    exact: ['current_cost', 'shipping_cost', 'freight_cost', 'carrier_fee'],
    strong: ['cost', 'price', 'amount', 'charge', 'fee', 'total', 'rate', 'freight'],
    partial: ['billing', 'charges', 'expense', 'money', 'bill']
  },
  originZip: {
    exact: ['origin_zip', 'ship_from_postal_code', 'pickup_zip', 'shipper_zip'],
    strong: ['from_zip', 'sender_zip', 'origin_postal', 'ship_from_zip'],
    partial: ['origin', 'from', 'ship_from', 'pickup', 'start', 'source']
  },
  destZip: {
    exact: ['destination_zip', 'ship_to_postal_code', 'delivery_zip', 'recipient_zip'],
    strong: ['dest_zip', 'to_zip', 'consignee_zip', 'ship_to_zip'],
    partial: ['destination', 'dest', 'to', 'ship_to', 'delivery', 'end', 'target']
  },
  length: {
    exact: ['length', 'package_length', 'shipment_length'],
    strong: ['len', 'pkg_length', 'box_length', 'dim_length'],
    partial: ['l', 'dimension_length', 'long', 'x']
  },
  width: {
    exact: ['width', 'package_width', 'shipment_width'],
    strong: ['pkg_width', 'box_width', 'dim_width'],
    partial: ['w', 'dimension_width', 'wide', 'y']
  },
  height: {
    exact: ['height', 'package_height', 'shipment_height'],
    strong: ['pkg_height', 'box_height', 'dim_height'],
    partial: ['h', 'dimension_height', 'tall', 'z']
  },
  shipperName: {
    exact: ['shipper_name', 'ship_from_name', 'sender_name'],
    strong: ['from_name', 'origin_name', 'shipper'],
    partial: ['sender', 'company_from', 'from_company']
  },
  shipperAddress: {
    exact: ['shipper_address', 'ship_from_address', 'sender_address'],
    strong: ['from_address', 'origin_address'],
    partial: ['shipper_addr', 'sender_addr']
  },
  shipperCity: {
    exact: ['shipper_city', 'ship_from_city', 'sender_city'],
    strong: ['from_city', 'origin_city'],
    partial: ['from_town']
  },
  shipperState: {
    exact: ['shipper_state', 'ship_from_state', 'sender_state'],
    strong: ['from_state', 'origin_state'],
    partial: ['from_st']
  },
  recipientName: {
    exact: ['recipient_name', 'ship_to_name', 'consignee_name'],
    strong: ['to_name', 'dest_name', 'recipient'],
    partial: ['consignee', 'company_to', 'to_company']
  },
  recipientAddress: {
    exact: ['recipient_address', 'ship_to_address', 'consignee_address'],
    strong: ['to_address', 'dest_address'],
    partial: ['recipient_addr', 'consignee_addr']
  },
  recipientCity: {
    exact: ['recipient_city', 'ship_to_city', 'consignee_city'],
    strong: ['to_city', 'dest_city'],
    partial: ['to_town']
  },
  recipientState: {
    exact: ['recipient_state', 'ship_to_state', 'consignee_state'],
    strong: ['to_state', 'dest_state'],
    partial: ['to_st']
  },
  zone: {
    exact: ['zone', 'shipping_zone', 'rate_zone'],
    strong: ['delivery_zone', 'postal_zone'],
    partial: []
  },
  isResidential: {
    exact: ['is_residential', 'residential', 'address_type', 'delivery_type'],
    strong: ['residential_flag', 'res_flag', 'home_delivery'],
    partial: ['type', 'classification']
  },
  shipDate: {
    exact: ['ship_date', 'shipping_date', 'date_shipped'],
    strong: ['send_date', 'pickup_date'],
    partial: ['date']
  },
  deliveryDate: {
    exact: ['delivery_date', 'delivered_date', 'date_delivered'],
    strong: ['arrival_date', 'due_date'],
    partial: []
  }
};

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

export function generateColumnMappings(csvHeaders: string[]): FieldMapping[] {
  console.log('generateColumnMappings - Input headers:', csvHeaders);
  const mappings: FieldMapping[] = [];
  
  Object.entries(FIELD_PATTERNS).forEach(([fieldName, patterns]) => {
    console.log(`Checking field ${fieldName} with patterns:`, patterns);
    const bestMatch = findBestMatchEnhanced(csvHeaders, patterns);
    if (bestMatch) {
      console.log(`Found match for ${fieldName}:`, bestMatch);
      mappings.push({
        fieldName,
        csvHeader: bestMatch.header,
        confidence: bestMatch.confidence,
        isAutoDetected: true
      });
    } else {
      console.log(`No match found for ${fieldName}`);
    }
  });
  
  console.log('Final mappings generated:', mappings);
  return mappings;
}

function findBestMatchEnhanced(csvHeaders: string[], patterns: { exact: string[]; strong: string[]; partial: string[]; }): { header: string; confidence: number } | null {
  let bestMatch: { header: string; confidence: number } | null = null;
  
  csvHeaders.forEach(header => {
    const headerLower = header.toLowerCase().replace(/[_\s-]/g, '');
    console.log(`  Checking header: "${header}" -> normalized: "${headerLower}"`);
    
    // Check exact matches first (highest confidence)
    patterns.exact.forEach(pattern => {
      const patternLower = pattern.toLowerCase().replace(/[_\s-]/g, '');
      if (headerLower === patternLower) {
        console.log(`    EXACT MATCH with pattern "${pattern}"`);
        if (!bestMatch || bestMatch.confidence < 1.0) {
          bestMatch = { header, confidence: 1.0 };
        }
        return;
      }
    });
    
    // If no exact match, check strong matches
    if (!bestMatch || bestMatch.confidence < 0.9) {
      patterns.strong.forEach(pattern => {
        const patternLower = pattern.toLowerCase().replace(/[_\s-]/g, '');
        
        if (headerLower === patternLower) {
          console.log(`    STRONG EXACT MATCH with pattern "${pattern}"`);
          if (!bestMatch || bestMatch.confidence < 0.9) {
            bestMatch = { header, confidence: 0.9 };
          }
        } else if (headerLower.includes(patternLower) || patternLower.includes(headerLower)) {
          const confidence = 0.8;
          console.log(`    STRONG PARTIAL MATCH with pattern "${pattern}", confidence: ${confidence}`);
          if (!bestMatch || bestMatch.confidence < confidence) {
            bestMatch = { header, confidence };
          }
        }
      });
    }
    
    // If still no strong match, check partial matches
    if (!bestMatch || bestMatch.confidence < 0.7) {
      patterns.partial.forEach(pattern => {
        const patternLower = pattern.toLowerCase().replace(/[_\s-]/g, '');
        
        if (headerLower.includes(patternLower) || patternLower.includes(headerLower)) {
          const similarity = Math.min(patternLower.length, headerLower.length) / 
                           Math.max(patternLower.length, headerLower.length);
          const confidence = Math.min(0.6, similarity * 0.7); // Cap partial matches at 0.6
          
          console.log(`    PARTIAL MATCH with pattern "${pattern}", confidence: ${confidence}`);
          if (confidence > 0.3 && (!bestMatch || bestMatch.confidence < confidence)) {
            bestMatch = { header, confidence };
          }
        }
      });
    }
  });
  
  console.log(`  Best match result:`, bestMatch);
  return bestMatch;
}

export function detectServiceTypes(data: any[], serviceColumn: string): ServiceMapping[] {
  const uniqueServices = [...new Set(data.map(row => row[serviceColumn]).filter(Boolean))];
  
  return uniqueServices.map(service => {
    const standardized = standardizeService(service);
    return {
      original: service,
      standardized: standardized.service,
      carrier: standardized.carrier,
      confidence: standardized.confidence,
      isResidential: standardized.isResidential,
      isResidentialDetected: standardized.isResidential !== undefined,
      residentialDetectionSource: standardized.residentialSource as 'service_name' | 'address_pattern' | 'csv_data' | 'manual'
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

export function standardizeService(service: string): { service: string; carrier: string; confidence: number; isResidential?: boolean; residentialSource?: string } {
  const serviceLower = service.toLowerCase().trim();
  
  // First, determine the carrier for reporting purposes
  let carrier = 'UNKNOWN';
  if (serviceLower.includes('ups')) carrier = 'UPS';
  else if (serviceLower.includes('fedex') || serviceLower.includes('federal express')) carrier = 'FedEx';
  else if (serviceLower.includes('usps') || serviceLower.includes('postal') || serviceLower.includes('mail')) carrier = 'USPS';
  
  // Detect residential vs commercial from service names
  let isResidential: boolean | undefined = undefined;
  let residentialSource = 'service_name';
  
  // NOW PRIORITIZE SERVICE TYPE CLASSIFICATION FOR APPLE-TO-APPLES COMPARISON
  
  // FEDEX-SPECIFIC RESIDENTIAL DETECTION
  if (carrier === 'FedEx') {
    if (serviceLower.includes('home delivery') || serviceLower.includes('fedex home')) {
      isResidential = true;
    } else if (serviceLower.includes('fedex ground') && !serviceLower.includes('home')) {
      isResidential = false;
    }
  }
  
  // USPS RESIDENTIAL DETECTION
  if (carrier === 'USPS') {
    // Most USPS services are residential by nature
    if (serviceLower.includes('priority mail') || serviceLower.includes('first-class') || 
        serviceLower.includes('media mail') || serviceLower.includes('parcel select')) {
      isResidential = true;
    }
  }

  // NEXT DAY AIR SAVER (check for saver first before general next day)
  if ((serviceLower.includes('next day') || serviceLower.includes('nextday') || serviceLower.includes('next air')) && 
      (serviceLower.includes('saver') || serviceLower.includes('save'))) {
    return { service: 'NEXT_DAY_AIR_SAVER', carrier, confidence: 0.95, isResidential, residentialSource };
  }
  
  // NEXT DAY / OVERNIGHT services (highest priority for speed)
  if (serviceLower.includes('next day') || serviceLower.includes('nextday') || 
      serviceLower.includes('next air') || serviceLower.includes('nda') ||
      serviceLower.includes('overnight') || serviceLower.includes('1 day') ||
      serviceLower.includes('standard overnight') || serviceLower.includes('priority overnight') ||
      serviceLower.includes('express mail') || serviceLower.includes('priority mail express')) {
    return { service: 'NEXT_DAY_AIR', carrier, confidence: 0.95, isResidential, residentialSource };
  }
  
  // EARLY AM / SATURDAY services (premium next day)
  if (serviceLower.includes('early') || serviceLower.includes('saturday') || 
      serviceLower.includes('am') || serviceLower.includes('before')) {
    return { service: 'NEXT_DAY_AIR_EARLY', carrier, confidence: 0.9, isResidential, residentialSource };
  }
  
  // 2ND DAY services
  if (serviceLower.includes('2nd day') || serviceLower.includes('2 day') ||
      serviceLower.includes('second day') || serviceLower.includes('2da') ||
      serviceLower.includes('2day') || serviceLower.includes('two day')) {
    return { service: '2ND_DAY_AIR', carrier, confidence: 0.95, isResidential, residentialSource };
  }
  
  // 3RD DAY / SELECT services
  if (serviceLower.includes('3rd day') || serviceLower.includes('3 day') ||
      serviceLower.includes('third day') || serviceLower.includes('3da') ||
      serviceLower.includes('3day') || serviceLower.includes('three day') ||
      serviceLower.includes('select') || serviceLower.includes('3 select')) {
    return { service: '3_DAY_SELECT', carrier, confidence: 0.95, isResidential, residentialSource };
  }
  
  // EXPRESS services (faster than ground, but not next day)
  if (serviceLower.includes('express') && !serviceLower.includes('ground') && 
      !serviceLower.includes('mail') && !serviceLower.includes('overnight')) {
    return { service: 'EXPRESS_SAVER', carrier, confidence: 0.8, isResidential, residentialSource };
  }
  
  // PRIORITY services (typically 1-3 days depending on carrier)
  if (serviceLower.includes('priority') && !serviceLower.includes('express') && 
      !serviceLower.includes('overnight') && !serviceLower.includes('mail express')) {
    return { service: 'PRIORITY_MAIL', carrier, confidence: 0.8, isResidential, residentialSource };
  }
  
  // GROUND services (slowest/cheapest)
  if (serviceLower.includes('ground') || serviceLower.includes('gnd') ||
      serviceLower.includes('surface') || serviceLower.includes('standard') ||
      serviceLower.includes('advantage') || serviceLower.includes('basic')) {
    return { service: 'GROUND', carrier, confidence: 0.9, isResidential, residentialSource };
  }
  
  // Fallback patterns for common service names that don't fit above
  if (serviceLower.includes('air') && !serviceLower.includes('ground')) {
    return { service: 'EXPRESS_AIR', carrier, confidence: 0.6, isResidential, residentialSource };
  }
  
  // Default fallback - assume ground for unknown services
  return { service: 'GROUND', carrier, confidence: 0.3, isResidential, residentialSource };
}