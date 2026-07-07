import { API, type IPagination } from 'reactjs-platform/utilities';

export type TemplateStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type TemplateVisibility = 'PRIVATE' | 'RESTRICTED' | 'PUBLIC';
export type TemplateArtifactType = 'rich_text' | 'spreadsheet' | 'presentation' | 'image_form';
export type TemplateShareSubjectType = 'ORG_UNIT' | 'ORG_UNIT_TREE' | 'USER' | 'GROUP';
export type TemplateAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'DELETED';

export interface ITemplatePermissions {
  can_edit: boolean;
  can_delete: boolean;
  can_submit: boolean;
  can_approve: boolean;
  can_reject: boolean;
  can_publish: boolean;
  can_unpublish: boolean;
  can_create_new_version: boolean;
  can_reset_to_draft: boolean;
}

export interface ITemplateVisibilityUnit {
  id: string;
  code: string;
  name: string;
  unit_type: string;
  parent_id?: string | null;
}

export interface ITemplateShareRule {
  subject_type: TemplateShareSubjectType;
  subject_id: string;
  label?: string;
}

export interface ITemplateShareTargetUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
}

export interface ITemplateMetadataValue {
  value: string;
  label: string;
}

export type ITemplateMetadata = Record<string, ITemplateMetadataValue | undefined>;

export interface ITemplate {
  id: string;
  name: string;
  description: string;
  template_type?: string;
  artifact_type?: TemplateArtifactType;
  visibility: TemplateVisibility;
  organization_unit_id?: string | null;
  share_rules?: ITemplateShareRule[];
  content: string;
  source_file_name: string;
  file_id: string;
  preview?: string | null;
  variables?: unknown;
  artifact_config?: unknown;
  template_metadata?: ITemplateMetadata | null;
  version: number;
  status: TemplateStatus;
  is_published?: boolean;
  created_by: string;
  submitted_by?: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  published_by?: string | null;
  unpublished_by?: string | null;
  createdByDisplay?: string;
  departmentName?: string | null;
  departmentNames?: string[];
  lastModifiedBy?: string | null;
  parent_version_id?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  published_at?: string | null;
  unpublished_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  revisions?: ITemplateRevision[];
  audit_logs?: ITemplateAuditLog[];
  permissions?: ITemplatePermissions;
}

export type ITemplateListItem = Omit<
  ITemplate,
  'artifact_config' | 'audit_logs' | 'content' | 'file_id' | 'preview' | 'revisions' | 'share_rules' | 'variables'
>;

export interface ITemplateAuditLog {
  id: string;
  template_id: string;
  action: TemplateAuditAction;
  performed_by: string;
  previous_status?: string | null;
  new_status?: string | null;
  details?: Record<string, unknown> | null;
  timestamp: string;
}

export interface ITemplateRevision {
  id: string;
  template_id: string;
  action: string;
  updated_by: string;
  snapshot: unknown;
  summary?: string | null;
  created_at: string;
}

export interface IListTemplatesParams {
  search?: string;
  page?: number;
  page_size?: number;
  sort?: string;
  status?: TemplateStatus;
  is_published?: boolean;
  created_by?: string;
  template_type?: string;
  artifact_type?: TemplateArtifactType;
  department_id?: string;
  metadata_filter?: Record<string, string>;
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
}

export interface IGetTemplateByIdOptions {
  includeSnapshot?: boolean;
}

export interface ITemplateMutationOptions {
  includeSnapshot?: boolean;
}

export interface ICreateTemplatePayload {
  name: string;
  description: string;
  template_type?: string;
  artifact_type?: TemplateArtifactType;
  visibility?: TemplateVisibility;
  organization_unit_id?: string;
  share_rules?: Array<{
    subject_type: TemplateShareSubjectType;
    subject_id: string;
  }>;
  content: string;
  source_file_name: string;
  file_id: string;
  preview?: string;
  variables?: unknown;
  artifact_config?: unknown;
  parent_version_id?: string;
  template_metadata?: ITemplateMetadata;
}

export interface IUpdateTemplatePayload {
  name?: string;
  description?: string;
  template_type?: string;
  artifact_type?: TemplateArtifactType;
  visibility?: TemplateVisibility;
  organization_unit_id?: string | null;
  share_rules?: Array<{
    subject_type: TemplateShareSubjectType;
    subject_id: string;
  }>;
  content?: string;
  source_file_name?: string;
  file_id?: string;
  preview?: string;
  variables?: unknown;
  artifact_config?: unknown;
  template_metadata?: ITemplateMetadata;
}

const TEMPLATES_BASE_URL = '/api/v1/templates/templates';
const TEMPLATE_AUDIT_LOGS_BASE_URL = '/api/v1/templates/template-audit-logs';

const inflightTemplateListRequests = new Map<string, Promise<{ data: ITemplateListItem[]; pagination: IPagination }>>();
const inflightTemplateDetailRequests = new Map<string, Promise<ITemplate>>();
const inflightTemplateAuditLogRequests = new Map<
  string,
  Promise<{ data: ITemplateAuditLog[]; pagination: IPagination }>
>();
let inflightTemplateVisibilityUnitsRequest: Promise<ITemplateVisibilityUnit[]> | null = null;

