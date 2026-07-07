import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Calculator,
  Columns3,
  Database,
  FolderTree,
  GripVertical,
  Italic,
  Layers3,
  Plus,
  Rows3,
  Settings2,
  Trash2,
  Underline,
  Wand2,
  Bold as BoldIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Button,
  Checkbox,
  Input,
  SearchableMultiSelect,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'reactjs-platform/ui';
import {
  getVariableAlias,
  getVariableTableAlias,
  type TableTemplate,
  type TableTemplateBlock,
  type TableTemplateCellStyle,
  type TableTemplateHeader,
  type TableTemplateRow,
} from '../../../lib';
import { useTranslation } from '../../../i18n';
import type {
  ITableBuilderColumn,
  ITableBuilderConfig,
  ITableBuilderHeaderGroup,
  ITableBuilderRowBlock,
  ITableDesignerProps,
  TTableDesignerSelection,
} from './table-designer.type';
import {
  TABLE_DESIGNER_INPUT_TYPES,
  buildTableDesignerField,
  cloneTableDesignerValue,
  compileTableBuilderToTemplate,
  createFetchConfigFromColumns,
  createTableDesignerBlock,
  createTableDesignerColumn,
  createTableDesignerGroup,
  createTableDesignerId,
  normalizeColumnKey,
  normalizeTableBuilder,
  parseTableDesignerField,
} from './table-designer.utils';

const NONE_VALUE = '__none';
const MAX_BLOCK_PREVIEW_ROWS = 20;
const DEFAULT_STYLE_VALUE = '__default';
const VERTICAL_ALIGN_OPTIONS = ['top', 'middle', 'bottom'] as const;
const FONT_FAMILY_OPTIONS = [
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Calibri, Arial, sans-serif', label: 'Calibri' },
  { value: 'Cambria, Georgia, serif', label: 'Cambria' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Courier New, Courier, monospace', label: 'Courier New' },
] as const;
const FONT_SIZE_OPTIONS = [
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
  '28pt',
];
const LINE_HEIGHT_OPTIONS = ['1', '1.15', '1.25', '1.5', '2'];
const COLOR_SWATCHES = ['#000000', '#374151', '#B91C1C', '#166534', '#1D4ED8', '#7C3AED', '#F8FAFC', '#E5E7EB'];
const STYLE_KEYS = [
  'bold',
  'italic',
  'underline',
  'font_family',
  'text_align',
  'vertical_align',
  'font_size',
  'line_height',
  'color',
  'background_color',
] as const;

type TStyleKey = (typeof STYLE_KEYS)[number];
type TStylePatch = Partial<Pick<TableTemplateCellStyle, TStyleKey>>;

const getConfiguredCanvasStyle = (
  source?: TableTemplateCellStyle | TableTemplateHeader | null,
  prefix: '' | 'cell_' = '',
): CSSProperties => {
  if (!source) return {};

  const config = source as TableTemplateHeader & Record<string, unknown>;
  const bold = config[`${prefix}bold`];
  const italic = config[`${prefix}italic`];
  const underline = config[`${prefix}underline`];
  const textAlign = config[`${prefix}text_align`];
  const verticalAlign = config[`${prefix}vertical_align`];

  return {
    ...(typeof bold === 'boolean' ? { fontWeight: bold ? 700 : 400 } : {}),
    ...(typeof italic === 'boolean' ? { fontStyle: italic ? 'italic' : 'normal' } : {}),
    ...(typeof underline === 'boolean' ? { textDecoration: underline ? 'underline' : 'none' } : {}),
    ...(typeof config[`${prefix}font_family`] === 'string'
      ? { fontFamily: config[`${prefix}font_family`] as string }
      : {}),
    ...(textAlign === 'left' || textAlign === 'center' || textAlign === 'right' || textAlign === 'justify'
      ? { textAlign }
      : {}),
    ...(verticalAlign === 'top' || verticalAlign === 'middle' || verticalAlign === 'bottom' ? { verticalAlign } : {}),
    ...(typeof config[`${prefix}font_size`] === 'string' ? { fontSize: config[`${prefix}font_size`] as string } : {}),
    ...(typeof config[`${prefix}line_height`] === 'string' || typeof config[`${prefix}line_height`] === 'number'
      ? { lineHeight: config[`${prefix}line_height`] as string | number }
      : {}),
    ...(typeof config[`${prefix}color`] === 'string' ? { color: config[`${prefix}color`] as string } : {}),
    ...(typeof config[`${prefix}background_color`] === 'string'
      ? { backgroundColor: config[`${prefix}background_color`] as string }
      : {}),
  };
};

const selectionKey = (selection: TTableDesignerSelection) => {
  if (selection.type === 'table') return 'table';
  if (selection.type === 'row') return `row:${selection.block_id}:${selection.row_index}`;
  return `${selection.type}:${selection.id}`;
};

const getCellValue = (cell: unknown) => {
  if (cell && typeof cell === 'object' && !Array.isArray(cell) && 'value' in cell) {
    const value = (cell as { value?: unknown }).value;
    return value === null || value === undefined ? '' : String(value);
  }
  return cell === null || cell === undefined ? '' : String(cell);
};

const getObjectRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const isManualSourceCell = (value: unknown) => getObjectRecord(value)?.force_manual === true;

const getStringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');

const getStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];

const getObjectArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === 'object' && !Array.isArray(item)),
      )
    : [];

const patchObject = (value: Record<string, unknown>, patch: Record<string, unknown>) => {
  const next = { ...value };
  Object.entries(patch).forEach(([key, patchValue]) => {
    if (patchValue === undefined || patchValue === null || patchValue === '') {
      delete next[key];
      return;
    }
    next[key] = patchValue;
  });
  return next;
};

const cleanStylePatch = (patch: TStylePatch) =>
  Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [key, value === DEFAULT_STYLE_VALUE ? undefined : value]),
  ) as TStylePatch;

const getHeaderStylePatch = (patch: TStylePatch, prefix = '') =>
  Object.fromEntries(Object.entries(cleanStylePatch(patch)).map(([key, value]) => [`${prefix}${key}`, value]));

const pickHeaderStyle = (source?: Record<string, unknown> | null, prefix = ''): TableTemplateCellStyle =>
  STYLE_KEYS.reduce<TableTemplateCellStyle>((style, key) => {
    const sourceKey = `${prefix}${key}`;
    if (source?.[sourceKey] !== undefined) {
      return { ...style, [key]: source[sourceKey] };
    }
    return style;
  }, {});

const patchCellStyle = (cell: unknown, patch: TStylePatch, column?: ITableBuilderColumn) => {
  const cellObject = getObjectRecord(cell);
  const nextCell: Record<string, unknown> = cellObject
    ? { ...cellObject }
    : {
        value: getCellValue(cell),
        is_read_only: Boolean(column?.read_only || column?.computed_type),
      };

  Object.entries(cleanStylePatch(patch)).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      delete nextCell[key];
      return;
    }
    nextCell[key] = value;
  });

  return nextCell;
};

const toOptionalNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const setCellValue = (cell: unknown, value: string, column?: ITableBuilderColumn) => {
  if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
    const nextCell: Record<string, unknown> = {
      ...(cell as Record<string, unknown>),
      value,
    };

    if (isManualSourceCell(cell)) {
      delete nextCell.table_field;
      delete nextCell.label_field;
    } else if (column?.table_field && !column.computed_type) {
      nextCell.table_field = column.table_field;
      if (column.label_field) {
        nextCell.label_field = column.label_field;
      } else {
        delete nextCell.label_field;
      }
    }

    return nextCell;
  }

  const nextCell: Record<string, unknown> = {
    value,
    is_read_only: Boolean(column?.read_only || column?.computed_type),
  };

  if (column?.table_field && !column.computed_type) {
    nextCell.table_field = column.table_field;
    if (column.label_field) {
      nextCell.label_field = column.label_field;
    }
  }

  return nextCell;
};

const isCellResolvedFromContext = (cell: unknown) => {
  const cellObject = getObjectRecord(cell);
  return Boolean(
    cellObject?.resolve_from_context ||
    cellObject?.resolveFromContext ||
    cellObject?.context_source ||
    cellObject?.contextSource,
  );
};

const isCellRecordSyncTrigger = (cell: unknown) => {
  const cellObject = getObjectRecord(cell);
  return Boolean(cellObject?.sync_record_trigger || cellObject?.syncRecordTrigger);
};

const getCellSourceConfig = (cell: unknown, column?: ITableBuilderColumn) => {
  const cellObject = getObjectRecord(cell);
  const forceManual = isManualSourceCell(cell);
  const tableField =
    getStringValue(cellObject?.table_field) || (forceManual ? '' : getStringValue(column?.table_field));
  const labelField =
    getStringValue(cellObject?.label_field) || (forceManual ? '' : getStringValue(column?.label_field));
  const source = parseTableDesignerField(tableField);
  return {
    table: source.table,
    field: source.field,
    labelField,
    resolveFromContext: isCellResolvedFromContext(cell),
    syncRecordTrigger: isCellRecordSyncTrigger(cell),
  };
};

const setCellSourceConfig = (
  cell: unknown,
  patch: {
    table?: string;
    field?: string;
    labelField?: string;
    resolveFromContext?: boolean;
    syncRecordTrigger?: boolean;
  },
  column?: ITableBuilderColumn,
) => {
  const cellObject = getObjectRecord(cell);
  const currentSource = getCellSourceConfig(cell, column);
  const nextTable = patch.table !== undefined ? patch.table : currentSource.table;
  const nextField = patch.field !== undefined ? patch.field : currentSource.field;
  const nextLabelField = patch.labelField !== undefined ? patch.labelField : currentSource.labelField;
  const nextResolveFromContext =
    patch.resolveFromContext !== undefined ? patch.resolveFromContext : currentSource.resolveFromContext;
  const nextSyncRecordTrigger =
    patch.syncRecordTrigger !== undefined ? patch.syncRecordTrigger : currentSource.syncRecordTrigger;

  const nextCell: Record<string, unknown> = {
    ...(cellObject ?? {}),
    value: getCellValue(cell),
  };
  const nextTableField = buildTableDesignerField(nextTable, nextField);

  if (nextTableField) {
    nextCell.table_field = nextTableField;
    if (nextLabelField && nextLabelField !== nextField) {
      nextCell.label_field = nextLabelField;
    } else {
      delete nextCell.label_field;
    }
    if (nextResolveFromContext || nextSyncRecordTrigger) {
      nextCell.resolve_from_context = true;
      nextCell.is_read_only = true;
      delete nextCell.force_manual;
    } else {
      delete nextCell.resolve_from_context;
    }
    if (nextSyncRecordTrigger) {
      nextCell.sync_record_trigger = true;
    } else {
      delete nextCell.sync_record_trigger;
      delete nextCell.syncRecordTrigger;
    }
    return nextCell;
  }

  delete nextCell.table_field;
  delete nextCell.label_field;
  delete nextCell.resolve_from_context;
  delete nextCell.resolveFromContext;
  delete nextCell.context_source;
  delete nextCell.contextSource;
  delete nextCell.sync_record_trigger;
  delete nextCell.syncRecordTrigger;
  delete nextCell.source_table;
  delete nextCell.source_record_id;
  nextCell.is_read_only = false;
  nextCell.force_manual = true;
  return nextCell;
};

