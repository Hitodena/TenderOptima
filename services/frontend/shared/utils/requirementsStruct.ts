/**
 * What a point carries besides its text. For a TZ read from a Word file the
 * key (1, 1.1, 1.2 ...) is only an internal id: it gives the order and
 * nesting, and what the document itself calls the point (label, number) is
 * kept here and never recalculated. Points found by the model have none of
 * the numbering fields; their key is their number.
 */
export interface RequirementMeta {
	/** Mark shown in the row, as in the document ("3.1.", "а)"); "" = none. */
	label?: string
	/** Number to quote in references and letters ("3.1"); "" = none. */
	number?: string
	/** The mark was assigned by the system, not taken from the document. */
	auto?: boolean
	page?: number
	/**
	 * The point stays in the list but is not compared with offers, and neither
	 * is anything under it (the title of the document, a section the customer
	 * does not want compared).
	 */
	excluded?: boolean
}

export interface RequirementNode extends RequirementMeta {
	text: string
	children: Record<string, RequirementNode>
	ref_value?: string
	ref?: string
}

export type RequirementsHierarchy = Record<string, RequirementNode>

export interface EditableRequirementRow extends RequirementMeta {
	key: string
	text: string
	isHeading?: boolean
}

function pickMeta(source: unknown): RequirementMeta {
	if (!source || typeof source !== 'object') return {}
	const record = source as Record<string, unknown>
	const picked: RequirementMeta = {}
	// An empty label/number is kept: it says "no number in the document",
	// which is different from the field being absent.
	if (typeof record.label === 'string') picked.label = record.label.trim()
	if (typeof record.number === 'string') picked.number = record.number.trim()
	if (record.auto === true) picked.auto = true
	if (typeof record.page === 'number' && Number.isInteger(record.page) && record.page > 0) {
		picked.page = record.page
	}
	if (record.excluded === true) picked.excluded = true
	return picked
}

/** True when the points were read from Word with their own numbering. */
export function hierarchyHasNumbering(
	hierarchy: RequirementsHierarchy | null | undefined,
): boolean {
	if (!hierarchy || typeof hierarchy !== 'object') return false
	return Object.values(hierarchy).some((node) => {
		if (!node || typeof node !== 'object') return false
		return node.label !== undefined
			|| node.number !== undefined
			|| hierarchyHasNumbering(node.children)
	})
}

/** Textarea row count from text; trailing empty lines are ignored; minimum 1. */
export function textareaRowsFromText(text: string): number {
	const trimmed = text.replace(/\n+$/, '')
	if (!trimmed) return 1
	return trimmed.split('\n').length
}

