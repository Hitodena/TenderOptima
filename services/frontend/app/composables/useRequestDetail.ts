import type { RequestResponse, RequestSupplierResponse } from '#shared/types';
import { isManualSupplierSource } from '#shared/utils/subscriptionAccess';

function sortSuppliersManualFirst(
	items: RequestSupplierResponse[],
): RequestSupplierResponse[] {
	return [...items].sort((a, b) => {
		const aManual = isManualSupplierSource(a.supplier?.from_source) ? 0 : 1;
		const bManual = isManualSupplierSource(b.supplier?.from_source) ? 0 : 1;
		return aManual - bManual;
	});
}

export function useRequestDetail(requestId: string) {
	const { get, patch, del } = useApi();

	const request = ref<RequestResponse | null>(null);
	const suppliers = ref<RequestSupplierResponse[]>([]);
	const loading = ref(true);
	const loadingSuppliers = ref(false);
	const updatingToggle = ref(false);
	const suppressToggleEvents = ref(false);
	const actionError = ref('');

	async function fetchRequest() {
		loading.value = true;
		try {
			request.value = await get<RequestResponse>(`/requests/${requestId}`);
		} catch {
			request.value = null;
		} finally {
			loading.value = false;
		}
	}

	async function fetchSuppliers(silent = false) {
		if (!silent) loadingSuppliers.value = true;
		try {
			suppliers.value = sortSuppliersManualFirst(
				await get<RequestSupplierResponse[]>(
					`/requests/${requestId}/suppliers`,
				),
			);
		} catch {
			suppliers.value = [];
		} finally {
			if (!silent) loadingSuppliers.value = false;
		}
	}

	async function updateSuppliersEnabled(ids: string[], enabled: boolean) {
		if (ids.length === 0) return;

		const targets = suppliers.value.filter((s) => ids.includes(s.id));
		if (targets.length === 0) return;

		const snapshot = new Map(targets.map((s) => [s.id, s.is_enabled]));

		updatingToggle.value = true;
		actionError.value = '';
		suppressToggleEvents.value = true;

		for (const s of targets) {
			s.is_enabled = enabled;
		}

		try {
			await patch(`/requests/${requestId}/suppliers/enabled`, {
				ids,
				is_enabled: enabled,
			});
		} catch (e: unknown) {
			for (const s of targets) {
				s.is_enabled = snapshot.get(s.id)!;
			}
			const detail = (e as { response?: { data?: { detail?: string } } })
				?.response?.data?.detail;
			actionError.value =
				typeof detail === 'string'
					? detail
					: 'Не удалось изменить выбор поставщиков';
		} finally {
			updatingToggle.value = false;
			await nextTick();
			suppressToggleEvents.value = false;
		}
	}

	async function removeSupplier(rsId: string) {
		actionError.value = '';
		try {
			await del(`/requests/${requestId}/suppliers/${rsId}`);
			suppliers.value = suppliers.value.filter((s) => s.id !== rsId);
		} catch (e: unknown) {
			const detail = (e as { response?: { data?: { detail?: string } } })
				?.response?.data?.detail;
			actionError.value =
				typeof detail === 'string'
					? detail
					: 'Не удалось удалить поставщика';
			throw e;
		}
	}

	return {
		request,
		suppliers,
		loading,
		loadingSuppliers,
		updatingToggle,
		suppressToggleEvents,
		actionError,
		fetchRequest,
		fetchSuppliers,
		updateSuppliersEnabled,
		removeSupplier,
	};
}
