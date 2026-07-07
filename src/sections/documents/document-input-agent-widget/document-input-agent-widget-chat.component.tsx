import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import type { IDocumentInputAgentFillDraft, IDocumentInputAgentUsageSummary } from 'api';
import type {
  IWidgetMessage,
  IWidgetMessageAttachment,
  IWidgetProgressEvent,
} from './document-input-agent-widget.type';

const formatTokenCount = (value?: number) => new Intl.NumberFormat('en-US').format(value ?? 0);

const formatUsd = (value?: number) => {
  const amount = value ?? 0;
  const fractionDigits = amount > 0 && amount < 0.01 ? 6 : 4;
  return `$${amount.toFixed(fractionDigits)}`;
};

const formatUsageCost = (cost: { total_usd: number; is_configured: boolean } | undefined, locale: string) =>
  cost?.is_configured ? formatUsd(cost.total_usd) : locale === 'vi' ? 'Chưa cấu hình' : 'Not configured';

const aggregateUsageSummaries = (usageSummaries: IDocumentInputAgentUsageSummary[]) => {
  if (usageSummaries.length === 0) return undefined;

  const firstCost = usageSummaries[0].cost;
  const configuredCost = usageSummaries.find((usage) => usage.cost.is_configured)?.cost ?? firstCost;
  const allCostsConfigured = usageSummaries.every((usage) => usage.cost.is_configured);

  return {
    input_tokens: usageSummaries.reduce((total, usage) => total + usage.input_tokens, 0),
    output_tokens: usageSummaries.reduce((total, usage) => total + usage.output_tokens, 0),
    total_tokens: usageSummaries.reduce((total, usage) => total + usage.total_tokens, 0),
    cached_input_tokens: usageSummaries.reduce((total, usage) => total + (usage.cached_input_tokens ?? 0), 0),
    reasoning_output_tokens: usageSummaries.reduce((total, usage) => total + (usage.reasoning_output_tokens ?? 0), 0),
    response_count: usageSummaries.reduce((total, usage) => total + usage.response_count, 0),
    cost: {
      currency: firstCost.currency,
      input_usd: usageSummaries.reduce((total, usage) => total + usage.cost.input_usd, 0),
      output_usd: usageSummaries.reduce((total, usage) => total + usage.cost.output_usd, 0),
      total_usd: usageSummaries.reduce((total, usage) => total + usage.cost.total_usd, 0),
      input_usd_per_1m_tokens: configuredCost.input_usd_per_1m_tokens,
      output_usd_per_1m_tokens: configuredCost.output_usd_per_1m_tokens,
      is_configured: allCostsConfigured,
    },
    items: usageSummaries.flatMap((usage) => usage.items),
  };
};

