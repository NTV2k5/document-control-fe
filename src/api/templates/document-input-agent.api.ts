import { API, API_ENDPOINT, CONFIGURATION, CookieService, type IPagination } from 'reactjs-platform/utilities';

export interface IDocumentInputAgentUploadedFile {
  file_id: string;
  original_name: string;
  mime_type: string;
  size: number;
}

export interface IDocumentInputAgentChatPayload {
  message: string;
  language?: 'vi' | 'en';
  file_ids?: string[];
  previous_response_id?: string;
  llm_model?: string;
  allow_apply?: boolean;
  skip_compatibility_check?: boolean;
  template_id?: string;
  sheet_selection?: IDocumentInputAgentSheetSelectionPayload;
}

export interface IDocumentInputAgentToolCallTrace {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  evidence?: Record<string, unknown>;
}

export interface IDocumentInputAgentUsageCost {
  currency: 'USD';
  input_usd: number;
  output_usd: number;
  total_usd: number;
  input_usd_per_1m_tokens: number;
  output_usd_per_1m_tokens: number;
  is_configured: boolean;
}

export interface IDocumentInputAgentTokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cached_input_tokens?: number;
  reasoning_output_tokens?: number;
}

export interface IDocumentInputAgentUsageItem extends IDocumentInputAgentTokenUsage {
  response_id: string;
  model: string;
  phase: string;
  round?: number;
  duration_ms?: number;
  cost: IDocumentInputAgentUsageCost;
}

export interface IDocumentInputAgentUsageSummary extends IDocumentInputAgentTokenUsage {
  response_count: number;
  cost: IDocumentInputAgentUsageCost;
  items: IDocumentInputAgentUsageItem[];
}

export interface IDocumentInputAgentResolvedField {
  key: string;
  value: unknown;
  source_table?: string;
  source_field?: string;
  source_record_id?: string;
  confidence?: number;
  reason?: string;
}

export interface IDocumentInputAgentFillDefinition {
  template_id: string;
  document_id?: string;
  title?: string;
  description?: string;
  values: Record<string, unknown>;
  document_template_values?: Record<string, Record<string, unknown>>;
  table_blocks?: Record<string, Record<string, Array<Record<string, unknown>>>>;
  var_types?: Record<string, string>;
  var_titles?: Record<string, string>;
  source_file_ids?: string[];
  evidence?: Record<string, unknown>;
  resolved_fields?: IDocumentInputAgentResolvedField[];
  unresolved_fields?: Array<{
    key: string;
    reason: string;
  }>;
  warnings?: string[];
}

export interface IDocumentInputAgentFillDraft {
  id: string;
  key: string;
  template_id: string;
  template_name: string;
  title: string;
  definition: IDocumentInputAgentFillDefinition;
  resolved_fields: IDocumentInputAgentResolvedField[];
  unresolved_fields: Array<{
    key: string;
    reason: string;
  }>;
  warnings: string[];
  preview: true;
  applied: false;
}

export interface IDocumentInputAgentAppliedDocument {
  id: string;
  key: string;
  document_id: string;
  template_id: string;
  title: string;
  status?: string;
  updated_at?: string;
}

export type TDocumentInputAgentStreamEvent =
  | {
      type: 'status';
      message: string;
      phase?: string;
      round?: number;
      attempt?: number;
      max_attempts?: number;
      stage?: string;
      detail?: unknown;
      recoverable?: boolean;
      run_id?: string;
      duration_ms?: number;
    }
  | {
      type: 'response';
      response_id: string;
      output_types: string[];
      round?: number;
      duration_ms: number;
      usage?: IDocumentInputAgentUsageItem;
    }
  | {
      type: 'reasoning';
      response_id: string;
      summary: string;
      round?: number;
    }
  | {
      type: 'tool_call';
      name: string;
      call_id: string;
      arguments: Record<string, unknown>;
      round: number;
    }
  | {
      type: 'tool_result';
      name: string;
      call_id: string;
      result: unknown;
      round: number;
      ok: boolean;
      duration_ms: number;
    }
  | {
      type: 'message';
      text: string;
    }
  | {
      type: 'done';
      response: IDocumentInputAgentChatResponse;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'compatibility_check';
      status: 'pass' | 'warning' | 'blocked';
      score_percent: number;
      matched_count: number;
      total_count: number;
      matched_variables: string[];
      unmatched_variables: string[];
      message: string;
      sheet_selection?: IDocumentInputAgentSheetSelectionRequest;
    };

export interface IDocumentInputAgentCompatibilityScore {
  score_percent: number;
  matched_count: number;
  total_count: number;
  matched_variables: string[];
  unmatched_variables: string[];
}

