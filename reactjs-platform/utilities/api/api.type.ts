import type { AxiosError, AxiosRequestConfig } from 'axios';
import type { PageSizePagination } from '../../../src/models/pagination/pagination.model';

export type IPagination = PageSizePagination;

export type ApiError = AxiosError<{
  code?: number;
  message?: string;
  data?: any;
}>;

export type CustomAxiosRequestConfig<D = any> = {
  skipToast?: boolean;
  [key: string]: any;
} & AxiosRequestConfig<D>;
