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

// Advanced auto-detection patterns - comprehensive coverage for all field types
const fieldPatterns = {
  trackingId: [
    /track/i, /tracking/i, /shipment.*id/i, /package.*id/i, /parcel.*id/i,
    /tracking.*number/i, /track.*number/i, /tracking.*no/i, /track.*no/i,
    /shipment.*number/i, /package.*number/i, /parcel.*number/i,
    /reference/i, /ref.*number/i, /ref.*no/i, /confirmation/i,
    /awb/i, /air.*waybill/i, /waybill/i, /manifest/i,
    /barcode/i, /label.*id/i, /^id$/i, /identifier/i
  ],
  service: [
    /service/i, /shipping.*service/i, /delivery.*service/i, /carrier.*service/i,
    /ship.*method/i, /delivery.*method/i, /shipping.*method/i,
    /service.*type/i, /delivery.*type/i, /ship.*type/i,
    /service.*level/i, /service.*class/i, /delivery.*option/i,
    /speed/i, /priority/i, /express/i, /standard/i, /economy/i,
    /overnight/i, /next.*day/i, /ground/i, /air/i, /freight/i
  ],
  carrier: [
    /carrier/i, /shipper/i, /company/i, /courier/i, /vendor/i,
    /shipping.*company/i, /delivery.*company/i, /logistics/i,
    /ups/i, /fedex/i, /dhl/i, /usps/i, /tnt/i, /dpd/i,
    /royal.*mail/i, /canada.*post/i, /australia.*post/i,
    /provider/i, /transporter/i
  ],
  weight: [
    /weight/i, /wt/i, /mass/i, /heavy/i,
    /lbs/i, /pounds/i, /lb/i, /pound/i,
    /kg/i, /kgs/i, /kilogram/i, /kilograms/i,
    /oz/i, /ounce/i, /ounces/i, /gram/i, /grams/i, /g$/i,
    /weight.*lbs/i, /weight.*kg/i, /weight.*oz/i,
    /actual.*weight/i, /gross.*weight/i, /net.*weight/i
  ],
  currentRate: [
    /cost/i, /rate/i, /price/i, /total/i, /amount/i, /charge/i, /fee/i,
    /shipping.*cost/i, /shipping.*price/i, /shipping.*rate/i, /shipping.*fee/i,
    /delivery.*cost/i, /delivery.*price/i, /delivery.*rate/i, /delivery.*fee/i,
    /freight.*cost/i, /freight.*rate/i, /freight.*charge/i,
    /carrier.*cost/i, /carrier.*rate/i, /carrier.*fee/i, /carrier.*charge/i,
    /invoice/i, /bill/i, /payment/i, /paid/i, /expense/i,
    /\$.*cost/i, /\$.*rate/i, /\$.*price/i, /\$.*total/i, /\$.*amount/i,
    /usd/i, /eur/i, /gbp/i, /cad/i, /aud/i, /currency/i,
    /actual.*cost/i, /billed.*amount/i, /charged.*amount/i
  ],
  originZip: [
    /origin.*zip/i, /from.*zip/i, /ship.*zip/i, /sender.*zip/i, /pickup.*zip/i,
    /from.*postal/i, /ship.*postal/i, /sender.*postal/i, /pickup.*postal/i,
    /origin.*postal.*code/i, /from.*postal.*code/i, /ship.*postal.*code/i,
    /shipper.*zip/i, /shipper.*postal/i, /source.*zip/i, /source.*postal/i,
    /start.*zip/i, /start.*postal/i, /collection.*zip/i, /collection.*postal/i,
    /warehouse.*zip/i, /facility.*zip/i, /depot.*zip/i
  ],
  destZip: [
    /dest.*zip/i, /to.*zip/i, /delivery.*zip/i, /recipient.*zip/i, /deliver.*zip/i,
    /to.*postal/i, /delivery.*postal/i, /recipient.*postal/i, /deliver.*postal/i,
    /destination.*postal.*code/i, /to.*postal.*code/i, /delivery.*postal.*code/i,
    /consignee.*zip/i, /consignee.*postal/i, /receiver.*zip/i, /receiver.*postal/i,
    /end.*zip/i, /end.*postal/i, /final.*zip/i, /final.*postal/i,
    /customer.*zip/i, /customer.*postal/i, /client.*zip/i, /client.*postal/i
  ],
  length: [
    /length/i, /^len$/i, /^l$/i, /long/i, /longest/i,
    /length.*in/i, /length.*inch/i, /length.*cm/i, /length.*mm/i,
    /dimension.*l/i, /dim.*l/i, /size.*l/i, /package.*length/i,
    /box.*length/i, /carton.*length/i, /item.*length/i
  ],
  width: [
    /width/i, /^wid$/i, /^w$/i, /wide/i, /widest/i,
    /width.*in/i, /width.*inch/i, /width.*cm/i, /width.*mm/i,
    /dimension.*w/i, /dim.*w/i, /size.*w/i, /package.*width/i,
    /box.*width/i, /carton.*width/i, /item.*width/i
  ],
  height: [
    /height/i, /^hgt$/i, /^h$/i, /high/i, /tall/i, /depth/i,
    /height.*in/i, /height.*inch/i, /height.*cm/i, /height.*mm/i,
    /dimension.*h/i, /dim.*h/i, /size.*h/i, /package.*height/i,
    /box.*height/i, /carton.*height/i, /item.*height/i, /thickness/i
  ],
  shipperName: [
    /shipper.*name/i, /sender.*name/i, /from.*name/i, /origin.*name/i,
    /ship.*from.*name/i, /dispatch.*name/i, /consignor.*name/i,
    /source.*name/i, /pickup.*name/i, /warehouse.*name/i,
    /facility.*name/i, /depot.*name/i, /vendor.*name/i,
    /supplier.*name/i, /company.*from/i, /business.*from/i
  ],
  shipperAddress: [
    /shipper.*address/i, /sender.*address/i, /from.*address/i, /origin.*address/i,
    /ship.*from.*address/i, /dispatch.*address/i, /consignor.*address/i,
    /source.*address/i, /pickup.*address/i, /warehouse.*address/i,
    /facility.*address/i, /depot.*address/i, /sender.*street/i,
    /from.*street/i, /origin.*street/i, /shipper.*street/i
  ],
  shipperCity: [
    /shipper.*city/i, /sender.*city/i, /from.*city/i, /origin.*city/i,
    /ship.*from.*city/i, /dispatch.*city/i, /consignor.*city/i,
    /source.*city/i, /pickup.*city/i, /warehouse.*city/i,
    /facility.*city/i, /depot.*city/i
  ],
  shipperState: [
    /shipper.*state/i, /sender.*state/i, /from.*state/i, /origin.*state/i,
    /ship.*from.*state/i, /dispatch.*state/i, /consignor.*state/i,
    /source.*state/i, /pickup.*state/i, /warehouse.*state/i,
    /shipper.*province/i, /sender.*province/i, /from.*province/i,
    /shipper.*region/i, /sender.*region/i, /from.*region/i
  ],
  recipientName: [
    /recipient.*name/i, /receiver.*name/i, /to.*name/i, /destination.*name/i,
    /ship.*to.*name/i, /deliver.*to.*name/i, /consignee.*name/i,
    /customer.*name/i, /client.*name/i, /addressee.*name/i,
    /end.*customer/i, /final.*recipient/i, /delivery.*name/i,
    /contact.*name/i, /person.*name/i, /company.*to/i, /business.*to/i
  ],
  recipientAddress: [
    /recipient.*address/i, /receiver.*address/i, /to.*address/i, /destination.*address/i,
    /ship.*to.*address/i, /deliver.*to.*address/i, /consignee.*address/i,
    /customer.*address/i, /client.*address/i, /addressee.*address/i,
    /delivery.*address/i, /end.*address/i, /final.*address/i,
    /recipient.*street/i, /to.*street/i, /delivery.*street/i
  ],
  recipientCity: [
    /recipient.*city/i, /receiver.*city/i, /to.*city/i, /destination.*city/i,
    /ship.*to.*city/i, /deliver.*to.*city/i, /consignee.*city/i,
    /customer.*city/i, /client.*city/i, /delivery.*city/i
  ],
  recipientState: [
    /recipient.*state/i, /receiver.*state/i, /to.*state/i, /destination.*state/i,
    /ship.*to.*state/i, /deliver.*to.*state/i, /consignee.*state/i,
    /customer.*state/i, /client.*state/i, /delivery.*state/i,
    /recipient.*province/i, /to.*province/i, /delivery.*province/i,
    /recipient.*region/i, /to.*region/i, /delivery.*region/i
  ],
  zone: [
    /zone/i, /shipping.*zone/i, /delivery.*zone/i, /rate.*zone/i,
    /postal.*zone/i, /geographic.*zone/i, /distance.*zone/i,
    /service.*zone/i, /carrier.*zone/i, /pricing.*zone/i,
    /region/i, /area/i, /territory/i, /sector/i
  ],
  isResidential: [
    /residential/i, /residence/i, /home/i, /house/i, /apartment/i,
    /business/i, /commercial/i, /office/i, /company/i, /industrial/i,
    /resi/i, /comm/i, /res.*flag/i, /comm.*flag/i, /address.*type/i,
    /delivery.*type/i, /location.*type/i, /customer.*type/i,
    /is.*residential/i, /is.*commercial/i, /is.*business/i
  ],
  shipDate: [
    /ship.*date/i, /shipping.*date/i, /dispatch.*date/i, /sent.*date/i,
    /pickup.*date/i, /collection.*date/i, /departure.*date/i,
    /ship.*on/i, /shipped.*on/i, /date.*shipped/i, /date.*sent/i,
    /manifest.*date/i, /processing.*date/i, /created.*date/i,
    /order.*date/i, /booking.*date/i
  ],
  deliveryDate: [
    /delivery.*date/i, /delivered.*date/i, /receive.*date/i, /received.*date/i,
    /arrival.*date/i, /completed.*date/i, /delivered.*on/i,
    /date.*delivered/i, /date.*received/i, /date.*completed/i,
    /end.*date/i, /final.*date/i, /finish.*date/i,
    /proof.*delivery/i, /pod.*date/i, /confirmation.*date/i
  ]
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

// Conservative auto-mapping - only high-confidence matches (85%+)
export function generateConservativeColumnMappings(headers: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const usedHeaders = new Set<string>();
  
  console.log('🔍 Available headers:', headers);
  
  Object.entries(fieldPatterns).forEach(([fieldName, patterns]) => {
    let bestMatch: { header: string; confidence: number } | null = null;
    
    headers.forEach(header => {
      if (usedHeaders.has(header)) return;
      
      const headerLower = header.toLowerCase().trim();
      let confidence = 0;
      
      // Check for exact or near-exact matches
      patterns.forEach(pattern => {
        if (pattern.test(headerLower)) {
          console.log(`🎯 Pattern match for ${fieldName}: "${header}" matches ${pattern}`);
          // Calculate confidence based on pattern specificity and header length
          const patternStr = pattern.toString().toLowerCase();
          if (headerLower === patternStr.replace(/[^a-z]/g, '')) {
            confidence = Math.max(confidence, 95); // Exact match
          } else if (headerLower.includes(patternStr.replace(/[^a-z]/g, ''))) {
            confidence = Math.max(confidence, 85); // Contains key term
          } else {
            confidence = Math.max(confidence, 80); // Pattern match
          }
          console.log(`   → Confidence: ${confidence}%`);
        }
      });
      
      // Consider matches with 85%+ confidence (lowered from 90%)
      if (confidence >= 85 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { header, confidence };
      }
    });
    
    if (bestMatch) {
      console.log(`✅ Best match for ${fieldName}: "${bestMatch.header}" (${bestMatch.confidence}%)`);
      mappings.push({
        fieldName,
        csvHeader: bestMatch.header,
        confidence: bestMatch.confidence,
        isAutoDetected: true
      });
      usedHeaders.add(bestMatch.header);
    } else {
      console.log(`❌ No match found for ${fieldName}`);
    }
  });
  
  console.log('🗂️ Final conservative mappings:', mappings);
  return mappings;
}

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