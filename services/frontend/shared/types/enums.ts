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
