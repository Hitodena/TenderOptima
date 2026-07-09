import type {
	RequestStatus,
	RequestSupplierStatus,
	TZAnalysisHistoryGroup,
	TZAnalysisRunStatus,
	TZAnalysisSupplierStatus,
} from './enums';

export interface TokenResponse {
	access_token: string;
	token_type: string;
}

export interface UserResponse {
	id: string;
	email: string;
	full_name: string | null;
	company_name?: string | null;
	phone?: string | null;
	contact_email?: string | null;
	business_info?: string | null;
	is_admin?: boolean;
	subscription?: SubscriptionResponse | null;
}

export type SubscriptionPlan = 'test' | 'basic' | 'advanced' | 'corporate';

export interface SubscriptionResponse {
	id: string;
	plan: SubscriptionPlan;
	module_1_enabled: boolean;
	module_2_enabled: boolean;
	max_searches_per_month: number | null;
	max_emails_per_month: number | null;
	max_kp_processed_per_month: number | null;
	max_pages_analyzed_per_month: number | null;
	max_tz_kp_upload_bytes: number | null;
	geo_code: string;
	currency_code: string;
	price_module_1_monthly: string | null;
	price_module_2_monthly: string | null;
	price_bundle_monthly: string | null;
	is_active: boolean;
	expires_at: string | null;
	searches_used_this_month?: number;
	emails_sent_this_month?: number;
	kp_processed_this_month?: number;
	pages_analyzed_this_month?: number;
	pages_analysis_remaining?: number | null;
}

export interface UserEmailSettingsResponse {
	smtp_host: string | null;
	smtp_port: number | null;
	smtp_user: string | null;
	smtp_password_configured: boolean;
	imap_host: string | null;
	imap_port: number | null;
	imap_user: string | null;
	imap_password_configured: boolean;
	current_sender_email: string | null;
}

export interface UserEmailSettingsUpdate {
	smtp_host?: string | null;
	smtp_port?: number | null;
	smtp_user?: string | null;
	smtp_password?: string | null;
	clear_smtp_password?: boolean;
	imap_host?: string | null;
	imap_port?: number | null;
	imap_user?: string | null;
	imap_password?: string | null;
	clear_imap_password?: boolean;
}

export interface BillingProfileResponse {
	country: string | null;
	organization_form: string | null;
	inn: string | null;
	organization_name: string | null;
	kpp: string | null;
	ogrn: string | null;
	legal_address: string | null;
	postal_address: string | null;
	director_name: string | null;
	bik: string | null;
	bank_name: string | null;
	settlement_account: string | null;
	correspondent_account: string | null;
	contact_person: string | null;
	contact_full_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;
}

export type BillingProfileUpdate = Partial<BillingProfileResponse>;

export interface BillingDocumentLineItem {
	name: string;
	amount: string;
}

export interface BillingDocumentResponse {
	id: string;
	receipt_id: string;
	plan: string;
	period_start: string;
	period_end: string;
	currency_code: string;
	total_amount: string;
	line_items: BillingDocumentLineItem[];
	email_status: string;
	sent_at: string | null;
	recipient_email: string | null;
	created_at: string;
}

export interface BillingGenerateRequest {
	period_year?: number | null;
	period_month?: number | null;
	send_email?: boolean;
}

export interface BillingGenerateResponse {
	document: BillingDocumentResponse;
	email_queued: boolean;
}

export interface SubscriptionUpdate {
	plan?: SubscriptionPlan | null;
	module_1_enabled?: boolean | null;
	module_2_enabled?: boolean | null;
	max_searches_per_month?: number | null;
	max_emails_per_month?: number | null;
	max_kp_processed_per_month?: number | null;
	max_pages_analyzed_per_month?: number | null;
	geo_code?: string | null;
	currency_code?: string | null;
	price_module_1_monthly?: string | null;
	price_module_2_monthly?: string | null;
	price_bundle_monthly?: string | null;
	is_active?: boolean | null;
	expires_at?: string | null;
}

export interface AdminUserListItem {
	id: string;
	email: string;
	full_name: string | null;
	company_name: string | null;
	is_admin: boolean;
	created_at: string;
	last_login_at: string | null;
	smtp_password_configured: boolean;
	imap_password_configured: boolean;
	emails_sent_this_month: number;
	pages_analyzed_this_month: number;
	pages_analysis_remaining: number | null;
	subscription: SubscriptionResponse | null;
}

