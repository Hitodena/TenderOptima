<template>
	<div>
		<!-- Authenticated: dashboard -->
		<template v-if="auth.isAuthenticated.value && user">
			<div class="dashboard-page">
			<!-- Hero -->
			<section class="landing-hero px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-18 lg:px-8 lg:pb-24 lg:pt-20">
				<div class="landing-hero-shape landing-hero-shape-1" aria-hidden="true" />
				<div class="landing-hero-shape landing-hero-shape-2" aria-hidden="true" />
				<div class="relative z-10 mx-auto max-w-4xl text-center">
					<p class="landing-hero-eyebrow mb-4 text-sm font-semibold uppercase tracking-widest">
						TenderOptima
					</p>
					<h1 class="landing-hero-title mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
						Добро пожаловать<template v-if="userName">, {{ userName }}</template>
					</h1>
					<p class="landing-hero-subtitle mx-auto max-w-2xl text-lg leading-relaxed sm:text-xl">
						Современная платформа для управления закупками и поиска поставщиков
					</p>
				</div>
			</section>

			<!-- Main feature cards -->
			<section class="px-4 pb-10 pt-0 sm:px-6 sm:pb-14 lg:px-8">
				<div class="mx-auto max-w-5xl">
					<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<!-- Suppliers / requests card -->
						<NuxtLink
							to="/requests"
							class="landing-card landing-card-down group flex flex-col gap-6 p-8 focus-visible:outline-primary sm:p-10"
						>
							<!-- Icon + arrow -->
							<div class="flex items-start justify-between gap-3">
								<div class="flex size-16 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/20">
									<UIcon name="i-lucide-search" class="size-8 text-primary" />
								</div>
								<div class="flex size-9 items-center justify-center rounded-full bg-elevated transition-all group-hover:bg-primary/10 group-hover:translate-x-1">
									<UIcon name="i-lucide-arrow-right" class="size-4 text-muted group-hover:text-primary" />
								</div>
							</div>

							<!-- Text -->
							<div class="flex-1">
								<h2 class="mb-3 text-2xl font-bold text-highlighted">
									Выбор поставщика
								</h2>
								<p class="text-base leading-relaxed text-muted">
									Инструменты и возможности для быстрого поиска поставщиков и отправки запросов
								</p>
							</div>

							<!-- Feature bullets -->
							<ul class="mt-auto space-y-2.5 border-t border-default pt-5">
								<li class="flex items-center gap-2.5 text-sm text-muted">
									<UIcon name="i-lucide-search" class="size-4 shrink-0 text-primary" />
									Автоматический поиск компаний по региону
								</li>
								<li class="flex items-center gap-2.5 text-sm text-muted">
									<UIcon name="i-lucide-send" class="size-4 shrink-0 text-primary" />
									Рассылка запросов поставщикам
								</li>
								<li class="flex items-center gap-2.5 text-sm text-muted">
									<UIcon name="i-lucide-inbox" class="size-4 shrink-0 text-primary" />
									Входящие ответы и сравнение КП
								</li>
							</ul>
						</NuxtLink>

						<!-- TZ analysis card -->
						<NuxtLink
							to="/tz-analysis"
							class="landing-card landing-card-down group flex flex-col gap-6 p-8 focus-visible:outline-primary sm:p-10"
						>
							<!-- Icon + arrow -->
							<div class="flex items-start justify-between gap-3">
								<div class="flex size-16 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/20">
									<UIcon name="i-lucide-file-search" class="size-8 text-primary" />
								</div>
								<div class="flex size-9 items-center justify-center rounded-full bg-elevated transition-all group-hover:bg-primary/10 group-hover:translate-x-1">
									<UIcon name="i-lucide-arrow-right" class="size-4 text-muted group-hover:text-primary" />
								</div>
							</div>

							<!-- Text -->
							<div class="flex-1">
								<h2 class="mb-3 text-2xl font-bold text-highlighted">
									Технический анализ
								</h2>
								<p class="text-base leading-relaxed text-muted">
									Полный цикл тендерных процедур с техническим анализом и сравнением предложений
								</p>
							</div>

							<!-- Feature bullets -->
							<ul class="mt-auto space-y-2.5 border-t border-default pt-5">
								<li class="flex items-center gap-2.5 text-sm text-muted">
									<UIcon name="i-lucide-file-search" class="size-4 shrink-0 text-primary" />
									Извлечение требований из ТЗ
								</li>
								<li class="flex items-center gap-2.5 text-sm text-muted">
									<UIcon name="i-lucide-file-check" class="size-4 shrink-0 text-primary" />
									Сверка с коммерческими предложениями
								</li>
								<li class="flex items-center gap-2.5 text-sm text-muted">
									<UIcon name="i-lucide-table" class="size-4 shrink-0 text-primary" />
									Отчёты — XLSX / DOCX
								</li>
							</ul>
						</NuxtLink>
					</div>
				</div>
			</section>

			<!-- Quick links row -->
			<section class="border-t border-default bg-elevated/30 px-4 py-6 sm:px-6 lg:px-8">
				<div class="mx-auto max-w-5xl">
					<p class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
						Быстрый доступ
					</p>
					<div class="flex flex-wrap gap-3">
						<UButton
							to="/requests/history"
							variant="outline"
							color="neutral"
							leading-icon="i-lucide-history"
							size="sm"
						>
							История запросов
						</UButton>
						<UButton
							to="/tz-analysis/history"
							variant="outline"
							color="neutral"
							leading-icon="i-lucide-archive"
							size="sm"
						>
							История анализов
						</UButton>
						<UButton
							:to="subscriptionPath"
							variant="outline"
							color="neutral"
							leading-icon="i-lucide-credit-card"
							size="sm"
						>
							Подписка
						</UButton>
					</div>
				</div>
			</section>

			<!-- Subscription stats for authorized users -->
			<section v-if="user?.subscription" class="border-t border-default px-4 py-6 sm:px-6 lg:px-8">
				<div class="mx-auto max-w-5xl">
					<p class="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
						Статус подписки
					</p>
					<ProfileSubscriptionPanel :subscription="user.subscription" />
				</div>
			</section>
			</div>
		</template>

		<!-- Not authenticated (or loading): full landing page -->
		<template v-else-if="!auth.isAuthenticated.value">
			<div class="landing-page">
				<!-- Hero: asymmetric layout, flat CTA, compact trust row, metrics cards -->
				<section
					class="landing-hero landing-hero--observed px-4 pt-12 pb-8 sm:px-6 sm:pt-14 sm:pb-10 lg:px-8 lg:pt-16 lg:pb-12"
					:class="{ 'landing-hero--inview': heroVisible }"
				>
					<div ref="heroReveal" class="reveal is-visible relative z-10 mx-auto max-w-6xl">
						<div class="landing-hero-grid gap-4 text-center lg:gap-10 lg:text-left">
							<div class="pb-4 sm:pb-6 lg:pb-2">
								<h1
									class="landing-hero-title mb-4 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl"
								>
									Упростите процессы закупок
								</h1>
								<ul class="mx-auto mb-6 flex flex-col gap-y-2.5 lg:mx-0 md:gap-y-3">
									<li
										v-for="point in heroBulletPoints"
										:key="point.desktop"
										class="flex items-center gap-2 md:items-start md:gap-2.5"
									>
										<UIcon
											name="i-lucide-check"
											class="size-4 shrink-0 text-orange-600 md:mt-0.5 md:size-[17px]"
											aria-hidden="true"
										/>
										<span class="text-left text-sm leading-snug text-gray-600 dark:text-gray-400 md:hidden">
											{{ point.mobile }}
										</span>
										<span class="hidden text-left text-base font-normal leading-snug text-gray-600 dark:text-gray-400 md:inline">
											{{ point.desktop }}
										</span>
									</li>
								</ul>
								<div class="flex w-full flex-col items-center gap-3 lg:items-start">
									<UButton
										size="lg"
										leading-icon="i-lucide-play-circle"
										:label="landingCtaLabel"
										class="landing-btn-primary w-auto max-w-full"
										@click="consultation.open()"
									/>
								</div>
								<div class="mt-6 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 sm:mt-7 sm:gap-x-3 lg:justify-start">
									<template v-for="(badge, index) in heroTrustBadges" :key="badge.label">
										<span
											v-if="index > 0"
											class="hidden shrink-0 text-sm text-gray-300 dark:text-gray-600 sm:inline"
											aria-hidden="true"
										>|</span>
										<TrustBadge compact :icon="badge.icon" :label="badge.label" />
									</template>
								</div>
							</div>

							<ProductMockup />
						</div>

						<MetricsHeroBand class="mt-8 lg:mt-10" />
					</div>
				</section>
				<IndustrySegmentsBand />

				<!-- JTBD bridge: two main pains → platform value -->
				<ProblemSolutionBridge />

				<RoiPaybackBand />

				<HowItWorksIntro />

				<!-- Interface walkthroughs -->
				<SupplierSearchHowItWorks />
				<TzKpHowItWorks />

				<!-- ICP: who it's for -->
				<section
					id="icp"
					ref="icpReveal"
					class="reveal px-4 py-12 sm:px-6 md:py-24 lg:px-8"
					:class="{ 'is-visible': icpVisible }"
				>
					<div class="mx-auto max-w-7xl">
						<div class="mb-12 text-center">
							<p class="landing-section-headline mb-2">
								Для кого
							</p>
							<h2 class="landing-section-title mb-4">
								Удобно сотрудникам — эффективно для бизнеса
							</h2>
							<p class="landing-section-description mx-auto">
								От специалиста, который готовит запросы, до руководителя, которому нужна прозрачная картина
								по срокам и рискам.
							</p>
						</div>

						<AudienceValueBlock />
					</div>
				</section>

				<RequestBroadcastBlock />

				<!-- Pricing teaser -->
				<LandingPricingTeaser />

				<!-- Case studies preview -->
				<section
					id="cases" ref="casesReveal"
					class="reveal bg-elevated/25 px-4 py-12 sm:px-6 md:py-24 lg:px-8"
				>
					<div class="mx-auto max-w-6xl">
						<div class="mb-12 text-center">
							<p class="landing-section-headline mb-2">
								Кейсы
							</p>
							<h2 class="landing-section-title mb-4">
								Как команды закупок используют TenderOptima
							</h2>
							<p class="landing-section-description mx-auto">
								Типовые сценарии без выдуманных названий компаний — только реальные задачи и результат
								работы с платформой.
							</p>
						</div>

						<CaseStudiesBento
							class="reveal"
							:class="{ 'is-visible': casesVisible }"
						/>

						<CtaBanner class="mt-10" />
					</div>
				</section>

				<!-- FAQ -->
				<section
