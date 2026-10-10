export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;
export type IndianState = (typeof INDIAN_STATES)[number];

/**
 * Bundled State → City list (offline, no external API). A practical set of district HQs / major towns per
 * state/UT, alphabetical. Used by web + mobile pickers and by the API to check a city belongs to its state.
 */
export const INDIAN_CITIES: Record<IndianState, readonly string[]> = {
  'Andhra Pradesh': ['Anantapur', 'Bhimavaram', 'Chittoor', 'Eluru', 'Guntur', 'Hindupur', 'Kadapa', 'Kakinada', 'Kurnool', 'Machilipatnam', 'Madanapalle', 'Nandyal', 'Nellore', 'Ongole', 'Proddatur', 'Rajahmundry', 'Srikakulam', 'Tadepalligudem', 'Tenali', 'Tirupati', 'Vijayawada', 'Visakhapatnam', 'Vizianagaram'],
  'Arunachal Pradesh': ['Aalo', 'Bomdila', 'Itanagar', 'Naharlagun', 'Pasighat', 'Roing', 'Tawang', 'Tezu', 'Ziro'],
  Assam: ['Barpeta', 'Bongaigaon', 'Dhubri', 'Dibrugarh', 'Diphu', 'Goalpara', 'Golaghat', 'Guwahati', 'Jorhat', 'Karimganj', 'Kokrajhar', 'Nagaon', 'North Lakhimpur', 'Silchar', 'Sivasagar', 'Tezpur', 'Tinsukia'],
  Bihar: ['Arrah', 'Aurangabad', 'Begusarai', 'Bettiah', 'Bhagalpur', 'Bihar Sharif', 'Buxar', 'Chapra', 'Darbhanga', 'Gaya', 'Hajipur', 'Katihar', 'Kishanganj', 'Motihari', 'Munger', 'Muzaffarpur', 'Patna', 'Purnia', 'Saharsa', 'Samastipur', 'Sasaram', 'Siwan'],
  Chhattisgarh: ['Ambikapur', 'Bhilai', 'Bilaspur', 'Dhamtari', 'Durg', 'Jagdalpur', 'Janjgir', 'Kanker', 'Korba', 'Mahasamund', 'Raigarh', 'Raipur', 'Rajnandgaon'],
  Goa: ['Bicholim', 'Canacona', 'Curchorem', 'Mapusa', 'Margao', 'Mormugao', 'Panaji', 'Pernem', 'Ponda', 'Quepem', 'Sanguem', 'Vasco da Gama'],
  Gujarat: ['Ahmedabad', 'Amreli', 'Anand', 'Bharuch', 'Bhavnagar', 'Bhuj', 'Gandhidham', 'Gandhinagar', 'Godhra', 'Jamnagar', 'Junagadh', 'Mehsana', 'Morbi', 'Nadiad', 'Navsari', 'Palanpur', 'Patan', 'Porbandar', 'Rajkot', 'Surat', 'Surendranagar', 'Vadodara', 'Valsad', 'Vapi'],
  Haryana: ['Ambala', 'Bahadurgarh', 'Bhiwani', 'Faridabad', 'Fatehabad', 'Gurugram', 'Hisar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'],
  'Himachal Pradesh': ['Baddi', 'Bilaspur', 'Chamba', 'Dharamshala', 'Hamirpur', 'Kangra', 'Kullu', 'Mandi', 'Manali', 'Nahan', 'Palampur', 'Shimla', 'Solan', 'Una'],
  Jharkhand: ['Bokaro Steel City', 'Chaibasa', 'Deoghar', 'Dhanbad', 'Dumka', 'Giridih', 'Hazaribagh', 'Jamshedpur', 'Medininagar', 'Phusro', 'Ramgarh', 'Ranchi'],
  Karnataka: ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru', 'Bidar', 'Chikkamagaluru', 'Chitradurga', 'Davanagere', 'Dharwad', 'Gadag', 'Hassan', 'Hosapete', 'Hubballi', 'Kalaburagi', 'Karwar', 'Kolar', 'Mandya', 'Mangaluru', 'Manipal', 'Mysuru', 'Raichur', 'Shivamogga', 'Tumakuru', 'Udupi', 'Vijayapura'],
  Kerala: ['Alappuzha', 'Kannur', 'Kasaragod', 'Kochi', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thalassery', 'Thiruvananthapuram', 'Thrissur', 'Tirur'],
  'Madhya Pradesh': ['Bhopal', 'Burhanpur', 'Chhindwara', 'Dewas', 'Gwalior', 'Indore', 'Jabalpur', 'Katni', 'Khandwa', 'Morena', 'Neemuch', 'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Shivpuri', 'Singrauli', 'Ujjain', 'Vidisha'],
  Maharashtra: ['Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Baramati', 'Beed', 'Bhandara', 'Bhiwandi', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Ichalkaranji', 'Jalgaon', 'Jalna', 'Kalyan', 'Kolhapur', 'Latur', 'Mumbai', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Navi Mumbai', 'Osmanabad', 'Palghar', 'Panvel', 'Parbhani', 'Pimpri-Chinchwad', 'Pune', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Vasai-Virar', 'Wardha', 'Washim', 'Yavatmal'],
  Manipur: ['Bishnupur', 'Churachandpur', 'Imphal', 'Kakching', 'Senapati', 'Thoubal', 'Ukhrul'],
  Meghalaya: ['Jowai', 'Nongpoh', 'Nongstoin', 'Shillong', 'Tura', 'Williamnagar'],
  Mizoram: ['Aizawl', 'Champhai', 'Kolasib', 'Lawngtlai', 'Lunglei', 'Saiha', 'Serchhip'],
  Nagaland: ['Dimapur', 'Kohima', 'Mokokchung', 'Mon', 'Phek', 'Tuensang', 'Wokha', 'Zunheboto'],
  Odisha: ['Angul', 'Balasore', 'Baripada', 'Berhampur', 'Bhadrak', 'Bhubaneswar', 'Bolangir', 'Cuttack', 'Jajpur', 'Jeypore', 'Jharsuguda', 'Kendrapara', 'Koraput', 'Puri', 'Rayagada', 'Rourkela', 'Sambalpur'],
  Punjab: ['Abohar', 'Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Firozpur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Mohali', 'Moga', 'Muktsar', 'Pathankot', 'Patiala', 'Phagwara', 'Rajpura', 'Sangrur'],
  Rajasthan: ['Ajmer', 'Alwar', 'Banswara', 'Barmer', 'Beawar', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Chittorgarh', 'Churu', 'Dausa', 'Hanumangarh', 'Jaipur', 'Jaisalmer', 'Jhunjhunu', 'Jodhpur', 'Kota', 'Nagaur', 'Pali', 'Sikar', 'Sri Ganganagar', 'Tonk', 'Udaipur'],
  Sikkim: ['Gangtok', 'Gyalshing', 'Mangan', 'Namchi', 'Rangpo', 'Singtam'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Cuddalore', 'Dindigul', 'Erode', 'Hosur', 'Kanchipuram', 'Karur', 'Kumbakonam', 'Madurai', 'Nagercoil', 'Namakkal', 'Pudukkottai', 'Rajapalayam', 'Salem', 'Sivakasi', 'Thanjavur', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tiruppur', 'Tiruvannamalai', 'Vellore', 'Villupuram'],
  Telangana: ['Adilabad', 'Hyderabad', 'Karimnagar', 'Khammam', 'Mahbubnagar', 'Mancherial', 'Miryalaguda', 'Nalgonda', 'Nizamabad', 'Ramagundam', 'Secunderabad', 'Siddipet', 'Suryapet', 'Warangal'],
  Tripura: ['Agartala', 'Ambassa', 'Belonia', 'Dharmanagar', 'Kailashahar', 'Khowai', 'Udaipur'],
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Ayodhya', 'Azamgarh', 'Bareilly', 'Etawah', 'Firozabad', 'Ghaziabad', 'Gorakhpur', 'Greater Noida', 'Jhansi', 'Kanpur', 'Lucknow', 'Mathura', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Noida', 'Prayagraj', 'Rampur', 'Saharanpur', 'Shahjahanpur', 'Sitapur', 'Varanasi'],
  Uttarakhand: ['Almora', 'Dehradun', 'Haldwani', 'Haridwar', 'Kashipur', 'Mussoorie', 'Nainital', 'Pithoragarh', 'Rishikesh', 'Roorkee', 'Rudrapur', 'Srinagar'],
  'West Bengal': ['Asansol', 'Baharampur', 'Bardhaman', 'Durgapur', 'Haldia', 'Howrah', 'Jalpaiguri', 'Kharagpur', 'Kolkata', 'Krishnanagar', 'Malda', 'Midnapore', 'Siliguri'],
  'Andaman and Nicobar Islands': ['Car Nicobar', 'Diglipur', 'Mayabunder', 'Port Blair'],
  Chandigarh: ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  Delhi: ['Delhi', 'New Delhi'],
  'Jammu and Kashmir': ['Anantnag', 'Baramulla', 'Jammu', 'Kathua', 'Pulwama', 'Rajouri', 'Sopore', 'Srinagar', 'Udhampur'],
  Ladakh: ['Kargil', 'Leh'],
  Lakshadweep: ['Agatti', 'Amini', 'Andrott', 'Kavaratti', 'Minicoy'],
  Puducherry: ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
};

export const isIndianState = (state: string): state is IndianState => (INDIAN_STATES as readonly string[]).includes(state);

/** Cities of a state ([] when no/unknown state). */
export const citiesForState = (state: string | null | undefined): readonly string[] => (state && isIndianState(state) ? INDIAN_CITIES[state] : []);

/** The standard city spelling for this state (case-insensitive match), or null when not in the dataset. */
export const findCity = (state: string, city: string): string | null => {
  const want = city.trim().toLowerCase();
  return citiesForState(state).find((c) => c.toLowerCase() === want) ?? null;
};

/**
 * City rule (client + API): the city must belong to the selected state. A mess saved before this rule keeps
 * its old free-text city as long as neither city nor state is changed (`saved` = stored values).
 */
export function cityStateError(state: string, city: string, saved?: { state: string; city: string } | null): string | undefined {
  if (!city.trim()) return undefined;
  if (findCity(state, city)) return undefined;
  if (saved && saved.state === state && saved.city.trim() === city.trim()) return undefined;
  return state ? 'Select a city from the list for this state' : 'Select a state first';
}
