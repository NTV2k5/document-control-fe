import { useNavigate } from '@tanstack/react-router';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Textarea } from 'reactjs-platform/ui';
import {
  runTemplateAgentToolAPI,
  streamTemplateAgentChatAPI,
  uploadTemplateAgentFileAPI,
  type ITemplateAgentChatResponse,
  type TTemplateAgentStreamEvent,
  type ITemplateAgentVariableDefinitionDraft,
  type ITemplateAgentVariableDefinitionResult,
} from 'api';
import type {
  ITemplateAgentFileState,
  ITemplateAgentChatHistory,
  ITemplateAgentChatSession,
  ILegacyTemplateAgentChatHistory,
  ITemplateAgentMessageAttachment,
  ITemplateAgentMessage,
  ITemplateAgentProgressEvent,
} from './template-agent.type';
import { useTranslation } from '../../i18n';

type TTranslate = ReturnType<typeof useTranslation>['t'];

const createMessageId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const TEMPLATE_AGENT_HISTORY_STORAGE_KEY = 'template-agent-chat-history-v1';
const MAX_LIVE_STEPS = 8;
const MAX_STORED_PROGRESS_EVENTS = 80;
const MAX_STORED_PROGRESS_VALUE_CHARS = 1_800;
const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const MAX_AGENT_FILES = 10;

const getVariableDetailSearchType = (variableType?: string) =>
  variableType === 'DOCUMENT_VARIABLE' ? 'DOCUMENT_VARIABLE' : 'TABLE_VARIABLE';

const stringifyCompact = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatPhaseTitle = (phase: string) =>
  phase
    .split('_')
    .filter(Boolean)
    .map((item) => `${item.slice(0, 1).toUpperCase()}${item.slice(1)}`)
    .join(' ');

const getTemplateStatusEventTitle = (event: Extract<TTemplateAgentStreamEvent, { type: 'status' }>, t: TTranslate) => {
  const phaseTitleMap: Record<string, string> = {
    start: t('agentChat.processing'),
    complete: t('agentChat.completed'),
    llm_retry: t('agentChat.statusTitles.retrying'),
    fast_fallback_failed: t('agentChat.statusTitles.failed'),
  };

  return event.phase ? phaseTitleMap[event.phase] || formatPhaseTitle(event.phase) : event.message;
};

const getStreamEventTitle = (event: TTemplateAgentStreamEvent, t: TTranslate) => {
  switch (event.type) {
    case 'status':
      return getTemplateStatusEventTitle(event, t);
    case 'response':
      return `${t('agentChat.llmResponse')} ${event.response_id}`;
    case 'reasoning':
      return t('agentChat.reasoningSummary');
    case 'tool_call':
      return t('agentChat.toolCall', { name: event.name });
    case 'tool_result':
      return event.ok ? t('agentChat.toolDone', { name: event.name }) : t('agentChat.toolError', { name: event.name });
    case 'message':
      return t('agentChat.assistantReply');
    case 'done':
      return t('agentChat.completed');
    case 'error':
      return t('agentChat.error');
    default:
      return t('agentChat.event');
  }
};

