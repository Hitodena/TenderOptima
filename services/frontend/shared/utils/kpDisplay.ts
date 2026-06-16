export const SCOPED_KP_SEP = ': '

export function scopedKpDisplayName(supplierName: string, filename: string): string {
	return `${supplierName}${SCOPED_KP_SEP}${filename}`
}

export function supplierKpScopedPrefix(supplierName: string): string {
	return scopedKpDisplayName(supplierName, '')
}

export function isKpScopedToSupplier(
	kpKey: string,
	supplierName: string,
): boolean {
	return kpKey.startsWith(supplierKpScopedPrefix(supplierName))
}

export function parseScopedKpName(
	displayName: string,
): { supplierName: string, filename: string } | null {
	const idx = displayName.indexOf(SCOPED_KP_SEP)
	if (idx < 0) return null
	return {
		supplierName: displayName.slice(0, idx),
		filename: displayName.slice(idx + SCOPED_KP_SEP.length),
	}
}

export function kpDisplayLabel(displayName: string): string {
	const parsed = parseScopedKpName(displayName)
	return parsed?.filename ?? displayName
}
