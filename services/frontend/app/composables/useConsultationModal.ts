import type { ConsultationRequestType } from '#shared/types/enums'

export function useConsultationModal() {
	const isOpen = useState('consultation-modal-open', () => false)
	const presetRequestType = useState<ConsultationRequestType>(
		'consultation-modal-request-type',
		() => 'demo',
	)

	function open(requestType: ConsultationRequestType = 'demo') {
		presetRequestType.value = requestType
		isOpen.value = true
	}

	function close() {
		isOpen.value = false
	}

	return { isOpen, presetRequestType, open, close }
}
