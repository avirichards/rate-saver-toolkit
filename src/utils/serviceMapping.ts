/**
 * Carrier-agnostic service mapping utility to convert various service names to universal service categories
 */

import { UniversalServiceCategory, DEFAULT_SERVICE_CATEGORIES } from './universalServiceCategories';

export interface ServiceMapping {
  standardizedService: UniversalServiceCategory;
  serviceName: string;
  confidence: number;
}

/**
 * Maps a service name to the most appropriate universal service category
 */
export function mapServiceToServiceCode(serviceName: string): ServiceMapping {
  if (!serviceName) {
    return {
      standardizedService: UniversalServiceCategory.GROUND,
      serviceName: 'Ground',
      confidence: 0.5
    };
  }

  const service = serviceName.toLowerCase().trim();

  // FedEx specific mappings (check early to avoid conflicts with general patterns)
  if (service.includes('fedex')) {
    // FedEx Express Saver should map to 3-Day Select
    if (service.includes('express saver') || service.includes('express save')) {
      return {
        standardizedService: UniversalServiceCategory.THREE_DAY,
        serviceName: '3-Day Select',
        confidence: 0.95
      };
    }
    // FedEx Home Delivery is ground residential
    if (service.includes('home delivery') || service.includes('home deliver')) {
      return {
        standardizedService: UniversalServiceCategory.GROUND,
        serviceName: 'Ground',
        confidence: 0.95
      };
    }
    if (service.includes('overnight') || service.includes('priority overnight')) {
      return {
        standardizedService: UniversalServiceCategory.OVERNIGHT,
        serviceName: 'Overnight',
        confidence: 0.85
      };
    }
    if (service.includes('2day') || service.includes('2 day')) {
      return {
        standardizedService: UniversalServiceCategory.TWO_DAY,
        serviceName: '2-Day',
        confidence: 0.85
      };
    }
    if (service.includes('ground')) {
      return {
        standardizedService: UniversalServiceCategory.GROUND,
        serviceName: 'Ground',
        confidence: 0.85
      };
    }
  }

  // Next Day Air / Overnight patterns
  if (service.includes('next day') || service.includes('overnight') || service.includes('1 day')) {
    if (service.includes('saver') || service.includes('save')) {
      return {
        standardizedService: UniversalServiceCategory.OVERNIGHT_SAVER,
        serviceName: 'Overnight Saver',
        confidence: 0.95
      };
    }
    if (service.includes('early') || service.includes('am')) {
      return {
        standardizedService: UniversalServiceCategory.OVERNIGHT_EARLY,
        serviceName: 'Overnight Early',
        confidence: 0.95
      };
    }
    return {
      standardizedService: UniversalServiceCategory.OVERNIGHT,
      serviceName: 'Overnight',
      confidence: 0.9
    };
  }

  // 2nd Day Air patterns
  if (service.includes('2nd day') || service.includes('2 day') || service.includes('second day')) {
    if (service.includes('am') || service.includes('a.m.') || service.includes('morning')) {
      return {
        standardizedService: UniversalServiceCategory.TWO_DAY_MORNING,
        serviceName: '2-Day Morning',
        confidence: 0.95
      };
    }
    return {
      standardizedService: UniversalServiceCategory.TWO_DAY,
      serviceName: '2-Day',
      confidence: 0.9
    };
  }

  // Ground patterns (check before 3 Day Select to catch USPS Parcel Select Ground)
  if (service.includes('ground') || service.includes('standard') || service.includes('regular')) {
    return {
      standardizedService: UniversalServiceCategory.GROUND,
      serviceName: 'Ground',
      confidence: 0.9
    };
  }

  // 3 Day Select patterns (but not if it includes ground)
  if ((service.includes('3 day') || service.includes('3-day') || service.includes('select')) && !service.includes('ground')) {
    return {
      standardizedService: UniversalServiceCategory.THREE_DAY,
      serviceName: '3-Day Select',
      confidence: 0.9
    };
  }

  // Express patterns (international)
  if (service.includes('express')) {
    if (service.includes('worldwide') || service.includes('international')) {
      return {
        standardizedService: UniversalServiceCategory.INTERNATIONAL_EXPRESS,
        serviceName: 'International Express',
        confidence: 0.9
      };
    }
    return {
      standardizedService: UniversalServiceCategory.OVERNIGHT,
      serviceName: 'Overnight',
      confidence: 0.8
    };
  }

  // Expedited patterns (international)
  if (service.includes('expedited') && (service.includes('worldwide') || service.includes('international'))) {
    return {
      standardizedService: UniversalServiceCategory.INTERNATIONAL_EXPEDITED,
      serviceName: 'International Expedited',
      confidence: 0.9
    };
  }

  // Saver patterns (international)
  if (service.includes('saver') && (service.includes('worldwide') || service.includes('international'))) {
    return {
      standardizedService: UniversalServiceCategory.INTERNATIONAL_SAVER,
      serviceName: 'International Saver',
      confidence: 0.9
    };
  }

  // Standard patterns (international)
  if (service.includes('standard') && (service.includes('worldwide') || service.includes('international'))) {
    return {
      standardizedService: UniversalServiceCategory.INTERNATIONAL_STANDARD,
      serviceName: 'International Standard',
      confidence: 0.9
    };
  }

  // Priority patterns
  if (service.includes('priority')) {
    return {
      standardizedService: UniversalServiceCategory.OVERNIGHT,
      serviceName: 'Overnight',
      confidence: 0.7
    };
  }


  // Home delivery patterns (general, not just FedEx)
  if (service.includes('home delivery') || service.includes('home deliver')) {
    return {
      standardizedService: UniversalServiceCategory.GROUND,
      serviceName: 'Ground',
      confidence: 0.9
    };
  }

  // DHL specific mappings
  if (service.includes('dhl')) {
    if (service.includes('express')) {
      return {
        standardizedService: UniversalServiceCategory.INTERNATIONAL_EXPRESS,
        serviceName: 'International Express',
        confidence: 0.85
      };
    }
  }

  // Default to Ground with low confidence
  return {
    standardizedService: UniversalServiceCategory.GROUND,
    serviceName: 'Ground',
    confidence: 0.3
  };
}

/**
 * Gets service categories to request, prioritizing the mapped service
 */
export function getServiceCategoriesToRequest(originalService: string): UniversalServiceCategory[] {
  const mapping = mapServiceToServiceCode(originalService);
  const primaryCategory = mapping.standardizedService;
  
  // Always include the mapped service first, then add others
  const serviceCategories = [primaryCategory];
  
  // Add other common services (avoiding duplicates)
  DEFAULT_SERVICE_CATEGORIES.forEach(category => {
    if (!serviceCategories.includes(category)) {
      serviceCategories.push(category);
    }
  });
  
  return serviceCategories;
}