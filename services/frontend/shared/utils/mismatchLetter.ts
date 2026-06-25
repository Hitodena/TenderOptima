import type { ComparisonSupplier, RequirementMatch } from '#shared/types'

export const LETTER_MISMATCH_HEADER = 'Не соответствует:'
export const LETTER_NOT_FOUND_HEADER = 'Не найдено:'
export const LETTER_PARTIAL_HEADER = 'Требуют уточнения/дополнения:'

export function mismatchReason(match: RequirementMatch): string {
	if (match.explanation?.trim()) return match.explanation.trim()
	if (match.status === 'missing') {
		return 'Предложение не соответствует требованию.'
	}
	if (match.status === 'not_found') {
		return 'В ответе не указана информация по требованию.'
	}
	return 'Требуется уточнение.'
}

export function isNonMatchingStatus(status: string | null | undefined): boolean {
	return status === 'missing' || status === 'partial' || status === 'not_found'
}

export function filterNonMatching(requirements: RequirementMatch[]): RequirementMatch[] {
	return requirements.filter((item) => isNonMatchingStatus(item.status))
}

export function supplierHasMismatches(
	supplier: ComparisonSupplier,
	requirements: string[],
): boolean {
	return requirements.some((req) => isNonMatchingStatus(supplier.statuses[req]))
}

export function buildEmailMismatchLetterBody(
	companyName: string,
	matches: RequirementMatch[],
	deadline = '7 дней',
): string {
	const mismatch = matches.filter((item) => item.status === 'missing')
	const notFound = matches.filter((item) => item.status === 'not_found')
	const partial = matches.filter((item) => item.status === 'partial')

	const lines: string[] = [
		`Уважаемый ${companyName}!`,
		'',
		'Проведён анализ вашего предложения по соответствию техническим требованиям.',
		'Выявлены следующие замечания и требуемые уточнения:',
	]

	let itemNum = 1

	if (mismatch.length) {
		lines.push('', LETTER_MISMATCH_HEADER)
		for (const item of mismatch) {
			lines.push(`${itemNum}. Требование: «${item.requirement}»`)
			if (item.offer_value) {
				lines.push(`   Предложено: «${item.offer_value}»`)
			}
			lines.push(`   ${mismatchReason(item)}`)
			itemNum += 1
		}
	}

	if (notFound.length) {
		lines.push('', LETTER_NOT_FOUND_HEADER)
		for (const item of notFound) {
			lines.push(`${itemNum}. Требование: «${item.requirement}»`)
			lines.push(`   ${mismatchReason(item)}`)
			itemNum += 1
		}
	}

	if (partial.length) {
		lines.push('', LETTER_PARTIAL_HEADER)
		for (const item of partial) {
			lines.push(`${itemNum}. Требование: «${item.requirement}»`)
			if (item.offer_value) {
				lines.push(`   Предложено: «${item.offer_value}»`)
			}
			lines.push(`   ${mismatchReason(item)}`)
			itemNum += 1
		}
	}

	lines.push(
		'',
		`Просим предоставить дополненное/уточненное предложение не позже ${deadline}.`,
	)
	return lines.join('\n')
}

export function buildComparisonSupplierLetterBody(
	supplier: ComparisonSupplier,
	requirements: string[],
	deadline = '7 дней',
): string {
	const matches: RequirementMatch[] = requirements
		.filter((req) => isNonMatchingStatus(supplier.statuses[req]))
		.map((req) => ({
			requirement: req,
			offer_value: supplier.values[req] ?? null,
			explanation: null,
			status: (supplier.statuses[req] ?? 'not_found') as RequirementMatch['status'],
		}))
	return buildEmailMismatchLetterBody(
		supplier.company_name,
		matches,
		deadline,
	)
}
