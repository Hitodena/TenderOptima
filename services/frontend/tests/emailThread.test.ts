// Run from services/frontend (Node 22.18+ or 24):
//   node --import ./tests/register-alias.mjs --test "tests/*.test.ts"
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	companyInitials,
	dayLabel,
	fileKind,
	firstUnansweredIncomingId,
	letterPreview,
	splitQuotedReply,
	threadState,
} from '../shared/utils/emailThread.ts'

describe('splitQuotedReply', () => {
	it('keeps a letter without a quote whole', () => {
		const r = splitQuotedReply('Добрый день!\nКП во вложении.')
		assert.equal(r.main, 'Добрый день!\nКП во вложении.')
		assert.equal(r.quoted, '')
	})

	it('handles empty and null bodies', () => {
		assert.deepEqual(splitQuotedReply(null), { main: '', quoted: '' })
		assert.deepEqual(splitQuotedReply(''), { main: '', quoted: '' })
	})

	it('cuts at -----Original Message-----', () => {
		const r = splitQuotedReply('Цена снижена.\n\n-----Original Message-----\nFrom: Вы\nПросим снизить цену')
		assert.equal(r.main, 'Цена снижена.')
		assert.match(r.quoted, /^-----Original Message-----/)
		assert.match(r.quoted, /Просим снизить цену/)
	})

	it('cuts at the Russian forward separator', () => {
		const r = splitQuotedReply('Смотрите ниже.\n-------- Пересылаемое сообщение --------\nтекст')
		assert.equal(r.main, 'Смотрите ниже.')
	})

	it('cuts at a Gmail RU attribution line', () => {
		const r = splitQuotedReply('Готовы на 10 дней.\n\nпн, 3 нояб. 2026 г. в 10:05, Закупки <buy@company.ru>:\n> Просим КП')
		assert.equal(r.main, 'Готовы на 10 дней.')
		assert.match(r.quoted, /Просим КП/)
	})

	it('cuts at an English "wrote:" line', () => {
		const r = splitQuotedReply('OK.\nOn Mon, Nov 3, 2026 at 10:05 AM Buyer <b@x.com> wrote:\n> hi')
		assert.equal(r.main, 'OK.')
	})

	it('cuts at a Russian "пишет:" line', () => {
		const r = splitQuotedReply('Да.\n03.11.2026 10:05, Иван Петров пишет:\n> вопрос')
		assert.equal(r.main, 'Да.')
	})

	it('cuts at an Outlook header block (От / Отправлено)', () => {
		const r = splitQuotedReply('Спасибо.\n\nОт: Закупки <b@x.ru>\nОтправлено: 3 ноября 2026 г. 10:05\nКому: sales@y.ru\nТема: КП')
		assert.equal(r.main, 'Спасибо.')
		assert.match(r.quoted, /^От: Закупки/)
	})

	it('cuts at an Outlook underscore rule followed by From', () => {
		const r = splitQuotedReply('Ок.\n________________________________\nFrom: Buyer\nSent: Monday\nSubject: RFQ')
		assert.equal(r.main, 'Ок.')
		assert.match(r.quoted, /^_{8,}/)
	})

	it('does not treat a lone "От:" line in the text as a header', () => {
		const text = 'Поставка от: 10 дней\nОплата 50/50'
		assert.equal(splitQuotedReply(text).quoted, '')
		const text2 = 'От: склада в Минске\nСрок 5 дней'
		assert.equal(splitQuotedReply(text2).quoted, '')
	})

	it('cuts a trailing block of > lines', () => {
		const r = splitQuotedReply('Принято.\n\n> Просим КП\n> на кабель\n')
		assert.equal(r.main, 'Принято.')
		assert.equal(r.quoted, '> Просим КП\n> на кабель')
	})

	it('keeps > lines in the middle of the text', () => {
		const r = splitQuotedReply('> ваш вопрос\nНаш ответ: да.')
		assert.equal(r.quoted, '')
	})

	it('keeps a pure forward (marker on the first line) whole', () => {
		const text = '-----Original Message-----\nFrom: A\nтекст'
		assert.deepEqual(splitQuotedReply(text), { main: text, quoted: '' })
	})

	it('normalises CRLF', () => {
		const r = splitQuotedReply('Да.\r\n\r\n-----Original Message-----\r\nтекст')
		assert.equal(r.main, 'Да.')
	})

	it('cuts at the earliest marker when there are several', () => {
		const r = splitQuotedReply('Новое.\n-----Original Message-----\nстарое\n-----Original Message-----\nещё старее')
		assert.equal(r.main, 'Новое.')
		assert.match(r.quoted, /ещё старее/)
	})
})

