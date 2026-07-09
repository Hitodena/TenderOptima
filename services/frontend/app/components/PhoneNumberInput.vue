<template>
	<UFieldGroup class="w-full">
		<USelectMenu
			v-model="countryCode"
			:items="countries"
			value-key="code"
			:search-input="{ placeholder: 'Поиск страны...', icon: 'i-lucide-search' }"
			:filter-fields="['name', 'code', 'dial']"
			:content="{ align: 'start' }"
			:ui="{ base: 'w-28 shrink-0', content: 'w-64' }"
		>
			<span class="flex items-center gap-1.5">
				<span class="text-base leading-none">{{ selectedCountry?.flag }}</span>
				<span class="text-sm">+{{ selectedCountry?.dial }}</span>
			</span>
			<template #item-leading="{ item }">
				<span class="text-base leading-none">{{ item.flag }}</span>
			</template>
			<template #item-label="{ item }">
				{{ item.name }} (+{{ item.dial }})
			</template>
		</USelectMenu>

		<UInput
			v-model="nationalNumber"
			type="tel"
			inputmode="tel"
			:placeholder="phonePlaceholder"
			icon="i-lucide-phone"
			class="w-full"
			autocomplete="tel"
		/>
	</UFieldGroup>
</template>

<script lang="ts" setup>
import {
	AsYouType,
	getCountryCallingCode,
	parsePhoneNumberFromString,
	type CountryCode,
} from 'libphonenumber-js'

import {
	isPhoneCountryCode,
	PHONE_COUNTRY_CODES,
	PHONE_COUNTRY_PRIORITY,
	PHONE_EXAMPLE_DIGITS,
} from '#shared/constants/phoneCountries'

const props = withDefaults(
	defineProps<{
		modelValue?: string
		defaultCountry?: CountryCode
	}>(),
	{
		modelValue: '',
		defaultCountry: 'BY' as CountryCode,
	},
)

const emit = defineEmits<{
	'update:modelValue': [value: string]
}>()

interface CountryOption {
	code: CountryCode
	name: string
	dial: string
	flag: string
}

function flagEmoji(code: string): string {
	return code
		.toUpperCase()
		.split('')
		.map((char) => String.fromCodePoint(0x1f1e6 - 65 + char.charCodeAt(0)))
		.join('')
}

const displayNames = new Intl.DisplayNames(['ru'], { type: 'region' })

const priorityRank = new Map(
	PHONE_COUNTRY_PRIORITY.map((code, index) => [code, index]),
)

const countries: CountryOption[] = PHONE_COUNTRY_CODES.map((code) => ({
	code,
	name: displayNames.of(code) ?? code,
	dial: getCountryCallingCode(code),
	flag: flagEmoji(code),
})).sort((a, b) => {
	const aRank = priorityRank.get(a.code)
	const bRank = priorityRank.get(b.code)
	if (aRank !== undefined && bRank !== undefined) {
		return aRank - bRank
	}
	if (aRank !== undefined) {
		return -1
	}
	if (bRank !== undefined) {
		return 1
	}
	return a.name.localeCompare(b.name, 'ru')
})

function initialStateFor(value: string): { code: CountryCode; national: string } {
	if (value) {
		try {
			const parsed = parsePhoneNumberFromString(value)
			if (parsed?.country && isPhoneCountryCode(parsed.country)) {
				return { code: parsed.country, national: parsed.formatNational() }
			}
		} catch {
			// fall through to default below
		}
	}
	return { code: props.defaultCountry, national: '' }
}

const initial = initialStateFor(props.modelValue)
const countryCode = ref<CountryCode>(initial.code)
const nationalNumber = ref(initial.national)

const selectedCountry = computed(() =>
	countries.find((country) => country.code === countryCode.value),
)

const phonePlaceholder = computed(() => {
	const digits = PHONE_EXAMPLE_DIGITS[countryCode.value]
	return digits ? new AsYouType(countryCode.value).input(digits) : ''
})

function emitValue() {
	const digits = nationalNumber.value.replace(/\D/g, '')
	if (!digits) {
		emit('update:modelValue', '')
		return
	}
	try {
		const parsed = parsePhoneNumberFromString(digits, countryCode.value)
		emit('update:modelValue', parsed?.number ?? '')
	} catch {
		emit('update:modelValue', '')
	}
}

watch(nationalNumber, (value) => {
	const digits = value.replace(/\D/g, '')
	const formatted = digits ? new AsYouType(countryCode.value).input(digits) : ''
	if (formatted !== value) {
		nationalNumber.value = formatted
		return
	}
	emitValue()
})

watch(countryCode, () => {
	const digits = nationalNumber.value.replace(/\D/g, '')
	nationalNumber.value = digits ? new AsYouType(countryCode.value).input(digits) : ''
	emitValue()
})
</script>
