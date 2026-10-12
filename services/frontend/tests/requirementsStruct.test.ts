// Run from services/frontend (Node 22.18+ or 24):
//   node --import ./tests/register-alias.mjs --test "tests/*.test.ts"
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	blankNumbering,
	buildResultTree,
	buildTreeFromRows,
	countComparedRows,
	countExcludedRows,
	countLeafRequirements,
	countRequirementRows,
	findRequirementLabelByKey,
	flattenRequirementsToEditableRows,
	insertSiblingAfterRow,
	normalizeTzRequirements,
	renumberRequirementRows,
	requirementMark,
	requirementNumberForKey,
	requirementQuoteForKey,
	resolveLetterItemGrouping,
	resolveLetterTzFields,
	requirementsRowsNonempty,
	rowsToHierarchy,
	toggleRowExcluded,
	type EditableRequirementRow,
	type RequirementsHierarchy,
} from '../shared/utils/requirementsStruct.ts'

/** What the server returns for a .docx: keys are positions, numbering is beside the text. */
function wordHierarchy(): RequirementsHierarchy {
	return {
		1: { text: 'ТЕХНИЧЕСКОЕ ЗАДАНИЕ', label: '', number: '', children: {} },
		2: {
			text: 'Общие требования',
			label: '1.',
			number: '1',
			children: {
				'2.1': { text: 'Оборудование должно быть новым.', label: '1.1.', number: '1.1', children: {} },
				'2.2': {
					text: 'Гарантийный срок не менее 24 месяцев:',
					label: '1.2.',
					number: '1.2',
					children: {
						'2.2.1': { text: 'на насос;', label: '1.2.1', number: '1.2.1', children: {} },
						'2.2.2': { text: 'на электродвигатель.', label: '1.2.2', number: '1.2.2', children: {} },
					},
				},
			},
		},
		// the document goes 1., 2., 4.: the gap is the document's, not ours
		3: { text: 'Сроки', label: '4.', number: '4', children: {
			'3.1': { text: 'Поставка за 90 дней', label: '3.', number: '3.1', children: {} },
			'3.2': { text: 'Допуск 3.5 мм', label: '', number: '3.1.1', auto: true, children: {} },
		} },
	}
}

function legacyHierarchy(): RequirementsHierarchy {
	return {
		1: {
			text: 'Общие',
			children: { '1.1': { text: 'Мощность не менее 5 кВт', children: {} } },
		},
	}
}

describe('numbering of points read from Word', () => {
	it('survives normalisation and keeps an empty label', () => {
		const normalized = normalizeTzRequirements(wordHierarchy())
		assert.equal(normalized['1']!.label, '')
		assert.equal(normalized['2']!.children['2.2']!.label, '1.2.')
		assert.equal(normalized['3']!.label, '4.')
		assert.equal(normalized['3']!.children['3.2']!.auto, true)
	})

	it('normalisation is stable, and a leaf keeps quoting its nearest ancestor with text', () => {
		let normalized = normalizeTzRequirements(wordHierarchy())
		for (let pass = 0; pass < 5; pass++) normalized = normalizeTzRequirements(normalized)
		const leaf = normalized['2']!.children['2.2']!.children['2.2.1']!
		assert.equal(leaf.ref, '2.2')
		assert.equal(leaf.ref_value, 'Гарантийный срок не менее 24 месяцев:')
		assert.equal(normalized['2']!.children['2.1']!.ref_value, 'Общие требования')
	})

	it('leaves hierarchies from the model as they were', () => {
		const normalized = normalizeTzRequirements(legacyHierarchy())
		const leaf = normalized['1']!.children['1.1']!
		assert.equal(leaf.ref, '1')
		assert.equal(leaf.ref_value, 'Общие')
		assert.equal('label' in leaf, false)
	})
})

describe('what a row shows as its number', () => {
	it('shows the document mark, or the key when there is none', () => {
		assert.equal(requirementMark({ key: '3.1', label: '1.2.' }), '1.2.')
		assert.equal(requirementMark({ key: '3.1', label: '' }), '')
		assert.equal(requirementMark({ key: '3.1' }), '3.1.')
		assert.equal(requirementMark({ key: '__row_4' }), '')
	})

	it('gives the number to quote, null when the document has none', () => {
		const hierarchy = wordHierarchy()
		assert.equal(requirementNumberForKey(hierarchy, '3'), '4')
		assert.equal(requirementNumberForKey(hierarchy, '2.2.1'), '1.2.1')
		assert.equal(requirementNumberForKey(hierarchy, '1'), null)
		assert.equal(requirementNumberForKey(legacyHierarchy(), '1.1'), '1.1')
		assert.equal(requirementNumberForKey(null, '1.1'), '1.1')
	})

	it('starts a leaf line with its mark from the document and leaves unnumbered text whole', () => {
		const hierarchy = wordHierarchy()
		// the line starts with the mark exactly as the document writes it
		assert.equal(findRequirementLabelByKey(hierarchy, '2.2.1'), '1.2.1 на насос;')
		assert.equal(findRequirementLabelByKey(hierarchy, '3.1'), '3. Поставка за 90 дней')
		assert.equal(findRequirementLabelByKey(hierarchy, '1'), 'ТЕХНИЧЕСКОЕ ЗАДАНИЕ')
		assert.equal(findRequirementLabelByKey(legacyHierarchy(), '1.1'), '1.1. Мощность не менее 5 кВт')
	})
})