export interface AdminUserDetail {
	id: string;
	email: string;
	full_name: string | null;
	company_name: string | null;
	is_admin: boolean;
	created_at: string;
	last_login_at: string | null;
	email_settings: UserEmailSettingsResponse;
	emails_sent_this_month: number;
	pages_analyzed_this_month: number;
	pages_analysis_remaining: number | null;
	subscription: SubscriptionResponse | null;
}

export interface AdminEmailMessageItem {
	id: string;
	direction: string;
	subject: string | null;
	from_email: string | null;
	to_email: string | null;
	mailbox_email: string | null;
	imap_id: string | null;
	message_id: string | null;
	matched_by: string | null;
	match_confidence: string | null;
	received_at: string | null;
	request_supplier_id: string;
	request_id: string | null;
	tracking_id: string | null;
	supplier_email: string | null;
	supplier_company: string | null;
	supplier_domain: string | null;
	user_email: string | null;
	user_id: string | null;
}

export interface AdminEmailMessagePage {
	items: AdminEmailMessageItem[];
	total: number;
	page: number;
	size: number;
}

export interface AdminEmailMessageLinkUpdate {
	request_supplier_id: string;
}

export interface AdminRequestSupplierRecipientUpdate {
	sent_to_email: string;
}

export interface RegisterCreate {
	email: string;
	password: string;
	full_name: string;
	company_name?: string | null;
	phone: string;
	agree_terms: boolean;
	agree_marketing: boolean;
}

export interface UserUpdate {
	full_name?: string | null;
	company_name?: string | null;
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
	supplier_messages_total?: number;
	supplier_messages_incoming?: number;
	supplier_messages_unread?: number;
	supplier_messages_incoming_suppliers?: number;
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
	extra_emails?: string[] | null;
	phone?: string | null;
	comments?: string | null;
	source?: string | null;
	request_id?: string | null;
	is_enabled?: boolean;
}

export interface Supplier {
	id: string;
	domain: string | null;
	company_name: string;
	main_email: string;
	extra_emails: string[];
	phone?: string | null;
	comments?: string | null;
	from_source?: string | null;
}

export interface SupplierUpdate {
	company_name?: string | null;
	domain?: string | null;
	phone?: string | null;
	extra_emails?: string[] | null;
	comments?: string | null;
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
	is_global?: boolean;
}

