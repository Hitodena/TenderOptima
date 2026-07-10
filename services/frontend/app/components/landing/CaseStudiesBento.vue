<template>
	<div
		ref="rootRef"
		class="cases-bento"
		:class="{ 'is-visible': isVisible }"
	>
		<!-- Desktop / tablet: bento with active focus -->
		<div class="cases-bento__desktop hidden md:grid">
			<div class="cases-bento__primary">
				<Transition name="case-primary" mode="out-in">
					<CaseStudyCardExpanded
						:key="activeStudy.id"
						:study="activeStudy"
					/>
				</Transition>
			</div>

			<div class="cases-bento__secondary">
				<TransitionGroup
					name="case-teaser"
					tag="div"
					class="cases-bento__secondary-list"
				>
					<button
						v-for="(study, index) in inactiveStudies"
						:key="study.id"
						type="button"
						class="cases-bento__teaser-btn cursor-pointer"
						:class="index === 0 ? 'cases-bento__teaser-btn--front' : 'cases-bento__teaser-btn--back'"
						:aria-label="`Показать кейс: ${study.title}`"
						@click="activate(study.id)"
					>
						<CaseStudyCardTeaser :study="study" />
					</button>
				</TransitionGroup>
			</div>
		</div>

		<!-- Mobile: full cards in snap carousel -->
		<div
			class="cases-bento__mobile -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:hidden"
			role="list"
		>
			<CaseStudyCardExpanded
				v-for="study in studies"
				:key="study.id"
				:study="study"
				class="cases-bento__mobile-slide snap-center"
				role="listitem"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { CaseStudy } from '#shared/constants/landing'
import { CASE_STUDIES } from '#shared/constants/landing'
import CaseStudyCardExpanded from '~/components/landing/CaseStudyCardExpanded.vue'
import CaseStudyCardTeaser from '~/components/landing/CaseStudyCardTeaser.vue'
import { useScrollReveal } from '~/composables/useScrollReveal'

const props = withDefaults(
	defineProps<{
		studies?: CaseStudy[]
		initialActiveId?: string
	}>(),
	{
		studies: () => CASE_STUDIES,
		initialActiveId: undefined,
	},
)

const { target: rootRef, isVisible } = useScrollReveal({ threshold: 0.12 })

const activeId = ref(
	props.initialActiveId ?? props.studies[0]?.id ?? '',
)

const activeStudy = computed(
	() => props.studies.find((study) => study.id === activeId.value) ?? props.studies[0],
)

const inactiveStudies = computed(
	() => props.studies.filter((study) => study.id !== activeId.value),
)

function activate(id: string) {
	if (id === activeId.value) {
		return
	}
	activeId.value = id
}
</script>

<style scoped>
.cases-bento__desktop {
	grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
	gap: 1rem;
	align-items: stretch;
	min-height: 28rem;
}

.cases-bento__primary {
	min-width: 0;
}

.cases-bento__secondary {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 28rem;
	padding: 0.5rem 0;
}

.cases-bento__secondary-list {
	position: relative;
	width: 100%;
	height: 20rem;
}

.cases-bento__teaser-btn {
	position: absolute;
	left: 0;
	right: 0;
	width: 100%;
	padding: 0;
	border: 0;
	background: none;
	text-align: inherit;
	transition: z-index 0s;
}

.cases-bento__teaser-btn--front {
	top: 0;
	left: 2%;
	right: -2%;
	z-index: 2;
}

.cases-bento__teaser-btn--back {
	top: 9.75rem;
	left: -2%;
	right: 2%;
	z-index: 1;
}

.cases-bento__teaser-btn :deep(.landing-case-teaser) {
	min-height: 10.5rem;
	box-shadow:
		0 4px 14px rgb(15 23 42 / 7%),
		0 1px 3px rgb(15 23 42 / 4%);
	transition:
		transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1),
		box-shadow 0.32s cubic-bezier(0.4, 0, 0.2, 1),
		border-color 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.cases-bento__teaser-btn--front :deep(.landing-case-teaser) {
	transform: rotate(-2.75deg);
}

.cases-bento__teaser-btn--back :deep(.landing-case-teaser) {
	transform: rotate(2.35deg);
}

.cases-bento__teaser-btn:hover,
.cases-bento__teaser-btn:focus-visible {
	z-index: 10;
}

.cases-bento__teaser-btn:hover :deep(.landing-case-teaser),
.cases-bento__teaser-btn:focus-visible :deep(.landing-case-teaser) {
	transform: rotate(0deg) translateY(-8px) scale(1.025);
	border-color: color-mix(in oklab, var(--ui-primary) 32%, var(--ui-border));
	box-shadow:
		0 18px 36px rgb(15 23 42 / 12%),
		0 0 0 1px color-mix(in oklab, var(--ui-primary) 10%, transparent);
}

.cases-bento__teaser-btn:active :deep(.landing-case-teaser) {
	transform: rotate(0deg) translateY(-4px) scale(1.01);
}

.cases-bento__teaser-btn:focus-visible {
	outline: none;
}

.cases-bento__teaser-btn:focus-visible :deep(.landing-case-teaser) {
	outline: 2px solid var(--ui-primary);
	outline-offset: 2px;
}

.cases-bento__mobile-slide {
	width: min(88vw, 22rem);
	flex-shrink: 0;
	scroll-snap-stop: always;
}

.case-primary-enter-active,
.case-primary-leave-active {
	transition:
		opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
		transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.case-primary-enter-from {
	opacity: 0;
	transform: translateX(1.25rem);
}

.case-primary-leave-to {
	opacity: 0;
	transform: translateX(-1rem);
}

.case-teaser-move {
	transition: transform 0.4s cubic-bezier(0.34, 1.1, 0.64, 1);
}

.case-teaser-enter-active,
.case-teaser-leave-active {
	transition:
		opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1),
		transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.case-teaser-enter-from,
.case-teaser-leave-to {
	opacity: 0;
}

.case-teaser-leave-active {
	position: absolute;
	left: 0;
	right: 0;
}

@media (prefers-reduced-motion: reduce) {
	.case-primary-enter-active,
	.case-primary-leave-active,
	.case-teaser-move,
	.case-teaser-enter-active,
	.case-teaser-leave-active,
	.cases-bento__teaser-btn :deep(.landing-case-teaser) {
		transition: none !important;
	}

	.case-primary-enter-from,
	.case-primary-leave-to {
		transform: none;
	}

	.cases-bento__teaser-btn--front :deep(.landing-case-teaser),
	.cases-bento__teaser-btn--back :deep(.landing-case-teaser) {
		transform: none;
	}

	.cases-bento__teaser-btn:hover :deep(.landing-case-teaser),
	.cases-bento__teaser-btn:focus-visible :deep(.landing-case-teaser),
	.cases-bento__teaser-btn:active :deep(.landing-case-teaser) {
		transform: none;
	}
}
</style>
