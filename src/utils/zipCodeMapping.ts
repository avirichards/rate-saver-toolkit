// ZIP code to city/state mapping for test data
export interface CityState {
  city: string;
  state: string;
}

const ZIP_TO_CITY_STATE: Record<string, CityState> = {
  // NYC
  '10001': { city: 'New York', state: 'NY' },
  '10002': { city: 'New York', state: 'NY' },
  '10003': { city: 'New York', state: 'NY' },
  '10004': { city: 'New York', state: 'NY' },
  '10005': { city: 'New York', state: 'NY' },
  
  // LA
  '90210': { city: 'Beverly Hills', state: 'CA' },
  '90211': { city: 'Beverly Hills', state: 'CA' },
  '90212': { city: 'Beverly Hills', state: 'CA' },
  '90213': { city: 'Beverly Hills', state: 'CA' },
  '90214': { city: 'Beverly Hills', state: 'CA' },
  
  // Chicago
  '60601': { city: 'Chicago', state: 'IL' },
  '60602': { city: 'Chicago', state: 'IL' },
  '60603': { city: 'Chicago', state: 'IL' },
  '60604': { city: 'Chicago', state: 'IL' },
  '60605': { city: 'Chicago', state: 'IL' },
  
  // DC
  '20001': { city: 'Washington', state: 'DC' },
  '20002': { city: 'Washington', state: 'DC' },
  '20003': { city: 'Washington', state: 'DC' },
  '20004': { city: 'Washington', state: 'DC' },
  '20005': { city: 'Washington', state: 'DC' },
  
  // Atlanta
  '30301': { city: 'Atlanta', state: 'GA' },
  '30302': { city: 'Atlanta', state: 'GA' },
  '30303': { city: 'Atlanta', state: 'GA' },
  '30304': { city: 'Atlanta', state: 'GA' },
  '30305': { city: 'Atlanta', state: 'GA' },
  
  // Houston
  '77001': { city: 'Houston', state: 'TX' },
  '77002': { city: 'Houston', state: 'TX' },
  '77003': { city: 'Houston', state: 'TX' },
  '77004': { city: 'Houston', state: 'TX' },
  '77005': { city: 'Houston', state: 'TX' },
  
  // Dallas
  '75201': { city: 'Dallas', state: 'TX' },
  '75202': { city: 'Dallas', state: 'TX' },
  '75203': { city: 'Dallas', state: 'TX' },
  '75204': { city: 'Dallas', state: 'TX' },
  '75205': { city: 'Dallas', state: 'TX' },
  
  // Miami
  '33101': { city: 'Miami', state: 'FL' },
  '33102': { city: 'Miami', state: 'FL' },
  '33103': { city: 'Miami', state: 'FL' },
  '33104': { city: 'Miami', state: 'FL' },
  '33105': { city: 'Miami', state: 'FL' },
  
  // Seattle
  '98101': { city: 'Seattle', state: 'WA' },
  '98102': { city: 'Seattle', state: 'WA' },
  '98103': { city: 'Seattle', state: 'WA' },
  '98104': { city: 'Seattle', state: 'WA' },
  '98105': { city: 'Seattle', state: 'WA' },
  
  // Boston
  '02101': { city: 'Boston', state: 'MA' },
  '02102': { city: 'Boston', state: 'MA' },
  '02103': { city: 'Boston', state: 'MA' },
  '02104': { city: 'Boston', state: 'MA' },
  '02105': { city: 'Boston', state: 'MA' },
};

export function getCityStateFromZip(zipCode: string): CityState {
  const cleanZip = zipCode.trim().substring(0, 5);
  const cityState = ZIP_TO_CITY_STATE[cleanZip];
  
  if (cityState) {
    return cityState;
  }
  
  // Default fallback for unknown ZIP codes
  return { city: 'Atlanta', state: 'GA' };
}