const clearMatchingCellSourceConfig = (
  cell: unknown,
  tableField: string | null | undefined,
  column: ITableBuilderColumn,
) => {
  const cellObject = getObjectRecord(cell);
  if (!cellObject || !tableField || getStringValue(cellObject.table_field) !== tableField) {
    return cell;
  }

  const nextCell: Record<string, unknown> = { ...cellObject };
  delete nextCell.table_field;
  delete nextCell.label_field;
  delete nextCell.resolve_from_context;
  delete nextCell.resolveFromContext;
  delete nextCell.context_source;
  delete nextCell.contextSource;
  delete nextCell.sync_record_trigger;
  delete nextCell.syncRecordTrigger;
  delete nextCell.source_table;
  delete nextCell.source_record_id;
  delete nextCell.force_manual;
  nextCell.is_read_only = Boolean(column.read_only || column.computed_type);

  return nextCell;
};

const clearColumnSourceFromRow = (
  row: Record<string, unknown>,
  column: ITableBuilderColumn,
  tableField: string | null | undefined,
) => {
  const nextCell = clearMatchingCellSourceConfig(row[column.key], tableField, column);
  if (nextCell === row[column.key]) return row;

  return {
    ...row,
    [column.key]: nextCell,
  };
};

const clearColumnSourceFromRowFetchConfig = (
  rowFetchConfig: Record<string, unknown> | null | undefined,
  columnKey: string,
) => {
  if (!rowFetchConfig || !Array.isArray(rowFetchConfig.fields_to_fetch)) {
    return rowFetchConfig;
  }

  return {
    ...rowFetchConfig,
    fields_to_fetch: rowFetchConfig.fields_to_fetch.filter((fieldConfig) => {
      const fieldConfigRecord = getObjectRecord(fieldConfig);
      return fieldConfigRecord?.key !== columnKey;
    }),
  };
};

const clearColumnSourceFromBlock = (
  block: ITableBuilderRowBlock,
  column: ITableBuilderColumn,
  tableField: string | null | undefined,
) => ({
  ...block,
  subsection_values: block.subsection_values
    ? clearColumnSourceFromRow(block.subsection_values, column, tableField)
    : undefined,
  row_template: block.row_template
    ? clearColumnSourceFromRow(block.row_template, column, tableField)
    : block.row_template,
  rows: block.rows?.map(
    (row) => clearColumnSourceFromRow(row as Record<string, unknown>, column, tableField) as TableTemplateRow,
  ),
  row_fetch_config: clearColumnSourceFromRowFetchConfig(block.row_fetch_config, column.key),
});

const createDesignerDataRow = (builder: ITableBuilderConfig, block: ITableBuilderRowBlock) => {
  const sourceTemplate = getObjectRecord(block.row_template) ?? {};
  const nextRow: Record<string, unknown> = {
    id: createTableDesignerId('row'),
  };

  ['row_button_config', 'cell_merge'].forEach((metadataKey) => {
    if (metadataKey in sourceTemplate) {
      nextRow[metadataKey] = cloneTableDesignerValue(sourceTemplate[metadataKey]);
    }
  });

  builder.columns.forEach((column) => {
    nextRow[column.key] = setCellValue(sourceTemplate[column.key], '', column);
  });

  return nextRow;
};

const getHeaderDepth = (headers: TableTemplateHeader[]) => {
  const hasChildHeaders = headers.some((header) => header.parent);
  const hasGrandchildHeaders = headers.some(
    (header) => header.parent && headers.find((parent) => parent.key === header.parent)?.parent,
  );
  return hasGrandchildHeaders ? 3 : hasChildHeaders ? 2 : 1;
};

const getHeaderVisualDepth = (header: TableTemplateHeader, headers: TableTemplateHeader[]) => {
  if (!header.parent) return 0;
  const parentHeader = headers.find((candidate) => candidate.key === header.parent);
  return parentHeader && !parentHeader.parent ? 1 : 2;
};

const getHeaderRows = (headers: TableTemplateHeader[]) => {
  const rowCount = getHeaderDepth(headers);
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    headers.filter((header) => {
      if (rowCount === 1) return true;
      if (rowCount === 2) {
        if (rowIndex === 0 && header.parent) return false;
        if (rowIndex === 1 && !header.parent) return false;
        return true;
      }
      return getHeaderVisualDepth(header, headers) === rowIndex;
    }),
  );
};

const getUniqueColumnKey = (columns: ITableBuilderColumn[], currentId: string, value: string) => {
  const normalized = normalizeColumnKey(value);
  const usedKeys = new Set(columns.filter((column) => column.id !== currentId).map((column) => column.key));
  if (!usedKeys.has(normalized)) return normalized;

  let index = 2;
  while (usedKeys.has(`${normalized}_${index}`)) {
    index += 1;
  }
  return `${normalized}_${index}`;
};

const getUniqueGroupKey = (groups: ITableBuilderHeaderGroup[], currentId: string, value: string) => {
  const normalized = normalizeColumnKey(value, 'group');
  const usedKeys = new Set(groups.filter((group) => group.id !== currentId).map((group) => group.key));
  if (!usedKeys.has(normalized)) return normalized;

  let index = 2;
  while (usedKeys.has(`${normalized}_${index}`)) {
    index += 1;
  }
  return `${normalized}_${index}`;
};

interface ISortableDesignerItemProps {
  id: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}

