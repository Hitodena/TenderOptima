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
}

export interface RequestCreate {
	query: string;
	delivery_region?: string | null;
	description?: string | null;
	quantity?: number | null;
	unit?: string | null;
	quality_requirements?: string | null;
	delivery_deadline?: string | null;
	max_price_per_unit?: number | string | null;
	currency?: string | null;
}

export interface RequestResponse {
	id: string;
	user_id: string;
	query: string;
	status: string;
	tracking_id: string;
	delivery_region: string | null;
	description: string | null;
	quantity: number | null;
	unit: string | null;
	quality_requirements: string | null;
	delivery_deadline: string | null;
	max_price_per_unit: string | null;
	currency: string | null;
	created_at: string;
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
