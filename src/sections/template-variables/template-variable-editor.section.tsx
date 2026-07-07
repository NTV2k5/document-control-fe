import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, BookOpen, Database, Home, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { TableDesigner, type ITableBuilderConfig, type ITableDesignerChangePayload } from '../../components/template';
import {
  isConfiguredBlocksTemplate,
  isTableTemplateConfig,
  normalizeConfiguredBlocksTemplate,
  normalizeEditorMeta,
  type ExactSchemaCatalog,
  type TableTemplate,
} from '../../lib';
import {
  compileTableBuilderToTemplate,
  normalizeTableBuilder,
  normalizeTableDesignerSlug,
} from '../../components/template/table-designer';
import type { ITemplateVariableEditorSectionProps, ITemplateVariableFormState } from './template-variables.type';

const ALL_TEMPLATE_TYPES_LABEL = 'Tất cả loại mẫu';
const TABLE_RULE_GUIDE_PATH = '/template-variable-docs/table-rule-guide';
const VARIABLE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/;
const HEADER_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

type TTableContextSchema = {
  normalizer?: string;
  render_rule?: Record<string, unknown>;
  required: string[];
  controls: Array<Record<string, unknown>>;
};

type TTableContextControlType = 'number' | 'number_pair' | 'record_select' | 'school_list_pair' | 'text_list';
type TTableRenderRuleType =
  | 'manual'
  | 'repeat_blocks'
  | 'comparison_columns'
  | 'dynamic_column_group'
  | 'dynamic_matrix'
  | 'configured_blocks';

const TABLE_RENDER_RULE_TYPE_ALIASES: Record<string, TTableRenderRuleType> = {
  comparison_school_columns: 'comparison_columns',
  course_plo_columns: 'dynamic_column_group',
  curriculum_framework_fixed: 'configured_blocks',
  syllabus_clo_plo_matrix: 'dynamic_matrix',
};

const CONTEXT_CONTROL_TYPE_OPTIONS: Array<{ value: TTableContextControlType; label: string }> = [
  { value: 'number', label: 'Câu hỏi số' },
  { value: 'record_select', label: 'Chọn bản ghi' },
  { value: 'text_list', label: 'Danh sách text' },
  { value: 'school_list_pair', label: 'Hai danh sách' },
  { value: 'number_pair', label: 'Cặp số / matrix' },
];
const TABLE_RENDER_RULE_TYPE_OPTIONS: Array<{ value: TTableRenderRuleType; label: string; description: string }> = [
  {
    value: 'manual',
    label: 'Không có rule',
    description: 'User nhập dữ liệu trực tiếp trên bảng, không sinh cấu trúc tự động.',
  },
  {
    value: 'repeat_blocks',
    label: 'Lặp block theo số',
    description: 'Dùng một hoặc nhiều block mẫu và sinh lại theo số user nhập, ví dụ sinh Học kỳ 1/2/3.',
  },
  {
    value: 'comparison_columns',
    label: 'Sinh cột theo danh sách',
    description: 'Dùng hai danh sách text để sinh nhóm cột so sánh, ví dụ trường trong nước và trường nước ngoài.',
  },
  {
    value: 'dynamic_column_group',
    label: 'Sinh nhóm cột theo số',
    description: 'Sinh số cột con trong một nhóm header theo số user nhập.',
  },
  {
    value: 'dynamic_matrix',
    label: 'Sinh matrix hàng/cột',
    description: 'Sinh ma trận theo số hàng và số cột user nhập.',
  },
  {
    value: 'configured_blocks',
    label: 'Chuẩn hoá block theo JSON',
    description: 'Dùng cấu hình block trong JSON để chuẩn hoá bảng và tính tổng theo block nguồn.',
  },
];

const sanitizeTemplateTypes = (templateTypes: string[]) => templateTypes.filter(Boolean);

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isTableBuilderConfig = (value: unknown): value is ITableBuilderConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ITableBuilderConfig>;
  return candidate.version === 1 && Array.isArray(candidate.columns) && Array.isArray(candidate.row_blocks);
};

const getTableTemplateFromUiConfig = (uiConfig?: Record<string, unknown> | null) => {
  const tableTemplate = uiConfig?.table_template;
  return isTableTemplateConfig(tableTemplate) ? tableTemplate : null;
};

const getTableBuilderFromUiConfig = (uiConfig?: Record<string, unknown> | null) => {
  const tableBuilder = uiConfig?.table_builder;
  return isTableBuilderConfig(tableBuilder) ? tableBuilder : null;
};

const normalizeTableTemplateForDesigner = (tableTemplate: TableTemplate) => {
  const { style: _unusedStyle, ...structure } = tableTemplate.structure as TableTemplate['structure'] & {
    style?: unknown;
  };
  const normalizedTemplate: TableTemplate = {
    ...tableTemplate,
    structure,
  };

  if (isConfiguredBlocksTemplate(tableTemplate)) {
    return normalizeConfiguredBlocksTemplate(normalizedTemplate);
  }

  return normalizedTemplate;
};

const cloneContextSchema = (schema: TTableContextSchema) => JSON.parse(JSON.stringify(schema)) as TTableContextSchema;

const createDefaultContextSchema = (): TTableContextSchema => ({
  render_rule: { type: 'manual' },
  required: [],
  controls: [],
});

const createDefaultContextControl = (type: TTableContextControlType): Record<string, unknown> => {
  if (type === 'record_select') {
    return {
      type,
      key: 'record_id',
      label: 'Chọn dữ liệu',
      description: 'Chọn bản ghi làm nguồn dữ liệu cho bảng này.',
      table: '',
      value_field: '_id',
      label_field: 'name',
      context_label_key: 'recordName',
      tone: 'amber',
    };
  }

  if (type === 'number_pair') {
    return {
      type,
      label: 'Nhập thông tin số lượng',
      tone: 'indigo',
      controls: [
        {
          type: 'number',
          key: 'firstCount',
          label: 'Số thứ nhất',
          min: 1,
        },
        {
          type: 'number',
          key: 'secondCount',
          label: 'Số thứ hai',
          min: 1,
        },
      ],
    };
  }

  if (type === 'school_list_pair') {
    return {
      type,
      label: 'Nhập danh sách so sánh',
      domestic_key: 'domestic_comparison_schools',
      foreign_key: 'foreign_comparison_schools',
      domestic_input_key: 'domestic_comparison_input',
      foreign_input_key: 'foreign_comparison_input',
      domestic_label: 'Danh sách trong nước',
      foreign_label: 'Danh sách nước ngoài',
      tone: 'sky',
    };
  }

  if (type === 'text_list') {
    return {
      type,
      key: 'items',
      input_key: 'itemsInput',
      label: 'Nhập danh sách',
      description: 'Mỗi dòng là một giá trị.',
      placeholder: 'Giá trị 1\nGiá trị 2\nGiá trị 3',
      tone: 'sky',
    };
  }

  return {
    type,
    key: 'count',
    label: 'Nhập số lượng',
    min: 1,
    tone: 'indigo',
  };
};

const getContextControlType = (control: Record<string, unknown>): TTableContextControlType => {
  const type = control.type;
  return CONTEXT_CONTROL_TYPE_OPTIONS.some((option) => option.value === type)
    ? (type as TTableContextControlType)
    : 'number';
};

const getContextControlTitle = (control: Record<string, unknown>, index: number) => {
  const type = getContextControlType(control);
  const label = getContextDisplayText(control.label, control.label_key, '');
  if (label) return `${index + 1}. ${label}`;
  return `${index + 1}. ${CONTEXT_CONTROL_TYPE_OPTIONS.find((option) => option.value === type)?.label || type}`;
};

const getRenderRuleLabel = (renderRule?: Record<string, unknown>) => {
  if (typeof renderRule?.label === 'string' && renderRule.label.trim()) return renderRule.label.trim();
  const normalizedType = getRenderRuleType(renderRule);
  if (normalizedType !== 'manual') return getRenderRuleTypeOption(normalizedType).label;
  return 'manual';
};

const getRenderRuleDescription = (renderRule?: Record<string, unknown>) => {
  if (typeof renderRule?.description === 'string' && renderRule.description.trim()) {
    return renderRule.description.trim();
  }
  return 'Rule này chỉ áp dụng cho biến hiện tại và được lưu trong JSON của biến.';
};

