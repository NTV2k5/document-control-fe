'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, Search, UserRoundCheck } from 'lucide-react';
import { Button, DataTable, Input, type PaginationInfo } from 'reactjs-platform/ui';
import { isRootProfile, profileStore, useKeycloakAccounts, type IKeycloakAccount } from 'reactjs-platform/utilities';
import { useTranslation } from '../../../i18n';

export const KeycloakAccountsTab = () => {
  const { t, intlLocale } = useTranslation();
  const profile = profileStore((state) => state.profile);
  const canSyncAccount = isRootProfile(profile);
  const {
    accounts,
    total,
    page,
    pageSize,
    search,
    isLoading,
    error,
    actionLoadingId,
    actionError,
    setSearch,
    setPage,
    syncAccount,
  } = useKeycloakAccounts();
  const [searchInput, setSearchInput] = useState(search ?? '');

  const columns: ColumnDef<IKeycloakAccount>[] = useMemo(
    () => [
      {
        id: 'no',
        header: t('adminUsers.keycloak.columns.no'),
        cell: ({ row }) => <span className="text-gray-500">#{(page - 1) * pageSize + row.index + 1}</span>,
        meta: { className: 'w-12 min-w-[48px] max-w-[48px] !px-1 text-center' },
      },
      {
        id: 'account',
        header: t('adminUsers.keycloak.columns.account'),
        cell: ({ row }) => {
          const account = row.original;
          const displayName =
            account.first_name || account.last_name
              ? `${account.first_name ?? ''} ${account.last_name ?? ''}`.trim()
              : '—';
          const initials = (account.first_name?.[0] ?? account.username?.[0] ?? '?').toUpperCase();

          return (
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#001B44]/10 text-xs font-semibold text-[#001B44]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{displayName}</p>
                <p className="truncate text-xs text-gray-400">@{account.username}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => (
          <span className={row.original.email ? 'text-sm text-gray-600' : 'text-sm text-red-500'}>
            {row.original.email || t('adminUsers.keycloak.noEmail')}
          </span>
        ),
      },
      {
        accessorKey: 'enabled',
        header: t('adminUsers.keycloak.columns.status'),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              row.original.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
            <span className={`size-1.5 rounded-full ${row.original.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
            {row.original.enabled ? t('adminUsers.users.active') : t('adminUsers.users.disabled')}
          </span>
        ),
      },
      {
        accessorKey: 'synced',
        header: t('adminUsers.keycloak.columns.syncStatus'),
        cell: ({ row }) =>
          row.original.synced ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              <CheckCircle2 className="size-3" />
              {t('adminUsers.keycloak.synced')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              <AlertCircle className="size-3" />
              {t('adminUsers.keycloak.notSynced')}
            </span>
          ),
      },
      {
        id: 'created',
        header: t('adminUsers.keycloak.columns.createdOn'),
        cell: ({ row }) =>
          row.original.created_at ? new Date(row.original.created_at).toLocaleDateString(intlLocale) : '—',
      },
      {
        id: 'actions',
        header: t('adminUsers.keycloak.columns.actions'),
        meta: { frozen: 'right', frozenWidth: 140 },
        cell: ({ row }) => {
          const account = row.original;
          const loading = actionLoadingId === account.id;
          const disabled = !canSyncAccount || account.synced || !account.email || actionLoadingId !== null;
          const title = !canSyncAccount
            ? t('adminUsers.keycloak.actions.noPermission')
            : account.synced
              ? t('adminUsers.keycloak.actions.alreadySynced')
              : !account.email
                ? t('adminUsers.keycloak.actions.emailRequired')
                : t('adminUsers.keycloak.actions.sync');

          return (
            <Button
              size="sm"
              variant={account.synced ? 'outline' : 'navy'}
              className="h-8 rounded-xl px-3"
              title={title}
              disabled={disabled}
              onClick={() => syncAccount(account.id)}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {account.synced ? t('adminUsers.keycloak.actions.synced') : t('adminUsers.keycloak.actions.add')}
            </Button>
          );
        },
      },
    ],
    [actionLoadingId, canSyncAccount, intlLocale, page, pageSize, syncAccount, t],
  );

  const tablePagination = useMemo<PaginationInfo>(
    () => ({
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize) || 1,
    }),
    [page, pageSize, total],
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold text-[#002147]">
            <UserRoundCheck className="size-6" />
            {t('adminUsers.keycloak.title')}
          </div>
          <p className="mt-1 text-sm text-slate-500">{t('adminUsers.keycloak.description')}</p>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="relative min-w-[280px] max-w-lg">
            <Input
              type="text"
              placeholder={t('adminUsers.keycloak.searchPlaceholder')}
              className="h-11 rounded-2xl border-slate-200 pl-10"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSearch(event.target.value.trim() || '');
                setPage(1);
              }}
            />
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        {(error || actionError) && (
          <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-600">{error || actionError}</div>
        )}
        <div className="px-6 py-5">
          <DataTable
            fixedHeader
            enableFreezeColumns
            columns={columns}
            data={accounts}
            loading={isLoading}
            pagination={tablePagination}
            onPaginationChange={(updater) => {
              const next = updater(tablePagination);
              if (next.page !== page) setPage(next.page);
            }}
          />
        </div>
      </div>
    </div>
  );
};
