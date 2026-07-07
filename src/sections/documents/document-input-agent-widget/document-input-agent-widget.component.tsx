import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  Clock,
  Trash2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  PenSquare,
  Plus,
  Search,
  Square,
  Upload,
  X,
} from 'lucide-react';
import {
  DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT,
  deleteDocumentInputAgentChatHistorySessionAPI,
  isDocumentInputAgentStreamNetworkError,
  runDocumentInputAgentToolAPI,
  getDocumentInputAgentChatHistorySessionAPI,
  getDocumentInputAgentChatHistorySummaryAPI,
  getDocumentInputAgentSettingsAPI,
  saveDocumentInputAgentChatHistorySessionAPI,
  streamDocumentInputAgentChatAPI,
  uploadDocumentInputAgentFileAPI,
  type IDocumentInputAgentAppliedDocument,
  type IDocumentInputAgentChatResponse,
  type IDocumentInputAgentFillDraft,
  type IDocumentInputAgentSettings,
  type IDocumentInputAgentSheetSelectionChoice,
  type IDocumentInputAgentSheetSelectionRequest,
  type TDocumentInputAgentStreamEvent,
} from 'api';
import { useTranslation } from '../../../i18n';
import { DocumentInputAgentTemplateSelector } from '../../document-input-agent/document-input-agent-template-selector.component';
import type { IDocumentInputAgentSelectedTemplate } from '../../document-input-agent/document-input-agent-action.type';
import { useDocumentInputAgentActions } from '../../document-input-agent/use-document-input-agent-actions.hook';
import { DocumentInputAgentWidgetChat } from './document-input-agent-widget-chat.component';
import type {
  IWidgetCompatibilityWarning,
  IWidgetFileState,
  IWidgetMessage,
  IWidgetMessageAttachment,
  IWidgetProgressEvent,
  IWidgetSession,
  TWidgetView,
} from './document-input-agent-widget.type';

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const MAX_VISIBLE_HISTORY = 5;
const ACCEPTED_FILE_TYPES = '.docx,.txt,.md,.xlsx,.csv,.pptx,image/png,image/jpeg,image/webp,image/gif';
const MAX_AGENT_FILES = 10;
const MAX_LIVE_STEPS = 6;
const MAX_STORED_PROGRESS_EVENTS = 80;
const MAX_STORED_PROGRESS_VALUE_CHARS = 1_800;
const LONG_TEXT_ATTACHMENT_MIN_CHARS = 6_000;
const LONG_TEXT_PREVIEW_CHARS = 1_200;

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const formatAgentRunErrorMessage = (error: unknown, fallback: string) =>
  isDocumentInputAgentStreamNetworkError(error) ? fallback : formatErrorMessage(error);

const buildSessionTitle = (messages: IWidgetMessage[], fallback: string) => {
  const firstUserMessage = messages.find((item) => item.role === 'user')?.content.trim();
  if (!firstUserMessage) return fallback;
  return firstUserMessage.length > 48 ? `${firstUserMessage.slice(0, 48)}...` : firstUserMessage;
};

const createMessageAttachments = (files: IWidgetFileState[]): IWidgetMessageAttachment[] =>
  files.map((file) => ({ ...file }));

const createPlainTextFile = (content: string, fileName = 'van-ban-da-dan.txt') =>
  new File([content], fileName, {
    type: 'text/plain;charset=utf-8',
    lastModified: Date.now(),
  });

const isLongTextInput = (value: string) => value.trim().length >= LONG_TEXT_ATTACHMENT_MIN_CHARS;

const getLongTextMessagePreview = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > LONG_TEXT_PREVIEW_CHARS ? `${trimmed.slice(0, LONG_TEXT_PREVIEW_CHARS)}...` : trimmed;
};

const getLongTextAttachmentMessage = (locale: string) =>
  locale === 'vi'
    ? 'Nội dung nhập dài đã được chuyển thành tệp văn bản đính kèm. Hãy đọc tệp văn bản đó như nguồn dữ liệu chính và xử lý theo yêu cầu.'
    : 'The long input was converted into an attached text file. Read that text file as the primary data source and process the request.';

const getLongTextPreviewPrefix = (locale: string) => (locale === 'vi' ? 'Trích đoạn đầu:' : 'Preview excerpt:');

const sanitizeMessageForRemoteHistory = (message: IWidgetMessage): IWidgetMessage => ({
  ...message,
  attachments: message.attachments?.map(({ preview_url: _previewUrl, ...attachment }) => attachment),
});

const sanitizeProgressValueForRemoteHistory = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length > MAX_STORED_PROGRESS_VALUE_CHARS
      ? `${value.slice(0, MAX_STORED_PROGRESS_VALUE_CHARS)}...`
      : value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeProgressValueForRemoteHistory);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeProgressValueForRemoteHistory(entry)]),
    );
  }

  return value;
};

const sanitizeProgressEventsForRemoteHistory = (progressEvents: IWidgetProgressEvent[]) =>
  progressEvents.slice(-MAX_STORED_PROGRESS_EVENTS).map((progressEvent) => ({
    ...progressEvent,
    event: sanitizeProgressValueForRemoteHistory(progressEvent.event) as TDocumentInputAgentStreamEvent,
  }));

const getLiveStepText = (event: TDocumentInputAgentStreamEvent, locale: string) => {
  const isVietnamese = locale === 'vi';
  if (event.type === 'status') return event.message;
  if (event.type === 'reasoning') return event.summary;
  if (event.type === 'tool_call') return isVietnamese ? `Đang gọi tool ${event.name}...` : `Calling ${event.name}...`;
  if (event.type === 'tool_result') {
    if (event.ok) return isVietnamese ? `${event.name} hoàn tất` : `${event.name} done`;
    return isVietnamese ? `${event.name} lỗi` : `${event.name} failed`;
  }
  if (event.type === 'error') return isVietnamese ? `Lỗi: ${event.message}` : `Error: ${event.message}`;
  return undefined;
};

const buildLiveAssistantContent = (steps: string[], locale: string) =>
  [locale === 'vi' ? 'Đang xử lý...' : 'Processing...', '', ...steps.map((step) => `- ${step}`)].join('\n');

const revokeFilePreviews = (files: Array<{ preview_url?: string }>) => {
  files.forEach((file) => {
    if (file.preview_url) URL.revokeObjectURL(file.preview_url);
  });
};

const revokeMessageAttachmentPreviews = (messages: IWidgetMessage[]) => {
  messages.forEach((message) => revokeFilePreviews(message.attachments ?? []));
};

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

const isSpreadsheetFile = (file: Pick<IWidgetFileState, 'local_name' | 'original_name' | 'mime_type'>) => {
  const name = `${file.local_name || file.original_name}`.toLowerCase();
  const mimeType = file.mime_type || '';
  return (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  );
};

