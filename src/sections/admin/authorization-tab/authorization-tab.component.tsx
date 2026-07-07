'use client';

import { Button, DataTable, Input, Textarea, type PaginationInfo } from 'reactjs-platform/ui';
import {
  useAdminAuthorization,
  profileStore,
  hasPermission,
  type ICreateOrganizationUnitPayload,
  type ICreatePermissionPayload,
  type IOrganizationUnit,
  type IPermission,
  type IUpdateOrganizationUnitPayload,
  type IUpdatePermissionPayload,
} from 'reactjs-platform/utilities';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  Building2,
  KeyRound,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';

type ModalType = 'createUnit' | 'editUnit' | 'createPermission' | 'editPermission' | null;
type AuthSubTab = 'units' | 'permissions';

export const AuthorizationTab = () => {
  const profile = profileStore((state) => state.profile);
  const canViewOrganization = hasPermission(profile, 'organization.view');
  const canViewPermissionCatalog = hasPermission(profile, 'role.view');
  const canCreateOrganization = hasPermission(profile, 'organization.create');
  const canUpdateOrganization = hasPermission(profile, 'organization.update');
  const canDeleteOrganization = hasPermission(profile, 'organization.delete');
  const canCreatePermission = hasPermission(profile, 'role.create');
  const canUpdatePermission = hasPermission(profile, 'role.update');
  const canDeletePermission = hasPermission(profile, 'role.delete');
  const {
    overview,
    organizationUnits,
    permissions,
    isLoading,
    error,
    actionLoading,
    actionError,
    clearActionError,
    createOrganizationUnit,
    updateOrganizationUnit,
    deleteOrganizationUnit,
    createPermission,
    updatePermission,
    deletePermission,
  } = useAdminAuthorization({
    includeOverview: canViewPermissionCatalog,
    includeOrganizationUnits: canViewOrganization,
    includePermissions: canViewPermissionCatalog,
  });

  const availableSubTabs = useMemo(() => {
    const tabs: { id: AuthSubTab; label: string }[] = [];

    if (canViewOrganization) {
      tabs.push({ id: 'units', label: 'Đơn vị tổ chức' });
    }

    if (canViewPermissionCatalog) {
      tabs.push({ id: 'permissions', label: 'Quyền' });
    }

    return tabs;
  }, [canViewOrganization, canViewPermissionCatalog]);

  const [subTab, setSubTab] = useState<AuthSubTab>(availableSubTabs[0]?.id ?? 'units');
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedUnit, setSelectedUnit] = useState<IOrganizationUnit | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<IPermission | null>(null);
  const [searchText, setSearchText] = useState('');
  const [deleteConfirmUnitId, setDeleteConfirmUnitId] = useState<string | null>(null);
  const [deleteConfirmPermissionId, setDeleteConfirmPermissionId] = useState<string | null>(null);
  const resolvedSubTab = availableSubTabs.some((tab) => tab.id === subTab) ? subTab : (availableSubTabs[0]?.id ?? null);

  const filteredUnits = useMemo(() => {
    if (!searchText.trim()) return organizationUnits;
    const q = searchText.toLowerCase();
    return organizationUnits.filter(
      (unit) =>
        unit.code.toLowerCase().includes(q) ||
        unit.name.toLowerCase().includes(q) ||
        unit.unit_type.toLowerCase().includes(q),
    );
  }, [organizationUnits, searchText]);

  const filteredPermissions = useMemo(() => {
    if (!searchText.trim()) return permissions;
    const q = searchText.toLowerCase();
    return permissions.filter(
      (permission) =>
        permission.code.toLowerCase().includes(q) ||
        permission.name.toLowerCase().includes(q) ||
        (permission.module ?? '').toLowerCase().includes(q),
    );
  }, [permissions, searchText]);

  const pagination = useMemo<PaginationInfo>(
    () => ({
      page: 1,
      page_size: Math.max(filteredUnits.length, filteredPermissions.length, 1),
      total: Math.max(filteredUnits.length, filteredPermissions.length),
      total_pages: 1,
    }),
    [filteredPermissions.length, filteredUnits.length],
  );

  const unitColumns = useMemo<ColumnDef<IOrganizationUnit>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Đơn vị tổ chức',
        cell: ({ row }) => (
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-[#002B5B]/10 p-2 text-[#002B5B]">
              <Building2 className="size-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">{row.original.name}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{row.original.code}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'unit_type',
        header: 'Loại',
        cell: ({ row }) => (
          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {row.original.unit_type}
          </span>
        ),
      },
      {
        accessorKey: 'parent_name',
        header: 'Đơn vị cha',
        cell: ({ row }) => <span className="text-sm text-slate-500">{row.original.parent_name ?? 'Gốc'}</span>,
      },
      {
        accessorKey: 'assignment_count',
        header: 'Phân quyền',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-slate-700">{row.original.assignment_count ?? 0}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { frozen: 'right', frozenWidth: 94 },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <IconBtn
              title="Sửa đơn vị"
              onClick={() => {
                clearActionError();
                setSelectedUnit(row.original);
                setModal('editUnit');
              }}
              disabled={actionLoading || !canUpdateOrganization}>
              <Pencil className="size-3.5" />
            </IconBtn>
            <IconBtn
              title={
                !canDeleteOrganization
                  ? 'Thiếu quyền organization.delete'
                  : deleteConfirmUnitId === row.original.id
                    ? 'Bấm lần nữa để xác nhận'
                    : 'Xóa đơn vị'
              }
              onClick={async () => {
                if (deleteConfirmUnitId !== row.original.id) {
                  setDeleteConfirmUnitId(row.original.id);
                  return;
                }
                const ok = await deleteOrganizationUnit(row.original.id);
                if (ok) setDeleteConfirmUnitId(null);
              }}
              disabled={actionLoading || !canDeleteOrganization}
              className={
                deleteConfirmUnitId === row.original.id
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'text-red-400 hover:bg-red-50 hover:text-red-600'
              }>
              <Trash2 className="size-3.5" />
            </IconBtn>
          </div>
        ),
      },
    ],
    [
      actionLoading,
      canDeleteOrganization,
      canUpdateOrganization,
      clearActionError,
      deleteConfirmUnitId,
      deleteOrganizationUnit,
    ],
  );

  const permissionColumns = useMemo<ColumnDef<IPermission>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Quyền',
        cell: ({ row }) => (
          <div>
            <div className="font-mono text-xs font-semibold text-slate-700">{row.original.code}</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{row.original.name}</div>
          </div>
        ),
      },
      {
        accessorKey: 'module',
        header: 'Mô-đun',
        cell: ({ row }) => <span className="text-sm text-slate-500">{row.original.module ?? 'Chung'}</span>,
      },
      {
        accessorKey: 'role_count',
        header: 'Vai trò',
        cell: ({ row }) => <span className="text-sm font-medium text-slate-700">{row.original.role_count ?? 0}</span>,
      },
      {
        id: 'actions',
        header: 'Thao tác',
        meta: { frozen: 'right', frozenWidth: 94 },
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <IconBtn
              title="Sửa quyền"
              onClick={() => {
                clearActionError();
                setSelectedPermission(row.original);
                setModal('editPermission');
              }}
              disabled={actionLoading || !canUpdatePermission}>
              <Pencil className="size-3.5" />
            </IconBtn>
            <IconBtn
              title={
                !canDeletePermission
                  ? 'Thiếu quyền role.delete'
                  : deleteConfirmPermissionId === row.original.id
                    ? 'Bấm lần nữa để xác nhận'
                    : 'Xóa quyền'
              }
              onClick={async () => {
                if (deleteConfirmPermissionId !== row.original.id) {
                  setDeleteConfirmPermissionId(row.original.id);
                  return;
                }
                const ok = await deletePermission(row.original.id);
                if (ok) setDeleteConfirmPermissionId(null);
              }}
              disabled={actionLoading || !canDeletePermission}
              className={
                deleteConfirmPermissionId === row.original.id
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'text-red-400 hover:bg-red-50 hover:text-red-600'
              }>
              <Trash2 className="size-3.5" />
            </IconBtn>
          </div>
        ),
      },
    ],
    [
      actionLoading,
      canDeletePermission,
      canUpdatePermission,
      clearActionError,
      deleteConfirmPermissionId,
      deletePermission,
    ],
  );

  return (
    <div className="space-y-6 p-6">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-semibold">Không tải được dữ liệu phân quyền</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={<Layers3 className="size-5" />}
          title="Đơn vị"
          value={canViewOrganization ? (overview?.units ?? organizationUnits.length) : '—'}
          tone="bg-sky-50 text-sky-700"
        />
        <SummaryCard
          icon={<KeyRound className="size-5" />}
          title="Quyền"
          value={canViewPermissionCatalog ? (overview?.permissions ?? permissions.length) : '—'}
          tone="bg-violet-50 text-violet-700"
        />
        <SummaryCard
          icon={<Shield className="size-5" />}
          title="Vai trò"
          value={canViewPermissionCatalog ? (overview?.roles ?? 0) : '—'}
          tone="bg-emerald-50 text-emerald-700"
        />
        <SummaryCard
          icon={<Building2 className="size-5" />}
          title="Phân quyền"
          value={canViewPermissionCatalog ? (overview?.assignments ?? 0) : '—'}
          tone="bg-amber-50 text-amber-700"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#002147]">Mô hình phân quyền</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý cây tổ chức và danh mục quyền dùng để gán vào các vai trò.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {resolvedSubTab === 'units' && canCreateOrganization && (
              <Button size="sm" variant="navy" onClick={() => setModal('createUnit')}>
                <Plus className="size-4" />
                Đơn vị mới
              </Button>
            )}
            {resolvedSubTab === 'permissions' && canCreatePermission && (
              <Button size="sm" variant="navy" onClick={() => setModal('createPermission')}>
                <Plus className="size-4" />
                Quyền mới
              </Button>
            )}
          </div>
        </div>

        {/* Sub-tab bar */}
        {availableSubTabs.length > 0 && (
          <div className="flex gap-1 border-b border-slate-100 px-6">
            {availableSubTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  resolvedSubTab === tab.id
                    ? 'border-[#002147] text-[#002147]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Search + errors */}
        <div className="px-6 py-5">
          <div className="relative w-full max-w-md">
            <Input
              type="text"
              placeholder={resolvedSubTab === 'units' ? 'Tìm đơn vị, mã…' : 'Tìm quyền, mô-đun…'}
              className="h-11 rounded-2xl border-slate-200 pl-10"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
          {(error || actionError) && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {actionError ?? error}
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="px-6 pb-6">
          {resolvedSubTab === null && (
            <section className="rounded-3xl border border-slate-200 bg-slate-50/40 p-6 text-sm text-slate-500">
              Bạn không có quyền truy cập danh mục phân quyền.
            </section>
          )}
          {resolvedSubTab === 'units' && (
            <section className="rounded-3xl border border-slate-200 bg-slate-50/40 p-4">
              <p className="mb-3 text-sm text-slate-500">
                Xây dựng cây tổ chức có thể tái sử dụng thay vì cố định theo một phạm vi duy nhất.
              </p>
              <DataTable
                fixedHeader
                enableFreezeColumns
                columns={unitColumns}
                data={filteredUnits}
                loading={isLoading}
                pagination={pagination}
                onPaginationChange={() => {}}
              />
            </section>
          )}
          {resolvedSubTab === 'permissions' && (
            <section className="rounded-3xl border border-slate-200 bg-slate-50/40 p-4">
              <p className="mb-3 text-sm text-slate-500">
                Quyền được giữ ở dạng tổng quát để hệ thống có thể mở rộng cho nhiều quy trình.
              </p>
              <DataTable
                fixedHeader
                enableFreezeColumns
                columns={permissionColumns}
                data={filteredPermissions}
                loading={isLoading}
                pagination={pagination}
                onPaginationChange={() => {}}
              />
            </section>
          )}
        </div>
      </div>

      {modal === 'createUnit' && canCreateOrganization && (
        <OrganizationUnitModal
          title="Tạo đơn vị tổ chức"
          organizationUnits={organizationUnits}
          loading={actionLoading}
          error={actionError}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            const ok = await createOrganizationUnit(payload);
            if (ok) setModal(null);
          }}
        />
      )}

      {modal === 'editUnit' && selectedUnit && canUpdateOrganization && (
        <OrganizationUnitModal
          title="Sửa đơn vị tổ chức"
          organizationUnits={organizationUnits.filter((unit) => unit.id !== selectedUnit.id)}
          loading={actionLoading}
          error={actionError}
          initialValues={{
            name: selectedUnit.name,
            unit_type: selectedUnit.unit_type,
            parent_id: selectedUnit.parent_id ?? undefined,
            sort_order: selectedUnit.sort_order,
            is_active: selectedUnit.is_active,
            metadata: selectedUnit.metadata ? JSON.stringify(selectedUnit.metadata, null, 2) : '',
          }}
          editMode
          onClose={() => {
            setSelectedUnit(null);
            setModal(null);
          }}
          onSubmit={async (payload) => {
            const ok = await updateOrganizationUnit(selectedUnit.id, payload as IUpdateOrganizationUnitPayload);
            if (ok) {
              setSelectedUnit(null);
              setModal(null);
            }
          }}
        />
      )}

      {modal === 'createPermission' && canCreatePermission && (
        <PermissionModal
          title="Tạo quyền"
          loading={actionLoading}
          error={actionError}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            const ok = await createPermission(payload);
            if (ok) setModal(null);
          }}
        />
      )}

      {modal === 'editPermission' && selectedPermission && canUpdatePermission && (
        <PermissionModal
          title="Sửa quyền"
          loading={actionLoading}
          error={actionError}
          initialValues={{
            code: selectedPermission.code,
            name: selectedPermission.name,
            description: selectedPermission.description ?? '',
            module: selectedPermission.module ?? '',
            resource: selectedPermission.resource ?? '',
            action: selectedPermission.action ?? '',
            is_system: selectedPermission.is_system,
          }}
          editMode
          onClose={() => {
            setSelectedPermission(null);
            setModal(null);
          }}
          onSubmit={async (payload) => {
            const ok = await updatePermission(selectedPermission.id, payload as IUpdatePermissionPayload);
            if (ok) {
              setSelectedPermission(null);
              setModal(null);
            }
          }}
        />
      )}
    </div>
  );
};

