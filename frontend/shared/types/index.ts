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
	email_subject?: string | null;
	attachment_paths: string[] | null;
}

export interface RequestSupplierResponse {
	id: string;
	supplier: Supplier;
	status: RequestSupplierStatus;
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

export interface SupplierSummary {
	id: string;
	domain: string;
	company_name: string | null;
	email: string | null;
}

export interface ThreadSummary {
	rs_id: string;
	supplier: SupplierSummary;
	last_message: ThreadMessage | null;
	message_count: number;
	unread: boolean;
}

export interface ThreadMessage {
	id: string;
	direction: 'incoming' | 'outgoing';
	subject: string | null;
	body: string | null;
	received_at: string | null;
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
	CLOSED: 'closed',
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
	[RequestStatus.CLOSED]: 'info',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
	[RequestStatus.DRAFT]: 'Черновик',
	[RequestStatus.ACTIVE]: 'Активный',
	[RequestStatus.QUEUED]: 'В очереди на рассылку',
	[RequestStatus.COMPLETED]: 'Завершён',
	[RequestStatus.CLOSED]: 'Закрыт',
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