export interface BlacklistResponse {
	id: string;
	domain: string;
	reason: string | null;
	is_global: boolean;
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
		id: string;
		body: string | null;
		received_at: string | null;
		direction: 'incoming' | 'outgoing';
		subject?: string | null;
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

export type TZAnalysisStatus = 'met' | 'partial' | 'missing' | 'not_found';

export interface TZAnalysisKpStats {
	match_score: number;
	met_count: number;
	partial_count: number;
	missing_count: number;
	not_found_count: number;
}

export interface TZAnalysisSupplierItem {
	id: string;
	name: string;
	kp_filenames: string[];
	primary_kp_filename?: string | null;
	order_index: number;
	status?: TZAnalysisSupplierStatus;
}

export interface TZAnalysisSupplierCreateRequest {
	name: string;
}

export interface RequirementMatch {
	requirement: string;
	offer_value: string | null;
	numeric_value?: number | null;
	currency?: string | null;
	explanation: string | null;
	status: TZAnalysisStatus;
	corrected_from?: string | null;
}

export interface EmailAnalysisResponse {
	message_id: string;
	status?: TZAnalysisRunStatus;
	parameters: Record<string, string>;
	previous_parameters?: Record<string, string> | null;
	matches: RequirementMatch[];
}

export interface ComparisonSupplier {
	rs_id: string;
	company_name: string;
	main_email: string;
	is_winner?: boolean;
	values: Record<string, string | null>;
	previous_values: Record<string, string | null>;
	explanations?: Record<string, string | null>;
	corrected_from?: Record<string, string | null>;
	statuses: Record<string, string | null>;
	numeric_values?: Record<string, number | null>;
	percent_vs_min?: Record<string, number | null>;
}

export interface ComparisonResponse {
	requirements: string[];
	price_requirements?: string[];
	suppliers: ComparisonSupplier[];
}

export interface RefreshAllResponse {
	queued: number;
}

export interface EmailTemplate {
	id: string;
	user_id: string | null;
	title: string;
	subject: string;
	body: string;
	is_global: boolean;
	created_at: string;
	updated_at: string;
}

export interface CustomEmailPayload {
	subject: string;
	body: string;
	attachment_paths?: string[] | null;
}

export interface SupplierBookmarkItem {
	id: string;
	company_name: string;
	email: string;
	domain: string | null;
	phone: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

export interface SupplierBookmarkList {
	id: string;
	user_id: string | null;
	title: string;
	is_global: boolean;
	items: SupplierBookmarkItem[];
	created_at: string;
	updated_at: string;
}

export interface SupplierBookmarkListCreate {
	title: string;
	is_global?: boolean;
}

export interface SupplierBookmarkItemCreate {
	company_name: string;
	email: string;
	domain?: string | null;
	phone?: string | null;
	notes?: string | null;
}

export interface SupplierBookmarkItemUpdate {
	company_name?: string;
	email?: string;
	domain?: string | null;
	phone?: string | null;
	notes?: string | null;
}

export interface RequirementNode {
	text: string;
	children: Record<string, RequirementNode>;
	ref_value?: string;
	ref?: string;
}

export type RequirementsHierarchy = Record<string, RequirementNode>;

export interface TZAnalysisItem {
	requirement: string;
	requirement_ref: string | null;
	ref?: string | null;
	ref_value?: string | null;
	offer_value: string | null;
	offer_ref: string | null;
	explanation: string;
	status: TZAnalysisStatus;
	kp_name?: string | null;
}

export interface TZAnalysisSession {
	id: string | null;
	title?: string | null;
	status?: TZAnalysisRunStatus;
	tz_filename: string | null;
	kp_filename: string | null;
	kp_filenames?: string[];
	confirmed?: boolean;
	requirements_tz?: RequirementsHierarchy;
	requirements_kp?: Record<string, RequirementsHierarchy>;
	kp_stats?: Record<string, TZAnalysisKpStats>;
	suppliers?: TZAnalysisSupplierItem[];
	items: TZAnalysisItem[];
	items_overrides?: Record<string, { status: TZAnalysisStatus }>;
	match_score: number;
	met_count: number;
	partial_count: number;
	missing_count: number;
	not_found_count: number;
	tz_requirements_count?: number;
	created_at: string | null;
}

export interface TZAnalysisListItem {
	id: string;
	title: string;
	tz_filename: string | null;
	kp_filename: string | null;
	kp_filenames?: string[];
	confirmed?: boolean;
	status: TZAnalysisRunStatus;
	match_score: number;
	met_count: number;
	partial_count: number;
	missing_count: number;
	not_found_count: number;
	created_at: string;
}

export interface TZAnalysisHistoryPageResponse {
	items: TZAnalysisListItem[];
	page: number;
	size: number;
	has_more: boolean;
	group: TZAnalysisHistoryGroup;
}

export interface TZAnalysisCompleteResponse {
	id: string;
	status: TZAnalysisRunStatus;
}

export interface TZAnalysisDocxRequest {
	selected_indices: number[];
	deadline_date?: string | null;
	paragraphs?: string[] | null;
}

export interface TZItemsOverridesRequest {
	overrides: Record<string, { status: TZAnalysisStatus }>;
}

export interface TZAnalysisCreateRequest {
	title: string;
}

export interface TZRequirementsUpdateRequest {
	requirements_tz: RequirementsHierarchy;
	requirements_kp?: Record<string, RequirementsHierarchy>;
}

export interface TZAnalysisConfirmRequest {
	requirements_tz?: RequirementsHierarchy;
	requirements_kp?: Record<string, RequirementsHierarchy>;
}

export interface TZPrimaryKpRequest {
	kp_filename: string;
}

export interface TZAnalysisSupplierRenameRequest {
	name: string;
}

export interface TZAnalysisPreviewResponse {
	title: string;
	paragraphs: string[];
	has_issues: boolean;
}

export interface UserBrief {
	id: string;
	email: string;
	full_name: string | null;
}

export interface FrontendErrorLogCreate {
	message: string;
	backend_response?: string | null;
	page_url?: string | null;
	request_method?: string | null;
	request_url?: string | null;
	status_code?: number | null;
}

export interface FrontendErrorLogResponse {
	id: string;
	user_id: string | null;
	user: UserBrief | null;
	message: string;
	backend_response: string | null;
	page_url: string | null;
	request_method: string | null;
	request_url: string | null;
	status_code: number | null;
	created_at: string;
}

export interface FrontendErrorLogPageResponse {
	items: FrontendErrorLogResponse[];
	page: number;
	size: number;
	total: number;
}

export interface IdeaSuggestionCreate {
	message: string;
}

export interface IdeaSuggestionResponse {
	id: string;
	user_id: string;
	user: UserBrief | null;
	message: string;
	created_at: string;
}

export interface IdeaSuggestionPageResponse {
	items: IdeaSuggestionResponse[];
	page: number;
	size: number;
	total: number;
}
