// Address validation utilities for shipping analysis

export interface AddressValidationResult {
  isValid: boolean;
  errors: string[];
  cleanedValue?: string;
}

// Validate US ZIP codes (5 digit or 5+4 format)
export function validateZipCode(zipCode: string): AddressValidationResult {
  if (!zipCode || typeof zipCode !== 'string') {
    return { isValid: false, errors: ['ZIP code is required'] };
  }

  const cleaned = zipCode.trim().replace(/\s+/g, '');
  const zipRegex = /^\d{5}(-\d{4})?$/;
  
  if (!zipRegex.test(cleaned)) {
    return { 
      isValid: false, 
      errors: ['ZIP code must be 5 digits or 5+4 format (e.g., 12345 or 12345-6789)'] 
    };
  }

  return { 
    isValid: true, 
    errors: [], 
    cleanedValue: cleaned 
  };
}

// Validate weight values - now handles oz to lbs conversion
export function validateWeight(weight: string | number, unit?: string): AddressValidationResult {
  if (!weight) {
    return { isValid: false, errors: ['Weight is required'] };
  }

  let numWeight = typeof weight === 'string' ? parseFloat(weight) : weight;
  
  if (isNaN(numWeight) || numWeight <= 0) {
    return { 
      isValid: false, 
      errors: ['Weight must be a positive number'] 
    };
  }

  // Convert ounces to pounds if needed
  if (unit && unit.toLowerCase().includes('oz')) {
    numWeight = numWeight / 16;
  }

  if (numWeight > 150) {
    return { 
      isValid: false, 
      errors: ['Weight exceeds UPS standard package limit (150 lbs)'] 
    };
  }

  return { 
    isValid: true, 
    errors: [], 
    cleanedValue: numWeight.toString() 
  };
}

// Validate dimensions - now optional with defaults
export function validateDimension(dimension: string | number, fieldName: string, isRequired: boolean = false): AddressValidationResult {
  if (!dimension || dimension === '') {
    if (isRequired) {
      return { isValid: false, errors: [`${fieldName} is required`] };
    }
    // Provide sensible defaults for missing dimensions
    const defaultDimensions = { 'Length': '12', 'Width': '12', 'Height': '6' };
    const defaultValue = defaultDimensions[fieldName as keyof typeof defaultDimensions] || '6';
    return { 
      isValid: true, 
      errors: [], 
      cleanedValue: defaultValue 
    };
  }

  const numDimension = typeof dimension === 'string' ? parseFloat(dimension) : dimension;
  
  if (isNaN(numDimension) || numDimension <= 0) {
    return { 
      isValid: false, 
      errors: [`${fieldName} must be a positive number`] 
    };
  }

  if (numDimension > 108) {
    return { 
      isValid: false, 
      errors: [`${fieldName} exceeds UPS maximum (108 inches)`] 
    };
  }

  return { 
    isValid: true, 
    errors: [], 
    cleanedValue: numDimension.toString() 
  };
}

// Validate shipping cost
export function validateCost(cost: string | number): AddressValidationResult {
  if (!cost) {
    return { isValid: false, errors: ['Cost is required'] };
  }

  const numCost = typeof cost === 'string' ? parseFloat(cost.replace(/[$,]/g, '')) : cost;
  
  if (isNaN(numCost) || numCost < 0) {
    return { 
      isValid: false, 
      errors: ['Cost must be a valid positive number'] 
    };
  }

  return { 
    isValid: true, 
    errors: [], 
    cleanedValue: numCost.toString() 
  };
}

// US state code validation
export function validateStateCode(state: string): AddressValidationResult {
  if (!state) {
    return { isValid: true, errors: [] }; // Optional field
  }

  const cleaned = state.trim().toUpperCase();
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
  ];

  if (cleaned.length === 2 && validStates.includes(cleaned)) {
    return { 
      isValid: true, 
      errors: [], 
      cleanedValue: cleaned 
    };
  }

  return { 
    isValid: false, 
    errors: ['Invalid state code (use 2-letter abbreviation like CA, NY, TX)'] 
  };
}

// Comprehensive shipment validation
export interface ShipmentValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
}

export function validateShipmentData(shipment: any): ShipmentValidationResult {
  const errors: Record<string, string[]> = {};
  const warnings: Record<string, string[]> = {};

  console.log('Validating shipment:', {
    id: shipment.id,
    originZip: shipment.originZip,
    destZip: shipment.destZip,
    weight: shipment.weight,
    cost: shipment.cost,
    dimensions: { length: shipment.length, width: shipment.width, height: shipment.height }
  });

  // Validate required fields - more flexible approach
  const originZipResult = validateZipCode(shipment.originZip);
  if (!originZipResult.isValid) {
    errors.originZip = originZipResult.errors;
  }

  const destZipResult = validateZipCode(shipment.destZip);
  if (!destZipResult.isValid) {
    errors.destZip = destZipResult.errors;
  }

  // Enhanced weight validation with unit detection
  let weightUnit = 'lbs';
  if (shipment.weightUnit) {
    weightUnit = shipment.weightUnit;
  } else if (shipment.weight && typeof shipment.weight === 'string') {
    // Try to detect unit from weight string
    if (shipment.weight.toLowerCase().includes('oz')) weightUnit = 'oz';
  }

  const weightResult = validateWeight(shipment.weight, weightUnit);
  if (!weightResult.isValid) {
    errors.weight = weightResult.errors;
  }

  // Cost validation - more flexible
  if (shipment.cost) {
    const costResult = validateCost(shipment.cost);
    if (!costResult.isValid) {
      errors.cost = costResult.errors;
    }
  } else {
    warnings.cost = ['Missing cost data - cannot calculate savings'];
  }

  // Validate dimensions - now required, no defaults
  const lengthResult = validateDimension(shipment.length, 'Length', true);
  if (!lengthResult.isValid) {
    errors.length = lengthResult.errors;
  }

  const widthResult = validateDimension(shipment.width, 'Width', true);
  if (!widthResult.isValid) {
    errors.width = widthResult.errors;
  }

  const heightResult = validateDimension(shipment.height, 'Height', true);
  if (!heightResult.isValid) {
    errors.height = heightResult.errors;
  }

  // Validate ZIP codes and auto-derive states
  if (shipment.shipperState) {
    const shipperStateResult = validateStateCode(shipment.shipperState);
    if (!shipperStateResult.isValid) {
      warnings.shipperState = shipperStateResult.errors;
    }
  }

  if (shipment.recipientState) {
    const recipientStateResult = validateStateCode(shipment.recipientState);
    if (!recipientStateResult.isValid) {
      warnings.recipientState = recipientStateResult.errors;
    }
  }

  // Check for missing optional but useful data
  if (!shipment.shipperCity && !shipment.recipientCity) {
    warnings.addresses = ['City information missing - may affect rate accuracy'];
  }

  // Log validation results
  const isValid = Object.keys(errors).length === 0;
  console.log(`Shipment ${shipment.id} validation result:`, {
    isValid,
    errorCount: Object.keys(errors).length,
    warningCount: Object.keys(warnings).length,
    errors: Object.keys(errors),
    warnings: Object.keys(warnings)
  });

  return {
    isValid,
    errors,
    warnings
  };
}