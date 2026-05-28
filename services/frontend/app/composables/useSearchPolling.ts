import type { Ref } from 'vue';
import type { RequestResponse } from '#shared/types';
import { RequestStatus } from '#shared/types';
import { useIntervalFn } from '@vueuse/core';

const SEARCH_POLL_INTERVAL_MS = 5_000;
const SEARCH_EXPECTED_DURATION_MS = 2 * 60 * 1000;

export function useSearchPolling(
	requestId: string,
	request: Ref<RequestResponse | null>,
	onSearchComplete: () => void | Promise<void>,
) {
	const { get } = useApi();
	const toast = useToast();

	const searchProgress = ref(0);
	const searchStartedAt = ref<number | null>(null);

	const isSearching = computed(
		() => request.value?.status === RequestStatus.SEARCHING,
	);

	const searchRemainingLabel = computed(() => {
		if (!searchStartedAt.value) return '';
		if (searchProgress.value >= 99) return 'Завершение...';
		const remainingMinutes = Math.ceil(
			((100 - searchProgress.value) / 100) *
				(SEARCH_EXPECTED_DURATION_MS / 60_000),
		);
		return remainingMinutes > 0
			? `Осталось ~${remainingMinutes} мин`
			: 'Завершение...';
	});

	function updateSearchProgress() {
		if (!searchStartedAt.value) return;
		const elapsed = Date.now() - searchStartedAt.value;
		searchProgress.value = Math.min(
			99,
			Math.round((elapsed / SEARCH_EXPECTED_DURATION_MS) * 100),
		);
	}

	async function pollSearchStatus() {
		if (!request.value) return;
		if (request.value.status !== RequestStatus.SEARCHING) return;

		try {
			const updated = await get<RequestResponse>(`/requests/${requestId}`);
			request.value = updated;

			if (updated.status !== RequestStatus.SEARCHING) {
				stopSearchTimers();
				await onSearchComplete();

				if (updated.status === RequestStatus.ACTIVE) {
					toast.add({
						title: 'Поиск завершён',
						description: 'Поставщики добавлены в запрос.',
						color: 'success',
						icon: 'i-lucide-check',
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

	function stopSearchTimers() {
		pauseSearchProgress();
		pauseSearchPolling();
	}

	function resetSearchTracking() {
		stopSearchTimers();
		searchProgress.value = 0;
		searchStartedAt.value = null;
	}

	function startSearchTracking() {
		if (searchStartedAt.value == null) {
			searchStartedAt.value = Date.now();
		}
		updateSearchProgress();
		resumeSearchProgress();
		resumeSearchPolling();
		void pollSearchStatus();
	}

	const { pause: pauseSearchProgress, resume: resumeSearchProgress } =
		useIntervalFn(updateSearchProgress, 1_000, { immediate: false });

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
		searchProgress,
		isSearching,
		searchRemainingLabel,
		resetSearchTracking,
	};
}