const getRenderRuleType = (renderRule?: Record<string, unknown>): TTableRenderRuleType => {
  const rawType = typeof renderRule?.type === 'string' ? renderRule.type.trim() : '';
  const normalizedType = TABLE_RENDER_RULE_TYPE_ALIASES[rawType] ?? rawType;

  return TABLE_RENDER_RULE_TYPE_OPTIONS.some((option) => option.value === normalizedType)
    ? (normalizedType as TTableRenderRuleType)
    : 'manual';
};

const getRenderRuleTypeOption = (type: TTableRenderRuleType) =>
  TABLE_RENDER_RULE_TYPE_OPTIONS.find((option) => option.value === type) ?? TABLE_RENDER_RULE_TYPE_OPTIONS[0];

const normalizeRenderRuleConfig = (renderRule: Record<string, unknown>) => ({
  ...renderRule,
  type: getRenderRuleType(renderRule),
});

const ensureRequiredKeys = (schema: TTableContextSchema, keys: string[]) => ({
  ...schema,
  required: Array.from(new Set([...schema.required, ...keys.filter(Boolean)])),
});

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const asObjectArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object' && !Array.isArray(item)),
      )
    : [];

const getDynamicColumnGroupConfigs = (renderRule?: Record<string, unknown>) => {
  const groupConfigs = asObjectArray(renderRule?.group_configs);
  if (groupConfigs.length > 0) return groupConfigs;
  return asObjectArray(renderRule?.groupConfigs);
};

const patchRenderRule = (renderRule: Record<string, unknown> | undefined, patch: Record<string, unknown>) => {
  const nextRule = { ...(renderRule ?? { type: 'manual' }) };

  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      delete nextRule[key];
      return;
    }

    nextRule[key] = value;
  });

  return nextRule;
};

const syncContextKeyReferences = (schema: TTableContextSchema, oldKey: string, nextKey: string) => {
  if (!oldKey || !nextKey || oldKey === nextKey) return schema;

  const required = Array.from(new Set(schema.required.map((key) => (key === oldKey ? nextKey : key))));
  const renderRule = schema.render_rule
    ? Object.fromEntries(
        Object.entries(schema.render_rule).map(([key, value]) => [key, value === oldKey ? nextKey : value]),
      )
    : undefined;

  return {
    ...schema,
    required,
    render_rule: renderRule,
  };
};

const toOptionalString = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toOptionalNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const stringifyJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const getContextDisplayText = (directValue: unknown, keyedValue: unknown, fallback = '') => {
  if (typeof directValue === 'string' && directValue.trim()) return directValue;
  if (typeof keyedValue === 'string' && keyedValue.trim()) return keyedValue.trim();
  return fallback;
};

const getContextControlKeys = (control: Record<string, unknown>) => {
  const type = getContextControlType(control);
  if (type === 'number' || type === 'record_select' || type === 'text_list') {
    return typeof control.key === 'string' && control.key.trim() ? [control.key.trim()] : [];
  }
  if (type === 'number_pair') {
    const controls = Array.isArray(control.controls)
      ? control.controls.filter((child): child is Record<string, unknown> =>
          Boolean(child && typeof child === 'object' && !Array.isArray(child)),
        )
      : [];
    return controls.map((child) => (typeof child.key === 'string' ? child.key.trim() : '')).filter(Boolean);
  }
  if (type === 'school_list_pair') {
    return [
      typeof control.domestic_key === 'string' && control.domestic_key.trim()
        ? control.domestic_key.trim()
        : 'domestic_comparison_schools',
      typeof control.foreign_key === 'string' && control.foreign_key.trim()
        ? control.foreign_key.trim()
        : 'foreign_comparison_schools',
    ];
  }
  return [];
};

const getTableContextSchema = (tableTemplate: TableTemplate): TTableContextSchema | null => {
  const schema = tableTemplate.context_schema ?? tableTemplate.contextSchema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null;
  const candidate = schema as Partial<TTableContextSchema>;

  return {
    normalizer: typeof candidate.normalizer === 'string' ? candidate.normalizer : undefined,
    render_rule:
      candidate.render_rule && typeof candidate.render_rule === 'object' && !Array.isArray(candidate.render_rule)
        ? normalizeRenderRuleConfig(candidate.render_rule as Record<string, unknown>)
        : undefined,
    required: Array.isArray(candidate.required)
      ? candidate.required.filter((item): item is string => typeof item === 'string')
      : [],
    controls: Array.isArray(candidate.controls)
      ? candidate.controls.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object' && !Array.isArray(item)),
        )
      : [],
  };
};

const createDefaultTableTemplate = (formState: Pick<ITemplateVariableFormState, 'key' | 'label'>): TableTemplate => {
  const template_id = normalizeTableDesignerSlug(formState.key || formState.label);

  return {
    id: template_id,
    name: formState.label || formState.key || 'Bảng mới',
    description: 'Bảng được cấu hình từ quản lý biến mẫu.',
    structure: {
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
      headers: [
        {
          label: 'Nội dung',
          key: 'label',
          width: '40%',
          input_type: 'Data',
        },
        {
          label: 'Giá trị',
          key: 'value',
          width: '60%',
          input_type: 'Data',
        },
      ],
      blocks: [
        {
          id: 'main',
          subsection: null,
          button_config: {
            show_add_row_button: true,
            show_copy_button: true,
            show_delete_button: true,
          },
          row_template: {
            label: {
              value: '',
              is_read_only: false,
            },
            value: {
              value: '',
              is_read_only: false,
            },
          },
          rows: [],
        },
      ],
    },
  };
};

const createFormWithTableDesigner = (form: ITemplateVariableFormState): ITemplateVariableFormState => {
  const tableTemplate = normalizeTableTemplateForDesigner(
    getTableTemplateFromUiConfig(form.ui_config) ?? createDefaultTableTemplate(form),
  );
  const hasConfiguredBlocksRule = isConfiguredBlocksTemplate(tableTemplate);
  const tableBuilder = normalizeTableBuilder(
    hasConfiguredBlocksRule ? null : getTableBuilderFromUiConfig(form.ui_config),
    tableTemplate,
  );
  const compiledTemplate = compileTableBuilderToTemplate(tableBuilder, tableTemplate);

  return {
    ...form,
    ui_config: {
      ...(form.ui_config ?? {}),
      table_builder: tableBuilder,
      table_template: compiledTemplate,
    },
  };
};

const createEmptyTableForm = (): ITemplateVariableFormState => {
  const form: ITemplateVariableFormState = {
    key: '',
    label: '',
    description: '',
    template_types: [],
    variable_type: 'TABLE_VARIABLE',
    input_type: 'Table',
    default_value: '',
    data_source: null,
    ui_config: null,
  };

  return createFormWithTableDesigner(form);
};

const normalizeDefinitionToTableForm = (definition: ITemplateVariableDefinition): ITemplateVariableFormState => {
  const form: ITemplateVariableFormState = {
    id: definition.id,
    key: definition.key,
    label: definition.label,
    description: definition.description ?? '',
    template_types: definition.template_types ?? [],
    variable_type: 'TABLE_VARIABLE',
    input_type: 'Table',
    default_value: '',
    data_source: null,
    ui_config: definition.ui_config ?? null,
  };

  return createFormWithTableDesigner(form);
};

const updateTemplateIdentity = (form: ITemplateVariableFormState): ITemplateVariableFormState => {
  const tableTemplate = normalizeTableTemplateForDesigner(
    getTableTemplateFromUiConfig(form.ui_config) ?? createDefaultTableTemplate(form),
  );
  const tableBuilder = normalizeTableBuilder(getTableBuilderFromUiConfig(form.ui_config), tableTemplate);
  const nextId = normalizeTableDesignerSlug(form.key || form.label);
  const nextName = form.label || form.key || tableTemplate.name;
  const nextBuilder: ITableBuilderConfig = {
    ...tableBuilder,
    id: nextId,
    name: nextName,
    description: form.description || tableBuilder.description,
  };

  return {
    ...form,
    ui_config: {
      ...(form.ui_config ?? {}),
      table_builder: nextBuilder,
      table_template: compileTableBuilderToTemplate(nextBuilder, {
        ...tableTemplate,
        id: nextId,
        name: nextName,
      }),
    },
  };
};