id="faq" ref="faqReveal"
					class="reveal bg-elevated/25 px-4 py-12 sm:px-6 md:py-24 lg:px-8">
					<div class="mx-auto max-w-3xl">
						<div class="mb-10 text-center">
							<p class="landing-section-headline mb-2">
								FAQ
							</p>
							<h2 class="landing-section-title">
								Частые вопросы
							</h2>
						</div>

						<UAccordion
type="single" :unmount-on-hide="false" :items="faqAccordionItems"
							class="rounded-xl border border-default bg-default px-4 sm:px-5" :ui="{
								trigger: 'py-4 text-base font-medium cursor-pointer',
								body: 'text-sm text-muted pb-4 leading-relaxed',
								content: 'overflow-hidden',
							}" />
					</div>
				</section>

				<!-- CTA: final section with embedded consultation form -->
				<section id="contacts" ref="ctaReveal" class="landing-cta-band reveal px-4 py-12 sm:px-6 md:py-24 lg:px-8">
					<div
						class="mx-auto max-w-7xl"
						:class="{ 'is-visible': ctaVisible }"
					>
						<div class="landing-cta-grid">
							<div class="landing-cta-grid__left min-w-0">
								<ContactSupportBrand />
								<ContactSupportPanel class="mt-4 sm:mt-5" />
							</div>

							<div class="landing-cta-grid__form landing-card bg-default p-6 md:p-8">
								<h2 class="landing-cta-title mb-1.5 text-xl font-bold sm:text-2xl">
									{{ landingCtaSectionTitle }}
								</h2>
								<p class="landing-cta-description mb-4 text-sm">
									Менеджер свяжется в рабочее время и предоставит вам доступ.
								</p>
								<ConsultationForm :submit-label="landingCtaFormSubmitLabel" />
							</div>
						</div>
					</div>
				</section>
			</div>
		</template>

		<!-- Loading state for authenticated users whose data is still fetching -->
		<template v-else>
			<div class="flex min-h-64 items-center justify-center">
				<UIcon name="i-lucide-loader" class="size-8 animate-spin text-muted" />
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui'
import type { UserResponse } from '#shared/types'