export interface IDocumentInputAgentCompatibilityResult {
  status: 'pass' | 'warning' | 'blocked';
  score: IDocumentInputAgentCompatibilityScore;
  message: string;
  sheet_selection?: IDocumentInputAgentSheetSelectionRequest;
}

export interface IDocumentInputAgentSheetSelectionChoice {
  template_sheet: string;
  source_sheet: string;
  file_id?: string;
  file_name?: string;
}

export interface IDocumentInputAgentSheetSelectionPayload {
  selections: IDocumentInputAgentSheetSelectionChoice[];
}

export interface IDocumentInputAgentSheetSelectionOption extends IDocumentInputAgentSheetSelectionChoice {
  score_percent: number;
  binding_coverage_percent: number;
  nonblank_coverage_percent: number;
  header_score: number;
  recommended?: boolean;
}

export interface IDocumentInputAgentSheetSelectionGroup {
  template_sheet: string;
  selected_source_sheet?: string;
  selected_file_id?: string;
  options: IDocumentInputAgentSheetSelectionOption[];
}

export interface IDocumentInputAgentSheetSelectionRequest {
  required: boolean;
  reason: 'multiple_candidate_sheets' | 'ambiguous_candidate_sheets';
  selections: IDocumentInputAgentSheetSelectionGroup[];
}

export interface IDocumentInputAgentChatResponse {
  response_id: string;
  model: string;
  output_text: string;
  tool_calls: IDocumentInputAgentToolCallTrace[];
  fill_drafts?: IDocumentInputAgentFillDraft[];
  applied_documents?: IDocumentInputAgentAppliedDocument[];
  allow_apply: boolean;
  usage?: IDocumentInputAgentUsageSummary;
  compatibility_warning?: IDocumentInputAgentCompatibilityResult;
}

export interface IDocumentInputAgentContext {
  workspace_root: string;
  agent: string;
  supported_uploads: string[];
  write_tools_require_allow_apply: boolean;
  guidance: string;
  important_payload_keys: string[];
  allowed_db_tables: string[];
  example: string;
}

export interface IDocumentInputAgentRunToolPayload {
  arguments?: Record<string, unknown>;
  allow_apply?: boolean;
}

export interface IDocumentInputAgentChatHistoryPayload {
  active_session_id?: string;
  sessions: unknown[];
  scope?: 'own' | 'user' | 'all_users';
  read_only?: boolean;
  user_count?: number;
}

export interface IDocumentInputAgentChatHistorySessionSummary {
  id: string;
  title: string;
  updated_at: number;
  message_count: number;
  progress_event_count: number;
  fill_draft_count: number;
  applied_document_count: number;
  latest_message_preview: string | null;
}

export interface IDocumentInputAgentChatHistoryUser {
  user_id: string;
  user_email: string | null;
  updated_at: string | null;
  session_count: number;
  message_count: number;
  latest_session_title: string | null;
  latest_message_preview: string | null;
  sessions: IDocumentInputAgentChatHistorySessionSummary[];
}

export interface IDocumentInputAgentChatHistoryMessage {
  id?: string;
  role?: string;
  content?: string;
  created_at?: number;
  attachments?: Array<{
    file_id?: string;
    original_name?: string;
    local_name?: string;
    mime_type?: string;
    size?: number;
  }>;
}

export interface IDocumentInputAgentChatHistorySession {
  id: string;
  title: string;
  updated_at: number;
  messages?: IDocumentInputAgentChatHistoryMessage[];
  progress_events?: unknown[];
  fill_drafts?: unknown[];
  applied_documents?: unknown[];
  history_owner_user_id?: string;
  history_owner_email?: string | null;
}

export interface IDocumentInputAgentChatHistoryUserDetail {
  user_id: string;
  user_email: string | null;
  updated_at: string | null;
  session_count: number;
  message_count: number;
  history: {
    active_session_id?: string;
    sessions: IDocumentInputAgentChatHistorySession[];
    scope: 'user';
    read_only: true;
  };
}

