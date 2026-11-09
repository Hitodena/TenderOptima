/**
 * Helpers for the supplier correspondence feed: split a letter into the new
 * text and the quoted history, build a short preview, group by day and
 * describe attachments and thread state.
 *
 * Quote detection is a display aid only: the full text is always kept and the
 * quoted part is shown behind a toggle, so a missed or wrong marker never
 * loses anything.
 */

export interface SplitLetter {
	/** Text the sender actually wrote in this letter. */
	main: string
	/** Quoted history below it (empty when none was found). */
	quoted: string
}

const SEPARATOR_MARKERS: RegExp[] = [
	// -----Original Message----- / -------- Пересылаемое сообщение --------
	/^\s*-{2,}\s*(original message|исходное сообщение|пересылаемое сообщение|forwarded message|переадресованное сообщение)\s*-{2,}\s*$/i,
	// "On Mon, 3 Nov 2026 at 10:05, Ivan <a@b.ru> wrote:" / "... написал(а):" / "... пишет:"
	/^\s*\S.{0,200}\s(wrote|пишет|написал\(а\)|написала?)\s*:\s*$/i,
	// Gmail (RU): "пн, 3 нояб. 2026 г. в 10:05, Иван <a@b.ru>:"
	/^\s*\S.{0,160}\d{1,2}:\d{2}.{0,80}<[^<>\s]+@[^<>\s]+>\s*:\s*$/,
]

const HEADER_FROM = /^\s*\*?(from|от|отправитель)\s*:\*?\s+\S/i
const HEADER_FOLLOW = /^\s*\*?(sent|date|отправлено|дата|to|кому|subject|тема)\s*:\*?/i
const UNDERSCORE_RULE = /^\s*_{8,}\s*$/

function isOutlookHeader(lines: string[], i: number): boolean {
	if (!HEADER_FROM.test(lines[i] ?? '')) return false
	for (let k = i + 1; k <= i + 4 && k < lines.length; k++) {
		if (HEADER_FOLLOW.test(lines[k] ?? '')) return true
	}
	return false
}

function findQuoteStart(lines: string[]): number {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? ''
		if (SEPARATOR_MARKERS.some(re => re.test(line))) return i
		if (UNDERSCORE_RULE.test(line) && isOutlookHeader(lines, i + 1)) return i
		if (isOutlookHeader(lines, i)) return i
	}
	// trailing block of "> quoted" lines
	let start = -1
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i] ?? ''
		if (!line.trim()) continue
		if (/^\s*>/.test(line)) start = i
		else break
	}
	return start
}

export function splitQuotedReply(body: string | null | undefined): SplitLetter {
	const text = (body ?? '').replace(/\r\n?/g, '\n')
	const lines = text.split('\n')
	const start = findQuoteStart(lines)
	if (start < 0) return { main: text.trim(), quoted: '' }
	const main = lines.slice(0, start).join('\n').trim()
	const quoted = lines.slice(start).join('\n').trim()
	// The marker is at the very top: a pure forward. Show it as is.
	if (!main) return { main: text.trim(), quoted: '' }
	return { main, quoted }
}

const GREETING_WORD = '(?:добрый\\s+(?:день|вечер)|доброе\\s+утро|здравствуй(?:те)?|приветствую|привет|hello|hi|dear|good\\s+(?:morning|afternoon)|уважаем\\S*)'
/** A whole line that is only a greeting: "Здравствуйте, Иван Петрович!" */
const GREETING_LINE = new RegExp(`^${GREETING_WORD}[^\\n]{0,60}$`, 'i')
/** A greeting at the start of a line followed by the text: "Добрый день! Направляем…" */
const GREETING_PREFIX = new RegExp(`^${GREETING_WORD}[^!.\\n]{0,50}[!.,]\\s+`, 'i')

/** One-line preview: new text only, without the greeting and line breaks. */
export function letterPreview(body: string | null | undefined, max = 140): string {
	const { main } = splitQuotedReply(body)
	const lines = main.split('\n').map(l => l.trim())
	while (lines.length > 1 && (!lines[0] || GREETING_LINE.test(lines[0]))) lines.shift()
	if (lines[0]) {
		const stripped = lines[0].replace(GREETING_PREFIX, '')
		if (stripped.trim()) lines[0] = stripped
	}
	let text = lines.join(' ').replace(/\s+/g, ' ').trim()
	if (!text) text = main.replace(/\s+/g, ' ').trim()
	if (text.length <= max) return text
	return `${text.slice(0, max - 1).trimEnd()}…`
}

