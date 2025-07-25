export interface TestShipmentData {
  tracking_id: string;
  service_type: string;
  weight_lbs: number;
  weight_oz?: number;
  length_in?: number;
  width_in?: number;
  height_in?: number;
  origin_zip: string;
  dest_zip: string;
  cost: number;
  zone?: string;
  residential?: boolean;
  saturday_delivery?: boolean;
  signature_required?: boolean;
}

const UNIVERSAL_SERVICES = [
  'Ground',
  'Overnight',
  'Overnight Saver',
  '2-Day',
  '3-Day Select',
  'Overnight Early',
  '2-Day Morning',
  'International Express',
  'International Expedited',
  'International Standard'
];

const COMMON_ZIPS = [
  '10001', '10002', '10003', '10004', '10005', // NYC
  '90210', '90211', '90212', '90213', '90214', // LA
  '60601', '60602', '60603', '60604', '60605', // Chicago
  '20001', '20002', '20003', '20004', '20005', // DC
  '30301', '30302', '30303', '30304', '30305', // Atlanta
  '77001', '77002', '77003', '77004', '77005', // Houston
  '75201', '75202', '75203', '75204', '75205', // Dallas
  '33101', '33102', '33103', '33104', '33105', // Miami
  '98101', '98102', '98103', '98104', '98105', // Seattle
  '02101', '02102', '02103', '02104', '02105'  // Boston
];

const generateTrackingId = (index: number): string => {
  const upsPrefix = '1Z999AA1';
  const fedexPrefix = '7901';
  
  if (index % 3 === 0) {
    return `${upsPrefix}${String(index).padStart(10, '0')}`;
  } else {
    return `${fedexPrefix}${String(index).padStart(8, '0')}`;
  }
};

const getRandomElement = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

const generateRandomWeight = (): { lbs: number; oz?: number } => {
  const usePounds = Math.random() > 0.3;
  
  if (usePounds) {
    return { lbs: Math.round((Math.random() * 50 + 0.5) * 100) / 100 };
  } else {
    return { lbs: 0, oz: Math.round(Math.random() * 15 + 1) };
  }
};

const generateRandomDimensions = (): { length: number; width: number; height: number } => {
  return {
    length: Math.round((Math.random() * 20 + 2) * 10) / 10,
    width: Math.round((Math.random() * 15 + 2) * 10) / 10,
    height: Math.round((Math.random() * 12 + 1) * 10) / 10
  };
};

const calculateEstimatedCost = (weight: number, service: string, zone?: string): number => {
  let baseRate = 8.50;
  
  // Service multipliers for universal categories
  const serviceMultipliers: Record<string, number> = {
    'Ground': 1.0,
    '3-Day Select': 1.3,
    '2-Day': 1.8,
    '2-Day Morning': 2.0,
    'Overnight Saver': 2.5,
    'Overnight': 3.0,
    'Overnight Early': 3.5,
    'International Express': 2.2,
    'International Expedited': 2.0,
    'International Standard': 1.1
  };
  
  // Weight calculation
  const weightCost = weight * 0.85;
  
  // Zone multiplier
  const zoneMultiplier = zone ? (parseInt(zone) * 0.1 + 1) : 1.2;
  
  const total = (baseRate + weightCost) * (serviceMultipliers[service] || 1.0) * zoneMultiplier;
  
  return Math.round(total * 100) / 100;
};

export const generateTestData = (count: number = 50): TestShipmentData[] => {
  const data: TestShipmentData[] = [];
  
  for (let i = 1; i <= count; i++) {
    const weight = generateRandomWeight();
    const dimensions = Math.random() > 0.2 ? generateRandomDimensions() : undefined;
    const service = getRandomElement(UNIVERSAL_SERVICES);
    const zone = Math.random() > 0.3 ? String(Math.floor(Math.random() * 8) + 2) : undefined;
    const actualWeight = weight.lbs + (weight.oz || 0) / 16;
    
    const shipment: TestShipmentData = {
      tracking_id: generateTrackingId(i),
      service_type: service,
      weight_lbs: weight.lbs,
      weight_oz: weight.oz,
      length_in: dimensions?.length,
      width_in: dimensions?.width,
      height_in: dimensions?.height,
      origin_zip: getRandomElement(COMMON_ZIPS),
      dest_zip: getRandomElement(COMMON_ZIPS),
      cost: calculateEstimatedCost(actualWeight, service, zone),
      zone,
      residential: Math.random() > 0.4,
      saturday_delivery: Math.random() > 0.8,
      signature_required: Math.random() > 0.7
    };
    
    data.push(shipment);
  }
  
  return data;
};

export const generateCSVContent = (data: TestShipmentData[]): string => {
  const headers = [
    'tracking_id',
    'service_type', 
    'weight_lbs',
    'weight_oz',
    'length_in',
    'width_in', 
    'height_in',
    'origin_zip',
    'dest_zip',
    'cost',
    'zone',
    'residential',
    'saturday_delivery',
    'signature_required'
  ];
  
  const rows = data.map(row => 
    headers.map(header => {
      const value = row[header as keyof TestShipmentData];
      if (value === undefined || value === null) return '';
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      return String(value);
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
};

export const downloadCSV = (content: string, filename: string = 'test-shipping-data.csv'): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Test data scenarios
export const TEST_SCENARIOS = {
  small_packages: () => generateTestData(25).map(item => ({
    ...item,
    weight_lbs: Math.round((Math.random() * 2 + 0.1) * 100) / 100,
    weight_oz: undefined
  })),
  
  large_packages: () => generateTestData(25).map(item => ({
    ...item,
    weight_lbs: Math.round((Math.random() * 45 + 10) * 100) / 100,
    weight_oz: undefined
  })),
  
  mixed_weights: () => generateTestData(50),
  
  express_only: () => generateTestData(30).map(item => ({
    ...item,
    service_type: getRandomElement(['Overnight', 'Overnight Saver', '2-Day'])
  })),
  
  ground_only: () => generateTestData(40).map(item => ({
    ...item,
    service_type: 'Ground'
  }))
};

// Store test data in localStorage
export const saveTestSession = (data: TestShipmentData[], name: string = 'default'): void => {
  localStorage.setItem(`test_shipping_data_${name}`, JSON.stringify(data));
};

export const loadTestSession = (name: string = 'default'): TestShipmentData[] | null => {
  const stored = localStorage.getItem(`test_shipping_data_${name}`);
  return stored ? JSON.parse(stored) : null;
};

export const clearTestSession = (name: string = 'default'): void => {
  localStorage.removeItem(`test_shipping_data_${name}`);
};