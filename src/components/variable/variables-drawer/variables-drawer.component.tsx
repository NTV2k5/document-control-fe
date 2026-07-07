'use client';

import type { ClassicEditor, ModelRange } from 'ckeditor5';
import type { TArtifactType, TOfficeArtifactScope } from 'api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Braces,
  X,
  Save,
  Trash2,
  Download,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'reactjs-platform/ui';
import { TableTemplateSelector } from '../../table-template/table-template-selector';
import {
  ArtifactEditor,
  DocumentTemplateSelector,
  getArtifactTypeLabel,
  OfficeArtifactEditor,
  type IOfficeArtifactEditorRef,
} from '../../template';
import type { ToastProps } from '../../ui';
import { useTranslation } from '../../../i18n';
import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  DOCUMENT_TEMPLATE_WRAPPER_ATTR,
  TABLE_TEMPLATE_VARIABLE_NAMESPACE,
  buildTextSignature,
  buildSemesterCoursesSignCompositeValue,
  collapseSemesterCoursesDisplayVariableKeys,
  expandSemesterCoursesDisplayVariableKeys,
  countSemesterCoursesSignCompositePatternOccurrences,
  buildTokenSet,
  createPreviewEditorConfig,
  attachFontSizeToolbarLabel,
  isDocxDocumentEditorEngine,
  isDocxPreviewEditorEnabled,
  exportToPdf,
  exportToWord,
  createDownloadFileName,
  generateDocumentHtml,
  generateTableHtmlFromTableTemplate,
  logVariablePerformance,
  measureVariablePerformance,
  navigateDocxExportPreviewWindow,
  openDocxExportPreviewWindow,
  writeDocxExportPreviewPayload,
  insertVariablePickerItems,
  loadEditorRuntime,
  getVariableAlias,
  getDocumentTemplateDisplayAlias,
  getDefaultVariableInputTypeForKey,
  getDefaultVariableValueForKey,
  getDocumentTemplateById,
  getTableTemplateById,
  getTemplateVariableDocumentTemplateByKey,
  getSemesterCoursesSignFocusVariableKey,
  isSemesterCoursesSignCompositeVariableKey,
  getVariableDisplayLabel,
  getTemplateVariableDefinitionByKey,
  getTemplateVariableTableTemplateByKey,
  FRAPPE_VARIABLE_INPUT_TYPES,
  isGenericDocumentTemplateAlias,
  parseVariableName,
  isCheckVariableInputType,
  isLongTextVariableInputType,
  isSelectVariableInputType,
  isTableMatrixVariableInputType,
  normalizeVariableInputType,
  normalizeSemesterCoursesDisplayVariableKey,
  registerMentionRichTextEditor,
  shouldLogVariablePerformanceCycle,
  type DocumentTemplate,
  type ExactSchemaCatalog,
  type IVariablePickerItem,
  type TableTemplate,
  type VariableInputType,
  type VarTypes,
} from '../../../lib';
import { VariableFieldDropdown } from '../variable-field-dropdown';
import { VariablePickerDialog } from '../variable-picker-dialog';

type VariablesDrawerEditorRuntime = Awaited<ReturnType<typeof loadEditorRuntime>>;

const PREVIEW_CONTENT_UPDATE_DELAY_MS = 500;
const VARIABLE_CARD_SCROLL_OFFSET_PX = 12;
const LOCK_DOCUMENT_VARIABLES_PREVIEW_EDITING = true;
const DOCUMENT_VARIABLES_PREVIEW_READ_ONLY_LOCK_ID = 'variables-drawer-document-preview-lock';
const VARIABLES_DRAWER_RESIZER_WIDTH_PX = 12;
const PREVIEW_PANE_COLLAPSE_THRESHOLD_PERCENT = 90;

const VARIABLE_INPUT_TYPE_OPTIONS: VariableInputType[] = [
  ...FRAPPE_VARIABLE_INPUT_TYPES,
  'Table matrix',
  'Table template',
  'Document template',
];

type TableTemplateHtmlCacheEntry = {
  template: TableTemplate;
  dependencySignature: string;
  html: string;
};

type TPreviewDisplayMode = 'rendered' | 'variables';

const tableTemplatePlaceholderDependenciesCache = new WeakMap<TableTemplate, string[]>();

function getTableTemplatePlaceholderDependencies(template: TableTemplate): string[] {
  const cached = tableTemplatePlaceholderDependenciesCache.get(template);
  if (cached) return cached;

  const matches = JSON.stringify(template).match(/\{\{([^}]+)\}\}/g) ?? [];
  const dependencies = Array.from(new Set(matches));
  tableTemplatePlaceholderDependenciesCache.set(template, dependencies);
  return dependencies;
}

function buildTableTemplateDependencySignature(template: TableTemplate, varValues: Record<string, string>) {
  return getTableTemplatePlaceholderDependencies(template)
    .map((key) => `${key}\u0000${varValues[key] ?? ''}`)
    .join('\u0001');
}

function cloneVariableTemplate<T>(template: T): T {
  return JSON.parse(JSON.stringify(template)) as T;
}

