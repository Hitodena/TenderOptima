// Run from services/frontend (Node 22.18+ or 24):
//   node --import ./tests/register-alias.mjs --test "tests/*.test.ts"
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { t } from '../app/constants/translations.ts'
import {
	pluralizeLetters,
	pluralizeSuppliersDative,
	pluralizeSuppliersGenitive,
} from '../shared/utils/textFormat.ts'

// the same assembly the request history card does
function label(sent: number, suppliers: number): string {
	return t(suppliers > 0 ? 'requests.sentLettersStats' : 'requests.sentLettersNoReplies')
		.replace('{sent}', String(sent))
		.replace('{sentLabel}', pluralizeLetters(sent))
		.replace('{suppliers}', String(suppliers))
		.replace('{suppliersLabel}', pluralizeSuppliersGenitive(suppliers))
}

describe('request history letters line', () => {
	it('reads as sent letters and replying suppliers', () => {
		assert.equal(label(11, 7), 'Отправлено 11 писем, получены ответы от 7 поставщиков')
	})

	it('agrees the words with the numbers', () => {
		assert.equal(label(1, 1), 'Отправлено 1 письмо, получены ответы от 1 поставщика')
		assert.equal(label(3, 2), 'Отправлено 3 письма, получены ответы от 2 поставщиков')
		assert.equal(label(21, 21), 'Отправлено 21 письмо, получены ответы от 21 поставщика')
		assert.equal(label(12, 11), 'Отправлено 12 писем, получены ответы от 11 поставщиков')
		assert.equal(label(104, 101), 'Отправлено 104 письма, получены ответы от 101 поставщика')
	})

	it('says there are no replies yet instead of «от 0 поставщиков»', () => {
		assert.equal(label(5, 0), 'Отправлено 5 писем, ответов пока нет')
		assert.equal(label(0, 0), 'Отправлено 0 писем, ответов пока нет')
	})
})

describe('pluralizeSuppliersGenitive', () => {
	it('uses the genitive after «от»', () => {
		const cases: [number, string][] = [
			[0, 'поставщиков'], [1, 'поставщика'], [2, 'поставщиков'], [4, 'поставщиков'],
			[5, 'поставщиков'], [11, 'поставщиков'], [14, 'поставщиков'], [21, 'поставщика'],
			[22, 'поставщиков'], [111, 'поставщиков'], [121, 'поставщика'],
		]
		for (const [n, word] of cases) assert.equal(pluralizeSuppliersGenitive(n), word, String(n))
	})
})

describe('pluralizeSuppliersDative', () => {
	it('uses the dative after «отправлен»', () => {
		const cases: [number, string][] = [
			[0, 'поставщикам'], [1, 'поставщику'], [2, 'поставщикам'], [5, 'поставщикам'],
			[11, 'поставщикам'], [21, 'поставщику'], [101, 'поставщику'], [111, 'поставщикам'],
		]
		for (const [n, word] of cases) assert.equal(pluralizeSuppliersDative(n), word, String(n))
	})
})
