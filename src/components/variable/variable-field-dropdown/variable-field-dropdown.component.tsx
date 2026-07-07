'use client';

import { type DragEvent, type ReactNode, useCallback, useEffect, useId, useMemo, useState } from 'react';
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
import {
  getTemplateRecordByFieldValueAPI,
  getTemplateTableOptionsAPI,
  getTemplateTableRecordsAPI,
  getTemplateTableSchemaFieldsAPI,
} from 'api';
import { DocumentTemplateEditor, TableCellConfig } from '../../template';
import { useTranslation } from '../../../i18n';
import {
  buildSemesterCoursesSignCompositeValue,
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  MENTION_BLACKLIST,
  getSemesterCoursesSignComponentVariableKeys,
  SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY,
  TABLE_TEMPLATE_VARIABLE_NAMESPACE,
  generateDocumentHtml,
  generateTableHtmlFromTableTemplate,
  getDocumentTemplateById,
  getForeignKeyMeta,
  getTableTemplateById,
  getTemplateVariableDefinitionByKey,
  getTemplateVariableDocumentTemplateByKey,
  getTemplateVariableTableTemplateByKey,
  getVariableAlias,
  getDefaultVariableInputTypeForKey,
  FRAPPE_VARIABLE_INPUT_TYPES,
  isSemesterCoursesSignCompositeVariableKey,
  parseVariableName,
  type DocumentTemplate,
  isCheckVariableInputType,
  isImageVariableInputType,
  isLongTextVariableInputType,
  isNumberVariableInputType,
  isSelectVariableInputType,
  isTableMatrixVariableInputType,
  hasInvalidTableTemplateHeaderTree,
  mergeDocumentTemplateStylesFromDefinition,
  mergeTableTemplateStylesFromDefinition,
  mergeTableTemplateWithRuntimeValues,
  normalizeConfiguredBlocksTemplate,
  type TableTemplate,
  type VariableInputType,
} from '../../../lib';

type DropdownApiOption = {
  id: string;
  value: string;
  label: string;
  record?: Record<string, unknown>;
};

const GENERATED_TABLE_FONT_STYLE =
  "font-family: 'Times New Roman', Times, serif; font-size: 14pt; line-height: 1.35; color: #000;";

function dedupeDropdownApiOptions(items: DropdownApiOption[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.id || item.value;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDropdownApiOptionLabel(field: string, item: DropdownApiOption, labelField?: string) {
  if (!labelField) return item.label;

  const recordValue = item.record?.[field];
  const recordLabel = item.record?.[labelField];

  if (typeof recordValue === 'string' && typeof recordLabel === 'string' && recordLabel.trim()) {
    if (recordValue.trim() === recordLabel.trim()) return recordValue;
    return `${recordValue} - ${recordLabel}`;
  }

  if (typeof recordLabel === 'string' && recordLabel.trim()) {
    return item.value && item.value !== recordLabel ? `${item.value} - ${recordLabel}` : recordLabel;
  }

  return item.label;
}

function getRecordValue(record: Record<string, unknown> | undefined, fieldName: string) {
  if (!record) return undefined;
  if (fieldName === '_id' || fieldName === 'id') {
    return record._id ?? record.id;
  }
  return record[fieldName];
}

function recordMatchesFieldValue(record: Record<string, unknown> | undefined, fieldName: string, value: string) {
  const recordValue = getRecordValue(record, fieldName);
  return recordValue !== undefined && recordValue !== null && String(recordValue) === value;
}

function getSharedRecordSelectorSourceKey(varName: string, templateType?: string | null) {
  const definition = getTemplateVariableDefinitionByKey(varName, templateType);
  const dataSource = definition?.dataSource;

  if (
    definition?.variableType !== 'FIELD_VARIABLE' ||
    !isSelectVariableInputType(definition.inputType) ||
    dataSource?.type !== 'table' ||
    !dataSource.table.trim()
  ) {
    return null;
  }

  const parsed = parseVariableName(varName);
  if (!parsed) return null;

  return JSON.stringify({
    table: dataSource.table.trim(),
    filterField: dataSource.filterField ?? '',
    filterValue: dataSource.filterValue ?? null,
  });
}

function getSharedRecordSelectorOwnerLabel(varName: string, templateType?: string | null) {
  const parsed = parseVariableName(varName);
  return parsed ? getVariableAlias(parsed.table, parsed.field, templateType) : varName;
}

const SEMESTER_COURSES_SIGN_TEXT_REGEX = /^(.*?)(?:,\s*)?ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})$/i;

function parseSemesterCoursesSignCompositeText(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { location: '', day: '', month: '', year: '' };
  }

  const match = normalized.match(SEMESTER_COURSES_SIGN_TEXT_REGEX);
  if (!match) {
    return { location: normalized, day: '', month: '', year: '' };
  }

  return {
    location: match[1]?.trim().replace(/,\s*$/, '') ?? '',
    day: match[2]?.trim() ?? '',
    month: match[3]?.trim() ?? '',
    year: match[4]?.trim() ?? '',
  };
}

function buildSemesterCoursesSignDateInputValue(dayValue: string, monthValue: string, yearValue: string) {
  const day = dayValue.trim();
  const month = monthValue.trim();
  const year = yearValue.trim();

  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return '';
  }

  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

async function fetchDropdownApiOptions(params: {
  table: string;
  field: string;
  labelField?: string;
  filterField?: string;
  filterValue?: unknown;
  search?: string;
  page: number;
  page_size: number;
}) {
  const { table, field, filterField, filterValue, search, page, page_size } = params;
  const labelField = params.labelField?.trim() || undefined;

  const primary = await getTemplateTableOptionsAPI({
    table,
    field_name: field,
    filter_field: filterField,
    filter_value: filterValue,
    sort_order: 'asc',
    search,
    page,
    page_size,
    label_field: labelField,
  });

  if (!labelField || !search?.trim() || labelField === field) {
    return primary.map((item) => ({
      ...item,
      label: formatDropdownApiOptionLabel(field, item, labelField),
    }));
  }

  const secondary = await getTemplateTableOptionsAPI({
    table,
    field_name: labelField,
    filter_field: filterField,
    filter_value: filterValue,
    sort_order: 'asc',
    search,
    page,
    page_size,
    label_field: field,
  });

  return dedupeDropdownApiOptions([...primary, ...secondary]).map((item) => ({
    ...item,
    label: formatDropdownApiOptionLabel(field, item, labelField),
  }));
}

const EMPTY_DOCUMENT_TEMPLATE_VALUES: Record<string, string> = {};

const VARIABLE_INPUT_TYPE_OPTIONS: VariableInputType[] = [
  ...FRAPPE_VARIABLE_INPUT_TYPES,
  'Table matrix',
  'Table template',
  'Document template',
];

const isSafeImageSrc = (value: string) => {
  const trimmed = value.trim();
  return /^(https?:\/\/|data:image\/|\/)/i.test(trimmed);
};

const escapeImageAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const buildImageHtmlValue = (src: string) => {
  const trimmed = src.trim();
  if (!trimmed || !isSafeImageSrc(trimmed)) {
    return '';
  }

  return `<img src="${escapeImageAttribute(trimmed)}" alt="" style="max-width:100%;height:auto;display:block;" />`;
};

const extractImageSrcValue = (value: string) => {
  const srcMatch = value.match(/<img\b[^>]*\ssrc=["']([^"']+)["']/i);
  return srcMatch?.[1] ?? value;
};

type TLinkedTemplateActionCardProps = {
  name: string;
  description?: string;
  linkedLabel: string;
  changeLabel: string;
  unlinkLabel: string;
  onChange: () => void;
  onReset: () => void;
};

const LinkedTemplateActionCard = ({
  name,
  description,
  linkedLabel,
  changeLabel,
  unlinkLabel,
  onChange,
  onReset,
}: TLinkedTemplateActionCardProps) => {
  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 shadow-sm">
      <div className="mb-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700/80">{linkedLabel}</div>
        <strong className="mt-1 block text-sm font-semibold leading-6 text-slate-900">{name}</strong>
        {description && <p className="mt-1 text-xs leading-5 text-emerald-800/80">{description}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={onChange}
          size="sm"
          variant="outline"
          className="h-10 flex-1 rounded-lg border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900">
          {changeLabel}
        </Button>
        <Button
          onClick={onReset}
          size="sm"
          variant="outline"
          className="h-10 rounded-lg border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 hover:text-red-800 sm:min-w-[112px]">
          {unlinkLabel}
        </Button>
      </div>
    </div>
  );
};

type TTemplateEmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

