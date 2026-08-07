/** Shared UModal `ui.content` for letter/template editors (matches main page width). */
export const EMAIL_LETTER_MODAL_UI = {
	content: 'w-[calc(100vw-2rem)] max-w-7xl',
	header: 'flex items-start gap-3',
} as const

/** Native UModal `#footer` actions row (Send / Cancel). */
export const EMAIL_LETTER_MODAL_FOOTER_CLASS =
	'flex flex-wrap items-center justify-end gap-2 w-full'
