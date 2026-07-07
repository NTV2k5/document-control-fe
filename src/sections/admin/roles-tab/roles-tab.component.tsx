'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, Button, Input, type PaginationInfo } from 'reactjs-platform/ui';
import {
  useAdminAuthorization,
  useAdminRoles,
  profileStore,
  hasPermission,
  type IRole,
  type ICreateRolePayload,
  type IUpdateRolePayload,
  type IPermission,
  type ScopeType,
} from 'reactjs-platform/utilities';
import { useCallback, useId, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';

type ModalType = 'create' | 'edit' | null;

const scopeLabel = (scope: ScopeType): string =>
  ({
    GLOBAL: 'Toàn hệ thống',
    TENANT: 'Toàn tenant',
    ORG_UNIT: 'Đơn vị',
    ORG_UNIT_TREE: 'Đơn vị + đơn vị con',
    OWN: 'Cá nhân',
    ASSIGNED: 'Được chia sẻ',
    PUBLIC: 'Công khai',
  })[scope] ?? scope;

export const RolesTab = () => {
  const profile = profileStore((state) => state.profile);
  const { permissions } = useAdminAuthorization({
    includeOverview: false,
    includeOrganizationUnits: false,
    includePermissions: true,
  });
  const { roles, isLoading, actionLoading, actionError, clearActionError, createRole, updateRole, deleteRole } =
    useAdminRoles();
  const isRootUser = profileStore((state) =>
    Boolean(state.profile?.scope_assignments?.some((assignment) => assignment.role.role_key === 'ROOT')),
  );
  const canCreateRole = hasPermission(profile, 'role.create');
  const canUpdateRole = hasPermission(profile, 'role.update');
  const canDeleteRole = hasPermission(profile, 'role.delete');

  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<IRole | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  const openModal = useCallback(
    (type: ModalType, role?: IRole) => {
      clearActionError();
      setSelected(role ?? null);
      setModal(type);
    },
    [clearActionError],
  );

  const closeModal = useCallback(() => {
    setModal(null);
    setSelected(null);
  }, []);

  const handleDelete = useCallback(
    async (role: IRole) => {
      if (deleteConfirmId !== role.id) {
        setDeleteConfirmId(role.id);
        return;
      }
      await deleteRole(role.id);
      setDeleteConfirmId(null);
    },
    [deleteConfirmId, deleteRole],
  );

  const filtered = useMemo(() => {
    if (!filterText.trim()) return roles;
    const q = filterText.toLowerCase();
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(q) ||
        role.key.toLowerCase().includes(q) ||
        role.scope_type.toLowerCase().includes(q),
    );
  }, [roles, filterText]);

  const pagination = useMemo<PaginationInfo>(
    () => ({
      page: 1,
      page_size: filtered.length || 1,
      total: filtered.length,
      total_pages: 1,
    }),
    [filtered.length],
  );

  const columns: ColumnDef<IRole>[] = useMemo(
    () => [
      {
        id: 'no',
        header: 'STT',
        cell: ({ row }) => <span className="text-gray-500">{row.index + 1}</span>,
        meta: { className: 'w-12 text-center' },
      },
      {
        accessorKey: 'key',
        header: 'Mã',
        cell: ({ row }) => <span className="font-mono text-xs font-medium text-gray-700">{row.original.key}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Tên',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-gray-400" />
            <span className="font-semibold text-gray-900">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'scope_type',
        header: 'Phạm vi',
        cell: ({ row }) => (
          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {scopeLabel(row.original.scope_type)}
          </span>
        ),
      },
      {
        accessorKey: 'level',
        header: 'Cấp',
        cell: ({ row }) => <span className="text-sm font-medium text-slate-700">{row.original.level}</span>,
      },
      {
        id: 'permissions',
        header: 'Quyền',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {(row.original.permissions ?? []).slice(0, 2).map((permission) => (
              <span
                key={permission.code}
                className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {permission.code}
              </span>
            ))}
            {(row.original.permission_count ?? 0) > 2 && (
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                +{(row.original.permission_count ?? 0) - 2}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Mô tả',
        cell: ({ row }) => <span className="text-sm text-gray-500">{row.original.description || '—'}</span>,
      },
      {
        accessorKey: 'is_system',
        header: 'Loại',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              row.original.is_system ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
            }`}>
            {row.original.is_system ? 'Hệ thống' : 'Tùy chỉnh'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { frozen: 'right', frozenWidth: 90 },
        cell: ({ row }) => {
          const role = row.original;
          const canEditRole = canUpdateRole && (!role.is_system || isRootUser);
          const canRemoveRole = canDeleteRole && !role.is_system;
          return (
            <div className="flex items-center gap-1">
              <IconBtn
                title={canEditRole ? 'Sửa' : 'Chỉ ROOT mới có thể sửa vai trò hệ thống'}
                onClick={() => openModal('edit', role)}
                disabled={actionLoading || !canEditRole}>
                <Pencil className="size-3.5" />
              </IconBtn>
              <IconBtn
                title={
                  !canDeleteRole
                    ? 'Thiếu quyền role.delete'
                    : role.is_system
                      ? 'Không thể xóa vai trò hệ thống'
                      : deleteConfirmId === role.id
                        ? 'Bấm lần nữa để xác nhận'
                        : 'Xóa'
                }
                onClick={() => handleDelete(role)}
                disabled={actionLoading || !canRemoveRole}
                className={
                  deleteConfirmId === role.id
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'text-red-400 hover:bg-red-50 hover:text-red-600'
                }>
                <Trash2 className="size-3.5" />
              </IconBtn>
            </div>
          );
        },
      },
    ],
    [actionLoading, canDeleteRole, canUpdateRole, deleteConfirmId, handleDelete, isRootUser, openModal],
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-[#002147]">Vai trò</div>
          <p className="mt-1 text-sm text-slate-500">
            Vai trò mô tả nhóm người dùng; quyền và phạm vi xác định họ được làm gì và ở đâu.
          </p>
        </div>
        {canCreateRole && (
          <Button size="sm" variant="navy" onClick={() => openModal('create')}>
            <Plus className="size-4" />
            Vai trò mới
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-4">
          <div className="relative w-80">
            <Input
              type="text"
              placeholder="Lọc vai trò…"
              className="pl-10"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
            />
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        <div className="p-4 pt-0">
          <DataTable
            fixedHeader
            enableFreezeColumns
            columns={columns}
            data={filtered}
            loading={isLoading}
            pagination={pagination}
            onPaginationChange={() => {}}
          />
        </div>
      </div>

      {modal === 'create' && canCreateRole && (
        <RoleFormModal
          title="Vai trò mới"
          permissions={permissions}
          loading={actionLoading}
          error={actionError}
          onClose={closeModal}
          onSubmit={async (data) => {
            const ok = await createRole(data as ICreateRolePayload);
            if (ok) closeModal();
          }}
        />
      )}

      {modal === 'edit' && selected && canUpdateRole && (
        <RoleFormModal
          title="Sửa vai trò"
          permissions={permissions}
          initialValues={{
            name: selected.name,
            description: selected.description ?? '',
            level: selected.level,
            scope_type: selected.scope_type,
            permission_codes: selected.permissions?.map((permission) => permission.code) ?? [],
          }}
          loading={actionLoading}
          error={actionError}
          editMode
          onClose={closeModal}
          onSubmit={async (data) => {
            const ok = await updateRole(selected.id, data as IUpdateRolePayload);
            if (ok) closeModal();
          }}
        />
      )}
    </div>
  );
};

function RoleFormModal({
  title,
  permissions,
  initialValues,
  loading,
  error,
  editMode,
  onClose,
  onSubmit,
}: {
  title: string;
  permissions: IPermission[];
  initialValues?: {
    name?: string;
    description?: string;
    level?: number;
    scope_type?: ScopeType;
    permission_codes?: string[];
  };
  loading: boolean;
  error: string | null;
  editMode?: boolean;
  onClose: () => void;
  onSubmit: (data: ICreateRolePayload | IUpdateRolePayload) => void;
}) {
  const keyFieldId = useId();
  const nameFieldId = useId();
  const descriptionFieldId = useId();
  const levelFieldId = useId();
  const scopeFieldId = useId();
  const [key, setKey] = useState('');
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [level, setLevel] = useState(String(initialValues?.level ?? 40));
  const [scope_type, setScopeType] = useState<ScopeType>(initialValues?.scope_type ?? 'OWN');
  const [permissionCodes, setPermissionCodes] = useState<string[]>(initialValues?.permission_codes ?? []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-4 sm:py-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="my-auto flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="size-4" />
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const payload = {
                name,
                description,
                level: Number(level || 0),
                scope_type: scope_type,
                permission_codes: permissionCodes,
              };
              editMode ? onSubmit(payload) : onSubmit({ key, ...payload });
            }}
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
            {!editMode && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={keyFieldId} className="text-sm font-medium text-gray-700">
                  Mã <span className="text-red-500">*</span>
                </label>
                <Input
                  id={keyFieldId}
                  value={key}
                  onChange={(event) => setKey(event.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  placeholder="VD: DOCUMENT_EDITOR"
                  required
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={nameFieldId} className="text-sm font-medium text-gray-700">
                Tên <span className="text-red-500">*</span>
              </label>
              <Input
                id={nameFieldId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tên hiển thị của vai trò"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={levelFieldId} className="text-sm font-medium text-gray-700">
                  Cấp
                </label>
                <Input
                  id={levelFieldId}
                  type="number"
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={scopeFieldId} className="text-sm font-medium text-gray-700">
                  Loại phạm vi
                </label>
                <select
                  id={scopeFieldId}
                  value={scope_type}
                  onChange={(event) => setScopeType(event.target.value as ScopeType)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001B44]">
                  {(['GLOBAL', 'TENANT', 'ORG_UNIT', 'ORG_UNIT_TREE', 'OWN', 'ASSIGNED', 'PUBLIC'] as ScopeType[]).map(
                    (scope) => (
                      <option key={scope} value={scope}>
                        {scopeLabel(scope)}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={descriptionFieldId} className="text-sm font-medium text-gray-700">
                Mô tả
              </label>
              <Input
                id={descriptionFieldId}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Mô tả tùy chọn"
              />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-gray-700">Quyền</legend>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 p-3 space-y-1.5">
                {permissions.map((permission) => (
                  <label
                    key={permission.id}
                    className="flex items-start gap-2.5 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-gray-300"
                      checked={permissionCodes.includes(permission.code)}
                      onChange={(event) => {
                        setPermissionCodes(
                          event.target.checked
                            ? [...permissionCodes, permission.code]
                            : permissionCodes.filter((c) => c !== permission.code),
                        );
                      }}
                    />
                    <div>
                      <span className="font-mono text-xs font-medium text-gray-700">{permission.code}</span>
                      {permission.name && <span className="ml-1.5 text-xs text-gray-400">· {permission.name}</span>}
                    </div>
                  </label>
                ))}
                {permissions.length === 0 && (
                  <div className="py-4 text-center text-sm text-gray-400">Chưa có quyền khả dụng</div>
                )}
              </div>
              <p className="text-xs text-gray-400">Đã chọn {permissionCodes.length}</p>
            </fieldset>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Button type="button" size="sm" variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" size="sm" variant="navy" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Đang lưu…' : 'Lưu'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

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
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-7 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
}
