export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name: string | null;
}

export interface RegisterCreate {
  email: string;
  password: string;
  full_name: string;
  company_name?: string | null;
  agree_terms: boolean;
  agree_marketing: boolean;
}

export interface RequestCreate {
  query: string;
  delivery_region: string;
}

export interface RequestResponse {
  id: string;
  user_id: string;
  query: string;
  status: string;
  tracking_id: string;
  delivery_region: string | null;
  description: string;
  delivery_deadline: string | null;
  currency: string;
  created_at: string;
  additional_params?: AdditionalParams | null;
}

export interface AdditionalParams {
  included_fields?: string[];
  custom_params?: Array<{ label: string; value: string }>;
}

export interface RequestSupplierResponse {
  id: string;
  supplier: Supplier;
  status: string;
  is_enabled: boolean;
  sent_at: string | null;
}

export interface SearchResult {
  saved_suppliers: number;
  skipped_blacklisted: number;
  skipped_no_email: number;
  request_id: string;
}

export interface LaunchMailingResponse {
  status: string;
  request_id: string;
  pending: number;
}

export interface Attachment {
  filename: string;
  content_type: string | null;
  size: number | null;
  path: string | null;
}

export interface Supplier {
  id: string;
  domain: string;
  company_name: string;
  email: string;
}

export interface SupplierResponseResponse {
  id: string;
  subject: string | null;
  raw_body: string | null;
  attachments: Attachment[] | null;
  received_at: string | null;
  supplier: Supplier;
}

export interface BlacklistCreate {
  domain: string;
  reason?: string | null;
}

export interface BlacklistResponse {
  id: string;
  domain: string;
  reason: string | null;
  created_at: string;
}

export interface SearchHistoryResponse {
  id: string;
  query: string;
  results_count: number | null;
  request_id: string | null;
  created_at: string;
}
