import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ClassicEditor } from 'ckeditor5';
import {
  Braces,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  FileText,
  Home,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Save,
  Send,
  Upload,
  XCircle,
} from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'reactjs-platform/ui';
import { isAdmin as isAdminProfile, isRootProfile, profileStore } from 'reactjs-platform/utilities';
import {
  approveDocumentAPI,
  applyLabelExpr,
  deleteDocumentAPI,
  exportArtifactAPI,
  exportOfficeArtifactAPI,
  extractWordDocumentAPI,
  getDocumentByIdAPI,
  getDocumentFilterConfigByType,
  getFilterFieldsForType,
  getMetadataByKeyAPI,
  getTemplateEditorMetaAPI,
  getTemplateTableOptionsAPI,
  getTemplateVariableSettingsAPI,
  type IDocument,
  type IDocumentAuditLog,
  type IDocumentApprovalStep,
  type IDocumentExtractionAuditDetails,
  type FilterConfigByType,
  type FilterConfigMetaValues,
  type ITemplateMetadata,
  type TArtifactExportFormat,
  type TArtifactType,
  publishDocumentAPI,
  rejectDocumentAPI,
  returnDocumentToDraftAPI,
  submitDocumentAPI,
  unpublishDocumentAPI,
  updateDocumentAPI,
} from 'api';
import {
  ApprovalHistoryTimeline,
  ApprovalStatusBadge,
  ArtifactEditor,
  buildArtifactPlaceholderContent,
  createDefaultArtifactConfig,
  extractArtifactVariableKeys,
  getArtifactCatalogVariableKeys,
  getArtifactTypeLabel,
  normalizeArtifactType,
  OfficeArtifactEditor,
  OfficeArtifactSetupPanel,
  PagedDocumentPreview,
  Toast,
  type IOfficeArtifactEditorRef,
  type ToastProps,
  VariablePickerDialog,
  VariablesDrawer,
} from '../../../components';
import type { IDocxDocumentEditorHandle } from '../../../components/template/docx-document-editor';
import { useTranslation } from '../../../i18n';
import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS,
  TABLE_TEMPLATE_VARIABLE_NAMESPACE,
  DOCX_EDITOR_RENDERER_VERSION,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  applyVariablesToHtml,
  applyVariablesToHtmlWithHighlight,
  canUseLiveTemplateVariableConfig,
  createEditorConfig,
  createEditorContentKey,
  createDownloadFileName,
  createWordDocumentBuffer,
  exportToPdf,
  exportToWord,
  extractVariablesFromHtml,
  extractVariablesInOrder,
  formatDate,
  generateDocumentHtml,
  generateTableHtmlFromTableTemplate,
  getCurrentTemplateDocxEditorSnapshotBuffer,
  getDocumentEditorEngine,
  getDocumentTemplateById,
  getTableTemplateById,
  getTemplateVariableDocumentTemplateByKey,
  getTemplateVariableTableTemplateByKey,
  type IVariablePickerItem,
  hasInvalidTableTemplateHeaderTree,
  isCurrentTemplateDocxEditorSnapshot,
  attachFontSizeToolbarLabel,
  mergeDocumentTemplateStylesFromDefinition,
  mergeTableTemplateStylesFromDefinition,
  mergeTableTemplateWithRuntimeValues,
  normalizeEditorMeta,
  normalizeTemplateVariableRenderSettings,
  normalizeVariableHtml,
  rebuildRawContentFromRenderedHtml,
  replaceVariableState,
  replaceDocxVariablePlaceholders,
  registerMentionRichTextEditor,
  setDocumentTemplates,
  setEditorGlobalStyle,
  setForeignKeyMeta,
  setSchemaFieldCatalog,
  setTableTemplates,
  setTemplateVariableDefinitions,
  isDocxPreviewEditorEnabled,
  navigateDocxExportPreviewWindow,
  openDocxExportPreviewWindow,
  saveFile,
  writeDocxExportPreviewPayload,
  cleanupVariableWorkspaceDrafts,
  deleteVariableWorkspaceDraft,
  loadEditorRuntime,
  readVariableWorkspaceDraft,
  writeVariableWorkspaceDraft,
  type DocumentTemplate,
  type ExactSchemaCatalog,
  type TableTemplate,
  type TemplateDocxEditorSnapshot,
  type TemplateStructure,
  type TemplateVariablesPayload,
  type VariableKey,
  type VarTypes,
} from '../../../lib';
import { useSSE } from '../../../lib/sse/use-sse.hook';
import { buildDocumentExtractionStreamUrl } from '../../../api/notifications/notifications.api';
import type { INotificationEvent } from '../../../sections/notifications/extraction-notifications.type';
import type { IDocumentEditorPageProps } from './document-editor.type';

type DocumentEditorRuntime = Awaited<ReturnType<typeof loadEditorRuntime>>;
type TEditorDisplayMode = 'editor' | 'docx' | 'preview';
type TDocumentWorkflowAction = 'submit' | 'approve' | 'reject' | 'return-draft' | 'publish' | 'unpublish' | 'delete';

const DEFAULT_TEMPLATE = '';
const VARIABLE_RENDER_DEBOUNCE_MS = 1000;
const VARIABLE_DRAFT_AUTOSAVE_DELAY_MS = 800;
const WORD_UPLOAD_ACCEPT =
  '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORD_UPLOAD_EXTENSIONS = ['.doc', '.docx'] as const;

const getInitialEditorDisplayMode = (): TEditorDisplayMode =>
  getDocumentEditorEngine() === 'docx-editor' || isDocxPreviewEditorEnabled() ? 'docx' : 'editor';
type TTranslator = ReturnType<typeof useTranslation>['t'];

const LazyDocxDocumentEditor = lazy(() =>
  import('../../../components/template/docx-document-editor').then((module) => ({
    default: module.DocxDocumentEditor,
  })),
);

type ActiveWordExtraction = {
  dagRunId?: string;
  jobId?: string;
  templateName?: string;
  queuedAt: number;
};

const getExtractionAuditDetails = (log?: IDocumentAuditLog | null): IDocumentExtractionAuditDetails | null => {
  if (!log?.details || typeof log.details !== 'object') {
    return null;
  }

  return log.details as IDocumentExtractionAuditDetails;
};

const findMatchingExtractionCallbackLog = (
  audit_logs: IDocumentAuditLog[] | undefined,
  extraction: ActiveWordExtraction,
) => {
  if (!audit_logs?.length) {
    return null;
  }

  const sortedLogs = [...audit_logs].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );

  if (extraction.dagRunId) {
    for (const log of sortedLogs) {
      const details = getExtractionAuditDetails(log);
      if (details?.source !== 'word_extraction_callback') continue;
      if (details.dagRunId === extraction.dagRunId) {
        return { log, details };
      }
    }
  }

  for (const log of sortedLogs) {
    const details = getExtractionAuditDetails(log);
    if (details?.source !== 'word_extraction_callback') continue;

    const timestamp = new Date(log.timestamp).getTime();
    if (Number.isNaN(timestamp)) continue;
    if (timestamp >= extraction.queuedAt) {
      return { log, details };
    }
  }

  return null;
};

const toDocumentActivityLogs = (audit_logs: IDocumentAuditLog[] | undefined) =>
  (audit_logs ?? []).map((log) => {
    const timestamp = new Date(log.timestamp).getTime();

    return {
      _id: log.id,
      document_id: log.document_id,
      action: log.action,
      performed_by: log.performed_by,
      previous_status: log.previous_status ?? undefined,
      new_status: log.new_status ?? undefined,
      details: (log.details as Record<string, unknown> | null) ?? undefined,
      timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    };
  });

const isSupportedWordUploadFile = (fileName: string) => {
  const normalizedName = fileName.toLowerCase();
  return WORD_UPLOAD_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
};

const getErrorMessage = (error: unknown, fallback = 'Unknown error') => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
};

const getDocumentMetadata = (document?: IDocument | null): ITemplateMetadata => {
  const metadata = document?.document_metadata ?? document?.documentMetadata;
  return metadata && typeof metadata === 'object' ? (metadata as ITemplateMetadata) : {};
};

const syncDocumentState = (
  data: IDocument,
  setters: {
    setDocument: (value: IDocument) => void;
    setTitle: (value: string) => void;
    setDescription: (value: string) => void;
    setDocumentMetadata: (value: ITemplateMetadata) => void;
    setOriginalTitle: (value: string) => void;
    setOriginalDescription: (value: string) => void;
    setOriginalDocumentMetadata: (value: ITemplateMetadata) => void;
  },
) => {
  const nextDocumentMetadata = getDocumentMetadata(data);

  setters.setDocument(data);
  setters.setTitle(data.title);
  setters.setDescription(data.description ?? '');
  setters.setDocumentMetadata(nextDocumentMetadata);
  setters.setOriginalTitle(data.title);
  setters.setOriginalDescription(data.description ?? '');
  setters.setOriginalDocumentMetadata(nextDocumentMetadata);
};

interface IExtractionLoadingBannerProps {
  statusText: string;
}

const ExtractionLoadingBanner = ({ statusText }: IExtractionLoadingBannerProps) => {
  const { t } = useTranslation();

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.24),_transparent_42%),linear-gradient(135deg,_#fff8e7_0%,_#fff4d6_100%)] px-4 py-3 text-amber-900 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/85 shadow-sm">
          <span className="size-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{t('documentDetail.extraction.bannerTitle')}</span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500 [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500 [animation-delay:300ms]" />
            </span>
          </div>
          <p className="mt-1 text-sm text-amber-800">{statusText}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 animate-pulse" />
      </div>
    </div>
  );
};

const useVariableCatalog = (
  template_type?: string | null,
  artifact_type?: TArtifactType,
): { catalog: ExactSchemaCatalog; ready: boolean } => {
  const [catalog, setCatalog] = useState<ExactSchemaCatalog>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setReady(false);

    void getTemplateEditorMetaAPI({
      template_type: template_type || undefined,
      artifact_type,
    })
      .then((data) => {
        if (cancelled) return;

        const normalized = normalizeEditorMeta(data);

        setCatalog(normalized.schema_field_catalog);
        setSchemaFieldCatalog(normalized.schema_field_catalog);
        setForeignKeyMeta(normalized.foreign_key_meta);
        setTableTemplates(normalized.table_templates);
        setDocumentTemplates(normalized.document_templates);
        setTemplateVariableDefinitions(normalized.variable_definitions);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog({});
        setSchemaFieldCatalog({});
        setForeignKeyMeta({});
        setTableTemplates([]);
        setDocumentTemplates([]);
        setTemplateVariableDefinitions([]);
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [artifact_type, template_type]);

  return { catalog, ready };
};

const toUiStatus = (status?: string | null) => {
  return (
    {
      DRAFT: 'Draft',
      SUBMITTED: 'Submitted',
      APPROVAL: 'Approval',
      IN_REVIEW: 'Approval',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled',
    }[status ?? ''] ??
    status ??
    'Draft'
  );
};

const getDocumentDisplayStatus = (document?: IDocument | null) => {
  if (!document) return 'Draft';
  if (document.is_published) return 'Published';
  return toUiStatus(document.status);
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

  if (typeof value === 'object') {
    return value as TemplateVariablesPayload;
  }

  return null;
};

const normalizeCompletedVariableKeys = (value: unknown, allowedKeys?: string[]) => {
  if (!Array.isArray(value)) return [];

  const requestedKeys = new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''));

  if (!allowedKeys) {
    return Array.from(requestedKeys);
  }

  return allowedKeys.filter((key) => requestedKeys.has(key));
};

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((item, index) => item === right[index]);

const getLatestRejectionNote = (document?: IDocument | null) => {
  const currentReason = document?.rejection_reason?.trim();
  if (currentReason) {
    return { reason: currentReason };
  }

  const latestRejectedLog = document?.audit_logs?.find((log) => {
    const reason = log.details?.rejection_reason;
    return log.action === 'REJECTED' && typeof reason === 'string' && reason.trim().length > 0;
  });

  const reason = latestRejectedLog?.details?.rejection_reason;
  if (typeof reason !== 'string' || !reason.trim()) {
    return null;
  }

  return {
    reason: reason.trim(),
    performed_by: latestRejectedLog?.performed_by,
    timestamp: latestRejectedLog?.timestamp,
  };
};

interface IRejectReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  isLoading: boolean;
}

