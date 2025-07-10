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

  // REAL ZIP CODES FROM USER'S CSV DATA
  // Florida
  '34986': { city: 'Stuart', state: 'FL' },
  '32955': { city: 'Rockledge', state: 'FL' },
  
  // Texas  
  '76476': { city: 'Granbury', state: 'TX' },
  '75165': { city: 'Waxahachie', state: 'TX' },
  
  // Indiana
  '46702': { city: 'Fort Wayne', state: 'IN' },
  
  // Oregon
  '97520': { city: 'Ashland', state: 'OR' },
};

export function getCityStateFromZip(zipCode: string): CityState {
  const cleanZip = zipCode.trim().substring(0, 5);
  const cityState = ZIP_TO_CITY_STATE[cleanZip];
  
  if (cityState) {
    return cityState;
  }
  
  // Enhanced fallback using ZIP code ranges for accurate state mapping
  const zipNum = parseInt(cleanZip);
  
  // Florida (32000-34999)
  if (zipNum >= 32000 && zipNum <= 34999) {
    return { city: 'Tampa', state: 'FL' };
  }
  
  // Texas (75000-79999, except 88000s)
  if (zipNum >= 75000 && zipNum <= 79999) {
    return { city: 'Dallas', state: 'TX' };
  }
  
  // Indiana (46000-47999)
  if (zipNum >= 46000 && zipNum <= 47999) {
    return { city: 'Indianapolis', state: 'IN' };
  }
  
  // Oregon (97000-97999)
  if (zipNum >= 97000 && zipNum <= 97999) {
    return { city: 'Portland', state: 'OR' };
  }
  
  // Georgia (30000-31999)
  if (zipNum >= 30000 && zipNum <= 31999) {
    return { city: 'Atlanta', state: 'GA' };
  }
  
  // Illinois (60000-62999)
  if (zipNum >= 60000 && zipNum <= 62999) {
    return { city: 'Chicago', state: 'IL' };
  }
  
  // California (90000-96999)
  if (zipNum >= 90000 && zipNum <= 96999) {
    return { city: 'Los Angeles', state: 'CA' };
  }
  
  // New York (10000-14999)
  if (zipNum >= 10000 && zipNum <= 14999) {
    return { city: 'New York', state: 'NY' };
  }
  
  // Washington DC (20000-20999)
  if (zipNum >= 20000 && zipNum <= 20999) {
    return { city: 'Washington', state: 'DC' };
  }
  
  // Log unmapped ZIP codes for debugging
  console.warn(`Unmapped ZIP code: ${zipCode}, using fallback Atlanta, GA`);
  return { city: 'Atlanta', state: 'GA' };
}