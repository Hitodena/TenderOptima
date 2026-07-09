<template>
	<UButton
		type="button"
		color="primary"
		variant="soft"
		size="sm"
		leading-icon="i-lucide-paperclip"
		:title="t('inbox.attachFile')"
		@click="emit('click')"
	>
		{{ t('inbox.attachFile') }}
		<UBadge
			v-if="count > 0"
			color="primary"
			variant="solid"
			size="sm"
			class="ml-1"
		>
			{{ count }}
		</UBadge>
	</UButton>
</template>

<script lang="ts" setup>
import { t } from '~/constants/translations'

withDefaults(
	defineProps<{
		count?: number
	}>(),
	{
		count: 0,
	},
)

const emit = defineEmits<{
	click: []
}>()
</script>
