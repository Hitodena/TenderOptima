<template>
	<div class="space-y-8">
		<section class="space-y-4">
			<div>
				<p class="font-semibold text-highlighted">
					Реестр целей обработки ПДн
				</p>
				<p class="text-sm text-muted mt-0.5">
					Очистка запускается вручную по пунктам 1, 2, 4, 5, 7. Якорь срока —
					<code class="text-xs">users.deleted_at</code>.
				</p>
			</div>

			<div class="overflow-x-auto rounded-lg border border-default">
				<table class="min-w-[1100px] w-full text-left text-sm">
					<thead class="bg-elevated/50 border-b border-default">
						<tr>
							<th class="px-3 py-2 font-semibold whitespace-nowrap w-12">№</th>
							<th class="px-3 py-2 font-semibold min-w-[14rem]">Цель обработки</th>
							<th class="px-3 py-2 font-semibold min-w-[10rem]">Срок после удаления</th>
							<th class="px-3 py-2 font-semibold whitespace-nowrap">Дней</th>
							<th class="px-3 py-2 font-semibold whitespace-nowrap">Очистка</th>
							<th class="px-3 py-2 font-semibold w-40" />
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in purposes"
							:key="row.number"
							class="border-b border-default align-top last:border-b-0"
						>
							<td class="px-3 py-3 tabular-nums text-muted">{{ row.number }}</td>
							<td class="px-3 py-3">
								<p class="text-highlighted">{{ row.purpose }}</p>
								<p class="text-xs text-muted mt-1">{{ row.dataList }}</p>
							</td>
							<td class="px-3 py-3 text-muted">{{ row.retention }}</td>
							<td class="px-3 py-3 tabular-nums text-muted">
								{{ row.retentionDays ?? '—' }}
							</td>
							<td class="px-3 py-3">
								<UBadge
									:color="row.cleanupSupported ? 'success' : 'neutral'"
									variant="soft"
								>
									{{ row.cleanupSupported ? 'Есть задача' : 'Нет' }}
								</UBadge>
							</td>
							<td class="px-3 py-3">
								<UButton
									v-if="row.cleanupSupported"
									size="xs"
									color="primary"
									variant="soft"
									leading-icon="i-lucide-play"
									:loading="runningPurpose === row.number"
									:disabled="!!runningPurpose"
									@click="runCleanup(row.number)"
								>
									Запустить
								</UButton>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<section class="space-y-4">
			<div class="flex items-center justify-between flex-wrap gap-3">
				<div>
					<p class="font-semibold text-highlighted">
						Удалённые пользователи
					</p>
					<p class="text-sm text-muted mt-0.5">
						Сколько дней прошло с удаления и сколько осталось до очистки по пунктам.
					</p>
				</div>
				<UButton
					size="sm"
					color="neutral"
					variant="soft"
					leading-icon="i-lucide-refresh-cw"
					:loading="loadingUsers"
					@click="fetchDeletedUsers"
				>
					Обновить
				</UButton>
			</div>

			<UAlert
				v-if="usersError"
				color="error"
				variant="soft"
				icon="i-lucide-circle-alert"
				:description="usersError"
			/>

			<div class="overflow-x-auto rounded-lg border border-default">
				<UTable
					:data="deletedUsers"
					:columns="userColumns"
					:loading="loadingUsers"
					class="min-w-[980px]"
					:ui="{ td: 'align-top py-3', th: 'whitespace-nowrap' }"
				>
					<template #empty>
						<div class="flex flex-col items-center justify-center gap-3 py-12">
							<UIcon name="i-lucide-user-x" class="size-10 text-muted opacity-40" />
							<p class="text-muted">Нет удалённых аккаунтов</p>
						</div>
					</template>

					<template #deleted_at-cell="{ row }">
						<span class="text-xs text-muted whitespace-nowrap">
							{{ formatDate(row.original.deleted_at) }}
						</span>
					</template>

					<template #user-cell="{ row }">
						<div class="min-w-0 max-w-56">
							<p class="text-sm font-medium truncate">
								{{ row.original.full_name || '—' }}
							</p>
							<p class="text-xs text-muted truncate">{{ row.original.email }}</p>
						</div>
					</template>

					<template #days_since_deleted-cell="{ row }">
						<span class="tabular-nums text-sm">
							{{ row.original.days_since_deleted }}
						</span>
					</template>

					<template #nearest_cleanup_days-cell="{ row }">
						<UBadge
							:color="row.original.nearest_cleanup_days === 0 ? 'warning' : 'neutral'"
							variant="soft"
						>
							{{
								row.original.nearest_cleanup_days == null
									? '—'
									: row.original.nearest_cleanup_days === 0
										? 'Готово'
										: `${row.original.nearest_cleanup_days} дн.`
							}}
						</UBadge>
					</template>

					<template #purposes-cell="{ row }">
						<div class="flex flex-wrap gap-1.5 max-w-md">
							<UBadge
								v-for="purpose in row.original.purposes"
								:key="`${row.original.id}-${purpose.purpose_number}`"
								:color="purpose.ready ? 'warning' : 'neutral'"
								variant="soft"
								size="xs"
							>
								п.{{ purpose.purpose_number }}:
								{{ purpose.ready ? 'ready' : `${purpose.days_until_cleanup}д` }}
							</UBadge>
						</div>
					</template>
				</UTable>
			</div>
		</section>

		<section class="space-y-4">
			<div class="flex items-center justify-between flex-wrap gap-3">
				<div>
					<p class="font-semibold text-highlighted">
						История запусков очистки
					</p>
					<p class="text-sm text-muted mt-0.5">
						Ручные Celery-задачи без beat.
					</p>
				</div>
				<UButton
					size="sm"
					color="neutral"
					variant="soft"
					leading-icon="i-lucide-refresh-cw"
					:loading="loadingRuns"
					@click="fetchRuns"
				>
					Обновить
				</UButton>
			</div>

			<div class="overflow-x-auto rounded-lg border border-default">
				<UTable
					:data="runs"
					:columns="runColumns"
					:loading="loadingRuns"
					class="min-w-[860px]"
				>
					<template #empty>
						<div class="flex flex-col items-center justify-center gap-3 py-12">
							<UIcon name="i-lucide-history" class="size-10 text-muted opacity-40" />
							<p class="text-muted">Запусков пока нет</p>
						</div>
					</template>

					<template #created_at-cell="{ row }">
						<span class="text-xs text-muted whitespace-nowrap">
							{{ formatDate(row.original.created_at) }}
						</span>
					</template>

					<template #status-cell="{ row }">
						<UBadge :color="runStatusColor(row.original.status)" variant="soft">
							{{ row.original.status }}
						</UBadge>
					</template>

					<template #error-cell="{ row }">
						<p class="text-xs text-muted max-w-xs line-clamp-2">
							{{ row.original.error || '—' }}
						</p>
					</template>
				</UTable>
			</div>
		</section>
	</div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import { PERSONAL_DATA_PURPOSES } from '#shared/constants/personalDataPurposes'
