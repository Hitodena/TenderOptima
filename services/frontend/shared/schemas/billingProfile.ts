import { z } from 'zod'

export const BILLING_PROFILE_FIELDS = [
	'country',
	'organization_form',
	'inn',
	'organization_name',
	'kpp',
	'ogrn',
	'legal_address',
	'postal_address',
	'director_name',
	'bik',
	'bank_name',
	'settlement_account',
	'correspondent_account',
	'contact_full_name',
	'contact_email',
	'contact_phone',
] as const

export type BillingProfileFormField = (typeof BILLING_PROFILE_FIELDS)[number]

export type BillingProfileForm = Record<BillingProfileFormField, string>

const requiredString = (message = 'Обязательное поле') =>
	z.string().trim().min(1, message)

const optionalString = z.string().optional()

export const billingProfileSchema = z.object({
	country: optionalString,
	organization_form: requiredString(),
	inn: requiredString(),
	organization_name: requiredString(),
	kpp: optionalString,
	ogrn: requiredString(),
	legal_address: requiredString(),
	postal_address: optionalString,
	director_name: optionalString,
	bik: optionalString,
	bank_name: requiredString(),
	settlement_account: requiredString(),
	correspondent_account: optionalString,
	contact_full_name: optionalString,
	contact_email: z
		.string()
		.trim()
		.refine((value) => value === '' || z.string().email().safeParse(value).success, {
			message: 'Неверный формат email',
		})
		.optional(),
	contact_phone: optionalString,
})

export function emptyBillingProfileForm(): BillingProfileForm {
	return {
		country: '',
		organization_form: '',
		inn: '',
		organization_name: '',
		kpp: '',
		ogrn: '',
		legal_address: '',
		postal_address: '',
		director_name: '',
		bik: '',
		bank_name: '',
		settlement_account: '',
		correspondent_account: '',
		contact_full_name: '',
		contact_email: '',
		contact_phone: '',
	}
}