export const listTemplatesAPI = async (
  params?: IListTemplatesParams,
): Promise<{ data: ITemplateListItem[]; pagination: IPagination }> => {
  const { metadata_filter, ...rest } = params ?? {};

  const requestKey = JSON.stringify({
    artifact_type: rest.artifact_type ?? null,
    created_by: rest.created_by ?? null,
    created_from: rest.created_from ?? null,
    created_to: rest.created_to ?? null,
    department_id: rest.department_id ?? null,
    is_published: rest.is_published ?? null,
    metadata_filter: metadata_filter ?? null,
    page: rest.page ?? 1,
    page_size: rest.page_size ?? 10,
    search: rest.search?.trim() ?? '',
    sort: rest.sort ?? '',
    status: rest.status ?? null,
    template_type: rest.template_type ?? null,
    updated_from: rest.updated_from ?? null,
    updated_to: rest.updated_to ?? null,
  });

  const existingRequest = inflightTemplateListRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const serializedParams = {
    ...rest,
    ...(metadata_filter && Object.keys(metadata_filter).length > 0
      ? { metadata_filter: JSON.stringify(metadata_filter) }
      : {}),
  };

  const request = API.get<{ data: ITemplateListItem[]; pagination: IPagination }>(TEMPLATES_BASE_URL, {
    params: serializedParams,
  })
    .then((response) => response.data)
    .finally(() => {
      inflightTemplateListRequests.delete(requestKey);
    });

  inflightTemplateListRequests.set(requestKey, request);
  return request;
};

export const getTemplateByIdAPI = async (id: string, options?: IGetTemplateByIdOptions): Promise<ITemplate> => {
  const includeSnapshot = options?.includeSnapshot !== false;
  const requestKey = `${id}:${includeSnapshot ? 'with-snapshot' : 'without-snapshot'}`;
  const existingRequest = inflightTemplateDetailRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = API.get<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}`, {
    params: { include_snapshot: includeSnapshot },
  })
    .then((response) => response.data.data)
    .finally(() => {
      inflightTemplateDetailRequests.delete(requestKey);
    });

  inflightTemplateDetailRequests.set(requestKey, request);
  return request;
};

export const createTemplateAPI = async (payload: ICreateTemplatePayload): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(TEMPLATES_BASE_URL, payload).then((response) => response.data.data);
};

export const updateTemplateAPI = async (
  id: string,
  payload: IUpdateTemplatePayload,
  options?: ITemplateMutationOptions,
): Promise<ITemplate> => {
  const includeSnapshot = options?.includeSnapshot !== false;
  return API.patch<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}`, payload, {
    params: { include_snapshot: includeSnapshot },
  }).then((response) => response.data.data);
};

export const deleteTemplateAPI = async (id: string): Promise<void> => {
  return API.delete(`${TEMPLATES_BASE_URL}/${id}`).then(() => undefined);
};

export const submitTemplateForApprovalAPI = async (id: string): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}/submit`).then((response) => response.data.data);
};

export const approveTemplateAPI = async (id: string): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}/approve`).then((response) => response.data.data);
};

export const rejectTemplateAPI = async (id: string, payload: { rejection_reason: string }): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}/reject`, payload).then(
    (response) => response.data.data,
  );
};

export const returnTemplateToDraftAPI = async (id: string): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}/draft`).then((response) => response.data.data);
};

export const createTemplateNewVersionAPI = async (id: string): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}/new-version`).then(
    (response) => response.data.data,
  );
};

export const duplicateTemplateAPI = async (id: string): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}/duplicate`).then((response) => response.data.data);
};

export const publishTemplateAPI = async (id: string): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}/publish`).then((response) => response.data.data);
};

export const unpublishTemplateAPI = async (id: string): Promise<ITemplate> => {
  return API.post<{ data: ITemplate }>(`${TEMPLATES_BASE_URL}/${id}/unpublish`).then((response) => response.data.data);
};

export const listTemplateHistoryAPI = async (id: string): Promise<{ data: ITemplate[]; pagination: IPagination }> => {
  return API.get<{ data: ITemplate[]; pagination: IPagination }>(`${TEMPLATES_BASE_URL}/${id}/history`).then(
    (response) => response.data,
  );
};

export const listTemplateAuditLogsAPI = async (params: {
  template_id: string;
  page?: number;
  page_size?: number;
}): Promise<{ data: ITemplateAuditLog[]; pagination: IPagination }> => {
  const requestKey = JSON.stringify({
    page: params.page ?? 1,
    page_size: params.page_size ?? 10,
    template_id: params.template_id,
  });
  const existingRequest = inflightTemplateAuditLogRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = API.get<{ data: ITemplateAuditLog[]; pagination: IPagination }>(TEMPLATE_AUDIT_LOGS_BASE_URL, {
    params,
  })
    .then((response) => response.data)
    .finally(() => {
      inflightTemplateAuditLogRequests.delete(requestKey);
    });

  inflightTemplateAuditLogRequests.set(requestKey, request);
  return request;
};

export const listTemplateVisibilityUnitsAPI = async (): Promise<ITemplateVisibilityUnit[]> => {
  if (inflightTemplateVisibilityUnitsRequest) {
    return inflightTemplateVisibilityUnitsRequest;
  }

  inflightTemplateVisibilityUnitsRequest = API.get<{ data: ITemplateVisibilityUnit[] }>(
    `${TEMPLATES_BASE_URL}/visibility-units`,
  )
    .then((response) => response.data.data)
    .finally(() => {
      inflightTemplateVisibilityUnitsRequest = null;
    });

  return inflightTemplateVisibilityUnitsRequest;
};

export const searchTemplateShareTargetUsersAPI = async (search?: string): Promise<ITemplateShareTargetUser[]> => {
  return API.get<{ data: ITemplateShareTargetUser[] }>(`${TEMPLATES_BASE_URL}/share-target-users`, {
    params: { search },
  }).then((response) => response.data.data);
};
