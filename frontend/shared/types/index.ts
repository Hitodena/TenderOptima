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
	status: RequestStatus;
	tracking_id: string;
	delivery_region: string | null;
	description: string;
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
	status: RequestStatus;
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

export const RequestStatus = {
	DRAFT: 'draft',
	ACTIVE: 'active',
	QUEUED: 'queued',
	COMPLETED: 'completed',
} as const;

export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const RequestSupplierStatus = {
	PENDING: 'pending',
	SENT: 'sent',
	REPLIED: 'replied',
	FAILED: 'failed',
} as const;

export type RequestSupplierStatus =
	(typeof RequestSupplierStatus)[keyof typeof RequestSupplierStatus];

type BadgeColor =
	| 'neutral'
	| 'primary'
	| 'success'
	| 'warning'
	| 'error'
	| 'info'
	| 'secondary';

export const REQUEST_STATUS_COLOR: Record<RequestStatus, BadgeColor> = {
	[RequestStatus.DRAFT]: 'neutral',
	[RequestStatus.ACTIVE]: 'success',
	[RequestStatus.QUEUED]: 'warning',
	[RequestStatus.COMPLETED]: 'success',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
	[RequestStatus.DRAFT]: 'Черновик',
	[RequestStatus.ACTIVE]: 'Активный',
	[RequestStatus.QUEUED]: 'В очереди',
	[RequestStatus.COMPLETED]: 'Завершён',
};

export const SUPPLIER_STATUS_COLOR: Record<RequestSupplierStatus, BadgeColor> =
	{
		[RequestSupplierStatus.PENDING]: 'neutral',
		[RequestSupplierStatus.SENT]: 'primary',
		[RequestSupplierStatus.REPLIED]: 'success',
		[RequestSupplierStatus.FAILED]: 'error',
	};

export const SUPPLIER_STATUS_LABEL: Record<RequestSupplierStatus, string> = {
	[RequestSupplierStatus.PENDING]: 'Ожидает',
	[RequestSupplierStatus.SENT]: 'Отправлено',
	[RequestSupplierStatus.REPLIED]: 'Ответил',
	[RequestSupplierStatus.FAILED]: 'Ошибка',
};

export function getRequestStatusColor(s: string): BadgeColor {
	return REQUEST_STATUS_COLOR[s as RequestStatus] ?? 'neutral';
}

export function getRequestStatusLabel(s: string): string {
	return REQUEST_STATUS_LABEL[s as RequestStatus] ?? s;
}

export function getSupplierStatusColor(s: string): BadgeColor {
	return SUPPLIER_STATUS_COLOR[s as RequestSupplierStatus] ?? 'neutral';
}

export function getSupplierStatusLabel(s: string): string {
	return SUPPLIER_STATUS_LABEL[s as RequestSupplierStatus] ?? s;
}
