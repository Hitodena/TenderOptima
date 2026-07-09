export const RequestStatus = {
	DRAFT: 'draft',
	SEARCHING: 'searching',
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

export const TZAnalysisHistoryGroup = {
	DRAFT: 'draft',
	ACTIVE: 'active',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
} as const;

export type TZAnalysisHistoryGroup =
	(typeof TZAnalysisHistoryGroup)[keyof typeof TZAnalysisHistoryGroup];

export const TZAnalysisRunStatus = {
	DRAFT: 'draft',
	ACTIVE: 'active',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	FAILED: 'failed',
} as const;

export type TZAnalysisRunStatus =
	(typeof TZAnalysisRunStatus)[keyof typeof TZAnalysisRunStatus];

export const TZAnalysisSupplierStatus = {
	PENDING: 'pending',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	FAILED: 'failed',
} as const;

export type TZAnalysisSupplierStatus =
	(typeof TZAnalysisSupplierStatus)[keyof typeof TZAnalysisSupplierStatus];

export const ConsultationRole = {
	PROCUREMENT_MANAGER: 'procurement_manager',
	TENDER_SPECIALIST: 'tender_specialist',
	TECH_SPECIALIST: 'tech_specialist',
	DIRECTOR: 'director',
	OTHER: 'other',
} as const;

export type ConsultationRole = (typeof ConsultationRole)[keyof typeof ConsultationRole];

export const ConsultationRequestType = {
	DEMO: 'demo',
	TRIAL: 'trial',
} as const;

export type ConsultationRequestType =
	(typeof ConsultationRequestType)[keyof typeof ConsultationRequestType];

export const ConsultationStatus = {
	NEW: 'new',
	IN_PROGRESS: 'in_progress',
	DONE: 'done',
	REJECTED: 'rejected',
} as const;

export type ConsultationStatus = (typeof ConsultationStatus)[keyof typeof ConsultationStatus];
