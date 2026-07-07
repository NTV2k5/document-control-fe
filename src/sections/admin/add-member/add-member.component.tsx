'use client';

import { AlertCircle, Loader2, Search, UserPlus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  adminAssignUserScopeAPI,
  adminCreateUserAPI,
  adminListUsersAPI,
  type IAdminCreateUserPayload,
  type IAdminUser,
  type IOrganizationUnit,
  type IRole,
  type IUserScopeAssignment,
  type ScopeType,
} from 'reactjs-platform/utilities';

interface IAddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: IOrganizationUnit;
  roles: IRole[];
  rolesLoading?: boolean;
  rolesError?: string | null;
  existingAssignments: IUserScopeAssignment[];
  initialRoleKey?: string | null;
  initialApplyScope?: ApplyScope;
  roleFilterKind?: TRoleFilterKind | null;
  initialUser?: {
    id: string;
    username?: string | null;
    email?: string | null;
  } | null;
  onAssigned: () => void | Promise<void>;
  onRetryRoles?: () => void;
}

type ApplyScope = 'unit' | 'tree';
type View = 'pick' | 'create';
type TRoleFilterKind = 'manager' | 'staff';

const MANAGER_ROLE_KEYS = new Set([
  'ROOT',
  'UNIVERSITY_ADMIN',
  'BOARD_OF_DIRECTORS',
  'DEAN',
  'DEPARTMENT_HEAD',
  'ROLE_MANAGER',
]);