const TemplateEmptyState = ({ title, description, actionLabel, onAction }: TTemplateEmptyStateProps) => {
  return (
    <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      <Button type="button" className="mt-3 h-10 w-full rounded-lg text-sm font-medium" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
};

type TConfigPanelTone = 'amber' | 'cyan' | 'emerald' | 'indigo' | 'rose' | 'sky';

const CONFIG_PANEL_TONE_CLASSES: Record<
  TConfigPanelTone,
  {
    container: string;
    eyebrow: string;
    description: string;
    footer: string;
  }
> = {
  amber: {
    container: 'border-amber-200 bg-amber-50/80',
    eyebrow: 'text-amber-800',
    description: 'text-amber-900/80',
    footer: 'text-amber-800',
  },
  cyan: {
    container: 'border-cyan-200 bg-cyan-50/80',
    eyebrow: 'text-cyan-800',
    description: 'text-cyan-900/80',
    footer: 'text-cyan-800',
  },
  emerald: {
    container: 'border-emerald-200 bg-emerald-50/80',
    eyebrow: 'text-emerald-800',
    description: 'text-emerald-900/80',
    footer: 'text-emerald-800',
  },
  indigo: {
    container: 'border-indigo-200 bg-indigo-50/80',
    eyebrow: 'text-indigo-800',
    description: 'text-indigo-900/80',
    footer: 'text-indigo-800',
  },
  rose: {
    container: 'border-rose-200 bg-rose-50/80',
    eyebrow: 'text-rose-800',
    description: 'text-rose-900/80',
    footer: 'text-rose-800',
  },
  sky: {
    container: 'border-sky-200 bg-sky-50/80',
    eyebrow: 'text-sky-800',
    description: 'text-sky-900/80',
    footer: 'text-sky-800',
  },
};

type TConfigPanelProps = {
  title: string;
  description?: string;
  tone?: TConfigPanelTone;
  children?: ReactNode;
  footer?: ReactNode;
};

const ConfigPanel = ({ title, description, tone = 'indigo', children, footer }: TConfigPanelProps) => {
  const toneClasses = CONFIG_PANEL_TONE_CLASSES[tone];

  return (
    <div className={`mt-2 rounded-lg border p-3 ${toneClasses.container}`}>
      <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${toneClasses.eyebrow}`}>{title}</div>
      {description && <p className={`mt-1 text-xs leading-5 ${toneClasses.description}`}>{description}</p>}
      {children && <div className="mt-3 space-y-2">{children}</div>}
      {footer && <div className={`mt-2 text-xs leading-5 ${toneClasses.footer}`}>{footer}</div>}
    </div>
  );
};

type TTableTemplateContextControlBase = {
  type: string;
  label?: string;
  description?: string;
  footer?: string;
  warning?: string;
  label_key?: string;
  description_key?: string;
  footer_key?: string;
  warning_key?: string;
  tone?: TConfigPanelTone;
};

type TTableTemplateContextNumberControl = TTableTemplateContextControlBase & {
  type: 'number';
  key: string;
  min?: number;
  max?: number;
  default_value?: number;
  placeholder?: string;
  placeholder_key?: string;
};

type TTableTemplateContextNumberPairControl = TTableTemplateContextControlBase & {
  type: 'number_pair';
  controls: TTableTemplateContextNumberControl[];
};

type TTableTemplateContextRecordSelectControl = TTableTemplateContextControlBase & {
  type: 'record_select';
  key: string;
  table: string;
  value_field?: string;
  label_field?: string;
  context_label_key?: string;
  source_key?: string;
  source_value?: string;
  placeholder?: string;
  placeholder_key?: string;
  empty_text?: string;
  empty_key?: string;
  selected_text?: string;
  selected_key?: string;
  linked_id_text?: string;
  linked_id_key?: string;
};

type TTableTemplateContextTextListControl = TTableTemplateContextControlBase & {
  type: 'text_list';
  key: string;
  input_key?: string;
  max_items?: number;
  placeholder?: string;
  placeholder_key?: string;
};

type TTableTemplateContextSchoolListPairControl = TTableTemplateContextControlBase & {
  type: 'school_list_pair';
  domestic_key?: string;
  foreign_key?: string;
  domestic_input_key?: string;
  foreign_input_key?: string;
  domestic_label?: string;
  foreign_label?: string;
  domestic_label_key?: string;
  foreign_label_key?: string;
  domestic_placeholder?: string;
  foreign_placeholder?: string;
  domestic_placeholder_key?: string;
  foreign_placeholder_key?: string;
};

type TTableTemplateContextControl =
  | TTableTemplateContextNumberControl
  | TTableTemplateContextNumberPairControl
  | TTableTemplateContextRecordSelectControl
  | TTableTemplateContextTextListControl
  | TTableTemplateContextSchoolListPairControl;

type TTableTemplateContextSchema = {
  normalizer?: string;
  render_rule?: Record<string, unknown>;
  required?: string[];
  controls?: TTableTemplateContextControl[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeTableContextNumberControl(value: unknown): TTableTemplateContextNumberControl | null {
  if (!isPlainObject(value) || value.type !== 'number' || typeof value.key !== 'string') return null;

  return {
    type: 'number',
    key: value.key,
    min: typeof value.min === 'number' ? value.min : undefined,
    max: typeof value.max === 'number' ? value.max : undefined,
    default_value: typeof value.default_value === 'number' ? value.default_value : undefined,
    label: typeof value.label === 'string' ? value.label : undefined,
    description: typeof value.description === 'string' ? value.description : undefined,
    footer: typeof value.footer === 'string' ? value.footer : undefined,
    label_key: typeof value.label_key === 'string' ? value.label_key : undefined,
    description_key: typeof value.description_key === 'string' ? value.description_key : undefined,
    footer_key: typeof value.footer_key === 'string' ? value.footer_key : undefined,
    placeholder: typeof value.placeholder === 'string' ? value.placeholder : undefined,
    placeholder_key: typeof value.placeholder_key === 'string' ? value.placeholder_key : undefined,
    warning: typeof value.warning === 'string' ? value.warning : undefined,
    warning_key: typeof value.warning_key === 'string' ? value.warning_key : undefined,
    tone: isConfigPanelTone(value.tone) ? value.tone : undefined,
  };
}

function isConfigPanelTone(value: unknown): value is TConfigPanelTone {
  return (
    value === 'amber' ||
    value === 'cyan' ||
    value === 'emerald' ||
    value === 'indigo' ||
    value === 'rose' ||
    value === 'sky'
  );
}

function normalizeTableContextControl(value: unknown): TTableTemplateContextControl | null {
  if (!isPlainObject(value) || typeof value.type !== 'string') return null;

  if (value.type === 'number') {
    return normalizeTableContextNumberControl(value);
  }

  if (value.type === 'number_pair') {
    const controls = Array.isArray(value.controls)
      ? value.controls
          .map((control) => normalizeTableContextNumberControl(control))
          .filter((control): control is TTableTemplateContextNumberControl => Boolean(control))
      : [];
    if (controls.length === 0) return null;

    return {
      type: 'number_pair',
      controls,
      label: typeof value.label === 'string' ? value.label : undefined,
      description: typeof value.description === 'string' ? value.description : undefined,
      footer: typeof value.footer === 'string' ? value.footer : undefined,
      label_key: typeof value.label_key === 'string' ? value.label_key : undefined,
      description_key: typeof value.description_key === 'string' ? value.description_key : undefined,
      footer_key: typeof value.footer_key === 'string' ? value.footer_key : undefined,
      warning: typeof value.warning === 'string' ? value.warning : undefined,
      warning_key: typeof value.warning_key === 'string' ? value.warning_key : undefined,
      tone: isConfigPanelTone(value.tone) ? value.tone : undefined,
    };
  }

  if (value.type === 'record_select') {
    if (typeof value.key !== 'string' || typeof value.table !== 'string') return null;

    return {
      type: 'record_select',
      key: value.key,
      table: value.table,
      value_field: typeof value.value_field === 'string' ? value.value_field : undefined,
      label_field: typeof value.label_field === 'string' ? value.label_field : undefined,
      context_label_key: typeof value.context_label_key === 'string' ? value.context_label_key : undefined,
      source_key: typeof value.source_key === 'string' ? value.source_key : undefined,
      source_value: typeof value.source_value === 'string' ? value.source_value : undefined,
      label: typeof value.label === 'string' ? value.label : undefined,
      description: typeof value.description === 'string' ? value.description : undefined,
      footer: typeof value.footer === 'string' ? value.footer : undefined,
      label_key: typeof value.label_key === 'string' ? value.label_key : undefined,
      description_key: typeof value.description_key === 'string' ? value.description_key : undefined,
      footer_key: typeof value.footer_key === 'string' ? value.footer_key : undefined,
      placeholder: typeof value.placeholder === 'string' ? value.placeholder : undefined,
      placeholder_key: typeof value.placeholder_key === 'string' ? value.placeholder_key : undefined,
      empty_text: typeof value.empty_text === 'string' ? value.empty_text : undefined,
      empty_key: typeof value.empty_key === 'string' ? value.empty_key : undefined,
      selected_text: typeof value.selected_text === 'string' ? value.selected_text : undefined,
      selected_key: typeof value.selected_key === 'string' ? value.selected_key : undefined,
      linked_id_text: typeof value.linked_id_text === 'string' ? value.linked_id_text : undefined,
      linked_id_key: typeof value.linked_id_key === 'string' ? value.linked_id_key : undefined,
      warning: typeof value.warning === 'string' ? value.warning : undefined,
      warning_key: typeof value.warning_key === 'string' ? value.warning_key : undefined,
      tone: isConfigPanelTone(value.tone) ? value.tone : undefined,
    };
  }

  if (value.type === 'text_list') {
    if (typeof value.key !== 'string') return null;

    return {
      type: 'text_list',
      key: value.key,
      input_key: typeof value.input_key === 'string' ? value.input_key : undefined,
      max_items: typeof value.max_items === 'number' ? value.max_items : undefined,
      label: typeof value.label === 'string' ? value.label : undefined,
      description: typeof value.description === 'string' ? value.description : undefined,
      footer: typeof value.footer === 'string' ? value.footer : undefined,
      label_key: typeof value.label_key === 'string' ? value.label_key : undefined,
      description_key: typeof value.description_key === 'string' ? value.description_key : undefined,
      footer_key: typeof value.footer_key === 'string' ? value.footer_key : undefined,
      placeholder: typeof value.placeholder === 'string' ? value.placeholder : undefined,
      placeholder_key: typeof value.placeholder_key === 'string' ? value.placeholder_key : undefined,
      warning: typeof value.warning === 'string' ? value.warning : undefined,
      warning_key: typeof value.warning_key === 'string' ? value.warning_key : undefined,
      tone: isConfigPanelTone(value.tone) ? value.tone : undefined,
    };
  }

  if (value.type === 'school_list_pair') {
    return {
      type: 'school_list_pair',
      domestic_key: typeof value.domestic_key === 'string' ? value.domestic_key : undefined,
      foreign_key: typeof value.foreign_key === 'string' ? value.foreign_key : undefined,
      domestic_input_key: typeof value.domestic_input_key === 'string' ? value.domestic_input_key : undefined,
      foreign_input_key: typeof value.foreign_input_key === 'string' ? value.foreign_input_key : undefined,
      label: typeof value.label === 'string' ? value.label : undefined,
      description: typeof value.description === 'string' ? value.description : undefined,
      footer: typeof value.footer === 'string' ? value.footer : undefined,
      label_key: typeof value.label_key === 'string' ? value.label_key : undefined,
      description_key: typeof value.description_key === 'string' ? value.description_key : undefined,
      footer_key: typeof value.footer_key === 'string' ? value.footer_key : undefined,
      domestic_label: typeof value.domestic_label === 'string' ? value.domestic_label : undefined,
      foreign_label: typeof value.foreign_label === 'string' ? value.foreign_label : undefined,
      domestic_label_key: typeof value.domestic_label_key === 'string' ? value.domestic_label_key : undefined,
      foreign_label_key: typeof value.foreign_label_key === 'string' ? value.foreign_label_key : undefined,
      domestic_placeholder: typeof value.domestic_placeholder === 'string' ? value.domestic_placeholder : undefined,
      foreign_placeholder: typeof value.foreign_placeholder === 'string' ? value.foreign_placeholder : undefined,
      domestic_placeholder_key:
        typeof value.domestic_placeholder_key === 'string' ? value.domestic_placeholder_key : undefined,
      foreign_placeholder_key:
        typeof value.foreign_placeholder_key === 'string' ? value.foreign_placeholder_key : undefined,
      warning: typeof value.warning === 'string' ? value.warning : undefined,
      warning_key: typeof value.warning_key === 'string' ? value.warning_key : undefined,
      tone: isConfigPanelTone(value.tone) ? value.tone : undefined,
    };
  }

  return null;
}

function getTableContextSchema(template?: TableTemplate | null): TTableTemplateContextSchema | null {
  if (!template) return null;

  const rawSchema = template.context_schema ?? template.contextSchema;
  if (isPlainObject(rawSchema)) {
    return {
      normalizer: typeof rawSchema.normalizer === 'string' ? rawSchema.normalizer : undefined,
      render_rule: isPlainObject(rawSchema.render_rule) ? rawSchema.render_rule : undefined,
      required: Array.isArray(rawSchema.required)
        ? rawSchema.required.filter((item): item is string => typeof item === 'string')
        : [],
      controls: Array.isArray(rawSchema.controls)
        ? rawSchema.controls
            .map((control) => normalizeTableContextControl(control))
            .filter((control): control is TTableTemplateContextControl => Boolean(control))
        : [],
    };
  }

  return null;
}

function getTableContextRenderRuleType(schema?: TTableTemplateContextSchema | null) {
  const ruleType = schema?.render_rule?.type;
  if (typeof ruleType !== 'string' || !ruleType.trim()) return '';

  const normalizedRuleType = ruleType.trim();
  const aliases: Record<string, string> = {
    comparison_school_columns: 'comparison_columns',
    course_plo_columns: 'dynamic_column_group',
    curriculum_framework_fixed: 'configured_blocks',
    syllabus_clo_plo_matrix: 'dynamic_matrix',
  };

  return aliases[normalizedRuleType] ?? normalizedRuleType;
}

function getTableContextRenderRuleString(
  schema: TTableTemplateContextSchema | null | undefined,
  key: string,
  fallback: string,
) {
  const value = schema?.render_rule?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parsePositiveIntegerContextValue(rawValue: unknown) {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return Math.max(1, Math.floor(rawValue));
  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) return Math.max(1, Math.floor(parsed));
  }
  return null;
}

function getContextControlKeys(control: TTableTemplateContextControl): string[] {
  if (control.type === 'number' || control.type === 'record_select' || control.type === 'text_list') {
    return [control.key];
  }
  if (control.type === 'number_pair') return control.controls.map((item) => item.key);
  if (control.type === 'school_list_pair') {
    return [control.domestic_key || 'domestic_comparison_schools', control.foreign_key || 'foreign_comparison_schools'];
  }
  return [];
}

function resolveContextFallbackText(directText: string | undefined, key: string | undefined, fallback: string) {
  if (directText?.trim()) return directText.trim();
  if (key?.trim()) return key.trim();
  return fallback;
}

function getWarningTextForContextKey(
  controls: TTableTemplateContextControl[],
  key: string,
  translate: (translationKey: string) => string,
) {
  const matchedControl = controls.find((control) => getContextControlKeys(control).includes(key));
  if (matchedControl?.warning) return matchedControl.warning;
  const controlLabel = resolveContextFallbackText(matchedControl?.label, matchedControl?.label_key, key);
  if (controlLabel) return `Vui lòng nhập ${controlLabel.toLowerCase()} trước khi tạo bảng.`;

  return translate(matchedControl?.warning_key || 'variables.field.warnings.configureTableContext');
}

function getRuleStringValue(rule: Record<string, unknown> | null | undefined, key: string, fallback: string) {
  const value = rule?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getRuleNumberValue(rule: Record<string, unknown> | null | undefined, key: string, fallback: number) {
  const value = rule?.[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cellStringValue(cell: unknown): string {
  if (cell && typeof cell === 'object' && 'value' in cell) {
    const value = (cell as { value?: unknown }).value;
    return value === undefined || value === null ? '' : String(value);
  }
  return cell === undefined || cell === null ? '' : String(cell);
}

function editableCellWithValue(
  value: string,
  previous?: unknown,
  tableField?: string,
  forceManual?: boolean,
  extraConfig?: Record<string, unknown>,
) {
  if (previous && typeof previous === 'object') {
    return {
      ...(previous as Record<string, unknown>),
      ...(extraConfig || {}),
      value,
      ...(tableField ? { table_field: tableField } : {}),
      is_read_only: false,
      ...(forceManual ? { force_manual: true } : {}),
    };
  }
  return {
    ...(extraConfig || {}),
    value,
    ...(tableField ? { table_field: tableField } : {}),
    is_read_only: false,
    ...(forceManual ? { force_manual: true } : {}),
  };
}

function readonlyCellWithValue(
  value: string,
  previous?: unknown,
  tableField?: string,
  extraConfig?: Record<string, unknown>,
) {
  const base = previous && typeof previous === 'object' ? { ...(previous as Record<string, unknown>) } : {};
  return {
    ...base,
    ...(extraConfig || {}),
    value,
    ...(tableField ? { table_field: tableField } : {}),
    is_read_only: true,
  };
}

type TGroupedPloColumnConfig = {
  parentKey: string;
  parentLabel: string;
  columnPrefix: string;
  countKey: string;
  labelPrefix: string;
  labelStart: number | null;
  groupWidth: number;
  defaultCount: number;
};

function getConfigStringValue(config: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function getConfigNumberValue(config: Record<string, unknown>, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = config[key];
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getGroupedPloColumnConfigs(renderRule?: Record<string, unknown> | null): TGroupedPloColumnConfig[] {
  const rawConfigs = Array.isArray(renderRule?.group_configs)
    ? renderRule?.group_configs
    : Array.isArray(renderRule?.groupConfigs)
      ? renderRule?.groupConfigs
      : [];

  return rawConfigs
    .map((rawConfig, index) => {
      if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return null;
      const config = rawConfig as Record<string, unknown>;
      const parentKey = getConfigStringValue(config, ['parent_key', 'parentKey', 'key'], '');
      if (!parentKey) return null;

      const parentLabel = getConfigStringValue(config, ['parent_label', 'parentLabel', 'label'], parentKey);
      const columnPrefix = getConfigStringValue(
        config,
        ['column_prefix', 'columnPrefix', 'plo_column_prefix', 'ploColumnPrefix'],
        `${parentKey}_`,
      );
      const countKey = getConfigStringValue(
        config,
        ['count_key', 'countKey'],
        `${parentKey.replace(/[^A-Za-z0-9_]/g, '') || `group${index + 1}`}Count`,
      );
      const labelPrefix = getConfigStringValue(config, ['label_prefix', 'labelPrefix'], 'PLO');
      const rawLabelStart = getConfigNumberValue(config, ['label_start', 'labelStart'], NaN);
      const defaultCount = Math.max(1, Math.floor(getConfigNumberValue(config, ['default_count', 'defaultCount'], 1)));
      const groupWidth = Math.max(1, getConfigNumberValue(config, ['group_width', 'groupWidth', 'width'], 40));

      return {
        parentKey,
        parentLabel,
        columnPrefix,
        countKey,
        labelPrefix,
        labelStart: Number.isFinite(rawLabelStart) ? Math.max(1, Math.floor(rawLabelStart)) : null,
        groupWidth,
        defaultCount,
      };
    })
    .filter((config): config is TGroupedPloColumnConfig => Boolean(config));
}

function normalizeGroupedPloHeadersFromTemplate(
  template: TableTemplate,
  fallbackPloColumnCount: number,
  renderRule: Record<string, unknown> | null | undefined,
  groupConfigs: TGroupedPloColumnConfig[],
): TableTemplate {
  const oldHeaders = template.structure.headers || [];
  const oldBlocks = template.structure.blocks || [];
  const sttKey = getRuleStringValue(renderRule, 'stt_key', 'stt');
  const fixedColumnKeys = getRenderRuleArray(renderRule ?? undefined, 'fixed_column_keys');
  const courseNameKey = getRuleStringValue(renderRule, 'course_name_key', 'course_name');
  const courseNameTableField = getRuleStringValue(renderRule, 'course_name_table_field', 'courses.name');
  const courseNameLabelField = getRuleStringValue(renderRule, 'course_name_label_field', '');
  const courseNameDropdownConfig = courseNameLabelField ? { label_field: courseNameLabelField } : undefined;
  const fixedKeys = fixedColumnKeys.length > 0 ? fixedColumnKeys : [sttKey, courseNameKey];
  const fixedHeaders = oldHeaders.filter((header) => fixedKeys.includes(String(header.key || '')));
  const fallbackCount = Number.isFinite(fallbackPloColumnCount) ? Math.max(1, Math.floor(fallbackPloColumnCount)) : 1;
  const ploParentKey = getRuleStringValue(renderRule, 'plo_parent_key', 'plo_group');
  const ploParentLabel = getRuleStringValue(
    renderRule,
    'plo_parent_label',
    'Chuẩn đầu ra của chương trình đào tạo (PLO)',
  );
  const ploGroupWidth = getRuleNumberValue(renderRule, 'plo_group_width', 70);

  let nextLabelStart = 1;
  let dynamicLeafCount = 0;
  const groupedHeadersWithoutRoot = groupConfigs.flatMap((groupConfig) => {
    const contextCount = parsePositiveIntegerContextValue(template.context?.[groupConfig.countKey]);
    const normalizedCount = contextCount ?? groupConfig.defaultCount ?? fallbackCount;
    const labelStart = groupConfig.labelStart ?? nextLabelStart;
    nextLabelStart = labelStart + normalizedCount;
    dynamicLeafCount += normalizedCount;

    const parentHeader = {
      ...(oldHeaders.find((header) => header.key === groupConfig.parentKey) || {
        label: groupConfig.parentLabel,
        key: groupConfig.parentKey,
        is_parent_header: true,
        read_only: true,
      }),
      label: groupConfig.parentLabel,
      width: `${groupConfig.groupWidth}%`,
      colspan: normalizedCount,
      parent: ploParentKey,
    };
    const childWidth = `${(groupConfig.groupWidth / normalizedCount).toFixed(2)}%`;
    const childHeaders = Array.from({ length: normalizedCount }, (_, index) => {
      const labelNumber = labelStart + index;
      return {
        label: `${groupConfig.labelPrefix}${labelNumber}`,
        key: `${groupConfig.columnPrefix}${index + 1}`,
        width: childWidth,
        parent: groupConfig.parentKey,
      };
    });

    return [parentHeader, ...childHeaders];
  });
  const shouldRenderGroupedRoot = groupConfigs.length > 1 || oldHeaders.some((header) => header.key === ploParentKey);
  const groupedRootHeader = shouldRenderGroupedRoot
    ? {
        ...(oldHeaders.find((header) => header.key === ploParentKey) || {
          label: ploParentLabel,
          key: ploParentKey,
          width: `${ploGroupWidth}%`,
          is_parent_header: true,
          read_only: true,
        }),
        label: ploParentLabel,
        colspan: dynamicLeafCount,
      }
    : null;
  const groupedHeaders = groupedRootHeader
    ? [groupedRootHeader, ...groupedHeadersWithoutRoot]
    : groupedHeadersWithoutRoot;

  const dynamicLeafHeaders = groupedHeaders.filter(
    (header): header is { label: string; key: string; width: string; parent: string } =>
      !('is_parent_header' in header && header.is_parent_header) &&
      'parent' in header &&
      typeof header.parent === 'string',
  );
  const fixedLeafCount = fixedHeaders.filter((header) => !header.is_parent_header).length;
  const fixedHeaderRowspan = groupedRootHeader ? 3 : 2;

  const nextHeaders = [
    ...fixedHeaders.map((header) => ({
      ...header,
      rowspan: fixedHeaderRowspan,
      ...(header.key === courseNameKey ? { read_only: false, ...courseNameDropdownConfig } : {}),
    })),
    ...groupedHeaders,
  ];

  const nextBlocks = oldBlocks.map((block) => {
    const subsectionBase = block.subsection;
    const subsection: Record<string, any> | null = subsectionBase
      ? {
          ...subsectionBase,
          [sttKey]: readonlyCellWithValue(cellStringValue(subsectionBase[sttKey]), subsectionBase[sttKey]),
          cell_merge: {
            ...((subsectionBase.cell_merge && typeof subsectionBase.cell_merge === 'object'
              ? subsectionBase.cell_merge
              : {}) as Record<string, unknown>),
            [sttKey]: {
              colspan: fixedLeafCount + dynamicLeafCount,
            },
          },
        }
      : null;

    if (subsection && fixedKeys.includes(courseNameKey)) {
      subsection[courseNameKey] = readonlyCellWithValue(
        '',
        subsectionBase?.[courseNameKey],
        courseNameTableField,
        courseNameDropdownConfig,
      );
    }

    if (subsection) {
      dynamicLeafHeaders.forEach((header) => {
        subsection[header.key] = readonlyCellWithValue('', subsectionBase?.[header.key]);
      });
    }

    const nextRows = (block.rows || []).map((row) => {
      const nextRow: Record<string, any> = {
        ...row,
        [sttKey]: editableCellWithValue(cellStringValue(row[sttKey]), row[sttKey]),
      };

      if (fixedKeys.includes(courseNameKey)) {
        nextRow[courseNameKey] = editableCellWithValue(
          cellStringValue(row[courseNameKey]),
          row[courseNameKey],
          courseNameTableField,
          false,
          courseNameDropdownConfig,
        );
      }

      dynamicLeafHeaders.forEach((header) => {
        const directCell = row[header.key];
        if (directCell !== undefined) {
          nextRow[header.key] = editableCellWithValue(cellStringValue(directCell), directCell);
          return;
        }

        const matchedOldHeader = oldHeaders.find(
          (oldHeader) =>
            !oldHeader.is_parent_header &&
            oldHeader.parent === header.parent &&
            String(oldHeader.label || '') === header.label,
        );
        const migratedCell = matchedOldHeader ? row[matchedOldHeader.key] : undefined;
        nextRow[header.key] = editableCellWithValue(cellStringValue(migratedCell), migratedCell);
      });

      return nextRow;
    });

    const rowTemplateBase = block.row_template && typeof block.row_template === 'object' ? block.row_template : {};
    const nextRowTemplate: Record<string, any> = {
      ...rowTemplateBase,
      [sttKey]: editableCellWithValue('', rowTemplateBase[sttKey]),
    };

    if (fixedKeys.includes(courseNameKey)) {
      nextRowTemplate[courseNameKey] = editableCellWithValue(
        '',
        rowTemplateBase[courseNameKey],
        courseNameTableField,
        false,
        courseNameDropdownConfig,
      );
    }

    dynamicLeafHeaders.forEach((header) => {
      nextRowTemplate[header.key] = editableCellWithValue('', rowTemplateBase[header.key]);
    });

    const existingRowFetchConfig =
      block.row_fetch_config && typeof block.row_fetch_config === 'object'
        ? (block.row_fetch_config as Record<string, unknown>)
        : {};
    const existingFieldsToFetch = Array.isArray(existingRowFetchConfig.fields_to_fetch)
      ? existingRowFetchConfig.fields_to_fetch
      : [];
    const fieldsToFetch =
      fixedKeys.includes(courseNameKey) && existingFieldsToFetch.length === 0
        ? [
            {
              key: courseNameKey,
              table: courseNameTableField.split('.')[0] || 'courses',
              field: courseNameTableField.split('.')[1] || 'name',
            },
          ]
        : existingFieldsToFetch;

    return {
      ...block,
      subsection,
      row_template: nextRowTemplate,
      rows: nextRows,
      row_fetch_config: fixedKeys.includes(courseNameKey)
        ? {
            ...existingRowFetchConfig,
            trigger_field: getRuleStringValue(
              renderRule,
              'trigger_field',
              String(existingRowFetchConfig.trigger_field || courseNameKey),
            ),
            primary_table: getRuleStringValue(
              renderRule,
              'primary_table',
              String(existingRowFetchConfig.primary_table || 'courses'),
            ),
            join_table: getRuleStringValue(
              renderRule,
              'join_table',
              String(existingRowFetchConfig.join_table || 'courses'),
            ),
            join_conditions: Array.isArray(existingRowFetchConfig.join_conditions)
              ? existingRowFetchConfig.join_conditions
              : [],
            fields_to_fetch: fieldsToFetch,
          }
        : existingRowFetchConfig,
      button_config: {
        show_add_row_button: true,
        show_copy_button: true,
        show_delete_button: true,
      },
    };
  });

  return {
    ...template,
    structure: {
      ...template.structure,
      headers: nextHeaders as TableTemplate['structure']['headers'],
      blocks: nextBlocks as TableTemplate['structure']['blocks'],
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
  };
}

function normalizePloHeadersFromTemplate(
  template: TableTemplate,
  ploColumnCount: number,
  renderRule?: Record<string, unknown> | null,
): TableTemplate {
  const groupedPloColumnConfigs = getGroupedPloColumnConfigs(renderRule);
  if (groupedPloColumnConfigs.length > 0) {
    return normalizeGroupedPloHeadersFromTemplate(template, ploColumnCount, renderRule, groupedPloColumnConfigs);
  }

  const normalizedCount = Number.isFinite(ploColumnCount) ? Math.max(1, Math.floor(ploColumnCount)) : 1;
  const oldHeaders = template.structure.headers || [];
  const oldBlocks = template.structure.blocks || [];
  const sttKey = getRuleStringValue(renderRule, 'stt_key', 'stt');
  const fixedColumnKeys = getRenderRuleArray(renderRule ?? undefined, 'fixed_column_keys');
  const fixedKeys = fixedColumnKeys.length > 0 ? fixedColumnKeys : [sttKey, 'course_code', 'course_name'];
  const ploParentKey = getRuleStringValue(renderRule, 'plo_parent_key', 'plo_group');
  const ploColumnPrefix = getRuleStringValue(renderRule, 'plo_column_prefix', 'plo_');
  const courseCodeKey = getRuleStringValue(renderRule, 'course_code_key', 'course_code');
  const courseNameKey = getRuleStringValue(renderRule, 'course_name_key', 'course_name');
  const courseCodeTableField = getRuleStringValue(renderRule, 'course_code_table_field', 'courses.code');
  const courseNameTableField = getRuleStringValue(renderRule, 'course_name_table_field', 'courses.name');
  const courseNameLabelField = getRuleStringValue(renderRule, 'course_name_label_field', '');
  const courseNameDropdownConfig = courseNameLabelField ? { label_field: courseNameLabelField } : undefined;
  const ploGroupWidth = getRuleNumberValue(renderRule, 'plo_group_width', 40);

  const oldChildHeaders = oldHeaders.filter((header) => !header.is_parent_header && header.parent === ploParentKey);
  const oldCodeByKey = new Map(oldChildHeaders.map((header) => [header.key, String(header.label || '')]));

  const fixedHeaders = oldHeaders.filter((header) => fixedKeys.includes(String(header.key || '')));

  const parentHeader = {
    ...(oldHeaders.find((header) => header.key === ploParentKey) || {
      label: 'Chuẩn đầu ra của chương trình đào tạo (PLO)',
      key: ploParentKey,
      width: `${ploGroupWidth}%`,
      is_parent_header: true,
      read_only: true,
    }),
    colspan: normalizedCount,
  };

  const childWidth = `${(ploGroupWidth / normalizedCount).toFixed(2)}%`;
  const nextChildHeaders = [] as Array<{
    label: string;
    key: string;
    width: string;
    parent: string;
  }>;
  for (let index = 1; index <= normalizedCount; index += 1) {
    nextChildHeaders.push({
      label: String(index),
      key: `${ploColumnPrefix}${index}`,
      width: childWidth,
      parent: ploParentKey,
    });
  }

  const nextHeaders = [
    ...fixedHeaders.map((header) => ({
      ...header,
      rowspan: 2,
      ...(header.key === courseCodeKey ? { read_only: true } : {}),
      ...(header.key === courseNameKey ? { read_only: false, ...courseNameDropdownConfig } : {}),
    })),
    parentHeader,
    ...nextChildHeaders,
  ];

  const nextBlocks = oldBlocks.map((block) => {
    const subsectionBase = block.subsection || { type: 'subsection' };
    const subsection = {
      ...subsectionBase,
      [sttKey]: readonlyCellWithValue(cellStringValue(subsectionBase[sttKey]), subsectionBase[sttKey]),
      [courseCodeKey]: readonlyCellWithValue('', subsectionBase[courseCodeKey], courseCodeTableField),
      [courseNameKey]: readonlyCellWithValue(
        '',
        subsectionBase[courseNameKey],
        courseNameTableField,
        courseNameDropdownConfig,
      ),
      cell_merge: {
        [sttKey]: {
          colspan: 3 + nextChildHeaders.length,
        },
      },
    } as Record<string, any>;

    nextChildHeaders.forEach((header) => {
      subsection[header.key] = readonlyCellWithValue('', subsectionBase[header.key]);
    });

    const nextRows = (block.rows || []).map((row) => {
      const courseCodeValue = cellStringValue(row[courseCodeKey]);
      const nextRow: Record<string, any> = {
        ...row,
        [sttKey]: editableCellWithValue(cellStringValue(row[sttKey]), row[sttKey]),
        [courseCodeKey]: courseCodeValue
          ? readonlyCellWithValue(courseCodeValue, row[courseCodeKey], courseCodeTableField)
          : editableCellWithValue('', row[courseCodeKey], courseCodeTableField),
        [courseNameKey]: editableCellWithValue(
          cellStringValue(row[courseNameKey]),
          row[courseNameKey],
          courseNameTableField,
          false,
          courseNameDropdownConfig,
        ),
      };

      nextChildHeaders.forEach((header) => {
        const directCell = row[header.key];
        if (directCell !== undefined) {
          nextRow[header.key] = editableCellWithValue(cellStringValue(directCell), directCell);
          return;
        }

        const matchedOldHeader = oldChildHeaders.find(
          (oldHeader) => (oldCodeByKey.get(oldHeader.key) || '') === header.label,
        );
        const migratedCell = matchedOldHeader ? row[matchedOldHeader.key] : undefined;

        nextRow[header.key] = editableCellWithValue(cellStringValue(migratedCell), migratedCell);
      });

      return nextRow;
    });

    const row_template_base = block.row_template && typeof block.row_template === 'object' ? block.row_template : {};
    const next_row_template: Record<string, any> = {
      ...row_template_base,
      [sttKey]: editableCellWithValue('', row_template_base[sttKey]),
      [courseCodeKey]: readonlyCellWithValue('', row_template_base[courseCodeKey], courseCodeTableField),
      [courseNameKey]: editableCellWithValue(
        '',
        row_template_base[courseNameKey],
        courseNameTableField,
        false,
        courseNameDropdownConfig,
      ),
    };

    nextChildHeaders.forEach((header) => {
      next_row_template[header.key] = editableCellWithValue('', row_template_base[header.key]);
    });

    const existingRowFetchConfig =
      block.row_fetch_config && typeof block.row_fetch_config === 'object'
        ? (block.row_fetch_config as Record<string, unknown>)
        : {};
    const fieldsToFetch = Array.isArray(existingRowFetchConfig.fields_to_fetch)
      ? existingRowFetchConfig.fields_to_fetch
      : [
          {
            key: courseCodeKey,
            table: courseCodeTableField.split('.')[0] || 'courses',
            field: courseCodeTableField.split('.')[1] || 'code',
          },
          {
            key: courseNameKey,
            table: courseNameTableField.split('.')[0] || 'courses',
            field: courseNameTableField.split('.')[1] || 'name',
          },
        ];

    return {
      ...block,
      subsection,
      row_template: next_row_template,
      rows: nextRows,
      row_fetch_config: {
        ...existingRowFetchConfig,
        trigger_field: getRuleStringValue(
          renderRule,
          'trigger_field',
          String(existingRowFetchConfig.trigger_field || courseNameKey),
        ),
        primary_table: getRuleStringValue(
          renderRule,
          'primary_table',
          String(existingRowFetchConfig.primary_table || 'courses'),
        ),
        join_table: getRuleStringValue(
          renderRule,
          'join_table',
          String(existingRowFetchConfig.join_table || 'courses'),
        ),
        join_conditions: Array.isArray(existingRowFetchConfig.join_conditions)
          ? existingRowFetchConfig.join_conditions
          : [],
        fields_to_fetch: fieldsToFetch,
      },
      button_config: {
        show_add_row_button: true,
        show_copy_button: true,
        show_delete_button: true,
      },
    };
  });

  return {
    ...template,
    structure: {
      ...template.structure,
      headers: nextHeaders as TableTemplate['structure']['headers'],
      blocks: nextBlocks as TableTemplate['structure']['blocks'],
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
  };
}

function normalizeSyllabusCloPloMatrixTemplate(
  template: TableTemplate,
  cloCount: number,
  ploCount: number,
  renderRule?: Record<string, unknown> | null,
): TableTemplate {
  const normalizedCloCount = Number.isFinite(cloCount) ? Math.max(1, Math.floor(cloCount)) : 1;
  const normalizedPloCount = Number.isFinite(ploCount) ? Math.max(1, Math.floor(ploCount)) : 1;

  const oldHeaders = template.structure.headers || [];
  const oldBlocks = template.structure.blocks || [];
  const fallbackBlockId = typeof oldBlocks[0]?.id === 'string' && oldBlocks[0].id ? oldBlocks[0].id : 'matrix_block';
  const blockId = getRuleStringValue(renderRule, 'block_id', fallbackBlockId);
  const cloColumnKey = getRuleStringValue(renderRule, 'clo_column_key', 'clo_code');
  const ploParentKey = getRuleStringValue(renderRule, 'plo_parent_key', 'plo_group');
  const ploColumnPrefix = getRuleStringValue(renderRule, 'plo_column_prefix', 'plo_');
  const rowIdPrefix = getRuleStringValue(renderRule, 'row_id_prefix', 'row_clo_');

  const cloHeader = {
    ...(oldHeaders.find((header) => header.key === cloColumnKey) || {
      label: 'Chuẩn đầu ra của học phần (CLOs)',
      key: cloColumnKey,
      width: '24%',
      is_required: true,
      background_color: '#fff59d',
    }),
    rowspan: 2,
    width: '24%',
  };

  const ploParentHeader = {
    ...(oldHeaders.find((header) => header.key === ploParentKey) || {
      label: 'Chuẩn đầu ra của chương trình đào tạo (PLOs)',
      key: ploParentKey,
      width: '76%',
      is_parent_header: true,
      read_only: true,
      background_color: '#fff59d',
    }),
    colspan: normalizedPloCount,
    width: '76%',
  };

  const childWidth = `${(76 / normalizedPloCount).toFixed(2)}%`;
  const nextPloHeaders = Array.from({ length: normalizedPloCount }, (_, index) => ({
    label: String(index + 1),
    key: `${ploColumnPrefix}${index + 1}`,
    width: childWidth,
    parent: ploParentKey,
    is_required: true,
    background_color: '#fff59d',
  }));

  const nextHeaders = [cloHeader, ploParentHeader, ...nextPloHeaders];

  const sourceBlock = oldBlocks.find((block) => block.id === blockId) ||
    oldBlocks[0] || {
      id: blockId,
      subsection: null,
      rows: [],
    };

  const row_template_base =
    sourceBlock.row_template && typeof sourceBlock.row_template === 'object'
      ? (sourceBlock.row_template as Record<string, unknown>)
      : {};

  const next_row_template: Record<string, any> = {
    ...row_template_base,
    [cloColumnKey]: editableCellWithValue('', row_template_base[cloColumnKey]),
  };

  nextPloHeaders.forEach((header) => {
    next_row_template[header.key] = editableCellWithValue('', row_template_base[header.key]);
  });

  const existingRows = Array.isArray(sourceBlock.rows) ? sourceBlock.rows : [];

  const nextRows = Array.from({ length: normalizedCloCount }, (_, index) => {
    const rowBase =
      existingRows[index] && typeof existingRows[index] === 'object'
        ? (existingRows[index] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const nextRow: Record<string, any> = {
      ...rowBase,
      id: (typeof rowBase.id === 'string' && rowBase.id) || `${rowIdPrefix}${index + 1}`,
      [cloColumnKey]: editableCellWithValue(
        cellStringValue(rowBase[cloColumnKey]) || `CLO${index + 1}`,
        rowBase[cloColumnKey],
      ),
      row_button_config:
        rowBase.row_button_config && typeof rowBase.row_button_config === 'object'
          ? rowBase.row_button_config
          : {
              show_copy_button: true,
              show_delete_button: true,
            },
      cell_merge: rowBase.cell_merge && typeof rowBase.cell_merge === 'object' ? rowBase.cell_merge : {},
    };

    nextPloHeaders.forEach((header, ploIndex) => {
      const directCell = rowBase[header.key];
      const fallbackCell = rowBase[`${ploColumnPrefix}${ploIndex + 1}`];
      const sourceCell = directCell !== undefined ? directCell : fallbackCell;
      nextRow[header.key] = editableCellWithValue(cellStringValue(sourceCell), sourceCell);
    });

    return nextRow;
  });

  const nextBlock = {
    ...sourceBlock,
    id: blockId,
    subsection: null,
    row_template: next_row_template,
    rows: nextRows,
    button_config: {
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
  };

  return {
    ...template,
    structure: {
      ...template.structure,
      headers: nextHeaders as TableTemplate['structure']['headers'],
      blocks: [nextBlock] as TableTemplate['structure']['blocks'],
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
  };
}

function syncSyllabusCloPloMatrixContextFromTemplate(
  template: TableTemplate,
  schema: TTableTemplateContextSchema | null | undefined,
  contextKeys: { cloCountKey: string; ploCountKey: string },
): TableTemplate {
  const blocks = template.structure.blocks || [];
  const fallbackBlockId = typeof blocks[0]?.id === 'string' && blocks[0].id ? blocks[0].id : 'matrix_block';
  const blockId = getTableContextRenderRuleString(schema, 'block_id', fallbackBlockId);
  const ploParentKey = getTableContextRenderRuleString(schema, 'plo_parent_key', 'plo_group');
  const ploColumnPrefix = getTableContextRenderRuleString(schema, 'plo_column_prefix', 'plo_');
  const matrixBlock = blocks.find((block) => block.id === blockId) ?? blocks[0];
  const rowCount = Array.isArray(matrixBlock?.rows) ? matrixBlock.rows.length : 0;
  const ploCount = (template.structure.headers || []).filter(
    (header) =>
      !header.is_parent_header &&
      header.parent === ploParentKey &&
      (!ploColumnPrefix || header.key.startsWith(ploColumnPrefix)),
  ).length;

  return {
    ...template,
    context: {
      ...(template.context || {}),
      [contextKeys.cloCountKey]: Math.max(1, rowCount),
      [contextKeys.ploCountKey]: Math.max(1, ploCount),
    },
  };
}

function getRenderRuleArray(rule: Record<string, unknown> | undefined, key: string) {
  const value = rule?.[key];
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getRenderRuleNumber(rule: Record<string, unknown> | undefined, key: string, fallback: number) {
  const value = rule?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getRepeatBlockReplacements(rule: Record<string, unknown> | undefined) {
  const value = rule?.replacements;
  if (!Array.isArray(value)) return [] as Array<{ from: string; to: string }>;

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.from !== 'string' || typeof candidate.to !== 'string') return null;
      return {
        from: candidate.from,
        to: candidate.to,
      };
    })
    .filter((item): item is { from: string; to: string } => Boolean(item));
}

function renderRepeatBlockString(
  value: string,
  rule: Record<string, unknown> | undefined,
  context: { index: number; sourceIndex: number; count: number },
) {
  const replaceTokens = (source: string) =>
    source
      .replace(/\{\{\s*index\s*\}\}/g, String(context.index))
      .replace(/\{\{\s*sourceIndex\s*\}\}/g, String(context.sourceIndex))
      .replace(/\{\{\s*count\s*\}\}/g, String(context.count));

  let nextValue = replaceTokens(value);
  getRepeatBlockReplacements(rule).forEach((replacement) => {
    const from = replaceTokens(replacement.from);
    if (!from) return;
    nextValue = nextValue.split(from).join(replaceTokens(replacement.to));
  });

  return nextValue;
}

function applyRepeatBlockTemplateValue<T>(
  value: T,
  rule: Record<string, unknown> | undefined,
  context: { index: number; sourceIndex: number; count: number },
): T {
  if (typeof value === 'string') {
    return renderRepeatBlockString(value, rule, context) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyRepeatBlockTemplateValue(item, rule, context)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, itemValue]) => [
        key,
        applyRepeatBlockTemplateValue(itemValue, rule, context),
      ]),
    ) as T;
  }

  return value;
}

function parseRepeatBlockNumber(value: unknown): number {
  const raw = cellStringValue(value).trim();
  if (!raw) return 0;
  const normalized = raw.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRepeatBlockNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function normalizeRepeatBlocksTemplate(
  template: TableTemplate,
  rule: Record<string, unknown> | undefined,
  repeatCount: number,
): TableTemplate {
  const sourceBlockIds = getRenderRuleArray(rule, 'source_block_ids');
  if (sourceBlockIds.length === 0) return template;

  const normalizedCount = Number.isFinite(repeatCount) ? Math.max(1, Math.floor(repeatCount)) : 1;
  const sourceIndex = Math.floor(getRenderRuleNumber(rule, 'source_index', 1));
  const indexStart = Math.floor(getRenderRuleNumber(rule, 'index_start', 1));
  const oldBlocks = template.structure.blocks || [];
  const oldBlocksById = new Map(
    oldBlocks.filter((block) => typeof block.id === 'string' && block.id).map((block) => [String(block.id), block]),
  );
  const sourceBlocks = sourceBlockIds
    .map((blockId) => oldBlocksById.get(blockId))
    .filter((block): block is TableTemplate['structure']['blocks'][number] => Boolean(block));

  if (sourceBlocks.length === 0) return template;

  const nextBlocks = [] as TableTemplate['structure']['blocks'];

  for (let offset = 0; offset < normalizedCount; offset += 1) {
    const index = indexStart + offset;
    const context = { index, sourceIndex, count: normalizedCount };

    sourceBlocks.forEach((sourceBlock) => {
      const generatedBlock = applyRepeatBlockTemplateValue(sourceBlock, rule, context);
      const generatedBlockId = typeof generatedBlock.id === 'string' ? generatedBlock.id : '';
      const existingBlock = generatedBlockId ? oldBlocksById.get(generatedBlockId) : undefined;

      nextBlocks.push({
        ...generatedBlock,
        subsection: existingBlock?.subsection ?? generatedBlock.subsection,
        row_template: existingBlock?.row_template ?? generatedBlock.row_template,
        rows: existingBlock?.rows ?? generatedBlock.rows ?? [],
      });
    });
  }

  const summaryRules = Array.isArray(rule?.summary_rules) ? rule.summary_rules : [];
  summaryRules.forEach((summaryRule) => {
    if (!summaryRule || typeof summaryRule !== 'object' || Array.isArray(summaryRule)) return;
    const config = summaryRule as Record<string, unknown>;
    const targetField = typeof config.target_field === 'string' ? config.target_field : '';
    const sourceFields = Array.isArray(config.source_fields)
      ? config.source_fields.filter((field): field is string => typeof field === 'string' && field.trim().length > 0)
      : [];
    const targetBlockPattern = typeof config.target_block_id === 'string' ? config.target_block_id : '';
    const sourceBlockPattern = typeof config.source_block_id === 'string' ? config.source_block_id : '';
    if (!targetField || sourceFields.length === 0 || !targetBlockPattern || !sourceBlockPattern) return;

    for (let offset = 0; offset < normalizedCount; offset += 1) {
      const index = indexStart + offset;
      const context = { index, sourceIndex, count: normalizedCount };
      const targetBlockId = renderRepeatBlockString(targetBlockPattern, rule, context);
      const sourceBlockId = renderRepeatBlockString(sourceBlockPattern, rule, context);
      const targetBlock = nextBlocks.find((block) => block.id === targetBlockId);
      const sourceBlock = nextBlocks.find((block) => block.id === sourceBlockId);
      if (!targetBlock?.subsection || !sourceBlock) continue;

      const total = (sourceBlock.rows || []).reduce((acc, row) => {
        const rowData = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
        return acc + sourceFields.reduce((sum, field) => sum + parseRepeatBlockNumber(rowData[field]), 0);
      }, 0);
      const subsection = targetBlock.subsection as Record<string, unknown>;
      subsection[targetField] = readonlyCellWithValue(formatRepeatBlockNumber(total), subsection[targetField]);
    }
  });
  const sourceBlockIdSet = new Set(sourceBlockIds);
  const generatedBlockIdSet = new Set(nextBlocks.map((block) => block.id).filter(Boolean));
  const orderedBlocks = oldBlocks.reduce<TableTemplate['structure']['blocks']>((acc, block) => {
    if (block.id && sourceBlockIdSet.has(block.id)) {
      if (!acc.some((item) => item.id === nextBlocks[0]?.id)) {
        acc.push(...nextBlocks);
      }
      return acc;
    }

    if (block.id && generatedBlockIdSet.has(block.id)) return acc;
    acc.push(block);
    return acc;
  }, []);

  if (!orderedBlocks.some((block) => block.id === nextBlocks[0]?.id)) {
    orderedBlocks.push(...nextBlocks);
  }

  return {
    ...template,
    context: {
      ...(template.context || {}),
      [getTableContextRenderRuleString({ render_rule: rule }, 'count_key', 'count')]: normalizedCount,
    },
    structure: {
      ...template.structure,
      blocks: orderedBlocks,
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
  };
}

function parseObjectiveComparisonSchoolList(rawValue: unknown, limit = 20): string[] {
  const normalize = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());

  const rawList = Array.isArray(rawValue)
    ? rawValue.map(normalize)
    : normalize(rawValue)
        .split(/[\n,;]+/g)
        .map((item) => item.trim());

  const deduplicated: string[] = [];
  const seen = new Set<string>();
  rawList.forEach((item) => {
    if (!item) return;
    const dedupeKey = item.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    deduplicated.push(item);
  });

  return deduplicated.slice(0, limit);
}

function getObjectiveComparisonChildHeaders(headers: TableTemplate['structure']['headers'], parentKey: string) {
  return (headers || []).filter(
    (header) =>
      !header.is_parent_header &&
      header.parent === parentKey &&
      typeof header.key === 'string' &&
      header.key.length > 0,
  );
}

function isObjectiveComparisonMatched(value: unknown): boolean {
  const normalized = cellStringValue(value).trim().toLowerCase();
  if (!normalized) return false;
  return ['x', '1', 'true', 'y', 'yes', 'co', 'có', '✓', '✔'].includes(normalized);
}

function formatObjectiveComparisonPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(2).replace(/\.?0+$/, '')}%`;
}

function createAppendixCurriculumHeadingBlock(id: string, label: string): TableTemplate['structure']['blocks'][number] {
  return {
    id,
    subsection: {
      type: 'subsection',
      category: readonlyCellWithValue(label),
      credits: readonlyCellWithValue(''),
      similarity_percent: readonlyCellWithValue(''),
      cell_merge: {
        category: {
          colspan: 2,
        },
      },
    } as unknown as TableTemplate['structure']['blocks'][number]['subsection'],
    rows: [],
    button_config: {
      show_add_row_button: false,
      show_copy_button: false,
      show_delete_button: false,
    },
  };
}

function createAppendixCurriculumRowsBlock(id: string): TableTemplate['structure']['blocks'][number] {
  return {
    id,
    subsection: null,
    rows: [],
    row_template: {
      category: editableCellWithValue('', undefined, 'courses.name'),
      credits: editableCellWithValue(''),
      similarity_percent: readonlyCellWithValue(''),
    },
    button_config: {
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
  };
}

function ensureAppendixCurriculumComparisonBlocks(
  blocks: TableTemplate['structure']['blocks'],
): TableTemplate['structure']['blocks'] {
  const blockIds = new Set((blocks || []).map((block) => String(block?.id || '')));
  const missingBlocks: TableTemplate['structure']['blocks'] = [];

  if (!blockIds.has('heading_1_1')) {
    missingBlocks.push(createAppendixCurriculumHeadingBlock('heading_1_1', '1.1 Lý luận chính trị'));
  }
  if (!blockIds.has('rows_1_1')) {
    missingBlocks.push(createAppendixCurriculumRowsBlock('rows_1_1'));
  }
  if (!blockIds.has('heading_1_2')) {
    missingBlocks.push(createAppendixCurriculumHeadingBlock('heading_1_2', '1.2 Khoa học xã hội'));
  }
  if (!blockIds.has('rows_1_2')) {
    missingBlocks.push(createAppendixCurriculumRowsBlock('rows_1_2'));
  }

  if (missingBlocks.length === 0) {
    return blocks;
  }

  const nextBlocks = (blocks || []).filter((block) => String(block?.id || '') !== 'rows_1_general');
  const insertIndex = nextBlocks.findIndex((block) => {
    const blockId = String(block?.id || '');
    return blockId === 'heading_1_3' || blockId === 'rows_1_3';
  });

  if (insertIndex === -1) {
    const headingIndex = nextBlocks.findIndex((block) => String(block?.id || '') === 'heading_i');
    const targetIndex = headingIndex === -1 ? nextBlocks.length : headingIndex + 1;
    return [...nextBlocks.slice(0, targetIndex), ...missingBlocks, ...nextBlocks.slice(targetIndex)];
  }

  return [...nextBlocks.slice(0, insertIndex), ...missingBlocks, ...nextBlocks.slice(insertIndex)];
}

function normalizeObjectiveComparisonTemplate(
  template: TableTemplate,
  domesticSchools: string[],
  foreignSchools: string[],
  renderRule?: Record<string, unknown> | null,
): TableTemplate {
  const oldHeaders = template.structure.headers || [];
  const oldBlocks = template.structure.blocks || [];
  const domesticParentKey = getRuleStringValue(renderRule, 'domestic_parent_key', 'domestic_group');
  const foreignParentKey = getRuleStringValue(renderRule, 'foreign_parent_key', 'foreign_group');
  const appendixDefaultsTemplateId = getRuleStringValue(renderRule, 'appendix_defaults_template_id', '');
  const shouldEnsureAppendixBlocks = Boolean(renderRule?.ensure_appendix_blocks);

  const oldDomesticChildHeaders = getObjectiveComparisonChildHeaders(oldHeaders, domesticParentKey);
  const oldForeignChildHeaders = getObjectiveComparisonChildHeaders(oldHeaders, foreignParentKey);

  const normalizedDomesticSchools =
    domesticSchools.length > 0
      ? domesticSchools
      : oldDomesticChildHeaders.map((header) => String(header.label || '').trim()).filter(Boolean);
  const normalizedForeignSchools =
    foreignSchools.length > 0
      ? foreignSchools
      : oldForeignChildHeaders.map((header) => String(header.label || '').trim()).filter(Boolean);

  const safeDomesticSchools =
    normalizedDomesticSchools.length > 0 ? normalizedDomesticSchools : ['Trường trong nước 1'];
  const safeForeignSchools = normalizedForeignSchools.length > 0 ? normalizedForeignSchools : ['Trường nước ngoài 1'];

  const baseCategoryHeader = oldHeaders.find((header) => header.key === 'category') || {
    label: 'Danh mục',
    key: 'category',
    width: '12%',
    rowspan: 2,
    is_required: true,
    background_color: '#f5f5f5',
  };
  const defaultMainContentKey = getRuleStringValue(renderRule, 'main_content_key', 'main_objective');

  const mainHeaderCandidate = oldHeaders.find((header) => {
    if (header.is_parent_header) return false;
    if (header.key === 'category' || header.key === 'similarity_percent') {
      return false;
    }
    if (!header.parent) {
      return typeof header.key === 'string' && header.key.length > 0;
    }

    const parentKey = String(header.parent || '');
    if (!parentKey) return false;
    const siblingKeys = oldHeaders
      .filter((candidate) => !candidate.is_parent_header && candidate.parent === parentKey)
      .map((candidate) => String(candidate.key || ''));

    return siblingKeys.includes('category') && typeof header.key === 'string' && header.key.length > 0;
  });
  const mainContentKey =
    (typeof mainHeaderCandidate?.key === 'string' && mainHeaderCandidate.key) || defaultMainContentKey;

  const baseMainObjectiveHeader = mainHeaderCandidate || {
    label: 'CTĐT ngành Khoa học dữ liệu Trường ĐHGD',
    key: mainContentKey,
    width: '24%',
    rowspan: 2,
    is_required: true,
    background_color: '#f5f5f5',
  };
  const baseMainProgramParentHeader = oldHeaders.find((header) => {
    if (!header.is_parent_header || header.parent) return false;
    const parentKey = String(header.key || '');
    if (!parentKey) return false;
    const childKeys = oldHeaders
      .filter((candidate) => !candidate.is_parent_header && candidate.parent === parentKey)
      .map((candidate) => String(candidate.key || ''));
    return childKeys.includes('category') && childKeys.includes(mainContentKey);
  });
  const baseDomesticParentHeader = oldHeaders.find((header) => header.key === domesticParentKey) || {
    label: 'CTĐT của các trường trong nước',
    key: domesticParentKey,
    width: '24%',
    is_parent_header: true,
    read_only: true,
    background_color: '#f5f5f5',
  };
  const baseForeignParentHeader = oldHeaders.find((header) => header.key === foreignParentKey) || {
    label: 'CTĐT của các trường nước ngoài',
    key: foreignParentKey,
    width: '24%',
    is_parent_header: true,
    read_only: true,
    background_color: '#f5f5f5',
  };
  const baseSimilarityHeader = oldHeaders.find((header) => header.key === 'similarity_percent') || {
    label: 'Tỷ lệ (%) % nội dung giống nhau với các CTĐT tham khảo',
    key: 'similarity_percent',
    width: '16%',
    rowspan: 2,
    background_color: '#f5f5f5',
  };

  const domesticChildWidth = `${(24 / safeDomesticSchools.length).toFixed(2)}%`;
  const foreignChildWidth = `${(24 / safeForeignSchools.length).toFixed(2)}%`;

  const domesticHeaders = safeDomesticSchools.map((schoolName, idx) => ({
    label: schoolName,
    key: `domestic_${idx + 1}`,
    width: domesticChildWidth,
    parent: domesticParentKey,
  }));
  const foreignHeaders = safeForeignSchools.map((schoolName, idx) => ({
    label: schoolName,
    key: `foreign_${idx + 1}`,
    width: foreignChildWidth,
    parent: foreignParentKey,
  }));

  const useMainProgramParentHeader = !!baseMainProgramParentHeader;
  const nextHeaders = (
    useMainProgramParentHeader
      ? [
          {
            ...baseMainProgramParentHeader,
            is_parent_header: true,
            read_only: true,
            colspan: 2,
          },
          {
            ...baseCategoryHeader,
            parent: String(baseMainProgramParentHeader?.key || ''),
            rowspan: 1,
          },
          {
            ...baseMainObjectiveHeader,
            parent: String(baseMainProgramParentHeader?.key || ''),
            rowspan: 1,
          },
          {
            ...baseDomesticParentHeader,
            is_parent_header: true,
            read_only: true,
            colspan: domesticHeaders.length,
          },
          ...domesticHeaders,
          {
            ...baseForeignParentHeader,
            is_parent_header: true,
            read_only: true,
            colspan: foreignHeaders.length,
          },
          ...foreignHeaders,
          {
            ...baseSimilarityHeader,
            rowspan: 2,
          },
        ]
      : [
          { ...baseCategoryHeader, rowspan: 2 },
          { ...baseMainObjectiveHeader, rowspan: 2 },
          {
            ...baseDomesticParentHeader,
            is_parent_header: true,
            read_only: true,
            colspan: domesticHeaders.length,
          },
          ...domesticHeaders,
          {
            ...baseForeignParentHeader,
            is_parent_header: true,
            read_only: true,
            colspan: foreignHeaders.length,
          },
          ...foreignHeaders,
          {
            ...baseSimilarityHeader,
            rowspan: 2,
          },
        ]
  ) as TableTemplate['structure']['headers'];

  const domesticOldKeyByLabel = new Map(
    oldDomesticChildHeaders.map((header) => [
      String(header.label || '')
        .trim()
        .toLowerCase(),
      String(header.key || ''),
    ]),
  );
  const foreignOldKeyByLabel = new Map(
    oldForeignChildHeaders.map((header) => [
      String(header.label || '')
        .trim()
        .toLowerCase(),
      String(header.key || ''),
    ]),
  );

  const getCellByLabel = (
    rowData: Record<string, unknown>,
    fallbackMap: Map<string, string>,
    newKey: string,
    label: string,
  ): unknown => {
    if (rowData[newKey] !== undefined) return rowData[newKey];
    const fallbackKey = fallbackMap.get(label.trim().toLowerCase()) || '';
    if (!fallbackKey) return undefined;
    return rowData[fallbackKey];
  };

  const getMainContentCell = (rowData: Record<string, unknown>): unknown => {
    if (rowData[mainContentKey] !== undefined) {
      return rowData[mainContentKey];
    }
    const fallbackKeys = [defaultMainContentKey, 'main_objective', 'program_outcome'];
    for (const key of fallbackKeys) {
      if (key === mainContentKey) continue;
      if (rowData[key] !== undefined) return rowData[key];
    }
    return undefined;
  };

  const comparisonHeaderKeys = [...domesticHeaders, ...foreignHeaders].map((header) => header.key);
  const appendixCurriculumDefaultBlocks =
    appendixDefaultsTemplateId && shouldEnsureAppendixBlocks
      ? getTableTemplateById(appendixDefaultsTemplateId)?.structure?.blocks || []
      : [];
  const shouldUseAppendixCurriculumDefaults =
    shouldEnsureAppendixBlocks &&
    (oldBlocks.length === 0 || !oldBlocks.some((block) => String(block?.id || '').startsWith('heading_')));
  const sourceBlocksBase =
    shouldUseAppendixCurriculumDefaults && appendixCurriculumDefaultBlocks.length > 0
      ? (JSON.parse(JSON.stringify(appendixCurriculumDefaultBlocks)) as TableTemplate['structure']['blocks'])
      : oldBlocks.length > 0
        ? oldBlocks
        : ([
            {
              id: 'comparison_rows',
              subsection: null,
              rows: [],
              row_template: {},
              button_config: {
                show_add_row_button: true,
                show_copy_button: true,
                show_delete_button: true,
              },
            },
          ] as TableTemplate['structure']['blocks']);
  const sourceBlocks = shouldEnsureAppendixBlocks
    ? ensureAppendixCurriculumComparisonBlocks(sourceBlocksBase)
    : sourceBlocksBase;

  const createEditableMainCategoryCell = (value: string, previous?: unknown) =>
    shouldEnsureAppendixBlocks
      ? editableCellWithValue(value, previous, 'courses.name')
      : editableCellWithValue(value, previous);

  const getComparisonSimilarityValue = (rowData: Record<string, unknown>) => {
    const comparisonValues = comparisonHeaderKeys.map((key) => rowData[key]);
    const hasAnyComparisonValue = comparisonValues.some((value) => cellStringValue(value).trim().length > 0);
    if (!hasAnyComparisonValue) {
      return cellStringValue(rowData.similarity_percent);
    }

    const matchedCount = comparisonValues.filter(isObjectiveComparisonMatched).length;
    return formatObjectiveComparisonPercent((matchedCount / Math.max(1, comparisonHeaderKeys.length)) * 100);
  };

  const normalizeComparisonSubsection = (
    subsectionValue: unknown,
  ): TableTemplate['structure']['blocks'][number]['subsection'] => {
    if (!subsectionValue || typeof subsectionValue !== 'object') return null;

    const subsectionData = subsectionValue as Record<string, unknown>;
    const sourceMainCell = getMainContentCell(subsectionData);
    const nextSubsection: Record<string, unknown> = {
      ...subsectionData,
      type: 'subsection',
      category: readonlyCellWithValue(cellStringValue(subsectionData.category), subsectionData.category),
      [mainContentKey]: readonlyCellWithValue(cellStringValue(sourceMainCell), sourceMainCell),
      similarity_percent: readonlyCellWithValue(
        cellStringValue(subsectionData.similarity_percent),
        subsectionData.similarity_percent,
      ),
    };

    domesticHeaders.forEach((header) => {
      const sourceCell = getCellByLabel(subsectionData, domesticOldKeyByLabel, header.key, String(header.label || ''));
      nextSubsection[header.key] = readonlyCellWithValue(cellStringValue(sourceCell), sourceCell);
    });
    foreignHeaders.forEach((header) => {
      const sourceCell = getCellByLabel(subsectionData, foreignOldKeyByLabel, header.key, String(header.label || ''));
      nextSubsection[header.key] = readonlyCellWithValue(cellStringValue(sourceCell), sourceCell);
    });

    return nextSubsection as unknown as TableTemplate['structure']['blocks'][number]['subsection'];
  };

  const nextBlocks = sourceBlocks.map((sourceBlock, blockIdx) => {
    const row_template_base =
      sourceBlock?.row_template && typeof sourceBlock.row_template === 'object'
        ? (sourceBlock.row_template as Record<string, unknown>)
        : {};
    const sourceRows = Array.isArray(sourceBlock?.rows) ? sourceBlock.rows : [];

    const normalizedRows = sourceRows.map((row, rowIdx) => {
      const rowData = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      const sourceMainCell = getMainContentCell(rowData);

      const nextRow: Record<string, unknown> = {
        ...rowData,
        id:
          (typeof rowData.id === 'string' && rowData.id) || `${sourceBlock.id || 'comparison_rows'}_row_${rowIdx + 1}`,
        category: createEditableMainCategoryCell(cellStringValue(rowData.category), rowData.category),
        [mainContentKey]: editableCellWithValue(cellStringValue(sourceMainCell), sourceMainCell),
      };

      domesticHeaders.forEach((header) => {
        const sourceCell = getCellByLabel(rowData, domesticOldKeyByLabel, header.key, String(header.label || ''));
        nextRow[header.key] = editableCellWithValue(cellStringValue(sourceCell), sourceCell);
      });
      foreignHeaders.forEach((header) => {
        const sourceCell = getCellByLabel(rowData, foreignOldKeyByLabel, header.key, String(header.label || ''));
        nextRow[header.key] = editableCellWithValue(cellStringValue(sourceCell), sourceCell);
      });

      nextRow.similarity_percent = readonlyCellWithValue(
        getComparisonSimilarityValue(nextRow),
        rowData.similarity_percent,
      );

      return nextRow;
    });

    const sourceMainTemplateCell = getMainContentCell(row_template_base);
    const next_row_template: Record<string, unknown> = {
      ...row_template_base,
      category: createEditableMainCategoryCell('', row_template_base.category),
      [mainContentKey]: editableCellWithValue('', sourceMainTemplateCell),
      similarity_percent: readonlyCellWithValue('', row_template_base.similarity_percent),
    };

    domesticHeaders.forEach((header) => {
      const sourceTemplateCell = getCellByLabel(
        row_template_base,
        domesticOldKeyByLabel,
        header.key,
        String(header.label || ''),
      );
      next_row_template[header.key] = editableCellWithValue('', sourceTemplateCell);
    });
    foreignHeaders.forEach((header) => {
      const sourceTemplateCell = getCellByLabel(
        row_template_base,
        foreignOldKeyByLabel,
        header.key,
        String(header.label || ''),
      );
      next_row_template[header.key] = editableCellWithValue('', sourceTemplateCell);
    });

    return {
      ...sourceBlock,
      id: sourceBlock.id || `comparison_rows_${blockIdx + 1}`,
      subsection: normalizeComparisonSubsection(sourceBlock.subsection),
      rows: normalizedRows as unknown as TableTemplate['structure']['blocks'][number]['rows'],
      row_template: next_row_template as TableTemplate['structure']['blocks'][number]['row_template'],
      button_config: {
        show_add_row_button: sourceBlock?.button_config?.show_add_row_button ?? true,
        show_copy_button: sourceBlock?.button_config?.show_copy_button ?? true,
        show_delete_button: sourceBlock?.button_config?.show_delete_button ?? true,
      },
    };
  });

  return {
    ...template,
    structure: {
      ...template.structure,
      headers: nextHeaders,
      blocks: nextBlocks,
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
    context: {
      ...(template.context || {}),
      domestic_comparison_schools: safeDomesticSchools,
      foreign_comparison_schools: safeForeignSchools,
    },
  };
}

export interface IVariableFieldDropdownProps {
  varKey: string;
  table: string;
  field: string;
  varValues: Record<string, string>;
  onVarValuesChange: (updates: Record<string, string>) => void;
  varsInDoc: string[];
  onChangeVariable?: (varKey: string) => void;
  varType?: VariableInputType;
  onVarTypeChange: (varKey: string, newType: VariableInputType) => void;
  selectedTemplate?: TableTemplate;
  onSelectedTemplateChange: (varKey: string, template: TableTemplate | null) => void;
  onShowTemplateSelector: (varKey: string) => void;
  // Document template support
  selectedDocumentTemplate?: DocumentTemplate;
  documentTemplateValues?: Record<string, string>;
  onDocumentTemplateChange?: (varKey: string, template: DocumentTemplate | null) => void;
  onDocumentTemplateValuesChange?: (varKey: string, values: Record<string, string>) => void;
  onShowDocumentTemplateSelector?: (varKey: string) => void;
  readOnly?: boolean;
  simpleMode?: boolean;
  allowDocumentTemplateReorder?: boolean;
  title?: string;
  template_type?: string | null;
  onTitleChange?: (varKey: string, title: string) => void;
  definitionRefreshKey?: string;
}

export const VariableFieldDropdown = ({
  varKey,
  table,
  field,
  varValues,
  onVarValuesChange,
  varsInDoc,
  onChangeVariable,
  varType,
  onVarTypeChange,
  selectedTemplate,
  onSelectedTemplateChange,
  onShowTemplateSelector,
  selectedDocumentTemplate,
  documentTemplateValues,
  onDocumentTemplateChange,
  onDocumentTemplateValuesChange,
  onShowDocumentTemplateSelector,
  readOnly = false,
  simpleMode = false,
  allowDocumentTemplateReorder = false,
  title,
  template_type,
  definitionRefreshKey,
}: IVariableFieldDropdownProps) => {
  const { t } = useTranslation();
  const variableDefinition = useMemo(
    () => getTemplateVariableDefinitionByKey(varKey, template_type),
    [definitionRefreshKey, template_type, varKey],
  );
  const matchedDynamicDocumentTemplate = useMemo(
    () => getTemplateVariableDocumentTemplateByKey(varKey, template_type),
    [definitionRefreshKey, template_type, varKey],
  );
  const isDynamicDocumentVariable =
    variableDefinition?.variableType === 'DOCUMENT_VARIABLE' && Boolean(matchedDynamicDocumentTemplate);
  const effectiveVarType = isDynamicDocumentVariable
    ? 'Document template'
    : getDefaultVariableInputTypeForKey(varKey, varType, template_type);
  const tableDataSource = variableDefinition?.dataSource?.type === 'table' ? variableDefinition.dataSource : null;
  const queryTable = tableDataSource?.table ?? table;
  const queryField = tableDataSource?.valueField ?? field;
  const queryLabelField = tableDataSource?.labelField ?? undefined;
  const queryFilterField = tableDataSource?.filterField ?? undefined;
  const queryFilterValue = tableDataSource?.filterValue;
  const sharedRecordSelectorSourceKey = useMemo(
    () => getSharedRecordSelectorSourceKey(varKey, template_type),
    [definitionRefreshKey, template_type, varKey],
  );
  const sharedRecordSelectorOwnerKey = useMemo(() => {
    if (!sharedRecordSelectorSourceKey) return null;

    return (
      (varsInDoc || []).find(
        (candidate) => getSharedRecordSelectorSourceKey(candidate, template_type) === sharedRecordSelectorSourceKey,
      ) ?? null
    );
  }, [definitionRefreshKey, sharedRecordSelectorSourceKey, template_type, varsInDoc]);
  const isSharedRecordSelectorFollower = Boolean(
    sharedRecordSelectorSourceKey &&
    sharedRecordSelectorOwnerKey &&
    sharedRecordSelectorOwnerKey !== varKey &&
    isSelectVariableInputType(effectiveVarType),
  );
  const sharedRecordSelectorOwnerLabel = sharedRecordSelectorOwnerKey
    ? getSharedRecordSelectorOwnerLabel(sharedRecordSelectorOwnerKey, template_type)
    : '';
  const isHardcodedTableTemplateVar = table === TABLE_TEMPLATE_VARIABLE_NAMESPACE;
  const isHardcodedDocumentTemplateVar = table === DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE;
  const variableAlias = getVariableAlias(table, field, template_type);
  const [tableData, setTableData] = useState<Array<{ id: string; label: string; value: string }> | undefined>(
    undefined,
  );
  const [allTableData, setAllTableData] = useState<Array<Record<string, unknown>> | undefined>(undefined);
  const [schemaFields, setSchemaFields] = useState<string[] | undefined>(undefined);
  const [contextNumberDrafts, setContextNumberDrafts] = useState<Record<string, string>>({});
  const domesticSchoolsFieldId = useId();
  const foreignSchoolsFieldId = useId();

  const rawTableData = isTableMatrixVariableInputType(effectiveVarType) ? allTableData : null;
  const current = varValues[varKey] ?? '';
  const [
    semesterCoursesSignLocationKey,
    semesterCoursesSignDayKey,
    semesterCoursesSignMonthKey,
    semesterCoursesSignYearKey,
  ] = useMemo(() => getSemesterCoursesSignComponentVariableKeys(), []);
  const parsedSemesterCoursesSignValue = useMemo(() => parseSemesterCoursesSignCompositeText(current), [current]);
  // Show the stored component value verbatim while editing — trimming it here
  // would strip a trailing space on every render, making it impossible to type
  // a space (e.g. "Hồ Chí Minh"). Only fall back to the value parsed from the
  // composite text when the component key has never been set.
  const storedSemesterCoursesSignLocation = varValues[semesterCoursesSignLocationKey];
  const semesterCoursesSignLocationValue =
    storedSemesterCoursesSignLocation === undefined
      ? parsedSemesterCoursesSignValue.location
      : storedSemesterCoursesSignLocation;
  const semesterCoursesSignDayValue =
    varValues[semesterCoursesSignDayKey]?.trim() || parsedSemesterCoursesSignValue.day;
  const semesterCoursesSignMonthValue =
    varValues[semesterCoursesSignMonthKey]?.trim() || parsedSemesterCoursesSignValue.month;
  const semesterCoursesSignYearValue =
    varValues[semesterCoursesSignYearKey]?.trim() || parsedSemesterCoursesSignValue.year;
  const semesterCoursesSignDateValue = useMemo(
    () =>
      buildSemesterCoursesSignDateInputValue(
        semesterCoursesSignDayValue,
        semesterCoursesSignMonthValue,
        semesterCoursesSignYearValue,
      ),
    [semesterCoursesSignDayValue, semesterCoursesSignMonthValue, semesterCoursesSignYearValue],
  );
  const semesterCoursesSignPreviewValue = useMemo(
    () =>
      buildSemesterCoursesSignCompositeValue({
        [semesterCoursesSignLocationKey]: semesterCoursesSignLocationValue,
        [semesterCoursesSignDayKey]: semesterCoursesSignDayValue,
        [semesterCoursesSignMonthKey]: semesterCoursesSignMonthValue,
        [semesterCoursesSignYearKey]: semesterCoursesSignYearValue,
      }),
    [
      semesterCoursesSignDayValue,
      semesterCoursesSignLocationValue,
      semesterCoursesSignLocationKey,
      semesterCoursesSignDayKey,
      semesterCoursesSignMonthValue,
      semesterCoursesSignMonthKey,
      semesterCoursesSignYearValue,
      semesterCoursesSignYearKey,
    ],
  );
  const matchedHardcodedTemplate = useMemo(
    () => (isHardcodedTableTemplateVar ? getTableTemplateById(field) : undefined),
    [isHardcodedTableTemplateVar, field],
  );
  const matchedDynamicTableTemplate = useMemo(
    () => getTemplateVariableTableTemplateByKey(varKey, template_type),
    [definitionRefreshKey, template_type, varKey],
  );
  const isDynamicTableVariable =
    variableDefinition?.variableType === 'TABLE_VARIABLE' &&
    effectiveVarType === 'Table' &&
    Boolean(matchedDynamicTableTemplate);
  const isSkipQueries =
    isHardcodedTableTemplateVar ||
    isHardcodedDocumentTemplateVar ||
    isDynamicTableVariable ||
    isDynamicDocumentVariable;
  const matchedTableTemplate =
    matchedDynamicTableTemplate ?? (isHardcodedTableTemplateVar ? matchedHardcodedTemplate : undefined);
  const shouldRefreshTableTemplateFromDefinition = Boolean(
    matchedTableTemplate?.refresh_from_definition_on_load ||
    variableDefinition?.uiConfig?.refresh_from_definition_on_load,
  );
  const activeTableTemplate = useMemo(() => {
    if (!matchedTableTemplate) return selectedTemplate;
    if (!selectedTemplate) return matchedTableTemplate;
    return shouldRefreshTableTemplateFromDefinition || hasInvalidTableTemplateHeaderTree(selectedTemplate)
      ? mergeTableTemplateWithRuntimeValues(matchedTableTemplate, selectedTemplate)
      : mergeTableTemplateStylesFromDefinition(matchedTableTemplate, selectedTemplate);
  }, [matchedTableTemplate, selectedTemplate, shouldRefreshTableTemplateFromDefinition]);
  const tableContextSchema = useMemo(
    () => getTableContextSchema(activeTableTemplate) ?? getTableContextSchema(matchedTableTemplate),
    [activeTableTemplate, matchedTableTemplate],
  );
  const tableContextControls = useMemo(() => tableContextSchema?.controls ?? [], [tableContextSchema]);
  const tableContextRequiredKeys = useMemo(() => tableContextSchema?.required ?? [], [tableContextSchema]);
  const tableContextRenderRuleType = getTableContextRenderRuleType(tableContextSchema);
  const coursePloColumnCountKey = getTableContextRenderRuleString(tableContextSchema, 'count_key', 'plo_column_count');
  const coursePloParentKey = getTableContextRenderRuleString(tableContextSchema, 'plo_parent_key', 'plo_group');
  const coursePloPlaceholderKey = getTableContextRenderRuleString(
    tableContextSchema,
    'plo_placeholder_key',
    'plo_placeholder',
  );
  const groupedPloColumnCountKeys = useMemo(
    () => getGroupedPloColumnConfigs(tableContextSchema?.render_rule).map((config) => config.countKey),
    [tableContextSchema?.render_rule],
  );
  const repeatBlocksCountKey = getTableContextRenderRuleString(tableContextSchema, 'count_key', 'count');
  const syllabusCloCountKey = getTableContextRenderRuleString(tableContextSchema, 'row_count_key', 'clo_count');
  const syllabusPloCountKey = getTableContextRenderRuleString(tableContextSchema, 'column_count_key', 'plo_count');
  const comparisonDomesticSchoolsKey = getTableContextRenderRuleString(
    tableContextSchema,
    'domestic_key',
    'domestic_comparison_schools',
  );
  const comparisonForeignSchoolsKey = getTableContextRenderRuleString(
    tableContextSchema,
    'foreign_key',
    'foreign_comparison_schools',
  );
  const comparisonDomesticInputKey = getTableContextRenderRuleString(
    tableContextSchema,
    'domestic_input_key',
    'domestic_comparison_input',
  );
  const comparisonForeignInputKey = getTableContextRenderRuleString(
    tableContextSchema,
    'foreign_input_key',
    'foreign_comparison_input',
  );
  const comparisonMaxSchools = getRuleNumberValue(tableContextSchema?.render_rule, 'max_columns_per_group', 20);
  const isCoursePloContributionTemplate = tableContextRenderRuleType === 'dynamic_column_group';
  const isSyllabusCloPloMatrixTemplate = tableContextRenderRuleType === 'dynamic_matrix';
  const isConfiguredBlocksTemplate = tableContextRenderRuleType === 'configured_blocks';
  const isRepeatBlocksTemplate = tableContextRenderRuleType === 'repeat_blocks';
  const isObjectiveComparisonTemplate = tableContextRenderRuleType === 'comparison_columns';
  const matchedHardcodedDocumentTemplate = useMemo(
    () => (isHardcodedDocumentTemplateVar ? getDocumentTemplateById(field) : undefined),
    [isHardcodedDocumentTemplateVar, field],
  );
  const matchedDocumentTemplate = matchedDynamicDocumentTemplate ?? matchedHardcodedDocumentTemplate;
  const shouldRefreshDocumentTemplateFromDefinition = Boolean(
    matchedDocumentTemplate?.refresh_from_definition_on_load ||
    variableDefinition?.uiConfig?.refresh_from_definition_on_load,
  );
  const activeDocumentTemplate = useMemo(() => {
    if (!matchedDocumentTemplate) return selectedDocumentTemplate;
    if (!selectedDocumentTemplate) return matchedDocumentTemplate;
    return shouldRefreshDocumentTemplateFromDefinition
      ? mergeDocumentTemplateStylesFromDefinition(matchedDocumentTemplate, selectedDocumentTemplate)
      : selectedDocumentTemplate;
  }, [matchedDocumentTemplate, selectedDocumentTemplate, shouldRefreshDocumentTemplateFromDefinition]);

  useEffect(() => {
    if (!shouldRefreshDocumentTemplateFromDefinition) return;
    if (!selectedDocumentTemplate || !activeDocumentTemplate) return;
    if (activeDocumentTemplate === selectedDocumentTemplate) return;
    if (!onDocumentTemplateChange) return;

    onDocumentTemplateChange(varKey, activeDocumentTemplate);
    onVarValuesChange({
      [varKey]: generateDocumentHtml(activeDocumentTemplate, documentTemplateValues ?? EMPTY_DOCUMENT_TEMPLATE_VALUES),
    });
  }, [
    activeDocumentTemplate,
    documentTemplateValues,
    onDocumentTemplateChange,
    onVarValuesChange,
    selectedDocumentTemplate,
    shouldRefreshDocumentTemplateFromDefinition,
    varKey,
  ]);
  const tableContextRecordSelectControls = useMemo(
    () =>
      tableContextControls.filter(
        (control): control is TTableTemplateContextRecordSelectControl => control.type === 'record_select',
      ),
    [tableContextControls],
  );
  const tableContextRecordSelectTables = useMemo(
    () => Array.from(new Set(tableContextRecordSelectControls.map((control) => control.table).filter(Boolean))),
    [tableContextRecordSelectControls],
  );
  const tableContextRecordSelectTablesKey = tableContextRecordSelectTables.join('|');
  const getNumberContextDraftKey = useCallback((contextKey: string) => `${varKey}:${contextKey}`, [varKey]);
  const getNumberContextDraftValue = useCallback(
    (contextKey: string) => {
      const draftKey = getNumberContextDraftKey(contextKey);
      if (!Object.hasOwn(contextNumberDrafts, draftKey)) return null;
      return parsePositiveIntegerContextValue(contextNumberDrafts[draftKey]);
    },
    [contextNumberDrafts, getNumberContextDraftKey],
  );
  const getNumberContextDefaultValue = useCallback(
    (contextKey: string) => {
      const groupDefault = getGroupedPloColumnConfigs(tableContextSchema?.render_rule).find(
        (config) => config.countKey === contextKey,
      )?.defaultCount;
      const parsedGroupDefault = parsePositiveIntegerContextValue(groupDefault);
      if (parsedGroupDefault !== null) return parsedGroupDefault;

      const directNumberControl = tableContextControls.find(
        (control): control is TTableTemplateContextNumberControl =>
          control.type === 'number' && control.key === contextKey,
      );
      const pairNumberControl = tableContextControls
        .filter((control): control is TTableTemplateContextNumberPairControl => control.type === 'number_pair')
        .flatMap((control) => control.controls)
        .find((control) => control.key === contextKey);
      const controlDefault = parsePositiveIntegerContextValue(
        directNumberControl?.default_value ?? pairNumberControl?.default_value,
      );
      return controlDefault;
    },
    [tableContextControls, tableContextSchema?.render_rule],
  );
  const requiresSyllabusCloPloContext = isSyllabusCloPloMatrixTemplate;
  const requiresRepeatBlocksContext = isRepeatBlocksTemplate;
  const requiresObjectiveComparisonContext = isObjectiveComparisonTemplate;
  const [contextSelectRecordsByTable, setContextSelectRecordsByTable] = useState<
    Record<string, Array<Record<string, unknown>>>
  >({});

  useEffect(() => {
    if (isSkipQueries) {
      setTableData(undefined);
      setAllTableData(undefined);
      setSchemaFields(undefined);
      return;
    }

    let cancelled = false;

    void getTemplateTableRecordsAPI(queryTable)
      .then((records) => {
        if (!cancelled) {
          setAllTableData(records as Array<Record<string, unknown>>);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllTableData([]);
        }
      });

    void getTemplateTableSchemaFieldsAPI(queryTable)
      .then((fields) => {
        if (!cancelled) {
          setSchemaFields(fields);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSchemaFields([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSkipQueries, queryTable]);

  useEffect(() => {
    const recordSelectTables = tableContextRecordSelectTablesKey
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);

    if (recordSelectTables.length === 0) {
      setContextSelectRecordsByTable({});
      return;
    }

    let cancelled = false;

    void Promise.all(
      recordSelectTables.map(async (tableName) => {
        try {
          const records = await getTemplateTableRecordsAPI(tableName);
          return [tableName, records as Array<Record<string, unknown>>] as const;
        } catch {
          return [tableName, [] as Array<Record<string, unknown>>] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setContextSelectRecordsByTable(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [tableContextRecordSelectTablesKey]);

  const updateTemplateContext = useCallback(
    (contextPatch: Record<string, any>) => {
      const baseTemplate = selectedTemplate ?? matchedTableTemplate;
      if (!baseTemplate) return;
      const prevContext = baseTemplate.context || {};
      const nextContext = { ...prevContext, ...contextPatch };
      if (JSON.stringify(prevContext) === JSON.stringify(nextContext)) {
        return;
      }
      onSelectedTemplateChange(varKey, {
        ...baseTemplate,
        context: nextContext,
      });
    },
    [matchedTableTemplate, selectedTemplate, onSelectedTemplateChange, varKey],
  );

  const inferredPloColumnCount = useMemo(() => {
    if (!activeTableTemplate || !isCoursePloContributionTemplate) {
      return null as number | null;
    }
    const childHeaders = (activeTableTemplate.structure.headers || []).filter(
      (header) => !header.is_parent_header && header.parent === coursePloParentKey,
    );
    if (childHeaders.length === 0) return null;
    if (childHeaders.length === 1 && childHeaders[0].key === coursePloPlaceholderKey) {
      return null;
    }
    return childHeaders.length;
  }, [activeTableTemplate, isCoursePloContributionTemplate, coursePloParentKey, coursePloPlaceholderKey]);

  const selectedPloColumnCount = useMemo(() => {
    if (!isCoursePloContributionTemplate || !activeTableTemplate) {
      return null as number | null;
    }

    if (groupedPloColumnCountKeys.length > 0) {
      const counts = groupedPloColumnCountKeys.map((contextKey) => {
        const draftCount = getNumberContextDraftValue(contextKey);
        if (draftCount !== null) return draftCount;
        return (
          parsePositiveIntegerContextValue(activeTableTemplate.context?.[contextKey]) ??
          getNumberContextDefaultValue(contextKey)
        );
      });

      if (counts.some((count) => count === null)) return null;
      return counts.reduce<number>((total, count) => total + (count ?? 0), 0);
    }

    const draftCount = getNumberContextDraftValue(coursePloColumnCountKey);
    if (draftCount !== null) return draftCount;

    const rawCount = activeTableTemplate.context?.[coursePloColumnCountKey];
    const contextCount = parsePositiveIntegerContextValue(rawCount);
    if (contextCount !== null) return contextCount;

    const defaultCount = getNumberContextDefaultValue(coursePloColumnCountKey);
    if (defaultCount !== null) return defaultCount;

    return inferredPloColumnCount;
  }, [
    isCoursePloContributionTemplate,
    activeTableTemplate,
    getNumberContextDraftValue,
    getNumberContextDefaultValue,
    coursePloColumnCountKey,
    groupedPloColumnCountKeys,
    inferredPloColumnCount,
  ]);

  const selectedSyllabusCloCount = useMemo(() => {
    if (!requiresSyllabusCloPloContext || !activeTableTemplate) {
      return null as number | null;
    }
    const draftCount = getNumberContextDraftValue(syllabusCloCountKey);
    if (draftCount !== null) return draftCount;

    const rawCount = activeTableTemplate.context?.[syllabusCloCountKey];
    return parsePositiveIntegerContextValue(rawCount);
  }, [requiresSyllabusCloPloContext, activeTableTemplate, getNumberContextDraftValue, syllabusCloCountKey]);

  const selectedSyllabusPloCount = useMemo(() => {
    if (!requiresSyllabusCloPloContext || !activeTableTemplate) {
      return null as number | null;
    }
    const draftCount = getNumberContextDraftValue(syllabusPloCountKey);
    if (draftCount !== null) return draftCount;

    const rawCount = activeTableTemplate.context?.[syllabusPloCountKey];
    return parsePositiveIntegerContextValue(rawCount);
  }, [requiresSyllabusCloPloContext, activeTableTemplate, getNumberContextDraftValue, syllabusPloCountKey]);

  const selectedRepeatBlocksCount = useMemo(() => {
    if (!requiresRepeatBlocksContext || !activeTableTemplate) {
      return null as number | null;
    }
    const draftCount = getNumberContextDraftValue(repeatBlocksCountKey);
    if (draftCount !== null) return draftCount;

    const rawCount = activeTableTemplate.context?.[repeatBlocksCountKey];
    return parsePositiveIntegerContextValue(rawCount);
  }, [requiresRepeatBlocksContext, activeTableTemplate, getNumberContextDraftValue, repeatBlocksCountKey]);

  const objectiveComparisonContextValues = useMemo(() => {
    if (!requiresObjectiveComparisonContext || !activeTableTemplate) {
      return {
        domesticSchools: [] as string[],
        foreignSchools: [] as string[],
        domesticInputValue: '',
        foreignInputValue: '',
      };
    }

    const context = activeTableTemplate.context || {};
    const hasDomesticInput = Object.hasOwn(context, comparisonDomesticInputKey);
    const hasForeignInput = Object.hasOwn(context, comparisonForeignInputKey);

    const domesticFromContext = parseObjectiveComparisonSchoolList(
      context[comparisonDomesticSchoolsKey],
      comparisonMaxSchools,
    );
    const foreignFromContext = parseObjectiveComparisonSchoolList(
      context[comparisonForeignSchoolsKey],
      comparisonMaxSchools,
    );
    const domesticFromInput = parseObjectiveComparisonSchoolList(
      context[comparisonDomesticInputKey],
      comparisonMaxSchools,
    );
    const foreignFromInput = parseObjectiveComparisonSchoolList(
      context[comparisonForeignInputKey],
      comparisonMaxSchools,
    );

    const domesticSchools = hasDomesticInput
      ? domesticFromInput
      : domesticFromContext.length > 0
        ? domesticFromContext
        : [];
    const foreignSchools = hasForeignInput ? foreignFromInput : foreignFromContext.length > 0 ? foreignFromContext : [];

    const domesticInputValue = hasDomesticInput
      ? cellStringValue(context[comparisonDomesticInputKey])
      : domesticFromContext.join(', ');
    const foreignInputValue = hasForeignInput
      ? cellStringValue(context[comparisonForeignInputKey])
      : foreignFromContext.join(', ');

    return {
      domesticSchools,
      foreignSchools,
      domesticInputValue,
      foreignInputValue,
    };
  }, [
    requiresObjectiveComparisonContext,
    activeTableTemplate,
    comparisonDomesticInputKey,
    comparisonDomesticSchoolsKey,
    comparisonForeignInputKey,
    comparisonForeignSchoolsKey,
    comparisonMaxSchools,
  ]);

  const selectedObjectiveComparisonDomesticSchools = objectiveComparisonContextValues.domesticSchools;
  const selectedObjectiveComparisonForeignSchools = objectiveComparisonContextValues.foreignSchools;
  const hasObjectiveComparisonContext =
    selectedObjectiveComparisonDomesticSchools.length > 0 && selectedObjectiveComparisonForeignSchools.length > 0;

  const normalizedCoursePloTemplate = useMemo(() => {
    if (!isCoursePloContributionTemplate) return null;
    if (!activeTableTemplate) return null;
    if (!selectedPloColumnCount) return null;

    return normalizePloHeadersFromTemplate(
      {
        ...activeTableTemplate,
        context: {
          ...(activeTableTemplate.context || {}),
          ...(groupedPloColumnCountKeys.length > 0 ? {} : { [coursePloColumnCountKey]: selectedPloColumnCount }),
        },
      },
      selectedPloColumnCount,
      tableContextSchema?.render_rule,
    );
  }, [
    isCoursePloContributionTemplate,
    activeTableTemplate,
    selectedPloColumnCount,
    coursePloColumnCountKey,
    groupedPloColumnCountKeys.length,
    tableContextSchema?.render_rule,
  ]);

  const normalizedSyllabusCloPloMatrixTemplate = useMemo(() => {
    if (!requiresSyllabusCloPloContext) return null;
    if (!activeTableTemplate) return null;
    if (!selectedSyllabusCloCount || !selectedSyllabusPloCount) return null;

    return normalizeSyllabusCloPloMatrixTemplate(
      {
        ...activeTableTemplate,
        context: {
          ...(activeTableTemplate.context || {}),
          [syllabusCloCountKey]: selectedSyllabusCloCount,
          [syllabusPloCountKey]: selectedSyllabusPloCount,
        },
      },
      selectedSyllabusCloCount,
      selectedSyllabusPloCount,
      tableContextSchema?.render_rule,
    );
  }, [
    requiresSyllabusCloPloContext,
    activeTableTemplate,
    selectedSyllabusCloCount,
    selectedSyllabusPloCount,
    syllabusCloCountKey,
    syllabusPloCountKey,
    tableContextSchema?.render_rule,
  ]);

  const normalizedRepeatBlocksTemplate = useMemo(() => {
    if (!requiresRepeatBlocksContext) return null;
    if (!activeTableTemplate) return null;
    if (!selectedRepeatBlocksCount) return null;

    return normalizeRepeatBlocksTemplate(
      {
        ...activeTableTemplate,
        context: {
          ...(activeTableTemplate.context || {}),
          [repeatBlocksCountKey]: selectedRepeatBlocksCount,
        },
      },
      tableContextSchema?.render_rule,
      selectedRepeatBlocksCount,
    );
  }, [
    requiresRepeatBlocksContext,
    activeTableTemplate,
    selectedRepeatBlocksCount,
    repeatBlocksCountKey,
    tableContextSchema?.render_rule,
  ]);

  const normalizedConfiguredBlocksTemplate = useMemo(() => {
    if (!isConfiguredBlocksTemplate) return null;
    if (!activeTableTemplate) return null;
    return normalizeConfiguredBlocksTemplate(activeTableTemplate, tableContextSchema?.render_rule);
  }, [isConfiguredBlocksTemplate, activeTableTemplate, tableContextSchema?.render_rule]);

  const normalizedObjectiveComparisonTemplate = useMemo(() => {
    if (!requiresObjectiveComparisonContext) return null;
    if (!activeTableTemplate) return null;
    if (!hasObjectiveComparisonContext) return null;
    return normalizeObjectiveComparisonTemplate(
      activeTableTemplate,
      selectedObjectiveComparisonDomesticSchools,
      selectedObjectiveComparisonForeignSchools,
      tableContextSchema?.render_rule,
    );
  }, [
    requiresObjectiveComparisonContext,
    activeTableTemplate,
    hasObjectiveComparisonContext,
    selectedObjectiveComparisonDomesticSchools,
    selectedObjectiveComparisonForeignSchools,
    tableContextSchema?.render_rule,
  ]);

  useEffect(() => {
    const currentTemplate = selectedTemplate ?? activeTableTemplate;
    if (!normalizedCoursePloTemplate || !currentTemplate) return;

    const currentSignature = JSON.stringify({
      headers: currentTemplate.structure.headers,
      blocks: currentTemplate.structure.blocks,
    });
    const nextSignature = JSON.stringify({
      headers: normalizedCoursePloTemplate.structure.headers,
      blocks: normalizedCoursePloTemplate.structure.blocks,
    });

    if (currentSignature !== nextSignature) {
      onSelectedTemplateChange(varKey, normalizedCoursePloTemplate);
      return;
    }

    const nextHtml = generateTableHtmlFromTableTemplate(normalizedCoursePloTemplate, varValues);
    if (varValues[varKey] !== nextHtml) {
      onVarValuesChange({ [varKey]: nextHtml });
    }
  }, [
    normalizedCoursePloTemplate,
    selectedTemplate,
    activeTableTemplate,
    onSelectedTemplateChange,
    varKey,
    varValues,
    onVarValuesChange,
  ]);

  useEffect(() => {
    const currentTemplate = selectedTemplate ?? activeTableTemplate;
    if (!normalizedSyllabusCloPloMatrixTemplate || !currentTemplate) return;

    const currentSignature = JSON.stringify({
      headers: currentTemplate.structure.headers,
      blocks: currentTemplate.structure.blocks,
    });
    const nextSignature = JSON.stringify({
      headers: normalizedSyllabusCloPloMatrixTemplate.structure.headers,
      blocks: normalizedSyllabusCloPloMatrixTemplate.structure.blocks,
    });

    if (currentSignature !== nextSignature) {
      onSelectedTemplateChange(varKey, normalizedSyllabusCloPloMatrixTemplate);
      return;
    }

    const nextHtml = generateTableHtmlFromTableTemplate(normalizedSyllabusCloPloMatrixTemplate, varValues);
    if (varValues[varKey] !== nextHtml) {
      onVarValuesChange({ [varKey]: nextHtml });
    }
  }, [
    normalizedSyllabusCloPloMatrixTemplate,
    selectedTemplate,
    activeTableTemplate,
    onSelectedTemplateChange,
    varKey,
    varValues,
    onVarValuesChange,
  ]);

  useEffect(() => {
    const currentTemplate = selectedTemplate ?? activeTableTemplate;
    if (!normalizedRepeatBlocksTemplate || !currentTemplate) return;

    const currentSignature = JSON.stringify({
      headers: currentTemplate.structure.headers,
      blocks: currentTemplate.structure.blocks,
    });
    const nextSignature = JSON.stringify({
      headers: normalizedRepeatBlocksTemplate.structure.headers,
      blocks: normalizedRepeatBlocksTemplate.structure.blocks,
    });

    if (currentSignature !== nextSignature) {
      onSelectedTemplateChange(varKey, normalizedRepeatBlocksTemplate);
      return;
    }

    const nextHtml = generateTableHtmlFromTableTemplate(normalizedRepeatBlocksTemplate, varValues);
    if (varValues[varKey] !== nextHtml) {
      onVarValuesChange({ [varKey]: nextHtml });
    }
  }, [
    normalizedRepeatBlocksTemplate,
    selectedTemplate,
    activeTableTemplate,
    onSelectedTemplateChange,
    varKey,
    varValues,
    onVarValuesChange,
  ]);

  useEffect(() => {
    const currentTemplate = selectedTemplate ?? activeTableTemplate;
    if (!normalizedConfiguredBlocksTemplate || !currentTemplate) {
      return;
    }

    const currentSignature = JSON.stringify({
      headers: currentTemplate.structure.headers,
      blocks: currentTemplate.structure.blocks,
    });
    const nextSignature = JSON.stringify({
      headers: normalizedConfiguredBlocksTemplate.structure.headers,
      blocks: normalizedConfiguredBlocksTemplate.structure.blocks,
    });

    if (currentSignature !== nextSignature) {
      onSelectedTemplateChange(varKey, normalizedConfiguredBlocksTemplate);
      return;
    }

    const nextHtml = generateTableHtmlFromTableTemplate(normalizedConfiguredBlocksTemplate, varValues);
    if (varValues[varKey] !== nextHtml) {
      onVarValuesChange({ [varKey]: nextHtml });
    }
  }, [
    normalizedConfiguredBlocksTemplate,
    selectedTemplate,
    activeTableTemplate,
    onSelectedTemplateChange,
    varKey,
    varValues,
    onVarValuesChange,
  ]);

  useEffect(() => {
    const currentTemplate = selectedTemplate ?? activeTableTemplate;
    if (!normalizedObjectiveComparisonTemplate || !currentTemplate) return;

    const currentSignature = JSON.stringify({
      headers: currentTemplate.structure.headers,
      blocks: currentTemplate.structure.blocks,
    });
    const nextSignature = JSON.stringify({
      headers: normalizedObjectiveComparisonTemplate.structure.headers,
      blocks: normalizedObjectiveComparisonTemplate.structure.blocks,
    });

    if (currentSignature !== nextSignature) {
      onSelectedTemplateChange(varKey, normalizedObjectiveComparisonTemplate);
      return;
    }

    const nextHtml = generateTableHtmlFromTableTemplate(normalizedObjectiveComparisonTemplate, varValues);
    if (varValues[varKey] !== nextHtml) {
      onVarValuesChange({ [varKey]: nextHtml });
    }
  }, [
    normalizedObjectiveComparisonTemplate,
    selectedTemplate,
    activeTableTemplate,
    onSelectedTemplateChange,
    varKey,
    varValues,
    onVarValuesChange,
  ]);

  const handleSelectValue = async (selectedValue: string) => {
    const sameTableVarKeys = Array.from(
      new Set(
        (varsInDoc || []).filter((varName) => {
          const parsed = parseVariableName(varName);
          return parsed?.table === table;
        }),
      ),
    );
    const extraAutoFillKeys = [queryLabelField ? `${queryTable}.${queryLabelField}` : '', `${queryTable}.${queryField}`]
      .filter(Boolean)
      .filter((key) => parseVariableName(key)?.table === table);
    const relatedVarKeys = Array.from(new Set([...sameTableVarKeys, ...extraAutoFillKeys])).filter(
      (item) => item !== varKey,
    );

    if (!selectedValue) {
      const clearUpdates: Record<string, string> = { [varKey]: '' };
      relatedVarKeys.forEach((relatedVarKey) => {
        clearUpdates[relatedVarKey] = '';
      });
      onVarValuesChange(clearUpdates);
      return;
    }

    const pendingUpdates: Record<string, string> = { [varKey]: selectedValue };
    relatedVarKeys.forEach((relatedVarKey) => {
      pendingUpdates[relatedVarKey] = '';
    });
    onVarValuesChange(pendingUpdates);

    if (isHardcodedTableTemplateVar) return;

    try {
      // For FK fields, the selectedValue is the display name but we
      // need the raw FK ID for the database lookup.
      const fkKey = `${table}.${field}`;
      const foreignKeyMeta = getForeignKeyMeta();
      const fkMeta = foreignKeyMeta[`${queryTable}.${queryField}`] ?? foreignKeyMeta[fkKey];
      let lookupValue = selectedValue;
      let selectedRecord = allTableData?.find(
        (record) =>
          recordMatchesFieldValue(record, queryField, selectedValue) ||
          recordMatchesFieldValue(record, field, selectedValue) ||
          recordMatchesFieldValue(record, '_id', selectedValue),
      );

      if (fkMeta) {
        const matchedTableItem = tableData?.find((item) => item.value === selectedValue);
        const matchedFetchedItem = matchedTableItem
          ? null
          : (
              await fetchDropdownApiOptions({
                table: queryTable,
                field: queryField,
                labelField: queryLabelField,
                filterField: queryFilterField,
                filterValue: queryFilterValue,
                search: selectedValue,
                page: 1,
                page_size: 20,
              })
            ).find((item) => item.value === selectedValue);
        const matchedItem = matchedTableItem ?? matchedFetchedItem;

        if (matchedItem) {
          lookupValue = matchedItem.id;
          if (matchedFetchedItem?.record) {
            selectedRecord = matchedFetchedItem.record;
          }
        }
      } else if (!selectedRecord) {
        selectedRecord = (
          await fetchDropdownApiOptions({
            table: queryTable,
            field: queryField,
            labelField: queryLabelField,
            filterField: queryFilterField,
            filterValue: queryFilterValue,
            search: selectedValue,
            page: 1,
            page_size: 20,
          })
        ).find((item) => item.value === selectedValue)?.record;
      }

      const record =
        selectedRecord ??
        (await getTemplateRecordByFieldValueAPI({
          table: queryTable,
          field_name: queryField,
          field_value: lookupValue,
        }));

      if (record) {
        const updates = { [varKey]: selectedValue } as Record<string, string>;
        const rec = record as unknown as Record<string, unknown>;

        // 1. Auto-fill same-table vars (resolve FK fields to display names)
        const relatedVars = Array.from(new Set([...sameTableVarKeys, ...extraAutoFillKeys])).filter((varName) => {
          const parsed = parseVariableName(varName);
          return parsed?.table === table;
        });

        for (const relatedVar of relatedVars) {
          const parsed = parseVariableName(relatedVar);
          if (parsed && rec[parsed.field] !== undefined && rec[parsed.field] !== null) {
            const relFkMeta =
              foreignKeyMeta[`${queryTable}.${parsed.field}`] ?? foreignKeyMeta[`${table}.${parsed.field}`];
            if (relFkMeta) {
              // This related field is also a FK — resolve to display name
              const refId = rec[parsed.field];
              const refRecord = await getTemplateRecordByFieldValueAPI({
                table: relFkMeta.table,
                field_name: '_id',
                field_value: String(refId),
              });
              if (refRecord) {
                const refRec = refRecord as unknown as Record<string, unknown>;
                updates[relatedVar] = String(refRec[relFkMeta.display_field] ?? refId);
              } else {
                updates[relatedVar] = String(refId);
              }
            } else {
              updates[relatedVar] = String(rec[parsed.field]);
            }
          }
        }

        // 2. Cross-table auto-fill via FK resolution
        const fkFieldsInRecord = Object.keys(rec).filter((f) => foreignKeyMeta[`${queryTable}.${f}`]);

        for (const fkField of fkFieldsInRecord) {
          const fkValue = rec[fkField];
          if (!fkValue) continue;

          const meta = foreignKeyMeta[`${queryTable}.${fkField}`];
          const refTable = meta.table;

          const crossVars = (varsInDoc || []).filter((varName) => {
            const parsed = parseVariableName(varName);
            return parsed?.table === refTable;
          });
          if (crossVars.length === 0) continue;

          const refRecord = await getTemplateRecordByFieldValueAPI({
            table: refTable,
            field_name: '_id',
            field_value: String(fkValue),
          });

          if (refRecord) {
            const refRec = refRecord as unknown as Record<string, unknown>;
            for (const crossVar of crossVars) {
              const parsed = parseVariableName(crossVar);
              if (parsed && refRec[parsed.field] !== undefined && refRec[parsed.field] !== null) {
                updates[crossVar] = String(refRec[parsed.field]);
              }
            }
          }
        }
        onVarValuesChange(updates);
      }
    } catch (error) {
      console.error('❌ Error auto-filling variables:', error);
    }
  };

  useEffect(() => {
    const isConfiguredTableTemplate =
      (isHardcodedTableTemplateVar && effectiveVarType === 'Table template') || isDynamicTableVariable;
    if (!isConfiguredTableTemplate) return;
    if (!matchedTableTemplate) return;
    if (selectedTemplate && !shouldRefreshTableTemplateFromDefinition) return;

    const nextTemplate = selectedTemplate
      ? mergeTableTemplateWithRuntimeValues(matchedTableTemplate, selectedTemplate)
      : matchedTableTemplate;
    if (
      selectedTemplate &&
      shouldRefreshTableTemplateFromDefinition &&
      JSON.stringify(selectedTemplate) === JSON.stringify(nextTemplate)
    ) {
      return;
    }

    const clonedTemplate = JSON.parse(JSON.stringify(nextTemplate)) as TableTemplate;
    onSelectedTemplateChange(varKey, clonedTemplate);

    if (shouldRefreshTableTemplateFromDefinition || !varValues[varKey]) {
      onVarValuesChange({
        [varKey]: generateTableHtmlFromTableTemplate(clonedTemplate, varValues),
      });
    }
  }, [
    isHardcodedTableTemplateVar,
    isDynamicTableVariable,
    effectiveVarType,
    matchedTableTemplate,
    selectedTemplate,
    shouldRefreshTableTemplateFromDefinition,
    onSelectedTemplateChange,
    varKey,
    varValues,
    onVarValuesChange,
  ]);

  // Auto-init hardcoded document template vars
  useEffect(() => {
    if (!isHardcodedDocumentTemplateVar && !isDynamicDocumentVariable) return;
    if (effectiveVarType !== 'Document template') return;
    if (!matchedDocumentTemplate) return;
    if (selectedDocumentTemplate) return;
    if (!onDocumentTemplateChange) return;

    const cloned = JSON.parse(JSON.stringify(matchedDocumentTemplate)) as DocumentTemplate;
    onDocumentTemplateChange(varKey, cloned);

    if (shouldRefreshDocumentTemplateFromDefinition) {
      onVarValuesChange({
        [varKey]: generateDocumentHtml(cloned, documentTemplateValues ?? EMPTY_DOCUMENT_TEMPLATE_VALUES),
      });
    }
  }, [
    isHardcodedDocumentTemplateVar,
    isDynamicDocumentVariable,
    effectiveVarType,
    matchedDocumentTemplate,
    selectedDocumentTemplate,
    shouldRefreshDocumentTemplateFromDefinition,
    onDocumentTemplateChange,
    varKey,
    onVarValuesChange,
    documentTemplateValues,
  ]);

  useEffect(() => {
    if (isHardcodedTableTemplateVar) return;
    if (isTableMatrixVariableInputType(effectiveVarType) && rawTableData?.length && schemaFields?.length) {
      const blacklistedFields = MENTION_BLACKLIST[queryTable] || [];
      const allFields = schemaFields.filter((f) => !f.startsWith('_') && !blacklistedFields.includes(f));

      const headerRow = allFields
        .map(
          (fname) =>
            `<th style="padding: 8px; border: 1px solid #ddd; text-align: left; font-weight: 600;">${fname}</th>`,
        )
        .join('');
      const bodyRows = rawTableData
        .map((item, idx) => {
          const cells = allFields
            .map((fname) => `<td style="padding: 8px; border: 1px solid #ddd;">${(item as any)[fname] ?? ''}</td>`)
            .join('');
          return `<tr style="background-color: ${idx % 2 === 0 ? '#fff' : '#fafafa'};">${cells}</tr>`;
        })
        .join('');

      const tableHtml = `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #ddd; ${GENERATED_TABLE_FONT_STYLE}"><thead><tr style="background-color: #f5f5f5;">${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;

      if (varValues[varKey] !== tableHtml) {
        if (!varValues[varKey]?.trim().startsWith('<table')) {
          onVarValuesChange({ [varKey]: tableHtml });
        }
      }
    }
  }, [
    effectiveVarType,
    rawTableData,
    schemaFields,
    varKey,
    queryTable,
    isHardcodedTableTemplateVar,
    onVarValuesChange,
    varValues,
  ]);

  const colCount = schemaFields
    ? schemaFields.filter((k) => !k.startsWith('_') && !(MENTION_BLACKLIST[queryTable] || []).includes(k)).length
    : 0;
  const tableTemplateForEditor =
    normalizedCoursePloTemplate ??
    normalizedSyllabusCloPloMatrixTemplate ??
    normalizedRepeatBlocksTemplate ??
    normalizedConfiguredBlocksTemplate ??
    normalizedObjectiveComparisonTemplate ??
    activeTableTemplate;
  const handleTableTemplateEditorChange = useCallback(
    (template: TableTemplate) => {
      if (requiresSyllabusCloPloContext) {
        onSelectedTemplateChange(
          varKey,
          syncSyllabusCloPloMatrixContextFromTemplate(template, tableContextSchema, {
            cloCountKey: syllabusCloCountKey,
            ploCountKey: syllabusPloCountKey,
          }),
        );
        return;
      }

      onSelectedTemplateChange(varKey, {
        ...template,
        context: template.context || tableTemplateForEditor?.context,
      });
    },
    [
      onSelectedTemplateChange,
      requiresSyllabusCloPloContext,
      syllabusCloCountKey,
      syllabusPloCountKey,
      tableContextSchema,
      tableTemplateForEditor?.context,
      varKey,
    ],
  );
  const hasGeneratedTableTemplate = Boolean(
    normalizedCoursePloTemplate ||
    normalizedSyllabusCloPloMatrixTemplate ||
    normalizedRepeatBlocksTemplate ||
    normalizedConfiguredBlocksTemplate ||
    normalizedObjectiveComparisonTemplate,
  );
  const isContextKeyConfigured = useCallback(
    (contextKey: string) => {
      if (groupedPloColumnCountKeys.includes(contextKey)) {
        const draftCount = getNumberContextDraftValue(contextKey);
        if (draftCount !== null) return true;
        return (
          parsePositiveIntegerContextValue(activeTableTemplate?.context?.[contextKey]) !== null ||
          getNumberContextDefaultValue(contextKey) !== null
        );
      }
      if (contextKey === coursePloColumnCountKey) return Boolean(selectedPloColumnCount);
      if (contextKey === syllabusCloCountKey) return Boolean(selectedSyllabusCloCount);
      if (contextKey === syllabusPloCountKey) return Boolean(selectedSyllabusPloCount);
      if (contextKey === repeatBlocksCountKey) return Boolean(selectedRepeatBlocksCount);
      if (contextKey === comparisonDomesticSchoolsKey) return selectedObjectiveComparisonDomesticSchools.length > 0;
      if (contextKey === comparisonForeignSchoolsKey) return selectedObjectiveComparisonForeignSchools.length > 0;

      const rawValue = activeTableTemplate?.context?.[contextKey];
      if (Array.isArray(rawValue)) return rawValue.length > 0;
      return cellStringValue(rawValue).trim().length > 0;
    },
    [
      comparisonDomesticSchoolsKey,
      comparisonForeignSchoolsKey,
      coursePloColumnCountKey,
      getNumberContextDraftValue,
      getNumberContextDefaultValue,
      groupedPloColumnCountKeys,
      repeatBlocksCountKey,
      selectedObjectiveComparisonDomesticSchools.length,
      selectedObjectiveComparisonForeignSchools.length,
      selectedPloColumnCount,
      selectedRepeatBlocksCount,
      selectedSyllabusCloCount,
      selectedSyllabusPloCount,
      activeTableTemplate?.context,
      syllabusCloCountKey,
      syllabusPloCountKey,
    ],
  );
  const missingRequiredContextKey = tableContextRequiredKeys.find((contextKey) => !isContextKeyConfigured(contextKey));
  const canConfigureTableTemplate = !missingRequiredContextKey || hasGeneratedTableTemplate;
  const tableTemplateConfigWarning = missingRequiredContextKey
    ? getWarningTextForContextKey(tableContextControls, missingRequiredContextKey, t)
    : '';
  const effectiveVariableLabel = title?.trim() || variableAlias;
  const rawImageSrcValue = isImageVariableInputType(effectiveVarType) ? extractImageSrcValue(current) : '';
  const imageSrcValue = rawImageSrcValue && isSafeImageSrc(rawImageSrcValue) ? rawImageSrcValue : '';

  const handleImageSourceChange = (nextSrc: string) => {
    onVarValuesChange({ [varKey]: buildImageHtmlValue(nextSrc) });
  };

  const handleImageFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        handleImageSourceChange(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleImageFile(event.dataTransfer.files?.[0]);
  };

  const handleSemesterCoursesSignLocationChange = (nextLocation: string) => {
    const nextCompositeValue = buildSemesterCoursesSignCompositeValue({
      [semesterCoursesSignLocationKey]: nextLocation,
      [semesterCoursesSignDayKey]: semesterCoursesSignDayValue,
      [semesterCoursesSignMonthKey]: semesterCoursesSignMonthValue,
      [semesterCoursesSignYearKey]: semesterCoursesSignYearValue,
    });

    onVarValuesChange({
      [semesterCoursesSignLocationKey]: nextLocation,
      [SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY]: nextCompositeValue,
    });
  };

  const handleSemesterCoursesSignDateChange = (nextDate: string) => {
    if (!nextDate) {
      const nextCompositeValue = buildSemesterCoursesSignCompositeValue({
        [semesterCoursesSignLocationKey]: semesterCoursesSignLocationValue,
      });

      onVarValuesChange({
        [semesterCoursesSignDayKey]: '',
        [semesterCoursesSignMonthKey]: '',
        [semesterCoursesSignYearKey]: '',
        [SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY]: nextCompositeValue,
      });
      return;
    }

    const [year, month, day] = nextDate.split('-');
    if (!year || !month || !day) {
      return;
    }

    const nextDayValue = String(Number(day));
    const nextMonthValue = String(Number(month));
    const nextCompositeValue = buildSemesterCoursesSignCompositeValue({
      [semesterCoursesSignLocationKey]: semesterCoursesSignLocationValue,
      [semesterCoursesSignDayKey]: nextDayValue,
      [semesterCoursesSignMonthKey]: nextMonthValue,
      [semesterCoursesSignYearKey]: year,
    });

    onVarValuesChange({
      [semesterCoursesSignDayKey]: nextDayValue,
      [semesterCoursesSignMonthKey]: nextMonthValue,
      [semesterCoursesSignYearKey]: year,
      [SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY]: nextCompositeValue,
    });
  };

  const resolveContextText = (directText: string | undefined, key: string | undefined, fallback: string) =>
    directText || (key ? t(key) : fallback);
  const resolveContextValueText = (directText: string | undefined, key: string | undefined, value: string) =>
    directText ? directText.replace(/\{value\}/g, value) : t(key || 'variables.field.selected', { value });

  const getRecordSelectOptions = (control: TTableTemplateContextRecordSelectControl) => {
    const records = contextSelectRecordsByTable[control.table] || [];
    const valueField = control.value_field || '_id';
    const labelField = control.label_field;

    return records
      .map((record) => {
        const rawValue = record[valueField] ?? record._id ?? record.id;
        if (rawValue === undefined || rawValue === null) return null;
        const rawLabel = labelField ? (record[labelField] ?? rawValue) : rawValue;

        return {
          id: String(rawValue),
          name: String(rawLabel ?? rawValue),
        };
      })
      .filter((option): option is { id: string; name: string } => Boolean(option))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const getNumberContextValue = (contextKey: string) => {
    if (groupedPloColumnCountKeys.includes(contextKey)) {
      return (
        parsePositiveIntegerContextValue(activeTableTemplate?.context?.[contextKey]) ??
        getNumberContextDefaultValue(contextKey)
      );
    }
    if (contextKey === coursePloColumnCountKey) return selectedPloColumnCount;
    if (contextKey === syllabusCloCountKey) return selectedSyllabusCloCount;
    if (contextKey === syllabusPloCountKey) return selectedSyllabusPloCount;
    if (contextKey === repeatBlocksCountKey) return selectedRepeatBlocksCount;

    const rawValue = activeTableTemplate?.context?.[contextKey];
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return Math.max(1, Math.floor(rawValue));
    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed)) return Math.max(1, Math.floor(parsed));
    }
    return getNumberContextDefaultValue(contextKey);
  };

  const handleNumberContextChange = (control: TTableTemplateContextNumberControl, rawValue: string) => {
    if (!rawValue) {
      updateTemplateContext({ [control.key]: null });
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const min = control.min ?? 1;
    const max = control.max ?? Number.POSITIVE_INFINITY;
    updateTemplateContext({
      [control.key]: Math.max(min, Math.min(max, Math.floor(parsed))),
    });
  };

  const getNumberContextInputValue = (control: TTableTemplateContextNumberControl) => {
    const draftKey = getNumberContextDraftKey(control.key);
    if (Object.hasOwn(contextNumberDrafts, draftKey)) return contextNumberDrafts[draftKey];
    const contextValue = getNumberContextValue(control.key);
    return contextValue === null ? '' : String(contextValue);
  };

  const handleNumberContextInputChange = (control: TTableTemplateContextNumberControl, rawValue: string) => {
    const draftKey = getNumberContextDraftKey(control.key);
    setContextNumberDrafts((current) => ({ ...current, [draftKey]: rawValue }));
    handleNumberContextChange(control, rawValue);
  };

  const renderNumberContextInput = (control: TTableTemplateContextNumberControl) => (
    <Input
      type="number"
      min={control.min ?? 1}
      max={control.max}
      value={getNumberContextInputValue(control)}
      onChange={(event) => handleNumberContextInputChange(control, event.target.value)}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      placeholder={resolveContextText(control.placeholder, control.placeholder_key, '') || undefined}
      className="h-10 rounded-lg bg-white text-sm"
    />
  );

  const renderTableContextControl = (control: TTableTemplateContextControl, index: number) => {
    if (control.type === 'record_select') {
      const options = getRecordSelectOptions(control);
      const selectedValue = cellStringValue(activeTableTemplate?.context?.[control.key]);
      const labelKey = control.context_label_key || `${control.key}Label`;
      const selectedLabel = cellStringValue(activeTableTemplate?.context?.[labelKey]);

      return (
        <ConfigPanel
          key={`${control.type}-${control.key}`}
          tone={control.tone || 'amber'}
          title={resolveContextText(control.label, control.label_key, control.key)}
          description={resolveContextText(control.description, control.description_key, '') || undefined}
          footer={resolveContextText(control.footer, control.footer_key, '') || undefined}>
          <Select
            value={selectedValue || undefined}
            onValueChange={(nextValue) => {
              const selectedOption = options.find((option) => option.id === nextValue);
              const contextPatch: Record<string, unknown> = {
                [control.key]: nextValue || null,
                [labelKey]: selectedOption?.name || null,
              };

              if (control.source_key) {
                contextPatch[control.source_key] = control.source_value ?? 'manual';
              }

              updateTemplateContext(contextPatch);
            }}>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={resolveContextText(control.placeholder, control.placeholder_key, control.key)}
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {options.length === 0 && (control.empty_text || control.empty_key) && (
            <div className="text-xs leading-5 text-amber-800">
              {resolveContextText(control.empty_text, control.empty_key, '')}
            </div>
          )}
          {selectedLabel && (
            <div className="text-xs leading-5 text-emerald-700">
              {resolveContextValueText(control.selected_text, control.selected_key, selectedLabel)}
            </div>
          )}
          {selectedValue && (
            <div className="text-xs leading-5 text-emerald-700">
              {resolveContextValueText(
                control.linked_id_text,
                control.linked_id_key || 'variables.field.linkedId',
                selectedValue,
              )}
            </div>
          )}
        </ConfigPanel>
      );
    }

    if (control.type === 'number') {
      return (
        <ConfigPanel
          key={`${control.type}-${control.key}`}
          tone={control.tone || 'indigo'}
          title={resolveContextText(control.label, control.label_key, control.key)}
          description={resolveContextText(control.description, control.description_key, '') || undefined}
          footer={resolveContextText(control.footer, control.footer_key, '') || undefined}>
          {renderNumberContextInput(control)}
        </ConfigPanel>
      );
    }

    if (control.type === 'number_pair') {
      return (
        <ConfigPanel
          key={`${control.type}-${index}`}
          tone={control.tone || 'indigo'}
          title={resolveContextText(control.label, control.label_key, 'Matrix size')}
          description={resolveContextText(control.description, control.description_key, '') || undefined}
          footer={resolveContextText(control.footer, control.footer_key, '') || undefined}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {control.controls.map((numberControl) => (
              <div key={numberControl.key}>{renderNumberContextInput(numberControl)}</div>
            ))}
          </div>
        </ConfigPanel>
      );
    }

    if (control.type === 'text_list') {
      const inputKey = control.input_key || `${control.key}Input`;
      const templateContext = activeTableTemplate?.context || {};
      const hasRawInput = Object.hasOwn(templateContext, inputKey);
      const textListValue = hasRawInput
        ? cellStringValue(templateContext[inputKey])
        : parseObjectiveComparisonSchoolList(templateContext[control.key], control.max_items ?? 100).join('\n');

      return (
        <ConfigPanel
          key={`${control.type}-${control.key}`}
          tone={control.tone || 'sky'}
          title={resolveContextText(control.label, control.label_key, control.key)}
          description={resolveContextText(control.description, control.description_key, '') || undefined}
          footer={resolveContextText(control.footer, control.footer_key, '') || undefined}>
          <Textarea
            value={textListValue}
            onChange={(event) => {
              const rawValue = event.target.value;
              updateTemplateContext({
                [inputKey]: rawValue,
                [control.key]: parseObjectiveComparisonSchoolList(rawValue, control.max_items ?? 100),
              });
            }}
            placeholder={resolveContextText(control.placeholder, control.placeholder_key, '') || undefined}
            className="min-h-20 w-full rounded-lg bg-white text-sm"
            rows={3}
          />
        </ConfigPanel>
      );
    }

    const domesticKey = control.domestic_key || 'domestic_comparison_schools';
    const foreignKey = control.foreign_key || 'foreign_comparison_schools';
    const domesticInputKey = control.domestic_input_key || 'domestic_comparison_input';
    const foreignInputKey = control.foreign_input_key || 'foreign_comparison_input';
    const templateContext = activeTableTemplate?.context || {};
    const hasDomesticInput = Object.hasOwn(templateContext, domesticInputKey);
    const hasForeignInput = Object.hasOwn(templateContext, foreignInputKey);
    const domesticInputValue = hasDomesticInput
      ? cellStringValue(templateContext[domesticInputKey])
      : parseObjectiveComparisonSchoolList(templateContext[domesticKey]).join(', ');
    const foreignInputValue = hasForeignInput
      ? cellStringValue(templateContext[foreignInputKey])
      : parseObjectiveComparisonSchoolList(templateContext[foreignKey]).join(', ');
    const domesticFieldId = `${domesticSchoolsFieldId}-${index}`;
    const foreignFieldId = `${foreignSchoolsFieldId}-${index}`;

    return (
      <ConfigPanel
        key={`${control.type}-${index}`}
        tone={control.tone || 'sky'}
        title={resolveContextText(control.label, control.label_key, 'Comparison schools')}
        description={resolveContextText(control.description, control.description_key, '') || undefined}
        footer={resolveContextText(control.footer, control.footer_key, '') || undefined}>
        <label htmlFor={domesticFieldId} className="block text-xs font-semibold text-sky-800">
          {resolveContextText(control.domestic_label, control.domestic_label_key, domesticKey)}
        </label>
        <Textarea
          id={domesticFieldId}
          value={domesticInputValue}
          onChange={(event) => {
            const rawValue = event.target.value;
            updateTemplateContext({
              [domesticInputKey]: rawValue,
              [domesticKey]: parseObjectiveComparisonSchoolList(rawValue),
            });
          }}
          placeholder={
            resolveContextText(control.domestic_placeholder, control.domestic_placeholder_key, '') || undefined
          }
          className="min-h-16 w-full rounded-lg bg-white text-sm"
          rows={2}
        />
        <label htmlFor={foreignFieldId} className="block pt-1 text-xs font-semibold text-sky-800">
          {resolveContextText(control.foreign_label, control.foreign_label_key, foreignKey)}
        </label>
        <Textarea
          id={foreignFieldId}
          value={foreignInputValue}
          onChange={(event) => {
            const rawValue = event.target.value;
            updateTemplateContext({
              [foreignInputKey]: rawValue,
              [foreignKey]: parseObjectiveComparisonSchoolList(rawValue),
            });
          }}
          placeholder={
            resolveContextText(control.foreign_placeholder, control.foreign_placeholder_key, '') || undefined
          }
          className="min-h-16 w-full rounded-lg bg-white text-sm"
          rows={2}
        />
      </ConfigPanel>
    );
  };

  return (
    <div className="variable-item" style={readOnly ? { opacity: 0.7, pointerEvents: 'none' } : undefined}>
      {!simpleMode && (
        <div className="variable-label">
          <span className="variable-label-title">{effectiveVariableLabel}</span>
          <code>{`{{${varKey}}}`}</code>
        </div>
      )}
      {!simpleMode && onChangeVariable && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChangeVariable(varKey)}
          className="mb-2 mt-2 h-10 w-full rounded-xl border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900">
          {t('variables.field.changeVariable')}
        </Button>
      )}
      {!simpleMode && (
        <Select value={effectiveVarType} onValueChange={(v) => onVarTypeChange(varKey, v as VariableInputType)}>
          <SelectTrigger className="w-full">
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
      )}

      {isSemesterCoursesSignCompositeVariableKey(varKey) ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">Thông tin ký</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              Chọn ngày bằng date picker, hệ thống sẽ tự format thành một biến hiển thị.
            </p>
          </div>
          <div className="space-y-3 p-3">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Địa điểm ký</div>
              <Input
                type="text"
                value={semesterCoursesSignLocationValue}
                onChange={(event) => handleSemesterCoursesSignLocationChange(event.target.value)}
                placeholder="Nhập địa điểm ký"
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ngày ký</div>
              <Input
                type="date"
                value={semesterCoursesSignDateValue}
                onChange={(event) => handleSemesterCoursesSignDateChange(event.target.value)}
                className="w-full"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Xem trước</div>
              <div className="mt-1 text-sm text-slate-700">
                {semesterCoursesSignPreviewValue || 'Chưa có dữ liệu ký'}
              </div>
            </div>
          </div>
        </div>
      ) : isSelectVariableInputType(effectiveVarType) ? (
        isSharedRecordSelectorFollower ? (
          <div className="mt-2 grid gap-1.5">
            <Input
              value={current}
              readOnly
              placeholder={t('variables.field.autoFilledPlaceholder')}
              className="h-10 bg-slate-50 text-slate-700"
            />
            <p className="text-xs leading-5 text-slate-500">
              {t('variables.field.autoFilledFromRecordSource', { field: sharedRecordSelectorOwnerLabel })}
            </p>
          </div>
        ) : (
          <SearchableSelect
            inlineSearchTrigger
            persistSearchText
            fetchOnOpen
            minSearchLength={0}
            value={current || undefined}
            onValueChange={handleSelectValue}
            disabled={isHardcodedTableTemplateVar || isHardcodedDocumentTemplateVar}
            apiFunction={
              isHardcodedTableTemplateVar || isHardcodedDocumentTemplateVar
                ? undefined
                : (params) =>
                    fetchDropdownApiOptions({
                      table: queryTable,
                      field: queryField,
                      labelField: queryLabelField,
                      filterField: queryFilterField,
                      filterValue: queryFilterValue,
                      search: typeof params.search === 'string' ? params.search : undefined,
                      page: typeof params.page === 'number' ? params.page : 1,
                      page_size: typeof params.page_size === 'number' ? params.page_size : 100,
                    })
            }
            loadByIdFunction={
              isHardcodedTableTemplateVar || isHardcodedDocumentTemplateVar
                ? undefined
                : async (selectedValue) => {
                    const matched = tableData?.find((item) => item.value === selectedValue);
                    if (matched) {
                      return {
                        value: matched.value,
                        label: matched.label,
                      };
                    }

                    const fetched = await fetchDropdownApiOptions({
                      table: queryTable,
                      field: queryField,
                      labelField: queryLabelField,
                      filterField: queryFilterField,
                      filterValue: queryFilterValue,
                      search: selectedValue,
                      page: 1,
                      page_size: 100,
                    });
                    const matchedFetched = fetched.find((item) => item.value === selectedValue) ?? fetched[0];
                    return matchedFetched
                      ? {
                          value: matchedFetched.value,
                          label: matchedFetched.label,
                        }
                      : null;
                  }
            }
            placeholder={
              isHardcodedTableTemplateVar
                ? t('variables.field.unavailableForTableTemplate')
                : t('tableEditor.cellProperties.searchAndSelect')
            }
            searchPlaceholder={t('tableEditor.cellProperties.searchValue')}
            emptyMessage={t('tableEditor.cellProperties.emptyValue')}
            searchKey="search"
            apiPageSize={10}
            clearable
          />
        )
      ) : isTableMatrixVariableInputType(effectiveVarType) ? (
        <ConfigPanel
          tone={rawTableData ? 'indigo' : 'amber'}
          title={rawTableData ? t('variables.field.tableMatrixReady') : t('variables.field.loadingTable')}
          description={t('variables.field.tableMatrixStats', {
            records: rawTableData?.length ?? t('common.status.loading'),
            columns: colCount,
          })}
        />
      ) : effectiveVarType === 'Table template' || isDynamicTableVariable ? (
        <div>
          {!tableTemplateForEditor ? (
            simpleMode ? null : (
              <TemplateEmptyState
                title={t('variables.field.noTableTemplateSelected')}
                description={t('variables.field.chooseTemplateHelp')}
                actionLabel={t('variables.field.chooseTemplate')}
                onAction={() => {
                  if (effectiveVarType === 'Table template') {
                    onShowTemplateSelector(varKey);
                  }
                }}
              />
            )
          ) : (
            <>
              {!simpleMode && effectiveVarType === 'Table template' && (
                <LinkedTemplateActionCard
                  name={tableTemplateForEditor.name}
                  description={tableTemplateForEditor.description}
                  linkedLabel={t('variables.field.linkedTemplate')}
                  changeLabel={t('variables.field.change')}
                  unlinkLabel={t('variables.field.unlink')}
                  onChange={() => onShowTemplateSelector(varKey)}
                  onReset={() => onSelectedTemplateChange(varKey, null)}
                />
              )}
              {tableContextControls.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-lg border border-cyan-200 bg-cyan-50/60">
                  <div className="border-b border-cyan-100 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-800">
                      Thiết lập trước khi tạo bảng
                    </div>
                    <p className="mt-1 text-xs leading-5 text-cyan-900/80">
                      Nhập các thông tin bên dưới. Khi đủ dữ liệu, bảng sẽ tự render để bạn nhập dòng/cell.
                    </p>
                  </div>
                  <div className="space-y-2 p-3">{tableContextControls.map(renderTableContextControl)}</div>
                  <div className="border-t border-cyan-100 px-3 py-2 text-xs leading-5">
                    {canConfigureTableTemplate ? (
                      <span className="font-medium text-emerald-700">Đã đủ thông tin, bảng được tạo bên dưới.</span>
                    ) : (
                      <span className="font-medium text-amber-800">{tableTemplateConfigWarning}</span>
                    )}
                  </div>
                </div>
              )}
              {canConfigureTableTemplate ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {!simpleMode && (
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{t('variables.field.tableTemplateData')}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        {t('variables.field.tableTemplateDataHelp')}
                      </p>
                    </div>
                  )}
                  <TableCellConfig
                    template={tableTemplateForEditor}
                    varValues={varValues}
                    onVarValuesChange={onVarValuesChange}
                    inlineEdit={simpleMode}
                    hideLabelFieldSelector={simpleMode}
                    onTemplateChange={handleTableTemplateEditorChange}
                  />
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm leading-6 text-slate-500">
                  Nhập đủ thông tin ở phần thiết lập để tạo bảng dữ liệu.
                </div>
              )}
            </>
          )}
        </div>
      ) : effectiveVarType === 'Document template' ? (
        <div>
          {!activeDocumentTemplate ? (
            simpleMode ? null : (
              <TemplateEmptyState
                title={t('variables.field.noDocumentTemplateSelected')}
                description={t('variables.field.chooseDocumentTemplateHelp')}
                actionLabel={t('variables.field.chooseDocumentTemplate')}
                onAction={() => onShowDocumentTemplateSelector?.(varKey)}
              />
            )
          ) : (
            <>
              {!simpleMode && (
                <LinkedTemplateActionCard
                  name={activeDocumentTemplate.name}
                  description={activeDocumentTemplate.description}
                  linkedLabel={t('variables.field.linkedTemplate')}
                  changeLabel={t('variables.field.change')}
                  unlinkLabel={t('variables.field.unlink')}
                  onChange={() => onShowDocumentTemplateSelector?.(varKey)}
                  onReset={() => onDocumentTemplateChange?.(varKey, null)}
                />
              )}
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {!simpleMode && (
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{t('variables.field.documentTemplateData')}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">
                      {t('variables.field.documentTemplateDataHelp')}
                    </p>
                  </div>
                )}
                <DocumentTemplateEditor
                  template={activeDocumentTemplate}
                  values={documentTemplateValues ?? EMPTY_DOCUMENT_TEMPLATE_VALUES}
                  onValuesChange={(updates) => onDocumentTemplateValuesChange?.(varKey, updates)}
                  onTemplateChange={(tpl) => onDocumentTemplateChange?.(varKey, tpl)}
                  simpleMode={simpleMode}
                  allowLockedStructureEditing={!simpleMode}
                  allowStructureReorder={allowDocumentTemplateReorder}
                  allowStyleEditing={false}
                />
              </div>
            </>
          )}
        </div>
      ) : isLongTextVariableInputType(effectiveVarType) ? (
        <Textarea
          value={current}
          onChange={(e) => onVarValuesChange({ [varKey]: e.target.value })}
          rows={4}
          className="w-full"
        />
      ) : isCheckVariableInputType(effectiveVarType) ? (
        <Checkbox
          checked={current === 'true' || current === '1'}
          onCheckedChange={(checked) => onVarValuesChange({ [varKey]: checked === true ? 'true' : 'false' })}
        />
      ) : isNumberVariableInputType(effectiveVarType) ? (
        <Input
          type="number"
          value={current}
          onChange={(e) => onVarValuesChange({ [varKey]: e.target.value })}
          placeholder={t('variables.field.manualValuePlaceholder')}
          className="w-full"
        />
      ) : isImageVariableInputType(effectiveVarType) ? (
        <div className="space-y-2">
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleImageDrop}
            className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-500">
            {imageSrcValue ? (
              <img src={imageSrcValue} alt="" className="max-h-40 max-w-full rounded-md object-contain" />
            ) : (
              <span>{t('variables.field.imageDropHint')}</span>
            )}
          </div>
          <Input
            type="url"
            value={imageSrcValue}
            onChange={(e) => handleImageSourceChange(e.target.value)}
            placeholder={t('variables.field.imageUrlPlaceholder')}
            className="w-full"
          />
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => handleImageFile(event.target.files?.[0])}
            className="w-full"
          />
        </div>
      ) : (
        <Input
          type="text"
          value={current}
          onChange={(e) => onVarValuesChange({ [varKey]: e.target.value })}
          placeholder={t('variables.field.manualValuePlaceholder')}
          className="w-full"
        />
      )}
    </div>
  );
};
