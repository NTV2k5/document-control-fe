import { API, type IPagination } from 'reactjs-platform/utilities';
import type { ITemplate, ITemplateMetadata, TemplateArtifactType } from '../templates/templates.api';

export type DocumentStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVAL' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DocumentVisibility = 'PRIVATE' | 'RESTRICTED' | 'PUBLIC';
export type DocumentExtractionStatus = 'success' | 'failed';
export type DocumentAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'DELETED';
export type DocumentRevisionAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type IDocumentTemplateRef = Pick<
  ITemplate,
  | 'id'
  | 'name'
  | 'version'
  | 'status'
  | 'template_type'
  | 'artifact_type'
  | 'visibility'
  | 'organization_unit_id'
  | 'source_file_name'
  | 'template_metadata'
> &
  Partial<Pick<ITemplate, 'artifact_config' | 'content' | 'file_id' | 'variables'>>;

export interface IDocumentAuditLog {
  id: string;
  document_id: string;
  action: DocumentAuditAction;
  performed_by: string;
  previous_status?: string | null;
  new_status?: string | null;
  details?: Record<string, unknown> | null;
  timestamp: string;
}

export interface IDocumentExtractionAuditDetails {
  source?: 'word_extraction_trigger' | 'word_extraction_callback';
  dagRunId?: string;
  jobId?: string;
  logicalDate?: string;
  templateName?: string;
  status?: DocumentExtractionStatus;
  error?: string;
  upload?: {
    bucket: string;
    path: string;
    size: number;
    etag: string;
  };
}

export interface IDocumentRevision {
  id: string;
  document_id: string;
  action: DocumentRevisionAction;
  updated_by: string;
  snapshot?: unknown;
  summary?: string | null;
  created_at: string;
}

export interface IDocumentPermissions {
  can_edit: boolean;
  can_delete: boolean;
  can_submit: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_publish: boolean;
  can_unpublish: boolean;
  can_reset_to_draft: boolean;
}

export interface IDocumentApprovalStep {
  id: string;
  step_key: string;
  step_order: number;
  label: string;
  actor_role_key?: string | null;
  status: 'WAITING' | 'WAITING_ASSIGNMENT' | 'ASSIGNED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'SKIPPED';
  target_organization_unit_id?: string | null;
  target_organization_unit_name?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_label?: string | null;
  candidate_ids?: string[];
  reason?: string | null;
  acted_at?: string | null;
  deadline_at?: string | null;
}

export interface IDocumentApprovalSummary {
  instance_id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  current_step_key?: string | null;
  current_step_order?: number | null;
  total_steps: number;
  current_step?: IDocumentApprovalStep | null;
  next_step?: IDocumentApprovalStep | null;
  steps: IDocumentApprovalStep[];
}

export interface IDocument {
  id: string;
  template_id: string;
  artifact_type?: TemplateArtifactType;
  title: string;
  description?: string | null;
  content?: string | null;
  data?: unknown;
  artifact_state?: unknown;
  document_metadata?: ITemplateMetadata | Record<string, unknown> | null;
  documentMetadata?: ITemplateMetadata | Record<string, unknown> | null;
  visibility: DocumentVisibility;
  organization_unit_id?: string | null;
  status: DocumentStatus;
  is_published: boolean;
  created_by: string;
  submitted_by?: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  published_by?: string | null;
  unpublished_by?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  published_at?: string | null;
  unpublished_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  template?: IDocumentTemplateRef | null;
  revisions?: IDocumentRevision[];
  audit_logs?: IDocumentAuditLog[];
  permissions?: IDocumentPermissions;
  approval?: IDocumentApprovalSummary | null;
  views?: number;
  recipients?: string[];
  tags?: string[];
  file_url?: string | null;
  folder?: string | null;
}

export interface IListDocumentsParams {
  search?: string;
  page?: number;
  page_size?: number;
  sort?: string;
  status?: DocumentStatus;
  template_id?: string;
  template_type?: string;
  artifact_type?: TemplateArtifactType;
  organization_unit_id?: string;
  metadata_filter?: Record<string, string>;
  is_published?: boolean;
  created_by?: string;
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
}