export const AddMemberModal = ({
  isOpen,
  onClose,
  unit,
  roles,
  rolesLoading = false,
  rolesError = null,
  existingAssignments,
  initialRoleKey,
  initialApplyScope = 'unit',
  roleFilterKind,
  initialUser,
  onAssigned,
  onRetryRoles,
}: IAddMemberModalProps) => {
  const roleFieldId = useId();
  const userSearchFieldId = useId();

  const [view, setView] = useState<View>('pick');
  const [user_id, setUserId] = useState('');
  const [role_id, setRoleId] = useState('');
  const [applyScope, setApplyScope] = useState<ApplyScope>('unit');
  const [is_primary, setIsPrimary] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<IAdminUser[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setView('pick');
    setUserId(initialUser?.id ?? '');
    setRoleId('');
    setApplyScope(initialApplyScope);
    setIsPrimary(false);
    setUserSearch('');
    setError(null);
    setNewUser({ first_name: '', last_name: '', username: '', email: '', password: '' });
  }, [initialApplyScope, initialUser?.id, isOpen]);

  const selectedRole = useMemo(() => roles.find((r) => r.id === role_id) ?? null, [roles, role_id]);

  const resolvedScope: ScopeType = useMemo(() => {
    return applyScope === 'tree' ? 'ORG_UNIT_TREE' : 'ORG_UNIT';
  }, [applyScope]);

  const assignableRoles = useMemo(() => {
    const existingRoleIds = new Set(
      initialUser
        ? existingAssignments
            .filter((assignment) => assignment.user_id === initialUser.id)
            .map((assignment) => assignment.role_id)
        : [],
    );
    return roles.filter((role) => {
      const scopedRole =
        role.scope_type === 'TENANT' || role.scope_type === 'ORG_UNIT' || role.scope_type === 'ORG_UNIT_TREE';
      const notAssigned = !existingRoleIds.has(role.id);
      const managerRole = MANAGER_ROLE_KEYS.has(role.key);
      const matchesPreset =
        roleFilterKind === 'manager' ? managerRole : roleFilterKind === 'staff' ? !managerRole : true;
      return scopedRole && notAssigned && matchesPreset;
    });
  }, [existingAssignments, initialUser, roleFilterKind, roles]);

  useEffect(() => {
    if (!isOpen || role_id || !initialRoleKey) return;
    const initialRole = assignableRoles.find((role) => role.key === initialRoleKey);
    if (!initialRole) return;
    setRoleId(initialRole.id);
  }, [assignableRoles, initialRoleKey, isOpen, role_id]);

  // Debounced fetch from BE: filter by exclude_unit_id + search
  useEffect(() => {
    if (!isOpen || view !== 'pick' || initialUser) return;
    const handle = setTimeout(() => {
      setLoadingCandidates(true);
      adminListUsersAPI({
        page: 1,
        page_size: 50,
        search: userSearch.trim() || undefined,
        exclude_unit_id: unit.id,
      })
        .then((res) => setCandidates(res.data))
        .catch(() => setCandidates([]))
        .finally(() => setLoadingCandidates(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [initialUser, isOpen, view, userSearch, unit.id]);

  const candidateUsers = useMemo(() => {
    // Extra guard: if a different role's assignment already exists at this unit,
    // BE still returns the user (exclude_unit_id is per-unit, not per-role).
    // Hide users who already have THIS role here.
    const existingForRole = new Set(existingAssignments.filter((a) => a.role_id === role_id).map((a) => a.user_id));
    return candidates.filter((u) => !existingForRole.has(u.db_user_id ?? u.id));
  }, [candidates, existingAssignments, role_id]);

  if (!isOpen) return null;

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (rolesLoading) {
      setError('Đang tải danh sách vai trò, vui lòng thử lại sau giây lát');
      return;
    }
    if (rolesError) {
      setError(rolesError);
      return;
    }
    if (assignableRoles.length === 0) {
      setError('Không có vai trò phù hợp để thêm vào đơn vị này');
      return;
    }
    if (!role_id) {
      setError('Vui lòng chọn vai trò trước');
      return;
    }
    if (!user_id) {
      setError('Vui lòng chọn người dùng');
      return;
    }
    setSubmitting(true);
    try {
      await adminAssignUserScopeAPI(user_id, {
        role_id: role_id,
        scope_type: resolvedScope,
        organization_unit_id: unit.id,
        is_primary: is_primary,
      });
      await onAssigned();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể thêm thành viên');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      setError('Tên đăng nhập, email và mật khẩu là bắt buộc');
      return;
    }
    setSubmitting(true);
    try {
      const payload: IAdminCreateUserPayload = {
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        first_name: newUser.first_name.trim() || undefined,
        last_name: newUser.last_name.trim() || undefined,
      };
      const created = await adminCreateUserAPI(payload);
      // Re-fetch the (filtered) candidate list so the new user shows up at top
      const refreshed = await adminListUsersAPI({
        page: 1,
        page_size: 50,
        exclude_unit_id: unit.id,
      });
      setCandidates(refreshed.data);
      const match = refreshed.data.find(
        (u) => (u.db_user_id ?? u.id) === created.id || u.username === created.username,
      );
      if (match) {
        setUserId(match.db_user_id ?? match.id);
      }
      setView('pick');
    } catch (err) {
      setError((err as Error).message || 'Không thể tạo người dùng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-4 py-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="my-auto flex w-full max-w-2xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-7 py-5">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-[#002147]">
                {view === 'create' ? 'Tạo người dùng' : 'Thêm thành viên'}
              </h3>
              <p className="mt-1 truncate text-sm text-slate-500">
                {view === 'create' ? (
                  'Sau khi tạo, người dùng sẽ được tự chọn cho đơn vị hiện tại'
                ) : initialUser ? (
                  <>
                    Thêm vai trò cho{' '}
                    <span className="font-medium text-slate-700">{initialUser.username ?? initialUser.email}</span>
                  </>
                ) : (
                  <>
                    Thêm người dùng vào <span className="font-medium text-slate-700">{unit.name}</span>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>

          {error && (
            <div className="border-b border-red-100 bg-red-50 px-7 py-3 text-sm text-red-600">
              <span className="inline-flex items-center gap-2">
                <AlertCircle className="size-4" />
                {error}
              </span>
            </div>
          )}

          {view === 'pick' ? (
            <form onSubmit={handleAssign} className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
              <div className="space-y-2">
                <label htmlFor={roleFieldId} className="text-sm font-medium text-slate-700">
                  Vai trò
                </label>
                <select
                  id={roleFieldId}
                  value={role_id}
                  onChange={(e) => {
                    setRoleId(e.target.value);
                    setApplyScope('unit');
                  }}
                  disabled={rolesLoading || Boolean(rolesError) || assignableRoles.length === 0}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002147]/15">
                  <option value="">
                    {rolesLoading
                      ? 'Đang tải vai trò…'
                      : rolesError
                        ? 'Không tải được vai trò'
                        : assignableRoles.length === 0
                          ? 'Không có vai trò phù hợp'
                          : 'Chọn vai trò…'}
                  </option>
                  {assignableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                {rolesLoading && <p className="text-xs text-slate-500">Đang tải danh sách vai trò…</p>}
                {rolesError && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                    <span>{rolesError}</span>
                    {onRetryRoles && (
                      <button
                        type="button"
                        onClick={onRetryRoles}
                        className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1 font-medium text-red-600 hover:bg-red-50">
                        Tải lại
                      </button>
                    )}
                  </div>
                )}
                {!rolesLoading && !rolesError && roles.length > 0 && assignableRoles.length === 0 && (
                  <p className="text-xs text-slate-500">Không có vai trò phù hợp với nhóm đang thêm.</p>
                )}
                {selectedRole?.description && <p className="text-xs text-slate-500">{selectedRole.description}</p>}
              </div>

              {selectedRole && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="font-medium text-slate-800">
                    Phạm vi quyền: {applyScope === 'tree' ? `${unit.name} + đơn vị con` : unit.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">Hệ thống tự chọn phạm vi theo nhóm bạn đang thêm.</div>
                </div>
              )}

              {!initialUser && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor={userSearchFieldId} className="text-sm font-medium text-slate-700">
                      Người dùng
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setView('create');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#002147] hover:underline">
                      <UserPlus className="size-3.5" />
                      Tạo người dùng
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id={userSearchFieldId}
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Tìm theo tên, tên đăng nhập, email…"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
                    />
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2">
                    {candidateUsers.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-6 text-center">
                        <p className="text-xs text-slate-400">
                          {userSearch ? 'Không có người dùng phù hợp' : 'Không có người dùng khả dụng'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const guess = userSearch.trim();
                            setNewUser((prev) => ({
                              ...prev,
                              username: /@/.test(guess) ? prev.username : guess,
                              email: /@/.test(guess) ? guess : prev.email,
                            }));
                            setError(null);
                            setView('create');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#002147] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#002147]/90">
                          <UserPlus className="size-3.5" />
                          Tạo người dùng {userSearch.trim() ? `"${userSearch.trim()}"` : ''}
                        </button>
                      </div>
                    ) : (
                      candidateUsers.map((u) => {
                        const uid = u.db_user_id ?? u.id;
                        const active = user_id === uid;
                        const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username;
                        return (
                          <button
                            key={uid}
                            type="button"
                            onClick={() => setUserId(uid)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                              active ? 'bg-[#002147] text-white' : 'text-slate-700 hover:bg-slate-100'
                            }`}>
                            <div
                              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                active ? 'bg-white/20 text-white' : 'bg-[#001B44]/10 text-[#001B44]'
                              }`}>
                              {(u.first_name?.[0] ?? u.username[0]).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{name}</div>
                              <div className={`truncate text-xs ${active ? 'text-white/70' : 'text-slate-500'}`}>
                                {u.email}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {initialUser && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="font-semibold text-slate-800">{initialUser.username ?? 'Người dùng đã chọn'}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{initialUser.email ?? initialUser.id}</div>
                </div>
              )}

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={is_primary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="size-4 rounded border-slate-300"
                />
                Đặt làm phân quyền chính của người dùng
              </label>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || rolesLoading || Boolean(rolesError) || assignableRoles.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#002147] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#002147]/90 disabled:opacity-60">
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? 'Đang thêm…' : 'Thêm thành viên'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateUser} className="flex-1 space-y-4 overflow-y-auto px-7 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <InlineField
                  label="Tên"
                  value={newUser.first_name}
                  onChange={(v) => setNewUser((p) => ({ ...p, first_name: v }))}
                  placeholder="An"
                />
                <InlineField
                  label="Họ"
                  value={newUser.last_name}
                  onChange={(v) => setNewUser((p) => ({ ...p, last_name: v }))}
                  placeholder="Nguyễn Văn"
                />
              </div>
              <InlineField
                label="Tên đăng nhập *"
                value={newUser.username}
                onChange={(v) => setNewUser((p) => ({ ...p, username: v }))}
                placeholder="nva"
              />
              <InlineField
                label="Email *"
                type="email"
                value={newUser.email}
                onChange={(v) => setNewUser((p) => ({ ...p, email: v }))}
                placeholder="nva@giadinh.edu.vn"
              />
              <InlineField
                label="Mật khẩu *"
                type="password"
                value={newUser.password}
                onChange={(v) => setNewUser((p) => ({ ...p, password: v }))}
                placeholder="••••••••"
              />

              <div className="flex justify-between gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setView('pick');
                  }}
                  disabled={submitting}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
                  ← Quay lại
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#002147] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#002147]/90 disabled:opacity-60">
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? 'Đang tạo…' : 'Tạo người dùng'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

function InlineField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/15"
      />
    </div>
  );
}
