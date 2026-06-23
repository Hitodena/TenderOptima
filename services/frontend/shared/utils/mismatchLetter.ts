import type { ComparisonSupplier, RequirementMatch } from '#shared/types'

export const LETTER_MISMATCH_HEADER = 'Несоответствующие параметры:'
export const LETTER_PARTIAL_HEADER = 'Требуют уточнения/дополнения:'

export function formatMismatchLetterDate(): string {
	return new Intl.DateTimeFormat('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	}).format(new Date())
}

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
	const partial = matches.filter((item) => item.status === 'partial')
	const notFound = matches.filter((item) => item.status === 'not_found')

	const lines: string[] = [
		`Уважаемый ${companyName}!`,
		'',
		'Проведён анализ вашего предложения по соответствию техническим требованиям.',
		'Выявлены следующие замечания и требуемые уточнения:',
	]

	if (mismatch.length) {
		lines.push('', LETTER_MISMATCH_HEADER)
		for (const [idx, item] of mismatch.entries()) {
			lines.push(`${idx + 1}. Требование: «${item.requirement}»`)
			if (item.offer_value) {
				lines.push(`   Предложено: «${item.offer_value}»`)
			}
			lines.push(`   ${mismatchReason(item)}`)
		}
	}

	if (partial.length) {
		lines.push('', LETTER_PARTIAL_HEADER)
		const start = mismatch.length + 1
		for (const [offset, item] of partial.entries()) {
			lines.push(`${start + offset}. Требование: «${item.requirement}»`)
			if (item.offer_value) {
				lines.push(`   Предложено: «${item.offer_value}»`)
			}
			lines.push(`   ${mismatchReason(item)}`)
		}
	}

	if (notFound.length) {
		if (!mismatch.length && !partial.length) {
			lines.push('', LETTER_MISMATCH_HEADER)
		}
		const start = mismatch.length + partial.length + 1
		for (const [offset, item] of notFound.entries()) {
			lines.push(`${start + offset}. Требование: «${item.requirement}»`)
			lines.push(`   ${mismatchReason(item)}`)
		}
	}

	lines.push(
		'',
		`Просим предоставить дополненное/уточненное предложение не позже ${deadline}.`,
		'',
		'С уважением,',
		'',
		formatMismatchLetterDate(),
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
