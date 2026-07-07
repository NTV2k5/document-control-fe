'use client';

import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  Landmark,
  Layers3,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserMinus,
  Users,
  UserPlus,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from 'reactjs-platform/ui';
import {
  adminGetOrganizationUnitAPI,
  adminListOrganizationUnitsAPI,
  adminListRolesAPI,
  adminRemoveUserScopeAPI,
  hasPermission,
  profileStore,
  type IOrganizationUnit,
  type IOrganizationUnitDetail,
  type IRole,
  type IUserScopeAssignment,
  type ScopeType,
} from 'reactjs-platform/utilities';
import { AddMemberModal } from '../add-member';
import { CreateUnitModal } from '../create-unit';
import { DeleteUnitDialog } from '../delete-unit';
import { EditUnitModal } from '../edit-unit';

interface ITreeNode extends IOrganizationUnit {
  children: ITreeNode[];
  depth: number;
}

interface IMemberAssignmentGroup {
  key: string;
  username?: string | null;
  email?: string | null;
  assignments: IUserScopeAssignment[];
}

type TAuthorityGroup = 'manager' | 'staff';

interface IAddMemberPreset {
  roleFilterKind?: TAuthorityGroup | null;
  initialRoleKey?: string | null;
  initialApplyScope?: 'unit' | 'tree';
}

const UNIT_TYPE_ORDER: Record<string, number> = {
  UNIVERSITY: 0,
  CAMPUS: 1,
  FACULTY: 2,
  DEPARTMENT: 3,
  OFFICE: 4,
  CENTER: 5,
  INSTITUTE: 6,
  DIVISION: 7,
  TEAM: 8,
};

const unitTypeRank = (t: string) => UNIT_TYPE_ORDER[t] ?? 99;

const unitTypeIcon = (t: string) => {
  switch (t) {
    case 'UNIVERSITY':
      return GraduationCap;
    case 'CAMPUS':
      return Landmark;
    case 'FACULTY':
      return Building2;
    case 'DEPARTMENT':
    case 'OFFICE':
      return Briefcase;
    case 'INSTITUTE':
      return FlaskConical;
    case 'CENTER':
      return Network;
    case 'DIVISION':
    case 'TEAM':
      return Users;
    default:
      return Building2;
  }
};

const MANAGER_ROLE_KEYS = new Set([
  'ROOT',
  'UNIVERSITY_ADMIN',
  'BOARD_OF_DIRECTORS',
  'DEAN',
  'DEPARTMENT_HEAD',
  'ROLE_MANAGER',
]);

const buildTree = (units: IOrganizationUnit[]): ITreeNode[] => {
  const byId = new Map<string, ITreeNode>();
  units.forEach((u) => byId.set(u.id, { ...u, children: [], depth: 0 }));
  const roots: ITreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      const parent = byId.get(node.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr: ITreeNode[]) => {
    arr.sort(
      (a, b) =>
        unitTypeRank(a.unit_type) - unitTypeRank(b.unit_type) ||
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name),
    );
    arr.forEach((n) => {
      n.children.forEach((c) => (c.depth = n.depth + 1));
      sortRec(n.children);
    });
  };
  sortRec(roots);
  return roots;
};

const scopeLabel = (scope: ScopeType): string =>
  ({
    GLOBAL: 'Toàn hệ thống',
    TENANT: 'Toàn tenant',
    ORG_UNIT: 'Đơn vị này',
    ORG_UNIT_TREE: 'Đơn vị này + đơn vị con',
    OWN: 'Tài nguyên cá nhân',
    ASSIGNED: 'Được chia sẻ cho tôi',
    PUBLIC: 'Công khai',
  })[scope] ?? scope;

const defaultRoleKeyForSection = (unit: IOrganizationUnit, kind: TAuthorityGroup): string => {
  if (kind === 'manager') {
    if (unit.code === 'BAN_GIAM_HIEU') return 'BOARD_OF_DIRECTORS';
    if (unit.unit_type === 'FACULTY') return 'DEAN';
    return 'DEPARTMENT_HEAD';
  }

  if (unit.code === 'PHONG_DAO_TAO') return 'TRAINING_DEPARTMENT_APPROVER';
  return 'DOCUMENT_EDITOR';
};

