import {
	extractRequirementKey,
	findRequirementLabelByKey,
	type RequirementsHierarchy,
} from '#shared/utils/requirementsStruct'

const QUOTE_RE = /«([^»]+)»/

/** Verbatim quote from the source TZ document (requirement_ref). */
export function extractOriginalTzQuote(ref: string | null): string | null {
	if (!ref) return null
	const match = ref.match(QUOTE_RE)
	return match?.[1]?.trim() || null
}

export function getTzRequirementDisplay(
	item: {
		requirement: string
		requirement_ref: string | null
	},
	requirementsTz?: RequirementsHierarchy | null,
): { tzOriginal: string | null; analysisText: string } {
	const tzOriginal = extractOriginalTzQuote(item.requirement_ref)
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
