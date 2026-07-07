import { API, API_ENDPOINT, CONFIGURATION, CookieService } from 'reactjs-platform/utilities';

export interface ITemplateAgentUploadedFile {
  file_id: string;
  original_name: string;
  mime_type: string;
  size: number;
}

export interface ITemplateAgentChatPayload {
  message: string;
  language?: 'vi' | 'en';
  file_ids?: string[];
  previous_response_id?: string;
  allow_apply?: boolean;
}

export interface ITemplateAgentToolCallTrace {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export type TTemplateAgentStreamEvent =
  | {
      type: 'status';
      message: string;
      phase?: string;
      round?: number;
      run_id?: string;
      duration_ms?: number;
    }
  | {
      type: 'response';
      response_id: string;
      output_types: string[];
      round?: number;
      duration_ms: number;
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
      response: ITemplateAgentChatResponse;
    }
  | {
      type: 'error';
      message: string;
    };

export interface ITemplateAgentChatResponse {
  response_id: string;
  model: string;
  output_text: string;
  tool_calls: ITemplateAgentToolCallTrace[];
  variable_definitions?: ITemplateAgentVariableDefinitionResult[];
  draft_variable_definitions?: ITemplateAgentVariableDefinitionDraft[];
  allow_apply: boolean;
}

export interface ITemplateAgentVariableDefinitionResult {
  id: string;
  key: string;
  label?: string;
  variable_type?: string;
  input_type?: string;
}

export interface ITemplateAgentVariableDefinitionDraft extends ITemplateAgentVariableDefinitionResult {
  category: string;
  file_name: string;
  definition: Record<string, unknown>;
}

export interface ITemplateAgentContext {
  workspace_root: string;
  source_repos: string[];
  template_variable_definitions: string;
  important_backend_paths: string[];
  important_frontend_paths: string[];
  write_tools_require_allow_apply: boolean;
  source_definition_write_enabled: boolean;
  guidance: string;
}

const TEMPLATE_AGENT_BASE_URL = '/api/v1/templates/template-agent';

export const getTemplateAgentContextAPI = async (): Promise<ITemplateAgentContext> => {
  return API.get<{ data: ITemplateAgentContext }>(`${TEMPLATE_AGENT_BASE_URL}/context`).then(
    (response) => response.data.data,
  );
};

export const uploadTemplateAgentFileAPI = async (file: File): Promise<ITemplateAgentUploadedFile> => {
  const formData = new FormData();
  formData.append('file', file);

  return API.post<{ data: ITemplateAgentUploadedFile }>(`${TEMPLATE_AGENT_BASE_URL}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }).then((response) => response.data.data);
};

export interface ITemplateAgentRunToolPayload {
  arguments?: Record<string, unknown>;
  allow_apply?: boolean;
}

export const chatTemplateAgentAPI = async (payload: ITemplateAgentChatPayload): Promise<ITemplateAgentChatResponse> => {
  return API.post<{ data: ITemplateAgentChatResponse }>(`${TEMPLATE_AGENT_BASE_URL}/chat`, payload).then(
    (response) => response.data.data,
  );
};

const getTemplateAgentStreamHeaders = () => {
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

const parseTemplateAgentStreamFrame = (frame: string): TTemplateAgentStreamEvent | null => {
  const dataLines = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return JSON.parse(dataLines.join('\n')) as TTemplateAgentStreamEvent;
};

export const streamTemplateAgentChatAPI = async (
  payload: ITemplateAgentChatPayload,
  onEvent: (event: TTemplateAgentStreamEvent) => void,
): Promise<void> => {
  const response = await fetch(`${API_ENDPOINT}${TEMPLATE_AGENT_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: getTemplateAgentStreamHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Template agent stream failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferedText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bufferedText += decoder.decode(value, { stream: true });
    const frames = bufferedText.split(/\n\n/);
    bufferedText = frames.pop() ?? '';

    frames.forEach((frame) => {
      const event = parseTemplateAgentStreamFrame(frame.trim());
      if (event) {
        onEvent(event);
      }
    });
  }

  bufferedText += decoder.decode();
  const tailEvent = parseTemplateAgentStreamFrame(bufferedText.trim());
  if (tailEvent) {
    onEvent(tailEvent);
  }
};

export const runTemplateAgentToolAPI = async <TResponse = unknown>(
  name: string,
  payload: ITemplateAgentRunToolPayload,
): Promise<TResponse> => {
  return API.post<{ data: TResponse }>(`${TEMPLATE_AGENT_BASE_URL}/tools/${name}`, payload).then(
    (response) => response.data.data,
  );
};
