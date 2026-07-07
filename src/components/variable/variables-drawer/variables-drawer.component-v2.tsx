'use client';

import type { ClassicEditor } from 'ckeditor5';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, GripVertical, Loader2, Save, Trash2, X } from 'lucide-react';
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
import { DocumentTemplateSelector } from '../../template';
import type { ToastProps } from '../../ui';
import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  DOCUMENT_TEMPLATE_WRAPPER_ATTR,
  TABLE_TEMPLATE_VARIABLE_NAMESPACE,
  buildTextSignature,
  buildTokenSet,
  createPreviewEditorConfig,
  exportToPdf,
  exportToWord,
  generateDocumentHtml,
  generateTableHtmlFromTableTemplate,
  loadEditorRuntime,
  getVariableAlias,
  getVariableDisplayLabel,
  FRAPPE_VARIABLE_INPUT_TYPES,
  isCheckVariableInputType,
  isLongTextVariableInputType,
  isSelectVariableInputType,
  isTableMatrixVariableInputType,
  normalizeVariableInputType,
  parseVariableName,
  registerMentionRichTextEditor,
  type DocumentTemplate,
  type TableTemplate,
  type VariableInputType,
  type VarTypes,
} from '../../../lib';
import { VariableFieldDropdown } from '../variable-field-dropdown';

type VariablesDrawerEditorRuntime = Awaited<ReturnType<typeof loadEditorRuntime>>;

const PREVIEW_CONTENT_UPDATE_DELAY_MS = 200;

const VARIABLE_INPUT_TYPE_LABELS: Partial<Record<VariableInputType, string>> = {
  TextInput: 'Văn bản',
  NumberInput: 'Số',
  DropdownList: 'Danh sách chọn',
  Checkbox: 'Ô chọn',
  Textarea: 'Văn bản nhiều dòng',
  ImageUrl: 'Hình ảnh',
  'Table matrix': 'Ma trận bảng',
  'Table template': 'Mẫu bảng',
  'Document template': 'Mẫu nội dung',
};

const VARIABLE_INPUT_TYPE_OPTIONS: VariableInputType[] = [
  ...FRAPPE_VARIABLE_INPUT_TYPES,
  'Table matrix',
  'Table template',
  'Document template',
];

const getVariableInputTypeLabel = (inputType: VariableInputType) => VARIABLE_INPUT_TYPE_LABELS[inputType] ?? inputType;

