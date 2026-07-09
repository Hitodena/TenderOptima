import { isValidPhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'

import { ConsultationRequestType } from '#shared/types/enums'
import { LANDING_CTA_LABEL } from '#shared/constants/landing'

export const CONSULTATION_REQUEST_TYPE_OPTIONS = [
	{
		value: ConsultationRequestType.DEMO,
		label: 'Показ системы',
		description: 'Покажем продукт на вашем сценарии закупки',
		submitLabel: LANDING_CTA_LABEL,
		modalTitle: LANDING_CTA_LABEL,
		modalDescription: 'Оставьте контакты — менеджер свяжется и предоставит вам доступ.',
		successMessage: 'Заявка отправлена. Мы свяжемся с вами в ближайшее рабочее время.',
	},
	{
		value: ConsultationRequestType.TRIAL,
		label: 'Пробный доступ',
		description: 'Откроем тестовый период после короткого созвона',
		submitLabel: 'Получить пробный доступ',
		modalTitle: 'Получить пробный доступ',
		modalDescription: 'Оставьте контакты — менеджер откроет trial и поможет с первым запуском.',
		successMessage: 'Заявка отправлена. Мы свяжемся с вами для открытия пробного доступа.',
	},
] as const

const CONSULTATION_REQUEST_TYPE_VALUES = new Set<string>(
	Object.values(ConsultationRequestType),
)

export function getConsultationRequestTypeOption(type: ConsultationRequestType) {
	return CONSULTATION_REQUEST_TYPE_OPTIONS.find((option) => option.value === type)
		?? CONSULTATION_REQUEST_TYPE_OPTIONS[0]
}

export const consultationSchema = z.object({
	requestType: z
		.string()
		.refine(
			(value) => CONSULTATION_REQUEST_TYPE_VALUES.has(value),
			'Выберите тип заявки',
		),
	name: z.string().trim().min(2, 'Имя должно содержать минимум 2 символа').max(100, 'Имя слишком длинное'),
	email: z.string().trim().toLowerCase().email('Введите корректный email'),
	phone: z
		.string()
		.min(1, 'Введите номер телефона')
		.refine((value) => isValidPhoneNumber(value), 'Введите корректный номер телефона'),
	consent: z.boolean().refine((value) => value === true, 'Необходимо согласие на обработку данных'),
	agree_marketing: z.boolean().optional(),
	honeypot: z.string().max(0).optional(),
})

export type ConsultationForm = z.infer<typeof consultationSchema>
