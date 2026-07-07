import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ClassicEditor, ModelRange } from 'ckeditor5';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mammoth from 'mammoth';
import {
  Braces,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
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
  X,
  XCircle,
} from 'lucide-react';
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
import {
  ALLOW_EDIT_ALL_STATUS,
  canAccessTechRoot,
  isAdmin as isAdminProfile,
  isRootProfile,
  profileStore,
} from 'reactjs-platform/utilities';
import {
  ApprovalHistoryTimeline,
  ApprovalStatusBadge,
  ApprovalStatusPanel,
  ArtifactEditor,
  ARTIFACT_TYPE_OPTIONS,
  buildArtifactPlaceholderContent,
  createDefaultArtifactConfig,
  extractArtifactVariableKeys,
  getArtifactCatalogVariableKeys,
  getArtifactTypeLabel,
  normalizeArtifactType,
  OfficeArtifactEditor,
  OfficeArtifactSetupPanel,
  PagedDocumentPreview,
  RejectionDialog,
  SpreadsheetTableBindingsPanel,
  SubmitForApprovalDialog,
  PreviewModal,
  TemplateShareRules,
  TemplateNameModal,
  Toast,
  VariablePickerDialog,
  VariablesDrawer,
  type FileSelectEvent,
  type ToastProps,
  type IOfficeArtifactEditorRef,
  UploadModal,
} from '../../../components';
import type { IDocxDocumentEditorHandle } from '../../../components/template/docx-document-editor';
import { useTranslation } from '../../../i18n';
import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  DOCUMENT_TEMPLATE_WRAPPER_ATTR,
  TABLE_TEMPLATE_VARIABLE_NAMESPACE,
  DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS,
  DOCX_EDITOR_RENDERER_VERSION,
  arrayBufferToBase64,
  applyVariablesToHtml,
  applyVariablesToHtmlWithHighlight,
  canUseLiveTemplateVariableConfig,
  createEditorConfig,
  createEditorContentKey,
  createDownloadFileName,
  exportToPdf,
  exportToWord,
  extractVariablesFromHtml,
  extractVariablesInOrder,
  formatDate,
  generateDocumentHtml,
  generateTableHtmlFromTableTemplate,
  getCurrentTemplateDocxEditorSnapshotBuffer,
  getDefaultVariableInputTypeForKey,
  getDefaultVariableValueForKey,
  getDocumentTemplateById,
  getTableTemplateById,
  getTemplateVariableDocumentTemplateByKey,
  getTemplateVariableTableTemplateByKey,
  type IVariablePickerItem,
  hasInvalidTableTemplateHeaderTree,
  mergeDocumentTemplateStylesFromDefinition,
  mergeTableTemplateStylesFromDefinition,
  mergeTableTemplateWithRuntimeValues,
  logVariablePerformance,
  measureVariablePerformance,
  insertVariablePickerItems,
  isCurrentTemplateDocxEditorSnapshot,
  attachFontSizeToolbarLabel,
  normalizeEditorMeta,
  normalizeTemplateVariableRenderSettings,
  normalizeVariableHtml,
  parseVariableName,
  rebuildRawContentFromRenderedHtml,
  replaceVariableState,
  removeRenderedDocumentTemplateHtml,
  registerMentionRichTextEditor,
  setDocumentTemplates,
  setEditorGlobalStyle,
  setForeignKeyMeta,
  setSchemaFieldCatalog,
  setTableTemplates,
  setTemplateVariableDefinitions,
  shouldLogVariablePerformanceCycle,
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
  type TemplateStructure,
  type TemplateDocxEditorSnapshot,
  type TemplateVariablesPayload,
  type VariableKey,
  type VarTypes,
} from '../../../lib';
import { VariableDragPanel } from '../../../components/variable/variable-drag-panel/variable-drag-panel.component';
import { setupVariableDropHandler } from '../../../lib/editor-config/variable-drop-handler';
import { getVariablePickerItems } from '../../../lib/editor-config/variable-picker';
import {
  approveTemplateAPI,
  applyLabelExpr,
  createTemplateAPI,
  exportArtifactAPI,
  exportOfficeArtifactAPI,
  createTemplateNewVersionAPI,
  deleteTemplateAPI,
  getTemplateByIdAPI,
  getTemplateEditorMetaAPI,
  getMetadataByKeyAPI,
  getTemplateTableOptionsAPI,
  getTemplateVariableSettingsAPI,
  listTemplateAuditLogsAPI,
  listTemplateVisibilityUnitsAPI,
  publishTemplateAPI,
  rejectTemplateAPI,
  returnTemplateToDraftAPI,
  submitTemplateForApprovalAPI,
  type FilterConfigMetaValues,
  type FilterField,
  type ITemplate,
  type ITemplateAuditLog,
  type ITemplateMetadata,
  type ITemplateShareRule,
  type MetadataOption,
  type TArtifactExportFormat,
  type TArtifactType,
  type TemplateVisibility,
  uploadArtifactSourceAPI,
  unpublishTemplateAPI,
  updateTemplateAPI,
} from 'api';
import type { ITemplateEditorPageProps } from './template-editor.type';

type TemplateEditorRuntime = Awaited<ReturnType<typeof loadEditorRuntime>>;
type TTemplateWorkflowAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'return-draft'
  | 'publish'
  | 'unpublish'
  | 'new-version'
  | 'delete';
const DEFAULT_TEMPLATE = '';
const VARIABLE_RENDER_DEBOUNCE_MS = 1000;
const VARIABLE_DRAFT_AUTOSAVE_DELAY_MS = 800;
const TEMPLATE_RENDER_CONFIG_KIND = 'template-render-config';
const TEMPLATE_RENDER_CONFIG_SCHEMA_VERSION = 1;

interface ITemplateRenderConfigJson {
  kind: typeof TEMPLATE_RENDER_CONFIG_KIND;
  schema_version: typeof TEMPLATE_RENDER_CONFIG_SCHEMA_VERSION;
  exported_at: string;
  template: {
    name: string;
    description?: string;
    template_type?: string;
  };
  render: {
    content: string;
    artifact_type: TArtifactType;
    artifact_config: unknown;
    source_file_name?: string;
    variables: TemplateVariablesPayload | null;
  };
}

const LazyDocxDocumentEditor = lazy(() =>
  import('../../../components/template/docx-document-editor').then((module) => ({
    default: module.DocxDocumentEditor,
  })),
);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const requiresArtifactSourceFile = (artifactType: TArtifactType) => artifactType !== 'rich_text';

const ARTIFACT_CONFIG_FILE_REFERENCE_KEYS = new Set(['document_key', 'file_id', 'office_file_id', 'wopi_file_id']);

const stripArtifactConfigFileReferences = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripArtifactConfigFileReferences);
  }

  const record = asRecord(value);
  if (!record) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !ARTIFACT_CONFIG_FILE_REFERENCE_KEYS.has(key))
      .map(([key, entry]) => [key, stripArtifactConfigFileReferences(entry)]),
  );
};

const parseTemplateRenderConfigJson = (value: string) => {
  const parsed = JSON.parse(value) as unknown;
  const root = asRecord(parsed);
  if (!root) {
    throw new Error('JSON root must be an object.');
  }

  const render = asRecord(root.render) ?? root;
  const templateInfo = asRecord(root.template);
  const variables = (render.variables ?? root.variables ?? null) as TemplateVariablesPayload | null;
  const content =
    typeof render.content === 'string'
      ? render.content
      : variables && typeof variables.raw_content === 'string'
        ? variables.raw_content
        : '';
  const artifactType = normalizeArtifactType(
    typeof render.artifact_type === 'string'
      ? render.artifact_type
      : typeof root.artifact_type === 'string'
        ? root.artifact_type
        : undefined,
  );

  if (!content && artifactType === 'rich_text') {
    throw new Error('Render config is missing content.');
  }

  return {
    content,
    artifactType,
    artifactConfig:
      render.artifact_config !== undefined
        ? stripArtifactConfigFileReferences(render.artifact_config)
        : createDefaultArtifactConfig(artifactType),
    sourceFileName: typeof render.source_file_name === 'string' ? render.source_file_name : '',
    templateType:
      typeof templateInfo?.template_type === 'string'
        ? templateInfo.template_type
        : typeof render.template_type === 'string'
          ? render.template_type
          : typeof root.template_type === 'string'
            ? root.template_type
            : '',
    variables,
  };
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
        if (!cancelled) {
          const normalized = normalizeEditorMeta(data);
          setCatalog(normalized.schema_field_catalog);
          setSchemaFieldCatalog(normalized.schema_field_catalog);
          setForeignKeyMeta(normalized.foreign_key_meta);
          setTableTemplates(normalized.table_templates);
          setDocumentTemplates(normalized.document_templates);
          setTemplateVariableDefinitions(normalized.variable_definitions);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog({});
          setSchemaFieldCatalog({});
          setForeignKeyMeta({});
          setTableTemplates([]);
          setDocumentTemplates([]);
          setTemplateVariableDefinitions([]);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artifact_type, template_type]);

  return { catalog, ready };
};

