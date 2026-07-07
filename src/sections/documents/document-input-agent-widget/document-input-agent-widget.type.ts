import type {
  IDocumentInputAgentAppliedDocument,
  IDocumentInputAgentChatPayload,
  IDocumentInputAgentChatResponse,
  IDocumentInputAgentFillDraft,
  IDocumentInputAgentSheetSelectionChoice,
  IDocumentInputAgentSheetSelectionRequest,
  IDocumentInputAgentUploadedFile,
  TDocumentInputAgentStreamEvent,
} from 'api';

export interface IWidgetFileState extends IDocumentInputAgentUploadedFile {
  local_name: string;
  preview_url?: string;
}

export interface IWidgetMessageAttachment extends IWidgetFileState {}

export interface IWidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: IDocumentInputAgentChatResponse;
  attachments?: IWidgetMessageAttachment[];
  created_at: number;
}

export interface IWidgetProgressEvent {
  id: string;
  created_at: number;
  event: TDocumentInputAgentStreamEvent;
}

export interface IWidgetSession {
  id: string;
  title: string;
  updated_at: number;
  messages: IWidgetMessage[];
  progress_events?: IWidgetProgressEvent[];
  previous_response_id?: string;
  llm_model?: string;
  fill_drafts?: IDocumentInputAgentFillDraft[];
  applied_documents?: IDocumentInputAgentAppliedDocument[];
}

export type TWidgetView = 'history' | 'chat';

export interface IWidgetCompatibilityWarning {
  score_percent: number;
  matched_count: number;
  total_count: number;
  message: string;
  sheet_selection?: IDocumentInputAgentSheetSelectionRequest;
  selected_sheet_selections: IDocumentInputAgentSheetSelectionChoice[];
  pendingPayload: IDocumentInputAgentChatPayload;
}
