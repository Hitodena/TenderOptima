<template>
	<UModal
		v-if="isDesktop"
		v-model:open="isOpen"
		:title="modalCopy.modalTitle"
		:description="modalCopy.modalDescription"
		:ui="{ content: 'max-w-md' }"
	>
		<template #body>
			<ConsultationForm
				ref="formRef"
				:initial-request-type="presetRequestType"
				@success="handleSuccess"
			/>
		</template>
	</UModal>

	<UDrawer
		v-else
		v-model:open="isOpen"
		:title="modalCopy.modalTitle"
		:description="modalCopy.modalDescription"
		:ui="{ container: 'max-h-[90vh] overflow-y-auto' }"
	>
		<template #body>
			<ConsultationForm
				ref="formRef"
				:initial-request-type="presetRequestType"
				@success="handleSuccess"
			/>
		</template>
	</UDrawer>
</template>

<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core'
import { getConsultationRequestTypeOption } from '#shared/schemas/consultation'

const { isOpen, presetRequestType, close } = useConsultationModal()
const isDesktop = useMediaQuery('(min-width: 640px)')
const formRef = ref<{ resetForm: () => void } | null>(null)

const modalCopy = computed(() => getConsultationRequestTypeOption(presetRequestType.value))

watch(isOpen, (val) => {
	if (!val) {
		setTimeout(() => formRef.value?.resetForm(), 300)
	}
})

function handleSuccess() {
	setTimeout(close, 1800)
}
</script>