export interface IListDocumentInputAgentChatHistoryUsersParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export type TDocumentInputAgentSettingSource = 'database' | 'environment' | 'user' | 'none';
export type TDocumentInputAgentLlmConfigScope = 'global' | 'user';
export type TDocumentInputAgentReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface IDocumentInputAgentSettings {
  model: string;
  model_options: string[];
  reasoning_effort: TDocumentInputAgentReasoningEffort;
  reasoning_effort_options: TDocumentInputAgentReasoningEffort[];
  document_input_agent_enabled: boolean;
  document_input_agent_widget_enabled: boolean;
  template_agent_enabled: boolean;
  use_global_llm_config: boolean;
  llm_config_scope: TDocumentInputAgentLlmConfigScope;
  active_llm_config_scope: TDocumentInputAgentLlmConfigScope;
  can_manage_global_settings: boolean;
  can_update_user_llm_config: boolean;
  open_ai_api_key: {
    masked_value: string;
    is_configured: boolean;
    source: TDocumentInputAgentSettingSource;
  };
  proxy_url_llm: {
    value: string;
    is_configured: boolean;
    source: TDocumentInputAgentSettingSource;
  };
  effective_open_ai_api_key?: {
    masked_value: string;
    is_configured: boolean;
    source: TDocumentInputAgentSettingSource;
  };
  effective_proxy_url_llm?: {
    value: string;
    is_configured: boolean;
    source: TDocumentInputAgentSettingSource;
  };
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface IUpdateDocumentInputAgentSettingsPayload {
  llm_config_scope?: TDocumentInputAgentLlmConfigScope;
  model?: string;
  reasoning_effort?: TDocumentInputAgentReasoningEffort;
  document_input_agent_enabled?: boolean;
  document_input_agent_widget_enabled?: boolean;
  template_agent_enabled?: boolean;
  use_global_llm_config?: boolean;
  open_ai_api_key?: string;
  proxy_url_llm?: string;
}

const DOCUMENT_INPUT_AGENT_BASE_URL = '/api/v1/templates/document-input-agent';
export const DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT = 'document-input-agent-settings-updated';

export const getDocumentInputAgentContextAPI = async (): Promise<IDocumentInputAgentContext> => {
  return API.get<{ data: IDocumentInputAgentContext }>(`${DOCUMENT_INPUT_AGENT_BASE_URL}/context`).then(
    (response) => response.data.data,
  );
};

export const uploadDocumentInputAgentFileAPI = async (file: File): Promise<IDocumentInputAgentUploadedFile> => {
  const formData = new FormData();
  formData.append('file', file);

  return API.post<{ data: IDocumentInputAgentUploadedFile }>(`${DOCUMENT_INPUT_AGENT_BASE_URL}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }).then((response) => response.data.data);
};

export const chatDocumentInputAgentAPI = async (
  payload: IDocumentInputAgentChatPayload,
): Promise<IDocumentInputAgentChatResponse> => {
  return API.post<{ data: IDocumentInputAgentChatResponse }>(`${DOCUMENT_INPUT_AGENT_BASE_URL}/chat`, payload).then(
    (response) => response.data.data,
  );
};

export const getDocumentInputAgentChatHistoryAPI = async (): Promise<IDocumentInputAgentChatHistoryPayload | null> => {
  return API.get<{ data: IDocumentInputAgentChatHistoryPayload | null }>(
    `${DOCUMENT_INPUT_AGENT_BASE_URL}/history`,
  ).then((response) => response.data.data);
};

export const getDocumentInputAgentChatHistorySummaryAPI =
  async (): Promise<IDocumentInputAgentChatHistoryPayload | null> => {
    return API.get<{ data: IDocumentInputAgentChatHistoryPayload | null }>(
      `${DOCUMENT_INPUT_AGENT_BASE_URL}/history/summary`,
    ).then((response) => response.data.data);
  };

export const getDocumentInputAgentChatHistorySessionAPI = async (
  sessionId: string,
): Promise<IDocumentInputAgentChatHistoryPayload | null> => {
  return API.get<{ data: IDocumentInputAgentChatHistoryPayload | null }>(
    `${DOCUMENT_INPUT_AGENT_BASE_URL}/history/sessions/${encodeURIComponent(sessionId)}`,
  ).then((response) => response.data.data);
};

export const getDocumentInputAgentChatHistoryUsersAPI = async (
  params?: IListDocumentInputAgentChatHistoryUsersParams,
): Promise<{ data: IDocumentInputAgentChatHistoryUser[]; pagination: IPagination }> => {
  return API.get<{ data: IDocumentInputAgentChatHistoryUser[]; pagination: IPagination }>(
    `${DOCUMENT_INPUT_AGENT_BASE_URL}/history/users`,
    { params },
  ).then((response) => response.data);
};

export const getDocumentInputAgentChatHistoryUserAPI = async (
  userId: string,
): Promise<IDocumentInputAgentChatHistoryUserDetail | null> => {
  return API.get<{ data: IDocumentInputAgentChatHistoryUserDetail | null }>(
    `${DOCUMENT_INPUT_AGENT_BASE_URL}/history/users/${encodeURIComponent(userId)}`,
  ).then((response) => response.data.data);
};

export const getDocumentInputAgentSettingsAPI = async (): Promise<IDocumentInputAgentSettings> => {
  return API.get<{ data: IDocumentInputAgentSettings }>(`${DOCUMENT_INPUT_AGENT_BASE_URL}/settings`).then(
    (response) => response.data.data,
  );
};

export const updateDocumentInputAgentSettingsAPI = async (
  payload: IUpdateDocumentInputAgentSettingsPayload,
): Promise<IDocumentInputAgentSettings> => {
  return API.patch<{ data: IDocumentInputAgentSettings }>(`${DOCUMENT_INPUT_AGENT_BASE_URL}/settings`, payload).then(
    (response) => response.data.data,
  );
};

export const saveDocumentInputAgentChatHistoryAPI = async (
  history: IDocumentInputAgentChatHistoryPayload,
): Promise<void> => {
  await API.post(`${DOCUMENT_INPUT_AGENT_BASE_URL}/history`, { history });
};

export const saveDocumentInputAgentChatHistorySessionAPI = async (
  sessionId: string,
  session: unknown,
  activeSessionId?: string,
): Promise<void> => {
  await API.post(`${DOCUMENT_INPUT_AGENT_BASE_URL}/history/sessions/${encodeURIComponent(sessionId)}`, {
    session,
    active_session_id: activeSessionId,
  });
};

export const deleteDocumentInputAgentChatHistoryAPI = async (): Promise<void> => {
  await API.delete(`${DOCUMENT_INPUT_AGENT_BASE_URL}/history`);
};

export const deleteDocumentInputAgentChatHistorySessionAPI = async (sessionId: string): Promise<void> => {
  await API.delete(`${DOCUMENT_INPUT_AGENT_BASE_URL}/history/sessions/${encodeURIComponent(sessionId)}`);
};

const getDocumentInputAgentStreamHeaders = () => {
  const token = CookieService.getItem<string>(CONFIGURATION.ACCESS_TOKEN_LS_KEY);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json;charset=UTF-8',
    Accept: 'text/event-stream',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const parseDocumentInputAgentStreamFrame = (frame: string): TDocumentInputAgentStreamEvent | null => {
  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return JSON.parse(dataLines.join('\n')) as TDocumentInputAgentStreamEvent;
};

const DOCUMENT_INPUT_AGENT_STREAM_NETWORK_ERROR_NAME = 'DocumentInputAgentStreamNetworkError';

const isFetchStreamNetworkError = (error: unknown) =>
  error instanceof TypeError && /network|fetch|load failed|failed to fetch/i.test(error.message);

const createDocumentInputAgentStreamNetworkError = () => {
  const error = new Error('Document input agent stream connection was interrupted before the final response.');
  error.name = DOCUMENT_INPUT_AGENT_STREAM_NETWORK_ERROR_NAME;
  return error;
};

export const isDocumentInputAgentStreamNetworkError = (error: unknown) =>
  error instanceof Error && error.name === DOCUMENT_INPUT_AGENT_STREAM_NETWORK_ERROR_NAME;

export const streamDocumentInputAgentChatAPI = async (
  payload: IDocumentInputAgentChatPayload,
  onEvent: (event: TDocumentInputAgentStreamEvent) => void,
  options: { signal?: AbortSignal } = {},
): Promise<void> => {
  const response = await fetch(`${API_ENDPOINT}${DOCUMENT_INPUT_AGENT_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: getDocumentInputAgentStreamHeaders(),
    body: JSON.stringify(payload),
    signal: options.signal,
  }).catch((error) => {
    if (options.signal?.aborted || !isFetchStreamNetworkError(error)) {
      throw error;
    }
    throw createDocumentInputAgentStreamNetworkError();
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Document input agent stream failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferedText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bufferedText += decoder.decode(value, { stream: true });
      const frames = bufferedText.split(/\n\n/);
      bufferedText = frames.pop() ?? '';

      frames.forEach((frame) => {
        const event = parseDocumentInputAgentStreamFrame(frame.trim());
        if (event) {
          onEvent(event);
        }
      });
    }
  } catch (error) {
    if (options.signal?.aborted || !isFetchStreamNetworkError(error)) {
      throw error;
    }
    throw createDocumentInputAgentStreamNetworkError();
  }

  bufferedText += decoder.decode();
  const tailEvent = parseDocumentInputAgentStreamFrame(bufferedText.trim());
  if (tailEvent) {
    onEvent(tailEvent);
  }
};

export const runDocumentInputAgentToolAPI = async <TResponse = unknown>(
  name: string,
  payload: IDocumentInputAgentRunToolPayload,
): Promise<TResponse> => {
  return API.post<{ data: TResponse }>(`${DOCUMENT_INPUT_AGENT_BASE_URL}/tools/${name}`, payload).then(
    (response) => response.data.data,
  );
};
