import { useNavigate } from '@tanstack/react-router';
import {
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'reactjs-platform/ui';
import {
  deleteDocumentInputAgentChatHistorySessionAPI,
  getDocumentInputAgentChatHistorySessionAPI,
  getDocumentInputAgentChatHistorySummaryAPI,
  getDocumentInputAgentSettingsAPI,
  isDocumentInputAgentStreamNetworkError,
  runDocumentInputAgentToolAPI,
  saveDocumentInputAgentChatHistorySessionAPI,
  streamDocumentInputAgentChatAPI,
  uploadDocumentInputAgentFileAPI,
  type IDocumentInputAgentAppliedDocument,
  type IDocumentInputAgentChatHistoryPayload,
  type IDocumentInputAgentChatPayload,
  type IDocumentInputAgentChatResponse,
  type IDocumentInputAgentFillDraft,
  type IDocumentInputAgentSheetSelectionChoice,
  type IDocumentInputAgentSheetSelectionRequest,
  type TDocumentInputAgentStreamEvent,
} from 'api';
import type {
  IDocumentInputAgentSelectedTemplate,
  TDocumentInputAgentCreateDocumentMode,
} from './document-input-agent-action.type';
import type {
  IDocumentInputAgentChatHistory,
  IDocumentInputAgentChatSession,
  IDocumentInputAgentFileState,
  IDocumentInputAgentMessage,
  IDocumentInputAgentMessageAttachment,
  IDocumentInputAgentProgressEvent,
  ILegacyDocumentInputAgentChatHistory,
} from './document-input-agent.type';
import { DocumentInputAgentTemplateSelector } from './document-input-agent-template-selector.component';
import { useDocumentInputAgentActions } from './use-document-input-agent-actions.hook';
import { useTranslation } from '../../i18n';

type TTranslate = ReturnType<typeof useTranslation>['t'];

const createMessageId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const LEGACY_DOCUMENT_INPUT_AGENT_HISTORY_STORAGE_KEY = 'document-input-agent-chat-history-v1';
const MAX_AGENT_FILES = 10;
const MAX_LIVE_STEPS = 8;
const MAX_STORED_PROGRESS_EVENTS = 80;
const MAX_STORED_PROGRESS_VALUE_CHARS = 1_800;
const REMOTE_HISTORY_SAVE_DELAY_MS = 900;
const LONG_TEXT_ATTACHMENT_MIN_CHARS = 6_000;
const COMPOSER_TEXTAREA_COMPACT_MIN_HEIGHT = 24;
const COMPOSER_TEXTAREA_EXPANDED_MIN_HEIGHT = 56;
const COMPOSER_TEXTAREA_MAX_HEIGHT = 220;
const DOCUMENT_INPUT_AGENT_ACCEPT = '.docx,.txt,.md,.xlsx,.csv,.pptx,image/png,image/jpeg,image/webp,image/gif';
const FALLBACK_DOCUMENT_INPUT_AGENT_MODELS = [
  'gpt-5.5',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4',
  'openrouter/openai/gpt-5.4',
  'openrouter/openai/gpt-5.3-codex',
  'openrouter/qwen/qwen3.5-27b',
  'openrouter/qwen/qwen3.5-flash-02-23',
  'openrouter/qwen/qwen3.6-27b',
  'openrouter/qwen/qwen3.6-flash',
];

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

const formatLlmModelLabel = (model: string) => {
  if (model === 'gpt-5.5') return 'GPT-5.5';
  if (model === 'gpt-4.1') return 'GPT-4.1';
  if (model === 'gpt-4.1-mini') return 'GPT-4.1 Mini';
  if (model === 'gpt-4o') return 'GPT-4o';
  if (model === 'gpt-4o-mini') return 'GPT-4o Mini';
  if (model === 'gpt-4') return 'GPT-4';
  if (model === 'openrouter/openai/gpt-5.4') return 'GPT-5.4 (OpenRouter)';
  if (model === 'openrouter/openai/gpt-5.3-codex') return 'GPT-5.3 Codex (OpenRouter)';
  if (model === 'openrouter/qwen/qwen3.5-27b') return 'Qwen 3.5 27B';
  if (model === 'openrouter/qwen/qwen3.5-flash-02-23') return 'Qwen 3.5 Flash';
  if (model === 'openrouter/qwen/qwen3.6-27b') return 'Qwen 3.6 27B';
  if (model === 'openrouter/qwen/qwen3.6-flash') return 'Qwen 3.6 Flash';
  return model.split('/').at(-1) || model;
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const formatAgentRunErrorMessage = (error: unknown, t: TTranslate) =>
  isDocumentInputAgentStreamNetworkError(error) ? t('agentChat.streamNetworkError') : formatErrorMessage(error);

const formatTokenCount = (value?: number) => new Intl.NumberFormat('en-US').format(value ?? 0);

const formatUsd = (value?: number) => {
  const amount = value ?? 0;
  const fractionDigits = amount > 0 && amount < 0.01 ? 6 : 4;
  return `$${amount.toFixed(fractionDigits)}`;
};

const formatUsageCost = (cost: { total_usd: number; is_configured: boolean } | undefined, t: TTranslate) =>
  cost?.is_configured ? formatUsd(cost.total_usd) : t('agentChat.unconfiguredPrice');

type TDocumentInputAgentUsageSummary = NonNullable<IDocumentInputAgentChatResponse['usage']>;

const aggregateUsageSummaries = (
  usageSummaries: TDocumentInputAgentUsageSummary[],
): TDocumentInputAgentUsageSummary | undefined => {
  if (usageSummaries.length === 0) return undefined;

  const firstCost = usageSummaries[0].cost;
  const configuredCost = usageSummaries.find((usage) => usage.cost.is_configured)?.cost ?? firstCost;
  const allCostsConfigured = usageSummaries.every((usage) => usage.cost.is_configured);
  const cost = usageSummaries.reduce<TDocumentInputAgentUsageSummary['cost']>(
    (current, usage) => ({
      currency: usage.cost.currency,
      input_usd: current.input_usd + usage.cost.input_usd,
      output_usd: current.output_usd + usage.cost.output_usd,
      total_usd: current.total_usd + usage.cost.total_usd,
      input_usd_per_1m_tokens: configuredCost.input_usd_per_1m_tokens,
      output_usd_per_1m_tokens: configuredCost.output_usd_per_1m_tokens,
      is_configured: allCostsConfigured,
    }),
    {
      currency: firstCost.currency,
      input_usd: 0,
      output_usd: 0,
      total_usd: 0,
      input_usd_per_1m_tokens: configuredCost.input_usd_per_1m_tokens,
      output_usd_per_1m_tokens: configuredCost.output_usd_per_1m_tokens,
      is_configured: allCostsConfigured,
    },
  );

  return {
    input_tokens: usageSummaries.reduce((total, usage) => total + usage.input_tokens, 0),
    output_tokens: usageSummaries.reduce((total, usage) => total + usage.output_tokens, 0),
    total_tokens: usageSummaries.reduce((total, usage) => total + usage.total_tokens, 0),
    cached_input_tokens: usageSummaries.reduce((total, usage) => total + (usage.cached_input_tokens ?? 0), 0),
    reasoning_output_tokens: usageSummaries.reduce((total, usage) => total + (usage.reasoning_output_tokens ?? 0), 0),
    response_count: usageSummaries.reduce((total, usage) => total + usage.response_count, 0),
    cost,
    items: usageSummaries.flatMap((usage) => usage.items),
  };
};

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

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

const getStatusEventTitle = (event: Extract<TDocumentInputAgentStreamEvent, { type: 'status' }>, t: TTranslate) => {
  const phaseTitleMap: Record<string, string> = {
    queued: t('agentChat.statusTitles.queued'),
    parse_source: t('agentChat.statusTitles.parseSource'),
    read_template: t('agentChat.statusTitles.readTemplate'),
    compile_schema: t('agentChat.statusTitles.compileSchema'),
    llm_extract: t('agentChat.statusTitles.llmExtract'),
    db_resolve: t('agentChat.statusTitles.dbResolve'),
    validate_fill: t('agentChat.statusTitles.validateFill'),
    preview_created: t('agentChat.statusTitles.previewCreated'),
    apply_created: t('agentChat.statusTitles.applyCreated'),
    retrying: t('agentChat.statusTitles.retrying'),
    llm_retry: t('agentChat.statusTitles.retrying'),
    stopped: t('agentChat.statusTitles.stopped'),
    failed: t('agentChat.statusTitles.failed'),
  };

  return event.phase ? phaseTitleMap[event.phase] || formatPhaseTitle(event.phase) : event.message;
};

const getStreamEventTitle = (event: TDocumentInputAgentStreamEvent, t: TTranslate) => {
  switch (event.type) {
    case 'status':
      return getStatusEventTitle(event, t);
    case 'response':
      return event.usage
        ? `${t('agentChat.llmResponse')} · ${formatTokenCount(event.usage.total_tokens)} token`
        : `${t('agentChat.llmResponse')} ${event.response_id}`;
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

const getStreamEventDetail = (event: TDocumentInputAgentStreamEvent, t: TTranslate) => {
  switch (event.type) {
    case 'status':
      return [
        event.phase ? `${t('agentChat.phase')}: ${event.phase}` : '',
        event.stage ? `stage: ${event.stage}` : '',
        event.attempt !== undefined ? `attempt: ${event.attempt}/${event.max_attempts ?? '?'}` : '',
        event.recoverable !== undefined ? `recoverable: ${String(event.recoverable)}` : '',
        event.run_id ? `run_id: ${event.run_id}` : '',
        event.duration_ms !== undefined ? `${t('agentChat.durationMs')}: ${event.duration_ms}` : '',
        event.detail !== undefined ? stringifyCompact(event.detail) : '',
      ]
        .filter(Boolean)
        .join('\n');
    case 'response':
      return [
        `${t('agentChat.durationMs')}: ${event.duration_ms}`,
        event.usage ? `${t('agentChat.inputTokens')}: ${formatTokenCount(event.usage.input_tokens)}` : '',
        event.usage ? `${t('agentChat.outputTokens')}: ${formatTokenCount(event.usage.output_tokens)}` : '',
        event.usage ? `${t('agentChat.totalTokens')}: ${formatTokenCount(event.usage.total_tokens)}` : '',
        event.usage ? `${t('agentChat.cost')}: ${formatUsageCost(event.usage.cost, t)}` : '',
        `${t('agentChat.output')}: ${event.output_types.join(', ') || t('agentChat.none')}`,
      ]
        .filter(Boolean)
        .join('\n');
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
      return [
        event.response.output_text || `${t('agentChat.response')}: ${event.response.response_id}`,
        event.response.usage
          ? `${t('agentChat.totalTokens')}: ${formatTokenCount(event.response.usage.total_tokens)}`
          : '',
        event.response.usage ? `${t('agentChat.cost')}: ${formatUsageCost(event.response.usage.cost, t)}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    case 'error':
      return event.message;
    default:
      return '';
  }
};

const isProgressErrorEvent = (event: TDocumentInputAgentStreamEvent) =>
  event.type === 'error' || (event.type === 'tool_result' && !event.ok);

const isProgressRetryEvent = (event: TDocumentInputAgentStreamEvent) =>
  event.type === 'status' && (event.phase === 'llm_retry' || event.phase === 'retrying');

const isProgressStoppedEvent = (event: TDocumentInputAgentStreamEvent) =>
  event.type === 'status' && event.phase === 'stopped';

const formatProgressTime = (timestamp: number, intlLocale: string) =>
  new Date(timestamp).toLocaleTimeString(intlLocale, {
    hour12: false,
  });

const getProgressDurationSeconds = (progressEvents: IDocumentInputAgentProgressEvent[]) => {
  const firstEvent = progressEvents[0];
  const lastEvent =
    [...progressEvents]
      .reverse()
      .find(({ event }) => event.type === 'done' || event.type === 'error' || isProgressStoppedEvent(event)) ??
    progressEvents[progressEvents.length - 1];

  if (!firstEvent || !lastEvent) return 0;

  return Math.max(1, Math.ceil((lastEvent.created_at - firstEvent.created_at) / 1_000));
};

const createEmptySession = (t: TTranslate): IDocumentInputAgentChatSession => ({
  id: createMessageId(),
  title: t('agentChat.newChat'),
  updated_at: Date.now(),
  messages: [],
  progress_events: [],
  fill_drafts: [],
  applied_documents: [],
});

const getLatestResponseModel = (messages: IDocumentInputAgentMessage[]) =>
  [...messages].reverse().find((item) => item.response?.model)?.response?.model;

const getSessionModel = (session?: IDocumentInputAgentChatSession) =>
  session?.llm_model ?? getLatestResponseModel(session?.messages ?? []);

const buildSessionTitle = (messages: IDocumentInputAgentMessage[], t: TTranslate) => {
  const firstUserMessage = messages.find((item) => item.role === 'user')?.content.trim();
  if (!firstUserMessage) return t('agentChat.newChat');
  return firstUserMessage.length > 48 ? `${firstUserMessage.slice(0, 48)}...` : firstUserMessage;
};

const getSessionDisplayTitle = (title: string, t: TTranslate) =>
  ['Chat m\u1edbi', 'Cu\u1ed9c tr\u00f2 chuy\u1ec7n m\u1edbi', 'New chat'].includes(title.trim())
    ? t('agentChat.newChat')
    : title;

const removeLegacyLocalChatHistory = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_DOCUMENT_INPUT_AGENT_HISTORY_STORAGE_KEY);
};

const sanitizeMessageForRemoteHistory = (item: IDocumentInputAgentMessage): IDocumentInputAgentMessage => ({
  ...item,
  attachments: item.attachments?.map(({ preview_url: _previewUrl, ...attachment }) => attachment),
  response: item.response ? sanitizeChatResponseForRemoteHistory(item.response) : undefined,
});

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

const sanitizeToolCallForRemoteHistory = (
  toolCall: IDocumentInputAgentChatResponse['tool_calls'][number],
): IDocumentInputAgentChatResponse['tool_calls'][number] => ({
  ...toolCall,
  arguments: sanitizeStoredValue(toolCall.arguments) as Record<string, unknown>,
  result: sanitizeStoredValue(toolCall.result),
  evidence: toolCall.evidence ? (sanitizeStoredValue(toolCall.evidence) as Record<string, unknown>) : undefined,
});

const sanitizeChatResponseForRemoteHistory = (
  response: IDocumentInputAgentChatResponse,
): IDocumentInputAgentChatResponse => ({
  ...response,
  tool_calls: response.tool_calls.map(sanitizeToolCallForRemoteHistory),
});

const sanitizeProgressResponseForRemoteHistory = (
  response: IDocumentInputAgentChatResponse,
): IDocumentInputAgentChatResponse => ({
  response_id: response.response_id,
  model: response.model,
  output_text: response.output_text,
  tool_calls: response.tool_calls.map(sanitizeToolCallForRemoteHistory),
  allow_apply: response.allow_apply,
  usage: response.usage,
});

const sanitizeProgressEventForRemoteHistory = (
  item: IDocumentInputAgentProgressEvent,
): IDocumentInputAgentProgressEvent => {
  const { event } = item;

  if (event.type === 'status') {
    return {
      ...item,
      event: {
        ...event,
        detail: sanitizeStoredValue(event.detail),
      },
    };
  }

  if (event.type === 'tool_call') {
    return {
      ...item,
      event: {
        ...event,
        arguments: sanitizeStoredValue(event.arguments) as Record<string, unknown>,
      },
    };
  }

  if (event.type === 'tool_result') {
    return {
      ...item,
      event: {
        ...event,
        result: sanitizeStoredValue(event.result),
      },
    };
  }

  if (event.type === 'done') {
    return {
      ...item,
      event: {
        ...event,
        response: sanitizeProgressResponseForRemoteHistory(event.response),
      },
    };
  }

  return item;
};

const sanitizeProgressEventsForRemoteHistory = (progressEvents: IDocumentInputAgentProgressEvent[]) =>
  progressEvents.slice(-MAX_STORED_PROGRESS_EVENTS).map(sanitizeProgressEventForRemoteHistory);

const sanitizeSessionForRemoteHistory = (session: IDocumentInputAgentChatSession): IDocumentInputAgentChatSession => {
  const { is_read_only: _isReadOnly, is_summary: _isSummary, ...sanitizedSession } = session;

  return {
    ...sanitizedSession,
    messages: session.messages.map(sanitizeMessageForRemoteHistory),
    progress_events: sanitizeProgressEventsForRemoteHistory(session.progress_events),
  };
};

const hasPersistableSessionContent = (session: IDocumentInputAgentChatSession) =>
  !session.is_summary &&
  (session.messages.length > 0 ||
    session.progress_events.length > 0 ||
    Boolean(session.previous_response_id) ||
    session.fill_drafts.length > 0 ||
    session.applied_documents.length > 0);

const isEmptyEditableSession = (session?: IDocumentInputAgentChatSession) => {
  if (!session || session.is_summary || session.is_read_only) return false;
  return !hasPersistableSessionContent(session);
};

const markSessionsReadOnly = (sessions: IDocumentInputAgentChatSession[]) =>
  sessions.map((session) => ({
    ...session,
    is_read_only: true,
  }));

const markInterruptedSession = (
  session: IDocumentInputAgentChatSession,
  t: TTranslate,
): IDocumentInputAgentChatSession => {
  if (!session.is_running) return session;

  const interruptedAt = Date.now();
  const reloadInterruptedMessage = t('agentChat.reloadInterrupted');
  const messages = [...session.messages];
  const assistantIndex = [...messages].reverse().findIndex((item) => item.role === 'assistant' && !item.response);
  const actualIndex = assistantIndex >= 0 ? messages.length - 1 - assistantIndex : -1;

  if (actualIndex >= 0) {
    messages[actualIndex] = {
      ...messages[actualIndex],
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
    progress_events: [
      ...session.progress_events,
      {
        id: createMessageId(),
        created_at: interruptedAt,
        event: {
          type: 'error',
          message: reloadInterruptedMessage,
        },
      },
    ],
    is_running: false,
    interrupted_at: interruptedAt,
  };
};

const normalizeSession = (
  session: Partial<IDocumentInputAgentChatSession>,
  t: TTranslate,
): IDocumentInputAgentChatSession => ({
  id: typeof session.id === 'string' ? session.id : createMessageId(),
  title: typeof session.title === 'string' ? session.title : buildSessionTitle(session.messages ?? [], t),
  updated_at: typeof session.updated_at === 'number' ? session.updated_at : Date.now(),
  messages: Array.isArray(session.messages) ? session.messages : [],
  progress_events: Array.isArray(session.progress_events) ? session.progress_events : [],
  previous_response_id: typeof session.previous_response_id === 'string' ? session.previous_response_id : undefined,
  llm_model: typeof session.llm_model === 'string' ? session.llm_model : undefined,
  fill_drafts: Array.isArray(session.fill_drafts) ? session.fill_drafts : [],
  applied_documents: Array.isArray(session.applied_documents) ? session.applied_documents : [],
  is_running: session.is_running === true,
  interrupted_at: typeof session.interrupted_at === 'number' ? session.interrupted_at : undefined,
  is_summary: session.is_summary === true,
});

const normalizeChatHistory = (
  parsed: Partial<IDocumentInputAgentChatHistory & ILegacyDocumentInputAgentChatHistory>,
  t: TTranslate,
): IDocumentInputAgentChatHistory | null => {
  if (Array.isArray(parsed.sessions)) {
    const sessions = parsed.sessions.map((session) => {
      const normalizedSession = normalizeSession(session, t);
      return normalizedSession.is_summary ? normalizedSession : markInterruptedSession(normalizedSession, t);
    });

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
      id: 'legacy-document-input-agent-chat',
      title: buildSessionTitle(Array.isArray(parsed.messages) ? parsed.messages : [], t),
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      progress_events: Array.isArray(parsed.progress_events) ? parsed.progress_events : [],
      previous_response_id: typeof parsed.previous_response_id === 'string' ? parsed.previous_response_id : undefined,
      llm_model: typeof parsed.llm_model === 'string' ? parsed.llm_model : undefined,
      fill_drafts: Array.isArray(parsed.fill_drafts) ? parsed.fill_drafts : [],
      applied_documents: Array.isArray(parsed.applied_documents) ? parsed.applied_documents : [],
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
};

const getLiveStepText = (event: TDocumentInputAgentStreamEvent, t: TTranslate) => {
  if (event.type === 'status') {
    return getStatusEventTitle(event, t);
  }
  if (event.type === 'reasoning') return event.summary;
  if (event.type === 'tool_call') return t('agentChat.liveToolCall', { name: event.name });
  if (event.type === 'tool_result') {
    return event.ok
      ? t('agentChat.liveToolDone', { name: event.name })
      : t('agentChat.liveToolError', { name: event.name });
  }
  if (event.type === 'error') return `${t('agentChat.errorPrefix')}: ${event.message}`;
  return undefined;
};

const buildLiveAssistantContent = (steps: string[], t: TTranslate) =>
  [t('agentChat.processing'), '', ...steps.map((step) => `- ${step}`)].join('\n');

const createMessageAttachments = (files: IDocumentInputAgentFileState[]): IDocumentInputAgentMessageAttachment[] =>
  files.map((file) => ({ ...file }));

const createPlainTextFile = (content: string, fileName = 'pasted-text.txt') =>
  new File([content], fileName, {
    type: 'text/plain;charset=utf-8',
    lastModified: Date.now(),
  });

const isLongTextInput = (value: string) => value.trim().length >= LONG_TEXT_ATTACHMENT_MIN_CHARS;

const isPlainTextAttachment = (
  attachment: Pick<IDocumentInputAgentFileState, 'local_name' | 'original_name' | 'mime_type'>,
) => {
  const name = `${attachment.local_name || attachment.original_name}`.toLowerCase();
  return attachment.mime_type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md');
};

const isSpreadsheetAttachment = (
  attachment: Pick<IDocumentInputAgentFileState, 'local_name' | 'original_name' | 'mime_type'>,
) => {
  const name = `${attachment.local_name || attachment.original_name}`.toLowerCase();
  return (
    attachment.mime_type.includes('spreadsheet') ||
    attachment.mime_type.includes('excel') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  );
};

const getAttachmentKindLabel = (
  attachment: Pick<IDocumentInputAgentFileState, 'local_name' | 'original_name' | 'mime_type'>,
  locale: string,
) => {
  const name = `${attachment.local_name || attachment.original_name}`.toLowerCase();
  const isVietnamese = locale === 'vi';
  if (isSpreadsheetAttachment(attachment)) return isVietnamese ? 'Bảng tính' : 'Spreadsheet';
  if (isPlainTextAttachment(attachment)) return isVietnamese ? 'Văn bản' : 'Text';
  if (attachment.mime_type.startsWith('image/')) return isVietnamese ? 'Hình ảnh' : 'Image';
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) return isVietnamese ? 'Bản trình chiếu' : 'Presentation';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return isVietnamese ? 'Tài liệu' : 'Document';
  return isVietnamese ? 'Tệp' : 'File';
};

const getLongTextMessagePreview = (content: string) => {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= 500) return compact;
  return `${compact.slice(0, 500)}...`;
};

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
    const itemKeyCounts = new Map<string, number>();
    listItems = [];
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {currentItems.map((item) => {
          const count = itemKeyCounts.get(item) ?? 0;
          itemKeyCounts.set(item, count + 1);

          return <li key={`${item}-${count}`}>{renderInline(item)}</li>;
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
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2">
        {renderInline(trimmed)}
      </p>,
    );
  });

  flushList();
  flushCode();

  return <div className="text-base leading-8 text-neutral-900">{blocks}</div>;
};

export const DocumentInputAgentSection = () => {
  const navigate = useNavigate();
  const { t, locale, intlLocale } = useTranslation();
  const composerActions = useDocumentInputAgentActions();
  const generatedActionPromptRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const thinkingLogRef = useRef<HTMLDivElement | null>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const activeAssistantMessageIdRef = useRef<string | undefined>(undefined);
  const translationRef = useRef(t);
  const hasUserEditedHistoryRef = useRef(false);
  const deletedSessionIdsRef = useRef<Set<string>>(new Set());
  const initialHistory = useMemo(() => {
    const emptySession = createEmptySession(t);
    return { activeSession: emptySession, sessions: [emptySession] };
  }, [t]);
  const [message, setMessage] = useState('');
  const [generatedActionPrompt, setGeneratedActionPrompt] = useState('');
  const [files, setFiles] = useState<IDocumentInputAgentFileState[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [sessions, setSessions] = useState<IDocumentInputAgentChatSession[]>(() => initialHistory.sessions);
  const [activeSessionId, setActiveSessionId] = useState(() => initialHistory.activeSession.id);
  const [messages, setMessages] = useState<IDocumentInputAgentMessage[]>(() => initialHistory.activeSession.messages);
  const [progressEvents, setProgressEvents] = useState<IDocumentInputAgentProgressEvent[]>(
    () => initialHistory.activeSession.progress_events,
  );
  const [previousResponseId, setPreviousResponseId] = useState<string | undefined>(
    () => initialHistory.activeSession.previous_response_id,
  );
  const [defaultLlmModel, setDefaultLlmModel] = useState(FALLBACK_DOCUMENT_INPUT_AGENT_MODELS[0]);
  const [selectedLlmModel, setSelectedLlmModel] = useState(FALLBACK_DOCUMENT_INPUT_AGENT_MODELS[0]);
  const [llmModelOptions, setLlmModelOptions] = useState(FALLBACK_DOCUMENT_INPUT_AGENT_MODELS);
  const [fillDrafts, setFillDrafts] = useState<IDocumentInputAgentFillDraft[]>(
    () => initialHistory.activeSession.fill_drafts,
  );
  const [appliedDocuments, setAppliedDocuments] = useState<IDocumentInputAgentAppliedDocument[]>(
    () => initialHistory.activeSession.applied_documents,
  );
  const sessionsRef = useRef<IDocumentInputAgentChatSession[]>(initialHistory.sessions);
  const activeSessionIdRef = useRef(initialHistory.activeSession.id);
  const [isUploading, setIsUploading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isGeneratedPromptPreviewOpen, setIsGeneratedPromptPreviewOpen] = useState(false);
  const [confirmingDraftId, setConfirmingDraftId] = useState<string>();
  const [sessionPendingDelete, setSessionPendingDelete] = useState<IDocumentInputAgentChatSession>();
  const [compatibilityWarning, setCompatibilityWarning] = useState<{
    score_percent: number;
    matched_count: number;
    total_count: number;
    message: string;
    sheet_selection?: IDocumentInputAgentSheetSelectionRequest;
    selected_sheet_selections: IDocumentInputAgentSheetSelectionChoice[];
    pendingPayload: IDocumentInputAgentChatPayload;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const [copiedDraftJsonId, setCopiedDraftJsonId] = useState<string>();
  const [isHistorySummaryLoading, setIsHistorySummaryLoading] = useState(true);
  const [isFullHistoryLoading, setIsFullHistoryLoading] = useState(false);
  const [hasLoadedRemoteHistory, setHasLoadedRemoteHistory] = useState(false);
  const [isRemoteHistoryReadOnly, setIsRemoteHistoryReadOnly] = useState(false);
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  );
  const isActiveSessionReadOnly = Boolean(activeSession?.is_read_only);
  const isActiveSessionSummary = Boolean(activeSession?.is_summary);
  const hasCreateDocumentTemplate = Boolean(composerActions.selectedTemplate);
  const hasCreateDocumentPrompt = Boolean(generatedActionPrompt.trim() || hasCreateDocumentTemplate);

  const canRunAgent =
    (message.trim().length > 0 || files.length > 0 || hasCreateDocumentPrompt) &&
    !isRunning &&
    !isUploading &&
    !isActiveSessionReadOnly;

  useEffect(() => {
    let isCancelled = false;

    getDocumentInputAgentSettingsAPI()
      .then((settings) => {
        if (isCancelled) return;
        const options = Array.from(
          new Set([settings.model, ...(settings.model_options ?? []), ...FALLBACK_DOCUMENT_INPUT_AGENT_MODELS]),
        ).filter(Boolean);
        const defaultModel = settings.model || options[0] || FALLBACK_DOCUMENT_INPUT_AGENT_MODELS[0];

        setDefaultLlmModel(defaultModel);
        setLlmModelOptions(options);
        const currentSession = sessionsRef.current.find((session) => session.id === activeSessionIdRef.current);
        const sessionModel =
          currentSession && hasPersistableSessionContent(currentSession) ? getSessionModel(currentSession) : undefined;
        setSelectedLlmModel(sessionModel || defaultModel);
      })
      .catch((error) => {
        console.warn('Cannot load document input agent model settings.', error);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;

    const isExpanded = files.length > 0 || hasCreateDocumentTemplate;
    const minHeight = isExpanded ? COMPOSER_TEXTAREA_EXPANDED_MIN_HEIGHT : COMPOSER_TEXTAREA_COMPACT_MIN_HEIGHT;

    textarea.style.height = 'auto';
    const nextHeight = message ? Math.min(textarea.scrollHeight, COMPOSER_TEXTAREA_MAX_HEIGHT) : minHeight;
    textarea.style.height = `${Math.max(nextHeight, minHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > COMPOSER_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [files.length, hasCreateDocumentTemplate, message]);

  const orderedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.updated_at - left.updated_at),
    [sessions],
  );
  const visibleHistorySessions = useMemo(
    () =>
      orderedSessions.filter(
        (session) => session.is_summary || session.is_read_only || hasPersistableSessionContent(session),
      ),
    [orderedSessions],
  );
  const isHistoryListLoading = isHistorySummaryLoading || (isFullHistoryLoading && visibleHistorySessions.length === 0);
  const historySessionsToRender = useMemo(() => {
    if (isHistoryListLoading) return [];
    const query = historySearch.trim().toLowerCase();
    if (!query) return visibleHistorySessions;

    return visibleHistorySessions.filter((session) =>
      getSessionDisplayTitle(session.title, t).toLowerCase().includes(query),
    );
  }, [historySearch, isHistoryListLoading, t, visibleHistorySessions]);
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
      fillDrafts.length,
      appliedDocuments.length,
      errorMessage.length,
      isRunning ? 'running' : 'idle',
    ].join(':');
  }, [
    activeSessionId,
    appliedDocuments.length,
    errorMessage.length,
    fillDrafts.length,
    isRunning,
    messages,
    progressEvents,
  ]);
  const latestProgressEventId = progressEvents[progressEvents.length - 1]?.id ?? '';
  const latestRetryEvent = useMemo(
    () =>
      [...progressEvents]
        .reverse()
        .find(
          (item) =>
            item.event.type === 'status' && (item.event.phase === 'llm_retry' || item.event.phase === 'retrying'),
        )?.event,
    [progressEvents],
  );
  const isBlankActiveSession =
    isEmptyEditableSession(activeSession) &&
    messages.length === 0 &&
    progressEvents.length === 0 &&
    fillDrafts.length === 0 &&
    appliedDocuments.length === 0 &&
    !previousResponseId;
  const shouldCenterComposer = isBlankActiveSession && !isActiveSessionSummary;
  const pendingDeleteTitle = sessionPendingDelete
    ? getSessionDisplayTitle(sessionPendingDelete.title, t)
    : t('agentChat.newChat');
  const sessionUsage = useMemo(
    () => aggregateUsageSummaries(messages.flatMap((item) => (item.response?.usage ? [item.response.usage] : []))),
    [messages],
  );
  const latestAssistantMessageId = useMemo(
    () => [...messages].reverse().find((item) => item.role === 'assistant')?.id,
    [messages],
  );
  const progressDurationSeconds = useMemo(() => getProgressDurationSeconds(progressEvents), [progressEvents]);

  const setGeneratedActionPromptValue = useCallback((value: string) => {
    generatedActionPromptRef.current = value;
    setGeneratedActionPrompt(value);
    if (!value) setIsGeneratedPromptPreviewOpen(false);
  }, []);

  const syncCreateDocumentPromptToComposer = (
    nextFiles: IDocumentInputAgentFileState[] = files,
    options: {
      mode?: TDocumentInputAgentCreateDocumentMode;
      template?: IDocumentInputAgentSelectedTemplate;
    } = {},
  ) => {
    const previousGeneratedPrompt = generatedActionPromptRef.current;
    const prompt = composerActions.buildCreateDocumentMessage(
      {
        userMessage: '',
        files: nextFiles,
        locale,
      },
      {
        mode: options.mode,
        template: options.template,
      },
    );

    if (!prompt) return;

    setGeneratedActionPromptValue(prompt);
    setMessage((current) => (current === previousGeneratedPrompt ? '' : current));
  };

  const clearCreateDocumentActionFromComposer = () => {
    const previousGeneratedPrompt = generatedActionPromptRef.current;

    composerActions.clearCreateDocumentAction();
    setGeneratedActionPromptValue('');
    setMessage((current) => (current === previousGeneratedPrompt ? '' : current));
  };

  const handleSelectCreateDocumentTemplate = (template: IDocumentInputAgentSelectedTemplate) => {
    const mode = files.length > 0 ? 'upload_source' : 'agent_request';

    composerActions.selectCreateDocumentTemplate(template);
    syncCreateDocumentPromptToComposer(files, {
      mode,
      template,
    });
  };

  useEffect(
    () => () => {
      streamAbortControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    removeLegacyLocalChatHistory();
  }, []);

  useEffect(() => {
    translationRef.current = t;
  }, [t]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    let isCancelled = false;
    setIsHistorySummaryLoading(true);
    setIsFullHistoryLoading(false);
    setHasLoadedRemoteHistory(false);

    const applyRemoteHistory = (
      remoteHistory: IDocumentInputAgentChatHistoryPayload | null,
      options: { isSummary: boolean },
    ) => {
      if (isCancelled) return;
      const translate = translationRef.current;
      if (!remoteHistory) return;

      if (
        options.isSummary &&
        sessionsRef.current.some((session) => !session.is_summary && hasPersistableSessionContent(session))
      ) {
        return;
      }

      const isAllUserReadOnlyHistory = Boolean(remoteHistory.read_only && remoteHistory.scope === 'all_users');
      setIsRemoteHistoryReadOnly(isAllUserReadOnlyHistory);
      const normalizedHistory = normalizeChatHistory(
        remoteHistory as Partial<IDocumentInputAgentChatHistory & ILegacyDocumentInputAgentChatHistory>,
        translate,
      );
      if (!normalizedHistory?.sessions.length) return;

      const normalizedSessions = isAllUserReadOnlyHistory
        ? markSessionsReadOnly(normalizedHistory.sessions)
        : normalizedHistory.sessions;
      const currentActiveSession = sessionsRef.current.find((session) => session.id === activeSessionIdRef.current);
      const shouldKeepEmptySessionActive = options.isSummary && isEmptyEditableSession(currentActiveSession);
      const editableSession =
        shouldKeepEmptySessionActive && currentActiveSession ? currentActiveSession : createEmptySession(translate);
      const remoteSessions = isAllUserReadOnlyHistory ? [editableSession, ...normalizedSessions] : normalizedSessions;
      const remoteSessionIds = new Set(remoteSessions.map((session) => session.id));
      const localSessionsToKeep = options.isSummary
        ? !isAllUserReadOnlyHistory && shouldKeepEmptySessionActive && currentActiveSession
          ? [currentActiveSession]
          : []
        : sessionsRef.current.filter(
            (session) => !remoteSessionIds.has(session.id) && hasPersistableSessionContent(session),
          );
      const nextSessions = [...localSessionsToKeep, ...remoteSessions];
      const currentActiveSessionId = activeSessionIdRef.current;
      const preferredActiveSession =
        (shouldKeepEmptySessionActive && nextSessions.find((session) => session.id === currentActiveSessionId)) ||
        (!options.isSummary && nextSessions.find((session) => session.id === currentActiveSessionId)) ||
        nextSessions.find((session) => session.id === normalizedHistory.active_session_id) ||
        nextSessions[0];

      sessionsRef.current = nextSessions;
      activeSessionIdRef.current = preferredActiveSession.id;
      setSessions(nextSessions);
      setActiveSessionId(preferredActiveSession.id);
      setMessages(preferredActiveSession.messages);
      setProgressEvents(preferredActiveSession.progress_events);
      setPreviousResponseId(preferredActiveSession.previous_response_id);
      const preferredModel = getSessionModel(preferredActiveSession);
      if (preferredModel) setSelectedLlmModel(preferredModel);
      setFillDrafts(preferredActiveSession.fill_drafts);
      setAppliedDocuments(preferredActiveSession.applied_documents);
      setFiles([]);
      setGeneratedActionPromptValue('');
      setErrorMessage('');
    };

    getDocumentInputAgentChatHistorySummaryAPI()
      .then((remoteHistory) => {
        applyRemoteHistory(remoteHistory, { isSummary: true });
      })
      .catch((error) => {
        console.warn('Cannot load document input agent chat history summary from DB.', error);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHistorySummaryLoading(false);
          setHasLoadedRemoteHistory(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [setGeneratedActionPromptValue]);

  useEffect(() => {
    if (isActiveSessionReadOnly) return;

    const hasActiveSessionBody =
      messages.length > 0 ||
      progressEvents.length > 0 ||
      fillDrafts.length > 0 ||
      appliedDocuments.length > 0 ||
      isRunning;

    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSessionId) return session;

        const hasSessionChanged =
          session.messages !== messages ||
          session.progress_events !== progressEvents ||
          session.previous_response_id !== previousResponseId ||
          session.llm_model !== selectedLlmModel ||
          session.fill_drafts !== fillDrafts ||
          session.applied_documents !== appliedDocuments ||
          session.is_running !== isRunning;
        const nextTitle =
          messages.length > 0
            ? buildSessionTitle(messages, t)
            : hasSessionChanged && !session.is_summary
              ? t('agentChat.newChat')
              : session.title;
        const nextInterruptedAt = isRunning ? undefined : session.interrupted_at;
        const nextIsSummary = hasActiveSessionBody ? false : session.is_summary;

        if (
          !hasSessionChanged &&
          session.title === nextTitle &&
          session.interrupted_at === nextInterruptedAt &&
          session.is_summary === nextIsSummary
        ) {
          return session;
        }

        return {
          ...session,
          title: nextTitle,
          updated_at: hasSessionChanged ? Date.now() : session.updated_at,
          messages,
          progress_events: progressEvents,
          previous_response_id: previousResponseId,
          llm_model: selectedLlmModel,
          fill_drafts: fillDrafts,
          applied_documents: appliedDocuments,
          is_running: isRunning,
          interrupted_at: nextInterruptedAt,
          is_summary: nextIsSummary,
        };
      }),
    );
  }, [
    activeSessionId,
    appliedDocuments,
    fillDrafts,
    isActiveSessionReadOnly,
    isRunning,
    messages,
    previousResponseId,
    progressEvents,
    selectedLlmModel,
    t,
  ]);

  useEffect(() => {
    if (!hasLoadedRemoteHistory) return;
    if (!hasUserEditedHistoryRef.current) return;

    const persistableSessions = sessions.filter(
      (session) => !session.is_read_only && hasPersistableSessionContent(session),
    );
    const timerId = window.setTimeout(() => {
      const persistHistoryChanges = async () => {
        const deletedSessionIds = [...deletedSessionIdsRef.current];
        try {
          for (const sessionId of deletedSessionIds) {
            await deleteDocumentInputAgentChatHistorySessionAPI(sessionId);
            deletedSessionIdsRef.current.delete(sessionId);
          }
        } catch (error) {
          console.warn('Cannot delete document input agent chat history session from DB.', error);
          return;
        }

        if (persistableSessions.length === 0) {
          hasUserEditedHistoryRef.current = false;
          return;
        }

        const activePersistableSession = persistableSessions.find((session) => session.id === activeSessionId);
        if (!activePersistableSession) {
          if (!isRunning) hasUserEditedHistoryRef.current = false;
          return;
        }

        try {
          await saveDocumentInputAgentChatHistorySessionAPI(
            activePersistableSession.id,
            sanitizeSessionForRemoteHistory(activePersistableSession),
            activeSessionId,
          );
          if (!isRunning) hasUserEditedHistoryRef.current = false;
        } catch (error) {
          console.warn('Cannot save document input agent chat history to DB.', error);
        }
      };

      void persistHistoryChanges();
    }, REMOTE_HISTORY_SAVE_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [activeSessionId, hasLoadedRemoteHistory, isRunning, sessions]);

  useEffect(() => {
    if (!latestActivityKey) return;

    const frameId = window.requestAnimationFrame(() => {
      const scrollContainer = mainScrollRef.current;
      if (!scrollContainer) return;
      scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [latestActivityKey]);

  useEffect(() => {
    if (!latestProgressEventId) return;

    const frameId = window.requestAnimationFrame(() => {
      const thinkingLog = thinkingLogRef.current;
      if (!thinkingLog) return;
      thinkingLog.scrollTo({ top: thinkingLog.scrollHeight, behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [latestProgressEventId]);

  const openDocument = (documentId: string) => {
    void navigate({ to: '/documents/$id', params: { id: documentId } });
  };

  const revokeFilePreviews = (items: Array<{ preview_url?: string }>) => {
    items.forEach((item) => {
      if (item.preview_url) URL.revokeObjectURL(item.preview_url);
    });
  };

  const revokeMessageAttachmentPreviews = (chatMessages: IDocumentInputAgentMessage[]) => {
    chatMessages.forEach((item) => {
      revokeFilePreviews(item.attachments ?? []);
    });
  };

  const applySessionToView = (session: IDocumentInputAgentChatSession) => {
    revokeFilePreviews(files);
    composerActions.resetAction();
    setGeneratedActionPromptValue('');
    setFiles([]);
    setMessage('');
    setProgressEvents(session.progress_events);
    setErrorMessage(session.interrupted_at ? t('agentChat.reloadInterrupted') : '');
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setPreviousResponseId(session.previous_response_id);
    setSelectedLlmModel(getSessionModel(session) ?? defaultLlmModel);
    setFillDrafts(session.fill_drafts);
    setAppliedDocuments(session.applied_documents);
  };

  const loadSession = async (session: IDocumentInputAgentChatSession) => {
    if (isRunning || isUploading) return;

    if (!session.is_summary) {
      applySessionToView(session);
      return;
    }

    setIsFullHistoryLoading(true);
    applySessionToView(session);
    try {
      const remoteHistory = await getDocumentInputAgentChatHistorySessionAPI(session.id);
      const normalizedHistory = normalizeChatHistory(
        remoteHistory as Partial<IDocumentInputAgentChatHistory & ILegacyDocumentInputAgentChatHistory>,
        translationRef.current,
      );
      const fullSession = normalizedHistory?.sessions[0];
      if (!fullSession) return;

      setSessions((current) => current.map((item) => (item.id === session.id ? fullSession : item)));
      applySessionToView(fullSession);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsFullHistoryLoading(false);
    }
  };

  const startNewChat = () => {
    if (isRunning || isUploading) return;

    revokeFilePreviews(files);
    composerActions.resetAction();
    setGeneratedActionPromptValue('');
    if (isEmptyEditableSession(activeSession)) {
      setFiles([]);
      setMessage('');
      setErrorMessage('');
      setSelectedLlmModel(defaultLlmModel);
      return;
    }

    const nextSession = createEmptySession(t);
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setFiles([]);
    setMessage('');
    setMessages([]);
    setProgressEvents([]);
    setPreviousResponseId(undefined);
    setSelectedLlmModel(defaultLlmModel);
    setFillDrafts([]);
    setAppliedDocuments([]);
    setErrorMessage('');
  };

  const deleteSession = (sessionId: string) => {
    if (isRunning || isUploading) return;
    if (sessions.find((session) => session.id === sessionId)?.is_read_only) return;

    const sessionToDelete = sessions.find((session) => session.id === sessionId);
    if (sessionToDelete) revokeMessageAttachmentPreviews(sessionToDelete.messages);

    const remainingSessions = sessions.filter((session) => session.id !== sessionId);
    hasUserEditedHistoryRef.current = true;
    if (sessionToDelete && (sessionToDelete.is_summary || hasPersistableSessionContent(sessionToDelete))) {
      deletedSessionIdsRef.current.add(sessionId);
    }
    const nextSession = remainingSessions[0] ?? createEmptySession(t);
    setSessions(remainingSessions.length > 0 ? remainingSessions : [nextSession]);
    if (sessionId === activeSessionId) void loadSession(nextSession);
  };

  const requestDeleteSession = (session: IDocumentInputAgentChatSession) => {
    if (isRunning || isUploading || session.is_read_only) return;
    setSessionPendingDelete(session);
  };

  const confirmDeleteSession = () => {
    if (!sessionPendingDelete) return;
    deleteSession(sessionPendingDelete.id);
    setSessionPendingDelete(undefined);
  };

  const uploadFiles = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0 || isActiveSessionReadOnly) return;

    setErrorMessage('');
    setIsUploading(true);
    const availableSlots = MAX_AGENT_FILES - files.length;
    const filesToUpload = selectedFiles.slice(0, Math.max(availableSlots, 0));
    const uploadedFiles: IDocumentInputAgentFileState[] = [];

    try {
      if (availableSlots <= 0) {
        throw new Error(t('agentChat.uploadLimit', { max: MAX_AGENT_FILES }));
      }

      for (const file of filesToUpload) {
        const uploaded = await uploadDocumentInputAgentFileAPI(file);
        uploadedFiles.push({
          ...uploaded,
          local_name: file.name,
          preview_url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        });
      }

      const nextFiles = [...files, ...uploadedFiles];
      setFiles(nextFiles);
      syncCreateDocumentPromptToComposer(nextFiles, { mode: 'upload_source' });
      if (selectedFiles.length > filesToUpload.length) {
        setErrorMessage(t('agentChat.uploadLimitSkipped', { max: MAX_AGENT_FILES }));
      }
    } catch (error) {
      revokeFilePreviews(uploadedFiles);
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const uploadGeneratedTextAttachment = async (content: string): Promise<IDocumentInputAgentFileState> => {
    const file = createPlainTextFile(content, 'van-ban-da-dan.txt');
    const uploaded = await uploadDocumentInputAgentFileAPI(file);
    return {
      ...uploaded,
      local_name: file.name,
    };
  };

  const appendLongTextAttachment = async (content: string) => {
    if (isRunning || isUploading || isActiveSessionReadOnly) return;

    setErrorMessage('');
    setIsUploading(true);
    try {
      if (files.length >= MAX_AGENT_FILES) {
        throw new Error(t('agentChat.uploadLimit', { max: MAX_AGENT_FILES }));
      }

      const uploaded = await uploadGeneratedTextAttachment(content);
      const nextFiles = [...files, uploaded];
      setFiles(nextFiles);
      syncCreateDocumentPromptToComposer(nextFiles, { mode: 'upload_source' });
      setMessage((current) => (current.trim() ? current : t('documentInputAgent.longTextAttachment')));
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const prepareLongMessageAttachmentForSubmit = async (
    trimmedMessage: string,
    currentFiles: IDocumentInputAgentFileState[],
  ) => {
    if (!isLongTextInput(trimmedMessage)) {
      return {
        message: trimmedMessage,
        files: currentFiles,
      };
    }

    if (currentFiles.length >= MAX_AGENT_FILES) {
      throw new Error(t('documentInputAgent.textTooLongNoSlot', { max: MAX_AGENT_FILES }));
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadGeneratedTextAttachment(trimmedMessage);
      return {
        message: `${t('documentInputAgent.longTextAttachment')}\n\n${t('documentInputAgent.longTextPreviewPrefix')}\n${getLongTextMessagePreview(trimmedMessage)}`,
        files: [...currentFiles, uploaded],
      };
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
    const pastedFiles = Array.from(event.clipboardData.files ?? []);
    const pastedText = event.clipboardData.getData('text/plain');
    if (pastedFiles.length === 0 && !isLongTextInput(pastedText)) return;

    event.preventDefault();
    if (pastedFiles.length > 0) {
      void uploadFiles(pastedFiles);
      return;
    }

    void appendLongTextAttachment(pastedText);
  };

  const handleMessageKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    void runAgent();
  };

  const handleComposerDrop = (event: React.DragEvent<HTMLFieldSetElement>) => {
    event.preventDefault();
    if (isRunning || isUploading || isActiveSessionReadOnly) return;
    void uploadFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const submitAgentRequest = async (
    trimmedMessage: string,
    sendingFiles: IDocumentInputAgentFileState[],
    options: { clearComposer?: boolean } = {},
  ) => {
    if (isRunning || isUploading) return;
    hasUserEditedHistoryRef.current = true;
    const sendingFileIds = sendingFiles.map((file) => file.file_id);
    const previousResponseModel = getLatestResponseModel(messages);
    const abortController = new AbortController();

    setErrorMessage('');
    setIsRunning(true);
    setFillDrafts([]);
    setProgressEvents([]);
    const userMessage: IDocumentInputAgentMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmedMessage,
      attachments: createMessageAttachments(sendingFiles),
      created_at: Date.now(),
    };
    const assistantMessageId = createMessageId();
    streamAbortControllerRef.current = abortController;
    activeAssistantMessageIdRef.current = assistantMessageId;
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantMessageId, role: 'assistant', content: t('agentChat.processing'), created_at: Date.now() },
    ]);
    if (options.clearComposer) {
      setMessage('');
      setFiles([]);
    }

    try {
      const streamState: { finalResponse?: IDocumentInputAgentChatResponse; error?: string } = {};
      const liveSteps: string[] = [];

      await streamDocumentInputAgentChatAPI(
        {
          message: trimmedMessage,
          language: locale,
          file_ids: sendingFileIds,
          previous_response_id:
            previousResponseModel && previousResponseModel !== selectedLlmModel ? undefined : previousResponseId,
          llm_model: selectedLlmModel,
          allow_apply: false,
        },
        (event) => {
          setProgressEvents((current) => [...current, { id: createMessageId(), created_at: Date.now(), event }]);

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
          if (event.type === 'error') streamState.error = event.message;
          if (event.type === 'done') streamState.finalResponse = event.response;
        },
        { signal: abortController.signal },
      );

      if (abortController.signal.aborted) return;
      if (streamState.error) throw new Error(streamState.error);
      const response = streamState.finalResponse;
      if (!response) throw new Error(t('agentChat.responseEndedWithoutFinal'));

      // Always confirm compatibility coverage before proceeding with fill.
      const compatibilityResult = response.compatibility_warning;
      if (compatibilityResult) {
        setIsRunning(false);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId ? { ...item, content: compatibilityResult.message } : item,
          ),
        );
        setCompatibilityWarning({
          score_percent: compatibilityResult.score.score_percent,
          matched_count: compatibilityResult.score.matched_count,
          total_count: compatibilityResult.score.total_count,
          message: compatibilityResult.message,
          sheet_selection: compatibilityResult.sheet_selection,
          selected_sheet_selections: createDefaultSheetSelections(compatibilityResult.sheet_selection),
          pendingPayload: {
            message: trimmedMessage,
            language: locale,
            file_ids: sendingFileIds,
            previous_response_id:
              previousResponseModel && previousResponseModel !== selectedLlmModel ? undefined : previousResponseId,
            llm_model: selectedLlmModel,
            allow_apply: false,
            skip_compatibility_check: true,
          },
        });
        return;
      }

      const drafts = response.fill_drafts ?? [];
      const applied = response.applied_documents ?? [];
      setPreviousResponseId(response.response_id);
      setFillDrafts(drafts);
      setAppliedDocuments(applied);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? { ...item, content: response.output_text || t('agentChat.noDisplayContent'), response }
            : item,
        ),
      );
    } catch (error) {
      if (abortController.signal.aborted || isAbortError(error)) {
        setErrorMessage('');
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId ? { ...item, content: t('agentChat.statusTitles.stopped') } : item,
          ),
        );
        return;
      }

      const errorMessage = formatAgentRunErrorMessage(error, t);
      setErrorMessage(errorMessage);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? { ...item, content: `${t('agentChat.errorPrefix')}: ${errorMessage}` }
            : item,
        ),
      );
    } finally {
      if (streamAbortControllerRef.current === abortController) {
        streamAbortControllerRef.current = null;
      }
      if (activeAssistantMessageIdRef.current === assistantMessageId) {
        activeAssistantMessageIdRef.current = undefined;
      }
      setIsRunning(false);
    }
  };

  const stopAgent = () => {
    const abortController = streamAbortControllerRef.current;
    if (!abortController || abortController.signal.aborted) return;

    hasUserEditedHistoryRef.current = true;
    abortController.abort();
    setErrorMessage('');
    setProgressEvents((current) => [
      ...current,
      {
        id: createMessageId(),
        created_at: Date.now(),
        event: {
          type: 'status',
          phase: 'stopped',
          message: t('agentChat.statusTitles.stopped'),
        },
      },
    ]);
    const assistantMessageId = activeAssistantMessageIdRef.current;
    if (assistantMessageId) {
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId ? { ...item, content: t('agentChat.statusTitles.stopped') } : item,
        ),
      );
    }
  };

  const runAgent = async () => {
    if (!canRunAgent) return;

    try {
      const actionMessage = composerActions.buildSubmitMessage({
        userMessage: message,
        files,
        locale,
      });
      const trimmedMessage = actionMessage.trim() || t('documentInputAgent.defaultFileMessage');
      const prepared = await prepareLongMessageAttachmentForSubmit(trimmedMessage, files);
      await submitAgentRequest(prepared.message, prepared.files, { clearComposer: true });
      composerActions.resetAction();
      setGeneratedActionPromptValue('');
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    }
  };

  const cloneAttachmentsForRetry = (
    attachments: IDocumentInputAgentMessageAttachment[] = [],
  ): IDocumentInputAgentFileState[] => attachments.map((attachment) => ({ ...attachment }));

  const handleSelectCompatibilitySheet = (templateSheet: string, value: string) => {
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
  };

  const handleConfirmCompatibility = async () => {
    if (!compatibilityWarning) return;
    const payload = {
      ...compatibilityWarning.pendingPayload,
      sheet_selection:
        compatibilityWarning.selected_sheet_selections.length > 0
          ? { selections: compatibilityWarning.selected_sheet_selections }
          : compatibilityWarning.pendingPayload.sheet_selection,
    };
    setCompatibilityWarning(null);
    setIsRunning(true);
    setErrorMessage('');

    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;
    const assistantMessageId = createMessageId();
    activeAssistantMessageIdRef.current = assistantMessageId;

    setMessages((current) => [
      ...current,
      { id: assistantMessageId, role: 'assistant', content: t('agentChat.processing'), created_at: Date.now() },
    ]);

    try {
      const streamState: { finalResponse?: IDocumentInputAgentChatResponse; error?: string } = {};
      const liveSteps: string[] = [];

      await streamDocumentInputAgentChatAPI(
        payload,
        (event) => {
          setProgressEvents((current) => [...current, { id: createMessageId(), created_at: Date.now(), event }]);

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
          if (event.type === 'error') streamState.error = event.message;
          if (event.type === 'done') streamState.finalResponse = event.response;
        },
        { signal: abortController.signal },
      );

      if (abortController.signal.aborted) return;
      if (streamState.error) throw new Error(streamState.error);
      const response = streamState.finalResponse;
      if (!response) throw new Error(t('agentChat.responseEndedWithoutFinal'));

      const drafts = response.fill_drafts ?? [];
      const applied = response.applied_documents ?? [];
      setPreviousResponseId(response.response_id);
      setFillDrafts(drafts);
      setAppliedDocuments(applied);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? { ...item, content: response.output_text || t('agentChat.noDisplayContent'), response }
            : item,
        ),
      );
    } catch (error) {
      if (abortController.signal.aborted || isAbortError(error)) {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId ? { ...item, content: t('agentChat.statusTitles.stopped') } : item,
          ),
        );
        return;
      }
      const errorMsg = formatAgentRunErrorMessage(error, t);
      setErrorMessage(errorMsg);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId ? { ...item, content: `${t('agentChat.errorPrefix')}: ${errorMsg}` } : item,
        ),
      );
    } finally {
      setIsRunning(false);
    }
  };

  const cloneAttachmentsForComposer = (
    attachments: IDocumentInputAgentMessageAttachment[] = [],
  ): IDocumentInputAgentFileState[] =>
    attachments.map(({ preview_url: _previewUrl, ...attachment }) => ({ ...attachment }));

  const copyMessageContent = async (item: IDocumentInputAgentMessage) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopiedMessageId(item.id);
      window.setTimeout(() => setCopiedMessageId((current) => (current === item.id ? undefined : current)), 1_500);
    } catch (error) {
      setErrorMessage(t('agentChat.copyFailed', { error: formatErrorMessage(error) }));
    }
  };

  const copyDraftJson = async (draft: IDocumentInputAgentFillDraft) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft.definition, null, 2));
      setCopiedDraftJsonId(draft.id);
      window.setTimeout(() => setCopiedDraftJsonId((current) => (current === draft.id ? undefined : current)), 1_500);
    } catch (error) {
      setErrorMessage(t('agentChat.copyJsonFailed', { error: formatErrorMessage(error) }));
    }
  };

  const editUserMessage = (item: IDocumentInputAgentMessage) => {
    if (item.role !== 'user' || isRunning || isUploading || isActiveSessionReadOnly) return;

    revokeFilePreviews(files);
    composerActions.resetAction();
    setGeneratedActionPromptValue('');
    setMessage(item.content);
    setFiles(cloneAttachmentsForComposer(item.attachments));
    setErrorMessage('');
  };

  const retryUserMessage = async (item: IDocumentInputAgentMessage) => {
    if (item.role !== 'user' || isRunning || isUploading || isActiveSessionReadOnly) return;
    await submitAgentRequest(
      item.content.trim() || t('documentInputAgent.defaultFileMessage'),
      cloneAttachmentsForRetry(item.attachments),
    );
  };

  const confirmDraft = async (draft: IDocumentInputAgentFillDraft, assistantMessageId?: string) => {
    if (confirmingDraftId || isActiveSessionReadOnly) return;

    hasUserEditedHistoryRef.current = true;
    setErrorMessage('');
    setConfirmingDraftId(draft.id);
    try {
      const appliedDocument = await runDocumentInputAgentToolAPI<IDocumentInputAgentAppliedDocument>(
        'apply_document_fill',
        {
          arguments: { definition: draft.definition },
          allow_apply: true,
        },
      );

      setAppliedDocuments((current) => [
        appliedDocument,
        ...current.filter((item) => item.document_id !== appliedDocument.document_id),
      ]);
      setFillDrafts((current) => current.filter((item) => item.id !== draft.id));
      if (assistantMessageId) {
        setMessages((current) =>
          current.map((item) => {
            if (item.id !== assistantMessageId || !item.response) return item;

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
          }),
        );
      }
      openDocument(appliedDocument.document_id);
    } catch (error) {
      setErrorMessage(formatErrorMessage(error));
    } finally {
      setConfirmingDraftId(undefined);
    }
  };

  const removeComposerFile = (fileId: string) => {
    const nextFiles = files.filter((item) => {
      if (item.file_id === fileId && item.preview_url) URL.revokeObjectURL(item.preview_url);
      return item.file_id !== fileId;
    });

    setFiles(nextFiles);
    syncCreateDocumentPromptToComposer(nextFiles, {
      mode: nextFiles.length > 0 ? 'upload_source' : 'agent_request',
    });
  };

  const renderAttachmentPreview = (attachment: IDocumentInputAgentMessageAttachment, removable = false) => {
    const displayName = attachment.local_name || attachment.original_name;
    if (isPlainTextAttachment(attachment)) {
      return (
        <div
          key={attachment.file_id}
          className="group relative flex h-16 w-full max-w-[280px] shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-neutral-700 shadow-sm">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-neutral-800">
              {displayName.toLowerCase().includes('van-ban-da-dan') ? t('agentChat.pastedText') : displayName}
            </div>
            <div className="mt-0.5 truncate text-xs text-neutral-500">{displayName}</div>
          </div>
          {removable ? (
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow hover:bg-red-600 hover:text-white"
              onClick={() => removeComposerFile(attachment.file_id)}
              title={t('agentChat.removeFile')}>
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <div
        key={attachment.file_id}
        className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
        {attachment.preview_url ? (
          <img src={attachment.preview_url} alt={displayName} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-neutral-600">
            <FileText className="size-5" />
            <span className="line-clamp-2 break-all">{displayName}</span>
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
  };

  const renderComposerAttachmentPreview = (attachment: IDocumentInputAgentMessageAttachment) => {
    const displayName = attachment.local_name || attachment.original_name;
    const isSpreadsheet = isSpreadsheetAttachment(attachment);
    const kindLabel = getAttachmentKindLabel(attachment, locale);

    return (
      <div
        key={attachment.file_id}
        className="relative flex h-14 w-full max-w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-2 py-2 pr-8 shadow-sm sm:w-80">
        {attachment.preview_url ? (
          <img
            src={attachment.preview_url}
            alt={displayName}
            className="size-10 shrink-0 rounded-lg border border-neutral-200 object-cover"
          />
        ) : (
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
              isSpreadsheet ? 'bg-emerald-500 text-white' : 'bg-neutral-100 text-neutral-700'
            }`}>
            {isSpreadsheet ? <FileSpreadsheet className="size-5" /> : <FileText className="size-5" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-5 text-[#0d0d0d]">{displayName}</div>
          <div className="truncate text-sm leading-5 text-neutral-500">{kindLabel}</div>
        </div>
        <button
          type="button"
          className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-neutral-950 text-white shadow-sm hover:bg-neutral-700"
          onClick={() => removeComposerFile(attachment.file_id)}
          title={t('agentChat.removeFile')}>
          <X className="size-3" />
        </button>
      </div>
    );
  };

  const renderProgressEventLog = () => (
    <div ref={thinkingLogRef} className="max-h-[300px] space-y-2 overflow-auto pr-1">
      {progressEvents.map(({ id, created_at, event }) => (
        <div
          key={id}
          className={`rounded-lg border bg-white px-3 py-2 text-xs ${
            isProgressErrorEvent(event)
              ? 'border-red-200 bg-red-50'
              : isProgressRetryEvent(event)
                ? 'border-amber-200 bg-amber-50'
                : isProgressStoppedEvent(event)
                  ? 'border-neutral-300 bg-neutral-100'
                  : 'border-neutral-200'
          }`}>
          <div className="flex items-center justify-between gap-2">
            <div
              className={`font-semibold ${
                isProgressErrorEvent(event)
                  ? 'text-red-700'
                  : isProgressRetryEvent(event)
                    ? 'text-amber-800'
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
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-2 text-[11px] leading-5 text-neutral-800">
              {getStreamEventDetail(event, t)}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  );

  const renderAssistantThought = (item: IDocumentInputAgentMessage) => {
    if (item.id !== latestAssistantMessageId || progressEvents.length === 0) return null;

    const isCurrentAssistantRunning = isRunning && item.id === latestAssistantMessageId;
    const thoughtLabel = isCurrentAssistantRunning
      ? t('agentChat.thinking')
      : t('agentChat.thoughtForSeconds', { seconds: progressDurationSeconds });

    return (
      <details className="group mb-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md py-0.5 text-sm font-normal text-neutral-500 transition hover:text-neutral-800">
          {isCurrentAssistantRunning ? <Loader2 className="size-3.5 animate-spin" /> : null}
          <span>{thoughtLabel}</span>
          <ChevronDown className="size-4 -rotate-90 text-neutral-400 transition group-open:rotate-0" />
        </summary>
        <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 shadow-sm">
          {renderProgressEventLog()}
        </div>
      </details>
    );
  };

  const renderDraftJson = (draft: IDocumentInputAgentFillDraft) => (
    <details
      key={`${draft.id}-json`}
      open
      className="group mt-3 rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-neutral-700">
        <span className="min-w-0 truncate">{t('documentInputAgent.previewPayload', { title: draft.title })}</span>
        <ChevronDown className="size-4 shrink-0 text-neutral-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-neutral-200 bg-neutral-50 p-3">
        <div className="mb-2 flex flex-wrap gap-2 text-xs text-neutral-500">
          <span className="rounded-full bg-white px-2 py-1">
            {t('documentInputAgent.template', { value: draft.template_name })}
          </span>
          <span className="rounded-full bg-white px-2 py-1">
            {t('documentInputAgent.resolved', { count: draft.resolved_fields.length })}
          </span>
          <span className="rounded-full bg-white px-2 py-1">
            {t('documentInputAgent.unresolved', { count: draft.unresolved_fields.length })}
          </span>
        </div>
        {draft.warnings.length > 0 ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {draft.warnings.slice(0, 5).map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}
        <div className="relative">
          <button
            type="button"
            className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white/90 text-neutral-700 shadow-sm backdrop-blur transition hover:bg-neutral-100 hover:text-neutral-950"
            onClick={() => void copyDraftJson(draft)}
            title={copiedDraftJsonId === draft.id ? t('agentChat.copied') : t('documentInputAgent.copyPreviewJson')}
            aria-label={
              copiedDraftJsonId === draft.id ? t('agentChat.copied') : t('documentInputAgent.copyPreviewJson')
            }>
            {copiedDraftJsonId === draft.id ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
          </button>
          <pre className="max-h-[420px] overflow-auto rounded-xl border border-neutral-200 bg-white p-3 pr-12 text-xs leading-5 text-neutral-800">
            <code>{JSON.stringify(draft.definition, null, 2)}</code>
          </pre>
        </div>
      </div>
    </details>
  );

  const renderUsageSummary = (
    usage?: TDocumentInputAgentUsageSummary,
    options: {
      title?: string;
    } = {},
  ) => {
    if (!usage) return null;

    const summaryItems = [
      { label: t('agentChat.inputTokens'), value: formatTokenCount(usage.input_tokens) },
      { label: t('agentChat.outputTokens'), value: formatTokenCount(usage.output_tokens) },
      { label: t('agentChat.totalTokens'), value: formatTokenCount(usage.total_tokens) },
      { label: t('agentChat.cost'), value: formatUsageCost(usage.cost, t) },
    ];

    return (
      <details className="group mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <span>{options.title ?? t('agentChat.tokenUsage')}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-neutral-500">
              {t('agentChat.responseCount', { count: usage.response_count })}
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-neutral-400 transition group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <div className="text-[11px] font-medium uppercase tracking-normal text-neutral-500">{item.label}</div>
              <div className="mt-1 break-words text-sm font-semibold text-neutral-950">{item.value}</div>
            </div>
          ))}
        </div>
        {usage.cost.is_configured ? (
          <div className="mt-2 text-[11px] text-neutral-500">
            {t('agentChat.pricing', {
              input: formatUsd(usage.cost.input_usd_per_1m_tokens),
              output: formatUsd(usage.cost.output_usd_per_1m_tokens),
            })}
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-amber-700">{t('agentChat.unconfiguredCost')}</div>
        )}
        {usage.items.length > 0 ? (
          <div className="mt-3 overflow-auto rounded-lg border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">{t('agentChat.phase')}</th>
                  <th className="px-2 py-1.5 font-semibold">{t('agentChat.inputTokens')}</th>
                  <th className="px-2 py-1.5 font-semibold">{t('agentChat.outputTokens')}</th>
                  <th className="px-2 py-1.5 font-semibold">{t('agentChat.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {usage.items.map((item) => (
                  <tr
                    key={`${item.response_id}-${item.phase}-${item.round ?? 'x'}`}
                    className="border-t border-neutral-100">
                    <td className="px-2 py-1.5 text-neutral-700">{item.phase}</td>
                    <td className="px-2 py-1.5">{formatTokenCount(item.input_tokens)}</td>
                    <td className="px-2 py-1.5">{formatTokenCount(item.output_tokens)}</td>
                    <td className="px-2 py-1.5">{formatUsageCost(item.cost, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </details>
    );
  };

  const findDraftAssistantMessageId = (draftId: string) =>
    [...messages].reverse().find((item) => item.response?.fill_drafts?.some((draft) => draft.id === draftId))?.id;

  const renderLatestDraftActions = () => {
    if (fillDrafts.length === 0) return null;

    return (
      <div className="rounded-2xl border border-emerald-300 bg-white p-4 shadow-[0_10px_32px_rgba(16,185,129,0.16)] ring-1 ring-emerald-100">
        <div className="min-w-0">
          <div className="text-base font-semibold leading-6 text-neutral-950">
            {t('documentInputAgent.pendingConfirm')}
          </div>
          <div className="mt-0.5 text-sm leading-5 text-neutral-500">{t('documentInputAgent.pendingConfirmHint')}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {fillDrafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              className="inline-flex max-w-full items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-emerald-300 disabled:shadow-none"
              disabled={Boolean(confirmingDraftId) || isActiveSessionReadOnly}
              onClick={() => confirmDraft(draft, findDraftAssistantMessageId(draft.id))}>
              {confirmingDraftId === draft.id ? <Loader2 className="size-4 shrink-0 animate-spin" /> : null}
              <span className="shrink-0">{t('documentInputAgent.confirmCreateDocument')}</span>
              <span className="min-w-0 max-w-[320px] truncate font-medium text-emerald-50">{draft.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderMessageActions = (item: IDocumentInputAgentMessage) => (
    <div className={`mt-2 flex flex-wrap gap-1 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <button
        type="button"
        className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
        onClick={() => void copyMessageContent(item)}
        title={t('agentChat.copyMessage')}>
        {copiedMessageId === item.id ? t('agentChat.copied') : t('agentChat.copy')}
      </button>
      {item.role === 'user' ? (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => editUserMessage(item)}
            disabled={isRunning || isUploading || isActiveSessionReadOnly}
            title={t('agentChat.editMessage')}>
            <Pencil className="size-3.5" />
            {t('agentChat.edit')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void retryUserMessage(item)}
            disabled={isRunning || isUploading || isActiveSessionReadOnly}
            title={t('agentChat.retryMessage')}>
            <RotateCcw className="size-3.5" />
            {t('agentChat.retry')}
          </button>
        </>
      ) : null}
    </div>
  );

  const renderComposerContext = () => (
    <>
      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      {isRunning && latestRetryEvent?.type === 'status' ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          <span>{getStatusEventTitle(latestRetryEvent, t)}</span>
        </div>
      ) : null}
    </>
  );

  const renderComposerSubmitButton = () =>
    isRunning ? (
      <button
        type="button"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
        onClick={stopAgent}
        title={t('agentChat.stop')}>
        <Square className="size-4 fill-current" />
      </button>
    ) : (
      <button
        type="button"
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          canRunAgent
            ? 'bg-black text-white hover:bg-neutral-800'
            : 'cursor-not-allowed bg-neutral-200 text-neutral-400'
        }`}
        disabled={!canRunAgent}
        onClick={() => void runAgent()}
        title={t('agentChat.send')}>
        {isUploading ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
      </button>
    );

  const renderModelSelect = () => (
    <Select
      value={selectedLlmModel}
      onValueChange={setSelectedLlmModel}
      disabled={isRunning || isUploading || isActiveSessionReadOnly}>
      <SelectTrigger
        aria-label={t('documentInputAgent.modelLabel')}
        title={`${t('documentInputAgent.modelLabel')}: ${selectedLlmModel}`}
        className="h-9 w-auto max-w-[142px] gap-1 rounded-full border-0 bg-transparent px-2 text-sm text-neutral-500 shadow-none hover:bg-neutral-100 focus:ring-0 sm:max-w-[190px]">
        <SelectValue>{formatLlmModelLabel(selectedLlmModel)}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {llmModelOptions.map((model) => (
          <SelectItem key={model} value={model} title={model}>
            {formatLlmModelLabel(model)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const renderGeneratedPromptPill = () => {
    if (!composerActions.selectedTemplate) return null;

    const promptPreview =
      composerActions.buildCreateDocumentMessage({
        userMessage: message,
        files,
        locale,
      }) || generatedActionPrompt;
    if (!promptPreview.trim()) return null;

    return (
      <div className="w-full space-y-2">
        <button
          type="button"
          className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          aria-expanded={isGeneratedPromptPreviewOpen}
          onClick={() => setIsGeneratedPromptPreviewOpen((current) => !current)}>
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{t('documentInputAgent.actions.hiddenPromptReady')}</span>
          <span className="hidden shrink-0 text-xs font-normal text-emerald-600 sm:inline">
            {t('documentInputAgent.actions.hiddenPromptHint')}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-emerald-600 transition ${
              isGeneratedPromptPreviewOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isGeneratedPromptPreviewOpen ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-3 text-left shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-950">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>{t('documentInputAgent.actions.hiddenPromptPreviewTitle')}</span>
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-700">
              {promptPreview}
            </pre>
          </div>
        ) : null}
      </div>
    );
  };

  const renderComposerActionPills = () => {
    const selectedTemplate = composerActions.selectedTemplate;
    if (!selectedTemplate) return null;

    return (
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[15px] font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRunning || isUploading || isActiveSessionReadOnly}
          onClick={composerActions.openCreateDocumentAction}
          title={t('documentInputAgent.actions.createDocument')}>
          <FilePlus2 className="size-4" />
          <span className="hidden sm:inline">{t('documentInputAgent.actions.createDocument')}</span>
        </button>
        <button
          type="button"
          className="hidden h-9 min-w-0 max-w-[220px] items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 sm:inline-flex"
          disabled={isRunning || isUploading || isActiveSessionReadOnly}
          onClick={composerActions.openCreateDocumentAction}
          title={selectedTemplate.name}>
          <span className="truncate">{selectedTemplate.name}</span>
        </button>
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRunning || isUploading || isActiveSessionReadOnly}
          onClick={clearCreateDocumentActionFromComposer}
          title={t('documentInputAgent.actions.clearTemplate')}>
          <X className="size-4" />
        </button>
      </div>
    );
  };

  const renderSuggestedActions = () => {
    if (isActiveSessionReadOnly) return null;

    const isCreateDocumentActive = composerActions.activeActionId === 'create_document';
    const selectedTemplate = composerActions.selectedTemplate;
    const actionListClassName = 'flex w-full flex-wrap justify-center gap-3 px-4';
    const getActionButtonClassName = (active: boolean) =>
      `group relative inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-[#d9d9d9] px-3.5 py-2 text-start text-[15px] font-normal leading-5 shadow-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-[#f4f4f4] text-[#0d0d0d] hover:bg-[#ececec]'
          : 'bg-white text-[#5d5d5d] hover:bg-[#f4f4f4] hover:text-[#0d0d0d]'
      }`;

    if (isCreateDocumentActive && selectedTemplate) {
      const isUploadMode = composerActions.createDocumentMode === 'upload_source';

      return (
        <div className={actionListClassName}>
          <button
            type="button"
            className={getActionButtonClassName(isUploadMode)}
            disabled={isRunning || isUploading}
            onClick={() => {
              composerActions.selectCreateDocumentUploadSource();
              syncCreateDocumentPromptToComposer(files, { mode: 'upload_source' });
              fileInputRef.current?.click();
            }}
            title={t('documentInputAgent.actions.uploadSourceHint')}>
            <Upload className="size-5 shrink-0 stroke-[1.8]" />
            <span className="min-w-0 truncate">{t('documentInputAgent.actions.uploadSource')}</span>
          </button>
        </div>
      );
    }

    return (
      <div className={actionListClassName}>
        <button
          type="button"
          className={getActionButtonClassName(isCreateDocumentActive)}
          disabled={isRunning || isUploading}
          onClick={composerActions.openCreateDocumentAction}
          title={t('documentInputAgent.actions.createDocumentHint')}>
          <FilePlus2 className="size-5 shrink-0 stroke-[1.8]" />
          <span className="min-w-0 truncate">{t('documentInputAgent.actions.createDocument')}</span>
        </button>
      </div>
    );
  };

  const renderComposer = () => {
    const isExpandedComposer = files.length > 0 || hasCreateDocumentTemplate;
    const composerPlaceholder = t('documentInputAgent.composerPlaceholder');
    const generatedPromptPill = renderGeneratedPromptPill();
    const textareaClassName =
      'max-h-[220px] flex-1 resize-none overflow-y-hidden border-0 bg-transparent px-0 py-0 text-[16px] leading-6 text-[#0d0d0d] outline-none ring-0 placeholder:text-[#8f8f8f] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0';

    return (
      <fieldset
        className={`rounded-[30px] border border-[#d9d9d9] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.12)] ${
          isExpandedComposer ? 'p-[10px]' : 'px-[10px] py-1'
        }`}
        aria-label={t('documentInputAgent.composerLabel')}
        onDrop={handleComposerDrop}
        onDragOver={(event) => event.preventDefault()}>
        {files.length > 0 ? (
          <div className="mb-6 flex max-h-[124px] flex-wrap gap-2 overflow-y-auto px-1 pr-2">
            {files.map((file) => renderComposerAttachmentPreview(file))}
          </div>
        ) : null}

        {generatedPromptPill ? <div className="mb-3 px-1">{generatedPromptPill}</div> : null}

        {isExpandedComposer ? (
          <textarea
            ref={composerTextareaRef}
            id="document-input-agent-message"
            rows={1}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onPaste={handlePasteMessage}
            onKeyDown={handleMessageKeyDown}
            placeholder={composerPlaceholder}
            disabled={isActiveSessionReadOnly}
            className={`${textareaClassName} block min-h-14 w-full px-1`}
          />
        ) : (
          <div className="flex min-h-12 items-center gap-2">
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#0d0d0d] hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isUploading || isRunning || isActiveSessionReadOnly}
              onClick={() => fileInputRef.current?.click()}
              title={t('agentChat.uploadFile')}>
              {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-6" />}
            </button>

            {renderComposerActionPills()}

            <textarea
              ref={composerTextareaRef}
              id="document-input-agent-message"
              rows={1}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onPaste={handlePasteMessage}
              onKeyDown={handleMessageKeyDown}
              placeholder={composerPlaceholder}
              disabled={isActiveSessionReadOnly}
              className={`${textareaClassName} min-h-6`}
            />

            <div className="flex shrink-0 items-center gap-1">
              {renderModelSelect()}
              {renderComposerSubmitButton()}
            </div>
          </div>
        )}

        {isExpandedComposer ? (
          <div className="mt-3 flex h-9 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#0d0d0d] hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading || isRunning || isActiveSessionReadOnly}
                onClick={() => fileInputRef.current?.click()}
                title={t('agentChat.uploadFile')}>
                {isUploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-6" />}
              </button>
              {renderComposerActionPills()}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {renderModelSelect()}
              {renderComposerSubmitButton()}
            </div>
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={DOCUMENT_INPUT_AGENT_ACCEPT}
          className="hidden"
          onChange={handleUploadFile}
        />
      </fieldset>
    );
  };

  return (
    <>
      <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-white text-[#0d0d0d]">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-[#ececec] bg-[#f9f9f9] md:flex">
          <div className="flex h-[72px] shrink-0 items-center px-4">
            <div className="truncate text-xl font-semibold tracking-tight text-[#0d0d0d]">Document Agent</div>
          </div>

          <div className="space-y-1 px-2">
            <button
              type="button"
              className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition ${
                shouldCenterComposer ? 'bg-[#ececec] text-[#0d0d0d]' : 'text-[#0d0d0d] hover:bg-[#ececec]'
              }`}
              onClick={startNewChat}
              disabled={isRunning || isUploading}
              title={t('agentChat.newChat')}>
              <Pencil className="size-5 shrink-0" />
              <span>{t('agentChat.newChat')}</span>
            </button>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-[#0d0d0d]" />
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder={t('agentChat.searchChats')}
                className="h-11 w-full rounded-xl bg-transparent pl-11 pr-3 text-[15px] text-[#0d0d0d] outline-none placeholder:text-neutral-500 hover:bg-[#ececec] focus:bg-white focus:ring-2 focus:ring-neutral-200"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-5">
            <div className="mb-2 px-3 text-sm font-semibold text-neutral-500">{t('agentChat.chatHistory')}</div>
            {isHistorySummaryLoading ? (
              <div className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" />
                <span>{t('agentChat.loadingHistory')}</span>
              </div>
            ) : null}
            <div className="space-y-1">
              {historySessionsToRender.map((session) => (
                <div key={session.id} className="group relative">
                  <button
                    type="button"
                    className={`flex h-9 w-full items-center gap-2 rounded-lg px-3 pr-9 text-left text-sm transition ${
                      session.id === activeSessionId
                        ? 'bg-[#ececec] text-[#0d0d0d]'
                        : 'text-[#0d0d0d] hover:bg-[#ececec]'
                    }`}
                    onClick={() => void loadSession(session)}>
                    <MessageSquare className="size-4 shrink-0 text-neutral-500" />
                    <span className="min-w-0 flex-1 truncate">{getSessionDisplayTitle(session.title, t)}</span>
                  </button>
                  <button
                    type="button"
                    className={`absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition group-hover:opacity-100 ${
                      session.id === activeSessionId
                        ? 'text-neutral-500 hover:bg-neutral-100 hover:text-red-600'
                        : 'text-neutral-400 hover:bg-red-50 hover:text-red-600'
                    }`}
                    onClick={() => requestDeleteSession(session)}
                    disabled={isRunning || isUploading || session.is_read_only}
                    title={t('agentChat.deleteChat')}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/95 px-4 backdrop-blur md:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700"
                onClick={startNewChat}
                disabled={isRunning || isUploading}
                title={t('agentChat.newChat')}>
                <Plus className="size-5" />
              </button>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">
                  {messages.length > 0 ? buildSessionTitle(messages, t) : t('documentInputAgent.title')}
                </div>
                {isActiveSessionReadOnly ? (
                  <div className="mt-0.5 text-xs font-medium text-neutral-500">
                    {t('documentInputAgent.readOnlyOtherUser')}
                  </div>
                ) : isRemoteHistoryReadOnly ? (
                  <div className="mt-0.5 text-xs font-medium text-neutral-500">
                    {t('documentInputAgent.viewingFullHistory')}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main ref={mainScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-8 md:px-8">
            <div className="mx-auto flex w-full max-w-[768px] flex-col gap-7">
              {isActiveSessionSummary && isFullHistoryLoading ? (
                <div className="flex min-h-[48vh] items-center justify-center">
                  <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm">
                    <Loader2 className="size-4 animate-spin" />
                    <span>{t('agentChat.loadingConversation')}</span>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-[calc(100dvh-13rem)] items-center justify-center">
                  <div className="w-full max-w-[768px] -translate-y-6 space-y-8">
                    <div className="px-1 text-center text-[24px] font-normal leading-8 tracking-normal text-[#0d0d0d]">
                      {t('documentInputAgent.emptyPromptTitle')}
                    </div>
                    <div className="space-y-3">
                      {renderComposerContext()}
                      {renderComposer()}
                      {renderSuggestedActions()}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((item) => (
                  <article key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {item.role === 'user' ? (
                      <div className="flex max-w-[min(720px,88%)] flex-col items-end">
                        <div className="w-full rounded-[22px] bg-[#f4f4f4] px-5 py-3 text-[#0d0d0d]">
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
                      <div className="w-full py-1">
                        <div className="min-w-0 flex-1">
                          {renderAssistantThought(item)}
                          <div>
                            <MarkdownLite content={item.content} />
                          </div>
                          {renderMessageActions(item)}

                          {item.response?.applied_documents?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {item.response.applied_documents.map((document) => (
                                <Button
                                  key={document.document_id}
                                  type="button"
                                  size="sm"
                                  onClick={() => openDocument(document.document_id)}>
                                  <ExternalLink className="mr-2 size-4" />
                                  {t('documentInputAgent.openDocument', { title: document.title })}
                                </Button>
                              ))}
                            </div>
                          ) : null}

                          {item.response?.fill_drafts?.length ? item.response.fill_drafts.map(renderDraftJson) : null}
                        </div>
                      </div>
                    )}
                  </article>
                ))
              )}

              {messages.length > 0
                ? renderUsageSummary(sessionUsage, { title: t('agentChat.sessionTokenUsage') })
                : null}

              {renderLatestDraftActions()}

              <div aria-hidden="true" />
            </div>
          </main>

          {shouldCenterComposer ? null : (
            <footer className="sticky bottom-0 z-20 shrink-0 bg-white/95 px-4 pb-5 pt-3 backdrop-blur md:px-8">
              <div className="mx-auto w-full max-w-[768px] space-y-3">
                {renderComposerContext()}
                {renderComposer()}
                {renderSuggestedActions()}
              </div>
            </footer>
          )}
        </div>
      </div>

      <DocumentInputAgentTemplateSelector
        open={composerActions.isTemplateSelectorOpen}
        selectedTemplateId={composerActions.selectedTemplate?.id}
        onOpenChange={composerActions.setTemplateSelectorOpen}
        onSelectTemplate={handleSelectCreateDocumentTemplate}
      />

      <AlertDialog
        open={Boolean(compatibilityWarning)}
        onOpenChange={(open) => {
          if (!open) setCompatibilityWarning(null);
        }}>
        <AlertDialogContent
          overlayClassName="bg-white/60 backdrop-blur-sm"
          className="w-[calc(100vw-2rem)] max-w-[448px] gap-0 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_16px_48px_rgba(15,23,42,0.16)] sm:rounded-2xl">
          <AlertDialogHeader className="space-y-4 text-left">
            <AlertDialogTitle className="text-2xl font-normal leading-tight tracking-normal text-neutral-950">
              {t('agentChat.compatibilityWarningTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-base leading-7 text-neutral-950">
              <span className="block">{compatibilityWarning?.message}</span>
              <span className="block text-base leading-7 text-neutral-500">
                {t('agentChat.compatibilityWarningScore', {
                  score: compatibilityWarning?.score_percent ?? 0,
                  matched: compatibilityWarning?.matched_count ?? 0,
                  total: compatibilityWarning?.total_count ?? 0,
                })}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {compatibilityWarning?.sheet_selection?.selections.length ? (
            <div className="mt-4 space-y-3">
              <div className="text-sm font-medium leading-5 text-neutral-950">
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
                  <div key={group.template_sheet} className="space-y-1">
                    <div className="text-sm leading-5 text-neutral-500">Template sheet: {group.template_sheet}</div>
                    <Select
                      value={selected ? encodeSheetSelectionOption(selected) : undefined}
                      onValueChange={(value) => handleSelectCompatibilitySheet(group.template_sheet, value)}>
                      <SelectTrigger className="h-10 rounded-lg border-neutral-300 bg-white text-left text-sm text-neutral-950">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {group.options.map((option) => (
                          <SelectItem
                            key={`${option.file_id ?? ''}:${option.source_sheet}`}
                            value={encodeSheetSelectionOption(option)}>
                            {option.source_sheet}
                            {option.file_name ? ` - ${option.file_name}` : ''}
                            {option.recommended ? (locale === 'vi' ? ' (đề xuất)' : ' (recommended)') : ''}
                            {` - ${option.score_percent}%`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          ) : null}
          <AlertDialogFooter className="mt-6 flex-row justify-end gap-3 sm:space-x-0">
            <AlertDialogCancel className="mt-0 h-10 rounded-full border border-neutral-300 bg-white px-5 text-base font-medium text-neutral-950 shadow-none hover:bg-neutral-50">
              {t('agentChat.compatibilityCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 rounded-full bg-blue-600 px-5 text-base font-medium text-white shadow-none hover:bg-blue-700 focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-offset-0"
              onClick={handleConfirmCompatibility}>
              {t('agentChat.compatibilityProceed')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(sessionPendingDelete)}
        onOpenChange={(open) => {
          if (!open) setSessionPendingDelete(undefined);
        }}>
        <AlertDialogContent
          overlayClassName="bg-white/60 backdrop-blur-sm"
          className="w-[calc(100vw-2rem)] max-w-[448px] gap-0 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_16px_48px_rgba(15,23,42,0.16)] sm:rounded-2xl">
          <AlertDialogHeader className="space-y-4 text-left">
            <AlertDialogTitle className="text-2xl font-normal leading-tight tracking-normal text-neutral-950">
              {t('agentChat.deleteChatConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-base leading-7 text-neutral-950">
              <span className="block">
                {t('agentChat.deleteChatConfirmDescription')}{' '}
                <span className="font-semibold">{pendingDeleteTitle}</span>.
              </span>
              <span className="block text-base leading-7 text-neutral-500">
                {t('agentChat.deleteChatConfirmWarning')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex-row justify-end gap-3 sm:space-x-0">
            <AlertDialogCancel className="mt-0 h-10 rounded-full border border-neutral-300 bg-white px-5 text-base font-medium text-neutral-950 shadow-none hover:bg-neutral-50">
              {t('agentChat.cancelDelete')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 rounded-full bg-red-600 px-5 text-base font-medium text-white shadow-none hover:bg-red-600 focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-offset-0"
              onClick={confirmDeleteSession}>
              {t('agentChat.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
