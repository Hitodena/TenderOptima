import type { RequestSupplierResponse } from '#shared/types'
import { RequestSupplierStatus } from '#shared/types/enums'
import { isManualSupplierSource } from '#shared/utils/subscriptionAccess'

type QuotaSupplier = Pick<RequestSupplierResponse, 'id' | 'is_enabled' | 'sent_status' | 'supplier'>

export interface SupplierQuotaLimits {
	/** Emails left this month; null = unlimited. */
	emailRemaining: number | null
	/** Trial only: search suppliers allowed per request; null = no trial limit. */
	searchLimit: number | null
	/** Trial only: total suppliers (search + manual) allowed per request. */
	selectableLimit: number | null
	/** Trial only: manually added suppliers allowed per request. */
	manualLimit: number | null
}

/** Only rows without a sent letter can be switched off or on for mailing. */
export function isPendingRequestSupplier(rs: Pick<RequestSupplierResponse, 'sent_status'>): boolean {
	return rs.sent_status === RequestSupplierStatus.PENDING
}

/**
 * Enabled suppliers that must be switched off to fit the subscription.
 *
 * Suppliers that already got the letter are never returned: their emails are
 * already counted in the monthly usage, and switching them off hides their
 * correspondence and offers from the request. They still occupy trial slots.
 */
export function supplierIdsOverQuota(
	suppliers: readonly QuotaSupplier[],
	limits: SupplierQuotaLimits,
): string[] {
	const { emailRemaining, searchLimit, selectableLimit, manualLimit } = limits
	if (emailRemaining == null && searchLimit == null && selectableLimit == null && manualLimit == null) {
		return []
	}

	const enabled = suppliers.filter((s) => s.is_enabled)
	let keptSearch = 0
	let keptManual = 0
	for (const s of enabled) {
		if (isPendingRequestSupplier(s)) continue
		if (isManualSupplierSource(s.supplier?.from_source)) keptManual++
		else keptSearch++
	}

	let keptPending = 0
	const toDisable: string[] = []
	for (const s of enabled) {
		if (!isPendingRequestSupplier(s)) continue
		const manual = isManualSupplierSource(s.supplier?.from_source)
		const overQuota = emailRemaining != null && keptPending >= emailRemaining
		const overSelectable = selectableLimit != null && keptSearch + keptManual >= selectableLimit
		const overKind = manual
			? manualLimit != null && keptManual >= manualLimit
			: searchLimit != null && keptSearch >= searchLimit
		if (overQuota || overSelectable || overKind) {
			toDisable.push(s.id)
			continue
		}
		keptPending++
		if (manual) keptManual++
		else keptSearch++
	}
	return toDisable
}
