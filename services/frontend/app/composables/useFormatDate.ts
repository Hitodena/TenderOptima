export function useFormatDate() {
	function formatDate(iso: string) {
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
	}

	function formatDateTime(iso: string) {
		return new Date(iso).toLocaleDateString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	function formatDateShort(iso: string) {
		const d = new Date(iso);
		const now = new Date();
		if (d.toDateString() === now.toDateString()) {
			return d.toLocaleTimeString('ru-RU', {
				hour: '2-digit',
				minute: '2-digit',
			});
		}
		return d.toLocaleDateString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
		});
	}

	return { formatDate, formatDateTime, formatDateShort };
}
