/**
 * Carrier service registry for mapping universal service categories to carrier-specific codes
 */

import { UniversalServiceCategory } from './universalServiceCategories';

export enum CarrierType {
  UPS = 'UPS',
  FEDEX = 'FEDEX',
  DHL = 'DHL'
}

export interface CarrierServiceMapping {
  universalCategory: UniversalServiceCategory;
  carrierCode: string;
  carrierServiceName: string;
  isAvailable: boolean;
}

// UPS Service Mappings
const UPS_SERVICE_MAPPINGS: CarrierServiceMapping[] = [
  {
    universalCategory: UniversalServiceCategory.OVERNIGHT,
    carrierCode: '01',
    carrierServiceName: 'UPS Next Day Air',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.OVERNIGHT_SAVER,
    carrierCode: '13',
    carrierServiceName: 'UPS Next Day Air Saver',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.OVERNIGHT_EARLY,
    carrierCode: '14',
    carrierServiceName: 'UPS Next Day Air Early',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.TWO_DAY,
    carrierCode: '02',
    carrierServiceName: 'UPS 2nd Day Air',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.TWO_DAY_MORNING,
    carrierCode: '59',
    carrierServiceName: 'UPS 2nd Day Air A.M.',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.THREE_DAY,
    carrierCode: '12',
    carrierServiceName: 'UPS 3 Day Select',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.GROUND,
    carrierCode: '03',
    carrierServiceName: 'UPS Ground',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.INTERNATIONAL_EXPRESS,
    carrierCode: '07',
    carrierServiceName: 'UPS Worldwide Express',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.INTERNATIONAL_EXPEDITED,
    carrierCode: '08',
    carrierServiceName: 'UPS Worldwide Expedited',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.INTERNATIONAL_STANDARD,
    carrierCode: '11',
    carrierServiceName: 'UPS Standard',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.INTERNATIONAL_SAVER,
    carrierCode: '65',
    carrierServiceName: 'UPS Worldwide Saver',
    isAvailable: true
  }
];

// FedEx Service Mappings
const FEDEX_SERVICE_MAPPINGS: CarrierServiceMapping[] = [
  {
    universalCategory: UniversalServiceCategory.OVERNIGHT,
    carrierCode: 'PRIORITY_OVERNIGHT',
    carrierServiceName: 'FedEx Priority Overnight',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.OVERNIGHT_SAVER,
    carrierCode: 'STANDARD_OVERNIGHT',
    carrierServiceName: 'FedEx Standard Overnight',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.OVERNIGHT_EARLY,
    carrierCode: 'FIRST_OVERNIGHT',
    carrierServiceName: 'FedEx First Overnight',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.TWO_DAY,
    carrierCode: 'FEDEX_2_DAY',
    carrierServiceName: 'FedEx 2Day',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.TWO_DAY_MORNING,
    carrierCode: 'FEDEX_2_DAY_AM',
    carrierServiceName: 'FedEx 2Day A.M.',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.GROUND,
    carrierCode: 'FEDEX_GROUND',
    carrierServiceName: 'FedEx Ground',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.INTERNATIONAL_EXPRESS,
    carrierCode: 'INTERNATIONAL_PRIORITY',
    carrierServiceName: 'FedEx International Priority',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.INTERNATIONAL_EXPEDITED,
    carrierCode: 'INTERNATIONAL_ECONOMY',
    carrierServiceName: 'FedEx International Economy',
    isAvailable: true
  }
];

// DHL Service Mappings
const DHL_SERVICE_MAPPINGS: CarrierServiceMapping[] = [
  {
    universalCategory: UniversalServiceCategory.OVERNIGHT,
    carrierCode: 'EXPRESS_10_30',
    carrierServiceName: 'DHL Express 10:30',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.OVERNIGHT_EARLY,
    carrierCode: 'EXPRESS_9_00',
    carrierServiceName: 'DHL Express 9:00',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.TWO_DAY,
    carrierCode: 'EXPRESS_12_00',
    carrierServiceName: 'DHL Express 12:00',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.INTERNATIONAL_EXPRESS,
    carrierCode: 'EXPRESS_WORLDWIDE',
    carrierServiceName: 'DHL Express Worldwide',
    isAvailable: true
  },
  {
    universalCategory: UniversalServiceCategory.INTERNATIONAL_EXPEDITED,
    carrierCode: 'EXPRESS_EASY',
    carrierServiceName: 'DHL Express Easy',
    isAvailable: true
  }
];

const CARRIER_MAPPINGS = {
  [CarrierType.UPS]: UPS_SERVICE_MAPPINGS,
  [CarrierType.FEDEX]: FEDEX_SERVICE_MAPPINGS,
  [CarrierType.DHL]: DHL_SERVICE_MAPPINGS
};

/**
 * Get carrier-specific service code for a universal service category
 */
export function getCarrierServiceCode(
  carrierType: CarrierType, 
  universalCategory: UniversalServiceCategory
): string | null {
  const mappings = CARRIER_MAPPINGS[carrierType];
  const mapping = mappings?.find(m => m.universalCategory === universalCategory && m.isAvailable);
  return mapping?.carrierCode || null;
}

/**
 * Get carrier-specific service name for a universal service category
 */
export function getCarrierServiceName(
  carrierType: CarrierType, 
  universalCategory: UniversalServiceCategory
): string | null {
  const mappings = CARRIER_MAPPINGS[carrierType];
  const mapping = mappings?.find(m => m.universalCategory === universalCategory && m.isAvailable);
  return mapping?.carrierServiceName || null;
}

/**
 * Get all available service codes for a carrier
 */
export function getAvailableServiceCodes(carrierType: CarrierType): string[] {
  const mappings = CARRIER_MAPPINGS[carrierType] || [];
  return mappings
    .filter(m => m.isAvailable)
    .map(m => m.carrierCode);
}

/**
 * Get service codes to request for rate quotes, prioritizing the mapped service
 */
export function getServiceCodesToRequest(
  carrierType: CarrierType,
  primaryCategory: UniversalServiceCategory
): string[] {
  const primaryCode = getCarrierServiceCode(carrierType, primaryCategory);
  const allCodes = getAvailableServiceCodes(carrierType);
  
  if (!primaryCode) {
    return allCodes;
  }
  
  // Put primary code first, then add others
  const serviceCodes = [primaryCode];
  allCodes.forEach(code => {
    if (!serviceCodes.includes(code)) {
      serviceCodes.push(code);
    }
  });
  
  return serviceCodes;
}

/**
 * Get universal category from carrier-specific service code
 */
export function getUniversalCategoryFromCarrierCode(
  carrierType: CarrierType,
  carrierCode: string
): UniversalServiceCategory | null {
  const mappings = CARRIER_MAPPINGS[carrierType] || [];
  const mapping = mappings.find(m => m.carrierCode === carrierCode);
  return mapping?.universalCategory || null;
}