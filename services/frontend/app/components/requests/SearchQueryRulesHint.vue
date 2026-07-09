<template>
	<UPopover
		mode="click"
		:content="{ side: 'bottom', align: 'end', sideOffset: 8 }"
		class="inline-flex items-center justify-center"
	>
		<button
			type="button"
			class="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-elevated text-muted transition-colors hover:bg-accented hover:text-default"
			aria-label="Правила составления запросов"
			@click.stop
		>
			<UIcon name="i-lucide-info" class="size-4" />
		</button>

		<template #content>
			<div class="max-w-sm p-4 space-y-3 text-sm">
				<p class="font-semibold text-highlighted">Правила составления запросов</p>
				<p class="text-muted">
					Чтобы получить наиболее точные результаты, используйте следующие рекомендации
					при вводе ключевых слов:
				</p>

				<div class="space-y-2">
					<p class="font-medium text-default">Выбирайте одну группу товара.</p>
					<div class="space-y-1.5 pl-1">
						<p>
							<span class="text-primary font-medium">Правильно: </span>
							<span class="text-muted">картон купить от производителя</span>
						</p>
						<p>
							<span class="text-error font-medium">Неправильно: </span>
							<span class="text-muted">картон купить от производителя, флаконы купить от
								производителя</span>
						</p>
					</div>
					<p class="text-muted text-xs">
						(в этом случае получите смешанную выдачу результата для разных групп товаров).
					</p>
				</div>

				<div class="space-y-1.5">
					<p class="font-medium text-default">
						Вы можете указать несколько однотипных запросов, перечислив их через запятую.
					</p>
					<p class="text-muted pl-1">
						Например: картонные коробки от производителя, картонные коробки оптом купить.
					</p>
				</div>
			</div>
		</template>
	</UPopover>
</template>