/** Local calendar day key, e.g. "2026-11-06". */
export function dayKey(iso: string): string {
	const d = new Date(iso)
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "Сегодня", "Вчера", "3 ноября", "3 ноября 2025". */
export function dayLabel(iso: string, now: Date = new Date()): string {
	const d = new Date(iso)
	const today = dayKey(now.toISOString())
	const yesterday = new Date(now)
	yesterday.setDate(now.getDate() - 1)
	const key = dayKey(iso)
	if (key === today) return 'Сегодня'
	if (key === dayKey(yesterday.toISOString())) return 'Вчера'
	const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
	if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
	return d.toLocaleDateString('ru-RU', opts).replace(/\s*г\.$/, '')
}

export type FileTone = 'pdf' | 'sheet' | 'doc' | 'image' | 'archive' | 'other'

export interface FileKind {
	/** Short badge text: PDF, XLSX, DOCX, JPG… */
	label: string
	tone: FileTone
}

export function fileKind(filename: string, contentType?: string | null): FileKind {
	const ext = (filename.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? '').toLowerCase()
	const ct = (contentType ?? '').toLowerCase()
	const label = (ext || ct.split('/')[1] || 'файл').toUpperCase().slice(0, 5)
	if (ext === 'pdf' || ct.includes('pdf')) return { label: 'PDF', tone: 'pdf' }
	if (['xls', 'xlsx', 'xlsm', 'csv', 'ods'].includes(ext) || ct.includes('sheet') || ct.includes('excel'))
		return { label, tone: 'sheet' }
	if (['doc', 'docx', 'rtf', 'odt', 'txt'].includes(ext) || ct.includes('word'))
		return { label, tone: 'doc' }
	if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'bmp', 'tif', 'tiff'].includes(ext) || ct.startsWith('image/'))
		return { label, tone: 'image' }
	if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext) || ct.includes('zip') || ct.includes('compressed'))
		return { label, tone: 'archive' }
	return { label, tone: 'other' }
}

/** Two-letter avatar text from a company name, skipping legal forms and quotes. */
export function companyInitials(name: string): string {
	const LEGAL = /^(ооо|оао|зао|пао|ао|ип|тд|нпо|нпп|чуп|уп|оду|llc|ltd|inc|gmbh)$/i
	const words = name
		.replace(/[«»"'“”„()]/g, ' ')
		.split(/[\s\-–—]+/)
		.filter(w => w && !LEGAL.test(w.replace(/\.$/, '')))
	if (!words.length) return (name.trim()[0] ?? '?').toUpperCase()
	if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
	return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

export type ThreadState = 'failed' | 'new' | 'declined' | 'replied' | 'awaiting' | 'empty'

export interface ThreadLike {
	unread: boolean
	message_count: number
	last_message: { direction: 'incoming' | 'outgoing', kind?: string | null } | null
	delivery_failed?: boolean
	declined?: boolean
}

/**
 * failed   — our letter did not reach the supplier
 * new      — supplier wrote and the letter is not read yet
 * declined — the supplier's latest letter reads like a refusal
 * replied  — the supplier has written at least once (robots don't count),
 *            even if our letter came after
 * awaiting — no letter from the supplier yet
 * empty    — nothing in the thread
 */
export function threadState(t: ThreadLike): ThreadState {
	if (!t.last_message) return 'empty'
	if (t.delivery_failed) return 'failed'
	const robot = t.last_message.kind === 'auto_reply' || t.last_message.kind === 'bounce'
	if (t.unread && t.message_count > 0 && !robot) return 'new'
	if (t.declined) return 'declined'
	if (t.message_count > 0) return 'replied'
	return 'awaiting'
}

export const THREAD_STATE_LABEL: Record<ThreadState, string> = {
	failed: 'Не доставлено',
	new: 'Новый ответ',
	declined: 'Похоже на отказ',
	replied: 'Есть ответ',
	awaiting: 'Ждём ответа',
	empty: 'Нет писем',
}

export interface MessageLike {
	id: string
	direction: 'incoming' | 'outgoing'
}

/**
 * First letter of the supplier's latest run of letters after our last one.
 * Used to draw the "Новое" divider when the thread was unread on open.
 */
export function firstUnansweredIncomingId(messages: MessageLike[]): string | null {
	let id: string | null = null
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i]!
		if (m.direction === 'outgoing') break
		id = m.id
	}
	return id
}
