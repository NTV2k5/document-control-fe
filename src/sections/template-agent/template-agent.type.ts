import type {
  ITemplateAgentChatResponse,
  ITemplateAgentUploadedFile,
  ITemplateAgentVariableDefinitionDraft,
  ITemplateAgentVariableDefinitionResult,
  TTemplateAgentStreamEvent,
} from 'api';

export interface ITemplateAgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: ITemplateAgentChatResponse;
  created_at?: number;
  attachments?: ITemplateAgentMessageAttachment[];
}

export interface ITemplateAgentFileState extends ITemplateAgentUploadedFile {
  local_name: string;
  preview_url?: string;
}

export interface ITemplateAgentMessageAttachment extends ITemplateAgentFileState {}

export interface ITemplateAgentProgressEvent {
  id: string;
  created_at: number;
  event: TTemplateAgentStreamEvent;
}

export interface ITemplateAgentChatSession {
  id: string;
  title: string;
  updated_at: number;
  messages: ITemplateAgentMessage[];
  progress_events: ITemplateAgentProgressEvent[];
  previous_response_id?: string;
  last_variables: ITemplateAgentVariableDefinitionResult[];
  draft_variables: ITemplateAgentVariableDefinitionDraft[];
  is_running?: boolean;
  interrupted_at?: number;
}

export interface ITemplateAgentChatHistory {
  active_session_id?: string;
  sessions: ITemplateAgentChatSession[];
}

export interface ILegacyTemplateAgentChatHistory {
  messages: ITemplateAgentMessage[];
  progress_events?: ITemplateAgentProgressEvent[];
  previous_response_id?: string;
  last_variables: ITemplateAgentVariableDefinitionResult[];
  draft_variables: ITemplateAgentVariableDefinitionDraft[];
  is_running?: boolean;
  interrupted_at?: number;
}
