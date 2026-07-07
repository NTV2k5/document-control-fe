import { API } from 'reactjs-platform/utilities';
import type { DocumentStatus, IDocumentApprovalSummary } from '../documents';

export interface IDocumentApprovalFlowAction {
  id?: string;
  action_key: string;
  label: string;
  from_status: DocumentStatus;
  to_status: DocumentStatus;
  next_step_key?: string | null;
  after_actions?: string[];
}

export interface IDocumentApprovalFlowStep {
  id?: string;
  step_key: string;
  step_order: number;
  label: string;
  description?: string | null;
  step_type?: 'SUBMIT' | 'REVIEW' | 'PUBLISH';
  actor_roles?: string[];
  actor_unit_strategy?: 'SUBMITTER_PRIMARY_UNIT' | 'FIXED_ORG_UNIT' | 'TENANT' | string;
  actor_unit_code?: string | null;
  is_assignable?: boolean;
  allowed_actions: IDocumentApprovalFlowAction[];
}

export interface IDocumentApprovalFlow {
  id?: string;
  template_type: string;
  label: string;
  description?: string | null;
  initial_status: DocumentStatus;
  final_status: DocumentStatus;
  is_active?: boolean;
  steps: IDocumentApprovalFlowStep[];
}

export interface IApprovalDashboardRow {
  id: string;
  title: string;
  status: DocumentStatus;
  template_type?: string | null;
  template_name?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approval: IDocumentApprovalSummary;
  bucket_flags: Record<string, boolean>;
}

export interface IApprovalDashboardSummary {
  mine: number;
  todo: number;
  upcoming: number;
  done: number;
  watching: number;
}

export const listDocumentApprovalFlowsAPI = async (): Promise<IDocumentApprovalFlow[]> => {
  return API.get<{ data: IDocumentApprovalFlow[] }>('/api/v1/document-approval-flows').then(
    (response) => response.data.data,
  );
};

export const getDocumentApprovalFlowByTemplateTypeAPI = async (
  template_type: string,
): Promise<IDocumentApprovalFlow> => {
  return API.get<{ data: IDocumentApprovalFlow }>(
    `/api/v1/document-approval-flows/by-template-type/${encodeURIComponent(template_type)}`,
  ).then((response) => response.data.data);
};

export const saveDocumentApprovalFlowAPI = async (payload: IDocumentApprovalFlow): Promise<IDocumentApprovalFlow> => {
  return API.post<{ data: IDocumentApprovalFlow }>('/api/v1/document-approval-flows', payload).then(
    (response) => response.data.data,
  );
};

export const getApprovalDashboardSummaryAPI = async (): Promise<IApprovalDashboardSummary> => {
  return API.get<{ data: IApprovalDashboardSummary }>('/api/v1/approval-dashboard/summary').then(
    (response) => response.data.data,
  );
};

export const listApprovalDashboardDocumentsAPI = async (bucket?: string): Promise<IApprovalDashboardRow[]> => {
  return API.get<{ data: IApprovalDashboardRow[] }>('/api/v1/approval-dashboard/documents', {
    params: bucket ? { bucket } : undefined,
  }).then((response) => response.data.data);
};
