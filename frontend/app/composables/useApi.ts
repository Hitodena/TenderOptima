import type { AxiosRequestConfig } from 'axios';

export function useApi() {
	const { $axios } = useNuxtApp();

	const get = <T>(url: string, config?: AxiosRequestConfig) =>
		$axios.get<T>(url, config).then((r) => r.data);

	const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
		$axios.post<T>(url, data, config).then((r) => r.data);

	const put = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
		$axios.put<T>(url, data, config).then((r) => r.data);

	const del = <T>(url: string, config?: AxiosRequestConfig) =>
		$axios.delete<T>(url, config).then((r) => r.data);

	const patch = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
		$axios.patch<T>(url, data, config).then((r) => r.data);

	return { get, post, put, del, patch };
}
