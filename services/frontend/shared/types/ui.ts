import { RequestStatus, RequestSupplierStatus } from './enums';

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

export function getSupplierStatusColor(s: string): BadgeColor {
	return SUPPLIER_STATUS_COLOR[s as RequestSupplierStatus] ?? 'neutral';
}

export function getSupplierStatusLabel(s: string): string {
	return SUPPLIER_STATUS_LABEL[s as RequestSupplierStatus] ?? s;
}