import AudienceValueBlock from '~/components/landing/AudienceValueBlock.vue'
import CaseStudiesBento from '~/components/landing/CaseStudiesBento.vue'
import ContactSupportBrand from '~/components/landing/ContactSupportBrand.vue'
import ContactSupportPanel from '~/components/landing/ContactSupportPanel.vue'
import CtaBanner from '~/components/landing/CtaBanner.vue'
import HowItWorksIntro from '~/components/landing/HowItWorksIntro.vue'
import SupplierSearchHowItWorks from '~/components/landing/SupplierSearchHowItWorks.vue'
import TzKpHowItWorks from '~/components/landing/TzKpHowItWorks.vue'
import IndustrySegmentsBand from '~/components/landing/IndustrySegmentsBand.vue'
import LandingPricingTeaser from '~/components/landing/LandingPricingTeaser.vue'
import MetricsHeroBand from '~/components/landing/MetricsHeroBand.vue'
import ProblemSolutionBridge from '~/components/landing/ProblemSolutionBridge.vue'
import ProductMockup from '~/components/landing/ProductMockup.vue'
import RequestBroadcastBlock from '~/components/landing/RequestBroadcastBlock.vue'
import RoiPaybackBand from '~/components/landing/RoiPaybackBand.vue'
import TrustBadge from '~/components/landing/TrustBadge.vue'
import {
	FAQ_ITEMS,
	HERO_BULLET_POINTS,
	HERO_TRUST_BADGES,
	LANDING_CTA_FORM_SUBMIT_LABEL,
	LANDING_CTA_LABEL,
	LANDING_CTA_SECTION_TITLE,
} from '#shared/constants/landing'
import { subscriptionPlansPath } from '#shared/utils/subscriptionDisplay'
import { useScrollReveal } from '~/composables/useScrollReveal'

