
const MIME_BY_EXT: Record<string, string> = {
	pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xls: 'application/vnd.ms-excel',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function mimeFromFilename(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase()
	return (ext && MIME_BY_EXT[ext]) || 'application/octet-stream'
}

function saveBlobAsFile(blob: Blob, filename: string) {
	const mime = mimeFromFilename(filename)
	const typedBlob = blob.type && blob.type !== 'application/octet-stream'
		? blob
		: new Blob([blob], { type: mime })
	const objectUrl = URL.createObjectURL(typedBlob)

	if (mime === 'application/pdf') {
		window.open(objectUrl, '_blank', 'noopener,noreferrer')
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
		return
	}

	const anchor = document.createElement('a')
	anchor.href = objectUrl
	anchor.download = filename
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	URL.revokeObjectURL(objectUrl)
}

export function useTzAnalysisFiles(
	analysisId: Ref<string | null | undefined>,
	tzFilename?: Ref<string | null | undefined>,
) {
	const { $axios } = useNuxtApp()
	const toast = useToast()

	async function openAnalysisFile(kind: 'tz' | 'kp', filename: string) {
		if (!analysisId.value) return
		const safeName = filename.trim()
		if (!safeName) return

		const url = kind === 'tz'
			? `/tz-analysis/${analysisId.value}/files/tz`
			: `/tz-analysis/${analysisId.value}/files/kp?filename=${encodeURIComponent(safeName)}`

		try {
			const res = await $axios.get(url, { responseType: 'blob' })
			saveBlobAsFile(res.data as Blob, safeName)
		} catch {
			toast.add({
				title: kind === 'tz' ? 'Файл ТЗ недоступен' : 'Файл КП недоступен',
				color: 'error',
			})
		}
	}

	function openTzFile() {
		const name = tzFilename?.value?.trim()
		if (!name) {
			toast.add({ title: 'Файл ТЗ недоступен', color: 'error' })
			return Promise.resolve()
		}
		return openAnalysisFile('tz', name)
	}

	function openKpFile(displayName: string, supplierId?: string) {
		if (supplierId) {
			return openSupplierKpFile(supplierId, displayName)
		}
		return openAnalysisFile('kp', displayName)
	}

	async function openSupplierKpFile(supplierId: string, filename: string) {
		if (!analysisId.value) return
		const safeName = filename.trim()
		if (!safeName) return
		const url = `/tz-analysis/${analysisId.value}/suppliers/${supplierId}/files/kp?filename=${encodeURIComponent(safeName)}`
		try {
			const res = await $axios.get(url, { responseType: 'blob' })
			saveBlobAsFile(res.data as Blob, safeName)
		} catch {
			toast.add({
				title: 'Файл КП недоступен',
				color: 'error',
			})
		}
	}

	return { openTzFile, openKpFile, openSupplierKpFile }
}
