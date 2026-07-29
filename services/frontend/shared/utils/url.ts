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

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"')\]]+/gi

export type TextLinkSegment =
	| { type: 'text'; value: string }
	| { type: 'link'; href: string; label: string }

/** Shorten a URL for display: host + truncated path/query. */
export function formatShortUrlLabel(url: string, maxLen = 48): string {
	const trimmed = url.trim()
	try {
		const parsed = new URL(trimmed)
		const host = parsed.hostname.replace(/^www\./i, '')
		const segments = parsed.pathname.split('/').filter(Boolean)
		const last = segments.at(-1) ?? ''
		const queryHash = `${parsed.search}${parsed.hash}`
		let label: string
		if (!segments.length) {
			label = `${host}${queryHash}`
		} else if (segments.length === 1) {
			label = `${host}/${last}${queryHash}`
		} else {
			label = `${host}/…/${last}${queryHash}`
		}
		return label.length > maxLen ? `${label.slice(0, maxLen - 1)}…` : label
	} catch {
		if (trimmed.length <= maxLen) return trimmed
		return `${trimmed.slice(0, maxLen - 1)}…`
	}
}

/** Split plain text into safe text/link segments (no HTML injection). */
export function splitTextWithLinks(text: string): TextLinkSegment[] {
	if (!text) return []
	const segments: TextLinkSegment[] = []
	let lastIndex = 0
	const re = new RegExp(URL_IN_TEXT_RE.source, URL_IN_TEXT_RE.flags)
	for (const match of text.matchAll(re)) {
		const start = match.index ?? 0
		if (start > lastIndex) {
			segments.push({ type: 'text', value: text.slice(lastIndex, start) })
		}
		const href = match[0].replace(/[.,;:!?]+$/u, '')
		const trailing = match[0].slice(href.length)
		segments.push({
			type: 'link',
			href,
			label: formatShortUrlLabel(href),
		})
		if (trailing) {
			segments.push({ type: 'text', value: trailing })
		}
		lastIndex = start + match[0].length
	}
	if (lastIndex < text.length) {
		segments.push({ type: 'text', value: text.slice(lastIndex) })
	}
	return segments.length ? segments : [{ type: 'text', value: text }]
}