describe('the editor', () => {
	it('carries the numbering into rows and back', () => {
		const hierarchy = normalizeTzRequirements(wordHierarchy())
		const rows = flattenRequirementsToEditableRows(hierarchy)
		assert.deepEqual(
			rows.map((row) => [row.key, row.label, row.auto ?? false]),
			[
				['1', '', false],
				['2', '1.', false],
				['2.1', '1.1.', false],
				['2.2', '1.2.', false],
				['2.2.1', '1.2.1', false],
				['2.2.2', '1.2.2', false],
				['3', '4.', false],
				['3.1', '3.', false],
				['3.2', '', true],
			],
		)
		assert.deepEqual(rowsToHierarchy(rows), hierarchy)
	})

	it('renumbers the keys and keeps what the document calls each point', () => {
		const rows = flattenRequirementsToEditableRows(normalizeTzRequirements(wordHierarchy()))
		// the user deletes point 1.1 of the document
		const without = rows.filter((row) => row.label !== '1.1.')
		const renumbered = renumberRequirementRows(without)
		const byLabel = Object.fromEntries(renumbered.map((row) => [row.label, row.key]))
		assert.equal(byLabel['1.2.'], '2.1')
		assert.equal(byLabel['1.2.1'], '2.1.1')
		// the document's own gap (1., 2., 4.) is not closed up
		assert.equal(byLabel['4.'], '3')
		assert.deepEqual(
			renumbered.map((row) => row.label),
			without.map((row) => row.label),
		)
		const back = rowsToHierarchy(renumbered)
		assert.equal(back['2']!.children['2.1']!.label, '1.2.')
		assert.equal(back['3']!.label, '4.')
	})

	it('gives a point the user adds no number, only in a TZ read from Word', () => {
		const wordRows = flattenRequirementsToEditableRows(normalizeTzRequirements(wordHierarchy()))
		const added = insertSiblingAfterRow(wordRows, 1)
		const fresh = added.find((row) => row.text === '' && row.key !== '')!
		assert.equal(fresh.label, '')
		assert.equal(fresh.number, '')
		assert.deepEqual(blankNumbering(wordRows), { label: '', number: '' })

		const legacyRows = flattenRequirementsToEditableRows(normalizeTzRequirements(legacyHierarchy()))
		assert.deepEqual(blankNumbering(legacyRows), {})
		const legacyAdded = insertSiblingAfterRow(legacyRows, 1)
		assert.equal(legacyAdded.some((row) => row.label !== undefined), false)
	})

	it('builds the tree with marks and marks the stand-in for a missing parent as unnumbered', () => {
		const rows: EditableRequirementRow[] = [
			{ key: '1', text: 'Раздел', label: '1.' },
			{ key: '1.2.1', text: 'Пункт', label: '1.2.1' },
		]
		const tree = buildTreeFromRows(rows)
		assert.equal(tree[0]!.label, '1.')
		const standIn = tree[0]!.children[0]!
		assert.equal(standIn.key, '1.2')
		assert.equal(standIn.label, '')
		assert.equal(standIn.children[0]!.label, '1.2.1')
	})
})

describe('results', () => {
	it('puts the document mark on result sections', () => {
		const { sections } = buildResultTree(normalizeTzRequirements(wordHierarchy()), [])
		const general = sections.find((section) => section.key === '2')!
		assert.equal(general.label, '1.')
		assert.equal(sections.find((section) => section.key === '1')!.label, '')
	})
})

