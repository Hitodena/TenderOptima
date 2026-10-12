// Run from services/frontend (Node 22.18+ or 24):
//   node --import ./tests/register-alias.mjs --test "tests/*.test.ts"
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeTzRequirements, type RequirementsHierarchy } from '../shared/utils/requirementsStruct.ts'
import {
	formatLetterRequirementLine,
	formatNumberedRefValue,
	formatShortTzRef,
	formatTzSourceRefLink,
	getTzRequirementDisplay,
	refValueStartsWithKey,
} from '../shared/utils/tzRequirementDisplay.ts'

/** A TZ read from Word: keys are positions, the numbers are the document's own. */
const word: RequirementsHierarchy = normalizeTzRequirements({
	1: { text: 'ТЕХНИЧЕСКОЕ ЗАДАНИЕ', label: '', number: '', children: {} },
	2: {
		text: 'Общие требования',
		label: '1.',
		number: '1',
		children: {
			'2.1': {
				text: 'Гарантийный срок не менее 24 месяцев:',
				label: '1.1.',
				number: '1.1',
				children: {
					'2.1.1': { text: 'на насос;', label: '1.1.1', number: '1.1.1', children: {} },
				},
			},
		},
	},
	// the document goes 1., 4. — the point stays «4»
	3: {
		text: 'Сроки',
		label: '4.',
		number: '4',
		children: {
			'3.1': { text: 'Допуск 3.5 мм', label: '', number: '', children: {} },
		},
	},
})

const legacy: RequirementsHierarchy = normalizeTzRequirements({
	1: { text: 'Общие', children: { '1.1': { text: 'Мощность не менее 5 кВт', children: {} } } },
})

describe('source references to the TZ', () => {
	it('quote the number of the document instead of the internal position', () => {
		assert.equal(
			formatShortTzRef('Источник ТЗ, стр 3, пункт 3', '3', word),
			'Источник ТЗ, стр 3, пункт 4',
		)
		assert.equal(formatShortTzRef(null, '2.1.1', word), 'Источник ТЗ, пункт 1.1.1')
	})

	it('quote only the page for a point the document does not number', () => {
		assert.equal(formatShortTzRef('Источник ТЗ, стр 2, пункт 1', '1', word), 'Источник ТЗ, стр 2')
		assert.equal(formatShortTzRef(null, '1', word), 'Источник ТЗ')
	})

	it('are left as stored for a TZ found by the model', () => {
		assert.equal(
			formatShortTzRef('Источник ТЗ, стр 3, пункт 1.1', '1.1', legacy),
			'Источник ТЗ, стр 3, пункт 1.1',
		)
		assert.equal(formatShortTzRef(null, '1.1', legacy), 'Источник ТЗ, пункт 1.1')
	})

	it('are built from the point the item is about, under its own number', () => {
		const item = {
			requirement: '2.1.1. на насос;',
			requirement_ref: 'Источник ТЗ, пункт 2.1.1',
			ref: '2.1.1',
			ref_value: 'Гарантийный срок не менее 24 месяцев: на насос;',
		}
		assert.equal(formatTzSourceRefLink(item, word), 'Источник ТЗ, пункт 1.1.1')
	})
})

describe('numbers with brackets and letters, as Word documents have', () => {
	const lettered: RequirementsHierarchy = normalizeTzRequirements({
		1: {
			text: 'Требования к документации:',
			label: '4.',
			number: '2.1.4',
			children: {
				'1.1': { text: 'паспорт', label: 'а)', number: '2.1.4 а)', children: {} },
				'1.2': { text: 'Перечень', label: '8 (1)', number: '8 (1)', auto: true, children: {} },
			},
		},
	})

	it('are quoted as they are and never break the line', () => {
		assert.equal(refValueStartsWithKey('2.1.4 а)', 'паспорт'), false)
		assert.equal(refValueStartsWithKey('8 (1)', '8 (1). Перечень'), true)
		assert.equal(formatNumberedRefValue('1.1', 'паспорт', lettered), '2.1.4 а). паспорт')
		assert.equal(formatNumberedRefValue('1.2', 'Перечень', lettered), '8 (1). Перечень')
		assert.equal(formatNumberedRefValue('1.2', '8 (1). Перечень', lettered), '8 (1). Перечень')
		assert.equal(formatShortTzRef(null, '1.1', lettered), 'Источник ТЗ, пункт 2.1.4 а)')
	})
})

describe('lines shown for an analysed requirement', () => {
	const item = {
		requirement: '2.1.1. на насос;',
		requirement_ref: 'Источник ТЗ, пункт 2.1',
		ref: '2.1',
		ref_value: 'Гарантийный срок не менее 24 месяцев:',
	}

	it('start with the number the document gives the point', () => {
		const display = getTzRequirementDisplay(item, word)
		assert.equal(display.analysisText, '1.1.1 на насос;')
		// the original is the point itself, led by the line that introduces it
		assert.equal(display.tzOriginal, 'Гарантийный срок не менее 24 месяцев: на насос;')
	})

	it('do not number a point the document does not number, nor cut its text', () => {
		const display = getTzRequirementDisplay(
			{ requirement: '3.1. Допуск 3.5 мм', requirement_ref: null, ref: null, ref_value: null },
			word,
		)
		assert.equal(display.analysisText, 'Допуск 3.5 мм')
	})

	it('keep the stored line when the point is no longer in the TZ', () => {
		const display = getTzRequirementDisplay(
			{ requirement: '9.9. Старый пункт', requirement_ref: null, ref: null, ref_value: null },
			word,
		)
		assert.equal(display.analysisText, '9.9. Старый пункт')
	})

	it('are unchanged for a TZ found by the model', () => {
		const display = getTzRequirementDisplay(
			{
				requirement: '1.1. Мощность не менее 5 кВт',
				requirement_ref: 'Источник ТЗ, пункт 1',
				ref: '1',
				ref_value: 'Общие',
			},
			legacy,
		)
		assert.equal(display.analysisText, '1. Мощность не менее 5 кВт')
		assert.equal(display.tzOriginal, 'Общие')
	})

	it('quote the point itself in letters, under its own number', () => {
		assert.equal(
			formatLetterRequirementLine(item, word),
			'1.1.1. Гарантийный срок не менее 24 месяцев: на насос;',
		)
		// what the model stored with the item, internal key included, is not used
		assert.equal(
			formatLetterRequirementLine(
				{ ...item, ref_value: 'Гарантийный срок не менее 24 месяцев: 2.1.1. на насос;' },
				word,
			),
			'1.1.1. Гарантийный срок не менее 24 месяцев: на насос;',
		)
		assert.equal(
			formatLetterRequirementLine(
				{ requirement: '1.1. Мощность не менее 5 кВт', ref: '1', ref_value: 'Общие' },
				legacy,
			),
			'1. Общие',
		)
	})
})
