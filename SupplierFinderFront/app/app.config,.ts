export default defineAppConfig({
	ui: {
		colors: {
			primary: 'blue',
			neutral: 'slate',
			error: 'red',
			success: 'green',
			warning: 'abmer',
		},

		card: {
			slots: {
				root: 'bg-[--ui-bg-muted] ring ring-[--ui-border] rounded-lg',
				header: 'px-6 py-4 border-b border-[--ui-border]',
				body: 'p-6',
				footer: 'px-6 py-4 border-t border-[--ui-border]',
			},
		},

		table: {
			slots: {
				th: 'text-[--ui-text-muted] text-xs font-medium uppercase tracking-wide',
				td: 'text-sm border-b border-[--ui-border]',
			},
		},
	},
});
