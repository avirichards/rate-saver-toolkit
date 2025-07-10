// Comprehensive US ZIP code to state mapping
// Based on USPS ZIP code ranges for all 50 states + DC

export interface StateInfo {
  state: string;
  stateName: string;
}

export function getStateFromZip(zipCode: string): StateInfo | null {
  if (!zipCode) return null;
  
  const cleanZip = zipCode.trim().substring(0, 5);
  const zipNum = parseInt(cleanZip);
  
  if (isNaN(zipNum)) return null;

  // ZIP code ranges by state (based on USPS assignments)
  if (zipNum >= 35000 && zipNum <= 36999) return { state: 'AL', stateName: 'Alabama' };
  if (zipNum >= 99500 && zipNum <= 99999) return { state: 'AK', stateName: 'Alaska' };
  if (zipNum >= 85000 && zipNum <= 86999) return { state: 'AZ', stateName: 'Arizona' };
  if (zipNum >= 71600 && zipNum <= 72999) return { state: 'AR', stateName: 'Arkansas' };
  if (zipNum >= 90000 && zipNum <= 96699) return { state: 'CA', stateName: 'California' };
  if (zipNum >= 80000 && zipNum <= 81999) return { state: 'CO', stateName: 'Colorado' };
  if (zipNum >= 6000 && zipNum <= 6999) return { state: 'CT', stateName: 'Connecticut' };
  if (zipNum >= 19700 && zipNum <= 19999) return { state: 'DE', stateName: 'Delaware' };
  if (zipNum >= 20000 && zipNum <= 20599) return { state: 'DC', stateName: 'District of Columbia' };
  if (zipNum >= 32000 && zipNum <= 34999) return { state: 'FL', stateName: 'Florida' };
  if (zipNum >= 30000 && zipNum <= 31999) return { state: 'GA', stateName: 'Georgia' };
  if (zipNum >= 96700 && zipNum <= 96999) return { state: 'HI', stateName: 'Hawaii' };
  if (zipNum >= 83200 && zipNum <= 83999) return { state: 'ID', stateName: 'Idaho' };
  if (zipNum >= 60000 && zipNum <= 62999) return { state: 'IL', stateName: 'Illinois' };
  if (zipNum >= 46000 && zipNum <= 47999) return { state: 'IN', stateName: 'Indiana' };
  if (zipNum >= 50000 && zipNum <= 52999) return { state: 'IA', stateName: 'Iowa' };
  if (zipNum >= 66000 && zipNum <= 67999) return { state: 'KS', stateName: 'Kansas' };
  if (zipNum >= 40000 && zipNum <= 42999) return { state: 'KY', stateName: 'Kentucky' };
  if (zipNum >= 70000 && zipNum <= 71599) return { state: 'LA', stateName: 'Louisiana' };
  if (zipNum >= 3900 && zipNum <= 4999) return { state: 'ME', stateName: 'Maine' };
  if (zipNum >= 20600 && zipNum <= 21999) return { state: 'MD', stateName: 'Maryland' };
  if (zipNum >= 1000 && zipNum <= 2799) return { state: 'MA', stateName: 'Massachusetts' };
  if (zipNum >= 48000 && zipNum <= 49999) return { state: 'MI', stateName: 'Michigan' };
  if (zipNum >= 55000 && zipNum <= 56999) return { state: 'MN', stateName: 'Minnesota' };
  if (zipNum >= 38600 && zipNum <= 39999) return { state: 'MS', stateName: 'Mississippi' };
  if (zipNum >= 63000 && zipNum <= 65999) return { state: 'MO', stateName: 'Missouri' };
  if (zipNum >= 59000 && zipNum <= 59999) return { state: 'MT', stateName: 'Montana' };
  if (zipNum >= 68000 && zipNum <= 69999) return { state: 'NE', stateName: 'Nebraska' };
  if (zipNum >= 88900 && zipNum <= 89999) return { state: 'NV', stateName: 'Nevada' };
  if (zipNum >= 3000 && zipNum <= 3899) return { state: 'NH', stateName: 'New Hampshire' };
  if (zipNum >= 7000 && zipNum <= 8999) return { state: 'NJ', stateName: 'New Jersey' };
  if (zipNum >= 87000 && zipNum <= 88499) return { state: 'NM', stateName: 'New Mexico' };
  if (zipNum >= 10000 && zipNum <= 14999) return { state: 'NY', stateName: 'New York' };
  if (zipNum >= 27000 && zipNum <= 28999) return { state: 'NC', stateName: 'North Carolina' };
  if (zipNum >= 58000 && zipNum <= 58999) return { state: 'ND', stateName: 'North Dakota' };
  if (zipNum >= 43000 && zipNum <= 45999) return { state: 'OH', stateName: 'Ohio' };
  if (zipNum >= 73000 && zipNum <= 74999) return { state: 'OK', stateName: 'Oklahoma' };
  if (zipNum >= 97000 && zipNum <= 97999) return { state: 'OR', stateName: 'Oregon' };
  if (zipNum >= 15000 && zipNum <= 19699) return { state: 'PA', stateName: 'Pennsylvania' };
  if (zipNum >= 2800 && zipNum <= 2999) return { state: 'RI', stateName: 'Rhode Island' };
  if (zipNum >= 29000 && zipNum <= 29999) return { state: 'SC', stateName: 'South Carolina' };
  if (zipNum >= 57000 && zipNum <= 57999) return { state: 'SD', stateName: 'South Dakota' };
  if (zipNum >= 37000 && zipNum <= 38599) return { state: 'TN', stateName: 'Tennessee' };
  if (zipNum >= 75000 && zipNum <= 79999) return { state: 'TX', stateName: 'Texas' };
  if (zipNum >= 84000 && zipNum <= 84999) return { state: 'UT', stateName: 'Utah' };
  if (zipNum >= 5000 && zipNum <= 5999) return { state: 'VT', stateName: 'Vermont' };
  if (zipNum >= 22000 && zipNum <= 24699) return { state: 'VA', stateName: 'Virginia' };
  if (zipNum >= 98000 && zipNum <= 99499) return { state: 'WA', stateName: 'Washington' };
  if (zipNum >= 24700 && zipNum <= 26999) return { state: 'WV', stateName: 'West Virginia' };
  if (zipNum >= 53000 && zipNum <= 54999) return { state: 'WI', stateName: 'Wisconsin' };
  if (zipNum >= 82000 && zipNum <= 83199) return { state: 'WY', stateName: 'Wyoming' };
  
  // Military and special ZIP codes
  if (zipNum >= 9000 && zipNum <= 9999) return { state: 'AE', stateName: 'Armed Forces Europe' };
  if (zipNum >= 34000 && zipNum <= 34099) return { state: 'AP', stateName: 'Armed Forces Pacific' };
  if (zipNum >= 9000 && zipNum <= 9999) return { state: 'AA', stateName: 'Armed Forces Americas' };
  
  // US Territories
  if (zipNum >= 600 && zipNum <= 999) return { state: 'PR', stateName: 'Puerto Rico' };
  if (zipNum >= 800 && zipNum <= 899) return { state: 'VI', stateName: 'Virgin Islands' };
  if (zipNum >= 96900 && zipNum <= 96999) return { state: 'GU', stateName: 'Guam' };
  if (zipNum >= 96799 && zipNum <= 96899) return { state: 'AS', stateName: 'American Samoa' };
  if (zipNum >= 96950 && zipNum <= 96999) return { state: 'MP', stateName: 'Northern Mariana Islands' };

  return null; // Unknown ZIP code
}

export function validateUSZipCode(zipCode: string): boolean {
  const stateInfo = getStateFromZip(zipCode);
  return stateInfo !== null;
}