/** Build an external https URL from a domain that may already include a scheme. */
export function toExternalUrl(domain: string): string {
	const trimmed = domain.trim()
	if (/^https?:\/\//i.test(trimmed)) return trimmed
	return `https://${trimmed}`
}

/** Display domain without scheme or leading www. */
export function formatDomainLabel(domain: string): string {
	return domain
		.trim()
		.replace(/^https?:\/\//i, '')
		.replace(/^www\./i, '')
		.replace(/\/$/, '')
}