describe('points that are not compared', () => {
	/** The title of the document is kept in the list but not compared. */
	function withTitle(): RequirementsHierarchy {
		const hierarchy = wordHierarchy()
		hierarchy['1'] = { ...hierarchy['1']!, excluded: true }
		return hierarchy
	}

	it('are carried through normalisation, rows and back', () => {
		const normalized = normalizeTzRequirements(withTitle())
		assert.equal(normalized['1']!.excluded, true)
		assert.equal('excluded' in normalized['2']!, false)

		const rows = flattenRequirementsToEditableRows(normalized)
		assert.equal(rows[0]!.excluded, true)
		assert.deepEqual(rowsToHierarchy(renumberRequirementRows(rows)), normalized)
	})

	it('are left out of what is compared, but stay in the list', () => {
		const normalized = normalizeTzRequirements(withTitle())
		const rows = flattenRequirementsToEditableRows(normalized)

		// the title is a leaf row; the other leaves are compared
		assert.equal(countRequirementRows(rows), 6)
		assert.equal(countComparedRows(rows), 5)
		assert.equal(countExcludedRows(rows), 1)
		assert.equal(countLeafRequirements(normalized), 5)
		assert.equal(countLeafRequirements(normalizeTzRequirements(wordHierarchy())), 6)
	})

	it('take everything under a marked section along', () => {
		const rows = flattenRequirementsToEditableRows(normalizeTzRequirements(wordHierarchy()))
		const section = rows.findIndex((row) => row.label === '1.')
		const marked = toggleRowExcluded(rows, section)

		// 1.1., 1.2.1, 1.2.2 are no longer compared
		assert.equal(countComparedRows(rows) - countComparedRows(marked), 3)
		assert.equal(countExcludedRows(marked), 3)
		assert.equal(requirementsRowsNonempty(marked), true)
		const tree = buildTreeFromRows(marked)
		const markedNode = tree.find((node) => node.label === '1.')!
		assert.equal(markedNode.excluded, true)
		assert.equal(markedNode.muted, true)
		assert.equal(markedNode.children.every((child) => child.muted === true), true)
		assert.equal(markedNode.children.every((child) => child.excluded === undefined), true)
		assert.equal(tree.find((node) => node.label === '4.')!.muted, undefined)
	})

	it('switch on and off, and nothing left to compare is told', () => {
		const rows = flattenRequirementsToEditableRows(normalizeTzRequirements(wordHierarchy()))
		const index = rows.findIndex((row) => row.label === '1.')
		const once = toggleRowExcluded(rows, index)
		assert.equal(once[index]!.excluded, true)
		assert.deepEqual(toggleRowExcluded(once, index), rows)
		assert.equal(rows[index]!.excluded, undefined, 'the original rows are not changed')
		assert.equal(toggleRowExcluded(rows, 999), rows)

		const everything = rows.reduce(
			(current, row, i) => (row.key.includes('.') ? current : toggleRowExcluded(current, i)),
			rows,
		)
		assert.equal(requirementsRowsNonempty(everything), false)
		assert.equal(countComparedRows(everything), 0)
		assert.equal(countRequirementRows(everything), 6, 'they are still in the list')
	})

	it('keep the key out of it: a similar key is not a child', () => {
		const rows: EditableRequirementRow[] = [
			{ key: '1', text: 'Один', excluded: true },
			{ key: '10', text: 'Десять' },
			{ key: '1.1', text: 'Подпункт один' },
		]
		assert.equal(countComparedRows(rows), 1)
	})
})

describe('quoting a point of a TZ read from Word in a letter', () => {
	it('is the point itself, led by the line above it only when that line introduces it', () => {
		const hierarchy = normalizeTzRequirements(wordHierarchy())
		assert.equal(
			requirementQuoteForKey(hierarchy, '2.2.1'),
			'Гарантийный срок не менее 24 месяцев: на насос;',
		)
		// «Общие требования» is a heading, not an introduction: it does not lead
		assert.equal(requirementQuoteForKey(hierarchy, '2.1'), 'Оборудование должно быть новым.')
		assert.equal(requirementQuoteForKey(hierarchy, '3.2'), 'Допуск 3.5 мм')
		assert.equal(requirementQuoteForKey(hierarchy, '9.9'), null)
		assert.equal(requirementQuoteForKey(normalizeTzRequirements(legacyHierarchy()), '1.1'), null)
	})

	it('puts every point in a letter group of its own', () => {
		const hierarchy = normalizeTzRequirements(wordHierarchy())
		const grouping = resolveLetterItemGrouping(
			{ requirement: '2.2.1. на насос;', requirement_ref: null, ref: '2.2.1', ref_value: null },
			hierarchy,
			'fallback',
		)
		assert.deepEqual(grouping, {
			groupKey: 'ref:2.2.1',
			parentKey: '2.2.1',
			tzVerbatim: 'Гарантийный срок не менее 24 месяцев: на насос;',
			isSplitChild: false,
		})
	})

	it('ignores what the model stored with the item', () => {
		const hierarchy = normalizeTzRequirements(wordHierarchy())
		assert.deepEqual(
			resolveLetterTzFields(
				{
					requirement: '2.2.2. на электродвигатель.',
					ref: '2.2.2',
					ref_value: 'Гарантийный срок не менее 24 месяцев: 2.2.2. на электродвигатель.',
				},
				hierarchy,
			),
			{ ref: '2.2.2', refValue: 'Гарантийный срок не менее 24 месяцев: на электродвигатель.' },
		)
	})
})
