export function parseOfferNumber(value: string | null | undefined): number | null {
	if (!value?.trim()) return null
	const normalized = value
		.replace(/\u00a0/g, ' ')
		.replace(/(\d)[\s\u202f](?=\d{3}\b)/g, '$1')
		.replace(',', '.')
	const match = normalized.match(/-?\d+(?:\.\d+)?/)
	if (!match) return null
	const num = Number.parseFloat(match[0])
	return Number.isFinite(num) ? num : null
}

export type OfferValueTrend = 'up' | 'down' | null

export function getOfferValueTrend(
	current: string | null | undefined,
	previous: string | null | undefined,
): OfferValueTrend {
	const cur = parseOfferNumber(current)
	const prev = parseOfferNumber(previous)
	if (cur === null || prev === null || cur === prev) return null
	return cur > prev ? 'up' : 'down'
}
