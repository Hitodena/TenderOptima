/** Shared UModal `ui.content` for letter/template editors (matches main page width). */
export const EMAIL_LETTER_MODAL_UI = {
	content: 'w-[calc(100vw-2rem)] max-w-7xl',
	header: 'flex items-start gap-3',
} as const

/** Sticky footer bar for letter modals (Send / Cancel). */
export const EMAIL_LETTER_MODAL_FOOTER_CLASS =
	'sticky bottom-0 shrink-0 -mx-1 mt-auto border-t border-default bg-default/95 backdrop-blur-sm px-1 pt-3 flex items-center justify-end gap-2'