export const TemplateVariableEditorSection = ({ variableId }: ITemplateVariableEditorSectionProps) => {
  const navigate = useNavigate();
  const [schemaCatalog, setSchemaCatalog] = useState<ExactSchemaCatalog>({});
  const [templateTypeOptions, setTemplateTypeOptions] = useState<MetadataOption[]>([]);
  const [form, setForm] = useState<ITemplateVariableFormState>(() => createEmptyTableForm());
  const [loading, setLoading] = useState(Boolean(variableId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [newContextControlType, setNewContextControlType] = useState<TTableContextControlType>('number');
  const [renderRuleJsonDraft, setRenderRuleJsonDraft] = useState('');
  const [renderRuleJsonError, setRenderRuleJsonError] = useState<string | null>(null);

  const selectedTemplateTypes = useMemo(() => sanitizeTemplateTypes(form.template_types), [form.template_types]);
  const tableNames = useMemo(() => Object.keys(schemaCatalog).sort(), [schemaCatalog]);
  const tableTemplate = useMemo(
    () =>
      normalizeTableTemplateForDesigner(
        getTableTemplateFromUiConfig(form.ui_config) ?? createDefaultTableTemplate(form),
      ),
    [form],
  );
  const tableBuilder = useMemo(
    () => normalizeTableBuilder(getTableBuilderFromUiConfig(form.ui_config), tableTemplate),
    [form.ui_config, tableTemplate],
  );
  const tableContextSchema = useMemo(() => getTableContextSchema(tableTemplate), [tableTemplate]);
  const contextControlTypes = useMemo(
    () =>
      tableContextSchema?.controls
        .map((control) => (typeof control.type === 'string' ? control.type : null))
        .filter((controlType): controlType is string => Boolean(controlType)) ?? [],
    [tableContextSchema],
  );
  const renderRule = useMemo(() => tableContextSchema?.render_rule ?? { type: 'manual' }, [tableContextSchema]);
  const renderRuleType = useMemo(() => getRenderRuleType(renderRule), [renderRule]);
  const renderRuleTypeOption = useMemo(() => getRenderRuleTypeOption(renderRuleType), [renderRuleType]);
  const dynamicColumnGroupConfigs = useMemo(() => getDynamicColumnGroupConfigs(renderRule), [renderRule]);
  const tableBlockOptions = useMemo(
    () =>
      (tableTemplate.structure.blocks ?? []).map((block, index) => ({
        value: block.id || `block_${index + 1}`,
        label: block.id
          ? `${index + 1}. ${block.subsection ? 'Dòng tổng' : 'Dòng dữ liệu'} - ${block.id}`
          : `${index + 1}. Block chưa có mã`,
      })),
    [tableTemplate.structure.blocks],
  );
  const parentHeaderOptions = useMemo(
    () =>
      (tableTemplate.structure.headers ?? [])
        .filter((header) => header.is_parent_header)
        .map((header) => ({ value: header.key, label: `${header.label || header.key} (${header.key})` })),
    [tableTemplate.structure.headers],
  );
  const numberControlOptions = useMemo(
    () =>
      (tableContextSchema?.controls ?? [])
        .flatMap((control) => {
          const type = getContextControlType(control);
          if (type === 'number') return [control];
          if (type === 'number_pair') {
            return Array.isArray(control.controls)
              ? control.controls.filter((child): child is Record<string, unknown> =>
                  Boolean(child && typeof child === 'object' && !Array.isArray(child)),
                )
              : [];
          }
          return [];
        })
        .map((control) => {
          const key = typeof control.key === 'string' ? control.key : '';
          return {
            value: key,
            label: getContextDisplayText(control.label, control.label_key, key),
          };
        })
        .filter((option) => option.value),
    [tableContextSchema],
  );
  const schoolListPairControlOptions = useMemo(
    () =>
      (tableContextSchema?.controls ?? [])
        .map((control, index) => ({ control, index, type: getContextControlType(control) }))
        .filter((item) => item.type === 'school_list_pair')
        .map((item) => ({
          value: String(item.index),
          label: getContextDisplayText(item.control.label, item.control.label_key, `Hai danh sách ${item.index + 1}`),
        })),
    [tableContextSchema],
  );
  const pageTitle = form.id ? 'Thiết kế biến bảng' : 'Tạo biến bảng';
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
    setRenderRuleJsonDraft(stringifyJson(renderRule));
    setRenderRuleJsonError(null);
  }, [renderRule]);

  useEffect(() => {
    if (!variableId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getTemplateVariableByIdAPI(variableId)
      .then((definition) => {
        if (cancelled) return;
        if (definition.variable_type !== 'TABLE_VARIABLE') {
          setError('Trang này chỉ dùng để thiết kế biến bảng.');
          return;
        }
        setForm(normalizeDefinitionToTableForm(definition));
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
  }, [variableId]);

  const handleFormChange = (patch: Partial<ITemplateVariableFormState>) => {
    setForm((current) =>
      updateTemplateIdentity({
        ...current,
        ...patch,
      }),
    );
  };

  const handleTableDesignerChange = ({
    tableBuilder: nextBuilder,
    tableTemplate: nextTemplate,
  }: ITableDesignerChangePayload) => {
    setForm((current) => {
      const normalizedNextTemplate = normalizeTableTemplateForDesigner(nextTemplate);
      const hasConfiguredBlocksRule = isConfiguredBlocksTemplate(normalizedNextTemplate);

      return {
        ...current,
        ui_config: {
          ...(current.ui_config ?? {}),
          table_builder: hasConfiguredBlocksRule ? normalizeTableBuilder(null, normalizedNextTemplate) : nextBuilder,
          table_template: normalizedNextTemplate,
        },
      };
    });
  };

  const updateContextSchema = (
    updater: (currentSchema: TTableContextSchema | null, currentTemplate: TableTemplate) => TTableContextSchema | null,
  ) => {
    setForm((current) => {
      const currentTemplate = normalizeTableTemplateForDesigner(
        getTableTemplateFromUiConfig(current.ui_config) ?? createDefaultTableTemplate(current),
      );
      const nextTemplate: TableTemplate = { ...currentTemplate };
      const nextSchema = updater(getTableContextSchema(currentTemplate), currentTemplate);

      if (nextSchema) {
        nextTemplate.context_schema = cloneContextSchema(nextSchema);
        delete nextTemplate.contextSchema;
      } else {
        delete nextTemplate.context_schema;
        delete nextTemplate.contextSchema;
      }

      const normalizedNextTemplate = normalizeTableTemplateForDesigner(nextTemplate);
      const hasConfiguredBlocksRule = isConfiguredBlocksTemplate(normalizedNextTemplate);

      return {
        ...current,
        ui_config: {
          ...(current.ui_config ?? {}),
          table_builder: hasConfiguredBlocksRule
            ? normalizeTableBuilder(null, normalizedNextTemplate)
            : current.ui_config?.table_builder,
          table_template: normalizedNextTemplate,
        },
      };
    });
  };

  const handleCreateContextSchema = () => {
    updateContextSchema((currentSchema) => currentSchema ?? createDefaultContextSchema());
  };

  const handleRemoveContextSchema = () => {
    updateContextSchema(() => null);
  };

  const handleContextSchemaPatch = (patch: Partial<TTableContextSchema>) => {
    updateContextSchema((currentSchema) => ({
      ...(currentSchema ?? createDefaultContextSchema()),
      ...patch,
    }));
  };

  const handleRenderRulePatch = (patch: Record<string, unknown>) => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      const nextRule = patchRenderRule(baseSchema.render_rule, patch);

      return {
        ...baseSchema,
        render_rule: Object.keys(nextRule).length > 0 ? nextRule : undefined,
      };
    });
  };

  const handleApplyRenderRuleJson = () => {
    try {
      const parsed = JSON.parse(renderRuleJsonDraft) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setRenderRuleJsonError('JSON rule phải là object.');
        return;
      }

      setRenderRuleJsonError(null);
      handleContextSchemaPatch({ render_rule: normalizeRenderRuleConfig(parsed as Record<string, unknown>) });
    } catch (jsonError) {
      setRenderRuleJsonError(getErrorMessage(jsonError));
    }
  };

  const handleRenderRuleTypeChange = (nextType: TTableRenderRuleType) => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      const currentRule = baseSchema.render_rule ?? {};

      if (nextType === 'manual') {
        return {
          ...baseSchema,
          render_rule: { type: 'manual' },
        };
      }

      if (nextType === 'repeat_blocks') {
        const countKey =
          typeof currentRule.count_key === 'string' && currentRule.count_key.trim()
            ? currentRule.count_key
            : numberControlOptions[0]?.value || 'semester_count';
        const sourceBlockIds = asStringArray(currentRule.source_block_ids);

        return ensureRequiredKeys(
          {
            ...baseSchema,
            controls:
              numberControlOptions.length > 0
                ? baseSchema.controls
                : [
                    ...baseSchema.controls,
                    {
                      ...createDefaultContextControl('number'),
                      key: countKey,
                      label: 'Số học kỳ trước đó',
                      description: 'Hệ thống sinh block học kỳ theo số đã nhập.',
                      placeholder: 'Ví dụ: 2',
                    },
                  ],
            render_rule: {
              ...currentRule,
              type: nextType,
              label: currentRule.label ?? 'Lặp block theo số',
              description: currentRule.description ?? 'Sinh lại các block mẫu theo số user nhập.',
              count_key: countKey,
              source_block_ids:
                sourceBlockIds.length > 0
                  ? sourceBlockIds
                  : tableBlockOptions.slice(0, 2).map((option) => option.value),
              index_start: typeof currentRule.index_start === 'number' ? currentRule.index_start : 1,
              source_index: typeof currentRule.source_index === 'number' ? currentRule.source_index : 1,
              replacements: Array.isArray(currentRule.replacements)
                ? currentRule.replacements
                : [
                    { from: 'semester_1', to: 'semester_{{index}}' },
                    { from: 'Học kỳ 1', to: 'Học kỳ {{index}}' },
                  ],
            },
          },
          [countKey],
        );
      }

      if (nextType === 'comparison_columns') {
        const existingPairIndex = schoolListPairControlOptions[0]?.value;
        const hasPairControl = existingPairIndex !== undefined;
        const domesticKey =
          typeof currentRule.domestic_key === 'string' && currentRule.domestic_key.trim()
            ? currentRule.domestic_key
            : 'domestic_comparison_schools';
        const foreignKey =
          typeof currentRule.foreign_key === 'string' && currentRule.foreign_key.trim()
            ? currentRule.foreign_key
            : 'foreign_comparison_schools';

        return ensureRequiredKeys(
          {
            ...baseSchema,
            controls: hasPairControl
              ? baseSchema.controls
              : [
                  ...baseSchema.controls,
                  {
                    ...createDefaultContextControl('school_list_pair'),
                    domestic_key: domesticKey,
                    foreign_key: foreignKey,
                    label: 'Danh sách trường so sánh',
                  },
                ],
            render_rule: {
              ...currentRule,
              type: nextType,
              label: currentRule.label ?? 'Sinh cột theo danh sách trường',
              description: currentRule.description ?? 'Sinh nhóm cột từ danh sách trường trong nước và nước ngoài.',
              domestic_key: domesticKey,
              foreign_key: foreignKey,
              domestic_input_key:
                typeof currentRule.domestic_input_key === 'string'
                  ? currentRule.domestic_input_key
                  : 'domestic_comparison_input',
              foreign_input_key:
                typeof currentRule.foreign_input_key === 'string'
                  ? currentRule.foreign_input_key
                  : 'foreign_comparison_input',
              domestic_parent_key:
                typeof currentRule.domestic_parent_key === 'string'
                  ? currentRule.domestic_parent_key
                  : parentHeaderOptions[0]?.value,
              foreign_parent_key:
                typeof currentRule.foreign_parent_key === 'string'
                  ? currentRule.foreign_parent_key
                  : parentHeaderOptions[1]?.value || parentHeaderOptions[0]?.value,
              max_columns_per_group:
                typeof currentRule.max_columns_per_group === 'number' ? currentRule.max_columns_per_group : 20,
            },
          },
          [domesticKey, foreignKey],
        );
      }

      if (nextType === 'dynamic_column_group') {
        const countKey =
          typeof currentRule.count_key === 'string' && currentRule.count_key.trim()
            ? currentRule.count_key
            : numberControlOptions[0]?.value || 'plo_column_count';

        return ensureRequiredKeys(
          {
            ...baseSchema,
            controls:
              numberControlOptions.length > 0
                ? baseSchema.controls
                : [
                    ...baseSchema.controls,
                    {
                      ...createDefaultContextControl('number'),
                      key: countKey,
                      label: 'Số cột PLO',
                      placeholder: 'Ví dụ: 8',
                    },
                  ],
            render_rule: {
              ...currentRule,
              type: nextType,
              label: currentRule.label ?? 'Sinh cột PLO',
              count_key: countKey,
              fixed_column_keys: currentRule.fixed_column_keys ?? ['stt', 'course_code', 'course_name'],
              stt_key: currentRule.stt_key ?? 'stt',
              plo_parent_key: currentRule.plo_parent_key ?? 'plo_group',
              plo_column_prefix: currentRule.plo_column_prefix ?? 'plo_',
              plo_placeholder_key: currentRule.plo_placeholder_key ?? 'plo_placeholder',
              course_code_key: currentRule.course_code_key ?? 'course_code',
              course_name_key: currentRule.course_name_key ?? 'course_name',
              course_code_table_field: currentRule.course_code_table_field ?? 'courses.code',
              course_name_table_field: currentRule.course_name_table_field ?? 'courses.name',
              trigger_field: currentRule.trigger_field ?? 'course_name',
              primary_table: currentRule.primary_table ?? 'courses',
              join_table: currentRule.join_table ?? 'courses',
              plo_group_width: currentRule.plo_group_width ?? 40,
            },
          },
          [countKey],
        );
      }

      if (nextType === 'dynamic_matrix') {
        const rowKey =
          typeof currentRule.row_count_key === 'string' && currentRule.row_count_key.trim()
            ? currentRule.row_count_key
            : 'clo_count';
        const columnKey =
          typeof currentRule.column_count_key === 'string' && currentRule.column_count_key.trim()
            ? currentRule.column_count_key
            : 'plo_count';

        return ensureRequiredKeys(
          {
            ...baseSchema,
            controls:
              numberControlOptions.length >= 2
                ? baseSchema.controls
                : [
                    ...baseSchema.controls,
                    {
                      ...createDefaultContextControl('number_pair'),
                      label: 'Số dòng/cột ma trận',
                      controls: [
                        { type: 'number', key: rowKey, label: 'Số CLO', min: 1 },
                        { type: 'number', key: columnKey, label: 'Số PLO', min: 1 },
                      ],
                    },
                  ],
            render_rule: {
              ...currentRule,
              type: nextType,
              label: currentRule.label ?? 'Sinh matrix hàng/cột',
              row_count_key: rowKey,
              column_count_key: columnKey,
              block_id: currentRule.block_id ?? tableBlockOptions[0]?.value ?? 'matrix_block',
              clo_column_key: currentRule.clo_column_key ?? 'clo_code',
              plo_parent_key: currentRule.plo_parent_key ?? 'plo_group',
              plo_column_prefix: currentRule.plo_column_prefix ?? 'plo_',
              row_id_prefix: currentRule.row_id_prefix ?? 'row_clo_',
            },
          },
          [rowKey, columnKey],
        );
      }

      return {
        ...baseSchema,
        render_rule: {
          ...currentRule,
          type: nextType,
          label: currentRule.label ?? getRenderRuleTypeOption(nextType).label,
          description: currentRule.description ?? getRenderRuleTypeOption(nextType).description,
        },
      };
    });
  };

  const handleContextControlPatch = (index: number, patch: Record<string, unknown>) => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      let nextSchema = baseSchema;
      const controls = baseSchema.controls.map((control, controlIndex) => {
        if (controlIndex !== index) return control;

        const previousKeys = getContextControlKeys(control);
        const nextControl = { ...control, ...patch };
        const nextKeys = getContextControlKeys(nextControl);
        nextSchema = syncContextKeyReferences(nextSchema, previousKeys[0] ?? '', nextKeys[0] ?? '');

        return nextControl;
      });

      return {
        ...nextSchema,
        controls,
      };
    });
  };

  const handleContextControlTypeChange = (index: number, type: TTableContextControlType) => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      const controls = baseSchema.controls.map((control, controlIndex) =>
        controlIndex === index ? createDefaultContextControl(type) : control,
      );

      return {
        ...baseSchema,
        controls,
      };
    });
  };

  const handleNumberPairChildPatch = (index: number, childIndex: number, patch: Record<string, unknown>) => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      let nextSchema = baseSchema;
      const controls = baseSchema.controls.map((control, controlIndex) => {
        if (controlIndex !== index) return control;

        const children = Array.isArray(control.controls)
          ? control.controls.filter((child): child is Record<string, unknown> =>
              Boolean(child && typeof child === 'object' && !Array.isArray(child)),
            )
          : [];
        const nextChildren: Array<Record<string, unknown>> = [0, 1].map((childPosition) => ({
          ...(children[childPosition] ?? {
            type: 'number',
            key: childPosition === 0 ? 'firstCount' : 'secondCount',
            min: 1,
          }),
          ...(childPosition === childIndex ? patch : {}),
          type: 'number',
        }));

        const previousKey = typeof children[childIndex]?.key === 'string' ? children[childIndex].key.trim() : '';
        const nextKey = typeof nextChildren[childIndex]?.key === 'string' ? nextChildren[childIndex].key.trim() : '';
        nextSchema = syncContextKeyReferences(nextSchema, previousKey, nextKey);

        return {
          ...control,
          controls: nextChildren,
        };
      });

      return {
        ...nextSchema,
        controls,
      };
    });
  };

  const handleAddContextControl = () => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      return {
        ...baseSchema,
        controls: [...baseSchema.controls, createDefaultContextControl(newContextControlType)],
      };
    });
  };

  const handleRemoveContextControl = (index: number) => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      return {
        ...baseSchema,
        controls: baseSchema.controls.filter((_, controlIndex) => controlIndex !== index),
      };
    });
  };

  const handleContextControlRequiredChange = (control: Record<string, unknown>, checked: boolean) => {
    const keys = getContextControlKeys(control);
    if (keys.length === 0) return;

    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      const requiredSet = new Set(baseSchema.required);
      keys.forEach((key) => {
        if (checked) {
          requiredSet.add(key);
        } else {
          requiredSet.delete(key);
        }
      });

      return {
        ...baseSchema,
        required: Array.from(requiredSet),
      };
    });
  };

  const handleRenderRuleContextKeyPatch = (ruleKey: string, nextKey: string) => {
    handleRenderRulePatch({ [ruleKey]: nextKey });
    if (!nextKey) return;

    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      return ensureRequiredKeys(baseSchema, [nextKey]);
    });
  };

  const handleDynamicColumnGroupConfigPatch = (index: number, patch: Record<string, unknown>) => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      const currentRule = baseSchema.render_rule ?? { type: 'dynamic_column_group' };
      const groupConfigs = getDynamicColumnGroupConfigs(currentRule);
      const previousCountKey =
        typeof groupConfigs[index]?.count_key === 'string' ? groupConfigs[index].count_key.trim() : '';
      const nextGroupConfigs = groupConfigs.map((config, configIndex) =>
        configIndex === index ? patchRenderRule(config, patch) : config,
      );
      const nextCountKey =
        typeof nextGroupConfigs[index]?.count_key === 'string' ? nextGroupConfigs[index].count_key.trim() : '';
      let nextSchema: TTableContextSchema = {
        ...baseSchema,
        render_rule: patchRenderRule(currentRule, { group_configs: nextGroupConfigs }),
      };

      if (previousCountKey && nextCountKey && previousCountKey !== nextCountKey) {
        nextSchema = syncContextKeyReferences(nextSchema, previousCountKey, nextCountKey);
      }

      return nextCountKey ? ensureRequiredKeys(nextSchema, [nextCountKey]) : nextSchema;
    });
  };

  const handleAddDynamicColumnGroupConfig = () => {
    updateContextSchema((currentSchema) => {
      const baseSchema = currentSchema ?? createDefaultContextSchema();
      const currentRule = baseSchema.render_rule ?? { type: 'dynamic_column_group' };
      const groupConfigs = getDynamicColumnGroupConfigs(currentRule);
      const index = groupConfigs.length + 1;
      const parentOption = parentHeaderOptions.find(
        (option) => !groupConfigs.some((config) => config.parent_key === option.value),
      );
      const countOption = numberControlOptions.find(
        (option) => !groupConfigs.some((config) => config.count_key === option.value),
      );
      const nextCountKey = countOption?.value || `plo_group_${index}_count`;
      const nextGroupConfigs = [
        ...groupConfigs,
        {
          parent_key: parentOption?.value || `plo_group_${index}`,
          parent_label: parentOption?.label || `Nhóm PLO ${index}`,
          column_prefix: `plo_${index}_`,
          count_key: nextCountKey,
          label_prefix: 'PLO',
          label_start: 1,
          group_width: 40,
          default_count: 1,
        },
      ];
      const nextSchema: TTableContextSchema = {
        ...baseSchema,
        render_rule: patchRenderRule(currentRule, { group_configs: nextGroupConfigs }),
      };

      return ensureRequiredKeys(nextSchema, [nextCountKey]);
    });
  };

  const handleRemoveDynamicColumnGroupConfig = (index: number) => {
    handleRenderRulePatch({
      group_configs: dynamicColumnGroupConfigs.filter((_, configIndex) => configIndex !== index),
    });
  };

  const handleRepeatSourceBlocksChange = (sourceBlockIds: string[]) => {
    handleRenderRulePatch({ source_block_ids: sourceBlockIds });
  };

  const getRepeatReplacements = () => {
    const replacements = renderRule.replacements;
    return Array.isArray(replacements)
      ? replacements
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const candidate = item as Record<string, unknown>;
            return {
              from: typeof candidate.from === 'string' ? candidate.from : '',
              to: typeof candidate.to === 'string' ? candidate.to : '',
            };
          })
          .filter((item): item is { from: string; to: string } => Boolean(item))
      : [];
  };

  const handleRepeatReplacementPatch = (index: number, patch: Partial<{ from: string; to: string }>) => {
    const replacements = getRepeatReplacements();
    const nextReplacements = replacements.map((replacement, replacementIndex) =>
      replacementIndex === index ? { ...replacement, ...patch } : replacement,
    );
    handleRenderRulePatch({ replacements: nextReplacements });
  };

  const handleAddRepeatReplacement = () => {
    handleRenderRulePatch({
      replacements: [...getRepeatReplacements(), { from: '1', to: '{{index}}' }],
    });
  };

  const handleRemoveRepeatReplacement = (index: number) => {
    handleRenderRulePatch({
      replacements: getRepeatReplacements().filter((_, replacementIndex) => replacementIndex !== index),
    });
  };

  const handleSchoolListControlSelection = (value: string) => {
    const selectedControl = tableContextSchema?.controls[Number(value)];
    if (!selectedControl || getContextControlType(selectedControl) !== 'school_list_pair') return;

    handleContextSchemaPatch({
      render_rule: patchRenderRule(renderRule, {
        domestic_key:
          typeof selectedControl.domestic_key === 'string'
            ? selectedControl.domestic_key
            : 'domestic_comparison_schools',
        foreign_key:
          typeof selectedControl.foreign_key === 'string' ? selectedControl.foreign_key : 'foreign_comparison_schools',
        domestic_input_key:
          typeof selectedControl.domestic_input_key === 'string'
            ? selectedControl.domestic_input_key
            : 'domestic_comparison_input',
        foreign_input_key:
          typeof selectedControl.foreign_input_key === 'string'
            ? selectedControl.foreign_input_key
            : 'foreign_comparison_input',
      }),
    });
  };

  const renderContextControlBaseFields = (control: Record<string, unknown>, index: number) => (
    <>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tên hiển thị</span>
        <Input
          value={getContextDisplayText(control.label, control.label_key, '')}
          onChange={(event) => handleContextControlPatch(index, { label: toOptionalString(event.target.value) })}
          placeholder="Chọn chương trình đào tạo"
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mô tả hướng dẫn</span>
        <Input
          value={getContextDisplayText(control.description, control.description_key, '')}
          onChange={(event) => handleContextControlPatch(index, { description: toOptionalString(event.target.value) })}
          placeholder="Chọn bản ghi làm nguồn dữ liệu cho bảng này"
        />
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={getContextControlKeys(control).every((key) => tableContextSchema?.required.includes(key))}
          onChange={(event) => handleContextControlRequiredChange(control, event.target.checked)}
        />
        Bắt buộc nhập trước khi render
      </label>
    </>
  );

  const renderNumberControlFields = (
    control: Record<string, unknown>,
    onPatch: (patch: Record<string, unknown>) => void,
  ) => (
    <>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mã lưu dữ liệu</span>
        <Input
          value={String(control.key ?? '')}
          onChange={(event) => onPatch({ key: event.target.value.trim() })}
          placeholder="semester_count"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Min</span>
          <Input
            type="number"
            value={control.min === undefined ? '' : String(control.min)}
            onChange={(event) => onPatch({ min: toOptionalNumber(event.target.value) })}
            placeholder="1"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Max</span>
          <Input
            type="number"
            value={control.max === undefined ? '' : String(control.max)}
            onChange={(event) => onPatch({ max: toOptionalNumber(event.target.value) })}
            placeholder="20"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Gợi ý nhập</span>
        <Input
          value={getContextDisplayText(control.placeholder, control.placeholder_key, '')}
          onChange={(event) => onPatch({ placeholder: toOptionalString(event.target.value) })}
          placeholder="Ví dụ: 2"
        />
      </div>
    </>
  );

  const renderContextControlEditor = (control: Record<string, unknown>, index: number) => {
    const controlType = getContextControlType(control);
    const numberPairChildren = Array.isArray(control.controls)
      ? control.controls.filter((child): child is Record<string, unknown> =>
          Boolean(child && typeof child === 'object' && !Array.isArray(child)),
        )
      : [];

    return (
      <div key={`${index}-${controlType}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">{getContextControlTitle(control, index)}</div>
          <Button type="button" variant="outline" onClick={() => handleRemoveContextControl(index)}>
            <Trash2 className="size-4 text-red-500" />
            Xoá
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kiểu câu hỏi</span>
            <Select
              value={controlType}
              onValueChange={(nextType) => handleContextControlTypeChange(index, nextType as TTableContextControlType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTEXT_CONTROL_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {renderContextControlBaseFields(control, index)}

          {controlType === 'number' &&
            renderNumberControlFields(control, (patch) => handleContextControlPatch(index, patch))}

          {controlType === 'text_list' && (
            <>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mã lưu dữ liệu</span>
                <Input
                  value={String(control.key ?? '')}
                  onChange={(event) => handleContextControlPatch(index, { key: event.target.value.trim() })}
                  placeholder="items"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mã input thô</span>
                <Input
                  value={String(control.input_key ?? '')}
                  onChange={(event) =>
                    handleContextControlPatch(index, { input_key: toOptionalString(event.target.value) })
                  }
                  placeholder="itemsInput"
                />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Gợi ý nhập</span>
                <Textarea
                  value={getContextDisplayText(control.placeholder, control.placeholder_key, '')}
                  onChange={(event) =>
                    handleContextControlPatch(index, { placeholder: toOptionalString(event.target.value) })
                  }
                  rows={2}
                  placeholder={'Giá trị 1\nGiá trị 2\nGiá trị 3'}
                />
              </div>
            </>
          )}

          {controlType === 'record_select' && (
            <>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mã lưu dữ liệu</span>
                <Input
                  value={String(control.key ?? '')}
                  onChange={(event) => handleContextControlPatch(index, { key: event.target.value.trim() })}
                  placeholder="academic_program_id"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Bảng nguồn</span>
                <Input
                  value={String(control.table ?? '')}
                  onChange={(event) => handleContextControlPatch(index, { table: event.target.value.trim() })}
                  placeholder={tableNames[0] || 'academic_programs'}
                  list="table-context-schema-tables"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Field lưu giá trị
                </span>
                <Input
                  value={String(control.value_field ?? '')}
                  onChange={(event) =>
                    handleContextControlPatch(index, { value_field: toOptionalString(event.target.value) })
                  }
                  placeholder="_id"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Field hiển thị</span>
                <Input
                  value={String(control.label_field ?? '')}
                  onChange={(event) =>
                    handleContextControlPatch(index, { label_field: toOptionalString(event.target.value) })
                  }
                  placeholder="name"
                />
              </div>
            </>
          )}

          {controlType === 'number_pair' && (
            <div className="grid gap-3 lg:col-span-2 lg:grid-cols-2">
              {[0, 1].map((childIndex) => {
                const child = numberPairChildren[childIndex] ?? {
                  type: 'number',
                  key: childIndex === 0 ? 'firstCount' : 'secondCount',
                  min: 1,
                };

                return (
                  <div key={childIndex} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Ô nhập số {childIndex + 1}
                    </div>
                    <div className="space-y-3">
                      {renderNumberControlFields(child, (patch) =>
                        handleNumberPairChildPatch(index, childIndex, patch),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {controlType === 'school_list_pair' && (
            <>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Nhãn danh sách 1
                </span>
                <Input
                  value={getContextDisplayText(control.domestic_label, control.domestic_label_key, '')}
                  onChange={(event) =>
                    handleContextControlPatch(index, { domestic_label: toOptionalString(event.target.value) })
                  }
                  placeholder="Trường trong nước"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Nhãn danh sách 2
                </span>
                <Input
                  value={getContextDisplayText(control.foreign_label, control.foreign_label_key, '')}
                  onChange={(event) =>
                    handleContextControlPatch(index, { foreign_label: toOptionalString(event.target.value) })
                  }
                  placeholder="Trường nước ngoài"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Gợi ý danh sách 1
                </span>
                <Input
                  value={getContextDisplayText(control.domestic_placeholder, control.domestic_placeholder_key, '')}
                  onChange={(event) =>
                    handleContextControlPatch(index, { domestic_placeholder: toOptionalString(event.target.value) })
                  }
                  placeholder="ĐH A, ĐH B, ĐH C"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Gợi ý danh sách 2
                </span>
                <Input
                  value={getContextDisplayText(control.foreign_placeholder, control.foreign_placeholder_key, '')}
                  onChange={(event) =>
                    handleContextControlPatch(index, { foreign_placeholder: toOptionalString(event.target.value) })
                  }
                  placeholder="University A, University B, University C"
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderRuleBuilder = () => {
    const repeatSourceBlockIds = asStringArray(renderRule.source_block_ids);
    const repeatReplacements = getRepeatReplacements();
    const selectedSchoolPairOption = schoolListPairControlOptions.find((option) => {
      const control = tableContextSchema?.controls[Number(option.value)];
      if (!control || getContextControlType(control) !== 'school_list_pair') return false;
      const domesticKey =
        typeof control.domestic_key === 'string' ? control.domestic_key : 'domestic_comparison_schools';
      const foreignKey = typeof control.foreign_key === 'string' ? control.foreign_key : 'foreign_comparison_schools';
      return renderRule.domestic_key === domesticKey && renderRule.foreign_key === foreignKey;
    });

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-900">Luật render</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Chọn cách hệ thống sinh bảng từ dữ liệu user nhập. Mỗi biến bảng có rule riêng trong JSON của chính biến đó.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Kiểu rule</span>
            <Select
              value={renderRuleType}
              onValueChange={(value) => handleRenderRuleTypeChange(value as TTableRenderRuleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_RENDER_RULE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500">{renderRuleTypeOption.description}</p>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tên rule</span>
            <Input
              value={typeof renderRule.label === 'string' ? renderRule.label : ''}
              onChange={(event) => handleRenderRulePatch({ label: toOptionalString(event.target.value) })}
              placeholder={renderRuleTypeOption.label}
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mô tả rule</span>
            <Textarea
              value={typeof renderRule.description === 'string' ? renderRule.description : ''}
              onChange={(event) => handleRenderRulePatch({ description: toOptionalString(event.target.value) })}
              rows={2}
              placeholder={renderRuleTypeOption.description}
            />
          </div>
        </div>

        {renderRuleType === 'manual' && (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm leading-6 text-slate-500">
            Không sinh cấu trúc tự động. User sẽ nhập hoặc thêm dòng trực tiếp trong bảng khi gán biến vào template.
          </div>
        )}

        {renderRuleType === 'repeat_blocks' && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Câu hỏi số lần lặp
              </span>
              <Select
                value={String(renderRule.count_key ?? '')}
                onValueChange={(value) => handleRenderRuleContextKeyPatch('count_key', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn câu hỏi số" />
                </SelectTrigger>
                <SelectContent>
                  {numberControlOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Bắt đầu từ</span>
                <Input
                  type="number"
                  value={String(renderRule.index_start ?? 1)}
                  onChange={(event) =>
                    handleRenderRulePatch({ index_start: toOptionalNumber(event.target.value) ?? 1 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Mẫu gốc số</span>
                <Input
                  type="number"
                  value={String(renderRule.source_index ?? 1)}
                  onChange={(event) =>
                    handleRenderRulePatch({ source_index: toOptionalNumber(event.target.value) ?? 1 })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Block mẫu được lặp
              </span>
              <SearchableMultiSelect
                options={tableBlockOptions}
                value={repeatSourceBlockIds}
                placeholder="Chọn block mẫu"
                searchPlaceholder="Tìm block..."
                emptyMessage="Chưa có block trong bảng"
                maxHeight="220px"
                maxDisplay={5}
                onValueChange={handleRepeatSourceBlocksChange}
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Pattern đổi tên/id khi sinh block
                </span>
                <Button type="button" variant="outline" onClick={handleAddRepeatReplacement}>
                  <Plus className="size-4" />
                  Thêm pattern
                </Button>
              </div>
              {repeatReplacements.length > 0 ? (
                <div className="space-y-2">
                  {repeatReplacements.map((replacement, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 lg:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={replacement.from}
                        onChange={(event) => handleRepeatReplacementPatch(index, { from: event.target.value })}
                        placeholder="semester_1"
                      />
                      <Input
                        value={replacement.to}
                        onChange={(event) => handleRepeatReplacementPatch(index, { to: event.target.value })}
                        placeholder="semester_{{index}}"
                      />
                      <Button type="button" variant="outline" onClick={() => handleRemoveRepeatReplacement(index)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                  Chưa có pattern. Thêm pattern để đổi `semester_1` thành `semester_2`, `Học kỳ 1` thành `Học kỳ 2`.
                </div>
              )}
            </div>
          </div>
        )}

        {renderRuleType === 'comparison_columns' && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Câu hỏi danh sách
              </span>
              <Select value={selectedSchoolPairOption?.value ?? ''} onValueChange={handleSchoolListControlSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn câu hỏi hai danh sách" />
                </SelectTrigger>
                <SelectContent>
                  {schoolListPairControlOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Số cột tối đa mỗi nhóm
              </span>
              <Input
                type="number"
                min={1}
                value={String(renderRule.max_columns_per_group ?? 20)}
                onChange={(event) =>
                  handleRenderRulePatch({ max_columns_per_group: toOptionalNumber(event.target.value) ?? 20 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Nhóm cột trong nước
              </span>
              <Select
                value={String(renderRule.domestic_parent_key ?? '')}
                onValueChange={(value) => handleRenderRulePatch({ domestic_parent_key: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhóm header" />
                </SelectTrigger>
                <SelectContent>
                  {parentHeaderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Nhóm cột nước ngoài
              </span>
              <Select
                value={String(renderRule.foreign_parent_key ?? '')}
                onValueChange={(value) => handleRenderRulePatch({ foreign_parent_key: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhóm header" />
                </SelectTrigger>
                <SelectContent>
                  {parentHeaderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {renderRuleType === 'dynamic_column_group' && (
          <div className="mt-4 space-y-3">
            {dynamicColumnGroupConfigs.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Nhóm cột động
                  </span>
                  <Button type="button" variant="outline" onClick={handleAddDynamicColumnGroupConfig}>
                    <Plus className="size-4" />
                    Thêm nhóm
                  </Button>
                </div>
                {dynamicColumnGroupConfigs.map((config, index) => (
                  <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">Nhóm PLO {index + 1}</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleRemoveDynamicColumnGroupConfig(index)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Header cha
                        </span>
                        <Select
                          value={typeof config.parent_key === 'string' ? config.parent_key : ''}
                          onValueChange={(value) =>
                            handleDynamicColumnGroupConfigPatch(index, {
                              parent_key: value,
                              parent_label:
                                parentHeaderOptions.find((option) => option.value === value)?.label ??
                                config.parent_label,
                            })
                          }>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn nhóm header" />
                          </SelectTrigger>
                          <SelectContent>
                            {parentHeaderOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Tên nhóm
                        </span>
                        <Input
                          value={typeof config.parent_label === 'string' ? config.parent_label : ''}
                          onChange={(event) =>
                            handleDynamicColumnGroupConfigPatch(index, {
                              parent_label: toOptionalString(event.target.value),
                            })
                          }
                          placeholder="Kiến thức"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Câu hỏi số cột
                        </span>
                        <Select
                          value={typeof config.count_key === 'string' ? config.count_key : ''}
                          onValueChange={(value) => handleDynamicColumnGroupConfigPatch(index, { count_key: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn câu hỏi số" />
                          </SelectTrigger>
                          <SelectContent>
                            {numberControlOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Prefix key cột
                        </span>
                        <Input
                          value={typeof config.column_prefix === 'string' ? config.column_prefix : ''}
                          onChange={(event) =>
                            handleDynamicColumnGroupConfigPatch(index, {
                              column_prefix: toOptionalString(event.target.value),
                            })
                          }
                          placeholder="plo_k"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Prefix label
                        </span>
                        <Input
                          value={typeof config.label_prefix === 'string' ? config.label_prefix : ''}
                          onChange={(event) =>
                            handleDynamicColumnGroupConfigPatch(index, {
                              label_prefix: toOptionalString(event.target.value),
                            })
                          }
                          placeholder="PLO"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Label bắt đầu
                        </span>
                        <Input
                          type="number"
                          min={1}
                          value={String(config.label_start ?? '')}
                          onChange={(event) =>
                            handleDynamicColumnGroupConfigPatch(index, {
                              label_start: toOptionalNumber(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Độ rộng nhóm
                        </span>
                        <Input
                          type="number"
                          min={1}
                          value={String(config.group_width ?? '')}
                          onChange={(event) =>
                            handleDynamicColumnGroupConfigPatch(index, {
                              group_width: toOptionalNumber(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Số mặc định
                        </span>
                        <Input
                          type="number"
                          min={1}
                          value={String(config.default_count ?? '')}
                          onChange={(event) =>
                            handleDynamicColumnGroupConfigPatch(index, {
                              default_count: toOptionalNumber(event.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Câu hỏi số cột</span>
                <Select
                  value={String(renderRule.count_key ?? '')}
                  onValueChange={(value) => handleRenderRuleContextKeyPatch('count_key', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn câu hỏi số" />
                  </SelectTrigger>
                  <SelectContent>
                    {numberControlOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={handleAddDynamicColumnGroupConfig}>
                  <Plus className="size-4" />
                  Dùng nhiều nhóm cột
                </Button>
              </div>
            )}
          </div>
        )}

        {renderRuleType === 'dynamic_matrix' && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Câu hỏi số dòng</span>
              <Select
                value={String(renderRule.row_count_key ?? '')}
                onValueChange={(value) => handleRenderRuleContextKeyPatch('row_count_key', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn câu hỏi số dòng" />
                </SelectTrigger>
                <SelectContent>
                  {numberControlOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Câu hỏi số cột</span>
              <Select
                value={String(renderRule.column_count_key ?? '')}
                onValueChange={(value) => handleRenderRuleContextKeyPatch('column_count_key', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn câu hỏi số cột" />
                </SelectTrigger>
                <SelectContent>
                  {numberControlOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {renderRuleType === 'configured_blocks' && (
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-800">
            Rule này dùng cấu hình block trong JSON nâng cao để chuẩn hoá khung CTĐT. Cấu hình dòng tổng nằm ở tab{' '}
            <span className="font-semibold">Dòng</span>, chọn từng section rồi chỉnh panel Thuộc tính.
          </div>
        )}
      </div>
    );
  };

  const validateForm = () => {
    if (!VARIABLE_KEY_PATTERN.test(form.key.trim())) {
      return 'Mã biến phải có dạng nhóm.trường, ví dụ academic_programs.teachingPlanTable.';
    }
    if (!form.label.trim()) {
      return 'Vui lòng nhập nhãn hiển thị.';
    }
    if (selectedTemplateTypes.length === 0) {
      return 'Vui lòng chọn ít nhất một loại mẫu.';
    }
    if (tableTemplate.structure.headers.length === 0) {
      return 'Bảng cần có ít nhất một cột.';
    }
    if ((tableTemplate.structure.blocks ?? []).length === 0) {
      return 'Bảng cần có ít nhất một block dòng.';
    }

    const seenHeaderKeys = new Set<string>();
    for (const header of tableTemplate.structure.headers) {
      if (!HEADER_KEY_PATTERN.test(header.key)) {
        return `Mã header "${header.key}" không hợp lệ. Chỉ dùng chữ, số và dấu gạch dưới.`;
      }
      if (seenHeaderKeys.has(header.key)) {
        return `Mã header "${header.key}" bị trùng.`;
      }
      seenHeaderKeys.add(header.key);
      if (header.computed_type && (!Array.isArray(header.computed_from) || header.computed_from.length === 0)) {
        return `Cột "${header.label || header.key}" cần chọn cột nguồn tính toán.`;
      }
      if (
        header.computed_type === 'percent' &&
        Array.isArray(header.computed_from) &&
        header.computed_from.length < 2
      ) {
        return `Cột "${header.label || header.key}" kiểu Percent cần chọn tử số và mẫu số.`;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        key: form.key.trim(),
        label: form.label.trim(),
        description: form.description.trim() || null,
        template_types: selectedTemplateTypes,
        variable_type: 'TABLE_VARIABLE' as const,
        input_type: 'Table' as const,
        default_value: null,
        data_source: null,
        ui_config: {
          ...(form.ui_config ?? {}),
          table_builder: tableBuilder,
          table_template: tableTemplate,
        },
      };

      const saved = form.id
        ? await updateTemplateVariableAPI(form.id, payload)
        : await createTemplateVariableAPI(payload);

      setForm(normalizeDefinitionToTableForm(saved));
      if (!form.id) {
        await navigate({
          to: '/template-variables/$id',
          params: { id: saved.id },
          search: { variable_type: 'TABLE_VARIABLE' },
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
              <span className="font-medium">Quản lý tài liệu</span>
            </span>
            <span className="text-gray-400">›</span>
            <button
              type="button"
              onClick={() => navigate({ to: '/template-variables' })}
              className="font-medium text-slate-500 hover:text-[#0B2559]">
              Biến mẫu
            </button>
            <span className="text-gray-400">›</span>
            <button
              type="button"
              onClick={() => navigate({ to: '/template-variables/tables' })}
              className="font-medium text-slate-500 hover:text-[#0B2559]">
              Biến bảng
            </button>
            <span className="text-gray-400">›</span>
            <span className="text-gray-500">{pageTitle}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: '/template-variables/tables' })}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#0B2559]">
            <ArrowLeft className="size-4" />
            Về danh sách biến bảng
          </button>
          <div className="text-3xl font-bold text-[#0B2559]">{pageTitle}</div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            User chỉnh bằng UI. Hệ thống tự sinh `table_builder` để mở lại chỉnh và `table_template` chuẩn để template
            document render.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={TABLE_RULE_GUIDE_PATH} target="_blank" rel="noreferrer">
              <BookOpen className="size-4" />
              Docs cấu hình
            </a>
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowJson((current) => !current)}>
            {showJson ? 'Ẩn chế độ kỹ thuật' : 'Chế độ kỹ thuật'}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? 'Đang lưu...' : 'Lưu biến bảng'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Database className="size-4 text-[#174A86]" />
          Thông tin biến
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Mã biến</span>
            <Input
              value={form.key}
              onChange={(event) => handleFormChange({ key: event.target.value })}
              placeholder="academic_programs.teachingPlanTable"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Nhãn hiển thị</span>
            <Input
              value={form.label}
              onChange={(event) => handleFormChange({ label: event.target.value })}
              placeholder="Bảng kế hoạch giảng dạy"
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Loại mẫu</span>
            <SearchableMultiSelect
              value={selectedTemplateTypes}
              options={templateTypeOptionsWithFallback}
              placeholder="Chọn loại mẫu"
              searchPlaceholder="Tìm loại mẫu..."
              emptyMessage="Không có loại mẫu phù hợp."
              enableSelectAll
              selectAllLabel={ALL_TEMPLATE_TYPES_LABEL}
              maxHeight="280px"
              maxDisplay={4}
              onValueChange={(values) => handleFormChange({ template_types: values })}
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Mô tả</span>
            <Textarea
              value={form.description}
              onChange={(event) => handleFormChange({ description: event.target.value })}
              rows={2}
              placeholder="Ghi chú cách dùng biến bảng này..."
            />
          </div>
        </div>
      </div>

      {showJson && (
        <pre className="mb-4 max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify(
            {
              key: form.key,
              label: form.label,
              template_types: selectedTemplateTypes,
              variable_type: 'TABLE_VARIABLE',
              input_type: 'Table',
              ui_config: {
                table_builder: tableBuilder,
                table_template: tableTemplate,
              },
            },
            null,
            2,
          )}
        </pre>
      )}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Luật render của biến này</div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Cấu hình riêng nằm trong JSON của biến này. Khi insert vào template, hệ thống chỉ hỏi thêm dữ liệu theo
              các trường bên dưới.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tableContextSchema && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Đã có luật render
              </span>
            )}
            {tableContextSchema ? (
              <Button type="button" variant="outline" onClick={handleRemoveContextSchema}>
                <Trash2 className="size-4 text-red-500" />
                Xoá luật
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleCreateContextSchema}>
                <Plus className="size-4" />
                Bật luật render
              </Button>
            )}
          </div>
        </div>

        <datalist id="table-context-schema-tables">
          {tableNames.map((table) => (
            <option key={table} value={table} />
          ))}
        </datalist>

        {!tableContextSchema ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
            Biến này chưa cần hỏi thêm dữ liệu khi render. Nếu cần chọn CTĐT, nhập số học kỳ, số PLO/CLO hoặc danh sách
            trường so sánh, hãy tạo luật render.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Câu hỏi user sẽ thấy</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {contextControlTypes.length > 0
                      ? `${tableContextSchema.controls.length} câu hỏi`
                      : 'Chưa có câu hỏi'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={newContextControlType}
                    onValueChange={(value) => setNewContextControlType(value as TTableContextControlType)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTEXT_CONTROL_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={handleAddContextControl}>
                    <Plus className="size-4" />
                    Thêm câu hỏi
                  </Button>
                </div>
              </div>

              {tableContextSchema.controls.length > 0 ? (
                <div className="space-y-3">{tableContextSchema.controls.map(renderContextControlEditor)}</div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                  Nếu rule cần user nhập số, chọn bản ghi hoặc nhập danh sách trước khi tạo bảng, hãy thêm câu hỏi ở
                  đây.
                </div>
              )}
            </div>

            {renderRuleBuilder()}

            {showJson && (
              <details className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                <summary className="cursor-pointer text-sm font-medium text-amber-900">
                  Kỹ thuật: xem/sửa JSON rule
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm leading-6 text-amber-900">
                    <div className="font-semibold">Rule hiện tại: {getRenderRuleLabel(renderRule)}</div>
                    <div>{getRenderRuleDescription(renderRule)}</div>
                    <div className="mt-1 text-xs text-amber-700">
                      Mã bắt buộc hiện tại:{' '}
                      {tableContextSchema.required.length ? tableContextSchema.required.join(', ') : 'Không có'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                      JSON render_rule
                    </span>
                    <Button type="button" variant="outline" onClick={handleApplyRenderRuleJson}>
                      Áp dụng JSON rule
                    </Button>
                  </div>
                  <Textarea
                    value={renderRuleJsonDraft}
                    onChange={(event) => setRenderRuleJsonDraft(event.target.value)}
                    rows={10}
                    spellCheck={false}
                    className="font-mono text-xs"
                    placeholder='{"type":"repeat_blocks","count_key":"semester_count"}'
                  />
                  <p className="text-xs leading-5 text-amber-800">
                    Phần này chỉ dành cho dev hoặc debug. User thường chỉ chỉnh câu hỏi và luật render bằng UI phía
                    trên.
                  </p>
                  {renderRuleJsonError && <p className="text-xs leading-5 text-red-600">{renderRuleJsonError}</p>}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Đang tải biến bảng...
        </div>
      ) : (
        <TableDesigner
          tableTemplate={tableTemplate}
          tableBuilder={tableBuilder}
          schemaCatalog={schemaCatalog}
          onChange={handleTableDesignerChange}
        />
      )}
    </div>
  );
};