const getStreamEventDetail = (event: TTemplateAgentStreamEvent, t: TTranslate) => {
  switch (event.type) {
    case 'status':
      return [
        event.phase ? `${t('agentChat.phase')}: ${event.phase}` : '',
        event.run_id ? `run_id: ${event.run_id}` : '',
        event.duration_ms !== undefined ? `${t('agentChat.durationMs')}: ${event.duration_ms}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    case 'response':
      return [
        `${t('agentChat.durationMs')}: ${event.duration_ms}`,
        `${t('agentChat.output')}: ${event.output_types.join(', ') || t('agentChat.none')}`,
      ].join('\n');
    case 'reasoning':
      return event.summary;
    case 'tool_call':
      return [`call_id: ${event.call_id}`, stringifyCompact(event.arguments)].join('\n');
    case 'tool_result':
      return [
        `${t('agentChat.status')}: ${event.ok ? t('agentChat.callStatusOk') : t('agentChat.callStatusError')}`,
        `${t('agentChat.durationMs')}: ${event.duration_ms}`,
        `call_id: ${event.call_id}`,
        stringifyCompact(event.result),
      ].join('\n');
    case 'message':
      return event.text;
    case 'done':
      return event.response.output_text || `${t('agentChat.response')}: ${event.response.response_id}`;
    case 'error':
      return event.message;
    default:
      return '';
  }
};

const formatProgressTime = (timestamp: number, intlLocale: string) =>
  new Date(timestamp).toLocaleTimeString(intlLocale, {
    hour12: false,
  });

const createEmptySession = (t: TTranslate): ITemplateAgentChatSession => ({
  id: createMessageId(),
  title: t('agentChat.newChat'),
  updated_at: Date.now(),
  messages: [],
  progress_events: [],
  last_variables: [],
  draft_variables: [],
});

const buildSessionTitle = (messages: ITemplateAgentMessage[], t: TTranslate) => {
  const firstUserMessage = messages.find((item) => item.role === 'user')?.content.trim();
  if (!firstUserMessage) return t('agentChat.newChat');
  return firstUserMessage.length > 48 ? `${firstUserMessage.slice(0, 48)}...` : firstUserMessage;
};

const getSessionDisplayTitle = (title: string, t: TTranslate) =>
  ['Chat m\u1edbi', 'Cu\u1ed9c tr\u00f2 chuy\u1ec7n m\u1edbi', 'New chat'].includes(title.trim())
    ? t('agentChat.newChat')
    : title;

const sanitizeMessagesForStorage = (messages: ITemplateAgentMessage[]) =>
  messages.map((item) => ({
    ...item,
    attachments: item.attachments?.map(({ preview_url: _previewUrl, ...attachment }) => attachment),
  }));

const sanitizeStoredValue = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') {
    return value.length > MAX_STORED_PROGRESS_VALUE_CHARS
      ? `${value.slice(0, MAX_STORED_PROGRESS_VALUE_CHARS)}...[truncated]`
      : value;
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'undefined') {
    return value;
  }

  if (depth >= 5) return '[object omitted]';

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeStoredValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeStoredValue(item, depth + 1),
      ]),
    );
  }

  return String(value);
};

const sanitizeProgressEventsForStorage = (progressEvents: ITemplateAgentProgressEvent[] = []) =>
  progressEvents.slice(-MAX_STORED_PROGRESS_EVENTS).map((item) => ({
    ...item,
    event: sanitizeStoredValue(item.event) as TTemplateAgentStreamEvent,
  }));

const markInterruptedSession = (session: ITemplateAgentChatSession, t: TTranslate): ITemplateAgentChatSession => {
  if (!session.is_running) return session;

  const interruptedAt = Date.now();
  const reloadInterruptedMessage = t('agentChat.reloadInterrupted');
  const messages = [...session.messages];
  let assistantIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (item.role === 'assistant' && !item.response) {
      assistantIndex = index;
      break;
    }
  }

  if (assistantIndex >= 0) {
    messages[assistantIndex] = {
      ...messages[assistantIndex],
      content: `${t('agentChat.errorPrefix')}: ${reloadInterruptedMessage}`,
    };
  } else if (messages.length > 0) {
    messages.push({
      id: createMessageId(),
      role: 'assistant',
      content: `${t('agentChat.errorPrefix')}: ${reloadInterruptedMessage}`,
      created_at: interruptedAt,
    });
  }

  return {
    ...session,
    messages,
    progress_events: sanitizeProgressEventsForStorage([
      ...session.progress_events,
      {
        id: createMessageId(),
        created_at: interruptedAt,
        event: {
          type: 'error',
          message: reloadInterruptedMessage,
        },
      },
    ]),
    is_running: false,
    interrupted_at: interruptedAt,
  };
};

const normalizeSession = (session: Partial<ITemplateAgentChatSession>, t: TTranslate): ITemplateAgentChatSession => ({
  id: typeof session.id === 'string' ? session.id : createMessageId(),
  title: typeof session.title === 'string' ? session.title : buildSessionTitle(session.messages ?? [], t),
  updated_at: typeof session.updated_at === 'number' ? session.updated_at : Date.now(),
  messages: Array.isArray(session.messages) ? session.messages : [],
  progress_events: Array.isArray(session.progress_events) ? session.progress_events : [],
  previous_response_id: typeof session.previous_response_id === 'string' ? session.previous_response_id : undefined,
  last_variables: Array.isArray(session.last_variables) ? session.last_variables : [],
  draft_variables: Array.isArray(session.draft_variables) ? session.draft_variables : [],
  is_running: session.is_running === true,
  interrupted_at: typeof session.interrupted_at === 'number' ? session.interrupted_at : undefined,
});

const readChatHistory = (t: TTranslate): ITemplateAgentChatHistory | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(TEMPLATE_AGENT_HISTORY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ITemplateAgentChatHistory & ILegacyTemplateAgentChatHistory>;

    if (Array.isArray(parsed.sessions)) {
      const sessions = parsed.sessions.map((session) => markInterruptedSession(normalizeSession(session, t), t));

      return {
        active_session_id:
          typeof parsed.active_session_id === 'string' &&
          sessions.some((session) => session.id === parsed.active_session_id)
            ? parsed.active_session_id
            : sessions[0]?.id,
        sessions,
      };
    }

    const legacySession = normalizeSession(
      {
        id: 'legacy-template-agent-chat',
        title: buildSessionTitle(Array.isArray(parsed.messages) ? parsed.messages : [], t),
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        progress_events: Array.isArray(parsed.progress_events) ? parsed.progress_events : [],
        previous_response_id: typeof parsed.previous_response_id === 'string' ? parsed.previous_response_id : undefined,
        last_variables: Array.isArray(parsed.last_variables) ? parsed.last_variables : [],
        draft_variables: Array.isArray(parsed.draft_variables) ? parsed.draft_variables : [],
        is_running: parsed.is_running === true,
        interrupted_at: typeof parsed.interrupted_at === 'number' ? parsed.interrupted_at : undefined,
      },
      t,
    );
    const normalizedLegacySession = markInterruptedSession(legacySession, t);

    return {
      active_session_id: normalizedLegacySession.id,
      sessions: normalizedLegacySession.messages.length > 0 ? [normalizedLegacySession] : [],
    };
  } catch {
    return null;
  }
};

const writeChatHistory = (history: ITemplateAgentChatHistory) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    TEMPLATE_AGENT_HISTORY_STORAGE_KEY,
    JSON.stringify({
      ...history,
      sessions: history.sessions.map((session) => ({
        ...session,
        messages: sanitizeMessagesForStorage(session.messages),
        progress_events: sanitizeProgressEventsForStorage(session.progress_events),
      })),
    }),
  );
};

const removeChatHistory = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TEMPLATE_AGENT_HISTORY_STORAGE_KEY);
};

const getLiveStepText = (event: TTemplateAgentStreamEvent, t: TTranslate) => {
  if (event.type === 'status') {
    return event.phase === 'llm_waiting' ? undefined : getTemplateStatusEventTitle(event, t);
  }

  if (event.type === 'reasoning') {
    return event.summary;
  }

  if (event.type === 'tool_call') {
    return t('agentChat.liveToolCall', { name: event.name });
  }

  if (event.type === 'tool_result') {
    return event.ok
      ? t('agentChat.liveToolDone', { name: event.name })
      : t('agentChat.liveToolError', { name: event.name });
  }

  if (event.type === 'error') {
    return `${t('agentChat.errorPrefix')}: ${event.message}`;
  }

  return undefined;
};

const buildLiveAssistantContent = (steps: string[], t: TTranslate) =>
  [t('agentChat.processing'), '', ...steps.map((step) => `- ${step}`)].join('\n');

const createMessageAttachments = (files: ITemplateAgentFileState[]): ITemplateAgentMessageAttachment[] =>
  files.map((file) => ({ ...file }));

const splitInlineCode = (text: string) => text.split(/(`[^`]+`)/g);

const MarkdownLite = ({ content, variant = 'assistant' }: { content: string; variant?: 'assistant' | 'user' }) => {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let isCodeBlock = false;
  const isUser = variant === 'user';
  const inlineCodeClassName = isUser
    ? 'rounded bg-white px-1.5 py-0.5 text-[0.92em] text-neutral-950'
    : 'rounded bg-neutral-200 px-1.5 py-0.5 text-[0.92em] text-neutral-950';
  const headingClassName = 'text-neutral-950';

  const renderInline = (value: string) => {
    let offset = 0;

    return splitInlineCode(value).map((part) => {
      const key = `${offset}-${part}`;
      offset += part.length + 1;
      return part.startsWith('`') && part.endsWith('`') ? (
        <code key={key} className={inlineCodeClassName}>
          {part.slice(1, -1)}
        </code>
      ) : (
        <span key={key}>{part}</span>
      );
    });
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const currentItems = listItems;
    listItems = [];
    let itemOffset = 0;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {currentItems.map((item) => {
          const key = `${itemOffset}-${item}`;
          itemOffset += item.length + 1;
          return <li key={key}>{renderInline(item)}</li>;
        })}
      </ul>,
    );
  };

  const flushCode = () => {
    if (codeLines.length === 0) return;
    const currentCode = codeLines.join('\n');
    codeLines = [];
    blocks.push(
      <pre
        key={`code-${blocks.length}`}
        className="my-3 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
        <code>{currentCode}</code>
      </pre>,
    );
  };

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (isCodeBlock) {
        isCodeBlock = false;
        flushCode();
      } else {
        flushList();
        isCodeBlock = true;
      }
      return;
    }

    if (isCodeBlock) {
      codeLines.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet?.[1]) {
      listItems.push(bullet[1]);
      return;
    }

    flushList();

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className={`mt-4 text-sm font-semibold ${headingClassName}`}>
          {renderInline(trimmed.slice(4))}
        </h3>,
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className={`mt-4 text-base font-semibold ${headingClassName}`}>
          {renderInline(trimmed.slice(3))}
        </h2>,
      );
      return;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h1 key={`h1-${blocks.length}`} className={`mt-4 text-lg font-semibold ${headingClassName}`}>
          {renderInline(trimmed.slice(2))}
        </h1>,
      );
      return;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2">
        {renderInline(trimmed)}
      </p>,
    );
  });

  flushList();
  flushCode();

  return <div className={`text-[15px] leading-7 ${isUser ? 'text-neutral-900' : 'text-neutral-800'}`}>{blocks}</div>;
};

