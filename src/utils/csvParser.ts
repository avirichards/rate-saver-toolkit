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
  
  // UPS patterns
  if (serviceLower.includes('ups') || serviceLower.includes('ground') || serviceLower.includes('gnd')) {
    if (serviceLower.includes('next') || serviceLower.includes('nda')) {
      return { service: 'UPS_NEXT_DAY_AIR', carrier: 'UPS', confidence: 0.9 };
    }
    if (serviceLower.includes('2nd') || serviceLower.includes('2da')) {
      return { service: 'UPS_2ND_DAY_AIR', carrier: 'UPS', confidence: 0.9 };
    }
    return { service: 'UPS_GROUND', carrier: 'UPS', confidence: 0.8 };
  }
  
  // FedEx patterns
  if (serviceLower.includes('fedex') || serviceLower.includes('express')) {
    if (serviceLower.includes('overnight')) {
      return { service: 'FEDEX_STANDARD_OVERNIGHT', carrier: 'FedEx', confidence: 0.9 };
    }
    if (serviceLower.includes('ground')) {
      return { service: 'FEDEX_GROUND', carrier: 'FedEx', confidence: 0.9 };
    }
    return { service: 'FEDEX_EXPRESS_SAVER', carrier: 'FedEx', confidence: 0.7 };
  }
  
  // USPS patterns
  if (serviceLower.includes('usps') || serviceLower.includes('priority') || serviceLower.includes('postal')) {
    if (serviceLower.includes('priority')) {
      return { service: 'USPS_PRIORITY_MAIL', carrier: 'USPS', confidence: 0.9 };
    }
    return { service: 'USPS_GROUND_ADVANTAGE', carrier: 'USPS', confidence: 0.7 };
  }
  
  // Default fallback
  return { service: service.toUpperCase().replace(/\s+/g, '_'), carrier: 'UNKNOWN', confidence: 0.3 };
}