describe('letterPreview', () => {
	it('drops the greeting and line breaks', () => {
		assert.equal(letterPreview('Добрый день!\nНаправляем КП на 1 240 000 ₽.'), 'Направляем КП на 1 240 000 ₽.')
	})

	it('drops "Здравствуйте, Иван!" style greetings', () => {
		assert.equal(letterPreview('Здравствуйте, коллеги!\nЦена 98 ₽/м'), 'Цена 98 ₽/м')
	})

	it('drops a greeting on the same line as the text', () => {
		assert.equal(letterPreview('Добрый день! Направляем КП.'), 'Направляем КП.')
	})

	it('skips empty lines before the text', () => {
		assert.equal(letterPreview('\n\nДобрый день,\n\nСрок 5 дней'), 'Срок 5 дней')
	})

	it('does not strip words that only start like a greeting', () => {
		assert.equal(letterPreview('Привезём за 5 дней.'), 'Привезём за 5 дней.')
	})

	it('drops "Уважаемый ..." greeting', () => {
		assert.equal(letterPreview('Уважаемый Иван Петрович!\nСрок 10 дней.'), 'Срок 10 дней.')
	})

	it('ignores the quoted history', () => {
		assert.equal(letterPreview('Добрый день,\nок.\n-----Original Message-----\nстарое письмо'), 'ок.')
	})

	it('falls back to the text when it is only a greeting', () => {
		assert.equal(letterPreview('Добрый день!'), 'Добрый день!')
	})

	it('cuts long text with an ellipsis', () => {
		const p = letterPreview('а'.repeat(300), 50)
		assert.equal(p.length, 50)
		assert.ok(p.endsWith('…'))
	})

	it('handles null', () => {
		assert.equal(letterPreview(null), '')
	})
})

describe('dayLabel', () => {
	const now = new Date(2026, 10, 6, 15, 0)
	it('today and yesterday', () => {
		assert.equal(dayLabel(new Date(2026, 10, 6, 0, 5).toISOString(), now), 'Сегодня')
		assert.equal(dayLabel(new Date(2026, 10, 5, 23, 59).toISOString(), now), 'Вчера')
	})
	it('older day of this year without the year', () => {
		assert.equal(dayLabel(new Date(2026, 10, 3, 10, 0).toISOString(), now), '3 ноября')
	})
	it('another year with the year', () => {
		assert.equal(dayLabel(new Date(2025, 11, 30, 10, 0).toISOString(), now), '30 декабря 2025')
	})
	it('yesterday across a month boundary', () => {
		const first = new Date(2026, 11, 1, 9, 0)
		assert.equal(dayLabel(new Date(2026, 10, 30, 18, 0).toISOString(), first), 'Вчера')
	})
})

describe('fileKind', () => {
	it('detects by extension', () => {
		assert.deepEqual(fileKind('КП_418.pdf'), { label: 'PDF', tone: 'pdf' })
		assert.deepEqual(fileKind('Прайс.XLSX'), { label: 'XLSX', tone: 'sheet' })
		assert.deepEqual(fileKind('ТЗ.docx'), { label: 'DOCX', tone: 'doc' })
		assert.deepEqual(fileKind('фото.jpeg'), { label: 'JPEG', tone: 'image' })
		assert.deepEqual(fileKind('docs.zip'), { label: 'ZIP', tone: 'archive' })
	})
	it('falls back to the content type', () => {
		assert.deepEqual(fileKind('document', 'application/pdf'), { label: 'PDF', tone: 'pdf' })
		assert.equal(fileKind('scan', 'image/png').tone, 'image')
	})
	it('unknown file', () => {
		assert.deepEqual(fileKind('noext', null), { label: 'ФАЙЛ', tone: 'other' })
		assert.equal(fileKind('a.bin', 'application/octet-stream').tone, 'other')
	})
})

describe('companyInitials', () => {
	it('skips legal forms and quotes', () => {
		assert.equal(companyInitials('ООО «ЭлектроКомплект»'), 'ЭЛ')
		assert.equal(companyInitials('ТД «Кабельный мир»'), 'КМ')
		assert.equal(companyInitials('ИП Ковалёв А. С.'), 'КА')
		assert.equal(companyInitials('АО «СевЗап-Кабель»'), 'СК')
	})
	it('handles odd names', () => {
		assert.equal(companyInitials('ООО'), 'О')
		assert.equal(companyInitials('  '), '?')
	})
})

describe('threadState', () => {
	const inc = { direction: 'incoming' as const }
	const out = { direction: 'outgoing' as const }
	it('new when unread with incoming letters', () => {
		assert.equal(threadState({ unread: true, message_count: 2, last_message: inc }), 'new')
	})
	it('replied when the last letter is from the supplier', () => {
		assert.equal(threadState({ unread: false, message_count: 1, last_message: inc }), 'replied')
	})
	it('awaiting when the last letter is ours', () => {
		assert.equal(threadState({ unread: false, message_count: 0, last_message: out }), 'awaiting')
		assert.equal(threadState({ unread: false, message_count: 3, last_message: out }), 'awaiting')
	})
	it('unread flag without incoming letters is not "new"', () => {
		assert.equal(threadState({ unread: true, message_count: 0, last_message: out }), 'awaiting')
	})
	it('empty thread', () => {
		assert.equal(threadState({ unread: false, message_count: 0, last_message: null }), 'empty')
	})
})

describe('firstUnansweredIncomingId', () => {
	it('first of the trailing incoming run', () => {
		const msgs = [
			{ id: 'a', direction: 'outgoing' as const },
			{ id: 'b', direction: 'incoming' as const },
			{ id: 'c', direction: 'outgoing' as const },
			{ id: 'd', direction: 'incoming' as const },
			{ id: 'e', direction: 'incoming' as const },
		]
		assert.equal(firstUnansweredIncomingId(msgs), 'd')
	})
	it('null when the last letter is ours', () => {
		assert.equal(firstUnansweredIncomingId([{ id: 'a', direction: 'incoming' }, { id: 'b', direction: 'outgoing' }]), null)
	})
	it('all incoming', () => {
		assert.equal(firstUnansweredIncomingId([{ id: 'a', direction: 'incoming' }, { id: 'b', direction: 'incoming' }]), 'a')
	})
	it('empty list', () => {
		assert.equal(firstUnansweredIncomingId([]), null)
	})
})
