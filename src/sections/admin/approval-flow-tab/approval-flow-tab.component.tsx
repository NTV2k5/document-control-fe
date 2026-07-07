import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  GitBranch,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'reactjs-platform/ui';
import {
  adminGetOrganizationUnitAPI,
  adminListOrganizationUnitsAPI,
  adminListRolesAPI,
  type IOrganizationUnit,
  type IOrganizationUnitDetail,
  type IRole,
  type IUserScopeAssignment,
} from 'reactjs-platform/utilities';
import {
  getMetadataByKeyAPI,
  listDocumentApprovalFlowsAPI,
  saveDocumentApprovalFlowAPI,
  type DocumentStatus,
  type IDocumentApprovalFlow,
  type IDocumentApprovalFlowAction,
  type IDocumentApprovalFlowStep,
  type MetadataOption,
} from 'api';
import { Toast, type ToastProps } from '../../../components';

type TUnitStrategy = 'SUBMITTER_PRIMARY_UNIT' | 'FIXED_ORG_UNIT' | 'TENANT';
type TStepType = 'SUBMIT' | 'REVIEW' | 'PUBLISH';

type TBusinessStep = IDocumentApprovalFlowStep & {
  is_assignable?: boolean;
  actor_roles?: string[];
  step_type?: TStepType;
};

const ROLE_OPTIONS = [
  { value: 'PROGRAM_DIRECTOR', label: 'Giám đốc chương trình' },
  { value: 'DEAN', label: 'Trưởng khoa' },
  { value: 'DEPARTMENT_HEAD', label: 'Trưởng phòng / trưởng đơn vị' },
  { value: 'TRAINING_DEPARTMENT_APPROVER', label: 'Người duyệt Phòng Đào tạo' },
  { value: 'BOARD_OF_DIRECTORS', label: 'Ban Giám Hiệu' },
  { value: 'RECTOR', label: 'Hiệu trưởng' },
  { value: 'VICE_RECTOR', label: 'Phó hiệu trưởng' },
];

const UNIT_STRATEGY_OPTIONS: Array<{ value: TUnitStrategy; label: string; hint: string }> = [
  {
    value: 'SUBMITTER_PRIMARY_UNIT',
    label: 'Theo đơn vị của người gửi duyệt',
    hint: 'Dùng cho Trưởng khoa, người duyệt cùng đơn vị với người soạn.',
  },
  {
    value: 'FIXED_ORG_UNIT',
    label: 'Chọn một đơn vị cụ thể',
    hint: 'Dùng cho Phòng Đào tạo, Ban Giám Hiệu hoặc đơn vị được chỉ định.',
  },
  {
    value: 'TENANT',
    label: 'Toàn trường',
    hint: 'Dùng khi quyền duyệt không phụ thuộc đơn vị cụ thể.',
  },
];

const STEP_TYPE_OPTIONS: Array<{ value: TStepType; label: string; hint: string }> = [
  {
    value: 'SUBMIT',
    label: 'Gửi duyệt',
    hint: 'Bước đầu tiên: người soạn gửi tài liệu vào luồng.',
  },
  {
    value: 'REVIEW',
    label: 'Duyệt trung gian',
    hint: 'Duyệt xong chuyển sang bước tiếp theo; từ chối trả về người soạn.',
  },
  {
    value: 'PUBLISH',
    label: 'Phê duyệt ban hành',
    hint: 'Bước cuối: duyệt xong approved và chạy tác vụ ban hành.',
  },
];

const AFTER_ACTION_OPTIONS = [
  { value: 'LOCK_DOCUMENT', label: 'Khóa tài liệu' },
  { value: 'EXPORT_PDF', label: 'Xuất PDF' },
  { value: 'DIGITAL_SIGN', label: 'Ký số' },
  { value: 'PUSH_TO_DOCUMENT_CONTROL', label: 'Công khai lên Document Control' },
  { value: 'SYNC_TO_EXTERNAL_SYSTEMS', label: 'Đồng bộ hệ thống ngoài' },
];

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Đã gửi duyệt',
  IN_REVIEW: 'Đang duyệt',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã hủy',
};

const getDocumentStatusLabel = (status?: string | null) => (status ? (DOCUMENT_STATUS_LABELS[status] ?? status) : '—');

const ROLE_LABEL_BY_VALUE = new Map(ROLE_OPTIONS.map((item) => [item.value, item.label]));
const UNIT_STRATEGY_BY_VALUE = new Map(UNIT_STRATEGY_OPTIONS.map((item) => [item.value, item]));

const getStepRoleKeys = (step: IDocumentApprovalFlowStep) => {
  const keys = (step.actor_roles ?? []).filter(Boolean);
  return [...new Set(keys)];
};

