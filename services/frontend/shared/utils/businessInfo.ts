import type { UserResponse } from '#shared/types'

/** Resolve business card text from profile or fallback fields. */
export function resolveBusinessInfo(user: UserResponse | null | undefined): string {
	if (!user) return ''
	const custom = user.business_info?.trim()
	if (custom) return custom

	const name = user.full_name || user.company_name || 'специалист отдела закупок'
	const contact = user.contact_email
		? `\n(Email для связи: ${user.contact_email})`
		: ''
	return `С Уважением,\nспециалист отдела закупок\n${name}${contact}`
}

/** Append business card to message body if not already present. */
export function appendBusinessInfoToBody(
	body: string,
	businessInfo: string,
): string {
	const trimmed = businessInfo.trim()
	if (!trimmed) return body
	const current = body.trimEnd()
	if (!current) return trimmed
	if (current.includes(trimmed)) return body
	return `${current}\n\n${trimmed}`
}
