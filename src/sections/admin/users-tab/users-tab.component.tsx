'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, Button, Input, type PaginationInfo } from 'reactjs-platform/ui';
import {
  useAdminUsers,
  profileStore,
  hasPermission,
  isCurrentProfileUser,
  type IAdminUser,
} from 'reactjs-platform/utilities';
import { useCallback, useMemo, useState } from 'react';
import { UserPlus, Pencil, KeyRound, Trash2, UserCheck, UserX, Search } from 'lucide-react';
import { CreateUserModal } from '../create-user';
import { EditUserModal } from '../edit-user';
import { ResetPasswordModal } from '../reset-password';
import { useAdminUsersContext } from '../admin-users/admin-users.context';
import { useTranslation } from '../../../i18n';

type ModalType = 'create' | 'edit' | 'resetPassword' | null;

export const UsersTab = () => {
  const { t, intlLocale } = useTranslation();
  const profile = profileStore((state) => state.profile);
  const canCreateUser = hasPermission(profile, 'user.create');
  const canEditUser = hasPermission(profile, 'user.update');
  const canDeleteUser = hasPermission(profile, 'user.delete');
  const canDisableUser = hasPermission(profile, 'user.disable');
  const { setActiveTab } = useAdminUsersContext();
  const {
    users,
    total,
    page,
    pageSize,
    search,
    isLoading,
    actionLoading,
    actionError,
    clearActionError,
    setSearch,
    setPage,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    setEnabled,
  } = useAdminUsers();

  const [modal, setModal] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<IAdminUser | null>(null);
  const [searchInput, setSearchInput] = useState(search ?? '');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openModal = useCallback(
    (type: ModalType, user?: IAdminUser) => {
      clearActionError();
      setSelectedUser(user ?? null);
      setModal(type);
    },
    [clearActionError],
  );

  const closeModal = useCallback(() => {
    setModal(null);
    setSelectedUser(null);
  }, []);

  const handleDelete = useCallback(
    async (user: IAdminUser) => {
      if (deleteConfirmId !== user.id) {
        setDeleteConfirmId(user.id);
        return;
      }
      await deleteUser(user.id);
      setDeleteConfirmId(null);
    },
    [deleteConfirmId, deleteUser],
  );

  const columns: ColumnDef<IAdminUser>[] = useMemo(
    () => [
      {
        id: 'no',
        header: t('adminUsers.users.columns.no'),
        cell: ({ row }) => <span className="text-gray-500">#{(page - 1) * pageSize + row.index + 1}</span>,
        meta: { className: 'w-12 min-w-[48px] max-w-[48px] !px-1 text-center' },
      },
      {
        id: 'user',
        header: t('adminUsers.users.columns.user'),
        cell: ({ row }) => {
          const u = row.original;
          const initials = (u.first_name?.[0] ?? u.username[0]).toUpperCase();
          const displayName = u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '—';
          return (
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#001B44]/10 text-xs font-semibold text-[#001B44]">
                {initials}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-400">@{u.username}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => <span className="text-sm text-gray-600">{row.original.email}</span>,
      },
      {
        id: 'managed_by',
        header: t('adminUsers.users.columns.managedBy'),
        cell: ({ row }) => {
          const managers = row.original.managed_by ?? [];

          if (!managers.length) {
            return <span className="text-xs text-slate-400">{t('adminUsers.users.noManagedScope')}</span>;
          }

          return (
            <div className="space-y-1">
              {managers.slice(0, 2).map((manager) => (
                <div key={manager.user_id} className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-700">{manager.display_name}</div>
                  <div className="truncate text-[11px] text-slate-400">
                    @{manager.username}
                    {manager.organization_unit_name ? ` · ${manager.organization_unit_name}` : ''}
                  </div>
                </div>
              ))}
              {managers.length > 2 && (
                <div className="text-[11px] font-medium text-slate-500">
                  {t('adminUsers.users.moreManagers', { count: managers.length - 2 })}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'enabled',
        header: t('adminUsers.users.columns.status'),
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
        id: 'created',
        header: t('adminUsers.users.columns.createdOn'),
        cell: ({ row }) =>
          row.original.created_at ? new Date(row.original.created_at).toLocaleDateString(intlLocale) : '—',
      },
      {
        id: 'actions',
        header: t('adminUsers.users.columns.actions'),
        meta: { frozen: 'right', frozenWidth: 180 },
        cell: ({ row }) => {
          const u = row.original;
          const isSelfUser = isCurrentProfileUser(profile, u);
          const showAnyAction = canEditUser || canDisableUser || canDeleteUser;
          return (
            <div className="flex items-center gap-1">
              {canEditUser && (
                <>
                  <IconBtn
                    title={t('adminUsers.users.actions.edit')}
                    onClick={() => openModal('edit', u)}
                    disabled={actionLoading}>
                    <Pencil className="size-3.5" />
                  </IconBtn>
                  <IconBtn
                    title={t('adminUsers.users.actions.resetPassword')}
                    onClick={() => openModal('resetPassword', u)}
                    disabled={actionLoading}>
                    <KeyRound className="size-3.5" />
                  </IconBtn>
                </>
              )}
              {canDisableUser && (
                <IconBtn
                  title={
                    isSelfUser
                      ? t('adminUsers.users.actions.disableSelf')
                      : u.enabled
                        ? t('adminUsers.users.actions.disable')
                        : t('adminUsers.users.actions.enable')
                  }
                  onClick={() => setEnabled(u.id, !u.enabled)}
                  disabled={actionLoading || isSelfUser}
                  className={u.enabled ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}>
                  {u.enabled ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                </IconBtn>
              )}
              {canDeleteUser && (
                <IconBtn
                  title={
                    isSelfUser
                      ? t('adminUsers.users.actions.deleteSelf')
                      : deleteConfirmId === u.id
                        ? t('adminUsers.users.actions.confirmDelete')
                        : t('adminUsers.users.actions.delete')
                  }
                  onClick={() => handleDelete(u)}
                  disabled={actionLoading || isSelfUser}
                  className={
                    deleteConfirmId === u.id
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'text-red-400 hover:bg-red-50 hover:text-red-600'
                  }>
                  <Trash2 className="size-3.5" />
                </IconBtn>
              )}
              {!showAnyAction && <span className="text-xs text-slate-400">{t('adminUsers.users.viewOnly')}</span>}
            </div>
          );
        },
      },
    ],
    [
      actionLoading,
      canDeleteUser,
      canDisableUser,
      canEditUser,
      deleteConfirmId,
      handleDelete,
      intlLocale,
      openModal,
      page,
      pageSize,
      profile,
      setEnabled,
      t,
    ],
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
          <div className="text-2xl font-bold text-[#002147]">{t('adminUsers.users.title')}</div>
          <p className="mt-1 text-sm text-slate-500">
            {t('adminUsers.users.descriptionPrefix')}{' '}
            <button
              type="button"
              onClick={() => setActiveTab('org-access')}
              className="font-medium text-[#002147] underline-offset-2 hover:underline">
              {t('adminUsers.users.descriptionTab')}
            </button>
            .
          </p>
        </div>
        {canCreateUser && (
          <Button size="sm" variant="navy" className="h-10 rounded-xl px-4" onClick={() => openModal('create')}>
            <UserPlus className="size-4" />
            {t('adminUsers.users.addUser')}
          </Button>
        )}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="relative min-w-[280px] max-w-lg">
            <Input
              type="text"
              placeholder={t('adminUsers.users.searchPlaceholder')}
              className="h-11 rounded-2xl border-slate-200 pl-10"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setSearch(e.target.value.trim() || '');
              }}
            />
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        <div className="px-6 py-5">
          <DataTable
            fixedHeader
            enableFreezeColumns
            columns={columns}
            data={users}
            loading={isLoading}
            pagination={tablePagination}
            onPaginationChange={(updater) => {
              const next = updater(tablePagination);
              if (next.page !== page) setPage(next.page);
            }}
          />
        </div>
      </div>

      <CreateUserModal
        isOpen={canCreateUser && modal === 'create'}
        onClose={closeModal}
        onSubmit={createUser}
        loading={actionLoading}
        error={actionError}
      />
      <EditUserModal
        isOpen={canEditUser && modal === 'edit'}
        onClose={closeModal}
        user={selectedUser}
        onSubmit={updateUser}
        loading={actionLoading}
        error={actionError}
      />
      <ResetPasswordModal
        isOpen={canEditUser && modal === 'resetPassword'}
        onClose={closeModal}
        user={selectedUser}
        onSubmit={resetPassword}
        loading={actionLoading}
        error={actionError}
      />
    </div>
  );
};

function IconBtn({
  title,
  onClick,
  disabled,
  children,
  className = 'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-7 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
}