definePageMeta({
	layout: 'default',
})

const auth = useAuthStore()
const consultation = useConsultationModal()
const { get } = useApi()

const user = ref<UserResponse | null>(null)
const subscriptionPath = computed(() => subscriptionPlansPath())

const userName = computed(() => {
	const name = user.value?.full_name?.trim()
	return name ? name.split(' ')[0] : ''
})

onMounted(async () => {
	if (!import.meta.client) return

	if (auth.isAuthenticated.value) {
		try {
			user.value = await get<UserResponse>('/auth/me')
		} catch {
			auth.clearToken()
			user.value = null
		}
		return
	}

	if (heroReveal.value) {
		heroReveal.value.classList.add('is-visible')
	}

	if (faqReveal.value) {
		faqReveal.value.classList.add('is-visible')
	}
})

// --- Landing page only composables ---

const { target: heroReveal, isVisible: heroVisible } = useScrollReveal({
	once: false,
	threshold: 0.1,
	rootMargin: '0px',
})

const { target: icpReveal, isVisible: icpVisible } = useScrollReveal()
const { target: casesReveal, isVisible: casesVisible } = useScrollReveal()
const { target: faqReveal } = useScrollReveal()
const { target: ctaReveal, isVisible: ctaVisible } = useScrollReveal()

const heroBulletPoints = HERO_BULLET_POINTS
const heroTrustBadges = HERO_TRUST_BADGES
const landingCtaLabel = LANDING_CTA_LABEL
const landingCtaFormSubmitLabel = LANDING_CTA_FORM_SUBMIT_LABEL
const landingCtaSectionTitle = LANDING_CTA_SECTION_TITLE

const faqAccordionItems = computed<AccordionItem[]>(() =>
	FAQ_ITEMS.map((item, index) => ({
		label: item.question,
		content: item.answer,
		value: String(index),
	})),
)
</script>