const SortableDesignerItem = ({ id, selected, onSelect, children }: ISortableDesignerItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-white p-3 text-left shadow-sm transition ${
        selected ? 'border-[#174A86] ring-2 ring-[#174A86]/10' : 'border-slate-200 hover:border-slate-300'
      } ${isDragging ? 'opacity-60' : ''}`}>
      <div className="flex gap-2">
        <button
          type="button"
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50"
          {...attributes}
          {...listeners}>
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          {children}
        </button>
      </div>
    </div>
  );
};

const InlineProperty = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    {children}
  </div>
);

const PropertyCheckbox = ({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
    <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onCheckedChange(value === true)} />
    <span className="font-medium text-slate-700">{label}</span>
  </label>
);

const StyleToggleButton = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`flex size-9 items-center justify-center rounded-md border text-sm transition ${
      active ? 'border-[#174A86] bg-[#174A86] text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
    }`}>
    {children}
  </button>
);

const StyleOptionSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }> | readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}) => {
  const resolvedOptions =
    value && !options.some((option) => option.value === value) ? [{ value, label: value }, ...options] : options;

  return (
    <InlineProperty label={label}>
      <Select
        value={value || DEFAULT_STYLE_VALUE}
        onValueChange={(nextValue) => onChange(nextValue === DEFAULT_STYLE_VALUE ? undefined : nextValue || undefined)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_STYLE_VALUE}>Theo mặc định</SelectItem>
          {resolvedOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </InlineProperty>
  );
};

const StyleSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: readonly string[];
  onChange: (value: string | undefined) => void;
}) => (
  <InlineProperty label={label}>
    <Select
      value={value || DEFAULT_STYLE_VALUE}
      onValueChange={(nextValue) => onChange(nextValue === DEFAULT_STYLE_VALUE ? undefined : nextValue || undefined)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_STYLE_VALUE}>Theo mặc định</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </InlineProperty>
);

const isHexColor = (value?: string) => Boolean(value && /^#[0-9a-f]{6}$/i.test(value));

const StyleColorPicker = ({
  label,
  value,
  onChange,
}: {
  label: string;
  onChange: (value: string | undefined) => void;
  value?: string;
}) => (
  <InlineProperty label={label}>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={isHexColor(value) ? value : '#000000'}
          className="h-10 w-12 shrink-0 cursor-pointer p-1"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onChange(undefined)}>
          Theo mặc định
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            title={color}
            onClick={() => onChange(color)}
            className={`size-6 rounded border ${
              value?.toLowerCase() === color.toLowerCase()
                ? 'border-[#174A86] ring-2 ring-[#174A86]/20'
                : 'border-slate-300'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  </InlineProperty>
);

const TextAlignButtonGroup = ({
  value,
  onChange,
}: {
  value?: TableTemplateCellStyle['text_align'];
  onChange: (value: TableTemplateCellStyle['text_align'] | undefined) => void;
}) => (
  <InlineProperty label="Căn ngang">
    <div className="grid grid-cols-5 gap-1.5">
      <StyleToggleButton label="Theo mặc định" active={!value} onClick={() => onChange(undefined)}>
        <span className="text-[13px] font-semibold">Auto</span>
      </StyleToggleButton>
      <StyleToggleButton label="Căn trái" active={value === 'left'} onClick={() => onChange('left')}>
        <AlignLeft className="size-4" />
      </StyleToggleButton>
      <StyleToggleButton label="Căn giữa" active={value === 'center'} onClick={() => onChange('center')}>
        <AlignCenter className="size-4" />
      </StyleToggleButton>
      <StyleToggleButton label="Căn phải" active={value === 'right'} onClick={() => onChange('right')}>
        <AlignRight className="size-4" />
      </StyleToggleButton>
      <StyleToggleButton label="Căn đều" active={value === 'justify'} onClick={() => onChange('justify')}>
        <AlignJustify className="size-4" />
      </StyleToggleButton>
    </div>
  </InlineProperty>
);

const CellStyleControls = ({
  title,
  description,
  value,
  includeFontFamily = true,
  onPatch,
}: {
  title: string;
  description?: string;
  value?: TableTemplateCellStyle | null;
  includeFontFamily?: boolean;
  onPatch: (patch: TStylePatch) => void;
}) => (
  <div className="rounded-lg border border-slate-200 p-3">
    <div className="mb-3">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {description && <div className="mt-1 text-[13px] leading-5 text-slate-500">{description}</div>}
    </div>
    <div className="grid gap-3">
      {includeFontFamily && (
        <StyleOptionSelect
          label="Font"
          value={value?.font_family}
          options={FONT_FAMILY_OPTIONS}
          onChange={(font_family) => onPatch({ font_family })}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <StyleOptionSelect
          label="Cỡ chữ"
          value={value?.font_size}
          options={FONT_SIZE_OPTIONS.map((fontSize) => ({ value: fontSize, label: fontSize }))}
          onChange={(font_size) => onPatch({ font_size })}
        />
        <StyleOptionSelect
          label="Line height"
          value={value?.line_height === undefined ? undefined : String(value.line_height)}
          options={LINE_HEIGHT_OPTIONS.map((lineHeight) => ({ value: lineHeight, label: lineHeight }))}
          onChange={(line_height) => onPatch({ line_height })}
        />
      </div>
      <TextAlignButtonGroup value={value?.text_align} onChange={(text_align) => onPatch({ text_align })} />
      <div className="grid gap-3">
        <StyleSelect
          label="Căn dọc"
          value={value?.vertical_align}
          options={VERTICAL_ALIGN_OPTIONS}
          onChange={(vertical_align) =>
            onPatch({ vertical_align: vertical_align as TableTemplateCellStyle['vertical_align'] })
          }
        />
      </div>
      <InlineProperty label="Kiểu chữ">
        <div className="flex gap-2">
          <StyleToggleButton
            label="In đậm"
            active={value?.bold === true}
            onClick={() => onPatch({ bold: value?.bold === true ? undefined : true })}>
            <BoldIcon className="size-4" />
          </StyleToggleButton>
          <StyleToggleButton
            label="In nghiêng"
            active={value?.italic === true}
            onClick={() => onPatch({ italic: value?.italic === true ? undefined : true })}>
            <Italic className="size-4" />
          </StyleToggleButton>
          <StyleToggleButton
            label="Gạch chân"
            active={value?.underline === true}
            onClick={() => onPatch({ underline: value?.underline === true ? undefined : true })}>
            <Underline className="size-4" />
          </StyleToggleButton>
        </div>
      </InlineProperty>
      <div className="grid grid-cols-2 gap-3">
        <StyleColorPicker label="Màu chữ" value={value?.color} onChange={(color) => onPatch({ color })} />
        <StyleColorPicker
          label="Màu nền"
          value={value?.background_color}
          onChange={(background_color) => onPatch({ background_color })}
        />
      </div>
    </div>
  </div>
);

export const TableDesigner = ({ tableTemplate, tableBuilder, schemaCatalog, onChange }: ITableDesignerProps) => {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<TTableDesignerSelection>({ type: 'table' });
  const builder = useMemo(() => normalizeTableBuilder(tableBuilder, tableTemplate), [tableBuilder, tableTemplate]);
  const compiledTemplate = useMemo(
    () => compileTableBuilderToTemplate(builder, tableTemplate),
    [builder, tableTemplate],
  );
  const tableNames = useMemo(() => Object.keys(schemaCatalog).sort((a, b) => a.localeCompare(b)), [schemaCatalog]);
  const tableOptions = useMemo(
    () =>
      tableNames.map((table) => ({
        value: table,
        label: `${getVariableTableAlias(table)} (${table})`,
      })),
    [tableNames],
  );
  const groupOptions = useMemo(
    () =>
      builder.header_groups.map((group) => ({
        value: group.id,
        label: `${group.label || group.key} (${group.key})`,
      })),
    [builder.header_groups],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedColumn =
    selection.type === 'column' ? builder.columns.find((column) => column.id === selection.id) : null;
  const selectedGroup =
    selection.type === 'group' ? builder.header_groups.find((group) => group.id === selection.id) : null;
  const selectedBlock =
    selection.type === 'block' ? builder.row_blocks.find((block) => block.id === selection.id) : null;
  const selectedRowBlock =
    selection.type === 'row' ? builder.row_blocks.find((block) => block.id === selection.block_id) : null;
  const selectedRow = selection.type === 'row' ? selectedRowBlock?.rows?.[selection.row_index] : null;

  useEffect(() => {
    if (selection.type === 'table') return;
    const exists =
      selection.type === 'column'
        ? builder.columns.some((column) => column.id === selection.id)
        : selection.type === 'group'
          ? builder.header_groups.some((group) => group.id === selection.id)
          : selection.type === 'block'
            ? builder.row_blocks.some((block) => block.id === selection.id)
            : Boolean(builder.row_blocks.find((block) => block.id === selection.block_id)?.rows?.[selection.row_index]);
    if (!exists) {
      setSelection({ type: 'table' });
    }
  }, [builder.columns, builder.header_groups, builder.row_blocks, selection]);

  const emitBuilderChange = useCallback(
    (updater: (current: ITableBuilderConfig) => ITableBuilderConfig) => {
      const nextBuilder = updater(builder);
      if (nextBuilder === builder) return;

      onChange({
        tableBuilder: nextBuilder,
        tableTemplate: compileTableBuilderToTemplate(nextBuilder, tableTemplate),
      });
    },
    [builder, onChange, tableTemplate],
  );

  const updateTableOptions = (patch: Partial<ITableBuilderConfig['options']>) => {
    emitBuilderChange((current) => ({
      ...current,
      options: {
        ...current.options,
        ...patch,
      },
    }));
  };

  const updateTableRenderRule = useCallback(
    (patch: Record<string, unknown>) => {
      const nextTemplate = compileTableBuilderToTemplate(builder, tableTemplate);
      const contextSchema = getObjectRecord(nextTemplate.context_schema) ?? {};
      const renderRule = getObjectRecord(contextSchema.render_rule) ?? {};

      nextTemplate.context_schema = {
        ...contextSchema,
        render_rule: {
          ...renderRule,
          ...patch,
        },
      };
      delete nextTemplate.contextSchema;

      onChange({
        tableBuilder: builder,
        tableTemplate: nextTemplate,
      });
    },
    [builder, onChange, tableTemplate],
  );

  const updateColumn = (columnId: string, patch: Partial<ITableBuilderColumn>) => {
    emitBuilderChange((current) => ({
      ...current,
      columns: current.columns.map((column) => {
        if (column.id !== columnId) return column;
        return {
          ...column,
          ...patch,
          key: patch.key !== undefined ? getUniqueColumnKey(current.columns, columnId, patch.key) : column.key,
        };
      }),
      row_blocks:
        'table_field' in patch && !patch.table_field
          ? current.row_blocks.map((block) => {
              const currentColumn = current.columns.find((column) => column.id === columnId);
              return currentColumn?.table_field
                ? clearColumnSourceFromBlock(block, currentColumn, currentColumn.table_field)
                : block;
            })
          : current.row_blocks,
    }));
  };

  const updateGroup = (groupId: string, patch: Partial<ITableBuilderHeaderGroup>) => {
    emitBuilderChange((current) => ({
      ...current,
      header_groups: current.header_groups.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          ...patch,
          key: patch.key !== undefined ? getUniqueGroupKey(current.header_groups, groupId, patch.key) : group.key,
        };
      }),
    }));
  };

  const updateBlock = (blockId: string, patch: Partial<ITableBuilderRowBlock>) => {
    emitBuilderChange((current) => ({
      ...current,
      row_blocks: current.row_blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
    }));
  };

  const addColumn = () => {
    const nextColumn = createTableDesignerColumn(builder);
    emitBuilderChange((current) => ({
      ...current,
      columns: [...current.columns, nextColumn],
    }));
    setSelection({ type: 'column', id: nextColumn.id });
  };

  const addGroup = () => {
    const nextGroup = createTableDesignerGroup(builder);
    emitBuilderChange((current) => ({
      ...current,
      header_groups: [...current.header_groups, nextGroup],
    }));
    setSelection({ type: 'group', id: nextGroup.id });
  };

  const addBlock = (type: ITableBuilderRowBlock['type']) => {
    const nextBlock = createTableDesignerBlock(builder, type);
    emitBuilderChange((current) => ({
      ...current,
      row_blocks: [...current.row_blocks, nextBlock],
    }));
    setSelection({ type: 'block', id: nextBlock.id });
  };

  const deleteColumn = (columnId: string) => {
    if (builder.columns.length <= 1) return;
    emitBuilderChange((current) => ({
      ...current,
      columns: current.columns.filter((column) => column.id !== columnId),
    }));
    setSelection({ type: 'table' });
  };

  const deleteGroup = (groupId: string) => {
    emitBuilderChange((current) => ({
      ...current,
      header_groups: current.header_groups
        .filter((group) => group.id !== groupId)
        .map((group) => ({
          ...group,
          parent_group_id: group.parent_group_id === groupId ? null : group.parent_group_id,
        })),
      columns: current.columns.map((column) => ({
        ...column,
        header_group_id: column.header_group_id === groupId ? null : column.header_group_id,
      })),
    }));
    setSelection({ type: 'table' });
  };

  const deleteBlock = (blockId: string) => {
    emitBuilderChange((current) => ({
      ...current,
      row_blocks: current.row_blocks.filter((block) => block.id !== blockId),
    }));
    setSelection({ type: 'table' });
  };

  const updateDataRow = (blockId: string, rowIndex: number, row: Record<string, unknown>) => {
    emitBuilderChange((current) => ({
      ...current,
      row_blocks: current.row_blocks.map((block) => {
        if (block.id !== blockId) return block;
        const rows = [...(block.rows ?? [])];
        rows[rowIndex] = row as TableTemplateRow;
        return { ...block, rows };
      }),
    }));
  };

  const addDataRow = (blockId: string) => {
    const block = builder.row_blocks.find((candidate) => candidate.id === blockId);
    if (!block) return;
    const nextRow = createDesignerDataRow(builder, block);
    const nextRowIndex = block.rows?.length ?? 0;

    emitBuilderChange((current) => ({
      ...current,
      row_blocks: current.row_blocks.map((candidate) =>
        candidate.id === blockId
          ? { ...candidate, rows: [...(candidate.rows ?? []), nextRow as TableTemplateRow] }
          : candidate,
      ),
    }));
    setSelection({ type: 'row', block_id: blockId, row_index: nextRowIndex });
  };

  const copyDataRow = (blockId: string, rowIndex: number) => {
    const block = builder.row_blocks.find((candidate) => candidate.id === blockId);
    const row = block?.rows?.[rowIndex];
    if (!block || !row) return;
    const copiedRow = {
      ...cloneTableDesignerValue(row),
      id: createTableDesignerId('row'),
    };

    emitBuilderChange((current) => ({
      ...current,
      row_blocks: current.row_blocks.map((candidate) =>
        candidate.id === blockId
          ? {
              ...candidate,
              rows: [
                ...(candidate.rows ?? []).slice(0, rowIndex + 1),
                copiedRow as TableTemplateRow,
                ...(candidate.rows ?? []).slice(rowIndex + 1),
              ],
            }
          : candidate,
      ),
    }));
    setSelection({ type: 'row', block_id: blockId, row_index: rowIndex + 1 });
  };

  const deleteDataRow = (blockId: string, rowIndex: number) => {
    emitBuilderChange((current) => ({
      ...current,
      row_blocks: current.row_blocks.map((block) =>
        block.id === blockId ? { ...block, rows: (block.rows ?? []).filter((_, index) => index !== rowIndex) } : block,
      ),
    }));
    setSelection({ type: 'block', id: blockId });
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    emitBuilderChange((current) => {
      const oldIndex = current.columns.findIndex((column) => column.id === active.id);
      const newIndex = current.columns.findIndex((column) => column.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return { ...current, columns: arrayMove(current.columns, oldIndex, newIndex) };
    });
  };

  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    emitBuilderChange((current) => {
      const oldIndex = current.row_blocks.findIndex((block) => block.id === active.id);
      const newIndex = current.row_blocks.findIndex((block) => block.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return { ...current, row_blocks: arrayMove(current.row_blocks, oldIndex, newIndex) };
    });
  };

  const selectHeader = (header: TableTemplateHeader) => {
    if (header.is_parent_header) {
      const group = builder.header_groups.find((candidate) => candidate.key === header.key);
      setSelection(group ? { type: 'group', id: group.id } : { type: 'table' });
      return;
    }
    const column = builder.columns.find((candidate) => candidate.key === header.key);
    setSelection(column ? { type: 'column', id: column.id } : { type: 'table' });
  };

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
      <div className="min-h-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FolderTree className="size-4 text-[#174A86]" />
            Cấu trúc bảng
          </div>
          <div className="mt-1 text-[13px] text-slate-500">{t('tableDesigner.dragDropHint')}</div>
        </div>

        <Tabs defaultValue="columns" className="min-h-0">
          <TabsList className="m-3 grid grid-cols-3">
            <TabsTrigger value="columns">Cột</TabsTrigger>
            <TabsTrigger value="groups">Nhóm</TabsTrigger>
            <TabsTrigger value="blocks">Dòng</TabsTrigger>
          </TabsList>

          <TabsContent value="columns" className="mt-0 px-3 pb-3">
            <div className="mb-3 flex gap-2">
              <Button type="button" size="sm" onClick={addColumn} className="flex-1">
                <Plus className="size-4" />
                Thêm cột
              </Button>
            </div>
            <div className="max-h-[calc(100vh-22rem)] min-h-[420px] overflow-auto pr-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
                <SortableContext
                  items={builder.columns.map((column) => column.id)}
                  strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {builder.columns.map((column, index) => (
                      <SortableDesignerItem
                        key={column.id}
                        id={column.id}
                        selected={selectionKey(selection) === `column:${column.id}`}
                        onSelect={() => setSelection({ type: 'column', id: column.id })}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {index + 1}. {column.label || column.key}
                            </div>
                            <div className="mt-1 truncate text-[13px] text-slate-500">
                              {column.key}
                              {column.table_field ? ` · ${column.table_field}` : ''}
                            </div>
                          </div>
                          {column.computed_type && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                              {column.computed_type}
                            </span>
                          )}
                        </div>
                      </SortableDesignerItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </TabsContent>

          <TabsContent value="groups" className="mt-0 px-3 pb-3">
            <Button type="button" size="sm" onClick={addGroup} className="mb-3 w-full">
              <Plus className="size-4" />
              Thêm nhóm header
            </Button>
            <div className="max-h-[calc(100vh-22rem)] min-h-[420px] overflow-auto pr-1">
              <div className="space-y-2">
                {builder.header_groups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Chưa có nhóm header. Tạo nhóm rồi gán cột vào nhóm ở inspector cột.
                  </div>
                ) : (
                  builder.header_groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelection({ type: 'group', id: group.id })}
                      className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition ${
                        selectionKey(selection) === `group:${group.id}`
                          ? 'border-[#174A86] ring-2 ring-[#174A86]/10'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <div className="text-sm font-semibold text-slate-900">{group.label || group.key}</div>
                      <div className="mt-1 text-[13px] text-slate-500">
                        {group.key}
                        {group.parent_group_id
                          ? ` · con của ${builder.header_groups.find((item) => item.id === group.parent_group_id)?.label}`
                          : ''}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="blocks" className="mt-0 px-3 pb-3">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => addBlock('section')}>
                <Plus className="size-4" />
                Nhóm
              </Button>
              <Button type="button" size="sm" onClick={() => addBlock('rows')}>
                <Plus className="size-4" />
                Dòng
              </Button>
            </div>
            <div className="max-h-[calc(100vh-22rem)] min-h-[420px] overflow-auto pr-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
                <SortableContext
                  items={builder.row_blocks.map((block) => block.id)}
                  strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {builder.row_blocks.map((block, index) => (
                      <SortableDesignerItem
                        key={block.id}
                        id={block.id}
                        selected={selectionKey(selection) === `block:${block.id}`}
                        onSelect={() => setSelection({ type: 'block', id: block.id })}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {index + 1}. {block.label || block.id}
                            </div>
                            <div className="mt-1 text-[13px] text-slate-500">
                              {block.type === 'section' ? 'Section / summary row' : 'Data rows'}
                              {block.rows?.length ? ` · ${block.rows.length} rows` : ''}
                            </div>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {block.type}
                          </span>
                        </div>
                      </SortableDesignerItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Columns3 className="size-4 text-[#174A86]" />
            <div>
              <div className="text-sm font-semibold text-slate-900">Canvas cấu trúc</div>
              <div className="text-[13px] text-slate-500">Click header, cột hoặc block để chỉnh bên phải.</div>
            </div>
          </div>
          <div className="rounded-full bg-blue-50 px-3 py-1 text-[13px] font-semibold text-blue-700">
            Xuất table_template chuẩn
          </div>
        </div>

        <TableDesignerCanvas
          tableTemplate={compiledTemplate}
          builder={builder}
          selection={selection}
          onSelect={setSelection}
          onSelectHeader={selectHeader}
        />
      </div>

      <div className="min-h-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Settings2 className="size-4 text-[#174A86]" />
            Thuộc tính
          </div>
          <div className="mt-1 text-[13px] text-slate-500">
            Đang chọn: {selection.type === 'table' ? 'Toàn bảng' : selection.type}
          </div>
        </div>

        <div className="max-h-[calc(100vh-15rem)] overflow-auto p-4">
          {selection.type === 'table' && (
            <TableInspector
              builder={builder}
              tableTemplate={tableTemplate}
              updateTableOptions={updateTableOptions}
              updateRenderRule={updateTableRenderRule}
            />
          )}
          {selectedColumn && (
            <ColumnInspector
              column={selectedColumn}
              builder={builder}
              tableOptions={tableOptions}
              schemaCatalog={schemaCatalog}
              groupOptions={groupOptions}
              updateColumn={updateColumn}
              deleteColumn={deleteColumn}
            />
          )}
          {selectedGroup && (
            <GroupInspector
              group={selectedGroup}
              builder={builder}
              updateGroup={updateGroup}
              deleteGroup={deleteGroup}
            />
          )}
          {selectedBlock && (
            <BlockInspector
              block={selectedBlock}
              builder={builder}
              tableTemplate={tableTemplate}
              tableOptions={tableOptions}
              updateBlock={updateBlock}
              updateRenderRule={updateTableRenderRule}
              deleteBlock={deleteBlock}
              selectRow={(rowIndex) => setSelection({ type: 'row', block_id: selectedBlock.id, row_index: rowIndex })}
              addRow={() => addDataRow(selectedBlock.id)}
            />
          )}
          {selection.type === 'row' && selectedRowBlock && selectedRow && (
            <RowInspector
              block={selectedRowBlock}
              row={selectedRow as Record<string, unknown>}
              rowIndex={selection.row_index}
              builder={builder}
              tableOptions={tableOptions}
              schemaCatalog={schemaCatalog}
              updateRow={(row) => updateDataRow(selection.block_id, selection.row_index, row)}
              copyRow={() => copyDataRow(selection.block_id, selection.row_index)}
              deleteRow={() => deleteDataRow(selection.block_id, selection.row_index)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface ITableDesignerCanvasProps {
  tableTemplate: TableTemplate;
  builder: ITableBuilderConfig;
  selection: TTableDesignerSelection;
  onSelect: (selection: TTableDesignerSelection) => void;
  onSelectHeader: (header: TableTemplateHeader) => void;
}

const TableDesignerCanvas = ({
  tableTemplate,
  builder,
  selection,
  onSelect,
  onSelectHeader,
}: ITableDesignerCanvasProps) => {
  const headers = useMemo(() => tableTemplate.structure.headers ?? [], [tableTemplate.structure.headers]);
  const leafHeaders = useMemo(() => headers.filter((header) => !header.is_parent_header), [headers]);
  const headerRows = useMemo(() => getHeaderRows(headers), [headers]);
  const groupIdByKey = useMemo(
    () => new Map(builder.header_groups.map((group) => [group.key, group.id])),
    [builder.header_groups],
  );
  const columnIdByKey = useMemo(
    () => new Map(builder.columns.map((column) => [column.key, column.id])),
    [builder.columns],
  );

  const isHeaderSelected = (header: TableTemplateHeader) => {
    if (header.is_parent_header) {
      return selectionKey(selection) === `group:${groupIdByKey.get(header.key)}`;
    }
    return selectionKey(selection) === `column:${columnIdByKey.get(header.key)}`;
  };

  return (
    <div className="max-h-[calc(100vh-15rem)] min-h-[620px] overflow-auto p-4">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          {headerRows.map((headerRow, rowIndex) => (
            <tr key={rowIndex}>
              {headerRow.map((header) => {
                const headerStyle = getConfiguredCanvasStyle(header);
                return (
                  <th
                    key={`${rowIndex}_${header.key}`}
                    colSpan={header.colspan || 1}
                    rowSpan={header.rowspan || 1}
                    onClick={() => onSelectHeader(header)}
                    className={`cursor-pointer border p-3 align-top font-semibold transition ${
                      isHeaderSelected(header)
                        ? 'border-[#174A86] bg-blue-50 text-[#0B2559]'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    }`}
                    style={{
                      width: header.width,
                      ...headerStyle,
                    }}>
                    <div className="relative min-h-5 pr-5">
                      <div className="break-words">{header.label || header.key}</div>
                      {header.is_parent_header ? (
                        <Layers3 className="absolute right-0 top-0 size-3.5 text-slate-400" />
                      ) : header.computed_type ? (
                        <Calculator className="absolute right-0 top-0 size-3.5 text-blue-500" />
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] font-normal text-slate-500">{header.key}</div>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {(tableTemplate.structure.blocks ?? []).map((block) => (
            <TableDesignerBlockPreview
              key={block.id}
              block={block}
              leafHeaders={leafHeaders}
              selected={selectionKey(selection) === `block:${block.id}`}
              selectedRowIndex={
                selection.type === 'row' && selection.block_id === block.id ? selection.row_index : null
              }
              onSelectBlock={() => onSelect({ type: 'block', id: block.id || '' })}
              onSelectRow={(rowIndex) => onSelect({ type: 'row', block_id: block.id || '', row_index: rowIndex })}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TableDesignerBlockPreview = ({
  block,
  leafHeaders,
  selected,
  selectedRowIndex,
  onSelectBlock,
  onSelectRow,
}: {
  block: TableTemplateBlock;
  leafHeaders: TableTemplateHeader[];
  selected: boolean;
  selectedRowIndex: number | null;
  onSelectBlock: () => void;
  onSelectRow: (rowIndex: number) => void;
}) => {
  const rows = useMemo(() => {
    const subsectionRows = block.subsection ? [{ row: block.subsection, isSubsection: true, rowIndex: null }] : [];
    if (block.rows?.length) {
      const dataRows = block.rows.map((row, rowIndex) => ({ row, isSubsection: false, rowIndex }));
      const visibleRows =
        selectedRowIndex !== null && selectedRowIndex >= MAX_BLOCK_PREVIEW_ROWS && dataRows[selectedRowIndex]
          ? [...dataRows.slice(0, MAX_BLOCK_PREVIEW_ROWS - 1), dataRows[selectedRowIndex]]
          : dataRows.slice(0, MAX_BLOCK_PREVIEW_ROWS);

      return [...subsectionRows, ...visibleRows];
    }

    if (block.row_template) {
      return [...subsectionRows, { row: block.row_template, isSubsection: false, rowIndex: null }];
    }

    if (block.subsection) {
      return subsectionRows;
    }

    return [{ row: {}, isSubsection: false, rowIndex: null }];
  }, [block.row_template, block.rows, block.subsection, selectedRowIndex]);
  const omittedRowCount = Math.max(0, (block.rows?.length ?? 0) - rows.filter((row) => !row.isSubsection).length);

  return (
    <>
      {rows.map(({ row, isSubsection, rowIndex: dataRowIndex }, rowIndex) => {
        const cell_merge =
          row && typeof row === 'object' && row.cell_merge && typeof row.cell_merge === 'object'
            ? (row.cell_merge as Record<string, { colspan?: number; rowspan?: number }>)
            : {};
        const skipIndices = new Set<number>();
        leafHeaders.forEach((header, headerIndex) => {
          const config = cell_merge[header.key];
          if (config?.colspan && config.colspan > 1) {
            for (let index = 1; index < config.colspan; index += 1) {
              skipIndices.add(headerIndex + index);
            }
          }
        });

        return (
          <tr
            key={`${block.id}_${isSubsection ? 'subsection' : (dataRowIndex ?? rowIndex)}`}
            onClick={() => (dataRowIndex === null ? onSelectBlock() : onSelectRow(dataRowIndex))}
            className={selected || selectedRowIndex === dataRowIndex ? 'bg-blue-50/70' : ''}>
            {leafHeaders.map((header, headerIndex) => {
              if (skipIndices.has(headerIndex)) return null;
              const rawValue = getCellValue((row as Record<string, unknown>)[header.key]);
              const value = rawValue || (isSubsection ? '' : `{{${header.key}}}`);
              const colspan = cell_merge[header.key]?.colspan || 1;
              const rowspan = cell_merge[header.key]?.rowspan || 1;
              const cell = (row as Record<string, unknown>)[header.key];
              const cellStyle =
                cell && typeof cell === 'object' && !Array.isArray(cell) ? (cell as TableTemplateCellStyle) : undefined;
              const cellSource = getCellSourceConfig(cell);
              const headerSource = parseTableDesignerField(header.table_field);
              const sourceDisplay =
                cellSource.table && cellSource.field
                  ? `${cellSource.table}.${cellSource.field}${
                      cellSource.labelField ? ` + ${cellSource.table}.${cellSource.labelField}` : ''
                    }`
                  : header.table_field && header.label_field && headerSource.table
                    ? `${header.table_field} + ${headerSource.table}.${header.label_field}`
                    : header.table_field;

              return (
                <td
                  key={header.key}
                  colSpan={colspan}
                  rowSpan={rowspan}
                  className={`cursor-pointer border p-3 align-top transition ${
                    selected ? 'border-[#174A86]' : 'border-slate-200 hover:bg-slate-50'
                  } ${isSubsection ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
                  style={{
                    ...getConfiguredCanvasStyle(header, 'cell_'),
                    ...getConfiguredCanvasStyle(cellStyle),
                  }}>
                  <div className="min-h-5 whitespace-pre-wrap break-words">{value}</div>
                  {!isSubsection && sourceDisplay && (
                    <div className="mt-1 text-[11px] text-slate-400">{sourceDisplay}</div>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
      {omittedRowCount > 0 && (
        <tr>
          <td
            colSpan={leafHeaders.length}
            className="border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-500">
            Đang ẩn {omittedRowCount} dòng trong canvas để giữ UI nhanh.
          </td>
        </tr>
      )}
    </>
  );
};

const TableInspector = ({
  builder,
  tableTemplate,
  updateTableOptions,
  updateRenderRule,
}: {
  builder: ITableBuilderConfig;
  tableTemplate: TableTemplate;
  updateTableOptions: (patch: Partial<ITableBuilderConfig['options']>) => void;
  updateRenderRule: (patch: Record<string, unknown>) => void;
}) => {
  const contextSchema = getObjectRecord(tableTemplate.context_schema);
  const renderRule = getObjectRecord(contextSchema?.render_rule);
  const renderRuleType = typeof renderRule?.type === 'string' ? renderRule.type : '';
  const dynamicGroupConfigs = getObjectArray(renderRule?.group_configs ?? renderRule?.groupConfigs);
  const groupOptions = builder.header_groups.map((group) => ({
    value: group.key,
    label: `${group.label || group.key} (${group.key})`,
  }));
  const updateDynamicGroupConfig = (index: number, patch: Record<string, unknown>) => {
    updateRenderRule({
      group_configs: dynamicGroupConfigs.map((config, configIndex) =>
        configIndex === index ? patchObject(config, patch) : config,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Table designer sẽ lưu hai phần: <span className="font-semibold">table_builder</span> để mở lại chỉnh UI và{' '}
        <span className="font-semibold">table_template</span> để document render như hiện tại.
      </div>
      <div className="grid gap-2">
        <PropertyCheckbox
          label="Cho thêm dòng"
          checked={builder.options.show_add_row_button !== false}
          onCheckedChange={(checked) => updateTableOptions({ show_add_row_button: checked })}
        />
        <PropertyCheckbox
          label="Cho copy dòng"
          checked={builder.options.show_copy_button !== false}
          onCheckedChange={(checked) => updateTableOptions({ show_copy_button: checked })}
        />
        <PropertyCheckbox
          label="Cho xoá dòng"
          checked={builder.options.show_delete_button !== false}
          onCheckedChange={(checked) => updateTableOptions({ show_delete_button: checked })}
        />
      </div>

      {renderRuleType === 'dynamic_column_group' && dynamicGroupConfigs.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Columns3 className="size-4 text-[#174A86]" />
            Nhóm cột động
          </div>
          <div className="space-y-3">
            {dynamicGroupConfigs.map((config, index) => (
              <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 text-sm font-semibold text-slate-900">
                  {typeof config.parent_label === 'string' && config.parent_label.trim()
                    ? config.parent_label
                    : `Nhóm ${index + 1}`}
                </div>
                <div className="grid gap-3">
                  <InlineProperty label="Header cha">
                    <SearchableSelect
                      value={typeof config.parent_key === 'string' ? config.parent_key : ''}
                      options={groupOptions}
                      placeholder="Chọn nhóm header"
                      searchPlaceholder="Tìm nhóm..."
                      maxHeight="220px"
                      onValueChange={(value) => {
                        const matchedGroup = builder.header_groups.find((group) => group.key === value);
                        updateDynamicGroupConfig(index, {
                          parent_key: value,
                          parent_label: matchedGroup?.label || config.parent_label,
                        });
                      }}
                    />
                  </InlineProperty>
                  <InlineProperty label="Tên nhóm">
                    <Input
                      value={typeof config.parent_label === 'string' ? config.parent_label : ''}
                      onChange={(event) =>
                        updateDynamicGroupConfig(index, { parent_label: event.target.value.trim() || undefined })
                      }
                      placeholder="Kiến thức"
                    />
                  </InlineProperty>
                  <InlineProperty label="Số mặc định">
                    <Input
                      type="number"
                      min={1}
                      value={String(config.default_count ?? '')}
                      onChange={(event) =>
                        updateDynamicGroupConfig(index, { default_count: toOptionalNumber(event.target.value) })
                      }
                      placeholder="4"
                    />
                  </InlineProperty>
                  <InlineProperty label="Label bắt đầu">
                    <Input
                      type="number"
                      min={1}
                      value={String(config.label_start ?? '')}
                      onChange={(event) =>
                        updateDynamicGroupConfig(index, { label_start: toOptionalNumber(event.target.value) })
                      }
                      placeholder="1"
                    />
                  </InlineProperty>
                  <InlineProperty label="Prefix key cột">
                    <Input
                      value={typeof config.column_prefix === 'string' ? config.column_prefix : ''}
                      onChange={(event) =>
                        updateDynamicGroupConfig(index, { column_prefix: event.target.value.trim() || undefined })
                      }
                      placeholder="plo_k"
                    />
                  </InlineProperty>
                  <InlineProperty label="Độ rộng nhóm">
                    <Input
                      type="number"
                      min={1}
                      value={String(config.group_width ?? '')}
                      onChange={(event) =>
                        updateDynamicGroupConfig(index, { group_width: toOptionalNumber(event.target.value) })
                      }
                      placeholder="33"
                    />
                  </InlineProperty>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[13px] leading-5 text-slate-500">
            Các giá trị này được lưu vào <span className="font-semibold">context_schema.render_rule.group_configs</span>
            . User vẫn có thể nhập lại số PLO khi điền biến, còn số mặc định dùng khi chưa nhập.
          </div>
        </div>
      )}
    </div>
  );
};

const ColumnInspector = ({
  column,
  builder,
  tableOptions,
  schemaCatalog,
  groupOptions,
  updateColumn,
  deleteColumn,
}: {
  column: ITableBuilderColumn;
  builder: ITableBuilderConfig;
  tableOptions: { value: string; label: string }[];
  schemaCatalog: Record<string, string[]>;
  groupOptions: { value: string; label: string }[];
  updateColumn: (columnId: string, patch: Partial<ITableBuilderColumn>) => void;
  deleteColumn: (columnId: string) => void;
}) => {
  const source = parseTableDesignerField(column.table_field);
  const sourceFields = source.table ? (schemaCatalog[source.table] ?? []) : [];
  const fieldOptions = sourceFields.map((field) => ({
    value: field,
    label: `${getVariableAlias(source.table, field)} (${field})`,
  }));
  const labelFieldOptions = sourceFields
    .filter((field) => field !== source.field)
    .map((field) => ({
      value: field,
      label: `${getVariableAlias(source.table, field)} (${field})`,
    }));
  const labelFieldValue =
    column.label_field && sourceFields.includes(column.label_field) && column.label_field !== source.field
      ? column.label_field
      : '';
  const computedOptions = builder.columns
    .filter((candidate) => candidate.id !== column.id)
    .map((candidate) => ({ value: candidate.key, label: `${candidate.label} (${candidate.key})` }));
  const headerStyle = pickHeaderStyle(column.raw_header);
  const bodyStyle = pickHeaderStyle(column.raw_header, 'cell_');
  const updateColumnHeaderStyle = (patch: TStylePatch) => {
    updateColumn(column.id, {
      ...(Object.prototype.hasOwnProperty.call(patch, 'background_color')
        ? { background_color: patch.background_color as string | undefined }
        : {}),
      raw_header: patchObject(column.raw_header ?? {}, getHeaderStylePatch(patch)),
    });
  };
  const updateColumnBodyStyle = (patch: TStylePatch) => {
    updateColumn(column.id, {
      raw_header: patchObject(column.raw_header ?? {}, getHeaderStylePatch(patch, 'cell_')),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Columns3 className="size-4 text-[#174A86]" />
          Cột dữ liệu
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={builder.columns.length <= 1}
          className="text-red-600 hover:bg-red-50"
          onClick={() => deleteColumn(column.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        <InlineProperty label="Tên hiển thị">
          <Input value={column.label} onChange={(event) => updateColumn(column.id, { label: event.target.value })} />
        </InlineProperty>
        <InlineProperty label="Mã cột">
          <Input value={column.key} onChange={(event) => updateColumn(column.id, { key: event.target.value })} />
        </InlineProperty>
        <InlineProperty label="Nhóm header">
          <SearchableSelect
            value={column.header_group_id || ''}
            options={groupOptions}
            placeholder="Không thuộc nhóm"
            searchPlaceholder="Tìm nhóm..."
            clearable
            maxHeight="260px"
            onValueChange={(value) => updateColumn(column.id, { header_group_id: value || null })}
          />
        </InlineProperty>
        <div className="grid grid-cols-2 gap-3">
          <InlineProperty label="Độ rộng">
            <Input
              value={column.width ?? ''}
              placeholder="12% hoặc 140px"
              onChange={(event) => updateColumn(column.id, { width: event.target.value })}
            />
          </InlineProperty>
          <InlineProperty label="Kiểu dữ liệu">
            <Select
              value={column.input_type || 'Data'}
              onValueChange={(value) =>
                updateColumn(column.id, { input_type: value as ITableBuilderColumn['input_type'] })
              }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_DESIGNER_INPUT_TYPES.map((input_type) => (
                  <SelectItem key={input_type} value={input_type}>
                    {input_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InlineProperty>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Database className="size-4 text-[#174A86]" />
            Nguồn dữ liệu
          </div>
          <div className="grid gap-3">
            <InlineProperty label="Bảng nguồn">
              <SearchableSelect
                value={source.table}
                options={tableOptions}
                placeholder="Không lấy dữ liệu"
                searchPlaceholder="Tìm bảng..."
                clearable
                disabled={Boolean(column.computed_type)}
                maxHeight="260px"
                onValueChange={(table) => {
                  const nextField = table
                    ? schemaCatalog[table]?.includes(source.field)
                      ? source.field
                      : (schemaCatalog[table]?.[0] ?? '')
                    : '';
                  const nextLabelField =
                    table &&
                    nextField &&
                    column.label_field &&
                    schemaCatalog[table]?.includes(column.label_field) &&
                    column.label_field !== nextField
                      ? column.label_field
                      : null;
                  updateColumn(column.id, {
                    table_field: buildTableDesignerField(table, nextField),
                    label_field: nextLabelField,
                  });
                }}
              />
            </InlineProperty>
            <InlineProperty label="Field nguồn">
              <SearchableSelect
                value={source.field}
                options={fieldOptions}
                placeholder="Chọn field"
                searchPlaceholder="Tìm field..."
                clearable
                disabled={!source.table || Boolean(column.computed_type)}
                maxHeight="260px"
                onValueChange={(field) => {
                  const nextLabelField =
                    column.label_field && sourceFields.includes(column.label_field) && column.label_field !== field
                      ? column.label_field
                      : null;
                  updateColumn(column.id, {
                    table_field: buildTableDesignerField(source.table, field),
                    label_field: nextLabelField,
                  });
                }}
              />
            </InlineProperty>
            <InlineProperty label="Field hiển thị phụ">
              <SearchableSelect
                value={labelFieldValue}
                options={labelFieldOptions}
                placeholder="Không nối thêm"
                searchPlaceholder="Tìm label field..."
                clearable
                disabled={!source.table || !source.field || Boolean(column.computed_type)}
                maxHeight="260px"
                onValueChange={(field) => updateColumn(column.id, { label_field: field || null })}
              />
            </InlineProperty>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Calculator className="size-4 text-[#174A86]" />
            Tính toán
          </div>
          <div className="grid gap-3">
            <InlineProperty label="Loại tính">
              <Select
                value={column.computed_type || NONE_VALUE}
                onValueChange={(value) =>
                  updateColumn(column.id, {
                    computed_type: value === NONE_VALUE ? null : (value as ITableBuilderColumn['computed_type']),
                    table_field: value === NONE_VALUE ? column.table_field : null,
                    label_field: value === NONE_VALUE ? column.label_field : null,
                    read_only: value === NONE_VALUE ? column.read_only : true,
                  })
                }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Không</SelectItem>
                  <SelectItem value="sum">Sum</SelectItem>
                  <SelectItem value="percent">Percent</SelectItem>
                </SelectContent>
              </Select>
            </InlineProperty>
            <InlineProperty label="Cột nguồn">
              <SearchableMultiSelect
                value={column.computed_from ?? []}
                options={computedOptions}
                disabled={!column.computed_type}
                placeholder="Chọn cột"
                searchPlaceholder="Tìm cột..."
                emptyMessage="Không có cột phù hợp."
                maxDisplay={2}
                maxHeight="240px"
                onValueChange={(values) => updateColumn(column.id, { computed_from: values })}
              />
            </InlineProperty>
          </div>
        </div>

        <div className="grid gap-2">
          <PropertyCheckbox
            label="Bắt buộc"
            checked={Boolean(column.is_required)}
            onCheckedChange={(checked) => updateColumn(column.id, { is_required: checked })}
          />
          <PropertyCheckbox
            label="Read only"
            checked={Boolean(column.read_only || column.computed_type)}
            disabled={Boolean(column.computed_type)}
            onCheckedChange={(checked) => updateColumn(column.id, { read_only: checked })}
          />
        </div>

        <CellStyleControls
          title="Định dạng header"
          description="Override cho ô header của cột này."
          value={headerStyle}
          onPatch={updateColumnHeaderStyle}
        />

        <CellStyleControls
          title="Định dạng ô dữ liệu"
          description="Override mặc định cho tất cả cell thuộc cột này."
          value={bodyStyle}
          onPatch={updateColumnBodyStyle}
        />
      </div>
    </div>
  );
};

const GroupInspector = ({
  group,
  builder,
  updateGroup,
  deleteGroup,
}: {
  group: ITableBuilderHeaderGroup;
  builder: ITableBuilderConfig;
  updateGroup: (groupId: string, patch: Partial<ITableBuilderHeaderGroup>) => void;
  deleteGroup: (groupId: string) => void;
}) => {
  const parentOptions = builder.header_groups
    .filter((candidate) => candidate.id !== group.id && candidate.parent_group_id !== group.id)
    .map((candidate) => ({ value: candidate.id, label: `${candidate.label} (${candidate.key})` }));
  const headerStyle = pickHeaderStyle(group.raw_header);
  const updateGroupHeaderStyle = (patch: TStylePatch) => {
    updateGroup(group.id, {
      ...(Object.prototype.hasOwnProperty.call(patch, 'background_color')
        ? { background_color: patch.background_color as string | undefined }
        : {}),
      raw_header: patchObject(group.raw_header ?? {}, getHeaderStylePatch(patch)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Layers3 className="size-4 text-[#174A86]" />
          Nhóm header
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-red-600 hover:bg-red-50"
          onClick={() => deleteGroup(group.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <InlineProperty label="Tên nhóm">
        <Input value={group.label} onChange={(event) => updateGroup(group.id, { label: event.target.value })} />
      </InlineProperty>
      <InlineProperty label="Mã nhóm">
        <Input value={group.key} onChange={(event) => updateGroup(group.id, { key: event.target.value })} />
      </InlineProperty>
      <InlineProperty label="Nhóm cha">
        <SearchableSelect
          value={group.parent_group_id || ''}
          options={parentOptions}
          placeholder="Nhóm cấp 1"
          searchPlaceholder="Tìm nhóm..."
          clearable
          maxHeight="260px"
          onValueChange={(value) => updateGroup(group.id, { parent_group_id: value || null })}
        />
      </InlineProperty>
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[13px] leading-5 text-blue-700">
        Gán cột vào nhóm trong inspector của từng cột. Nhóm cha/con sẽ compile thành header 2 hoặc 3 dòng bằng `parent`,
        `colspan`, `rowspan`.
      </div>
      <CellStyleControls
        title="Định dạng header nhóm"
        description="Override cho ô header nhóm này."
        value={headerStyle}
        onPatch={updateGroupHeaderStyle}
      />
    </div>
  );
};

const BlockInspector = ({
  block,
  builder,
  tableTemplate,
  tableOptions,
  updateBlock,
  updateRenderRule,
  deleteBlock,
  selectRow,
  addRow,
}: {
  block: ITableBuilderRowBlock;
  builder: ITableBuilderConfig;
  tableTemplate: TableTemplate;
  tableOptions: { value: string; label: string }[];
  updateBlock: (blockId: string, patch: Partial<ITableBuilderRowBlock>) => void;
  updateRenderRule: (patch: Record<string, unknown>) => void;
  deleteBlock: (blockId: string) => void;
  selectRow: (rowIndex: number) => void;
  addRow: () => void;
}) => {
  const fetch_config = block.row_fetch_config ?? createFetchConfigFromColumns(builder.columns);
  const triggerField = typeof fetch_config.trigger_field === 'string' ? fetch_config.trigger_field : '';
  const primaryTable = typeof fetch_config.primary_table === 'string' ? fetch_config.primary_table : '';
  const subsection_values = block.subsection_values ?? {};
  const contextSchema = getObjectRecord(tableTemplate.context_schema);
  const renderRule = getObjectRecord(contextSchema?.render_rule);
  const renderRuleType = typeof renderRule?.type === 'string' ? renderRule.type : '';
  const blockConfigs = Array.isArray(renderRule?.block_configs) ? renderRule.block_configs : [];
  const renderRuleBlockConfig = getObjectRecord(
    blockConfigs.find((config) => getObjectRecord(config)?.id === block.id),
  );
  const isConfiguredLabelBlock =
    renderRuleType === 'configured_blocks' &&
    Boolean(renderRuleBlockConfig && ['summary', 'title'].includes(String(renderRuleBlockConfig.kind)));
  const configuredManualFields = getStringArray(
    renderRuleBlockConfig?.manual_fields ??
      renderRuleBlockConfig?.manualFields ??
      renderRuleBlockConfig?.editable_fields ??
      renderRule?.summary_manual_fields,
  );
  const manualFields = [...new Set([...(block.manual_fields ?? []), ...configuredManualFields])];
  const columnOptions = builder.columns.map((column) => ({
    value: column.key,
    label: `${column.label || column.key} (${column.key})`,
  }));
  const subsectionStyleColumnKey = block.merge_column_key || builder.columns[0]?.key || '';
  const subsectionStyleColumn = builder.columns.find((column) => column.key === subsectionStyleColumnKey);
  const subsectionStyleCell = getObjectRecord(subsection_values[subsectionStyleColumnKey]);
  const updateBlockSubsectionStyle = (patch: TStylePatch) => {
    if (!subsectionStyleColumnKey) return;
    updateBlock(block.id, {
      subsection_values: {
        ...subsection_values,
        [subsectionStyleColumnKey]: patchCellStyle(
          subsection_values[subsectionStyleColumnKey],
          patch,
          subsectionStyleColumn,
        ),
      },
    });
  };
  const getRowLabel = (row: Record<string, unknown>, rowIndex: number) => {
    const label = builder.columns
      .map((column) => getCellValue(row[column.key]))
      .filter(Boolean)
      .slice(0, 2)
      .join(' · ');
    return label || `Dòng ${rowIndex + 1}`;
  };

  const updateFetchConfig = (patch: Record<string, unknown>) => {
    updateBlock(block.id, {
      row_fetch_config: {
        ...fetch_config,
        ...patch,
      },
    });
  };
  const updateRenderRuleBlockConfig = (patch: Record<string, unknown>) => {
    updateRenderRule({
      block_configs: blockConfigs.map((config) => {
        const blockConfig = getObjectRecord(config);
        if (!blockConfig || blockConfig.id !== block.id) return config;
        return {
          ...blockConfig,
          ...patch,
        };
      }),
    });
  };
  const updateManualFields = (nextManualFields: string[]) => {
    updateBlock(block.id, { manual_fields: nextManualFields });
    if (renderRuleBlockConfig) {
      updateRenderRuleBlockConfig({ manual_fields: nextManualFields });
    }
  };
  const updateBlockLabel = (label: string) => {
    const mergeColumnKey = block.merge_column_key || builder.columns[0]?.key || '';
    const mergeColumn = builder.columns.find((column) => column.key === mergeColumnKey);
    const nextBlockPatch: Partial<ITableBuilderRowBlock> = {
      label,
      ...(mergeColumnKey
        ? {
            subsection_values: {
              ...subsection_values,
              [mergeColumnKey]: setCellValue(subsection_values[mergeColumnKey], label, mergeColumn),
            },
          }
        : {}),
    };

    if (isConfiguredLabelBlock) {
      updateRenderRuleBlockConfig({ label });
      updateBlock(block.id, nextBlockPatch);
      return;
    }
    updateBlock(block.id, nextBlockPatch);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Rows3 className="size-4 text-[#174A86]" />
          Block dòng
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-red-600 hover:bg-red-50"
          onClick={() => deleteBlock(block.id)}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <InlineProperty label="Loại block">
        <Select
          value={block.type}
          onValueChange={(value) => updateBlock(block.id, { type: value as ITableBuilderRowBlock['type'] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="section">Section / summary row</SelectItem>
            <SelectItem value="rows">Data rows</SelectItem>
          </SelectContent>
        </Select>
      </InlineProperty>

      <InlineProperty label="Tên hiển thị">
        <Input value={block.label} onChange={(event) => updateBlockLabel(event.target.value)} />
      </InlineProperty>

      <InlineProperty label="Cột nhập tay trong block này">
        <SearchableMultiSelect
          options={columnOptions}
          value={manualFields}
          placeholder="Chọn cột được nhập tay"
          searchPlaceholder="Tìm cột..."
          emptyMessage="Chưa có cột trong bảng"
          maxHeight="220px"
          maxDisplay={5}
          onValueChange={updateManualFields}
        />
      </InlineProperty>

      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Dòng mẫu trong block</div>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-4" />
            Thêm dòng
          </Button>
        </div>
        <div className="grid gap-2">
          {block.rows?.length ? (
            block.rows.map((row, rowIndex) => (
              <button
                key={(row as Record<string, unknown>).id?.toString() || rowIndex}
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-[#174A86] hover:bg-blue-50"
                onClick={() => selectRow(rowIndex)}>
                {rowIndex + 1}. {getRowLabel(row as Record<string, unknown>, rowIndex)}
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
              Chưa có dòng mẫu. Bấm thêm dòng để tạo row trong JSON.
            </div>
          )}
        </div>
      </div>

      {block.type === 'section' ? (
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3">
          <InlineProperty label="Ô đặt text">
            <SearchableSelect
              value={block.merge_column_key || ''}
              options={builder.columns.map((column) => ({
                value: column.key,
                label: `${column.label} (${column.key})`,
              }))}
              placeholder="Chọn cột"
              searchPlaceholder="Tìm cột..."
              maxHeight="260px"
              onValueChange={(value) => updateBlock(block.id, { merge_column_key: value || null })}
            />
          </InlineProperty>
          <InlineProperty label="Gộp bao nhiêu cột">
            <Input
              type="number"
              min={1}
              max={builder.columns.length}
              value={block.merge_colspan ?? builder.columns.length}
              onChange={(event) =>
                updateBlock(block.id, {
                  merge_colspan: Number(event.target.value) || 1,
                })
              }
            />
          </InlineProperty>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 text-sm font-semibold text-slate-900">Giá trị từng ô summary</div>
            <div className="grid gap-3">
              {builder.columns.map((column) => {
                const isMainLabelColumn = column.key === block.merge_column_key;
                return (
                  <InlineProperty key={column.id} label={`${column.label || column.key} (${column.key})`}>
                    <Input
                      value={isMainLabelColumn ? block.label : getCellValue(subsection_values[column.key])}
                      disabled={isMainLabelColumn}
                      placeholder={isMainLabelColumn ? 'Dùng Tên hiển thị của block' : 'Để trống nếu không hiển thị'}
                      onChange={(event) =>
                        updateBlock(block.id, {
                          subsection_values: {
                            ...subsection_values,
                            [column.key]: setCellValue(subsection_values[column.key], event.target.value, column),
                          },
                        })
                      }
                    />
                  </InlineProperty>
                );
              })}
            </div>
            <div className="mt-3 text-[13px] leading-5 text-slate-500">
              Các giá trị này là số/text mặc định của dòng section hoặc dòng tổng. Tự cộng theo block con cần rule
              riêng, không dùng chung với Sum theo từng dòng dữ liệu.
            </div>
          </div>

          <CellStyleControls
            title="Định dạng dòng section"
            description="Override cho ô chính của dòng section/summary này."
            value={subsectionStyleCell}
            onPatch={updateBlockSubsectionStyle}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2">
            <PropertyCheckbox
              label="Cho thêm dòng"
              checked={block.allow_add_row !== false}
              onCheckedChange={(checked) => updateBlock(block.id, { allow_add_row: checked })}
            />
            <PropertyCheckbox
              label="Cho copy dòng"
              checked={block.allow_copy_row !== false}
              onCheckedChange={(checked) => updateBlock(block.id, { allow_copy_row: checked })}
            />
            <PropertyCheckbox
              label="Cho xoá dòng"
              checked={block.allow_delete_row !== false}
              onCheckedChange={(checked) => updateBlock(block.id, { allow_delete_row: checked })}
            />
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Database className="size-4 text-[#174A86]" />
                Load dòng từ nguồn
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateBlock(block.id, {
                    row_fetch_config: block.row_fetch_config ? null : createFetchConfigFromColumns(builder.columns),
                  })
                }>
                {block.row_fetch_config ? 'Tắt' : 'Bật'}
              </Button>
            </div>

            {block.row_fetch_config && (
              <div className="grid gap-3">
                <InlineProperty label="Cột trigger">
                  <SearchableSelect
                    value={triggerField}
                    options={builder.columns.map((column) => ({
                      value: column.key,
                      label: `${column.label} (${column.key})`,
                    }))}
                    placeholder="Chọn cột"
                    searchPlaceholder="Tìm cột..."
                    clearable
                    maxHeight="260px"
                    onValueChange={(value) => updateFetchConfig({ trigger_field: value })}
                  />
                </InlineProperty>
                <InlineProperty label="Bảng chính">
                  <SearchableSelect
                    value={primaryTable}
                    options={tableOptions}
                    placeholder="Chọn bảng"
                    searchPlaceholder="Tìm bảng..."
                    clearable
                    maxHeight="260px"
                    onValueChange={(value) => updateFetchConfig({ primary_table: value, join_table: value })}
                  />
                </InlineProperty>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const syncedFetchConfig = createFetchConfigFromColumns(builder.columns, triggerField, primaryTable);
                    updateBlock(block.id, {
                      row_fetch_config: {
                        ...fetch_config,
                        trigger_field: triggerField || syncedFetchConfig.trigger_field,
                        primary_table: primaryTable || syncedFetchConfig.primary_table,
                        join_table: primaryTable || syncedFetchConfig.join_table,
                        fields_to_fetch: syncedFetchConfig.fields_to_fetch,
                      },
                    });
                  }}>
                  <Wand2 className="size-4" />
                  Đồng bộ fields_to_fetch từ cột nguồn
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const RowInspector = ({
  block,
  row,
  rowIndex,
  builder,
  tableOptions,
  schemaCatalog,
  updateRow,
  copyRow,
  deleteRow,
}: {
  block: ITableBuilderRowBlock;
  row: Record<string, unknown>;
  rowIndex: number;
  builder: ITableBuilderConfig;
  tableOptions: { value: string; label: string }[];
  schemaCatalog: Record<string, string[]>;
  updateRow: (row: Record<string, unknown>) => void;
  copyRow: () => void;
  deleteRow: () => void;
}) => {
  const rowButtonConfig = getObjectRecord(row.row_button_config) ?? {};
  const showCopyButton =
    typeof rowButtonConfig.show_copy_button === 'boolean'
      ? rowButtonConfig.show_copy_button
      : block.allow_copy_row !== false;
  const showDeleteButton =
    typeof rowButtonConfig.show_delete_button === 'boolean'
      ? rowButtonConfig.show_delete_button
      : block.allow_delete_row !== false;

  const updateCell = (column: ITableBuilderColumn, value: string) => {
    updateRow({
      ...row,
      [column.key]: setCellValue(row[column.key], value, column),
    });
  };
  const updateCellFormat = (column: ITableBuilderColumn, patch: TStylePatch) => {
    updateRow({
      ...row,
      [column.key]: patchCellStyle(row[column.key], patch, column),
    });
  };
  const updateCellSource = (
    column: ITableBuilderColumn,
    patch: {
      table?: string;
      field?: string;
      labelField?: string;
      resolveFromContext?: boolean;
      syncRecordTrigger?: boolean;
    },
  ) => {
    updateRow({
      ...row,
      [column.key]: setCellSourceConfig(row[column.key], patch, column),
    });
  };
  const updateRowButtonConfig = (key: 'show_copy_button' | 'show_delete_button', value: boolean) => {
    updateRow({
      ...row,
      row_button_config: {
        ...rowButtonConfig,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Rows3 className="size-4 text-[#174A86]" />
          Dòng dữ liệu {rowIndex + 1}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyRow}>
            Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            onClick={deleteRow}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-5 text-slate-600">
        Đang sửa row trong block <span className="font-semibold">{block.label || block.id}</span>. Mỗi ô dưới đây sẽ ghi
        thẳng vào `rows[{rowIndex}]` của JSON.
      </div>

      <div className="grid gap-2">
        <PropertyCheckbox
          label="Cho copy dòng này"
          checked={showCopyButton}
          onCheckedChange={(checked) => updateRowButtonConfig('show_copy_button', checked)}
        />
        <PropertyCheckbox
          label="Cho xoá dòng này"
          checked={showDeleteButton}
          onCheckedChange={(checked) => updateRowButtonConfig('show_delete_button', checked)}
        />
      </div>

      <div className="grid gap-3">
        {builder.columns.map((column) => {
          const cell = row[column.key];
          const source = getCellSourceConfig(cell, column);
          const sourceFields = source.table ? (schemaCatalog[source.table] ?? []) : [];
          const fieldOptions = sourceFields.map((field) => ({
            value: field,
            label: `${getVariableAlias(source.table, field)} (${field})`,
          }));
          const labelFieldOptions = sourceFields
            .filter((field) => field !== source.field)
            .map((field) => ({
              value: field,
              label: `${getVariableAlias(source.table, field)} (${field})`,
            }));

          return (
            <div key={column.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <InlineProperty label={`${column.label || column.key} (${column.key})`}>
                <Input
                  value={getCellValue(cell)}
                  disabled={source.resolveFromContext}
                  onChange={(event) => updateCell(column, event.target.value)}
                />
              </InlineProperty>

              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                  <Database className="size-3.5 text-[#174A86]" />
                  Nguồn DB cho ô này
                </div>
                <div className="grid gap-2">
                  <InlineProperty label="Bảng nguồn">
                    <SearchableSelect
                      value={source.table}
                      options={tableOptions}
                      placeholder="Không lấy dữ liệu"
                      searchPlaceholder="Tìm bảng..."
                      clearable
                      maxHeight="240px"
                      onValueChange={(table) => {
                        const nextField =
                          table && schemaCatalog[table]?.includes(source.field)
                            ? source.field
                            : table
                              ? (schemaCatalog[table]?.[0] ?? '')
                              : '';
                        const nextLabelField =
                          table && source.labelField && schemaCatalog[table]?.includes(source.labelField)
                            ? source.labelField
                            : '';
                        updateCellSource(column, {
                          table,
                          field: nextField,
                          labelField: nextLabelField,
                          resolveFromContext: table && nextField ? source.resolveFromContext : false,
                          syncRecordTrigger: table && nextField ? source.syncRecordTrigger : false,
                        });
                      }}
                    />
                  </InlineProperty>
                  <InlineProperty label="Field nguồn">
                    <SearchableSelect
                      value={source.field}
                      options={fieldOptions}
                      placeholder="Chọn field"
                      searchPlaceholder="Tìm field..."
                      clearable
                      disabled={!source.table}
                      maxHeight="240px"
                      onValueChange={(field) => {
                        const nextLabelField =
                          source.labelField && sourceFields.includes(source.labelField) && source.labelField !== field
                            ? source.labelField
                            : '';
                        updateCellSource(column, {
                          field,
                          labelField: nextLabelField,
                          resolveFromContext: source.table && field ? source.resolveFromContext : false,
                          syncRecordTrigger: source.table && field ? source.syncRecordTrigger : false,
                        });
                      }}
                    />
                  </InlineProperty>
                  <InlineProperty label="Field hiển thị phụ">
                    <SearchableSelect
                      value={source.labelField && source.labelField !== source.field ? source.labelField : ''}
                      options={labelFieldOptions}
                      placeholder="Không nối thêm"
                      searchPlaceholder="Tìm label field..."
                      clearable
                      disabled={!source.table || !source.field}
                      maxHeight="240px"
                      onValueChange={(field) => updateCellSource(column, { labelField: field || '' })}
                    />
                  </InlineProperty>
                  <PropertyCheckbox
                    label="Lấy giá trị từ DB/context khi render"
                    checked={source.resolveFromContext}
                    disabled={!source.table || !source.field}
                    onCheckedChange={(checked) => updateCellSource(column, { resolveFromContext: checked })}
                  />
                  <PropertyCheckbox
                    label="Trigger đồng bộ record"
                    checked={source.syncRecordTrigger}
                    disabled={!source.table || !source.field}
                    onCheckedChange={(checked) =>
                      updateCellSource(column, {
                        syncRecordTrigger: checked,
                        resolveFromContext: checked ? true : source.resolveFromContext,
                      })
                    }
                  />
                  {source.syncRecordTrigger && (
                    <p className="rounded-md bg-blue-50 px-2 py-1.5 text-[13px] leading-5 text-blue-700">
                      Khi chọn record ở ô này, các ô khác cùng bảng nguồn và bật DB/context sẽ tự lấy field tương ứng.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <CellStyleControls
                  title="Định dạng ô"
                  description="Override riêng cho ô này, ưu tiên cao hơn style của cột."
                  value={getObjectRecord(cell)}
                  includeFontFamily={false}
                  onPatch={(patch) => updateCellFormat(column, patch)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