const stringifyCompact = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const splitInlineCode = (text: string) => text.split(/(`[^`]+`)/g);

const MarkdownLite = ({ content, variant = 'assistant' }: { content: string; variant?: 'assistant' | 'user' }) => {
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let isCodeBlock = false;
  const isUser = variant === 'user';
  const inlineCodeClassName = isUser
    ? 'rounded bg-white/15 px-1 py-0.5 text-[0.92em] text-white'
    : 'rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-900';

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
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-1.5 list-disc space-y-1 pl-4">
        {currentItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInline(item)}</li>
        ))}
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
        className={`my-2 max-h-40 overflow-auto rounded-md border p-2 text-[11px] leading-4 ${
          isUser ? 'border-white/15 bg-white/10 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'
        }`}>
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
      <p key={`p-${blocks.length}`} className="my-1">
        {renderInline(trimmed)}
      </p>,
    );
  });

  flushList();
  flushCode();

  return <div className={`text-[13px] leading-5 ${isUser ? 'text-white' : 'text-slate-800'}`}>{blocks}</div>;
};

const getProgressEventTitle = (item: IWidgetProgressEvent, locale: string) => {
  const { event } = item;
  if (event.type === 'status') return event.message;
  if (event.type === 'reasoning') return locale === 'vi' ? 'Tóm tắt suy luận' : 'Reasoning summary';
  if (event.type === 'tool_call') return locale === 'vi' ? `Gọi tool ${event.name}` : `Calling ${event.name}`;
  if (event.type === 'tool_result') return event.ok ? `${event.name} done` : `${event.name} failed`;
  if (event.type === 'response') return locale === 'vi' ? 'LLM response' : 'LLM response';
  if (event.type === 'compatibility_check') return locale === 'vi' ? 'Kiểm tra compatibility' : 'Compatibility check';
  if (event.type === 'done') return locale === 'vi' ? 'Hoàn tất' : 'Completed';
  if (event.type === 'error') return locale === 'vi' ? 'Lỗi' : 'Error';
  return locale === 'vi' ? 'Sự kiện' : 'Event';
};

const getProgressEventDetail = (item: IWidgetProgressEvent) => {
  const { event } = item;
  if (event.type === 'status') {
    return [
      event.phase ? `phase: ${event.phase}` : '',
      event.stage ? `stage: ${event.stage}` : '',
      event.attempt !== undefined ? `attempt: ${event.attempt}/${event.max_attempts ?? '?'}` : '',
      event.recoverable !== undefined ? `recoverable: ${String(event.recoverable)}` : '',
      event.run_id ? `run_id: ${event.run_id}` : '',
      event.duration_ms !== undefined ? `duration_ms: ${event.duration_ms}` : '',
      event.detail !== undefined ? stringifyCompact(event.detail) : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (event.type === 'reasoning') return event.summary;
  if (event.type === 'tool_call') return [`call_id: ${event.call_id}`, stringifyCompact(event.arguments)].join('\n');
  if (event.type === 'tool_result') return [`ok: ${String(event.ok)}`, stringifyCompact(event.result)].join('\n');
  if (event.type === 'response') {
    return [
      `duration_ms: ${event.duration_ms}`,
      event.usage ? `total_tokens: ${formatTokenCount(event.usage.total_tokens)}` : '',
      event.usage ? `cost: ${formatUsageCost(event.usage.cost, 'en')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (event.type === 'compatibility_check') {
    return `${event.score_percent}% (${event.matched_count}/${event.total_count})\n${event.message}`;
  }
  if (event.type === 'done') return event.response.output_text || event.response.response_id;
  if (event.type === 'error') return event.message;
  if (event.type === 'message') return event.text;
  return '';
};

const isProgressErrorEvent = (event: IWidgetProgressEvent['event']) =>
  event.type === 'error' || (event.type === 'tool_result' && !event.ok);

const isProgressRetryEvent = (event: IWidgetProgressEvent['event']) =>
  event.type === 'status' && (event.phase?.includes('retry') || (event.attempt ?? 0) > 1);

const isProgressStoppedEvent = (event: IWidgetProgressEvent['event']) =>
  event.type === 'status' && event.phase === 'stopped';

const formatProgressTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('vi-VN', {
    hour12: false,
  });

const getProgressDurationSeconds = (progressEvents: IWidgetProgressEvent[]) => {
  const firstEvent = progressEvents[0];
  const lastEvent = progressEvents[progressEvents.length - 1];
  if (!firstEvent || !lastEvent) return 0;
  return Math.max(1, Math.ceil((lastEvent.created_at - firstEvent.created_at) / 1_000));
};

const isSpreadsheetAttachment = (attachment: IWidgetMessageAttachment) => {
  const name = `${attachment.local_name || attachment.original_name}`.toLowerCase();
  const mimeType = attachment.mime_type || '';
  return (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  );
};

const getAttachmentKindLabel = (attachment: IWidgetMessageAttachment, locale: string) => {
  const name = `${attachment.local_name || attachment.original_name}`.toLowerCase();
  const mimeType = attachment.mime_type || '';
  const isVietnamese = locale === 'vi';
  if (isSpreadsheetAttachment(attachment)) return isVietnamese ? 'Bảng tính' : 'Spreadsheet';
  if (mimeType.startsWith('image/')) return isVietnamese ? 'Hình ảnh' : 'Image';
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) return isVietnamese ? 'Bản trình chiếu' : 'Presentation';
  if (name.endsWith('.docx') || name.endsWith('.doc')) return isVietnamese ? 'Tài liệu' : 'Document';
  return isVietnamese ? 'Tệp' : 'File';
};

