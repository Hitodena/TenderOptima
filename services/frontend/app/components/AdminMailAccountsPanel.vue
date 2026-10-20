<template>
<div class="space-y-5">
<UCard :ui="{ body: 'p-5 space-y-4' }">
<template #header>
<div class="flex flex-wrap items-center justify-between gap-3">
<div>
<h2 class="font-semibold">Почтовые аккаунты</h2>
<p class="text-sm text-muted">Централизованные SMTP/IMAP-аккаунты. Пароли не отображаются.</p>
</div>
<UButton :loading="verifyingAll" variant="soft" icon="i-lucide-shield-check" @click="verifyAll">
Проверить все
</UButton>
</div>
</template>

<UFormField label="Email">
<UInput v-model="form.email" type="email" class="w-full" autocomplete="email" />
</UFormField>
<div class="grid gap-3 sm:grid-cols-2">
<UFormField label="SMTP host"><UInput v-model="form.smtp_host" class="w-full" placeholder="smtp.example.com" /></UFormField>
<UFormField label="SMTP port"><UInput v-model="form.smtp_port" type="number" min="1" max="65535" class="w-full" /></UFormField>
<UFormField label="IMAP host"><UInput v-model="form.imap_host" class="w-full" placeholder="imap.example.com" /></UFormField>
<UFormField label="IMAP port"><UInput v-model="form.imap_port" type="number" min="1" max="65535" class="w-full" /></UFormField>
</div>
<UFormField label="Пароль">
<UInput v-model="form.password" type="password" class="w-full" autocomplete="new-password" />
</UFormField>
<UAlert v-if="formError" color="error" variant="soft" :description="formError" />
<UButton :loading="creating" icon="i-lucide-plus" @click="createAccount">Добавить административную почту</UButton>
</UCard>

	<UAlert v-if="loadError" color="error" variant="soft" :description="loadError" />
	<div class="grid gap-3 sm:grid-cols-2">
		<UFormField label="Источник">
			<USelect v-model="sourceFilter" :items="sourceFilterOptions" class="w-full" />
		</UFormField>
		<UFormField label="Статус">
			<USelect v-model="availabilityFilter" :items="availabilityFilterOptions" class="w-full" />
		</UFormField>
	</div>
	<div class="overflow-x-auto rounded-lg border border-default">
	<UTable :data="filteredAccounts" :columns="columns" :loading="loading" class="min-w-[1000px]">
	<template #source-cell="{ row }"><UBadge :color="row.original.source === 'admin' ? 'primary' : 'neutral'" variant="soft">{{ row.original.source }}</UBadge></template>
	<template #protocols-cell="{ row }"><span>SMTP: {{ statusLabel(row.original.smtp_available) }} · IMAP: {{ statusLabel(row.original.imap_available) }}</span></template>
	<template #availability-cell="{ row }"><UBadge :color="row.original.availability ? 'success' : 'error'" variant="soft">{{ row.original.availability ? 'Доступен' : 'Недоступен' }}</UBadge></template>
	<template #created-cell="{ row }"><span class="text-xs text-muted">{{ formatDateTime(row.original.created_at) }}</span></template>
	<template #assigned-cell="{ row }"><span>{{ row.original.assigned_user_count }}</span></template>
<template #checked-cell="{ row }"><span class="text-xs text-muted">{{ row.original.last_checked_at ? formatDateTime(row.original.last_checked_at) : '—' }}</span><p v-if="row.original.last_error" class="max-w-64 text-xs text-error">{{ row.original.last_error }}</p></template>
<template #actions-cell="{ row }">
	<div class="flex gap-2">
		<UButton size="xs" variant="soft" :loading="verifyingId === row.original.id" @click="verifyOne(row.original.id)">Проверить</UButton>
		<UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :loading="deletingId === row.original.id" @click="deleteAccount(row.original)">Удалить</UButton>
	</div>
</template>
<template #empty><div class="py-10 text-center text-muted">Почтовых аккаунтов пока нет</div></template>
</UTable>
</div>
</div>
</template>

<script lang="ts" setup>
import type { TableColumn } from '@nuxt/ui'
import type { MailAccountCreate, MailAccountResponse } from '#shared/types'
import { getApiErrorDetail } from '#shared/utils/apiError'

