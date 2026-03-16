// Lead360 - Crew Member Type Definitions
// Matches crew_member_REST_API.md response shapes exactly
// Sensitive fields: ssn, itin, drivers_license_number, bank_routing, bank_account
// These are always masked in responses; use reveal endpoint for full values

// ========== CREW MEMBER ENTITY ==========

export interface CrewMember {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  date_of_birth: string | null;
  // Masked sensitive fields
  ssn_masked: string | null;
  has_ssn: boolean;
  itin_masked: string | null;
  has_itin: boolean;
  has_drivers_license: boolean;
  drivers_license_masked: string | null;
  has_drivers_license_number: boolean;
  // Employment
  default_hourly_rate: number | null;
  weekly_hours_schedule: number | null;
  overtime_enabled: boolean;
  overtime_rate_multiplier: number | null;
  // Payment
  default_payment_method: PaymentMethod | null;
  bank_name: string | null;
  bank_routing_masked: string | null;
  has_bank_routing: boolean;
  bank_account_masked: string | null;
  has_bank_account: boolean;
  venmo_handle: string | null;
  zelle_contact: string | null;
  // Profile
  profile_photo_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// ========== PAYMENT METHOD ENUM ==========

export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'venmo' | 'zelle';

// ========== REVEALABLE FIELDS ==========

export type RevealableCrewField = 'ssn' | 'itin' | 'drivers_license_number' | 'bank_routing' | 'bank_account';

export interface RevealFieldResponse {
  field: RevealableCrewField;
  value: string;
}

// ========== DTOs ==========

export interface CreateCrewMemberDto {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  date_of_birth?: string;
  ssn?: string;
  itin?: string;
  has_drivers_license?: boolean;
  drivers_license_number?: string;
  default_hourly_rate?: number;
  weekly_hours_schedule?: number;
  overtime_enabled?: boolean;
  overtime_rate_multiplier?: number;
  default_payment_method?: PaymentMethod;
  bank_name?: string;
  bank_routing_number?: string;
  bank_account_number?: string;
  venmo_handle?: string;
  zelle_contact?: string;
  notes?: string;
}

export interface UpdateCrewMemberDto extends Partial<CreateCrewMemberDto> {
  is_active?: boolean;
}

// ========== LIST RESPONSE ==========

export interface ListCrewMembersResponse {
  data: CrewMember[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ========== FILTERS ==========

export interface CrewMemberFilters {
  page?: number;
  limit?: number;
  is_active?: boolean;
  search?: string;
}

// ========== CREW HOURS SUMMARY ==========

export interface CrewHoursSummary {
  crew_member_id: string;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_hours: number;
  logs_by_project: CrewHoursProjectBreakdown[];
}

export interface CrewHoursProjectBreakdown {
  project_id: string;
  project_name: string;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
}

// ========== US STATES ==========

export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
] as const;

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer (ACH)' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
];
