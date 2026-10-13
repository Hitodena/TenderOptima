export function titleCaseWords(value: string | null | undefined): string {
	if (!value) return ''
	return value
		.trim()
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ')
}

/** Russian plural forms: one (1, 21…), few (2–4, 22–24…), many (0, 5–20, 11–14…). */
export function pluralizeRu(
	count: number,
	one: string,
	few: string,
	many: string,
): string {
	const n = Math.abs(count) % 100
	const n2 = n % 10
	if (n >= 11 && n <= 19) return many
	if (n2 === 1) return one
	if (n2 >= 2 && n2 <= 4) return few
	return many
}

export function pluralizeSuppliers(count: number): string {
	return pluralizeRu(count, 'поставщик', 'поставщика', 'поставщиков')
}

/** «от 1 поставщика», «от 2 поставщиков», «от 21 поставщика». */
export function pluralizeSuppliersGenitive(count: number): string {
	return pluralizeRu(count, 'поставщика', 'поставщиков', 'поставщиков')
}

/** «отправлен 1 поставщику», «отправлен 5 поставщикам». */
export function pluralizeSuppliersDative(count: number): string {
	return pluralizeRu(count, 'поставщику', 'поставщикам', 'поставщикам')
}

export function pluralizeLetters(count: number): string {
	return pluralizeRu(count, 'письмо', 'письма', 'писем')
}
