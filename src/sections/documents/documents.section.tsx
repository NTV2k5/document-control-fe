import { useNavigate } from '@tanstack/react-router';
import {
  CheckCircle2,
  Clock3,
  Download,
  Files,
  Home,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { DocumentGridView } from './document-grid-view.component';
import { DocumentSidePanel } from './document-side-panel.component';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApprovalStatusBadge, Toast, type ToastProps } from '../../components';
import { useTranslation, type TTranslationParams } from '../../i18n';
import {
  applyVariablesToHtml,
  createDownloadFileName,
  formatDate,
  getCurrentTemplateDocxEditorSnapshotBuffer,
  navigateDocxExportPreviewWindow,
  openDocxExportPreviewWindow,
  writeDocxExportPreviewPayload,
  type TemplateDocxEditorSnapshot,
  type TemplateVariablesPayload,
} from '../../lib';
import { extractPageSize } from '../../models';
import type {
  IDocumentQuickFilterOption,
  IDocumentsSectionProps,
  TDocumentColumn,
  TDocumentRow,
  TDocumentsNavigate,
} from './documents.type';
import { DocumentInputAgentWidget } from './document-input-agent-widget';
import {
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  SearchableSelect,
  type SearchableSelectOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type PaginationInfo,
} from 'reactjs-platform/ui';
import {
  adminListOrganizationUnitsAPI,
  canAccessTemplates,
  hasPermission,
  isAdmin as isAdminProfile,
  isRootProfile,
  profileStore,
  type IOrganizationUnit,
} from 'reactjs-platform/utilities';
import {
  applyLabelExpr,
  approveDocumentAPI,
  deleteDocumentAPI,
  getDocumentByIdAPI,
  getDocumentFilterConfigByType,
  getFilterFieldsForType,
  getDocumentReportSummaryAPI,
  getMetadataByKeyAPI,
  getTemplateByIdAPI,
  getTemplateTableOptionsAPI,
  listDocumentsAPI,
  publishDocumentAPI,
  returnDocumentToDraftAPI,
  unpublishDocumentAPI,
  type DocumentStatus,
  type FilterConfigByType,
  type FilterConfigMetaValues,
  type IDocument,
  type IEntityReportSummary,
  type ITemplate,
  type MetadataOption,
  type TArtifactType,
} from 'api';
import type React from 'react';

type DocumentRow = TDocumentRow;
type TArtifactFilter = 'ALL' | TArtifactType;
type TDocumentRowAction = 'approve' | 'return-draft' | 'publish' | 'unpublish' | 'delete';
type TDocumentMetadataEntry = { label?: unknown; value?: unknown } | string | null | undefined;
type TDocumentMetadata = Record<string, TDocumentMetadataEntry> | null | undefined;

const DEFAULT_PAGE_SIZE = 10;
const EMPTY_TABLE_CELL = '—';
const DOCUMENT_METADATA_DISPLAY_KEYS = ['faculty_id', 'major_id', 'specialization_id', 'academic_cohort_id'];

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const getDocumentActionKey = (action: TDocumentRowAction, id: string) => `${action}:${id}`;
const getDocumentMetadataDisplay = (entry: TDocumentMetadataEntry) => {
  if (typeof entry === 'string') return entry.trim();

  if (entry && typeof entry === 'object') {
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    const value = typeof entry.value === 'string' ? entry.value.trim() : '';

    return label || value;
  }

  return '';
};

const getDocumentMetadataItems = (metadata: TDocumentMetadata) => {
  if (!metadata) return [];

  const orderedKeys = [
    ...DOCUMENT_METADATA_DISPLAY_KEYS,
    ...Object.keys(metadata).filter((key) => !DOCUMENT_METADATA_DISPLAY_KEYS.includes(key)),
  ];

  return orderedKeys
    .map((key) => ({
      key,
      display: getDocumentMetadataDisplay(metadata[key]),
    }))
    .filter((item) => item.display);
};

