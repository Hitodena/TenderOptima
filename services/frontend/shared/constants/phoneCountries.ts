import type { CountryCode } from 'libphonenumber-js'

/** Shown first in the phone country selector. */
export const PHONE_COUNTRY_PRIORITY: CountryCode[] = ['BY', 'RU', 'KZ']

/** CIS and nearby markets — enough for current B2B audience. */
export const PHONE_COUNTRY_CODES: CountryCode[] = [
	...PHONE_COUNTRY_PRIORITY,
	'AM',
	'AZ',
	'GE',
	'KG',
	'MD',
	'TJ',
	'TM',
	'UZ',
]

const PHONE_COUNTRY_CODE_SET = new Set<string>(PHONE_COUNTRY_CODES)

export function isPhoneCountryCode(code: string): code is CountryCode {
	return PHONE_COUNTRY_CODE_SET.has(code)
}

/** Sample national digits for placeholder masks via libphonenumber AsYouType. */
export const PHONE_EXAMPLE_DIGITS: Partial<Record<CountryCode, string>> = {
	BY: '291234567',
	RU: '9001234567',
	KZ: '7001234567',
	AM: '77123456',
	AZ: '501234567',
	GE: '555123456',
	KG: '700123456',
	MD: '69123456',
	TJ: '917123456',
	TM: '66123456',
	UZ: '901234567',
}