const getStepType = (step: IDocumentApprovalFlowStep, index: number, steps: IDocumentApprovalFlowStep[]): TStepType => {
  if (step.step_type) return step.step_type;
  if (index === 0) return 'SUBMIT';
  if (index === steps.length - 1) return 'PUBLISH';
  return 'REVIEW';
};

const STANDARD_FLOW: IDocumentApprovalFlow = {
  template_type: 'CHUONG_TRINH_DAO_TAO',
  label: 'Chương trình đào tạo',
  description: 'Luồng phê duyệt chương trình đào tạo trước khi ban hành chính thức',
  initial_status: 'DRAFT',
  final_status: 'APPROVED',
  is_active: true,
  steps: [
    {
      step_key: 'PROGRAM_DIRECTOR_SUBMIT',
      step_order: 1,
      label: 'Giám đốc chương trình',
      description: 'Người soạn hoàn tất tài liệu và gửi vào luồng duyệt.',
      step_type: 'SUBMIT',
      actor_roles: ['PROGRAM_DIRECTOR'],
      actor_unit_strategy: 'SUBMITTER_PRIMARY_UNIT',
      allowed_actions: [],
    },
    {
      step_key: 'DEAN_REVIEW',
      step_order: 2,
      label: 'Trưởng khoa',
      description: 'Duyệt nội dung thuộc khoa trước khi chuyển Phòng Đào tạo.',
      step_type: 'REVIEW',
      actor_roles: ['DEAN'],
      actor_unit_strategy: 'SUBMITTER_PRIMARY_UNIT',
      allowed_actions: [],
    },
    {
      step_key: 'TRAINING_DEPARTMENT_REVIEW',
      step_order: 3,
      label: 'Phòng Đào tạo',
      description: 'Rà soát chuyên môn, cấu trúc chương trình và quy định đào tạo.',
      step_type: 'REVIEW',
      actor_roles: ['DEPARTMENT_HEAD', 'TRAINING_DEPARTMENT_APPROVER'],
      actor_unit_strategy: 'FIXED_ORG_UNIT',
      actor_unit_code: 'PHONG_DAO_TAO',
      allowed_actions: [],
    },
    {
      step_key: 'BOARD_APPROVAL',
      step_order: 4,
      label: 'Ban Giám Hiệu',
      description: 'Phê duyệt ban hành chính thức.',
      step_type: 'PUBLISH',
      actor_roles: ['BOARD_OF_DIRECTORS'],
      actor_unit_strategy: 'FIXED_ORG_UNIT',
      actor_unit_code: 'BAN_GIAM_HIEU',
      allowed_actions: [],
    },
  ],
};

const cloneFlow = (flow: IDocumentApprovalFlow): IDocumentApprovalFlow => JSON.parse(JSON.stringify(flow));

const createFlowForTemplateType = (template_type: string, label?: string): IDocumentApprovalFlow => ({
  ...cloneFlow(STANDARD_FLOW),
  id: undefined,
  template_type: template_type,
  label: label || template_type,
  description: `Luồng phê duyệt tài liệu ${label || template_type}`,
});

const normalizeStepOrders = (steps: IDocumentApprovalFlowStep[]) =>
  steps.map((step, index) => ({ ...step, step_order: index + 1 }));

const toStepKey = (label: string, order: number) => {
  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return normalized ? `${normalized}_${order}` : `STEP_${order}`;
};

const getRoleLabel = (role?: string | null, roles: IRole[] = []) => {
  if (!role) return 'Chưa chọn vai trò';
  const systemRole = roles.find((item) => item.key === role);
  return systemRole?.name ?? ROLE_LABEL_BY_VALUE.get(role) ?? role;
};

const getStepRoleLabel = (step: IDocumentApprovalFlowStep, roles: IRole[]) => {
  const roleKeys = getStepRoleKeys(step);
  if (!roleKeys.length) return 'Chưa chọn vai trò';
  return roleKeys.map((roleKey) => getRoleLabel(roleKey, roles)).join(' + ');
};

const getUnitStrategyLabel = (step: IDocumentApprovalFlowStep) => {
  const strategy = UNIT_STRATEGY_BY_VALUE.get((step.actor_unit_strategy ?? 'SUBMITTER_PRIMARY_UNIT') as TUnitStrategy);
  if (step.actor_unit_strategy === 'FIXED_ORG_UNIT') {
    return `${strategy?.label ?? 'Cố định đơn vị'}${step.actor_unit_code ? ` · ${step.actor_unit_code}` : ''}`;
  }
  return strategy?.label ?? step.actor_unit_strategy ?? 'Theo đơn vị người gửi duyệt';
};

const getApproveActionKey = (step: IDocumentApprovalFlowStep, isFinalStep: boolean) => {
  if (isFinalStep) return 'APPROVE_RELEASE';
  const roleKeys = getStepRoleKeys(step);
  if (roleKeys.includes('DEAN')) return 'APPROVE_CONTENT';
  if (roleKeys.includes('TRAINING_DEPARTMENT_APPROVER')) return 'APPROVE_PROFESSIONAL';
  return `APPROVE_STEP_${step.step_order}`;
};

