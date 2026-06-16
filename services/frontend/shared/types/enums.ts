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
