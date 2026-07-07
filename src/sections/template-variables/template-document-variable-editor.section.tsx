import { useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ChevronDown,
  Code2,
  Database,
  FileCode2,
  FileText,
  Home,
  Loader2,
  Save,
  SlidersHorizontal,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Input,
  SearchableMultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'reactjs-platform/ui';
import {
  createTemplateVariableAPI,
  getMetadataByKeyAPI,
  getTemplateEditorMetaAPI,
  getTemplateVariableByIdAPI,
  updateTemplateVariableAPI,
  type ITemplateVariableDefinition,
  type MetadataOption,
} from 'api';
import { DocumentTemplateEditor } from '../../components/template';
import { useTranslation } from '../../i18n';
import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  createEditorContentKey,
  createPreviewEditorConfig,
  generateDocumentHtml,
  isDocumentTemplateConfig,
  loadEditorRuntime,
  normalizeEditorMeta,
  registerMentionRichTextEditor,
  attachFontSizeToolbarLabel,
  type DocumentField,
  type DocumentListItem,
  type DocumentSection,
  type DocumentTemplate,
  type EditorRuntime,
  type ExactSchemaCatalog,
} from '../../lib';
import type { ITemplateVariableEditorSectionProps, ITemplateVariableFormState } from './template-variables.type';

const VARIABLE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/;

type TDocumentVariableEditorCopy = {
  defaultName: string;
  defaultDescription: string;
  defaultSectionTitle: string;
};

const DEFAULT_DOCUMENT_VARIABLE_EDITOR_COPY: TDocumentVariableEditorCopy = {
  defaultName: 'Mẫu nội dung mới',
  defaultDescription: 'Mẫu nội dung được cấu hình từ quản lý biến mẫu.',
  defaultSectionTitle: 'Nội dung',
};

type TDocumentVariableInitialRenderMode = 'structured' | 'raw_html';
type TRawHtmlEditorConfig = Awaited<ReturnType<typeof createPreviewEditorConfig>>;
type TRawHtmlEditorMode = 'ckeditor' | 'docx';

const RAW_HTML_LAYOUT_TABLE_ATTR = 'data-template-layout-table';
const RAW_HTML_LAYOUT_CELL_ATTR = 'data-template-layout-cell';
const RAW_HTML_LAYOUT_WIDTH_STYLE = '--template-layout-table-width';

const LazyDocxDocumentEditor = lazy(() =>
  import('../../components/template/docx-document-editor').then((module) => ({
    default: module.DocxDocumentEditor,
  })),
);

