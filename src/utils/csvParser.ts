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
}

// Common field patterns for fuzzy matching - enhanced with more variations
const FIELD_PATTERNS: Record<string, string[]> = {
  trackingId: ['tracking', 'track', 'number', 'id', 'shipment_id', 'tracking_number', 'track_num', 'trackingid', 'shipment', 'ref', 'reference', 'trackno', 'pkg', 'package'],
  weight: ['weight', 'wt', 'lbs', 'pounds', 'kg', 'kilos', 'weight_lbs', 'package_weight', 'pkg_weight', 'wght', 'oz', 'ounces', 'weight_oz', 'mass', 'lb', 'kgs'],
  service: ['service', 'shipping_service', 'carrier_service', 'service_type', 'ship_service', 'carrier', 'method', 'type', 'shipment_type', 'ship_method', 'delivery'],
  cost: ['cost', 'price', 'amount', 'charge', 'fee', 'total', 'shipping_cost', 'rate', 'freight', 'billing', 'charges', 'expense', 'money', 'bill'],
  originZip: ['origin', 'from', 'ship_from', 'origin_zip', 'from_zip', 'sender_zip', 'origin_postal', 'shipper_zip', 'pickup_zip', 'start', 'source', 'begin'],
  destZip: ['destination', 'dest', 'to', 'ship_to', 'dest_zip', 'to_zip', 'recipient_zip', 'delivery_zip', 'consignee_zip', 'end', 'target', 'deliver'],
  length: ['length', 'len', 'l', 'package_length', 'box_length', 'pkg_length', 'dim_length', 'dimension_length', 'long', 'x'],
  width: ['width', 'w', 'package_width', 'box_width', 'pkg_width', 'dim_width', 'dimension_width', 'wide', 'y'],
  height: ['height', 'h', 'package_height', 'box_height', 'pkg_height', 'dim_height', 'dimension_height', 'tall', 'z'],
  shipperName: ['shipper_name', 'sender_name', 'from_name', 'ship_from_name', 'origin_name', 'company_from', 'shipper', 'sender', 'from_company'],
  shipperAddress: ['shipper_address', 'sender_address', 'from_address', 'ship_from_address', 'origin_address', 'shipper_addr', 'sender_addr'],
  shipperCity: ['shipper_city', 'sender_city', 'from_city', 'ship_from_city', 'origin_city', 'from_town'],
  shipperState: ['shipper_state', 'sender_state', 'from_state', 'ship_from_state', 'origin_state', 'from_st'],
  recipientName: ['recipient_name', 'consignee_name', 'to_name', 'ship_to_name', 'dest_name', 'company_to', 'recipient', 'consignee', 'to_company'],
  recipientAddress: ['recipient_address', 'consignee_address', 'to_address', 'ship_to_address', 'dest_address', 'recipient_addr', 'consignee_addr'],
  recipientCity: ['recipient_city', 'consignee_city', 'to_city', 'ship_to_city', 'dest_city', 'to_town'],
  recipientState: ['recipient_state', 'consignee_state', 'to_state', 'ship_to_state', 'dest_state', 'to_st'],
  zone: ['zone', 'shipping_zone', 'rate_zone', 'delivery_zone', 'postal_zone'],
  shipDate: ['ship_date', 'shipping_date', 'date_shipped', 'send_date', 'pickup_date', 'date'],
  deliveryDate: ['delivery_date', 'delivered_date', 'date_delivered', 'arrival_date', 'due_date']
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
    const bestMatch = findBestMatch(csvHeaders, patterns);
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

function findBestMatch(csvHeaders: string[], patterns: string[]): { header: string; confidence: number } | null {
  let bestMatch: { header: string; confidence: number } | null = null;
  
  csvHeaders.forEach(header => {
    const headerLower = header.toLowerCase().replace(/[_\s-]/g, '');
    console.log(`  Checking header: "${header}" -> normalized: "${headerLower}"`);
    
    patterns.forEach(pattern => {
      const patternLower = pattern.toLowerCase().replace(/[_\s-]/g, '');
      
      // Exact match
      if (headerLower === patternLower) {
        console.log(`    EXACT MATCH with pattern "${pattern}"`);
        if (!bestMatch || bestMatch.confidence < 1.0) {
          bestMatch = { header, confidence: 1.0 };
        }
        return;
      }
      
      // Contains match
      if (headerLower.includes(patternLower) || patternLower.includes(headerLower)) {
        const confidence = Math.min(patternLower.length, headerLower.length) / 
                          Math.max(patternLower.length, headerLower.length);
        
        console.log(`    PARTIAL MATCH with pattern "${pattern}", confidence: ${confidence}`);
        if (confidence > 0.4 && (!bestMatch || bestMatch.confidence < confidence)) {
          bestMatch = { header, confidence };
        }
      }
    });
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
      confidence: standardized.confidence
    };
  });
}

