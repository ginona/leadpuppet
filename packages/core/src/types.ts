export interface RawPlace {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
}

export interface RawSearchResponse {
  places?: RawPlace[];
  nextPageToken?: string;
}

export interface SearchResult {
  places: RawPlace[];
  pages: number;
}

export interface IcpProfile {
  name: string;
  categories: string[];
  cities: string[];
  targetCount: number;
  maxQueries: number;
}

export interface IcpQuery {
  queryText: string;
  city: string;
}

export interface Lead {
  name: string;
  website: string;
  phone: string | null;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  sourceQuery: string;
  /** Only present when run with --include-instagram; absent (not null) in default mode. */
  instagram?: string | null;
  /** Only present when --include-instagram detects that website is a pure WhatsApp redirect. */
  whatsapp?: string | null;
}

export interface ContactInfo {
  name: string | null;
  role: string | null;
  email: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface EnrichedLead extends Lead {
  contactName: string | null;
  contactRole: string | null;
  contactEmail: string | null;
  confidence: 'high' | 'medium' | 'low';
}
