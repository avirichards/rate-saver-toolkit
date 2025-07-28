/**
 * Carrier-agnostic service mapping utility to convert various service names to universal service categories
 */

import { UniversalServiceCategory, DEFAULT_SERVICE_CATEGORIES } from './universalServiceCategories';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceMapping {
  standardizedService: UniversalServiceCategory;
  serviceName: string;
  confidence: number;
}

/**
 * Normalize service name for consistent matching
 */
const normalizeServiceName = (serviceName: string): string => {
  return serviceName?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
};

/**
 * Check for custom user service mappings first
 */
async function getCustomServiceMapping(serviceName: string): Promise<ServiceMapping | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const normalizedName = normalizeServiceName(serviceName);
    
    const { data, error } = await supabase
      .from('custom_service_mappings')
      .select('*')
      .eq('user_id', user.id)
      .eq('normalized_service_name', normalizedName)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    return {
      standardizedService: data.universal_category as UniversalServiceCategory,
      serviceName: data.service_name,
      confidence: data.confidence
    };
  } catch (error) {
    console.warn('Error fetching custom service mapping:', error);
    return null;
  }
}

/**
 * Maps a service name to the most appropriate universal service category
 * Checks custom user mappings first, then falls back to built-in logic
 */
export async function mapServiceToServiceCodeAsync(serviceName: string): Promise<ServiceMapping> {
  // First, check for custom user mappings
  const customMapping = await getCustomServiceMapping(serviceName);
  if (customMapping) {
    return customMapping;
  }

  // Fall back to built-in mapping logic
  return mapServiceToServiceCodeSync(serviceName);
}

/**
 * Synchronous version of service mapping (original logic)
 * Used for backward compatibility and when async is not available
 */
export function mapServiceToServiceCode(serviceName: string): ServiceMapping {
  return mapServiceToServiceCodeSync(serviceName);
}

/**
 * Internal synchronous mapping function with the original logic
 */
function mapServiceToServiceCodeSync(serviceName: string): ServiceMapping {
  if (!serviceName) {
    return {
      standardizedService: UniversalServiceCategory.GROUND,
      serviceName: 'Ground',
      confidence: 0.5
    };
  }

  const service = serviceName.toLowerCase().trim();

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

  // 3 Day Select patterns
  if (service.includes('3 day') || service.includes('3-day') || service.includes('select')) {
    return {
      standardizedService: UniversalServiceCategory.THREE_DAY,
      serviceName: '3-Day Select',
      confidence: 0.9
    };
  }

  // Ground patterns
  if (service.includes('ground') || service.includes('standard') || service.includes('regular')) {
    return {
      standardizedService: UniversalServiceCategory.GROUND,
      serviceName: 'Ground',
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

  // FedEx specific mappings
  if (service.includes('fedex')) {
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