import { useNavigate } from '@tanstack/react-router';
import mammoth from 'mammoth';
import {
  CheckCircle2,
  Clock3,
  FileText,
  Home,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ApprovalStatusBadge,
  type FileSelectEvent,
  RejectionDialog,
  Toast,
  type ToastProps,
  UploadModal,
} from '../../components';
import { useTranslation, type TTranslationParams } from '../../i18n';
import { DOCX_EDITOR_RENDERER_VERSION, arrayBufferToBase64, createEditorContentKey, formatDate } from '../../lib';
import { extractPageSize } from '../../models';
import type {
  ITemplatesSectionProps,
  ITemplateStatusOption,
  TTemplateColumn,
  TTemplateRow,
  TTemplatesNavigate,
} from './templates.type';
import {
  approveTemplateAPI,
  applyLabelExpr,
  createTemplateAPI,
  createTemplateNewVersionAPI,
  deleteTemplateAPI,
  duplicateTemplateAPI,
  getMetadataByKeyAPI,
  getTemplateReportSummaryAPI,
  getTemplateTableOptionsAPI,
  listTemplateVisibilityUnitsAPI,
  listTemplatesAPI,
  publishTemplateAPI,
  rejectTemplateAPI,
  returnTemplateToDraftAPI,
  submitTemplateForApprovalAPI,
  uploadArtifactSourceAPI,
  type FilterConfigMetaValues,
  type FilterField,
  type IEntityReportSummary,
  type ITemplateShareRule,
  type MetadataOption,
  type TArtifactType,
  type TemplateStatus,
  type TemplateVisibility,
  unpublishTemplateAPI,
} from 'api';
import {
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SearchableSelect,
  type PaginationInfo,
} from 'reactjs-platform/ui';
import { isAdmin as isAdminProfile, isRootProfile, profileStore, useDebounce } from 'reactjs-platform/utilities';
import type React from 'react';

type Template = TTemplateRow;
type TArtifactFilter = 'ALL' | TArtifactType;
type TTemplateRowAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'return-draft'
  | 'publish'
  | 'unpublish'
  | 'new-version'
  | 'duplicate'
  | 'delete';

const DEFAULT_PAGE_SIZE = 10;

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const getTemplateActionKey = (action: TTemplateRowAction, id: string) => `${action}:${id}`;

type TReportCard = {
  key: string;
  label: string;
  description: string;
  value: number;
  icon: React.ReactNode;
  accentClassName: string;
  active?: boolean;
};

const STATUS_OPTIONS: ITemplateStatusOption[] = [
  { value: 'ALL', label: 'templatesPage.status.all' },
  { value: 'DRAFT', label: 'templatesPage.status.draft' },
  { value: 'SUBMITTED', label: 'templatesPage.status.submitted' },
  { value: 'APPROVAL', label: 'templatesPage.status.approval' },
  { value: 'APPROVED', label: 'templatesPage.status.approved' },
  { value: 'REJECTED', label: 'templatesPage.status.rejected' },
  { value: 'CANCELLED', label: 'templatesPage.status.cancelled' },
];

const ARTIFACT_FORMAT_OPTIONS: Array<{ value: TArtifactFilter; label: string }> = [
  { value: 'ALL', label: 'templatesPage.allFormats' },
  { value: 'rich_text', label: 'templatesPage.artifactFormats.richText' },
  { value: 'spreadsheet', label: 'templatesPage.artifactFormats.spreadsheet' },
  { value: 'presentation', label: 'templatesPage.artifactFormats.presentation' },
  { value: 'image_form', label: 'templatesPage.artifactFormats.imageForm' },
];

