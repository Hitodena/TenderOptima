import {
	extractRequirementKey,
	findRequirementLabelByKey,
	formatNumberedText,
	hierarchyHasNumbering,
	leafKeyFromRequirement,
	requirementNumberForKey,
	resolveLetterTzFields,
	stripLeadingKey,
	type RequirementsHierarchy,
} from '#shared/utils/requirementsStruct'

const QUOTE_RE = /«([^»]+)»/
const PAGE_RE = /стр\.?\s*(\d+)/i
const KEY_RE = /(?:п\.|пункт)\s*([\d./]+)/i
const TZ_SHORT_PREFIX = 'Источник ТЗ'
const KP_SHORT_PREFIX = 'Источник КП'

/** Verbatim quote from the source TZ document (requirement_ref). */
export function extractOriginalTzQuote(ref: string | null): string | null {
	if (!ref) return null
	const match = ref.match(QUOTE_RE)
	return match?.[1]?.trim() || null
}

function parsePageFromRef(ref: string | null): number | null {
	if (!ref) return null
	const match = ref.match(PAGE_RE)
	return match ? Number(match[1]) : null
}

function parseKeyFromRef(ref: string | null): string | null {
	if (!ref) return null
	const match = ref.match(KEY_RE)
	return match?.[1]?.replace('/', '.') ?? null
}

function formatShortSourceRef(
	prefix: string,
	key: string | null,
	page: number | null,
	options?: { unnumbered?: boolean },
): string {
	if (options?.unnumbered) {
		return page != null ? `${prefix}, стр ${page}` : prefix
	}
	if (!key) return 'Не найдено'
	const keyPart = `пункт ${key}`
	if (page != null) return `${prefix}, стр ${page}, ${keyPart}`
	return `${prefix}, ${keyPart}`
}

/**
 * Short TZ reference for a requirement key. For a TZ read from Word the key is
 * only an internal position, so the number the document gives the point is
 * quoted instead, and a point the document does not number is quoted by page.
 */
function formatTzSourceRef(
	key: string | null,
	page: number | null,
	hierarchy?: RequirementsHierarchy | null,
): string {
	if (!key || !hierarchyHasNumbering(hierarchy)) {
		return formatShortSourceRef(TZ_SHORT_PREFIX, key, page)
	}
	const number = requirementNumberForKey(hierarchy, key)
	return number
		? formatShortSourceRef(TZ_SHORT_PREFIX, number, page)
		: formatShortSourceRef(TZ_SHORT_PREFIX, null, page, { unnumbered: true })
}

/** Normalize stored TZ/KP refs to short clickable format. */
export function formatShortTzRef(
	ref: string | null,
	fallbackKey?: string | null,
	hierarchy?: RequirementsHierarchy | null,
): string | null {
	if (!ref?.trim()) {
		if (!fallbackKey) return null
		return formatTzSourceRef(fallbackKey, null, hierarchy)
	}
	const trimmed = ref.trim()
	if (trimmed.startsWith(TZ_SHORT_PREFIX) && !hierarchyHasNumbering(hierarchy)) {
		return trimmed
	}
	const page = parsePageFromRef(trimmed)
	const key = parseKeyFromRef(trimmed) ?? fallbackKey ?? null
	return formatTzSourceRef(key, page, hierarchy)
}

export function formatShortKpRef(
	ref: string | null,
	fallbackKey?: string | null,
): string | null {
	if (!ref?.trim()) {
		if (!fallbackKey) return null
		return formatShortSourceRef(KP_SHORT_PREFIX, fallbackKey, null)
	}
	const trimmed = ref.trim()
	if (trimmed.startsWith(KP_SHORT_PREFIX)) return trimmed
	const page = parsePageFromRef(trimmed)
	const key = parseKeyFromRef(trimmed) ?? fallbackKey ?? null
	return formatShortSourceRef(KP_SHORT_PREFIX, key, page)
}

export function refValueStartsWithKey(
	key: string | null,
	refValue: string | null | undefined,
): boolean {
	if (!key || !refValue?.trim()) return false
	const normalizedKey = key.replace('/', '.')
	const trimmed = refValue.trim()
	if (trimmed.startsWith(`${normalizedKey}. `)) return true
	// a number from a Word file may hold brackets and letters («4 а)», «8 (1)»)
	const escaped = normalizedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return new RegExp(`^${escaped}\\.\\s`).test(trimmed)
}

