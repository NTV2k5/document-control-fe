import { API, type IPagination } from 'reactjs-platform/utilities';
import type { ITemplateVariableRenderSettings } from '../../lib';

export const TEMPLATE_VARIABLE_INPUT_TYPES = [
  'Autocomplete',
  'Attach',
  'Attach Image',
  'Barcode',
  'Button',
  'Check',
  'Code',
  'Color',
  'Currency',
  'Data',
  'Date',
  'Datetime',
  'Duration',
  'Dynamic Link',
  'Float',
  'Geolocation',
  'Heading',
  'HTML',
  'HTML Editor',
  'Icon',
  'Image',
  'Int',
  'JSON',
  'Link',
  'Long Text',
  'Markdown Editor',
  'Password',
  'Percent',
  'Phone',
  'Read Only',
  'Rating',
  'Select',
  'Signature',
  'Small Text',
  'Table',
  'Table MultiSelect',
  'Text',
  'Text Editor',
  'Time',
] as const;

export type TTemplateVariableInputType = (typeof TEMPLATE_VARIABLE_INPUT_TYPES)[number];

export const TEMPLATE_VARIABLE_DATA_SOURCE_INPUT_TYPES = [
  'Autocomplete',
  'Dynamic Link',
  'Link',
  'Select',
  'Table MultiSelect',
] as const satisfies readonly TTemplateVariableInputType[];

export const isTemplateVariableDataSourceInputType = (inputType: string): inputType is TTemplateVariableInputType =>
  TEMPLATE_VARIABLE_DATA_SOURCE_INPUT_TYPES.includes(
    inputType as (typeof TEMPLATE_VARIABLE_DATA_SOURCE_INPUT_TYPES)[number],
  );

export const TEMPLATE_VARIABLE_TYPES = ['FIELD_VARIABLE', 'TABLE_VARIABLE', 'DOCUMENT_VARIABLE'] as const;

export type TTemplateVariableType = (typeof TEMPLATE_VARIABLE_TYPES)[number];

export const ARTIFACT_VARIABLE_PROFILE_TYPES = ['spreadsheet', 'presentation', 'image_form'] as const;

export type TArtifactVariableProfileType = (typeof ARTIFACT_VARIABLE_PROFILE_TYPES)[number];

export type TEditorArtifactScope = TArtifactVariableProfileType | 'rich_text';

export type TArtifactBindingKind =
  | 'cell'
  | 'range'
  | 'repeat_table'
  | 'slide_text'
  | 'slide_image'
  | 'repeat_slide'
  | 'overlay_text'
  | 'overlay_image'
  | 'signature';

export interface IArtifactVariableBindingColumn {
  id: string;
  label: string;
  target: string;
  variable_key: string;
}

export interface IArtifactVariableBinding {
  id: string;
  name: string;
  kind: TArtifactBindingKind;
  variable_key?: string;
  source_table?: string;
  sheet?: string;
  slide?: string;
  page?: string;
  target?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  columns?: IArtifactVariableBindingColumn[];
}

export interface IArtifactVariableProfileConfig {
  bindings: IArtifactVariableBinding[];
}