import type {
	DeletedUserRetentionItem,
	DeletedUserRetentionPage,
	PersonalDataCleanupEnqueueResponse,
	PersonalDataCleanupRunResponse,
} from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

const purposes = PERSONAL_DATA_PURPOSES
const { get, post } = useApi()
const toast = useToast()
const { formatDate } = useFormatDate()

const deletedUsers = ref<DeletedUserRetentionItem[]>([])
const loadingUsers = ref(false)
const usersError = ref<string | null>(null)

const runs = ref<PersonalDataCleanupRunResponse[]>([])
const loadingRuns = ref(false)
const runningPurpose = ref<number | null>(null)

const userColumns: TableColumn<DeletedUserRetentionItem>[] = [
	{ accessorKey: 'deleted_at', header: 'Удалён' },
	{ id: 'user', header: 'Пользователь' },
	{ accessorKey: 'days_since_deleted', header: 'Дней прошло' },
	{ accessorKey: 'nearest_cleanup_days', header: 'До ближайшей' },
	{ id: 'purposes', header: 'По пунктам' },
]

const runColumns: TableColumn<PersonalDataCleanupRunResponse>[] = [
	{ accessorKey: 'created_at', header: 'Создан' },
	{ accessorKey: 'purpose_number', header: 'Пункт' },
	{ id: 'status', header: 'Статус' },
	{ accessorKey: 'eligible_users', header: 'Users' },
	{ accessorKey: 'affected_records', header: 'Записей' },
	{ id: 'error', header: 'Ошибка' },
]

function runStatusColor(
	status: string,
): 'primary' | 'success' | 'error' | 'warning' | 'neutral' {
	switch (status) {
		case 'queued':
			return 'neutral'
		case 'running':
			return 'primary'
		case 'completed':
			return 'success'
		case 'failed':
			return 'error'
		default:
			return 'warning'
	}
}

async function fetchDeletedUsers() {
	loadingUsers.value = true
	usersError.value = null
	try {
		const data = await get<DeletedUserRetentionPage>(
			'/admin/personal-data/deleted-users',
		)
		deletedUsers.value = data.items
	}
	catch (e: unknown) {
		deletedUsers.value = []
		usersError.value = getApiErrorDetail(e) ?? 'Не удалось загрузить удалённых пользователей'
	}
	finally {
		loadingUsers.value = false
	}
}

async function fetchRuns() {
	loadingRuns.value = true
	try {
		runs.value = await get<PersonalDataCleanupRunResponse[]>(
			'/admin/personal-data/cleanup-runs',
		)
	}
	catch {
		runs.value = []
	}
	finally {
		loadingRuns.value = false
	}
}

async function runCleanup(purposeNumber: number) {
	if (runningPurpose.value) return
	runningPurpose.value = purposeNumber
	try {
		const result = await post<PersonalDataCleanupEnqueueResponse>(
			`/admin/personal-data/cleanup/${purposeNumber}`,
			{},
		)
		toast.add({
			title: result.message,
			color: 'success',
		})
		await fetchRuns()
	}
	catch (e: unknown) {
		toast.add({
			title: getApiErrorDetail(e) ?? 'Не удалось поставить задачу',
			color: 'error',
		})
	}
	finally {
		runningPurpose.value = null
	}
}

onMounted(() => {
	void fetchDeletedUsers()
	void fetchRuns()
})
</script>