const getFileKindLabel = (
  file: Pick<IWidgetFileState, 'local_name' | 'original_name' | 'mime_type'>,
  locale: string,
) => {
  const name = `${file.local_name || file.original_name}`.toLowerCase();
  const mimeType = file.mime_type || '';
  const isVietnamese = locale === 'vi';
  if (isSpreadsheetFile(file)) return isVietnamese ? 'Bảng tính' : 'Spreadsheet';
  if (mimeType.startsWith('image/')) return isVietnamese ? 'Hình ảnh' : 'Image';
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) return isVietnamese ? 'Bản trình chiếu' : 'Presentation';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return isVietnamese ? 'Tài liệu' : 'Document';
  if (mimeType.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    return isVietnamese ? 'Văn bản' : 'Text';
  }
  return isVietnamese ? 'Tệp' : 'File';
};

const createDefaultSheetSelections = (
  sheetSelection?: IDocumentInputAgentSheetSelectionRequest,
): IDocumentInputAgentSheetSelectionChoice[] =>
  sheetSelection?.selections
    .map<IDocumentInputAgentSheetSelectionChoice | null>((group) => {
      const option =
        group.options.find((item) => item.recommended) ??
        group.options.find(
          (item) => item.source_sheet === group.selected_source_sheet && item.file_id === group.selected_file_id,
        ) ??
        group.options[0];

      if (!option) return null;

      return {
        template_sheet: group.template_sheet,
        source_sheet: option.source_sheet,
        file_id: option.file_id,
        file_name: option.file_name,
      };
    })
    .filter((item): item is IDocumentInputAgentSheetSelectionChoice => Boolean(item)) ?? [];

const encodeSheetSelectionOption = (option: IDocumentInputAgentSheetSelectionChoice) =>
  JSON.stringify({
    template_sheet: option.template_sheet,
    source_sheet: option.source_sheet,
    file_id: option.file_id,
    file_name: option.file_name,
  });

const decodeSheetSelectionOption = (value: string): IDocumentInputAgentSheetSelectionChoice | null => {
  try {
    const parsed = JSON.parse(value) as Partial<IDocumentInputAgentSheetSelectionChoice>;
    if (!parsed.template_sheet || !parsed.source_sheet) return null;
    return {
      template_sheet: parsed.template_sheet,
      source_sheet: parsed.source_sheet,
      file_id: parsed.file_id,
      file_name: parsed.file_name,
    };
  } catch {
    return null;
  }
};