export const OrgAccessTab = () => {
  const profile = profileStore((s) => s.profile);
  const canAssign = hasPermission(profile, 'user.assign_role');
  const canRevoke = hasPermission(profile, 'user.revoke_role');
  const canCreateUnit = hasPermission(profile, 'organization.create');
  const canEditUnit = hasPermission(profile, 'organization.update');
  const canDeleteUnit = hasPermission(profile, 'organization.delete');

  const [units, setUnits] = useState<IOrganizationUnit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IOrganizationUnitDetail | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchTree, setSearchTree] = useState('');
  const [searchMember, setSearchMember] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addRoleTarget, setAddRoleTarget] = useState<IMemberAssignmentGroup | null>(null);
  const [createUnitParent, setCreateUnitParent] = useState<IOrganizationUnit | null | undefined>(undefined);
  const [editingUnit, setEditingUnit] = useState<IOrganizationUnit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<IOrganizationUnit | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [includeSubtree, setIncludeSubtree] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [roles, setRoles] = useState<IRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [addMemberPreset, setAddMemberPreset] = useState<IAddMemberPreset | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<TAuthorityGroup, boolean>>({
    manager: true,
    staff: false,
  });

  const loadTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const data = await adminListOrganizationUnitsAPI();
      setUnits(data);
      setSelectedId((prev) => prev ?? data.find((u) => !u.parent_id)?.id ?? data[0]?.id ?? null);
    } finally {
      setLoadingTree(false);
    }
  }, []);

  const loadDetail = useCallback(
    async (id: string, subtree = includeSubtree) => {
      setLoadingDetail(true);
      try {
        const data = await adminGetOrganizationUnitAPI(id, { include_subtree: subtree });
        setDetail(data);
      } finally {
        setLoadingDetail(false);
      }
    },
    [includeSubtree],
  );

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    setRolesError(null);
    try {
      const data = await adminListRolesAPI();
      setRoles(data);
    } catch (err) {
      setRoles([]);
      setRolesError((err as Error).message || 'Không thể tải danh sách vai trò');
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    void loadTree();
    void loadRoles();
  }, [loadRoles, loadTree]);

  useEffect(() => {
    if (!addOpen || roles.length > 0 || loadingRoles) return;
    void loadRoles();
  }, [addOpen, loadRoles, loadingRoles, roles.length]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const tree = useMemo(() => buildTree(units), [units]);

  const matches = useCallback(
    (node: ITreeNode): boolean => {
      const q = searchTree.trim().toLowerCase();
      if (!q) return true;
      if (node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q)) return true;
      return node.children.some(matches);
    },
    [searchTree],
  );

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const isExpanded = (id: string, depth: number) => expanded[id] ?? (searchTree.trim() !== '' || depth < 1);

  const renderNode = (node: ITreeNode, ancestorsLastFlag: boolean[] = [], isLast = true) => {
    if (!matches(node)) return null;
    const hasChildren = node.children.length > 0;
    const open = isExpanded(node.id, node.depth);
    const active = node.id === selectedId;
    const Icon = unitTypeIcon(node.unit_type);
    const showMenu = menuOpenId === node.id;

    return (
      <div key={node.id} className={showMenu ? 'relative z-40' : ''}>
        <div
          className={`group relative flex items-center gap-1 rounded-xl pr-2 py-1.5 text-sm transition-colors ${
            active ? 'bg-[#002147] text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
          style={{ paddingLeft: `${8 + node.depth * 18}px` }}>
          {/* Tree connector lines (aligned to parent chevron center: x = 18 + i*18) */}
          {node.depth > 0 && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0">
              {ancestorsLastFlag.map((wasLast, i) => (
                <span
                  key={i}
                  className={`absolute top-0 h-full w-px ${wasLast ? '' : 'bg-slate-200'}`}
                  style={{ left: `${18 + i * 18}px` }}
                />
              ))}
              <span
                className="absolute w-px bg-slate-200"
                style={{
                  left: `${18 + (node.depth - 1) * 18}px`,
                  top: 0,
                  height: isLast ? '50%' : '100%',
                }}
              />
              <span
                className="absolute h-px bg-slate-200"
                style={{
                  left: `${18 + (node.depth - 1) * 18}px`,
                  top: '50%',
                  width: '10px',
                }}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.id)}
            className={`relative z-10 flex size-5 shrink-0 items-center justify-center rounded ${
              hasChildren ? 'hover:bg-black/10' : 'opacity-0'
            }`}>
            <ChevronRight className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setSelectedId(node.id)}
            className="relative z-10 flex min-w-0 flex-1 items-center gap-2 truncate text-left">
            <Icon className={`size-3.5 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
            <span className="truncate font-medium">{node.name}</span>
            {typeof node.assignment_count === 'number' && node.assignment_count > 0 && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                {node.assignment_count}
              </span>
            )}
          </button>
          {canCreateUnit && (
            <button
              type="button"
              title="Thêm đơn vị con"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((p) => ({ ...p, [node.id]: true }));
                setCreateUnitParent(node);
              }}
              className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${
                active ? 'hover:bg-white/20' : 'hover:bg-black/10'
              }`}>
              <Plus className="size-3.5" />
            </button>
          )}
          {(canCreateUnit || canEditUnit || canDeleteUnit) && (
            <DropdownMenu open={showMenu} onOpenChange={(open) => setMenuOpenId(open ? node.id : null)}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Options"
                  onClick={(event) => event.stopPropagation()}
                  className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${
                    active ? 'hover:bg-white/20' : 'hover:bg-black/10'
                  } ${showMenu ? 'opacity-100' : ''}`}>
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
                className="z-[70] w-44 rounded-xl border-slate-200 bg-white p-1 text-sm text-slate-700 shadow-2xl ring-1 ring-black/5">
                {canCreateUnit && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setExpanded((p) => ({ ...p, [node.id]: true }));
                      setCreateUnitParent(node);
                    }}
                    className="cursor-pointer rounded-lg px-3 py-2 focus:bg-slate-50">
                    <Plus className="size-3.5" />
                    Thêm đơn vị con
                  </DropdownMenuItem>
                )}
                {canEditUnit && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditingUnit(node);
                    }}
                    className="cursor-pointer rounded-lg px-3 py-2 focus:bg-slate-50">
                    <Pencil className="size-3.5" />
                    Sửa
                  </DropdownMenuItem>
                )}
                {canDeleteUnit && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setDeletingUnit(node);
                    }}
                    className="cursor-pointer rounded-lg px-3 py-2 text-red-600 focus:bg-red-50 focus:text-red-700">
                    <Trash2 className="size-3.5" />
                    Xóa
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {hasChildren && open && (
          <div>
            {node.children.map((child, idx) =>
              renderNode(child, [...ancestorsLastFlag, isLast], idx === node.children.length - 1),
            )}
          </div>
        )}
      </div>
    );
  };

  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedId), [units, selectedId]);
  const selectedPath = useMemo(() => {
    if (!selectedUnit) return [] as IOrganizationUnit[];
    const chain: IOrganizationUnit[] = [];
    let current: IOrganizationUnit | undefined = selectedUnit;
    while (current) {
      chain.unshift(current);
      current = current.parent_id ? units.find((u) => u.id === current!.parent_id) : undefined;
    }
    return chain;
  }, [selectedUnit, units]);

  const members = useMemo(() => {
    let list = detail?.assignments ?? [];
    if (roleFilter !== 'ALL') {
      list = list.filter((a) => a.role_key === roleFilter);
    }
    const q = searchMember.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        (a.username ?? '').toLowerCase().includes(q) ||
        (a.email ?? '').toLowerCase().includes(q) ||
        (a.role_name ?? '').toLowerCase().includes(q) ||
        (a.role_key ?? '').toLowerCase().includes(q),
    );
  }, [detail, searchMember, roleFilter]);

  const memberGroups = useMemo(() => {
    const groups = new Map<string, IMemberAssignmentGroup>();
    for (const assignment of members) {
      const key = assignment.user_id || assignment.email || assignment.username || assignment.id;
      const current = groups.get(key);
      if (current) {
        current.assignments.push(assignment);
      } else {
        groups.set(key, {
          key,
          username: assignment.username,
          email: assignment.email,
          assignments: [assignment],
        });
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      const primaryA = a.assignments.some((assignment) => assignment.is_primary) ? 0 : 1;
      const primaryB = b.assignments.some((assignment) => assignment.is_primary) ? 0 : 1;
      if (primaryA !== primaryB) return primaryA - primaryB;
      return (a.username ?? a.email ?? '').localeCompare(b.username ?? b.email ?? '');
    });
  }, [members]);

  const selectedUnitUserCount = useMemo(() => {
    const ids = new Set(
      (detail?.assignments ?? []).map((assignment) => assignment.user_id || assignment.email || assignment.username),
    );
    return ids.size;
  }, [detail]);

  const authorityGroups = useMemo(() => {
    const managers: IMemberAssignmentGroup[] = [];
    const staff: IMemberAssignmentGroup[] = [];

    for (const group of memberGroups) {
      const isManager = group.assignments.some(
        (assignment) => assignment.role_key && MANAGER_ROLE_KEYS.has(assignment.role_key),
      );
      if (isManager) {
        managers.push(group);
      } else {
        staff.push(group);
      }
    }

    return { managers, staff };
  }, [memberGroups]);

  const roleOptions = useMemo(() => {
    const present = new Set<string>();
    for (const a of detail?.assignments ?? []) {
      if (a.role_key) present.add(a.role_key);
    }
    return roles.filter((r) => present.has(r.key));
  }, [detail, roles]);

  const handleRevoke = async (assignment: IUserScopeAssignment) => {
    if (revokingId === assignment.id) return;
    setRevokingId(assignment.id);
    // Optimistic: drop assignment from detail + decrement tree count locally.
    setDetail((prev) =>
      prev ? { ...prev, assignments: prev.assignments.filter((a) => a.id !== assignment.id) } : prev,
    );
    setUnits((prev) =>
      prev.map((u) =>
        u.id === assignment.organization_unit_id
          ? { ...u, assignment_count: Math.max(0, (u.assignment_count ?? 0) - 1) }
          : u,
      ),
    );
    try {
      await adminRemoveUserScopeAPI(assignment.user_id, assignment.id);
    } catch {
      // Rollback by re-fetching the affected slices on failure only.
      if (selectedId) await loadDetail(selectedId);
      await loadTree();
    } finally {
      setRevokingId(null);
    }
  };

  const handleRemoveUserFromUnit = async (group: IMemberAssignmentGroup) => {
    const removableAssignments = group.assignments.filter((assignment) => !assignment.inherited_from_unit_id);
    if (!removableAssignments.length) return;
    const ok = window.confirm(
      `Xóa ${group.username ?? group.email ?? 'người dùng này'} khỏi ${selectedUnit?.name ?? 'đơn vị này'}?`,
    );
    if (!ok) return;

    setRevokingId(group.key);
    try {
      await Promise.all(
        removableAssignments.map((assignment) => adminRemoveUserScopeAPI(assignment.user_id, assignment.id)),
      );
      if (selectedId) await loadDetail(selectedId);
      await loadTree();
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="flex min-h-[640px]">
      {/* Left: Org Tree */}
      <aside className="w-80 shrink-0 border-r border-slate-100 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers3 className="size-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">Tổ chức</h3>
          </div>
          {canCreateUnit && (
            <button
              type="button"
              title="Thêm đơn vị cấp cao nhất"
              onClick={() => setCreateUnitParent(null)}
              className="flex size-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              <Plus className="size-3.5" />
            </button>
          )}
        </div>
        <div className="relative mb-3">
          <Input
            value={searchTree}
            onChange={(e) => setSearchTree(e.target.value)}
            placeholder="Tìm đơn vị..."
            className="h-9 rounded-xl border-slate-200 pl-8 text-sm"
          />
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="max-h-[560px] overflow-auto pr-1">
          {loadingTree ? (
            <div className="py-8 text-center text-xs text-slate-400">Đang tải…</div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-xs text-slate-400">Chưa có đơn vị</p>
              {canCreateUnit && (
                <button
                  type="button"
                  onClick={() => setCreateUnitParent(null)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#002147] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#002147]/90">
                  <Plus className="size-3.5" />
                  Tạo đơn vị đầu tiên
                </button>
              )}
            </div>
          ) : (
            tree.map((node, idx) => renderNode(node, [], idx === tree.length - 1))
          )}
        </div>
      </aside>

      {/* Right: Unit Detail */}
      <main className="min-w-0 flex-1 p-6">
        {!selectedUnit ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Chọn một đơn vị để xem thành viên
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  {selectedPath.map((p, i) => (
                    <span key={p.id} className="flex items-center gap-1">
                      {i > 0 && <span>›</span>}
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={`hover:text-slate-700 ${p.id === selectedUnit.id ? 'font-semibold text-slate-700' : ''}`}>
                        {p.name}
                      </button>
                    </span>
                  ))}
                </div>
                <h2 className="mt-2 text-2xl font-bold text-[#002147]">{selectedUnit.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedUnit.unit_type} · {selectedUnit.code} · {selectedUnitUserCount} người dùng ·{' '}
                  {detail?.assignments.length ?? 0} phân quyền vai trò
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canCreateUnit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 rounded-xl px-4"
                    onClick={() => setCreateUnitParent(selectedUnit)}>
                    <Plus className="size-4" />
                    Thêm đơn vị con
                  </Button>
                )}
                {canAssign && (
                  <Button
                    size="sm"
                    variant="navy"
                    className="h-10 rounded-xl px-4"
                    onClick={() => {
                      setAddRoleTarget(null);
                      setAddMemberPreset(null);
                      setAddOpen(true);
                    }}>
                    <UserPlus className="size-4" />
                    Thêm thành viên
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="relative max-w-md flex-1">
                  <Input
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder="Tìm theo tên, email, vai trò..."
                    className="h-10 rounded-xl border-slate-200 pl-9 text-sm"
                  />
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={includeSubtree}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setIncludeSubtree(next);
                      if (selectedId) void loadDetail(selectedId, next);
                    }}
                    className="size-4 rounded border-slate-300"
                  />
                  Bao gồm đơn vị con
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002147]/15">
                  <option value="ALL">Tất cả vai trò</option>
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.key}>
                      {r.name ?? r.key}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {loadingDetail ? (
                  <div className="py-12 text-center text-sm text-slate-400">Đang tải thành viên…</div>
                ) : (
                  <div>
                    <MemberSection
                      title="Trưởng / quản lý đơn vị"
                      description="Những người có quyền quản lý hoặc phân công trong đơn vị đang chọn."
                      emptyText="Chưa có trưởng/quản lý đơn vị."
                      groups={authorityGroups.managers}
                      kind="manager"
                      expanded={expandedSections.manager}
                      canAssign={canAssign}
                      canRevoke={canRevoke}
                      revokingId={revokingId}
                      expandedMembers={expandedMembers}
                      onToggleSection={() =>
                        setExpandedSections((current) => ({
                          ...current,
                          manager: !current.manager,
                        }))
                      }
                      onAddRole={(group) => {
                        setAddRoleTarget(group);
                        setAddMemberPreset(null);
                        setAddOpen(true);
                      }}
                      onAddUser={() => {
                        setAddRoleTarget(null);
                        setAddMemberPreset({
                          roleFilterKind: 'manager',
                          initialRoleKey: defaultRoleKeyForSection(selectedUnit, 'manager'),
                          initialApplyScope: 'tree',
                        });
                        setAddOpen(true);
                      }}
                      onRemoveUser={(group) => void handleRemoveUserFromUnit(group)}
                      onToggle={(group) =>
                        setExpandedMembers((current) => ({
                          ...current,
                          [group.key]: !(current[group.key] ?? false),
                        }))
                      }
                      onRevoke={(assignment) => void handleRevoke(assignment)}
                    />
                    <MemberSection
                      title="Nhân sự dưới quyền"
                      description="Các người dùng thuộc đơn vị này, chịu quyền quản lý/phân công của nhóm trưởng/quản lý phía trên."
                      emptyText="Chưa có nhân sự dưới quyền."
                      groups={authorityGroups.staff}
                      kind="staff"
                      expanded={expandedSections.staff}
                      canAssign={canAssign}
                      canRevoke={canRevoke}
                      revokingId={revokingId}
                      expandedMembers={expandedMembers}
                      onToggleSection={() =>
                        setExpandedSections((current) => ({
                          ...current,
                          staff: !current.staff,
                        }))
                      }
                      onAddRole={(group) => {
                        setAddRoleTarget(group);
                        setAddMemberPreset(null);
                        setAddOpen(true);
                      }}
                      onAddUser={() => {
                        setAddRoleTarget(null);
                        setAddMemberPreset({
                          roleFilterKind: 'staff',
                          initialRoleKey: defaultRoleKeyForSection(selectedUnit, 'staff'),
                          initialApplyScope: 'unit',
                        });
                        setAddOpen(true);
                      }}
                      onRemoveUser={(group) => void handleRemoveUserFromUnit(group)}
                      onToggle={(group) =>
                        setExpandedMembers((current) => ({
                          ...current,
                          [group.key]: !(current[group.key] ?? false),
                        }))
                      }
                      onRevoke={(assignment) => void handleRevoke(assignment)}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {selectedUnit && (
        <AddMemberModal
          isOpen={addOpen}
          onClose={() => {
            setAddOpen(false);
            setAddRoleTarget(null);
            setAddMemberPreset(null);
          }}
          unit={selectedUnit}
          roles={roles}
          rolesLoading={loadingRoles}
          rolesError={rolesError}
          existingAssignments={detail?.assignments ?? []}
          initialRoleKey={addMemberPreset?.initialRoleKey ?? null}
          initialApplyScope={addMemberPreset?.initialApplyScope ?? 'unit'}
          roleFilterKind={addMemberPreset?.roleFilterKind ?? null}
          initialUser={
            addRoleTarget
              ? {
                  id: addRoleTarget.key,
                  username: addRoleTarget.username,
                  email: addRoleTarget.email,
                }
              : null
          }
          onAssigned={async () => {
            if (selectedId) await loadDetail(selectedId);
            await loadTree();
          }}
          onRetryRoles={() => void loadRoles()}
        />
      )}

      <CreateUnitModal
        isOpen={createUnitParent !== undefined}
        onClose={() => setCreateUnitParent(undefined)}
        parent={createUnitParent ?? null}
        onCreated={async (unitId) => {
          await loadTree();
          setSelectedId(unitId);
          if (createUnitParent) {
            setExpanded((p) => ({ ...p, [createUnitParent.id]: true }));
          }
        }}
      />

      <EditUnitModal
        isOpen={!!editingUnit}
        unit={editingUnit}
        onClose={() => setEditingUnit(null)}
        onUpdated={async (updated) => {
          await loadTree();
          if (selectedId === updated.id) await loadDetail(updated.id);
        }}
      />

      <DeleteUnitDialog
        isOpen={!!deletingUnit}
        unit={deletingUnit}
        onClose={() => setDeletingUnit(null)}
        onDeleted={async () => {
          const wasSelected = deletingUnit?.id === selectedId;
          await loadTree();
          if (wasSelected) {
            setSelectedId(null);
            setDetail(null);
          }
        }}
      />
    </div>
  );
};