const sanitizeTemplateTypes = (templateTypes: string[]) => templateTypes.filter(Boolean);
const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const normalizeDocumentTemplateSlug = (value: string) =>
  value
    .replace(new RegExp(`^${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}\\.`), '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'new_content';

const getDocumentTemplateIdFromKey = (key: string, label: string) =>
  normalizeDocumentTemplateSlug(key || label || 'new_content');

const getDocumentTemplateFromUiConfig = (uiConfig?: Record<string, unknown> | null) => {
  const documentTemplate = uiConfig?.document_template;
  return isDocumentTemplateConfig(documentTemplate) ? documentTemplate : null;
};

const createDefaultDocumentTemplate = (
  formState: Pick<ITemplateVariableFormState, 'key' | 'label' | 'description'>,
  copy: TDocumentVariableEditorCopy = DEFAULT_DOCUMENT_VARIABLE_EDITOR_COPY,
  initialRenderMode: TDocumentVariableInitialRenderMode = 'structured',
): DocumentTemplate => {
  const template_id = getDocumentTemplateIdFromKey(formState.key, formState.label);

  const template: DocumentTemplate = {
    id: template_id,
    name: formState.label || copy.defaultName,
    description: formState.description || copy.defaultDescription,
    type: 'document',
    primary_table: '',
    trigger_field: '',
    show_trigger_selector: false,
    lock_structure: true,
    allow_section_management: false,
    join_conditions: [],
    sections: [
      {
        id: 'sec_main',
        title: copy.defaultSectionTitle,
        fields: [
          {
            id: 'content',
            label: '',
            type: 'text',
            value: '',
          },
        ],
      },
    ],
  };

  if (initialRenderMode === 'raw_html') {
    return {
      ...template,
      render_mode: 'raw_html',
      static_html: '',
      sections: [],
      lock_structure: true,
      allow_section_management: false,
      is_read_only: false,
    };
  }

  return template;
};

const createEmptyDocumentForm = (
  copy: TDocumentVariableEditorCopy = DEFAULT_DOCUMENT_VARIABLE_EDITOR_COPY,
  initialRenderMode: TDocumentVariableInitialRenderMode = 'structured',
): ITemplateVariableFormState => {
  const form: ITemplateVariableFormState = {
    key: `${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.new_content`,
    label: copy.defaultName,
    description: '',
    template_types: [],
    variable_type: 'DOCUMENT_VARIABLE',
    input_type: 'HTML Editor',
    default_value: '',
    data_source: null,
    ui_config: null,
  };

  const documentTemplate = createDefaultDocumentTemplate(form, copy, initialRenderMode);
  return {
    ...form,
    ui_config: {
      document_template: documentTemplate,
    },
  };
};

const normalizeDefinitionToDocumentForm = (
  definition: ITemplateVariableDefinition,
  copy: TDocumentVariableEditorCopy = DEFAULT_DOCUMENT_VARIABLE_EDITOR_COPY,
): ITemplateVariableFormState => {
  const form: ITemplateVariableFormState = {
    id: definition.id,
    key: definition.key,
    label: definition.label,
    description: definition.description ?? '',
    template_types: definition.template_types ?? [],
    variable_type: 'DOCUMENT_VARIABLE',
    input_type: 'HTML Editor',
    default_value: '',
    data_source: null,
    ui_config: definition.ui_config ?? null,
  };

  return {
    ...form,
    ui_config: {
      ...(definition.ui_config ?? {}),
      document_template:
        getDocumentTemplateFromUiConfig(definition.ui_config) ?? createDefaultDocumentTemplate(form, copy),
    },
  };
};

const updateDocumentTemplateIdentity = (
  template: DocumentTemplate,
  form: Pick<ITemplateVariableFormState, 'key' | 'label' | 'description'>,
): DocumentTemplate => ({
  ...template,
  id: getDocumentTemplateIdFromKey(form.key, form.label),
  name: form.label || template.name,
  description: form.description,
});

const hasNoBorderStyle = (value?: string | null) =>
  Boolean(value && /(?:^|;)\s*border(?:-[a-z-]+)?\s*:\s*(?:0|none)\b/i.test(value));

const isRawHtmlLayoutTable = (table: HTMLTableElement) => {
  if (table.getAttribute('border') === '0' || hasNoBorderStyle(table.getAttribute('style'))) {
    return true;
  }

  const cells = Array.from(table.querySelectorAll<HTMLElement>('th,td'));
  return cells.length > 0 && cells.every((cell) => hasNoBorderStyle(cell.getAttribute('style')));
};

const getRawHtmlTableWidth = (table: HTMLTableElement) =>
  table.style.getPropertyValue('width') || table.getAttribute('width') || 'auto';

const decorateRawHtmlForEditor = (html: string) => {
  if (!html.trim() || typeof DOMParser === 'undefined') {
    return html;
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  document.body.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (!isRawHtmlLayoutTable(table)) return;

    table.setAttribute(RAW_HTML_LAYOUT_TABLE_ATTR, 'true');
    table.style.setProperty(RAW_HTML_LAYOUT_WIDTH_STYLE, getRawHtmlTableWidth(table));

    table.querySelectorAll<HTMLElement>('th,td').forEach((cell) => {
      cell.setAttribute(RAW_HTML_LAYOUT_CELL_ATTR, 'true');
    });
  });

  return document.body.innerHTML;
};

