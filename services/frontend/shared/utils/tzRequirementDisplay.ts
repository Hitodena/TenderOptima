import {
	extractRequirementKey,
	findRequirementLabelByKey,
	resolveLetterTzFields,
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
): string {
	if (!key) return 'Не найдено'
	const keyPart = `пункт ${key}`
	if (page != null) return `${prefix}, стр ${page}, ${keyPart}`
	return `${prefix}, ${keyPart}`
}

/** Normalize stored TZ/KP refs to short clickable format. */
export function formatShortTzRef(
	ref: string | null,
	fallbackKey?: string | null,
): string | null {
	if (!ref?.trim()) {
		if (!fallbackKey) return null
		return formatShortSourceRef(TZ_SHORT_PREFIX, fallbackKey, null)
	}
	const trimmed = ref.trim()
	if (trimmed.startsWith(TZ_SHORT_PREFIX)) return trimmed
	const page = parsePageFromRef(trimmed)
	const key = parseKeyFromRef(trimmed) ?? fallbackKey ?? null
	return formatShortSourceRef(TZ_SHORT_PREFIX, key, page)
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
	return new RegExp(`^${normalizedKey.replace(/\./g, '\\.')}\\.\\s`).test(trimmed)
}

export function formatNumberedRefValue(
	key: string | null,
	refValue: string | null | undefined,
): string | null {
	if (!refValue?.trim()) return null
	const trimmed = refValue.trim()
	if (key && refValueStartsWithKey(key, trimmed)) return trimmed
	if (key) return `${key.replace('/', '.')}. ${trimmed}`
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
	const formatted = formatNumberedRefValue(ref, refValue)
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
	return formatShortTzRef(item.requirement_ref, key)
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
			analysisText: ensureNumberedAnalysisLabel(
				extractRequirementKey(item),
				findRequirementLabelByKey(requirementsTz, extractRequirementKey(item))
					?? item.requirement,
			),
		}
	}

	const tzOriginal = extractOriginalTzQuote(item.requirement_ref)
		?? formatNumberedRefValue(
			extractRequirementKey(item),
			item.ref_value,
		)
	const key = extractRequirementKey(item)
	const fromHierarchy = findRequirementLabelByKey(requirementsTz, key)
	const analysisText = ensureNumberedAnalysisLabel(
		key,
		fromHierarchy ?? item.requirement,
	)
	return { tzOriginal, analysisText }
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
