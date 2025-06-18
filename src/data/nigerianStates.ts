// Nigerian States and Major Cities Data
export interface NigerianState {
  name: string;
  code: string;
  capital: string;
  zone: 'North Central' | 'North East' | 'North West' | 'South East' | 'South South' | 'South West';
  majorCities: string[];
}

export const NIGERIAN_STATES: NigerianState[] = [
  // North Central
  {
    name: 'Federal Capital Territory',
    code: 'FCT',
    capital: 'Abuja',
    zone: 'North Central',
    majorCities: ['Abuja', 'Gwagwalada', 'Kuje', 'Kwali', 'Bwari']
  },
  {
    name: 'Benue',
    code: 'BN',
    capital: 'Makurdi',
    zone: 'North Central',
    majorCities: ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala', 'Vandeikya']
  },
  {
    name: 'Kogi',
    code: 'KG',
    capital: 'Lokoja',
    zone: 'North Central',
    majorCities: ['Lokoja', 'Okene', 'Kabba', 'Anyigba', 'Idah']
  },
  {
    name: 'Kwara',
    code: 'KW',
    capital: 'Ilorin',
    zone: 'North Central',
    majorCities: ['Ilorin', 'Offa', 'Omu-Aran', 'Lafiagi', 'Pategi']
  },
  {
    name: 'Nasarawa',
    code: 'NS',
    capital: 'Lafia',
    zone: 'North Central',
    majorCities: ['Lafia', 'Keffi', 'Akwanga', 'Nasarawa', 'Doma']
  },
  {
    name: 'Niger',
    code: 'NG',
    capital: 'Minna',
    zone: 'North Central',
    majorCities: ['Minna', 'Bida', 'Kontagora', 'Suleja', 'New Bussa']
  },
  {
    name: 'Plateau',
    code: 'PL',
    capital: 'Jos',
    zone: 'North Central',
    majorCities: ['Jos', 'Bukuru', 'Shendam', 'Pankshin', 'Vom']
  },

  // North East
  {
    name: 'Adamawa',
    code: 'AD',
    capital: 'Yola',
    zone: 'North East',
    majorCities: ['Yola', 'Jimeta', 'Mubi', 'Numan', 'Ganye']
  },
  {
    name: 'Bauchi',
    code: 'BA',
    capital: 'Bauchi',
    zone: 'North East',
    majorCities: ['Bauchi', 'Azare', 'Misau', 'Jama\'are', 'Katagum']
  },
  {
    name: 'Borno',
    code: 'BO',
    capital: 'Maiduguri',
    zone: 'North East',
    majorCities: ['Maiduguri', 'Biu', 'Bama', 'Dikwa', 'Gubio']
  },
  {
    name: 'Gombe',
    code: 'GO',
    capital: 'Gombe',
    zone: 'North East',
    majorCities: ['Gombe', 'Billiri', 'Kaltungo', 'Dukku', 'Bajoga']
  },
  {
    name: 'Taraba',
    code: 'TA',
    capital: 'Jalingo',
    zone: 'North East',
    majorCities: ['Jalingo', 'Wukari', 'Bali', 'Gembu', 'Serti']
  },
  {
    name: 'Yobe',
    code: 'YO',
    capital: 'Damaturu',
    zone: 'North East',
    majorCities: ['Damaturu', 'Potiskum', 'Gashua', 'Nguru', 'Geidam']
  },

  // North West
  {
    name: 'Jigawa',
    code: 'JG',
    capital: 'Dutse',
    zone: 'North West',
    majorCities: ['Dutse', 'Hadejia', 'Kazaure', 'Gumel', 'Ringim']
  },
  {
    name: 'Kaduna',
    code: 'KD',
    capital: 'Kaduna',
    zone: 'North West',
    majorCities: ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro', 'Sabon Gari']
  },
  {
    name: 'Kano',
    code: 'KN',
    capital: 'Kano',
    zone: 'North West',
    majorCities: ['Kano', 'Wudil', 'Gwarzo', 'Rano', 'Karaye']
  },
  {
    name: 'Katsina',
    code: 'KT',
    capital: 'Katsina',
    zone: 'North West',
    majorCities: ['Katsina', 'Daura', 'Funtua', 'Malumfashi', 'Dutsin-Ma']
  },
  {
    name: 'Kebbi',
    code: 'KB',
    capital: 'Birnin Kebbi',
    zone: 'North West',
    majorCities: ['Birnin Kebbi', 'Argungu', 'Yauri', 'Zuru', 'Bagudo']
  },
  {
    name: 'Sokoto',
    code: 'SO',
    capital: 'Sokoto',
    zone: 'North West',
    majorCities: ['Sokoto', 'Tambuwal', 'Gwadabawa', 'Illela', 'Shagari']
  },
  {
    name: 'Zamfara',
    code: 'ZA',
    capital: 'Gusau',
    zone: 'North West',
    majorCities: ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Anka', 'Bungudu']
  },

  // South East
  {
    name: 'Abia',
    code: 'AB',
    capital: 'Umuahia',
    zone: 'South East',
    majorCities: ['Umuahia', 'Aba', 'Arochukwu', 'Ohafia', 'Bende']
  },
  {
    name: 'Anambra',
    code: 'AN',
    capital: 'Awka',
    zone: 'South East',
    majorCities: ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Agulu']
  },
  {
    name: 'Ebonyi',
    code: 'EB',
    capital: 'Abakaliki',
    zone: 'South East',
    majorCities: ['Abakaliki', 'Afikpo', 'Onueke', 'Ezza', 'Ishielu']
  },
  {
    name: 'Enugu',
    code: 'EN',
    capital: 'Enugu',
    zone: 'South East',
    majorCities: ['Enugu', 'Nsukka', 'Oji River', 'Agbani', 'Awgu']
  },
  {
    name: 'Imo',
    code: 'IM',
    capital: 'Owerri',
    zone: 'South East',
    majorCities: ['Owerri', 'Orlu', 'Okigwe', 'Mbaise', 'Oguta']
  },

  // South South
  {
    name: 'Akwa Ibom',
    code: 'AK',
    capital: 'Uyo',
    zone: 'South South',
    majorCities: ['Uyo', 'Ikot Ekpene', 'Eket', 'Oron', 'Abak']
  },
  {
    name: 'Bayelsa',
    code: 'BY',
    capital: 'Yenagoa',
    zone: 'South South',
    majorCities: ['Yenagoa', 'Brass', 'Ogbia', 'Sagbama', 'Ekeremor']
  },
  {
    name: 'Cross River',
    code: 'CR',
    capital: 'Calabar',
    zone: 'South South',
    majorCities: ['Calabar', 'Ugep', 'Ikom', 'Obudu', 'Ogoja']
  },
  {
    name: 'Delta',
    code: 'DT',
    capital: 'Asaba',
    zone: 'South South',
    majorCities: ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor']
  },
  {
    name: 'Edo',
    code: 'ED',
    capital: 'Benin City',
    zone: 'South South',
    majorCities: ['Benin City', 'Auchi', 'Ekpoma', 'Uromi', 'Igarra']
  },
  {
    name: 'Rivers',
    code: 'RV',
    capital: 'Port Harcourt',
    zone: 'South South',
    majorCities: ['Port Harcourt', 'Obio-Akpor', 'Okrika', 'Bonny', 'Degema']
  },

  // South West
  {
    name: 'Ekiti',
    code: 'EK',
    capital: 'Ado-Ekiti',
    zone: 'South West',
    majorCities: ['Ado-Ekiti', 'Ikere-Ekiti', 'Ilawe-Ekiti', 'Ijero-Ekiti', 'Ise-Ekiti']
  },
  {
    name: 'Lagos',
    code: 'LA',
    capital: 'Ikeja',
    zone: 'South West',
    majorCities: ['Lagos', 'Ikeja', 'Epe', 'Ikorodu', 'Badagry', 'Lagos Island', 'Victoria Island', 'Lekki']
  },
  {
    name: 'Ogun',
    code: 'OG',
    capital: 'Abeokuta',
    zone: 'South West',
    majorCities: ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ota', 'Ilaro']
  },
  {
    name: 'Ondo',
    code: 'ON',
    capital: 'Akure',
    zone: 'South West',
    majorCities: ['Akure', 'Ondo', 'Owo', 'Ikare', 'Okitipupa']
  },
  {
    name: 'Osun',
    code: 'OS',
    capital: 'Osogbo',
    zone: 'South West',
    majorCities: ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo']
  },
  {
    name: 'Oyo',
    code: 'OY',
    capital: 'Ibadan',
    zone: 'South West',
    majorCities: ['Ibadan', 'Ogbomoso', 'Iseyin', 'Oyo', 'Saki']
  }
];

// Helper functions
export const getStateByName = (name: string): NigerianState | undefined => {
  return NIGERIAN_STATES.find(state => 
    state.name.toLowerCase() === name.toLowerCase()
  );
};

export const getStateByCode = (code: string): NigerianState | undefined => {
  return NIGERIAN_STATES.find(state => 
    state.code.toLowerCase() === code.toLowerCase()
  );
};

export const getStatesByZone = (zone: string): NigerianState[] => {
  return NIGERIAN_STATES.filter(state => 
    state.zone.toLowerCase() === zone.toLowerCase()
  );
};

export const getAllCities = (): string[] => {
  const cities: string[] = [];
  NIGERIAN_STATES.forEach(state => {
    cities.push(...state.majorCities);
  });
  return [...new Set(cities)].sort();
};

export const getCitiesByState = (stateName: string): string[] => {
  const state = getStateByName(stateName);
  return state ? state.majorCities : [];
};

export const GEOPOLITICAL_ZONES = [
  'North Central',
  'North East', 
  'North West',
  'South East',
  'South South',
  'South West'
] as const;

export default NIGERIAN_STATES;