const stripRawHtmlEditorMarkers = (html: string) => {
  if (!html.trim() || typeof DOMParser === 'undefined') {
    return html;
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  document.body
    .querySelectorAll<HTMLElement>(`[${RAW_HTML_LAYOUT_TABLE_ATTR}],[${RAW_HTML_LAYOUT_CELL_ATTR}]`)
    .forEach((element) => {
      element.removeAttribute(RAW_HTML_LAYOUT_TABLE_ATTR);
      element.removeAttribute(RAW_HTML_LAYOUT_CELL_ATTR);
      element.style.removeProperty(RAW_HTML_LAYOUT_WIDTH_STYLE);
      if (!element.getAttribute('style')?.trim()) {
        element.removeAttribute('style');
      }
    });

  return document.body.innerHTML;
};

const collectSourceTablesFromDocumentTemplate = (value: unknown, tables = new Set<string>()) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceTablesFromDocumentTemplate(item, tables));
    return tables;
  }

  if (!value || typeof value !== 'object') {
    return tables;
  }

  const record = value as Record<string, unknown>;
  [record.table, record.reference_table, record.primary_table, record.from_table, record.to_table].forEach(
    (candidate) => {
      if (typeof candidate === 'string' && candidate.trim()) {
        tables.add(candidate.trim());
      }
    },
  );

  if (typeof record.table_field === 'string') {
    const [sourceTable] = record.table_field.split('.');
    if (sourceTable?.trim()) {
      tables.add(sourceTable.trim());
    }
  }

  Object.values(record).forEach((nestedValue) => collectSourceTablesFromDocumentTemplate(nestedValue, tables));
  return tables;
};

const extractDocumentTemplateValues = (template: DocumentTemplate) => {
  const values: Record<string, string> = {};

  const readListItemValue = (item: DocumentListItem, key: string) => {
    if (typeof item.value === 'string') {
      values[key] = item.value;
    }
    item.sub_items?.forEach((subItem, subIndex) =>
      readListItemValue(subItem, subItem.table_field || `${key}_sub_${subIndex}`),
    );
  };

  const walkSections = (sections: DocumentSection[]) => {
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === 'list') {
          field.items.forEach((item, index) => readListItemValue(item, item.table_field || `${field.id}_${index}`));
          return;
        }

        if ('value' in field && typeof field.value === 'string') {
          values[field.table_field || field.id] = field.value;
        }
      });
      if (section.children) {
        walkSections(section.children);
      }
    });
  };

  walkSections(template.sections);
  return values;
};

const applyDocumentTemplateValues = (template: DocumentTemplate, values: Record<string, string>) => {
  const next = structuredClone(template);

  const writeListItemValue = (item: DocumentListItem, key: string) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      item.value = values[key];
    }
    item.sub_items?.forEach((subItem, subIndex) =>
      writeListItemValue(subItem, subItem.table_field || `${key}_sub_${subIndex}`),
    );
  };

  const walkSections = (sections: DocumentSection[]) => {
    sections.forEach((section) => {
      section.fields.forEach((field: DocumentField) => {
        if (field.type === 'list') {
          field.items.forEach((item, index) => writeListItemValue(item, item.table_field || `${field.id}_${index}`));
          return;
        }

        const key = field.table_field || field.id;
        if (Object.prototype.hasOwnProperty.call(values, key) && 'value' in field) {
          field.value = values[key];
        }
      });
      if (section.children) {
        walkSections(section.children);
      }
    });
  };

  walkSections(next.sections);
  return next;
};

