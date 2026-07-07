import { API } from 'reactjs-platform/utilities';

export type TArtifactType = 'rich_text' | 'spreadsheet' | 'presentation' | 'image_form';
export type TArtifactExportFormat = 'xlsx' | 'pptx' | 'pdf' | 'fods' | 'fodp' | 'html' | 'svg';

export interface IArtifactSourceUploadResponse {
  file_id: string;
  source_file_name: string;
  mime_type: string;
  artifact_type: TArtifactType;
  artifact_config: unknown;
  upload?: {
    bucket: string;
    path: string;
    size: number;
    etag: string;
  };
}

export interface IArtifactRenderPayload {
  artifact_type: TArtifactType;
  artifact_config?: unknown;
  artifact_state?: unknown;
  values?: Record<string, string>;
}

export interface IArtifactExportPayload extends IArtifactRenderPayload {
  output_format?: TArtifactExportFormat;
  file_name?: string;
}

export type TOfficeArtifactScope = 'template' | 'document';

export interface IOfficeArtifactConfigResponse {
  document_server_url: string;
  config: Record<string, unknown>;
  artifact_type: Extract<TArtifactType, 'spreadsheet' | 'presentation'>;
  document_type: 'cell' | 'slide';
  file_id: string;
  source_file_name: string;
  file_type: 'xlsx' | 'pptx';
  document_key: string;
}

export interface ICollaboraArtifactConfigResponse {
  access_token: string;
  access_token_ttl: number;
  artifact_type: Extract<TArtifactType, 'spreadsheet' | 'presentation'>;
  document_key: string;
  document_type: 'cell' | 'slide';
  file_id: string;
  file_type: 'xlsx' | 'pptx';
  iframe_url: string;
  mode: 'source' | 'preview';
  post_message_origin: string;
  provider: 'collabora';
  source_file_name: string;
  wopi_file_id: string;
  wopi_src: string;
}

const unwrapApiData = <T>(payload: T | { data: T }): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
};

export const uploadArtifactSourceAPI = async (file: File): Promise<IArtifactSourceUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return API.post<IArtifactSourceUploadResponse>('/api/v1/artifacts/source', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((response) => unwrapApiData(response.data));
};

export const previewArtifactAPI = async (
  payload: IArtifactRenderPayload,
): Promise<{ artifact_type: TArtifactType; html: string }> => {
  return API.post<{ artifact_type: TArtifactType; html: string }>('/api/v1/artifacts/preview', payload).then(
    (response) => unwrapApiData(response.data),
  );
};

export const exportArtifactAPI = async (payload: IArtifactExportPayload): Promise<Blob> => {
  return API.post('/api/v1/artifacts/export', payload, { responseType: 'blob' }).then((response) => response.data);
};

export const getOfficeArtifactConfigAPI = async (
  scope: TOfficeArtifactScope,
  id: string,
): Promise<IOfficeArtifactConfigResponse> => {
  return API.get<IOfficeArtifactConfigResponse | { data: IOfficeArtifactConfigResponse }>(
    '/api/v1/artifacts/office/config',
    { params: { scope, id } },
  ).then((response) => unwrapApiData(response.data));
};

export const getRenderedOfficeArtifactConfigAPI = async (
  scope: TOfficeArtifactScope,
  id: string,
  values: Record<string, string>,
): Promise<IOfficeArtifactConfigResponse> => {
  return API.post<IOfficeArtifactConfigResponse | { data: IOfficeArtifactConfigResponse }>(
    '/api/v1/artifacts/office/render-config',
    { scope, id, values },
  ).then((response) => unwrapApiData(response.data));
};

export const getRenderedCollaboraArtifactConfigAPI = async (
  scope: TOfficeArtifactScope,
  id: string,
  values: Record<string, string>,
  data?: Record<string, unknown>,
  artifact_state?: unknown,
): Promise<ICollaboraArtifactConfigResponse> => {
  return API.post<ICollaboraArtifactConfigResponse | { data: ICollaboraArtifactConfigResponse }>(
    '/api/v1/artifacts/collabora/render-config',
    { scope, id, values, data, artifact_state },
  ).then((response) => unwrapApiData(response.data));
};

export const getCollaboraArtifactConfigAPI = async (
  scope: TOfficeArtifactScope,
  id: string,
  mode: 'source' | 'preview',
): Promise<ICollaboraArtifactConfigResponse> => {
  return API.get<ICollaboraArtifactConfigResponse | { data: ICollaboraArtifactConfigResponse }>(
    '/api/v1/artifacts/collabora/config',
    { params: { scope, id, mode } },
  ).then((response) => unwrapApiData(response.data));
};

export const forceSaveOfficeArtifactAPI = async (
  scope: TOfficeArtifactScope,
  id: string,
  document_key?: string,
): Promise<{ key: string; result: unknown }> => {
  return API.post<{ key: string; result: unknown } | { data: { key: string; result: unknown } }>(
    '/api/v1/artifacts/office/forcesave',
    { scope, id, document_key },
  ).then((response) => unwrapApiData(response.data));
};

export const exportOfficeArtifactAPI = async (
  scope: TOfficeArtifactScope,
  id: string,
  format: 'xlsx' | 'pptx' | 'pdf',
): Promise<Blob> => {
  return API.get('/api/v1/artifacts/office/export', {
    params: { scope, id, format },
    responseType: 'blob',
  }).then((response) => response.data);
};
