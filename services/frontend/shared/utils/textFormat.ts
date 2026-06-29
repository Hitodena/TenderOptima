export function titleCaseWords(value: string | null | undefined): string {
	if (!value) return ''
	return value
		.trim()
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ')
}