const useTemplateTypeOptions = (): MetadataOption[] => {
  const [options, setOptions] = useState<MetadataOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    void getMetadataByKeyAPI<MetadataOption[]>('TEMPLATE_TYPE')
      .then((metadata) => {
        if (!cancelled) {
          setOptions(metadata.meta_values ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return options;
};

const useFilterConfig = (): FilterConfigMetaValues['filterTemplate'] => {
  const [config, setConfig] = useState<FilterConfigMetaValues['filterTemplate']>({});

  useEffect(() => {
    let cancelled = false;

    void getMetadataByKeyAPI<FilterConfigMetaValues>('FILTER_CONFIG')
      .then((record) => {
        if (!cancelled) {
          setConfig(record.meta_values?.filterTemplate ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfig({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return config;
};

const useOrganizationUnitOptions = (): MetadataOption[] => {
  const [options, setOptions] = useState<MetadataOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listTemplateVisibilityUnitsAPI()
      .then((units) => {
        if (cancelled) {
          return;
        }

        setOptions(
          units.map((unit) => ({
            value: unit.id,
            label: unit.name || unit.code,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return options;
};

const toUiStatus = (status?: string | null) =>
  ({
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVAL: 'Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  })[status ?? ''] ??
  status ??
  'Draft';

const toTimestamp = (value?: string | null): number | undefined => {
  if (!value) return undefined;
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? undefined : date;
};

const hasMeaningfulTemplateContent = (value?: string | null): boolean => {
  const normalized = normalizeVariableHtml(value || '');
  const plainText = normalized
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText.length > 0;
};

const RIGHT_SIDEBAR_CARD_CLASS_NAME = 'border-b border-slate-100 last:border-b-0';
const RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME =
  'w-full px-5 py-4 hover:no-underline [&[data-state=open]]:border-b [&[data-state=open]]:border-slate-100';
const RIGHT_SIDEBAR_CARD_BODY_CLASS_NAME = 'px-5 py-5';

type UiApprovalHistory = {
  audit_logs: Array<{
    _id: string;
    template_id: string;
    action: string;
    performed_by: string;
    previous_status?: string;
    new_status?: string;
    details?: Record<string, unknown>;
    timestamp: number;
  }>;
};

type EditorTemplate = ITemplate;
type TTemplatePreviewMode = 'rendered' | 'variables';
type TEditorDisplayMode = 'editor' | 'docx' | 'preview';

const getTemplateEditorDisplayContent = (
  rawHtml: string,
  values: Record<string, string>,
  mode: TTemplatePreviewMode,
) => {
  const normalizedRawHtml = normalizeVariableHtml(rawHtml || '');
  return mode === 'variables' ? normalizedRawHtml : applyVariablesToHtmlWithHighlight(normalizedRawHtml, values);
};

const cloneTemplateConfig = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const shouldHydrateVariableValue = (value: string | undefined, varKey: string) => {
  if (value === undefined || value === null) return true;
  const normalized = String(value).trim();
  return normalized === `{{${varKey}}}`;
};

const normalizeTemplateForEditor = (template: ITemplate): EditorTemplate => template;

const mergeTemplateVariablesPayload = (
  template: ITemplate,
  variablesPayload: TemplateVariablesPayload | null | undefined,
): ITemplate => {
  if (variablesPayload === undefined) {
    return template;
  }

  return {
    ...template,
    variables: variablesPayload,
  };
};

export const TemplateEditorPage = ({ template_id, workspaceMode = false }: ITemplateEditorPageProps) => {
  const search = useSearch({ strict: false }) as { zoom?: string };
  const { t } = useTranslation();
  const defaultTemplateTitle = t('templateDetail.defaults.newTemplate');
  const tRef = useRef(t);
  const defaultTemplateTitleRef = useRef(defaultTemplateTitle);

  const [value, setValue] = useState(DEFAULT_TEMPLATE);
  const [rawContent, setRawContent] = useState(DEFAULT_TEMPLATE);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [renderVarValues, setRenderVarValues] = useState<Record<string, string>>({});
  const [renderedVarValues, setRenderedVarValues] = useState<Record<string, string>>({});
  const [varTypes, setVarTypes] = useState<VarTypes>({});
  const [varTitles, setVarTitles] = useState<Record<string, string>>({});
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, TableTemplate>>({});
  const [selectedDocumentTemplates, setSelectedDocumentTemplates] = useState<Record<string, DocumentTemplate>>({});
  const [documentTemplateValues, setDocumentTemplateValues] = useState<Record<string, Record<string, string>>>({});
  const [docxEditorSnapshot, setDocxEditorSnapshot] = useState<TemplateDocxEditorSnapshot | null>(null);
  const [artifactType, setArtifactType] = useState<TArtifactType>('rich_text');
  const [artifactConfig, setArtifactConfig] = useState<unknown>(createDefaultArtifactConfig('rich_text'));
  const [artifactSourceFileName, setArtifactSourceFileName] = useState('');
  const [artifactFileId, setArtifactFileId] = useState('');
  const [templateVariableSettings, setTemplateVariableSettings] = useState(DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS);
  const [templateVariableSettingsReady, setTemplateVariableSettingsReady] = useState(false);
  const [variableStateLoadedKey, setVariableStateLoadedKey] = useState('');
  const [variableDraftDirty, setVariableDraftDirty] = useState(false);

  const navigate = useNavigate();
  const isWorkspaceZoomed = workspaceMode && (search.zoom === '1' || search.zoom === 'true');
  const [varsInDoc, setVarsInDoc] = useState<VariableKey[]>([]);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, _setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadArtifactType, setUploadArtifactType] = useState<TArtifactType>('rich_text');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [originalRawContent, setOriginalRawContent] = useState(DEFAULT_TEMPLATE);
  const [originalTemplateTitle, setOriginalTemplateTitle] = useState(defaultTemplateTitle);
  const [originalTemplateDescription, setOriginalTemplateDescription] = useState('');
  const [originalTemplateType, setOriginalTemplateType] = useState<string>('');
  const [originalArtifactType, setOriginalArtifactType] = useState<TArtifactType>('rich_text');
  const [originalArtifactConfig, setOriginalArtifactConfig] = useState<unknown>(
    createDefaultArtifactConfig('rich_text'),
  );
  const [originalArtifactSourceFileName, setOriginalArtifactSourceFileName] = useState('');
  const [originalArtifactFileId, setOriginalArtifactFileId] = useState('');
  const [originalVisibility, setOriginalVisibility] = useState<TemplateVisibility>('PRIVATE');
  const [originalTemplateMetadata, setOriginalTemplateMetadata] = useState<ITemplateMetadata>({});
  const [originalShareRules, setOriginalShareRules] = useState<ITemplateShareRule[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<TTemplateWorkflowAction | null>(null);
  const [showTemplateNameModal, setShowTemplateNameModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [templateDescriptionInput, setTemplateDescriptionInput] = useState('');
  const [selectedTemplateType, setSelectedTemplateType] = useState('');
  const [selectedVisibility, setSelectedVisibility] = useState<TemplateVisibility>('PRIVATE');
  const selectedTemplateTypeRef = useRef(selectedTemplateType);
  const selectedVisibilityRef = useRef(selectedVisibility);
  const [share_rules, setShareRules] = useState<ITemplateShareRule[]>([]);
  const [template_metadata, setTemplateMetadata] = useState<ITemplateMetadata>({});
  const [templateTitle, setTemplateTitle] = useState(defaultTemplateTitle);
  const [templateDescription, setTemplateDescription] = useState('');
  const [templatePreviewMode, setTemplatePreviewMode] = useState<TTemplatePreviewMode>('rendered');
  const [editorDisplayMode, setEditorDisplayMode] = useState<TEditorDisplayMode>('docx');
  const templatePreviewModeRef = useRef<TTemplatePreviewMode>(templatePreviewMode);
  const [showSaveBeforeVariablesDialog, setShowSaveBeforeVariablesDialog] = useState(false);
  const [pendingOpenVariablesAfterSave, setPendingOpenVariablesAfterSave] = useState(false);
  const [showRenderConfigJsonDialog, setShowRenderConfigJsonDialog] = useState(false);
  const [renderConfigJsonText, setRenderConfigJsonText] = useState('');
  const [renderConfigJsonError, setRenderConfigJsonError] = useState<string | null>(null);

  useEffect(() => {
    tRef.current = t;
    defaultTemplateTitleRef.current = defaultTemplateTitle;
    selectedTemplateTypeRef.current = selectedTemplateType;
    selectedVisibilityRef.current = selectedVisibility;
    templatePreviewModeRef.current = templatePreviewMode;
  }, [defaultTemplateTitle, selectedTemplateType, selectedVisibility, templatePreviewMode, t]);

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

  // Approval workflow states
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [template, setTemplate] = useState<EditorTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(Boolean(template_id));
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<UiApprovalHistory | undefined>(
    template_id
      ? undefined
      : {
          audit_logs: [],
        },
  );
  const [editorRuntime, setEditorRuntime] = useState<TemplateEditorRuntime | null>(null);
  const [editorConfig, setEditorConfig] = useState<Awaited<ReturnType<typeof createEditorConfig>> | null>(null);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [showDragPanel, setShowDragPanel] = useState(false);
  const editorRef = useRef<{ editor: ClassicEditor } | null>(null);
  const mentionEditorCleanupRef = useRef<(() => void) | null>(null);
  const variableDropHandlerCleanupRef = useRef<(() => void) | null>(null);
  const officeArtifactEditorRef = useRef<IOfficeArtifactEditorRef | null>(null);
  const workflowActionRef = useRef<TTemplateWorkflowAction | null>(null);
  const savedSelectionRangeRef = useRef<ModelRange | null>(null);
  const skipRawContentSyncRef = useRef(false);
  const rawContentRef = useRef(rawContent);
  const varValuesRef = useRef(varValues);
  const varTypesRef = useRef(varTypes);
  const varTitlesRef = useRef(varTitles);
  const selectedTemplatesRef = useRef(selectedTemplates);
  const selectedDocumentTemplatesRef = useRef(selectedDocumentTemplates);
  const documentTemplateValuesRef = useRef(documentTemplateValues);
  const docxEditorSnapshotRef = useRef<TemplateDocxEditorSnapshot | null>(null);
  const highlightRafIdRef = useRef<number | null>(null);
  const inspectorAttachedRef = useRef(false);
  const performanceRenderCountRef = useRef(0);
  const performanceValueUpdateCountRef = useRef(0);
  const performanceTableTemplateUpdateCountRef = useRef(0);
  const performanceDocumentTemplateUpdateCountRef = useRef(0);
  const variableDraftRestoreKeyRef = useRef<string | null>(null);
  const variableDraftAutosaveReadyRef = useRef(false);
  const variableDraftSkipNextWriteRef = useRef(false);

  useEffect(() => {
    performanceRenderCountRef.current += 1;
    const cycle = performanceRenderCountRef.current;
    if (!shouldLogVariablePerformanceCycle(cycle)) return;

    logVariablePerformance('TemplateEditorPage committed render', {
      cycle,
      workspace_mode: workspaceMode,
      variable_count: varsInDoc.length,
      value_count: Object.keys(varValues).length,
      table_template_count: Object.keys(selectedTemplates).length,
      document_template_count: Object.keys(selectedDocumentTemplates).length,
    });
  });

  const { catalog: variableCatalog, ready: variableCatalogReady } = useVariableCatalog(
    selectedTemplateType,
    artifactType,
  );
  const dragPanelItems = useMemo(
    () => (variableCatalog ? getVariablePickerItems('', variableCatalog, { template_type: selectedTemplateType }) : []),
    [variableCatalog, selectedTemplateType],
  );
  const artifactPlaceholderContent = useMemo(
    () => buildArtifactPlaceholderContent(artifactType, artifactConfig, artifactSourceFileName),
    [artifactConfig, artifactSourceFileName, artifactType],
  );
  const artifactBindingKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...getArtifactCatalogVariableKeys(variableCatalog),
          ...extractArtifactVariableKeys(artifactConfig),
          ...varsInDoc,
        ]),
      ).sort(),
    [artifactConfig, variableCatalog, varsInDoc],
  );
  const shouldUseDocxEditor = false;
  const shouldUseDocxPreviewEditor = true;
  const shouldPersistDocxEditorSnapshot = shouldUseDocxEditor || shouldUseDocxPreviewEditor;
  const templateTypeOptions = useTemplateTypeOptions();
  const filterConfig = useFilterConfig();
  const organizationUnitOptions = useOrganizationUnitOptions();
  const profile = profileStore((s) => s.profile);
  const isAdmin = isAdminProfile(profile) || isRootProfile(profile);
  const canManageRenderConfigJson = isAdmin || canAccessTechRoot(profile);
  const templateTypeOption = useMemo(
    () => templateTypeOptions.find((option) => option.value === selectedTemplateType) ?? null,
    [selectedTemplateType, templateTypeOptions],
  );
  const metadataFields = useMemo<FilterField[]>(
    () => filterConfig[selectedTemplateType]?.fields ?? [],
    [filterConfig, selectedTemplateType],
  );

  // Computed states (must be after template/query declarations)
  const isExistingTemplate = Boolean(template_id);
  const isTemplateRouteRecordPending = Boolean(template_id && (!template || String(template.id) !== template_id));
  const rawStatus = template?.status;
  const templateStatus = toUiStatus(rawStatus);
  const displayStatus = template?.is_published ? 'Published' : templateStatus;
  const allowEditAllStatus = ALLOW_EDIT_ALL_STATUS;
  const isOfficeArtifact = artifactType === 'spreadsheet' || artifactType === 'presentation';
  const canUseOfficeArtifactEditor = isOfficeArtifact && Boolean(template_id);
  const canEdit =
    !isTemplateRouteRecordPending &&
    (allowEditAllStatus ||
      !isExistingTemplate ||
      (template?.permissions?.can_edit ?? (rawStatus === 'DRAFT' || rawStatus === 'REJECTED')));
  const hasContent = artifactType !== 'rich_text' || hasMeaningfulTemplateContent(rawContent || value);
  const canSubmit =
    !isTemplateRouteRecordPending && isExistingTemplate && (template?.permissions?.can_submit ?? canEdit) && hasContent;
  const canDelete =
    !isTemplateRouteRecordPending && isExistingTemplate && (template?.permissions?.can_delete ?? isAdmin);
  const canApprove =
    !isTemplateRouteRecordPending &&
    (template?.permissions?.can_approve ?? (isAdmin && (rawStatus === 'SUBMITTED' || rawStatus === 'APPROVAL')));
  const canReject =
    !isTemplateRouteRecordPending &&
    (template?.permissions?.can_reject ??
      (isAdmin && (rawStatus === 'SUBMITTED' || rawStatus === 'APPROVAL' || rawStatus === 'APPROVED')));
  const canPublish =
    !isTemplateRouteRecordPending &&
    (template?.permissions?.can_publish ?? (isAdmin && rawStatus === 'APPROVED' && !template?.is_published));
  const canUnpublish =
    !isTemplateRouteRecordPending &&
    (template?.permissions?.can_unpublish ?? (isAdmin && Boolean(template?.is_published)));
  const canReturnToDraft = !isTemplateRouteRecordPending && Boolean(template?.permissions?.can_reset_to_draft);
  const canCreateNewVersion =
    !isTemplateRouteRecordPending &&
    (template?.permissions?.can_create_new_version ?? (isAdmin && rawStatus === 'APPROVED'));
  const readOnly = isTemplateRouteRecordPending || (isExistingTemplate && !canEdit);
  const isWorkflowBusy = isSaving || workflowAction !== null;
  const showRightSidebar =
    !template_id || templateLoading || Boolean(template && !isTemplateRouteRecordPending) || Boolean(templateError);

  const startWorkflowAction = useCallback(
    (action: TTemplateWorkflowAction) => {
      if (workflowActionRef.current || isSaving) {
        return false;
      }

      workflowActionRef.current = action;
      setWorkflowAction(action);
      setIsSaving(true);
      return true;
    },
    [isSaving],
  );

  const finishWorkflowAction = useCallback(() => {
    workflowActionRef.current = null;
    setWorkflowAction(null);
    setIsSaving(false);
  }, []);

  const navigateToVariablesWorkspace = useCallback(
    (nextTemplateId?: string) => {
      navigate({
        to: nextTemplateId ? '/templates/$id/variables' : '/templates/new/variables',
        params: nextTemplateId ? { id: nextTemplateId } : undefined,
      });
    },
    [navigate],
  );

  const refreshTemplate = useCallback(async () => {
    const fallbackTitle = defaultTemplateTitleRef.current;

    if (!template_id) {
      setTemplate(null);
      setApprovalHistory({ audit_logs: [] });
      setTemplateLoading(false);
      setTemplateError(null);
      setValue(DEFAULT_TEMPLATE);
      setOriginalRawContent(DEFAULT_TEMPLATE);
      setRawContent(DEFAULT_TEMPLATE);
      setTemplateTitle(fallbackTitle);
      setTemplateDescription('');
      setOriginalTemplateTitle(fallbackTitle);
      setOriginalTemplateDescription('');
      setSelectedTemplateType('');
      setOriginalTemplateType('');
      setSelectedVisibility('PRIVATE');
      setOriginalVisibility('PRIVATE');
      setShareRules([]);
      setOriginalShareRules([]);
      setTemplateMetadata({});
      setOriginalTemplateMetadata({});
      setArtifactType('rich_text');
      setOriginalArtifactType('rich_text');
      setArtifactConfig(createDefaultArtifactConfig('rich_text'));
      setOriginalArtifactConfig(createDefaultArtifactConfig('rich_text'));
      setArtifactSourceFileName('');
      setOriginalArtifactSourceFileName('');
      setArtifactFileId('');
      setOriginalArtifactFileId('');
      setDocxEditorSnapshot(null);
      docxEditorSnapshotRef.current = null;
      setVariableDraftDirty(false);
      setVariableStateLoadedKey('template:new');
      return null;
    }

    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const [templateData, auditLogsRes] = await Promise.all([
        getTemplateByIdAPI(template_id),
        workspaceMode
          ? Promise.resolve({ data: [] as ITemplateAuditLog[] })
          : listTemplateAuditLogsAPI({ template_id, page: 1, page_size: 100 }),
      ]);

      setTemplate(normalizeTemplateForEditor(templateData));
      setTemplateTitle(templateData.name || fallbackTitle);
      setTemplateDescription(templateData.description || '');
      setOriginalTemplateTitle(templateData.name || fallbackTitle);
      setOriginalTemplateDescription(templateData.description || '');
      setSelectedTemplateType(templateData.template_type || '');
      setOriginalTemplateType(templateData.template_type || '');
      const loadedArtifactType = normalizeArtifactType(templateData.artifact_type);
      const loadedArtifactConfig = stripArtifactConfigFileReferences(
        templateData.artifact_config ?? createDefaultArtifactConfig(loadedArtifactType),
      );
      setArtifactType(loadedArtifactType);
      setOriginalArtifactType(loadedArtifactType);
      setArtifactConfig(loadedArtifactConfig);
      setOriginalArtifactConfig(loadedArtifactConfig);
      setArtifactSourceFileName(templateData.source_file_name || '');
      setOriginalArtifactSourceFileName(templateData.source_file_name || '');
      setArtifactFileId(templateData.file_id || '');
      setOriginalArtifactFileId(templateData.file_id || '');
      setSelectedVisibility(templateData.visibility || 'PRIVATE');
      setOriginalVisibility(templateData.visibility || 'PRIVATE');
      setShareRules(templateData.share_rules || []);
      setOriginalShareRules(templateData.share_rules || []);
      setTemplateMetadata((templateData.template_metadata as ITemplateMetadata) || {});
      setOriginalTemplateMetadata((templateData.template_metadata as ITemplateMetadata) || {});
      setApprovalHistory({
        audit_logs: auditLogsRes.data.map((log: ITemplateAuditLog) => ({
          _id: log.id,
          template_id: log.template_id,
          action: toUiStatus(log.action),
          performed_by: log.performed_by,
          previous_status: log.previous_status ? toUiStatus(log.previous_status) : undefined,
          new_status: log.new_status ? toUiStatus(log.new_status) : undefined,
          details: (log.details as Record<string, unknown> | null) ?? undefined,
          timestamp: toTimestamp(log.timestamp) ?? 0,
        })),
      });

      return normalizeTemplateForEditor(templateData);
    } catch (error: any) {
      setTemplateError(error?.message ?? tRef.current('templateDetail.messages.loadFailed'));
      throw error;
    } finally {
      setTemplateLoading(false);
    }
  }, [template_id, workspaceMode]);

  useEffect(() => {
    void refreshTemplate();
  }, [refreshTemplate]);

  useEffect(() => {
    if (shouldUseDocxEditor) {
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
          setTemplateError(tRef.current('templateDetail.messages.loadEditorFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldUseDocxEditor]);

  useEffect(() => {
    if (template_id || selectedTemplateType || templateTypeOptions.length === 0) {
      return;
    }

    const defaultTemplateType = templateTypeOptions[0].value;
    setSelectedTemplateType(defaultTemplateType);
    setOriginalTemplateType(defaultTemplateType);
  }, [selectedTemplateType, template_id, templateTypeOptions]);

  useEffect(() => {
    if (template_id || selectedVisibility) {
      return;
    }

    setSelectedVisibility('PRIVATE');
  }, [selectedVisibility, template_id]);

  const getRebuildValuesMap = useCallback(
    (currentVarValues = varValues) => {
      // Start with renderedVarValues as fallback (previous render cycle),
      // then overlay current values. Keep previous non-empty values when
      // current value is empty so reverse-mapping can still recover
      // placeholders from the rendered editor content.
      const rebuildMap = { ...renderedVarValues };
      Object.entries(currentVarValues || {}).forEach(([key, val]) => {
        const isEmptyString = typeof val === 'string' && val === '';
        if (val !== undefined && val !== null && !isEmptyString) {
          rebuildMap[key] = val;
        }
      });
      return rebuildMap;
    },
    [renderedVarValues, varValues],
  );

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
      const nextEditorDisplayHtml = getTemplateEditorDisplayContent(
        currentRawContent,
        nextVarValues,
        templatePreviewModeRef.current,
      );

      varValuesRef.current = nextVarValues;
      varTypesRef.current = nextVarTypes;
      varTitlesRef.current = nextVarTitles;
      selectedTemplatesRef.current = nextSelectedTemplates;
      selectedDocumentTemplatesRef.current = nextSelectedDocumentTemplates;
      documentTemplateValuesRef.current = nextDocumentTemplateValues;

      setVarValues(nextVarValues);
      setRenderedVarValues(nextVarValues);
      setVarTypes(nextVarTypes);
      setVarTitles(nextVarTitles);
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

  const writeCurrentTemplateVariableDraft = useCallback(() => {
    if (!template_id || !template) return Promise.resolve();

    return writeVariableWorkspaceDraft({
      scope: 'template',
      id: template_id,
      source_updated_at: template.updated_at,
      updated_at: Date.now(),
      var_values: varValuesRef.current,
      var_types: varTypesRef.current,
      var_titles: varTitlesRef.current,
      selected_templates: selectedTemplatesRef.current,
      selected_document_templates: selectedDocumentTemplatesRef.current,
      document_template_values: documentTemplateValuesRef.current,
    });
  }, [template, template_id]);

  useEffect(() => {
    if (!variableCatalogReady || !templateVariableSettingsReady) {
      return;
    }

    try {
      if (template_id && template) {
        // `content` now stores raw template with {{variables}} placeholders.
        // `preview` stores the rendered HTML (variables substituted).
        // For backwards compatibility, if content looks rendered (no {{}} placeholders)
        // but rawContent exists in variables payload, prefer rawContent.
        const currentArtifactType = normalizeArtifactType(template.artifact_type);
        const currentArtifactConfig = template.artifact_config ?? createDefaultArtifactConfig(currentArtifactType);
        const currentArtifactPlaceholderContent = buildArtifactPlaceholderContent(
          currentArtifactType,
          currentArtifactConfig,
          template.source_file_name || '',
        );
        const storedContent =
          currentArtifactType !== 'rich_text'
            ? currentArtifactPlaceholderContent || template.content || DEFAULT_TEMPLATE
            : template.content || DEFAULT_TEMPLATE;

        if (template.variables) {
          try {
            const parsedData = (
              typeof template.variables === 'string' ? JSON.parse(template.variables) : template.variables
            ) as TemplateVariablesPayload;
            const variablesArray = parsedData.variables || [];
            const varTypesData = { ...(parsedData.var_types || {}) };
            const varTitlesData = { ...(parsedData.var_titles || {}) };
            const savedDocxEditorSnapshot = parsedData.docx_editor_snapshot ?? null;

            skipRawContentSyncRef.current = true;
            setDocxEditorSnapshot(savedDocxEditorSnapshot);
            docxEditorSnapshotRef.current = savedDocxEditorSnapshot;

            const variablesObj = {} as Record<string, string>;
            variablesArray.forEach((item) => {
              variablesObj[item.key] = item.value;
            });

            const savedStructures = parsedData.template_structures || {};
            const savedDocumentStructures = parsedData.document_template_structures || {};
            const savedDocumentValues = parsedData.document_template_values || {};
            const useLiveVariableConfig = canUseLiveTemplateVariableConfig(templateVariableSettings, {
              status: template.status,
              is_published: template.is_published,
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
                getTemplateVariableTableTemplateByKey(varKey, selectedTemplateTypeRef.current) ??
                (inferredId ? getTableTemplateById(inferredId) : undefined);
              const shouldRefreshFromDefinition = Boolean(definitionTemplate?.refresh_from_definition_on_load);

              if (
                definitionTemplate &&
                (useLiveVariableConfig ||
                  shouldRefreshFromDefinition ||
                  hasInvalidTableTemplateHeaderTree(savedTemplate))
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
                getTemplateVariableDocumentTemplateByKey(varKey, selectedTemplateTypeRef.current) ??
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
            Object.entries(savedDocumentStructures).forEach(([varKey, entry]) => {
              const resolvedTemplate = resolveDocumentTemplate(varKey, entry);
              if (
                resolvedTemplate &&
                (useLiveVariableConfig ||
                  resolvedTemplate.refresh_from_definition_on_load ||
                  resolvedTemplate !== entry?.template ||
                  !variablesObj[varKey])
              ) {
                variablesObj[varKey] = generateDocumentHtml(resolvedTemplate, savedDocumentValues[varKey] || {});
              }
            });

            // Determine the raw template content:
            // 1. Prefer the stored content if it contains {{}} placeholders (new format).
            // 2. Fall back to rawContent from the variables payload (migration path).
            // 3. Last resort: try to reconstruct from rendered HTML (legacy).
            const contentHasPlaceholders = /\{\{[^}]+\}\}/.test(storedContent);
            let resolvedRawContent: string;

            if (contentHasPlaceholders) {
              // Content is already in the correct raw format
              resolvedRawContent = normalizeVariableHtml(storedContent);
            } else if (parsedData.raw_content) {
              // Legacy: content was saved as rendered HTML, but rawContent exists in payload
              resolvedRawContent = normalizeVariableHtml(parsedData.raw_content);
            } else {
              // Very old legacy: try to rebuild from rendered HTML
              resolvedRawContent = rebuildRawContentFromRenderedHtml(
                normalizeVariableHtml(storedContent),
                storedContent,
                variablesObj,
              );
            }

            // Self-heal missing document-template placeholders:
            // if structure exists but rawContent no longer contains
            // {{document_template.*}}, try restoring from rendered
            // HTML blocks using currently saved values.
            Object.keys(savedDocumentStructures).forEach((varKey) => {
              if (!variablesObj[varKey]) return;
              if (resolvedRawContent.includes(`{{${varKey}}}`)) {
                return;
              }
              resolvedRawContent = rebuildRawContentFromRenderedHtml(resolvedRawContent, `{{${varKey}}}`, {
                [varKey]: variablesObj[varKey],
              });
            });

            const documentVariableKeys = Array.from(
              new Set(
                [...Object.keys(variablesObj), ...extractVariablesInOrder(resolvedRawContent)].filter((varKey) =>
                  varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`),
                ),
              ),
            );
            const nextDocumentTemplateValues = { ...savedDocumentValues };

            documentVariableKeys.forEach((varKey) => {
              const resolvedTemplate = resolveDocumentTemplate(varKey, savedDocumentStructures[varKey]);
              if (!resolvedTemplate) {
                return;
              }

              varTypesData[varKey] = 'Document template';
              const values = nextDocumentTemplateValues[varKey] || {};
              nextDocumentTemplateValues[varKey] = values;

              const currentValue = variablesObj[varKey]?.trim() ?? '';
              const placeholder = `{{${varKey}}}`;
              if (
                useLiveVariableConfig ||
                resolvedTemplate.refresh_from_definition_on_load ||
                !currentValue ||
                currentValue === placeholder ||
                currentValue.includes(placeholder)
              ) {
                variablesObj[varKey] = generateDocumentHtml(resolvedTemplate, values);
              }
            });

            const restoredDocumentTemplates = {} as Record<string, DocumentTemplate>;
            documentVariableKeys.forEach((varKey) => {
              const entry = savedDocumentStructures[varKey];
              const resolvedTemplate = resolveDocumentTemplate(varKey, entry);
              if (resolvedTemplate) {
                restoredDocumentTemplates[varKey] = resolvedTemplate;
              }
            });
            resolvedRawContent = ensureDocumentTemplatePlaceholders(
              resolvedRawContent,
              restoredDocumentTemplates,
              variablesObj,
            );
            if (currentArtifactType !== 'rich_text' && currentArtifactPlaceholderContent) {
              resolvedRawContent = normalizeVariableHtml(currentArtifactPlaceholderContent);
            }

            setRawContent(resolvedRawContent);

            // Keep editor display consistent with VariablesDrawer preview:
            // use highlighted rendered HTML in the main editor as well.
            setValue(getTemplateEditorDisplayContent(resolvedRawContent, variablesObj, templatePreviewModeRef.current));
            setOriginalRawContent(resolvedRawContent);

            setVarValues(variablesObj);
            setRenderedVarValues(variablesObj);
            setVarTypes(varTypesData);
            setVarTitles(varTitlesData);
            varValuesRef.current = variablesObj;
            varTypesRef.current = varTypesData;
            varTitlesRef.current = varTitlesData;

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

            setDocumentTemplateValues(nextDocumentTemplateValues);
            documentTemplateValuesRef.current = nextDocumentTemplateValues;
            setDocxEditorDirty(false);
            setVariableDraftDirty(false);
            setVariableStateLoadedKey(`template:${template_id}:${template.updated_at}:variables`);

            setToast({
              message: tRef.current('templateDetail.messages.loadedWithVariables'),
              type: 'info',
            });
            return;
          } catch (parseErr) {
            console.warn('Could not parse template variables:', parseErr);
          }
        }

        const nextStoredContent = normalizeVariableHtml(storedContent);
        setValue(nextStoredContent);
        setOriginalRawContent(nextStoredContent);
        setRawContent(nextStoredContent);
        setVarValues({});
        setRenderedVarValues({});
        setVarTypes({});
        setSelectedTemplates({});
        setSelectedDocumentTemplates({});
        setDocumentTemplateValues({});
        setDocxEditorSnapshot(null);
        setDocxEditorDirty(false);
        varValuesRef.current = {};
        varTypesRef.current = {};
        selectedTemplatesRef.current = {};
        selectedDocumentTemplatesRef.current = {};
        documentTemplateValuesRef.current = {};
        docxEditorSnapshotRef.current = null;
        setVariableDraftDirty(false);
        setVariableStateLoadedKey(`template:${template_id}:${template.updated_at}:empty`);
        setToast({ message: tRef.current('templateDetail.messages.loaded'), type: 'info' });
        return;
      }

      setValue(DEFAULT_TEMPLATE);
      setOriginalRawContent(DEFAULT_TEMPLATE);
      setRawContent(DEFAULT_TEMPLATE);
      setTemplateTitle(defaultTemplateTitleRef.current);
      setTemplateDescription('');
      setOriginalTemplateTitle(defaultTemplateTitleRef.current);
      setOriginalTemplateDescription('');
      setOriginalTemplateType(selectedTemplateTypeRef.current);
      setOriginalVisibility(selectedVisibilityRef.current);
      setOriginalTemplateMetadata({});
      setOriginalShareRules([]);
      setVarValues({});
      setRenderedVarValues({});
      setVarTypes({});
      setSelectedTemplates({});
      setSelectedDocumentTemplates({});
      setDocumentTemplateValues({});
      setDocxEditorSnapshot(null);
      setDocxEditorDirty(false);
      setTemplateMetadata({});
      varValuesRef.current = {};
      varTypesRef.current = {};
      selectedTemplatesRef.current = {};
      selectedDocumentTemplatesRef.current = {};
      documentTemplateValuesRef.current = {};
      docxEditorSnapshotRef.current = null;
      setVariableDraftDirty(false);
      setVariableStateLoadedKey('template:new');
      setToast({ message: tRef.current('templateDetail.messages.creatingNew'), type: 'info' });
    } catch (err: any) {
      console.error(err);
      setToast({
        message: tRef.current('templateDetail.messages.openFailed', { error: err.message }),
        type: 'error',
      });
    }
  }, [
    ensureDocumentTemplatePlaceholders,
    template_id,
    template,
    templateVariableSettings,
    templateVariableSettingsReady,
    variableCatalogReady,
  ]);

  useEffect(() => {
    if (!template_id || !template || !variableStateLoadedKey) {
      variableDraftAutosaveReadyRef.current = false;
      return;
    }

    const restoreKey = `${template_id}:${template.updated_at}:${variableStateLoadedKey}`;
    if (variableDraftRestoreKeyRef.current === restoreKey) {
      return;
    }

    variableDraftRestoreKeyRef.current = restoreKey;
    variableDraftAutosaveReadyRef.current = false;
    let cancelled = false;

    void readVariableWorkspaceDraft('template', template_id)
      .then((draft) => {
        if (cancelled || !draft) return;
        if (draft.source_updated_at && draft.source_updated_at !== template.updated_at) return;

        applyVariableWorkspaceDraft({
          var_values: draft.var_values,
          var_types: draft.var_types,
          var_titles: draft.var_titles,
          selected_templates: draft.selected_templates,
          selected_document_templates: draft.selected_document_templates,
          document_template_values: draft.document_template_values,
        });
        setVariableDraftDirty(true);
        setToast({
          message: tRef.current('templateDetail.messages.restoredUnsavedDraft'),
          type: 'info',
        });
      })
      .catch((error) => {
        console.warn('Cannot restore template variable draft.', error);
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
  }, [applyVariableWorkspaceDraft, template, template_id, variableStateLoadedKey]);

  useEffect(() => {
    if (!template_id || !template || templateLoading || !variableDraftDirty || !variableDraftAutosaveReadyRef.current) {
      return;
    }

    if (variableDraftSkipNextWriteRef.current) {
      variableDraftSkipNextWriteRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writeCurrentTemplateVariableDraft().catch((error) => {
        console.warn('Cannot autosave template variable draft.', error);
      });
    }, VARIABLE_DRAFT_AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    documentTemplateValues,
    selectedDocumentTemplates,
    selectedTemplates,
    template,
    templateLoading,
    template_id,
    varTitles,
    varTypes,
    varValues,
    variableDraftDirty,
    writeCurrentTemplateVariableDraft,
  ]);

  useEffect(() => {
    if (!template_id || !template || !variableDraftDirty) {
      return;
    }

    const flushDraft = () => {
      if (!variableDraftAutosaveReadyRef.current) return;

      void writeCurrentTemplateVariableDraft().catch((error) => {
        console.warn('Cannot flush template variable draft.', error);
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
  }, [template, template_id, variableDraftDirty, writeCurrentTemplateVariableDraft]);

  useEffect(() => {
    const vars = extractVariablesInOrder(rawContent) as VariableKey[];
    setVarsInDoc((prev) => {
      const prevStr = JSON.stringify(prev);
      const nextStr = JSON.stringify(vars);
      return prevStr === nextStr ? prev : vars;
    });

    if (!variableCatalogReady || vars.length === 0) {
      return;
    }

    const nextVarValues = { ...varValuesRef.current };
    const nextVarTypes = { ...varTypesRef.current };
    const nextSelectedTemplates = { ...selectedTemplatesRef.current };
    const nextSelectedDocumentTemplates = { ...selectedDocumentTemplatesRef.current };
    const nextDocumentTemplateValues = { ...documentTemplateValuesRef.current };
    let hasHydratedState = false;

    vars.forEach((varKey) => {
      const parsed = parseVariableName(varKey);
      const defaultType = getDefaultVariableInputTypeForKey(
        varKey,
        nextVarTypes[varKey],
        selectedTemplateTypeRef.current,
      );

      if (nextVarTypes[varKey] !== defaultType) {
        nextVarTypes[varKey] = defaultType;
        hasHydratedState = true;
      }

      const tableTemplate =
        getTemplateVariableTableTemplateByKey(varKey, selectedTemplateTypeRef.current) ??
        (parsed?.table === TABLE_TEMPLATE_VARIABLE_NAMESPACE ? getTableTemplateById(parsed.field) : undefined);

      if (tableTemplate) {
        const selectedTemplate = nextSelectedTemplates[varKey] ?? cloneTemplateConfig(tableTemplate);
        if (!nextSelectedTemplates[varKey]) {
          nextSelectedTemplates[varKey] = selectedTemplate;
          hasHydratedState = true;
        }

        if (shouldHydrateVariableValue(nextVarValues[varKey], varKey)) {
          nextVarValues[varKey] = generateTableHtmlFromTableTemplate(selectedTemplate, nextVarValues);
          hasHydratedState = true;
        }
        return;
      }

      const documentTemplate =
        getTemplateVariableDocumentTemplateByKey(varKey, selectedTemplateTypeRef.current) ??
        (parsed?.table === DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE ? getDocumentTemplateById(parsed.field) : undefined);

      if (documentTemplate) {
        const selectedDocumentTemplate = nextSelectedDocumentTemplates[varKey] ?? cloneTemplateConfig(documentTemplate);
        if (!nextSelectedDocumentTemplates[varKey]) {
          nextSelectedDocumentTemplates[varKey] = selectedDocumentTemplate;
          hasHydratedState = true;
        }

        if (!nextDocumentTemplateValues[varKey]) {
          nextDocumentTemplateValues[varKey] = {};
          hasHydratedState = true;
        }

        if (shouldHydrateVariableValue(nextVarValues[varKey], varKey)) {
          nextVarValues[varKey] = generateDocumentHtml(selectedDocumentTemplate, nextDocumentTemplateValues[varKey]);
          hasHydratedState = true;
        }
        return;
      }

      const defaultValue = getDefaultVariableValueForKey(varKey, selectedTemplateTypeRef.current);
      if (defaultValue !== undefined && shouldHydrateVariableValue(nextVarValues[varKey], varKey)) {
        nextVarValues[varKey] = defaultValue;
        hasHydratedState = true;
      }
    });

    if (!hasHydratedState) {
      return;
    }

    setVarValues(nextVarValues);
    setRenderedVarValues(nextVarValues);
    setVarTypes(nextVarTypes);
    setSelectedTemplates(nextSelectedTemplates);
    setSelectedDocumentTemplates(nextSelectedDocumentTemplates);
    setDocumentTemplateValues(nextDocumentTemplateValues);

    varValuesRef.current = nextVarValues;
    varTypesRef.current = nextVarTypes;
    selectedTemplatesRef.current = nextSelectedTemplates;
    selectedDocumentTemplatesRef.current = nextSelectedDocumentTemplates;
    documentTemplateValuesRef.current = nextDocumentTemplateValues;

    if (templatePreviewModeRef.current === 'rendered') {
      const nextEditorContent = getTemplateEditorDisplayContent(
        rawContent,
        nextVarValues,
        templatePreviewModeRef.current,
      );
      setValue(nextEditorContent);

      if (editorRef.current?.editor && editorRef.current.editor.getData() !== nextEditorContent) {
        skipRawContentSyncRef.current = true;
        editorRef.current.editor.setData(nextEditorContent);
      }
    }
  }, [rawContent, selectedTemplateType, variableCatalogReady]);

  useEffect(() => {
    if (artifactType === 'rich_text' || !artifactPlaceholderContent) {
      return;
    }

    const nextRawContent = normalizeVariableHtml(artifactPlaceholderContent);
    const nextDisplayContent = getTemplateEditorDisplayContent(
      nextRawContent,
      varValuesRef.current,
      templatePreviewModeRef.current,
    );

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
      for (const entry of range.getWalker({
        ignoreElementEnd: true,
      })) {
        const element = entry.item;
        if (!element.is('element')) continue;
        if (!element.hasClass('mention')) continue;

        const mentionAttr = element.getAttribute('data-mention');
        if (typeof mentionAttr !== 'string') continue;

        const key = mentionAttr.replace(/^\{\{|\}\}$/g, '');
        const value = varValuesRef.current[key];
        const isFilled = value !== undefined && value !== null && String(value).trim() !== '';

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
      variableDropHandlerCleanupRef.current?.();
      variableDropHandlerCleanupRef.current = setupVariableDropHandler(editor);

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
      variableDropHandlerCleanupRef.current?.();
      variableDropHandlerCleanupRef.current = null;
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
    () =>
      measureVariablePerformance(
        'TemplateEditorPage applyVariablesToHtml',
        () => applyVariablesToHtml(contentForRender, renderVarValues),
        {
          html_length: contentForRender.length,
          value_count: Object.keys(renderVarValues).length,
        },
      ),
    [contentForRender, renderVarValues],
  );
  const renderedHtmlHighlighted = useMemo(
    () =>
      measureVariablePerformance(
        'TemplateEditorPage applyVariablesToHtmlWithHighlight',
        () => applyVariablesToHtmlWithHighlight(contentForRender, renderVarValues),
        {
          html_length: contentForRender.length,
          value_count: Object.keys(renderVarValues).length,
        },
      ),
    [contentForRender, renderVarValues],
  );
  const handleTemplatePreviewModeChange = useCallback(
    (nextMode: TTemplatePreviewMode) => {
      if (nextMode === templatePreviewModeRef.current) return;

      const currentVarValues = varValuesRef.current;
      const nextRawContent = ensureDocumentTemplatePlaceholders(
        rawContent,
        selectedDocumentTemplatesRef.current,
        currentVarValues,
      );
      const nextEditorContent = getTemplateEditorDisplayContent(nextRawContent, currentVarValues, nextMode);

      templatePreviewModeRef.current = nextMode;
      setTemplatePreviewMode(nextMode);
      if (shouldUseDocxPreviewEditor && docxEditorSnapshotRef.current) {
        setDocxEditorSnapshot(null);
        docxEditorSnapshotRef.current = null;
        setDocxEditorDirty(false);
      }
      if (nextRawContent !== rawContent) {
        setRawContent(nextRawContent);
      }
      setValue(nextEditorContent);

      if (editorRef.current?.editor) {
        skipRawContentSyncRef.current = true;
        editorRef.current.editor.setData(nextEditorContent);
      }
    },
    [ensureDocumentTemplatePlaceholders, rawContent, shouldUseDocxPreviewEditor],
  );

  rawContentRef.current = rawContent;
  varValuesRef.current = varValues;
  varTypesRef.current = varTypes;
  varTitlesRef.current = varTitles;
  selectedTemplatesRef.current = selectedTemplates;
  selectedDocumentTemplatesRef.current = selectedDocumentTemplates;
  documentTemplateValuesRef.current = documentTemplateValues;
  docxEditorSnapshotRef.current = docxEditorSnapshot;

  useEffect(() => {
    void varValues;
    scheduleMentionHighlights();
  }, [varValues, scheduleMentionHighlights]);

  useEffect(() => {
    if (shouldUseDocxEditor) {
      setEditorConfig(null);
      return;
    }

    if (!variableCatalogReady) {
      return;
    }

    let cancelled = false;
    setEditorConfig(null);

    void createEditorConfig(variableCatalog, handleEditorReady, selectedTemplateType)
      .then((config) => {
        if (!cancelled) {
          setEditorConfig(config);
        }
      })
      .catch((error) => {
        console.error('Failed to create CKEditor config', error);
        if (!cancelled) {
          setTemplateError(tRef.current('templateDetail.messages.createEditorConfigFailed'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [handleEditorReady, selectedTemplateType, shouldUseDocxEditor, variableCatalog, variableCatalogReady]);

  const editorCatalogKey = useMemo(
    () => `${template_id ?? 'new'}:${Object.keys(variableCatalog).sort().join('|')}`,
    [template_id, variableCatalog],
  );
  const docxDocumentEditorRef = useRef<IDocxDocumentEditorHandle | null>(null);
  const [docxEditorReady, setDocxEditorReady] = useState(false);
  const [docxEditorDirty, setDocxEditorDirty] = useState(false);
  const docxEditorHtmlContent = templatePreviewMode === 'variables' ? value : renderedHtml;
  const docxEditorHtmlContentKey = useMemo(
    () => createEditorContentKey(docxEditorHtmlContent),
    [docxEditorHtmlContent],
  );
  const initialDocxEditorBuffer = useMemo(() => {
    return getCurrentTemplateDocxEditorSnapshotBuffer(docxEditorSnapshot, docxEditorHtmlContentKey);
  }, [docxEditorHtmlContentKey, docxEditorSnapshot]);

  useEffect(() => {
    if (!docxEditorSnapshot) return;
    if (isCurrentTemplateDocxEditorSnapshot(docxEditorSnapshot, docxEditorHtmlContentKey)) return;

    setDocxEditorSnapshot(null);
    docxEditorSnapshotRef.current = null;
    setDocxEditorDirty(false);
  }, [docxEditorHtmlContentKey, docxEditorSnapshot]);

  const CKEditorComponent = editorRuntime?.CKEditor;
  const ClassicEditorConstructor = editorRuntime?.ClassicEditor;

  const createDocxSnapshot = useCallback(
    (buffer: ArrayBuffer): TemplateDocxEditorSnapshot => ({
      base64: arrayBufferToBase64(buffer),
      file_name: `${templateTitle || template?.name || defaultTemplateTitle}.docx`,
      updated_at: new Date().toISOString(),
      source: 'docx-editor',
      html_content_key: docxEditorHtmlContentKey,
      renderer_version: DOCX_EDITOR_RENDERER_VERSION,
    }),
    [defaultTemplateTitle, docxEditorHtmlContentKey, template?.name, templateTitle],
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
            message: t('templateDetail.messages.saveFailed', { error: error.message }),
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
    () =>
      [
        'template-docx',
        template_id ?? 'new',
        templatePreviewMode,
        docxEditorSnapshot?.updated_at ?? 'html',
        docxEditorHtmlContentKey,
      ].join(':'),
    [docxEditorHtmlContentKey, docxEditorSnapshot?.updated_at, templatePreviewMode, template_id],
  );

  const createDocxExportFileName = useCallback(
    (extension: 'docx' | 'pdf', suffix = '') =>
      createDownloadFileName(`${templateTitle || template?.name || defaultTemplateTitle}${suffix}`, extension),
    [defaultTemplateTitle, template?.name, templateTitle],
  );

  const handleOpenDocxExportPreview = useCallback(
    async (suffix = '', loadingKey = 'export') => {
      let previewWindow: Window | null = null;

      try {
        previewWindow = openDocxExportPreviewWindow();
        setExportLoading(loadingKey);

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
          source: 'template',
          title: templateTitle || template?.name || defaultTemplateTitle,
          fileName: createDocxExportFileName('docx', suffix),
          htmlContent: docxEditorHtmlContent || '<p></p>',
          initialDocumentBuffer,
        });

        navigateDocxExportPreviewWindow(previewWindow, payload.id);
      } catch (error: any) {
        previewWindow?.close();
        setToast({
          message: t('templateDetail.messages.exportWordFailed', { error: error.message }),
          type: 'error',
        });
      } finally {
        setExportLoading(null);
      }
    },
    [
      createDocxExportFileName,
      createDocxSnapshot,
      defaultTemplateTitle,
      docxEditorDirty,
      docxEditorHtmlContent,
      docxEditorHtmlContentKey,
      t,
      template?.name,
      templateTitle,
    ],
  );

  const captureEditorSelection = useCallback(() => {
    const range = editorRef.current?.editor.model.document.selection.getFirstRange();
    savedSelectionRangeRef.current = range ? range.clone() : null;
  }, []);

  const handleOpenVariablePicker = useCallback(() => {
    if (!isOfficeArtifact) {
      captureEditorSelection();
    }
    setShowVariablePicker(true);
  }, [captureEditorSelection, isOfficeArtifact]);

  const handleInsertVariables = useCallback(
    async (items: IVariablePickerItem[]) => {
      if (isOfficeArtifact && officeArtifactEditorRef.current) {
        for (const item of items) {
          await officeArtifactEditorRef.current.insertVariable(item);
        }
        return;
      }

      if (artifactType === 'rich_text' && (editorDisplayMode === 'docx' || shouldUseDocxEditor)) {
        const inserted = docxDocumentEditorRef.current?.insertText(items.map((item) => item.token).join(' '));
        if (inserted) {
          return;
        }
      }

      const editor = editorRef.current?.editor;
      if (!editor) return;

      insertVariablePickerItems(editor, items, savedSelectionRangeRef.current);
      savedSelectionRangeRef.current = editor.model.document.selection.getFirstRange()?.clone() ?? null;
      scheduleMentionHighlights(editor);
    },
    [artifactType, editorDisplayMode, isOfficeArtifact, scheduleMentionHighlights, shouldUseDocxEditor],
  );

  const handleInsertVariable = useCallback(
    (item: IVariablePickerItem) => {
      void handleInsertVariables([item]);
    },
    [handleInsertVariables],
  );

  const buildTemplateVariablesPayload = useCallback(
    (
      nextRawContent: string,
      currentVarValues: Record<string, string>,
      currentVarTypes: VarTypes,
      currentVarTitles: Record<string, string>,
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

      return {
        timestamp: new Date().toISOString(),
        variables: extractVariablesInOrder(nextRawContent).map((varKey) => ({
          key: varKey,
          value: currentVarValues[varKey] ?? '',
        })),
        var_types: currentVarTypes,
        ...(Object.keys(currentVarTitles).length > 0 ? { var_titles: currentVarTitles } : {}),
        raw_content: nextRawContent,
        ...(Object.keys(templateStructures).length > 0 ? { template_structures: templateStructures } : {}),
        ...(Object.keys(documentTemplateStructures).length > 0
          ? { document_template_structures: documentTemplateStructures }
          : {}),
        ...(Object.keys(currentDocumentTemplateValues).length > 0
          ? {
              document_template_values: currentDocumentTemplateValues,
            }
          : {}),
        ...(currentDocxEditorSnapshot ? { docx_editor_snapshot: currentDocxEditorSnapshot } : {}),
      };
    },
    [],
  );

  const buildCurrentRenderConfigJson = useCallback((): ITemplateRenderConfigJson => {
    const currentVarValues = varValuesRef.current;
    const currentSelectedDocumentTemplates = selectedDocumentTemplatesRef.current;
    const syncedRawContent = ensureDocumentTemplatePlaceholders(
      rawContent,
      currentSelectedDocumentTemplates,
      currentVarValues,
    );
    const variablesPayload = buildTemplateVariablesPayload(
      syncedRawContent,
      currentVarValues,
      varTypesRef.current,
      varTitlesRef.current,
      selectedTemplatesRef.current,
      currentSelectedDocumentTemplates,
      documentTemplateValuesRef.current,
      docxEditorSnapshotRef.current,
    );

    return {
      kind: TEMPLATE_RENDER_CONFIG_KIND,
      schema_version: TEMPLATE_RENDER_CONFIG_SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      template: {
        name: templateTitle.trim() || template?.name || defaultTemplateTitle,
        description: templateDescription.trim() || undefined,
        template_type: selectedTemplateType || template?.template_type || undefined,
      },
      render: {
        content: syncedRawContent,
        artifact_type: artifactType,
        artifact_config: stripArtifactConfigFileReferences(artifactConfig),
        source_file_name: artifactSourceFileName || template?.source_file_name || undefined,
        variables: variablesPayload,
      },
    };
  }, [
    artifactConfig,
    artifactSourceFileName,
    artifactType,
    buildTemplateVariablesPayload,
    defaultTemplateTitle,
    ensureDocumentTemplatePlaceholders,
    rawContent,
    selectedTemplateType,
    template?.name,
    template?.source_file_name,
    template?.template_type,
    templateDescription,
    templateTitle,
  ]);

  const handleCopyRenderConfigJson = useCallback(async () => {
    const jsonText = JSON.stringify(buildCurrentRenderConfigJson(), null, 2);
    setRenderConfigJsonText(jsonText);
    setRenderConfigJsonError(null);

    try {
      await navigator.clipboard?.writeText(jsonText);
      setToast({
        message: t('templateDetail.renderConfig.copySuccess'),
        type: 'success',
      });
    } catch {
      setToast({
        message: t('templateDetail.renderConfig.copyFallback'),
        type: 'info',
      });
    }
  }, [buildCurrentRenderConfigJson, t]);

  const handleOpenRenderConfigJsonDialog = useCallback(() => {
    setRenderConfigJsonError(null);
    setRenderConfigJsonText((current) =>
      current.trim() ? current : JSON.stringify(buildCurrentRenderConfigJson(), null, 2),
    );
    setShowRenderConfigJsonDialog(true);
  }, [buildCurrentRenderConfigJson]);

  const handleApplyRenderConfigJson = useCallback(() => {
    try {
      const parsed = parseTemplateRenderConfigJson(renderConfigJsonText);
      const nextArtifactConfig = parsed.artifactConfig ?? createDefaultArtifactConfig(parsed.artifactType);
      const artifactPlaceholder =
        parsed.artifactType !== 'rich_text'
          ? buildArtifactPlaceholderContent(parsed.artifactType, nextArtifactConfig, parsed.sourceFileName)
          : '';
      const nextRawContent = normalizeVariableHtml(parsed.content || artifactPlaceholder || DEFAULT_TEMPLATE);
      const variablesPayload = parsed.variables;
      const nextVarValues = {} as Record<string, string>;

      (Array.isArray(variablesPayload?.variables) ? variablesPayload.variables : []).forEach((item) => {
        if (item?.key) {
          nextVarValues[item.key] = item.value ?? '';
        }
      });

      const nextVarTypes = { ...(variablesPayload?.var_types ?? {}) } as VarTypes;
      const nextVarTitles = { ...(variablesPayload?.var_titles ?? {}) };
      const nextSelectedTemplates = {} as Record<string, TableTemplate>;
      Object.entries(variablesPayload?.template_structures ?? {}).forEach(([varKey, entry]) => {
        if (entry?.template) {
          nextSelectedTemplates[varKey] = entry.template;
        }
      });

      const nextSelectedDocumentTemplates = {} as Record<string, DocumentTemplate>;
      Object.entries(variablesPayload?.document_template_structures ?? {}).forEach(([varKey, entry]) => {
        if (entry?.template) {
          nextSelectedDocumentTemplates[varKey] = entry.template;
        }
      });

      const nextDocumentTemplateValues = { ...(variablesPayload?.document_template_values ?? {}) };
      const finalRawContent = ensureDocumentTemplatePlaceholders(
        nextRawContent,
        nextSelectedDocumentTemplates,
        nextVarValues,
      );
      const nextEditorValue = getTemplateEditorDisplayContent(
        finalRawContent,
        nextVarValues,
        templatePreviewModeRef.current,
      );

      setArtifactType(parsed.artifactType);
      setArtifactConfig(nextArtifactConfig);
      setArtifactSourceFileName(parsed.sourceFileName);
      if (parsed.templateType) {
        setSelectedTemplateType(parsed.templateType);
        selectedTemplateTypeRef.current = parsed.templateType;
      }
      setRawContent(finalRawContent);
      setValue(nextEditorValue);
      setVarsInDoc(extractVariablesInOrder(finalRawContent) as VariableKey[]);
      setVarValues(nextVarValues);
      setRenderedVarValues(nextVarValues);
      setRenderVarValues(nextVarValues);
      setVarTypes(nextVarTypes);
      setVarTitles(nextVarTitles);
      setSelectedTemplates(nextSelectedTemplates);
      setSelectedDocumentTemplates(nextSelectedDocumentTemplates);
      setDocumentTemplateValues(nextDocumentTemplateValues);
      setDocxEditorSnapshot(variablesPayload?.docx_editor_snapshot ?? null);

      varValuesRef.current = nextVarValues;
      varTypesRef.current = nextVarTypes;
      varTitlesRef.current = nextVarTitles;
      selectedTemplatesRef.current = nextSelectedTemplates;
      selectedDocumentTemplatesRef.current = nextSelectedDocumentTemplates;
      documentTemplateValuesRef.current = nextDocumentTemplateValues;
      docxEditorSnapshotRef.current = variablesPayload?.docx_editor_snapshot ?? null;

      if (editorRef.current?.editor) {
        skipRawContentSyncRef.current = true;
        editorRef.current.editor.setData(nextEditorValue);
      }

      setRenderConfigJsonError(null);
      setShowRenderConfigJsonDialog(false);
      setToast({
        message: t('templateDetail.renderConfig.applySuccess'),
        type: 'success',
      });
    } catch (error: any) {
      const message = error?.message || t('templateDetail.renderConfig.invalidJson');
      setRenderConfigJsonError(message);
      setToast({
        message: t('templateDetail.renderConfig.applyFailed', { error: message }),
        type: 'error',
      });
    }
  }, [ensureDocumentTemplatePlaceholders, renderConfigJsonText, t]);

  const handleArtifactTypeChange = useCallback(
    (value: string) => {
      const nextType = normalizeArtifactType(value);
      setArtifactType(nextType);
      setArtifactConfig((current: unknown) =>
        nextType === artifactType ? current : createDefaultArtifactConfig(nextType),
      );

      if (nextType === 'rich_text' && artifactType !== 'rich_text') {
        setRawContent(DEFAULT_TEMPLATE);
        setValue(DEFAULT_TEMPLATE);
        setRenderedVarValues({});
      }

      resetDocxEditorSnapshot();
    },
    [artifactType, resetDocxEditorSnapshot],
  );

  const handleFileUpload = async (event: FileSelectEvent) => {
    const file =
      ('dataTransfer' in event ? event.dataTransfer.files?.[0] : null) ||
      ('target' in event ? (event.target as HTMLInputElement)?.files?.[0] : null);
    if (!file) return;
    setIsDragging(false);
    _setIsUploading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension && extension !== 'doc' && extension !== 'docx') {
        const uploaded = await uploadArtifactSourceAPI(file);
        const nextArtifactType = normalizeArtifactType(uploaded.artifact_type);
        const nextArtifactConfig = stripArtifactConfigFileReferences(
          uploaded.artifact_config ?? createDefaultArtifactConfig(nextArtifactType),
        );
        const nextContent = buildArtifactPlaceholderContent(
          nextArtifactType,
          nextArtifactConfig,
          uploaded.source_file_name,
        );
        setArtifactType(nextArtifactType);
        setArtifactConfig(nextArtifactConfig);
        setArtifactSourceFileName(uploaded.source_file_name);
        setArtifactFileId(uploaded.file_id);
        setRawContent(nextContent);
        setValue(nextContent);
        setRenderedVarValues({});
        resetDocxEditorSnapshot();
        setToast({ message: t('templateDetail.messages.uploaded', { name: file.name }), type: 'success' });
        setShowUploadModal(false);
        return;
      }

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
      const nextContent = normalizeVariableHtml(result.value?.trim() ?? '');
      const nextVarValues: Record<string, string> = {};
      const nextVarTypes: VarTypes = {};
      const nextVarTitles: Record<string, string> = {};
      const nextSelectedTemplates: Record<string, TableTemplate> = {};
      const nextSelectedDocumentTemplates: Record<string, DocumentTemplate> = {};
      const nextDocumentTemplateValues: Record<string, Record<string, string>> = {};
      const nextEditorValue = getTemplateEditorDisplayContent(
        nextContent,
        nextVarValues,
        templatePreviewModeRef.current,
      );
      const nextDocxEditorHtmlContent =
        templatePreviewModeRef.current === 'variables'
          ? nextEditorValue
          : applyVariablesToHtml(nextContent, nextVarValues);
      const nextDocxEditorSnapshot: TemplateDocxEditorSnapshot = {
        base64: arrayBufferToBase64(arrayBuffer),
        file_name: file.name,
        updated_at: new Date().toISOString(),
        source: 'docx-editor',
        html_content_key: createEditorContentKey(nextDocxEditorHtmlContent),
        renderer_version: DOCX_EDITOR_RENDERER_VERSION,
      };
      setArtifactType('rich_text');
      setArtifactConfig(createDefaultArtifactConfig('rich_text'));
      setArtifactSourceFileName(file.name);
      setArtifactFileId('');
      setRawContent(nextContent);
      setValue(nextEditorValue);
      setVarValues(nextVarValues);
      setRenderedVarValues(nextVarValues);
      setRenderVarValues(nextVarValues);
      setVarTypes(nextVarTypes);
      setVarTitles(nextVarTitles);
      setSelectedTemplates(nextSelectedTemplates);
      setSelectedDocumentTemplates(nextSelectedDocumentTemplates);
      setDocumentTemplateValues(nextDocumentTemplateValues);
      setDocxEditorSnapshot(nextDocxEditorSnapshot);
      varValuesRef.current = nextVarValues;
      varTypesRef.current = nextVarTypes;
      varTitlesRef.current = nextVarTitles;
      selectedTemplatesRef.current = nextSelectedTemplates;
      selectedDocumentTemplatesRef.current = nextSelectedDocumentTemplates;
      documentTemplateValuesRef.current = nextDocumentTemplateValues;
      docxEditorSnapshotRef.current = nextDocxEditorSnapshot;
      setDocxEditorDirty(false);
      setToast({ message: t('templateDetail.messages.uploaded', { name: file.name }), type: 'success' });
      setShowUploadModal(false);
    } catch (error: any) {
      setToast({
        message: t('templateDetail.messages.uploadFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      _setIsUploading(false);
    }
  };

  const handleExportPdf = useCallback(async () => {
    if (shouldUseDocxEditor || shouldUseDocxPreviewEditor) {
      await handleOpenDocxExportPreview();
      return;
    }

    try {
      setExportLoading('pdf');
      await exportToPdf(
        renderedHtml,
        createDownloadFileName(templateTitle || template?.name || defaultTemplateTitle, 'pdf'),
      );
      setToast({
        message: t('templateDetail.messages.exportPdfSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('templateDetail.messages.exportPdfFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  }, [
    defaultTemplateTitle,
    handleOpenDocxExportPreview,
    renderedHtml,
    shouldUseDocxEditor,
    shouldUseDocxPreviewEditor,
    t,
    template?.name,
    templateTitle,
  ]);

  const handleExportWord = useCallback(async () => {
    if (shouldUseDocxEditor || shouldUseDocxPreviewEditor) {
      await handleOpenDocxExportPreview();
      return;
    }

    try {
      setExportLoading('word');
      await exportToWord(
        renderedHtml,
        createDownloadFileName(templateTitle || template?.name || defaultTemplateTitle, 'docx'),
      );
      setToast({
        message: t('templateDetail.messages.exportWordSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('templateDetail.messages.exportWordFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  }, [
    defaultTemplateTitle,
    handleOpenDocxExportPreview,
    renderedHtml,
    shouldUseDocxEditor,
    shouldUseDocxPreviewEditor,
    t,
    template?.name,
    templateTitle,
  ]);

  const handleExportArtifact = useCallback(
    async (outputFormat?: TArtifactExportFormat) => {
      if (artifactType === 'rich_text') return;

      try {
        if (isOfficeArtifact && !template_id) {
          setToast({
            message: 'Save this template first to export from the ONLYOFFICE source file.',
            type: 'info',
          });
          return;
        }
        const resolvedFormat =
          outputFormat ?? (artifactType === 'spreadsheet' ? 'xlsx' : artifactType === 'presentation' ? 'pptx' : 'pdf');
        setExportLoading(`artifact-${resolvedFormat}`);
        if (isOfficeArtifact && template_id) {
          await officeArtifactEditorRef.current?.forceSave();
        }
        const blob =
          isOfficeArtifact && template_id
            ? await exportOfficeArtifactAPI(
                'template',
                template_id,
                resolvedFormat === 'pdf' ? 'pdf' : artifactType === 'spreadsheet' ? 'xlsx' : 'pptx',
              )
            : await exportArtifactAPI({
                artifact_type: artifactType,
                artifact_config: artifactConfig,
                output_format: resolvedFormat,
                file_name: templateTitle || template?.name || defaultTemplateTitle,
                values: renderedVarValues,
              });
        await saveFile(
          blob,
          createDownloadFileName(
            templateTitle || template?.name || defaultTemplateTitle,
            resolvedFormat === 'svg' ? 'svg' : resolvedFormat,
          ),
        );
        setToast({
          message: t('templateDetail.messages.exportPdfSuccess'),
          type: 'success',
        });
      } catch (error: any) {
        setToast({
          message: t('templateDetail.messages.exportPdfFailed', { error: error.message }),
          type: 'error',
        });
      } finally {
        setExportLoading(null);
      }
    },
    [
      artifactConfig,
      artifactType,
      defaultTemplateTitle,
      isOfficeArtifact,
      renderedVarValues,
      t,
      template?.name,
      templateTitle,
      template_id,
    ],
  );

  const handlePreviewExportPdf = async () => {
    if (shouldUseDocxEditor || shouldUseDocxPreviewEditor) {
      await handleOpenDocxExportPreview(' preview', 'preview-export');
      return;
    }

    try {
      setExportLoading('preview-pdf');
      await exportToPdf(
        renderedHtml,
        createDownloadFileName(`${templateTitle || template?.name || defaultTemplateTitle} preview`, 'pdf'),
      );
      setToast({
        message: t('templateDetail.messages.exportPdfSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('templateDetail.messages.exportPdfFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  };

  const handlePreviewExportWord = async () => {
    if (shouldUseDocxEditor || shouldUseDocxPreviewEditor) {
      await handleOpenDocxExportPreview(' preview', 'preview-export');
      return;
    }

    try {
      setExportLoading('preview-word');
      await exportToWord(
        renderedHtml,
        createDownloadFileName(`${templateTitle || template?.name || defaultTemplateTitle} preview`, 'docx'),
      );
      setToast({
        message: t('templateDetail.messages.exportWordSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      setToast({
        message: t('templateDetail.messages.exportWordFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handleExportPdf();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        handleExportWord();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExportPdf, handleExportWord]);

  const handleSaveVariables = useCallback(
    async (overrideVarValues: Record<string, string>) => {
      if (!template_id) {
        setToast({
          message: t('templateDetail.messages.missingTemplateId'),
          type: 'error',
        });
        return;
      }

      try {
        const currentVarValues = overrideVarValues || varValuesRef.current;
        const currentVarTypes = varTypesRef.current;
        const currentVarTitles = varTitlesRef.current;
        const currentSelectedTemplates = selectedTemplatesRef.current;
        const currentSelectedDocumentTemplates = selectedDocumentTemplatesRef.current;
        const currentDocumentTemplateValues = documentTemplateValuesRef.current;
        // Variables save should not mutate template structure.
        // Keep rawContent as source-of-truth for placeholders.
        const resolvedRawContent = ensureDocumentTemplatePlaceholders(
          rawContent,
          currentSelectedDocumentTemplates,
          currentVarValues,
        );
        setRawContent(resolvedRawContent);
        const freshRenderedHtml = applyVariablesToHtml(resolvedRawContent, currentVarValues);
        const variablesPayload = buildTemplateVariablesPayload(
          resolvedRawContent,
          currentVarValues,
          currentVarTypes,
          currentVarTitles,
          currentSelectedTemplates,
          currentSelectedDocumentTemplates,
          currentDocumentTemplateValues,
          null,
        );
        setDocxEditorSnapshot(null);
        docxEditorSnapshotRef.current = null;

        const updatedTemplate = await updateTemplateAPI(
          template_id,
          {
            content: resolvedRawContent,
            preview: freshRenderedHtml,
            template_type: selectedTemplateType || template?.template_type || undefined,
            visibility: selectedVisibility,
            share_rules:
              selectedVisibility === 'RESTRICTED'
                ? share_rules.map((rule) => ({
                    subject_type: rule.subject_type,
                    subject_id: rule.subject_id,
                  }))
                : [],
            variables: variablesPayload,
          },
          { includeSnapshot: false },
        );
        setTemplate(normalizeTemplateForEditor(mergeTemplateVariablesPayload(updatedTemplate, variablesPayload)));

        skipRawContentSyncRef.current = true;
        setVarValues(currentVarValues);
        setRenderedVarValues(currentVarValues);
        const editorDisplayHtml = getTemplateEditorDisplayContent(
          resolvedRawContent,
          currentVarValues,
          templatePreviewModeRef.current,
        );
        setValue(editorDisplayHtml);
        if (editorRef.current?.editor) {
          editorRef.current.editor.setData(editorDisplayHtml);
        }
        setOriginalRawContent(resolvedRawContent);
        setVariableDraftDirty(false);
        variableDraftSkipNextWriteRef.current = true;
        void deleteVariableWorkspaceDraft('template', template_id).catch((error) => {
          console.warn('Cannot clear saved template variable draft.', error);
        });

        setToast({
          message: t('templateDetail.messages.saveVariablesSuccess'),
          type: 'success',
        });
      } catch (error: any) {
        console.error('Save failed:', error);
        setToast({
          message: t('templateDetail.messages.saveFailed', { error: error.message }),
          type: 'error',
        });
        throw error;
      }
    },
    [
      buildTemplateVariablesPayload,
      ensureDocumentTemplatePlaceholders,
      rawContent,
      share_rules,
      selectedTemplateType,
      selectedVisibility,
      t,
      template?.template_type,
      template_id,
    ],
  );

  const handleRemoveVariable = useCallback(
    (varKey: string) => {
      const removedRenderedValue = normalizeVariableHtml(varValuesRef.current[varKey] || '');
      const escapedVarKey = varKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const placeholderRegex = new RegExp(`\\{\\{\\s*${escapedVarKey}\\s*\\}\\}`, 'gi');

      let newRawContent = normalizeVariableHtml(rawContent).replace(placeholderRegex, '');

      // ── Document template: remove <div data-document-template="id"> ──
      // The wrapper div makes removal trivial — locate by attribute,
      // strip the entire element.  This mirrors how <table>/<figure>
      // works for table-template variables.
      const isDocTemplateVar = varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`);
      if (isDocTemplateVar) {
        const template_id = varKey.slice(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`.length);
        const divRegex = new RegExp(
          `<div\\b[^>]*${DOCUMENT_TEMPLATE_WRAPPER_ATTR}="${template_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*?<\\/div>`,
          'gi',
        );
        newRawContent = newRawContent.replace(divRegex, '');
      }

      // ── Generic fallbacks (for non-document-template vars & legacy) ──
      if (removedRenderedValue) {
        // Try standard rebuild → replace → remove cycle
        for (let pass = 0; pass < 8; pass += 1) {
          const rebuiltOnce = rebuildRawContentFromRenderedHtml(newRawContent, `{{${varKey}}}`, {
            [varKey]: removedRenderedValue,
          }).replace(placeholderRegex, '');
          if (rebuiltOnce === newRawContent) break;
          newRawContent = rebuiltOnce;
        }

        // Exact string removal
        while (newRawContent.includes(removedRenderedValue)) {
          newRawContent = newRawContent.replace(removedRenderedValue, '');
        }

        // Text-signature fallback for doc templates without wrapper
        // (legacy data saved before the div-wrapper was introduced)
        if (isDocTemplateVar) {
          newRawContent = removeRenderedDocumentTemplateHtml(newRawContent, removedRenderedValue);
        }
      }

      const newVarValues = { ...varValuesRef.current };
      delete newVarValues[varKey];
      setVarValues(newVarValues);
      varValuesRef.current = newVarValues;

      const newVarTypes = { ...varTypesRef.current };
      delete newVarTypes[varKey];
      setVarTypes(newVarTypes);
      varTypesRef.current = newVarTypes;

      const newSelectedTemplates = { ...selectedTemplatesRef.current };
      delete newSelectedTemplates[varKey];
      setSelectedTemplates(newSelectedTemplates);
      selectedTemplatesRef.current = newSelectedTemplates;

      const newSelectedDocumentTemplates = {
        ...selectedDocumentTemplatesRef.current,
      };
      delete newSelectedDocumentTemplates[varKey];
      setSelectedDocumentTemplates(newSelectedDocumentTemplates);
      selectedDocumentTemplatesRef.current = newSelectedDocumentTemplates;

      const newDocumentTemplateValues = {
        ...documentTemplateValuesRef.current,
      };
      delete newDocumentTemplateValues[varKey];
      setDocumentTemplateValues(newDocumentTemplateValues);
      documentTemplateValuesRef.current = newDocumentTemplateValues;

      newRawContent = ensureDocumentTemplatePlaceholders(newRawContent, newSelectedDocumentTemplates, newVarValues);
      setRawContent(newRawContent);

      const newRendered = getTemplateEditorDisplayContent(newRawContent, newVarValues, templatePreviewModeRef.current);
      setValue(newRendered);
      setRenderedVarValues(newVarValues);
      if (editorRef.current?.editor) {
        skipRawContentSyncRef.current = true;
        editorRef.current.editor.setData(newRendered);
      }
    },
    [rawContent, ensureDocumentTemplatePlaceholders],
  );

  const handleReplaceVariable = useCallback(
    (oldVarKey: string, item: IVariablePickerItem) => {
      const newVarKey = item.key;

      if (oldVarKey === newVarKey) {
        return;
      }

      if (varsInDoc.includes(newVarKey)) {
        setToast({
          message: t('templateDetail.messages.duplicateVariable'),
          type: 'error',
        });
        return;
      }

      const replacedState = replaceVariableState({
        rawContent,
        oldVarKey,
        newVarKey,
        template_type: selectedTemplateType,
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

      setSelectedTemplates(replacedState.selectedTemplates);
      selectedTemplatesRef.current = replacedState.selectedTemplates;

      setSelectedDocumentTemplates(replacedState.selectedDocumentTemplates);
      selectedDocumentTemplatesRef.current = replacedState.selectedDocumentTemplates;

      setDocumentTemplateValues(replacedState.documentTemplateValues);
      documentTemplateValuesRef.current = replacedState.documentTemplateValues;

      setRawContent(nextRawContent);

      const nextRendered = getTemplateEditorDisplayContent(
        nextRawContent,
        replacedState.varValues,
        templatePreviewModeRef.current,
      );
      setValue(nextRendered);
      setRenderedVarValues(replacedState.varValues);

      if (editorRef.current?.editor) {
        skipRawContentSyncRef.current = true;
        editorRef.current.editor.setData(nextRendered);
      }

      setToast({
        message: t('templateDetail.messages.replaceVariableSuccess', { label: item.label }),
        type: 'success',
      });
    },
    [ensureDocumentTemplatePlaceholders, rawContent, t, varsInDoc],
  );

  const normalizedCurrentRawContent =
    artifactType === 'rich_text'
      ? normalizeVariableHtml(ensureDocumentTemplatePlaceholders(rawContent, selectedDocumentTemplates, varValues))
      : normalizeVariableHtml(artifactPlaceholderContent);
  const normalizedOriginalRawContent =
    originalArtifactType === 'rich_text'
      ? normalizeVariableHtml(originalRawContent)
      : normalizeVariableHtml(
          buildArtifactPlaceholderContent(originalArtifactType, originalArtifactConfig, originalArtifactSourceFileName),
        );

  const hasChanges =
    normalizedCurrentRawContent !== normalizedOriginalRawContent ||
    templateTitle !== originalTemplateTitle ||
    templateDescription !== originalTemplateDescription ||
    selectedTemplateType !== originalTemplateType ||
    artifactType !== originalArtifactType ||
    JSON.stringify(artifactConfig) !== JSON.stringify(originalArtifactConfig) ||
    artifactSourceFileName !== originalArtifactSourceFileName ||
    artifactFileId !== originalArtifactFileId ||
    selectedVisibility !== originalVisibility ||
    JSON.stringify(template_metadata) !== JSON.stringify(originalTemplateMetadata) ||
    JSON.stringify(share_rules) !== JSON.stringify(originalShareRules) ||
    (shouldPersistDocxEditorSnapshot && docxEditorDirty);

  const handleSaveTemplate = useCallback(async () => {
    if (isSaving || workflowActionRef.current) return;

    const currentVarValues = varValuesRef.current;
    const currentSelectedDocumentTemplates = selectedDocumentTemplatesRef.current;
    const syncedRawContent = ensureDocumentTemplatePlaceholders(
      rawContent,
      currentSelectedDocumentTemplates,
      currentVarValues,
    );

    if (artifactType === 'rich_text' && !hasMeaningfulTemplateContent(syncedRawContent)) {
      setPendingOpenVariablesAfterSave(false);
      setToast({
        message: t('templateDetail.messages.emptyContent'),
        type: 'error',
      });
      return;
    }

    const effectiveArtifactFileId = artifactFileId || template?.file_id || '';
    if (requiresArtifactSourceFile(artifactType) && !effectiveArtifactFileId.trim()) {
      setPendingOpenVariablesAfterSave(false);
      setToast({
        message: t('templateDetail.messages.artifactSourceRequired'),
        type: 'error',
      });
      return;
    }

    if (!template_id) {
      let defaultName = defaultTemplateTitle;
      const match = value.match(/<h[1-3]>([^<]+)<\/h[1-3]>/);
      if (match) {
        defaultName = match[1];
      }
      setTemplateNameInput(templateTitle.trim() || defaultName);
      setTemplateDescriptionInput(templateDescription.trim());
      setShowTemplateNameModal(true);
    } else {
      try {
        setIsSaving(true);
        if (isOfficeArtifact) {
          await officeArtifactEditorRef.current?.forceSave();
        }
        let nextDocxEditorSnapshot = docxEditorSnapshotRef.current;
        const shouldCaptureDocxEditorSnapshot =
          shouldPersistDocxEditorSnapshot &&
          Boolean(docxDocumentEditorRef.current) &&
          (editorDisplayMode === 'docx' || shouldUseDocxEditor || docxEditorDirty);
        if (shouldCaptureDocxEditorSnapshot) {
          nextDocxEditorSnapshot = await persistCurrentDocxEditorSnapshot();
        } else if (shouldPersistDocxEditorSnapshot && docxEditorDirty && nextDocxEditorSnapshot) {
          setDocxEditorDirty(false);
        } else if (shouldPersistDocxEditorSnapshot && docxEditorDirty) {
          throw new Error('DOCX editor is not ready.');
        }
        const currentVarTypes = varTypesRef.current;
        const currentVarTitles = varTitlesRef.current;
        const currentSelectedTemplates = selectedTemplatesRef.current;
        const currentDocumentTemplateValues = documentTemplateValuesRef.current;
        const plainRenderedContent = applyVariablesToHtml(syncedRawContent, currentVarValues);
        const variablesPayload = buildTemplateVariablesPayload(
          syncedRawContent,
          currentVarValues,
          currentVarTypes,
          currentVarTitles,
          currentSelectedTemplates,
          currentSelectedDocumentTemplates,
          currentDocumentTemplateValues,
          nextDocxEditorSnapshot,
        );
        const persistedArtifactConfig = stripArtifactConfigFileReferences(artifactConfig);

        if (variablesPayload.variables.length === 0 && !variablesPayload.docx_editor_snapshot) {
          // No variables: content and preview are both the plain content
          const updatedTemplate = await updateTemplateAPI(
            template_id,
            {
              name: templateTitle.trim() || template?.name || defaultTemplateTitle,
              description: templateDescription.trim(),
              template_type: selectedTemplateType || template?.template_type || undefined,
              visibility: selectedVisibility,
              share_rules:
                selectedVisibility === 'RESTRICTED'
                  ? share_rules.map((rule) => ({
                      subject_type: rule.subject_type,
                      subject_id: rule.subject_id,
                    }))
                  : [],
              content: syncedRawContent,
              artifact_type: artifactType,
              artifact_config: persistedArtifactConfig,
              source_file_name: artifactSourceFileName || template?.source_file_name || '',
              file_id: effectiveArtifactFileId,
              preview: plainRenderedContent,
              variables: null,
              template_metadata,
            },
            { includeSnapshot: false },
          );
          setTemplate(normalizeTemplateForEditor(mergeTemplateVariablesPayload(updatedTemplate, null)));
          setVarValues({});
          setRenderedVarValues({});
          setVarTypes({});
          setSelectedTemplates({});
          setSelectedDocumentTemplates({});
          setDocumentTemplateValues({});
          setDocxEditorSnapshot(null);
          varValuesRef.current = {};
          varTypesRef.current = {};
          selectedTemplatesRef.current = {};
          selectedDocumentTemplatesRef.current = {};
          documentTemplateValuesRef.current = {};
          docxEditorSnapshotRef.current = null;
          setRawContent(syncedRawContent);
          setVarsInDoc([]);
          if (editorRef.current?.editor) {
            skipRawContentSyncRef.current = true;
            editorRef.current.editor.setData(plainRenderedContent);
          }
        } else {
          const updatedTemplate = await updateTemplateAPI(
            template_id,
            {
              name: templateTitle.trim() || template?.name || defaultTemplateTitle,
              description: templateDescription.trim(),
              template_type: selectedTemplateType || template?.template_type || undefined,
              visibility: selectedVisibility,
              share_rules:
                selectedVisibility === 'RESTRICTED'
                  ? share_rules.map((rule) => ({
                      subject_type: rule.subject_type,
                      subject_id: rule.subject_id,
                    }))
                  : [],
              content: syncedRawContent,
              artifact_type: artifactType,
              artifact_config: persistedArtifactConfig,
              source_file_name: artifactSourceFileName || template?.source_file_name || '',
              file_id: effectiveArtifactFileId,
              preview: plainRenderedContent,
              variables: variablesPayload,
              template_metadata,
            },
            { includeSnapshot: false },
          );
          setTemplate(normalizeTemplateForEditor(mergeTemplateVariablesPayload(updatedTemplate, variablesPayload)));
          setRawContent(syncedRawContent);
          if (editorRef.current?.editor) {
            skipRawContentSyncRef.current = true;
            editorRef.current.editor.setData(
              getTemplateEditorDisplayContent(syncedRawContent, currentVarValues, templatePreviewModeRef.current),
            );
          }
        }

        const editorDisplayAfterSave = getTemplateEditorDisplayContent(
          syncedRawContent,
          currentVarValues,
          templatePreviewModeRef.current,
        );
        setValue(editorDisplayAfterSave);
        setRenderedVarValues(currentVarValues);
        setOriginalRawContent(syncedRawContent);
        setOriginalTemplateTitle(templateTitle);
        setOriginalTemplateDescription(templateDescription);
        setOriginalTemplateType(selectedTemplateType);
        setOriginalArtifactType(artifactType);
        setArtifactConfig(persistedArtifactConfig);
        setOriginalArtifactConfig(persistedArtifactConfig);
        setOriginalArtifactSourceFileName(artifactSourceFileName);
        setOriginalArtifactFileId(effectiveArtifactFileId);
        setOriginalVisibility(selectedVisibility);
        setOriginalTemplateMetadata(template_metadata);
        setOriginalShareRules(share_rules);

        if (pendingOpenVariablesAfterSave && template_id) {
          setPendingOpenVariablesAfterSave(false);
          navigateToVariablesWorkspace(template_id);
          return;
        }

        setToast({
          message: t('templateDetail.messages.saved'),
          type: 'success',
        });
      } catch (error: any) {
        setPendingOpenVariablesAfterSave(false);
        console.error(error);
        setToast({
          message: t('templateDetail.messages.saveFailed', { error: error.message }),
          type: 'error',
        });
      } finally {
        setIsSaving(false);
      }
    }
  }, [
    buildTemplateVariablesPayload,
    defaultTemplateTitle,
    ensureDocumentTemplatePlaceholders,
    persistCurrentDocxEditorSnapshot,
    rawContent,
    share_rules,
    shouldPersistDocxEditorSnapshot,
    docxEditorDirty,
    artifactConfig,
    artifactFileId,
    artifactSourceFileName,
    artifactType,
    isOfficeArtifact,
    template,
    templateDescription,
    template_id,
    template_metadata,
    selectedTemplateType,
    selectedVisibility,
    pendingOpenVariablesAfterSave,
    templateTitle,
    t,
    value,
    navigateToVariablesWorkspace,
    isSaving,
  ]);

  const handleConfirmTemplateName = useCallback(async () => {
    if (isSaving || workflowActionRef.current) return;

    if (!templateNameInput.trim()) {
      setToast({
        message: t('templateDetail.messages.nameRequired'),
        type: 'error',
      });
      return;
    }

    if (!selectedTemplateType) {
      setToast({
        message: t('templateDetail.messages.typeRequired'),
        type: 'error',
      });
      return;
    }

    if (selectedVisibility === 'RESTRICTED' && share_rules.length === 0) {
      setToast({
        message: t('templateDetail.messages.restrictedShareRequired'),
        type: 'error',
      });
      return;
    }

    try {
      setIsSaving(true);
      const currentVarValues = varValuesRef.current;
      const currentVarTypes = varTypesRef.current;
      const currentVarTitles = varTitlesRef.current;
      const currentSelectedTemplates = selectedTemplatesRef.current;
      const currentSelectedDocumentTemplates = selectedDocumentTemplatesRef.current;
      const currentDocumentTemplateValues = documentTemplateValuesRef.current;
      let nextDocxEditorSnapshot = docxEditorSnapshotRef.current;
      const shouldCaptureDocxEditorSnapshot =
        shouldPersistDocxEditorSnapshot &&
        Boolean(docxDocumentEditorRef.current) &&
        (editorDisplayMode === 'docx' || shouldUseDocxEditor || docxEditorDirty);
      if (shouldCaptureDocxEditorSnapshot) {
        nextDocxEditorSnapshot = await persistCurrentDocxEditorSnapshot();
      } else if (shouldPersistDocxEditorSnapshot && docxEditorDirty && nextDocxEditorSnapshot) {
        setDocxEditorDirty(false);
      } else if (shouldPersistDocxEditorSnapshot && docxEditorDirty) {
        throw new Error('DOCX editor is not ready.');
      }
      const syncedRawContent = ensureDocumentTemplatePlaceholders(
        rawContent,
        currentSelectedDocumentTemplates,
        currentVarValues,
      );

      if (artifactType === 'rich_text' && !hasMeaningfulTemplateContent(syncedRawContent)) {
        setToast({
          message: t('templateDetail.messages.emptyContent'),
          type: 'error',
        });
        return;
      }

      if (requiresArtifactSourceFile(artifactType) && !artifactFileId.trim()) {
        setToast({
          message: t('templateDetail.messages.artifactSourceRequired'),
          type: 'error',
        });
        return;
      }

      const plainRenderedContent = applyVariablesToHtml(syncedRawContent, currentVarValues);
      const variablesPayload = buildTemplateVariablesPayload(
        syncedRawContent,
        currentVarValues,
        currentVarTypes,
        currentVarTitles,
        currentSelectedTemplates,
        currentSelectedDocumentTemplates,
        currentDocumentTemplateValues,
        nextDocxEditorSnapshot,
      );
      const persistedArtifactConfig = stripArtifactConfigFileReferences(artifactConfig);

      const createdTemplate = await createTemplateAPI({
        name: templateNameInput.trim(),
        description: templateDescriptionInput.trim(),
        content: syncedRawContent,
        template_type: selectedTemplateType,
        artifact_type: artifactType,
        artifact_config: persistedArtifactConfig,
        visibility: selectedVisibility,
        share_rules:
          selectedVisibility === 'RESTRICTED'
            ? share_rules.map((rule) => ({
                subject_type: rule.subject_type,
                subject_id: rule.subject_id,
              }))
            : [],
        preview: plainRenderedContent,
        file_id: artifactFileId,
        source_file_name:
          artifactSourceFileName || (artifactType === 'rich_text' ? `${templateNameInput.trim()}.docx` : ''),
        template_metadata: Object.keys(template_metadata).length > 0 ? template_metadata : undefined,
        ...(variablesPayload.variables.length > 0 || variablesPayload.docx_editor_snapshot
          ? { variables: variablesPayload }
          : {}),
      });
      setTemplate(normalizeTemplateForEditor(createdTemplate));
      setTemplateTitle(createdTemplate.name || templateNameInput.trim());
      setTemplateDescription(createdTemplate.description || templateDescriptionInput.trim());
      setRawContent(syncedRawContent);
      setValue(getTemplateEditorDisplayContent(syncedRawContent, currentVarValues, templatePreviewModeRef.current));
      setRenderedVarValues(currentVarValues);
      setOriginalRawContent(syncedRawContent);
      setOriginalTemplateTitle(createdTemplate.name || templateNameInput.trim());
      setOriginalTemplateDescription(createdTemplate.description || templateDescriptionInput.trim());
      setOriginalTemplateType(selectedTemplateType);
      setOriginalArtifactType(artifactType);
      setArtifactConfig(persistedArtifactConfig);
      setOriginalArtifactConfig(persistedArtifactConfig);
      setOriginalArtifactSourceFileName(artifactSourceFileName);
      setOriginalArtifactFileId(artifactFileId);
      setOriginalVisibility(selectedVisibility);
      setOriginalTemplateMetadata(template_metadata);
      setOriginalShareRules(share_rules);
      setDocxEditorSnapshot(nextDocxEditorSnapshot);
      setShowTemplateNameModal(false);
      setTemplateNameInput('');
      setTemplateDescriptionInput('');

      if (pendingOpenVariablesAfterSave) {
        setPendingOpenVariablesAfterSave(false);
        navigateToVariablesWorkspace(createdTemplate.id);
      } else {
        navigate({ to: `/templates/${createdTemplate.id}` });
      }

      setToast({
        message: t('templateDetail.messages.created'),
        type: 'success',
      });
    } catch (error: any) {
      console.error(error);
      setToast({
        message: t('templateDetail.messages.saveFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    templateNameInput,
    templateDescriptionInput,
    defaultTemplateTitle,
    artifactConfig,
    artifactFileId,
    artifactSourceFileName,
    artifactType,
    template_metadata,
    share_rules,
    selectedTemplateType,
    selectedVisibility,
    rawContent,
    pendingOpenVariablesAfterSave,
    buildTemplateVariablesPayload,
    docxEditorDirty,
    ensureDocumentTemplatePlaceholders,
    navigate,
    navigateToVariablesWorkspace,
    persistCurrentDocxEditorSnapshot,
    shouldPersistDocxEditorSnapshot,
    t,
    isSaving,
  ]);

  const handleSelectedTemplatesChange = useCallback((updates: Record<string, TableTemplate | null>) => {
    const next = { ...selectedTemplatesRef.current };
    let hasChanges = false;

    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === undefined) {
        if (k in next) {
          delete next[k];
          hasChanges = true;
        }
        return;
      }

      if (next[k] !== v) {
        next[k] = v;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;
    performanceTableTemplateUpdateCountRef.current += 1;
    const cycle = performanceTableTemplateUpdateCountRef.current;
    if (shouldLogVariablePerformanceCycle(cycle)) {
      logVariablePerformance('TemplateEditorPage table template state update', {
        cycle,
        keys: Object.keys(updates),
      });
    }
    selectedTemplatesRef.current = next;
    setSelectedTemplates(next);
    setVariableDraftDirty(true);
  }, []);

  const handleVarValuesChange = useCallback((updates: Record<string, string>) => {
    const next = { ...varValuesRef.current };
    let hasChanges = false;

    Object.entries(updates).forEach(([k, v]) => {
      if (next[k] !== v) {
        next[k] = v;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;
    performanceValueUpdateCountRef.current += 1;
    const cycle = performanceValueUpdateCountRef.current;
    if (shouldLogVariablePerformanceCycle(cycle)) {
      logVariablePerformance('TemplateEditorPage variable value state update', {
        cycle,
        keys: Object.keys(updates),
        value_lengths: Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, value.length])),
      });
    }
    varValuesRef.current = next;
    setVarValues(next);
    setVariableDraftDirty(true);
  }, []);

  const handleVarTypesChange = useCallback((updates: VarTypes) => {
    const next = { ...varTypesRef.current };
    let hasChanges = false;

    Object.entries(updates).forEach(([k, v]) => {
      if (next[k] !== v) {
        next[k] = v;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;
    varTypesRef.current = next;
    setVarTypes(next);
    setVariableDraftDirty(true);
  }, []);

  const handleSelectedDocumentTemplatesChange = useCallback((updates: Record<string, DocumentTemplate | null>) => {
    const next = { ...selectedDocumentTemplatesRef.current };
    let hasChanges = false;

    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === undefined) {
        if (k in next) {
          delete next[k];
          hasChanges = true;
        }
        return;
      }

      if (next[k] !== v) {
        next[k] = v;
        hasChanges = true;
      }
    });

    if (!hasChanges) return;
    performanceDocumentTemplateUpdateCountRef.current += 1;
    const cycle = performanceDocumentTemplateUpdateCountRef.current;
    if (shouldLogVariablePerformanceCycle(cycle)) {
      logVariablePerformance('TemplateEditorPage document template state update', {
        cycle,
        keys: Object.keys(updates),
      });
    }
    selectedDocumentTemplatesRef.current = next;
    setSelectedDocumentTemplates(next);
    setVariableDraftDirty(true);
  }, []);

  const handleTitleChange = useCallback((varKey: string, title: string) => {
    setVarTitles((prev) => {
      if (prev[varKey] === title) return prev;
      const next = { ...prev, [varKey]: title };
      varTitlesRef.current = next;
      setVariableDraftDirty(true);
      return next;
    });
  }, []);

  const handleDocumentTemplateValuesChange = useCallback((varKey: string, values: Record<string, string>) => {
    const previousValues = documentTemplateValuesRef.current[varKey] ?? {};
    const mergedValues = { ...previousValues };
    let hasChanges = false;

    Object.entries(values).forEach(([k, v]) => {
      if (mergedValues[k] !== v) {
        mergedValues[k] = v;
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

  const handleClearVariablesWorkspaceState = useCallback(() => {
    setTemplateMetadata({});
  }, []);

  const handleCancelSaveBeforeVariables = useCallback(() => {
    setShowSaveBeforeVariablesDialog(false);
    setPendingOpenVariablesAfterSave(false);
  }, []);

  const handleConfirmSaveBeforeVariables = useCallback(async () => {
    setShowSaveBeforeVariablesDialog(false);
    setPendingOpenVariablesAfterSave(true);
    await handleSaveTemplate();
  }, [handleSaveTemplate]);

  const handleCloseTemplateNameModal = useCallback(() => {
    setShowTemplateNameModal(false);
    setPendingOpenVariablesAfterSave(false);
  }, []);

  const openVariablesWorkspace = useCallback(() => {
    if (!hasChanges) {
      navigateToVariablesWorkspace(template_id);
      return;
    }

    setShowSaveBeforeVariablesDialog(true);
  }, [hasChanges, navigateToVariablesWorkspace, template_id]);

  const handleDelete = useCallback(async () => {
    if (!template_id || !template) return;

    const confirmed = window.confirm(t('templateDetail.messages.confirmDelete', { name: template.name }));
    if (!confirmed) return;
    if (!startWorkflowAction('delete')) return;

    try {
      await deleteTemplateAPI(template_id);
      navigate({ to: '/templates' });
    } catch (error: any) {
      setToast({
        message: t('templateDetail.messages.actionFailed', {
          error: error instanceof Error ? error.message : t('templateDetail.messages.deleteFallback'),
        }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [finishWorkflowAction, navigate, startWorkflowAction, t, template, template_id]);

  const handleSubmitForApproval = useCallback(async () => {
    if (!template_id) {
      throw new Error(t('templateDetail.messages.saveBeforeAction'));
    }
    if (!startWorkflowAction('submit')) {
      throw new Error('Vui lòng chờ tác vụ hiện tại hoàn tất.');
    }

    try {
      await submitTemplateForApprovalAPI(template_id);
      await refreshTemplate();
    } catch (error) {
      setToast({
        message: t('templateDetail.messages.actionFailed', {
          error: error instanceof Error ? error.message : t('templateDetail.messages.submitFallback'),
        }),
        type: 'error',
      });
      throw error;
    } finally {
      finishWorkflowAction();
    }
  }, [finishWorkflowAction, refreshTemplate, startWorkflowAction, t, template_id]);

  const handleApproveTemplate = useCallback(async () => {
    if (!template_id || !startWorkflowAction('approve')) return;

    try {
      await approveTemplateAPI(template_id);
      await refreshTemplate();
    } catch (error) {
      setToast({
        message: t('templateDetail.messages.actionFailed', {
          error: error instanceof Error ? error.message : t('templateDetail.messages.approveFallback'),
        }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [finishWorkflowAction, refreshTemplate, startWorkflowAction, t, template_id]);

  const handleRejectTemplate = useCallback(
    async (_templateId: string, _approverId: string, reason: string) => {
      if (!template_id) {
        throw new Error(t('templateDetail.messages.saveBeforeAction'));
      }
      if (!startWorkflowAction('reject')) {
        throw new Error('Vui lòng chờ tác vụ hiện tại hoàn tất.');
      }

      try {
        await rejectTemplateAPI(template_id, {
          rejection_reason: reason,
        });
        await refreshTemplate();
      } catch (error) {
        setToast({
          message: t('templateDetail.messages.actionFailed', {
            error: error instanceof Error ? error.message : t('templateDetail.messages.rejectFallback'),
          }),
          type: 'error',
        });
        throw error;
      } finally {
        finishWorkflowAction();
      }
    },
    [finishWorkflowAction, refreshTemplate, startWorkflowAction, t, template_id],
  );

  const handleReturnToDraftTemplate = useCallback(async () => {
    if (!template_id || !template) return;

    const confirmed = window.confirm(t('templateDetail.messages.confirmReturnDraft', { name: template.name }));
    if (!confirmed) return;
    if (!startWorkflowAction('return-draft')) return;

    try {
      await returnTemplateToDraftAPI(template_id);
      await refreshTemplate();
      setToast({
        message: t('templateDetail.messages.returnDraftSuccess'),
        type: 'success',
      });
    } catch (error) {
      setToast({
        message: t('templateDetail.messages.actionFailed', {
          error: error instanceof Error ? error.message : t('templateDetail.messages.returnDraftFallback'),
        }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [finishWorkflowAction, refreshTemplate, startWorkflowAction, t, template, template_id]);

  const handlePublishTemplate = useCallback(async () => {
    if (!template_id || !startWorkflowAction('publish')) return;

    try {
      await publishTemplateAPI(template_id);
      await refreshTemplate();
    } catch (error) {
      setToast({
        message: t('templateDetail.messages.actionFailed', {
          error: error instanceof Error ? error.message : t('templateDetail.messages.publishFallback'),
        }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [finishWorkflowAction, refreshTemplate, startWorkflowAction, t, template_id]);

  const handleUnpublishTemplate = useCallback(async () => {
    if (!template_id || !startWorkflowAction('unpublish')) return;

    try {
      await unpublishTemplateAPI(template_id);
      await refreshTemplate();
    } catch (error) {
      setToast({
        message: t('templateDetail.messages.actionFailed', {
          error: error instanceof Error ? error.message : t('templateDetail.messages.unpublishFallback'),
        }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [finishWorkflowAction, refreshTemplate, startWorkflowAction, t, template_id]);

  const handleCreateNewVersionTemplate = useCallback(async () => {
    if (!template_id || !template) return;

    const confirmed = window.confirm(t('templateDetail.messages.confirmNewVersion', { name: template.name }));
    if (!confirmed) return;
    if (!startWorkflowAction('new-version')) return;

    try {
      const newTemplate = await createTemplateNewVersionAPI(template_id);
      navigate({ to: `/templates/${newTemplate.id}` });
    } catch (error) {
      setToast({
        message: t('templateDetail.messages.actionFailed', {
          error: error instanceof Error ? error.message : t('templateDetail.messages.newVersionFallback'),
        }),
        type: 'error',
      });
    } finally {
      finishWorkflowAction();
    }
  }, [finishWorkflowAction, navigate, startWorkflowAction, t, template, template_id]);

  const handleCloseVariablesWorkspace = useCallback(() => {
    if (template_id) {
      navigate({ to: '/templates/$id', params: { id: template_id } });
      return;
    }

    navigate({ to: '/templates/new' });
  }, [navigate, template_id]);

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
      const addedVars = newVars.filter((varName) => !currentVars.includes(varName));

      if (addedVars.length > 0 || normalizedData !== normalizeVariableHtml(rawContent)) {
        setRawContent((prev) => {
          const rebuilt = rebuildRawContentFromRenderedHtml(
            normalizedData,
            prev,
            getRebuildValuesMap(varValuesRef.current),
          );
          return ensureDocumentTemplatePlaceholders(
            rebuilt,
            selectedDocumentTemplatesRef.current,
            varValuesRef.current,
          );
        });
      }
    },
    [ensureDocumentTemplatePlaceholders, getRebuildValuesMap, rawContent],
  );

  const toggleVariablesWorkspaceZoom = useCallback(() => {
    navigate({
      to: template_id ? '/templates/$id/variables' : '/templates/new/variables',
      params: template_id ? { id: template_id } : undefined,
      search: isWorkspaceZoomed ? ({} as never) : ({ zoom: '1' } as never),
    });
  }, [isWorkspaceZoomed, navigate, template_id]);

  const templateDisplayName = templateTitle || template?.name || defaultTemplateTitle;

  const renderTemplateDocxEditor = (previewOnly = false) => (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
          {t('templateDetail.editor.loading')}
        </div>
      }>
      <LazyDocxDocumentEditor
        ref={docxDocumentEditorRef}
        htmlContent={docxEditorHtmlContent}
        initialDocumentBuffer={initialDocxEditorBuffer}
        sourceKey={docxEditorSourceKey}
        fileName={`${templateTitle || 'template'}.docx`}
        readOnly={previewOnly || readOnly}
        className={previewOnly ? 'h-full min-h-0' : undefined}
        variableCatalog={variableCatalog}
        template_type={selectedTemplateType}
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
  );

  const renderTemplateCkEditor = () => {
    if (template_id && templateLoading) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
          {t('templateDetail.editor.loading')}
        </div>
      );
    }

    if (!variableCatalogReady || !CKEditorComponent || !ClassicEditorConstructor || !editorConfig) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
          {t('templateDetail.editor.loading')}
        </div>
      );
    }

    return (
      <CKEditorComponent
        key={editorCatalogKey}
        editor={ClassicEditorConstructor}
        config={editorConfig}
        data={value}
        disabled={readOnly}
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
          if (templatePreviewModeRef.current === 'variables') {
            setRawContent(normalizedData);
            scheduleMentionHighlights();
            return;
          }
          const dataIsEmpty = !normalizedData || normalizedData.replace(/<[^>]*>/g, '').trim() === '';
          if (dataIsEmpty) {
            setRawContent(normalizedData);
          } else {
            const newVars = extractVariablesFromHtml(normalizedData);
            const currentVars = extractVariablesFromHtml(normalizeVariableHtml(rawContent));
            const addedVars = newVars.filter((v) => !currentVars.includes(v));
            if (addedVars.length > 0 || normalizedData !== normalizeVariableHtml(rawContent)) {
              setRawContent((prev) => {
                const rebuilt = rebuildRawContentFromRenderedHtml(
                  normalizedData,
                  prev,
                  getRebuildValuesMap(varValuesRef.current),
                );
                return ensureDocumentTemplatePlaceholders(
                  rebuilt,
                  selectedDocumentTemplatesRef.current,
                  varValuesRef.current,
                );
              });
            }
          }
          scheduleMentionHighlights();
        }}
      />
    );
  };

  if (isTemplateRouteRecordPending) {
    return (
      <div className="flex h-screen min-h-0 flex-col bg-slate-100">
        <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="mb-1 flex items-center gap-1.5 text-sm">
            <button
              type="button"
              onClick={() => navigate({ to: '/templates' })}
              className="flex cursor-pointer items-center gap-1 text-amber-600 hover:text-amber-700">
              <Home className="size-3.5" />
              <span className="font-medium">{t('templateDetail.sidebar.breadcrumbRoot')}</span>
            </button>
            <span className="text-gray-400">›</span>
            {templateError ? (
              <span className="text-gray-500">{defaultTemplateTitle}</span>
            ) : (
              <span className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            )}
          </div>
          <div className="flex min-h-8 items-center">
            {templateError ? (
              <span className="min-w-0 break-words text-xl font-bold text-[#002147]">{defaultTemplateTitle}</span>
            ) : (
              <span className="h-7 w-56 animate-pulse rounded bg-gray-200" />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="flex min-h-[240px] w-full max-w-xl flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
            {templateError ? (
              <p className="text-red-700">{templateError}</p>
            ) : (
              <>
                <Loader2 className="mb-3 size-5 animate-spin text-slate-400" />
                <p>{t('templateDetail.editor.loading')}</p>
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
                  onClick={() => navigate({ to: '/templates' })}
                  className="min-w-0 shrink-0 font-medium text-amber-600 hover:text-amber-700">
                  {t('templateDetail.sidebar.breadcrumbRoot')}
                </button>
                <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <button
                  type="button"
                  onClick={handleCloseVariablesWorkspace}
                  className="min-w-0 truncate text-slate-500 hover:text-slate-700">
                  {templateDisplayName || t('templateDetail.defaults.templateFallback')}
                </button>
                <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0 truncate text-slate-500">{t('templateDetail.actions.variables')}</span>
              </nav>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseVariablesWorkspace}
                  className="size-9 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  title={t('templateDetail.workspace.back')}
                  aria-label={t('templateDetail.workspace.back')}>
                  <Home className="size-4" />
                </Button>
                <div className="min-w-0 truncate text-xl font-bold text-[#002147]">
                  {t('templateDetail.workspace.variablesOf', {
                    name: templateDisplayName || t('templateDetail.defaults.templateFallback'),
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
                  isWorkspaceZoomed ? 'templateDetail.workspace.zoomOutTitle' : 'templateDetail.workspace.zoomInTitle',
                )}>
                {isWorkspaceZoomed ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                {t(isWorkspaceZoomed ? 'templateDetail.workspace.zoomOut' : 'templateDetail.workspace.zoomIn')}
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
              varsInDoc={varsInDoc}
              varValues={varValues}
              onVarValuesChange={handleVarValuesChange}
              varTypes={varTypes}
              onVarTypesChange={handleVarTypesChange}
              varTitles={varTitles}
              onShowToast={setToast}
              rawHtml={contentForRender}
              renderedHtml={renderedHtml}
              renderedHtmlHighlighted={renderedHtmlHighlighted}
              exportLoading={exportLoading}
              exportFileName={templateDisplayName || defaultTemplateTitle}
              onSaveVariables={handleWorkspaceSaveVariables}
              onPreviewContentChange={handleVariablesPreviewContentChange}
              onRemoveVariable={handleRemoveVariable}
              selectedTemplates={selectedTemplates}
              onSelectedTemplatesChange={handleSelectedTemplatesChange}
              selectedDocumentTemplates={selectedDocumentTemplates}
              documentTemplateValues={documentTemplateValues}
              onSelectedDocumentTemplatesChange={handleSelectedDocumentTemplatesChange}
              onDocumentTemplateValuesChange={handleDocumentTemplateValuesChange}
              onClearAll={handleClearVariablesWorkspaceState}
              variableCatalog={variableCatalog}
              template_type={selectedTemplateType}
              onReplaceVariable={handleReplaceVariable}
              readOnly={readOnly}
              onTitleChange={handleTitleChange}
              artifactType={artifactType}
              artifactConfig={artifactConfig}
              artifactValues={varValues}
              artifactVariableKeys={artifactBindingKeys}
              artifactOfficeScope="template"
              artifactOfficeId={template_id}
              onArtifactConfigChange={setArtifactConfig}
            />
          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-slate-100">
      {/* PAGE HEADER */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mb-1 flex items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => navigate({ to: '/templates' })}
            className="flex items-center gap-1 text-amber-600 hover:text-amber-700 cursor-pointer">
            <Home className="size-3.5" />
            <span className="font-medium">{t('templateDetail.sidebar.breadcrumbRoot')}</span>
          </button>
          <span className="text-gray-400">›</span>
          {template_id && templateLoading ? (
            <span className="h-4 w-32 animate-pulse rounded bg-gray-200 cursor-pointer" />
          ) : (
            <span className="text-gray-500">{templateDisplayName}</span>
          )}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="min-w-0 break-words text-xl font-bold text-[#002147]">{templateDisplayName}</span>
            {template && (
              <ApprovalStatusBadge status={displayStatus} rejection_reason={template.rejection_reason ?? undefined} />
            )}
          </div>

          <div className="flex w-full flex-wrap items-center justify-start gap-2 xl:w-auto xl:max-w-[min(100%,980px)] xl:justify-end">
            {canSubmit && (
              <Button size="sm" onClick={() => setShowSubmitDialog(true)} disabled={isWorkflowBusy}>
                {workflowAction === 'submit' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {t('templateDetail.actions.submitApproval')}
              </Button>
            )}

            {canApprove && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => void handleApproveTemplate()}
                disabled={isWorkflowBusy}>
                {workflowAction === 'approve' && <Loader2 className="size-3.5 animate-spin" />}
                {t('templateDetail.actions.approve')}
              </Button>
            )}

            {canReject && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={isWorkflowBusy}>
                <XCircle className="size-3.5" />
                {t('templateDetail.actions.reject')}
              </Button>
            )}

            {canReturnToDraft && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleReturnToDraftTemplate()}
                disabled={isWorkflowBusy}>
                {workflowAction === 'return-draft' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                {t('templateDetail.actions.returnDraft')}
              </Button>
            )}

            {canPublish && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handlePublishTemplate()}
                disabled={isWorkflowBusy}>
                {workflowAction === 'publish' && <Loader2 className="size-3.5 animate-spin" />}
                {t('templateDetail.actions.publish')}
              </Button>
            )}

            {canUnpublish && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleUnpublishTemplate()}
                disabled={isWorkflowBusy}>
                {workflowAction === 'unpublish' && <Loader2 className="size-3.5 animate-spin" />}
                {t('templateDetail.actions.unpublish')}
              </Button>
            )}

            {canCreateNewVersion && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleCreateNewVersionTemplate()}
                disabled={isWorkflowBusy}>
                {workflowAction === 'new-version' && <Loader2 className="size-3.5 animate-spin" />}
                {t('templateDetail.actions.newVersion')}
              </Button>
            )}

            {canDelete && (
              <Button size="sm" variant="destructive" onClick={() => void handleDelete()} disabled={isWorkflowBusy}>
                {workflowAction === 'delete' && <Loader2 className="size-3.5 animate-spin" />}
                {t('templateDetail.actions.delete')}
              </Button>
            )}

            {canEdit && hasContent && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                onClick={handleSaveTemplate}
                disabled={isWorkflowBusy || !hasChanges}>
                {isSaving && workflowAction === null ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {isSaving ? t('templateDetail.actions.saving') : t('templateDetail.actions.save')}
              </Button>
            )}

            {canEdit ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600">
                <span>Format</span>
                <Select value={artifactType} onValueChange={handleArtifactTypeChange}>
                  <SelectTrigger className="h-7 w-[170px] rounded-md border-slate-200 bg-slate-50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARTIFACT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setUploadArtifactType(artifactType);
                setShowUploadModal(true);
              }}
              disabled={isWorkflowBusy}>
              <Upload className="size-3.5" />
              Import file
            </Button>

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
                  disabled={Boolean(exportLoading)}>
                  <Download className="size-3.5" />
                  {exportLoading?.startsWith('artifact') ? '…' : 'Export'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExportArtifact('pdf')}
                  disabled={Boolean(exportLoading)}>
                  PDF
                </Button>
              </>
            ) : shouldUseDocxEditor || shouldUseDocxPreviewEditor ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleOpenDocxExportPreview()}
                disabled={
                  exportLoading === 'export' ||
                  (shouldUseDocxEditor && !docxEditorReady) ||
                  (shouldUseDocxPreviewEditor && editorDisplayMode === 'docx' && !docxEditorReady)
                }>
                <Download className="size-3.5" />
                {exportLoading === 'export' ? '…' : t('templateDetail.actions.export')}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exportLoading === 'pdf'}>
                  <Download className="size-3.5" />
                  {exportLoading === 'pdf' ? '…' : 'PDF'}
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportWord} disabled={exportLoading === 'word'}>
                  <FileText className="size-3.5" />
                  {exportLoading === 'word' ? '…' : 'Word'}
                </Button>
              </>
            )}

            {canManageRenderConfigJson ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenRenderConfigJsonDialog}
                title={t('templateDetail.renderConfig.description')}>
                <FileCode2 className="size-3.5" />
                {t('templateDetail.renderConfig.title')}
              </Button>
            ) : null}

            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => handleTemplatePreviewModeChange('rendered')}
                className={`h-7 rounded-md px-3 transition ${
                  templatePreviewMode === 'rendered'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}>
                {t('templateDetail.previewMode.rendered')}
              </button>
              <button
                type="button"
                onClick={() => handleTemplatePreviewModeChange('variables')}
                className={`h-7 rounded-md px-3 transition ${
                  templatePreviewMode === 'variables'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}>
                {t('templateDetail.previewMode.variables')}
              </button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenVariablePicker}
              disabled={!canEdit || (!editorConfig && !isOfficeArtifact)}
              title={t('templateDetail.tooltips.insertVariable')}>
              <Braces className="size-3.5" />
              {t('templateDetail.actions.insertVariable')}
            </Button>

            <Button
              size="sm"
              variant={showDragPanel ? 'default' : 'outline'}
              onClick={() => setShowDragPanel((prev) => !prev)}
              disabled={!canEdit || (!editorConfig && !isOfficeArtifact)}
              title={t('templateDetail.tooltips.dragDropVariables')}>
              <Braces className="size-3.5" />
              {t('templateDetail.actions.dragDrop')}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={openVariablesWorkspace}
              className="relative"
              title={t('templateDetail.tooltips.variablesWorkspace')}>
              <Maximize2 className="size-3.5" />
              {t('templateDetail.actions.variables')}
              {varsInDoc.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                  {varsInDoc.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {templateError && (
        <div className="mx-6 mt-4 shrink-0 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {templateError}
        </div>
      )}

      {/* BODY */}
      <div className="relative flex min-h-0 flex-1 gap-6 overflow-hidden p-6">
        {/* EDITOR CARD */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {template && !isTemplateRouteRecordPending && readOnly && (
            <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              <span>🔒</span>
              <span>{t('templateDetail.editor.readOnly')}</span>
            </div>
          )}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-slate-50/80 px-4 py-2">
            <div className="text-sm font-semibold text-slate-700">{t('templateDetail.editor.title')}</div>
            {isTemplateRouteRecordPending ? (
              <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                {t('templateDetail.editor.loading')}
              </div>
            ) : artifactType === 'rich_text' ? (
              <div className="inline-flex rounded-lg bg-slate-200/70 p-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => void handleEditorDisplayModeChange('docx')}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 transition ${
                    editorDisplayMode === 'docx'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}>
                  <FileText className="size-3.5" />
                  {t('templateDetail.editor.modes.docx')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleEditorDisplayModeChange('editor')}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 transition ${
                    editorDisplayMode === 'editor'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}>
                  <FileCode2 className="size-3.5" />
                  {t('templateDetail.editor.modes.editor')}
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {getArtifactTypeLabel(artifactType)}
              </div>
            )}
          </div>
          <div className="editor-main-content min-h-0 flex-1 overflow-hidden">
            {isTemplateRouteRecordPending ? (
              <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center text-sm text-gray-500">
                {templateError ?? t('templateDetail.editor.loading')}
              </div>
            ) : artifactType !== 'rich_text' ? (
              isOfficeArtifact ? (
                canUseOfficeArtifactEditor ? (
                  <OfficeArtifactEditor
                    ref={officeArtifactEditorRef}
                    scope="template"
                    id={template_id!}
                    artifactType={artifactType}
                    metadata={artifactConfig}
                    variableCatalog={variableCatalog}
                    template_type={selectedTemplateType}
                    readOnly={readOnly}
                    onMetadataChange={setArtifactConfig}
                    onShowToast={setToast}
                    showInsertVariableButton={false}
                  />
                ) : (
                  <OfficeArtifactSetupPanel artifactType={artifactType} scope="template" />
                )
              ) : (
                <ArtifactEditor
                  artifactType={artifactType}
                  config={artifactConfig}
                  values={renderedVarValues}
                  variableKeys={artifactBindingKeys}
                  variableCatalog={variableCatalog}
                  template_type={selectedTemplateType}
                  readOnly={readOnly}
                  onConfigChange={setArtifactConfig}
                />
              )
            ) : editorDisplayMode === 'preview' ? (
              <PagedDocumentPreview
                html={docxEditorHtmlContent}
                emptyMessage={t('templateDetail.editor.emptyPagePreview')}
              />
            ) : editorDisplayMode === 'docx' || shouldUseDocxEditor ? (
              renderTemplateDocxEditor()
            ) : (
              <div className="template-ckeditor-panel h-full overflow-auto">{renderTemplateCkEditor()}</div>
            )}
          </div>
          {!isTemplateRouteRecordPending && artifactType === 'rich_text' ? (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
              {t('templateDetail.editor.help', {
                insertVariable: t('templateDetail.actions.insertVariable'),
                token: '{{',
                pdfShortcut: 'Ctrl+P',
                wordShortcut: 'Ctrl+W',
              })}
            </div>
          ) : null}
        </div>

        {/* VARIABLE DRAG PANEL (right side) */}
        {showDragPanel && (
          <div className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-900">{t('templateDetail.dragDropPanelTitle')}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowDragPanel(false)}
                className="h-7 gap-1 rounded-lg px-2 text-xs">
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <VariableDragPanel items={dragPanelItems} />
            </div>
          </div>
        )}

        {/* RIGHT SIDEBAR */}
        {showRightSidebar && isRightSidebarCollapsed ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setIsRightSidebarCollapsed(false)}
            className="absolute right-8 top-8 z-20 size-9 rounded-xl border-slate-200 bg-white/95 text-slate-600 shadow-sm backdrop-blur hover:bg-white hover:text-slate-950"
            title={`${t('common.actions.open')} ${t('templateDetail.sidebar.templateInfoTitle')}`}>
            <PanelRightOpen className="size-4" />
          </Button>
        ) : null}
        {showRightSidebar && !isRightSidebarCollapsed ? (
          <div className="flex h-full w-[420px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:w-[460px]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t('templateDetail.sidebar.templateInfoTitle')}</p>
                <p className="mt-1 text-xs text-slate-500">{t('templateDetail.sidebar.metadataDescription')}</p>
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
              defaultValue={['template-settings', 'approval-status', 'history']}
              className="min-h-0 flex-1 overflow-y-auto">
              <AccordionItem value="template-settings" className={RIGHT_SIDEBAR_CARD_CLASS_NAME}>
                <AccordionTrigger className={RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME}>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('templateDetail.sidebar.templateInfoTitle')} / {t('templateDetail.sidebar.metadataTitle')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('templateDetail.sidebar.templateInfoDescription')}{' '}
                      {t('templateDetail.sidebar.metadataDescription')}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-5 px-5 py-4">
                  {template_id && templateLoading && !template ? (
                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div className="grid gap-1.5">
                        <label
                          className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                          htmlFor="template-title">
                          {t('templateDetail.sidebar.title')}
                        </label>
                        <Input
                          id="template-title"
                          value={templateTitle}
                          onChange={(e) => setTemplateTitle(e.target.value)}
                          disabled={!canEdit}
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <label
                          className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                          htmlFor="template-description">
                          {t('templateDetail.sidebar.description')}
                        </label>
                        <Textarea
                          id="template-description"
                          value={templateDescription}
                          onChange={(e) => setTemplateDescription(e.target.value)}
                          disabled={!canEdit}
                          className="min-h-24"
                        />
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {t('templateDetail.sidebar.metadataTitle')}
                      </p>
                      <ApprovalStatusBadge
                        status={displayStatus}
                        rejection_reason={template?.rejection_reason ?? undefined}
                      />
                    </div>
                    <dl className="space-y-3 text-sm">
                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('templateDetail.sidebar.template_type')}
                        </dt>
                        {canEdit && templateTypeOptions.length > 0 ? (
                          <div className="mt-2">
                            <Select
                              value={
                                templateTypeOptions.some((option) => option.value === selectedTemplateType)
                                  ? selectedTemplateType
                                  : undefined
                              }
                              onValueChange={setSelectedTemplateType}>
                              <SelectTrigger className="h-10 rounded-xl bg-white">
                                <SelectValue
                                  placeholder={templateTypeOption?.label || template?.template_type || '-'}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {templateTypeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <dd className="mt-2 font-medium text-gray-900">
                            {templateTypeOption?.label || template?.template_type || '-'}
                          </dd>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          Artifact format
                        </dt>
                        {canEdit ? (
                          <div className="mt-2">
                            <Select value={artifactType} onValueChange={handleArtifactTypeChange}>
                              <SelectTrigger className="h-10 rounded-xl bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ARTIFACT_TYPE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <dd className="mt-2 font-medium text-gray-900">{getArtifactTypeLabel(artifactType)}</dd>
                        )}
                      </div>

                      <div className="space-y-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                          {t('templateDetail.sidebar.template_metadata')}
                        </dt>
                        {metadataFields.length === 0 ? (
                          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-xs italic text-gray-400">
                            {selectedTemplateType
                              ? t('templateDetail.sidebar.noMetadataForType')
                              : t('templateDetail.sidebar.chooseTypeForMetadata')}
                          </div>
                        ) : (
                          metadataFields.map((field) => {
                            const currentEntry = template_metadata[field.key];
                            const currentVal = currentEntry?.value ?? '';
                            const currentLabel = currentEntry?.label ?? currentVal;
                            const writeEntry = (val: string, label: string) =>
                              setTemplateMetadata((prev) => {
                                const next = { ...prev };
                                if (val) next[field.key] = { value: val, label: label || val };
                                else delete next[field.key];
                                return next;
                              });
                            const clearEntry = () =>
                              setTemplateMetadata((prev) => {
                                const next = { ...prev };
                                delete next[field.key];
                                return next;
                              });

                            return (
                              <div
                                key={field.key}
                                className="grid gap-1.5 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                  {field.label}
                                </span>
                                {canEdit ? (
                                  field.source_type === 'api_table' ? (
                                    <SearchableSelect
                                      value={currentVal || undefined}
                                      onValueChange={(v) => {
                                        if (!v) clearEntry();
                                      }}
                                      onOptionSelect={(option) => {
                                        if (!option) clearEntry();
                                        else writeEntry(option.value, option.label);
                                      }}
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
                                      fetchOnOpen
                                      minSearchLength={0}
                                      placeholder={t('templateDetail.sidebar.selectField', {
                                        field: field.label.toLowerCase(),
                                      })}
                                      searchPlaceholder={t('templateDetail.sidebar.searchField', {
                                        field: field.label.toLowerCase(),
                                      })}
                                      emptyMessage={t('templateDetail.sidebar.noResults')}
                                      clearable
                                      className="h-8 text-xs"
                                    />
                                  ) : field.source_type === 'static' ? (
                                    <Select
                                      value={currentVal || '__NONE__'}
                                      onValueChange={(v) => {
                                        if (v === '__NONE__') clearEntry();
                                        else {
                                          const opt = field.options.find((o) => o.value === v);
                                          writeEntry(v, opt?.label ?? v);
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
                                        <SelectItem value="__NONE__">
                                          {t('templateDetail.sidebar.noneOption')}
                                        </SelectItem>
                                        {field.options.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
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
                                      onChange={(e) => writeEntry(e.target.value, e.target.value)}
                                    />
                                  ) : (
                                    <Input
                                      type="text"
                                      className="h-8 text-xs"
                                      value={currentVal}
                                      placeholder={field.placeholder ?? field.label}
                                      onChange={(e) => writeEntry(e.target.value, e.target.value)}
                                    />
                                  )
                                ) : (
                                  <span className="text-xs font-medium text-gray-900">{currentLabel || '-'}</span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.visibility')}
                          </dt>
                          {canEdit ? (
                            <div className="mt-2">
                              <Select
                                value={selectedVisibility}
                                onValueChange={(value) => setSelectedVisibility(value as TemplateVisibility)}>
                                <SelectTrigger className="h-10 rounded-xl bg-white">
                                  <SelectValue placeholder={t('templateDetail.sidebar.visibilityPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PRIVATE">
                                    {t('templateDetail.sidebar.visibilityPrivate')}
                                  </SelectItem>
                                  <SelectItem value="RESTRICTED">
                                    {t('templateDetail.sidebar.visibilityRestricted')}
                                  </SelectItem>
                                  <SelectItem value="PUBLIC">{t('templateDetail.sidebar.visibilityPublic')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <dd className="mt-2 font-medium text-gray-900">{selectedVisibility}</dd>
                          )}
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.shareScope')}
                          </dt>
                          <dd className="mt-2 text-sm font-medium text-gray-900">
                            {share_rules.length > 0
                              ? t('templateDetail.sidebar.shareRulesCount', { count: share_rules.length })
                              : t('templateDetail.sidebar.noShareRules')}
                          </dd>
                          <p className="mt-1 text-xs text-gray-500">
                            {share_rules.length > 0
                              ? t('templateDetail.sidebar.shareRulesHasAccess')
                              : t('templateDetail.sidebar.shareRulesNoAccess')}
                          </p>
                        </div>
                      </div>

                      {canEdit && selectedVisibility === 'RESTRICTED' ? (
                        <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.manageShareRules')}
                          </dt>
                          <TemplateShareRules
                            share_rules={share_rules}
                            onShareRulesChange={setShareRules}
                            organizationUnitOptions={organizationUnitOptions}
                          />
                        </div>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.published')}
                          </dt>
                          <dd className="mt-2 text-base font-semibold text-gray-900">
                            {template?.is_published ? t('templateDetail.sidebar.yes') : t('templateDetail.sidebar.no')}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.version')}
                          </dt>
                          <dd className="mt-2 text-base font-semibold text-gray-900">v{template?.version ?? 1}</dd>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.created_by')}
                          </dt>
                          <dd className="mt-2 break-words font-medium text-gray-900">
                            {template?.createdByDisplay || template?.created_by || '-'}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.lastModifiedBy')}
                          </dt>
                          <dd className="mt-2 break-words font-medium text-gray-900">
                            {template?.lastModifiedBy || '-'}
                          </dd>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.created_at')}
                          </dt>
                          <dd className="mt-2 font-medium text-gray-900">
                            {template?.created_at ? formatDate(template.created_at) : '-'}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.updated_at')}
                          </dt>
                          <dd className="mt-2 font-medium text-gray-900">
                            {template?.updated_at ? formatDate(template.updated_at) : '-'}
                          </dd>
                        </div>
                      </div>

                      {template?.published_at && (
                        <div className="rounded-xl border border-gray-100 bg-white p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            {t('templateDetail.sidebar.published_at')}
                          </dt>
                          <dd className="mt-2 font-medium text-gray-900">{formatDate(template.published_at)}</dd>
                        </div>
                      )}

                      {template?.rejection_reason && (
                        <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
                            {t('templateDetail.sidebar.rejection_reason')}
                          </dt>
                          <dd className="mt-2 text-sm leading-6 text-red-700">{template.rejection_reason}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {artifactType === 'spreadsheet' ? (
                <AccordionItem value="spreadsheet-table-bindings" className={RIGHT_SIDEBAR_CARD_CLASS_NAME}>
                  <AccordionTrigger className={RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME}>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900">Excel table config</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Gom phần bảng động của file Excel vào từng binding thay vì config rời từng biến.
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 py-4">
                    <SpreadsheetTableBindingsPanel
                      artifactConfig={artifactConfig}
                      template_type={selectedTemplateType}
                      readOnly={!canEdit}
                      onChange={setArtifactConfig}
                    />
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              {canManageRenderConfigJson ? (
                <AccordionItem value="render-config-json" className={RIGHT_SIDEBAR_CARD_CLASS_NAME}>
                  <AccordionTrigger className={RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME}>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-900">{t('templateDetail.renderConfig.title')}</p>
                      <p className="mt-1 text-xs text-slate-500">{t('templateDetail.renderConfig.description')}</p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className={RIGHT_SIDEBAR_CARD_BODY_CLASS_NAME}>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                        {t('templateDetail.renderConfig.warning')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCopyRenderConfigJson()}
                          className="h-9 rounded-lg text-xs">
                          <Copy className="size-3.5" />
                          {t('templateDetail.renderConfig.copy')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleApplyRenderConfigJson}
                          disabled={readOnly || !renderConfigJsonText.trim()}
                          className="h-9 rounded-lg bg-slate-900 text-xs hover:bg-slate-800">
                          <FileCode2 className="size-3.5" />
                          {t('templateDetail.renderConfig.apply')}
                        </Button>
                      </div>
                      <Textarea
                        value={renderConfigJsonText}
                        onChange={(event) => {
                          setRenderConfigJsonText(event.target.value);
                          setRenderConfigJsonError(null);
                        }}
                        placeholder={t('templateDetail.renderConfig.placeholder')}
                        className="min-h-64 font-mono text-xs leading-5"
                        spellCheck={false}
                      />
                      {renderConfigJsonError ? (
                        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                          {renderConfigJsonError}
                        </p>
                      ) : (
                        <p className="text-xs leading-5 text-slate-500">{t('templateDetail.renderConfig.applyHelp')}</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              <AccordionItem value="approval-status" className={RIGHT_SIDEBAR_CARD_CLASS_NAME}>
                <AccordionTrigger className={RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME}>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('templateDetail.sidebar.approvalStatusTitle')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('templateDetail.sidebar.approvalStatusDescription')}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={RIGHT_SIDEBAR_CARD_BODY_CLASS_NAME}>
                  <ApprovalStatusPanel
                    status={displayStatus}
                    submitted_at={toTimestamp(template?.submitted_at)}
                    approved_at={toTimestamp(template?.approved_at)}
                    rejected_at={toTimestamp(template?.rejected_at)}
                    rejection_reason={template?.rejection_reason}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="history" className={RIGHT_SIDEBAR_CARD_CLASS_NAME}>
                <AccordionTrigger className={RIGHT_SIDEBAR_CARD_TRIGGER_CLASS_NAME}>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">{t('templateDetail.sidebar.historyTitle')}</p>
                    <p className="mt-1 text-xs text-slate-500">{t('templateDetail.sidebar.historyDescription')}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={RIGHT_SIDEBAR_CARD_BODY_CLASS_NAME}>
                  <ApprovalHistoryTimeline
                    logs={approvalHistory?.audit_logs}
                    isLoading={approvalHistory === undefined}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        ) : null}
      </div>

      <PreviewModal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        renderedHtml={renderedHtml}
        onExportPdf={handlePreviewExportPdf}
        onExportWord={handlePreviewExportWord}
        onExport={
          shouldUseDocxEditor || shouldUseDocxPreviewEditor
            ? () => void handleOpenDocxExportPreview(' preview', 'preview-export')
            : undefined
        }
        exportLoading={exportLoading}
      />
      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        isDragging={isDragging}
        onDraggingChange={setIsDragging}
        onFileSelect={handleFileUpload}
        isUploading={isUploading}
        templateTypeOptions={templateTypeOptions}
        templateTypeValue={selectedTemplateType}
        onTemplateTypeChange={setSelectedTemplateType}
        artifactTypeValue={uploadArtifactType}
        onArtifactTypeChange={setUploadArtifactType}
        visibilityValue={selectedVisibility}
        onVisibilityChange={setSelectedVisibility}
        share_rules={share_rules}
        onShareRulesChange={setShareRules}
        organizationUnitOptions={organizationUnitOptions}
      />
      <TemplateNameModal
        open={showTemplateNameModal}
        onClose={handleCloseTemplateNameModal}
        value={templateNameInput}
        onChange={setTemplateNameInput}
        description={templateDescriptionInput}
        onDescriptionChange={setTemplateDescriptionInput}
        templateTypeOptions={templateTypeOptions}
        templateTypeValue={selectedTemplateType}
        onTemplateTypeChange={setSelectedTemplateType}
        visibilityValue={selectedVisibility}
        onVisibilityChange={setSelectedVisibility}
        share_rules={share_rules}
        onShareRulesChange={setShareRules}
        organizationUnitOptions={organizationUnitOptions}
        onConfirm={handleConfirmTemplateName}
        isLoading={isSaving}
      />
      <Dialog open={showRenderConfigJsonDialog} onOpenChange={setShowRenderConfigJsonDialog}>
        <DialogContent className="max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-900">
                <FileCode2 className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold text-slate-900">
                  {t('templateDetail.renderConfig.title')}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm leading-6 text-slate-500">
                  {t('templateDetail.renderConfig.description')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-700">
              {t('templateDetail.renderConfig.warning')}
            </div>
            <Textarea
              value={renderConfigJsonText}
              onChange={(event) => {
                setRenderConfigJsonText(event.target.value);
                setRenderConfigJsonError(null);
              }}
              placeholder={t('templateDetail.renderConfig.placeholder')}
              className="min-h-[52vh] font-mono text-xs leading-5"
              spellCheck={false}
            />
            {renderConfigJsonError ? (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                {renderConfigJsonError}
              </p>
            ) : (
              <p className="text-xs leading-5 text-slate-500">{t('templateDetail.renderConfig.applyHelp')}</p>
            )}
          </div>

          <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRenderConfigJsonDialog(false)}
              className="h-10 rounded-xl px-5">
              {t('common.actions.cancel')}
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCopyRenderConfigJson()}
                className="h-10 rounded-xl px-5">
                <Copy className="size-4" />
                {t('templateDetail.renderConfig.copy')}
              </Button>
              <Button
                type="button"
                onClick={handleApplyRenderConfigJson}
                disabled={readOnly || !renderConfigJsonText.trim()}
                className="h-10 rounded-xl bg-slate-900 px-5 hover:bg-slate-800">
                <FileCode2 className="size-4" />
                {t('templateDetail.renderConfig.apply')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={showSaveBeforeVariablesDialog} onOpenChange={setShowSaveBeforeVariablesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('templateDetail.saveBeforeVariables.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('templateDetail.saveBeforeVariables.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSaveBeforeVariables}>
              {t('templateDetail.saveBeforeVariables.stay')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmSaveBeforeVariables()} disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {isSaving ? t('templateDetail.actions.saving') : t('templateDetail.saveBeforeVariables.saveAndContinue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <VariablePickerDialog
        open={showVariablePicker}
        catalog={variableCatalog}
        template_type={selectedTemplateType}
        onOpenChange={setShowVariablePicker}
        onSelect={handleInsertVariable}
        onSelectMany={handleInsertVariables}
      />

      {/* APPROVAL DIALOGS */}
      <SubmitForApprovalDialog
        isOpen={showSubmitDialog}
        template_id={template_id!}
        templateName={template?.name}
        onClose={() => setShowSubmitDialog(false)}
        onSubmit={async () => {
          await handleSubmitForApproval();
        }}
      />

      <RejectionDialog
        isOpen={showRejectDialog}
        template_id={template_id!}
        approverId=""
        templateName={template?.name}
        onClose={() => setShowRejectDialog(false)}
        onReject={handleRejectTemplate}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
