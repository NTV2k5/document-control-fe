import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Home, Loader2, Pencil, Plus, RefreshCcw, Save, Search, Settings2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SearchableMultiSelect,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  type PaginationInfo,
} from 'reactjs-platform/ui';
import { useDebounce } from 'reactjs-platform/utilities';
import {
  createTemplateVariableAPI,
  deleteTemplateVariableAPI,
  getMetadataByKeyAPI,
  getTemplateEditorMetaAPI,
  getTemplateVariableSettingsAPI,
  isTemplateVariableDataSourceInputType,
  listTemplateVariablesAPI,
  type MetadataOption,
  TEMPLATE_VARIABLE_INPUT_TYPES,
  updateTemplateVariableSettingsAPI,
  updateTemplateVariableAPI,
  type ITemplateVariableDefinition,
  type TArtifactVariableProfileType,
  type TTemplateVariableInputType,
  type TTemplateVariableType,
} from 'api';
import {
  DEFAULT_EDITOR_GLOBAL_STYLE,
  DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS,
  getVariableAlias,
  getVariableTableAlias,
  isTableTemplateConfig,
  normalizeTemplateVariableRenderSettings,
  normalizeEditorMeta,
  setEditorGlobalStyle,
  type ExactSchemaCatalog,
  type TEditorTextStyle,
  type ITemplateVariableRenderSettings,
} from '../../lib';
import { extractPageSize } from '../../models';
import { useTranslation } from '../../i18n';
import { ArtifactVariableProfilesSection } from './artifact-variable-profiles.section';
import type {
  ITemplateVariableFormState,
  ITemplateVariableListState,
  TTemplateVariableActiveFilter,
  TTemplateVariableRouteFilter,
  ITemplateVariablesSectionProps,
} from './template-variables.type';

type TVariableModalMode = 'create' | 'edit' | null;
const DEFAULT_PAGE_SIZE = 10;

const EMPTY_SOURCE = {
  type: 'table' as const,
  table: '',
  value_field: '',
  label_field: null,
  sort_order: 'asc' as const,
};

const VARIABLE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/;
const LEGACY_ALL_TEMPLATE_TYPES_VALUE = '__all_template_types__';
const EDITOR_STYLE_FONT_OPTIONS = [
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Calibri, Arial, sans-serif', label: 'Calibri' },
  { value: 'Cambria, Georgia, serif', label: 'Cambria' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Courier New, Courier, monospace', label: 'Courier New' },
] as const;
const EDITOR_STYLE_FONT_SIZE_OPTIONS = [
  '8pt',
  '9pt',
  '10pt',
  '11pt',
  '12pt',
  '13pt',
  '14pt',
  '16pt',
  '18pt',
  '20pt',
  '24pt',
];
const EDITOR_STYLE_LINE_HEIGHT_OPTIONS = ['1', '1.15', '1.25', '1.5', '2'];
const EDITOR_STYLE_TEXT_ALIGN_OPTIONS = ['left', 'center', 'right', 'justify'] as const;
const STYLE_SELECT_CLASSNAME =
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const DEFAULT_VARIABLE_TEXT_STYLE: TEditorTextStyle = {
  ...DEFAULT_EDITOR_GLOBAL_STYLE,
  bold: false,
  italic: false,
  underline: false,
  text_align: 'left',
};

const getVariableTextStyleFromConfig = (uiConfig?: Record<string, unknown> | null): TEditorTextStyle => {
  const style = uiConfig?.style;
  return {
    ...DEFAULT_VARIABLE_TEXT_STYLE,
    ...(style && typeof style === 'object' && !Array.isArray(style) ? (style as TEditorTextStyle) : {}),
  };
};

const SOURCE_TABLE_KEY_OVERRIDES: Record<string, string> = {
  faculties: 'faculty',
  syllabuses: 'syllabus',
};

const VARIABLE_TYPE_LABEL_KEYS: Record<TTemplateVariableType, string> = {
  FIELD_VARIABLE: 'variables.management.variableTypes.field',
  TABLE_VARIABLE: 'variables.management.variableTypes.table',
  DOCUMENT_VARIABLE: 'variables.management.variableTypes.document',
};
const HTML_CONTENT_VARIABLE_FILTER = 'HTML_CONTENT_VARIABLE' as const;

const isTemplateVariableTypeFilter = (value: TTemplateVariableRouteFilter): value is TTemplateVariableType =>
  value === 'FIELD_VARIABLE' || value === 'TABLE_VARIABLE' || value === 'DOCUMENT_VARIABLE';

const isArtifactProfileType = (value: TTemplateVariableRouteFilter): value is TArtifactVariableProfileType =>
  value === 'spreadsheet' || value === 'presentation' || value === 'image_form';

const createEmptyForm = (): ITemplateVariableFormState => ({
  key: '',
  label: '',
  description: '',
  template_types: [],
  variable_type: 'FIELD_VARIABLE',
  input_type: 'Data',
  default_value: '',
  data_source: null,
  ui_config: { style: DEFAULT_VARIABLE_TEXT_STYLE },
});

const VARIABLE_TYPE_FILTER_CONFIGS: Array<{
  value: TTemplateVariableRouteFilter;
  labelKey: string;
  to: string;
}> = [
  { value: 'all', labelKey: 'variables.management.variableTypes.all', to: '/template-variables' },
  { value: 'FIELD_VARIABLE', labelKey: VARIABLE_TYPE_LABEL_KEYS.FIELD_VARIABLE, to: '/template-variables/fields' },
  { value: 'TABLE_VARIABLE', labelKey: VARIABLE_TYPE_LABEL_KEYS.TABLE_VARIABLE, to: '/template-variables/tables' },
  {
    value: 'DOCUMENT_VARIABLE',
    labelKey: VARIABLE_TYPE_LABEL_KEYS.DOCUMENT_VARIABLE,
    to: '/template-variables/documents',
  },
  {
    value: HTML_CONTENT_VARIABLE_FILTER,
    labelKey: 'variables.management.variableTypes.htmlContent',
    to: '/template-variables/html-content',
  },
  {
    value: 'spreadsheet',
    labelKey: 'variables.management.variableTypes.spreadsheet',
    to: '/template-variables/excel',
  },
  {
    value: 'presentation',
    labelKey: 'variables.management.variableTypes.presentation',
    to: '/template-variables/powerpoint',
  },
  {
    value: 'image_form',
    labelKey: 'variables.management.variableTypes.image_form',
    to: '/template-variables/image-form',
  },
  {
    value: 'settings',
    labelKey: 'variables.management.variableTypes.settings',
    to: '/template-variables/settings',
  },
];

const FORM_FIELD_IDS = {
  key: 'template-variable-key',
  label: 'template-variable-label',
  defaultValue: 'template-variable-default-value',
  description: 'template-variable-description',
} as const;

const normalizeDefinitionToForm = (definition: ITemplateVariableDefinition): ITemplateVariableFormState => ({
  id: definition.id,
  key: definition.key,
  label: definition.label,
  description: definition.description ?? '',
  template_types: definition.template_types ?? [],
  variable_type: definition.variable_type ?? 'FIELD_VARIABLE',
  input_type: definition.input_type,
  default_value: definition.default_value ?? '',
  data_source: definition.data_source ?? null,
  ui_config: definition.ui_config ?? null,
});

const getTableTemplateFromUiConfig = (uiConfig?: Record<string, unknown> | null) => {
  const tableTemplate = uiConfig?.table_template;
  return isTableTemplateConfig(tableTemplate) ? tableTemplate : null;
};

const toSourceVariableGroup = (table: string) => {
  if (SOURCE_TABLE_KEY_OVERRIDES[table]) {
    return SOURCE_TABLE_KEY_OVERRIDES[table];
  }
  if (table.endsWith('ies')) {
    return `${table.slice(0, -3)}y`;
  }
  if (table.endsWith('s') && table.length > 1) {
    return table.slice(0, -1);
  }
  return table;
};

const buildSourceVariableKey = (table?: string | null, field?: string | null) => {
  if (!table || !field) return '';
  return `${toSourceVariableGroup(table)}.${field}`;
};

const shouldSyncGeneratedKey = (key: string, dataSource: ITemplateVariableFormState['data_source']) => {
  const currentKey = key.trim();
  if (!currentKey) return true;
  return currentKey === buildSourceVariableKey(dataSource?.table, dataSource?.value_field);
};

const getSourceTable = (definition: ITemplateVariableDefinition) => {
  const table = definition.data_source?.table;
  if (table?.trim()) return table.trim();

  const uiConfigSourceTables = new Set<string>();
  collectSourceTablesFromUnknown(definition.ui_config, uiConfigSourceTables);
  return uiConfigSourceTables.values().next().value ?? null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const collectSourceTablesFromUnknown = (value: unknown, tables: Set<string>) => {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectSourceTablesFromUnknown(item, tables);
    });
    return;
  }

  if (!isRecord(value)) return;

  [value.table, value.reference_table, value.primary_table, value.join_table].forEach((candidate) => {
    if (typeof candidate === 'string' && candidate.trim()) {
      tables.add(candidate.trim());
    }
  });

  if (typeof value.table_field === 'string') {
    const [sourceTable] = value.table_field.split('.');
    if (sourceTable?.trim()) {
      tables.add(sourceTable.trim());
    }
  }

  Object.values(value).forEach((nestedValue) => {
    collectSourceTablesFromUnknown(nestedValue, tables);
  });
};

