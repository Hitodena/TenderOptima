import { isValidPhoneNumber } from 'libphonenumber-js'
import { z } from 'zod'

export const cooperationInviteSchema = z.object({
	name: z.string().trim().min(2, 'Имя должно содержать минимум 2 символа').max(100, 'Имя слишком длинное'),
	email: z.string().trim().toLowerCase().email('Введите корректный email'),
	phone: z
		.string()
		.min(1, 'Введите номер телефона')
		.refine((value) => isValidPhoneNumber(value), 'Введите корректный номер телефона'),
	company: z.string().trim().max(150, 'Название компании слишком длинное').optional(),
	industry: z
		.string()
		.trim()
		.min(2, 'Укажите сферу отрасли')
		.max(150, 'Сфера отрасли слишком длинная'),
	comment: z.string().trim().max(1000, 'Комментарий слишком длинный').optional(),
	consent: z.boolean().refine((value) => value === true, 'Необходимо согласие на обработку данных'),
	agree_marketing: z.boolean().optional(),
	honeypot: z.string().max(0).optional(),
})

export type CooperationInviteForm = z.infer<typeof cooperationInviteSchema>