function standardizeService(service: string): { service: string; carrier: string; confidence: number } {
  const serviceLower = service.toLowerCase().trim();
  
  // First, determine the carrier for reporting purposes
  let carrier = 'UNKNOWN';
  if (serviceLower.includes('ups')) carrier = 'UPS';
  else if (serviceLower.includes('fedex') || serviceLower.includes('federal express')) carrier = 'FedEx';
  else if (serviceLower.includes('usps') || serviceLower.includes('postal') || serviceLower.includes('mail')) carrier = 'USPS';
  
  // NOW PRIORITIZE SERVICE TYPE CLASSIFICATION FOR APPLE-TO-APPLES COMPARISON
  
  // NEXT DAY / OVERNIGHT services (highest priority for speed)
  if (serviceLower.includes('next day') || serviceLower.includes('nextday') || 
      serviceLower.includes('next air') || serviceLower.includes('nda') ||
      serviceLower.includes('overnight') || serviceLower.includes('1 day') ||
      serviceLower.includes('standard overnight') || serviceLower.includes('priority overnight') ||
      serviceLower.includes('express mail') || serviceLower.includes('priority mail express')) {
    return { service: 'NEXT_DAY_AIR', carrier, confidence: 0.95 };
  }
  
  // EARLY AM / SATURDAY services (premium next day)
  if (serviceLower.includes('early') || serviceLower.includes('saturday') || 
      serviceLower.includes('am') || serviceLower.includes('before')) {
    return { service: 'NEXT_DAY_AIR_EARLY', carrier, confidence: 0.9 };
  }
  
  // 2ND DAY services
  if (serviceLower.includes('2nd day') || serviceLower.includes('2 day') ||
      serviceLower.includes('second day') || serviceLower.includes('2da') ||
      serviceLower.includes('2day') || serviceLower.includes('two day')) {
    return { service: '2ND_DAY_AIR', carrier, confidence: 0.95 };
  }
  
  // 3RD DAY / SELECT services
  if (serviceLower.includes('3rd day') || serviceLower.includes('3 day') ||
      serviceLower.includes('third day') || serviceLower.includes('3da') ||
      serviceLower.includes('3day') || serviceLower.includes('three day') ||
      serviceLower.includes('select') || serviceLower.includes('3 select')) {
    return { service: '3_DAY_SELECT', carrier, confidence: 0.95 };
  }
  
  // EXPRESS services (faster than ground, but not next day)
  if (serviceLower.includes('express') && !serviceLower.includes('ground') && 
      !serviceLower.includes('mail') && !serviceLower.includes('overnight')) {
    return { service: 'EXPRESS_SAVER', carrier, confidence: 0.8 };
  }
  
  // PRIORITY services (typically 1-3 days depending on carrier)
  if (serviceLower.includes('priority') && !serviceLower.includes('express') && 
      !serviceLower.includes('overnight') && !serviceLower.includes('mail express')) {
    return { service: 'PRIORITY_MAIL', carrier, confidence: 0.8 };
  }
  
  // GROUND services (slowest/cheapest)
  if (serviceLower.includes('ground') || serviceLower.includes('gnd') ||
      serviceLower.includes('surface') || serviceLower.includes('standard') ||
      serviceLower.includes('advantage') || serviceLower.includes('basic')) {
    return { service: 'GROUND', carrier, confidence: 0.9 };
  }
  
  // Fallback patterns for common service names that don't fit above
  if (serviceLower.includes('air') && !serviceLower.includes('ground')) {
    return { service: 'EXPRESS_AIR', carrier, confidence: 0.6 };
  }
  
  // Default fallback - assume ground for unknown services
  return { service: 'GROUND', carrier, confidence: 0.3 };
}