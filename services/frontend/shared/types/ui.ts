import type { TZAnalysisStatus } from './api';
import {
	RequestStatus,
	RequestSupplierStatus,
	TZAnalysisRunStatus,
} from './enums';

type BadgeColor =
	| 'neutral'
	| 'primary'
	| 'success'
	| 'warning'
	| 'error'
	| 'info'
	| 'secondary';

export const REQUEST_STATUS_COLOR: Record<RequestStatus, BadgeColor> = {
	[RequestStatus.DRAFT]: 'neutral',
	[RequestStatus.SEARCHING]: 'warning',
	[RequestStatus.ACTIVE]: 'success',
	[RequestStatus.QUEUED]: 'warning',
	[RequestStatus.COMPLETED]: 'success',
	[RequestStatus.CLOSED]: 'neutral',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
	[RequestStatus.DRAFT]: 'Черновик',
	[RequestStatus.SEARCHING]: 'Поиск поставщиков',
	[RequestStatus.ACTIVE]: 'Активный',
	[RequestStatus.QUEUED]: 'В очереди на рассылку',
	[RequestStatus.COMPLETED]: 'Рассылка завершена',
	[RequestStatus.CLOSED]: 'Завершен',
};

export const SUPPLIER_STATUS_COLOR: Record<RequestSupplierStatus, BadgeColor> =
	{
		[RequestSupplierStatus.PENDING]: 'neutral',
		[RequestSupplierStatus.SENT]: 'primary',
		[RequestSupplierStatus.REPLIED]: 'success',
		[RequestSupplierStatus.FAILED]: 'error',
	};

export const SUPPLIER_STATUS_LABEL: Record<RequestSupplierStatus, string> = {
	[RequestSupplierStatus.PENDING]: 'Ожидает рассылки',
	[RequestSupplierStatus.SENT]: 'Отправлено',
	[RequestSupplierStatus.REPLIED]: 'Ответил',
	[RequestSupplierStatus.FAILED]: 'Ошибка',
};

export function getRequestStatusColor(s: string): BadgeColor {
	return REQUEST_STATUS_COLOR[s as RequestStatus] ?? 'neutral';
}

export function getRequestStatusLabel(s: string): string {
	return REQUEST_STATUS_LABEL[s as RequestStatus] ?? s;
}

export const TZ_RUN_STATUS_COLOR: Record<TZAnalysisRunStatus, BadgeColor> = {
	[TZAnalysisRunStatus.DRAFT]: 'neutral',
	[TZAnalysisRunStatus.ACTIVE]: 'success',
	[TZAnalysisRunStatus.PROCESSING]: 'warning',
	[TZAnalysisRunStatus.COMPLETED]: 'neutral',
	[TZAnalysisRunStatus.FAILED]: 'error',
};

export const TZ_RUN_STATUS_LABEL: Record<TZAnalysisRunStatus, string> = {
	[TZAnalysisRunStatus.DRAFT]: 'Черновик',
	[TZAnalysisRunStatus.ACTIVE]: 'Активный',
	[TZAnalysisRunStatus.PROCESSING]: 'В очереди на обработку',
	[TZAnalysisRunStatus.COMPLETED]: 'Завершен',
	[TZAnalysisRunStatus.FAILED]: 'Ошибка',
};

export function getTzRunStatusColor(s: string): BadgeColor {
	return TZ_RUN_STATUS_COLOR[s as TZAnalysisRunStatus] ?? 'neutral';
}

export function getTzRunStatusLabel(s: string): string {
	return TZ_RUN_STATUS_LABEL[s as TZAnalysisRunStatus] ?? s;
}

export const TZ_ITEM_STATUS_COLOR: Record<TZAnalysisStatus, BadgeColor> = {
	met: 'success',
	partial: 'warning',
	missing: 'error',
	not_found: 'neutral',
};

export const TZ_ITEM_STATUS_LABEL: Record<TZAnalysisStatus, string> = {
	met: 'Соответствует',
	partial: 'Частично',
	missing: 'Не соответствует',
	not_found: 'Не найдено',
};

export function getTzItemStatusColor(s: TZAnalysisStatus): BadgeColor {
	return TZ_ITEM_STATUS_COLOR[s] ?? 'neutral';
}

export function getTzItemStatusLabel(s: TZAnalysisStatus): string {
	return TZ_ITEM_STATUS_LABEL[s] ?? s;
}

export function getSupplierStatusColor(s: string): BadgeColor {
	return SUPPLIER_STATUS_COLOR[s as RequestSupplierStatus] ?? 'neutral';
}

export function getSupplierStatusLabel(s: string): string {
	return SUPPLIER_STATUS_LABEL[s as RequestSupplierStatus] ?? s;
}
