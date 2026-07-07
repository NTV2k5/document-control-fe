import { API } from 'reactjs-platform/utilities';
import type { TDocumentTemplate, TTableTemplate } from '../../lib';
import type { ITemplateVariableDefinition, TEditorArtifactScope } from './template-variables.api';
export type TTemplateDataCatalog = Record<string, string[]>;

export type TForeignKeyMeta = Record<string, { table: string; display_field: string }>;

export type TTemplateDataOption = {
  id: string;
  label: string;
  value: string;
  record?: Record<string, unknown>;
};

export type TTemplateDataRecord = Record<string, unknown> & {
  _id?: string;
};

export interface IEditorMetaPayload {
  schema_field_catalog: TTemplateDataCatalog;
  source_schema_field_catalog: TTemplateDataCatalog;
  foreign_key_meta: TForeignKeyMeta;
  table_templates: TTableTemplate[];
  document_templates: TDocumentTemplate[];
  variable_definitions: ITemplateVariableDefinition[];
}

export type TemplateDataCatalog = TTemplateDataCatalog;
export type ForeignKeyMeta = TForeignKeyMeta;
export type TemplateDataOption = TTemplateDataOption;
export type TemplateDataRecord = TTemplateDataRecord;
export type EditorMetaPayload = IEditorMetaPayload;

type JoinConditionPayload = {
  from_table: string;
  from_field: string;
  to_table: string;
  to_field: string;
};

type FieldToFetchPayload = {
  key: string;
  table: string;
  field: string;
  source_field?: string;
  source_table?: string;
};

const TEMPLATE_DATA_BASE_URL = '/api/v1/templates/template-data';
const pendingEditorMetaRequests = new Map<string, Promise<IEditorMetaPayload>>();
const TEMPLATE_TABLE_OPTIONS_CACHE_TTL_MS = 30_000;
const TEMPLATE_TABLE_OPTIONS_CACHE_MAX_SIZE = 150;
const TEMPLATE_TABLE_OPTIONS_REQUEST_TIMEOUT_MS = 8_000;
const pendingTemplateTableOptionsRequests = new Map<string, Promise<TTemplateDataOption[]>>();
const templateTableOptionsCache = new Map<string, { expiresAt: number; data: TTemplateDataOption[] }>();

const createTemplateTableOptionsRequestKey = (params: {
  table: string;
  field_name: string;
  filter_field?: string;
  filter_value?: unknown;
  sort_order?: 'asc' | 'desc';
  search?: string;
  page?: number;
  page_size?: number;
  label_field?: string;
}) =>
  JSON.stringify({
    table: params.table,
    field_name: params.field_name,
    filter_field: params.filter_field,
    filter_value: params.filter_value,
    sort_order: params.sort_order,
    search: params.search,
    page: params.page,
    page_size: params.page_size,
    label_field: params.label_field,
  });

const trimTemplateTableOptionsCache = () => {
  if (templateTableOptionsCache.size <= TEMPLATE_TABLE_OPTIONS_CACHE_MAX_SIZE) {
    return;
  }

  const removeCount = templateTableOptionsCache.size - TEMPLATE_TABLE_OPTIONS_CACHE_MAX_SIZE;
  Array.from(templateTableOptionsCache.keys())
    .slice(0, removeCount)
    .forEach((key) => {
      templateTableOptionsCache.delete(key);
    });
};

const withTemplateTableOptionsTimeout = <T>(request: Promise<T>) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Template table options request timed out'));
    }, TEMPLATE_TABLE_OPTIONS_REQUEST_TIMEOUT_MS);
  });

  return Promise.race([request, timeout]).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });
};

export const getTemplateDataCatalogAPI = async (): Promise<TTemplateDataCatalog> => {
  return API.get<{ data: TTemplateDataCatalog }>(`${TEMPLATE_DATA_BASE_URL}/catalog`).then(
    (response) => response.data.data,
  );
};

export const getTemplateEditorMetaAPI = async (params?: {
  template_type?: string;
  artifact_type?: TEditorArtifactScope;
}): Promise<IEditorMetaPayload> => {
  const requestKey = JSON.stringify(params ?? {});
  const existingRequest = pendingEditorMetaRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = API.get<{ data: EditorMetaPayload }>(`${TEMPLATE_DATA_BASE_URL}/editor-meta`, { params })
    .then((response) => response.data.data)
    .finally(() => {
      pendingEditorMetaRequests.delete(requestKey);
    });

  pendingEditorMetaRequests.set(requestKey, request);
  return request;
};

