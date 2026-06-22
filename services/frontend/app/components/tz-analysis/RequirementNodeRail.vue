<template>
	<div class="w-full select-none pt-1">
		<div class="border-t border-default w-full" aria-hidden="true" />

		<div class="flex justify-center pt-2 pb-1">
			<div class="relative flex items-center">
				<div class="relative flex items-center gap-1">
					<div
						class="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-default"
						aria-hidden="true"
					/>

					<button
						type="button"
						class="relative z-10 flex size-6 items-center justify-center rounded-full border border-default bg-default hover:bg-elevated transition-colors"
						aria-label="Добавить подпункт"
						@click.stop="emit('add-child')"
					>
						<UIcon name="i-lucide-plus" class="size-3.5 text-muted" />
					</button>

					<button
						type="button"
						class="relative z-10 flex size-6 items-center justify-center rounded-full text-muted hover:bg-elevated/60 transition-colors"
						aria-label="Открыть действия добавления"
						:aria-expanded="menuOpen"
						@click.stop="menuOpen = !menuOpen"
					>
						<UIcon
							name="i-lucide-chevron-down"
							class="size-4 transition-transform"
							:class="menuOpen && '-rotate-90'"
						/>
					</button>
				</div>

				<Transition name="requirement-actions">
					<div
						v-if="menuOpen"
						class="absolute left-14 top-0 z-20 flex items-center gap-1 rounded-full border border-default bg-default/95 p-1 shadow-sm backdrop-blur-sm"
					>
						<button
							type="button"
							class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-default hover:bg-elevated transition-colors"
							@click.stop="selectHeading"
						>
							<UIcon name="i-lucide-heading" class="size-3.5 text-muted" />
							Заголовок
						</button>
						<button
							v-if="showRemove"
							type="button"
							class="inline-flex size-7 items-center justify-center rounded-full text-error hover:bg-error/10 transition-colors"
							aria-label="Удалить пункт"
							@click.stop="selectRemove"
						>
							<UIcon name="i-lucide-trash-2" class="size-3.5" />
						</button>
						<button
							type="button"
							class="inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-elevated transition-colors"
							aria-label="Закрыть действия"
							@click.stop="menuOpen = false"
						>
							<UIcon name="i-lucide-x" class="size-3.5" />
						</button>
					</div>
				</Transition>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
const props = withDefaults(
	defineProps<{
		showRemove?: boolean
	}>(),
	{ showRemove: true },
)

const emit = defineEmits<{
	'add-child': []
	'add-heading': []
	'add-sibling': []
	remove: []
}>()

const menuOpen = ref(false)

function selectHeading() {
	emit('add-heading')
	menuOpen.value = false
}

function selectRemove() {
	if (!props.showRemove) return
	emit('remove')
	menuOpen.value = false
}
</script>

<style scoped>
.requirement-actions-enter-active,
.requirement-actions-leave-active {
	transition:
		opacity 120ms ease,
		transform 120ms ease;
}

.requirement-actions-enter-from,
.requirement-actions-leave-to {
	opacity: 0;
	transform: translateX(-0.5rem) scaleX(0.96);
}
</style>
