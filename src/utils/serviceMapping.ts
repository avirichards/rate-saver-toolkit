/**
 * Service mapping utility to convert various carrier service names to UPS service codes
 */

export interface ServiceMapping {
  standardizedService: string;
  upsServiceCode: string;
  upsServiceName: string;
  confidence: number;
}

// Common UPS service codes
export const UPS_SERVICE_CODES = {
  '01': 'UPS Next Day Air',
  '02': 'UPS 2nd Day Air',
  '03': 'UPS Ground',
  '12': 'UPS 3 Day Select',
  '13': 'UPS Next Day Air Saver',
  '14': 'UPS Next Day Air Early',
  '54': 'UPS Worldwide Express Plus',
  '07': 'UPS Worldwide Express',
  '08': 'UPS Worldwide Expedited',
  '11': 'UPS Standard',
  '65': 'UPS Saver'
};

// Default service types to request when no specific mapping is found
export const DEFAULT_SERVICE_CODES = ['01', '02', '03', '12', '13'];

/**
 * Maps a service name to the most appropriate UPS service code
 */
export function mapServiceToUpsCode(serviceName: string): ServiceMapping {
  if (!serviceName) {
    return {
      standardizedService: 'Ground',
      upsServiceCode: '03',
      upsServiceName: 'UPS Ground',
      confidence: 0.5
    };
  }

  const service = serviceName.toLowerCase().trim();

  // Next Day Air / Overnight patterns
  if (service.includes('next day') || service.includes('overnight') || service.includes('1 day')) {
    if (service.includes('saver') || service.includes('save')) {
      return {
        standardizedService: 'Next Day Air Saver',
        upsServiceCode: '13',
        upsServiceName: 'UPS Next Day Air Saver',
        confidence: 0.95
      };
    }
    if (service.includes('early') || service.includes('am')) {
      return {
        standardizedService: 'Next Day Air Early',
        upsServiceCode: '14',
        upsServiceName: 'UPS Next Day Air Early',
        confidence: 0.95
      };
    }
    return {
      standardizedService: 'Next Day Air',
      upsServiceCode: '01',
      upsServiceName: 'UPS Next Day Air',
      confidence: 0.9
    };
  }

  // 2nd Day Air patterns
  if (service.includes('2nd day') || service.includes('2 day') || service.includes('second day')) {
    return {
      standardizedService: '2nd Day Air',
      upsServiceCode: '02',
      upsServiceName: 'UPS 2nd Day Air',
      confidence: 0.9
    };
  }

  // 3 Day Select patterns
  if (service.includes('3 day') || service.includes('3-day') || service.includes('select')) {
    return {
      standardizedService: '3 Day Select',
      upsServiceCode: '12',
      upsServiceName: 'UPS 3 Day Select',
      confidence: 0.9
    };
  }

  // Ground patterns
  if (service.includes('ground') || service.includes('standard') || service.includes('regular')) {
    return {
      standardizedService: 'Ground',
      upsServiceCode: '03',
      upsServiceName: 'UPS Ground',
      confidence: 0.9
    };
  }

  // Express patterns (international)
  if (service.includes('express')) {
    if (service.includes('plus') || service.includes('+')) {
      return {
        standardizedService: 'Worldwide Express Plus',
        upsServiceCode: '54',
        upsServiceName: 'UPS Worldwide Express Plus',
        confidence: 0.8
      };
    }
    return {
      standardizedService: 'Worldwide Express',
      upsServiceCode: '07',
      upsServiceName: 'UPS Worldwide Express',
      confidence: 0.8
    };
  }

  // Priority patterns
  if (service.includes('priority')) {
    return {
      standardizedService: 'Next Day Air',
      upsServiceCode: '01',
      upsServiceName: 'UPS Next Day Air',
      confidence: 0.7
    };
  }

  // FedEx specific mappings
  if (service.includes('fedex')) {
    if (service.includes('overnight') || service.includes('priority overnight')) {
      return {
        standardizedService: 'Next Day Air',
        upsServiceCode: '01',
        upsServiceName: 'UPS Next Day Air',
        confidence: 0.85
      };
    }
    if (service.includes('2day') || service.includes('2 day')) {
      return {
        standardizedService: '2nd Day Air',
        upsServiceCode: '02',
        upsServiceName: 'UPS 2nd Day Air',
        confidence: 0.85
      };
    }
  }

  // Default to Ground with low confidence
  return {
    standardizedService: 'Ground',
    upsServiceCode: '03',
    upsServiceName: 'UPS Ground',
    confidence: 0.3
  };
}

/**
 * Gets service codes to request, prioritizing the mapped service
 */
export function getServiceCodesToRequest(originalService: string): string[] {
  const mapping = mapServiceToUpsCode(originalService);
  const primaryCode = mapping.upsServiceCode;
  
  // Always include the mapped service first, then add others
  const serviceCodes = [primaryCode];
  
  // Add other common services (avoiding duplicates)
  DEFAULT_SERVICE_CODES.forEach(code => {
    if (!serviceCodes.includes(code)) {
      serviceCodes.push(code);
    }
  });
  
  return serviceCodes;
}