export const TemplateAgentSection = () => {
  const navigate = useNavigate();
  const { t, locale, intlLocale } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const thinkingLogRef = useRef<HTMLDivElement | null>(null);
  const initialHistory = useMemo(() => {
    const storedHistory = readChatHistory(t);
    if (storedHistory?.sessions.length) {
      const activeSession =
        storedHistory.sessions.find((session) => session.id === storedHistory.active_session_id) ??
        storedHistory.sessions[0];
      return {
        activeSession,
        sessions: storedHistory.sessions,
      };
    }

    const emptySession = createEmptySession(t);
    return {
      activeSession: emptySession,
      sessions: [emptySession],
    };
  }, [t]);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<ITemplateAgentFileState[]>([]);
  const [sessions, setSessions] = useState<ITemplateAgentChatSession[]>(() => initialHistory.sessions);
  const [activeSessionId, setActiveSessionId] = useState(() => initialHistory.activeSession.id);
  const [messages, setMessages] = useState<ITemplateAgentMessage[]>(() => initialHistory.activeSession.messages);
  const [progressEvents, setProgressEvents] = useState<ITemplateAgentProgressEvent[]>(
    () => initialHistory.activeSession.progress_events,
  );
  const [previousResponseId, setPreviousResponseId] = useState<string | undefined>(
    () => initialHistory.activeSession.previous_response_id,
  );
  const [lastVariables, setLastVariables] = useState<ITemplateAgentVariableDefinitionResult[]>(
    () => initialHistory.activeSession.last_variables,
  );
  const [draftVariables, setDraftVariables] = useState<ITemplateAgentVariableDefinitionDraft[]>(
    () => initialHistory.activeSession.draft_variables,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [confirmingDraftId, setConfirmingDraftId] = useState<string>();
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [copiedDraftJsonId, setCopiedDraftJsonId] = useState<string>();

  const canRunAgent = (message.trim().length > 0 || files.length > 0) && !isRunning && !isUploading;
  const orderedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.updated_at - left.updated_at),
    [sessions],
  );
  const latestActivityKey = useMemo(() => {
    const latestMessage = messages[messages.length - 1];
    const latestProgressEvent = progressEvents[progressEvents.length - 1];

    return [
      activeSessionId,
      messages.length,
      latestMessage?.id ?? '',
      latestMessage?.content.length ?? 0,
      progressEvents.length,
      latestProgressEvent?.id ?? '',
      draftVariables.length,
      lastVariables.length,
      errorMessage.length,
      isRunning ? 'running' : 'idle',
    ].join(':');
  }, [
    activeSessionId,
    draftVariables.length,
    errorMessage.length,
    isRunning,
    lastVariables.length,
    messages,
    progressEvents,
  ]);
  const latestProgressEventId = progressEvents[progressEvents.length - 1]?.id ?? '';

  useEffect(() => {
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              title: buildSessionTitle(messages, t),
              updated_at: Date.now(),
              messages,
              progress_events: progressEvents,
              previous_response_id: previousResponseId,
              last_variables: lastVariables,
              draft_variables: draftVariables,
              is_running: isRunning,
              interrupted_at: isRunning ? undefined : session.interrupted_at,
            }
          : session,
      ),
    );
  }, [activeSessionId, draftVariables, isRunning, lastVariables, messages, previousResponseId, progressEvents, t]);

  useEffect(() => {
    const nonEmptySessions = sessions.filter(
      (session) =>
        session.messages.length > 0 ||
        session.progress_events.length > 0 ||
        Boolean(session.previous_response_id) ||
        session.last_variables.length > 0 ||
        session.draft_variables.length > 0 ||
        session.id === activeSessionId,
    );

    if (nonEmptySessions.length === 0) {
      removeChatHistory();
      return;
    }

    writeChatHistory({
      active_session_id: activeSessionId,
      sessions: nonEmptySessions,
    });
  }, [activeSessionId, sessions]);

  useEffect(() => {
    const flushChatHistory = () => {
      const nextSessions = sessions.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              title: buildSessionTitle(messages, t),
              updated_at: Date.now(),
              messages,
              progress_events: progressEvents,
              previous_response_id: previousResponseId,
              last_variables: lastVariables,
              draft_variables: draftVariables,
              is_running: isRunning,
              interrupted_at: isRunning ? undefined : session.interrupted_at,
            }
          : session,
      );

      writeChatHistory({
        active_session_id: activeSessionId,
        sessions: nextSessions,
      });
    };

    window.addEventListener('beforeunload', flushChatHistory);
    return () => window.removeEventListener('beforeunload', flushChatHistory);
  }, [
    activeSessionId,
    draftVariables,
    isRunning,
    lastVariables,
    messages,
    previousResponseId,
    progressEvents,
    sessions,
    t,
  ]);

  useEffect(() => {
    if (!latestActivityKey) return;

    const frameId = window.requestAnimationFrame(() => {
      const scrollContainer = mainScrollRef.current;
      if (!scrollContainer) return;

      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [latestActivityKey]);

  useEffect(() => {
    if (!latestProgressEventId) return;

    const frameId = window.requestAnimationFrame(() => {
      const thinkingLog = thinkingLogRef.current;
      if (!thinkingLog) return;

      thinkingLog.scrollTo({
        top: thinkingLog.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [latestProgressEventId]);

  const openVariableDetail = (definition: ITemplateAgentVariableDefinitionResult) => {
    if (definition.variable_type === 'FIELD_VARIABLE') {
      void navigate({ to: '/template-variables/fields' });
      return;
    }

    void navigate({
      to: '/template-variables/$id',
      params: { id: definition.id },
      search: {
        variable_type: getVariableDetailSearchType(definition.variable_type),
      },
    });
  };

  const revokeFilePreviews = (items: Array<{ preview_url?: string }>) => {
    items.forEach((item) => {
      if (item.preview_url) {
        URL.revokeObjectURL(item.preview_url);
      }
    });
  };

  const revokeMessageAttachmentPreviews = (chatMessages: ITemplateAgentMessage[]) => {
    chatMessages.forEach((item) => {
      revokeFilePreviews(item.attachments ?? []);
    });
  };

  const loadSession = (session: ITemplateAgentChatSession) => {
    if (isRunning || isUploading) return;

    revokeFilePreviews(files);
    setFiles([]);
    setMessage('');
    setProgressEvents(session.progress_events);
    setErrorMessage(session.interrupted_at ? t('agentChat.reloadInterrupted') : '');
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setPreviousResponseId(session.previous_response_id);
    setLastVariables(session.last_variables);
    setDraftVariables(session.draft_variables);
  };

  const startNewChat = () => {
    if (isRunning || isUploading) return;

    revokeFilePreviews(files);
    const nextSession = createEmptySession(t);
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setFiles([]);
    setMessage('');
    setMessages([]);
    setProgressEvents([]);
    setPreviousResponseId(undefined);
    setLastVariables([]);
    setDraftVariables([]);
    setErrorMessage('');
  };

  const deleteSession = (sessionId: string) => {
    if (isRunning || isUploading) return;

    const sessionToDelete = sessions.find((session) => session.id === sessionId);
    if (sessionToDelete) {
      revokeMessageAttachmentPreviews(sessionToDelete.messages);
    }

    const remainingSessions = sessions.filter((session) => session.id !== sessionId);
    const nextSession = remainingSessions[0] ?? createEmptySession(t);
    setSessions(remainingSessions.length > 0 ? remainingSessions : [nextSession]);

    if (sessionId === activeSessionId) {
      loadSession(nextSession);
    }
  };

  const uploadFiles = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    setErrorMessage('');
    setIsUploading(true);
    const availableSlots = MAX_AGENT_FILES - files.length;
    const filesToUpload = selectedFiles.slice(0, Math.max(availableSlots, 0));
    const uploadedFiles: ITemplateAgentFileState[] = [];

    try {
      if (availableSlots <= 0) {
        throw new Error(t('agentChat.uploadLimit', { max: MAX_AGENT_FILES }));
      }

      for (const file of filesToUpload) {
        const uploaded = await uploadTemplateAgentFileAPI(file);
        uploadedFiles.push({
          ...uploaded,
          local_name: file.name,
          preview_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        });
      }

      setFiles((current) => [...current, ...uploadedFiles]);
      if (selectedFiles.length > filesToUpload.length) {
        setErrorMessage(t('agentChat.uploadLimitSkipped', { max: MAX_AGENT_FILES }));
      }
    } catch (error) {
      uploadedFiles.forEach((file) => {
        if (file.preview_url) {
          URL.revokeObjectURL(file.preview_url);
        }
      });
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    void uploadFiles(selectedFiles);
  };

  const handlePasteMessage = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedFiles = Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (pastedFiles.length === 0) return;

    event.preventDefault();
    void uploadFiles(pastedFiles);
  };

  const handleMessageKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void runAgent();
  };

  const handleComposerDrop = (event: React.DragEvent<HTMLFieldSetElement>) => {
    event.preventDefault();
    if (isRunning || isUploading) return;

    void uploadFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const submitAgentRequest = async (
    trimmedMessage: string,
    sendingFiles: ITemplateAgentFileState[],
    options: { clearComposer?: boolean } = {},
  ) => {
    if (isRunning || isUploading) return;
    const sendingFileIds = sendingFiles.map((file) => file.file_id);

    setErrorMessage('');
    setIsRunning(true);
    setDraftVariables([]);
    setProgressEvents([]);
    const userMessage: ITemplateAgentMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmedMessage,
      attachments: createMessageAttachments(sendingFiles),
      created_at: Date.now(),
    };
    const assistantMessageId = createMessageId();
    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: t('agentChat.processing'),
        created_at: Date.now(),
      },
    ]);
    if (options.clearComposer) {
      setMessage('');
      setFiles([]);
    }

    try {
      const streamState: {
        finalResponse?: ITemplateAgentChatResponse;
        error?: string;
      } = {};
      const liveSteps: string[] = [];

      await streamTemplateAgentChatAPI(
        {
          message: trimmedMessage,
          language: locale,
          file_ids: sendingFileIds,
          previous_response_id: previousResponseId,
          allow_apply: false,
        },
        (event) => {
          setProgressEvents((current) => [
            ...current,
            {
              id: createMessageId(),
              created_at: Date.now(),
              event,
            },
          ]);

          const liveStep = getLiveStepText(event, t);
          if (liveStep) {
            liveSteps.push(liveStep);
            const liveContent = buildLiveAssistantContent(liveSteps.slice(-MAX_LIVE_STEPS), t);
            setMessages((current) =>
              current.map((item) => (item.id === assistantMessageId ? { ...item, content: liveContent } : item)),
            );
          }

          if (event.type === 'message' && event.text) {
            setMessages((current) =>
              current.map((item) => (item.id === assistantMessageId ? { ...item, content: event.text } : item)),
            );
          }

          if (event.type === 'error') {
            streamState.error = event.message;
          }

          if (event.type === 'done') {
            streamState.finalResponse = event.response;
          }
        },
      );

      if (streamState.error) {
        throw new Error(streamState.error);
      }

      const response = streamState.finalResponse;
      if (!response) {
        throw new Error(t('agentChat.responseEndedWithoutFinal'));
      }
      const variableDefinitions = response.variable_definitions ?? [];
      const draftDefinitions = response.draft_variable_definitions ?? [];

      setPreviousResponseId(response.response_id);
      setLastVariables(variableDefinitions);
      setDraftVariables(draftDefinitions);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: response.output_text || t('agentChat.noDisplayContent'),
                response,
                created_at: item.created_at ?? Date.now(),
              }
            : item,
        ),
      );
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: `${t('agentChat.errorPrefix')}: ${formatErrorMessage(error)}`,
              }
            : item,
        ),
      );
    } finally {
      setIsRunning(false);
    }
  };

  const runAgent = async () => {
    const trimmedMessage = message.trim() || t('templateAgent.defaultFileMessage');
    if (!canRunAgent) return;

    await submitAgentRequest(trimmedMessage, files, {
      clearComposer: true,
    });
  };

  const cloneAttachmentsForRetry = (attachments: ITemplateAgentMessageAttachment[] = []): ITemplateAgentFileState[] =>
    attachments.map((attachment) => ({ ...attachment }));

  const cloneAttachmentsForComposer = (
    attachments: ITemplateAgentMessageAttachment[] = [],
  ): ITemplateAgentFileState[] =>
    attachments.map(({ preview_url: _previewUrl, ...attachment }) => ({
      ...attachment,
    }));

  const copyMessageContent = async (item: ITemplateAgentMessage) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopiedMessageId(item.id);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === item.id ? undefined : current));
      }, 1_500);
    } catch (error) {
      setErrorMessage(t('agentChat.copyFailed', { error: formatErrorMessage(error) }));
    }
  };

  const copyDraftJson = async (draft: ITemplateAgentVariableDefinitionDraft) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft.definition, null, 2));
      setCopiedDraftJsonId(draft.id);
      window.setTimeout(() => {
        setCopiedDraftJsonId((current) => (current === draft.id ? undefined : current));
      }, 1_500);
    } catch (error) {
      setErrorMessage(t('agentChat.copyJsonFailed', { error: formatErrorMessage(error) }));
    }
  };

  const editUserMessage = (item: ITemplateAgentMessage) => {
    if (item.role !== 'user' || isRunning || isUploading) return;

    revokeFilePreviews(files);
    setMessage(item.content);
    setFiles(cloneAttachmentsForComposer(item.attachments));
    setErrorMessage('');
  };

  const retryUserMessage = async (item: ITemplateAgentMessage) => {
    if (item.role !== 'user' || isRunning || isUploading) return;

    const retryMessage = item.content.trim() || t('templateAgent.defaultFileMessage');
    await submitAgentRequest(retryMessage, cloneAttachmentsForRetry(item.attachments));
  };

  const confirmDraft = async (draft: ITemplateAgentVariableDefinitionDraft) => {
    if (confirmingDraftId) return;

    setErrorMessage('');
    setConfirmingDraftId(draft.id);
    try {
      const savedDefinition = await runTemplateAgentToolAPI<ITemplateAgentVariableDefinitionResult>(
        'write_template_variable_definition',
        {
          arguments: {
            category: draft.category,
            file_name: draft.file_name,
            definition: draft.definition,
          },
          allow_apply: true,
        },
      );

      setLastVariables((current) => [savedDefinition, ...current.filter((item) => item.id !== savedDefinition.id)]);
      setDraftVariables((current) => current.filter((item) => item.id !== draft.id));
      openVariableDetail(savedDefinition);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setConfirmingDraftId(undefined);
    }
  };

  const clearSession = () => {
    files.forEach((file) => {
      if (file.preview_url) {
        URL.revokeObjectURL(file.preview_url);
      }
    });
    messages.forEach((item) => {
      item.attachments?.forEach((attachment) => {
        if (attachment.preview_url) {
          URL.revokeObjectURL(attachment.preview_url);
        }
      });
    });
    setFiles([]);
    setMessages([]);
    setProgressEvents([]);
    setPreviousResponseId(undefined);
    setLastVariables([]);
    setDraftVariables([]);
    setErrorMessage('');
  };

  const removeComposerFile = (fileId: string) => {
    setFiles((current) =>
      current.filter((item) => {
        if (item.file_id === fileId && item.preview_url) {
          URL.revokeObjectURL(item.preview_url);
        }
        return item.file_id !== fileId;
      }),
    );
  };

  const renderAttachmentPreview = (attachment: ITemplateAgentMessageAttachment, removable = false) => (
    <div
      key={attachment.file_id}
      className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
      {attachment.preview_url ? (
        <img
          src={attachment.preview_url}
          alt={attachment.local_name || attachment.original_name}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-neutral-600">
          <FileText className="size-5" />
          <span className="line-clamp-2 break-all">{attachment.local_name || attachment.original_name}</span>
        </div>
      )}
      {removable ? (
        <button
          type="button"
          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow hover:bg-red-600 hover:text-white"
          onClick={() => removeComposerFile(attachment.file_id)}
          title={t('agentChat.removeFile')}>
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );

  const getDraftStaticHtml = (draft: ITemplateAgentVariableDefinitionDraft) => {
    const uiConfig =
      draft.definition.ui_config &&
      typeof draft.definition.ui_config === 'object' &&
      !Array.isArray(draft.definition.ui_config)
        ? (draft.definition.ui_config as Record<string, unknown>)
        : {};
    const documentTemplate =
      uiConfig.document_template &&
      typeof uiConfig.document_template === 'object' &&
      !Array.isArray(uiConfig.document_template)
        ? (uiConfig.document_template as Record<string, unknown>)
        : {};

    return typeof documentTemplate.static_html === 'string' ? documentTemplate.static_html : undefined;
  };

  const buildDraftPreviewSrcDoc = (staticHtml: string) =>
    [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      '<style>',
      'html,body{margin:0;padding:0;background:#fff;color:#000;}',
      'body{font-family:"Times New Roman",Times,serif;}',
      '*{box-sizing:border-box;}',
      '.template-agent-draft-preview{width:794px;min-height:1123px;margin:0 auto;background:#fff;overflow:visible;}',
      '</style>',
      '</head>',
      '<body>',
      '<main class="template-agent-draft-preview">',
      staticHtml,
      '</main>',
      '</body>',
      '</html>',
    ].join('');

  const renderDraftPreview = (draft: ITemplateAgentVariableDefinitionDraft) => {
    const staticHtml = getDraftStaticHtml(draft);
    if (!staticHtml) return null;

    return (
      <details
        key={`${draft.id}-preview`}
        open
        className="group mt-3 rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-neutral-700">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-neutral-500" />
            <span className="truncate">{t('templateAgent.previewLayout', { key: draft.key })}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-neutral-400 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-neutral-200 bg-neutral-50 p-3">
          <iframe
            title={t('templateAgent.previewTitle', { key: draft.key })}
            srcDoc={buildDraftPreviewSrcDoc(staticHtml)}
            sandbox=""
            className="h-[420px] w-full rounded-xl border border-neutral-200 bg-white"
          />
        </div>
      </details>
    );
  };

  const renderDraftJson = (draft: ITemplateAgentVariableDefinitionDraft) => (
    <details
      key={`${draft.id}-json`}
      open
      className="group mt-3 rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-neutral-700">
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-neutral-500" />
          <span className="truncate">{t('templateAgent.finalJson', { key: draft.key })}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void copyDraftJson(draft);
            }}
            title={t('templateAgent.copyFinalJson')}>
            <Copy className="size-3.5" />
            {copiedDraftJsonId === draft.id ? t('agentChat.copied') : t('templateAgent.copyFinalJson')}
          </button>
          <ChevronDown className="size-4 text-neutral-400 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-neutral-200 bg-neutral-50 p-3">
        <div className="mb-2 flex flex-wrap gap-2 text-xs text-neutral-500">
          <span className="rounded-full bg-white px-2 py-1">
            {t('templateAgent.category', { value: draft.category })}
          </span>
          <span className="rounded-full bg-white px-2 py-1">{t('templateAgent.file', { value: draft.file_name })}</span>
        </div>
        <pre className="max-h-[420px] overflow-auto rounded-xl border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-800">
          <code>{JSON.stringify(draft.definition, null, 2)}</code>
        </pre>
      </div>
    </details>
  );

  const renderMessageActions = (item: ITemplateAgentMessage) => (
    <div className={`mt-2 flex flex-wrap gap-1.5 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
        onClick={() => void copyMessageContent(item)}
        title={t('agentChat.copyMessage')}>
        <Copy className="size-3.5" />
        {copiedMessageId === item.id ? t('agentChat.copied') : t('agentChat.copy')}
      </button>
      {item.role === 'user' ? (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => editUserMessage(item)}
            disabled={isRunning || isUploading}
            title={t('agentChat.editMessage')}>
            <Pencil className="size-3.5" />
            {t('agentChat.edit')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void retryUserMessage(item)}
            disabled={isRunning || isUploading}
            title={t('agentChat.retryMessage')}>
            <RotateCcw className="size-3.5" />
            {t('agentChat.retry')}
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-white text-neutral-950">
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-neutral-300 bg-[#e8ecef] md:flex xl:w-[292px]">
        <div className="flex h-16 items-center border-b border-neutral-300 px-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-white/70 hover:text-neutral-950"
            onClick={startNewChat}
            disabled={isRunning || isUploading}
            title={t('agentChat.newChat')}>
            <Plus className="size-4" />
            <span>{t('agentChat.newChat')}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-normal text-neutral-500">
            {t('agentChat.chatHistory')}
          </div>
          <div className="space-y-1">
            {orderedSessions.map((session) => (
              <div key={session.id} className="group relative">
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 pr-10 text-left text-sm ${
                    session.id === activeSessionId
                      ? 'bg-white text-neutral-950 shadow-sm'
                      : 'text-neutral-700 hover:bg-white/70 hover:text-neutral-950'
                  }`}
                  onClick={() => loadSession(session)}>
                  <MessageSquare className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{getSessionDisplayTitle(session.title, t)}</span>
                </button>
                <button
                  type="button"
                  className={`absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 ${
                    session.id === activeSessionId
                      ? 'text-neutral-500 hover:bg-neutral-100 hover:text-red-600'
                      : 'text-neutral-400 hover:bg-red-50 hover:text-red-600'
                  }`}
                  onClick={() => deleteSession(session.id)}
                  disabled={isRunning || isUploading}
                  title={t('agentChat.deleteChat')}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/95 px-6 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 md:hidden"
              onClick={startNewChat}
              disabled={isRunning || isUploading}
              title={t('agentChat.newChat')}>
              <Plus className="size-5" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">
                {messages.length > 0 ? buildSessionTitle(messages, t) : t('templateAgent.title')}
              </div>
            </div>
          </div>
          {messages.length > 0 ? (
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
              onClick={clearSession}
              title={t('agentChat.clearChat')}>
              <RotateCcw className="size-4" />
            </button>
          ) : null}
        </header>

        <main ref={mainScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
            {messages.length === 0 ? (
              <div className="flex min-h-[48vh] items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-semibold tracking-normal text-neutral-950">
                    {t('templateAgent.title')}
                  </div>
                  <div className="mt-3 text-sm text-neutral-500">{t('templateAgent.emptySubtitle')}</div>
                </div>
              </div>
            ) : (
              messages.map((item) => (
                <article key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {item.role === 'user' ? (
                    <div className="flex max-w-[82%] flex-col items-end">
                      <div className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-950 shadow-sm">
                        {item.attachments?.length ? (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {item.attachments.map((attachment) => renderAttachmentPreview(attachment))}
                          </div>
                        ) : null}
                        <MarkdownLite content={item.content} variant="user" />
                      </div>
                      {renderMessageActions(item)}
                    </div>
                  ) : (
                    <div className="w-full max-w-[90%] py-1">
                      <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
                        <Bot className="size-4" />
                        <span>{t('agentChat.assistant')}</span>
                        {item.created_at ? <span>{formatProgressTime(item.created_at, intlLocale)}</span> : null}
                        {isRunning && item.id === messages[messages.length - 1]?.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : null}
                      </div>
                      <MarkdownLite content={item.content} />
                      {renderMessageActions(item)}

                      {item.response?.variable_definitions?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.response.variable_definitions.map((definition) => (
                            <Button
                              key={definition.id}
                              type="button"
                              size="sm"
                              onClick={() => openVariableDetail(definition)}>
                              <ExternalLink className="mr-2 size-4" />
                              {t('templateAgent.openDetail', { key: definition.key })}
                            </Button>
                          ))}
                        </div>
                      ) : null}

                      {item.response?.draft_variable_definitions?.length ? (
                        <>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.response.draft_variable_definitions.map((draft) => (
                              <Button
                                key={draft.id}
                                type="button"
                                size="sm"
                                disabled={Boolean(confirmingDraftId)}
                                onClick={() => confirmDraft(draft)}>
                                {confirmingDraftId === draft.id ? (
                                  <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="mr-2 size-4" />
                                )}
                                {t('templateAgent.confirm', { key: draft.key })}
                              </Button>
                            ))}
                          </div>
                          {item.response.draft_variable_definitions.map(renderDraftPreview)}
                          {item.response.draft_variable_definitions.map(renderDraftJson)}
                        </>
                      ) : null}
                    </div>
                  )}
                </article>
              ))
            )}

            {progressEvents.length > 0 ? (
              <details
                className="group rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
                open={isRunning}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-neutral-700">
                  <span className="flex min-w-0 items-center gap-2">
                    {isRunning ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-neutral-500" />
                    ) : (
                      <Bot className="size-3.5 shrink-0 text-neutral-500" />
                    )}
                    <span>{t('agentChat.thinking')}</span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                      {progressEvents.length}
                    </span>
                  </span>
                  <ChevronDown className="size-4 text-neutral-400 transition group-open:rotate-180" />
                </summary>
                <div ref={thinkingLogRef} className="mt-3 max-h-[300px] space-y-2 overflow-auto pr-1">
                  {progressEvents.map(({ id, created_at, event }) => (
                    <div
                      key={id}
                      className={`rounded-xl border bg-neutral-50 px-3 py-2 text-xs ${
                        event.type === 'error' || (event.type === 'tool_result' && !event.ok)
                          ? 'border-red-200'
                          : 'border-neutral-200'
                      }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={`font-semibold ${
                            event.type === 'error' || (event.type === 'tool_result' && !event.ok)
                              ? 'text-red-700'
                              : 'text-neutral-700'
                          }`}>
                          {getStreamEventTitle(event, t)}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-neutral-500">
                          <span>{formatProgressTime(created_at, intlLocale)}</span>
                          {'round' in event && event.round !== undefined ? (
                            <span className="rounded-full bg-white px-2 py-0.5 font-medium">
                              {t('agentChat.round', { round: event.round })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {getStreamEventDetail(event, t) ? (
                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-[11px] leading-5 text-neutral-800">
                          {getStreamEventDetail(event, t)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            <div aria-hidden="true" />
          </div>
        </main>

        <footer className="sticky bottom-0 z-20 shrink-0 bg-white/95 px-4 pb-5 pt-3 backdrop-blur">
          <div className="mx-auto w-full max-w-4xl space-y-3">
            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            {draftVariables.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {draftVariables.map((draft) => (
                    <Button
                      key={draft.id}
                      type="button"
                      size="sm"
                      disabled={Boolean(confirmingDraftId)}
                      onClick={() => confirmDraft(draft)}>
                      {confirmingDraftId === draft.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 size-4" />
                      )}
                      {t('templateAgent.confirm', { key: draft.key })}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {lastVariables.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lastVariables.slice(0, 3).map((definition) => (
                  <button
                    key={definition.id}
                    type="button"
                    className="flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    onClick={() => openVariableDetail(definition)}>
                    <span className="truncate">{definition.key}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </button>
                ))}
              </div>
            ) : null}

            <fieldset
              className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm"
              aria-label={t('templateAgent.composerLabel')}
              onDrop={handleComposerDrop}
              onDragOver={(event) => event.preventDefault()}>
              {files.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {files.map((file) => renderAttachmentPreview(file, true))}
                </div>
              ) : null}

              <Textarea
                id="template-agent-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onPaste={handlePasteMessage}
                onKeyDown={handleMessageKeyDown}
                placeholder={t('templateAgent.defaultMessage')}
                className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-base leading-7 text-neutral-950 placeholder:text-neutral-400 focus-visible:ring-0"
              />

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex size-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isUploading || isRunning}
                    onClick={() => fileInputRef.current?.click()}
                    title={t('agentChat.uploadFile')}>
                    {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-5" />}
                  </button>
                  <span className="text-xs text-neutral-500">
                    {isUploading
                      ? t('agentChat.uploading')
                      : files.length > 0
                        ? t('agentChat.attachedFiles', { count: files.length })
                        : t('templateAgent.fileHint')}
                  </span>
                </div>

                <button
                  type="button"
                  className={`flex size-10 items-center justify-center rounded-full ${
                    canRunAgent
                      ? 'bg-neutral-950 text-white hover:bg-neutral-800'
                      : 'cursor-not-allowed bg-neutral-200 text-neutral-400'
                  }`}
                  disabled={!canRunAgent}
                  onClick={() => void runAgent()}
                  title={t('agentChat.send')}>
                  {isRunning || isUploading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                </button>
              </div>

              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUploadFile} />
            </fieldset>
          </div>
        </footer>
      </div>
    </div>
  );
};
