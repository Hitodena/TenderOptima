// Run from services/frontend (Node 22.18+ or 24):
//   node --import ./tests/register-alias.mjs --test "tests/*.test.ts"
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isPendingRequestSupplier, supplierIdsOverQuota, type SupplierQuotaLimits } from '../shared/utils/supplierQuota.ts'

type Status = 'pending' | 'sent' | 'failed' | 'replied'

function rs(id: string, status: Status, source: 'parser' | 'manual' = 'parser', enabled = true) {
	return {
		id,
		is_enabled: enabled,
		sent_status: status,
		supplier: { from_source: source },
	} as Parameters<typeof supplierIdsOverQuota>[0][number]
}

const paid = (emailRemaining: number | null): SupplierQuotaLimits => ({
	emailRemaining,
	searchLimit: null,
	selectableLimit: null,
	manualLimit: null,
})

/** Trial: 10 search + 1 manual per request, 11 emails a month. */
const trial = (emailRemaining: number, manualCount = 1): SupplierQuotaLimits => ({
	emailRemaining,
	searchLimit: 10,
	selectableLimit: 10 + Math.min(1, manualCount),
	manualLimit: 1,
})

const sentSearch = (n: number, status: Status = 'sent') =>
	Array.from({ length: n }, (_, i) => rs(`s${i + 1}`, status))

describe('supplierIdsOverQuota — sent suppliers are never switched off', () => {
	it('user scenario: 10 sent, 1 email left, one manual added — nothing is switched off', () => {
		const list = [rs('m1', 'pending', 'manual'), ...sentSearch(10)]
		assert.deepEqual(supplierIdsOverQuota(list, trial(1)), [])
		assert.deepEqual(supplierIdsOverQuota(list, paid(1)), [])
	})

	it('reopening the request after the mailing used the whole quota keeps every sent row', () => {
		assert.deepEqual(supplierIdsOverQuota(sentSearch(10), trial(0)), [])
		assert.deepEqual(supplierIdsOverQuota(sentSearch(10), paid(0)), [])
		assert.deepEqual(supplierIdsOverQuota(sentSearch(10), paid(3)), [])
	})

	for (const status of ['sent', 'failed', 'replied'] as const) {
		it(`${status} rows stay enabled even when far over quota`, () => {
			const list = [...sentSearch(5, status), rs('p1', 'pending')]
			assert.deepEqual(supplierIdsOverQuota(list, paid(0)), ['p1'])
		})
	}

	it('a sent manual supplier stays enabled on trial even with another manual added', () => {
		const list = [rs('m-old', 'sent', 'manual'), rs('m-new', 'pending', 'manual')]
		assert.deepEqual(supplierIdsOverQuota(list, trial(5)), ['m-new'])
	})
})

describe('supplierIdsOverQuota — monthly quota counts only unsent suppliers', () => {
	it('unlimited paid plan: nothing to trim', () => {
		const list = Array.from({ length: 50 }, (_, i) => rs(`p${i}`, 'pending'))
		assert.deepEqual(supplierIdsOverQuota(list, paid(null)), [])
	})

	it('pending exactly at the quota: nothing trimmed (boundary)', () => {
		const list = [...sentSearch(4), rs('p1', 'pending'), rs('p2', 'pending')]
		assert.deepEqual(supplierIdsOverQuota(list, paid(2)), [])
	})

	it('one pending over the quota: the last one in list order is trimmed (boundary)', () => {
		const list = [...sentSearch(4), rs('p1', 'pending'), rs('p2', 'pending'), rs('p3', 'pending')]
		assert.deepEqual(supplierIdsOverQuota(list, paid(2)), ['p3'])
	})

	it('quota 0: every pending row is trimmed, sent rows are not', () => {
		const list = [rs('p1', 'pending'), ...sentSearch(2), rs('p2', 'pending', 'manual')]
		assert.deepEqual(supplierIdsOverQuota(list, paid(0)), ['p1', 'p2'])
	})

	it('disabled rows are ignored and do not take quota', () => {
		const list = [rs('off', 'pending', 'parser', false), rs('p1', 'pending'), rs('sent-off', 'sent', 'parser', false)]
		assert.deepEqual(supplierIdsOverQuota(list, paid(1)), [])
	})

	it('paid plan: several manual suppliers are allowed (no trial manual slot)', () => {
		const list = [rs('m1', 'pending', 'manual'), rs('m2', 'pending', 'manual'), rs('m3', 'pending', 'manual')]
		assert.deepEqual(supplierIdsOverQuota(list, paid(10)), [])
	})

	it('empty list', () => {
		assert.deepEqual(supplierIdsOverQuota([], trial(11)), [])
	})
})

describe('supplierIdsOverQuota — trial per-request slots', () => {
	it('fresh request: 10 search + 1 manual fit, the 11th search and 2nd manual do not', () => {
		const list = [
			rs('m1', 'pending', 'manual'),
			rs('m2', 'pending', 'manual'),
			...Array.from({ length: 11 }, (_, i) => rs(`p${i + 1}`, 'pending')),
		]
		assert.deepEqual(supplierIdsOverQuota(list, trial(11, 2)), ['m2', 'p11'])
	})

	it('sent search suppliers occupy search slots: a new search supplier past 10 is trimmed', () => {
		const list = [...sentSearch(10), rs('p-new', 'pending')]
		assert.deepEqual(supplierIdsOverQuota(list, trial(1, 0)), ['p-new'])
	})

	it('without a manual supplier the trial total is 10: the manual bonus does not leak to search', () => {
		const list = Array.from({ length: 11 }, (_, i) => rs(`p${i + 1}`, 'pending'))
		assert.deepEqual(supplierIdsOverQuota(list, trial(11, 0)), ['p11'])
	})
})

describe('isPendingRequestSupplier', () => {
	it('only pending rows can be toggled or removed', () => {
		assert.equal(isPendingRequestSupplier({ sent_status: 'pending' } as never), true)
		for (const status of ['sent', 'failed', 'replied']) {
			assert.equal(isPendingRequestSupplier({ sent_status: status } as never), false)
		}
	})
})