function SummaryCard({
  icon,
  title,
  value,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-2xl p-3 ${tone}`}>{icon}</div>
      <div className="mt-4 text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-[#002147]">{value}</div>
    </div>
  );
}

function OrganizationUnitModal({
  title,
  organizationUnits,
  loading,
  error,
  initialValues,
  editMode,
  onClose,
  onSubmit,
}: {
  title: string;
  organizationUnits: IOrganizationUnit[];
  loading: boolean;
  error: string | null;
  initialValues?: {
    name?: string;
    unit_type?: string;
    parent_id?: string;
    sort_order?: number;
    is_active?: boolean;
    metadata?: string;
  };
  editMode?: boolean;
  onClose: () => void;
} & (
  | {
      editMode?: false;
      onSubmit: (payload: ICreateOrganizationUnitPayload) => Promise<void>;
    }
  | {
      editMode: true;
      onSubmit: (payload: IUpdateOrganizationUnitPayload) => Promise<void>;
    }
)) {
  const codeId = useId();
  const nameId = useId();
  const typeId = useId();
  const parent_id = useId();
  const sortId = useId();
  const metadataId = useId();

  const [code, setCode] = useState('');
  const [name, setName] = useState(initialValues?.name ?? '');
  const [unit_type, setUnitType] = useState(initialValues?.unit_type ?? '');
  const [parent, setParent] = useState(initialValues?.parent_id ?? 'ROOT');
  const [sort_order, setSortOrder] = useState(String(initialValues?.sort_order ?? 0));
  const [is_active, setIsActive] = useState(initialValues?.is_active ?? true);
  const [metadata, setMetadata] = useState(initialValues?.metadata ?? '');
  const [localError, setLocalError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError('');

    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadata.trim()) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch {
        setLocalError('Metadata phải là JSON hợp lệ');
        return;
      }
    }

    const payload = {
      ...(editMode ? {} : { code: code.trim() }),
      name: name.trim(),
      unit_type: unit_type.trim(),
      parent_id: parent === 'ROOT' ? null : parent,
      sort_order: Number(sort_order || 0),
      is_active: is_active,
      metadata: parsedMetadata,
    };

    if (editMode) {
      await onSubmit(payload as IUpdateOrganizationUnitPayload);
      return;
    }

    await onSubmit(payload as ICreateOrganizationUnitPayload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">
      <div className="flex min-h-full items-center justify-center">
        <div className="my-auto flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-7 py-5">
            <div>
              <div className="text-lg font-semibold text-[#002147]">{title}</div>
              <div className="mt-1 text-sm text-slate-500">
                Dùng loại đơn vị tổng quát để hệ thống có thể mở rộng theo nhiều cây tổ chức.
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={submit} className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
            {(error || localError) && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {localError || error}
              </div>
            )}

            {!editMode && (
              <Field label="Mã" htmlFor={codeId}>
                <Input
                  id={codeId}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="KHOA-CNTT"
                />
              </Field>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tên hiển thị" htmlFor={nameId}>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Khoa Công nghệ thông tin"
                />
              </Field>
              <Field label="Loại đơn vị" htmlFor={typeId}>
                <Input
                  id={typeId}
                  value={unit_type}
                  onChange={(event) => setUnitType(event.target.value)}
                  placeholder="KHOA"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Đơn vị cha" htmlFor={parent_id}>
                <select
                  id={parent_id}
                  value={parent}
                  onChange={(event) => setParent(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002147]/15">
                  <option value="ROOT">Không có đơn vị cha (gốc)</option>
                  {organizationUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.code})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Thứ tự sắp xếp" htmlFor={sortId}>
                <Input
                  id={sortId}
                  type="number"
                  value={sort_order}
                  onChange={(event) => setSortOrder(event.target.value)}
                />
              </Field>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={is_active}
                onChange={(event) => setIsActive(event.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              Đơn vị đang hoạt động và có thể nhận phân quyền
            </label>

            <Field label="Metadata JSON" htmlFor={metadataId}>
              <Textarea
                id={metadataId}
                value={metadata}
                onChange={(event) => setMetadata(event.target.value)}
                rows={6}
                placeholder='{"country":"VN"}'
              />
            </Field>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Hủy
              </Button>
              <Button type="submit" variant="navy" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Đang lưu…' : editMode ? 'Lưu đơn vị' : 'Tạo đơn vị'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PermissionModal({
  title,
  loading,
  error,
  initialValues,
  editMode,
  onClose,
  onSubmit,
}: {
  title: string;
  loading: boolean;
  error: string | null;
  initialValues?: {
    code?: string;
    name?: string;
    description?: string;
    module?: string;
    resource?: string;
    action?: string;
    is_system?: boolean;
  };
  editMode?: boolean;
  onClose: () => void;
} & (
  | {
      editMode?: false;
      onSubmit: (payload: ICreatePermissionPayload) => Promise<void>;
    }
  | {
      editMode: true;
      onSubmit: (payload: IUpdatePermissionPayload) => Promise<void>;
    }
)) {
  const codeId = useId();
  const nameId = useId();
  const moduleId = useId();
  const resourceId = useId();
  const actionId = useId();
  const descriptionId = useId();
  const [code, setCode] = useState(initialValues?.code ?? '');
  const [name, setName] = useState(initialValues?.name ?? '');
  const [moduleValue, setModuleValue] = useState(initialValues?.module ?? '');
  const [resource, setResource] = useState(initialValues?.resource ?? '');
  const [action, setAction] = useState(initialValues?.action ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [is_system, setIsSystem] = useState(initialValues?.is_system ?? true);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      ...(editMode ? {} : { code: code.trim() }),
      name: name.trim(),
      module: moduleValue.trim() || undefined,
      resource: resource.trim() || undefined,
      action: action.trim() || undefined,
      description: description.trim() || undefined,
      is_system: is_system,
    };

    if (editMode) {
      await onSubmit(payload as IUpdatePermissionPayload);
      return;
    }

    await onSubmit(payload as ICreatePermissionPayload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">
      <div className="flex min-h-full items-center justify-center">
        <div className="my-auto flex w-full max-w-2xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-7 py-5">
            <div>
              <div className="text-lg font-semibold text-[#002147]">{title}</div>
              <div className="mt-1 text-sm text-slate-500">
                Giữ mã quyền ổn định vì vai trò và chính sách sẽ tham chiếu đến các mã này.
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={submit} className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            {!editMode && (
              <Field label="Mã quyền" htmlFor={codeId}>
                <Input
                  id={codeId}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="template.approve"
                />
              </Field>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tên hiển thị" htmlFor={nameId}>
                <Input
                  id={nameId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Phê duyệt mẫu"
                />
              </Field>
              <Field label="Mô-đun" htmlFor={moduleId}>
                <Input
                  id={moduleId}
                  value={moduleValue}
                  onChange={(event) => setModuleValue(event.target.value)}
                  placeholder="template"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tài nguyên" htmlFor={resourceId}>
                <Input
                  id={resourceId}
                  value={resource}
                  onChange={(event) => setResource(event.target.value)}
                  placeholder="template"
                />
              </Field>
              <Field label="Hành động" htmlFor={actionId}>
                <Input
                  id={actionId}
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  placeholder="approve"
                />
              </Field>
            </div>

            <Field label="Mô tả" htmlFor={descriptionId}>
              <Textarea
                id={descriptionId}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Giải thích quyền này cho phép làm gì theo ngữ cảnh nghiệp vụ."
              />
            </Field>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={is_system}
                onChange={(event) => setIsSystem(event.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              Đánh dấu đây là quyền hệ thống
            </label>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Hủy
              </Button>
              <Button type="submit" variant="navy" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? 'Đang lưu…' : editMode ? 'Lưu quyền' : 'Tạo quyền'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-8 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 ${className ?? ''}`}>
      {children}
    </button>
  );
}