interface IDocumentInputAgentWidgetChatProps {
  messages: IWidgetMessage[];
  progressEvents: IWidgetProgressEvent[];
  isRunning: boolean;
  confirmingDraftId?: string;
  copiedMessageId?: string;
  copiedDraftJsonId?: string;
  locale: string;
  onApplyDraft: (draft: IDocumentInputAgentFillDraft) => void;
  onCopyDraftJson: (draft: IDocumentInputAgentFillDraft) => void;
  onCopyMessage: (message: IWidgetMessage) => void;
  onReuseUserMessage: (message: IWidgetMessage) => void;
  onRetryUserMessage: (message: IWidgetMessage) => void;
  onOpenDocument: (documentId: string) => void;
}

export const DocumentInputAgentWidgetChat = ({
  messages,
  progressEvents,
  isRunning,
  confirmingDraftId,
  copiedMessageId,
  copiedDraftJsonId,
  locale,
  onApplyDraft,
  onCopyDraftJson,
  onCopyMessage,
  onReuseUserMessage,
  onRetryUserMessage,
  onOpenDocument,
}: IDocumentInputAgentWidgetChatProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const thinkingRef = useRef<HTMLDivElement | null>(null);
  const latestAssistantMessageId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;
  const progressDurationSeconds = getProgressDurationSeconds(progressEvents);
  const sessionUsage = useMemo(
    () =>
      aggregateUsageSummaries(messages.flatMap((message) => (message.response?.usage ? [message.response.usage] : []))),
    [messages],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, progressEvents.length]);

  useEffect(() => {
    const el = thinkingRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [progressEvents.length]);

  const renderAttachmentPreview = (attachment: IWidgetMessageAttachment) => {
    const displayName = attachment.local_name || attachment.original_name || (locale === 'vi' ? 'Tệp' : 'File');
    const kindLabel = getAttachmentKindLabel(attachment, locale);
    const mimeType = attachment.mime_type || '';

    return (
      <div
        key={attachment.file_id}
        className="flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-2 text-slate-800">
        {attachment.preview_url && mimeType.startsWith('image/') ? (
          <img
            src={attachment.preview_url}
            alt={displayName}
            className="h-9 w-9 shrink-0 rounded-md border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            {mimeType.startsWith('image/') ? (
              <ImageIcon className="h-4 w-4" />
            ) : isSpreadsheetAttachment(attachment) ? (
              <FileSpreadsheet className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold">{displayName}</div>
          <div className="truncate text-[11px] text-slate-500">{kindLabel}</div>
        </div>
      </div>
    );
  };

  const renderThinking = (message: IWidgetMessage) => {
    if (message.id !== latestAssistantMessageId || progressEvents.length === 0) return null;
    const label =
      isRunning && message.id === latestAssistantMessageId
        ? locale === 'vi'
          ? 'Đang suy nghĩ'
          : 'Thinking'
        : locale === 'vi'
          ? `Đã suy nghĩ ${progressDurationSeconds}s`
          : `Thought for ${progressDurationSeconds}s`;

    return (
      <details className="group mb-2">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800">
          {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 -rotate-90 transition group-open:rotate-0" />
        </summary>
        <div
          ref={thinkingRef}
          className="mt-2 max-h-48 space-y-1.5 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          {progressEvents.map((item) => {
            const detail = getProgressEventDetail(item);
            return (
              <div
                key={item.id}
                className={`rounded-md border px-2 py-1.5 text-[11px] ${
                  isProgressErrorEvent(item.event)
                    ? 'border-red-200 bg-red-50'
                    : isProgressRetryEvent(item.event)
                      ? 'border-amber-200 bg-amber-50'
                      : isProgressStoppedEvent(item.event)
                        ? 'border-slate-300 bg-slate-100'
                        : 'border-slate-200 bg-white'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">{getProgressEventTitle(item, locale)}</span>
                  <span className="flex shrink-0 items-center gap-1 text-slate-400">
                    <span>{formatProgressTime(item.created_at)}</span>
                    {'round' in item.event && item.event.round !== undefined ? (
                      <span className="rounded-full bg-white px-1.5 py-0.5">r{item.event.round}</span>
                    ) : null}
                  </span>
                </div>
                {detail ? (
                  <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-1.5 text-[10px] leading-4 text-slate-700">
                    {detail}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>
      </details>
    );
  };

  const renderDraftPreview = (draft: IDocumentInputAgentFillDraft) => (
    <details key={draft.id} className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold text-emerald-900">
        <span className="min-w-0 truncate">
          {locale === 'vi' ? `Preview: ${draft.title}` : `Preview: ${draft.title}`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-emerald-100 p-2">
        {draft.warnings.length > 0 ? (
          <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
            {draft.warnings.slice(0, 3).map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}
        <div className="relative">
          <button
            type="button"
            onClick={() => onCopyDraftJson(draft)}
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            title={
              copiedDraftJsonId === draft.id
                ? locale === 'vi'
                  ? 'Đã copy'
                  : 'Copied'
                : locale === 'vi'
                  ? 'Copy JSON'
                  : 'Copy JSON'
            }>
            {copiedDraftJsonId === draft.id ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <pre className="max-h-48 overflow-auto rounded-md border border-slate-200 bg-white p-2 pr-10 text-[10px] leading-4 text-slate-700">
            {JSON.stringify(draft.definition, null, 2)}
          </pre>
        </div>
        <button
          type="button"
          disabled={Boolean(confirmingDraftId)}
          onClick={() => onApplyDraft(draft)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {confirmingDraftId === draft.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {locale === 'vi' ? 'Tạo tài liệu' : 'Create document'}
        </button>
      </div>
    </details>
  );

  const renderUsageSummary = () => {
    if (!sessionUsage) return null;

    return (
      <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
        <summary className="cursor-pointer list-none font-semibold">
          {locale === 'vi' ? 'Token sử dụng' : 'Token usage'} · {formatTokenCount(sessionUsage.total_tokens)}
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded bg-slate-50 px-2 py-1">
            <div className="text-slate-400">Input</div>
            <div className="font-semibold text-slate-800">{formatTokenCount(sessionUsage.input_tokens)}</div>
          </div>
          <div className="rounded bg-slate-50 px-2 py-1">
            <div className="text-slate-400">Output</div>
            <div className="font-semibold text-slate-800">{formatTokenCount(sessionUsage.output_tokens)}</div>
          </div>
          <div className="col-span-2 rounded bg-slate-50 px-2 py-1">
            <div className="text-slate-400">Cost</div>
            <div className="font-semibold text-slate-800">{formatUsageCost(sessionUsage.cost, locale)}</div>
          </div>
        </div>
        {sessionUsage.cost.is_configured ? (
          <div className="mt-2 text-[10px] text-slate-500">
            {locale === 'vi' ? 'Giá' : 'Pricing'}: {formatUsd(sessionUsage.cost.input_usd_per_1m_tokens)} input /{' '}
            {formatUsd(sessionUsage.cost.output_usd_per_1m_tokens)} output per 1M tokens
          </div>
        ) : (
          <div className="mt-2 text-[10px] text-amber-700">
            {locale === 'vi' ? 'Chưa cấu hình đơn giá token.' : 'Token pricing is not configured.'}
          </div>
        )}
        {sessionUsage.items.length > 0 ? (
          <div className="mt-2 overflow-auto rounded-md border border-slate-200">
            <table className="min-w-full text-left text-[10px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1 font-semibold">{locale === 'vi' ? 'Phase' : 'Phase'}</th>
                  <th className="px-2 py-1 font-semibold">Input</th>
                  <th className="px-2 py-1 font-semibold">Output</th>
                  <th className="px-2 py-1 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {sessionUsage.items.map((item) => (
                  <tr
                    key={`${item.response_id}-${item.phase}-${item.round ?? 'x'}`}
                    className="border-t border-slate-100">
                    <td className="px-2 py-1 text-slate-700">{item.phase}</td>
                    <td className="px-2 py-1">{formatTokenCount(item.input_tokens)}</td>
                    <td className="px-2 py-1">{formatTokenCount(item.output_tokens)}</td>
                    <td className="px-2 py-1">{formatUsageCost(item.cost, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </details>
    );
  };

  const renderMessageActions = (message: IWidgetMessage) => (
    <div className={`mt-1.5 flex gap-1 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <button
        type="button"
        onClick={() => onCopyMessage(message)}
        className={`rounded-md px-2 py-1 text-[11px] font-medium ${
          message.role === 'user'
            ? 'text-slate-300 hover:bg-white/10 hover:text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`}>
        {copiedMessageId === message.id ? (locale === 'vi' ? 'Đã copy' : 'Copied') : locale === 'vi' ? 'Copy' : 'Copy'}
      </button>
      {message.role === 'user' ? (
        <>
          <button
            type="button"
            onClick={() => onReuseUserMessage(message)}
            disabled={isRunning}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40">
            {locale === 'vi' ? 'Sửa' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={() => onRetryUserMessage(message)}
            disabled={isRunning}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40">
            <RotateCcw className="h-3 w-3" />
            {locale === 'vi' ? 'Thử lại' : 'Retry'}
          </button>
        </>
      ) : null}
    </div>
  );

  if (messages.length === 0 && !isRunning) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10 text-center">
        <div>
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
            <Bot className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-800">
            {locale === 'vi' ? 'Gửi tin nhắn để bắt đầu' : 'Send a message to start'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {locale === 'vi'
              ? 'Chọn template hoặc nhập yêu cầu xử lý tài liệu.'
              : 'Choose a template or ask for a document task.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
      <div className="flex flex-col gap-3">
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 shadow-sm ${
                msg.role === 'user'
                  ? 'rounded-br-md bg-slate-900 text-white'
                  : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
              }`}>
              {msg.attachments?.length ? (
                <div className="mb-2 flex flex-col gap-1.5">{msg.attachments.map(renderAttachmentPreview)}</div>
              ) : null}
              {msg.role === 'assistant' && !msg.content && isRunning && index === messages.length - 1 ? (
                <span className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {locale === 'vi' ? 'Đang xử lý...' : 'Processing...'}
                </span>
              ) : msg.role === 'user' ? (
                <>
                  <MarkdownLite content={msg.content} variant="user" />
                  {renderMessageActions(msg)}
                </>
              ) : (
                <>
                  {renderThinking(msg)}
                  <MarkdownLite content={msg.content} />
                  {msg.response?.applied_documents?.length ? (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {msg.response.applied_documents.map((document) => (
                        <button
                          key={document.document_id}
                          type="button"
                          onClick={() => onOpenDocument(document.document_id)}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-100">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 truncate">{document.title}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {msg.response?.fill_drafts?.map(renderDraftPreview)}
                  {renderMessageActions(msg)}
                </>
              )}
            </div>
          </div>
        ))}
        {isRunning && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start gap-2">
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              <span className="text-[13px] text-slate-500">{locale === 'vi' ? 'Đang xử lý...' : 'Processing...'}</span>
            </div>
          </div>
        )}
        {renderUsageSummary()}
      </div>
    </div>
  );
};