export function formatNumberedRefValue(
	key: string | null,
	refValue: string | null | undefined,
	hierarchy?: RequirementsHierarchy | null,
): string | null {
	if (!refValue?.trim()) return null
	const trimmed = refValue.trim()
	// For a TZ read from Word the key is an internal position: the line starts
	// with the number the document gives the point (none if it has none).
	const number = hierarchyHasNumbering(hierarchy)
		? requirementNumberForKey(hierarchy, key)
		: key
	if (number && refValueStartsWithKey(number, trimmed)) return trimmed
	if (number) return `${number.replace('/', '.')}. ${trimmed}`
	return trimmed
}

export function formatLetterRequirementLine(
	item: {
		requirement: string
		ref?: string | null
		ref_value?: string | null
	},
	requirementsTz?: RequirementsHierarchy | null,
): string {
	const { ref, refValue } = resolveLetterTzFields(item, requirementsTz)
	const formatted = formatNumberedRefValue(ref, refValue, requirementsTz)
	if (formatted) return formatted
	return item.requirement
}

export function formatLetterRequirementRef(
	item: {
		requirement: string
		requirement_ref: string | null
		ref?: string | null
		ref_value?: string | null
	},
	requirementsTz?: RequirementsHierarchy | null,
): string | null {
	return formatTzSourceRefLink(item, requirementsTz)
}

/** TZ source link in short format: «Источник ТЗ, стр X, пункт Y». */
export function formatTzSourceRefLink(
	item: {
		requirement: string
		requirement_ref: string | null
		ref?: string | null
		ref_value?: string | null
	},
	requirementsTz?: RequirementsHierarchy | null,
): string | null {
	const { ref } = resolveLetterTzFields(item, requirementsTz)
	const key = ref ?? extractRequirementKey(item) ?? parseKeyFromRef(item.requirement_ref)
	return formatShortTzRef(item.requirement_ref, key, requirementsTz)
}

export function formatKpSourceRefLink(
	item: {
		offer_ref?: string | null
		offer?: string | null
	},
	fallbackKey?: string | null,
): string | null {
	return formatShortKpRef(item.offer_ref ?? null, fallbackKey)
}

export function getTzRequirementDisplay(
	item: {
		requirement: string
		requirement_ref: string | null
		ref?: string | null
		ref_value?: string | null
	},
	requirementsTz?: RequirementsHierarchy | null,
): { tzOriginal: string | null; analysisText: string } {
	const { ref, refValue } = resolveLetterTzFields(item, requirementsTz)
	if (ref && refValue) {
		return {
			tzOriginal: refValue,
			analysisText: buildAnalysisLine(item, requirementsTz),
		}
	}

	const tzOriginal = extractOriginalTzQuote(item.requirement_ref)
		?? formatNumberedRefValue(
			extractRequirementKey(item),
			item.ref_value,
			requirementsTz,
		)
	return { tzOriginal, analysisText: buildAnalysisLine(item, requirementsTz) }
}

/** Line with the requirement being analysed, starting with its number. */
function buildAnalysisLine(
	item: {
		requirement: string
		requirement_ref: string | null
		ref?: string | null
	},
	requirementsTz?: RequirementsHierarchy | null,
): string {
	if (!hierarchyHasNumbering(requirementsTz)) {
		const key = extractRequirementKey(item)
		return ensureNumberedAnalysisLabel(
			key,
			findRequirementLabelByKey(requirementsTz, key) ?? item.requirement,
		)
	}
	// A TZ read from Word: the item is about the leaf its line starts with, and
	// the line carries the number the document gives that leaf, not the
	// internal position the key stands for.
	const leafKey = leafKeyFromRequirement(item.requirement) ?? extractRequirementKey(item)
	const fromHierarchy = findRequirementLabelByKey(requirementsTz, leafKey)
	if (fromHierarchy) return fromHierarchy
	return formatNumberedText(
		requirementNumberForKey(requirementsTz, leafKey),
		stripLeadingKey(item.requirement),
	)
}

/** Ensure analysis line starts with «N.» or «N.M.» from hierarchy key. */
function ensureNumberedAnalysisLabel(
	key: string | null,
	text: string,
): string {
	const trimmed = text.trim()
	if (!trimmed) return ''
	if (!key) return trimmed
	const numberedPrefix = `${key}. `
	if (trimmed.startsWith(numberedPrefix)) return trimmed
	if (new RegExp(`^${key.replace(/\./g, '\\.')}\\.\\s`).test(trimmed)) {
		return trimmed
	}
	const body = trimmed.replace(/^[\d./]+\.\s*/, '')
	return body ? `${key}. ${body}` : `${key}.`
}

export function shouldShowAnalysisLine(
	tzOriginal: string | null,
	analysisText: string,
): boolean {
	if (!analysisText) return false
	if (!tzOriginal) return true
	return analysisText.trim() !== tzOriginal.trim()
}