const { get, post, del } = useApi()
const { formatDateTime } = useFormatDate()
const accounts = ref<MailAccountResponse[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const creating = ref(false)
const verifyingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const verifyingAll = ref(false)
const formError = ref<string | null>(null)
const form = reactive({ email: '', password: '', smtp_host: '', smtp_port: '465', imap_host: '', imap_port: '993' })
const sourceFilter = ref<'all' | 'admin' | 'custom'>('all')
const availabilityFilter = ref<'all' | 'available' | 'unavailable'>('all')
const sourceFilterOptions = [
	{ label: 'Все источники', value: 'all' },
	{ label: 'Администратор', value: 'admin' },
	{ label: 'Пользователь', value: 'custom' },
]
const availabilityFilterOptions = [
	{ label: 'Все статусы', value: 'all' },
	{ label: 'Доступен', value: 'available' },
	{ label: 'Недоступен', value: 'unavailable' },
]
const filteredAccounts = computed(() => accounts.value.filter((account) => {
	const sourceMatches = sourceFilter.value === 'all' || account.source === sourceFilter.value
	const availabilityMatches = availabilityFilter.value === 'all'
		|| (availabilityFilter.value === 'available' && account.availability)
		|| (availabilityFilter.value === 'unavailable' && !account.availability)
	return sourceMatches && availabilityMatches
}))
const columns: TableColumn<MailAccountResponse>[] = [
	{ accessorKey: 'email', header: 'Email' },
	{ id: 'source', header: 'Источник' },
	{ id: 'protocols', header: 'Проверки' },
	{ id: 'availability', header: 'Статус' },
	{ id: 'created', header: 'Создан' },
	{ id: 'assigned', header: 'Назначен' },
	{ id: 'checked', header: 'Последняя проверка' },
{ id: 'actions', header: '' },
]
function statusLabel(value: boolean): string { return value ? 'OK' : 'ошибка' }
function ports(): { smtp: number, imap: number } | null {
const smtp = Number(form.smtp_port); const imap = Number(form.imap_port)
return Number.isInteger(smtp) && smtp > 0 && smtp <= 65535 && Number.isInteger(imap) && imap > 0 && imap <= 65535 ? { smtp, imap } : null
}
async function load() {
loading.value = true; loadError.value = null
try { accounts.value = await get<MailAccountResponse[]>('/admin/mail-accounts') }
catch (error: unknown) { loadError.value = getApiErrorDetail(error) ?? 'Не удалось загрузить почтовые аккаунты' }
finally { loading.value = false }
}
async function createAccount() {
const values = ports()
if (!values) { formError.value = 'Порты должны быть целыми числами от 1 до 65535'; return }
creating.value = true; formError.value = null
try {
const payload: MailAccountCreate = { email: form.email.trim(), password: form.password, smtp_host: form.smtp_host.trim(), smtp_port: values.smtp, imap_host: form.imap_host.trim(), imap_port: values.imap }
await post<MailAccountResponse>('/admin/mail-accounts', payload)
Object.assign(form, { email: '', password: '', smtp_host: '', smtp_port: '465', imap_host: '', imap_port: '993' })
await load()
}
catch (error: unknown) { formError.value = getApiErrorDetail(error) ?? 'Не удалось создать аккаунт' }
finally { creating.value = false }
}
async function verifyOne(id: string) {
verifyingId.value = id
try { await post(`/admin/mail-accounts/${id}/verify`, {}); await load() }
catch (error: unknown) { loadError.value = getApiErrorDetail(error) ?? 'Не удалось проверить аккаунт' }
finally { verifyingId.value = null }
}
async function verifyAll() {
verifyingAll.value = true
try { await post('/admin/mail-accounts/verify-all', {}); await load() }
catch (error: unknown) { loadError.value = getApiErrorDetail(error) ?? 'Не удалось запустить массовую проверку' }
finally { verifyingAll.value = false }
}
async function deleteAccount(account: MailAccountResponse) {
	const warning = account.assigned_user_count > 0
		? `Аккаунт ${account.email} назначен пользователям (${account.assigned_user_count}). Удаление снимет эти назначения; история писем останется. Продолжить?`
		: `Удалить почтовый аккаунт ${account.email}? История писем останется.`
	if (!window.confirm(warning)) return
	deletingId.value = account.id
	loadError.value = null
	try {
		await del(`/admin/mail-accounts/${account.id}`)
		await load()
	} catch (error: unknown) {
		loadError.value = getApiErrorDetail(error) ?? 'Не удалось удалить почтовый аккаунт'
	} finally {
		deletingId.value = null
	}
}
onMounted(load)
</script>
