<template>
	<aside
		class="contact-support-panel landing-card bg-default p-5 sm:p-6"
		aria-label="Контакты поддержки"
	>
		<div class="contact-support-panel__top">
			<div class="contact-support-panel__head">
				<h3 class="text-sm font-semibold text-primary">
					Контакты
				</h3>
				<p class="mt-1 text-sm leading-snug text-muted">
					{{ support.lead }}
				</p>
			</div>

			<a
				:href="`tel:${phoneTel}`"
				class="contact-support-panel__phone shrink-0 transition-opacity hover:opacity-80"
			>
				<span class="sr-only">Телефон</span>
				{{ phoneDisplay }}
			</a>
		</div>

		<div class="contact-support-panel__bottom">
			<a
				v-if="telegramHref"
				:href="telegramHref"
				target="_blank"
				rel="noopener noreferrer"
				class="contact-support-panel__telegram transition-opacity hover:opacity-80"
				aria-label="Telegram"
			>
				<span
					class="contact-support-panel__telegram-icon"
					aria-hidden="true"
				>
					<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<rect width="24" height="24" rx="6" fill="currentColor" />
						<path
							fill="#fff"
							d="M17.472 7.382 6.914 11.86c-.78.317-.768.753-.133.95l2.675.835 1.03 3.13c.12.37.22.51.45.51.29 0 .415-.13.64-.47l1.56-2.25 2.89 2.14c.53.29.91.14 1.04-.49l1.9-8.93c.19-.77-.28-1.12-.86-.93Z"
						/>
					</svg>
				</span>
				<span class="block text-sm font-medium text-highlighted">{{ telegramDisplay }}</span>
			</a>

			<ul class="contact-support-panel__emails" aria-label="Email-адреса">
				<li
					v-for="email in support.emails"
					:key="email.address"
				>
					<a
						:href="`mailto:${email.address}`"
						class="group block transition-opacity hover:opacity-80"
					>
						<span class="block text-xs text-muted">{{ email.label }}</span>
						<span class="block text-sm font-medium break-all text-highlighted group-hover:text-primary">
							{{ email.address }}
						</span>
					</a>
				</li>
			</ul>
		</div>
	</aside>
</template>

<script lang="ts" setup>
import { CONTACT_SUPPORT } from '#shared/constants/landing'

const support = CONTACT_SUPPORT
const { public: publicConfig } = useRuntimeConfig()

const phoneTel = computed(() => String(publicConfig.contactPhone).replace(/\s/g, ''))
const phoneDisplay = computed(() => String(publicConfig.contactPhone))

const telegramRaw = computed(() => String(publicConfig.contactTelegram ?? '').trim())

const telegramDisplay = computed(() => {
	const value = telegramRaw.value
	if (!value) {
		return ''
	}
	return value.startsWith('@') ? value : `@${value}`
})

const telegramHref = computed(() => {
	const value = telegramRaw.value
	if (!value) {
		return ''
	}
	const username = value.replace(/^@/, '')
	return `https://t.me/${username}`
})
</script>

<style scoped>
.contact-support-panel__top {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
	justify-content: space-between;
	gap: 0.75rem 1.25rem;
}

.contact-support-panel__head {
	min-width: 0;
	flex: 1 1 12rem;
}

.contact-support-panel__phone {
	font-size: clamp(1.375rem, 3vw, 1.875rem);
	font-weight: 700;
	line-height: 1.05;
	letter-spacing: -0.03em;
	color: var(--color-cta);
}

.contact-support-panel__bottom {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	gap: 1rem 1.5rem;
	margin-top: 1rem;
	padding-top: 1rem;
	border-top: 1px solid color-mix(in oklab, var(--ui-border) 75%, transparent);
}

.contact-support-panel__telegram {
	flex: 0 0 auto;
}

.contact-support-panel__telegram-icon {
	display: inline-flex;
	width: 3.6rem;
	height: 3.6rem;
	margin-bottom: 0.25rem;
	color: #2aabee;
	border-radius: 0.3125rem;
	overflow: hidden;
}

.contact-support-panel__emails {
	display: flex;
	flex: 1 1 14rem;
	flex-wrap: wrap;
	gap: 0.75rem 1.25rem;
	min-width: 0;
	list-style: none;
	margin: 0;
	padding: 0;
}

.contact-support-panel__emails li {
	flex: 1 1 9rem;
	min-width: 0;
}
</style>