const getApproveLabel = (step: IDocumentApprovalFlowStep, isFinalStep: boolean) => {
  if (isFinalStep) return 'Phê duyệt ban hành';
  const roleKeys = getStepRoleKeys(step);
  if (roleKeys.includes('DEAN')) return 'Duyệt nội dung';
  if (roleKeys.includes('TRAINING_DEPARTMENT_APPROVER')) return 'Duyệt chuyên môn';
  return 'Duyệt';
};

const getFromStatus = (index: number): DocumentStatus => {
  if (index === 0) return 'DRAFT';
  if (index === 1) return 'SUBMITTED';
  return 'IN_REVIEW';
};

const findAction = (step: IDocumentApprovalFlowStep, action_key: string) =>
  step.allowed_actions.find((action) => action.action_key === action_key);

const buildActionsForStep = (
  step: TBusinessStep,
  index: number,
  steps: TBusinessStep[],
): IDocumentApprovalFlowAction[] => {
  const nextStep = steps[index + 1] ?? null;
  const stepType = getStepType(step, index, steps);
  const isSubmitStep = stepType === 'SUBMIT';
  const isPublishStep = stepType === 'PUBLISH' || !nextStep;

  if (isSubmitStep) {
    return [
      {
        id: findAction(step, 'SUBMIT')?.id,
        action_key: 'SUBMIT',
        label: 'Gửi duyệt',
        from_status: 'DRAFT',
        to_status: 'SUBMITTED',
        next_step_key: nextStep?.step_key ?? null,
      },
      {
        id: findAction(step, 'CANCEL')?.id,
        action_key: 'CANCEL',
        label: 'Huỷ',
        from_status: 'DRAFT',
        to_status: 'CANCELLED',
        next_step_key: null,
      },
    ];
  }

  const approveActionKey = getApproveActionKey(step, isPublishStep);
  const oldApproveAction = findAction(step, approveActionKey);
  const oldRejectAction = findAction(step, 'REJECT');

  return [
    {
      id: oldApproveAction?.id,
      action_key: approveActionKey,
      label: getApproveLabel(step, isPublishStep),
      from_status: getFromStatus(index),
      to_status: isPublishStep ? 'APPROVED' : 'IN_REVIEW',
      next_step_key: isPublishStep ? null : (nextStep?.step_key ?? null),
      after_actions: isPublishStep
        ? oldApproveAction?.after_actions?.length
          ? oldApproveAction.after_actions
          : AFTER_ACTION_OPTIONS.map((item) => item.value)
        : [],
    },
    {
      id: oldRejectAction?.id,
      action_key: 'REJECT',
      label: 'Từ chối về người soạn',
      from_status: getFromStatus(index),
      to_status: 'REJECTED',
      next_step_key: steps[0]?.step_key ?? null,
    },
  ];
};

const normalizeFlowForSave = (flow: IDocumentApprovalFlow): IDocumentApprovalFlow => {
  const orderedSteps = normalizeStepOrders(flow.steps) as TBusinessStep[];
  return {
    ...flow,
    template_type: flow.template_type.trim(),
    label: flow.label.trim(),
    description: flow.description?.trim() || null,
    initial_status: 'DRAFT',
    final_status: 'APPROVED',
    steps: orderedSteps.map((step, index) => {
      return {
        ...step,
        step_key: step.step_key.trim(),
        label: step.label.trim(),
        description: step.description?.trim() || null,
        step_type: getStepType(step, index, orderedSteps),
        actor_roles: getStepRoleKeys(step),
        actor_unit_strategy: step.actor_unit_strategy ?? 'SUBMITTER_PRIMARY_UNIT',
        actor_unit_code: step.actor_unit_strategy === 'FIXED_ORG_UNIT' ? step.actor_unit_code?.trim() || null : null,
        allowed_actions: buildActionsForStep(step, index, orderedSteps),
      };
    }),
  };
};

const applyStandardFlow = (template_type: string, label?: string) => ({
  ...cloneFlow(STANDARD_FLOW),
  template_type: template_type,
  label: label || 'Chương trình đào tạo',
  description: `Luồng phê duyệt tài liệu ${label || 'Chương trình đào tạo'}`,
});

const getUnitLabel = (code: string | null | undefined, orgUnits: IOrganizationUnit[]) => {
  if (!code) return '';
  const unit = orgUnits.find((item) => item.code === code);
  return unit ? `${unit.name} (${unit.code})` : code;
};