function getRecordSelectorGroupKey(varKey: string, templateType?: string | null) {
  const parsed = parseVariableName(varKey);
  if (!parsed) return null;

  const definition = getTemplateVariableDefinitionByKey(varKey, templateType);
  const dataSource = definition?.dataSource;

  if (
    definition?.variableType !== 'FIELD_VARIABLE' ||
    !isSelectVariableInputType(definition.inputType) ||
    dataSource?.type !== 'table' ||
    !dataSource.table.trim()
  ) {
    return null;
  }

  return JSON.stringify({
    placeholderTable: parsed.table,
    sourceTable: dataSource.table.trim(),
    filterField: dataSource.filterField ?? '',
    filterValue: dataSource.filterValue ?? null,
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countVariablePlaceholderTextOccurrences(html: string | undefined, varKey: string) {
  if (!html) return 0;

  let count = 0;
  let index = 0;
  const variableRegex = /\{\{\s*([^{}]+?)\s*\}\}/g;

  while (index < html.length) {
    if (html[index] === '<') {
      const tagEndIndex = html.indexOf('>', index + 1);
      if (tagEndIndex === -1) break;
      index = tagEndIndex + 1;
      continue;
    }

    const nextTagIndex = html.indexOf('<', index);
    const textEndIndex = nextTagIndex === -1 ? html.length : nextTagIndex;
    const textChunk = html.slice(index, textEndIndex);
    variableRegex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = variableRegex.exec(textChunk))) {
      if (match[1]?.trim() === varKey) {
        count += 1;
      }
    }

    index = textEndIndex;
  }

  return count;
}

export interface IVariablesDrawerProps {
  open: boolean;
  onClose?: () => void;
  renderMode?: 'modal' | 'page';
  varsInDoc: string[];
  varValues: Record<string, string>;
  onVarValuesChange: (updates: Record<string, string>) => void;
  varTypes: VarTypes;
  onVarTypesChange: (updates: VarTypes) => void;
  varTitles?: Record<string, string>;
  onShowToast: (toast: ToastProps) => void;
  rawHtml?: string;
  renderedHtml: string;
  renderedHtmlHighlighted: string;
  exportLoading: string | null;
  onSaveVariables: (overrideVarValues: Record<string, string>) => Promise<void>;
  onRemoveVariable?: (varKey: string) => void;
  selectedTemplates: Record<string, TableTemplate>;
  onSelectedTemplatesChange: (updates: Record<string, TableTemplate | null>) => void;
  // Document template support
  selectedDocumentTemplates: Record<string, DocumentTemplate>;
  documentTemplateValues: Record<string, Record<string, string>>;
  onSelectedDocumentTemplatesChange: (updates: Record<string, DocumentTemplate | null>) => void;
  onDocumentTemplateValuesChange: (varKey: string, values: Record<string, string>) => void;
  completedVarKeys?: string[];
  onCompletedVarKeysChange?: (keys: string[]) => void;
  readOnly?: boolean;
  simpleMode?: boolean;
  allowDocumentTemplateReorder?: boolean;
  onTitleChange?: (varKey: string, title: string) => void;
  onPreviewContentChange?: (html: string) => void;
  variableCatalog?: ExactSchemaCatalog;
  template_type?: string | null;
  onReplaceVariable?: (varKey: string, item: IVariablePickerItem) => void;
  allowVariableInsertion?: boolean;
  showPreviewDisplayModeToggle?: boolean;
  exportFileName?: string;
  onClearAll?: () => void;
  artifactType?: TArtifactType;
  artifactConfig?: unknown;
  artifactValues?: Record<string, string>;
  artifactVariableKeys?: string[];
  artifactOfficeScope?: TOfficeArtifactScope;
  artifactOfficeId?: string;
  onArtifactConfigChange?: (config: unknown) => void;
}

export const VariablesDrawer = ({
  open,
  onClose,
  renderMode = 'modal',
  varsInDoc,
  varValues,
  onVarValuesChange,
  varTypes,
  onVarTypesChange,
  varTitles = {},
  onShowToast,
  rawHtml,
  renderedHtml,
  renderedHtmlHighlighted,
  exportLoading,
  onSaveVariables,
  onRemoveVariable,
  selectedTemplates,
  onSelectedTemplatesChange,
  selectedDocumentTemplates,
  documentTemplateValues,
  onSelectedDocumentTemplatesChange,
  onDocumentTemplateValuesChange,
  completedVarKeys,
  onCompletedVarKeysChange,
  readOnly = false,
  simpleMode = false,
  allowDocumentTemplateReorder = false,
  onTitleChange,
  onPreviewContentChange,
  variableCatalog,
  template_type,
  onReplaceVariable,
  allowVariableInsertion = true,
  showPreviewDisplayModeToggle = true,
  exportFileName,
  onClearAll,
  artifactType = 'rich_text',
  artifactConfig,
  artifactValues,
  artifactVariableKeys,
  artifactOfficeScope,
  artifactOfficeId,
  onArtifactConfigChange,
}: IVariablesDrawerProps) => {
  const isPreviewEditorDisabled = readOnly;
  const isPreviewEditorReadOnly = LOCK_DOCUMENT_VARIABLES_PREVIEW_EDITING && artifactOfficeScope === 'document';
  const { t } = useTranslation();
  const DEFAULT_SIDEBAR_WIDTH_PERCENT = 33.333;
  const MIN_SIDEBAR_WIDTH_PX = 320;
  const MIN_PREVIEW_WIDTH_PX = 0;
  const MAX_SIDEBAR_WIDTH_PERCENT = 99;

  const [isSaving, setIsSaving] = useState(false);
  const [previewContent, setPreviewContent] = useState(renderedHtml);
  const [showTemplateSelector, setShowTemplateSelector] = useState<string | null>(null);
  const [showDocumentTemplateSelector, setShowDocumentTemplateSelector] = useState<string | null>(null);
  const [showVariableReplacePicker, setShowVariableReplacePicker] = useState<string | null>(null);
  const [showPreviewVariablePicker, setShowPreviewVariablePicker] = useState(false);
  const [editorRuntime, setEditorRuntime] = useState<VariablesDrawerEditorRuntime | null>(null);
  const [previewEditorConfig, setPreviewEditorConfig] = useState<Awaited<
    ReturnType<typeof createPreviewEditorConfig>
  > | null>(null);
  const [isPreviewEditorFocused, setIsPreviewEditorFocused] = useState(false);
  const [sidebarWidthPercent, setSidebarWidthPercent] = useState(DEFAULT_SIDEBAR_WIDTH_PERCENT);
  const editorRef = useRef<{ editor: ClassicEditor } | null>(null);
  const mentionEditorCleanupRef = useRef<(() => void) | null>(null);
  const savedPreviewSelectionRangeRef = useRef<ModelRange | null>(null);
  const isPreviewSelectionFrozenRef = useRef(false);
  const isPreviewVariableInsertPendingRef = useRef(false);
  const previewSelectionCleanupRef = useRef<(() => void) | null>(null);
  const previewClickCleanupRef = useRef<(() => void) | null>(null);
  const drawerContentRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewEditorVersion, setPreviewEditorVersion] = useState(0);
  const [previewDisplayMode, setPreviewDisplayMode] = useState<TPreviewDisplayMode>('rendered');
  const [artifactVariableFilter, setArtifactVariableFilter] = useState<'used' | 'all'>('used');
  const [variableSearchQuery, setVariableSearchQuery] = useState('');
  const [docxExportPreviewLoading, setDocxExportPreviewLoading] = useState(false);
  const shouldUseDocxExportPreview = useMemo(() => isDocxDocumentEditorEngine() || isDocxPreviewEditorEnabled(), []);
  const exportBaseFileName = exportFileName?.trim() || 'preview';
  const isArtifactPreview = artifactType !== 'rich_text';
  const isPreviewPaneCollapsed = sidebarWidthPercent >= PREVIEW_PANE_COLLAPSE_THRESHOLD_PERCENT;
  const displayVarValues = useMemo<Record<string, string>>(
    () => ({
      ...varValues,
      'semester_courses.sign_location_date': buildSemesterCoursesSignCompositeValue(varValues),
    }),
    [varValues],
  );
  const artifactPreviewValues = useMemo<Record<string, string>>(() => {
    const sourceValues = artifactValues ?? varValues;

    return {
      ...sourceValues,
      'semester_courses.sign_location_date': buildSemesterCoursesSignCompositeValue(sourceValues),
    };
  }, [artifactValues, varValues]);
  const artifactPreviewData = useMemo(() => {
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
  const artifactAvailableVariableKeys = useMemo(
    () =>
      Array.from(new Set([...(artifactVariableKeys ?? []), ...varsInDoc].filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [artifactVariableKeys, varsInDoc],
  );
  const artifactPreviewVariableKeys = varsInDoc.length ? varsInDoc : artifactAvailableVariableKeys;
  const isOfficeArtifactPreview = artifactType === 'spreadsheet' || artifactType === 'presentation';
  const drawerBaseVariableKeys = useMemo(() => {
    if (!isArtifactPreview || artifactVariableFilter === 'used') {
      return varsInDoc;
    }

    return artifactAvailableVariableKeys;
  }, [artifactAvailableVariableKeys, artifactVariableFilter, isArtifactPreview, varsInDoc]);
  const displayedDrawerBaseVariableKeys = useMemo(
    () => collapseSemesterCoursesDisplayVariableKeys(drawerBaseVariableKeys),
    [drawerBaseVariableKeys],
  );
  const hasDrawerVariableSource = isArtifactPreview
    ? artifactAvailableVariableKeys.length > 0 || varsInDoc.length > 0
    : drawerBaseVariableKeys.length > 0;
  const usedVarKeySet = useMemo(() => new Set(varsInDoc), [varsInDoc]);
  const varsLengthRef = useRef(varsInDoc.length);
  const tableTemplateHtmlCacheRef = useRef<Record<string, TableTemplateHtmlCacheEntry>>({});
  const tableRegenerationCycleRef = useRef(0);
  const documentRegenerationCycleRef = useRef(0);
  const variableListScrollRef = useRef<HTMLDivElement | null>(null);
  const variableCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const variableOrderItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingScrollVarKeyRef = useRef<string | null>(null);
  const variableAnchorCycleIndexRef = useRef<Record<string, number>>({});
  const [activeVarKey, setActiveVarKey] = useState<string | null>(null);
  const [expandAllVariables, setExpandAllVariables] = useState(false);
  const [expandedVarCards, setExpandedVarCards] = useState<Record<string, boolean>>({});
  const [manuallyCompletedVarKeys, setManuallyCompletedVarKeys] = useState<Set<string>>(() => new Set());
  const completedVarKeySet = useMemo(
    () => (completedVarKeys ? new Set(completedVarKeys) : manuallyCompletedVarKeys),
    [completedVarKeys, manuallyCompletedVarKeys],
  );
  const highlightedAnchorRef = useRef<HTMLElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [isSidebarNavCollapsed, setIsSidebarNavCollapsed] = useState(true);
  const officeArtifactEditorRef = useRef<IOfficeArtifactEditorRef | null>(null);
  const pendingOfficePreviewRebuildRef = useRef(false);

  // Refs for mutable state used in stable callbacks
  const varValuesRef = useRef(varValues);
  varValuesRef.current = varValues;
  const selectedTemplatesRef = useRef(selectedTemplates);
  selectedTemplatesRef.current = selectedTemplates;
  const selectedDocumentTemplatesRef = useRef(selectedDocumentTemplates);
  selectedDocumentTemplatesRef.current = selectedDocumentTemplates;
  const varTypesRef = useRef(varTypes);
  varTypesRef.current = varTypes;
  const previewContentRef = useRef(previewContent);
  previewContentRef.current = previewContent;
  const definitionRefreshKey = useMemo(
    () =>
      Object.keys(variableCatalog ?? {})
        .sort()
        .join('|'),
    [variableCatalog],
  );

  // Memoize parsed variable names to avoid regex parsing on every render
  const parsedVariables = useMemo(
    () => new Map(displayedDrawerBaseVariableKeys.map((k) => [k, parseVariableName(k)])),
    [displayedDrawerBaseVariableKeys],
  );

  const getDrawerVariableDisplayLabel = useCallback(
    (varKey: string) => {
      const parsed = parseVariableName(varKey);
      const customTitle = varTitles[varKey]?.trim();

      if (
        customTitle &&
        (parsed?.table !== DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE || !isGenericDocumentTemplateAlias(customTitle))
      ) {
        return customTitle;
      }

      if (parsed?.table === DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE) {
        const selectedTemplateAlias = getDocumentTemplateDisplayAlias(selectedDocumentTemplates[varKey]);
        if (selectedTemplateAlias) return selectedTemplateAlias;
      }

      return getVariableDisplayLabel(varKey, template_type);
    },
    [selectedDocumentTemplates, template_type, varTitles],
  );

  const recordSelectorGroupingSignature = useMemo(() => {
    return displayedDrawerBaseVariableKeys
      .map((varKey) => getRecordSelectorGroupKey(varKey, template_type) ?? '')
      .join('|');
  }, [definitionRefreshKey, displayedDrawerBaseVariableKeys, template_type]);

  const { secondaryVarKeys, groupedFieldsByPrimary, groupedVarKeysByPrimary } = useMemo(() => {
    const secondaryVarKeys = new Set<string>();
    const groupedFieldsByPrimary = new Map<string, string[]>();
    const groupedVarKeysByPrimary = new Map<string, string[]>();
    const groupOwnerByKey = new Map<string, string>();

    displayedDrawerBaseVariableKeys.forEach((varKey) => {
      const groupKey = getRecordSelectorGroupKey(varKey, template_type);
      if (!groupKey) {
        return;
      }

      const ownerKey = groupOwnerByKey.get(groupKey);
      if (!ownerKey) {
        groupOwnerByKey.set(groupKey, varKey);
        groupedFieldsByPrimary.set(varKey, []);
        groupedVarKeysByPrimary.set(varKey, []);
        return;
      }

      secondaryVarKeys.add(varKey);
      const currentVarKeys = groupedVarKeysByPrimary.get(ownerKey) ?? [];
      currentVarKeys.push(varKey);
      groupedVarKeysByPrimary.set(ownerKey, currentVarKeys);
      const ownerParsed = parseVariableName(ownerKey);
      const currentParsed = parseVariableName(varKey);
      if (ownerParsed && currentParsed && ownerParsed.table === currentParsed.table) {
        const currentFields = groupedFieldsByPrimary.get(ownerKey) ?? [];
        currentFields.push(currentParsed.field);
        groupedFieldsByPrimary.set(ownerKey, currentFields);
      }
    });

    return { secondaryVarKeys, groupedFieldsByPrimary, groupedVarKeysByPrimary };
  }, [definitionRefreshKey, displayedDrawerBaseVariableKeys, template_type, recordSelectorGroupingSignature]);

  const searchedVarKeys = useMemo(() => {
    const query = variableSearchQuery.trim().toLowerCase();
    if (!query) return displayedDrawerBaseVariableKeys;

    return displayedDrawerBaseVariableKeys.filter((varKey) => {
      const label = getDrawerVariableDisplayLabel(varKey);
      const parsed = parseVariableName(varKey);
      const groupedFields = groupedFieldsByPrimary.get(varKey) ?? [];
      const groupedSearchText = groupedFields
        .map((fieldName) =>
          parsed
            ? `${parsed.table}.${fieldName} ${getVariableAlias(parsed.table, fieldName, template_type)}`
            : fieldName,
        )
        .join(' ');
      return `${varKey} ${label} ${groupedSearchText}`.toLowerCase().includes(query);
    });
  }, [
    displayedDrawerBaseVariableKeys,
    getDrawerVariableDisplayLabel,
    groupedFieldsByPrimary,
    template_type,
    variableSearchQuery,
  ]);

  const visibleVarKeys = useMemo(
    () => searchedVarKeys.filter((varKey) => !secondaryVarKeys.has(varKey)),
    [searchedVarKeys, secondaryVarKeys],
  );

  const variableIndexMap = useMemo(() => {
    return new Map(visibleVarKeys.map((varKey, index) => [varKey, index + 1]));
  }, [visibleVarKeys]);

  const variableOccurrenceCountMap = useMemo(() => {
    const sourceHtml = renderedHtmlHighlighted || renderedHtml;
    const counts = new Map<string, number>();

    visibleVarKeys.forEach((varKey) => {
      if (isSemesterCoursesSignCompositeVariableKey(varKey)) {
        counts.set(
          varKey,
          countSemesterCoursesSignCompositePatternOccurrences(rawHtml) +
            countVariablePlaceholderTextOccurrences(rawHtml, varKey),
        );
        return;
      }

      const groupedVarKeys = groupedVarKeysByPrimary.get(varKey) ?? [];
      const relatedVarKeys = Array.from(
        new Set(
          [varKey, ...groupedVarKeys].flatMap((currentVarKey) =>
            expandSemesterCoursesDisplayVariableKeys(currentVarKey),
          ),
        ),
      );
      const rawTokenCount = relatedVarKeys.reduce(
        (total, currentVarKey) => total + countVariablePlaceholderTextOccurrences(rawHtml, currentVarKey),
        0,
      );

      if (rawTokenCount > 0) {
        counts.set(varKey, rawTokenCount);
        return;
      }

      const occurrenceIds = new Set<string>();

      relatedVarKeys.forEach((currentVarKey) => {
        const escapedVarKey = escapeRegExp(currentVarKey);
        const anchoredPattern = new RegExp(
          `data-var-key="${escapedVarKey}"[^>]*data-var-occurrence="(\\d+)"|data-var-occurrence="(\\d+)"[^>]*data-var-key="${escapedVarKey}"`,
          'g',
        );
        let anchoredMatch: RegExpExecArray | null;

        while ((anchoredMatch = anchoredPattern.exec(sourceHtml))) {
          occurrenceIds.add(anchoredMatch[1] ?? anchoredMatch[2]);
        }
      });

      if (occurrenceIds.size > 0) {
        counts.set(varKey, occurrenceIds.size);
        return;
      }

      const fallbackCount = relatedVarKeys.reduce((total, currentVarKey) => {
        const escapedVarKey = escapeRegExp(currentVarKey);
        const pattern = new RegExp(`data-var-key="${escapedVarKey}"`, 'g');
        return total + (sourceHtml.match(pattern)?.length ?? 0);
      }, 0);
      counts.set(varKey, fallbackCount);
    });

    return counts;
  }, [groupedVarKeysByPrimary, rawHtml, renderedHtml, renderedHtmlHighlighted, visibleVarKeys]);

  const commitCompletedVarKeys = useCallback(
    (next: Set<string>) => {
      if (onCompletedVarKeysChange) {
        onCompletedVarKeysChange(Array.from(next));
        return;
      }

      setManuallyCompletedVarKeys(next);
    },
    [onCompletedVarKeysChange],
  );

  const handleManualCompletedChange = useCallback(
    (varKey: string, checked: boolean) => {
      const next = new Set(completedVarKeySet);

      if (checked) {
        next.add(varKey);
      } else {
        next.delete(varKey);
      }

      if (next.size === completedVarKeySet.size && Array.from(next).every((key) => completedVarKeySet.has(key))) {
        return;
      }

      commitCompletedVarKeys(next);
    },
    [commitCompletedVarKeys, completedVarKeySet],
  );

  useEffect(() => {
    const availableSet = new Set(displayedDrawerBaseVariableKeys);
    const next = new Set(Array.from(completedVarKeySet).filter((varKey) => availableSet.has(varKey)));

    if (next.size === completedVarKeySet.size && Array.from(next).every((key) => completedVarKeySet.has(key))) {
      return;
    }

    commitCompletedVarKeys(next);
  }, [commitCompletedVarKeys, completedVarKeySet, displayedDrawerBaseVariableKeys]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (isArtifactPreview) {
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
        console.error('Failed to load CKEditor preview runtime', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isArtifactPreview, open]);

  useEffect(() => {
    return () => {
      previewSelectionCleanupRef.current?.();
      previewSelectionCleanupRef.current = null;
      previewClickCleanupRef.current?.();
      previewClickCleanupRef.current = null;
      mentionEditorCleanupRef.current?.();
      mentionEditorCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open || isArtifactPreview) {
      setPreviewEditorConfig(null);
      return;
    }

    let cancelled = false;
    setPreviewEditorConfig(null);

    void createPreviewEditorConfig()
      .then((config) => {
        if (!cancelled) {
          setPreviewEditorConfig(config);
        }
      })
      .catch((error) => {
        console.error('Failed to create CKEditor preview config', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isArtifactPreview, open]);

  const CKEditorComponent = editorRuntime?.CKEditor;
  const ClassicEditorConstructor = editorRuntime?.ClassicEditor;

  useEffect(() => {
    if (varsInDoc.length !== varsLengthRef.current) {
      setPreviewKey((k) => k + 1);
      varsLengthRef.current = varsInDoc.length;
    }
  }, [varsInDoc.length]);

  const clampSidebarWidthPercent = useCallback((nextPercent: number) => {
    const containerWidth = drawerContentRef.current?.getBoundingClientRect().width ?? 0;
    if (containerWidth <= 0) {
      return Math.min(MAX_SIDEBAR_WIDTH_PERCENT, Math.max(28, nextPercent));
    }

    const minPercent = (MIN_SIDEBAR_WIDTH_PX / containerWidth) * 100;
    const maxPercent = ((containerWidth - MIN_PREVIEW_WIDTH_PX) / containerWidth) * 100;
    const boundedMaxPercent = Math.min(MAX_SIDEBAR_WIDTH_PERCENT, Math.max(minPercent, maxPercent));

    return Math.min(boundedMaxPercent, Math.max(minPercent, nextPercent));
  }, []);

  const stopResize = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!isResizingRef.current || !drawerContentRef.current) return;

      const rect = drawerContentRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const nextPercent = ((event.clientX - rect.left) / rect.width) * 100;
      setSidebarWidthPercent(clampSidebarWidthPercent(nextPercent));
    };

    const handlePointerUp = () => {
      stopResize();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      stopResize();
    };
  }, [clampSidebarWidthPercent, open, stopResize]);

  useEffect(() => {
    if (!open || renderMode !== 'modal') return;

    const bodyStyle = document.body.style;
    const docStyle = document.documentElement.style;

    const previousBodyOverflow = bodyStyle.overflow;
    const previousBodyOverscrollBehavior = bodyStyle.overscrollBehavior;
    const previousDocOverflow = docStyle.overflow;
    const previousDocOverscrollBehavior = docStyle.overscrollBehavior;

    bodyStyle.overflow = 'hidden';
    bodyStyle.overscrollBehavior = 'none';
    docStyle.overflow = 'hidden';
    docStyle.overscrollBehavior = 'none';

    return () => {
      bodyStyle.overflow = previousBodyOverflow;
      bodyStyle.overscrollBehavior = previousBodyOverscrollBehavior;
      docStyle.overflow = previousDocOverflow;
      docStyle.overscrollBehavior = previousDocOverscrollBehavior;
    };
  }, [open, renderMode]);

  useEffect(() => {
    if (open && varsInDoc.length > 0) {
      const typeUpdates = {} as VarTypes;
      const valueUpdates: Record<string, string> = {};
      let hasTypeUpdates = false;
      let hasValueUpdates = false;

      varsInDoc.forEach((varKey) => {
        const defaultType = getDefaultVariableInputTypeForKey(varKey, undefined, template_type);
        const definitionInputType = getTemplateVariableDefinitionByKey(varKey, template_type)?.inputType;
        const currentType = varTypes[varKey] ? normalizeVariableInputType(varTypes[varKey]) : null;
        if (
          !varTypes[varKey] ||
          (definitionInputType && currentType !== defaultType) ||
          (defaultType === 'Document template' && varTypes[varKey] !== defaultType)
        ) {
          typeUpdates[varKey] = defaultType;
          hasTypeUpdates = true;
        }

        const defaultValue = getDefaultVariableValueForKey(varKey, template_type);
        if (defaultValue !== undefined && varValues[varKey] === undefined) {
          valueUpdates[varKey] = defaultValue;
          hasValueUpdates = true;
        }
      });

      if (hasTypeUpdates) onVarTypesChange(typeUpdates);
      if (hasValueUpdates) onVarValuesChange(valueUpdates);
    }
  }, [open, varsInDoc, varTypes, varValues, onVarTypesChange, onVarValuesChange, template_type]);

  useEffect(() => {
    if (open) {
      setActiveVarKey(null);
      setIsSidebarNavCollapsed(true);
      setExpandAllVariables(false);
      setExpandedVarCards({});
    }
  }, [open]);

  useEffect(() => {
    const nextPreviewContent =
      previewDisplayMode === 'variables'
        ? rawHtml || renderedHtmlHighlighted || renderedHtml
        : renderedHtmlHighlighted || renderedHtml;

    if (!open) {
      return;
    }

    if (nextPreviewContent === previewContentRef.current) {
      return;
    }

    if (previewContentRef.current.length === 0) {
      setPreviewContent(nextPreviewContent);
      return;
    }

    if (isPreviewEditorFocused && onPreviewContentChange) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPreviewContent(nextPreviewContent);
    }, PREVIEW_CONTENT_UPDATE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isPreviewEditorFocused,
    onPreviewContentChange,
    open,
    previewDisplayMode,
    rawHtml,
    renderedHtmlHighlighted,
    renderedHtml,
  ]);

  const getPreviewEditableRoot = useCallback(() => {
    return editorRef.current?.editor?.ui.getEditableElement() as HTMLElement | null;
  }, []);

  const syncPreviewEditorReadOnlyMode = useCallback(
    (editor: ClassicEditor | null | undefined) => {
      if (!editor) {
        return;
      }

      const editableElement = editor.ui.getEditableElement() as HTMLElement | null;

      if (isPreviewEditorReadOnly) {
        editor.enableReadOnlyMode(DOCUMENT_VARIABLES_PREVIEW_READ_ONLY_LOCK_ID);
        editableElement?.setAttribute('tabindex', '-1');
        editableElement?.setAttribute('aria-readonly', 'true');
        return;
      }

      editor.disableReadOnlyMode(DOCUMENT_VARIABLES_PREVIEW_READ_ONLY_LOCK_ID);
      editableElement?.removeAttribute('tabindex');
      editableElement?.removeAttribute('aria-readonly');
    },
    [isPreviewEditorReadOnly],
  );

  useEffect(() => {
    syncPreviewEditorReadOnlyMode(editorRef.current?.editor);
  }, [syncPreviewEditorReadOnlyMode]);

  const escapeSelectorValue = useCallback((value: string) => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/(["\\])/g, '\\$1');
  }, []);

  const getAnchorElements = useCallback(
    (root: HTMLElement, varKey: string) => {
      const escapedVarKey = escapeSelectorValue(varKey);
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(`[data-var-key="${escapedVarKey}"]`));

      if (nodes.length > 0) {
        return nodes.sort((a, b) => {
          const aOccurrence = Number(a.getAttribute('data-var-occurrence') ?? Number.MAX_SAFE_INTEGER);
          const bOccurrence = Number(b.getAttribute('data-var-occurrence') ?? Number.MAX_SAFE_INTEGER);
          return aOccurrence - bOccurrence;
        });
      }

      if (varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)) {
        const template_id = varKey.slice(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`.length);
        const escapedTemplateId = escapeSelectorValue(template_id);
        const docTemplateNode = root.querySelector<HTMLElement>(
          `[${DOCUMENT_TEMPLATE_WRAPPER_ATTR}="${escapedTemplateId}"]`,
        );
        if (docTemplateNode) return [docTemplateNode];
      }

      const fallbackText = `{{${varKey}}}`;
      const emptyNodes = Array.from(root.querySelectorAll<HTMLElement>('.var-empty'));
      return emptyNodes.filter((node) => node.textContent?.replace(/\s+/g, ' ').includes(fallbackText));
    },
    [escapeSelectorValue],
  );

  const applyPreviewAnchorHighlight = useCallback((anchorElement: HTMLElement) => {
    const previousElement = highlightedAnchorRef.current;
    if (previousElement && previousElement !== anchorElement) {
      previousElement.classList.remove('preview-variable-target-highlight');
    }

    anchorElement.classList.remove('preview-variable-target-highlight');
    void anchorElement.offsetWidth;
    anchorElement.classList.add('preview-variable-target-highlight');

    highlightedAnchorRef.current = anchorElement;

    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      anchorElement.classList.remove('preview-variable-target-highlight');
      if (highlightedAnchorRef.current === anchorElement) {
        highlightedAnchorRef.current = null;
      }
      highlightTimeoutRef.current = null;
    }, 1400);
  }, []);

  const scrollPreviewToVariable = useCallback(
    (varKey: string) => {
      const root = getPreviewEditableRoot();
      if (!root) return false;

      const anchorElements = getAnchorElements(root, varKey);
      if (anchorElements.length === 0) return false;

      const currentIndex = variableAnchorCycleIndexRef.current[varKey] ?? 0;
      const nextIndex = currentIndex % anchorElements.length;
      const anchorElement = anchorElements[nextIndex];
      variableAnchorCycleIndexRef.current[varKey] = (nextIndex + 1) % anchorElements.length;

      if (!anchorElement) return false;

      anchorElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      applyPreviewAnchorHighlight(anchorElement);
      return true;
    },
    [applyPreviewAnchorHighlight, getAnchorElements, getPreviewEditableRoot],
  );

  const retryScrollToVariable = useCallback(
    (varKey: string, attempts = 6) => {
      let remainingAttempts = attempts;

      const tryScroll = () => {
        if (pendingScrollVarKeyRef.current !== varKey) return;

        if (scrollPreviewToVariable(varKey)) {
          pendingScrollVarKeyRef.current = null;
          return;
        }

        if (remainingAttempts <= 0) {
          pendingScrollVarKeyRef.current = null;
          return;
        }
        remainingAttempts -= 1;

        window.requestAnimationFrame(() => {
          window.setTimeout(tryScroll, 50);
        });
      };

      tryScroll();
    },
    [scrollPreviewToVariable],
  );

  const shouldIgnoreVariableCardClick = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
      target.closest(
        'input,select,textarea,button,a,[role="button"],[contenteditable="true"],.btn,.ck-editor,.modal-overlay,.cell-property-modal,.table-structure-modal-overlay,.table-structure-cell-property-modal',
      ),
    );
  }, []);

  const scrollVariableOrderItemIntoView = useCallback((varKey: string) => {
    window.requestAnimationFrame(() => {
      variableOrderItemRefs.current[varKey]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    });
  }, []);

  const scrollVariableCardIntoView = useCallback((varKey: string) => {
    const scrollContainer = variableListScrollRef.current;
    const cardElement = variableCardRefs.current[varKey];
    if (!scrollContainer || !cardElement) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();
    const maxScrollTop = Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0);
    const nextScrollTop = Math.min(
      Math.max(scrollContainer.scrollTop + cardRect.top - containerRect.top - VARIABLE_CARD_SCROLL_OFFSET_PX, 0),
      maxScrollTop,
    );

    scrollContainer.scrollTo({
      top: nextScrollTop,
      behavior: 'smooth',
    });
  }, []);

  const scheduleVariableCardScroll = useCallback(
    (varKey: string) => {
      window.requestAnimationFrame(() => {
        scrollVariableCardIntoView(varKey);
        window.requestAnimationFrame(() => scrollVariableCardIntoView(varKey));
      });
    },
    [scrollVariableCardIntoView],
  );

  const flashVariableCard = useCallback(
    (varKey: string) => {
      setActiveVarKey(varKey);
      scrollVariableOrderItemIntoView(varKey);
    },
    [scrollVariableOrderItemIntoView],
  );

  const activateVariableCard = useCallback((varKey: string) => {
    setActiveVarKey(varKey);
  }, []);

  const focusOfficeArtifactVariable = useCallback(
    (varKey: string) => {
      if (!isOfficeArtifactPreview || !officeArtifactEditorRef.current) {
        return false;
      }

      void officeArtifactEditorRef.current.focusVariable(getSemesterCoursesSignFocusVariableKey(varKey));
      return true;
    },
    [isOfficeArtifactPreview],
  );

  const focusVariableTarget = useCallback(
    (varKey: string) => {
      const targetVarKey = getSemesterCoursesSignFocusVariableKey(varKey);

      if (focusOfficeArtifactVariable(targetVarKey)) {
        return;
      }

      pendingScrollVarKeyRef.current = targetVarKey;

      if (scrollPreviewToVariable(targetVarKey)) {
        pendingScrollVarKeyRef.current = null;
        return;
      }

      retryScrollToVariable(targetVarKey);
    },
    [focusOfficeArtifactVariable, retryScrollToVariable, scrollPreviewToVariable],
  );

  const expandVariableCard = useCallback((varKey: string) => {
    setExpandedVarCards((current) => {
      if (current[varKey] === true && Object.keys(current).length === 1) return current;
      return { [varKey]: true };
    });
  }, []);

  const toggleVariableCard = useCallback(
    (varKey: string) => {
      activateVariableCard(varKey);
      focusVariableTarget(varKey);
      if (expandAllVariables) {
        setExpandAllVariables(false);
        setExpandedVarCards({ [varKey]: false });
        return;
      }

      setExpandedVarCards((current) => {
        const isExpanded = current[varKey] ?? activeVarKey === varKey;
        return isExpanded ? { [varKey]: false } : { [varKey]: true };
      });
    },
    [activateVariableCard, activeVarKey, expandAllVariables, focusVariableTarget],
  );

  const focusVariableFromPreview = useCallback(
    (varKey: string) => {
      const displayVarKey = normalizeSemesterCoursesDisplayVariableKey(varKey);
      flashVariableCard(displayVarKey);
      expandVariableCard(displayVarKey);
      scheduleVariableCardScroll(displayVarKey);
    },
    [expandVariableCard, flashVariableCard, scheduleVariableCardScroll],
  );

  const getPreviewVariableKeyFromTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) {
      return null;
    }

    const targetElement = target instanceof Element ? target : target.parentElement;
    if (!targetElement) {
      return null;
    }

    const anchorElement = targetElement.closest<HTMLElement>('[data-var-key]');
    const anchoredVarKey = anchorElement?.getAttribute('data-var-key')?.trim();
    if (anchoredVarKey) {
      return anchoredVarKey;
    }

    const documentTemplateElement = targetElement.closest<HTMLElement>(`[${DOCUMENT_TEMPLATE_WRAPPER_ATTR}]`);
    const documentTemplateId = documentTemplateElement?.getAttribute(DOCUMENT_TEMPLATE_WRAPPER_ATTR)?.trim();
    if (documentTemplateId) {
      return `${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.${documentTemplateId}`;
    }

    return null;
  }, []);

  const bindPreviewClickListener = useCallback(
    (editor: ClassicEditor) => {
      const listenerHost =
        (editor.ui.view.element as HTMLElement | null) ??
        (editor.ui.getEditableElement()?.parentElement as HTMLElement | null) ??
        (editor.ui.getEditableElement() as HTMLElement | null);
      if (!listenerHost) {
        return () => {};
      }

      const handlePreviewMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return;
        const varKey = getPreviewVariableKeyFromTarget(event.target);
        if (!varKey) return;

        const targetNode = event.target;
        let targetElement: Element | null = null;
        if (targetNode instanceof Element) {
          targetElement = targetNode;
        } else if (targetNode instanceof Node) {
          targetElement = targetNode.parentElement;
        }
        if (targetElement && !listenerHost.contains(targetElement)) return;

        focusVariableFromPreview(varKey);
      };

      document.addEventListener('mousedown', handlePreviewMouseDown, true);
      return () => {
        document.removeEventListener('mousedown', handlePreviewMouseDown, true);
      };
    },
    [focusVariableFromPreview, getPreviewVariableKeyFromTarget],
  );

  const handleSidebarItemClick = useCallback(
    (varKey: string) => {
      flashVariableCard(varKey);
      expandVariableCard(varKey);
      scheduleVariableCardScroll(varKey);
      focusVariableTarget(varKey);
    },
    [expandVariableCard, flashVariableCard, focusVariableTarget, scheduleVariableCardScroll],
  );

  const handleVariableCardClick = useCallback(
    (event: React.MouseEvent<HTMLElement>, varKey: string) => {
      if (event.button !== 0) return;
      setIsPreviewEditorFocused(false);
      if (shouldIgnoreVariableCardClick(event.target)) return;

      activateVariableCard(varKey);
      expandVariableCard(varKey);
      focusVariableTarget(varKey);
    },
    [activateVariableCard, expandVariableCard, focusVariableTarget, shouldIgnoreVariableCardClick],
  );

  useEffect(() => {
    if (!open) {
      pendingScrollVarKeyRef.current = null;
      setActiveVarKey(null);
      return;
    }

    const pendingVarKey = pendingScrollVarKeyRef.current;
    if (!pendingVarKey || previewContent.length === 0) return;

    const frameId = window.requestAnimationFrame(() => {
      if (scrollPreviewToVariable(pendingVarKey)) {
        pendingScrollVarKeyRef.current = null;
        return;
      }
      retryScrollToVariable(pendingVarKey, 4);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open, previewContent, retryScrollToVariable, scrollPreviewToVariable]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      if (highlightedAnchorRef.current) {
        highlightedAnchorRef.current.classList.remove('preview-variable-target-highlight');
      }
      variableCardRefs.current = {};
      variableOrderItemRefs.current = {};
    };
  }, []);

  useEffect(() => {
    const templateVarKeys = Object.keys(selectedTemplates);
    if (templateVarKeys.length === 0) return;

    tableRegenerationCycleRef.current += 1;
    const cycle = tableRegenerationCycleRef.current;
    const htmlUpdates = {} as Record<string, string>;
    let hasChanges = false;
    let generatedCount = 0;

    const activeTemplateKeys = new Set(templateVarKeys);
    Object.keys(tableTemplateHtmlCacheRef.current).forEach((varKey) => {
      if (!activeTemplateKeys.has(varKey)) {
        delete tableTemplateHtmlCacheRef.current[varKey];
      }
    });

    templateVarKeys.forEach((varKey) => {
      const template = selectedTemplates[varKey];
      const dependencySignature = buildTableTemplateDependencySignature(template, varValues);
      const cached = tableTemplateHtmlCacheRef.current[varKey];

      if (cached?.template === template && cached.dependencySignature === dependencySignature) {
        if (varValues[varKey] !== cached.html) {
          htmlUpdates[varKey] = cached.html;
          hasChanges = true;
        }
        return;
      }

      generatedCount += 1;
      const newTableHtml = measureVariablePerformance(
        'VariablesDrawer generateTableHtmlFromTableTemplate',
        () => generateTableHtmlFromTableTemplate(template, varValues),
        { cycle, key: varKey },
      );
      tableTemplateHtmlCacheRef.current[varKey] = {
        template,
        dependencySignature,
        html: newTableHtml,
      };

      if (varValues[varKey] !== newTableHtml) {
        htmlUpdates[varKey] = newTableHtml;
        hasChanges = true;
      }
    });

    if (hasChanges || shouldLogVariablePerformanceCycle(cycle)) {
      logVariablePerformance('VariablesDrawer table regeneration cycle', {
        cycle,
        configured_count: templateVarKeys.length,
        generated_count: generatedCount,
        updated_keys: Object.keys(htmlUpdates),
      });
    }

    if (hasChanges) {
      varValuesRef.current = {
        ...varValuesRef.current,
        ...htmlUpdates,
      };
      onVarValuesChange(htmlUpdates);
    }
  }, [selectedTemplates, varValues, onVarValuesChange]);

  // Re-generate document template HTML when values change
  useEffect(() => {
    const docVarKeys = Object.keys(selectedDocumentTemplates);
    if (docVarKeys.length === 0) return;

    documentRegenerationCycleRef.current += 1;
    const cycle = documentRegenerationCycleRef.current;
    const htmlUpdates = {} as Record<string, string>;
    let hasChanges = false;

    docVarKeys.forEach((varKey) => {
      const template = selectedDocumentTemplates[varKey];
      const vals = documentTemplateValues[varKey] ?? {};
      const newHtml = measureVariablePerformance(
        'VariablesDrawer generateDocumentHtml',
        () => generateDocumentHtml(template, vals),
        { cycle, key: varKey, value_count: Object.keys(vals).length },
      );

      if (varValues[varKey] !== newHtml) {
        htmlUpdates[varKey] = newHtml;
        hasChanges = true;
      }
    });

    if (hasChanges || shouldLogVariablePerformanceCycle(cycle)) {
      logVariablePerformance('VariablesDrawer document regeneration cycle', {
        cycle,
        configured_count: docVarKeys.length,
        updated_keys: Object.keys(htmlUpdates),
      });
    }

    if (hasChanges) {
      varValuesRef.current = {
        ...varValuesRef.current,
        ...htmlUpdates,
      };
      onVarValuesChange(htmlUpdates);
    }
  }, [selectedDocumentTemplates, documentTemplateValues, varValues, onVarValuesChange]);

  const flushPendingVariableInputs = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && drawerContentRef.current?.contains(activeElement)) {
      activeElement.blur();
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
  }, []);

  const syncTableTemplateHtml = useCallback(() => {
    const currentSelectedTemplates = selectedTemplatesRef.current;
    const updatedVarValues = { ...varValuesRef.current };
    const htmlUpdates: Record<string, string> = {};

    Object.entries(currentSelectedTemplates).forEach(([varKey, template]) => {
      const newTableHtml = generateTableHtmlFromTableTemplate(template, updatedVarValues);
      const dependencySignature = buildTableTemplateDependencySignature(template, updatedVarValues);

      tableTemplateHtmlCacheRef.current[varKey] = {
        template,
        dependencySignature,
        html: newTableHtml,
      };

      if (updatedVarValues[varKey] !== newTableHtml) {
        updatedVarValues[varKey] = newTableHtml;
        htmlUpdates[varKey] = newTableHtml;
      }
    });

    if (Object.keys(htmlUpdates).length > 0) {
      varValuesRef.current = updatedVarValues;
      onVarValuesChange(htmlUpdates);
    }

    return updatedVarValues;
  }, [onVarValuesChange]);

  const syncTableMatrixEdits = useCallback(() => {
    const currentVarValues = varValuesRef.current;
    const currentVarTypes = varTypesRef.current;
    const updatedVarValues = { ...currentVarValues };
    const tableVars = (Object.keys(currentVarTypes) as string[]).filter((k) =>
      isTableMatrixVariableInputType(currentVarTypes[k]),
    );

    if (tableVars.length === 0) return updatedVarValues;

    let currentContent = previewContentRef.current;
    if (editorRef.current?.editor) {
      currentContent = editorRef.current.editor.getData();
    }

    const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
    const tables = currentContent.match(tableRegex) || [];

    if (tables.length === 0) return updatedVarValues;

    // Use content-similarity matching instead of index-based matching
    // to handle documents with non-variable tables correctly.
    const usedTableIndices = new Set<number>();

    tableVars.forEach((varKey) => {
      const currentValue = currentVarValues[varKey];
      if (!currentValue) return;

      const expectedSig = buildTextSignature(currentValue);
      if (!expectedSig) return;

      const expectedTokens = buildTokenSet(expectedSig);
      if (expectedTokens.size === 0) return;

      let bestIndex = -1;
      let bestScore = -1;

      tables.forEach((table, idx) => {
        if (usedTableIndices.has(idx)) return;

        const candidateSig = buildTextSignature(table);
        if (!candidateSig) return;

        const candidateTokens = buildTokenSet(candidateSig);
        if (candidateTokens.size === 0) return;

        let intersection = 0;
        expectedTokens.forEach((token) => {
          if (candidateTokens.has(token)) intersection++;
        });

        const score = intersection / expectedTokens.size;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = idx;
        }
      });

      if (bestIndex !== -1 && bestScore >= 0.3) {
        usedTableIndices.add(bestIndex);
        if (currentVarValues[varKey] !== tables[bestIndex]) {
          updatedVarValues[varKey] = tables[bestIndex];
        }
      }
    });

    return updatedVarValues;
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await flushPendingVariableInputs();
      varValuesRef.current = syncTableTemplateHtml();
      const syncedVarValues = syncTableMatrixEdits();
      varValuesRef.current = syncedVarValues;
      await onSaveVariables(syncedVarValues);
      onShowToast({
        message: t('variables.drawer.saveSuccess'),
        type: 'success',
      });
    } catch (error) {
      console.error(`❌ Lỗi lưu:`, error);
    } finally {
      setIsSaving(false);
    }
  }, [flushPendingVariableInputs, syncTableTemplateHtml, syncTableMatrixEdits, onSaveVariables, onShowToast, t]);

  const onClearAllVariables = useCallback(() => {
    const confirmed = window.confirm(t('variables.drawer.clearAllConfirm'));
    if (!confirmed) return;

    const currentVarValues = varValuesRef.current;
    const resetKeys = Array.from(
      new Set([
        ...drawerBaseVariableKeys,
        ...Object.keys(currentVarValues),
        ...Object.keys(selectedTemplates),
        ...Object.keys(selectedDocumentTemplates),
        ...Object.keys(documentTemplateValues),
      ]),
    );
    const nextVarValues = Object.fromEntries(resetKeys.map((k) => [k, ''])) as Record<string, string>;
    const nextSelectedTemplates: Record<string, TableTemplate | null> = {};
    const nextSelectedDocumentTemplates: Record<string, DocumentTemplate | null> = {};

    resetKeys.forEach((varKey) => {
      const parsed = parseVariableName(varKey);
      const defaultTableTemplate =
        getTemplateVariableTableTemplateByKey(varKey, template_type) ??
        (parsed?.table === TABLE_TEMPLATE_VARIABLE_NAMESPACE ? getTableTemplateById(parsed.field) : undefined) ??
        selectedTemplates[varKey];
      const defaultDocumentTemplate =
        getTemplateVariableDocumentTemplateByKey(varKey, template_type) ??
        (parsed?.table === DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE ? getDocumentTemplateById(parsed.field) : undefined) ??
        selectedDocumentTemplates[varKey];

      if (defaultTableTemplate) {
        const clonedTemplate = cloneVariableTemplate(defaultTableTemplate);
        nextSelectedTemplates[varKey] = clonedTemplate;
        nextVarValues[varKey] = generateTableHtmlFromTableTemplate(clonedTemplate, nextVarValues);
      } else if (varKey in selectedTemplates) {
        nextSelectedTemplates[varKey] = null;
      }

      if (defaultDocumentTemplate) {
        const clonedTemplate = cloneVariableTemplate(defaultDocumentTemplate);
        nextSelectedDocumentTemplates[varKey] = clonedTemplate;
        nextVarValues[varKey] = generateDocumentHtml(clonedTemplate, {});
      } else if (varKey in selectedDocumentTemplates) {
        nextSelectedDocumentTemplates[varKey] = null;
      }

      const previousDocumentValues = documentTemplateValues[varKey];
      if (previousDocumentValues && Object.keys(previousDocumentValues).length > 0) {
        onDocumentTemplateValuesChange(
          varKey,
          Object.fromEntries(Object.keys(previousDocumentValues).map((key) => [key, ''])),
        );
      }
    });

    onVarValuesChange(nextVarValues);
    onSelectedTemplatesChange(nextSelectedTemplates);
    onSelectedDocumentTemplatesChange(nextSelectedDocumentTemplates);
    commitCompletedVarKeys(new Set());
    onClearAll?.();
  }, [
    commitCompletedVarKeys,
    onVarValuesChange,
    onSelectedTemplatesChange,
    onSelectedDocumentTemplatesChange,
    onDocumentTemplateValuesChange,
    onClearAll,
    selectedTemplates,
    selectedDocumentTemplates,
    documentTemplateValues,
    drawerBaseVariableKeys,
    template_type,
    t,
  ]);

  const handleVarTypeChange = useCallback(
    (varKey: string, newType: VariableInputType) => {
      const currentVarTypes = varTypesRef.current;
      onVarTypesChange({ [varKey]: newType });

      if (
        (currentVarTypes[varKey] === 'Table' ||
          currentVarTypes[varKey] === 'Table matrix' ||
          currentVarTypes[varKey] === 'Table template') &&
        newType !== 'Table' &&
        newType !== 'Table matrix' &&
        newType !== 'Table template'
      ) {
        onVarValuesChange({ [varKey]: '' });
      }

      if (currentVarTypes[varKey] === 'Document template' && newType !== 'Document template') {
        onVarValuesChange({ [varKey]: '' });
        onSelectedDocumentTemplatesChange({ [varKey]: null });
      }
    },
    [onVarTypesChange, onVarValuesChange, onSelectedDocumentTemplatesChange],
  );

  const requestOfficePreviewRebuild = useCallback(() => {
    if (!isOfficeArtifactPreview) return;

    pendingOfficePreviewRebuildRef.current = true;
  }, [isOfficeArtifactPreview]);

  useEffect(() => {
    if (!isOfficeArtifactPreview || !pendingOfficePreviewRebuildRef.current) return;

    pendingOfficePreviewRebuildRef.current = false;
    // Spreadsheets rebuild themselves inside OfficeArtifactEditor (debounced,
    // double-buffered) whenever values or render inputs change, so an explicit
    // rebuild here would fire a second, visible (non-buffered) reload — the
    // "loads 2-3 times" flwhen a table/document template is picked. Only
    // presentations still need the parent to push a rebuild.
    if (artifactType === 'spreadsheet') return;

    void officeArtifactEditorRef.current?.rebuildPreview();
  }, [artifactPreviewData, artifactType, isOfficeArtifactPreview]);

  const handleSelectTemplate = useCallback(
    (varKey: string, template: TableTemplate) => {
      selectedTemplatesRef.current = {
        ...selectedTemplatesRef.current,
        [varKey]: template,
      };
      onSelectedTemplatesChange({ [varKey]: template });
      setShowTemplateSelector(null);

      const tableHtml = generateTableHtmlFromTableTemplate(template, varValuesRef.current);
      tableTemplateHtmlCacheRef.current[varKey] = {
        template,
        dependencySignature: buildTableTemplateDependencySignature(template, varValuesRef.current),
        html: tableHtml,
      };
      varValuesRef.current = {
        ...varValuesRef.current,
        [varKey]: tableHtml,
      };
      onVarValuesChange({ [varKey]: tableHtml });
      requestOfficePreviewRebuild();
    },
    [onSelectedTemplatesChange, onVarValuesChange, requestOfficePreviewRebuild],
  );

  const handleSelectDocumentTemplate = useCallback(
    (varKey: string, template: DocumentTemplate) => {
      selectedDocumentTemplatesRef.current = {
        ...selectedDocumentTemplatesRef.current,
        [varKey]: template,
      };
      onSelectedDocumentTemplatesChange({ [varKey]: template });
      setShowDocumentTemplateSelector(null);

      const html = generateDocumentHtml(template, documentTemplateValues[varKey] ?? {});
      varValuesRef.current = {
        ...varValuesRef.current,
        [varKey]: html,
      };
      onVarValuesChange({ [varKey]: html });
      requestOfficePreviewRebuild();
    },
    [documentTemplateValues, onSelectedDocumentTemplatesChange, onVarValuesChange, requestOfficePreviewRebuild],
  );

  const handleReplaceVariable = useCallback(
    (item: IVariablePickerItem) => {
      if (!showVariableReplacePicker || !onReplaceVariable) {
        return;
      }

      onReplaceVariable(showVariableReplacePicker, item);
      setShowVariableReplacePicker(null);
    },
    [onReplaceVariable, showVariableReplacePicker],
  );

  const syncSavedPreviewSelection = useCallback((editor: ClassicEditor | null | undefined) => {
    if (!editor || isPreviewSelectionFrozenRef.current) {
      return;
    }

    const range = editor.model.document.selection.getFirstRange();
    savedPreviewSelectionRangeRef.current = range ? range.clone() : null;
  }, []);

  const capturePreviewEditorSelection = useCallback(() => {
    const editor = editorRef.current?.editor;
    if (!editor) {
      return;
    }

    const range = editor.model.document.selection.getFirstRange();
    savedPreviewSelectionRangeRef.current = range ? range.clone() : null;
  }, []);

  const handleOpenPreviewVariablePicker = useCallback(() => {
    capturePreviewEditorSelection();
    isPreviewSelectionFrozenRef.current = true;
    setShowPreviewVariablePicker(true);
  }, [capturePreviewEditorSelection]);

  const handlePreviewInsertTriggerMouseDown = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      capturePreviewEditorSelection();
      isPreviewSelectionFrozenRef.current = true;
    },
    [capturePreviewEditorSelection],
  );

  const handlePreviewVariablePickerConfirmStart = useCallback(() => {
    isPreviewVariableInsertPendingRef.current = true;
    isPreviewSelectionFrozenRef.current = true;
  }, []);

  const handlePreviewVariablePickerOpenChange = useCallback((nextOpen: boolean) => {
    setShowPreviewVariablePicker(nextOpen);

    if (!nextOpen && !isPreviewVariableInsertPendingRef.current) {
      isPreviewSelectionFrozenRef.current = false;
    }
  }, []);

  const handleInsertPreviewVariables = useCallback(
    (items: IVariablePickerItem[]) => {
      const editor = editorRef.current?.editor;
      if (!editor) {
        isPreviewVariableInsertPendingRef.current = false;
        isPreviewSelectionFrozenRef.current = false;
        return;
      }

      const targetRange =
        savedPreviewSelectionRangeRef.current ?? editor.model.document.selection.getFirstRange()?.clone();
      try {
        insertVariablePickerItems(editor, items, targetRange);
      } finally {
        isPreviewVariableInsertPendingRef.current = false;
        isPreviewSelectionFrozenRef.current = false;
      }

      syncSavedPreviewSelection(editor);

      const html = editor.getData();
      setPreviewContent(html);
      onPreviewContentChange?.(html);
    },
    [onPreviewContentChange, syncSavedPreviewSelection],
  );

  const handleInsertPreviewVariable = useCallback(
    (item: IVariablePickerItem) => {
      handleInsertPreviewVariables([item]);
    },
    [handleInsertPreviewVariables],
  );

  // Stable callbacks for VariableFieldDropdown to avoid re-creating closures per render
  const handleFieldTemplateChange = useCallback(
    (key: string, template: TableTemplate | null) => {
      if (!template) {
        const nextSelectedTemplates = { ...selectedTemplatesRef.current };
        delete nextSelectedTemplates[key];
        selectedTemplatesRef.current = nextSelectedTemplates;
        delete tableTemplateHtmlCacheRef.current[key];
        varValuesRef.current = {
          ...varValuesRef.current,
          [key]: '',
        };
        onSelectedTemplatesChange({ [key]: null });
        onVarValuesChange({ [key]: '' });
        requestOfficePreviewRebuild();
      } else {
        selectedTemplatesRef.current = {
          ...selectedTemplatesRef.current,
          [key]: template,
        };
        const tableHtml = generateTableHtmlFromTableTemplate(template, varValuesRef.current);
        tableTemplateHtmlCacheRef.current[key] = {
          template,
          dependencySignature: buildTableTemplateDependencySignature(template, varValuesRef.current),
          html: tableHtml,
        };
        varValuesRef.current = {
          ...varValuesRef.current,
          [key]: tableHtml,
        };
        onSelectedTemplatesChange({ [key]: template });
        onVarValuesChange({ [key]: tableHtml });
        requestOfficePreviewRebuild();
      }
    },
    [onSelectedTemplatesChange, onVarValuesChange, requestOfficePreviewRebuild],
  );

  const handleFieldDocTemplateChange = useCallback(
    (key: string, tpl: DocumentTemplate | null) => {
      if (!tpl) {
        const nextSelectedDocumentTemplates = { ...selectedDocumentTemplatesRef.current };
        delete nextSelectedDocumentTemplates[key];
        selectedDocumentTemplatesRef.current = nextSelectedDocumentTemplates;
        varValuesRef.current = {
          ...varValuesRef.current,
          [key]: '',
        };
        onSelectedDocumentTemplatesChange({ [key]: null });
        onVarValuesChange({ [key]: '' });
        requestOfficePreviewRebuild();
      } else {
        selectedDocumentTemplatesRef.current = {
          ...selectedDocumentTemplatesRef.current,
          [key]: tpl,
        };
        const html = generateDocumentHtml(tpl, documentTemplateValues[key] ?? {});
        varValuesRef.current = {
          ...varValuesRef.current,
          [key]: html,
        };
        onSelectedDocumentTemplatesChange({ [key]: tpl });
        onVarValuesChange({ [key]: html });
        requestOfficePreviewRebuild();
      }
    },
    [documentTemplateValues, onSelectedDocumentTemplatesChange, onVarValuesChange, requestOfficePreviewRebuild],
  );

  const handleExportPdf = useCallback(async () => {
    try {
      await exportToPdf(previewContentRef.current, createDownloadFileName(exportBaseFileName, 'pdf'));
      onShowToast({
        message: t('variables.drawer.exportPdfSuccess'),
        type: 'success',
      });
    } catch (error: any) {
      console.error(t('variables.drawer.exportPdfFailed'), error);
      onShowToast({
        message: `✕ ${t('variables.drawer.exportPdfFailed')} ${error.message}`,
        type: 'error',
      });
    }
  }, [exportBaseFileName, onShowToast, t]);

  const handleExportWord = useCallback(async () => {
    try {
      await exportToWord(previewContentRef.current, createDownloadFileName(exportBaseFileName, 'docx'));
    } catch (error: any) {
      console.error(t('variables.drawer.exportWordFailed'), error);
      onShowToast({
        message: `✕ ${t('variables.drawer.exportWordFailed')} ${error.message}`,
        type: 'error',
      });
    }
  }, [exportBaseFileName, onShowToast, t]);

  const handleOpenDocxExportPreview = useCallback(async () => {
    let previewWindow: Window | null = null;

    try {
      previewWindow = openDocxExportPreviewWindow();
      setDocxExportPreviewLoading(true);

      const payload = await writeDocxExportPreviewPayload({
        source: 'document',
        title: exportBaseFileName,
        fileName: createDownloadFileName(exportBaseFileName, 'docx'),
        htmlContent: previewContentRef.current || '<p></p>',
      });

      navigateDocxExportPreviewWindow(previewWindow, payload.id);
    } catch (error: any) {
      previewWindow?.close();
      onShowToast({
        message: `✕ ${t('variables.drawer.exportWordFailed')} ${error.message}`,
        type: 'error',
      });
    } finally {
      setDocxExportPreviewLoading(false);
    }
  }, [exportBaseFileName, onShowToast, t]);

  const containerClassName =
    renderMode === 'page'
      ? 'flex min-h-0 flex-1 flex-col'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';

  const contentClassName =
    renderMode === 'page'
      ? 'flex min-h-0 flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm'
      : 'flex h-[99vh] w-[99vw] overflow-hidden rounded-lg bg-white shadow-xl';
  const paneHeaderClassName = 'flex min-h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4';

  const renderArtifactPreview = () => {
    if (isOfficeArtifactPreview && artifactOfficeScope && artifactOfficeId) {
      return (
        <OfficeArtifactEditor
          ref={officeArtifactEditorRef}
          scope={artifactOfficeScope}
          id={artifactOfficeId}
          artifactType={artifactType}
          metadata={artifactConfig}
          values={artifactPreviewValues}
          variableCatalog={variableCatalog ?? {}}
          template_type={template_type}
          readOnly
          renderValues
          renderData={artifactPreviewData}
          renderArtifactState={artifactConfig}
          showInsertVariableButton={false}
          onMetadataChange={onArtifactConfigChange}
          onFocusedVariableChange={focusVariableFromPreview}
          onShowToast={onShowToast}
        />
      );
    }

    if (artifactType === 'image_form') {
      return (
        <ArtifactEditor
          artifactType={artifactType}
          config={artifactConfig}
          values={artifactPreviewValues}
          variableKeys={artifactPreviewVariableKeys}
          variableCatalog={variableCatalog ?? {}}
          template_type={template_type}
          readOnly
        />
      );
    }

    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-slate-50 p-6 text-center text-sm text-slate-500">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="font-semibold text-slate-800">{getArtifactTypeLabel(artifactType)}</div>
          <div className="mt-2">
            Office artifacts open in the source editor. Use this workspace for variable values and save the values on
            the left.
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {open && (
        <div className={containerClassName} onClick={renderMode === 'modal' ? onClose : undefined}>
          <div ref={drawerContentRef} className={contentClassName} onClick={(e) => e.stopPropagation()}>
            <div className="flex h-full min-w-0 flex-1 overflow-hidden bg-white overscroll-none">
              <div
                className="flex min-w-0 shrink-0 flex-col overflow-hidden bg-white overscroll-none"
                style={{
                  width: isPreviewPaneCollapsed
                    ? `calc(100% - ${VARIABLES_DRAWER_RESIZER_WIDTH_PX}px)`
                    : `${sidebarWidthPercent}%`,
                  minWidth: `${MIN_SIDEBAR_WIDTH_PX}px`,
                }}>
                {/* Header */}
                <div className={paneHeaderClassName}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-semibold text-[#002147]">{t('variables.drawer.title')}</span>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-medium text-blue-700">
                      {visibleVarKeys.length}
                    </span>
                  </div>
                  {readOnly && (
                    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                      🔒 {t('common.status.readOnly')}
                    </span>
                  )}
                </div>

                {/* Variables list */}
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  {!hasDrawerVariableSource ? (
                    <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-400">
                      {t('variables.drawer.empty')}
                    </div>
                  ) : (
                    <>
                      <div
                        className={`flex min-h-0 shrink-0 flex-col border-r border-slate-200 bg-slate-50/70 p-3 transition-[width] duration-200 ${
                          isSidebarNavCollapsed ? 'w-24' : 'w-72'
                        }`}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          {!isSidebarNavCollapsed && (
                            <span className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {t('variables.drawer.order')}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarNavCollapsed((current) => !current)}
                            className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100">
                            {isSidebarNavCollapsed ? (
                              <PanelLeftOpen className="size-4" />
                            ) : (
                              <PanelLeftClose className="size-4" />
                            )}
                          </Button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 pb-3">
                          {visibleVarKeys.map((varKey) => {
                            const itemIndex = variableIndexMap.get(varKey) ?? 0;
                            const displayLabel = getDrawerVariableDisplayLabel(varKey);
                            const isActive = activeVarKey === varKey;
                            const isOpen = expandAllVariables || (expandedVarCards[varKey] ?? isActive);
                            const occurrenceCount = variableOccurrenceCountMap.get(varKey) ?? 0;
                            const isManuallyCompleted = completedVarKeySet.has(varKey);
                            const isReady = isManuallyCompleted;
                            const sidebarItemClassName = isActive
                              ? 'border-blue-500 bg-blue-50 shadow-[0_0_0_2px_rgba(59,130,246,0.12)]'
                              : isManuallyCompleted
                                ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                                : isOpen
                                  ? 'border-slate-300 bg-white shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-100';
                            const sidebarIndexClassName = isReady
                              ? 'bg-emerald-100 text-emerald-700'
                              : isActive
                                ? 'bg-blue-600 text-white'
                                : isOpen
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-slate-100 text-slate-500';
                            const sidebarLabelClassName = isActive
                              ? 'font-semibold text-blue-900'
                              : isReady
                                ? 'font-semibold text-emerald-800'
                                : isOpen
                                  ? 'font-medium text-slate-800'
                                  : 'font-medium text-slate-700';
                            const sidebarReadyDotClassName = 'bg-emerald-500';

                            return (
                              <button
                                key={varKey}
                                ref={(element) => {
                                  variableOrderItemRefs.current[varKey] = element;
                                }}
                                type="button"
                                onClick={() => handleSidebarItemClick(varKey)}
                                aria-label={displayLabel}
                                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${sidebarItemClassName} ${
                                  isSidebarNavCollapsed ? 'justify-center px-2' : ''
                                }`}>
                                <span
                                  className={`inline-flex min-w-8 shrink-0 items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${sidebarIndexClassName}`}>
                                  {itemIndex}
                                </span>
                                {!isSidebarNavCollapsed && (
                                  <>
                                    <span className={`min-w-0 flex-1 truncate text-sm ${sidebarLabelClassName}`}>
                                      {displayLabel}
                                    </span>
                                    {occurrenceCount > 1 && (
                                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                        x{occurrenceCount}
                                      </span>
                                    )}
                                    {isReady && (
                                      <span className={`size-2 shrink-0 rounded-full ${sidebarReadyDotClassName}`} />
                                    )}
                                  </>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div
                        ref={variableListScrollRef}
                        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3">
                        {isArtifactPreview && (
                          <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-[11px] font-semibold text-slate-600">
                              <button
                                type="button"
                                onClick={() => setArtifactVariableFilter('used')}
                                className={`rounded-md px-2 py-1.5 transition ${
                                  artifactVariableFilter === 'used'
                                    ? 'bg-white text-slate-950 shadow-sm'
                                    : 'hover:text-slate-900'
                                }`}>
                                {t('variables.drawer.usedVariables')} ({varsInDoc.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setArtifactVariableFilter('all')}
                                className={`rounded-md px-2 py-1.5 transition ${
                                  artifactVariableFilter === 'all'
                                    ? 'bg-white text-slate-950 shadow-sm'
                                    : 'hover:text-slate-900'
                                }`}>
                                {t('variables.drawer.allVariables')} ({artifactAvailableVariableKeys.length})
                              </button>
                            </div>
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                              <Input
                                value={variableSearchQuery}
                                onChange={(event) => setVariableSearchQuery(event.target.value)}
                                placeholder={t('variables.drawer.searchVariables')}
                                className="h-8 rounded-lg bg-white pl-8 text-xs"
                              />
                            </div>
                          </div>
                        )}
                        <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                          <span>{t('variables.drawer.expandAll')}</span>
                          <Checkbox
                            checked={expandAllVariables}
                            onCheckedChange={(checked) => {
                              const enabled = checked === true;
                              setExpandAllVariables(enabled);
                              if (enabled) {
                                setExpandedVarCards({});
                              }
                            }}
                          />
                        </label>
                        <div className="space-y-3">
                          {visibleVarKeys.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                              {t('variables.drawer.noFilterResults')}
                            </div>
                          ) : (
                            visibleVarKeys.map((k) => {
                              const parsed = parsedVariables.get(k);
                              const isExpanded = expandAllVariables || (expandedVarCards[k] ?? activeVarKey === k);
                              const occurrenceCount = variableOccurrenceCountMap.get(k) ?? 0;
                              const isManuallyCompleted = completedVarKeySet.has(k);
                              const isReady = isManuallyCompleted;
                              const displayLabel = getDrawerVariableDisplayLabel(k);
                              const markCompletedLabel = t('variables.drawer.markCompleted', { label: displayLabel });
                              if (parsed) {
                                const autoFillFields = groupedFieldsByPrimary.get(k);
                                return (
                                  <div
                                    key={k}
                                    ref={(element) => {
                                      variableCardRefs.current[k] = element;
                                    }}
                                    className={`relative min-w-0 overflow-hidden rounded-xl border transition-all duration-200 ${
                                      activeVarKey === k
                                        ? 'border-blue-400 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
                                        : isManuallyCompleted
                                          ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                                          : 'border-slate-200 bg-white'
                                    }`}
                                    onMouseDown={(event) => handleVariableCardClick(event, k)}>
                                    <div
                                      className={`flex items-center gap-2 px-3 py-3 ${
                                        isExpanded ? 'border-b border-slate-100' : ''
                                      }`}>
                                      <button
                                        type="button"
                                        onClick={() => toggleVariableCard(k)}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                        {isExpanded ? (
                                          <ChevronDown className="size-4 shrink-0 text-slate-500" />
                                        ) : (
                                          <ChevronRight className="size-4 shrink-0 text-slate-500" />
                                        )}
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                                            isReady
                                              ? 'bg-emerald-100 text-emerald-700'
                                              : activeVarKey === k
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-slate-100 text-slate-500'
                                          }`}>
                                          {variableIndexMap.get(k)}
                                        </span>
                                        <span
                                          className={`truncate text-[12px] font-semibold ${
                                            isReady ? 'text-emerald-800' : 'text-slate-600'
                                          }`}>
                                          {displayLabel}
                                        </span>
                                        {occurrenceCount > 1 && (
                                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                            x{occurrenceCount}
                                          </span>
                                        )}
                                      </button>
                                      <Checkbox
                                        disabled={readOnly}
                                        checked={isManuallyCompleted}
                                        title={markCompletedLabel}
                                        aria-label={markCompletedLabel}
                                        className="shrink-0"
                                        onCheckedChange={(checked) => handleManualCompletedChange(k, checked === true)}
                                      />
                                      {usedVarKeySet.has(k) && onRemoveVariable && !readOnly && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => onRemoveVariable(k)}
                                          title={t('variables.drawer.removeVariable')}
                                          className="h-5 w-5 shrink-0 text-gray-300 hover:text-red-400">
                                          <X className="size-3" />
                                        </Button>
                                      )}
                                    </div>
                                    {isExpanded && (
                                      <div>
                                        <VariableFieldDropdown
                                          varKey={k}
                                          table={parsed.table}
                                          field={parsed.field}
                                          varValues={displayVarValues}
                                          onVarValuesChange={onVarValuesChange}
                                          varsInDoc={varsInDoc}
                                          onChangeVariable={
                                            allowVariableInsertion && onReplaceVariable && variableCatalog
                                              ? setShowVariableReplacePicker
                                              : undefined
                                          }
                                          varType={varTypes[k]}
                                          onVarTypeChange={handleVarTypeChange}
                                          selectedTemplate={selectedTemplates[k]}
                                          onSelectedTemplateChange={handleFieldTemplateChange}
                                          onShowTemplateSelector={setShowTemplateSelector}
                                          selectedDocumentTemplate={selectedDocumentTemplates[k]}
                                          documentTemplateValues={documentTemplateValues[k]}
                                          onDocumentTemplateChange={handleFieldDocTemplateChange}
                                          onDocumentTemplateValuesChange={onDocumentTemplateValuesChange}
                                          onShowDocumentTemplateSelector={setShowDocumentTemplateSelector}
                                          readOnly={readOnly}
                                          simpleMode={simpleMode}
                                          allowDocumentTemplateReorder={allowDocumentTemplateReorder}
                                          title={varTitles[k]}
                                          template_type={template_type}
                                          onTitleChange={onTitleChange}
                                          definitionRefreshKey={definitionRefreshKey}
                                        />
                                        {!simpleMode && autoFillFields && autoFillFields.length > 0 && (
                                          <div
                                            style={{
                                              display: 'flex',
                                              flexWrap: 'wrap',
                                              gap: '4px',
                                              padding: '0 12px 8px',
                                            }}>
                                            {autoFillFields.map((f) => (
                                              <span
                                                key={f}
                                                style={{
                                                  fontSize: '11px',
                                                  color: '#6b7280',
                                                  background: '#f3f4f6',
                                                  borderRadius: '4px',
                                                  padding: '1px 6px',
                                                }}>
                                                + {getVariableAlias(parsed.table, f, template_type)}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              const varType = normalizeVariableInputType(varTypes[k] || 'Data');
                              const current = displayVarValues[k] ?? '';
                              const options: string[] = [];

                              return (
                                <div
                                  key={k}
                                  ref={(element) => {
                                    variableCardRefs.current[k] = element;
                                  }}
                                  className={`min-w-0 overflow-hidden rounded-xl border transition-all duration-200 ${
                                    activeVarKey === k
                                      ? 'border-blue-400 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
                                      : isManuallyCompleted
                                        ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                                        : 'border-slate-200 bg-white'
                                  }`}
                                  style={{ opacity: readOnly ? 0.7 : 1 }}
                                  onMouseDown={(event) => handleVariableCardClick(event, k)}>
                                  <div
                                    className={`flex items-center gap-2 px-3 py-3 ${
                                      isExpanded ? 'border-b border-slate-100' : ''
                                    }`}>
                                    <button
                                      type="button"
                                      onClick={() => toggleVariableCard(k)}
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                      {isExpanded ? (
                                        <ChevronDown className="size-4 shrink-0 text-slate-500" />
                                      ) : (
                                        <ChevronRight className="size-4 shrink-0 text-slate-500" />
                                      )}
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                                          isReady
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : activeVarKey === k
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {variableIndexMap.get(k)}
                                      </span>
                                      <span
                                        className={`truncate text-[12px] font-semibold ${
                                          isReady ? 'text-emerald-800' : 'text-slate-600'
                                        }`}>
                                        {displayLabel}
                                      </span>
                                      {occurrenceCount > 1 && (
                                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                          x{occurrenceCount}
                                        </span>
                                      )}
                                    </button>
                                    <Checkbox
                                      disabled={readOnly}
                                      checked={isManuallyCompleted}
                                      title={markCompletedLabel}
                                      aria-label={markCompletedLabel}
                                      className="shrink-0"
                                      onCheckedChange={(checked) => handleManualCompletedChange(k, checked === true)}
                                    />
                                    {usedVarKeySet.has(k) && onRemoveVariable && !readOnly && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onRemoveVariable(k)}
                                        title={t('variables.drawer.removeVariable')}
                                        className="h-5 w-5 shrink-0 text-gray-300 hover:text-red-400">
                                        <X className="size-3" />
                                      </Button>
                                    )}
                                  </div>
                                  {isExpanded && (
                                    <div className="space-y-2 p-3">
                                      <div className="flex items-center gap-2">
                                        <label className="min-w-0 flex-1 text-xs font-medium text-gray-700">
                                          <code className="rounded bg-gray-100 px-1">{`{{${k}}}`}</code>
                                          {displayLabel !== k && (
                                            <span className="ml-1 font-medium text-slate-500">- {displayLabel}</span>
                                          )}
                                        </label>
                                        <Select
                                          value={varType}
                                          disabled={readOnly}
                                          onValueChange={(v) => handleVarTypeChange(k, v as VariableInputType)}>
                                          <SelectTrigger className="w-36 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {VARIABLE_INPUT_TYPE_OPTIONS.map((type) => (
                                              <SelectItem key={type} value={type}>
                                                {t(`variables.inputTypes.${type}`)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {isSelectVariableInputType(varType) ? (
                                        <SearchableSelect
                                          inlineSearchTrigger
                                          value={current || undefined}
                                          disabled={readOnly}
                                          onValueChange={(v) => onVarValuesChange({ [k]: v })}
                                          options={options.map((opt) => ({
                                            value: opt,
                                            label: opt,
                                          }))}
                                          placeholder={t('tableEditor.cellProperties.searchAndSelect')}
                                          searchPlaceholder={t('tableEditor.cellProperties.searchValue')}
                                          emptyMessage={t('tableEditor.cellProperties.emptyValue')}
                                          clearable
                                        />
                                      ) : isCheckVariableInputType(varType) ? (
                                        <Checkbox
                                          disabled={readOnly}
                                          checked={current === 'true' || current === '1'}
                                          onCheckedChange={(checked) =>
                                            onVarValuesChange({ [k]: checked === true ? 'true' : 'false' })
                                          }
                                        />
                                      ) : isLongTextVariableInputType(varType) ? (
                                        <Textarea
                                          value={current}
                                          readOnly={readOnly}
                                          onChange={(e) => onVarValuesChange({ [k]: e.target.value })}
                                          placeholder={t('variables.inputPlaceholders.longText')}
                                          rows={4}
                                          className="w-full"
                                        />
                                      ) : (
                                        <Input
                                          type="text"
                                          value={current}
                                          readOnly={readOnly}
                                          onChange={(e) => onVarValuesChange({ [k]: e.target.value })}
                                          placeholder={t('variables.inputPlaceholders.value')}
                                          className="w-full"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                {hasDrawerVariableSource && (
                  <div className="flex gap-2 border-t border-gray-200 p-3">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleSave}
                      disabled={isSaving || readOnly}>
                      {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      {isSaving ? t('common.status.saving') : t('common.actions.save')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onClearAllVariables}
                      disabled={isSaving || readOnly}
                      className="border-red-200 text-red-500 hover:bg-red-50">
                      <Trash2 className="size-3.5" />
                      {t('common.actions.clearAll')}
                    </Button>
                  </div>
                )}
              </div>

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t('variables.drawer.resizeVariablesPane')}
                onPointerDown={handleResizeStart}
                className="relative z-20 w-3 shrink-0 cursor-col-resize border-x border-slate-200 bg-slate-100/90 transition-colors hover:bg-slate-200">
                <div className="absolute left-1/2 top-1/2 flex h-8 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm">
                  <GripVertical className="size-3 text-slate-500" />
                </div>
              </div>

              {/* RIGHT: Live preview */}
              {!isPreviewPaneCollapsed && (
                <div
                  className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white overscroll-none"
                  style={{ minWidth: `${MIN_PREVIEW_WIDTH_PX}px` }}>
                  <div className={paneHeaderClassName}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700">
                        {isArtifactPreview ? getArtifactTypeLabel(artifactType) : t('variables.drawer.livePreview')}
                      </span>
                      {showPreviewDisplayModeToggle && !isArtifactPreview && (
                        <div className="flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold text-slate-600">
                          <button
                            type="button"
                            onClick={() => setPreviewDisplayMode('rendered')}
                            className={`h-6 rounded-md px-2.5 transition ${
                              previewDisplayMode === 'rendered'
                                ? 'bg-white text-slate-950 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}>
                            {t('templateDetail.previewMode.rendered')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDisplayMode('variables')}
                            className={`h-6 rounded-md px-2.5 transition ${
                              previewDisplayMode === 'variables'
                                ? 'bg-white text-slate-950 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}>
                            {t('templateDetail.previewMode.variables')}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {allowVariableInsertion && variableCatalog && !readOnly && !isArtifactPreview && (
                        <Button
                          size="sm"
                          variant="outline"
                          onMouseDown={handlePreviewInsertTriggerMouseDown}
                          onClick={handleOpenPreviewVariablePicker}
                          className="h-9 rounded-lg px-3"
                          title={t('variables.picker.insertAtCursor')}>
                          <Braces className="size-3.5" />
                          {t('variables.picker.confirm')}
                        </Button>
                      )}
                      {!isArtifactPreview &&
                        (shouldUseDocxExportPreview ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleOpenDocxExportPreview()}
                            disabled={docxExportPreviewLoading}
                            className="h-9 rounded-lg px-3">
                            <Download className="size-3.5" />
                            {docxExportPreviewLoading ? '…' : t('templateDetail.actions.export')}
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleExportPdf}
                              disabled={exportLoading === 'pdf'}
                              className="h-9 rounded-lg px-3">
                              <Download className="size-3.5" />
                              {exportLoading === 'pdf' ? '…' : 'PDF'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleExportWord}
                              disabled={exportLoading === 'word'}
                              className="h-9 rounded-lg px-3">
                              <FileText className="size-3.5" />
                              {exportLoading === 'word' ? '…' : 'Word'}
                            </Button>
                          </>
                        ))}
                      {onClose && renderMode !== 'page' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onClose}
                          className="text-gray-400 hover:text-gray-600">
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto overscroll-contain">
                    {isArtifactPreview ? (
                      renderArtifactPreview()
                    ) : !CKEditorComponent || !ClassicEditorConstructor || !previewEditorConfig ? (
                      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
                        {t('variables.drawer.loadingPreview')}
                      </div>
                    ) : (
                      <CKEditorComponent
                        key={previewKey}
                        editor={ClassicEditorConstructor}
                        data={previewContent}
                        disabled={isPreviewEditorDisabled}
                        config={previewEditorConfig}
                        onReady={(editor) => {
                          previewSelectionCleanupRef.current?.();
                          previewClickCleanupRef.current?.();
                          mentionEditorCleanupRef.current?.();
                          editorRef.current = { editor };
                          syncPreviewEditorReadOnlyMode(editor);
                          previewClickCleanupRef.current = bindPreviewClickListener(editor);
                          attachFontSizeToolbarLabel(editor);
                          mentionEditorCleanupRef.current = registerMentionRichTextEditor(editor);
                          setPreviewEditorVersion((current) => current + 1);
                          syncSavedPreviewSelection(editor);

                          const syncPreviewSelection = () => {
                            syncSavedPreviewSelection(editor);
                          };

                          editor.model.document.selection.on('change:range', syncPreviewSelection);
                          previewSelectionCleanupRef.current = () => {
                            editor.model.document.selection.off('change:range', syncPreviewSelection);
                          };
                        }}
                        onFocus={(_event, editor) => {
                          setIsPreviewEditorFocused(true);
                          syncSavedPreviewSelection(editor);
                        }}
                        onBlur={() => setIsPreviewEditorFocused(false)}
                        onChange={(_event, editor) => {
                          const html = editor.getData();
                          syncSavedPreviewSelection(editor);
                          setPreviewContent(html);
                          if (isPreviewEditorFocused) {
                            onPreviewContentChange?.(html);
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTemplateSelector && (
        <TableTemplateSelector
          onSelectTemplate={(template) => handleSelectTemplate(showTemplateSelector, template)}
          onClose={() => setShowTemplateSelector(null)}
        />
      )}

      {showDocumentTemplateSelector && (
        <DocumentTemplateSelector
          onSelectTemplate={(template) => handleSelectDocumentTemplate(showDocumentTemplateSelector, template)}
          onClose={() => setShowDocumentTemplateSelector(null)}
        />
      )}

      {allowVariableInsertion && showVariableReplacePicker && variableCatalog && onReplaceVariable && (
        <VariablePickerDialog
          open
          catalog={variableCatalog}
          template_type={template_type}
          initialActiveKey={showVariableReplacePicker}
          title={t('variables.picker.replaceTitle')}
          description={t('variables.picker.replaceDescription')}
          confirmLabel={t('variables.picker.replaceConfirm')}
          multiSelect={false}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setShowVariableReplacePicker(null);
            }
          }}
          onSelect={handleReplaceVariable}
        />
      )}

      {allowVariableInsertion && showPreviewVariablePicker && variableCatalog && (
        <VariablePickerDialog
          open
          catalog={variableCatalog}
          template_type={template_type}
          title={t('variables.picker.title')}
          description={t('variables.picker.insertPreviewDescription')}
          confirmLabel={t('variables.picker.confirm')}
          onConfirmStart={handlePreviewVariablePickerConfirmStart}
          onOpenChange={handlePreviewVariablePickerOpenChange}
          onSelect={handleInsertPreviewVariable}
          onSelectMany={handleInsertPreviewVariables}
        />
      )}
    </>
  );
};