type TableTemplateHtmlCacheEntry = {
  template: TableTemplate;
  dependencySignature: string;
  html: string;
};

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
  readOnly?: boolean;
  simpleMode?: boolean;
  onTitleChange?: (varKey: string, title: string) => void;
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
  readOnly = false,
  simpleMode = false,
  onTitleChange,
}: IVariablesDrawerProps) => {
  const DEFAULT_SIDEBAR_WIDTH_PERCENT = 33.333;
  const MIN_SIDEBAR_WIDTH_PX = 320;
  const MIN_PREVIEW_WIDTH_PX = 560;

  const [isSaving, setIsSaving] = useState(false);
  const [previewContent, setPreviewContent] = useState(renderedHtml);
  const [showTemplateSelector, setShowTemplateSelector] = useState<string | null>(null);
  const [showDocumentTemplateSelector, setShowDocumentTemplateSelector] = useState<string | null>(null);
  const [editorRuntime, setEditorRuntime] = useState<VariablesDrawerEditorRuntime | null>(null);
  const [previewEditorConfig, setPreviewEditorConfig] = useState<Awaited<
    ReturnType<typeof createPreviewEditorConfig>
  > | null>(null);
  const [sidebarWidthPercent, setSidebarWidthPercent] = useState(DEFAULT_SIDEBAR_WIDTH_PERCENT);
  const editorRef = useRef<{ editor: ClassicEditor } | null>(null);
  const mentionEditorCleanupRef = useRef<(() => void) | null>(null);
  const drawerContentRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewEditorVersion, setPreviewEditorVersion] = useState(0);
  const varsLengthRef = useRef(varsInDoc.length);
  const tableTemplateHtmlCacheRef = useRef<Record<string, TableTemplateHtmlCacheEntry>>({});
  const variableCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingScrollVarKeyRef = useRef<string | null>(null);
  const [activeVarKey, setActiveVarKey] = useState<string | null>(null);
  const activeVarKeyTimeoutRef = useRef<number | null>(null);
  const highlightedAnchorRef = useRef<HTMLElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  // Refs for mutable state used in stable callbacks
  const varValuesRef = useRef(varValues);
  varValuesRef.current = varValues;
  const varTypesRef = useRef(varTypes);
  varTypesRef.current = varTypes;
  const previewContentRef = useRef(previewContent);
  previewContentRef.current = previewContent;

  useEffect(() => {
    return () => {
      mentionEditorCleanupRef.current?.();
      mentionEditorCleanupRef.current = null;
    };
  }, []);

  // Memoize parsed variable names to avoid regex parsing on every render
  const parsedVariables = useMemo(() => new Map(varsInDoc.map((k) => [k, parseVariableName(k)])), [varsInDoc]);

  // Group same-table DropdownList vars: only the first one per table is "primary",
  // the rest are "secondary" (hidden — auto-fill handles them when the primary is selected).
  const { secondaryVarKeys, groupedFieldsByPrimary } = useMemo(() => {
    const secondary = new Set<string>();
    const groupedFields = new Map<string, string[]>(); // primaryKey -> [secondary field labels]
    const seenTables = new Map<string, string>(); // table -> primaryKey

    for (const k of varsInDoc) {
      const parsed = parsedVariables.get(k);
      if (!parsed) continue;
      if (parsed.table === TABLE_TEMPLATE_VARIABLE_NAMESPACE || parsed.table === DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE) {
        continue;
      }
      const effectiveType = normalizeVariableInputType(varTypes[k] ?? 'Select');
      if (!isSelectVariableInputType(effectiveType)) continue;

      const existingPrimary = seenTables.get(parsed.table);
      if (existingPrimary !== undefined) {
        secondary.add(k);
        groupedFields.set(existingPrimary, [...(groupedFields.get(existingPrimary) ?? []), parsed.field]);
      } else {
        seenTables.set(parsed.table, k);
      }
    }

    return { secondaryVarKeys: secondary, groupedFieldsByPrimary: groupedFields };
  }, [varsInDoc, parsedVariables, varTypes]);

  useEffect(() => {
    if (!open) {
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
  }, [open]);

  useEffect(() => {
    if (!open) {
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
  }, [open]);

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
      return Math.min(48, Math.max(28, nextPercent));
    }

    const minPercent = (MIN_SIDEBAR_WIDTH_PX / containerWidth) * 100;
    const maxPercent = ((containerWidth - MIN_PREVIEW_WIDTH_PX) / containerWidth) * 100;
    const boundedMaxPercent = Math.min(55, Math.max(minPercent, maxPercent));

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
      let hasUpdates = false;
      varsInDoc.forEach((varKey) => {
        if (!varTypes[varKey]) {
          typeUpdates[varKey] = varKey.startsWith(`${TABLE_TEMPLATE_VARIABLE_NAMESPACE}.`)
            ? 'Table template'
            : varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)
              ? 'Document template'
              : 'Select';
          hasUpdates = true;
        }
      });
      if (hasUpdates) onVarTypesChange(typeUpdates);
    }
  }, [open, varsInDoc, varTypes, onVarTypesChange]);

  useEffect(() => {
    const nextPreviewContent = renderedHtmlHighlighted || renderedHtml;

    if (!open || previewContentRef.current.length === 0) {
      setPreviewContent(nextPreviewContent);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPreviewContent(nextPreviewContent);
    }, PREVIEW_CONTENT_UPDATE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, renderedHtmlHighlighted, renderedHtml]);

  const getPreviewEditableRoot = useCallback(() => {
    return editorRef.current?.editor?.ui.getEditableElement() as HTMLElement | null;
  }, []);

  const escapeSelectorValue = useCallback((value: string) => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/(["\\])/g, '\\$1');
  }, []);

  const findAnchorElement = useCallback(
    (root: HTMLElement, varKey: string) => {
      const escapedVarKey = escapeSelectorValue(varKey);
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(`[data-var-key="${escapedVarKey}"]`));

      if (nodes.length > 0) {
        const sorted = nodes.sort((a, b) => {
          const aOccurrence = Number(a.getAttribute('data-var-occurrence') ?? Number.MAX_SAFE_INTEGER);
          const bOccurrence = Number(b.getAttribute('data-var-occurrence') ?? Number.MAX_SAFE_INTEGER);
          return aOccurrence - bOccurrence;
        });
        return sorted[0] ?? null;
      }

      if (varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)) {
        const template_id = varKey.slice(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`.length);
        const escapedTemplateId = escapeSelectorValue(template_id);
        const docTemplateNode = root.querySelector<HTMLElement>(
          `[${DOCUMENT_TEMPLATE_WRAPPER_ATTR}="${escapedTemplateId}"]`,
        );
        if (docTemplateNode) return docTemplateNode;
      }

      const fallbackText = `{{${varKey}}}`;
      const emptyNodes = Array.from(root.querySelectorAll<HTMLElement>('.var-empty'));
      return emptyNodes.find((node) => node.textContent?.replace(/\s+/g, ' ').includes(fallbackText)) ?? null;
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

      const anchorElement = findAnchorElement(root, varKey);
      if (!anchorElement) return false;

      anchorElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      applyPreviewAnchorHighlight(anchorElement);
      return true;
    },
    [applyPreviewAnchorHighlight, findAnchorElement, getPreviewEditableRoot],
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

  const flashVariableCard = useCallback((varKey: string, timeoutMs = 350) => {
    setActiveVarKey(varKey);
    if (activeVarKeyTimeoutRef.current !== null) {
      window.clearTimeout(activeVarKeyTimeoutRef.current);
    }
    activeVarKeyTimeoutRef.current = window.setTimeout(() => {
      setActiveVarKey((current) => (current === varKey ? null : current));
      activeVarKeyTimeoutRef.current = null;
    }, timeoutMs);
  }, []);

  const focusVariableFromPreview = useCallback(
    (varKey: string) => {
      flashVariableCard(varKey, 500);
      const cardElement = variableCardRefs.current[varKey];
      cardElement?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    },
    [flashVariableCard],
  );

  const handleVariableCardClick = useCallback(
    (event: React.MouseEvent<HTMLElement>, varKey: string) => {
      if (event.button !== 0) return;
      if (shouldIgnoreVariableCardClick(event.target)) return;

      flashVariableCard(varKey);

      pendingScrollVarKeyRef.current = varKey;

      if (scrollPreviewToVariable(varKey)) {
        pendingScrollVarKeyRef.current = null;
        return;
      }

      retryScrollToVariable(varKey);
    },
    [flashVariableCard, retryScrollToVariable, scrollPreviewToVariable, shouldIgnoreVariableCardClick],
  );

  useEffect(() => {
    if (!open) {
      pendingScrollVarKeyRef.current = null;
      if (activeVarKeyTimeoutRef.current !== null) {
        window.clearTimeout(activeVarKeyTimeoutRef.current);
        activeVarKeyTimeoutRef.current = null;
      }
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
      if (activeVarKeyTimeoutRef.current !== null) {
        window.clearTimeout(activeVarKeyTimeoutRef.current);
      }
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      if (highlightedAnchorRef.current) {
        highlightedAnchorRef.current.classList.remove('preview-variable-target-highlight');
      }
      variableCardRefs.current = {};
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current?.editor;
    if (!editor || !open) return;

    const editableElement = editor.ui.getEditableElement() as HTMLElement | null;
    if (!editableElement) return;

    const handlePreviewMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const anchorElement = target.closest<HTMLElement>('[data-var-key]');
      const varKey = anchorElement?.getAttribute('data-var-key')?.trim();
      if (!varKey) return;

      focusVariableFromPreview(varKey);
    };

    editableElement.addEventListener('mousedown', handlePreviewMouseDown);
    return () => {
      editableElement.removeEventListener('mousedown', handlePreviewMouseDown);
    };
  }, [focusVariableFromPreview, open, previewEditorVersion]);

  useEffect(() => {
    const templateVarKeys = Object.keys(selectedTemplates);
    if (templateVarKeys.length === 0) return;

    const htmlUpdates = {} as Record<string, string>;
    let hasChanges = false;

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

      const newTableHtml = generateTableHtmlFromTableTemplate(template, varValues);
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

    if (hasChanges) {
      onVarValuesChange(htmlUpdates);
    }
  }, [selectedTemplates, varValues, onVarValuesChange]);

  // Re-generate document template HTML when values change
  useEffect(() => {
    const docVarKeys = Object.keys(selectedDocumentTemplates);
    if (docVarKeys.length === 0) return;

    const htmlUpdates = {} as Record<string, string>;
    let hasChanges = false;

    docVarKeys.forEach((varKey) => {
      const template = selectedDocumentTemplates[varKey];
      const vals = documentTemplateValues[varKey] ?? {};
      const newHtml = generateDocumentHtml(template, vals);

      if (varValues[varKey] !== newHtml) {
        htmlUpdates[varKey] = newHtml;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onVarValuesChange(htmlUpdates);
    }
  }, [selectedDocumentTemplates, documentTemplateValues, varValues, onVarValuesChange]);

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
      const syncedVarValues = syncTableMatrixEdits();
      await onSaveVariables(syncedVarValues);
      onShowToast({
        message: 'Lưu biến thành công',
        type: 'success',
      });
    } catch (error) {
      console.error(`❌ Lỗi lưu:`, error);
    } finally {
      setIsSaving(false);
    }
  }, [syncTableMatrixEdits, onSaveVariables, onShowToast]);

  const onClearAllVariables = useCallback(() => {
    const currentVarValues = varValuesRef.current;
    onVarValuesChange(Object.fromEntries(Object.keys(currentVarValues).map((k) => [k, ''])));
    onSelectedTemplatesChange(Object.fromEntries(Object.keys(selectedTemplates).map((k) => [k, null])));
    onSelectedDocumentTemplatesChange(Object.fromEntries(Object.keys(selectedDocumentTemplates).map((k) => [k, null])));
  }, [
    onVarValuesChange,
    onSelectedTemplatesChange,
    onSelectedDocumentTemplatesChange,
    selectedTemplates,
    selectedDocumentTemplates,
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

  const handleSelectTemplate = useCallback(
    (varKey: string, template: TableTemplate) => {
      onSelectedTemplatesChange({ [varKey]: template });
      setShowTemplateSelector(null);

      const tableHtml = generateTableHtmlFromTableTemplate(template, varValuesRef.current);
      onVarValuesChange({ [varKey]: tableHtml });
    },
    [onSelectedTemplatesChange, onVarValuesChange],
  );

  const handleSelectDocumentTemplate = useCallback(
    (varKey: string, template: DocumentTemplate) => {
      onSelectedDocumentTemplatesChange({ [varKey]: template });
      setShowDocumentTemplateSelector(null);

      const html = generateDocumentHtml(template, documentTemplateValues[varKey] ?? {});
      onVarValuesChange({ [varKey]: html });
    },
    [onSelectedDocumentTemplatesChange, onVarValuesChange, documentTemplateValues],
  );

  // Stable callbacks for VariableFieldDropdown to avoid re-creating closures per render
  const handleFieldTemplateChange = useCallback(
    (key: string, template: TableTemplate | null) => {
      if (!template) {
        onSelectedTemplatesChange({ [key]: null });
        onVarValuesChange({ [key]: '' });
      } else {
        onSelectedTemplatesChange({ [key]: template });
      }
    },
    [onSelectedTemplatesChange, onVarValuesChange],
  );

  const handleFieldDocTemplateChange = useCallback(
    (key: string, tpl: DocumentTemplate | null) => {
      if (!tpl) {
        onSelectedDocumentTemplatesChange({ [key]: null });
        onVarValuesChange({ [key]: '' });
      } else {
        onSelectedDocumentTemplatesChange({ [key]: tpl });
      }
    },
    [onSelectedDocumentTemplatesChange, onVarValuesChange],
  );

  const handleExportPdf = useCallback(async () => {
    try {
      await exportToPdf(previewContentRef.current, 'preview.pdf');
      onShowToast({
        message: 'Xuất PDF thành công!',
        type: 'success',
      });
    } catch (error: any) {
      console.error('Xuất PDF thất bại:', error);
      onShowToast({
        message: `✕ Xuất PDF thất bại: ${error.message}`,
        type: 'error',
      });
    }
  }, [onShowToast]);

  const handleExportWord = useCallback(() => {
    exportToWord(previewContentRef.current, 'preview.docx');
  }, []);

  const containerClassName =
    renderMode === 'page'
      ? 'flex min-h-0 flex-1 flex-col'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';

  const contentClassName =
    renderMode === 'page'
      ? 'flex min-h-0 flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm'
      : 'flex h-[99vh] w-[99vw] overflow-hidden rounded-lg bg-white shadow-xl';

  return (
    <>
      {open && (
        <div className={containerClassName} onClick={renderMode === 'modal' ? onClose : undefined}>
          <div ref={drawerContentRef} className={contentClassName} onClick={(e) => e.stopPropagation()}>
            <div className="flex h-full min-w-0 overflow-hidden bg-white overscroll-none">
              <div
                className="flex min-w-0 shrink-0 flex-col overflow-hidden bg-white overscroll-none"
                style={{
                  width: `${sidebarWidthPercent}%`,
                  minWidth: `${MIN_SIDEBAR_WIDTH_PX}px`,
                }}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#002147]">Biến</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {varsInDoc.length}
                    </span>
                  </div>
                  {readOnly && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                      🔒 Chỉ xem
                    </span>
                  )}
                </div>

                {/* Variables list */}
                <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3">
                  {varsInDoc.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      Chưa tìm thấy biến nào.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {varsInDoc.map((k) => {
                        if (secondaryVarKeys.has(k)) return null;
                        const parsed = parsedVariables.get(k);
                        if (parsed) {
                          const autoFillFields = groupedFieldsByPrimary.get(k);
                          return (
                            <div
                              key={k}
                              ref={(element) => {
                                variableCardRefs.current[k] = element;
                              }}
                              className={`relative min-w-0 rounded-lg border transition-all duration-200 ${
                                activeVarKey === k
                                  ? 'border-blue-400 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
                                  : 'border-transparent'
                              }`}
                              onMouseDown={(event) => handleVariableCardClick(event, k)}>
                              <VariableFieldDropdown
                                varKey={k}
                                table={parsed.table}
                                field={parsed.field}
                                varValues={varValues}
                                onVarValuesChange={onVarValuesChange}
                                varsInDoc={varsInDoc}
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
                                title={varTitles[k]}
                                onTitleChange={onTitleChange}
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
                                      + {getVariableAlias(parsed.table, f)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {onRemoveVariable && !readOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onRemoveVariable(k)}
                                  title="Xóa biến"
                                  className="absolute right-1 top-1 h-5 w-5 text-gray-300 hover:text-red-400">
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          );
                        }

                        const varType = normalizeVariableInputType(varTypes[k] || 'Data');
                        const current = varValues[k] ?? '';
                        const options: string[] = [];
                        const displayLabel = getVariableDisplayLabel(k);

                        return (
                          <div
                            key={k}
                            ref={(element) => {
                              variableCardRefs.current[k] = element;
                            }}
                            className={`min-w-0 rounded-lg border p-3 transition-all duration-200 ${
                              activeVarKey === k
                                ? 'border-blue-400 bg-blue-50 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]'
                                : 'border-gray-200'
                            }`}
                            style={{ opacity: readOnly ? 0.7 : 1 }}
                            onMouseDown={(event) => handleVariableCardClick(event, k)}>
                            <div className="mb-2 flex items-center gap-2">
                              <label className="flex-1 text-xs font-medium text-gray-700">
                                <code className="rounded bg-gray-100 px-1">{`{{${k}}}`}</code>
                                {displayLabel !== k && (
                                  <span className="ml-1 font-medium text-slate-500">- {displayLabel}</span>
                                )}
                              </label>
                              {onRemoveVariable && !readOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onRemoveVariable(k)}
                                  className="h-5 w-5 text-gray-300 hover:text-red-400">
                                  <X className="size-3" />
                                </Button>
                              )}
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
                                      {getVariableInputTypeLabel(type)}
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
                                placeholder="Tìm và chọn giá trị..."
                                searchPlaceholder="Tìm giá trị..."
                                emptyMessage="Không tìm thấy giá trị phù hợp."
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
                                placeholder="Nhập văn bản nhiều dòng..."
                                rows={4}
                                className="w-full"
                              />
                            ) : (
                              <Input
                                type="text"
                                value={current}
                                readOnly={readOnly}
                                onChange={(e) => onVarValuesChange({ [k]: e.target.value })}
                                placeholder="Nhập giá trị..."
                                className="w-full"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {varsInDoc.length > 0 && (
                  <div className="flex gap-2 border-t border-gray-200 p-3">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleSave}
                      disabled={isSaving || readOnly}>
                      {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      {isSaving ? 'Đang lưu…' : 'Lưu'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onClearAllVariables}
                      disabled={isSaving || readOnly}
                      className="border-red-200 text-red-500 hover:bg-red-50">
                      <Trash2 className="size-3.5" />
                      Xóa tất cả
                    </Button>
                  </div>
                )}
              </div>

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Đổi kích thước bảng biến"
                onPointerDown={handleResizeStart}
                className="relative z-20 w-3 shrink-0 cursor-col-resize border-x border-slate-200 bg-slate-100/90 transition-colors hover:bg-slate-200">
                <div className="absolute left-1/2 top-1/2 flex h-8 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm">
                  <GripVertical className="size-3 text-slate-500" />
                </div>
              </div>

              {/* RIGHT: Live preview */}
              <div
                className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white overscroll-none"
                style={{ minWidth: `${MIN_PREVIEW_WIDTH_PX}px` }}>
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                  <span className="text-sm font-semibold text-gray-700">Xem trước trực tiếp</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exportLoading === 'pdf'}>
                      <Download className="size-3.5" />
                      {exportLoading === 'pdf' ? '…' : 'PDF'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportWord} disabled={exportLoading === 'word'}>
                      <FileText className="size-3.5" />
                      {exportLoading === 'word' ? '…' : 'Word'}
                    </Button>
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
                  {!CKEditorComponent || !ClassicEditorConstructor || !previewEditorConfig ? (
                    <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-gray-500">
                      Đang tải trình xem trước...
                    </div>
                  ) : (
                    <CKEditorComponent
                      key={previewKey}
                      editor={ClassicEditorConstructor}
                      data={previewContent}
                      disabled={readOnly}
                      config={previewEditorConfig}
                      onReady={(editor) => {
                        editorRef.current = { editor };
                        mentionEditorCleanupRef.current?.();
                        mentionEditorCleanupRef.current = registerMentionRichTextEditor(editor);
                        setPreviewEditorVersion((current) => current + 1);
                      }}
                      onChange={(_event, editor) => setPreviewContent(editor.getData())}
                    />
                  )}
                </div>
              </div>
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
    </>
  );
};
