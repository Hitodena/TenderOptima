import type { RequestStatus, RequestSupplierStatus } from './enums';

export interface TokenResponse {
	access_token: string;
	token_type: string;
}

export interface UserResponse {
	id: string;
	email: string;
	full_name: string | null;
	contact_email?: string | null;
	business_info?: string | null;
}

export interface RegisterCreate {
	email: string;
	password: string;
	full_name: string;
	company_name?: string | null;
	agree_terms: boolean;
	agree_marketing: boolean;
}

export interface UserUpdate {
	full_name?: string | null;
	contact_email?: string | null;
	business_info?: string | null;
}

export interface RequestCreate {
	query: string;
	delivery_region: string;
}

export interface RequestUpdate {
	description: string;
	additional_params?: string[] | null;
	attachments?: AttachmentInfo[] | null;
}

export interface AttachmentInfo {
	filename: string;
	content_type: string | null;
	size: number;
	path: string;
}

export interface RequestResponse {
	id: string;
	user_id: string;
	query: string;
	status: RequestStatus;
	delivery_region: string;
	description: string;
	created_at: string;
	additional_params?: string[] | null;
	email_message: string | null;
	email_subject: string | null;
	attachment_paths: string[] | null;
}

export interface RequestSupplierResponse {
	id: string;
	supplier: Supplier;
	sent_status: RequestSupplierStatus;
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
	status: RequestStatus;
	request_id: string;
	pending: number;
}

export interface Attachment {
	filename: string;
	content_type: string | null;
	size: number | null;
	path: string | null;
}

export interface SupplierCreate {
	domain?: string | null;
	company_name: string;
	email: string;
	source?: string | null;
	request_id?: string | null;
}

export interface Supplier {
	id: string;
	domain: string | null;
	company_name: string;
	main_email: string;
	extra_emails: string[];
}

export interface SupplierEmailUpdate {
	main_email: string;
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

export interface ThreadSummary {
	rs_id: string;
	supplier: Supplier;
	last_message: {
		body: string | null;
		received_at: string | null;
		direction: 'incoming' | 'outgoing';
	} | null;
	message_count: number;
	unread: boolean;
}

export interface Message {
	id: string;
	direction: 'incoming' | 'outgoing';
	subject: string | null;
	raw_body: string | null;
	attachments: Attachment[] | null;
	received_at: string | null;
}

export interface ReplyPayload {
	body: string;
}