const getStepApproverAssignments = (
  step: IDocumentApprovalFlowStep,
  orgUnits: IOrganizationUnit[],
  unitDetails: Record<string, IOrganizationUnitDetail>,
): IUserScopeAssignment[] => {
  if (step.actor_unit_strategy !== 'FIXED_ORG_UNIT' || !step.actor_unit_code) return [];
  const unit = orgUnits.find((item) => item.code === step.actor_unit_code);
  if (!unit) return [];
  const detail = unitDetails[unit.id];
  if (!detail) return [];
  const roleKeys = new Set(getStepRoleKeys(step));
  if (!roleKeys.size) return [];
  const byUser = new Map<string, IUserScopeAssignment>();
  for (const assignment of detail.assignments) {
    if (!assignment.role_key || !roleKeys.has(assignment.role_key)) continue;
    const key = assignment.user_id || assignment.email || assignment.username || assignment.id;
    if (!byUser.has(key)) byUser.set(key, assignment);
  }
  return Array.from(byUser.values());
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Đã xảy ra lỗi không xác định.';
};

export const ApprovalFlowTab = () => {
  const [flows, setFlows] = useState<IDocumentApprovalFlow[]>([]);
  const [templateTypeOptions, setTemplateTypeOptions] = useState<MetadataOption[]>([]);
  const [selectedTemplateType, setSelectedTemplateType] = useState(STANDARD_FLOW.template_type);
  const [draftFlow, setDraftFlow] = useState<IDocumentApprovalFlow>(() => normalizeFlowForSave(STANDARD_FLOW));
  const [notice, setNotice] = useState<ToastProps | null>(null);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [roles, setRoles] = useState<IRole[]>([]);
  const [orgUnits, setOrgUnits] = useState<IOrganizationUnit[]>([]);
  const [unitDetails, setUnitDetails] = useState<Record<string, IOrganizationUnitDetail>>({});

  const flowByTemplateType = useMemo(
    () => new Map(flows.map((flow): [string, IDocumentApprovalFlow] => [flow.template_type, flow])),
    [flows],
  );

  const currentTemplateLabel = useMemo(
    () => templateTypeOptions.find((option) => option.value === selectedTemplateType)?.label,
    [selectedTemplateType, templateTypeOptions],
  );

  const generatedFlow = useMemo(() => normalizeFlowForSave(draftFlow), [draftFlow]);
  const roleOptions = useMemo(() => {
    const fallbackKeys = new Set(ROLE_OPTIONS.map((role) => role.value));
    const missingFallback = ROLE_OPTIONS.filter(
      (role) => !roles.some((systemRole) => systemRole.key === role.value),
    ).map((role) => ({ key: role.value, name: role.label }));
    return [
      ...roles.map((role) => ({ key: role.key, name: role.name })),
      ...missingFallback.filter((role) => fallbackKeys.has(role.key)),
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [roles]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setNotice(null);
      const [items, metadata, systemRoles, units] = await Promise.all([
        listDocumentApprovalFlowsAPI(),
        getMetadataByKeyAPI<MetadataOption[]>('TEMPLATE_TYPE').catch(() => null),
        adminListRolesAPI().catch(() => []),
        adminListOrganizationUnitsAPI().catch(() => []),
      ]);
      setFlows(items);
      setTemplateTypeOptions(metadata?.meta_values ?? []);
      setRoles(systemRoles);
      setOrgUnits(units);
      const firstTemplateType =
        items[0]?.template_type ?? metadata?.meta_values?.[0]?.value ?? STANDARD_FLOW.template_type;
      const firstLabel = metadata?.meta_values?.find((option) => option.value === firstTemplateType)?.label;
      setSelectedTemplateType(firstTemplateType);
      setDraftFlow(cloneFlow(items[0] ?? createFlowForTemplateType(firstTemplateType, firstLabel)));
    } catch (error: unknown) {
      const message = `Không tải được cấu hình flow: ${getErrorMessage(error)}`;
      setNotice({ message, type: 'error' });
      setToast({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const fixedUnitIds = draftFlow.steps
      .filter((step) => step.actor_unit_strategy === 'FIXED_ORG_UNIT' && step.actor_unit_code)
      .map((step) => orgUnits.find((unit) => unit.code === step.actor_unit_code)?.id)
      .filter((id): id is string => Boolean(id))
      .filter((id) => !unitDetails[id]);

    if (!fixedUnitIds.length) return;
    fixedUnitIds.forEach((id) => {
      adminGetOrganizationUnitAPI(id, { include_subtree: true })
        .then((detail) => setUnitDetails((current) => ({ ...current, [id]: detail })))
        .catch(() => undefined);
    });
  }, [draftFlow.steps, orgUnits, unitDetails]);

  const selectTemplateType = (template_type: string) => {
    const flow = flowByTemplateType.get(template_type);
    const label = templateTypeOptions.find((option) => option.value === template_type)?.label;
    setSelectedTemplateType(template_type);
    setDraftFlow(cloneFlow(flow ?? createFlowForTemplateType(template_type, label)));
    setNotice(null);
  };

  const updateFlow = (patch: Partial<IDocumentApprovalFlow>) => {
    setDraftFlow((current) => ({ ...current, ...patch }));
  };

  const updateStep = (index: number, patch: Partial<TBusinessStep>) => {
    setDraftFlow((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
    }));
  };

  const addStep = () => {
    setDraftFlow((current) => {
      const nextOrder = current.steps.length + 1;
      const step_key = toStepKey('Bước duyệt mới', nextOrder);
      const newStep: TBusinessStep = {
        step_key: step_key,
        step_order: nextOrder,
        label: 'Bước duyệt mới',
        description: '',
        step_type: 'REVIEW',
        actor_roles: ['TRAINING_DEPARTMENT_APPROVER'],
        actor_unit_strategy: 'SUBMITTER_PRIMARY_UNIT',
        is_assignable: true,
        allowed_actions: [],
      };
      return { ...current, steps: normalizeStepOrders([...current.steps, newStep]) };
    });
  };

  const removeStep = (stepIndex: number) => {
    setDraftFlow((current) => ({
      ...current,
      steps: normalizeStepOrders(current.steps.filter((_, index) => index !== stepIndex)),
    }));
  };

  const moveStep = (stepIndex: number, direction: -1 | 1) => {
    setDraftFlow((current) => {
      const nextIndex = stepIndex + direction;
      if (nextIndex < 0 || nextIndex >= current.steps.length) return current;
      const steps = [...current.steps];
      const [step] = steps.splice(stepIndex, 1);
      steps.splice(nextIndex, 0, step);
      return { ...current, steps: normalizeStepOrders(steps) };
    });
  };

  const useStandardTemplate = () => {
    const nextFlow = applyStandardFlow(selectedTemplateType, currentTemplateLabel);
    setDraftFlow(nextFlow);
    setNotice({
      message: 'Đã áp dụng mẫu chuẩn 4 bước. Kiểm tra lại rồi bấm lưu luồng.',
      type: 'info',
    });
  };

  const save = async () => {
    try {
      setLoading(true);
      setNotice(null);
      const saved = await saveDocumentApprovalFlowAPI(generatedFlow);
      setSelectedTemplateType(saved.template_type);
      setDraftFlow(cloneFlow(saved));
      await loadData();
      const message = 'Đã lưu cấu hình luồng duyệt.';
      setNotice({ message, type: 'success' });
      setToast({ message, type: 'success' });
    } catch (error: unknown) {
      const message = `Không lưu được flow: ${getErrorMessage(error)}`;
      setNotice({ message, type: 'error' });
      setToast({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const templateOptions = [
    ...templateTypeOptions,
    ...flows.map((flow) => ({ value: flow.template_type, label: flow.label })),
  ].filter((option, index, array) => array.findIndex((item) => item.value === option.value) === index);

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <GitBranch className="size-5 text-[#0B2559]" />
            Cấu hình luồng duyệt tài liệu
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Quản trị viên chỉ cần chọn loại tài liệu, các bước duyệt, vai trò xử lý và đơn vị xử lý. Hệ thống tự sinh
            trạng thái, hành động và bước tiếp theo khi lưu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={loading} onClick={useStandardTemplate}>
            <Wand2 className="size-4" />
            Dùng mẫu chuẩn 4 bước
          </Button>
          <Button variant="navy" disabled={loading} onClick={() => void save()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Lưu luồng
          </Button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
          {notice.message}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_minmax(220px,1fr)_120px]">
          <Field label="Loại tài liệu">
            <Select value={selectedTemplateType} onValueChange={selectTemplateType}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue placeholder="Chọn loại tài liệu" />
              </SelectTrigger>
              <SelectContent>
                {templateOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tên luồng duyệt">
            <Input
              value={draftFlow.label}
              onChange={(event) => updateFlow({ label: event.target.value })}
              className="h-10 rounded-lg"
            />
          </Field>
          <Field label="Trạng thái">
            <select
              value={draftFlow.is_active === false ? 'inactive' : 'active'}
              onChange={(event) => updateFlow({ is_active: event.target.value === 'active' })}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#0B2559]">
              <option value="active">Đang bật</option>
              <option value="inactive">Tạm tắt</option>
            </select>
          </Field>
          <Field label="Mô tả" className="lg:col-span-3">
            <Textarea
              value={draftFlow.description ?? ''}
              onChange={(event) => updateFlow({ description: event.target.value })}
              className="min-h-20 rounded-lg"
            />
          </Field>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">Luồng duyệt</div>
                <div className="mt-1 text-sm text-slate-500">
                  Sắp xếp logic theo thứ tự: người soạn gửi duyệt, các cấp duyệt lần lượt, bước cuối ban hành.
                </div>
              </div>
              <Button variant="outline" onClick={addStep}>
                <Plus className="size-4" />
                Thêm bước
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              {draftFlow.steps.map((step, stepIndex) => {
                const generatedStep = generatedFlow.steps[stepIndex];
                const approveAction = generatedStep?.allowed_actions.find(
                  (action) => action.action_key !== 'REJECT' && action.action_key !== 'CANCEL',
                );
                const rejectAction = generatedStep?.allowed_actions.find((action) => action.action_key === 'REJECT');
                const stepType = getStepType(step, stepIndex, draftFlow.steps);
                const isFirstStep = stepType === 'SUBMIT';
                const isFinalStep = stepType === 'PUBLISH' || stepIndex === draftFlow.steps.length - 1;
                const stepRoleKeys = getStepRoleKeys(step);
                const fixedUnitApprovers = getStepApproverAssignments(step, orgUnits, unitDetails);
                const fixedUnitLoaded =
                  step.actor_unit_strategy !== 'FIXED_ORG_UNIT' ||
                  !step.actor_unit_code ||
                  Boolean(unitDetails[orgUnits.find((unit) => unit.code === step.actor_unit_code)?.id ?? '']);
                const fixedUnitMissingApprover =
                  step.actor_unit_strategy === 'FIXED_ORG_UNIT' &&
                  Boolean(step.actor_unit_code) &&
                  fixedUnitLoaded &&
                  fixedUnitApprovers.length === 0;

                return (
                  <section
                    key={`${step.step_key}-${stepIndex}`}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0B2559] text-sm font-semibold text-white">
                          {stepIndex + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold uppercase text-slate-500">
                            {STEP_TYPE_OPTIONS.find((item) => item.value === stepType)?.label ?? 'Bước duyệt'}
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">
                            {step.label || 'Chưa đặt tên bước'}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-white px-2 py-1">{getStepRoleLabel(step, roles)}</span>
                            <span className="rounded-full bg-white px-2 py-1">
                              {step.actor_unit_strategy === 'FIXED_ORG_UNIT'
                                ? `Cố định · ${getUnitLabel(step.actor_unit_code, orgUnits) || 'Chưa chọn đơn vị'}`
                                : getUnitStrategyLabel(step)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <IconButton title="Đưa lên" disabled={stepIndex === 0} onClick={() => moveStep(stepIndex, -1)}>
                          <ArrowUp className="size-4" />
                        </IconButton>
                        <IconButton
                          title="Đưa xuống"
                          disabled={stepIndex === draftFlow.steps.length - 1}
                          onClick={() => moveStep(stepIndex, 1)}>
                          <ArrowDown className="size-4" />
                        </IconButton>
                        <IconButton
                          title="Xoá bước"
                          disabled={draftFlow.steps.length <= 1}
                          onClick={() => removeStep(stepIndex)}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Tên bước">
                        <Input
                          value={step.label}
                          onChange={(event) =>
                            updateStep(stepIndex, {
                              label: event.target.value,
                              step_key: step.step_key || toStepKey(event.target.value, stepIndex + 1),
                            })
                          }
                          className="h-10 rounded-lg"
                        />
                      </Field>
                      <Field label="Loại bước">
                        <Select
                          value={stepType}
                          onValueChange={(value) => updateStep(stepIndex, { step_type: value as TStepType })}>
                          <SelectTrigger className="h-10 rounded-lg">
                            <SelectValue placeholder="Chọn loại bước" />
                          </SelectTrigger>
                          <SelectContent>
                            {STEP_TYPE_OPTIONS.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Vai trò xử lý">
                        <Select
                          value={getStepRoleKeys(step)[0] ?? ''}
                          onValueChange={(value) =>
                            updateStep(stepIndex, {
                              actor_roles: [value],
                            })
                          }>
                          <SelectTrigger className="h-10 rounded-lg">
                            <SelectValue placeholder="Chọn vai trò" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role.key} value={role.key}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Phạm vi tìm người duyệt">
                        <Select
                          value={step.actor_unit_strategy ?? 'SUBMITTER_PRIMARY_UNIT'}
                          onValueChange={(value) =>
                            updateStep(stepIndex, {
                              actor_unit_strategy: value as TUnitStrategy,
                              actor_unit_code: value === 'FIXED_ORG_UNIT' ? step.actor_unit_code : null,
                            })
                          }>
                          <SelectTrigger className="h-10 rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_STRATEGY_OPTIONS.map((strategy) => (
                              <SelectItem key={strategy.value} value={strategy.value}>
                                {strategy.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      {step.actor_unit_strategy === 'FIXED_ORG_UNIT' && (
                        <Field label="Đơn vị cụ thể">
                          <select
                            value={step.actor_unit_code ?? ''}
                            onChange={(event) => updateStep(stepIndex, { actor_unit_code: event.target.value || null })}
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#0B2559]">
                            <option value="">Chọn đơn vị</option>
                            {orgUnits.map((unit) => (
                              <option key={unit.id} value={unit.code}>
                                {unit.name} ({unit.code})
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                      <Field label="Mô tả bước" className="md:col-span-2 xl:col-span-3">
                        <Input
                          value={step.description ?? ''}
                          onChange={(event) => updateStep(stepIndex, { description: event.target.value })}
                          className="h-10 rounded-lg"
                        />
                      </Field>
                      <label className="flex h-10 items-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={(step as TBusinessStep).is_assignable !== false}
                          onChange={(event) => updateStep(stepIndex, { is_assignable: event.target.checked })}
                          className="size-4 accent-[#0B2559]"
                        />
                        Cho phép phân công lại
                      </label>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Vai trò được phép xử lý bước này
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {roleOptions.map((role) => (
                          <label
                            key={role.key}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              aria-label={`Cho phép vai trò ${role.name} xử lý bước này`}
                              checked={stepRoleKeys.includes(role.key)}
                              onChange={(event) => {
                                const nextRoleKeys = event.target.checked
                                  ? [...new Set([...stepRoleKeys, role.key])]
                                  : stepRoleKeys.filter((roleKey) => roleKey !== role.key);
                                updateStep(stepIndex, {
                                  actor_roles: nextRoleKeys,
                                });
                              }}
                              className="size-4 accent-[#0B2559]"
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{role.name}</span>
                              <span className="block truncate text-xs text-slate-400">{role.key}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      {step.label.toLowerCase().includes('phòng đào tạo') && (
                        <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                          Phòng Đào tạo nên chọn cả Trưởng phòng và Người duyệt Phòng Đào tạo để trưởng phòng tự duyệt
                          được, đồng thời vẫn phân công chuyên viên duyệt chuyên môn được.
                        </div>
                      )}
                    </div>

                    <ApproverPreview
                      step={step}
                      roles={roles}
                      orgUnits={orgUnits}
                      approvers={fixedUnitApprovers}
                      loaded={fixedUnitLoaded}
                      hasWarning={fixedUnitMissingApprover}
                    />

                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        Hành động người duyệt sẽ thấy
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <ActionPreview
                          title={isFirstStep ? 'Gửi duyệt' : approveAction?.label || 'Duyệt'}
                          description={
                            isFirstStep
                              ? `Chuyển tài liệu sang ${draftFlow.steps[1]?.label ?? 'bước tiếp theo'}.`
                              : approveAction?.next_step_key
                                ? `Duyệt xong chuyển sang ${draftFlow.steps.find((item) => item.step_key === approveAction.next_step_key)?.label ?? approveAction.next_step_key}.`
                                : 'Duyệt xong kết thúc flow và ban hành tài liệu.'
                          }
                          tone="success"
                        />
                        <ActionPreview
                          title={isFirstStep ? 'Huỷ' : rejectAction?.label || 'Từ chối về người soạn'}
                          description={
                            isFirstStep
                              ? 'Huỷ tài liệu khi còn nháp.'
                              : 'Tài liệu về trạng thái bị từ chối, người soạn chỉnh lại rồi gửi duyệt lại từ đầu.'
                          }
                          tone="warning"
                        />
                      </div>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                          Khi duyệt:{' '}
                          <span className="font-semibold text-slate-900">
                            {getDocumentStatusLabel(approveAction?.from_status)} →{' '}
                            {getDocumentStatusLabel(approveAction?.to_status)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
                          Khi từ chối:{' '}
                          <span className="font-semibold text-slate-900">
                            {getDocumentStatusLabel(rejectAction?.from_status)} →{' '}
                            {getDocumentStatusLabel(
                              rejectAction?.to_status ?? (isFirstStep ? 'CANCELLED' : 'REJECTED'),
                            )}
                          </span>
                        </div>
                      </div>

                      {isFinalStep && (
                        <div className="mt-4">
                          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Sau khi ban hành</div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {AFTER_ACTION_OPTIONS.map((action) => {
                              const oldApproveAction = step.allowed_actions.find(
                                (item) => item.action_key === 'APPROVE_RELEASE',
                              );
                              const checked = oldApproveAction
                                ? (oldApproveAction.after_actions ?? []).includes(action.value)
                                : true;
                              return (
                                <label
                                  key={action.value}
                                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                      const current = oldApproveAction
                                        ? (oldApproveAction.after_actions ?? [])
                                        : AFTER_ACTION_OPTIONS.map((item) => item.value);
                                      const next = event.target.checked
                                        ? [...new Set([...current, action.value])]
                                        : current.filter((item) => item !== action.value);
                                      updateStep(stepIndex, {
                                        allowed_actions: [
                                          ...step.allowed_actions.filter(
                                            (item) => item.action_key !== 'APPROVE_RELEASE',
                                          ),
                                          {
                                            action_key: 'APPROVE_RELEASE',
                                            label: 'Phê duyệt ban hành',
                                            from_status: getFromStatus(stepIndex),
                                            to_status: 'APPROVED',
                                            next_step_key: null,
                                            after_actions: next,
                                          },
                                        ],
                                      });
                                    }}
                                    className="size-4 accent-[#0B2559]"
                                  />
                                  {action.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setShowAdvanced((current) => !current)}>
              <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Settings2 className="size-4 text-slate-500" />
                Kỹ thuật
              </span>
              <span className="text-sm text-slate-500">{showAdvanced ? 'Ẩn JSON' : 'Xem JSON sẽ lưu'}</span>
            </button>
            {showAdvanced && (
              <pre className="mt-4 max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(generatedFlow, null, 2)}
              </pre>
            )}
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Người dùng sẽ thấy</div>
            <div className="mt-4 space-y-4">
              {generatedFlow.steps.map((step, index) => {
                const approveAction = step.allowed_actions.find(
                  (action) => action.action_key !== 'REJECT' && action.action_key !== 'CANCEL',
                );
                return (
                  <div key={`${step.step_key}-preview`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0B2559] text-xs font-semibold text-white">
                        {index + 1}
                      </div>
                      {index < generatedFlow.steps.length - 1 && <div className="mt-2 h-8 w-px bg-slate-200" />}
                    </div>
                    <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">{step.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{getStepRoleLabel(step, roles)}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <span>{approveAction?.label}</span>
                        {approveAction?.next_step_key && <ArrowRight className="size-3" />}
                        <span>
                          {approveAction?.next_step_key
                            ? generatedFlow.steps.find((item) => item.step_key === approveAction.next_step_key)?.label
                            : 'Ban hành'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Tóm tắt</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraftFlow(cloneFlow(flowByTemplateType.get(selectedTemplateType) ?? generatedFlow))}>
                <RotateCcw className="size-4" />
                Hoàn tác
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <SummaryItem label="Loại" value={draftFlow.template_type} />
              <SummaryItem label="Số bước" value={String(draftFlow.steps.length)} />
              <SummaryItem label="Bắt đầu" value={getDocumentStatusLabel('DRAFT')} />
              <SummaryItem label="Kết thúc" value={getDocumentStatusLabel('APPROVED')} />
            </div>
          </section>
        </aside>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const Field = ({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) => (
  <label className={`block space-y-1.5 ${className ?? ''}`}>
    <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
    {children}
  </label>
);

const ActionPreview = ({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: 'success' | 'warning';
}) => (
  <div
    className={`rounded-lg px-3 py-2 ${tone === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
    <div className="text-sm font-semibold">{title}</div>
    <div className="mt-1 text-xs leading-5">{description}</div>
  </div>
);

const ApproverPreview = ({
  step,
  roles,
  orgUnits,
  approvers,
  loaded,
  hasWarning,
}: {
  step: IDocumentApprovalFlowStep;
  roles: IRole[];
  orgUnits: IOrganizationUnit[];
  approvers: IUserScopeAssignment[];
  loaded: boolean;
  hasWarning: boolean;
}) => {
  const roleLabel = getStepRoleLabel(step, roles);
  if (step.actor_unit_strategy !== 'FIXED_ORG_UNIT') {
    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">Xem trước người duyệt</div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
          Vai trò <span className="font-semibold text-slate-800">{roleLabel}</span> sẽ được xác định theo khoa/đơn vị
          chính của người gửi khi tài liệu được gửi duyệt.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mt-4 rounded-lg border p-3 ${hasWarning ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        {hasWarning && <AlertTriangle className="size-4 text-amber-600" />}
        Xem trước người duyệt
      </div>
      <div className="mt-2 text-sm text-slate-600">
        Đơn vị:{' '}
        <span className="font-semibold text-slate-800">
          {getUnitLabel(step.actor_unit_code, orgUnits) || 'Chưa chọn đơn vị'}
        </span>
      </div>
      <div className="mt-1 text-sm text-slate-600">
        Vai trò: <span className="font-semibold text-slate-800">{roleLabel}</span>
      </div>
      {!loaded ? (
        <div className="mt-3 text-sm text-slate-500">Đang tải danh sách người duyệt...</div>
      ) : approvers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {approvers.map((assignment) => (
            <span
              key={assignment.id}
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              {assignment.username ?? assignment.email ?? assignment.user_id} ·{' '}
              {assignment.role_name ?? assignment.role_key}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-amber-800">
          Chưa có người dùng nào có vai trò này trong đơn vị đã chọn. Luồng có thể bị kẹt ở bước này.
        </div>
      )}
    </div>
  );
};

const SummaryItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-slate-50 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 break-all text-sm font-semibold text-slate-900">{value}</div>
  </div>
);

const IconButton = ({
  title,
  disabled,
  children,
  onClick,
}: {
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
    {children}
  </button>
);
