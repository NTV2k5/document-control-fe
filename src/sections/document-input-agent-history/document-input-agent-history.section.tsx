import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Bot, Eye, Loader2, MessageSquare, RefreshCcw, Search, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, DataTable, Input, type PaginationInfo } from 'reactjs-platform/ui';
import {
  getDocumentInputAgentChatHistoryUserAPI,
  getDocumentInputAgentChatHistoryUsersAPI,
  type IDocumentInputAgentChatHistoryMessage,
  type IDocumentInputAgentChatHistorySession,
  type IDocumentInputAgentChatHistoryUser,
  type IDocumentInputAgentChatHistoryUserDetail,
} from 'api';
import { useTranslation } from '../../i18n';

const DEFAULT_PAGINATION: PaginationInfo = {
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 0,
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

type TTranslate = ReturnType<typeof useTranslation>['t'];

const formatDateTime = (value: string | number | null | undefined, intlLocale: string, emptyLabel: string) => {
  if (value === undefined || value === null) return emptyLabel;

  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(intlLocale, {
    hour12: false,
  });
};

const formatCompactDateTime = (value: string | number | null | undefined, intlLocale: string) => {
  if (value === undefined || value === null) return '-';

  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(intlLocale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const readMessageContent = (message: IDocumentInputAgentChatHistoryMessage) => {
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  return '';
};

const getRoleLabel = (role: string | undefined, t: TTranslate) => {
  if (role === 'user') return t('documentInputAgentHistory.roles.user');
  if (role === 'assistant') return t('documentInputAgentHistory.roles.assistant');
  return role || t('documentInputAgentHistory.roles.message');
};

const getUserLabel = (user: Pick<IDocumentInputAgentChatHistoryUser, 'user_email' | 'user_id'>) =>
  user.user_email || user.user_id;

const getConversationPreview = (session: IDocumentInputAgentChatHistorySession, t: TTranslate) => {
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const latestMessage = [...messages].reverse().find((message) => readMessageContent(message));
  const preview = latestMessage ? readMessageContent(latestMessage).replace(/\s+/g, ' ') : '';

  if (!preview) return t('documentInputAgentHistory.empty.noContent');
  return preview.length > 96 ? `${preview.slice(0, 96)}...` : preview;
};

const ChatMessageBubble = ({
  message,
  sessionId,
  index,
  t,
  intlLocale,
}: {
  message: IDocumentInputAgentChatHistoryMessage;
  sessionId: string;
  index: number;
  t: TTranslate;
  intlLocale: string;
}) => {
  const isUser = message.role === 'user';
  const content = readMessageContent(message);

  return (
    <article key={message.id || `${sessionId}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? (
        <div className="flex max-w-[82%] flex-col items-end">
          <div className="w-full rounded-[24px] bg-neutral-100 px-5 py-4 text-neutral-950 shadow-sm">
            {message.created_at ? (
              <div className="mb-2 text-right text-[11px] font-medium text-neutral-500">
                {formatCompactDateTime(message.created_at, intlLocale)}
              </div>
            ) : null}
            <div className="whitespace-pre-wrap break-words text-sm leading-6">
              {content || t('documentInputAgentHistory.empty.noTextContent')}
            </div>
            {message.attachments?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.attachments.map((attachment) => (
                  <span
                    key={attachment.file_id || attachment.original_name || attachment.local_name}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600">
                    {attachment.original_name || attachment.local_name || attachment.file_id}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[92%] py-1">
          <div className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
            <Bot className="size-4" />
            <span>{getRoleLabel(message.role, t)}</span>
            {message.created_at ? <span>{formatCompactDateTime(message.created_at, intlLocale)}</span> : null}
          </div>
          <div className="whitespace-pre-wrap break-words text-sm leading-7 text-neutral-900">
            {content || t('documentInputAgentHistory.empty.noTextContent')}
          </div>
        </div>
      )}
    </article>
  );
};

const getHistoryColumns = (
  navigateToDetail: (userId: string) => void,
  page: number,
  pageSize: number,
  t: TTranslate,
  intlLocale: string,
): ColumnDef<IDocumentInputAgentChatHistoryUser>[] => [
  {
    id: 'no',
    header: t('documentInputAgentHistory.columns.no'),
    cell: ({ row }) => <span className="text-slate-400">{(page - 1) * pageSize + row.index + 1}</span>,
    meta: { className: 'w-12 min-w-[48px] max-w-[48px] !px-1 text-center' },
  },
  {
    id: 'user',
    header: t('documentInputAgentHistory.columns.user'),
    cell: ({ row }) => (
      <button
        type="button"
        onClick={() => navigateToDetail(row.original.user_id)}
        className="flex min-w-0 items-center gap-3 text-left">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <UserRound className="size-4" />
        </div>
        <div className="min-w-0 whitespace-normal">
          <div className="break-words text-sm font-semibold leading-5 text-[#174A86]">{getUserLabel(row.original)}</div>
          <div className="mt-1 break-words text-xs leading-4 text-slate-400">{row.original.user_id}</div>
        </div>
      </button>
    ),
    meta: { className: 'w-[300px] min-w-[260px] max-w-[340px] whitespace-normal' },
  },
  {
    accessorKey: 'session_count',
    header: t('documentInputAgentHistory.columns.conversations'),
    cell: ({ row }) => (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
        {row.original.session_count}
      </span>
    ),
    meta: { className: 'w-[130px] min-w-[120px] text-center' },
  },
  {
    accessorKey: 'message_count',
    header: t('documentInputAgentHistory.columns.messages'),
    cell: ({ row }) => <span className="font-semibold text-slate-800">{row.original.message_count}</span>,
    meta: { className: 'w-[110px] min-w-[100px] text-center' },
  },
  {
    accessorKey: 'latest_session_title',
    header: t('documentInputAgentHistory.columns.latestConversation'),
    cell: ({ row }) => (
      <div className="max-w-[260px] whitespace-normal text-sm">
        <div className="break-words font-semibold leading-5 text-slate-900">
          {row.original.latest_session_title || '-'}
        </div>
      </div>
    ),
    meta: { className: 'w-[260px] min-w-[220px] max-w-[300px] whitespace-normal' },
  },
  {
    accessorKey: 'latest_message_preview',
    header: t('documentInputAgentHistory.columns.latestMessage'),
    cell: ({ row }) => (
      <div className="max-w-[340px] whitespace-normal text-sm leading-5 text-slate-500">
        {row.original.latest_message_preview || '-'}
      </div>
    ),
    meta: { className: 'w-[340px] min-w-[280px] max-w-[380px] whitespace-normal' },
  },
  {
    accessorKey: 'updated_at',
    header: t('documentInputAgentHistory.columns.updatedAt'),
    cell: ({ row }) => (
      <div className="whitespace-normal text-sm">
        <div className="font-medium leading-5 text-slate-700">
          {formatDateTime(row.original.updated_at, intlLocale, t('documentInputAgentHistory.empty.noDate'))}
        </div>
      </div>
    ),
    meta: { className: 'w-[150px] min-w-[140px] max-w-[170px] whitespace-normal' },
  },
  {
    id: 'actions',
    header: t('documentInputAgentHistory.columns.actions'),
    meta: { frozen: 'right', frozenWidth: 96 },
    cell: ({ row }) => (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 rounded-xl px-3"
        onClick={() => navigateToDetail(row.original.user_id)}>
        <Eye className="size-4" />
        {t('documentInputAgentHistory.actions.view')}
      </Button>
    ),
  },
];

const DocumentInputAgentHistoryList = () => {
  const { t, intlLocale } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState<IDocumentInputAgentChatHistoryUser[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState('');

  const pageSize = pagination.page_size ?? 10;

  const loadUsers = useCallback(async () => {
    setUserError('');
    setLoadingUsers(true);
    try {
      const response = await getDocumentInputAgentChatHistoryUsersAPI({
        page: pagination.page,
        page_size: pageSize,
        search: searchQuery.trim() || undefined,
      });

      setUsers(response.data);
      setPagination((current) => ({
        ...current,
        ...response.pagination,
      }));
    } catch (error) {
      setUserError(formatErrorMessage(error));
      setUsers([]);
      setPagination((current) => ({
        ...current,
        total: 0,
        total_pages: 0,
      }));
    } finally {
      setLoadingUsers(false);
    }
  }, [pageSize, pagination.page, searchQuery]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const navigateToDetail = useCallback(
    (userId: string) => {
      void navigate({
        to: '/document-input-agent-history/$userId',
        params: { userId },
      });
    },
    [navigate],
  );

  const columns = useMemo(
    () => getHistoryColumns(navigateToDetail, pagination.page, pageSize, t, intlLocale),
    [intlLocale, navigateToDetail, pageSize, pagination.page, t],
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-bold text-[#0B2559]">{t('documentInputAgentHistory.title')}</div>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadUsers()} disabled={loadingUsers}>
          {loadingUsers ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          {t('documentInputAgentHistory.actions.reload')}
        </Button>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="relative min-w-[280px] flex-1 md:max-w-lg">
            <Input
              type="text"
              placeholder={t('documentInputAgentHistory.searchPlaceholder')}
              className="h-11 rounded-2xl border-slate-200 pl-10"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
            />
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="text-sm font-medium text-slate-500">
            {pagination.total > 0
              ? `${(pagination.page - 1) * pageSize + 1}-${Math.min(pagination.total, pagination.page * pageSize)} / ${
                  pagination.total
                }`
              : '0 / 0'}
          </div>
        </div>

        {userError ? (
          <div className="mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {userError}
          </div>
        ) : null}

        <div className="px-6 py-5">
          <DataTable
            fixedHeader
            enableFreezeColumns
            columns={columns}
            data={users}
            loading={loadingUsers}
            pagination={pagination}
            onPaginationChange={(updater) => setPagination((current) => updater(current))}
          />
        </div>
      </div>
    </div>
  );
};

const DocumentInputAgentHistoryDetail = ({ userId }: { userId: string }) => {
  const { t, intlLocale } = useTranslation();
  const navigate = useNavigate();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedUserDetail, setSelectedUserDetail] = useState<IDocumentInputAgentChatHistoryUserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  const sessions = selectedUserDetail?.history.sessions ?? [];
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [selectedSessionId, sessions],
  );
  const messages = selectedSession?.messages ?? [];
  const userLabel = selectedUserDetail
    ? getUserLabel({
        user_id: selectedUserDetail.user_id,
        user_email: selectedUserDetail.user_email,
      })
    : userId;

  const loadDetail = useCallback(async () => {
    setDetailError('');
    setLoadingDetail(true);
    try {
      const detail = await getDocumentInputAgentChatHistoryUserAPI(userId);
      setSelectedUserDetail(detail);
      const nextSessions = detail?.history.sessions ?? [];
      const activeSessionId = detail?.history.active_session_id;
      const nextSessionId =
        nextSessions.find((session) => session.id === activeSessionId)?.id ?? nextSessions[0]?.id ?? '';
      setSelectedSessionId(nextSessionId);
    } catch (error) {
      setDetailError(formatErrorMessage(error));
      setSelectedUserDetail(null);
      setSelectedSessionId('');
    } finally {
      setLoadingDetail(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden bg-white text-neutral-950">
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-neutral-300 bg-[#e8ecef] md:flex xl:w-[292px]">
        <div className="flex h-16 items-center border-b border-neutral-300 px-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-white/70 hover:text-neutral-950"
            onClick={() => navigate({ to: '/document-input-agent-history' })}
            title={t('documentInputAgentHistory.actions.backToList')}>
            <ArrowLeft className="size-4" />
            <span>{t('documentInputAgentHistory.actions.userList')}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-normal text-neutral-500">
            {t('documentInputAgentHistory.sidebarTitle')}
          </div>
          {loadingDetail ? (
            <div className="flex items-center gap-2 rounded-xl bg-white/60 px-3 py-3 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
              {t('documentInputAgentHistory.loading')}
            </div>
          ) : null}
          {!loadingDetail && sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white/60 px-4 py-8 text-center text-sm text-neutral-500">
              {t('documentInputAgentHistory.empty.noUserConversations')}
            </div>
          ) : null}
          <div className="space-y-1">
            {!loadingDetail &&
              sessions.map((session) => {
                const isSelected = session.id === selectedSession?.id;

                return (
                  <button
                    type="button"
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
                      isSelected
                        ? 'bg-white text-neutral-950 shadow-sm'
                        : 'text-neutral-700 hover:bg-white/70 hover:text-neutral-950'
                    }`}>
                    <MessageSquare className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {session.title || t('documentInputAgentHistory.empty.newConversation')}
                      </span>
                      <span className="mt-1 block truncate text-xs text-neutral-500">
                        {getConversationPreview(session, t)}
                      </span>
                      <span className="mt-1 block text-xs text-neutral-400">
                        {formatCompactDateTime(session.updated_at, intlLocale)} ·{' '}
                        {t('documentInputAgentHistory.messageCount', { count: session.messages?.length ?? 0 })}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white/95 px-6 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 md:hidden"
              onClick={() => navigate({ to: '/document-input-agent-history' })}
              title={t('documentInputAgentHistory.actions.backToList')}>
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">
                {selectedSession
                  ? selectedSession.title || t('documentInputAgentHistory.empty.newConversation')
                  : t('documentInputAgentHistory.agentName')}
              </div>
              <div className="mt-0.5 truncate text-xs font-medium text-neutral-500">
                {userLabel} · {t('documentInputAgentHistory.readOnly')} ·{' '}
                {t('documentInputAgentHistory.conversationCount', { count: selectedUserDetail?.session_count ?? 0 })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadDetail()}
              disabled={loadingDetail}>
              {loadingDetail ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
              {t('documentInputAgentHistory.actions.reload')}
            </Button>
          </div>
        </header>

        {detailError ? (
          <div className="mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {detailError}
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
            {loadingDetail ? (
              <div className="flex min-h-[48vh] items-center justify-center text-sm text-neutral-500">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t('documentInputAgentHistory.loadingDetail')}
              </div>
            ) : null}

            {!loadingDetail && selectedSession && messages.length === 0 ? (
              <div className="flex min-h-[48vh] items-center justify-center text-sm text-neutral-500">
                {t('documentInputAgentHistory.empty.noMessages')}
              </div>
            ) : null}

            {!loadingDetail && !selectedSession ? (
              <div className="flex min-h-[48vh] items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-semibold tracking-normal text-neutral-950">
                    {t('documentInputAgentHistory.agentName')}
                  </div>
                  <div className="mt-3 text-sm text-neutral-500">
                    {t('documentInputAgentHistory.empty.noConversationToShow')}
                  </div>
                </div>
              </div>
            ) : null}

            {!loadingDetail && selectedSession
              ? messages.map((message, index) => (
                  <ChatMessageBubble
                    key={message.id || `${selectedSession.id}-${index}`}
                    message={message}
                    sessionId={selectedSession.id}
                    index={index}
                    t={t}
                    intlLocale={intlLocale}
                  />
                ))
              : null}
          </div>
        </main>
      </div>
    </div>
  );
};

export const DocumentInputAgentHistorySection = ({ user_id }: { user_id?: string }) => {
  if (user_id) return <DocumentInputAgentHistoryDetail userId={user_id} />;
  return <DocumentInputAgentHistoryList />;
};
