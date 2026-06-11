export interface RequirementNode {
	text: string
	children: Record<string, RequirementNode>
}

export type RequirementsHierarchy = Record<string, RequirementNode>

export interface EditableRequirementRow {
	key: string
	text: string
	isHeading?: boolean
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
	}
}

function mergeNode(existing: RequirementNode, incoming: RequirementNode): RequirementNode {
	const mergedChildren: Record<string, RequirementNode> = { ...existing.children }
	for (const [key, child] of Object.entries(incoming.children)) {
		if (key in mergedChildren) {
			mergedChildren[key] = mergeNode(mergedChildren[key], child)
		} else {
			mergedChildren[key] = child
		}
	}
	return {
		text: (incoming.text || existing.text || '').trim(),
		children: mergedChildren,
	}
}

function canonicalizeHierarchy(hierarchy: RequirementsHierarchy): RequirementsHierarchy {
	const result: RequirementsHierarchy = {}

	function ensureParentChain(fullKey: string): Record<string, RequirementNode> {
		const segments = fullKey.replace(/\//g, '.').split('.')
		const topKey = segments[0]
		if (!result[topKey]) {
			result[topKey] = { text: '', children: {} }
		}

		let current = result[topKey]
		for (let index = 1; index < segments.length - 1; index++) {
			const path = segments.slice(0, index + 1).join('.')
			if (!current.children[path]) {
				current.children[path] = { text: '', children: {} }
			}
			current = current.children[path]
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

export function normalizeTzRequirements(data: RequirementsHierarchy | null | undefined): RequirementsHierarchy {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
	const normalized: RequirementsHierarchy = {}
	for (const [key, value] of Object.entries(data)) {
		normalized[key] = normalizeNode(value)
	}
	return canonicalizeHierarchy(normalized)
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

function parseFlattenedLine(line: string): EditableRequirementRow {
	const match = line.match(/^([\d./]+)\.\s+([\s\S]*)$/)
	if (match) return { key: match[1], text: match[2] }
	return { key: '', text: line }
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
				rows.push({ key, text: node.text, isHeading: true })
				walk(node.children)
			} else if (node.text) {
				rows.push({ key, text: node.text, isHeading: false })
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
): void {
	const normalizedKey = key.trim().replace(/\//g, '.')
	if (!normalizedKey) return

	const segments = normalizedKey.split('.')
	const topKey = segments[0]

	if (segments.length === 1) {
		root[normalizedKey] = {
			text,
			children: root[normalizedKey]?.children ?? {},
		}
		return
	}

	if (!root[topKey]) {
		root[topKey] = { text: '', children: {} }
	}

	let current = root[topKey]
	let path = topKey

	for (let i = 1; i < segments.length; i++) {
		path = segments.slice(0, i + 1).join('.')
		const children = current.children ?? {}
		current.children = children

		if (i === segments.length - 1) {
			children[path] = {
				text,
				children: children[path]?.children ?? {},
			}
			return
		}

		if (!children[path]) {
			children[path] = { text: '', children: {} }
		}
		current = children[path]
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
		insertNode(result, key, row.text.trim())
	}
	return normalizeTzRequirements(result)
}

export function requirementsRowsNonempty(rows: EditableRequirementRow[]): boolean {
	return rows.some((row) => !row.isHeading && row.text.trim())
}

export function requirementsNonempty(data: RequirementsHierarchy | null | undefined): boolean {
	return flattenHierarchy(normalizeTzRequirements(data)).length > 0
}

export function countRequirementRows(rows: EditableRequirementRow[]): number {
	return rows.filter((row) => !row.isHeading && row.text.trim()).length
}