export function compareVersionKeys(a: string, b: string): number {
	const partsA = a.replace(/\//g, '.').split('.')
	const partsB = b.replace(/\//g, '.').split('.')
	const len = Math.max(partsA.length, partsB.length)

	for (let i = 0; i < len; i++) {
		const segA = partsA[i]
		const segB = partsB[i]
		if (segA === undefined) return -1
		if (segB === undefined) return 1

		const numA = Number(segA)
		const numB = Number(segB)
		if (!Number.isNaN(numA) && !Number.isNaN(numB) && String(numA) === segA && String(numB) === segB) {
			if (numA !== numB) return numA - numB
			continue
		}
		const cmp = segA.localeCompare(segB)
		if (cmp !== 0) return cmp
	}
	return 0
}

function normalizeNode(node: unknown): RequirementNode {
	if (!node || typeof node !== 'object' || Array.isArray(node)) {
		return { text: '', children: {} }
	}
	const record = node as Record<string, unknown>
	const childrenRaw = record.children
	const children: Record<string, RequirementNode> = {}
	if (childrenRaw && typeof childrenRaw === 'object' && !Array.isArray(childrenRaw)) {
		for (const [key, child] of Object.entries(childrenRaw)) {
			children[key] = normalizeNode(child)
		}
	}
	return {
		text: String(record.text ?? '').trim(),
		children,
		...(String(record.ref_value ?? '').trim()
			? { ref_value: String(record.ref_value).trim() }
			: {}),
		...(String(record.ref ?? '').trim()
			? { ref: normalizeRequirementKey(String(record.ref)) }
			: {}),
		...pickMeta(record),
	}
}

function mergeNode(existing: RequirementNode, incoming: RequirementNode): RequirementNode {
	const mergedChildren: Record<string, RequirementNode> = { ...existing.children }
	for (const [key, child] of Object.entries(incoming.children)) {
		if (key in mergedChildren) {
			mergedChildren[key] = mergeNode(mergedChildren[key]!, child)
		} else {
			mergedChildren[key] = child
		}
	}
	return {
		text: (incoming.text || existing.text || '').trim(),
		children: mergedChildren,
		...(incoming.ref_value || existing.ref_value
			? { ref_value: (incoming.ref_value || existing.ref_value || '').trim() }
			: {}),
		...(incoming.ref || existing.ref
			? { ref: (incoming.ref || existing.ref || '').trim() }
			: {}),
		...pickMeta(existing),
		...pickMeta(incoming),
	}
}

function canonicalizeHierarchy(hierarchy: RequirementsHierarchy): RequirementsHierarchy {
	const result: RequirementsHierarchy = {}

	function ensureParentChain(fullKey: string): Record<string, RequirementNode> {
		const segments = fullKey.replace(/\//g, '.').split('.')
		const topKey = segments[0]
		if (!topKey) return {}

		if (!result[topKey]) {
			result[topKey] = { text: '', children: {} }
		}

		let current = result[topKey]!
		for (let index = 1; index < segments.length - 1; index++) {
			const path = segments.slice(0, index + 1).join('.')
			if (!current.children[path]) {
				current.children[path] = { text: '', children: {} }
			}
			current = current.children[path]!
		}
		return current.children
	}

	for (const key of Object.keys(hierarchy).sort(compareVersionKeys)) {
		const node = normalizeNode(hierarchy[key])
		const keyStr = key.replace(/\//g, '.')
		const segments = keyStr.split('.')

		if (segments.length === 1) {
			if (result[keyStr]) {
				result[keyStr] = mergeNode(result[keyStr], node)
			} else {
				result[keyStr] = node
			}
			continue
		}

		const parentChildren = ensureParentChain(keyStr)
		if (parentChildren[keyStr]) {
			parentChildren[keyStr] = mergeNode(parentChildren[keyStr], node)
		} else {
			parentChildren[keyStr] = node
		}
	}

	return result
}

function parentRequirementKey(key: string): string | null {
	const normalized = normalizeRequirementKey(key)
	const segments = normalized.split('.')
	if (segments.length <= 1) return null
	return segments.slice(0, -1).join('.')
}

function findNodeByKey(
	data: RequirementsHierarchy | null | undefined,
	key: string,
): RequirementNode | null {
	if (!data) return null
	const hierarchy = normalizeTzRequirements(data)
	const normalized = normalizeRequirementKey(key)
	const segments = normalized.split('.')
	const top = segments[0]
	if (!top || !hierarchy[top]) return null

	let current = normalizeNode(hierarchy[top])
	if (segments.length === 1) return current

	for (let index = 1; index < segments.length; index++) {
		const path = segments.slice(0, index + 1).join('.')
		const child = current.children[path]
		if (!child) return null
		current = normalizeNode(child)
	}
	return current
}

function isSplitParent(node: RequirementNode): boolean {
	const children = Object.keys(node.children)
	if (!children.length) return false
	return Boolean(node.ref_value?.trim()) || !node.text.trim()
}

/**
 * ref/ref_value for a hierarchy read from Word, from its structure alone: a
 * leaf quotes the nearest ancestor that has text, a point with children
 * quotes its own text. The same as the server computes, and the same however
 * often it is applied (the general routine below moves the context of a leaf
 * one level up on every pass, which shows in trees deeper than two levels).
 */
function enrichStructuredRefs(hierarchy: RequirementsHierarchy): RequirementsHierarchy {
	function walk(
		nodes: RequirementsHierarchy,
		contextKey: string | null,
		contextText: string,
	): RequirementsHierarchy {
		const result: RequirementsHierarchy = {}
		for (const key of Object.keys(nodes).sort(compareVersionKeys)) {
			const node = normalizeNode(nodes[key])
			const text = node.text.trim()
			const enriched: RequirementNode = { text, children: {} }
			if (Object.keys(node.children).length > 0) {
				enriched.children = text
					? walk(node.children, key, text)
					: walk(node.children, contextKey, contextText)
				if (text) enriched.ref_value = text
			} else if (contextKey && contextText) {
				enriched.ref = contextKey
				enriched.ref_value = contextText
			} else if (text) {
				enriched.ref_value = text
			}
			result[key] = { ...enriched, ...pickMeta(node) }
		}
		return result
	}

	return walk(hierarchy, null, '')
}

function enrichHierarchyRefs(hierarchy: RequirementsHierarchy): RequirementsHierarchy {
	if (hierarchyHasNumbering(hierarchy)) return enrichStructuredRefs(hierarchy)

	function enrichNodes(nodes: RequirementsHierarchy): RequirementsHierarchy {
		const result: RequirementsHierarchy = {}
		for (const key of Object.keys(nodes).sort(compareVersionKeys)) {
			const node = normalizeNode(nodes[key])
			const text = node.text.trim()
			let refValue = node.ref_value?.trim() || ''
			const children = enrichNodes(node.children)
			if (!refValue && text) refValue = text

			const enriched: RequirementNode = { text, children, ...pickMeta(node) }
			if (refValue) enriched.ref_value = refValue
			if (node.ref) enriched.ref = node.ref

			if (isSplitParent(enriched)) {
				const parentRefValue = enriched.ref_value || enriched.text
				if (parentRefValue) enriched.ref_value = parentRefValue
				for (const child of Object.values(children)) {
					if (!child.ref) child.ref = key
					if (parentRefValue) child.ref_value = parentRefValue
				}
			}

			result[key] = enriched
		}
		return result
	}

	return enrichNodes(hierarchy)
}

/**
 * The point as it is quoted in a letter, for a TZ read from Word: the point
 * itself, led by the line above it when that line introduces it with a colon
 * («Гарантийный срок не менее 24 месяцев: на насос;»). A point of such a TZ is
 * a point of the document in its own right, not a part of the line above it.
 * Null for any other hierarchy.
 */
export function requirementQuoteForKey(
	hierarchy: RequirementsHierarchy | null | undefined,
	key: string | null,
): string | null {
	if (!key || !hierarchy || !hierarchyHasNumbering(hierarchy)) return null
	const target = normalizeRequirementKey(key)
	let found: string | null = null

	function walk(nodes: RequirementsHierarchy, lead: string) {
		for (const [nodeKey, node] of Object.entries(nodes)) {
			if (found !== null) return
			const text = (node.text ?? '').split(/\s+/).filter(Boolean).join(' ')
			const children = node.children ?? {}
			if (Object.keys(children).length > 0) {
				// a line that ends with a colon introduces what stands under it
				walk(children, text ? (text.endsWith(':') ? text : '') : lead)
			} else if (text && normalizeRequirementKey(nodeKey) === target) {
				found = lead ? `${lead} ${text}` : text
			}
		}
	}

	walk(hierarchy, '')
	return found
}

export function resolveLetterTzFields(
	item: {
		requirement: string
		ref?: string | null
		ref_value?: string | null
	},
	hierarchy?: RequirementsHierarchy | null,
): { ref: string | null; refValue: string | null } {
	const leafKey = extractRequirementKey(item)
	let ref = item.ref?.trim() || null
	let refValue = item.ref_value?.trim() || null

	// A TZ read from Word: the item is about the point its line starts with,
	// and that point is quoted from the TZ itself (what the model stored with
	// the item may carry internal keys).
	const ownKey = leafKeyFromRequirement(item.requirement) ?? leafKey
	const quote = requirementQuoteForKey(hierarchy, ownKey)
	if (ownKey && quote) return { ref: ownKey, refValue: quote }

	if (hierarchy && leafKey) {
		const node = findNodeByKey(hierarchy, leafKey)
		if (node) {
			ref = ref || node.ref?.trim() || null
			refValue = refValue || node.ref_value?.trim() || null

			if (ref) {
				const parent = findNodeByKey(hierarchy, ref)
				const parentRefValue = parent?.ref_value?.trim() || parent?.text.trim() || null
				if (parentRefValue) refValue = parentRefValue
			} else {
				const parentKey = parentRequirementKey(leafKey)
				if (parentKey) {
					const parent = findNodeByKey(hierarchy, parentKey)
					if (parent && isSplitParent(parent)) {
						ref = parentKey
						refValue = refValue
							|| parent.ref_value?.trim()
							|| parent.text.trim()
							|| null
					}
				}
			}
		}
	}

	if (!refValue && leafKey) {
		const parts = item.requirement.trim().split('. ')
		refValue = parts.length > 1 ? parts.slice(1).join('. ') : item.requirement.trim()
	}
	if (!ref) ref = leafKey

	return { ref, refValue }
}

export type LetterItemGrouping = {
	groupKey: string
	parentKey: string | null
	tzVerbatim: string | null
	isSplitChild: boolean
}

/** Group key and verbatim TZ text for letter sidebar / DOCX (no numbering in tzVerbatim). */
export function resolveLetterItemGrouping(
	item: {
		requirement: string
		requirement_ref: string | null
		ref?: string | null
		ref_value?: string | null
	},
	hierarchy: RequirementsHierarchy | null | undefined,
	fallbackGroupKey: string,
): LetterItemGrouping {
	const leafKey = extractRequirementKey(item)

	// A TZ read from Word: every point stands on its own in the letter, quoted
	// in full; there is no clause above it to group the points under.
	const ownKey = leafKeyFromRequirement(item.requirement) ?? leafKey
	const quote = requirementQuoteForKey(hierarchy, ownKey)
	if (ownKey && quote) {
		return {
			groupKey: `ref:${ownKey}`,
			parentKey: ownKey,
			tzVerbatim: quote,
			isSplitChild: false,
		}
	}

	if (leafKey && hierarchy) {
		const parentKey = parentRequirementKey(leafKey)
		if (parentKey) {
			const parent = findNodeByKey(hierarchy, parentKey)
			if (parent && isSplitParent(parent)) {
				const tzVerbatim = parent.ref_value?.trim()
					|| parent.text.trim()
					|| null
				return {
					groupKey: `parent:${parentKey}`,
					parentKey,
					tzVerbatim,
					isSplitChild: true,
				}
			}
		}
	}

	const { ref, refValue } = resolveLetterTzFields(item, hierarchy)
	if (ref) {
		return {
			groupKey: `ref:${ref}`,
			parentKey: ref,
			tzVerbatim: refValue,
			isSplitChild: false,
		}
	}

	return {
		groupKey: fallbackGroupKey,
		parentKey: leafKey,
		tzVerbatim: refValue,
		isSplitChild: false,
	}
}

export function normalizeTzRequirements(data: RequirementsHierarchy | null | undefined): RequirementsHierarchy {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
	const normalized: RequirementsHierarchy = {}
	for (const [key, value] of Object.entries(data)) {
		normalized[key] = normalizeNode(value)
	}
	return enrichHierarchyRefs(canonicalizeHierarchy(normalized))
}

export function normalizeRequirementsKp(
	data: Record<string, RequirementsHierarchy> | null | undefined,
): Record<string, RequirementsHierarchy> {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
	const result: Record<string, RequirementsHierarchy> = {}
	for (const [name, items] of Object.entries(data)) {
		result[name] = normalizeTzRequirements(items)
	}
	return result
}

export function flattenHierarchy(hierarchy: RequirementsHierarchy): string[] {
	const result: string[] = []

	function walk(nodes: RequirementsHierarchy) {
		for (const key of Object.keys(nodes).sort(compareVersionKeys)) {
			const node = normalizeNode(nodes[key])
			// not compared, together with everything under it
			if (node.excluded) continue
			const children = node.children
			const hasChildren = Object.keys(children).length > 0
			if (hasChildren) {
				walk(children)
			} else if (node.text) {
				result.push(`${key}. ${node.text}`)
			}
		}
	}

	walk(hierarchy)
	return result
}

export function countLeafRequirements(
	data: RequirementsHierarchy | null | undefined,
): number {
	return flattenHierarchy(normalizeTzRequirements(data)).length
}


export function flattenRequirementsToEditableRows(
	data: RequirementsHierarchy | null | undefined,
): EditableRequirementRow[] {
	const rows: EditableRequirementRow[] = []
	const hierarchy = normalizeTzRequirements(data)

	function walk(nodes: RequirementsHierarchy) {
		for (const key of Object.keys(nodes).sort(compareVersionKeys)) {
			const node = normalizeNode(nodes[key])
			const hasChildren = Object.keys(node.children).length > 0
			if (hasChildren) {
				rows.push({ key, text: node.text, isHeading: true, ...pickMeta(node) })
				walk(node.children)
			} else if (node.text) {
				rows.push({ key, text: node.text, isHeading: false, ...pickMeta(node) })
			}
		}
	}

	walk(hierarchy)
	return rows
}

export function flattenRequirementsToRows(
	data: RequirementsHierarchy | null | undefined,
): EditableRequirementRow[] {
	return flattenRequirementsToEditableRows(data)
}

function insertNode(
	root: RequirementsHierarchy,
	key: string,
	text: string,
	numbering: RequirementMeta = {},
): void {
	const normalizedKey = key.trim().replace(/\//g, '.')
	if (!normalizedKey) return

	const segments = normalizedKey.split('.')
	const topKey = segments[0]
	if (!topKey) return

	if (segments.length === 1) {
		root[normalizedKey] = {
			text,
			children: root[normalizedKey]?.children ?? {},
			...numbering,
		}
		return
	}

	if (!root[topKey]) {
		root[topKey] = { text: '', children: {} }
	}

	let current = root[topKey]!
	let path = topKey

	for (let i = 1; i < segments.length; i++) {
		path = segments.slice(0, i + 1).join('.')
		const children = current.children ?? {}
		current.children = children

		if (i === segments.length - 1) {
			children[path] = {
				text,
				children: children[path]?.children ?? {},
				...numbering,
			}
			return
		}

		if (!children[path]) {
			children[path] = { text: '', children: {} }
		}
		current = children[path]!
	}
}

export function rowsToHierarchy(rows: EditableRequirementRow[]): RequirementsHierarchy {
	const result: RequirementsHierarchy = {}
	const sorted = [...rows]
		.filter((row) => row.isHeading || row.text.trim())
		.sort((a, b) => compareVersionKeys(a.key || 'z', b.key || 'z'))

	let nextTop = 1
	for (const row of sorted) {
		let key = row.key.trim()
		if (!key) {
			if (row.isHeading) continue
			key = String(nextTop)
			nextTop += 1
		} else if (!key.includes('.') && !key.includes('/')) {
			const num = Number(key)
			if (!Number.isNaN(num)) nextTop = Math.max(nextTop, num + 1)
		}
		insertNode(result, key, row.text.trim(), pickMeta(row))
	}
	return normalizeTzRequirements(result)
}

/**
 * Numbering fields for a row the user adds. In a hierarchy read from Word a
 * new point has no number in the document, so it gets an empty mark rather
 * than a made-up one; points found by the model keep using their key.
 */
export function blankNumbering(rows: EditableRequirementRow[]): RequirementMeta {
	return rows.some((row) => row.label !== undefined) ? { label: '', number: '' } : {}
}

export function nextTopLevelKey(rows: EditableRequirementRow[]): string {
	const maxTop = rows.reduce((max, row) => {
		const top = Number(row.key.split(/[./]/)[0])
		return Number.isNaN(top) ? max : Math.max(max, top)
	}, 0)
	return String(maxTop + 1)
}

export function nextChildKey(
	parentKey: string,
	rows: EditableRequirementRow[],
): string {
	const prefix = `${parentKey}.`
	const directChildren = rows.filter((row) => {
		if (!row.key.startsWith(prefix)) return false
		const rest = row.key.slice(prefix.length)
		return rest.length > 0 && !rest.includes('.') && !rest.includes('/')
	})
	const maxChild = directChildren.reduce((max, row) => {
		const suffix = row.key.slice(prefix.length)
		const num = Number(suffix)
		return !Number.isNaN(num) ? Math.max(max, num) : max
	}, 0)
	return `${parentKey}.${maxChild + 1}`
}

/** Keys of the rows marked «не сравнивать». */
function markedKeys(rows: EditableRequirementRow[]): string[] {
	return rows.filter((row) => row.excluded).map((row) => normalizeRequirementKey(row.key))
}

/** True for a key marked itself or lying under a marked one: a section takes its points along. */
function isKeyExcluded(key: string, marked: string[]): boolean {
	if (marked.length === 0) return false
	const normalized = normalizeRequirementKey(key)
	return marked.some((m) => normalized === m || normalized.startsWith(`${m}.`))
}

function isRequirementRow(row: EditableRequirementRow): boolean {
	return !row.isHeading && Boolean(row.text.trim())
}

/** At least one row that is compared with offers. */
export function requirementsRowsNonempty(rows: EditableRequirementRow[]): boolean {
	const marked = markedKeys(rows)
	return rows.some((row) => isRequirementRow(row) && !isKeyExcluded(row.key, marked))
}

export function requirementsNonempty(data: RequirementsHierarchy | null | undefined): boolean {
	return flattenHierarchy(normalizeTzRequirements(data)).length > 0
}

/** All rows holding a requirement text, compared or not. */
export function countRequirementRows(rows: EditableRequirementRow[]): number {
	return rows.filter(isRequirementRow).length
}

/** Rows that are compared with offers. */
export function countComparedRows(rows: EditableRequirementRow[]): number {
	const marked = markedKeys(rows)
	return rows.filter((row) => isRequirementRow(row) && !isKeyExcluded(row.key, marked)).length
}

/** Rows kept in the list but not compared, either marked or lying under a marked section. */
export function countExcludedRows(rows: EditableRequirementRow[]): number {
	return countRequirementRows(rows) - countComparedRows(rows)
}

/** Switch a row between «compared» and «не сравнивать»; a section takes its points along. */
export function toggleRowExcluded(
	rows: EditableRequirementRow[],
	index: number,
): EditableRequirementRow[] {
	if (!rows[index]) return rows
	return rows.map((row, i) => {
		if (i !== index) return row
		const { excluded, ...rest } = row
		return excluded ? rest : { ...rest, excluded: true }
	})
}

export interface RequirementTreeNode {
	key: string
	text: string
	isHeading: boolean
	rowIndex?: number
	/** Mark from the document (see `RequirementMeta`); absent = show the key. */
	label?: string
	auto?: boolean
	/** Marked «не сравнивать» itself. */
	excluded?: boolean
	/** Not compared: marked itself or lying under a marked section. */
	muted?: boolean
	children: RequirementTreeNode[]
}

export interface MatchableAnalysisItem {
	requirement: string
	requirement_ref: string | null
	offer_value: string | null
	offer_ref: string | null
	explanation: string
	status: 'met' | 'partial' | 'missing' | 'not_found'
	kp_name?: string | null
	_index: number
}

export interface ResultTreeNode {
	key: string
	text: string
	isHeading: boolean
	label?: string
	auto?: boolean
	children: ResultTreeNode[]
	items: MatchableAnalysisItem[]
}

/**
 * What to show in the number column of a row: the mark the document has
 * (possibly empty), or the key for points found by the model.
 */
export function requirementMark(node: { key: string; label?: string }): string {
	if (node.label !== undefined) return node.label
	if (node.key.startsWith('__row_')) return ''
	return `${node.key}.`
}

function normalizeRequirementKey(key: string): string {
	return key.trim().replace(/\//g, '.')
}

export function isTopLevelSectionKey(key: string): boolean {
	return !normalizeRequirementKey(key).includes('.')
}

function sortTreeNodes<T extends { key: string; children: T[] }>(nodes: T[]) {
	nodes.sort((a, b) => compareVersionKeys(a.key, b.key))
	for (const node of nodes) sortTreeNodes(node.children)
}

export function buildTreeFromRows(
	rows: EditableRequirementRow[],
	options?: { sort?: boolean },
): RequirementTreeNode[] {
	const nodeByKey = new Map<string, RequirementTreeNode>()
	const roots: RequirementTreeNode[] = []
	const hasDocumentNumbering = rows.some((row) => row.label !== undefined)

	function attachToParent(node: RequirementTreeNode) {
		if (node.key.startsWith('__row_')) {
			if (!roots.some((root) => root.key === node.key)) roots.push(node)
			return
		}

		const parentKey = parentRequirementKey(node.key)
		if (!parentKey) {
			if (!roots.some((root) => root.key === node.key)) roots.push(node)
			return
		}

		let parent = nodeByKey.get(parentKey)
		if (!parent) {
			parent = {
				key: parentKey,
				text: '',
				isHeading: true,
				// a stand-in for a missing parent has no number of its own
				...(hasDocumentNumbering ? { label: '' } : {}),
				children: [],
			}
			nodeByKey.set(parentKey, parent)
			attachToParent(parent)
		}

		if (!parent.children.some((child) => child.key === node.key)) {
			parent.children.push(node)
		}
		if (!parent.isHeading) parent.isHeading = true
	}

	for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
		const row = rows[rowIndex]
		if (!row) continue
		if (!row.isHeading && !row.text.trim() && !row.key.trim()) continue

		const key = normalizeRequirementKey(row.key) || `__row_${rowIndex}`

		const node: RequirementTreeNode = {
			key,
			text: row.text,
			isHeading: Boolean(row.isHeading),
			rowIndex,
			...(row.label !== undefined ? { label: row.label } : {}),
			...(row.auto ? { auto: true } : {}),
			...(row.excluded ? { excluded: true } : {}),
			children: [],
		}
		nodeByKey.set(key, node)
		attachToParent(node)
	}

	if (options?.sort !== false) {
		sortTreeNodes(roots)
	}
	markNotCompared(roots, false)
	return roots
}

/** A section marked «не сравнивать» takes everything under it along. */
function markNotCompared(nodes: RequirementTreeNode[], inherited: boolean) {
	for (const node of nodes) {
		const notCompared = inherited || Boolean(node.excluded)
		if (notCompared) node.muted = true
		markNotCompared(node.children, notCompared)
	}
}

export function isDescendantRowKey(key: string, ancestorKey: string): boolean {
	const normalized = normalizeRequirementKey(key)
	const ancestor = normalizeRequirementKey(ancestorKey)
	return normalized.startsWith(`${ancestor}.`)
}

/** Inclusive row index range for a node and all nested rows (preorder flat list). */
export function getRowSubtreeRange(
	rows: EditableRequirementRow[],
	rowIndex: number,
): [number, number] {
	const key = normalizeRequirementKey(rows[rowIndex]?.key ?? '')
	if (!key || key.startsWith('__row_')) return [rowIndex, rowIndex]

	let end = rowIndex
	for (let i = rowIndex + 1; i < rows.length; i++) {
		const rowKey = normalizeRequirementKey(rows[i]?.key ?? '')
		if (isDescendantRowKey(rowKey, key)) {
			end = i
		} else {
			break
		}
	}
	return [rowIndex, end]
}

export function canReorderRequirementRows(
	rows: EditableRequirementRow[],
	fromIndex: number,
	toIndex: number,
): boolean {
	if (fromIndex === toIndex) return false
	const fromRow = rows[fromIndex]
	const toRow = rows[toIndex]
	if (!fromRow || !toRow) return false

	const fromParent = parentRequirementKey(fromRow.key)
	const toParent = parentRequirementKey(toRow.key)
	if (fromParent !== toParent) return false

	const [, fromEnd] = getRowSubtreeRange(rows, fromIndex)
	if (toIndex > fromIndex && toIndex <= fromEnd) return false

	return true
}

export function moveRequirementRowBlock(
	rows: EditableRequirementRow[],
	fromIndex: number,
	toIndex: number,
): EditableRequirementRow[] {
	if (!canReorderRequirementRows(rows, fromIndex, toIndex)) return rows

	const [fromStart, fromEnd] = getRowSubtreeRange(rows, fromIndex)
	const block = rows.slice(fromStart, fromEnd + 1)
	const without = [...rows.slice(0, fromStart), ...rows.slice(fromEnd + 1)]

	const [targetStart, targetEnd] = getRowSubtreeRange(rows, toIndex)
	let insertAt = targetStart
	if (fromStart < targetStart) {
		insertAt = targetEnd - block.length + 1
	}

	without.splice(insertAt, 0, ...block)
	return without
}

/**
 * A brand-new sibling row with a blank key/text is invisible: `buildTreeFromRows`
 * drops any row that has no key, no text, and isn't a heading (see its skip
 * condition), so it would never be picked up by the following
 * `renumberRequirementRows` pass and would silently disappear. Assigning it a
 * real (temporary, non-colliding) key in the same parent scope keeps it in the
 * tree immediately; the exact numeric value doesn't matter since
 * `renumberRequirementRows` reassigns sequential keys from array order right
 * after insertion.
 */
function siblingPlaceholderKey(
	rows: EditableRequirementRow[],
	anchorIndex: number,
): string {
	const anchorKey = normalizeRequirementKey(rows[anchorIndex]?.key ?? '')
	const parentKey = parentRequirementKey(anchorKey)
	return parentKey ? nextChildKey(parentKey, rows) : nextTopLevelKey(rows)
}

export function insertSiblingAfterRow(
	rows: EditableRequirementRow[],
	afterIndex: number,
	options?: { isHeading?: boolean },
): EditableRequirementRow[] {
	const [, end] = getRowSubtreeRange(rows, afterIndex)
	const next = [...rows]
	next.splice(end + 1, 0, {
		key: siblingPlaceholderKey(rows, afterIndex),
		text: '',
		isHeading: options?.isHeading,
		...blankNumbering(rows),
	})
	return next
}

export function insertSiblingBeforeRow(
	rows: EditableRequirementRow[],
	beforeIndex: number,
	options?: { isHeading?: boolean },
): EditableRequirementRow[] {
	const [start] = getRowSubtreeRange(rows, beforeIndex)
	const next = [...rows]
	next.splice(start, 0, {
		key: siblingPlaceholderKey(rows, beforeIndex),
		text: '',
		isHeading: options?.isHeading,
		...blankNumbering(rows),
	})
	return next
}

/**
 * Insert a new child row immediately after the parent row (as first child),
 * so it appears at the top of the parent's children list instead of appended
 * at the end of the flat array.
 *
 * The new row is given the key that `nextChildKey` would assign for the parent,
 * so the tree builder knows it belongs to the parent. After insertion the caller
 * should run `renumberRequirementRows` to reassign all keys in tree order.
 */
export function insertChildAfterParentRow(
	rows: EditableRequirementRow[],
	parentKey: string,
	options?: { isHeading?: boolean },
): EditableRequirementRow[] {
	const normalizedParent = parentKey.trim().replace(/\//g, '.')
	const parentIndex = rows.findIndex(
		(row) => normalizeRequirementKey(row.key) === normalizedParent,
	)
	const childKey = nextChildKey(parentKey, rows)
	const numbering = blankNumbering(rows)
	if (parentIndex === -1) {
		return [
			...rows,
			{ key: childKey, text: '', isHeading: options?.isHeading, ...numbering },
		]
	}
	const next = [...rows]
	next.splice(parentIndex + 1, 0, {
		key: childKey,
		text: '',
		isHeading: options?.isHeading,
		...numbering,
	})
	return next
}

/** Reassign sequential keys (1, 2, 1.1, …) from current tree order after add/remove. */
export function renumberRequirementRows(
	rows: EditableRequirementRow[],
): EditableRequirementRow[] {
	const tree = buildTreeFromRows(rows, { sort: false })
	const updated = rows.map((row) => ({ ...row }))

	function walk(nodes: RequirementTreeNode[], parentKey: string | null) {
		for (const [index, node] of nodes.entries()) {
			const newKey = parentKey === null
				? String(index + 1)
				: `${parentKey}.${index + 1}`

			if (node.rowIndex !== undefined) {
				updated[node.rowIndex]!.key = newKey
			}

			if (node.children.length > 0) {
				walk(node.children, newKey)
			}
		}
	}

	walk(tree, null)
	return updated
}

function collectHierarchyKeys(hierarchy: RequirementsHierarchy): Set<string> {
	const keys = new Set<string>()

	function walk(nodes: RequirementsHierarchy) {
		for (const key of Object.keys(nodes)) {
			keys.add(normalizeRequirementKey(key))
			walk(normalizeNode(nodes[key]).children)
		}
	}

	walk(hierarchy)
	return keys
}

export function extractRequirementKey(item: {
	requirement_ref: string | null
	requirement: string
	ref?: string | null
}): string | null {
	if (item.ref?.trim()) return normalizeRequirementKey(item.ref.trim())

	if (item.requirement_ref) {
		const refMatch = item.requirement_ref.match(/п\.\s*([\d./]+)/i)
		if (refMatch?.[1]) return normalizeRequirementKey(refMatch[1])
	}

	const reqMatch = item.requirement.match(/^([\d./]+)\.\s/)
	if (reqMatch?.[1]) return normalizeRequirementKey(reqMatch[1])

	return null
}

/** Key a flattened requirement line starts with: «1.2.1. text» -> 1.2.1. */
export function leafKeyFromRequirement(requirement: string): string | null {
	const match = requirement.trim().match(/^(\d+(?:[./]\d+)*)\.\s/)
	return match?.[1] ? normalizeRequirementKey(match[1]) : null
}

/** The line without the key it starts with; text that merely starts with a digit stays whole. */
export function stripLeadingKey(requirement: string): string {
	return requirement.trim().replace(/^\d+(?:[./]\d+)*\.\s+/, '')
}

/**
 * Number to quote for a point in references and letters, or null when the
 * document does not number it. For points found by the model that is the key;
 * for points read from Word it is the number the document gives them (the
 * key is then only an internal position).
 */
export function requirementNumberForKey(
	data: RequirementsHierarchy | null | undefined,
	key: string | null,
): string | null {
	if (!key) return null
	const normalizedKey = normalizeRequirementKey(key)
	if (!hierarchyHasNumbering(data)) return normalizedKey
	return referenceNumber(findNodeByKey(data, normalizedKey), normalizedKey)
}

function referenceNumber(node: RequirementNode | null, key: string): string | null {
	if (!node) return key
	if (node.number !== undefined) return node.number || null
	if (node.label !== undefined) return node.label.replace(/[.)]+$/, '') || null
	return key
}

/** «number. text», or just the text when the point has no number. */
export function formatNumberedText(number: string | null, text: string): string {
	return number ? `${number}. ${text}` : text
}

/**
 * The mark a line of a TZ read from Word starts with: as the document writes
 * it («1.2.1», «а)», «3.»); a number the system assigned gets the closing dot.
 * Inside its section the mark is enough, so the number that is quoted in
 * references («1 (Приложение 1)») is not used here.
 */
function lineMark(node: RequirementNode, key: string): string {
	if (node.auto && node.number) return `${node.number}.`
	if (node.label) return node.label
	if (node.label !== undefined) return ''
	return node.number ? `${node.number}.` : `${key}.`
}

/** Leaf requirement line from confirmed TZ hierarchy: «mark text», «key. text» for points found by the model. */
export function findRequirementLabelByKey(
	data: RequirementsHierarchy | null | undefined,
	key: string | null,
): string | null {
	if (!key) return null
	const hierarchy = normalizeTzRequirements(data)
	const targetKey = normalizeRequirementKey(key)
	const structured = hierarchyHasNumbering(hierarchy)

	function walk(nodes: RequirementsHierarchy): string | null {
		for (const nodeKey of Object.keys(nodes).sort(compareVersionKeys)) {
			const node = normalizeNode(nodes[nodeKey])
			const nk = normalizeRequirementKey(nodeKey)
			const hasChildren = Object.keys(node.children).length > 0
			if (hasChildren) {
				const found = walk(node.children)
				if (found) return found
			} else if (nk === targetKey && node.text.trim()) {
				if (!structured) return formatNumberedText(nk, node.text.trim())
				const mark = lineMark(node, nk)
				return mark ? `${mark} ${node.text.trim()}` : node.text.trim()
			}
		}
		return null
	}

	return walk(hierarchy)
}

export function buildResultTree(
	hierarchy: RequirementsHierarchy | null | undefined,
	items: MatchableAnalysisItem[],
): { sections: ResultTreeNode[]; unmapped: MatchableAnalysisItem[] } {
	const normalized = normalizeTzRequirements(hierarchy)
	const hierarchyKeys = collectHierarchyKeys(normalized)
	const itemsByKey = new Map<string, MatchableAnalysisItem[]>()
	const unmapped: MatchableAnalysisItem[] = []

	for (const item of items) {
		const key = extractRequirementKey(item)
		if (!key || !hierarchyKeys.has(key)) {
			unmapped.push(item)
			continue
		}
		const bucket = itemsByKey.get(key) ?? []
		bucket.push(item)
		itemsByKey.set(key, bucket)
	}

	function walk(nodes: RequirementsHierarchy): ResultTreeNode[] {
		const sections: ResultTreeNode[] = []

		for (const key of Object.keys(nodes).sort(compareVersionKeys)) {
			const node = normalizeNode(nodes[key])
			const normalizedKey = normalizeRequirementKey(key)
			const children = walk(node.children)
			const nodeItems = itemsByKey.get(normalizedKey) ?? []
			const hasChildren = Object.keys(node.children).length > 0
			const isHeading = hasChildren || (!node.text && children.length > 0)

			if (!hasChildren && nodeItems.length === 0 && !node.text) continue

			sections.push({
				key: normalizedKey,
				text: node.text,
				isHeading: hasChildren || isHeading,
				...(node.label !== undefined ? { label: node.label } : {}),
				...(node.auto ? { auto: true } : {}),
				children,
				items: nodeItems,
			})
		}

		return sections
	}

	return {
		sections: walk(normalized),
		unmapped,
	}
}