const getSourceTableLabel = (table?: string | null) => {
  if (!table) return '-';
  return `${getVariableTableAlias(table)} (${table})`;
};

const getSourceFieldSummary = (
  definition: ITemplateVariableDefinition,
  copy: { columnSuffix: string; displayFieldPrefix: string },
) => {
  const source = definition.data_source;
  if (source?.type !== 'table') {
    const tableTemplate = getTableTemplateFromUiConfig(definition.ui_config);
    return tableTemplate
      ? `${tableTemplate.name} · ${tableTemplate.structure.headers.length} ${copy.columnSuffix}`
      : '-';
  }
  const valueLabel = getVariableAlias(source.table, source.value_field);
  const labelField = source.label_field ? getVariableAlias(source.table, source.label_field) : null;
  return `${valueLabel}${labelField ? ` (${copy.displayFieldPrefix}: ${labelField})` : ''}`;
};

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const sanitizeTemplateTypes = (templateTypes: string[]) =>
  templateTypes.filter((template_type) => template_type !== LEGACY_ALL_TEMPLATE_TYPES_VALUE);

export const TemplateVariablesSection = ({ variableType = 'all' }: ITemplateVariablesSectionProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [schemaCatalog, setSchemaCatalog] = useState<ExactSchemaCatalog>({});
  const [templateTypeOptions, setTemplateTypeOptions] = useState<MetadataOption[]>([]);
  const [listState, setListState] = useState<ITemplateVariableListState>({
    data: [],
    loading: true,
    error: null,
  });
  const [form, setForm] = useState<ITemplateVariableFormState>(() => createEmptyForm());
  const [modalMode, setModalMode] = useState<TVariableModalMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<ITemplateVariableDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<TTemplateVariableActiveFilter>('all');
  const [templateTypeFilter, setTemplateTypeFilter] = useState('all');
  const variableTypeFilter = variableType;
  const [inputTypeFilter, setInputTypeFilter] = useState<TTemplateVariableInputType | ''>('');
  const [sourceTableFilter, setSourceTableFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ITemplateVariableRenderSettings>(DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total: 0,
    total_pages: 0,
  });

  const debouncedSearch = useDebounce(search, 350);
  const pageSize = extractPageSize(pagination);
  const isSettingsView = variableTypeFilter === 'settings';
  const isArtifactProfileView = isArtifactProfileType(variableTypeFilter);
  const tableNames = useMemo(() => Object.keys(schemaCatalog).sort((a, b) => a.localeCompare(b)), [schemaCatalog]);
  const sourceTableOptions = useMemo(
    () =>
      tableNames.map((table) => ({
        value: table,
        label: getSourceTableLabel(table),
      })),
    [tableNames],
  );
  const getInputTypeLabel = useCallback(
    (inputType: TTemplateVariableInputType) => t(`variables.inputTypes.${inputType}`),
    [t],
  );
  const inputTypeOptions = useMemo(
    () =>
      TEMPLATE_VARIABLE_INPUT_TYPES.map((inputType) => ({
        value: inputType,
        label: getInputTypeLabel(inputType),
      })),
    [getInputTypeLabel],
  );
  const allTemplateTypesLabel = t('variables.management.allTemplateTypes');
  const variableTypeLabels = useMemo<Record<TTemplateVariableType, string>>(
    () => ({
      FIELD_VARIABLE: t(VARIABLE_TYPE_LABEL_KEYS.FIELD_VARIABLE),
      TABLE_VARIABLE: t(VARIABLE_TYPE_LABEL_KEYS.TABLE_VARIABLE),
      DOCUMENT_VARIABLE: t(VARIABLE_TYPE_LABEL_KEYS.DOCUMENT_VARIABLE),
    }),
    [t],
  );
  const variableTypeFilterOptions = useMemo(
    () =>
      VARIABLE_TYPE_FILTER_CONFIGS.map((option) => ({
        ...option,
        label: t(option.labelKey),
      })),
    [t],
  );
  const templateTypeLabelMap = useMemo(
    () => new Map(templateTypeOptions.map((option) => [option.value, option.label])),
    [templateTypeOptions],
  );
  const activeVariableTypeLabel = useMemo(
    () =>
      variableTypeFilterOptions.find((option) => option.value === variableTypeFilter)?.label ??
      t('variables.management.templateVariables'),
    [t, variableTypeFilter, variableTypeFilterOptions],
  );
  const pageTitle = isSettingsView
    ? t('variables.management.settings.title')
    : variableTypeFilter === 'all'
      ? t('variables.management.title')
      : t('variables.management.titleForType', { type: activeVariableTypeLabel.toLocaleLowerCase() });
  const selectedTemplateTypes = useMemo(() => sanitizeTemplateTypes(form.template_types), [form.template_types]);
  const dataSourceEnabled = isTemplateVariableDataSourceInputType(form.input_type);
  const getTemplateTypeLabels = useCallback(
    (templateTypes?: string[] | null) => {
      const normalizedTemplateTypes = templateTypes ?? [];
      if (normalizedTemplateTypes.length === 0) {
        return [allTemplateTypesLabel];
      }

      return normalizedTemplateTypes.map((template_type) => templateTypeLabelMap.get(template_type) ?? template_type);
    },
    [allTemplateTypesLabel, templateTypeLabelMap],
  );
  const sourceFields = useMemo(() => {
    const table = form.data_source?.table;
    return table ? (schemaCatalog[table] ?? []) : [];
  }, [form.data_source?.table, schemaCatalog]);
  const suggestedVariableKey = useMemo(
    () => buildSourceVariableKey(form.data_source?.table, form.data_source?.value_field),
    [form.data_source?.table, form.data_source?.value_field],
  );

  const loadVariableMeta = useCallback(async () => {
    try {
      const [meta, templateTypes] = await Promise.all([
        getTemplateEditorMetaAPI(),
        getMetadataByKeyAPI<MetadataOption[]>('TEMPLATE_TYPE'),
      ]);
      const normalizedMeta = normalizeEditorMeta(meta);
      setSchemaCatalog(normalizedMeta.source_schema_field_catalog);
      setTemplateTypeOptions(templateTypes.meta_values ?? []);
    } catch (error) {
      setListState((current) => ({
        ...current,
        error: getErrorMessage(error),
      }));
    }
  }, []);

  const loadDefinitions = useCallback(async () => {
    if (isSettingsView || isArtifactProfileView) {
      setListState((current) => ({ ...current, loading: false, error: null }));
      return;
    }

    setListState((current) => ({ ...current, loading: true, error: null }));
    try {
      const queryVariableType =
        variableTypeFilter === HTML_CONTENT_VARIABLE_FILTER
          ? 'DOCUMENT_VARIABLE'
          : isTemplateVariableTypeFilter(variableTypeFilter)
            ? variableTypeFilter
            : undefined;
      const documentRenderMode =
        variableTypeFilter === HTML_CONTENT_VARIABLE_FILTER
          ? 'raw_html'
          : variableTypeFilter === 'DOCUMENT_VARIABLE'
            ? 'structured'
            : undefined;
      const definitions = await listTemplateVariablesAPI({
        search: debouncedSearch.trim() || undefined,
        is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
        template_type: templateTypeFilter === 'all' ? undefined : templateTypeFilter,
        variable_type: queryVariableType,
        input_type: inputTypeFilter || undefined,
        source_table: sourceTableFilter || undefined,
        document_render_mode: documentRenderMode,
        page: pagination.page,
        page_size: pageSize,
      });
      setListState({ data: definitions.data, loading: false, error: null });
      setPagination((current) => ({
        ...current,
        total: definitions.pagination.total,
        total_pages: definitions.pagination.total_pages,
        page: definitions.pagination.page,
        page_size: definitions.pagination.page_size,
      }));
    } catch (error) {
      setListState((current) => ({
        ...current,
        loading: false,
        error: getErrorMessage(error),
      }));
    }
  }, [
    activeFilter,
    debouncedSearch,
    pageSize,
    inputTypeFilter,
    pagination.page,
    sourceTableFilter,
    templateTypeFilter,
    variableTypeFilter,
    isArtifactProfileView,
    isSettingsView,
  ]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setListState((current) => ({ ...current, error: null }));
    try {
      const nextSettings = await getTemplateVariableSettingsAPI();
      const normalizedSettings = normalizeTemplateVariableRenderSettings(nextSettings);
      setEditorGlobalStyle(normalizedSettings.editor_style);
      setSettings(normalizedSettings);
    } catch (error) {
      setListState((current) => ({
        ...current,
        error: getErrorMessage(error),
      }));
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVariableMeta();
  }, [loadVariableMeta]);

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const openCreateModal = () => {
    if (isArtifactProfileView) {
      return;
    }

    if (variableTypeFilter === 'TABLE_VARIABLE') {
      void navigate({ to: '/template-variables/new', search: { variable_type: 'TABLE_VARIABLE' } });
      return;
    }

    if (variableTypeFilter === HTML_CONTENT_VARIABLE_FILTER) {
      void navigate({
        to: '/template-variables/new',
        search: { variable_type: 'DOCUMENT_VARIABLE', document_mode: 'raw_html' },
      });
      return;
    }

    if (variableTypeFilter === 'DOCUMENT_VARIABLE') {
      void navigate({
        to: '/template-variables/new',
        search: { variable_type: 'DOCUMENT_VARIABLE' },
      });
      return;
    }

    const emptyForm = createEmptyForm();
    if (isTemplateVariableTypeFilter(variableTypeFilter)) {
      setForm({
        ...emptyForm,
        variable_type: variableTypeFilter,
        input_type: emptyForm.input_type,
      });
    } else {
      setForm(emptyForm);
    }
    setModalMode('create');
  };

  const openEditModal = (definition: ITemplateVariableDefinition) => {
    if (definition.variable_type === 'TABLE_VARIABLE') {
      void navigate({
        to: '/template-variables/$id',
        params: { id: definition.id },
        search: { variable_type: 'TABLE_VARIABLE' },
      });
      return;
    }

    if (definition.variable_type === 'DOCUMENT_VARIABLE') {
      void navigate({
        to: '/template-variables/$id',
        params: { id: definition.id },
        search: { variable_type: 'DOCUMENT_VARIABLE' },
      });
      return;
    }

    const nextForm = normalizeDefinitionToForm(definition);
    const nextTemplateTypes = sanitizeTemplateTypes(nextForm.template_types);
    setForm({
      ...nextForm,
      template_types:
        nextTemplateTypes.length === 0 && templateTypeOptions.length > 0
          ? templateTypeOptions.map((option) => option.value)
          : nextTemplateTypes,
    });
    setModalMode('edit');
  };

  const closeFormModal = () => {
    setModalMode(null);
    setForm(createEmptyForm());
  };

  const updateDataSource = (patch: Partial<NonNullable<ITemplateVariableFormState['data_source']>>) => {
    setForm((current) => {
      const nextSource = {
        ...(current.data_source ?? EMPTY_SOURCE),
        ...patch,
      };
      const nextKey = buildSourceVariableKey(nextSource.table, nextSource.value_field);
      const shouldSyncKey = shouldSyncGeneratedKey(current.key, current.data_source);

      return {
        ...current,
        key: shouldSyncKey ? nextKey : current.key,
        data_source: nextSource,
      };
    });
  };

  const syncKeyFromSource = () => {
    if (!suggestedVariableKey) return;
    setForm((current) => ({
      ...current,
      key: suggestedVariableKey,
    }));
  };

  const handleInputTypeChange = (inputType: TTemplateVariableInputType) => {
    setForm((current) => ({
      ...current,
      input_type: inputType,
      data_source: isTemplateVariableDataSourceInputType(inputType) ? (current.data_source ?? EMPTY_SOURCE) : null,
    }));
  };

  const handleVariableTypeChange = (variableType: TTemplateVariableType) => {
    if (variableType === 'TABLE_VARIABLE') {
      closeFormModal();
      void navigate({ to: '/template-variables/new', search: { variable_type: 'TABLE_VARIABLE' } });
      return;
    }

    if (variableType === 'DOCUMENT_VARIABLE') {
      closeFormModal();
      void navigate({ to: '/template-variables/new', search: { variable_type: 'DOCUMENT_VARIABLE' } });
      return;
    }

    setForm((current) => {
      return {
        ...current,
        variable_type: variableType,
        input_type: current.variable_type === 'TABLE_VARIABLE' ? 'Data' : current.input_type,
        data_source:
          variableType === 'FIELD_VARIABLE' && isTemplateVariableDataSourceInputType(current.input_type)
            ? (current.data_source ?? EMPTY_SOURCE)
            : null,
        ui_config:
          variableType === 'FIELD_VARIABLE'
            ? { ...(current.ui_config ?? {}), style: getVariableTextStyleFromConfig(current.ui_config) }
            : current.ui_config,
      };
    });
  };

  const handleTemplateTypesChange = (values: string[]) => {
    setForm((current) => ({ ...current, template_types: sanitizeTemplateTypes(values) }));
  };

  const handleFieldStyleChange = (patch: TEditorTextStyle) => {
    setForm((current) => {
      const currentStyle = getVariableTextStyleFromConfig(current.ui_config);
      return {
        ...current,
        ui_config: {
          ...(current.ui_config ?? {}),
          style: {
            ...currentStyle,
            ...patch,
          },
        },
      };
    });
  };

  const validateForm = () => {
    if (!VARIABLE_KEY_PATTERN.test(form.key.trim())) {
      return t('variables.management.errors.invalidKey');
    }
    if (!form.label.trim()) {
      return t('variables.management.errors.missingLabel');
    }
    if (selectedTemplateTypes.length === 0) {
      return t('variables.management.errors.missingTemplateType');
    }
    if (dataSourceEnabled) {
      if (!form.data_source?.table || !form.data_source.value_field) {
        return t('variables.management.errors.missingDataSource', { inputType: getInputTypeLabel(form.input_type) });
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setListState((current) => ({ ...current, error: validationError }));
      return;
    }

    setSaving(true);
    setListState((current) => ({ ...current, error: null }));
    try {
      const payload = {
        key: form.key.trim(),
        label: form.label.trim(),
        description: form.description.trim() || null,
        template_types: selectedTemplateTypes,
        variable_type: form.variable_type,
        input_type: form.input_type,
        default_value: form.default_value.trim() || null,
        data_source: dataSourceEnabled ? form.data_source : null,
        ui_config: form.ui_config,
      };

      if (form.id) {
        await updateTemplateVariableAPI(form.id, payload);
      } else {
        await createTemplateVariableAPI(payload);
      }

      if (!form.id && pagination.page !== 1) {
        setPagination((current) => ({ ...current, page: 1 }));
      } else {
        await loadDefinitions();
      }
      closeFormModal();
    } catch (error) {
      setListState((current) => ({
        ...current,
        error: getErrorMessage(error),
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleSettingsChange = async (patch: Partial<ITemplateVariableRenderSettings>) => {
    const nextSettings = normalizeTemplateVariableRenderSettings({
      ...settings,
      ...patch,
    });

    setSettings(nextSettings);
    setEditorGlobalStyle(nextSettings.editor_style);
    setSettingsLoading(true);
    setListState((current) => ({ ...current, error: null }));

    try {
      const savedSettings = await updateTemplateVariableSettingsAPI(nextSettings);
      const normalizedSavedSettings = normalizeTemplateVariableRenderSettings(savedSettings);
      setEditorGlobalStyle(normalizedSavedSettings.editor_style);
      setSettings(normalizedSavedSettings);
    } catch (error) {
      setListState((current) => ({
        ...current,
        error: getErrorMessage(error),
      }));
      await loadSettings();
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setListState((current) => ({ ...current, error: null }));
    try {
      await deleteTemplateVariableAPI(deleteTarget.id);
      if (listState.data.length <= 1 && pagination.page > 1) {
        setPagination((current) => ({ ...current, page: current.page - 1 }));
      } else {
        await loadDefinitions();
      }
      setDeleteTarget(null);
      if (form.id === deleteTarget.id) {
        closeFormModal();
      }
    } catch (error) {
      setListState((current) => ({
        ...current,
        error: getErrorMessage(error),
      }));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<ITemplateVariableDefinition>[] = [
    {
      id: 'index',
      header: t('variables.management.columns.index'),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-slate-600">{(pagination.page - 1) * pageSize + row.index + 1}</span>
      ),
      meta: { className: 'w-[72px] min-w-[72px] text-center align-top' },
    },
    {
      accessorKey: 'key',
      header: t('variables.management.columns.key'),
      cell: ({ row }) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => openEditModal(row.original)}
            className="break-all text-left font-mono text-xs font-semibold text-[#0B2559]">
            {`{{${row.original.key}}}`}
          </button>
        </div>
      ),
      meta: { className: 'w-[240px] min-w-[220px] whitespace-normal align-top' },
    },
    {
      accessorKey: 'label',
      header: t('variables.management.columns.label'),
      cell: ({ row }) => (
        <div className="min-w-0 whitespace-normal">
          <div className="font-medium text-slate-900">{row.original.label}</div>
          {row.original.description && (
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{row.original.description}</div>
          )}
        </div>
      ),
      meta: { className: 'min-w-[240px] whitespace-normal align-top' },
    },
    {
      id: 'template_types',
      header: t('variables.management.columns.templateTypes'),
      cell: ({ row }) => {
        const labels = getTemplateTypeLabels(row.original.template_types);
        return (
          <div className="flex max-w-[280px] flex-wrap gap-1">
            {labels.length > 0 ? (
              labels.map((label) => (
                <span key={label} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  {label}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">-</span>
            )}
          </div>
        );
      },
      meta: { className: 'w-[280px] min-w-[240px] whitespace-normal align-top' },
    },
    {
      accessorKey: 'variable_type',
      header: t('variables.management.columns.variableType'),
      cell: ({ row }) => (
        <span className="inline-flex rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
          {variableTypeLabels[row.original.variable_type] ?? row.original.variable_type}
        </span>
      ),
      meta: { className: 'w-[160px] min-w-[150px] whitespace-normal align-top' },
    },
    {
      id: 'source_table',
      header: t('variables.management.columns.sourceTable'),
      cell: ({ row }) => {
        const sourceTable = getSourceTable(row.original);
        return (
          <div className="min-w-0 whitespace-normal">
            <div className="text-sm font-medium text-slate-700">
              {sourceTable ? getVariableTableAlias(sourceTable) : '-'}
            </div>
            <div className="mt-1 break-all font-mono text-[11px] text-slate-400">{sourceTable ?? '-'}</div>
          </div>
        );
      },
      meta: { className: 'w-[200px] min-w-[180px] whitespace-normal align-top' },
    },
    {
      accessorKey: 'input_type',
      header: t('variables.management.columns.inputType'),
      cell: ({ row }) => (
        <span className="whitespace-normal text-sm text-slate-600">{getInputTypeLabel(row.original.input_type)}</span>
      ),
      meta: { className: 'w-[160px] min-w-[150px] whitespace-normal align-top' },
    },
    {
      accessorKey: 'default_value',
      header: t('variables.management.columns.defaultValue'),
      cell: ({ row }) =>
        row.original.default_value ? (
          <span className="line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{row.original.default_value}</span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        ),
      meta: { className: 'w-[180px] min-w-[160px] whitespace-normal align-top' },
    },
    {
      id: 'source',
      header: t('variables.management.columns.dataSource'),
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {getSourceFieldSummary(row.original, {
            columnSuffix: t('variables.management.columnSuffix'),
            displayFieldPrefix: t('variables.management.displayFieldPrefix'),
          })}
        </span>
      ),
      meta: { className: 'w-[240px] min-w-[220px] whitespace-normal align-top' },
    },
    {
      accessorKey: 'is_active',
      header: t('variables.management.columns.status'),
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
            row.original.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
          {row.original.is_active ? t('variables.management.status.active') : t('variables.management.status.inactive')}
        </span>
      ),
      meta: { className: 'w-[130px] min-w-[120px] whitespace-normal align-top' },
    },
    {
      id: 'actions',
      header: t('variables.management.columns.actions'),
      meta: { frozen: 'right', frozenWidth: 112, className: 'w-[112px] min-w-[112px]' },
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={t('variables.management.actions.edit')}
            title={t('variables.management.actions.edit')}
            onClick={() => openEditModal(row.original)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={t('variables.management.actions.softDelete')}
            title={
              row.original.is_active
                ? t('variables.management.actions.softDelete')
                : t('variables.management.actions.alreadyDeleted')
            }
            disabled={!row.original.is_active || saving}
            onClick={() => setDeleteTarget(row.original)}
            className="text-red-600 hover:bg-red-50">
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm">
            <span className="flex items-center gap-1 text-amber-600">
              <Home className="size-3.5" />
              <span className="font-medium">{t('variables.management.documentManagement')}</span>
            </span>
            <span className="text-gray-400">›</span>
            {variableTypeFilter === 'all' ? (
              <span className="text-gray-500">{t('variables.management.templateVariables')}</span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate({ to: '/template-variables' })}
                  className="font-medium text-slate-500 hover:text-[#0B2559]">
                  {t('variables.management.templateVariables')}
                </button>
                <span className="text-gray-400">›</span>
                <span className="text-gray-500">{activeVariableTypeLabel}</span>
              </>
            )}
          </div>
          <div className="text-3xl font-bold text-[#0B2559]">{pageTitle}</div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{t('variables.management.description')}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void loadVariableMeta();
              void loadDefinitions();
              void loadSettings();
            }}
            disabled={listState.loading || saving || settingsLoading}>
            <RefreshCcw className="size-4" />
            {t('variables.management.reload')}
          </Button>
          {!isSettingsView && !isArtifactProfileView && (
            <Button onClick={openCreateModal} disabled={saving}>
              <Plus className="size-4" />
              {t('variables.management.addVariable')}
            </Button>
          )}
        </div>
      </div>

      {listState.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {listState.error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <nav className="flex flex-wrap gap-1 border-b border-slate-100 px-6">
          {variableTypeFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (variableTypeFilter !== option.value) {
                  void navigate({ to: option.to });
                }
              }}
              aria-current={variableTypeFilter === option.value ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                variableTypeFilter === option.value
                  ? 'border-[#002147] text-[#002147]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {option.label}
            </button>
          ))}
        </nav>
        {isArtifactProfileView ? (
          <ArtifactVariableProfilesSection
            artifactType={variableTypeFilter}
            schemaCatalog={schemaCatalog}
            templateTypeOptions={templateTypeOptions}
          />
        ) : isSettingsView ? (
          <div className="space-y-5 p-6">
            <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <Settings2 className="mt-0.5 size-5 text-[#174A86]" />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {t('variables.management.settings.renderModeTitle')}
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-600">
                  {t('variables.management.settings.renderModeDescription')}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {(
                [
                  {
                    value: 'snapshot',
                    title: t('variables.management.settings.snapshotTitle'),
                    description: t('variables.management.settings.snapshotDescription'),
                  },
                  {
                    value: 'live_config',
                    title: t('variables.management.settings.liveConfigTitle'),
                    description: t('variables.management.settings.liveConfigDescription'),
                  },
                ] as const
              ).map((option) => {
                const selected = settings.render_mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={settingsLoading}
                    onClick={() => void handleSettingsChange({ render_mode: option.value })}
                    className={`min-h-36 rounded-lg border p-5 text-left transition-colors ${
                      selected
                        ? 'border-[#0B2559] bg-[#0B2559] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-[#0B2559]/40'
                    }`}>
                    <div className="text-base font-semibold">{option.title}</div>
                    <div className={`mt-2 text-sm leading-6 ${selected ? 'text-blue-50' : 'text-slate-500'}`}>
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <Checkbox
                checked={settings.live_config_draft_only}
                disabled={settingsLoading || settings.render_mode !== 'live_config'}
                onCheckedChange={(checked: boolean | 'indeterminate') =>
                  void handleSettingsChange({
                    live_config_draft_only: checked === true,
                  })
                }
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {t('variables.management.settings.draftOnlyTitle')}
                </span>
                <span className="mt-1 block text-sm leading-6 text-slate-500">
                  {t('variables.management.settings.draftOnlyDescription')}
                </span>
              </span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">
                {t('variables.management.settings.editorStyleTitle')}
              </div>
              <div className="mt-1 text-sm leading-6 text-slate-500">
                {t('variables.management.settings.editorStyleDescription')}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    {t('variables.management.settings.editorFontFamily')}
                  </span>
                  <select
                    value={settings.editor_style.font_family}
                    disabled={settingsLoading}
                    onChange={(event) =>
                      void handleSettingsChange({
                        editor_style: {
                          ...settings.editor_style,
                          font_family: event.target.value,
                        },
                      })
                    }
                    className={STYLE_SELECT_CLASSNAME}>
                    {EDITOR_STYLE_FONT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    {t('variables.management.settings.editorFontSize')}
                  </span>
                  <select
                    value={settings.editor_style.font_size}
                    disabled={settingsLoading}
                    onChange={(event) =>
                      void handleSettingsChange({
                        editor_style: {
                          ...settings.editor_style,
                          font_size: event.target.value,
                        },
                      })
                    }
                    className={STYLE_SELECT_CLASSNAME}>
                    {EDITOR_STYLE_FONT_SIZE_OPTIONS.map((fontSize) => (
                      <option key={fontSize} value={fontSize}>
                        {fontSize}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    {t('variables.management.settings.editorLineHeight')}
                  </span>
                  <select
                    value={settings.editor_style.line_height}
                    disabled={settingsLoading}
                    onChange={(event) =>
                      void handleSettingsChange({
                        editor_style: {
                          ...settings.editor_style,
                          line_height: event.target.value,
                        },
                      })
                    }
                    className={STYLE_SELECT_CLASSNAME}>
                    {EDITOR_STYLE_LINE_HEIGHT_OPTIONS.map((lineHeight) => (
                      <option key={lineHeight} value={lineHeight}>
                        {lineHeight}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    {t('variables.management.settings.editorTextColor')}
                  </span>
                  <Input
                    type="color"
                    value={settings.editor_style.color}
                    disabled={settingsLoading}
                    onChange={(event) =>
                      void handleSettingsChange({
                        editor_style: {
                          ...settings.editor_style,
                          color: event.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
              <div className="relative min-w-72 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPagination((current) => ({ ...current, page: 1 }));
                  }}
                  placeholder={t('variables.management.searchPlaceholder')}
                  className="h-10 pl-10"
                />
              </div>
              <Select
                value={activeFilter}
                onValueChange={(value) => {
                  setActiveFilter(value as TTemplateVariableActiveFilter);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}>
                <SelectTrigger className="h-10 w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('variables.management.status.all')}</SelectItem>
                  <SelectItem value="active">{t('variables.management.status.active')}</SelectItem>
                  <SelectItem value="inactive">{t('variables.management.status.inactive')}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={templateTypeFilter}
                onValueChange={(value) => {
                  setTemplateTypeFilter(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}>
                <SelectTrigger className="h-10 w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{allTemplateTypesLabel}</SelectItem>
                  {templateTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SearchableSelect
                value={inputTypeFilter}
                options={inputTypeOptions}
                placeholder={t('variables.management.allInputTypes')}
                searchPlaceholder={t('variables.management.searchInputTypes')}
                emptyMessage={t('variables.management.noInputTypes')}
                clearable
                onValueChange={(value) => {
                  setInputTypeFilter(value as TTemplateVariableInputType | '');
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                className="h-10 w-full sm:w-56"
                maxHeight="320px"
              />
              <SearchableSelect
                value={sourceTableFilter}
                options={sourceTableOptions}
                placeholder={t('variables.management.allSourceTables')}
                searchPlaceholder={t('variables.management.searchSourceTables')}
                emptyMessage={t('variables.management.noSourceTables')}
                clearable
                onValueChange={(value) => {
                  setSourceTableFilter(value);
                  setPagination((current) => ({ ...current, page: 1 }));
                }}
                className="h-10 w-full sm:w-72"
                maxHeight="320px"
              />
            </div>

            <div className="px-4 py-5">
              <DataTable
                fixedHeader
                enableFreezeColumns
                columns={columns}
                data={listState.data}
                loading={listState.loading}
                pagination={pagination}
                onPaginationChange={(updater) => setPagination((current) => updater(current))}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            </div>
          </>
        )}
      </div>

      <Dialog
        open={modalMode !== null}
        onOpenChange={(open) => {
          if (!open) closeFormModal();
        }}>
        <DialogContent
          className={`max-h-[90vh] overflow-y-auto ${form.variable_type === 'TABLE_VARIABLE' ? 'max-w-7xl' : 'max-w-4xl'}`}>
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'edit'
                ? t('variables.management.modal.editTitle')
                : t('variables.management.modal.addTitle')}
            </DialogTitle>
            <DialogDescription>{t('variables.management.modal.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={FORM_FIELD_IDS.key} className="text-sm font-medium text-slate-700">
                  {t('variables.management.form.key')}
                </label>
                {suggestedVariableKey && form.key.trim() !== suggestedVariableKey && (
                  <Button type="button" size="sm" variant="outline" onClick={syncKeyFromSource} className="h-7 px-2">
                    {t('variables.management.form.useSuggestedKey', { key: suggestedVariableKey })}
                  </Button>
                )}
              </div>
              <Input
                id={FORM_FIELD_IDS.key}
                value={form.key}
                onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
                placeholder={suggestedVariableKey || 'course.code'}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor={FORM_FIELD_IDS.label} className="text-sm font-medium text-slate-700">
                {t('variables.management.form.label')}
              </label>
              <Input
                id={FORM_FIELD_IDS.label}
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder={t('variables.management.form.labelPlaceholder')}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">{t('variables.management.form.templateTypes')}</span>
              <SearchableMultiSelect
                value={selectedTemplateTypes}
                options={templateTypeOptions}
                placeholder={t('variables.management.form.chooseTemplateTypes')}
                searchPlaceholder={t('variables.management.form.searchTemplateTypes')}
                emptyMessage={t('variables.management.form.noTemplateTypes')}
                enableSelectAll
                selectAllLabel={allTemplateTypesLabel}
                maxHeight="280px"
                maxDisplay={2}
                onValueChange={handleTemplateTypesChange}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">{t('variables.management.form.variableType')}</span>
              <Select
                value={form.variable_type}
                onValueChange={(value) => handleVariableTypeChange(value as TTemplateVariableType)}>
                <SelectTrigger aria-label={t('variables.management.form.variableType')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(variableTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">{t('variables.management.form.inputType')}</span>
              <Select
                value={form.input_type}
                disabled={form.variable_type === 'TABLE_VARIABLE'}
                onValueChange={(value) => handleInputTypeChange(value as TTemplateVariableInputType)}>
                <SelectTrigger aria-label={t('variables.management.form.inputType')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_VARIABLE_INPUT_TYPES.map((inputType) => (
                    <SelectItem key={inputType} value={inputType}>
                      {getInputTypeLabel(inputType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <label htmlFor={FORM_FIELD_IDS.defaultValue} className="text-sm font-medium text-slate-700">
                {t('variables.management.form.defaultValue')}
              </label>
              <Textarea
                id={FORM_FIELD_IDS.defaultValue}
                value={form.default_value}
                onChange={(event) => setForm((current) => ({ ...current, default_value: event.target.value }))}
                rows={2}
                placeholder={t('variables.management.form.defaultValuePlaceholder')}
              />
            </div>

            {form.variable_type === 'FIELD_VARIABLE' &&
              (() => {
                const fieldStyle = getVariableTextStyleFromConfig(form.ui_config);
                return (
                  <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {t('variables.management.form.fieldStyleTitle')}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        {t('variables.management.form.fieldStyleDescription')}
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div className="space-y-1.5 lg:col-span-2">
                        <span className="text-sm font-medium text-slate-700">
                          {t('variables.management.settings.editorFontFamily')}
                        </span>
                        <select
                          value={fieldStyle.font_family ?? DEFAULT_VARIABLE_TEXT_STYLE.font_family}
                          onChange={(event) => handleFieldStyleChange({ font_family: event.target.value })}
                          className={STYLE_SELECT_CLASSNAME}>
                          {EDITOR_STYLE_FONT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">
                          {t('variables.management.settings.editorFontSize')}
                        </span>
                        <select
                          value={fieldStyle.font_size ?? DEFAULT_VARIABLE_TEXT_STYLE.font_size}
                          onChange={(event) => handleFieldStyleChange({ font_size: event.target.value })}
                          className={STYLE_SELECT_CLASSNAME}>
                          {EDITOR_STYLE_FONT_SIZE_OPTIONS.map((fontSize) => (
                            <option key={fontSize} value={fontSize}>
                              {fontSize}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">
                          {t('variables.management.settings.editorLineHeight')}
                        </span>
                        <select
                          value={fieldStyle.line_height ?? DEFAULT_VARIABLE_TEXT_STYLE.line_height}
                          onChange={(event) => handleFieldStyleChange({ line_height: event.target.value })}
                          className={STYLE_SELECT_CLASSNAME}>
                          {EDITOR_STYLE_LINE_HEIGHT_OPTIONS.map((lineHeight) => (
                            <option key={lineHeight} value={lineHeight}>
                              {lineHeight}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">
                          {t('variables.management.settings.editorTextColor')}
                        </span>
                        <Input
                          type="color"
                          value={fieldStyle.color}
                          onChange={(event) => handleFieldStyleChange({ color: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">
                          {t('variables.management.form.textAlign')}
                        </span>
                        <select
                          value={fieldStyle.text_align ?? DEFAULT_VARIABLE_TEXT_STYLE.text_align}
                          onChange={(event) =>
                            handleFieldStyleChange({ text_align: event.target.value as TEditorTextStyle['text_align'] })
                          }
                          className={STYLE_SELECT_CLASSNAME}>
                          {EDITOR_STYLE_TEXT_ALIGN_OPTIONS.map((textAlign) => (
                            <option key={textAlign} value={textAlign}>
                              {t(`variables.management.form.align${textAlign[0].toUpperCase()}${textAlign.slice(1)}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 lg:col-span-2">
                        {(
                          [
                            ['bold', t('variables.management.form.bold')],
                            ['italic', t('variables.management.form.italic')],
                            ['underline', t('variables.management.form.underline')],
                          ] as const
                        ).map(([styleKey, label]) => (
                          <label key={styleKey} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={fieldStyle[styleKey] === true}
                              onChange={(event) =>
                                handleFieldStyleChange({ [styleKey]: event.target.checked } as TEditorTextStyle)
                              }
                              className="size-4 rounded border-slate-300 text-[#0B2559]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>

          <div className="block space-y-1.5">
            <label htmlFor={FORM_FIELD_IDS.description} className="text-sm font-medium text-slate-700">
              {t('variables.management.form.description')}
            </label>
            <Textarea
              id={FORM_FIELD_IDS.description}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              placeholder={t('variables.management.form.descriptionPlaceholder')}
            />
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Database className="size-4 text-[#174A86]" />
              <div>
                <div className="text-sm font-semibold text-slate-900">{t('variables.management.dataSource.title')}</div>
                <div className="text-xs text-slate-500">{t('variables.management.dataSource.help')}</div>
              </div>
            </div>
            <div className={`grid gap-4 p-4 lg:grid-cols-3 ${!dataSourceEnabled ? 'opacity-50' : ''}`}>
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">{t('variables.management.dataSource.table')}</span>
                <Select
                  value={form.data_source?.table || undefined}
                  disabled={!dataSourceEnabled}
                  onValueChange={(table) =>
                    updateDataSource({
                      table,
                      value_field: schemaCatalog[table]?.includes(form.data_source?.value_field ?? '')
                        ? (form.data_source?.value_field ?? '')
                        : '',
                      label_field: schemaCatalog[table]?.includes(form.data_source?.label_field ?? '')
                        ? (form.data_source?.label_field ?? null)
                        : null,
                    })
                  }>
                  <SelectTrigger aria-label={t('variables.management.dataSource.table')}>
                    <SelectValue placeholder={t('variables.management.dataSource.chooseTable')} />
                  </SelectTrigger>
                  <SelectContent>
                    {tableNames.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table} · {getVariableTableAlias(table)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  {t('variables.management.dataSource.valueField')}
                </span>
                <Select
                  value={form.data_source?.value_field || undefined}
                  disabled={!dataSourceEnabled || !form.data_source?.table}
                  onValueChange={(valueField) => updateDataSource({ value_field: valueField })}>
                  <SelectTrigger aria-label={t('variables.management.dataSource.valueField')}>
                    <SelectValue placeholder={t('variables.management.dataSource.chooseField')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field} · {getVariableAlias(form.data_source?.table ?? '', field)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  {t('variables.management.dataSource.labelField')}
                </span>
                <Select
                  value={form.data_source?.label_field || '__none'}
                  disabled={!dataSourceEnabled || !form.data_source?.table}
                  onValueChange={(labelField) =>
                    updateDataSource({ label_field: labelField === '__none' ? null : labelField })
                  }>
                  <SelectTrigger aria-label={t('variables.management.dataSource.labelField')}>
                    <SelectValue placeholder={t('variables.management.dataSource.labelField')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t('variables.management.dataSource.useValueField')}</SelectItem>
                    {sourceFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field} · {getVariableAlias(form.data_source?.table ?? '', field)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {t('variables.management.currentToken')}{' '}
            <code className="font-mono">{form.key ? `{{${form.key}}}` : '{{...}}'}</code>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeFormModal} disabled={saving}>
              {t('variables.management.cancel')}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? t('variables.management.saving') : t('variables.management.saveConfig')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('variables.management.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('variables.management.deleteDialog.descriptionPrefix')}{' '}
              <span className="font-mono">{deleteTarget ? `{{${deleteTarget.key}}}` : ''}</span>{' '}
              {t('variables.management.deleteDialog.descriptionSuffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('variables.management.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void handleSoftDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? t('variables.management.deleting') : t('variables.management.confirmSoftDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