export const DocumentInputAgentWidget = () => {
  const navigate = useNavigate();
  const { locale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isWidgetEnabled, setIsWidgetEnabled] = useState(true);
  const [view, setView] = useState<TWidgetView>('history');
  const [historySearch, setHistorySearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sessions, setSessions] = useState<IWidgetSession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [sessionPendingDelete, setSessionPendingDelete] = useState<IWidgetSession | null>(null);

  // Chat state
  const [messages, setMessages] = useState<IWidgetMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(() => createId());
  const [progressEvents, setProgressEvents] = useState<IWidgetProgressEvent[]>([]);
  const [previousResponseId, setPreviousResponseId] = useState<string>();
  const [selectedModel, setSelectedModel] = useState('');
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<IWidgetFileState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fillDrafts, setFillDrafts] = useState<IDocumentInputAgentFillDraft[]>([]);
  const [appliedDocuments, setAppliedDocuments] = useState<IDocumentInputAgentAppliedDocument[]>([]);
  const [compatibilityWarning, setCompatibilityWarning] = useState<IWidgetCompatibilityWarning | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmingDraftId, setConfirmingDraftId] = useState<string>();
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [copiedDraftJsonId, setCopiedDraftJsonId] = useState<string>();
  // Template state
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<IDocumentInputAgentSelectedTemplate | null>(null);
  const composerActions = useDocumentInputAgentActions();
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedFilesRef = useRef<IWidgetFileState[]>([]);
  const messagesRef = useRef<IWidgetMessage[]>([]);

  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      revokeFilePreviews(uploadedFilesRef.current);
      revokeMessageAttachmentPreviews(messagesRef.current);
    },
    [],
  );

  const applyWidgetSettings = useCallback((settings: Partial<IDocumentInputAgentSettings>) => {
    const enabled = settings.document_input_agent_widget_enabled !== false;
    setIsWidgetEnabled(enabled);

    if (!enabled) {
      abortRef.current?.abort();
      setIsOpen(false);
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getDocumentInputAgentSettingsAPI()
      .then((settings) => {
        if (active) {
          applyWidgetSettings(settings);
        }
      })
      .catch(() => {});

    const handleSettingsUpdated = (event: Event) => {
      const settings = (event as CustomEvent<Partial<IDocumentInputAgentSettings>>).detail;
      if (settings) {
        applyWidgetSettings(settings);
      }
    };

    window.addEventListener(DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);

    return () => {
      active = false;
      window.removeEventListener(DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    };
  }, [applyWidgetSettings]);

  // Load history on open
  useEffect(() => {
    if (!isOpen) return;
    setIsHistoryLoading(true);
    getDocumentInputAgentChatHistorySummaryAPI()
      .then((data) => {
        if (!data?.sessions) return;
        const mapped: IWidgetSession[] = (data.sessions as unknown[]).map((s: unknown) => {
          const session = s as Record<string, unknown>;
          return {
            id: String(session.id ?? ''),
            title: String(session.title ?? 'New chat'),
            updated_at: Number(session.updated_at ?? Date.now()),
            messages: [],
          };
        });
        setSessions(mapped.sort((a, b) => b.updated_at - a.updated_at));
      })
      .catch(() => {})
      .finally(() => setIsHistoryLoading(false));
  }, [isOpen]);

  // Load model options
  useEffect(() => {
    if (!isOpen) return;
    getDocumentInputAgentSettingsAPI()
      .then((settings) => {
        const options = Array.from(new Set([settings.model, ...(settings.model_options ?? [])])).filter(Boolean);
        setModelOptions(options);
        setSelectedModel((current) => current || settings.model || options[0] || '');
      })
      .catch(() => {});
  }, [isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '24px';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [message]);

  const saveWidgetSession = useCallback(async (nextSession: IWidgetSession) => {
    const sessionToSave = {
      ...nextSession,
      messages: nextSession.messages.map(sanitizeMessageForRemoteHistory),
      progress_events: sanitizeProgressEventsForRemoteHistory(nextSession.progress_events ?? []),
    };

    setSessions((current) => {
      const existing = current.some((session) => session.id === nextSession.id);
      const nextSessions = existing
        ? current.map((session) => (session.id === nextSession.id ? nextSession : session))
        : [nextSession, ...current];
      return nextSessions.sort((a, b) => b.updated_at - a.updated_at);
    });

    try {
      await saveDocumentInputAgentChatHistorySessionAPI(nextSession.id, sessionToSave, nextSession.id);
    } catch {
      // History persistence is non-critical for the floating widget.
    }
  }, []);

  const openDocument = useCallback(
    (documentId: string) => {
      setIsOpen(false);
      void navigate({ to: '/documents/$id', params: { id: documentId } });
    },
    [navigate],
  );

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const data = await getDocumentInputAgentChatHistorySessionAPI(sessionId);
      if (!data?.sessions) return;
      const sessionArr = data.sessions as unknown[];
      const found = sessionArr.find((s: unknown) => (s as Record<string, unknown>).id === sessionId) as
        | Record<string, unknown>
        | undefined;
      if (!found) return;

      const rawMessages = (found.messages as Array<Record<string, unknown>>) ?? [];
      const mapped: IWidgetMessage[] = rawMessages.map((m) => ({
        id: String(m.id ?? createId()),
        role: (m.role as 'user' | 'assistant') ?? 'user',
        content: String(m.content ?? ''),
        response: m.response as IDocumentInputAgentChatResponse | undefined,
        attachments: Array.isArray(m.attachments) ? (m.attachments as IWidgetMessageAttachment[]) : undefined,
        created_at: Number(m.created_at ?? Date.now()),
      }));

      revokeFilePreviews(uploadedFilesRef.current);
      revokeMessageAttachmentPreviews(messagesRef.current);
      setUploadedFiles([]);
      setActiveSessionId(sessionId);
      setMessages(mapped);
      setProgressEvents(Array.isArray(found.progress_events) ? (found.progress_events as IWidgetProgressEvent[]) : []);
      setFillDrafts(Array.isArray(found.fill_drafts) ? (found.fill_drafts as IDocumentInputAgentFillDraft[]) : []);
      setAppliedDocuments(
        Array.isArray(found.applied_documents) ? (found.applied_documents as IDocumentInputAgentAppliedDocument[]) : [],
      );
      setPreviousResponseId(found.previous_response_id as string | undefined);
      setSelectedModel((current) => (typeof found.llm_model === 'string' ? found.llm_model : current));
      setCompatibilityWarning(null);
      setErrorMessage('');
      setView('chat');
    } catch {
      // ignore
    }
  }, []);

  const startNewChat = useCallback(() => {
    revokeFilePreviews(uploadedFilesRef.current);
    revokeMessageAttachmentPreviews(messagesRef.current);
    setActiveSessionId(createId());
    setMessages([]);
    setProgressEvents([]);
    setPreviousResponseId(undefined);
    setUploadedFiles([]);
    setFillDrafts([]);
    setAppliedDocuments([]);
    setCompatibilityWarning(null);
    setErrorMessage('');
    setSelectedTemplate(null);
    setView('chat');
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const requestDeleteSession = useCallback(
    (session: IWidgetSession, event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (isRunning || isUploading) return;
      setSessionPendingDelete(session);
    },
    [isRunning, isUploading],
  );

  const confirmDeleteSession = useCallback(async () => {
    if (!sessionPendingDelete || isRunning || isUploading) return;

    setErrorMessage('');
    try {
      await deleteDocumentInputAgentChatHistorySessionAPI(sessionPendingDelete.id);
      setSessions((current) => current.filter((session) => session.id !== sessionPendingDelete.id));

      if (sessionPendingDelete.id === activeSessionId) {
        revokeFilePreviews(uploadedFilesRef.current);
        revokeMessageAttachmentPreviews(messagesRef.current);
        setActiveSessionId(createId());
        setMessages([]);
        setProgressEvents([]);
        setPreviousResponseId(undefined);
        setUploadedFiles([]);
        setFillDrafts([]);
        setAppliedDocuments([]);
        setCompatibilityWarning(null);
        setSelectedTemplate(null);
        setView('history');
      }

      setSessionPendingDelete(null);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    }
  }, [activeSessionId, isRunning, isUploading, sessionPendingDelete]);

  const handleSelectTemplate = useCallback((template: IDocumentInputAgentSelectedTemplate) => {
    setSelectedTemplate(template);
    setIsTemplateSelectorOpen(false);
    setView('chat');
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setIsUploading(true);
      setErrorMessage('');
      setView('chat');
      const availableSlots = MAX_AGENT_FILES - uploadedFilesRef.current.length;
      const selectedFiles = Array.from(files).slice(0, Math.max(availableSlots, 0));
      const uploadedItems: IWidgetFileState[] = [];

      try {
        if (availableSlots <= 0) {
          throw new Error(
            locale === 'vi'
              ? `Chỉ được đính kèm tối đa ${MAX_AGENT_FILES} file.`
              : `Attach up to ${MAX_AGENT_FILES} files.`,
          );
        }

        for (const file of selectedFiles) {
          const result = await uploadDocumentInputAgentFileAPI(file);
          uploadedItems.push({
            ...result,
            local_name: file.name,
            preview_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          });
        }

        setUploadedFiles((prev) => [...prev, ...uploadedItems]);
        if (Array.from(files).length > selectedFiles.length) {
          setErrorMessage(
            locale === 'vi'
              ? `Đã bỏ qua file vượt quá giới hạn ${MAX_AGENT_FILES}.`
              : `Skipped files beyond the ${MAX_AGENT_FILES} limit.`,
          );
        }
      } catch (error) {
        revokeFilePreviews(uploadedItems);
        setErrorMessage(formatErrorMessage(error));
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [locale],
  );

  const uploadGeneratedTextAttachment = useCallback(async (content: string): Promise<IWidgetFileState> => {
    const file = createPlainTextFile(content);
    const uploaded = await uploadDocumentInputAgentFileAPI(file);
    return {
      ...uploaded,
      local_name: file.name,
    };
  }, []);

  const appendLongTextAttachment = useCallback(
    async (content: string) => {
      if (isRunning || isUploading) return;

      setErrorMessage('');
      setIsUploading(true);
      setView('chat');
      try {
        if (uploadedFilesRef.current.length >= MAX_AGENT_FILES) {
          throw new Error(
            locale === 'vi'
              ? `Tin nhắn quá dài nhưng đã đủ ${MAX_AGENT_FILES} file đính kèm, không thể tạo tệp văn bản.`
              : `The message is too long, but all ${MAX_AGENT_FILES} attachment slots are already used.`,
          );
        }

        const uploaded = await uploadGeneratedTextAttachment(content);
        setUploadedFiles((prev) => [...prev, uploaded]);
        setMessage((current) => (current.trim() ? current : getLongTextAttachmentMessage(locale)));
      } catch (error) {
        setErrorMessage(formatErrorMessage(error));
      } finally {
        setIsUploading(false);
      }
    },
    [isRunning, isUploading, locale, uploadGeneratedTextAttachment],
  );

  const prepareLongMessageAttachmentForSubmit = useCallback(
    async (trimmedMessage: string, currentFiles: IWidgetFileState[]) => {
      if (!isLongTextInput(trimmedMessage)) {
        return {
          message: trimmedMessage,
          files: currentFiles,
        };
      }

      if (currentFiles.length >= MAX_AGENT_FILES) {
        throw new Error(
          locale === 'vi'
            ? `Tin nhắn quá dài nhưng đã đủ ${MAX_AGENT_FILES} file đính kèm, không thể tạo tệp văn bản.`
            : `The message is too long, but all ${MAX_AGENT_FILES} attachment slots are already used.`,
        );
      }

      setIsUploading(true);
      try {
        const uploaded = await uploadGeneratedTextAttachment(trimmedMessage);
        return {
          message: [
            getLongTextAttachmentMessage(locale),
            '',
            getLongTextPreviewPrefix(locale),
            getLongTextMessagePreview(trimmedMessage),
          ].join('\n'),
          files: [...currentFiles, uploaded],
        };
      } finally {
        setIsUploading(false);
      }
    },
    [locale, uploadGeneratedTextAttachment],
  );

  const removeUploadedFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => {
      const removed = prev.find((file) => file.file_id === fileId);
      if (removed?.preview_url) URL.revokeObjectURL(removed.preview_url);
      return prev.filter((file) => file.file_id !== fileId);
    });
  }, []);

  const uploadSelectedFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const dataTransfer = new DataTransfer();
      files.forEach((file) => dataTransfer.items.add(file));
      await handleFileUpload({
        target: { files: dataTransfer.files },
      } as React.ChangeEvent<HTMLInputElement>);
    },
    [handleFileUpload],
  );

  const handlePasteMessage = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedFiles = Array.from(event.clipboardData.files ?? []);
      const pastedText = event.clipboardData.getData('text/plain');
      if (pastedFiles.length === 0 && !isLongTextInput(pastedText)) return;

      event.preventDefault();
      if (pastedFiles.length > 0) {
        void uploadSelectedFiles(pastedFiles);
        return;
      }

      void appendLongTextAttachment(pastedText);
    },
    [appendLongTextAttachment, uploadSelectedFiles],
  );

  const handleComposerDrop = useCallback(
    (event: React.DragEvent<HTMLFieldSetElement>) => {
      event.preventDefault();
      if (isRunning || isUploading) return;
      void uploadSelectedFiles(Array.from(event.dataTransfer.files ?? []));
    },
    [isRunning, isUploading, uploadSelectedFiles],
  );

  const sendMessage = useCallback(
    async (overrides?: {
      message?: string;
      files?: IWidgetFileState[];
      selectedTemplate?: IDocumentInputAgentSelectedTemplate | null;
    }) => {
      const sourceMessage = overrides?.message ?? message;
      const sourceFiles = overrides?.files ?? uploadedFiles;
      const sourceTemplate = overrides?.selectedTemplate ?? selectedTemplate;
      const rawTrimmed = sourceMessage.trim();
      if (!rawTrimmed && !sourceTemplate && sourceFiles.length === 0) return;
      if (isRunning || isUploading) return;

      let preparedMessage = rawTrimmed;
      let preparedFiles = [...sourceFiles];
      try {
        const prepared = await prepareLongMessageAttachmentForSubmit(rawTrimmed, preparedFiles);
        preparedMessage = prepared.message;
        preparedFiles = prepared.files;
      } catch (error) {
        setErrorMessage(formatErrorMessage(error));
        return;
      }

      const sendingFiles = preparedFiles;
      const sendingFileIds = sendingFiles.map((f) => f.file_id);
      const sessionId = activeSessionId || createId();

      // Build message with the same create-document prompt generator as the full page.
      let finalMessage = preparedMessage;
      if (sourceTemplate) {
        finalMessage =
          composerActions.buildCreateDocumentMessage(
            {
              userMessage: preparedMessage,
              files: sendingFiles,
              locale,
            },
            {
              mode: sendingFiles.length > 0 ? 'upload_source' : 'agent_request',
              template: sourceTemplate,
            },
          ) || preparedMessage;
      }

      const displayContent = sourceTemplate
        ? `📄 ${sourceTemplate.name}${sendingFiles.length > 0 ? `\n📎 ${sendingFiles.map((f) => f.original_name).join(', ')}` : ''}${preparedMessage ? `\n${preparedMessage}` : ''}`
        : sendingFiles.length > 0
          ? `${preparedMessage}\n\n📎 ${sendingFiles.map((f) => f.original_name).join(', ')}`
          : preparedMessage;

      const userMsg: IWidgetMessage = {
        id: createId(),
        role: 'user',
        content: displayContent,
        attachments: createMessageAttachments(sendingFiles),
        created_at: Date.now(),
      };
      const assistantId = createId();
      const assistantMsg: IWidgetMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        created_at: Date.now(),
      };

      const nextBaseMessages = [...messages, userMsg, assistantMsg];
      const previousResponseModel = [...messages].reverse().find((item) => item.response?.model)?.response?.model;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setMessage('');
      setUploadedFiles([]);
      setSelectedTemplate(null);
      setProgressEvents([]);
      setFillDrafts([]);
      setAppliedDocuments([]);
      setCompatibilityWarning(null);
      setErrorMessage('');
      setActiveSessionId(sessionId);
      setIsRunning(true);
      setView('chat');

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        let finalResponse: IDocumentInputAgentChatResponse | undefined;
        let streamError: string | undefined;
        const liveSteps: string[] = [];
        const runProgressEvents: IWidgetProgressEvent[] = [];

        await streamDocumentInputAgentChatAPI(
          {
            message: finalMessage,
            language: locale as 'vi' | 'en',
            file_ids: sendingFileIds.length > 0 ? sendingFileIds : undefined,
            llm_model: selectedModel || undefined,
            previous_response_id:
              previousResponseModel && previousResponseModel !== selectedModel ? undefined : previousResponseId,
            allow_apply: false,
          },
          (event: TDocumentInputAgentStreamEvent) => {
            const progressEvent = { id: createId(), created_at: Date.now(), event };
            runProgressEvents.push(progressEvent);
            setProgressEvents((prev) => [...prev, progressEvent]);

            const liveStep = getLiveStepText(event, locale);
            if (liveStep) {
              liveSteps.push(liveStep);
              const liveContent = buildLiveAssistantContent(liveSteps.slice(-MAX_LIVE_STEPS), locale);
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: liveContent } : m)));
            }

            // Final text from 'message' event (streaming text)
            if (event.type === 'message' && 'text' in event && event.text) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: event.text as string } : m)),
              );
            }
            if (event.type === 'done' && 'response' in event) {
              finalResponse = event.response;
            }
            if (event.type === 'error' && 'message' in event) {
              streamError = event.message;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${event.message}` } : m)),
              );
            }
          },
          { signal: abortController.signal },
        );

        if (abortController.signal.aborted) return;
        if (streamError) throw new Error(streamError);
        if (!finalResponse) {
          throw new Error(
            locale === 'vi'
              ? 'Luồng agent kết thúc nhưng không có phản hồi cuối.'
              : 'The agent stream ended without a final response.',
          );
        }

        const compatibilityResult = finalResponse.compatibility_warning;
        if (compatibilityResult) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: compatibilityResult.message } : m)),
          );
          setCompatibilityWarning({
            score_percent: compatibilityResult.score.score_percent,
            matched_count: compatibilityResult.score.matched_count,
            total_count: compatibilityResult.score.total_count,
            message: compatibilityResult.message,
            sheet_selection: compatibilityResult.sheet_selection,
            selected_sheet_selections: createDefaultSheetSelections(compatibilityResult.sheet_selection),
            pendingPayload: {
              message: finalMessage,
              language: locale as 'vi' | 'en',
              file_ids: sendingFileIds.length > 0 ? sendingFileIds : undefined,
              llm_model: selectedModel || undefined,
              previous_response_id:
                previousResponseModel && previousResponseModel !== selectedModel ? undefined : previousResponseId,
              allow_apply: false,
              skip_compatibility_check: true,
            },
          });
          return;
        }

        if (finalResponse) {
          setPreviousResponseId(finalResponse.response_id);
          const drafts = finalResponse.fill_drafts ?? [];
          const applied = finalResponse.applied_documents ?? [];
          setFillDrafts(drafts);
          setAppliedDocuments(applied);
          const finalMessages = nextBaseMessages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    finalResponse!.output_text ||
                    (locale === 'vi' ? 'Không có nội dung hiển thị.' : 'No display content.'),
                  response: finalResponse,
                }
              : m,
          );
          setMessages(finalMessages);
          void saveWidgetSession({
            id: sessionId,
            title: buildSessionTitle(finalMessages, locale === 'vi' ? 'Chat mới' : 'New chat'),
            updated_at: Date.now(),
            messages: finalMessages,
            progress_events: runProgressEvents,
            previous_response_id: finalResponse.response_id,
            llm_model: selectedModel || finalResponse.model,
            fill_drafts: drafts,
            applied_documents: applied,
          });
        }
      } catch (error) {
        if (!abortController.signal.aborted && !isAbortError(error)) {
          const errMsg = formatAgentRunErrorMessage(
            error,
            locale === 'vi'
              ? 'Kết nối stream bị gián đoạn trước khi có phản hồi cuối.'
              : 'The agent stream connection was interrupted before the final response.',
          );
          setErrorMessage(errMsg);
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${errMsg}` } : m)));
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
      }
    },
    [
      activeSessionId,
      isRunning,
      isUploading,
      locale,
      message,
      messages,
      prepareLongMessageAttachmentForSubmit,
      previousResponseId,
      saveWidgetSession,
      selectedModel,
      selectedTemplate,
      uploadedFiles,
      composerActions,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const stopRunning = () => {
    abortRef.current?.abort();
    setProgressEvents((prev) => [
      ...prev,
      {
        id: createId(),
        created_at: Date.now(),
        event: {
          type: 'status',
          phase: 'stopped',
          message: locale === 'vi' ? 'Đã dừng' : 'Stopped',
        },
      },
    ]);
    setIsRunning(false);
  };

  const persistCurrentSession = useCallback(
    (overrides: Partial<IWidgetSession> = {}) => {
      const nextMessages = overrides.messages ?? messagesRef.current;
      const nextProgressEvents = overrides.progress_events ?? progressEvents;
      const nextFillDrafts = overrides.fill_drafts ?? fillDrafts;
      const nextAppliedDocuments = overrides.applied_documents ?? appliedDocuments;

      void saveWidgetSession({
        id: activeSessionId,
        title: buildSessionTitle(nextMessages, locale === 'vi' ? 'Chat mới' : 'New chat'),
        updated_at: Date.now(),
        messages: nextMessages,
        progress_events: nextProgressEvents,
        previous_response_id: overrides.previous_response_id ?? previousResponseId,
        llm_model: overrides.llm_model ?? selectedModel,
        fill_drafts: nextFillDrafts,
        applied_documents: nextAppliedDocuments,
      });
    },
    [
      activeSessionId,
      appliedDocuments,
      fillDrafts,
      locale,
      previousResponseId,
      progressEvents,
      saveWidgetSession,
      selectedModel,
    ],
  );

  const handleConfirmCompatibility = useCallback(async () => {
    if (!compatibilityWarning || isRunning) return;

    const payload = {
      ...compatibilityWarning.pendingPayload,
      sheet_selection:
        compatibilityWarning.selected_sheet_selections.length > 0
          ? { selections: compatibilityWarning.selected_sheet_selections }
          : compatibilityWarning.pendingPayload.sheet_selection,
    };
    const assistantId = createId();
    const assistantMsg: IWidgetMessage = {
      id: assistantId,
      role: 'assistant',
      content: locale === 'vi' ? 'Đang xử lý...' : 'Processing...',
      created_at: Date.now(),
    };
    const baseMessages = [...messagesRef.current, assistantMsg];
    const runProgressEvents: IWidgetProgressEvent[] = [];
    const abortController = new AbortController();

    setCompatibilityWarning(null);
    setErrorMessage('');
    setIsRunning(true);
    setMessages(baseMessages);
    abortRef.current = abortController;

    try {
      let finalResponse: IDocumentInputAgentChatResponse | undefined;
      let streamError: string | undefined;
      const liveSteps: string[] = [];

      await streamDocumentInputAgentChatAPI(
        payload,
        (event) => {
          const progressEvent = { id: createId(), created_at: Date.now(), event };
          runProgressEvents.push(progressEvent);
          setProgressEvents((prev) => [...prev, progressEvent]);

          const liveStep = getLiveStepText(event, locale);
          if (event.type === 'error') {
            streamError = event.message;
          }

          if (liveStep) {
            liveSteps.push(liveStep);
            const liveContent = buildLiveAssistantContent(liveSteps.slice(-MAX_LIVE_STEPS), locale);
            setMessages((prev) =>
              prev.map((item) => (item.id === assistantId ? { ...item, content: liveContent } : item)),
            );
          }

          if (event.type === 'message' && event.text) {
            setMessages((prev) =>
              prev.map((item) => (item.id === assistantId ? { ...item, content: event.text } : item)),
            );
          }
          if (event.type === 'done') finalResponse = event.response;
        },
        { signal: abortController.signal },
      );

      if (abortController.signal.aborted) return;
      if (streamError) throw new Error(streamError);
      if (!finalResponse) throw new Error(locale === 'vi' ? 'Không có phản hồi cuối.' : 'Missing final response.');

      const drafts = finalResponse.fill_drafts ?? [];
      const applied = finalResponse.applied_documents ?? [];
      const finalMessages = baseMessages.map((item) =>
        item.id === assistantId
          ? {
              ...item,
              content:
                finalResponse!.output_text || (locale === 'vi' ? 'Không có nội dung hiển thị.' : 'No display content.'),
              response: finalResponse,
            }
          : item,
      );

      setPreviousResponseId(finalResponse.response_id);
      setFillDrafts(drafts);
      setAppliedDocuments(applied);
      setMessages(finalMessages);
      persistCurrentSession({
        messages: finalMessages,
        progress_events: [...progressEvents, ...runProgressEvents],
        previous_response_id: finalResponse.response_id,
        llm_model: selectedModel || finalResponse.model,
        fill_drafts: drafts,
        applied_documents: applied,
      });
    } catch (error) {
      if (!abortController.signal.aborted && !isAbortError(error)) {
        const errorText = formatAgentRunErrorMessage(
          error,
          locale === 'vi'
            ? 'Kết nối stream bị gián đoạn trước khi có phản hồi cuối.'
            : 'The agent stream connection was interrupted before the final response.',
        );
        setErrorMessage(errorText);
        setMessages((prev) =>
          prev.map((item) => (item.id === assistantId ? { ...item, content: `Error: ${errorText}` } : item)),
        );
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [compatibilityWarning, isRunning, locale, persistCurrentSession, progressEvents, selectedModel]);

  const handleSelectCompatibilitySheet = useCallback((templateSheet: string, value: string) => {
    const selection = decodeSheetSelectionOption(value);
    if (!selection) return;

    setCompatibilityWarning((current) => {
      if (!current) return current;

      const nextSelections = current.selected_sheet_selections.some((item) => item.template_sheet === templateSheet)
        ? current.selected_sheet_selections.map((item) => (item.template_sheet === templateSheet ? selection : item))
        : [...current.selected_sheet_selections, selection];

      return {
        ...current,
        selected_sheet_selections: nextSelections,
      };
    });
  }, []);

  const handleCancelCompatibility = useCallback(() => {
    setCompatibilityWarning(null);
  }, []);

  const handleApplyDraft = useCallback(
    async (draft: IDocumentInputAgentFillDraft) => {
      if (confirmingDraftId || isRunning) return;

      setConfirmingDraftId(draft.id);
      setErrorMessage('');

      try {
        const appliedDocument = await runDocumentInputAgentToolAPI<IDocumentInputAgentAppliedDocument>(
          'apply_document_fill',
          {
            arguments: { definition: draft.definition },
            allow_apply: true,
          },
        );
        const nextAppliedDocuments = [
          appliedDocument,
          ...appliedDocuments.filter((item) => item.document_id !== appliedDocument.document_id),
        ];
        const nextFillDrafts = fillDrafts.filter((item) => item.id !== draft.id);
        const nextMessages = messagesRef.current.map((item) => {
          if (!item.response?.fill_drafts?.some((responseDraft) => responseDraft.id === draft.id)) return item;

          return {
            ...item,
            response: {
              ...item.response,
              fill_drafts: item.response.fill_drafts?.filter((responseDraft) => responseDraft.id !== draft.id),
              applied_documents: [
                appliedDocument,
                ...(item.response.applied_documents ?? []).filter(
                  (document) => document.document_id !== appliedDocument.document_id,
                ),
              ],
            },
          };
        });

        setAppliedDocuments(nextAppliedDocuments);
        setFillDrafts(nextFillDrafts);
        setMessages(nextMessages);
        persistCurrentSession({
          messages: nextMessages,
          fill_drafts: nextFillDrafts,
          applied_documents: nextAppliedDocuments,
        });
        openDocument(appliedDocument.document_id);
      } catch (error) {
        setErrorMessage(formatErrorMessage(error));
      } finally {
        setConfirmingDraftId(undefined);
      }
    },
    [appliedDocuments, confirmingDraftId, fillDrafts, isRunning, openDocument, persistCurrentSession],
  );

  const handleCopyMessage = useCallback(
    async (item: IWidgetMessage) => {
      try {
        await navigator.clipboard.writeText(item.content);
        setCopiedMessageId(item.id);
        window.setTimeout(() => setCopiedMessageId((current) => (current === item.id ? undefined : current)), 1400);
      } catch {
        setErrorMessage(locale === 'vi' ? 'Không copy được nội dung.' : 'Could not copy the message.');
      }
    },
    [locale],
  );

  const handleCopyDraftJson = useCallback(
    async (draft: IDocumentInputAgentFillDraft) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(draft.definition, null, 2));
        setCopiedDraftJsonId(draft.id);
        window.setTimeout(() => setCopiedDraftJsonId((current) => (current === draft.id ? undefined : current)), 1400);
      } catch {
        setErrorMessage(locale === 'vi' ? 'Không copy được JSON xem trước.' : 'Could not copy the preview JSON.');
      }
    },
    [locale],
  );

  const handleReuseUserMessage = useCallback(
    (item: IWidgetMessage) => {
      if (item.role !== 'user' || isRunning || isUploading) return;
      revokeFilePreviews(uploadedFilesRef.current);
      setMessage(item.content);
      setUploadedFiles((item.attachments ?? []).map((attachment) => ({ ...attachment })));
      setSelectedTemplate(null);
      setCompatibilityWarning(null);
      setErrorMessage('');
      setView('chat');
      setTimeout(() => textareaRef.current?.focus(), 100);
    },
    [isRunning, isUploading],
  );

  const handleRetryUserMessage = useCallback(
    async (item: IWidgetMessage) => {
      if (item.role !== 'user' || isRunning || isUploading) return;
      await sendMessage({
        message:
          item.content.trim() ||
          (locale === 'vi'
            ? 'Đọc tệp đã tải lên, tìm mẫu phù hợp và tạo bản xem trước dữ liệu tài liệu.'
            : 'Read the uploaded file, find the matching template, and create a document data preview.'),
        files: (item.attachments ?? []).map((attachment) => ({ ...attachment })),
        selectedTemplate: null,
      });
    },
    [isRunning, isUploading, locale, sendMessage],
  );

  const renderComposerFilePreview = (file: IWidgetFileState) => {
    const displayName = file.local_name || file.original_name;
    const mimeType = file.mime_type || '';
    const isImage = mimeType.startsWith('image/');
    const kindLabel = getFileKindLabel(file, locale);

    const removeButton = (
      <button
        type="button"
        onClick={() => removeUploadedFile(file.file_id)}
        className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50 hover:text-slate-950"
        title={locale === 'vi' ? 'Gỡ file' : 'Remove file'}>
        <X className="h-4 w-4" />
      </button>
    );

    if (file.preview_url && isImage) {
      return (
        <div key={file.file_id} className="group relative h-20 w-20 shrink-0">
          <div className="h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <img src={file.preview_url} alt={displayName} className="h-full w-full object-cover" />
          </div>
          {removeButton}
        </div>
      );
    }

    return (
      <div
        key={file.file_id}
        className="group relative flex h-20 w-32 shrink-0 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          {isImage ? (
            <ImageIcon className="h-4 w-4" />
          ) : isSpreadsheetFile(file) ? (
            <FileSpreadsheet className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold leading-4 text-slate-800">{displayName}</div>
          <div className="truncate text-[10px] leading-3 text-slate-500">{kindLabel}</div>
        </div>
        {removeButton}
      </div>
    );
  };

  const renderPendingDraftActions = () => {
    if (fillDrafts.length === 0) return null;

    return (
      <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5 text-emerald-900">
        <div className="font-semibold">
          {locale === 'vi' ? 'Tài liệu mới cần xác nhận' : 'New document needs confirmation'}
        </div>
        <div className="mt-0.5 text-emerald-800/80">
          {locale === 'vi'
            ? 'Bấm nút dưới đây để tạo document từ dữ liệu xem trước.'
            : 'Click below to create a document from the preview data.'}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fillDrafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => void handleApplyDraft(draft)}
              disabled={Boolean(confirmingDraftId) || isRunning}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {confirmingDraftId === draft.id ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
              <span className="shrink-0">{locale === 'vi' ? 'Tạo tài liệu' : 'Create document'}</span>
              <span className="min-w-0 max-w-[180px] truncate font-medium text-emerald-50">{draft.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Filtered sessions
  const filteredSessions = historySearch
    ? sessions.filter((s) => s.title.toLowerCase().includes(historySearch.toLowerCase()))
    : sessions;
  const displayedSessions = showAllHistory ? filteredSessions : filteredSessions.slice(0, MAX_VISIBLE_HISTORY);

  const formatModelLabel = (model: string) => {
    const name = model.split('/').at(-1) || model;
    return name.replace(/^(gpt-|qwen)/, (m) => m.toUpperCase().replace('-', '-'));
  };

  const labels =
    locale === 'vi'
      ? {
          attachFile: 'Đính kèm file',
          cancelDelete: 'Hủy',
          confirmDelete: 'Xóa',
          createDocument: 'Tạo tài liệu',
          deleteChat: 'Xóa chat',
          deleteChatDescription: 'Thao tác này sẽ xóa cuộc trò chuyện khỏi lịch sử.',
          deleteChatTitle: 'Xóa cuộc trò chuyện?',
          history: 'Lịch sử',
          model: 'Mô hình',
          newChat: 'Chat mới',
          noHistory: 'Chưa có cuộc trò chuyện nào',
          openAssistant: 'Mở trợ lý tài liệu',
          placeholder: 'Nhập yêu cầu...',
          readyToCreate: 'Sẵn sàng tạo tài liệu',
          recent: 'Gần đây',
          search: 'Tìm kiếm',
          searchPlaceholder: 'Tìm trong tác vụ gần đây',
          title: 'Trợ lý tài liệu',
          uploadSource: 'Tải dữ liệu nguồn',
          viewAll: 'Xem tất cả',
        }
      : {
          attachFile: 'Attach file',
          cancelDelete: 'Cancel',
          confirmDelete: 'Delete',
          createDocument: 'Create document',
          deleteChat: 'Delete chat',
          deleteChatDescription: 'This will remove the conversation from history.',
          deleteChatTitle: 'Delete conversation?',
          history: 'History',
          model: 'Model',
          newChat: 'New chat',
          noHistory: 'No conversations yet',
          openAssistant: 'Open document assistant',
          placeholder: 'Ask for a document task...',
          readyToCreate: 'Ready to create document',
          recent: 'Recent',
          search: 'Search',
          searchPlaceholder: 'Search recent tasks',
          title: 'Document assistant',
          uploadSource: 'Upload source',
          viewAll: 'View all',
        };

  if (!isWidgetEnabled) {
    return null;
  }

  return (
    <>
      {/* Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500 bg-emerald-600 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          aria-label={labels.openAssistant}>
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[620px] max-h-[calc(100vh-7rem)] w-[440px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-[0_18px_54px_rgba(15,23,42,0.18)] max-sm:bottom-20 max-sm:left-3 max-sm:right-3 max-sm:h-[calc(100dvh-6.5rem)] max-sm:w-auto">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
                <Bot className="h-4 w-4" />
              </div>
              <h2 className="truncate text-sm font-semibold text-slate-950">{labels.title}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={labels.history}
                onClick={() => setView('history')}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  view === 'history'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}>
                <Clock className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={labels.search}
                onClick={() => {
                  setIsSearchOpen(!isSearchOpen);
                  if (view === 'chat') setView('history');
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isSearchOpen
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}>
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={labels.newChat}
                onClick={startNewChat}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <PenSquare className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={locale === 'vi' ? 'Đóng' : 'Close'}
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={locale === 'vi' ? 'Đóng trợ lý tài liệu' : 'Close document assistant'}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {view === 'history' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
              {/* Search */}
              {isSearchOpen && (
                <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder={labels.searchPlaceholder}
                      className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Session List */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
                {isHistoryLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : displayedSessions.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center">
                      <Clock className="mx-auto mb-2 h-5 w-5 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700">{labels.noHistory}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        {labels.recent}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                        {filteredSessions.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {sessionPendingDelete && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                          <div className="font-semibold">{labels.deleteChatTitle}</div>
                          <div className="mt-0.5">{labels.deleteChatDescription}</div>
                          <div className="mt-2 truncate font-medium text-red-900">{sessionPendingDelete.title}</div>
                          <div className="mt-2 flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSessionPendingDelete(null)}
                              className="rounded-md border border-red-200 bg-white px-2.5 py-1 font-semibold text-red-700 hover:bg-red-100">
                              {labels.cancelDelete}
                            </button>
                            <button
                              type="button"
                              onClick={() => void confirmDeleteSession()}
                              className="rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700">
                              {labels.confirmDelete}
                            </button>
                          </div>
                        </div>
                      )}
                      {displayedSessions.map((session) => (
                        <div
                          key={session.id}
                          className="group flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/60">
                          <button
                            type="button"
                            onClick={() => void loadSession(session.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                              <MessageSquare className="h-4 w-4" />
                            </div>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">
                              {session.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                              {formatRelativeTime(session.updated_at)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => requestDeleteSession(session, event)}
                            disabled={isRunning || isUploading}
                            title={labels.deleteChat}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {!showAllHistory && filteredSessions.length > MAX_VISIBLE_HISTORY && (
                        <button
                          type="button"
                          onClick={() => setShowAllHistory(true)}
                          className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50">
                          {labels.viewAll} ({filteredSessions.length})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Chat View */
            <DocumentInputAgentWidgetChat
              messages={messages}
              progressEvents={progressEvents}
              isRunning={isRunning}
              confirmingDraftId={confirmingDraftId}
              copiedMessageId={copiedMessageId}
              locale={locale}
              onApplyDraft={handleApplyDraft}
              onCopyDraftJson={handleCopyDraftJson}
              onCopyMessage={handleCopyMessage}
              onReuseUserMessage={handleReuseUserMessage}
              onRetryUserMessage={handleRetryUserMessage}
              onOpenDocument={openDocument}
              copiedDraftJsonId={copiedDraftJsonId}
            />
          )}

          {/* Composer */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
            {renderPendingDraftActions()}
            {errorMessage && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                {errorMessage}
              </div>
            )}
            {compatibilityWarning && (
              <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-900">
                <div className="font-semibold">{locale === 'vi' ? 'Xác nhận tài liệu' : 'Confirm source file'}</div>
                <div className="mt-1">{compatibilityWarning.message}</div>
                <div className="mt-1 text-amber-800/80">
                  {locale === 'vi'
                    ? `Fill được ${compatibilityWarning.matched_count}/${compatibilityWarning.total_count} trường (${compatibilityWarning.score_percent}%).`
                    : `Can fill ${compatibilityWarning.matched_count}/${compatibilityWarning.total_count} fields (${compatibilityWarning.score_percent}%).`}
                </div>
                {compatibilityWarning.sheet_selection?.selections.length ? (
                  <div className="mt-2 space-y-2">
                    <div className="font-semibold text-amber-950">
                      {locale === 'vi' ? 'Chọn sheet nguồn' : 'Choose source sheet'}
                    </div>
                    {compatibilityWarning.sheet_selection.selections.map((group) => {
                      const selected =
                        compatibilityWarning.selected_sheet_selections.find(
                          (item) => item.template_sheet === group.template_sheet,
                        ) ??
                        createDefaultSheetSelections({
                          required: true,
                          reason: 'multiple_candidate_sheets',
                          selections: [group],
                        })[0];

                      return (
                        <label key={group.template_sheet} className="block">
                          <span className="mb-1 block text-amber-800/80">
                            {locale === 'vi'
                              ? `Template sheet: ${group.template_sheet}`
                              : `Template sheet: ${group.template_sheet}`}
                          </span>
                          <select
                            value={selected ? encodeSheetSelectionOption(selected) : ''}
                            onChange={(event) =>
                              handleSelectCompatibilitySheet(group.template_sheet, event.target.value)
                            }
                            className="h-9 w-full rounded-md border border-amber-300 bg-white px-2 text-[12px] font-medium text-amber-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200">
                            {group.options.map((option) => (
                              <option
                                key={`${option.file_id ?? ''}:${option.source_sheet}`}
                                value={encodeSheetSelectionOption(option)}>
                                {option.source_sheet}
                                {option.file_name ? ` - ${option.file_name}` : ''}
                                {option.recommended ? (locale === 'vi' ? ' (đề xuất)' : ' (recommended)') : ''}
                                {` - ${option.score_percent}%`}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleConfirmCompatibility()}
                    className="rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700">
                    {locale === 'vi' ? 'Tiếp tục' : 'Continue'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCompatibility}
                    className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100">
                    {locale === 'vi' ? 'Hủy' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
            {/* Create document action */}
            {!isRunning && !selectedTemplate && (
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateSelectorOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[13px] font-medium text-emerald-800 transition-colors hover:bg-emerald-100">
                  <FilePlus2 className="h-4 w-4" />
                  {labels.createDocument}
                </button>
              </div>
            )}

            {/* Selected template pill + upload source button */}
            {selectedTemplate && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-800">
                  <FilePlus2 className="h-3.5 w-3.5" />
                  <span className="max-w-[180px] truncate">{selectedTemplate.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    className="ml-0.5 text-emerald-600 hover:text-emerald-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
                {uploadedFiles.length === 0 && !isUploading && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50">
                    <Upload className="h-3.5 w-3.5 text-slate-500" />
                    {labels.uploadSource}
                  </button>
                )}
              </div>
            )}

            {/* Uploaded file previews */}
            {(uploadedFiles.length > 0 || isUploading) && (
              <div className="mb-2 flex max-w-full items-center gap-3 overflow-x-auto rounded-3xl bg-slate-100/80 p-3">
                {uploadedFiles.length < MAX_AGENT_FILES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRunning || isUploading}
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
                    title={labels.attachFile}>
                    <ImageIcon className="h-7 w-7" />
                  </button>
                )}
                {uploadedFiles.map(renderComposerFilePreview)}
                {isUploading && (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>
            )}

            <fieldset
              onDrop={handleComposerDrop}
              onDragOver={(event) => event.preventDefault()}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100">
              {/* Ready prompt hint */}
              {selectedTemplate && (
                <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{labels.readyToCreate}</span>
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePasteMessage}
                placeholder={labels.placeholder}
                rows={1}
                disabled={isRunning}
                className="w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-5 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0 disabled:opacity-50"
                style={{ minHeight: '24px', maxHeight: '100px' }}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title={labels.attachFile}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRunning}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-slate-700 disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                  </button>
                  {modelOptions.length > 0 && (
                    <label className="flex min-w-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] text-slate-500">
                      <span className="hidden sm:inline">{labels.model}</span>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="max-w-[150px] border-none bg-transparent px-0 text-[11px] font-medium text-slate-600 focus:outline-none focus:ring-0">
                        {modelOptions.map((model) => (
                          <option key={model} value={model}>
                            {formatModelLabel(model)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {isRunning ? (
                    <button
                      type="button"
                      onClick={stopRunning}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white transition-colors hover:bg-slate-700">
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={!message.trim() && !selectedTemplate && uploadedFiles.length === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white transition-opacity hover:bg-emerald-700 disabled:opacity-35">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </fieldset>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            onChange={(e) => void handleFileUpload(e)}
            className="hidden"
          />
        </div>
      )}

      {/* Template Selector Dialog */}
      <DocumentInputAgentTemplateSelector
        open={isTemplateSelectorOpen}
        selectedTemplateId={selectedTemplate?.id}
        onOpenChange={setIsTemplateSelectorOpen}
        onSelectTemplate={handleSelectTemplate}
      />
    </>
  );
};