export const TemplateDocumentVariableEditorSection = ({
  variableId,
  initialRenderMode = 'structured',
}: ITemplateVariableEditorSectionProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const documentCopy = useMemo<TDocumentVariableEditorCopy>(
    () => ({
      defaultName: t('templateDocumentVariableEditor.defaultName'),
      defaultDescription: t('templateDocumentVariableEditor.defaultDescription'),
      defaultSectionTitle: t('templateDocumentVariableEditor.defaultSectionTitle'),
    }),
    [t],
  );
  const [schemaCatalog, setSchemaCatalog] = useState<ExactSchemaCatalog>({});
  const [templateTypeOptions, setTemplateTypeOptions] = useState<MetadataOption[]>([]);
  const [form, setForm] = useState<ITemplateVariableFormState>(() =>
    createEmptyDocumentForm(documentCopy, initialRenderMode),
  );
  const [documentTemplate, setDocumentTemplate] = useState<DocumentTemplate>(() => {
    const emptyForm = createEmptyDocumentForm(documentCopy, initialRenderMode);
    return (
      getDocumentTemplateFromUiConfig(emptyForm.ui_config) ?? createDefaultDocumentTemplate(emptyForm, documentCopy)
    );
  });
  const [documentValues, setDocumentValues] = useState<Record<string, string>>({});
  const [rawHtmlEditorRuntime, setRawHtmlEditorRuntime] = useState<EditorRuntime | null>(null);
  const [rawHtmlEditorConfig, setRawHtmlEditorConfig] = useState<TRawHtmlEditorConfig | null>(null);
  const [rawHtmlEditorMode, setRawHtmlEditorMode] = useState<TRawHtmlEditorMode>('ckeditor');
  const mentionEditorCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      mentionEditorCleanupRef.current?.();
      mentionEditorCleanupRef.current = null;
    };
  }, []);
  const [loading, setLoading] = useState(Boolean(variableId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [showDataBinding, setShowDataBinding] = useState(false);

  const selectedTemplateTypes = useMemo(() => sanitizeTemplateTypes(form.template_types), [form.template_types]);
  const selectedTemplateTypesKey = useMemo(() => selectedTemplateTypes.join('|'), [selectedTemplateTypes]);
  const pageTitle = form.id
    ? t('templateDocumentVariableEditor.editTitle')
    : t('templateDocumentVariableEditor.createTitle');
  const tableNames = useMemo(() => Object.keys(schemaCatalog).sort(), [schemaCatalog]);
  const triggerFields = useMemo(
    () => (documentTemplate.primary_table ? (schemaCatalog[documentTemplate.primary_table] ?? []) : []),
    [documentTemplate.primary_table, schemaCatalog],
  );
  const templateTypeLabelMap = useMemo(
    () => new Map(templateTypeOptions.map((option) => [option.value, option.label])),
    [templateTypeOptions],
  );
  const templateTypeOptionsWithFallback = useMemo(
    () =>
      selectedTemplateTypes
        .filter((value) => !templateTypeLabelMap.has(value))
        .map((value) => ({ value, label: value }))
        .concat(templateTypeOptions),
    [selectedTemplateTypes, templateTypeLabelMap, templateTypeOptions],
  );
  const editableDocumentTemplate = useMemo(
    () => ({
      ...documentTemplate,
      lock_structure: false,
      allow_section_management: false,
    }),
    [documentTemplate],
  );
  const previewTemplate = useMemo(
    () => applyDocumentTemplateValues(documentTemplate, documentValues),
    [documentTemplate, documentValues],
  );
  const previewHtml = useMemo(
    () => generateDocumentHtml(previewTemplate, documentValues),
    [previewTemplate, documentValues],
  );
  const rawHtmlDocxSourceKey = useMemo(
    () => ['document-variable-docx', documentTemplate.id, createEditorContentKey(previewHtml)].join(':'),
    [documentTemplate.id, previewHtml],
  );
  const rawHtmlEditorData = useMemo(
    () => decorateRawHtmlForEditor(documentTemplate.static_html || '<p></p>'),
    [documentTemplate.static_html],
  );
  const RawCKEditorComponent = rawHtmlEditorRuntime?.CKEditor;
  const RawClassicEditorConstructor = rawHtmlEditorRuntime?.ClassicEditor;

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getTemplateEditorMetaAPI(), getMetadataByKeyAPI<MetadataOption[]>('TEMPLATE_TYPE')])
      .then(([meta, templateTypes]) => {
        if (cancelled) return;
        const normalizedMeta = normalizeEditorMeta(meta);
        setSchemaCatalog(normalizedMeta.source_schema_field_catalog);
        setTemplateTypeOptions(templateTypes.meta_values ?? []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(getErrorMessage(loadError));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (documentTemplate.render_mode !== 'raw_html') {
      return;
    }

    let cancelled = false;
    setRawHtmlEditorConfig(null);

    void Promise.all([
      loadEditorRuntime(),
      createPreviewEditorConfig(schemaCatalog, selectedTemplateTypes[0] ?? null, {
        includeSourceEditing: true,
        allowRawHtmlLayout: true,
      }),
    ])
      .then(([runtime, config]) => {
        if (cancelled) return;
        setRawHtmlEditorRuntime(runtime);
        setRawHtmlEditorConfig(config);
      })
      .catch((editorError) => {
        if (cancelled) return;
        setError(getErrorMessage(editorError));
      });

    return () => {
      cancelled = true;
    };
  }, [documentTemplate.render_mode, schemaCatalog, selectedTemplateTypes, selectedTemplateTypesKey]);

  useEffect(() => {
    if (!variableId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getTemplateVariableByIdAPI(variableId)
      .then((definition) => {
        if (cancelled) return;
        if (definition.variable_type !== 'DOCUMENT_VARIABLE') {
          setError(t('templateDocumentVariableEditor.errors.documentOnly'));
          return;
        }

        const nextForm = normalizeDefinitionToDocumentForm(definition, documentCopy);
        const nextTemplate =
          getDocumentTemplateFromUiConfig(nextForm.ui_config) ?? createDefaultDocumentTemplate(nextForm, documentCopy);
        setForm(nextForm);
        setDocumentTemplate(nextTemplate);
        setDocumentValues(extractDocumentTemplateValues(nextTemplate));
        setShowDataBinding(
          Boolean(
            nextTemplate.primary_table || nextTemplate.trigger_field || nextTemplate.show_trigger_selector === true,
          ),
        );
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentCopy, t, variableId]);

  const handleFormChange = (patch: Partial<ITemplateVariableFormState>) => {
    setForm((current) => {
      const nextForm = {
        ...current,
        ...patch,
      };
      setDocumentTemplate((currentTemplate) => updateDocumentTemplateIdentity(currentTemplate, nextForm));
      return nextForm;
    });
  };

  const handleDocumentTemplatePatch = (patch: Partial<DocumentTemplate>) => {
    setDocumentTemplate((current) => {
      const next = {
        ...current,
        ...patch,
      };

      if (patch.primary_table && !schemaCatalog[patch.primary_table]?.includes(next.trigger_field)) {
        next.trigger_field = '';
      }

      return next;
    });
  };

  const validateForm = (template: DocumentTemplate = documentTemplate) => {
    const key = form.key.trim();
    if (!VARIABLE_KEY_PATTERN.test(key)) {
      return t('templateDocumentVariableEditor.errors.invalidKey', {
        namespace: DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
      });
    }
    if (!key.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)) {
      return t('templateDocumentVariableEditor.errors.wrongPrefix', {
        namespace: DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
      });
    }
    if (!form.label.trim()) {
      return t('templateDocumentVariableEditor.errors.missingLabel');
    }
    if (selectedTemplateTypes.length === 0) {
      return t('templateDocumentVariableEditor.errors.missingTemplateType');
    }
    if (template.render_mode === 'raw_html') {
      if (!template.static_html?.trim()) {
        return t('templateDocumentVariableEditor.errors.missingHtml');
      }
      return null;
    }
    if (template.sections.length === 0) {
      return t('templateDocumentVariableEditor.errors.missingSection');
    }
    return null;
  };

  const buildDocumentTemplateForSave = (template: DocumentTemplate = documentTemplate) => {
    const withValues = applyDocumentTemplateValues(updateDocumentTemplateIdentity(template, form), documentValues);
    if (withValues.render_mode === 'raw_html') {
      return {
        ...withValues,
        sections: [],
      };
    }

    const structuredTemplate = {
      ...withValues,
      render_mode: undefined,
      static_html: undefined,
    };
    return JSON.parse(JSON.stringify(structuredTemplate)) as DocumentTemplate;
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const validationError = validateForm(documentTemplate);
      if (validationError) {
        setError(validationError);
        return;
      }

      const documentTemplateForSave = buildDocumentTemplateForSave(documentTemplate);
      const sourceTables = Array.from(collectSourceTablesFromDocumentTemplate(documentTemplateForSave)).sort();
      const payload = {
        key: form.key.trim(),
        label: form.label.trim(),
        description: form.description.trim() || null,
        template_types: selectedTemplateTypes,
        variable_type: 'DOCUMENT_VARIABLE' as const,
        input_type: 'HTML Editor' as const,
        default_value: null,
        data_source: null,
        ui_config: {
          ...(form.ui_config ?? {}),
          source_template_id: documentTemplateForSave.id,
          source_tables: sourceTables,
          document_template: documentTemplateForSave,
        },
      };

      const saved = form.id
        ? await updateTemplateVariableAPI(form.id, payload)
        : await createTemplateVariableAPI(payload);

      const nextForm = normalizeDefinitionToDocumentForm(saved, documentCopy);
      const nextTemplate =
        getDocumentTemplateFromUiConfig(nextForm.ui_config) ?? createDefaultDocumentTemplate(nextForm, documentCopy);
      setForm(nextForm);
      setDocumentTemplate(nextTemplate);
      setDocumentValues(extractDocumentTemplateValues(nextTemplate));

      if (!form.id) {
        await navigate({
          to: '/template-variables/$id',
          params: { id: saved.id },
          search: { variable_type: 'DOCUMENT_VARIABLE' },
        });
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm">
            <span className="flex items-center gap-1 text-amber-600">
              <Home className="size-3.5" />
              <span className="font-medium">{t('templateDocumentVariableEditor.documentManagement')}</span>
            </span>
            <span className="text-gray-400">›</span>
            <button
              type="button"
              onClick={() => navigate({ to: '/template-variables' })}
              className="font-medium text-slate-500 hover:text-[#0B2559]">
              {t('templateDocumentVariableEditor.templateVariables')}
            </button>
            <span className="text-gray-400">›</span>
            <button
              type="button"
              onClick={() => navigate({ to: '/template-variables/documents' })}
              className="font-medium text-slate-500 hover:text-[#0B2559]">
              {t('templateDocumentVariableEditor.documentVariables')}
            </button>
            <span className="text-gray-400">›</span>
            <span className="text-gray-500">{pageTitle}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: '/template-variables/documents' })}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#0B2559]">
            <ArrowLeft className="size-4" />
            {t('templateDocumentVariableEditor.backToList')}
          </button>
          <div className="text-3xl font-bold text-[#0B2559]">{pageTitle}</div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            {t('templateDocumentVariableEditor.helpText')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setShowJson((current) => !current)}>
            <Code2 className="size-4" />
            {showJson ? t('templateDocumentVariableEditor.hideJson') : t('templateDocumentVariableEditor.showJson')}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? t('templateDocumentVariableEditor.saving') : t('templateDocumentVariableEditor.save')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Database className="size-4 text-[#174A86]" />
          {t('templateDocumentVariableEditor.infoTitle')}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              {t('templateDocumentVariableEditor.variableKey')}
            </span>
            <Input
              value={form.key}
              onChange={(event) => handleFormChange({ key: event.target.value })}
              placeholder="document_template.program_objectives_po_section"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">{t('templateDocumentVariableEditor.label')}</span>
            <Input
              value={form.label}
              onChange={(event) => handleFormChange({ label: event.target.value })}
              placeholder={t('templateDocumentVariableEditor.labelPlaceholder')}
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              {t('templateDocumentVariableEditor.templateTypes')}
            </span>
            <SearchableMultiSelect
              value={selectedTemplateTypes}
              options={templateTypeOptionsWithFallback}
              placeholder={t('templateDocumentVariableEditor.chooseTemplateTypes')}
              searchPlaceholder={t('templateDocumentVariableEditor.searchTemplateTypes')}
              emptyMessage={t('templateDocumentVariableEditor.noTemplateTypes')}
              enableSelectAll
              selectAllLabel={t('templateDocumentVariableEditor.allTemplateTypes')}
              maxHeight="280px"
              maxDisplay={4}
              onValueChange={(values) => handleFormChange({ template_types: values })}
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">
              {t('templateDocumentVariableEditor.description')}
            </span>
            <Textarea
              value={form.description}
              onChange={(event) => handleFormChange({ description: event.target.value })}
              rows={2}
              placeholder={t('templateDocumentVariableEditor.descriptionPlaceholder')}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileText className="size-4 text-[#174A86]" />
          {t('templateDocumentVariableEditor.contentConfig')}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">{t('templateDocumentVariableEditor.renderMode')}</span>
            <Select
              value={documentTemplate.render_mode === 'raw_html' ? 'raw_html' : 'structured'}
              onValueChange={(value) => {
                handleDocumentTemplatePatch(
                  value === 'raw_html'
                    ? { render_mode: 'raw_html', static_html: documentTemplate.static_html ?? previewHtml }
                    : { render_mode: undefined, static_html: undefined },
                );
              }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="structured">{t('templateDocumentVariableEditor.structuredSections')}</SelectItem>
                <SelectItem value="raw_html">{t('templateDocumentVariableEditor.rawHtml')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={documentTemplate.lock_structure === true}
              onChange={(event) => handleDocumentTemplatePatch({ lock_structure: event.target.checked })}
            />
            {t('templateDocumentVariableEditor.lockStructure')}
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowDataBinding((current) => !current)}
          className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-[#174A86]" />
            {t('templateDocumentVariableEditor.advancedDataBinding')}
          </span>
          <ChevronDown className={`size-4 transition-transform ${showDataBinding ? 'rotate-180' : ''}`} />
        </button>
        {showDataBinding && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-3 text-sm leading-6 text-slate-500">
              {t('templateDocumentVariableEditor.advancedDataBindingHelp')}
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={documentTemplate.show_trigger_selector === true}
                  onChange={(event) => handleDocumentTemplatePatch({ show_trigger_selector: event.target.checked })}
                />
                {t('templateDocumentVariableEditor.enableTriggerSelector')}
              </label>
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  {t('templateDocumentVariableEditor.primarySourceTable')}
                </span>
                <Select
                  value={documentTemplate.primary_table || undefined}
                  onValueChange={(primary_table) => handleDocumentTemplatePatch({ primary_table })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('templateDocumentVariableEditor.noDataSource')} />
                  </SelectTrigger>
                  <SelectContent>
                    {tableNames.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  {t('templateDocumentVariableEditor.triggerField')}
                </span>
                <Select
                  value={documentTemplate.trigger_field || undefined}
                  disabled={!documentTemplate.primary_table}
                  onValueChange={(trigger_field) => handleDocumentTemplatePatch({ trigger_field })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('templateDocumentVariableEditor.noTriggerField')} />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {showJson && (
        <pre className="mb-4 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(
            {
              key: form.key,
              label: form.label,
              template_types: selectedTemplateTypes,
              variable_type: 'DOCUMENT_VARIABLE',
              input_type: 'HTML Editor',
              ui_config: {
                document_template: buildDocumentTemplateForSave(),
              },
            },
            null,
            2,
          )}
        </pre>
      )}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {t('templateDocumentVariableEditor.loading')}
        </div>
      ) : documentTemplate.render_mode === 'raw_html' ? (
        <div className="flex min-h-[720px] xl:h-[calc(100vh-12rem)]">
          <div className="flex h-full min-h-[720px] w-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {t('templateDocumentVariableEditor.htmlContent')}
                </div>
                <div className="mt-1 text-xs text-slate-500">{t('templateDocumentVariableEditor.rawEditorHelp')}</div>
              </div>
              <div className="flex rounded-lg bg-slate-100 p-1">
                <Button
                  type="button"
                  variant={rawHtmlEditorMode === 'ckeditor' ? 'outline' : 'ghost'}
                  className={rawHtmlEditorMode === 'ckeditor' ? 'bg-white text-[#0B2559]' : 'text-slate-600'}
                  onClick={() => setRawHtmlEditorMode('ckeditor')}>
                  <FileCode2 className="size-4" />
                  {t('templateDocumentVariableEditor.ckeditor')}
                </Button>
                <Button
                  type="button"
                  variant={rawHtmlEditorMode === 'docx' ? 'outline' : 'ghost'}
                  className={rawHtmlEditorMode === 'docx' ? 'bg-white text-[#0B2559]' : 'text-slate-600'}
                  onClick={() => setRawHtmlEditorMode('docx')}>
                  <FileText className="size-4" />
                  {t('templateDocumentVariableEditor.docx')}
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {rawHtmlEditorMode === 'ckeditor' ? (
                !RawCKEditorComponent || !RawClassicEditorConstructor || !rawHtmlEditorConfig ? (
                  <div className="flex min-h-[680px] items-center justify-center text-sm text-slate-500">
                    {t('templateDocumentVariableEditor.loading')}
                  </div>
                ) : (
                  <div className="template-raw-html-editor">
                    <RawCKEditorComponent
                      key={`${documentTemplate.id}-raw-html-${selectedTemplateTypesKey}`}
                      editor={RawClassicEditorConstructor}
                      config={rawHtmlEditorConfig}
                      data={rawHtmlEditorData}
                      onReady={(editor) => {
                        attachFontSizeToolbarLabel(editor);
                        mentionEditorCleanupRef.current?.();
                        mentionEditorCleanupRef.current = registerMentionRichTextEditor(editor);
                      }}
                      onChange={(_, editor) => {
                        handleDocumentTemplatePatch({ static_html: stripRawHtmlEditorMarkers(editor.getData()) });
                      }}
                    />
                  </div>
                )
              ) : (
                <Suspense
                  fallback={
                    <div className="flex min-h-[680px] items-center justify-center text-sm text-slate-500">
                      {t('templateDocumentVariableEditor.loading')}
                    </div>
                  }>
                  <LazyDocxDocumentEditor
                    htmlContent={previewHtml || '<p></p>'}
                    sourceKey={rawHtmlDocxSourceKey}
                    fileName={`${documentTemplate.id || form.label || 'content-variable'}.docx`}
                    className="h-full min-h-[680px]"
                    onError={setError}
                  />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[520px] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)] xl:items-start">
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm xl:max-h-[calc(100vh-4rem)] xl:self-start">
            <DocumentTemplateEditor
              editableTemplateMeta
              template={editableDocumentTemplate}
              values={documentValues}
              onValuesChange={(updates) => setDocumentValues((current) => ({ ...current, ...updates }))}
              onTemplateChange={(nextTemplate) => {
                setDocumentTemplate((current) => ({
                  ...nextTemplate,
                  lock_structure: current.lock_structure,
                  allow_section_management: current.allow_section_management,
                }));
                setForm((current) => ({
                  ...current,
                  label: nextTemplate.name,
                }));
              }}
            />
          </div>
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-16 xl:max-h-[calc(100vh-4rem)] xl:self-start">
            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {t('templateDocumentVariableEditor.previewRender')}
            </div>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
};