export interface ICreateDocumentPayload {
  template_id: string;
  title?: string;
  description?: string;
  artifact_type?: TemplateArtifactType;
  content?: string;
  data?: unknown;
  artifact_state?: unknown;
  document_metadata?: ITemplateMetadata | Record<string, unknown> | null;
}

export interface IUpdateDocumentPayload {
  title?: string;
  description?: string;
  artifact_type?: TemplateArtifactType;
  content?: string;
  data?: unknown;
  artifact_state?: unknown;
  document_metadata?: ITemplateMetadata | Record<string, unknown> | null;
  recipients?: string[];
  tags?: string[];
  file_url?: string | null;
  folder?: string | null;
}

export interface IExtractWordResponse {
  document_id: string;
  status: 'queued';
  upload: {
    bucket: string;
    path: string;
    size: number;
    etag: string;
  };
  airflow: {
    dagRunId?: string;
    jobId?: string;
    logicalDate?: string;
    templateName?: string;
    dagId?: string;
    destination?: string;
  };
}

const DOCUMENTS_BASE_URL = '/api/v1/documents';

const inflightDocumentListRequests = new Map<string, Promise<{ data: IDocument[]; pagination: IPagination }>>();
const inflightDocumentDetailRequests = new Map<string, Promise<IDocument>>();

export const listDocumentsAPI = async (
  params?: IListDocumentsParams,
): Promise<{ data: IDocument[]; pagination: IPagination }> => {
  const { metadata_filter, ...rest } = params ?? {};

  const requestKey = JSON.stringify({
    created_by: rest.created_by ?? null,
    created_from: rest.created_from ?? null,
    created_to: rest.created_to ?? null,
    is_published: rest.is_published ?? null,
    metadata_filter: metadata_filter ?? null,
    page: rest.page ?? 1,
    page_size: rest.page_size ?? 10,
    search: rest.search?.trim() ?? '',
    sort: rest.sort ?? '',
    status: rest.status ?? null,
    artifact_type: rest.artifact_type ?? null,
    organization_unit_id: rest.organization_unit_id ?? null,
    template_id: rest.template_id ?? null,
    template_type: rest.template_type ?? null,
    updated_from: rest.updated_from ?? null,
    updated_to: rest.updated_to ?? null,
  });

  const existingRequest = inflightDocumentListRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const serializedParams = {
    ...rest,
    ...(metadata_filter && Object.keys(metadata_filter).length > 0
      ? { metadata_filter: JSON.stringify(metadata_filter) }
      : {}),
  };

  const request = API.get<{ data: IDocument[]; pagination: IPagination }>(DOCUMENTS_BASE_URL, {
    params: serializedParams,
  })
    .then((response) => response.data)
    .finally(() => {
      inflightDocumentListRequests.delete(requestKey);
    });

  inflightDocumentListRequests.set(requestKey, request);
  return request;
};

export const getDocumentByIdAPI = async (id: string): Promise<IDocument> => {
  const existingRequest = inflightDocumentDetailRequests.get(id);
  if (existingRequest) {
    return existingRequest;
  }

  const request = API.get<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}`)
    .then((response) => response.data.data)
    .finally(() => {
      inflightDocumentDetailRequests.delete(id);
    });

  inflightDocumentDetailRequests.set(id, request);
  return request;
};

export const createDocumentAPI = async (payload: ICreateDocumentPayload): Promise<IDocument> => {
  return API.post<{ data: IDocument }>(DOCUMENTS_BASE_URL, payload).then((response) => response.data.data);
};

export const updateDocumentAPI = async (id: string, payload: IUpdateDocumentPayload): Promise<IDocument> => {
  return API.patch<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}`, payload).then((response) => response.data.data);
};

export const deleteDocumentAPI = async (id: string): Promise<void> => {
  return API.delete(`${DOCUMENTS_BASE_URL}/${id}`).then(() => undefined);
};

export interface ISubmitDocumentPayload {
  step_assignees?: Record<string, string>;
  step_units?: Record<string, string>;
  note?: string;
}

export interface IExecuteDocumentApprovalActionPayload {
  action_key: string;
  step_id?: string;
  assignee_id?: string;
  reason?: string;
}