export interface IArtifactVariableProfile {
  id: string;
  name: string;
  description?: string | null;
  artifact_type: TArtifactVariableProfileType;
  template_types: string[];
  config: IArtifactVariableProfileConfig;
  is_active: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ITemplateVariableDataSource {
  type: 'table';
  table: string;
  value_field: string;
  label_field?: string | null;
  filter_field?: string | null;
  filter_value?: unknown;
  sort_order?: 'asc' | 'desc';
}

export interface ITemplateVariableDefinition {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  group_label?: string | null;
  template_types: string[];
  variable_type: TTemplateVariableType;
  input_type: TTemplateVariableInputType;
  default_value?: string | null;
  data_source?: ITemplateVariableDataSource | null;
  ui_config?: Record<string, unknown> | null;
  sort_order: number;
  is_active: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IListTemplateVariablesParams {
  search?: string;
  is_active?: boolean;
  template_type?: string;
  variable_type?: TTemplateVariableType;
  input_type?: TTemplateVariableInputType;
  source_table?: string;
  document_render_mode?: 'structured' | 'raw_html';
  page?: number;
  page_size?: number;
}

export interface IUpsertTemplateVariablePayload {
  key: string;
  label: string;
  description?: string | null;
  group_label?: string | null;
  template_types: string[];
  variable_type?: TTemplateVariableType;
  input_type: TTemplateVariableInputType;
  default_value?: string | null;
  data_source?: ITemplateVariableDataSource | null;
  ui_config?: Record<string, unknown> | null;
  sort_order?: number;
  is_active?: boolean;
}

const TEMPLATE_VARIABLES_BASE_URL = '/api/v1/templates/template-variables';

export type IUpdateTemplateVariableSettingsPayload = Partial<ITemplateVariableRenderSettings>;

export const listTemplateVariablesAPI = async (
  params?: IListTemplateVariablesParams,
): Promise<{ data: ITemplateVariableDefinition[]; pagination: IPagination }> => {
  return API.get<{ data: ITemplateVariableDefinition[]; pagination: IPagination }>(TEMPLATE_VARIABLES_BASE_URL, {
    params,
  }).then((response) => response.data);
};

export const getTemplateVariableByIdAPI = async (id: string): Promise<ITemplateVariableDefinition> => {
  return API.get<{ data: ITemplateVariableDefinition }>(`${TEMPLATE_VARIABLES_BASE_URL}/${id}`).then(
    (response) => response.data.data,
  );
};

export const createTemplateVariableAPI = async (
  payload: IUpsertTemplateVariablePayload,
): Promise<ITemplateVariableDefinition> => {
  return API.post<{ data: ITemplateVariableDefinition }>(TEMPLATE_VARIABLES_BASE_URL, payload).then(
    (response) => response.data.data,
  );
};

export const updateTemplateVariableAPI = async (
  id: string,
  payload: Partial<IUpsertTemplateVariablePayload>,
): Promise<ITemplateVariableDefinition> => {
  return API.patch<{ data: ITemplateVariableDefinition }>(`${TEMPLATE_VARIABLES_BASE_URL}/${id}`, payload).then(
    (response) => response.data.data,
  );
};

export const deleteTemplateVariableAPI = async (id: string): Promise<void> => {
  return API.delete(`${TEMPLATE_VARIABLES_BASE_URL}/${id}`).then(() => undefined);
};

export const listArtifactVariableProfilesAPI = async (params?: {
  artifact_type?: TArtifactVariableProfileType;
  is_active?: boolean;
}): Promise<IArtifactVariableProfile[]> => {
  return API.get<{ data: IArtifactVariableProfile[] }>(`${TEMPLATE_VARIABLES_BASE_URL}/artifact-profiles`, {
    params,
  }).then((response) => response.data.data);
};

export const createArtifactVariableProfileAPI = async (
  payload: Omit<IArtifactVariableProfile, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>,
): Promise<IArtifactVariableProfile> => {
  return API.post<{ data: IArtifactVariableProfile }>(`${TEMPLATE_VARIABLES_BASE_URL}/artifact-profiles`, payload).then(
    (response) => response.data.data,
  );
};

export const updateArtifactVariableProfileAPI = async (
  id: string,
  payload: Partial<Omit<IArtifactVariableProfile, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>,
): Promise<IArtifactVariableProfile> => {
  return API.patch<{ data: IArtifactVariableProfile }>(
    `${TEMPLATE_VARIABLES_BASE_URL}/artifact-profiles/${id}`,
    payload,
  ).then((response) => response.data.data);
};

export const deleteArtifactVariableProfileAPI = async (id: string): Promise<void> => {
  return API.delete(`${TEMPLATE_VARIABLES_BASE_URL}/artifact-profiles/${id}`).then(() => undefined);
};

let pendingTemplateVariableSettingsRequest: Promise<ITemplateVariableRenderSettings> | null = null;

export const getTemplateVariableSettingsAPI = async (): Promise<ITemplateVariableRenderSettings> => {
  if (pendingTemplateVariableSettingsRequest) {
    return pendingTemplateVariableSettingsRequest;
  }

  pendingTemplateVariableSettingsRequest = API.get<{ data: ITemplateVariableRenderSettings }>(
    `${TEMPLATE_VARIABLES_BASE_URL}/settings`,
  )
    .then((response) => response.data.data)
    .finally(() => {
      pendingTemplateVariableSettingsRequest = null;
    });

  return pendingTemplateVariableSettingsRequest;
};

export const updateTemplateVariableSettingsAPI = async (
  payload: IUpdateTemplateVariableSettingsPayload,
): Promise<ITemplateVariableRenderSettings> => {
  return API.patch<{ data: ITemplateVariableRenderSettings }>(`${TEMPLATE_VARIABLES_BASE_URL}/settings`, payload).then(
    (response) => response.data.data,
  );
};