export const getTemplateTableOptionsAPI = async (params: {
  table: string;
  field_name: string;
  filter_field?: string;
  filter_value?: unknown;
  sort_order?: 'asc' | 'desc';
  search?: string;
  page?: number;
  page_size?: number;
  label_field?: string;
}): Promise<TTemplateDataOption[]> => {
  const requestKey = createTemplateTableOptionsRequestKey(params);
  const cached = templateTableOptionsCache.get(requestKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const pendingRequest = pendingTemplateTableOptionsRequests.get(requestKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = withTemplateTableOptionsTimeout(
    API.get<{ data: TTemplateDataOption[] }>(`${TEMPLATE_DATA_BASE_URL}/options`, { params }),
  )
    .then((response) => {
      const data = response.data.data;
      templateTableOptionsCache.set(requestKey, {
        data,
        expiresAt: Date.now() + TEMPLATE_TABLE_OPTIONS_CACHE_TTL_MS,
      });
      trimTemplateTableOptionsCache();
      return data;
    })
    .finally(() => {
      pendingTemplateTableOptionsRequests.delete(requestKey);
    });

  pendingTemplateTableOptionsRequests.set(requestKey, request);
  return request;
};

export const getTemplateTableRecordsAPI = async (table: string): Promise<TTemplateDataRecord[]> => {
  return API.get<{ data: TTemplateDataRecord[] }>(`${TEMPLATE_DATA_BASE_URL}/records`, {
    params: { table },
  }).then((response) => response.data.data);
};

export const getTemplateTableSchemaFieldsAPI = async (table: string): Promise<string[]> => {
  return API.get<{ data: string[] }>(`${TEMPLATE_DATA_BASE_URL}/schema-fields`, {
    params: { table },
  }).then((response) => response.data.data);
};

export const getTemplateRecordByFieldValueAPI = async (params: {
  table: string;
  field_name: string;
  field_value: string;
}): Promise<TemplateDataRecord | null> => {
  return API.get<{ data: TemplateDataRecord | null }>(`${TEMPLATE_DATA_BASE_URL}/record`, {
    params,
  }).then((response) => response.data.data);
};

export const getTemplateJoinedRowAPI = async (payload: {
  trigger_table: string;
  trigger_field: string;
  trigger_value: string;
  join_table: string;
  to_field: string;
  join_conditions?: JoinConditionPayload[];
  academic_program_id?: string;
}): Promise<Record<string, unknown> | null> => {
  return API.post<{ data: Record<string, unknown> | null }>(`${TEMPLATE_DATA_BASE_URL}/joined-row`, payload).then(
    (response) => response.data.data,
  );
};

export const getTemplateAutoFillAPI = async (payload: {
  trigger_table: string;
  trigger_field: string;
  trigger_value: string;
  join_conditions?: JoinConditionPayload[];
  fields_to_fetch: FieldToFetchPayload[];
  academic_program_id?: string;
}): Promise<{
  updates: Record<string, unknown>;
  source_by_field: Record<string, { table: string; record_id: string }>;
  source_ids: Record<string, string>;
}> => {
  return API.post<{
    data: {
      updates: Record<string, unknown>;
      source_by_field: Record<string, { table: string; record_id: string }>;
      source_ids: Record<string, string>;
    };
  }>(`${TEMPLATE_DATA_BASE_URL}/auto-fill`, payload).then((response) => {
    return response.data.data;
  });
};

export const getTemplateDocumentDataAPI = async (payload: {
  primary_table: string;
  trigger_field: string;
  trigger_value: string;
  join_conditions: JoinConditionPayload[];
  fields_to_fetch: Array<{ key: string; table: string; field: string }>;
  reference_lookups?: Array<{
    key: string;
    fk_table: string;
    fk_field: string;
    target_table: string;
    target_field: string;
  }>;
  checkbox_fields?: Array<{
    key: string;
    source_table: string;
    source_field: string;
    reference_table: string;
    reference_field: string;
    match_values: string[];
  }>;
  academic_program_id?: string;
}): Promise<{
  values: Record<string, unknown>;
  checkbox_results: Record<string, string[]>;
}> => {
  return API.post<{
    data: {
      values: Record<string, unknown>;
      checkbox_results: Record<string, string[]>;
    };
  }>(`${TEMPLATE_DATA_BASE_URL}/document-template`, payload).then((response) => {
    return response.data.data;
  });
};
