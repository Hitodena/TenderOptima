<script setup lang="ts">
import { REQUEST_BROADCAST } from '#shared/constants/landing'
import { useScrollReveal } from '~/composables/useScrollReveal'
import ProductMockup from '~/components/landing/ProductMockup.vue'

const { title, subtitle, highlights } = REQUEST_BROADCAST

const { target: sectionRef, isVisible } = useScrollReveal({
	once: false,
	threshold: 0.12,
})

const hasRevealed = ref(false)

type MockSlide = 'broadcast' | 'inbox' | 'compare'

const slides: { id: MockSlide; label: string }[] = [
	{ id: 'broadcast', label: 'Рассылка запросов' },
	{ id: 'inbox', label: 'Переписка' },
	{ id: 'compare', label: 'Сравнение поставщиков' },
]

const activeSlide = ref(0)
const currentVariant = computed(() => slides[activeSlide.value]?.id ?? 'broadcast')

let timer: ReturnType<typeof setInterval> | null = null
const isPaused = ref(false)

function goToSlide(index: number) {
	activeSlide.value = index
	restartAutoplay()
}

function startAutoplay() {
	if (!isVisible.value || isPaused.value || slides.length < 2) {
		return
	}
	timer = setInterval(() => {
		activeSlide.value = (activeSlide.value + 1) % slides.length
	}, 6000)
}

function stopAutoplay() {
	if (timer) {
		clearInterval(timer)
	}
	timer = null
}

function restartAutoplay() {
	stopAutoplay()
	startAutoplay()
}

function resumeAutoplay() {
	isPaused.value = false
	if (isVisible.value) {
		startAutoplay()
	}
}

watch(isVisible, (visible) => {
	if (visible) {
		hasRevealed.value = true
	}
	if (visible && !isPaused.value) {
		startAutoplay()
	}
	else {
		stopAutoplay()
	}
})

onBeforeUnmount(stopAutoplay)
</script>

<template>
	<section
		id="requests"
		ref="sectionRef"
		class="reveal bg-elevated/25 py-(--landing-section-py) px-4 sm:px-6 lg:px-8"
		:class="{ 'is-inview': isVisible, 'is-visible': hasRevealed }"
	>
		<div class="mx-auto max-w-7xl">
			<div
				class="grid items-center gap-10 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)] lg:gap-12 xl:gap-16"
			>
				<div
					class="reveal max-w-xl lg:max-w-none"
					:class="{ 'is-visible': hasRevealed }"
				>
					<h2 class="text-3xl font-bold tracking-tight text-highlighted">
						{{ title }}
					</h2>
					<p
						v-if="subtitle"
						class="mt-4 text-base leading-relaxed text-muted sm:text-lg"
					>
						{{ subtitle }}
					</p>

					<ul class="mt-8 space-y-4">
						<li
							v-for="(item, index) in highlights"
							:key="item.text"
							class="reveal flex items-start gap-3.5"
							:class="[`stagger-${index + 1}`, { 'is-visible': hasRevealed }]"
						>
							<span
								class="flex size-9 shrink-0 items-center justify-center rounded-lg"
								:class="[item.iconBg, item.iconColor]"
							>
								<UIcon :name="item.icon" class="size-4.5" />
							</span>
							<span class="pt-1.5 text-sm leading-relaxed text-default sm:text-base">
								{{ item.text }}
							</span>
						</li>
					</ul>
				</div>

				<div
					class="reveal stagger-2 w-full min-w-0"
					:class="{ 'is-visible': hasRevealed }"
					@mouseenter="isPaused = true; stopAutoplay()"
					@mouseleave="resumeAutoplay()"
				>
					<Transition name="request-mock-fade" mode="out-in">
						<ProductMockup
							:key="currentVariant"
							:variant="currentVariant"
						/>
					</Transition>

					<div
						class="mt-4 flex flex-wrap items-center justify-center gap-2"
						role="tablist"
						aria-label="Сценарии рассылки, переписки и сравнения"
					>
						<button
							v-for="(slide, index) in slides"
							:key="slide.id"
							type="button"
							role="tab"
							class="request-mock-tab"
							:class="{ 'request-mock-tab--active': activeSlide === index }"
							:aria-selected="activeSlide === index"
							@click="goToSlide(index)"
						>
							{{ slide.label }}
						</button>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>

<style scoped>
.request-mock-fade-enter-active,
.request-mock-fade-leave-active {
	transition: opacity 0.25s ease, transform 0.25s ease;
}

.request-mock-fade-enter-from,
.request-mock-fade-leave-to {
	opacity: 0;
	transform: translateY(8px);
}

.request-mock-tab {
	padding: 0.35rem 0.75rem;
	border-radius: 999px;
	border: 1px solid var(--ui-border);
	background: color-mix(in oklab, var(--ui-bg) 88%, transparent);
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--ui-text-muted);
	cursor: pointer;
	transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.request-mock-tab:hover {
	color: var(--ui-text-highlighted);
}

.request-mock-tab--active {
	color: var(--color-cta);
	border-color: color-mix(in oklab, var(--color-cta) 32%, var(--ui-border));
	background: color-mix(in oklab, var(--color-cta) 8%, var(--ui-bg));
}

@media (prefers-reduced-motion: reduce) {
	.request-mock-fade-enter-active,
	.request-mock-fade-leave-active {
		transition: none;
	}

	.request-mock-fade-enter-from,
	.request-mock-fade-leave-to {
		transform: none;
	}
}
</style>
