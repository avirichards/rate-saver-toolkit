/**
 * Service fallback hierarchy for UPS services
 * When a service rate cannot be obtained, try these fallbacks in order
 */

export interface ServiceFallback {
  originalService: string;
  fallbackServices: string[];
  reason: string;
}

export interface ServiceSubstitution {
  originalService: string;
  originalServiceName: string;
  actualService: string;
  actualServiceName: string;
  reason: string;
  isSubstitution: true;
}

// Service fallback hierarchy based on delivery speed and characteristics
export const SERVICE_FALLBACK_HIERARCHY: Record<string, string[]> = {
  // Next Day Air Saver -> Next Day Air -> 2nd Day Air
  '13': ['01', '02'], 
  
  // Next Day Air Early -> Next Day Air -> Next Day Air Saver
  '14': ['01', '13'],
  
  // Next Day Air -> Next Day Air Saver -> 2nd Day Air
  '01': ['13', '02'],
  
  // 2nd Day Air A.M. -> 2nd Day Air -> 3 Day Select
  '59': ['02', '12'],
  
  // 2nd Day Air -> 2nd Day Air A.M. -> 3 Day Select
  '02': ['59', '12'],
  
  // 3 Day Select -> Ground -> 2nd Day Air
  '12': ['03', '02'],
  
  // Ground -> 3 Day Select -> 2nd Day Air
  '03': ['12', '02'],
  
  // Worldwide Express -> Worldwide Saver -> Standard
  '07': ['65', '11'],
  
  // Worldwide Saver -> Worldwide Express -> Standard
  '65': ['07', '11'],
  
  // Standard -> Worldwide Saver -> Ground
  '11': ['65', '03']
};

// Service names for better user messaging
export const SERVICE_NAMES: Record<string, string> = {
  '01': 'UPS Next Day Air',
  '02': 'UPS 2nd Day Air',
  '03': 'UPS Ground',
  '12': 'UPS 3 Day Select',
  '13': 'UPS Next Day Air Saver',
  '14': 'UPS Next Day Air Early',
  '59': 'UPS 2nd Day Air A.M.',
  '07': 'UPS Worldwide Express',
  '08': 'UPS Worldwide Expedited',
  '11': 'UPS Standard',
  '65': 'UPS Worldwide Saver'
};

/**
 * Gets fallback services for a given service code
 */
export function getFallbackServices(serviceCode: string): string[] {
  return SERVICE_FALLBACK_HIERARCHY[serviceCode] || [];
}

/**
 * Gets all service codes to try (original + fallbacks) in priority order
 */
export function getServiceCodesToTry(serviceCode: string): string[] {
  const fallbacks = getFallbackServices(serviceCode);
  return [serviceCode, ...fallbacks];
}

/**
 * Gets a human-readable service name
 */
export function getServiceName(serviceCode: string): string {
  return SERVICE_NAMES[serviceCode] || `UPS Service ${serviceCode}`;
}

/**
 * Creates a service substitution record
 */
export function createServiceSubstitution(
  originalService: string,
  actualService: string,
  reason: string = 'Rate unavailable for original service'
): ServiceSubstitution {
  return {
    originalService,
    originalServiceName: getServiceName(originalService),
    actualService,
    actualServiceName: getServiceName(actualService),
    reason,
    isSubstitution: true
  };
}

/**
 * Determines if a service substitution should be flagged as significant
 * (e.g., when downgrading from faster to slower service)
 */
export function isSignificantSubstitution(originalService: string, actualService: string): boolean {
  // Define service speed ranking (lower number = faster)
  const serviceSpeed: Record<string, number> = {
    '14': 1, // Next Day Air Early
    '01': 2, // Next Day Air
    '13': 3, // Next Day Air Saver
    '59': 4, // 2nd Day Air A.M.
    '02': 5, // 2nd Day Air
    '12': 6, // 3 Day Select
    '03': 7, // Ground
    '07': 2, // Worldwide Express (similar to Next Day)
    '65': 6, // Worldwide Saver (similar to 3 Day)
    '11': 7, // Standard (similar to Ground)
  };

  const originalSpeed = serviceSpeed[originalService] || 999;
  const actualSpeed = serviceSpeed[actualService] || 999;

  // Flag as significant if we're downgrading speed by more than 1 tier
  return actualSpeed > originalSpeed + 1;
}