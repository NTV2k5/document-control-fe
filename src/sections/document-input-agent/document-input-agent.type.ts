import type {
  IDocumentInputAgentAppliedDocument,
  IDocumentInputAgentChatResponse,
  IDocumentInputAgentFillDraft,
  IDocumentInputAgentUploadedFile,
  TDocumentInputAgentStreamEvent,
} from 'api';

export interface IDocumentInputAgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: IDocumentInputAgentChatResponse;
  created_at?: number;
  attachments?: IDocumentInputAgentMessageAttachment[];
}

export interface IDocumentInputAgentFileState extends IDocumentInputAgentUploadedFile {
  local_name: string;
  preview_url?: string;
}

export interface IDocumentInputAgentMessageAttachment extends IDocumentInputAgentFileState {}

export interface IDocumentInputAgentProgressEvent {
  id: string;
  created_at: number;
  event: TDocumentInputAgentStreamEvent;
}

export interface IDocumentInputAgentChatSession {
  id: string;
  title: string;
  updated_at: number;
  messages: IDocumentInputAgentMessage[];
  progress_events: IDocumentInputAgentProgressEvent[];
  previous_response_id?: string;
  llm_model?: string;
  fill_drafts: IDocumentInputAgentFillDraft[];
  applied_documents: IDocumentInputAgentAppliedDocument[];
  is_running?: boolean;
  interrupted_at?: number;
  is_read_only?: boolean;
  is_summary?: boolean;
}

export interface IDocumentInputAgentChatHistory {
  active_session_id?: string;
  sessions: IDocumentInputAgentChatSession[];
}

export interface ILegacyDocumentInputAgentChatHistory {
  messages: IDocumentInputAgentMessage[];
  progress_events?: IDocumentInputAgentProgressEvent[];
  previous_response_id?: string;
  llm_model?: string;
  fill_drafts?: IDocumentInputAgentFillDraft[];
  applied_documents?: IDocumentInputAgentAppliedDocument[];
  is_running?: boolean;
  interrupted_at?: number;
}
