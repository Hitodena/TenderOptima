<template>
	<UButton
		:color="resolvedColor"
		:variant="resolvedVariant"
		:size="size"
		:to="to"
		:icon="icon"
		:leading-icon="leadingIcon"
		:trailing-icon="trailingIcon"
		:loading="loading"
		:disabled="disabled"
		:block="block"
		class="cursor-pointer"
		:class="buttonClasses"
		@click="onClick"
	>
		<slot />
	</UButton>
</template>

<script lang="ts" setup>
import type { ButtonProps } from '@nuxt/ui'

/**
 * Landing CTA hierarchy:
 * - primary → warm accent (main conversion action)
 * - secondary → blue outline (supporting action)
 * - ghost → neutral text button
 */
const props = withDefaults(
	defineProps<{
		variant?: 'primary' | 'secondary' | 'ghost'
		size?: ButtonProps['size']
		to?: string
		icon?: string
		leadingIcon?: string
		trailingIcon?: string
		loading?: boolean
		disabled?: boolean
		block?: boolean
	}>(),
	{
		variant: 'primary',
		size: 'lg',
		to: undefined,
		icon: undefined,
		leadingIcon: undefined,
		trailingIcon: undefined,
		loading: false,
		disabled: false,
		block: false,
	},
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const resolvedColor = computed(() => {
	if (props.variant === 'ghost') return 'neutral'
	if (props.variant === 'secondary') return 'primary'
	return 'neutral'
})

const resolvedVariant = computed(() => {
	if (props.variant === 'ghost') return 'ghost'
	if (props.variant === 'secondary') return 'outline'
	return 'solid'
})

const buttonClasses = computed(() => ({
	'landing-btn-primary': props.variant === 'primary',
	'landing-btn-secondary': props.variant === 'secondary',
}))

function onClick(event: MouseEvent) {
	emit('click', event)
}
</script>
