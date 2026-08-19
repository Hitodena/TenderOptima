<template>
	<div class="space-y-4">
		<p class="text-sm text-muted">
			Цели обработки персональных данных, категории субъектов, перечень данных,
			правовые основания и сроки хранения.
		</p>

		<div class="overflow-x-auto rounded-lg border border-default">
			<table class="min-w-[960px] w-full text-left text-sm">
				<thead class="bg-elevated/50 border-b border-default">
					<tr>
						<th class="px-3 py-2 font-semibold whitespace-nowrap w-12">№</th>
						<th class="px-3 py-2 font-semibold min-w-[14rem]">Цель обработки</th>
						<th class="px-3 py-2 font-semibold min-w-[12rem]">Категории субъектов</th>
						<th class="px-3 py-2 font-semibold min-w-[12rem]">Перечень данных</th>
						<th class="px-3 py-2 font-semibold min-w-[10rem]">Правовые основания</th>
						<th class="px-3 py-2 font-semibold min-w-[12rem]">Срок хранения</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="row in purposes"
						:key="row.number"
						class="border-b border-default align-top last:border-b-0"
					>
						<td class="px-3 py-3 tabular-nums text-muted">{{ row.number }}</td>
						<td class="px-3 py-3 text-highlighted">{{ row.purpose }}</td>
						<td class="px-3 py-3 text-muted">{{ row.subjects }}</td>
						<td class="px-3 py-3 text-muted">{{ row.dataList }}</td>
						<td class="px-3 py-3 text-muted">{{ row.legalBasis }}</td>
						<td class="px-3 py-3 text-muted">{{ row.retention }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { PERSONAL_DATA_PURPOSES } from '#shared/constants/personalDataPurposes'

const purposes = PERSONAL_DATA_PURPOSES
</script>
