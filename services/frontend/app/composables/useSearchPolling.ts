import type { Ref } from 'vue';
import type { RequestResponse, RequestSupplierResponse } from '#shared/types';
import { RequestStatus } from '#shared/types';
import { useIntervalFn } from '@vueuse/core';

const SEARCH_POLL_INTERVAL_MS = 5_000;

export function useSearchPolling(
	requestId: string,
	request: Ref<RequestResponse | null>,
	suppliers: Ref<RequestSupplierResponse[]>,
	onSearchComplete: () => void | Promise<void>,
) {
	const { get } = useApi();
	const toast = useToast();

	const isSearching = computed(
		() => request.value?.status === RequestStatus.SEARCHING,
	);

	async function pollSearchStatus() {
		if (!request.value) return;
		if (request.value.status !== RequestStatus.SEARCHING) return;

		try {
			const updated = await get<RequestResponse>(`/requests/${requestId}`);
			request.value = updated;

			if (updated.status !== RequestStatus.SEARCHING) {
				stopSearchPolling();
				await onSearchComplete();

				if (updated.status === RequestStatus.ACTIVE) {
					const count = suppliers.value.length
					toast.add({
						title: 'Поиск завершён',
						description: count > 0
							? 'Поставщики добавлены в запрос.'
							: 'Поставщики не найдены. Попробуйте изменить запрос или регион.',
						color: count > 0 ? 'success' : 'warning',
						icon: count > 0 ? 'i-lucide-check' : 'i-lucide-search-x',
					});
				} else if (updated.status === RequestStatus.DRAFT) {
					toast.add({
						title: 'Ошибка поиска',
						description: 'Не удалось найти поставщиков. Попробуйте снова.',
						color: 'error',
						icon: 'i-lucide-circle-alert',
					});
				}
			}
		} catch {
			// retry on next interval
		}
	}

	function stopSearchPolling() {
		pauseSearchPolling();
	}

	function resetSearchTracking() {
		stopSearchPolling();
	}

	function startSearchTracking() {
		resumeSearchPolling();
		void pollSearchStatus();
	}

	const { pause: pauseSearchPolling, resume: resumeSearchPolling } =
		useIntervalFn(pollSearchStatus, SEARCH_POLL_INTERVAL_MS, {
			immediate: false,
		});

	watch(
		isSearching,
		(searching) => {
			if (searching) startSearchTracking();
			else resetSearchTracking();
		},
		{ immediate: true },
	);

	onUnmounted(resetSearchTracking);

	return {
		isSearching,
		resetSearchTracking,
	};
}