const openPathInNewTab = (path: string) => {
  if (typeof window === 'undefined') return;

  const url = new URL(path, window.location.href);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
};

const parseVariablesPayload = (value: unknown): TemplateVariablesPayload | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TemplateVariablesPayload;
    } catch {
      return null;
    }
  }

  return typeof value === 'object' ? (value as TemplateVariablesPayload) : null;
};

const buildVariableValueMap = (payload?: TemplateVariablesPayload | null) => {
  const values: Record<string, string> = {};

  if (!Array.isArray(payload?.variables)) return values;

  payload.variables.forEach((item) => {
    values[item.key] = item.value;
  });

  return values;
};

const getSnapshotBuffer = (snapshot: TemplateDocxEditorSnapshot | null | undefined, htmlContent: string) => {
  if (!snapshot?.base64) return null;

  return getCurrentTemplateDocxEditorSnapshotBuffer(snapshot, snapshot.html_content_key ?? htmlContent);
};

const buildTemplateExportPreviewInput = (template: ITemplate) => {
  const payload = parseVariablesPayload(template.variables);
  const rawContent = payload?.raw_content || template.content || '<p></p>';
  const htmlContent = applyVariablesToHtml(rawContent, buildVariableValueMap(payload));
  const snapshot = payload?.docx_editor_snapshot ?? null;

  return {
    source: 'template' as const,
    title: template.name,
    fileName: createDownloadFileName(template.source_file_name || template.name || 'template', 'docx'),
    htmlContent,
    initialDocumentBuffer: getSnapshotBuffer(snapshot, rawContent),
  };
};

const buildDocumentExportPreviewInput = (document: IDocument) => {
  const payload = parseVariablesPayload(document.data);
  const rawContent = payload?.raw_content || document.content || '<p></p>';
  const htmlContent = applyVariablesToHtml(rawContent, buildVariableValueMap(payload));
  const snapshot = payload?.docx_editor_snapshot ?? null;

  return {
    source: 'document' as const,
    title: document.title,
    fileName: createDownloadFileName(document.title || 'document', 'docx'),
    htmlContent,
    initialDocumentBuffer: getSnapshotBuffer(snapshot, rawContent),
  };
};

const getOrganizationUnitOption = (unit: IOrganizationUnit): SearchableSelectOption => ({
  value: unit.id,
  label: [unit.name, unit.code, unit.unit_type].filter(Boolean).join(' · '),
});

type TReportCard = {
  key: string;
  label: string;
  description: string;
  value: number;
  icon: React.ReactNode;
  accentClassName: string;
  active?: boolean;
};