const toStatusLabel = (status: string) =>
  ({
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVAL: 'Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  })[status] ?? status;

const ReportCardGrid = ({ cards }: { cards: TReportCard[] }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    {cards.map((card) => (
      <div
        key={card.key}
        className={`rounded-lg border bg-white p-4 shadow-sm ${card.active ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}`}>
        <div className={`mb-3 flex size-10 items-center justify-center rounded-lg border-t-4 ${card.accentClassName}`}>
          {card.icon}
        </div>
        <div className="text-3xl font-bold leading-none text-slate-900">{card.value}</div>
        <div className="mt-2 text-sm font-semibold text-slate-700">{card.label}</div>
        <div className="mt-1 text-xs text-slate-400">{card.description}</div>
      </div>
    ))}
  </div>
);

const getColumns = (
  navigate: TTemplatesNavigate,
  pageOffset: number,
  getTemplateTypeLabel: (template_type?: string | null) => string,
  t: (key: string, params?: TTranslationParams) => string,
  isAdmin: boolean,
  pendingActionKey: string | null,
  onSubmit: (row: TTemplateRow) => Promise<void>,
  onApprove: (row: TTemplateRow) => Promise<void>,
  onReject: (row: TTemplateRow) => void,
  onReturnToDraft: (row: TTemplateRow) => Promise<void>,
  onPublish: (row: TTemplateRow) => Promise<void>,
  onUnpublish: (row: TTemplateRow) => Promise<void>,
  onNewVersion: (row: TTemplateRow) => Promise<void>,
  onDuplicate: (row: TTemplateRow) => Promise<void>,
  onDelete: (row: TTemplateRow) => Promise<void>,
): TTemplateColumn[] => {
  return [
    {
      id: 'no',
      header: t('templatesPage.columns.no'),
      cell: ({ row }) => <span className="text-slate-400">{pageOffset + row.index + 1}</span>,
      meta: { className: 'w-12 min-w-[48px] max-w-[48px] !px-1 text-center' },
    },
    {
      accessorKey: 'name',
      header: t('templatesPage.columns.name'),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 whitespace-normal">
            <button
              type="button"
              onClick={() => navigate({ to: `/templates/${row.original.id}` })}
              className="break-words text-left text-sm font-semibold leading-5 text-[#174A86] transition hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200">
              {row.original.name}
            </button>
            {/* <div className="mt-1 break-words text-xs leading-4 text-slate-400">
              {row.original.source_file_name || row.original.description || '-'}
            </div> */}
          </div>
        </div>
      ),
      meta: { className: 'w-[300px] min-w-[260px] max-w-[340px] whitespace-normal' },
    },
    {
      accessorKey: 'template_type',
      header: t('templatesPage.columns.type'),
      cell: ({ row }) => (
        <span className="inline-flex max-w-[160px] whitespace-normal rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold leading-4 text-emerald-700">
          {getTemplateTypeLabel(row.original.template_type)}
        </span>
      ),
      meta: { className: 'w-[160px] min-w-[140px] max-w-[180px] whitespace-normal' },
    },
    {
      id: 'template_metadata',
      header: t('templatesPage.columns.metadata'),
      cell: ({ row }) => {
        const meta = row.original.template_metadata as
          | Record<string, { value: string; label: string } | string | null | undefined>
          | null
          | undefined;
        if (!meta || Object.keys(meta).length === 0) {
          return <span className="text-xs text-slate-400">—</span>;
        }
        return (
          <div className="flex max-w-[220px] flex-wrap gap-1 whitespace-normal">
            {Object.entries(meta)
              .slice(0, 4)
              .map(([key, entry]) => {
                if (entry == null) return null;
                const display = typeof entry === 'string' ? entry : (entry.label ?? entry.value);
                if (!display) return null;
                return (
                  <span
                    key={key}
                    className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs leading-4 text-slate-600">
                    {display}
                  </span>
                );
              })}
            {Object.keys(meta).length > 4 && (
              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                +{Object.keys(meta).length - 4}
              </span>
            )}
          </div>
        );
      },
      meta: { className: 'w-[220px] min-w-[180px] max-w-[240px] whitespace-normal' },
    },
    {
      accessorKey: 'version',
      header: t('templatesPage.columns.version'),
      cell: ({ row }) => (
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          v{row.original.version}
        </span>
      ),
      meta: { className: 'w-[95px] min-w-[90px] max-w-[110px] text-center' },
    },
    {
      id: 'created_by',
      header: t('templatesPage.columns.created_by'),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
            {(row.original.createdByDisplay || row.original.created_by || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 whitespace-normal">
            <div className="break-words text-sm font-semibold leading-5 text-slate-900">
              {row.original.createdByDisplay || row.original.created_by || '-'}
            </div>
            <div className="text-xs text-slate-500">{t('templatesPage.columns.created_by')}</div>
          </div>
        </div>
      ),
      meta: { className: 'w-[150px] min-w-[130px] max-w-[170px] whitespace-normal' },
    },
    {
      id: 'createdOn',
      header: t('templatesPage.columns.createdOn'),
      cell: ({ row }) => (
        <div className="whitespace-normal text-sm">
          <div className="font-medium leading-5 text-slate-700">{formatDate(row.original.created_at)}</div>
        </div>
      ),
      meta: { className: 'w-[120px] min-w-[110px] max-w-[130px] whitespace-normal' },
    },
    {
      id: 'updatedOn',
      header: t('templatesPage.columns.updatedOn'),
      cell: ({ row }) => (
        <div className="whitespace-normal text-sm">
          <div className="font-medium leading-5 text-slate-700">{formatDate(row.original.updated_at)}</div>
        </div>
      ),
      meta: { className: 'w-[120px] min-w-[110px] max-w-[130px] whitespace-normal' },
    },
    {
      accessorKey: 'status',
      header: t('templatesPage.columns.status'),
      cell: ({ row }) => (
        <div className="whitespace-normal text-sm">
          <ApprovalStatusBadge
            status={row.original.is_published ? 'Published' : toStatusLabel(row.original.status)}
            rejection_reason={row.original.rejection_reason ?? undefined}
          />
        </div>
      ),
      meta: { className: 'w-[125px] min-w-[115px] max-w-[140px] whitespace-normal' },
    },
    {
      id: 'actions',
      header: t('templatesPage.columns.actions'),
      meta: { frozen: 'right', frozenWidth: 88 },
      cell: ({ row }) => {
        const canEdit =
          row.original.permissions?.can_edit ?? (row.original.status === 'DRAFT' || row.original.status === 'REJECTED');
        const canDelete = row.original.permissions?.can_delete ?? (isAdmin || row.original.status === 'DRAFT');
        const canSubmit =
          row.original.permissions?.can_submit ??
          (row.original.status === 'DRAFT' || row.original.status === 'REJECTED');
        const canApprove =
          row.original.permissions?.can_approve ??
          (isAdmin && (row.original.status === 'SUBMITTED' || row.original.status === 'APPROVAL'));
        const canReject =
          row.original.permissions?.can_reject ??
          (isAdmin &&
            (row.original.status === 'SUBMITTED' ||
              row.original.status === 'APPROVAL' ||
              row.original.status === 'APPROVED'));
        const canPublish =
          row.original.permissions?.can_publish ??
          (isAdmin && row.original.status === 'APPROVED' && !row.original.is_published);
        const canUnpublish = row.original.permissions?.can_unpublish ?? (isAdmin && Boolean(row.original.is_published));
        const canCreateNewVersion =
          row.original.permissions?.can_create_new_version ?? (isAdmin && row.original.status === 'APPROVED');
        const canReturnToDraft = row.original.permissions?.can_reset_to_draft ?? false;
        const primaryActionLabel = canEdit ? t('templatesPage.actions.edit') : t('templatesPage.actions.view');
        const rowPending = Boolean(pendingActionKey?.endsWith(`:${row.original.id}`));
        const actionsDisabled = Boolean(pendingActionKey);
        const isActionPending = (action: TTemplateRowAction) =>
          pendingActionKey === getTemplateActionKey(action, row.original.id);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 rounded-xl px-2.5" disabled={actionsDisabled}>
                {rowPending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={actionsDisabled}
                onClick={() => navigate({ to: `/templates/${row.original.id}` })}>
                {primaryActionLabel}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onDuplicate(row.original)}>
                {isActionPending('duplicate') && <Loader2 className="size-4 animate-spin" />}
                {t('templatesPage.actions.duplicate')}
              </DropdownMenuItem>
              {(canSubmit ||
                canApprove ||
                canReject ||
                canReturnToDraft ||
                canPublish ||
                canUnpublish ||
                canCreateNewVersion ||
                canDelete) && <DropdownMenuSeparator />}
              {canSubmit && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onSubmit(row.original)}>
                  {isActionPending('submit') && <Loader2 className="size-4 animate-spin" />}
                  {t('templatesPage.actions.submitApproval')}
                </DropdownMenuItem>
              )}
              {canApprove && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onApprove(row.original)}>
                  {isActionPending('approve') && <Loader2 className="size-4 animate-spin" />}
                  {t('templatesPage.actions.approve')}
                </DropdownMenuItem>
              )}
              {canReject && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => onReject(row.original)}>
                  {isActionPending('reject') && <Loader2 className="size-4 animate-spin" />}
                  {t('templatesPage.actions.reject')}
                </DropdownMenuItem>
              )}
              {canReturnToDraft && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onReturnToDraft(row.original)}>
                  {isActionPending('return-draft') && <Loader2 className="size-4 animate-spin" />}
                  {t('templatesPage.actions.returnDraft')}
                </DropdownMenuItem>
              )}
              {canPublish && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onPublish(row.original)}>
                  {isActionPending('publish') && <Loader2 className="size-4 animate-spin" />}
                  {t('templatesPage.actions.publish')}
                </DropdownMenuItem>
              )}
              {canUnpublish && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onUnpublish(row.original)}>
                  {isActionPending('unpublish') && <Loader2 className="size-4 animate-spin" />}
                  {t('templatesPage.actions.unpublish')}
                </DropdownMenuItem>
              )}
              {canCreateNewVersion && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onNewVersion(row.original)}>
                  {isActionPending('new-version') && <Loader2 className="size-4 animate-spin" />}
                  {t('templatesPage.actions.newVersion')}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  disabled={actionsDisabled}
                  className="text-rose-600 focus:text-rose-600"
                  onClick={() => void onDelete(row.original)}>
                  {isActionPending('delete') ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {t('templatesPage.actions.delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
};

export const TemplatesSection: React.FC<ITemplatesSectionProps> = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = profileStore((state) => state.profile);
  const isAdmin = isAdminProfile(profile) || isRootProfile(profile);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TemplateStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [artifactFilter, setArtifactFilter] = useState<TArtifactFilter>('ALL');
  const [metadataFilter, setMetadataFilter] = useState<Record<string, string>>({});
  const [updatedFrom, setUpdatedFrom] = useState('');
  const [updatedTo, setUpdatedTo] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 350);
  const debouncedMetadataFilter = useDebounce(metadataFilter, 350);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [reportSummary, setReportSummary] = useState<IEntityReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [templateToReject, setTemplateToReject] = useState<Template | null>(null);
  const [templateTypeOptions, setTemplateTypeOptions] = useState<MetadataOption[]>([]);
  const [filterConfig, setFilterConfig] = useState<FilterConfigMetaValues['filterTemplate']>({});
  const [organizationUnitOptions, setOrganizationUnitOptions] = useState<MetadataOption[]>([]);
  const [uploadTemplateType, setUploadTemplateType] = useState('');
  const [uploadArtifactType, setUploadArtifactType] = useState<TArtifactType>('rich_text');
  const [uploadVisibility, setUploadVisibility] = useState<TemplateVisibility>('PRIVATE');
  const [uploadShareRules, setUploadShareRules] = useState<ITemplateShareRule[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total: 0,
    total_pages: 0,
  });
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const pendingActionKeyRef = useRef<string | null>(null);

  const startRowAction = useCallback((actionKey: string) => {
    if (pendingActionKeyRef.current) {
      return false;
    }

    pendingActionKeyRef.current = actionKey;
    setPendingActionKey(actionKey);
    return true;
  }, []);

  const finishRowAction = useCallback(() => {
    pendingActionKeyRef.current = null;
    setPendingActionKey(null);
  }, []);

  const pageSize = extractPageSize(pagination);
  const debouncedMetadataFilterKey = useMemo(() => JSON.stringify(debouncedMetadataFilter), [debouncedMetadataFilter]);
  const debouncedMetadataFilterParams = useMemo(
    () => JSON.parse(debouncedMetadataFilterKey) as Record<string, string>,
    [debouncedMetadataFilterKey],
  );
  const templateListParams = useMemo(
    () => ({
      search: debouncedSearchQuery || undefined,
      page: pagination.page,
      page_size: pageSize,
      sort: 'desc:updated_at',
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      template_type: typeFilter === 'ALL' ? undefined : typeFilter,
      artifact_type: artifactFilter === 'ALL' ? undefined : artifactFilter,
      metadata_filter:
        Object.keys(debouncedMetadataFilterParams).length > 0 ? debouncedMetadataFilterParams : undefined,
      updated_from: updatedFrom ? new Date(updatedFrom).toISOString() : undefined,
      updated_to: updatedTo ? new Date(`${updatedTo}T23:59:59.999`).toISOString() : undefined,
    }),
    [
      pageSize,
      pagination.page,
      debouncedSearchQuery,
      statusFilter,
      typeFilter,
      artifactFilter,
      debouncedMetadataFilterKey,
      updatedFrom,
      updatedTo,
    ],
  );
  const activeFilterFields = useMemo<FilterField[]>(() => {
    if (typeFilter === 'ALL') return [];
    return filterConfig[typeFilter]?.fields ?? [];
  }, [filterConfig, typeFilter]);
  const reportCards = useMemo<TReportCard[]>(() => {
    return [
      {
        key: 'total',
        label: t('templatesPage.stats.total'),
        description: t('templatesPage.stats.currentFilter'),
        value: reportSummary?.total ?? 0,
        icon: <FileText className="size-5" />,
        accentClassName: 'border-blue-500 bg-blue-50 text-blue-700',
        active: true,
      },
      {
        key: 'draft',
        label: t('templatesPage.stats.draft'),
        description: t('templatesPage.stats.designing'),
        value: reportSummary?.draft ?? 0,
        icon: <PlusCircle className="size-5" />,
        accentClassName: 'border-slate-400 bg-slate-50 text-slate-700',
      },
      {
        key: 'pending',
        label: t('templatesPage.stats.pending'),
        description: t('templatesPage.stats.pendingDescription'),
        value: reportSummary?.pending ?? 0,
        icon: <Clock3 className="size-5" />,
        accentClassName: 'border-amber-500 bg-amber-50 text-amber-700',
      },
      {
        key: 'approved',
        label: t('templatesPage.stats.approved'),
        description: t('templatesPage.stats.publishedCount', { count: reportSummary?.published ?? 0 }),
        value: reportSummary?.approved ?? 0,
        icon: <CheckCircle2 className="size-5" />,
        accentClassName: 'border-emerald-500 bg-emerald-50 text-emerald-700',
      },
      {
        key: 'rejected',
        label: t('templatesPage.stats.rejected'),
        description: t('templatesPage.stats.needsRevision'),
        value: reportSummary?.rejected ?? 0,
        icon: <XCircle className="size-5" />,
        accentClassName: 'border-rose-500 bg-rose-50 text-rose-700',
      },
    ];
  }, [reportSummary, t]);

  const templateTypeLabelMap = useMemo(
    () => new Map(templateTypeOptions.map((option) => [option.value, option.label])),
    [templateTypeOptions],
  );
  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getMetadataByKeyAPI<MetadataOption[]>('TEMPLATE_TYPE'),
      getMetadataByKeyAPI<FilterConfigMetaValues>('FILTER_CONFIG'),
      listTemplateVisibilityUnitsAPI(),
    ])
      .then(([metadata, filterConfigRecord, units]) => {
        if (!cancelled) {
          setTemplateTypeOptions(metadata.meta_values ?? []);
          setFilterConfig(filterConfigRecord.meta_values?.filterTemplate ?? {});
          setOrganizationUnitOptions(
            units.map((unit) => ({
              value: unit.id,
              label: unit.name || unit.code,
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateTypeOptions([]);
          setFilterConfig({});
          setOrganizationUnitOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (uploadTemplateType || templateTypeOptions.length === 0) {
      return;
    }

    setUploadTemplateType(templateTypeOptions[0].value);
  }, [templateTypeOptions, uploadTemplateType]);

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await listTemplatesAPI(templateListParams);
      setTemplates(res.data);
      setPagination((prev) => {
        if (
          prev.total === res.pagination.total &&
          prev.total_pages === res.pagination.total_pages &&
          prev.page === res.pagination.page &&
          prev.page_size === res.pagination.page_size
        ) {
          return prev;
        }

        return {
          ...prev,
          total: res.pagination.total,
          total_pages: res.pagination.total_pages,
          page: res.pagination.page,
          page_size: res.pagination.page_size,
        };
      });
    } catch (error: unknown) {
      setToast({
        message: t('templatesPage.messages.loadFailed', { error: getErrorMessage(error) }),
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [templateListParams, t]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    let cancelled = false;

    void getTemplateReportSummaryAPI({
      template_type: typeFilter === 'ALL' ? undefined : typeFilter,
      artifact_type: artifactFilter === 'ALL' ? undefined : artifactFilter,
      from: updatedFrom ? new Date(updatedFrom).toISOString() : undefined,
      to: updatedTo ? new Date(`${updatedTo}T23:59:59.999`).toISOString() : undefined,
      group_by: 'day',
    })
      .then((summary) => {
        if (!cancelled) setReportSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setReportSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, [artifactFilter, typeFilter, updatedFrom, updatedTo]);

  const handleDelete = useCallback(
    async (row: Template) => {
      const confirmed = window.confirm(t('templatesPage.messages.confirmDelete', { name: row.name }));
      if (!confirmed) return;
      if (!startRowAction(getTemplateActionKey('delete', row.id))) return;

      try {
        await deleteTemplateAPI(row.id);
        setToast({
          message: t('templatesPage.messages.deleted'),
          type: 'success',
        });
        await fetchTemplates();
      } catch (error: unknown) {
        setToast({
          message: t('templatesPage.messages.deleteFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchTemplates, finishRowAction, startRowAction, t],
  );

  const handleSubmit = useCallback(
    async (row: Template) => {
      const confirmed = window.confirm(t('templatesPage.messages.confirmSubmit', { name: row.name }));
      if (!confirmed) return;
      if (!startRowAction(getTemplateActionKey('submit', row.id))) return;

      try {
        await submitTemplateForApprovalAPI(row.id);
        setToast({
          message: t('templatesPage.messages.submitted'),
          type: 'success',
        });
        await fetchTemplates();
      } catch (error: unknown) {
        setToast({
          message: t('templatesPage.messages.submitFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchTemplates, finishRowAction, startRowAction, t],
  );

  const handleApprove = useCallback(
    async (row: Template) => {
      const confirmed = window.confirm(t('templatesPage.messages.confirmApprove', { name: row.name }));
      if (!confirmed) return;
      if (!startRowAction(getTemplateActionKey('approve', row.id))) return;

      try {
        await approveTemplateAPI(row.id);
        setToast({
          message: t('templatesPage.messages.approved'),
          type: 'success',
        });
        await fetchTemplates();
      } catch (error: unknown) {
        setToast({
          message: t('templatesPage.messages.approveFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchTemplates, finishRowAction, startRowAction, t],
  );

  const handleReject = useCallback((row: Template) => {
    if (pendingActionKeyRef.current) return;
    setTemplateToReject(row);
  }, []);

  const handleReturnToDraft = useCallback(
    async (row: Template) => {
      const confirmed = window.confirm(t('templatesPage.messages.confirmReturnDraft', { name: row.name }));
      if (!confirmed) return;
      if (!startRowAction(getTemplateActionKey('return-draft', row.id))) return;

      try {
        await returnTemplateToDraftAPI(row.id);
        setToast({
          message: t('templatesPage.messages.returnedDraft'),
          type: 'success',
        });
        await fetchTemplates();
      } catch (error: unknown) {
        setToast({
          message: t('templatesPage.messages.returnDraftFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchTemplates, finishRowAction, startRowAction, t],
  );

  const handlePublish = useCallback(
    async (row: Template) => {
      const confirmed = window.confirm(t('templatesPage.messages.confirmPublish', { name: row.name }));
      if (!confirmed) return;
      if (!startRowAction(getTemplateActionKey('publish', row.id))) return;

      try {
        await publishTemplateAPI(row.id);
        setToast({
          message: t('templatesPage.messages.published'),
          type: 'success',
        });
        await fetchTemplates();
      } catch (error: unknown) {
        setToast({
          message: t('templatesPage.messages.publishFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchTemplates, finishRowAction, startRowAction, t],
  );

  const handleUnpublish = useCallback(
    async (row: Template) => {
      const confirmed = window.confirm(t('templatesPage.messages.confirmUnpublish', { name: row.name }));
      if (!confirmed) return;
      if (!startRowAction(getTemplateActionKey('unpublish', row.id))) return;

      try {
        await unpublishTemplateAPI(row.id);
        setToast({
          message: t('templatesPage.messages.unpublished'),
          type: 'success',
        });
        await fetchTemplates();
      } catch (error: unknown) {
        setToast({
          message: t('templatesPage.messages.unpublishFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchTemplates, finishRowAction, startRowAction, t],
  );

  const handleNewVersion = useCallback(
    async (row: Template) => {
      const confirmed = window.confirm(t('templatesPage.messages.confirmNewVersion', { name: row.name }));
      if (!confirmed) return;
      if (!startRowAction(getTemplateActionKey('new-version', row.id))) return;

      try {
        const newTemplate = await createTemplateNewVersionAPI(row.id);
        setToast({
          message: t('templatesPage.messages.newVersionCreated'),
          type: 'success',
        });
        navigate({ to: `/templates/${newTemplate.id}` });
      } catch (error: unknown) {
        setToast({
          message: t('templatesPage.messages.newVersionFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [finishRowAction, navigate, startRowAction, t],
  );

  const handleDuplicate = useCallback(
    async (row: Template) => {
      if (!startRowAction(getTemplateActionKey('duplicate', row.id))) return;

      try {
        const duplicatedTemplate = await duplicateTemplateAPI(row.id);
        setToast({
          message: t('templatesPage.messages.duplicated'),
          type: 'success',
        });
        navigate({ to: `/templates/${duplicatedTemplate.id}` });
      } catch (error: unknown) {
        setToast({
          message: t('templatesPage.messages.duplicateFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [finishRowAction, navigate, startRowAction, t],
  );

  const handleFileUpload = async (event: FileSelectEvent) => {
    const file =
      ('dataTransfer' in event ? event.dataTransfer.files?.[0] : null) ||
      ('target' in event ? (event.target as HTMLInputElement)?.files?.[0] : null);
    if (!file) return;

    setIsDragging(false);
    setIsUploading(true);

    try {
      if (!uploadTemplateType) {
        throw new Error(t('templatesPage.messages.chooseType'));
      }

      if (uploadVisibility === 'RESTRICTED' && uploadShareRules.length === 0) {
        throw new Error(t('templatesPage.messages.addShareRule'));
      }

      const extension = file.name.split('.').pop()?.toLowerCase();
      const isWordFile = extension === 'doc' || extension === 'docx';
      let normalizedContent = `<p>${file.name}</p>`;
      let artifact_type: TArtifactType = 'rich_text';
      let artifact_config: unknown;
      let variables: unknown;
      let file_id = '';

      if (isWordFile) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
            ],
          },
        );

        normalizedContent = result.value?.trim() ?? '';
        if (!normalizedContent) {
          throw new Error(t('templatesPage.messages.emptyContent'));
        }
        variables = {
          timestamp: new Date().toISOString(),
          variables: [],
          var_types: {},
          raw_content: normalizedContent,
          docx_editor_snapshot: {
            base64: arrayBufferToBase64(arrayBuffer),
            file_name: file.name,
            updated_at: new Date().toISOString(),
            source: 'docx-editor',
            html_content_key: createEditorContentKey(normalizedContent),
            renderer_version: DOCX_EDITOR_RENDERER_VERSION,
          },
        };
      } else {
        const uploaded = await uploadArtifactSourceAPI(file);
        artifact_type = uploaded.artifact_type;
        artifact_config = uploaded.artifact_config;
        file_id = uploaded.file_id;
        normalizedContent = `<p>${uploaded.source_file_name}</p>`;
      }

      await createTemplateAPI({
        name: file.name.replace('.docx', ''),
        description: `${file.name}`,
        content: normalizedContent,
        template_type: uploadTemplateType,
        artifact_type,
        artifact_config,
        visibility: uploadVisibility,
        share_rules:
          uploadVisibility === 'RESTRICTED'
            ? uploadShareRules.map((rule) => ({
                subject_type: rule.subject_type,
                subject_id: rule.subject_id,
              }))
            : [],
        preview: normalizedContent.substring(0, 100),
        file_id,
        source_file_name: file.name,
        ...(variables ? { variables } : {}),
      });

      setToast({ message: t('templatesPage.messages.uploaded', { name: file.name }), type: 'success' });
      setShowUploadModal(false);
      setUploadArtifactType('rich_text');
      setUploadShareRules([]);
      await fetchTemplates();
    } catch (error: unknown) {
      setToast({
        message: t('templatesPage.messages.uploadFailed', { error: getErrorMessage(error) }),
        type: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const columns = useMemo(
    () =>
      getColumns(
        navigate,
        (pagination.page - 1) * pageSize,
        (template_type?: string | null) =>
          (template_type ? templateTypeLabelMap.get(template_type) : undefined) ?? template_type ?? '-',
        t,
        isAdmin,
        pendingActionKey,
        handleSubmit,
        handleApprove,
        handleReject,
        handleReturnToDraft,
        handlePublish,
        handleUnpublish,
        handleNewVersion,
        handleDuplicate,
        handleDelete,
      ),
    [
      handleApprove,
      handleDelete,
      handleDuplicate,
      handleNewVersion,
      handlePublish,
      handleReject,
      handleReturnToDraft,
      handleSubmit,
      handleUnpublish,
      isAdmin,
      navigate,
      pageSize,
      pagination.page,
      pendingActionKey,
      t,
      templateTypeLabelMap,
    ],
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm">
            <span className="flex items-center gap-1 text-amber-600">
              <Home className="size-3.5" />
              <span className="font-medium">{t('templatesPage.breadcrumbRoot')}</span>
            </span>
            <span className="text-gray-400">›</span>
            <span className="text-gray-500">{t('templatesPage.breadcrumbCurrent')}</span>
          </div>
          <div className="text-3xl font-bold text-[#0B2559]">{t('templatesPage.title')}</div>
          <p className="mt-1 text-sm text-slate-500">{t('templatesPage.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowUploadModal(true)} className="h-10 rounded-xl px-4">
            <Upload className="size-4" />
            {t('templatesPage.actions.upload')}
          </Button>
          <Button
            size="sm"
            className="h-10 rounded-xl bg-emerald-600 px-4 hover:bg-emerald-700"
            onClick={() => navigate({ to: '/templates/new' })}>
            <PlusCircle className="size-4" />
            {t('templatesPage.actions.createNew')}
          </Button>
        </div>
      </div>

      <ReportCardGrid cards={reportCards} />

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="relative min-w-[280px] flex-1 md:max-w-lg">
            <Input
              type="text"
              placeholder={t('templatesPage.searchPlaceholder')}
              className="h-11 rounded-2xl border-slate-200 pl-10"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={updatedFrom}
                onChange={(e) => {
                  setUpdatedFrom(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="h-11 w-40 rounded-2xl border-slate-200"
              />
              <span className="text-slate-400">—</span>
              <Input
                type="date"
                value={updatedTo}
                onChange={(e) => {
                  setUpdatedTo(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="h-11 w-40 rounded-2xl border-slate-200"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setMetadataFilter({});
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}>
              <SelectTrigger className="h-11 w-45 rounded-2xl border-slate-200">
                <SelectValue placeholder={t('templatesPage.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('templatesPage.allTypes')}</SelectItem>
                {templateTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={artifactFilter}
              onValueChange={(value) => {
                setArtifactFilter(value as TArtifactFilter);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}>
              <SelectTrigger className="h-11 w-[190px] rounded-2xl border-slate-200">
                <SelectValue placeholder={t('templatesPage.allFormats')} />
              </SelectTrigger>
              <SelectContent>
                {ARTIFACT_FORMAT_OPTIONS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {t(format.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as 'ALL' | TemplateStatus);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}>
              <SelectTrigger className="h-11 w-[180px] rounded-2xl border-slate-200">
                <SelectValue placeholder={t('templatesPage.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {t(status.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeFilterFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('templatesPage.metadata')}
            </span>
            {activeFilterFields.map((field) => {
              const currentVal = metadataFilter[field.key] || undefined;
              const onChange = (val: string | undefined) => {
                setMetadataFilter((prev) => {
                  const next = { ...prev };
                  if (val) next[field.key] = val;
                  else delete next[field.key];
                  return next;
                });
                setPagination((prev) => ({ ...prev, page: 1 }));
              };

              if (field.source_type === 'api_table') {
                return (
                  <SearchableSelect
                    key={field.key}
                    value={currentVal}
                    clearable
                    placeholder={field.label}
                    searchPlaceholder={t('templatesPage.searchMetadata', { label: field.label.toLowerCase() })}
                    emptyMessage={t('templatesPage.noMetadataResult')}
                    fetchOnOpen
                    minSearchLength={0}
                    apiFunction={async (params) => {
                      const results = await getTemplateTableOptionsAPI({
                        table: field.table,
                        field_name: field.field_name,
                        label_field: field.label_field,
                        sort_order: 'asc',
                        search: typeof params.search === 'string' ? params.search : undefined,
                        page: typeof params.page === 'number' ? params.page : 1,
                        page_size: 50,
                      });
                      return applyLabelExpr(results, field.label_expr);
                    }}
                    onValueChange={onChange}
                    className="h-10 w-44 rounded-2xl"
                  />
                );
              }

              if (field.source_type === 'static') {
                return (
                  <Select
                    key={field.key}
                    value={currentVal ?? 'ALL'}
                    onValueChange={(val) => onChange(val === 'ALL' ? undefined : val)}>
                    <SelectTrigger className="h-10 w-40 rounded-2xl border-slate-200">
                      <SelectValue placeholder={field.label} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('templatesPage.allOf', { label: field.label })}</SelectItem>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }

              if (field.source_type === 'input_number') {
                return (
                  <Input
                    key={field.key}
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    placeholder={field.placeholder ?? field.label}
                    className="h-10 w-36 rounded-2xl border-slate-200"
                    value={currentVal ?? ''}
                    onChange={(e) => onChange(e.target.value || undefined)}
                  />
                );
              }

              return (
                <Input
                  key={field.key}
                  type="text"
                  placeholder={field.placeholder ?? field.label}
                  className="h-10 w-40 rounded-2xl border-slate-200"
                  value={currentVal ?? ''}
                  onChange={(e) => onChange(e.target.value || undefined)}
                />
              );
            })}
            {Object.keys(metadataFilter).length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-xl text-xs text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setMetadataFilter({});
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}>
                {t('templatesPage.clearFilters')}
              </Button>
            )}
          </div>
        )}

        <div className="px-6 py-5">
          <DataTable
            fixedHeader
            enableFreezeColumns
            columns={columns}
            data={templates}
            loading={isLoading}
            pagination={pagination}
            onPaginationChange={(updater) => setPagination((prev) => updater(prev))}
          />
        </div>
      </div>

      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        isDragging={isDragging}
        onDraggingChange={setIsDragging}
        onFileSelect={handleFileUpload}
        isUploading={isUploading}
        templateTypeOptions={templateTypeOptions}
        templateTypeValue={uploadTemplateType}
        onTemplateTypeChange={setUploadTemplateType}
        artifactTypeValue={uploadArtifactType}
        onArtifactTypeChange={setUploadArtifactType}
        visibilityValue={uploadVisibility}
        onVisibilityChange={setUploadVisibility}
        share_rules={uploadShareRules}
        onShareRulesChange={setUploadShareRules}
        organizationUnitOptions={organizationUnitOptions}
      />

      <RejectionDialog
        isOpen={Boolean(templateToReject)}
        template_id={templateToReject?.id ?? ''}
        approverId=""
        templateName={templateToReject?.name}
        onClose={() => setTemplateToReject(null)}
        onReject={async (template_id, _approverId, reason) => {
          if (!startRowAction(getTemplateActionKey('reject', template_id))) {
            throw new Error('Vui lòng chờ tác vụ hiện tại hoàn tất.');
          }

          try {
            await rejectTemplateAPI(template_id, { rejection_reason: reason });
            setToast({
              message: t('templatesPage.messages.rejected'),
              type: 'success',
            });
            setTemplateToReject(null);
            await fetchTemplates();
          } catch (error: unknown) {
            setToast({
              message: t('templatesPage.messages.rejectFailed', { error: getErrorMessage(error) }),
              type: 'error',
            });
            throw error;
          } finally {
            finishRowAction();
          }
        }}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
