/**
 * Universal service categories for carrier-agnostic service mapping
 */

export enum UniversalServiceCategory {
  OVERNIGHT = 'OVERNIGHT',
  OVERNIGHT_SAVER = 'OVERNIGHT_SAVER', 
  OVERNIGHT_EARLY = 'OVERNIGHT_EARLY',
  TWO_DAY = 'TWO_DAY',
  TWO_DAY_MORNING = 'TWO_DAY_MORNING',
  THREE_DAY = 'THREE_DAY',
  GROUND = 'GROUND',
  INTERNATIONAL_EXPRESS = 'INTERNATIONAL_EXPRESS',
  INTERNATIONAL_EXPEDITED = 'INTERNATIONAL_EXPEDITED',
  INTERNATIONAL_STANDARD = 'INTERNATIONAL_STANDARD',
  INTERNATIONAL_SAVER = 'INTERNATIONAL_SAVER'
}

export interface UniversalServiceInfo {
  category: UniversalServiceCategory;
  displayName: string;
  description: string;
  isInternational: boolean;
  typicalTransitDays: string;
}

export const UNIVERSAL_SERVICES: Record<UniversalServiceCategory, UniversalServiceInfo> = {
  [UniversalServiceCategory.OVERNIGHT]: {
    category: UniversalServiceCategory.OVERNIGHT,
    displayName: 'Overnight',
    description: 'Next business day delivery by end of day',
    isInternational: false,
    typicalTransitDays: '1'
  },
  [UniversalServiceCategory.OVERNIGHT_SAVER]: {
    category: UniversalServiceCategory.OVERNIGHT_SAVER,
    displayName: 'Overnight Saver',
    description: 'Next business day delivery, typically by 3:00 PM',
    isInternational: false,
    typicalTransitDays: '1'
  },
  [UniversalServiceCategory.OVERNIGHT_EARLY]: {
    category: UniversalServiceCategory.OVERNIGHT_EARLY,
    displayName: 'Overnight Early',
    description: 'Next business day delivery by 8:00-10:30 AM',
    isInternational: false,
    typicalTransitDays: '1'
  },
  [UniversalServiceCategory.TWO_DAY]: {
    category: UniversalServiceCategory.TWO_DAY,
    displayName: '2-Day',
    description: 'Delivery in 2 business days by end of day',
    isInternational: false,
    typicalTransitDays: '2'
  },
  [UniversalServiceCategory.TWO_DAY_MORNING]: {
    category: UniversalServiceCategory.TWO_DAY_MORNING,
    displayName: '2-Day Morning',
    description: 'Delivery in 2 business days by 12:00 PM',
    isInternational: false,
    typicalTransitDays: '2'
  },
  [UniversalServiceCategory.THREE_DAY]: {
    category: UniversalServiceCategory.THREE_DAY,
    displayName: '3-Day Select',
    description: 'Delivery in 3 business days',
    isInternational: false,
    typicalTransitDays: '3'
  },
  [UniversalServiceCategory.GROUND]: {
    category: UniversalServiceCategory.GROUND,
    displayName: 'Ground',
    description: 'Standard ground delivery, 1-5 business days',
    isInternational: false,
    typicalTransitDays: '1-5'
  },
  [UniversalServiceCategory.INTERNATIONAL_EXPRESS]: {
    category: UniversalServiceCategory.INTERNATIONAL_EXPRESS,
    displayName: 'International Express',
    description: 'Express international delivery',
    isInternational: true,
    typicalTransitDays: '1-3'
  },
  [UniversalServiceCategory.INTERNATIONAL_EXPEDITED]: {
    category: UniversalServiceCategory.INTERNATIONAL_EXPEDITED,
    displayName: 'International Expedited',
    description: 'Expedited international delivery',
    isInternational: true,
    typicalTransitDays: '2-5'
  },
  [UniversalServiceCategory.INTERNATIONAL_STANDARD]: {
    category: UniversalServiceCategory.INTERNATIONAL_STANDARD,
    displayName: 'International Standard',
    description: 'Standard international delivery',
    isInternational: true,
    typicalTransitDays: '5-10'
  },
  [UniversalServiceCategory.INTERNATIONAL_SAVER]: {
    category: UniversalServiceCategory.INTERNATIONAL_SAVER,
    displayName: 'International Saver',
    description: 'Economy international delivery',
    isInternational: true,
    typicalTransitDays: '1-3'
  }
};

export const DEFAULT_SERVICE_CATEGORIES = [
  UniversalServiceCategory.OVERNIGHT,
  UniversalServiceCategory.TWO_DAY,
  UniversalServiceCategory.GROUND,
  UniversalServiceCategory.THREE_DAY,
  UniversalServiceCategory.OVERNIGHT_SAVER,
  UniversalServiceCategory.TWO_DAY_MORNING
];