function MemberSection({
  title,
  description,
  emptyText,
  groups,
  kind,
  expanded,
  canAssign,
  canRevoke,
  revokingId,
  expandedMembers,
  onToggleSection,
  onAddUser,
  onAddRole,
  onRemoveUser,
  onToggle,
  onRevoke,
}: {
  title: string;
  description: string;
  emptyText: string;
  groups: IMemberAssignmentGroup[];
  kind: TAuthorityGroup;
  expanded: boolean;
  canAssign: boolean;
  canRevoke: boolean;
  revokingId: string | null;
  expandedMembers: Record<string, boolean>;
  onToggleSection: () => void;
  onAddUser: () => void;
  onAddRole: (group: IMemberAssignmentGroup) => void;
  onRemoveUser: (group: IMemberAssignmentGroup) => void;
  onToggle: (group: IMemberAssignmentGroup) => void;
  onRevoke: (assignment: IUserScopeAssignment) => void;
}) {
  return (
    <section className="border-b border-slate-100 last:border-b-0">
      <div
        className={`flex w-full items-center justify-between gap-3 px-5 py-3 ${kind === 'manager' ? 'bg-blue-50/70' : 'bg-slate-50/70'}`}>
        <button type="button" onClick={onToggleSection} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {kind === 'manager' ? (
                <ShieldCheck className="size-4 text-[#002147]" />
              ) : (
                <Users className="size-4 text-slate-500" />
              )}
              {title}
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
              {groups.length} người dùng
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{description}</div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {canAssign && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAddUser();
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                kind === 'manager'
                  ? 'border-blue-200 bg-white text-[#002147] hover:bg-blue-50'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}>
              <UserPlus className="size-3.5" />
              {kind === 'manager' ? 'Thêm quản lý' : 'Thêm người dùng'}
            </button>
          )}
          <button type="button" onClick={onToggleSection} className="rounded-lg p-1 transition hover:bg-black/5">
            {expanded ? (
              <ChevronDown className="size-4 text-slate-400" />
            ) : (
              <ChevronRight className="size-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>
      {!expanded ? null : groups.length === 0 ? (
        <div className="px-5 py-6 text-sm text-slate-400">{emptyText}</div>
      ) : (
        <ul
          className={`divide-y divide-slate-100 ${kind === 'staff' ? 'relative ml-8 border-l border-slate-200' : ''}`}>
          {groups.map((group) => (
            <MemberGroupRow
              key={group.key}
              group={group}
              kind={kind}
              canRevoke={canRevoke}
              revokingId={revokingId}
              expanded={expandedMembers[group.key] ?? false}
              onAddRole={() => onAddRole(group)}
              onRemoveUser={() => onRemoveUser(group)}
              onToggle={() => onToggle(group)}
              onRevoke={onRevoke}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberGroupRow({
  group,
  kind,
  canRevoke,
  revokingId,
  expanded,
  onAddRole,
  onRemoveUser,
  onToggle,
  onRevoke,
}: {
  group: IMemberAssignmentGroup;
  kind: TAuthorityGroup;
  canRevoke: boolean;
  revokingId: string | null;
  expanded: boolean;
  onAddRole: () => void;
  onRemoveUser: () => void;
  onToggle: () => void;
  onRevoke: (assignment: IUserScopeAssignment) => void;
}) {
  const initials = (group.username?.[0] ?? group.email?.[0] ?? '?').toUpperCase();
  const primaryAssignment = group.assignments.find((assignment) => assignment.is_primary);
  const primaryScope = primaryAssignment?.scope_type ?? group.assignments[0]?.scope_type;
  return (
    <li>
      <div
        className={`relative flex w-full items-center gap-4 py-4 pr-5 text-left transition ${
          kind === 'manager' ? 'bg-white px-5 hover:bg-blue-50/50' : 'pl-8 hover:bg-slate-50'
        }`}>
        {kind === 'staff' && <span className="absolute left-0 top-1/2 h-px w-5 bg-slate-200" aria-hidden />}
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              kind === 'manager' ? 'bg-[#002147] text-white' : 'bg-[#001B44]/10 text-[#001B44]'
            }`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate font-semibold text-slate-900">{group.username ?? '—'}</div>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  kind === 'manager' ? 'bg-blue-100 text-[#002147]' : 'bg-slate-100 text-slate-600'
                }`}>
                {kind === 'manager' ? 'Trưởng/quản lý' : 'Dưới quyền'}
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {group.assignments.length} vai trò
              </span>
              {primaryScope && (
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  {scopeLabel(primaryScope)}
                </span>
              )}
              {primaryAssignment?.is_primary && (
                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Chính
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-500">{group.email ?? '—'}</div>
          </div>
          <div className="hidden min-w-0 flex-1 flex-wrap justify-end gap-1 md:flex">
            {group.assignments.slice(0, 3).map((assignment) => (
              <span
                key={assignment.id}
                className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                {assignment.role_name ?? assignment.role_key ?? '—'}
              </span>
            ))}
            {group.assignments.length > 3 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                +{group.assignments.length - 3}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-slate-400" />
          )}
        </button>
        {canRevoke && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onAddRole}
              title="Thêm vai trò cho người dùng này"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#002147] transition hover:bg-blue-50">
              <UserCog className="size-3.5" />
              Thêm vai trò
            </button>
            <button
              type="button"
              onClick={onRemoveUser}
              disabled={revokingId === group.key}
              title="Xóa người dùng khỏi đơn vị này"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
              <UserMinus className="size-3.5" />
              Xóa người dùng
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className={`border-t border-slate-100 bg-slate-50/70 py-3 pr-5 ${kind === 'manager' ? 'px-5' : 'pl-14'}`}>
          <div className="ml-14 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {group.assignments.map((assignment) => {
              const inherited = Boolean(assignment.inherited_from_unit_id);
              return (
                <div
                  key={assignment.id}
                  className="grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_220px_120px]">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">
                      {assignment.role_name ?? assignment.role_key ?? '—'}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-xs text-slate-400">{assignment.role_key}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
                      {scopeLabel(assignment.scope_type)}
                    </span>
                    {assignment.is_primary && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-700">Chính</span>
                    )}
                    {inherited && (
                      <span
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600"
                        title={`Kế thừa từ ${assignment.inherited_from_unit_name ?? 'đơn vị con'}`}>
                        từ {assignment.inherited_from_unit_name ?? 'đơn vị con'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end">
                    {canRevoke && !inherited && (
                      <button
                        type="button"
                        onClick={() => onRevoke(assignment)}
                        disabled={revokingId === assignment.id}
                        title="Xóa vai trò khỏi đơn vị"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                        <Trash2 className="size-3.5" />
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}
