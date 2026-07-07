import { API } from 'reactjs-platform/utilities';
import type { TArtifactType } from '../artifacts';

export type TReportGroupBy = 'day' | 'month' | 'year';

export interface IReportTrendPoint {
  label: string;
  count: number;
}

export interface IEntityReportSummary {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  published: number;
  by_status: Record<string, number>;
  by_template_type: Record<string, number>;
  trend: IReportTrendPoint[];
}

export interface IReportQueryParams {
  from?: string;
  to?: string;
  group_by?: TReportGroupBy;
  template_type?: string;
  artifact_type?: TArtifactType;
  organization_unit_id?: string;
}

const pendingReportRequests = new Map<string, Promise<IEntityReportSummary>>();

const getReportSummary = (url: string, params?: IReportQueryParams) => {
  const requestKey = `${url}:${JSON.stringify(params ?? {})}`;
  const existing = pendingReportRequests.get(requestKey);
  if (existing) {
    return existing;
  }

  const request = API.get<{ data: IEntityReportSummary }>(url, { params })
    .then((response) => response.data.data)
    .finally(() => {
      pendingReportRequests.delete(requestKey);
    });

  pendingReportRequests.set(requestKey, request);
  return request;
};

export const getDocumentReportSummaryAPI = async (params?: IReportQueryParams): Promise<IEntityReportSummary> => {
  return getReportSummary('/api/v1/documents/reports/summary', params);
};

export const getTemplateReportSummaryAPI = async (params?: IReportQueryParams): Promise<IEntityReportSummary> => {
  return getReportSummary('/api/v1/templates/templates/reports/summary', params);
};