const RejectReasonModal = ({ open, onClose, onConfirm, isLoading }: IRejectReasonModalProps) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const reasonFieldId = useId();

  useEffect(() => {
    if (!open) {
      setReason('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isLoading) return;
        if (!nextOpen) onClose();
      }}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {t('documentDetail.rejectModal.title')}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-500">
            {t('documentDetail.rejectModal.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <label htmlFor={reasonFieldId} className="text-sm font-semibold text-slate-900">
              {t('documentDetail.rejectModal.reason')}
            </label>
            <Textarea
              id={reasonFieldId}
              className="min-h-32 rounded-xl border-slate-200 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('documentDetail.rejectModal.placeholder')}
            />
            <div className="text-xs text-slate-500">
              {t('documentDetail.rejectModal.minChars', { count: reason.trim().length })}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="h-11 rounded-xl px-5">
            {t('documentDetail.rejectModal.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm(reason)}
            disabled={isLoading || reason.trim().length < 3}
            className="h-11 rounded-xl px-5">
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {isLoading ? t('documentDetail.rejectModal.rejecting') : t('documentDetail.rejectModal.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const getApprovalStepTone = (
  step: IDocumentApprovalStep,
  current_step_key: string | null | undefined,
  t: TTranslator,
) => {
  if (step.status === 'APPROVED') {
    return {
      icon: <CheckCircle2 className="size-4" />,
      dot: 'bg-emerald-500 text-white',
      line: 'bg-emerald-200',
      card: 'border-emerald-200 bg-emerald-50/70',
      text: 'text-emerald-700',
      label: t('documentDetail.approvalFlow.approved'),
    };
  }

  if (step.status === 'REJECTED') {
    return {
      icon: <XCircle className="size-4" />,
      dot: 'bg-rose-500 text-white',
      line: 'bg-rose-200',
      card: 'border-rose-200 bg-rose-50/70',
      text: 'text-rose-700',
      label: t('documentDetail.approvalFlow.rejected'),
    };
  }

  if (step.step_key === current_step_key || step.status === 'ASSIGNED' || step.status === 'WAITING_ASSIGNMENT') {
    return {
      icon: <Clock3 className="size-4" />,
      dot: 'bg-amber-500 text-white',
      line: 'bg-slate-200',
      card: 'border-amber-200 bg-amber-50/80',
      text: 'text-amber-700',
      label:
        step.status === 'WAITING_ASSIGNMENT'
          ? t('documentDetail.approvalFlow.waitingAssignment')
          : t('documentDetail.approvalFlow.processing'),
    };
  }

  return {
    icon: <Circle className="size-4" />,
    dot: 'bg-slate-200 text-slate-500',
    line: 'bg-slate-200',
    card: 'border-slate-200 bg-white',
    text: 'text-slate-500',
    label: t('documentDetail.approvalFlow.notYet'),
  };
};

const RIGHT_SIDEBAR_CARD_CLASS_NAME = 'border-b border-slate-100 last:border-b-0';
const RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME =
  'w-full px-5 py-4 hover:no-underline [&[data-state=open]]:border-b [&[data-state=open]]:border-slate-100';
const RIGHT_SIDEBAR_CARD_BODY_CLASS_NAME = 'px-5 py-5';

const ApprovalWorkflowPanel = ({ document, embedded = false }: { document: IDocument | null; embedded?: boolean }) => {
  const { t } = useTranslation();
  const approval = document?.approval;

  if (!approval || approval.steps.length === 0) {
    return (
      <div className={embedded ? 'space-y-3' : 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm'}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-700">{t('documentDetail.approvalFlow.title')}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            {t('documentDetail.approvalFlow.notSubmitted')}
          </span>
        </div>
        <p className="mt-3 text-sm leading-5 text-slate-500">{t('documentDetail.approvalFlow.noFlowDescription')}</p>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{t('documentDetail.approvalFlow.title')}</p>
          <p className="mt-1 text-xs text-slate-500">
            {t('documentDetail.approvalFlow.stepProgress', {
              current: approval.current_step_order ?? approval.total_steps,
              total: approval.total_steps,
              status: approval.status,
            })}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
          {approval.current_step?.label ?? t('documentDetail.approvalFlow.completed')}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {approval.steps.map((step, index) => {
          const tone = getApprovalStepTone(step, approval.current_step_key, t);
          const isLast = index === approval.steps.length - 1;
          const stepOrganizationLabel = step.target_organization_unit_name?.trim();

          return (
            <div key={step.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <div className="flex flex-col items-center">
                <div className={`flex size-7 items-center justify-center rounded-full ${tone.dot}`}>{tone.icon}</div>
                {!isLast && <div className={`mt-1 h-full min-h-10 w-px ${tone.line}`} />}
              </div>
              <div className={`rounded-lg border px-3 py-2.5 ${tone.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold leading-5 text-slate-900">
                      {t('documentDetail.approvalFlow.stepLabel', {
                        order: step.step_order,
                        label: step.label,
                      })}
                    </div>
                    {stepOrganizationLabel && (
                      <div className="mt-0.5 break-words text-xs leading-4 text-slate-500">{stepOrganizationLabel}</div>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-semibold ${tone.text}`}>{tone.label}</span>
                </div>

                <div className="mt-2 rounded-md bg-white/70 px-2 py-1.5 text-xs leading-4 text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-700">{t('documentDetail.approvalFlow.assignee')}</span>{' '}
                    {step.assigned_to_label ??
                      (step.status === 'WAITING_ASSIGNMENT'
                        ? t('documentDetail.approvalFlow.waitingManagerAssignment')
                        : '-')}
                  </div>
                  {step.deadline_at && (
                    <div className="mt-0.5">
                      <span className="font-semibold text-slate-700">{t('documentDetail.approvalFlow.deadline')}</span>{' '}
                      {formatDate(step.deadline_at)}
                    </div>
                  )}
                  {step.acted_at && (
                    <div className="mt-0.5">
                      <span className="font-semibold text-slate-700">{t('documentDetail.approvalFlow.acted_at')}</span>{' '}
                      {formatDate(step.acted_at)}
                    </div>
                  )}
                  {step.reason?.trim() && (
                    <div className="mt-2 rounded-md border border-rose-100 bg-rose-50 px-2 py-1.5 text-rose-700">
                      <div className="font-semibold">{t('documentDetail.approvalFlow.reason')}</div>
                      <div className="mt-0.5 whitespace-pre-wrap break-words">{step.reason}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-slate-50 p-2">
          <div className="text-slate-400">{t('documentDetail.approvalFlow.current')}</div>
          <div className="mt-1 break-words font-semibold text-slate-800">
            {approval.current_step?.assigned_to_label ?? approval.current_step?.label ?? '-'}
          </div>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <div className="text-slate-400">{t('documentDetail.approvalFlow.next')}</div>
          <div className="mt-1 break-words font-semibold text-slate-800">
            {approval.next_step?.assigned_to_label ?? approval.next_step?.label ?? '-'}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DocumentEditorPage = ({ document_id, workspaceMode = false }: IDocumentEditorPageProps) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { zoom?: string };
  const { t } = useTranslation();
  const profile = profileStore((s) => s.profile);
  const isAdmin = isAdminProfile(profile) || isRootProfile(profile);
  const isWorkspaceZoomed = workspaceMode && (search.zoom === '1' || search.zoom === 'true');
  const defaultDocumentTitle = t('documentDetail.defaults.document');
  const tRef = useRef(t);

  const [document, setDocument] = useState<IDocument | null>(null);
  const [documentLoading, setDocumentLoading] = useState(true);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentMetadata, setDocumentMetadata] = useState<ITemplateMetadata>({});
  const [documentFilterConfig, setDocumentFilterConfig] = useState<FilterConfigByType>({});
  const currentTemplateType = document?.template?.template_type ?? null;
  const documentMetadataFields = useMemo(
    () => getFilterFieldsForType(documentFilterConfig, currentTemplateType),
    [currentTemplateType, documentFilterConfig],
  );

  const [value, setValue] = useState(DEFAULT_TEMPLATE);
  const [rawContent, setRawContent] = useState(DEFAULT_TEMPLATE);
  const [originalRawContent, setOriginalRawContent] = useState(DEFAULT_TEMPLATE);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [originalDocumentMetadata, setOriginalDocumentMetadata] = useState<ITemplateMetadata>({});
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [renderVarValues, setRenderVarValues] = useState<Record<string, string>>({});
  const [renderedVarValues, setRenderedVarValues] = useState<Record<string, string>>({});
  const [varTypes, setVarTypes] = useState<VarTypes>({});
  const [varTitles, setVarTitles] = useState<Record<string, string>>({});
  const [completedVarKeys, setCompletedVarKeys] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, TableTemplate>>({});
  const [selectedDocumentTemplates, setSelectedDocumentTemplates] = useState<Record<string, DocumentTemplate>>({});
  const [documentTemplateValues, setDocumentTemplateValues] = useState<Record<string, Record<string, string>>>({});
  const [docxEditorSnapshot, setDocxEditorSnapshot] = useState<TemplateDocxEditorSnapshot | null>(null);
  const [artifactType, setArtifactType] = useState<TArtifactType>('rich_text');
  const [artifactState, setArtifactState] = useState<unknown>(createDefaultArtifactConfig('rich_text'));
  const [originalArtifactType, setOriginalArtifactType] = useState<TArtifactType>('rich_text');
  const [originalArtifactState, setOriginalArtifactState] = useState<unknown>(createDefaultArtifactConfig('rich_text'));
  const [templateVariableSettings, setTemplateVariableSettings] = useState(DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS);
  const [templateVariableSettingsReady, setTemplateVariableSettingsReady] = useState(false);
  const [variableStateLoadedKey, setVariableStateLoadedKey] = useState('');
  const [variableDraftDirty, setVariableDraftDirty] = useState(false);
  const [varsInDoc, setVarsInDoc] = useState<VariableKey[]>([]);
  const [editorDisplayMode, setEditorDisplayMode] = useState<TEditorDisplayMode>(getInitialEditorDisplayMode);

  const [toast, setToast] = useState<ToastProps | null>(null);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<TDocumentWorkflowAction | null>(null);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSubmitConfirmDialog, setShowSubmitConfirmDialog] = useState(false);
  const [showApproveConfirmDialog, setShowApproveConfirmDialog] = useState(false);
  const [rejectConfirmationReason, setRejectConfirmationReason] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeExtraction, setActiveExtraction] = useState<ActiveWordExtraction | null>(null);
  const [extractionStatusText, setExtractionStatusText] = useState<string | null>(null);
  const [editorRuntime, setEditorRuntime] = useState<DocumentEditorRuntime | null>(null);
  const [editorConfig, setEditorConfig] = useState<Awaited<ReturnType<typeof createEditorConfig>> | null>(null);
  const [showSaveBeforeVariablesDialog, setShowSaveBeforeVariablesDialog] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    setTemplateVariableSettingsReady(false);
    void getTemplateVariableSettingsAPI()
      .then((settings) => {
        if (!cancelled) {
          const normalizedSettings = normalizeTemplateVariableRenderSettings(settings);
          setEditorGlobalStyle(normalizedSettings.editor_style);
          setTemplateVariableSettings(normalizedSettings);
          setTemplateVariableSettingsReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEditorGlobalStyle(DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS.editor_style);
          setTemplateVariableSettings(DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS);
          setTemplateVariableSettingsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getMetadataByKeyAPI<FilterConfigMetaValues>('FILTER_CONFIG')
      .then((record) => {
        if (!cancelled) {
          setDocumentFilterConfig(getDocumentFilterConfigByType(record.meta_values));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentFilterConfig({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const editorRef = useRef<{ editor: ClassicEditor } | null>(null);
  const mentionEditorCleanupRef = useRef<(() => void) | null>(null);
  const officeArtifactEditorRef = useRef<IOfficeArtifactEditorRef | null>(null);
  const wordFileInputRef = useRef<HTMLInputElement | null>(null);
  const skipRawContentSyncRef = useRef(false);
  const rawContentRef = useRef(rawContent);
  const highlightRafIdRef = useRef<number | null>(null);
  const inspectorAttachedRef = useRef(false);
  const varValuesRef = useRef(varValues);
  const varTypesRef = useRef(varTypes);
  const varTitlesRef = useRef(varTitles);
  const completedVarKeysRef = useRef(completedVarKeys);
  const selectedTemplatesRef = useRef(selectedTemplates);
  const selectedDocumentTemplatesRef = useRef(selectedDocumentTemplates);
  const documentTemplateValuesRef = useRef(documentTemplateValues);
  const docxEditorSnapshotRef = useRef<TemplateDocxEditorSnapshot | null>(null);
  const workflowActionRef = useRef<TDocumentWorkflowAction | null>(null);
  const activeExtractionRef = useRef<ActiveWordExtraction | null>(null);
  const extractionRefreshInFlightRef = useRef(false);
  const variableDraftRestoreKeyRef = useRef<string | null>(null);
  const variableDraftAutosaveReadyRef = useRef(false);
  const variableDraftSkipNextWriteRef = useRef(false);

  const { catalog: variableCatalog, ready: variableCatalogReady } = useVariableCatalog(
    currentTemplateType,
    artifactType,
  );
  const artifactPlaceholderContent = useMemo(
    () => buildArtifactPlaceholderContent(artifactType, artifactState, document?.template?.source_file_name || ''),
    [artifactState, artifactType, document?.template?.source_file_name],
  );
  const artifactBindingKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...getArtifactCatalogVariableKeys(variableCatalog),
          ...extractArtifactVariableKeys(artifactState),
          ...varsInDoc,
        ]),
      ).sort(),
    [artifactState, variableCatalog, varsInDoc],
  );
  const handleInsertOfficeVariable = useCallback((item: IVariablePickerItem) => {
    if (!officeArtifactEditorRef.current) return;
    void officeArtifactEditorRef.current.insertVariable(item);
  }, []);
  const documentEditorEngine = useMemo(() => getDocumentEditorEngine(), []);
  const shouldUseDocxEditor = documentEditorEngine === 'docx-editor';
  const shouldUseDocxPreviewEditor = useMemo(() => isDocxPreviewEditorEnabled(), []);
  const shouldUseDocumentDocxTabs = shouldUseDocxEditor || shouldUseDocxPreviewEditor;
  const shouldUseCkEditorDocumentEditor = !shouldUseDocumentDocxTabs;
  const shouldPersistDocxEditorSnapshot = shouldUseDocxEditor || shouldUseDocxPreviewEditor;

  const rawStatus = document?.status;
  const isDocumentRouteRecordPending = !document || String(document.id) !== document_id;
  const uiStatus = getDocumentDisplayStatus(document);
  const latestRejectionNote = useMemo(() => getLatestRejectionNote(document), [document]);
  const documentActivityLogs = useMemo(() => toDocumentActivityLogs(document?.audit_logs), [document?.audit_logs]);
  const canEdit =
    !isDocumentRouteRecordPending &&
    (document?.permissions?.can_edit ?? (rawStatus === 'DRAFT' || rawStatus === 'REJECTED'));
  const isOfficeArtifact = artifactType === 'spreadsheet' || artifactType === 'presentation';
  const canUseOfficeArtifactEditor = isOfficeArtifact && Boolean(document_id);
  const officeRenderData = useMemo(() => {
    const templateStructures = Object.fromEntries(
      Object.entries(selectedTemplates)
        .filter(([, template]) => Boolean(template))
        .map(([varKey, template]) => [
          varKey,
          {
            base_template_id: template.id,
            template,
          },
        ]),
    );
    const documentTemplateStructures = Object.fromEntries(
      Object.entries(selectedDocumentTemplates)
        .filter(([, template]) => Boolean(template))
        .map(([varKey, template]) => [
          varKey,
          {
            base_template_id: template.id,
            template,
          },
        ]),
    );
    const nextData: Record<string, unknown> = {};

    if (Object.keys(templateStructures).length > 0) {
      nextData.template_structures = templateStructures;
    }

    if (Object.keys(documentTemplateStructures).length > 0) {
      nextData.document_template_structures = documentTemplateStructures;
    }

    if (Object.keys(documentTemplateValues).length > 0) {
      nextData.document_template_values = documentTemplateValues;
    }

    return Object.keys(nextData).length > 0 ? nextData : undefined;
  }, [documentTemplateValues, selectedDocumentTemplates, selectedTemplates]);
  const hasDocumentContent = artifactType !== 'rich_text' || value.trim().length > 0;
  const isDocumentSubmittableStatus = rawStatus === 'DRAFT' || rawStatus === 'REJECTED';
  const canSubmit =
    !isDocumentRouteRecordPending &&
    (Boolean(document?.permissions?.can_submit) ||
      (isAdmin && isDocumentSubmittableStatus && hasDocumentContent) ||
      (document?.permissions?.can_submit === undefined && canEdit && hasDocumentContent));
  const canDelete = !isDocumentRouteRecordPending && (document?.permissions?.can_delete ?? false);
  const currentApprovalStepStatus = document?.approval?.current_step?.status;
  const isCurrentApprovalStepActionable =
    !document?.approval ||
    currentApprovalStepStatus === 'ASSIGNED' ||
    currentApprovalStepStatus === 'WAITING_ASSIGNMENT';
  const isDocumentApprovableStatus = rawStatus === 'SUBMITTED' || rawStatus === 'APPROVAL' || rawStatus === 'IN_REVIEW';
  const isDocumentRejectableStatus =
    rawStatus === 'SUBMITTED' || rawStatus === 'APPROVAL' || rawStatus === 'IN_REVIEW' || rawStatus === 'APPROVED';
  const canApprove =
    !isDocumentRouteRecordPending &&
    (Boolean(document?.permissions?.can_approve) && isDocumentApprovableStatus
      ? true
      : isAdmin && isDocumentApprovableStatus && isCurrentApprovalStepActionable);
  const canReject =
    !isDocumentRouteRecordPending &&
    (Boolean(document?.permissions?.can_reject) && isDocumentRejectableStatus
      ? true
      : isAdmin && isDocumentRejectableStatus && isCurrentApprovalStepActionable);
  const canPublish =
    !isDocumentRouteRecordPending &&
    (document?.permissions?.can_publish ?? (isAdmin && rawStatus === 'APPROVED' && !document?.is_published));
  const canUnpublish =
    !isDocumentRouteRecordPending &&
    (document?.permissions?.can_unpublish ?? (isAdmin && Boolean(document?.is_published)));
  const canReturnToDraft = !isDocumentRouteRecordPending && Boolean(document?.permissions?.can_reset_to_draft);
  const isEditorReadOnly = !canEdit || isExtracting;
  const isWorkflowBusy = isSaving || isExtracting || workflowAction !== null;

  const startWorkflowAction = useCallback(
    (action: TDocumentWorkflowAction) => {
      if (workflowActionRef.current || isSaving || isExtracting) {
        return false;
      }

      workflowActionRef.current = action;
      setWorkflowAction(action);
      setIsSaving(true);
      return true;
    },
    [isExtracting, isSaving],
  );

  const finishWorkflowAction = useCallback(() => {
    workflowActionRef.current = null;
    setWorkflowAction(null);
    setIsSaving(false);
  }, []);

  useEffect(() => {
    if (shouldUseDocumentDocxTabs && editorDisplayMode === 'editor') {
      setEditorDisplayMode('docx');
    }
  }, [editorDisplayMode, shouldUseDocumentDocxTabs]);

  const refreshDocument = useCallback(async () => {
    setDocumentLoading(true);
    setDocumentError(null);

    try {
      const data = await getDocumentByIdAPI(document_id);
      syncDocumentState(data, {
        setDocument,
        setTitle,
        setDescription,
        setDocumentMetadata,
        setOriginalTitle,
        setOriginalDescription,
        setOriginalDocumentMetadata,
      });
      return data;
    } catch (error: any) {
      setDocumentError(error?.message ?? tRef.current('documentDetail.messages.loadFailed'));
      throw error;
    } finally {
      setDocumentLoading(false);
    }
  }, [document_id]);

  const refreshDocumentSilently = useCallback(async () => {
    const data = await getDocumentByIdAPI(document_id);
    syncDocumentState(data, {
      setDocument,
      setTitle,
      setDescription,
      setDocumentMetadata,
      setOriginalTitle,
      setOriginalDescription,
      setOriginalDocumentMetadata,
    });
    return data;
  }, [document_id]);

  useEffect(() => {
    void refreshDocument();
  }, [refreshDocument]);

  useEffect(() => {
    if (!shouldUseCkEditorDocumentEditor) {
      setEditorRuntime(null);
      return;
    }

    let cancelled = false;

    void loadEditorRuntime()
      .then((runtime) => {
        if (!cancelled) {
          setEditorRuntime(runtime);
        }
      })
      .catch((error) => {
        console.error('Failed to load CKEditor runtime', error);
        if (!cancelled) {
          setDocumentError(tRef.current('documentDetail.messages.loadEditorFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldUseCkEditorDocumentEditor]);

  const updateActiveExtraction = useCallback((nextExtraction: ActiveWordExtraction | null) => {
    activeExtractionRef.current = nextExtraction;
    setActiveExtraction(nextExtraction);
  }, []);

  const stopExtractionPolling = useCallback(
    (options?: { keepBusy?: boolean; clearStatusText?: boolean }) => {
      updateActiveExtraction(null);

      if (!options?.keepBusy) {
        setIsExtracting(false);
      }

      if (options?.clearStatusText !== false) {
        setExtractionStatusText(null);
      }
    },
    [updateActiveExtraction],
  );

  const sseUrl = document_id ? buildDocumentExtractionStreamUrl(document_id) : null;

  const handleExtractionEvent = useCallback(
    async (event: INotificationEvent) => {
      const activeExtraction = activeExtractionRef.current;
      if (!activeExtraction) return;

      if (
        activeExtraction.dagRunId &&
        event.payload?.dagRunId &&
        activeExtraction.dagRunId !== event.payload.dagRunId
      ) {
        return;
      }

      if (event.status === 'failed') {
        stopExtractionPolling();
        setToast({
          message: event.payload?.error?.trim()
            ? t('documentDetail.messages.extractionFailed', { error: event.payload.error })
            : t('documentDetail.messages.extractionFailedGeneric'),
          type: 'error',
        });
        return;
      }

      if (event.status === 'success') {
        stopExtractionPolling({ keepBusy: true, clearStatusText: false });
        setExtractionStatusText(t('documentDetail.extraction.doneRefreshing'));

        try {
          await refreshDocument();
          setToast({
            message: t('documentDetail.messages.extractionRefreshSuccess'),
            type: 'success',
          });
        } catch (error: unknown) {
          setToast({
            message: t('documentDetail.messages.extractionRefreshPartialFailed', {
              error: getErrorMessage(error, t('app.unexpectedError')),
            }),
            type: 'error',
          });
        } finally {
          setIsExtracting(false);
          setExtractionStatusText(null);
        }
      }
    },
    [refreshDocument, stopExtractionPolling, t],
  );

  useSSE<INotificationEvent>(sseUrl, { onMessage: (e) => void handleExtractionEvent(e) });

  useEffect(() => {
    if (!activeExtraction || !document?.audit_logs?.length) {
      return;
    }

    const matchedCallback = findMatchingExtractionCallbackLog(document.audit_logs, activeExtraction);
    if (!matchedCallback) {
      return;
    }

    if (matchedCallback.details?.status === 'failed') {
      stopExtractionPolling();
      setToast({
        message: matchedCallback.details.error?.trim()
          ? t('documentDetail.messages.extractionFailed', { error: matchedCallback.details.error })
          : t('documentDetail.messages.extractionFailedGeneric'),
        type: 'error',
      });
      return;
    }

    stopExtractionPolling({ keepBusy: true, clearStatusText: false });
    setExtractionStatusText(t('documentDetail.extraction.infoUpdated'));
    setToast({
      message: t('documentDetail.messages.extractionRefreshSuccess'),
      type: 'success',
    });
    setIsExtracting(false);
    setExtractionStatusText(null);
  }, [activeExtraction, document, stopExtractionPolling, t]);

  useEffect(() => {
    if (!activeExtraction) {
      extractionRefreshInFlightRef.current = false;
      return;
    }

    const pollForExtractionResult = async () => {
      if (extractionRefreshInFlightRef.current) {
        return;
      }

      extractionRefreshInFlightRef.current = true;

      try {
        await refreshDocumentSilently();
      } catch {
        // Ignore transient refresh failures while waiting for callback.
      } finally {
        extractionRefreshInFlightRef.current = false;
      }
    };

    const timeoutId = window.setTimeout(() => {
      void pollForExtractionResult();
    }, 2500);

    const intervalId = window.setInterval(() => {
      void pollForExtractionResult();
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      extractionRefreshInFlightRef.current = false;
    };
  }, [activeExtraction, refreshDocumentSilently]);

  const ensureDocumentTemplatePlaceholders = useCallback(
    (
      candidateRawContent: string,
      currentSelectedDocumentTemplates: Record<string, DocumentTemplate>,
      currentVarValues: Record<string, string>,
    ) => {
      let nextRaw = normalizeVariableHtml(candidateRawContent || '');
      const docVarKeys = Object.keys(currentSelectedDocumentTemplates || {});
      if (docVarKeys.length === 0) return nextRaw;

      const hasPlaceholder = (html: string, key: string) => {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`);
        return re.test(html);
      };

      const countPlaceholders = (html: string, key: string) => {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'g');
        return (html.match(re) || []).length;
      };

      docVarKeys.forEach((varKey) => {
        const placeholder = `{{${varKey}}}`;
        const renderedValue = normalizeVariableHtml(currentVarValues[varKey] || '');
        const placeholderCount = countPlaceholders(nextRaw, varKey);

        if (placeholderCount > 0) {
          if (renderedValue) {
            const cleanupSource = placeholder.repeat(placeholderCount + 1);
            let cleanedRaw = rebuildRawContentFromRenderedHtml(nextRaw, cleanupSource, { [varKey]: renderedValue });
            let afterCount = countPlaceholders(cleanedRaw, varKey);
            while (afterCount > placeholderCount) {
              const idx = cleanedRaw.lastIndexOf(placeholder);
              if (idx === -1) break;
              cleanedRaw = cleanedRaw.slice(0, idx) + cleanedRaw.slice(idx + placeholder.length);
              afterCount -= 1;
            }
            nextRaw = cleanedRaw;
          }
          return;
        }

        if (hasPlaceholder(nextRaw, varKey)) return;

        if (renderedValue) {
          const exactIdx = nextRaw.indexOf(renderedValue);
          if (exactIdx !== -1) {
            nextRaw = nextRaw.slice(0, exactIdx) + placeholder + nextRaw.slice(exactIdx + renderedValue.length);
            return;
          }

          const rebuilt = rebuildRawContentFromRenderedHtml(nextRaw, placeholder, { [varKey]: renderedValue });
          if (hasPlaceholder(rebuilt, varKey)) {
            nextRaw = rebuilt;
            return;
          }
        }

        // If the rendered block is gone, treat it as an intentional removal.
        // Re-adding the placeholder here makes deleted document-template
        // variables appear again at the end of the file.
      });

      return nextRaw;
    },
    [],
  );

  const applyVariableWorkspaceDraft = useCallback(
    (draftValues: {
      var_values?: Record<string, string>;
      var_types?: VarTypes;
      var_titles?: Record<string, string>;
      manually_completed_variables?: string[];
      selected_templates?: Record<string, TableTemplate>;
      selected_document_templates?: Record<string, DocumentTemplate>;
      document_template_values?: Record<string, Record<string, string>>;
    }) => {
      const nextVarValues = {
        ...varValuesRef.current,
        ...(draftValues.var_values ?? {}),
      };
      const nextVarTypes = {
        ...varTypesRef.current,
        ...(draftValues.var_types ?? {}),
      };
      const nextVarTitles = {
        ...varTitlesRef.current,
        ...(draftValues.var_titles ?? {}),
      };
      const nextCompletedVarKeys =
        draftValues.manually_completed_variables !== undefined
          ? normalizeCompletedVariableKeys(draftValues.manually_completed_variables)
          : completedVarKeysRef.current;
      const nextSelectedTemplates = {
        ...selectedTemplatesRef.current,
        ...(draftValues.selected_templates ?? {}),
      };
      const nextSelectedDocumentTemplates = {
        ...selectedDocumentTemplatesRef.current,
        ...(draftValues.selected_document_templates ?? {}),
      };
      const nextDocumentTemplateValues = {
        ...documentTemplateValuesRef.current,
        ...(draftValues.document_template_values ?? {}),
      };
      const currentRawContent = rawContentRef.current;
      const nextEditorDisplayHtml = applyVariablesToHtmlWithHighlight(currentRawContent, nextVarValues);

      varValuesRef.current = nextVarValues;
      varTypesRef.current = nextVarTypes;
      varTitlesRef.current = nextVarTitles;
      completedVarKeysRef.current = nextCompletedVarKeys;
      selectedTemplatesRef.current = nextSelectedTemplates;
      selectedDocumentTemplatesRef.current = nextSelectedDocumentTemplates;
      documentTemplateValuesRef.current = nextDocumentTemplateValues;

      setVarValues(nextVarValues);
      setRenderedVarValues(nextVarValues);
      setVarTypes(nextVarTypes);
      setVarTitles(nextVarTitles);
      setCompletedVarKeys(nextCompletedVarKeys);
      setSelectedTemplates(nextSelectedTemplates);
      setSelectedDocumentTemplates(nextSelectedDocumentTemplates);
      setDocumentTemplateValues(nextDocumentTemplateValues);
      setValue(nextEditorDisplayHtml);

      if (editorRef.current?.editor) {
        skipRawContentSyncRef.current = true;
        editorRef.current.editor.setData(nextEditorDisplayHtml);
      }
    },
    [],
  );

  const writeCurrentDocumentVariableDraft = useCallback(() => {
    if (!document) return Promise.resolve();

    return writeVariableWorkspaceDraft({
      scope: 'document',
      id: document.id,
      source_updated_at: document.updated_at,
      updated_at: Date.now(),
      var_values: varValuesRef.current,
      var_types: varTypesRef.current,
      var_titles: varTitlesRef.current,
      manually_completed_variables: completedVarKeysRef.current,
      selected_templates: selectedTemplatesRef.current,
      selected_document_templates: selectedDocumentTemplatesRef.current,
      document_template_values: documentTemplateValuesRef.current,
    });
  }, [document]);

  useEffect(() => {
    if (!variableCatalogReady || !templateVariableSettingsReady || !document) {
      return;
    }

    try {
      const loadedArtifactType = normalizeArtifactType(document.artifact_type || document.template?.artifact_type);
      const loadedArtifactState =
        document.artifact_state ??
        document.template?.artifact_config ??
        createDefaultArtifactConfig(loadedArtifactType);
      const loadedArtifactPlaceholderContent = buildArtifactPlaceholderContent(
        loadedArtifactType,
        loadedArtifactState,
        document.template?.source_file_name || '',
      );
      const storedContent =
        loadedArtifactType !== 'rich_text'
          ? loadedArtifactPlaceholderContent || document.content || DEFAULT_TEMPLATE
          : document.content || DEFAULT_TEMPLATE;
      setArtifactType(loadedArtifactType);
      setOriginalArtifactType(loadedArtifactType);
      setArtifactState(loadedArtifactState);
      setOriginalArtifactState(loadedArtifactState);
      const parsedData = parseVariablesPayload(document.data);

      if (parsedData) {
        const variablesArray = Array.isArray(parsedData.variables) ? parsedData.variables : [];
        const varTypesData = { ...(parsedData.var_types || {}) };
        const variablesObj = {} as Record<string, string>;

        variablesArray.forEach((item) => {
          variablesObj[item.key] = item.value;
        });

        Object.keys(variablesObj).forEach((varKey) => {
          if (!varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)) {
            return;
          }

          const docTemplateId = varKey.slice(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`.length);
          const docTemplate = getDocumentTemplateById(docTemplateId);
          if (docTemplate?.render_mode === 'raw_html') {
            variablesObj[varKey] = generateDocumentHtml(docTemplate, {});
            if (!varTypesData[varKey]) {
              varTypesData[varKey] = 'Document template';
            }
          }
        });

        const savedStructures = parsedData.template_structures || {};
        const savedDocumentStructures = parsedData.document_template_structures || {};
        const savedDocumentValues = parsedData.document_template_values || {};
        const useLiveVariableConfig = canUseLiveTemplateVariableConfig(templateVariableSettings, {
          status: document.status,
          is_published: document.is_published,
        });
        const resolveTableTemplate = (
          varKey: string,
          entry?: { template?: TableTemplate } | null,
        ): TableTemplate | undefined => {
          const savedTemplate = entry?.template;
          const inferredId =
            (savedTemplate && typeof savedTemplate.id === 'string' ? savedTemplate.id : undefined) ||
            (varKey.startsWith(`${TABLE_TEMPLATE_VARIABLE_NAMESPACE}.`)
              ? varKey.slice(`${TABLE_TEMPLATE_VARIABLE_NAMESPACE}.`.length)
              : '');
          const definitionTemplate =
            getTemplateVariableTableTemplateByKey(varKey, currentTemplateType) ??
            (inferredId ? getTableTemplateById(inferredId) : undefined);
          const shouldRefreshFromDefinition = Boolean(definitionTemplate?.refresh_from_definition_on_load);

          if (
            definitionTemplate &&
            (useLiveVariableConfig || shouldRefreshFromDefinition || hasInvalidTableTemplateHeaderTree(savedTemplate))
          ) {
            return mergeTableTemplateWithRuntimeValues(definitionTemplate, savedTemplate);
          }

          if (definitionTemplate && savedTemplate) {
            return mergeTableTemplateStylesFromDefinition(definitionTemplate, savedTemplate);
          }

          return savedTemplate || definitionTemplate;
        };

        const resolveDocumentTemplate = (
          varKey: string,
          entry?: { template?: DocumentTemplate } | null,
        ): DocumentTemplate | undefined => {
          const savedTemplate = entry?.template;
          const inferredId =
            (savedTemplate && typeof savedTemplate.id === 'string' ? savedTemplate.id : undefined) ||
            (varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)
              ? varKey.slice(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`.length)
              : '');
          const definitionTemplate =
            getTemplateVariableDocumentTemplateByKey(varKey, currentTemplateType) ??
            (inferredId ? getDocumentTemplateById(inferredId) : undefined);
          const shouldRefreshFromDefinition = Boolean(definitionTemplate?.refresh_from_definition_on_load);

          if (definitionTemplate && (useLiveVariableConfig || shouldRefreshFromDefinition)) {
            return definitionTemplate;
          }

          if (savedTemplate && definitionTemplate) {
            return mergeDocumentTemplateStylesFromDefinition(definitionTemplate, savedTemplate);
          }

          return savedTemplate || definitionTemplate;
        };

        Object.entries(savedStructures).forEach(([varKey, entry]) => {
          const resolvedTemplate = resolveTableTemplate(varKey, entry);
          if (resolvedTemplate) {
            variablesObj[varKey] = generateTableHtmlFromTableTemplate(resolvedTemplate, variablesObj);
          }
        });

        const restoredDocumentTemplates = {} as Record<string, DocumentTemplate>;
        Object.entries(savedDocumentStructures).forEach(([varKey, entry]) => {
          const resolvedTemplate = resolveDocumentTemplate(varKey, entry);
          if (!resolvedTemplate) return;

          restoredDocumentTemplates[varKey] = resolvedTemplate;
          if (
            useLiveVariableConfig ||
            resolvedTemplate.refresh_from_definition_on_load ||
            resolvedTemplate !== entry?.template ||
            !variablesObj[varKey]
          ) {
            variablesObj[varKey] = generateDocumentHtml(resolvedTemplate, savedDocumentValues[varKey] || {});
          }
        });

        const contentHasPlaceholders = /\{\{[^}]+\}\}/.test(storedContent);
        let resolvedRawContent = contentHasPlaceholders
          ? normalizeVariableHtml(storedContent)
          : normalizeVariableHtml(parsedData.raw_content || storedContent);

        Object.keys(savedDocumentStructures).forEach((varKey) => {
          if (!variablesObj[varKey]) return;
          if (resolvedRawContent.includes(`{{${varKey}}}`)) return;

          resolvedRawContent = rebuildRawContentFromRenderedHtml(resolvedRawContent, `{{${varKey}}}`, {
            [varKey]: variablesObj[varKey],
          });
        });
        resolvedRawContent = ensureDocumentTemplatePlaceholders(
          resolvedRawContent,
          restoredDocumentTemplates,
          variablesObj,
        );
        if (loadedArtifactType !== 'rich_text' && loadedArtifactPlaceholderContent) {
          resolvedRawContent = normalizeVariableHtml(loadedArtifactPlaceholderContent);
        }

        const loadedCompletedVarKeys = normalizeCompletedVariableKeys(
          parsedData.manually_completed_variables,
          extractVariablesInOrder(resolvedRawContent),
        );
        const highlightedContent = applyVariablesToHtmlWithHighlight(resolvedRawContent, variablesObj);

        skipRawContentSyncRef.current = true;
        setRawContent(resolvedRawContent);
        setValue(highlightedContent);
        setOriginalRawContent(resolvedRawContent);
        setVarValues(variablesObj);
        setRenderedVarValues(variablesObj);
        setVarTypes(varTypesData);
        setVarTitles({ ...(parsedData.var_titles || {}) });
        setCompletedVarKeys(loadedCompletedVarKeys);
        varValuesRef.current = variablesObj;
        varTypesRef.current = varTypesData;
        varTitlesRef.current = { ...(parsedData.var_titles || {}) };
        completedVarKeysRef.current = loadedCompletedVarKeys;

        const restoredTemplates = {} as Record<string, TableTemplate>;
        Object.entries(savedStructures).forEach(([varKey, entry]) => {
          const resolvedTemplate = resolveTableTemplate(varKey, entry);
          if (resolvedTemplate) {
            restoredTemplates[varKey] = resolvedTemplate;
          }
        });
        setSelectedTemplates(restoredTemplates);
        selectedTemplatesRef.current = restoredTemplates;

        setSelectedDocumentTemplates(restoredDocumentTemplates);
        selectedDocumentTemplatesRef.current = restoredDocumentTemplates;

        setDocumentTemplateValues(savedDocumentValues);
        documentTemplateValuesRef.current = savedDocumentValues;
        setDocxEditorSnapshot(parsedData.docx_editor_snapshot ?? null);
        docxEditorSnapshotRef.current = parsedData.docx_editor_snapshot ?? null;
        setDocxEditorDirty(false);
        setVariableDraftDirty(false);
        setVariableStateLoadedKey(`document:${document.id}:${document.updated_at}:variables`);
        return;
      }

      const nextStoredContent = normalizeVariableHtml(storedContent);
      setValue(nextStoredContent);
      setOriginalRawContent(nextStoredContent);
      setRawContent(nextStoredContent);
      setVarValues({});
      setRenderedVarValues({});
      setVarTypes({});
      setVarTitles({});
      setCompletedVarKeys([]);
      setSelectedTemplates({});
      setSelectedDocumentTemplates({});
      setDocumentTemplateValues({});
      setDocxEditorSnapshot(null);
      setDocxEditorDirty(false);
      varValuesRef.current = {};
      varTypesRef.current = {};
      varTitlesRef.current = {};
      completedVarKeysRef.current = [];
      selectedTemplatesRef.current = {};
      selectedDocumentTemplatesRef.current = {};
      documentTemplateValuesRef.current = {};
      docxEditorSnapshotRef.current = null;
      setVariableDraftDirty(false);
      setVariableStateLoadedKey(`document:${document.id}:${document.updated_at}:empty`);
    } catch (error: any) {
      setToast({
        message: tRef.current('documentDetail.messages.openFailed', { error: error.message }),
        type: 'error',
      });
    }
  }, [currentTemplateType, document, templateVariableSettings, templateVariableSettingsReady, variableCatalogReady]);

  useEffect(() => {
    if (!document || !variableStateLoadedKey) {
      variableDraftAutosaveReadyRef.current = false;
      return;
    }

    const restoreKey = `${document.id}:${document.updated_at}:${variableStateLoadedKey}`;
    if (variableDraftRestoreKeyRef.current === restoreKey) {
      return;
    }

    variableDraftRestoreKeyRef.current = restoreKey;
    variableDraftAutosaveReadyRef.current = false;
    let cancelled = false;

    void readVariableWorkspaceDraft('document', document.id)
      .then((draft) => {
        if (cancelled || !draft) return;
        if (draft.source_updated_at && draft.source_updated_at !== document.updated_at) return;

        applyVariableWorkspaceDraft({
          var_values: draft.var_values,
          var_types: draft.var_types,
          var_titles: draft.var_titles,
          manually_completed_variables: draft.manually_completed_variables,
          selected_templates: draft.selected_templates,
          selected_document_templates: draft.selected_document_templates,
          document_template_values: draft.document_template_values,
        });
        setVariableDraftDirty(true);
        setToast({
          message: tRef.current('documentDetail.messages.restoredUnsavedDraft'),
          type: 'info',
        });
      })
      .catch((error) => {
        console.warn('Cannot restore document variable draft.', error);
      })
      .finally(() => {
        if (!cancelled) {
          variableDraftAutosaveReadyRef.current = true;
          void cleanupVariableWorkspaceDrafts().catch(() => {});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyVariableWorkspaceDraft, document, variableStateLoadedKey]);

  useEffect(() => {
    if (!document || documentLoading || !variableDraftDirty || !variableDraftAutosaveReadyRef.current) {
      return;
    }

    if (variableDraftSkipNextWriteRef.current) {
      variableDraftSkipNextWriteRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writeCurrentDocumentVariableDraft().catch((error) => {
        console.warn('Cannot autosave document variable draft.', error);
      });
    }, VARIABLE_DRAFT_AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    document,
    documentLoading,
    completedVarKeys,
    documentTemplateValues,
    selectedDocumentTemplates,
    selectedTemplates,
    varTitles,
    varTypes,
    varValues,
    variableDraftDirty,
    writeCurrentDocumentVariableDraft,
  ]);

  useEffect(() => {
    if (!document || !variableDraftDirty) {
      return;
    }

    const flushDraft = () => {
      if (!variableDraftAutosaveReadyRef.current) return;

      void writeCurrentDocumentVariableDraft().catch((error) => {
        console.warn('Cannot flush document variable draft.', error);
      });
    };
    const flushDraftWhenHidden = () => {
      if (globalThis.document?.visibilityState === 'hidden') {
        flushDraft();
      }
    };

    window.addEventListener('pagehide', flushDraft);
    globalThis.document?.addEventListener('visibilitychange', flushDraftWhenHidden);

    return () => {
      window.removeEventListener('pagehide', flushDraft);
      globalThis.document?.removeEventListener('visibilitychange', flushDraftWhenHidden);
    };
  }, [document, variableDraftDirty, writeCurrentDocumentVariableDraft]);

  useEffect(() => {
    const vars = extractVariablesInOrder(rawContent) as VariableKey[];
    setVarsInDoc((prev) => (JSON.stringify(prev) === JSON.stringify(vars) ? prev : vars));
  }, [rawContent]);

  useEffect(() => {
    if (artifactType === 'rich_text' || !artifactPlaceholderContent) {
      return;
    }

    const nextRawContent = normalizeVariableHtml(artifactPlaceholderContent);
    const nextDisplayContent = applyVariablesToHtmlWithHighlight(nextRawContent, varValuesRef.current);

    setRawContent((prev) => (normalizeVariableHtml(prev) === nextRawContent ? prev : nextRawContent));
    setValue((prev) => (prev === nextDisplayContent ? prev : nextDisplayContent));
  }, [artifactPlaceholderContent, artifactType]);

  const updateMentionHighlights = useCallback((editor?: ClassicEditor) => {
    const instance = editor || editorRef.current?.editor;
    if (!instance) return;

    const view = instance.editing.view;
    view.change((writer) => {
      const root = view.document.getRoot();
      if (!root) return;

      const range = view.createRangeIn(root);
      for (const entry of range.getWalker({ ignoreElementEnd: true })) {
        const element = entry.item;
        if (!element.is('element')) continue;
        if (!element.hasClass('mention')) continue;

        const mentionAttr = element.getAttribute('data-mention');
        if (typeof mentionAttr !== 'string') continue;

        const key = mentionAttr.replace(/^\{\{|\}\}$/g, '');
        const currentValue = varValuesRef.current[key];
        const isFilled = currentValue !== undefined && currentValue !== null && String(currentValue).trim() !== '';

        writer.removeClass('mention-filled', element);
        writer.removeClass('mention-empty', element);
        writer.addClass(isFilled ? 'mention-filled' : 'mention-empty', element);
      }
    });
  }, []);

  const scheduleMentionHighlights = useCallback(
    (editor?: ClassicEditor) => {
      if (highlightRafIdRef.current !== null) {
        cancelAnimationFrame(highlightRafIdRef.current);
      }

      highlightRafIdRef.current = requestAnimationFrame(() => {
        highlightRafIdRef.current = null;
        updateMentionHighlights(editor);
      });
    },
    [updateMentionHighlights],
  );

  const handleEditorReady = useCallback(
    (editor: ClassicEditor) => {
      editorRef.current = { editor };
      attachFontSizeToolbarLabel(editor);
      mentionEditorCleanupRef.current?.();
      mentionEditorCleanupRef.current = registerMentionRichTextEditor(editor);

      if (
        import.meta.env.DEV &&
        import.meta.env.VITE_DISABLE_CK_INSPECTOR !== 'true' &&
        !inspectorAttachedRef.current
      ) {
        inspectorAttachedRef.current = true;
        import('@ckeditor/ckeditor5-inspector')
          .then((mod) => {
            const CKEditorInspector = mod.default;
            if (editorRef.current?.editor) {
              CKEditorInspector.attach(editorRef.current.editor);
            }
          })
          .catch(() => {});
      }

      scheduleMentionHighlights(editor);
    },
    [scheduleMentionHighlights],
  );

  useEffect(() => {
    return () => {
      mentionEditorCleanupRef.current?.();
      mentionEditorCleanupRef.current = null;
    };
  }, []);

  const contentForRender = useMemo(() => normalizeVariableHtml(rawContent), [rawContent]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRenderVarValues(varValues);
    }, VARIABLE_RENDER_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [varValues]);

  const renderedHtml = useMemo(
    () => applyVariablesToHtml(contentForRender, renderVarValues),
    [contentForRender, renderVarValues],
  );
  const renderedHtmlHighlighted = useMemo(
    () => applyVariablesToHtmlWithHighlight(contentForRender, renderVarValues),
    [contentForRender, renderVarValues],
  );

  rawContentRef.current = rawContent;
  varValuesRef.current = varValues;
  varTypesRef.current = varTypes;
  selectedTemplatesRef.current = selectedTemplates;
  selectedDocumentTemplatesRef.current = selectedDocumentTemplates;
  documentTemplateValuesRef.current = documentTemplateValues;
  docxEditorSnapshotRef.current = docxEditorSnapshot;

  useEffect(() => {
    void varValues;
    scheduleMentionHighlights();
  }, [scheduleMentionHighlights, varValues]);

  useEffect(() => {
    if (!shouldUseCkEditorDocumentEditor) {
      setEditorConfig(null);
      return;
    }

    if (!variableCatalogReady) {
      return;
    }

    let cancelled = false;
    setEditorConfig(null);

    void createEditorConfig(variableCatalog, handleEditorReady, currentTemplateType)
      .then((config) => {
        if (!cancelled) {
          setEditorConfig(config);
        }
      })
      .catch((error) => {
        console.error('Failed to create CKEditor config', error);
        if (!cancelled) {
          setDocumentError(tRef.current('documentDetail.messages.createEditorConfigFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentTemplateType, handleEditorReady, shouldUseCkEditorDocumentEditor, variableCatalog, variableCatalogReady]);

  const editorCatalogKey = useMemo(
    () => `${document_id}:${Object.keys(variableCatalog).sort().join('|')}`,
    [document_id, variableCatalog],
  );
  const docxDocumentEditorRef = useRef<IDocxDocumentEditorHandle | null>(null);
  const [docxEditorReady, setDocxEditorReady] = useState(false);
  const [docxEditorDirty, setDocxEditorDirty] = useState(false);
  const docxEditorHtmlContent = renderedHtml || value;
  const docxEditorHtmlContentKey = useMemo(
    () => createEditorContentKey(docxEditorHtmlContent),
    [docxEditorHtmlContent],
  );
  const initialDocxEditorBuffer = useMemo(() => {
    return getCurrentTemplateDocxEditorSnapshotBuffer(docxEditorSnapshot, docxEditorHtmlContentKey);
  }, [docxEditorHtmlContentKey, docxEditorSnapshot]);

  const CKEditorComponent = editorRuntime?.CKEditor;
  const ClassicEditorConstructor = editorRuntime?.ClassicEditor;

  const createDocxSnapshot = useCallback(
    (buffer: ArrayBuffer, htmlContentKeyOverride = docxEditorHtmlContentKey): TemplateDocxEditorSnapshot => ({
      base64: arrayBufferToBase64(buffer),
      file_name: `${document?.title || title || 'document'}.docx`,
      updated_at: new Date().toISOString(),
      source: 'docx-editor',
      html_content_key: htmlContentKeyOverride,
      renderer_version: DOCX_EDITOR_RENDERER_VERSION,
    }),
    [document?.title, docxEditorHtmlContentKey, title],
  );

  const persistCurrentDocxEditorSnapshot = useCallback(async () => {
    const savedBuffer = await docxDocumentEditorRef.current?.saveBuffer();
    if (!savedBuffer) {
      throw new Error('DOCX editor is not ready.');
    }

    const nextDocxEditorSnapshot = createDocxSnapshot(savedBuffer);
    setDocxEditorSnapshot(nextDocxEditorSnapshot);
    docxEditorSnapshotRef.current = nextDocxEditorSnapshot;
    setDocxEditorDirty(false);
    return nextDocxEditorSnapshot;
  }, [createDocxSnapshot]);

  const createDocxSnapshotFromHtml = useCallback(
    async (htmlContent: string, htmlContentKey = createEditorContentKey(htmlContent || '<p></p>')) => {
      const nextBuffer = await createWordDocumentBuffer(htmlContent || '<p></p>');
      const nextDocxEditorSnapshot = createDocxSnapshot(nextBuffer, htmlContentKey);
      setDocxEditorSnapshot(nextDocxEditorSnapshot);
      docxEditorSnapshotRef.current = nextDocxEditorSnapshot;
      setDocxEditorDirty(false);
      return nextDocxEditorSnapshot;
    },
    [createDocxSnapshot],
  );

  const savePendingDocxEditorSnapshot = useCallback(
    async (htmlContentOverride?: string) => {
      let nextDocxEditorSnapshot = docxEditorSnapshotRef.current;
      const nextDocxHtmlContent = (htmlContentOverride ?? docxEditorHtmlContent) || '<p></p>';
      const nextDocxHtmlContentKey = createEditorContentKey(nextDocxHtmlContent);

      const shouldCaptureDocxEditorSnapshot =
        shouldPersistDocxEditorSnapshot &&
        Boolean(docxDocumentEditorRef.current) &&
        (editorDisplayMode === 'docx' || shouldUseDocxEditor || docxEditorDirty);

      if (shouldCaptureDocxEditorSnapshot) {
        nextDocxEditorSnapshot = await persistCurrentDocxEditorSnapshot();
      } else if (shouldPersistDocxEditorSnapshot) {
        if (!isCurrentTemplateDocxEditorSnapshot(nextDocxEditorSnapshot, nextDocxHtmlContentKey)) {
          nextDocxEditorSnapshot = await createDocxSnapshotFromHtml(nextDocxHtmlContent, nextDocxHtmlContentKey);
        } else if (docxEditorDirty) {
          setDocxEditorDirty(false);
        }
      }

      return nextDocxEditorSnapshot;
    },
    [
      createDocxSnapshotFromHtml,
      docxEditorHtmlContent,
      docxEditorDirty,
      editorDisplayMode,
      persistCurrentDocxEditorSnapshot,
      shouldPersistDocxEditorSnapshot,
      shouldUseDocxEditor,
    ],
  );

  const resetDocxEditorSnapshot = useCallback(() => {
    setDocxEditorDirty(false);
    if (!shouldUseDocxPreviewEditor || !docxEditorSnapshotRef.current) {
      return;
    }

    setDocxEditorSnapshot(null);
    docxEditorSnapshotRef.current = null;
  }, [shouldUseDocxPreviewEditor]);

  const handleEditorDisplayModeChange = useCallback(
    async (nextMode: TEditorDisplayMode) => {
      if (nextMode === editorDisplayMode) {
        return;
      }

      if (shouldUseDocxPreviewEditor && editorDisplayMode === 'docx' && docxEditorDirty) {
        try {
          await persistCurrentDocxEditorSnapshot();
          setDocxEditorDirty(true);
        } catch (error: any) {
          setToast({
            message: t('documentDetail.messages.saveFailed', { error: error.message }),
            type: 'error',
          });
          return;
        }
      }

      setEditorDisplayMode(nextMode);
    },
    [docxEditorDirty, editorDisplayMode, persistCurrentDocxEditorSnapshot, shouldUseDocxPreviewEditor, t],
  );

  const docxEditorSourceKey = useMemo(
    () => ['document-docx', document_id, docxEditorSnapshot?.updated_at ?? 'html', docxEditorHtmlContentKey].join(':'),
    [document_id, docxEditorHtmlContentKey, docxEditorSnapshot?.updated_at],
  );

  const createDocxExportFileName = useCallback(
    (extension: 'docx' | 'pdf') => createDownloadFileName(document?.title || title || 'tai-lieu', extension),
    [document?.title, title],
  );

  const handleOpenDocxExportPreview = useCallback(async () => {
    let previewWindow: Window | null = null;

    try {
      previewWindow = openDocxExportPreviewWindow();
      setExportLoading('export');

      const wasDocxEditorDirty = docxEditorDirty;
      let initialDocumentBuffer: ArrayBuffer | null = null;

      if (docxDocumentEditorRef.current) {
        const savedBuffer = await docxDocumentEditorRef.current.saveBuffer();
        if (!savedBuffer) {
          throw new Error('DOCX editor is not ready.');
        }

        const nextDocxEditorSnapshot = createDocxSnapshot(savedBuffer);
        setDocxEditorSnapshot(nextDocxEditorSnapshot);
        docxEditorSnapshotRef.current = nextDocxEditorSnapshot;
        initialDocumentBuffer = savedBuffer;

        if (wasDocxEditorDirty) {
          setDocxEditorDirty(true);
        }
      } else if (docxEditorSnapshotRef.current?.base64) {
        initialDocumentBuffer = getCurrentTemplateDocxEditorSnapshotBuffer(
          docxEditorSnapshotRef.current,
          docxEditorHtmlContentKey,
        );
      }

      const payload = await writeDocxExportPreviewPayload({
        source: 'document',
        title: document?.title || title || defaultDocumentTitle,
        fileName: createDocxExportFileName('docx'),
        htmlContent: docxEditorHtmlContent || '<p></p>',
        initialDocumentBuffer,
      });

      navigateDocxExportPreviewWindow(previewWindow, payload.id);
    } catch (error: any) {
      previewWindow?.close();
      setToast({
        message: t('documentDetail.messages.exportWordFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  }, [
    createDocxExportFileName,
    createDocxSnapshot,
    defaultDocumentTitle,
    docxEditorDirty,
    docxEditorHtmlContent,
    docxEditorHtmlContentKey,
    document?.title,
    t,
    title,
  ]);

  const buildDocumentVariablesPayload = useCallback(
    (
      nextRawContent: string,
      currentVarValues: Record<string, string>,
      currentVarTypes: VarTypes,
      currentVarTitles: Record<string, string>,
      currentCompletedVarKeys: string[],
      currentSelectedTemplates: Record<string, TableTemplate>,
      currentSelectedDocumentTemplates: Record<string, DocumentTemplate>,
      currentDocumentTemplateValues: Record<string, Record<string, string>>,
      currentDocxEditorSnapshot?: TemplateDocxEditorSnapshot | null,
    ): TemplateVariablesPayload => {
      const templateStructures = {} as Record<string, TemplateStructure>;
      Object.entries(currentSelectedTemplates).forEach(([varKey, templateObj]) => {
        if (templateObj) {
          templateStructures[varKey] = {
            base_template_id: templateObj.id,
            template: templateObj,
          };
        }
      });

      const documentTemplateStructures = {} as Record<string, { base_template_id: string; template: DocumentTemplate }>;
      Object.entries(currentSelectedDocumentTemplates).forEach(([varKey, templateObj]) => {
        if (templateObj) {
          documentTemplateStructures[varKey] = {
            base_template_id: templateObj.id,
            template: templateObj,
          };
        }
      });

      const variableKeys = extractVariablesInOrder(nextRawContent);
      const normalizedCompletedVarKeys = normalizeCompletedVariableKeys(currentCompletedVarKeys, variableKeys);

      return {
        timestamp: new Date().toISOString(),
        variables: variableKeys.map((varKey) => ({
          key: varKey,
          value: currentVarValues[varKey] ?? '',
        })),
        var_types: currentVarTypes,
        ...(Object.keys(currentVarTitles).length > 0 ? { var_titles: currentVarTitles } : {}),
        ...(normalizedCompletedVarKeys.length > 0 ? { manually_completed_variables: normalizedCompletedVarKeys } : {}),
        raw_content: nextRawContent,
        ...(Object.keys(templateStructures).length > 0 ? { template_structures: templateStructures } : {}),
        ...(Object.keys(documentTemplateStructures).length > 0
          ? { document_template_structures: documentTemplateStructures }
          : {}),
        ...(Object.keys(currentDocumentTemplateValues).length > 0
          ? { document_template_values: currentDocumentTemplateValues }
          : {}),
        ...(currentDocxEditorSnapshot ? { docx_editor_snapshot: currentDocxEditorSnapshot } : {}),
      };
    },
    [],
  );

  const persistDocument = useCallback(
    async (
      overrideVarValues?: Record<string, string>,
      successMessage = t('documentDetail.messages.saved'),
      showSuccessToast = true,
      docxEditorSnapshotOverride: TemplateDocxEditorSnapshot | null | undefined = docxEditorSnapshotRef.current,
    ) => {
      if (!document) return;

      const currentVarValues = overrideVarValues || varValuesRef.current;
      const currentVarTypes = varTypesRef.current;
      const currentVarTitles = varTitlesRef.current;
      const currentCompletedVarKeys = completedVarKeysRef.current;
      const currentSelectedTemplates = selectedTemplatesRef.current;
      const currentSelectedDocumentTemplates = selectedDocumentTemplatesRef.current;
      const currentDocumentTemplateValues = documentTemplateValuesRef.current;
      const syncedRawContent = ensureDocumentTemplatePlaceholders(
        rawContent,
        currentSelectedDocumentTemplates,
        currentVarValues,
      );
      const variablesPayload = buildDocumentVariablesPayload(
        syncedRawContent,
        currentVarValues,
        currentVarTypes,
        currentVarTitles,
        currentCompletedVarKeys,
        currentSelectedTemplates,
        currentSelectedDocumentTemplates,
        currentDocumentTemplateValues,
        docxEditorSnapshotOverride,
      );

      if (isOfficeArtifact) {
        await officeArtifactEditorRef.current?.forceSave();
      }

      const updatedDocument = await updateDocumentAPI(document.id, {
        title: title.trim() || document.title,
        description: description.trim() || undefined,
        artifact_type: artifactType,
        content: syncedRawContent,
        data: variablesPayload.variables.length > 0 || variablesPayload.docx_editor_snapshot ? variablesPayload : null,
        artifact_state: artifactState,
        document_metadata: Object.keys(documentMetadata).length > 0 ? documentMetadata : null,
      });
      const savedDocumentMetadata = getDocumentMetadata(updatedDocument);

      const highlightedAfterSave = applyVariablesToHtmlWithHighlight(syncedRawContent, currentVarValues);

      setDocument(updatedDocument);
      setRawContent(syncedRawContent);
      setValue(highlightedAfterSave);
      setOriginalRawContent(syncedRawContent);
      setOriginalTitle(updatedDocument.title);
      setOriginalDescription(updatedDocument.description ?? '');
      setDocumentMetadata(savedDocumentMetadata);
      setOriginalDocumentMetadata(savedDocumentMetadata);
      setOriginalArtifactType(artifactType);
      setOriginalArtifactState(artifactState);
      setRenderedVarValues(currentVarValues);
      setDocxEditorSnapshot(docxEditorSnapshotOverride ?? null);
      docxEditorSnapshotRef.current = docxEditorSnapshotOverride ?? null;
      setVariableDraftDirty(false);
      variableDraftSkipNextWriteRef.current = true;
      void deleteVariableWorkspaceDraft('document', document.id).catch((error) => {
        console.warn('Cannot clear saved document variable draft.', error);
      });
      if (editorRef.current?.editor) {
        skipRawContentSyncRef.current = true;
        editorRef.current.editor.setData(highlightedAfterSave);
      }

      if (showSuccessToast) {
        setToast({
          message: successMessage,
          type: 'success',
        });
      }
    },
    [
      artifactState,
      artifactType,
      buildDocumentVariablesPayload,
      description,
      documentMetadata,
      document,
      ensureDocumentTemplatePlaceholders,
      isOfficeArtifact,
      rawContent,
      t,
      title,
    ],
  );

  const handleSaveDocument = useCallback(async () => {
    if (isSaving || isExtracting || workflowActionRef.current) return;

    try {
      setIsSaving(true);
      const nextDocxEditorSnapshot = await savePendingDocxEditorSnapshot();
      await persistDocument(undefined, t('documentDetail.messages.saved'), true, nextDocxEditorSnapshot);
      await refreshDocument();
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.saveFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [isExtracting, isSaving, persistDocument, refreshDocument, savePendingDocxEditorSnapshot, t]);

  const handleSaveVariables = useCallback(
    async (overrideVarValues: Record<string, string>) => {
      try {
        setIsSaving(true);
        const nextDocxEditorHtml = applyVariablesToHtml(contentForRender, overrideVarValues);
        const nextDocxEditorHtmlContentKey = createEditorContentKey(nextDocxEditorHtml);
        let nextDocxEditorSnapshot: TemplateDocxEditorSnapshot | null = null;
        const existingSnapshot = docxEditorSnapshotRef.current;

        if (shouldPersistDocxEditorSnapshot && existingSnapshot?.base64) {
          const patchedBuffer = await replaceDocxVariablePlaceholders(
            base64ToArrayBuffer(existingSnapshot.base64),
            overrideVarValues,
          );

          if (patchedBuffer) {
            nextDocxEditorSnapshot = createDocxSnapshot(patchedBuffer, nextDocxEditorHtmlContentKey);
            setDocxEditorSnapshot(nextDocxEditorSnapshot);
            docxEditorSnapshotRef.current = nextDocxEditorSnapshot;
            setDocxEditorDirty(false);
          }
        }

        if (!nextDocxEditorSnapshot) {
          nextDocxEditorSnapshot = await savePendingDocxEditorSnapshot(nextDocxEditorHtml);
        }

        await persistDocument(
          overrideVarValues,
          t('documentDetail.messages.saveVariablesSuccess'),
          true,
          nextDocxEditorSnapshot,
        );
        await refreshDocument();
      } catch (error: any) {
        setToast({
          message: t('documentDetail.messages.saveFailed', { error: error.message }),
          type: 'error',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      contentForRender,
      createDocxSnapshot,
      persistDocument,
      refreshDocument,
      savePendingDocxEditorSnapshot,
      shouldPersistDocxEditorSnapshot,
      t,
    ],
  );

  const handleReplaceVariable = useCallback(
    (oldVarKey: string, item: IVariablePickerItem) => {
      const newVarKey = item.key;

      if (oldVarKey === newVarKey) {
        return;
      }

      if (varsInDoc.includes(newVarKey)) {
        setToast({
          message: t('documentDetail.messages.duplicateVariable'),
          type: 'error',
        });
        return;
      }

      const replacedState = replaceVariableState({
        rawContent,
        oldVarKey,
        newVarKey,
        template_type: currentTemplateType,
        varValues: varValuesRef.current,
        varTypes: varTypesRef.current,
        varTitles: varTitlesRef.current,
        selectedTemplates: selectedTemplatesRef.current,
        selectedDocumentTemplates: selectedDocumentTemplatesRef.current,
        documentTemplateValues: documentTemplateValuesRef.current,
      });

      const nextRawContent = ensureDocumentTemplatePlaceholders(
        replacedState.rawContent,
        replacedState.selectedDocumentTemplates,
        replacedState.varValues,
      );

      setVarValues(replacedState.varValues);
      varValuesRef.current = replacedState.varValues;

      setVarTypes(replacedState.varTypes);
      varTypesRef.current = replacedState.varTypes;

      setVarTitles(replacedState.varTitles);
      varTitlesRef.current = replacedState.varTitles;

      const completedSet = new Set(completedVarKeysRef.current);
      if (completedSet.delete(oldVarKey)) {
        completedSet.add(newVarKey);
        const nextCompletedVarKeys = normalizeCompletedVariableKeys(Array.from(completedSet));
        completedVarKeysRef.current = nextCompletedVarKeys;
        setCompletedVarKeys(nextCompletedVarKeys);
      }

      setSelectedTemplates(replacedState.selectedTemplates);
      selectedTemplatesRef.current = replacedState.selectedTemplates;

      setSelectedDocumentTemplates(replacedState.selectedDocumentTemplates);
      selectedDocumentTemplatesRef.current = replacedState.selectedDocumentTemplates;

      setDocumentTemplateValues(replacedState.documentTemplateValues);
      documentTemplateValuesRef.current = replacedState.documentTemplateValues;

      setRawContent(nextRawContent);

      const nextRendered = applyVariablesToHtmlWithHighlight(nextRawContent, replacedState.varValues);
      setValue(nextRendered);
      setRenderedVarValues(replacedState.varValues);

      if (editorRef.current?.editor) {
        skipRawContentSyncRef.current = true;
        editorRef.current.editor.setData(nextRendered);
      }

      setToast({
        message: t('documentDetail.messages.replaceVariableSuccess', { label: item.label }),
        type: 'success',
      });
      setVariableDraftDirty(true);
    },
    [ensureDocumentTemplatePlaceholders, rawContent, t, varsInDoc],
  );

  const handleVarValuesChange = useCallback((updates: Record<string, string>) => {
    const next = { ...varValuesRef.current };
    let hasChanges = false;

    Object.entries(updates).forEach(([key, nextValue]) => {
      if (next[key] !== nextValue) {
        next[key] = nextValue;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;
    varValuesRef.current = next;
    setVarValues(next);
    setVariableDraftDirty(true);
  }, []);

  const handleVarTypesChange = useCallback((updates: VarTypes) => {
    const next = { ...varTypesRef.current };
    let hasChanges = false;

    Object.entries(updates).forEach(([key, nextValue]) => {
      if (next[key] !== nextValue) {
        next[key] = nextValue;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;
    varTypesRef.current = next;
    setVarTypes(next);
    setVariableDraftDirty(true);
  }, []);

  const handleCompletedVarKeysChange = useCallback(
    (nextKeys: string[]) => {
      const next = normalizeCompletedVariableKeys(nextKeys, varsInDoc);

      if (areStringArraysEqual(completedVarKeysRef.current, next)) {
        return;
      }

      completedVarKeysRef.current = next;
      setCompletedVarKeys(next);
      setVariableDraftDirty(true);
    },
    [varsInDoc],
  );

  const handleSelectedTemplatesChange = useCallback((updates: Record<string, TableTemplate | null>) => {
    const next = { ...selectedTemplatesRef.current };
    let hasChanges = false;

    Object.entries(updates).forEach(([key, nextValue]) => {
      if (nextValue == null) {
        if (key in next) {
          delete next[key];
          hasChanges = true;
        }
        return;
      }

      if (next[key] !== nextValue) {
        next[key] = nextValue;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;
    selectedTemplatesRef.current = next;
    setSelectedTemplates(next);
    setVariableDraftDirty(true);
  }, []);

  const handleSelectedDocumentTemplatesChange = useCallback((updates: Record<string, DocumentTemplate | null>) => {
    const next = { ...selectedDocumentTemplatesRef.current };
    let hasChanges = false;

    Object.entries(updates).forEach(([key, nextValue]) => {
      if (nextValue == null) {
        if (key in next) {
          delete next[key];
          hasChanges = true;
        }
        return;
      }

      if (next[key] !== nextValue) {
        next[key] = nextValue;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;
    selectedDocumentTemplatesRef.current = next;
    setSelectedDocumentTemplates(next);
    setVariableDraftDirty(true);
  }, []);

  const handleDocumentTemplateValuesChange = useCallback((varKey: string, values: Record<string, string>) => {
    const previousValues = documentTemplateValuesRef.current[varKey] ?? {};
    const mergedValues = { ...previousValues };
    let hasChanges = false;

    Object.entries(values).forEach(([key, nextValue]) => {
      if (mergedValues[key] !== nextValue) {
        mergedValues[key] = nextValue;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;

    const next = {
      ...documentTemplateValuesRef.current,
      [varKey]: mergedValues,
    };
    documentTemplateValuesRef.current = next;
    setDocumentTemplateValues(next);
    setVariableDraftDirty(true);
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (shouldUseDocxEditor || shouldUseDocxPreviewEditor) {
      await handleOpenDocxExportPreview();
      return;
    }

    try {
      setExportLoading('pdf');
      await exportToPdf(renderedHtml, createDownloadFileName(document?.title || title || 'tai-lieu', 'pdf'));
      setToast({
        message: t('documentDetail.messages.exportPdfSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.exportPdfFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  }, [
    document?.title,
    handleOpenDocxExportPreview,
    renderedHtml,
    shouldUseDocxEditor,
    shouldUseDocxPreviewEditor,
    t,
    title,
  ]);

  const handleExportWord = useCallback(async () => {
    if (shouldUseDocxEditor || shouldUseDocxPreviewEditor) {
      await handleOpenDocxExportPreview();
      return;
    }

    try {
      setExportLoading('word');
      await exportToWord(renderedHtml, createDownloadFileName(document?.title || title || 'tai-lieu', 'docx'));
      setToast({
        message: t('documentDetail.messages.exportWordSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.exportWordFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  }, [
    document?.title,
    handleOpenDocxExportPreview,
    renderedHtml,
    shouldUseDocxEditor,
    shouldUseDocxPreviewEditor,
    t,
    title,
  ]);

  const handleExportArtifact = useCallback(
    async (outputFormat?: TArtifactExportFormat) => {
      if (artifactType === 'rich_text') return;

      try {
        const resolvedFormat =
          outputFormat ?? (artifactType === 'spreadsheet' ? 'xlsx' : artifactType === 'presentation' ? 'pptx' : 'pdf');
        setExportLoading(`artifact-${resolvedFormat}`);
        if (isOfficeArtifact && document_id) {
          await officeArtifactEditorRef.current?.forceSave();
        }
        const blob =
          isOfficeArtifact && document_id
            ? await exportOfficeArtifactAPI(
                'document',
                document_id,
                resolvedFormat === 'pdf' ? 'pdf' : artifactType === 'spreadsheet' ? 'xlsx' : 'pptx',
              )
            : await exportArtifactAPI({
                artifact_type: artifactType,
                artifact_config: document?.template?.artifact_config,
                artifact_state: artifactState,
                output_format: resolvedFormat,
                file_name: document?.title || title || 'tai-lieu',
                values: renderedVarValues,
              });
        await saveFile(blob, createDownloadFileName(document?.title || title || 'tai-lieu', resolvedFormat));
        setToast({
          message: t('documentDetail.messages.exportPdfSuccess'),
          type: 'success',
        });
      } catch (error: any) {
        setToast({
          message: t('documentDetail.messages.exportPdfFailed', { error: error.message }),
          type: 'error',
        });
      } finally {
        setExportLoading(null);
      }
    },
    [
      artifactState,
      artifactType,
      document?.template?.artifact_config,
      document?.title,
      document_id,
      isOfficeArtifact,
      renderedVarValues,
      t,
      title,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        void handleExportPdf();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'w') {
        event.preventDefault();
        void handleExportWord();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportPdf, handleExportWord]);

  const navigateToVariablesWorkspace = useCallback(() => {
    navigate({
      to: '/documents/$id/variables',
      params: { id: document_id },
    });
  }, [document_id, navigate]);

  const normalizedCurrentRawContent =
    artifactType === 'rich_text'
      ? normalizeVariableHtml(ensureDocumentTemplatePlaceholders(rawContent, selectedDocumentTemplates, varValues))
      : normalizeVariableHtml(artifactPlaceholderContent);
  const normalizedOriginalRawContent =
    originalArtifactType === 'rich_text'
      ? normalizeVariableHtml(originalRawContent)
      : normalizeVariableHtml(
          buildArtifactPlaceholderContent(
            originalArtifactType,
            originalArtifactState,
            document?.template?.source_file_name || '',
          ),
        );

  const hasChanges =
    normalizedCurrentRawContent !== normalizedOriginalRawContent ||
    title !== originalTitle ||
    description !== originalDescription ||
    JSON.stringify(documentMetadata) !== JSON.stringify(originalDocumentMetadata) ||
    artifactType !== originalArtifactType ||
    JSON.stringify(artifactState) !== JSON.stringify(originalArtifactState) ||
    (shouldPersistDocxEditorSnapshot && docxEditorDirty);

  const openVariablesWorkspace = useCallback(() => {
    if (!hasChanges) {
      navigateToVariablesWorkspace();
      return;
    }

    setShowSaveBeforeVariablesDialog(true);
  }, [hasChanges, navigateToVariablesWorkspace]);

  const handleCancelSaveBeforeVariables = useCallback(() => {
    setShowSaveBeforeVariablesDialog(false);
  }, []);

  const handleConfirmSaveBeforeVariables = useCallback(async () => {
    if (!document) {
      return;
    }

    setShowSaveBeforeVariablesDialog(false);

    try {
      setIsSaving(true);
      const nextDocxEditorSnapshot = await savePendingDocxEditorSnapshot();
      await persistDocument(undefined, t('documentDetail.messages.saved'), false, nextDocxEditorSnapshot);
      navigateToVariablesWorkspace();
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.saveFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [document, navigateToVariablesWorkspace, persistDocument, savePendingDocxEditorSnapshot, t]);

  const handleSubmit = useCallback(async () => {
    if (!document || !startWorkflowAction('submit')) return;

    try {
      const nextDocxEditorSnapshot = await savePendingDocxEditorSnapshot();
      await persistDocument(
        undefined,
        t('documentDetail.messages.draftSavedBeforeSubmit'),
        true,
        nextDocxEditorSnapshot,
      );
      await submitDocumentAPI(document.id);
      await refreshDocument();
      setToast({
        message: t('documentDetail.messages.submitSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.submitFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setShowSubmitConfirmDialog(false);
      finishWorkflowAction();
    }
  }, [
    document,
    finishWorkflowAction,
    persistDocument,
    refreshDocument,
    savePendingDocxEditorSnapshot,
    startWorkflowAction,
    t,
  ]);

  const handleApprove = useCallback(async () => {
    if (!document || !startWorkflowAction('approve')) return;

    try {
      await approveDocumentAPI(document.id);
      await refreshDocument();
      setToast({
        message: t('documentDetail.messages.approveSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.approveFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setShowApproveConfirmDialog(false);
      finishWorkflowAction();
    }
  }, [document, finishWorkflowAction, refreshDocument, startWorkflowAction, t]);

  const handleReject = useCallback(
    async (reason: string) => {
      if (!document || !startWorkflowAction('reject')) return;

      try {
        await rejectDocumentAPI(document.id, {
          rejection_reason: reason.trim(),
        });
        await refreshDocument();
        setShowRejectModal(false);
        setRejectConfirmationReason(null);
        setToast({
          message: t('documentDetail.messages.rejectSuccess'),
          type: 'success',
        });
      } catch (error: any) {
        setRejectConfirmationReason(null);
        setToast({
          message: t('documentDetail.messages.rejectFailed', { error: error.message }),
          type: 'error',
        });
      } finally {
        finishWorkflowAction();
      }
    },
    [document, finishWorkflowAction, refreshDocument, startWorkflowAction, t],
  );

  const handleReturnToDraft = useCallback(async () => {
    if (!document) return;

    const confirmed = window.confirm(t('documentDetail.messages.confirmReturnDraft', { name: document.title }));
    if (!confirmed) return;
    if (!startWorkflowAction('return-draft')) return;

    try {
      await returnDocumentToDraftAPI(document.id);
      await refreshDocument();
      setToast({
        message: t('documentDetail.messages.returnDraftSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.returnDraftFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [document, finishWorkflowAction, refreshDocument, startWorkflowAction, t]);

  const handlePublish = useCallback(async () => {
    if (!document || !startWorkflowAction('publish')) return;

    try {
      await publishDocumentAPI(document.id);
      await refreshDocument();
      setToast({
        message: t('documentDetail.messages.publishSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.publishFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [document, finishWorkflowAction, refreshDocument, startWorkflowAction, t]);

  const handleUnpublish = useCallback(async () => {
    if (!document || !startWorkflowAction('unpublish')) return;

    try {
      await unpublishDocumentAPI(document.id);
      await refreshDocument();
      setToast({
        message: t('documentDetail.messages.unpublishSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.unpublishFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [document, finishWorkflowAction, refreshDocument, startWorkflowAction, t]);

  const handleDelete = useCallback(async () => {
    if (!document) return;

    const confirmed = window.confirm(t('documentDetail.messages.confirmDelete', { name: document.title }));
    if (!confirmed) return;
    if (!startWorkflowAction('delete')) return;

    try {
      await deleteDocumentAPI(document.id);
      setToast({
        message: t('documentDetail.messages.deleteSuccess'),
        type: 'success',
      });
      navigate({ to: '/documents' });
    } catch (error: any) {
      setToast({
        message: t('documentDetail.messages.deleteFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [document, finishWorkflowAction, navigate, startWorkflowAction, t]);

  const handleUploadWordClick = useCallback(() => {
    if (!canEdit || isSaving || isExtracting || workflowActionRef.current) return;
    wordFileInputRef.current?.click();
  }, [canEdit, isExtracting, isSaving]);

  const handleWordFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!document || !file) return;

      const fileName = file.name || '';
      if (!isSupportedWordUploadFile(fileName)) {
        setToast({
          message: t('documentDetail.messages.docxOnly'),
          type: 'error',
        });
        return;
      }

      let failedStep = t('documentDetail.messages.failedStepUploadExtraction');

      try {
        setIsExtracting(true);
        if (hasChanges) {
          failedStep = t('documentDetail.messages.failedStepSaveBeforeExtraction');
          setExtractionStatusText(t('documentDetail.extraction.savingChanges'));
          setIsSaving(true);
          const nextDocxEditorSnapshot = await savePendingDocxEditorSnapshot();
          await persistDocument(undefined, t('documentDetail.messages.saved'), false, nextDocxEditorSnapshot);
          setIsSaving(false);
        }

        failedStep = t('documentDetail.messages.failedStepUploadExtraction');
        setExtractionStatusText(t('documentDetail.extraction.uploading'));
        const result = await extractWordDocumentAPI(document.id, file);
        updateActiveExtraction({
          dagRunId: result.airflow?.dagRunId,
          jobId: result.airflow?.jobId,
          templateName: result.airflow?.templateName,
          queuedAt: Date.now(),
        });
        setExtractionStatusText(t('documentDetail.extraction.queued'));
        setToast({
          message: t('documentDetail.messages.extractionQueuedToast'),
          type: 'success',
        });
      } catch (error: unknown) {
        stopExtractionPolling();
        setToast({
          message: t('documentDetail.messages.extractionStepFailed', {
            step: failedStep,
            error: getErrorMessage(error, t('app.unexpectedError')),
          }),
          type: 'error',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      document,
      hasChanges,
      persistDocument,
      savePendingDocxEditorSnapshot,
      stopExtractionPolling,
      t,
      updateActiveExtraction,
    ],
  );

  const handleCloseVariablesWorkspace = useCallback(() => {
    navigate({ to: '/documents/$id', params: { id: document_id } });
  }, [document_id, navigate]);

  const handleWorkspaceSaveVariables = useCallback(
    async (overrideVarValues: Record<string, string>) => {
      await handleSaveVariables(overrideVarValues);
    },
    [handleSaveVariables],
  );

  const handleVariablesPreviewContentChange = useCallback(
    (data: string) => {
      const normalizedData = normalizeVariableHtml(data);
      setValue(data);
      setRenderedVarValues(varValuesRef.current);

      const dataIsEmpty = !normalizedData || normalizedData.replace(/<[^>]*>/g, '').trim() === '';
      if (dataIsEmpty) {
        setRawContent(normalizedData);
        return;
      }

      const newVars = extractVariablesFromHtml(normalizedData);
      const currentVars = extractVariablesFromHtml(normalizeVariableHtml(rawContent));
      const addedVars = newVars.filter((item) => !currentVars.includes(item));

      if (addedVars.length > 0 || normalizedData !== normalizeVariableHtml(rawContent)) {
        resetDocxEditorSnapshot();
        setRawContent((prev) =>
          ensureDocumentTemplatePlaceholders(
            rebuildRawContentFromRenderedHtml(
              normalizedData,
              prev,
              (() => {
                const rebuildMap = {
                  ...renderedVarValues,
                };
                Object.entries(varValuesRef.current).forEach(([key, nextValue]) => {
                  if (typeof nextValue === 'string' && nextValue !== '') {
                    rebuildMap[key] = nextValue;
                  }
                });
                return rebuildMap;
              })(),
            ),
            selectedDocumentTemplatesRef.current,
            varValuesRef.current,
          ),
        );
      }
    },
    [ensureDocumentTemplatePlaceholders, rawContent, renderedVarValues, resetDocxEditorSnapshot],
  );

  const toggleVariablesWorkspaceZoom = useCallback(() => {
    navigate({
      to: '/documents/$id/variables',
      params: { id: document_id },
      search: isWorkspaceZoomed ? ({} as never) : ({ zoom: '1' } as never),
    });
  }, [document_id, isWorkspaceZoomed, navigate]);

  const documentDisplayName = document?.title ?? defaultDocumentTitle;

  if (isDocumentRouteRecordPending) {
    return (
      <div className="flex h-screen min-h-0 flex-col bg-slate-100">
        <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="mb-1 flex items-center gap-1.5 text-sm">
            <button
              type="button"
              onClick={() => navigate({ to: '/documents' })}
              className="flex cursor-pointer items-center gap-1 text-amber-600 hover:text-amber-700">
              <Home className="size-3.5" />
              <span className="font-medium">{t('documentDetail.sidebar.breadcrumbRoot')}</span>
            </button>
            <span className="text-gray-400">›</span>
            {documentError ? (
              <span className="text-gray-500">{defaultDocumentTitle}</span>
            ) : (
              <span className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            )}
          </div>
          <div className="flex min-h-8 items-center">
            {documentError ? (
              <span className="min-w-0 break-words text-xl font-bold text-[#002147]">{defaultDocumentTitle}</span>
            ) : (
              <span className="h-7 w-56 animate-pulse rounded bg-gray-200" />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="flex min-h-[240px] w-full max-w-xl flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
            {documentError ? (
              <p className="text-red-700">{documentError}</p>
            ) : (
              <>
                <Loader2 className="mb-3 size-5 animate-spin text-slate-400" />
                <p>{t('documentDetail.editor.loading')}</p>
              </>
            )}
          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (workspaceMode) {
    const workspaceContainerClassName = isWorkspaceZoomed
      ? 'fixed inset-0 z-50 flex min-h-0 flex-col overflow-hidden bg-slate-100'
      : 'flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden bg-slate-100';

    const workspaceBodyClassName = isWorkspaceZoomed
      ? 'flex min-h-0 flex-1 overflow-hidden p-3'
      : 'flex min-h-0 flex-1 overflow-hidden px-6 py-6';

    return (
      <div className={workspaceContainerClassName}>
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-2.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <nav className="mb-1.5 flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
                <button
                  type="button"
                  onClick={() => navigate({ to: '/documents' })}
                  className="min-w-0 shrink-0 font-medium text-amber-600 hover:text-amber-700">
                  {t('documentDetail.sidebar.breadcrumbRoot')}
                </button>
                <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <button
                  type="button"
                  onClick={handleCloseVariablesWorkspace}
                  className="min-w-0 truncate text-slate-500 hover:text-slate-700">
                  {documentDisplayName}
                </button>
                <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0 truncate text-slate-500">{t('documentDetail.actions.variables')}</span>
              </nav>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseVariablesWorkspace}
                  className="size-9 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  title={t('documentDetail.workspace.back')}
                  aria-label={t('documentDetail.workspace.back')}>
                  <Home className="size-4" />
                </Button>
                <div className="min-w-0 truncate text-xl font-bold text-[#002147]">
                  {t('documentDetail.workspace.variablesOf', {
                    name: document?.title ?? t('documentDetail.defaults.documentLower'),
                  })}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleVariablesWorkspaceZoom}
                className="gap-2"
                title={t(
                  isWorkspaceZoomed ? 'documentDetail.workspace.zoomOutTitle' : 'documentDetail.workspace.zoomInTitle',
                )}>
                {isWorkspaceZoomed ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                {t(isWorkspaceZoomed ? 'documentDetail.workspace.zoomOut' : 'documentDetail.workspace.zoomIn')}
              </Button>
            </div>
          </div>
        </div>

        <div className={workspaceBodyClassName}>
          <div className="flex min-h-0 w-full flex-1 flex-col rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <VariablesDrawer
              open
              onClose={handleCloseVariablesWorkspace}
              renderMode="page"
              simpleMode
              allowDocumentTemplateReorder={!isEditorReadOnly}
              varsInDoc={varsInDoc}
              varValues={varValues}
              onVarValuesChange={handleVarValuesChange}
              varTypes={varTypes}
              onVarTypesChange={handleVarTypesChange}
              varTitles={varTitles}
              completedVarKeys={completedVarKeys}
              onCompletedVarKeysChange={handleCompletedVarKeysChange}
              onShowToast={setToast}
              rawHtml={contentForRender}
              renderedHtml={renderedHtml}
              renderedHtmlHighlighted={renderedHtmlHighlighted}
              exportLoading={exportLoading}
              exportFileName={document?.title || title || defaultDocumentTitle}
              onSaveVariables={handleWorkspaceSaveVariables}
              onPreviewContentChange={handleVariablesPreviewContentChange}
              selectedTemplates={selectedTemplates}
              onSelectedTemplatesChange={handleSelectedTemplatesChange}
              selectedDocumentTemplates={selectedDocumentTemplates}
              documentTemplateValues={documentTemplateValues}
              onSelectedDocumentTemplatesChange={handleSelectedDocumentTemplatesChange}
              onDocumentTemplateValuesChange={handleDocumentTemplateValuesChange}
              variableCatalog={variableCatalog}
              template_type={currentTemplateType}
              onReplaceVariable={handleReplaceVariable}
              allowVariableInsertion={false}
              showPreviewDisplayModeToggle={false}
              readOnly={isEditorReadOnly}
              artifactType={artifactType}
              artifactConfig={artifactState}
              artifactValues={varValues}
              artifactVariableKeys={artifactBindingKeys}
              artifactOfficeScope="document"
              artifactOfficeId={document_id}
              onArtifactConfigChange={setArtifactState}
            />
          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-slate-100">
      <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mb-1 flex items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => navigate({ to: '/documents' })}
            className="flex cursor-pointer items-center gap-1 text-amber-600 hover:text-amber-700">
            <Home className="size-3.5" />
            <span className="font-medium">{t('documentDetail.sidebar.breadcrumbRoot')}</span>
          </button>
          <span className="text-gray-400">›</span>
          {documentLoading ? (
            <span className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          ) : (
            <span className="text-gray-500">{documentDisplayName}</span>
          )}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="min-w-0 break-words text-xl font-bold text-[#002147]">{documentDisplayName}</span>
            {document && (
              <ApprovalStatusBadge status={uiStatus} rejection_reason={document.rejection_reason ?? undefined} />
            )}
          </div>

          <div className="flex w-full flex-wrap items-center justify-start gap-2 xl:w-auto xl:max-w-[min(100%,920px)] xl:justify-end">
            {canSubmit && (
              <Button size="sm" onClick={() => setShowSubmitConfirmDialog(true)} disabled={isWorkflowBusy}>
                {workflowAction === 'submit' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {t('documentDetail.actions.submitApproval')}
              </Button>
            )}

            {canApprove && (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setShowApproveConfirmDialog(true)}
                  disabled={isWorkflowBusy}>
                  {workflowAction === 'approve' && <Loader2 className="size-3.5 animate-spin" />}
                  {t('documentDetail.actions.approve')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowRejectModal(true)}
                  disabled={isWorkflowBusy}>
                  {t('documentDetail.actions.reject')}
                </Button>
              </>
            )}

            {!canApprove && canReject && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowRejectModal(true)}
                disabled={isWorkflowBusy}>
                {t('documentDetail.actions.reject')}
              </Button>
            )}

            {canReturnToDraft && (
              <Button size="sm" variant="outline" onClick={() => void handleReturnToDraft()} disabled={isWorkflowBusy}>
                {workflowAction === 'return-draft' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                {t('documentDetail.actions.returnDraft')}
              </Button>
            )}

            {canPublish && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => void handlePublish()}
                disabled={isWorkflowBusy}>
                {workflowAction === 'publish' && <Loader2 className="size-3.5 animate-spin" />}
                {t('documentDetail.actions.publish')}
              </Button>
            )}

            {canUnpublish && (
              <Button size="sm" variant="outline" onClick={() => void handleUnpublish()} disabled={isWorkflowBusy}>
                {workflowAction === 'unpublish' && <Loader2 className="size-3.5 animate-spin" />}
                {t('documentDetail.actions.unpublish')}
              </Button>
            )}

            {canDelete && (
              <Button size="sm" variant="destructive" onClick={() => void handleDelete()} disabled={isWorkflowBusy}>
                {workflowAction === 'delete' && <Loader2 className="size-3.5 animate-spin" />}
                {t('documentDetail.actions.delete')}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleUploadWordClick()}
              disabled={!canEdit || isWorkflowBusy}>
              {isExtracting ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {isExtracting ? t('documentDetail.actions.extracting') : t('documentDetail.actions.uploadWord')}
            </Button>

            {canEdit && hasChanges && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => void handleSaveDocument()}
                disabled={isWorkflowBusy}>
                {isSaving && workflowAction === null ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {isSaving ? t('documentDetail.actions.saving') : t('documentDetail.actions.save')}
              </Button>
            )}

            {artifactType !== 'rich_text' ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleExportArtifact(
                      artifactType === 'spreadsheet' ? 'xlsx' : artifactType === 'presentation' ? 'pptx' : 'pdf',
                    )
                  }
                  disabled={Boolean(exportLoading) || isExtracting}>
                  <Download className="size-3.5" />
                  {exportLoading?.startsWith('artifact') ? '…' : 'Export'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExportArtifact('pdf')}
                  disabled={Boolean(exportLoading) || isExtracting}>
                  PDF
                </Button>
              </>
            ) : shouldUseDocumentDocxTabs ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleOpenDocxExportPreview()}
                disabled={
                  exportLoading === 'export' ||
                  isExtracting ||
                  (shouldUseDocumentDocxTabs && editorDisplayMode === 'docx' && !docxEditorReady)
                }>
                <Download className="size-3.5" />
                {exportLoading === 'export' ? '…' : t('documentDetail.actions.export')}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExportPdf()}
                  disabled={exportLoading === 'pdf' || isExtracting}>
                  <Download className="size-3.5" />
                  {exportLoading === 'pdf' ? '…' : 'PDF'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExportWord()}
                  disabled={exportLoading === 'word' || isExtracting}>
                  <FileText className="size-3.5" />
                  {exportLoading === 'word' ? '…' : 'Word'}
                </Button>
              </>
            )}

            {canUseOfficeArtifactEditor && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowVariablePicker(true)}
                disabled={isEditorReadOnly}>
                <Braces className="size-3.5" />
                Insert variable
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={openVariablesWorkspace}
              className="relative"
              title={t('documentDetail.tooltips.variablesWorkspace')}>
              <Maximize2 className="size-3.5" />
              {t('documentDetail.actions.startEditing')}
              {varsInDoc.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                  {varsInDoc.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {isExtracting && extractionStatusText && <ExtractionLoadingBanner statusText={extractionStatusText} />}
      </div>

      {documentError && (
        <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {documentError}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 gap-4 overflow-hidden p-6">
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-slate-50/80 px-4 py-2">
            <div className="text-sm font-semibold text-slate-700">{t('documentDetail.editor.title')}</div>
            <div className="inline-flex rounded-lg bg-slate-200/70 p-1 text-xs font-medium">
              {isDocumentRouteRecordPending ? (
                <span className="h-7 rounded-md bg-white px-3 py-1.5 text-slate-500 shadow-sm">
                  {t('documentDetail.editor.loading')}
                </span>
              ) : artifactType !== 'rich_text' ? (
                <span className="h-7 rounded-md bg-white px-3 py-1.5 text-slate-950 shadow-sm">
                  {getArtifactTypeLabel(artifactType)}
                </span>
              ) : !shouldUseDocumentDocxTabs ? (
                <button
                  type="button"
                  onClick={() => void handleEditorDisplayModeChange('editor')}
                  className={`h-7 rounded-md px-3 transition ${
                    editorDisplayMode === 'editor'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}>
                  {t('documentDetail.editor.modes.editor')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleEditorDisplayModeChange('docx')}
                  className={`h-7 rounded-md px-3 transition ${
                    editorDisplayMode === 'docx'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}>
                  Preview
                </button>
              )}
              {/* <button
                type="button"
                onClick={() => void handleEditorDisplayModeChange('preview')}
                className={`h-7 rounded-md px-3 transition ${
                  editorDisplayMode === 'preview'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}>
                {t('documentDetail.editor.modes.pages')}
              </button> */}
            </div>
          </div>
          <div className="editor-main-content relative flex-1 overflow-auto">
            {isExtracting && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-amber-50/92 via-white/78 to-orange-50/92 backdrop-blur-[1px]">
                <div className="mx-6 w-full max-w-sm rounded-3xl border border-amber-200 bg-white/90 px-6 py-5 text-center shadow-xl">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100">
                    <span className="size-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-900">
                    {t('documentDetail.extraction.overlayTitle')}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {extractionStatusText ?? t('documentDetail.extraction.waitingAirflow')}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="size-2 animate-pulse rounded-full bg-amber-500" />
                    <span className="size-2 animate-pulse rounded-full bg-amber-500 [animation-delay:150ms]" />
                    <span className="size-2 animate-pulse rounded-full bg-amber-500 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            {isDocumentRouteRecordPending ? (
              <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center text-sm text-gray-500">
                {documentError ?? t('documentDetail.editor.loading')}
              </div>
            ) : artifactType !== 'rich_text' ? (
              isOfficeArtifact ? (
                canUseOfficeArtifactEditor ? (
                  <OfficeArtifactEditor
                    ref={officeArtifactEditorRef}
                    scope="document"
                    id={document_id}
                    artifactType={artifactType}
                    metadata={artifactState}
                    variableCatalog={variableCatalog}
                    template_type={currentTemplateType}
                    readOnly={isEditorReadOnly}
                    renderValues={Object.keys(renderedVarValues).length > 0}
                    values={renderedVarValues}
                    renderData={officeRenderData}
                    renderArtifactState={artifactState}
                    onMetadataChange={setArtifactState}
                    onShowToast={setToast}
                    showInsertVariableButton={false}
                  />
                ) : (
                  <OfficeArtifactSetupPanel artifactType={artifactType} scope="document" />
                )
              ) : (
                <ArtifactEditor
                  artifactType={artifactType}
                  config={artifactState}
                  values={renderedVarValues}
                  variableKeys={artifactBindingKeys}
                  variableCatalog={variableCatalog}
                  template_type={currentTemplateType}
                  readOnly={isEditorReadOnly}
                  onConfigChange={setArtifactState}
                />
              )
            ) : editorDisplayMode === 'docx' && shouldUseDocumentDocxTabs ? (
              <Suspense
                fallback={
                  <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
                    {t('documentDetail.editor.loading')}
                  </div>
                }>
                <LazyDocxDocumentEditor
                  ref={docxDocumentEditorRef}
                  htmlContent={docxEditorHtmlContent}
                  initialDocumentBuffer={initialDocxEditorBuffer}
                  sourceKey={docxEditorSourceKey}
                  fileName={`${document?.title || title || 'document'}.docx`}
                  readOnly={isEditorReadOnly}
                  onReadyChange={setDocxEditorReady}
                  onDirtyChange={setDocxEditorDirty}
                  onError={(message) =>
                    setToast({
                      message,
                      type: 'error',
                    })
                  }
                />
              </Suspense>
            ) : editorDisplayMode === 'preview' ? (
              <PagedDocumentPreview html={renderedHtml} emptyMessage={t('documentDetail.editor.emptyPagePreview')} />
            ) : documentLoading ? (
              <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
                {t('documentDetail.editor.loading')}
              </div>
            ) : shouldUseDocxEditor ? (
              <Suspense
                fallback={
                  <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
                    {t('documentDetail.editor.loading')}
                  </div>
                }>
                <LazyDocxDocumentEditor
                  ref={docxDocumentEditorRef}
                  htmlContent={docxEditorHtmlContent}
                  initialDocumentBuffer={initialDocxEditorBuffer}
                  sourceKey={docxEditorSourceKey}
                  fileName={`${document?.title || title || 'document'}.docx`}
                  readOnly={isEditorReadOnly}
                  onReadyChange={setDocxEditorReady}
                  onDirtyChange={setDocxEditorDirty}
                  onError={(message) =>
                    setToast({
                      message,
                      type: 'error',
                    })
                  }
                />
              </Suspense>
            ) : !variableCatalogReady ||
              documentLoading ||
              !CKEditorComponent ||
              !ClassicEditorConstructor ||
              !editorConfig ? (
              <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
                {t('documentDetail.editor.loading')}
              </div>
            ) : (
              <CKEditorComponent
                key={editorCatalogKey}
                editor={ClassicEditorConstructor}
                config={editorConfig}
                data={value}
                disabled={isEditorReadOnly}
                onReady={handleEditorReady}
                onChange={(_, editor) => {
                  const data = editor.getData();
                  if (skipRawContentSyncRef.current) {
                    skipRawContentSyncRef.current = false;
                    return;
                  }

                  const normalizedData = normalizeVariableHtml(data);
                  setValue(data);
                  setRenderedVarValues(varValuesRef.current);
                  resetDocxEditorSnapshot();

                  const dataIsEmpty = !normalizedData || normalizedData.replace(/<[^>]*>/g, '').trim() === '';
                  if (dataIsEmpty) {
                    setRawContent(normalizedData);
                  } else {
                    const newVars = extractVariablesFromHtml(normalizedData);
                    const currentVars = extractVariablesFromHtml(normalizeVariableHtml(rawContent));
                    const addedVars = newVars.filter((item) => !currentVars.includes(item));

                    if (addedVars.length > 0 || normalizedData !== normalizeVariableHtml(rawContent)) {
                      setRawContent((prev) =>
                        ensureDocumentTemplatePlaceholders(
                          rebuildRawContentFromRenderedHtml(
                            normalizedData,
                            prev,
                            (() => {
                              const rebuildMap = {
                                ...renderedVarValues,
                              };
                              Object.entries(varValuesRef.current).forEach(([key, nextValue]) => {
                                if (typeof nextValue === 'string' && nextValue !== '') {
                                  rebuildMap[key] = nextValue;
                                }
                              });
                              return rebuildMap;
                            })(),
                          ),
                          selectedDocumentTemplatesRef.current,
                          varValuesRef.current,
                        ),
                      );
                    }
                  }

                  scheduleMentionHighlights();
                }}
              />
            )}
          </div>
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
            {t('documentDetail.editor.help', {
              pdfShortcut: 'Ctrl+P',
              wordShortcut: 'Ctrl+W',
            })}
          </div>
        </div>

        {isRightSidebarCollapsed ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setIsRightSidebarCollapsed(false)}
            className="absolute right-8 top-8 z-20 size-9 rounded-xl border-slate-200 bg-white/95 text-slate-600 shadow-sm backdrop-blur hover:bg-white hover:text-slate-950"
            title={`${t('common.actions.open')} ${t('documentDetail.sidebar.documentInfoTitle')}`}>
            <PanelRightOpen className="size-4" />
          </Button>
        ) : null}

        {!isRightSidebarCollapsed ? (
          <div className="flex h-full w-[420px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:w-[460px]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t('documentDetail.sidebar.documentInfoTitle')}</p>
                <p className="mt-1 text-xs text-slate-500">{t('documentDetail.sidebar.documentInfoDescription')}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsRightSidebarCollapsed(true)}
                className="h-8 gap-2 rounded-lg bg-white text-xs">
                <PanelRightClose className="size-3.5" />
                {t('navigation.collapse')}
              </Button>
            </div>

            <Accordion
              type="multiple"
              defaultValue={['document-settings', 'approval-flow', 'activity']}
              className="min-h-0 flex-1 overflow-y-auto">
              <AccordionItem value="document-settings" className={RIGHT_SIDEBAR_CARD_CLASS_NAME}>
                <AccordionTrigger className={RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME}>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('documentDetail.sidebar.documentInfoTitle')} / {t('documentDetail.sidebar.metadataTitle')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t('documentDetail.sidebar.documentInfoDescription')}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-5 px-5 py-4">
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <label
                        className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                        htmlFor="document-title">
                        {t('documentDetail.sidebar.title')}
                      </label>
                      <Input
                        id="document-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isEditorReadOnly}
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <label
                        className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                        htmlFor="document-description">
                        {t('documentDetail.sidebar.description')}
                      </label>
                      <Textarea
                        id="document-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isEditorReadOnly}
                        className="min-h-24"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {t('documentDetail.sidebar.document_metadata')}
                      </p>
                      {!isEditorReadOnly && Object.keys(documentMetadata).length > 0 ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-600 hover:underline"
                          onClick={() => setDocumentMetadata({})}>
                          {t('documentsPage.clearFilters')}
                        </button>
                      ) : (
                        <ApprovalStatusBadge
                          status={uiStatus}
                          rejection_reason={latestRejectionNote?.reason ?? undefined}
                        />
                      )}
                    </div>

                    <div className="grid gap-2">
                      {documentMetadataFields.length === 0 ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-xs italic text-gray-400">
                          {currentTemplateType
                            ? t('documentDetail.sidebar.noMetadataForType')
                            : t('documentDetail.sidebar.chooseTypeForMetadata')}
                        </div>
                      ) : (
                        documentMetadataFields.map((field) => {
                          const currentEntry = documentMetadata[field.key];
                          const currentVal = currentEntry?.value ?? '';
                          const currentLabel = currentEntry?.label ?? currentVal;
                          const writeEntry = (val: string, label: string) => {
                            setDocumentMetadata((prev) => {
                              const next = { ...prev };
                              if (val) next[field.key] = { value: val, label: label || val };
                              else delete next[field.key];
                              return next;
                            });
                          };
                          const clearEntry = () => {
                            setDocumentMetadata((prev) => {
                              const next = { ...prev };
                              delete next[field.key];
                              return next;
                            });
                          };

                          return (
                            <div
                              key={field.key}
                              className="grid gap-1.5 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                {field.label}
                              </span>
                              {isEditorReadOnly ? (
                                <span className="text-xs font-medium text-gray-900">{currentLabel || '-'}</span>
                              ) : field.source_type === 'api_table' ? (
                                <SearchableSelect
                                  value={currentVal || undefined}
                                  clearable
                                  fetchOnOpen
                                  minSearchLength={0}
                                  placeholder={t('templateDetail.sidebar.selectField', {
                                    field: field.label.toLowerCase(),
                                  })}
                                  searchPlaceholder={t('templateDetail.sidebar.searchField', {
                                    field: field.label.toLowerCase(),
                                  })}
                                  emptyMessage={t('templateDetail.sidebar.noResults')}
                                  className="h-8 text-xs"
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
                                  onValueChange={(value) => {
                                    if (!value) clearEntry();
                                  }}
                                  onOptionSelect={(option) => {
                                    if (!option) clearEntry();
                                    else writeEntry(option.value, option.label);
                                  }}
                                />
                              ) : field.source_type === 'static' ? (
                                <Select
                                  value={currentVal || '__NONE__'}
                                  onValueChange={(value) => {
                                    if (value === '__NONE__') clearEntry();
                                    else {
                                      const option = field.options.find((item) => item.value === value);
                                      writeEntry(value, option?.label ?? value);
                                    }
                                  }}>
                                  <SelectTrigger className="h-8 rounded-xl bg-white text-xs">
                                    <SelectValue
                                      placeholder={t('templateDetail.sidebar.selectField', {
                                        field: field.label.toLowerCase(),
                                      })}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__NONE__">{t('templateDetail.sidebar.noneOption')}</SelectItem>
                                    {field.options.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : field.source_type === 'input_number' ? (
                                <Input
                                  type="number"
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  className="h-8 text-xs"
                                  value={currentVal}
                                  placeholder={field.placeholder ?? field.label}
                                  onChange={(event) => writeEntry(event.target.value, event.target.value)}
                                />
                              ) : (
                                <Input
                                  type="text"
                                  className="h-8 text-xs"
                                  value={currentVal}
                                  placeholder={field.placeholder ?? field.label}
                                  onChange={(event) => writeEntry(event.target.value, event.target.value)}
                                />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {t('documentDetail.sidebar.metadataTitle')}
                      </p>
                      <ApprovalStatusBadge
                        status={uiStatus}
                        rejection_reason={latestRejectionNote?.reason ?? undefined}
                      />
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 sm:col-span-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('documentDetail.sidebar.template')}
                        </dt>
                        <dd className="mt-2 break-words font-medium text-gray-900">
                          {document?.template?.name ?? '-'}
                        </dd>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('documentDetail.sidebar.template_type')}
                        </dt>
                        <dd className="mt-2 break-words font-medium text-gray-900">
                          {document?.template?.template_type ?? '-'}
                        </dd>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('documentDetail.sidebar.artifact_format')}
                        </dt>
                        <dd className="mt-2 font-medium text-gray-900">{getArtifactTypeLabel(artifactType)}</dd>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('documentDetail.sidebar.created_by')}
                        </dt>
                        <dd className="mt-2 break-words font-medium text-gray-900">{document?.created_by ?? '-'}</dd>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('documentDetail.sidebar.published')}
                        </dt>
                        <dd className="mt-2 font-medium text-gray-900">
                          {document?.is_published ? t('documentDetail.sidebar.yes') : t('documentDetail.sidebar.no')}
                        </dd>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('documentDetail.sidebar.created_at')}
                        </dt>
                        <dd className="mt-2 font-medium text-gray-900">
                          {document?.created_at ? formatDate(document.created_at) : '-'}
                        </dd>
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('documentDetail.sidebar.updated_at')}
                        </dt>
                        <dd className="mt-2 font-medium text-gray-900">
                          {document?.updated_at ? formatDate(document.updated_at) : '-'}
                        </dd>
                      </div>

                      {latestRejectionNote && (
                        <div className="rounded-xl border border-red-100 bg-red-50 p-3 sm:col-span-2">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
                            {t('documentDetail.sidebar.rejection_reason')}
                          </dt>
                          <dd className="mt-2 text-red-700">
                            <div className="whitespace-pre-wrap break-words">{latestRejectionNote.reason}</div>
                            {(latestRejectionNote.performed_by || latestRejectionNote.timestamp) && (
                              <div className="mt-2 text-xs text-red-500">
                                {[
                                  latestRejectionNote.performed_by,
                                  latestRejectionNote.timestamp && formatDate(latestRejectionNote.timestamp),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            )}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="approval-flow" className={RIGHT_SIDEBAR_CARD_CLASS_NAME}>
                <AccordionTrigger className={RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME}>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">{t('documentDetail.approvalFlow.title')}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {document?.approval
                        ? t('documentDetail.approvalFlow.stepProgress', {
                            current: document.approval.current_step_order ?? document.approval.total_steps,
                            total: document.approval.total_steps,
                            status: document.approval.status,
                          })
                        : t('documentDetail.approvalFlow.noFlowDescription')}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={RIGHT_SIDEBAR_CARD_BODY_CLASS_NAME}>
                  <ApprovalWorkflowPanel document={document} embedded />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="activity" className={RIGHT_SIDEBAR_CARD_CLASS_NAME}>
                <AccordionTrigger className={RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME}>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">{t('documentDetail.sidebar.activityTitle')}</p>
                    <p className="mt-1 text-xs text-slate-500">{t('documentDetail.sidebar.activityDescription')}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={RIGHT_SIDEBAR_CARD_BODY_CLASS_NAME}>
                  <ApprovalHistoryTimeline logs={documentActivityLogs} isLoading={documentLoading} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        ) : null}
      </div>

      <input
        ref={wordFileInputRef}
        type="file"
        accept={WORD_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => void handleWordFileSelected(event)}
      />

      <RejectReasonModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={(reason) => setRejectConfirmationReason(reason.trim())}
        isLoading={workflowAction === 'reject'}
      />
      <AlertDialog
        open={showSubmitConfirmDialog}
        onOpenChange={(nextOpen) => {
          if (workflowAction === 'submit') return;
          setShowSubmitConfirmDialog(nextOpen);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documentDetail.submitConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('documentDetail.submitConfirm.description', {
                name: document?.title ?? documentDisplayName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workflowAction === 'submit'}>
              {t('documentDetail.submitConfirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={workflowAction === 'submit'}
              onClick={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}>
              {workflowAction === 'submit' && <Loader2 className="size-4 animate-spin" />}
              {t('documentDetail.submitConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={showApproveConfirmDialog}
        onOpenChange={(nextOpen) => {
          if (workflowAction === 'approve') return;
          setShowApproveConfirmDialog(nextOpen);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documentDetail.approveConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('documentDetail.approveConfirm.description', {
                name: document?.title ?? documentDisplayName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workflowAction === 'approve'}>
              {t('documentDetail.approveConfirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={workflowAction === 'approve'}
              onClick={(event) => {
                event.preventDefault();
                void handleApprove();
              }}>
              {workflowAction === 'approve' && <Loader2 className="size-4 animate-spin" />}
              {t('documentDetail.approveConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(rejectConfirmationReason)}
        onOpenChange={(nextOpen) => {
          if (workflowAction === 'reject') return;
          if (!nextOpen) {
            setRejectConfirmationReason(null);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documentDetail.rejectConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('documentDetail.rejectConfirm.description', {
                name: document?.title ?? documentDisplayName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rejectConfirmationReason && (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <div className="font-semibold">{t('documentDetail.rejectConfirm.reason')}</div>
              <div className="mt-1 whitespace-pre-wrap break-words">{rejectConfirmationReason}</div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workflowAction === 'reject'}>
              {t('documentDetail.rejectConfirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={workflowAction === 'reject'}
              onClick={(event) => {
                event.preventDefault();
                if (rejectConfirmationReason) {
                  void handleReject(rejectConfirmationReason);
                }
              }}>
              {workflowAction === 'reject' && <Loader2 className="size-4 animate-spin" />}
              {t('documentDetail.rejectConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showSaveBeforeVariablesDialog} onOpenChange={setShowSaveBeforeVariablesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documentDetail.saveBeforeVariables.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('documentDetail.saveBeforeVariables.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSaveBeforeVariables}>
              {t('documentDetail.saveBeforeVariables.stay')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmSaveBeforeVariables()} disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {isSaving ? t('documentDetail.actions.saving') : t('documentDetail.saveBeforeVariables.saveAndContinue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <VariablePickerDialog
        open={showVariablePicker}
        catalog={variableCatalog}
        template_type={currentTemplateType}
        multiSelect={false}
        onOpenChange={setShowVariablePicker}
        onSelect={handleInsertOfficeVariable}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