const toStatusLabel = (status: string) =>
  ({
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVAL: 'Approval',
    IN_REVIEW: 'Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  })[status] ?? status;

const quickFilters: IDocumentQuickFilterOption[] = [
  { key: 'ALL', label: 'documentsPage.status.all' },
  { key: 'DRAFT', label: 'documentsPage.status.draft' },
  { key: 'SUBMITTED', label: 'documentsPage.status.submitted' },
  { key: 'APPROVED', label: 'documentsPage.status.approved' },
  { key: 'REJECTED', label: 'documentsPage.status.rejected' },
];

const artifactFormatOptions: Array<{ value: TArtifactFilter; label: string }> = [
  { value: 'ALL', label: 'documentsPage.allFormats' },
  { value: 'rich_text', label: 'documentsPage.artifactFormats.richText' },
  { value: 'spreadsheet', label: 'documentsPage.artifactFormats.spreadsheet' },
  { value: 'presentation', label: 'documentsPage.artifactFormats.presentation' },
  { value: 'image_form', label: 'documentsPage.artifactFormats.imageForm' },
];

const FileDraftIcon = () => (
  <div className="flex size-5 items-center justify-center rounded border border-current text-[10px] font-bold">D</div>
);

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
  navigate: TDocumentsNavigate,
  page: number,
  pageSize: number,
  getTemplateTypeLabel: (template_type?: string | null) => string,
  t: (key: string, params?: TTranslationParams) => string,
  isAdmin: boolean,
  canOpenTemplateDetail: boolean,
  pendingActionKey: string | null,
  onOpenTemplateFile: (row: TDocumentRow, canOpenTemplateDetail: boolean) => Promise<void>,
  onApprove: (row: TDocumentRow) => Promise<void>,
  onReturnToDraft: (row: TDocumentRow) => Promise<void>,
  onPublish: (row: TDocumentRow) => Promise<void>,
  onUnpublish: (row: TDocumentRow) => Promise<void>,
  onDelete: (row: TDocumentRow) => Promise<void>,
  onSelectDocument: (row: TDocumentRow) => void,
): TDocumentColumn[] => {
  return [
    {
      id: 'no',
      header: t('documentsPage.columns.no'),
      cell: ({ row }) => <span className="text-slate-400">{(page - 1) * pageSize + row.index + 1}</span>,
      meta: { className: 'w-12 min-w-[48px] max-w-[48px] !px-1 text-center' },
    },
    {
      id: 'document_id',
      header: t('documentsPage.columns.id'),
      cell: ({ row }) => (
        <span
          className="block max-w-[170px] break-all font-mono text-xs leading-4 text-slate-600"
          title={row.original.id}>
          {row.original.id}
        </span>
      ),
      meta: { className: 'w-[180px] min-w-[160px] max-w-[200px] whitespace-normal' },
    },
    {
      accessorKey: 'title',
      header: t('documentsPage.columns.name'),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Files className="size-4" />
          </div>
          <div className="min-w-0 whitespace-normal">
            <button
              type="button"
              onClick={() => onSelectDocument(row.original)}
              className="break-words text-left text-sm font-semibold leading-5 text-[#174A86] transition hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200">
              {row.original.title}
            </button>
            {/* <div className="mt-1 break-words text-xs leading-4 text-slate-400">
              {row.original.description || `ID: ${row.original.id.slice(0, 8)}`}
            </div> */}
          </div>
        </div>
      ),
      meta: { className: 'w-[260px] min-w-[240px] max-w-[300px] whitespace-normal' },
    },
    {
      id: 'template',
      header: t('documentsPage.columns.template'),
      cell: ({ row }) => {
        const template = row.original.template;

        if (!template) {
          return <span className="text-xs text-slate-400">{EMPTY_TABLE_CELL}</span>;
        }

        return (
          <div className="min-w-0 whitespace-normal">
            <div className="break-words text-sm font-semibold leading-5 text-slate-900" title={template.name}>
              {template.name || EMPTY_TABLE_CELL}
            </div>
            <button
              type="button"
              onClick={() => void onOpenTemplateFile(row.original, canOpenTemplateDetail)}
              className="mt-1 block break-all text-left font-mono text-[11px] leading-4 text-blue-600 transition hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200"
              title={template.source_file_name || template.id}>
              {template.source_file_name || template.id}
            </button>
          </div>
        );
      },
      meta: { className: 'w-[240px] min-w-[220px] max-w-[280px] whitespace-normal' },
    },
    {
      id: 'template_type',
      header: t('documentsPage.columns.type'),
      cell: ({ row }) => (
        <span className="inline-flex max-w-[150px] whitespace-normal rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold leading-4 text-emerald-700">
          {getTemplateTypeLabel(row.original.template?.template_type)}
        </span>
      ),
      meta: { className: 'w-[150px] min-w-[130px] max-w-[160px] whitespace-normal' },
    },
    {
      id: 'document_metadata',
      header: t('documentsPage.columns.metadata'),
      cell: ({ row }) => {
        const metadataItems = getDocumentMetadataItems(row.original.document_metadata as TDocumentMetadata);

        if (metadataItems.length === 0) {
          return <span className="text-xs text-slate-400">{EMPTY_TABLE_CELL}</span>;
        }

        return (
          <div className="flex max-w-[220px] flex-wrap gap-1 whitespace-normal">
            {metadataItems.slice(0, 4).map((item) => (
              <span
                key={item.key}
                className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs leading-4 text-slate-600">
                {item.display}
              </span>
            ))}
            {metadataItems.length > 4 && (
              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                +{metadataItems.length - 4}
              </span>
            )}
          </div>
        );
      },
      meta: { className: 'w-[220px] min-w-[180px] max-w-[240px] whitespace-normal' },
    },
    {
      id: 'created_by',
      header: t('documentsPage.columns.created_by'),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700">
            {(row.original.created_by || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 whitespace-normal">
            <div className="break-words text-sm font-semibold leading-5 text-slate-900">
              {row.original.created_by || '-'}
            </div>
            <div className="text-xs text-slate-500">{t('documentsPage.columns.author')}</div>
          </div>
        </div>
      ),
      meta: { className: 'w-[150px] min-w-[130px] max-w-[170px] whitespace-normal' },
    },
    {
      id: 'createdOn',
      header: t('documentsPage.columns.createdOn'),
      cell: ({ row }) => (
        <div className="whitespace-normal text-sm">
          <div className="font-medium leading-5 text-slate-700">{formatDate(row.original.created_at)}</div>
        </div>
      ),
      meta: { className: 'w-[120px] min-w-[110px] max-w-[130px] whitespace-normal' },
    },
    {
      id: 'updatedOn',
      header: t('documentsPage.columns.updatedOn'),
      cell: ({ row }) => (
        <div className="whitespace-normal text-sm">
          <div className="font-medium leading-5 text-slate-700">{formatDate(row.original.updated_at)}</div>
        </div>
      ),
      meta: { className: 'w-[120px] min-w-[110px] max-w-[130px] whitespace-normal' },
    },
    {
      id: 'approvalProgress',
      header: t('documentsPage.columns.approvalProgress'),
      cell: ({ row }) => {
        const approval = row.original.approval;
        if (!approval) {
          return <span className="text-xs text-slate-400">{t('documentsPage.noApprovalFlow')}</span>;
        }
        const current = approval.current_step;
        return (
          <div className="min-w-0 whitespace-normal text-sm">
            <div className="break-words text-xs font-semibold leading-4 text-amber-600">
              {current
                ? t('documentsPage.approvalStep', {
                    current: current.step_order,
                    total: approval.total_steps,
                    label: current.label,
                  })
                : t('documentsPage.approvalCompleted', {
                    current: approval.total_steps,
                    total: approval.total_steps,
                  })}
            </div>
            <div className="mt-2 flex gap-1">
              {approval.steps.map((step) => (
                <span
                  key={step.id}
                  className={`h-2 w-7 rounded-full ${
                    step.status === 'APPROVED'
                      ? 'bg-emerald-500'
                      : step.status === 'ASSIGNED' || step.status === 'WAITING_ASSIGNMENT'
                        ? 'bg-amber-400'
                        : step.status === 'REJECTED'
                          ? 'bg-rose-500'
                          : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <div className="mt-1 text-xs text-slate-400">{approval.status}</div>
          </div>
        );
      },
      meta: { className: 'w-[210px] min-w-[190px] max-w-[230px] whitespace-normal' },
    },
    {
      id: 'currentAssignee',
      header: t('documentsPage.columns.currentAssignee'),
      cell: ({ row }) => {
        const step = row.original.approval?.current_step;
        return (
          <div className="whitespace-normal text-sm">
            <div className="break-words font-semibold leading-5 text-slate-900">{step?.assigned_to_label ?? '-'}</div>
            <div className="break-words text-xs leading-4 text-slate-500">
              {step?.target_organization_unit_name ?? step?.actor_role_key ?? '-'}
            </div>
            {step?.status === 'WAITING_ASSIGNMENT' && (
              <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {t('documentsPage.waitingAssignment')}
              </span>
            )}
          </div>
        );
      },
      meta: { className: 'w-[170px] min-w-[150px] max-w-[190px] whitespace-normal' },
    },
    {
      id: 'nextApprover',
      header: t('documentsPage.columns.nextApprover'),
      cell: ({ row }) => {
        const step = row.original.approval?.next_step;
        return (
          <div className="whitespace-normal text-sm">
            <div className="break-words font-semibold leading-5 text-slate-900">{step?.assigned_to_label ?? '-'}</div>
            <div className="break-words text-xs leading-4 text-slate-500">{step?.label ?? '-'}</div>
          </div>
        );
      },
      meta: { className: 'w-[160px] min-w-[140px] max-w-[180px] whitespace-normal' },
    },
    {
      accessorKey: 'status',
      header: t('documentsPage.columns.status'),
      cell: ({ row }) => (
        <div className="whitespace-normal text-sm">
          <ApprovalStatusBadge
            status={toStatusLabel(row.original.status)}
            rejection_reason={row.original.rejection_reason ?? undefined}
          />
        </div>
      ),
      meta: { className: 'w-[120px] min-w-[110px] max-w-[130px] whitespace-normal' },
    },
    {
      id: 'actions',
      header: t('documentsPage.columns.actions'),
      meta: { frozen: 'right', frozenWidth: 84 },
      cell: ({ row }) => {
        const permissions = row.original.permissions;
        const canDelete = permissions?.can_delete ?? row.original.status === 'DRAFT';
        const canApprove = permissions?.can_approve ?? false;
        const canPublish = permissions?.can_publish ?? false;
        const canUnpublish = permissions?.can_unpublish ?? false;
        const canReturnToDraft = permissions?.can_reset_to_draft ?? false;
        const canEdit =
          permissions?.can_edit ?? (row.original.status === 'DRAFT' || row.original.status === 'REJECTED');
        const primaryActionLabel = canEdit ? t('documentsPage.actions.edit') : t('documentsPage.actions.view');
        const rowPending = Boolean(pendingActionKey?.endsWith(`:${row.original.id}`));
        const actionsDisabled = Boolean(pendingActionKey);
        const isActionPending = (action: TDocumentRowAction) =>
          pendingActionKey === getDocumentActionKey(action, row.original.id);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 rounded-xl px-2.5" disabled={actionsDisabled}>
                {rowPending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                disabled={actionsDisabled}
                onClick={() => navigate({ to: `/documents/${row.original.id}` })}>
                {primaryActionLabel}
              </DropdownMenuItem>
              {canApprove && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onApprove(row.original)}>
                  {isActionPending('approve') && <Loader2 className="size-4 animate-spin" />}
                  {t('documentsPage.actions.approve')}
                </DropdownMenuItem>
              )}
              {canReturnToDraft && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onReturnToDraft(row.original)}>
                  {isActionPending('return-draft') && <Loader2 className="size-4 animate-spin" />}
                  {t('documentsPage.actions.returnDraft')}
                </DropdownMenuItem>
              )}
              {canPublish && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onPublish(row.original)}>
                  {isActionPending('publish') && <Loader2 className="size-4 animate-spin" />}
                  {t('documentsPage.actions.publish')}
                </DropdownMenuItem>
              )}
              {canUnpublish && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onUnpublish(row.original)}>
                  {isActionPending('unpublish') && <Loader2 className="size-4 animate-spin" />}
                  {t('documentsPage.actions.unpublish')}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  disabled={actionsDisabled}
                  className="text-red-600 focus:text-red-600"
                  onClick={() => void onDelete(row.original)}>
                  {isActionPending('delete') ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {t('documentsPage.actions.delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
};

export const DocumentsSection: React.FC<IDocumentsSectionProps> = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = profileStore((s) => s.profile);
  const isAdmin = isAdminProfile(profile) || isRootProfile(profile);
  const canCreateDocument = hasPermission(profile, 'document.create');
  const canOpenTemplateDetail = canAccessTemplates(profile);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedDocument, setSelectedDocument] = useState<IDocument | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DocumentStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [artifactFilter, setArtifactFilter] = useState<TArtifactFilter>('ALL');
  const [organizationUnitFilter, setOrganizationUnitFilter] = useState('');
  const [updatedFrom, setUpdatedFrom] = useState('');
  const [updatedTo, setUpdatedTo] = useState('');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [reportSummary, setReportSummary] = useState<IEntityReportSummary | null>(null);
  const [templateTypeOptions, setTemplateTypeOptions] = useState<MetadataOption[]>([]);
  const [organizationUnitOptions, setOrganizationUnitOptions] = useState<SearchableSelectOption[]>([]);
  const [documentFilterConfig, setDocumentFilterConfig] = useState<FilterConfigByType>({});
  const [metadataFilter, setMetadataFilter] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
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
  const metadataFilterKey = useMemo(() => JSON.stringify(metadataFilter), [metadataFilter]);
  const metadataFilterParams = useMemo(
    () => JSON.parse(metadataFilterKey) as Record<string, string>,
    [metadataFilterKey],
  );
  const documentListParams = useMemo(
    () => ({
      search: searchQuery || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      template_type: typeFilter === 'ALL' ? undefined : typeFilter,
      artifact_type: artifactFilter === 'ALL' ? undefined : artifactFilter,
      organization_unit_id: organizationUnitFilter || undefined,
      metadata_filter: Object.keys(metadataFilterParams).length > 0 ? metadataFilterParams : undefined,
      updated_from: updatedFrom ? new Date(updatedFrom).toISOString() : undefined,
      updated_to: updatedTo ? new Date(`${updatedTo}T23:59:59.999`).toISOString() : undefined,
      page: pagination.page,
      page_size: pageSize,
      sort: 'desc:updated_at',
    }),
    [
      searchQuery,
      statusFilter,
      typeFilter,
      artifactFilter,
      organizationUnitFilter,
      metadataFilterKey,
      updatedFrom,
      updatedTo,
      pagination.page,
      pageSize,
    ],
  );
  const templateTypeLabelMap = useMemo(
    () => new Map(templateTypeOptions.map((option) => [option.value, option.label])),
    [templateTypeOptions],
  );
  const activeFilterFields = useMemo(
    () => getFilterFieldsForType(documentFilterConfig, typeFilter),
    [documentFilterConfig, typeFilter],
  );
  const reportCards = useMemo<TReportCard[]>(() => {
    return [
      {
        key: 'total',
        label: t('documentsPage.stats.total'),
        description: t('documentsPage.stats.currentFilter'),
        value: reportSummary?.total ?? 0,
        icon: <Files className="size-5" />,
        accentClassName: 'border-blue-500 bg-blue-50 text-blue-700',
        active: true,
      },
      {
        key: 'draft',
        label: t('documentsPage.stats.draft'),
        description: t('documentsPage.stats.drafting'),
        value: reportSummary?.draft ?? 0,
        icon: <FileDraftIcon />,
        accentClassName: 'border-slate-400 bg-slate-50 text-slate-700',
      },
      {
        key: 'pending',
        label: t('documentsPage.stats.pending'),
        description: t('documentsPage.stats.pendingDescription'),
        value: reportSummary?.pending ?? 0,
        icon: <Clock3 className="size-5" />,
        accentClassName: 'border-amber-500 bg-amber-50 text-amber-700',
      },
      {
        key: 'approved',
        label: t('documentsPage.stats.approved'),
        description: t('documentsPage.stats.readyToPublish'),
        value: reportSummary?.approved ?? 0,
        icon: <CheckCircle2 className="size-5" />,
        accentClassName: 'border-emerald-500 bg-emerald-50 text-emerald-700',
      },
      {
        key: 'rejected',
        label: t('documentsPage.stats.rejected'),
        description: t('documentsPage.stats.needsRevision'),
        value: reportSummary?.rejected ?? 0,
        icon: <Send className="size-5 rotate-180" />,
        accentClassName: 'border-rose-500 bg-rose-50 text-rose-700',
      },
    ];
  }, [reportSummary, t]);

  useEffect(() => {
    let cancelled = false;

    void getMetadataByKeyAPI<MetadataOption[]>('TEMPLATE_TYPE')
      .then((metadata) => {
        if (!cancelled) setTemplateTypeOptions(metadata.meta_values ?? []);
      })
      .catch(() => {
        if (!cancelled) setTemplateTypeOptions([]);
      });

    void getMetadataByKeyAPI<FilterConfigMetaValues>('FILTER_CONFIG')
      .then((record) => {
        if (!cancelled) setDocumentFilterConfig(getDocumentFilterConfigByType(record.meta_values));
      })
      .catch(() => {
        if (!cancelled) setDocumentFilterConfig({});
      });

    void adminListOrganizationUnitsAPI()
      .then((units) => {
        if (!cancelled) setOrganizationUnitOptions(units.map(getOrganizationUnitOption));
      })
      .catch(() => {
        if (!cancelled) setOrganizationUnitOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await listDocumentsAPI(documentListParams);

      setDocuments(res.data);
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
        message: t('documentsPage.messages.loadFailed', { error: getErrorMessage(error) }),
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [documentListParams, t]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    let cancelled = false;

    void getDocumentReportSummaryAPI({
      template_type: typeFilter === 'ALL' ? undefined : typeFilter,
      artifact_type: artifactFilter === 'ALL' ? undefined : artifactFilter,
      organization_unit_id: organizationUnitFilter || undefined,
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
  }, [artifactFilter, typeFilter, organizationUnitFilter, updatedFrom, updatedTo]);

  const handleDelete = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmDelete', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('delete', row.id))) return;

      try {
        await deleteDocumentAPI(row.id);
        setToast({
          message: t('documentsPage.messages.deleted'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.deleteFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handleApprove = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmApprove', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('approve', row.id))) return;

      try {
        await approveDocumentAPI(row.id);
        setToast({
          message: t('documentsPage.messages.approved'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.approveFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handleReturnToDraft = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmReturnDraft', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('return-draft', row.id))) return;

      try {
        await returnDocumentToDraftAPI(row.id);
        setToast({
          message: t('documentsPage.messages.returnedDraft'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.returnDraftFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handlePublish = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmPublish', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('publish', row.id))) return;

      try {
        await publishDocumentAPI(row.id);
        setToast({
          message: t('documentsPage.messages.published'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.publishFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handleUnpublish = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmUnpublish', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('unpublish', row.id))) return;

      try {
        await unpublishDocumentAPI(row.id);
        setToast({
          message: t('documentsPage.messages.unpublished'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.unpublishFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handleOpenTemplateFile = useCallback(
    async (row: DocumentRow, canOpenDetail: boolean) => {
      const template = row.template;
      if (!template) return;

      if (canOpenDetail) {
        openPathInNewTab(`/templates/${template.id}`);
        return;
      }

      let previewWindow: Window | null = null;

      try {
        previewWindow = openDocxExportPreviewWindow();

        const templateDetail = await getTemplateByIdAPI(template.id).catch(() => null);
        const previewInput = templateDetail
          ? buildTemplateExportPreviewInput(templateDetail)
          : buildDocumentExportPreviewInput(await getDocumentByIdAPI(row.id));
        const payload = await writeDocxExportPreviewPayload(previewInput);
        navigateDocxExportPreviewWindow(previewWindow, payload.id);
      } catch (error: unknown) {
        previewWindow?.close();
        setToast({
          message: t('documentsPage.messages.openTemplateFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      }
    },
    [t],
  );

  const columns = useMemo(
    () =>
      getColumns(
        navigate,
        pagination.page,
        pageSize,
        (template_type) =>
          (template_type ? templateTypeLabelMap.get(template_type) : undefined) ?? template_type ?? '-',
        t,
        isAdmin,
        canOpenTemplateDetail,
        pendingActionKey,
        handleOpenTemplateFile,
        handleApprove,
        handleReturnToDraft,
        handlePublish,
        handleUnpublish,
        handleDelete,
        setSelectedDocument,
      ),
    [
      handleApprove,
      canOpenTemplateDetail,
      handleDelete,
      handleOpenTemplateFile,
      handlePublish,
      handleReturnToDraft,
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
      {/* ── Title & Export ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1B2559]">Published Documents</h1>
        <Button
          size="sm"
          className="h-10 rounded-xl bg-blue-600 px-6 font-bold hover:bg-blue-700">
          <Download className="mr-2 size-4" />
          Export Excel
        </Button>
      </div>

      {/* ── Tabs & View Toggle ── */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-8">
          <button className="border-b-2 border-blue-600 pb-3 text-sm font-bold text-blue-600">
            ALL (24)
          </button>
          <button className="border-b-2 border-transparent pb-3 text-sm font-bold text-[#A3AED0] hover:text-slate-600">
            ACADEMIC DOCS (12)
          </button>
          <button className="border-b-2 border-transparent pb-3 text-sm font-bold text-[#A3AED0] hover:text-slate-600">
            FINANCIAL (8)
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <div className="flex items-center rounded-xl bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <ReportCardGrid cards={reportCards} />

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="relative min-w-[280px] flex-1 md:max-w-lg">
            <Input
              type="text"
              placeholder={t('documentsPage.searchPlaceholder')}
              className="h-11 rounded-2xl border-slate-200 pl-10"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
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
                placeholder={t('documentsPage.fromDate')}
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
                placeholder={t('documentsPage.toDate')}
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
                <SelectValue placeholder={t('documentsPage.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('documentsPage.allTypes')}</SelectItem>
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
                <SelectValue placeholder={t('documentsPage.allFormats')} />
              </SelectTrigger>
              <SelectContent>
                {artifactFormatOptions.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {t(format.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchableSelect
              value={organizationUnitFilter || undefined}
              options={organizationUnitOptions}
              clearable
              placeholder={t('documentsPage.allUnits')}
              searchPlaceholder={t('documentsPage.searchUnits')}
              emptyMessage={t('documentsPage.noUnitResult')}
              onValueChange={(value) => {
                setOrganizationUnitFilter(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="h-11 w-64 rounded-2xl border-slate-200"
              contentClassName="w-72"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as 'ALL' | DocumentStatus);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}>
              <SelectTrigger className="h-11 w-[180px] rounded-2xl border-slate-200">
                <SelectValue placeholder={t('documentsPage.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                {quickFilters.map((filter) => (
                  <SelectItem key={filter.key} value={filter.key}>
                    {t(filter.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {activeFilterFields.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('documentsPage.metadata')}
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
                    searchPlaceholder={t('documentsPage.searchMetadata', { label: field.label.toLowerCase() })}
                    emptyMessage={t('documentsPage.noMetadataResult')}
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
                      <SelectItem value="ALL">{t('documentsPage.allOf', { label: field.label })}</SelectItem>
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
                {t('documentsPage.clearFilters')}
              </Button>
            )}
          </div>
        )}

        <div className="px-6 py-5">
          {viewMode === 'list' ? (
            <DataTable
              fixedHeader
              enableFreezeColumns
              columns={columns}
              data={documents}
              loading={isLoading}
              pagination={pagination}
              onPaginationChange={(updater) => setPagination((prev) => updater(prev))}
            />
          ) : (
            <DocumentGridView documents={documents} onSelectDocument={setSelectedDocument} />
          )}
        </div>
      </div>

      <DocumentSidePanel document={selectedDocument} onClose={() => setSelectedDocument(null)} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <DocumentInputAgentWidget />
    </div>
  );
};