export const submitDocumentAPI = async (id: string, payload?: ISubmitDocumentPayload): Promise<IDocument> => {
  return API.post<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}/submit`, payload ?? {}).then(
    (response) => response.data.data,
  );
};

export const approveDocumentAPI = async (id: string): Promise<IDocument> => {
  return API.post<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}/approve`).then((response) => response.data.data);
};

export const rejectDocumentAPI = async (id: string, payload: { rejection_reason: string }): Promise<IDocument> => {
  return API.post<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}/reject`, payload).then(
    (response) => response.data.data,
  );
};

export const returnDocumentToDraftAPI = async (id: string): Promise<IDocument> => {
  return API.post<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}/draft`).then((response) => response.data.data);
};

export const executeDocumentApprovalActionAPI = async (
  id: string,
  payload: IExecuteDocumentApprovalActionPayload,
): Promise<IDocument> => {
  return API.post<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}/approval/actions`, payload).then(
    (response) => response.data.data,
  );
};

export const publishDocumentAPI = async (id: string): Promise<IDocument> => {
  return API.post<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}/publish`).then((response) => response.data.data);
};

export const unpublishDocumentAPI = async (id: string): Promise<IDocument> => {
  return API.post<{ data: IDocument }>(`${DOCUMENTS_BASE_URL}/${id}/unpublish`).then((response) => response.data.data);
};

export const extractWordDocumentAPI = async (id: string, file: File): Promise<IExtractWordResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return API.post<{ data: IExtractWordResponse }>(`${DOCUMENTS_BASE_URL}/${id}/extract-word`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }).then((response) => response.data.data);
};

export interface IFileVersion {
  name: string;
  creation: string;
  owner: string;
  data: string;
  version_number: string;
  full_name: string;
  user_image: string | null;
}

export const listPublishedDocumentsAPI = async (
  params?: IListDocumentsParams,
): Promise<{ data: IDocument[]; pagination: IPagination }> => {
  const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';
  return API.get<{ message: { data: any[]; total: number; page_size: number; start: number } }>(
    `/api/method/${API_COMMON}.published.get_published_documents`
  ).then((response) => {
    const raw = response.data.message.data;
    const mapped: IDocument[] = raw.map((item) => {
      const typeLower = item.mime_type?.toLowerCase() || '';
      let artifact_type: TemplateArtifactType = 'rich_text';
      let template_type = 'ACADEMIC';
      if (typeLower.includes('pdf')) {
        artifact_type = 'image_form';
      } else if (typeLower.includes('sheet') || typeLower.includes('excel')) {
        artifact_type = 'spreadsheet';
        template_type = 'FINANCIAL';
      }
      return {
        id: item.name,
        template_id: 'default-template',
        title: item.file_name,
        artifact_type,
        visibility: 'PUBLIC',
        status: 'APPROVED',
        is_published: item.status === 'Active',
        created_by: item.owner,
        created_at: item.creation,
        updated_at: item.modified,
        views: item.views,
        template: {
          id: 'default-template',
          name: 'Default Template',
          version: 1,
          status: 'APPROVED',
          template_type,
          artifact_type,
          visibility: 'PUBLIC',
          organization_unit_id: 'default-unit',
          source_file_name: item.file_name,
          template_metadata: null,
        },
        permissions: {
          can_edit: false,
          can_delete: true,
          can_submit: false,
          can_approve: false,
          can_reject: false,
          can_publish: false,
          can_unpublish: true,
          can_reset_to_draft: false,
        },
      };
    });
    return {
      data: mapped,
      pagination: {
        page: 1,
        page_size: response.data.message.page_size || 10,
        total: response.data.message.total || mapped.length,
        total_pages: Math.ceil((response.data.message.total || mapped.length) / (response.data.message.page_size || 10)),
      },
    };
  });
};

export const getFileVersionsAPI = async (fileName: string): Promise<IFileVersion[]> => {
  const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';
  return API.request<{ message: IFileVersion[] }>({
    method: 'GET',
    url: `/api/method/${API_COMMON}.published.get_file_versions`,
    data: { file_name: fileName },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data.message);
};

