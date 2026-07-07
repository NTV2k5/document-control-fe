'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2 } from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getTemplateAutoFillAPI,
  getTemplateRecordByFieldValueAPI,
  getTemplateTableOptionsAPI,
  getTemplateTableSchemaFieldsAPI,
} from 'api';
import '../../../styles/TableStructureEditor.css';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'reactjs-platform/ui';
import {
  mapRequiredTypeDisplayValue,
  type TableTemplate,
  type TableTemplateBlock,
  type TableTemplateHeader,
  type TableTemplateRow,
  type TableTemplateSubsection,
} from '../../../lib';
import { useTranslation } from '../../../i18n';

export interface ITableStructureEditorProps {
  tableTemplate: TableTemplate;
  onTableTemplateChange: (template: TableTemplate) => void;
  // Optional callbacks for external actions (approval flow, delete etc.)
  onSubmitForApproval?: (payload: { blockId: string; rowId?: string; rowIdx?: number }) => void;
  onApprove?: (payload: { id: string }) => void;
  onReject?: (payload: { id: string }) => void;
  onCancelApproval?: (payload: { id: string }) => void;
  onDeleteItem?: (payload: { id: string }) => void;
  inlineEditMode?: boolean;
  hideLabelFieldSelector?: boolean;
}

export interface IActiveCell {
  blockId: string;
  rowIdx: number;
  colIdx: number;
  header: TableTemplateHeader;
  row: TableTemplateSubsection | TableTemplateRow;
  isSubsection: boolean;
}

export interface ICellPropertiesState {
  label?: string;
  key?: string;
  value?: string | number;
  source_record_id?: string;
  label_field?: string;
  resolve_from_context?: boolean;
  is_required?: boolean;
  read_only?: boolean;
  width?: string;
  editable?: boolean;
}

const INLINE_CELL_COMMIT_DELAY_MS = 300;

type TTableBehaviorComputedType = 'sum' | 'percent';

type TTableBehaviorComputedField = {
  targetField: string;
  sourceFields: string[];
  computedType: TTableBehaviorComputedType;
};

type TTableStructureBehavior = {
  manualFields: Set<string>;
  editableReadOnlyFields: Set<string>;
  computedFields: TTableBehaviorComputedField[];
};
type DropdownOption = {
  id: string;
  value: string;
  label: string;
  record?: Record<string, unknown>;
};

type TTableSectionGroup = {
  id: string;
  blocks: TableTemplateBlock[];
};

interface ISortableSectionGroupProps {
  id: string;
  disabled: boolean;
  dragTitle: string;
  children: (dragHandle: ReactNode) => ReactNode;
}

interface ISortableDataRowProps {
  id: string;
  disabled: boolean;
  dragTitle: string;
  children: (dragHandle: ReactNode) => ReactNode;
}

const getTableBlockSectionId = (block: TableTemplateBlock, index: number) =>
  `section-${typeof block.id === 'string' && block.id ? block.id : index}`;

const getTableRowSortableId = (block: TableTemplateBlock, row: TableTemplateRow, rowIdx: number) => {
  const blockId = typeof block.id === 'string' && block.id ? block.id : 'block';
  const rowId = typeof row.id === 'string' && row.id ? row.id : rowIdx;
  return `row-${blockId}-${rowId}`;
};

const createTableSectionGroups = (blocks: TableTemplateBlock[]): TTableSectionGroup[] => {
  const groups: TTableSectionGroup[] = [];

  blocks.forEach((block, index) => {
    const hasSubsection = Boolean(block.subsection);
    const latestGroup = groups[groups.length - 1];
    const latestGroupHasSubsection = latestGroup?.blocks.some((groupBlock) => Boolean(groupBlock.subsection));
    const shouldStartGroup = !latestGroup || hasSubsection || !latestGroupHasSubsection;

    if (shouldStartGroup) {
      groups.push({
        id: getTableBlockSectionId(block, index),
        blocks: [block],
      });
      return;
    }

    latestGroup.blocks.push(block);
  });

  return groups;
};

const flattenTableSectionGroups = (groups: TTableSectionGroup[]) => groups.flatMap((group) => group.blocks);

const copyTableTemplateBlock = (block: TableTemplateBlock, uniqueId: string): TableTemplateBlock => ({
  ...block,
  id: `${block.id}${uniqueId}`,
  subsection: block.subsection ? { ...block.subsection, type: 'subsection' } : null,
  row_template: block.row_template ? { ...block.row_template } : null,
  rows: block.rows
    ? block.rows.map((row: TableTemplateRow, rowIdx) => ({
        ...row,
        id: row.id ? `${row.id}${uniqueId}` : `row_${block.id}${uniqueId}_${rowIdx + 1}`,
      }))
    : [],
});

const canAddRowsToBlock = (block: TableTemplateBlock) =>
  Boolean(block.row_template && Object.keys(block.row_template).length > 0) ||
  Boolean(block.row_fetch_config) ||
  (Array.isArray(block.rows) && block.rows.length > 0);

const SortableSectionGroup = ({ id, disabled, dragTitle, children }: ISortableSectionGroupProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const dragHandle = disabled ? null : (
    <button
      type="button"
      className="row-action-btn section-drag-handle"
      aria-label={dragTitle}
      title={dragTitle}
      onClick={(event) => event.stopPropagation()}
      {...attributes}
      {...listeners}>
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className={`section-sortable-group ${isDragging ? 'is-dragging' : ''}`}>
      {children(dragHandle)}
    </div>
  );
};

const SortableDataRow = ({ id, disabled, dragTitle, children }: ISortableDataRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const dragHandle = disabled ? null : (
    <button
      type="button"
      className="row-action-btn row-drag-handle"
      aria-label={dragTitle}
      title={dragTitle}
      onClick={(event) => event.stopPropagation()}
      {...attributes}
      {...listeners}>
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className={`row-sortable-item ${isDragging ? 'is-dragging' : ''}`}>
      {children(dragHandle)}
    </div>
  );
};

function formatDropdownOptionLabel(fieldName: string, item: DropdownOption, labelField?: string) {
  if (!labelField) return item.label;

  const recordValue = item.record?.[fieldName];
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

function dedupeDropdownOptions(items: DropdownOption[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.id || item.value;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const getStringConfigValue = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const normalizeStringListConfig = (...values: unknown[]) => {
  const result: string[] = [];
  values.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string' && item.trim()) {
          result.push(item.trim());
        }
      });
      return;
    }

    if (typeof value === 'string' && value.trim()) {
      result.push(value.trim());
    }
  });

  return [...new Set(result)];
};

const getRowFetchTriggerFields = (config?: Record<string, unknown> | null) =>
  new Set(normalizeStringListConfig(config?.trigger_fields, config?.trigger_field));

const normalizeBehaviorComputedField = (value: unknown): TTableBehaviorComputedField | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const config = value as Record<string, unknown>;
  const targetField = getStringConfigValue(config.target_field, config.targetField, config.key);
  const sourceFields = normalizeStringListConfig(config.source_fields, config.computed_from);
  const rawType = getStringConfigValue(config.type, config.computed_type, config.computedType);
  const computedType: TTableBehaviorComputedType = rawType === 'percent' ? 'percent' : 'sum';

  if (!targetField || sourceFields.length === 0) return null;

  return {
    targetField,
    sourceFields,
    computedType,
  };
};

const getTableStructureBehavior = (tableTemplate: TableTemplate): TTableStructureBehavior => {
  const structureBehavior =
    tableTemplate.structure?.behavior && typeof tableTemplate.structure.behavior === 'object'
      ? (tableTemplate.structure.behavior as Record<string, unknown>)
      : {};
  const templateBehavior =
    tableTemplate.behavior && typeof tableTemplate.behavior === 'object'
      ? (tableTemplate.behavior as Record<string, unknown>)
      : {};
  const behavior = { ...templateBehavior, ...structureBehavior };
  const manualFields = normalizeStringListConfig(behavior.manual_fields, behavior.manualFields);
  const editableReadOnlyFields = normalizeStringListConfig(
    behavior.editable_read_only_fields,
    behavior.editableReadOnlyFields,
    behavior.editable_readonly_fields,
  );
  const computedFields = Array.isArray(behavior.computed_fields)
    ? behavior.computed_fields.map(normalizeBehaviorComputedField).filter(Boolean)
    : Array.isArray(behavior.computedFields)
      ? behavior.computedFields.map(normalizeBehaviorComputedField).filter(Boolean)
      : [];

  return {
    manualFields: new Set(manualFields),
    editableReadOnlyFields: new Set(editableReadOnlyFields),
    computedFields: computedFields as TTableBehaviorComputedField[],
  };
};

const hasBehaviorField = (fields: Set<string>, headerKey?: string | null) =>
  typeof headerKey === 'string' && fields.has(headerKey);

const getConfiguredBlockIds = (tableTemplate: TableTemplate) => {
  const contextSchema = getCellObjectConfig(tableTemplate.context_schema ?? tableTemplate.contextSchema);
  const renderRule = getCellObjectConfig(contextSchema?.render_rule ?? contextSchema?.renderRule);
  const blockConfigs = Array.isArray(renderRule?.block_configs)
    ? renderRule.block_configs
    : Array.isArray(renderRule?.blockConfigs)
      ? renderRule.blockConfigs
      : [];

  return new Set(
    blockConfigs
      .map((config) => (config && typeof config === 'object' ? (config as Record<string, unknown>).id : null))
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
};

const getStructureBehaviorRecord = (tableTemplate: TableTemplate) =>
  tableTemplate.structure?.behavior && typeof tableTemplate.structure.behavior === 'object'
    ? (tableTemplate.structure.behavior as Record<string, unknown>)
    : {};

const getRecordFieldValue = (record: Record<string, unknown> | undefined, fieldName: string | undefined) => {
  if (!record || !fieldName) return undefined;
  if (fieldName === '_id') return record._id ?? record.id;
  return record[fieldName];
};

const getRecordFieldString = (record: Record<string, unknown> | undefined, fieldName: string | undefined) => {
  const value = getRecordFieldValue(record, fieldName);
  return value === undefined || value === null ? '' : String(value);
};

const getCellObjectConfig = (cellData: unknown) =>
  cellData && typeof cellData === 'object' && !Array.isArray(cellData) ? (cellData as Record<string, unknown>) : null;

const getCellStringConfig = (cellData: unknown, key: string) => {
  const value = getCellObjectConfig(cellData)?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const parseTableFieldConfig = (tableField: unknown) => {
  const value = getStringConfigValue(tableField);
  if (!value) return null;

  const separatorIndex = value.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null;

  return {
    table: value.slice(0, separatorIndex),
    field: value.slice(separatorIndex + 1),
  };
};

const isContextResolvedCellData = (cellData: unknown) => {
  const cellConfig = getCellObjectConfig(cellData);
  return Boolean(
    cellConfig?.resolve_from_context ||
    cellConfig?.resolveFromContext ||
    cellConfig?.context_source ||
    cellConfig?.contextSource,
  );
};

const isRecordSyncTriggerCellData = (cellData: unknown) => {
  const cellConfig = getCellObjectConfig(cellData);
  return Boolean(cellConfig?.sync_record_trigger || cellConfig?.syncRecordTrigger);
};

const hasMeaningfulCellValue = (value: unknown) => {
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
};

const getBlockCellStringConfig = (
  block: TableTemplateBlock | undefined,
  headerKey: string | undefined,
  configKey: string,
) => {
  if (!block || !headerKey) return undefined;

  const rowTemplateValue = getCellStringConfig(block.row_template?.[headerKey], configKey);
  if (rowTemplateValue) return rowTemplateValue;

  const rowValue = (block.rows || []).map((row) => getCellStringConfig(row?.[headerKey], configKey)).find(Boolean);
  if (rowValue) return rowValue;

  return getCellStringConfig(block.subsection?.[headerKey], configKey);
};

const inlineCellInputStyle = {
  width: '100%',
  height: '100%',
  minHeight: '42px',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 'inherit',
  lineHeight: '1.4',
  padding: '4px 6px',
  boxSizing: 'border-box',
  resize: 'vertical',
  whiteSpace: 'pre-wrap',
} as const;

const DEFAULT_COLUMN_WIDTH_PX = 120;
const TABLE_PERCENT_WIDTH_UNIT_PX = 12;

function getColumnStyle(header?: TableTemplateHeader) {
  const width = typeof header?.width === 'string' ? header.width.trim() : '';
  if (!width) {
    return {
      width: `${DEFAULT_COLUMN_WIDTH_PX}px`,
      minWidth: `${DEFAULT_COLUMN_WIDTH_PX}px`,
    };
  }

  if (/^\d+(\.\d+)?%$/.test(width)) {
    const pxWidth = Math.max(96, Math.round(Number.parseFloat(width) * TABLE_PERCENT_WIDTH_UNIT_PX));
    return {
      width: `${pxWidth}px`,
      minWidth: `${pxWidth}px`,
    };
  }

  return {
    width,
    minWidth: width,
  };
}

function getHeaderDepth(headers: TableTemplateHeader[]) {
  const hasChildHeaders = headers.some((header) => header.parent);
  const hasGrandchildHeaders = headers.some(
    (header) => header.parent && headers.find((parent) => parent.key === header.parent)?.parent,
  );
  return hasGrandchildHeaders ? 3 : hasChildHeaders ? 2 : 1;
}

function getHeaderVisualDepth(header: TableTemplateHeader, headers: TableTemplateHeader[]) {
  if (!header.parent) return 0;
  const parentHeader = headers.find((candidate) => candidate.key === header.parent);
  return parentHeader && !parentHeader.parent ? 1 : 2;
}

function getLeafHeaderDescendants(header: TableTemplateHeader, headers: TableTemplateHeader[]): TableTemplateHeader[] {
  const children = headers.filter((candidate) => candidate.parent === header.key);
  if (!children.length) return header.is_parent_header ? [] : [header];

  return children.flatMap((child) => {
    if (child.is_parent_header) return getLeafHeaderDescendants(child, headers);
    return [child];
  });
}

function getHeaderGridCells(headers: TableTemplateHeader[]) {
  const leafHeaders = headers.filter((header) => !header.is_parent_header);
  const leafIndexByKey = new Map(leafHeaders.map((header, index) => [header.key, index]));
  const headerDepth = getHeaderDepth(headers);

  return headers
    .map((header, order) => {
      const visualDepth = getHeaderVisualDepth(header, headers);
      const childHeaders = headers.filter((candidate) => candidate.parent === header.key);
      const descendantLeafHeaders = header.is_parent_header ? getLeafHeaderDescendants(header, headers) : [header];
      const firstLeafIndex = descendantLeafHeaders.reduce<number | null>((currentIndex, leafHeader) => {
        const leafIndex = leafIndexByKey.get(leafHeader.key);
        if (leafIndex == null) return currentIndex;
        return currentIndex == null ? leafIndex : Math.min(currentIndex, leafIndex);
      }, null);
      const colStart = (firstLeafIndex ?? leafIndexByKey.get(header.key) ?? order) + 1;
      const colSpan =
        header.is_parent_header && descendantLeafHeaders.length > 0
          ? descendantLeafHeaders.length
          : Math.max(1, Number(header.colspan) || 1);
      const defaultRowSpan = childHeaders.length > 0 ? 1 : Math.max(1, headerDepth - visualDepth);
      const rowSpan = childHeaders.length > 0 ? 1 : Math.max(1, Number(header.rowspan) || defaultRowSpan);

      return {
        header,
        order,
        rowStart: visualDepth + 1,
        colStart,
        colSpan,
        rowSpan,
      };
    })
    .sort((a, b) => a.rowStart - b.rowStart || a.colStart - b.colStart || a.order - b.order);
}

function getCellMergeColspan(row: TableTemplateSubsection | TableTemplateRow, headerKey: string) {
  const cell_merge =
    row && typeof row === 'object' && row.cell_merge && typeof row.cell_merge === 'object' ? row.cell_merge : null;
  const mergeConfig = cell_merge ? cell_merge[headerKey] : null;
  const rawColspan =
    mergeConfig && typeof mergeConfig === 'object' && 'colspan' in mergeConfig ? Number(mergeConfig.colspan) : 1;
  return Number.isFinite(rawColspan) ? Math.max(1, Math.floor(rawColspan)) : 1;
}

interface IInlineTableCellInputProps {
  value: string;
  headerKey: string;
  onCommit: (value: string) => void;
}

const InlineTableCellInput = memo(function InlineTableCellInput({
  value,
  headerKey,
  onCommit,
}: IInlineTableCellInputProps) {
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);
  const lastCommittedValueRef = useRef(value);
  const commitTimerRef = useRef<number | null>(null);
  const isFocusedRef = useRef(false);
  const onCommitRef = useRef(onCommit);

  onCommitRef.current = onCommit;

  const clearCommitTimer = useCallback(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  const commitValue = useCallback(
    (nextValue = draftValueRef.current) => {
      clearCommitTimer();
      if (lastCommittedValueRef.current === nextValue) return;
      lastCommittedValueRef.current = nextValue;
      onCommitRef.current(nextValue);
    },
    [clearCommitTimer],
  );

  useEffect(() => {
    lastCommittedValueRef.current = value;
    if (!isFocusedRef.current) {
      draftValueRef.current = value;
      setDraftValue(value);
    }
  }, [value]);

  useEffect(
    () => () => {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }
      if (lastCommittedValueRef.current !== draftValueRef.current) {
        onCommitRef.current(draftValueRef.current);
      }
    },
    [],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      draftValueRef.current = nextValue;
      setDraftValue(nextValue);

      clearCommitTimer();
      commitTimerRef.current = window.setTimeout(() => {
        commitValue(nextValue);
      }, INLINE_CELL_COMMIT_DELAY_MS);
    },
    [clearCommitTimer, commitValue],
  );

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    commitValue();
  }, [commitValue]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.currentTarget.blur();
      }
      if (event.key === 'Escape') {
        clearCommitTimer();
        draftValueRef.current = value;
        setDraftValue(value);
      }
    },
    [clearCommitTimer, value],
  );

  return (
    <textarea
      value={draftValue}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={headerKey}
      style={inlineCellInputStyle}
      rows={1}
    />
  );
});

/**
 * Block-based table editor for configuring table structure
 * Allows adding/removing blocks and rows, with card-based layout
 */
export const TableStructureEditor = ({
  tableTemplate,
  onTableTemplateChange: onTemplateChange,
  onSubmitForApproval,
  onApprove,
  onReject,
  onCancelApproval,
  onDeleteItem,
  inlineEditMode = false,
  hideLabelFieldSelector = false,
}: ITableStructureEditorProps) => {
  const { t } = useTranslation();
  const [activeCell, setActiveCell] = useState<IActiveCell | null>(null);
  const [cellProperties, setCellProperties] = useState<ICellPropertiesState | null>({});
  const [isSavingCellProperties, setIsSavingCellProperties] = useState(false);
  const [dropdownState, setDropdownState] = useState<{
    options: Array<{
      id: string;
      label: string;
      value: string;
      record?: Record<string, unknown>;
    }>;
    loading: boolean;
  }>({
    options: [],
    loading: false,
  });
  const [labelFieldOptions, setLabelFieldOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [labelFieldsLoading, setLabelFieldsLoading] = useState(false);
  const [selectedDropdownOptionId, setSelectedDropdownOptionId] = useState<string | null>(null);
  const [selectedDropdownRecord, setSelectedDropdownRecord] = useState<Record<string, unknown> | null>(null);
  const academic_program_id = tableTemplate.context?.academic_program_id || null;
  const tableBehavior = useMemo(() => getTableStructureBehavior(tableTemplate), [tableTemplate]);
  const configuredBlockIds = useMemo(() => getConfiguredBlockIds(tableTemplate), [tableTemplate]);
  const sectionDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Derive collection info from active cell's table_field and header reference metadata
  const cellData = activeCell?.row?.[activeCell?.header?.key as string];
  const cellConfig =
    typeof cellData === 'object' && cellData !== null ? (cellData as Record<string, unknown>) : undefined;
  const headerConfig = activeCell?.header as Record<string, unknown> | undefined;
  const activeBlock = activeCell?.blockId
    ? tableTemplate.structure.blocks.find((block) => block.id === activeCell.blockId)
    : undefined;
  const activeRowFetchConfig = activeBlock?.row_fetch_config as Record<string, unknown> | undefined;
  const activeRowFetchTriggerFields = getRowFetchTriggerFields(activeRowFetchConfig);
  const activeRowFetchPrimaryTable = getStringConfigValue(activeRowFetchConfig?.primary_table);
  const activeHeaderKey = activeCell?.header?.key;
  const tableField =
    getStringConfigValue(
      getCellStringConfig(cellData, 'table_field'),
      getBlockCellStringConfig(activeBlock, activeHeaderKey, 'table_field'),
      getCellStringConfig(activeCell?.header, 'table_field'),
    ) || null;

  // Check if header has reference table metadata (for ID fields that should display related data)
  const headerReference = activeCell?.header?.reference_table;
  const headerRefField = activeCell?.header?.reference_field;

  let collectionName: string | null = null;
  let fieldName: string | null = null;

  if (headerReference && headerRefField) {
    // Use reference table metadata if available
    collectionName = headerReference;
    fieldName = headerRefField;
  } else if (tableField) {
    // Fall back to parsing tableField
    collectionName = tableField.split('.')[0];
    fieldName = tableField.split('.')[1] || 'name';
  }

  const isForceManual =
    typeof cellData === 'object' && cellData !== null && 'force_manual' in cellData
      ? !!(cellData as any).force_manual
      : false;
  const isBehaviorManualField = hasBehaviorField(tableBehavior.manualFields, activeCell?.header?.key);

  const isDropdown = !isForceManual && !isBehaviorManualField && tableField != null && tableField !== '';
  const isBooleanDropdownField = fieldName === 'is_required';
  const labelFieldName = getStringConfigValue(
    cellProperties?.label_field,
    cellConfig?.label_field,
    getBlockCellStringConfig(activeBlock, activeHeaderKey, 'label_field'),
    headerConfig?.label_field,
  );
  const dataSourceDisplay =
    collectionName && fieldName
      ? labelFieldName && labelFieldName !== fieldName
        ? `${collectionName}.${fieldName} + ${collectionName}.${labelFieldName}`
        : `${collectionName}.${fieldName}`
      : '';
  const isRowFetchTriggerDropdown = Boolean(
    activeRowFetchTriggerFields.has(activeCell?.header?.key ?? '') &&
    collectionName &&
    activeRowFetchPrimaryTable === collectionName,
  );
  const sourceRecordFieldName = getStringConfigValue(
    cellConfig?.source_record_field,
    cellConfig?.dropdown_source_record_field,
    headerConfig?.source_record_field,
    headerConfig?.dropdown_source_record_field,
    activeRowFetchConfig?.sourceRecordField,
    activeRowFetchConfig?.source_record_field,
  );
  const shouldTrackDropdownSourceRecord = Boolean(sourceRecordFieldName || isRowFetchTriggerDropdown);
  const dropdownPageSize = 100;

  const dropdownOptions = useMemo(() => {
    return dropdownState.options;
  }, [dropdownState.options]);

  const booleanDropdownFieldOptions = useMemo(
    () =>
      [
        { value: 'true', label: t('tableEditor.booleanOptions.required') },
        { value: 'false', label: t('tableEditor.booleanOptions.optional') },
      ] as const,
    [t],
  );

  const fetchDropdownOptions = useCallback(
    async (params: { search?: string; page?: number; page_size?: number }) => {
      if (!(collectionName && fieldName)) return [] as DropdownOption[];

      const primary = await getTemplateTableOptionsAPI({
        table: collectionName,
        field_name: fieldName,
        sort_order: 'asc',
        search: params.search,
        page: params.page ?? 1,
        page_size: params.page_size ?? dropdownPageSize,
        label_field: labelFieldName,
      });

      if (!labelFieldName || !params.search?.trim() || labelFieldName === fieldName) {
        return primary.map((item) => ({
          ...item,
          label: formatDropdownOptionLabel(fieldName, item, labelFieldName),
        }));
      }

      const secondary = await getTemplateTableOptionsAPI({
        table: collectionName,
        field_name: labelFieldName,
        sort_order: 'asc',
        search: params.search,
        page: params.page ?? 1,
        page_size: params.page_size ?? dropdownPageSize,
        label_field: fieldName,
      });

      return dedupeDropdownOptions([...primary, ...secondary]).map((item) => ({
        ...item,
        label: formatDropdownOptionLabel(fieldName, item, labelFieldName),
      }));
    },
    [collectionName, fieldName, dropdownPageSize, labelFieldName],
  );

  const isLoadingDropdown = Boolean(collectionName && isDropdown && dropdownState.loading);
  const isEmptyOrError = Boolean(isDropdown && !dropdownState.loading && dropdownOptions.length === 0);
  const shouldShowLabelFieldSelector = Boolean(
    !hideLabelFieldSelector && isDropdown && !isBooleanDropdownField && collectionName && fieldName,
  );
  const isCellValueControlDisabled = Boolean(cellProperties?.read_only && !isDropdown);

  const {
    headers,
    blocks,
    rows: existingRows,
    show_add_row_button = true,
    show_copy_button = true,
    show_delete_button = true,
  } = tableTemplate.structure;
  const leafHeaders = useMemo(() => headers.filter((header) => !header.is_parent_header), [headers]);
  const headerIndexByKey = useMemo(() => new Map(headers.map((header, index) => [header.key, index])), [headers]);
  const headerGridCells = useMemo(() => getHeaderGridCells(headers), [headers]);
  const tableGridTemplateColumns = useMemo(
    () => leafHeaders.map((header) => getColumnStyle(header).width || `${DEFAULT_COLUMN_WIDTH_PX}px`).join(' '),
    [leafHeaders],
  );

  /**
   * Ensure block has required structure with validation
   * Safely validates and returns clean block object
   * IMPORTANT: Preserve all properties including row_fetch_config, button_config, etc.
   */
  const ensureBlockStructure = useCallback((block: TableTemplateBlock): TableTemplateBlock => {
    const normalizedSubsection = block.subsection && Object.keys(block.subsection).length > 0 ? block.subsection : null;
    const normalizedRowTemplate =
      block.row_template && Object.keys(block.row_template).length > 0 ? block.row_template : null;
    return {
      id: block.id || `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subsection: normalizedSubsection,
      row_template: normalizedRowTemplate,
      rows: Array.isArray(block.rows)
        ? block.rows.map((row: TableTemplateRow) => ({
            ...row,
          }))
        : [],
      // PRESERVE all other properties to avoid losing auto-fill config
      ...(block.row_fetch_config && {
        row_fetch_config: block.row_fetch_config,
      }),
      ...(block.fetch_config && { fetch_config: block.fetch_config }),
      ...(block.button_config && { button_config: block.button_config }),
    };
  }, []);

  /**
   * Rebuild nested structure from blocks array
   * Validates all blocks and their relationships
   */
  const rebuildNestedStructure = useCallback(
    (blocksList: any[]): TableTemplateBlock[] => {
      if (!Array.isArray(blocksList) || blocksList.length === 0) {
        return [];
      }

      // Validate and ensure all blocks have required structure
      const validatedBlocks = blocksList
        .map((block) => {
          if (!block || typeof block !== 'object' || !block.id) {
            console.warn('Invalid block detected, skipping:', block);
            return null;
          }
          return ensureBlockStructure(block as TableTemplateBlock);
        })
        .filter(Boolean) as TableTemplateBlock[];

      if (validatedBlocks.length === 0) {
        console.warn('No valid blocks found after validation');
        return [];
      }

      return validatedBlocks;
    },
    [ensureBlockStructure],
  );

  // Use blocks if available, otherwise create blocks from flat rows
  const displayBlocks = useMemo(() => {
    if (blocks && blocks.length > 0) {
      return rebuildNestedStructure(blocks);
    }
    // Fallback: create blocks from flat rows
    if (existingRows && existingRows.length > 0) {
      const newBlocks: TableTemplateBlock[] = [];
      let currentBlock: TableTemplateBlock | null = null;
      let blockCount = 0;

      existingRows.forEach((row: any) => {
        if (row.type === 'subsection') {
          if (currentBlock) {
            newBlocks.push(currentBlock);
          }
          blockCount++;
          const blockId = row.id || `block_${blockCount}`;
          const row_template: Record<string, any> = {};
          leafHeaders.forEach((h) => {
            row_template[h.key] = '';
          });
          currentBlock = {
            id: blockId,
            subsection: row as TableTemplateSubsection,
            row_template,
            rows: [],
          } as unknown as TableTemplateBlock;
        } else if (currentBlock) {
          const rowWithId = {
            ...row,
            id: row.id || `row_${currentBlock.id}_${currentBlock.rows.length + 1}`,
          };
          currentBlock.rows.push(rowWithId as TableTemplateRow);
        }
      });

      if (currentBlock) {
        newBlocks.push(currentBlock);
      }
      return rebuildNestedStructure(newBlocks);
    }
    return [];
  }, [blocks, existingRows, leafHeaders, rebuildNestedStructure]);
  const sectionGroups = useMemo(() => createTableSectionGroups(displayBlocks), [displayBlocks]);
  const sectionGroupIds = useMemo(() => sectionGroups.map((group) => group.id), [sectionGroups]);

  useEffect(() => {
    setSelectedDropdownRecord(null);
  }, [activeCell?.blockId, activeCell?.rowIdx, activeCell?.colIdx]);

  useEffect(() => {
    if (!shouldTrackDropdownSourceRecord) {
      setSelectedDropdownOptionId(null);
      return;
    }

    const currentSourceId =
      typeof cellProperties?.source_record_id === 'string' && cellProperties.source_record_id.trim().length > 0
        ? cellProperties.source_record_id
        : null;

    if (currentSourceId) {
      setSelectedDropdownOptionId(currentSourceId);
      return;
    }

    const currentValue = String(cellProperties?.value ?? '');
    if (!currentValue) {
      setSelectedDropdownOptionId(null);
      return;
    }

    const matchedOption = dropdownOptions.find((option) => option.value === currentValue);
    setSelectedDropdownOptionId(matchedOption?.id || null);
  }, [shouldTrackDropdownSourceRecord, cellProperties?.source_record_id, cellProperties?.value, dropdownOptions]);

  useEffect(() => {
    if (!(collectionName && isDropdown && fieldName) || isBooleanDropdownField) {
      setDropdownState({
        options: [],
        loading: false,
      });
      return;
    }

    let cancelled = false;

    setDropdownState({
      options: [],
      loading: true,
    });

    void (async () => {
      try {
        const items = await fetchDropdownOptions({
          page: 1,
          page_size: dropdownPageSize,
        });

        if (!cancelled) {
          setDropdownState({
            options: items.filter((item) => item.value),
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setDropdownState({
            options: [],
            loading: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collectionName, fieldName, isDropdown, dropdownPageSize, fetchDropdownOptions, isBooleanDropdownField]);

  useEffect(() => {
    if (!shouldShowLabelFieldSelector || !collectionName || !fieldName) {
      setLabelFieldOptions([]);
      setLabelFieldsLoading(false);
      return;
    }

    let cancelled = false;
    setLabelFieldsLoading(true);

    void (async () => {
      try {
        const fields = await getTemplateTableSchemaFieldsAPI(collectionName);
        if (cancelled) return;

        setLabelFieldOptions(
          fields
            .filter((field) => field && field !== fieldName)
            .map((field) => ({
              value: field,
              label: field,
            })),
        );
      } catch {
        if (!cancelled) {
          setLabelFieldOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLabelFieldsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collectionName, fieldName, shouldShowLabelFieldSelector]);

  /**
   * Find a block by ID
   */
  const findBlockById = useCallback(
    (blockId: string, blocksToSearch: TableTemplateBlock[] = displayBlocks): TableTemplateBlock | null => {
      for (const block of blocksToSearch) {
        if (block.id === blockId) {
          return block;
        }
      }
      return null;
    },
    [displayBlocks],
  );

  // Helper to find and update a block
  const updateBlockInHierarchy = useCallback(
    (
      targetBlockId: string,
      updateFn: (block: TableTemplateBlock) => TableTemplateBlock,
      rootBlocks: TableTemplateBlock[],
    ): TableTemplateBlock[] => {
      const updateRecursive = (block: TableTemplateBlock): TableTemplateBlock => {
        if (block.id === targetBlockId) {
          const updated = updateFn(block);
          // Ensure updated block maintains structure
          return ensureBlockStructure(updated);
        }
        return block;
      };

      const result = rootBlocks.map((b) => updateRecursive(b)).filter(Boolean);
      return result.length > 0 ? result : rootBlocks; // Prevent empty result
    },
    [ensureBlockStructure],
  );

  // Helper function to save and reconstruct nested blocks
  const saveTemplateChange = useCallback(
    (
      newHeaders: TableTemplateHeader[],
      newBlocks: TableTemplateBlock[],
      options?: {
        deletedBlockId?: string;
        deletedBlockIds?: string[];
        deletedRowId?: string;
        deletedRowIds?: string[];
      },
    ) => {
      // Validate before saving
      if (!Array.isArray(newBlocks)) {
        console.error('Invalid blocks array:', newBlocks);
        return;
      }

      const validatedBlocks = rebuildNestedStructure(newBlocks);
      const structureBehavior = { ...getStructureBehaviorRecord(tableTemplate) };
      const deletedBlockIds = [
        ...(options?.deletedBlockIds ?? []),
        ...(options?.deletedBlockId ? [options.deletedBlockId] : []),
      ].filter((blockId): blockId is string => typeof blockId === 'string' && blockId.length > 0);
      const deletedRowIds = [
        ...(options?.deletedRowIds ?? []),
        ...(options?.deletedRowId ? [options.deletedRowId] : []),
      ].filter((rowId): rowId is string => typeof rowId === 'string' && rowId.length > 0);

      if (deletedBlockIds.some((blockId) => configuredBlockIds.has(blockId))) {
        structureBehavior.deleted_configured_block_ids = [
          ...new Set(
            [
              ...normalizeStringListConfig(
                structureBehavior.deleted_configured_block_ids,
                structureBehavior.deletedConfiguredBlockIds,
              ),
              ...deletedBlockIds.filter((blockId) => configuredBlockIds.has(blockId)),
            ].filter(Boolean),
          ),
        ];
      }

      if (deletedRowIds.length > 0) {
        structureBehavior.deleted_configured_row_ids = [
          ...new Set(
            [
              ...normalizeStringListConfig(
                structureBehavior.deleted_configured_row_ids,
                structureBehavior.deletedConfiguredRowIds,
              ),
              ...deletedRowIds,
            ].filter(Boolean),
          ),
        ];
      }

      onTemplateChange({
        ...tableTemplate,
        structure: {
          ...tableTemplate.structure, // ← Preserve existing structure (fetch_config, fieldMapping, etc.)
          headers: newHeaders,
          blocks: validatedBlocks,
          behavior: structureBehavior,
          show_add_row_button,
          show_copy_button,
          show_delete_button,
        },
      });
    },
    [
      tableTemplate,
      rebuildNestedStructure,
      onTemplateChange,
      configuredBlockIds,
      show_add_row_button,
      show_copy_button,
      show_delete_button,
    ],
  );

  const handleSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sectionGroups.findIndex((group) => group.id === active.id);
      const newIndex = sectionGroups.findIndex((group) => group.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const reorderedGroups = arrayMove(sectionGroups, oldIndex, newIndex);
      saveTemplateChange(headers, flattenTableSectionGroups(reorderedGroups));
      setActiveCell(null);
    },
    [headers, sectionGroups, saveTemplateChange],
  );

  const handleRowDragEnd = useCallback(
    (blockId: string, event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const block = findBlockById(blockId);
      if (!block?.rows?.length) return;

      const rowIds = block.rows.map((row, rowIdx) => getTableRowSortableId(block, row, rowIdx));
      const oldIndex = rowIds.findIndex((rowId) => rowId === active.id);
      const newIndex = rowIds.findIndex((rowId) => rowId === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const updatedRoots = updateBlockInHierarchy(
        blockId,
        (candidateBlock: TableTemplateBlock) => ({
          ...candidateBlock,
          rows: arrayMove(candidateBlock.rows, oldIndex, newIndex),
        }),
        displayBlocks,
      );

      saveTemplateChange(headers, updatedRoots);
      setActiveCell(null);
    },
    [headers, displayBlocks, findBlockById, updateBlockInHierarchy, saveTemplateChange],
  );

  // Note: Currently not used in UI, but kept for future expansion
  const _handleAddColumn = useCallback(() => {
    const newColNum = headers.length + 1;
    const newKey = `col${newColNum}`;
    const newHeader = {
      label: `Header ${newColNum}`,
      key: newKey,
      width: '10%',
    };

    const newHeaders = [...headers, newHeader as TableTemplateHeader];
    const updatedBlocks = displayBlocks.map((block: TableTemplateBlock) => ({
      ...block,
      rows: block.rows.map((row: TableTemplateRow) => ({
        ...row,
        [newKey]: '',
      })),
    }));

    saveTemplateChange(newHeaders, updatedBlocks);
    console.log(`Added column: ${newKey}`);
  }, [headers, displayBlocks, saveTemplateChange]);

  // Helper function to get the next STT number
  const getNextSTT = useCallback(() => {
    let maxSTT = 0;
    displayBlocks.forEach((block: TableTemplateBlock) => {
      block.rows.forEach((row: TableTemplateRow) => {
        const sttValue = typeof row.stt === 'object' && row.stt !== null ? row.stt.value : row.stt;
        const parsedStt = Number.parseFloat(String(sttValue ?? ''));
        if (!Number.isNaN(parsedStt)) {
          maxSTT = Math.max(maxSTT, parsedStt);
        }
      });
    });
    return (maxSTT + 1).toString();
  }, [displayBlocks]);

  const getCellValueForCompute = useCallback((cellData: any) => {
    if (typeof cellData === 'object' && cellData !== null && 'value' in cellData) {
      return cellData.value ?? '';
    }
    return cellData ?? '';
  }, []);

  const parseNumberForCompute = useCallback((rawValue: unknown) => {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return 0;
    }
    const normalized = String(rawValue).trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const formatComputedNumber = useCallback((value: number) => {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }, []);

  const applyComputedFieldsToRow = useCallback(
    (rowData: Record<string, any>) => {
      if (!rowData || typeof rowData !== 'object') return rowData;

      const computedItems = [
        ...headers
          .filter(
            (header) =>
              header &&
              header.key &&
              Array.isArray(header.computed_from) &&
              header.computed_from.length > 0 &&
              ['sum', 'percent'].includes(header.computed_type || 'sum'),
          )
          .map((header) => ({
            targetField: header.key,
            sourceFields: (header.computed_from as unknown[]).filter(
              (sourceKey): sourceKey is string => typeof sourceKey === 'string' && sourceKey.length > 0,
            ),
            computedType: (header.computed_type === 'percent' ? 'percent' : 'sum') as TTableBehaviorComputedType,
          })),
        ...tableBehavior.computedFields,
      ];

      if (computedItems.length === 0) return rowData;

      const updatedRow = { ...rowData };
      computedItems.forEach((computedItem) => {
        const sourceKeys = computedItem.sourceFields.filter(
          (sourceKey: unknown) => typeof sourceKey === 'string' && sourceKey.length > 0,
        );

        if (sourceKeys.length === 0) return;

        const sourceValues = sourceKeys.map((sourceKey: string) => getCellValueForCompute(updatedRow[sourceKey]));
        const hasAnySourceValue = sourceValues.some(
          (value: unknown) => value !== '' && value !== null && value !== undefined,
        );
        let computedValue = '';

        if (hasAnySourceValue && computedItem.computedType === 'percent') {
          const numerator = parseNumberForCompute(sourceValues[0]);
          const denominator = parseNumberForCompute(sourceValues[1]);
          computedValue = denominator !== 0 ? `${formatComputedNumber((numerator / denominator) * 100)}%` : '';
        } else if (hasAnySourceValue) {
          const computedSum = sourceValues.reduce(
            (acc: number, value: unknown) => acc + parseNumberForCompute(value),
            0,
          );
          computedValue = formatComputedNumber(computedSum);
        }

        const oldCellData = updatedRow[computedItem.targetField];
        if (typeof oldCellData === 'object' && oldCellData !== null) {
          updatedRow[computedItem.targetField] = {
            ...oldCellData,
            value: computedValue,
            is_read_only: true,
            force_manual: false,
          };
        } else {
          updatedRow[computedItem.targetField] = {
            value: computedValue,
            is_read_only: true,
            force_manual: false,
          };
        }
      });

      return updatedRow;
    },
    [headers, tableBehavior.computedFields, getCellValueForCompute, parseNumberForCompute, formatComputedNumber],
  );

  // Inline edit: update a row cell value directly without opening modal
  const handleInlineCellValueChange = useCallback(
    (blockId: string, rowIdx: number, headerKey: string, newValue: string) => {
      const updatedRoots = updateBlockInHierarchy(
        blockId,
        (b: TableTemplateBlock) => {
          if (rowIdx < 0) {
            const oldSubsection = b.subsection;
            if (!oldSubsection) return b;

            const oldCellData = oldSubsection[headerKey];
            const newCellData =
              typeof oldCellData === 'object' && oldCellData !== null ? { ...oldCellData, value: newValue } : newValue;
            const updatedSubsection = applyComputedFieldsToRow({
              ...oldSubsection,
              [headerKey]: newCellData,
            }) as TableTemplateSubsection;

            return { ...b, subsection: updatedSubsection };
          }

          const newRows = [...(b.rows || [])];
          const oldRow = newRows[rowIdx];
          if (!oldRow) return b;

          const oldCellData = oldRow[headerKey];
          const newCellData =
            typeof oldCellData === 'object' && oldCellData !== null ? { ...oldCellData, value: newValue } : newValue;

          const updatedRow: Record<string, any> = { ...oldRow, [headerKey]: newCellData };

          newRows[rowIdx] = applyComputedFieldsToRow(updatedRow) as TableTemplateRow;
          return { ...b, rows: newRows };
        },
        displayBlocks,
      );
      saveTemplateChange(headers, updatedRoots);
    },
    [updateBlockInHierarchy, saveTemplateChange, displayBlocks, headers, applyComputedFieldsToRow],
  );

  const handleInlineHeaderLabelChange = useCallback(
    (headerKey: string, newLabel: string) => {
      const updatedHeaders = headers.map((header) =>
        header.key === headerKey
          ? {
              ...header,
              label: newLabel,
            }
          : header,
      );
      saveTemplateChange(updatedHeaders, displayBlocks);
    },
    [displayBlocks, headers, saveTemplateChange],
  );

  // Handle adding a new row to a block
  const handleAddRowToBlock = useCallback(
    (blockId: string) => {
      const block = findBlockById(blockId);
      if (!block || !block.rows) return;
      const blueprintRow =
        block.row_template && Object.keys(block.row_template).length > 0 ? block.row_template : block.rows[0] || null;

      const newRow: Record<string, any> = {};
      leafHeaders.forEach((h) => {
        if (h.key === 'stt') {
          if (blueprintRow && typeof blueprintRow[h.key] === 'object' && blueprintRow[h.key] !== null) {
            const shouldKeepManualSttBlank = Boolean((blueprintRow[h.key] as Record<string, unknown>).force_manual);
            newRow[h.key] = {
              ...blueprintRow[h.key],
              value: shouldKeepManualSttBlank ? '' : getNextSTT(),
              is_read_only: false,
            };
          } else {
            newRow[h.key] = getNextSTT();
          }
        } else if (blueprintRow && typeof blueprintRow[h.key] === 'object' && blueprintRow[h.key] !== null) {
          newRow[h.key] = { ...blueprintRow[h.key], value: '' };
        } else {
          newRow[h.key] = '';
        }
      });
      newRow.id = `row_${blockId}_${block.rows.length + 1}`;
      const newRowWithComputed = applyComputedFieldsToRow(newRow);

      const updatedRoots = updateBlockInHierarchy(
        blockId,
        (b: TableTemplateBlock) => {
          const persistedRowTemplate =
            b.row_template && Object.keys(b.row_template).length > 0
              ? b.row_template
              : b.rows[0]
                ? { ...b.rows[0] }
                : blueprintRow
                  ? { ...blueprintRow }
                  : null;

          return {
            ...b,
            row_template: persistedRowTemplate,
            rows: [...b.rows, newRowWithComputed as TableTemplateRow],
          };
        },
        displayBlocks,
      );

      saveTemplateChange(headers, updatedRoots);

      console.log(`Added row to block: ${blockId}`);
    },
    [
      headers,
      leafHeaders,
      displayBlocks,
      findBlockById,
      updateBlockInHierarchy,
      saveTemplateChange,
      getNextSTT,
      applyComputedFieldsToRow,
    ],
  );

  // Handle deleting a row from a block
  const handleDeleteRow = useCallback(
    (blockId: string, rowIdx: number) => {
      const block = findBlockById(blockId);
      if (!block || !block.rows) return;
      const deletedRowId = typeof block.rows[rowIdx]?.id === 'string' ? block.rows[rowIdx].id : undefined;

      const updatedRoots = updateBlockInHierarchy(
        blockId,
        (b: TableTemplateBlock) => ({
          ...b,
          rows: b.rows.filter((_: any, i: number) => i !== rowIdx),
        }),
        displayBlocks,
      );

      saveTemplateChange(headers, updatedRoots, { deletedRowId });

      console.log(`Deleted row from block: ${blockId}`);
      setActiveCell(null);
    },
    [headers, displayBlocks, findBlockById, updateBlockInHierarchy, saveTemplateChange],
  );

  const handleDeleteSectionGroup = useCallback(
    (blockIds: string[]) => {
      const sectionBlockIds = blockIds.filter(Boolean);
      if (sectionBlockIds.length === 0) return;

      const sectionBlockIdSet = new Set(sectionBlockIds);
      const updatedRoots = displayBlocks.filter((block) => !sectionBlockIdSet.has(block.id ?? ''));
      if (updatedRoots.length === displayBlocks.length) return;

      saveTemplateChange(headers, updatedRoots, { deletedBlockIds: sectionBlockIds });

      console.log(`Deleted section group: ${sectionBlockIds.join(', ')}`);
      setActiveCell(null);
    },
    [headers, displayBlocks, saveTemplateChange],
  );

  const handleCopySectionGroup = useCallback(
    (blockIds: string[]) => {
      const sectionBlockIds = blockIds.filter(Boolean);
      if (sectionBlockIds.length === 0) return;

      const sectionBlockIdSet = new Set(sectionBlockIds);
      const blocksToCopy = displayBlocks.filter((block) => sectionBlockIdSet.has(block.id ?? ''));
      if (blocksToCopy.length === 0) return;

      const insertIndex = displayBlocks.reduce(
        (latestIndex, block, index) => (sectionBlockIdSet.has(block.id ?? '') ? index : latestIndex),
        -1,
      );
      if (insertIndex < 0) return;

      const uniqueId = `_copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const copiedBlocks = blocksToCopy.map((block) => copyTableTemplateBlock(block, uniqueId));
      const updatedRoots = [
        ...displayBlocks.slice(0, insertIndex + 1),
        ...copiedBlocks,
        ...displayBlocks.slice(insertIndex + 1),
      ];

      saveTemplateChange(headers, updatedRoots);

      console.log(`Copied section group: ${sectionBlockIds.join(', ')}`);
    },
    [headers, displayBlocks, saveTemplateChange],
  );

  // Handle copying a row
  const handleCopyRow = useCallback(
    (blockId: string, rowIdx: number) => {
      const block = findBlockById(blockId);
      if (!block || !block.rows) return;

      const rowToCopy = block.rows[rowIdx];
      const uniqueId = `_copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const copiedRow = applyComputedFieldsToRow({
        ...rowToCopy,
        id: `${rowToCopy.id}${uniqueId}`,
      });

      const updatedRoots = updateBlockInHierarchy(
        blockId,
        (b: TableTemplateBlock) => ({
          ...b,
          rows: [...b.rows.slice(0, rowIdx + 1), copiedRow as TableTemplateRow, ...b.rows.slice(rowIdx + 1)],
        }),
        displayBlocks,
      );

      saveTemplateChange(headers, updatedRoots);

      console.log(`Copied row: ${rowToCopy.id} -> ${copiedRow.id}`);
    },
    [headers, displayBlocks, findBlockById, updateBlockInHierarchy, saveTemplateChange, applyComputedFieldsToRow],
  );

  const syncContextResolvedCellsFromRecord = useCallback(
    (
      blockId: string,
      roots: TableTemplateBlock[],
      record: Record<string, unknown> | null,
      sourceTable: string | null,
      sourceRecordId: string | null,
    ) => {
      if (!record || !sourceTable) return roots;

      const updateCellFromRecord = (cellData: unknown) => {
        const cellConfig = getCellObjectConfig(cellData);
        if (!cellConfig || !isContextResolvedCellData(cellData)) return cellData;

        const tableFieldConfig = parseTableFieldConfig(cellConfig.table_field);
        if (!tableFieldConfig || tableFieldConfig.table !== sourceTable) return cellData;

        const nextValue = getRecordFieldValue(record, tableFieldConfig.field);
        if (nextValue === undefined || nextValue === null) return cellData;

        return {
          ...cellConfig,
          value: String(nextValue),
          is_read_only: true,
          resolve_from_context: true,
          ...(sourceRecordId ? { source_record_id: sourceRecordId } : {}),
        };
      };

      const updateRowFromRecord = (rowData: TableTemplateRow | TableTemplateSubsection | null | undefined) => {
        if (!rowData) return rowData;

        let hasChanges = false;
        const nextRow = { ...rowData };
        Object.entries(rowData).forEach(([key, value]) => {
          const nextValue = updateCellFromRecord(value);
          if (nextValue !== value) {
            hasChanges = true;
            nextRow[key] = nextValue;
          }
        });

        return hasChanges ? nextRow : rowData;
      };

      return updateBlockInHierarchy(
        blockId,
        (block: TableTemplateBlock) => ({
          ...block,
          subsection: updateRowFromRecord(block.subsection) as TableTemplateSubsection | null,
          rows: block.rows.map((row) => updateRowFromRecord(row) as TableTemplateRow),
        }),
        roots,
      );
    },
    [updateBlockInHierarchy],
  );

  // Handle property change
  const handlePropertyChange = (property: string, value: any) => {
    setCellProperties((prev) => ({
      ...prev,
      [property]: value,
    }));
  };

  // Handle saving cell properties
  const handleSaveCellProperties = async () => {
    if (isSavingCellProperties) return;
    console.log(`Saving cell properties:`, cellProperties, activeCell);
    if (!activeCell || !cellProperties) return;

    const { blockId, rowIdx, colIdx, header, row } = activeCell;
    const block = findBlockById(blockId);
    if (!block) {
      console.error(`Block ${blockId} not found`);
      return;
    }

    setIsSavingCellProperties(true);
    try {
      const newHeaders = [...headers];

      const selectedSourceRecordId =
        selectedDropdownOptionId ||
        (typeof cellProperties.source_record_id === 'string' && cellProperties.source_record_id.trim().length > 0
          ? cellProperties.source_record_id
          : '');
      const selectedDropdownOption =
        shouldTrackDropdownSourceRecord && selectedSourceRecordId
          ? dropdownOptions.find((option) => option.id === selectedSourceRecordId)
          : null;
      let selectedRecordForSync =
        selectedDropdownRecord ||
        selectedDropdownOption?.record ||
        dropdownOptions.find((option) => option.value === String(cellProperties.value ?? ''))?.record ||
        null;
      const shouldSyncSelectedRecord = isRecordSyncTriggerCellData(cellData) || isContextResolvedCellData(cellData);
      const resolvedCellValue =
        shouldTrackDropdownSourceRecord &&
        (cellProperties.value === undefined ||
          cellProperties.value === null ||
          String(cellProperties.value).trim() === '')
          ? (selectedDropdownOption?.value ?? '')
          : cellProperties.value;
      const hasExplicitSourceRecordId = typeof cellProperties.source_record_id === 'string';
      const resolvedSourceRecordId =
        shouldTrackDropdownSourceRecord && selectedDropdownOption
          ? selectedDropdownOption.id
          : typeof cellProperties.source_record_id === 'string'
            ? cellProperties.source_record_id
            : undefined;
      const nextLabelField = getStringConfigValue(
        cellProperties.label_field,
        cellConfig?.label_field,
        getBlockCellStringConfig(block, header.key, 'label_field'),
        headerConfig?.label_field,
      );
      const normalizedNextLabelField = nextLabelField && nextLabelField !== fieldName ? nextLabelField : '';
      const normalizedTableField = getStringConfigValue(tableField, headerConfig?.table_field);

      if (shouldSyncSelectedRecord && !selectedRecordForSync && collectionName && fieldName && resolvedCellValue) {
        try {
          selectedRecordForSync = await getTemplateRecordByFieldValueAPI({
            table: collectionName,
            field_name: fieldName,
            field_value: String(resolvedCellValue),
          });
        } catch (error) {
          console.error('Failed to resolve selected record for table cell sync:', error);
        }
      }

      const selectedRecordIdForSync =
        getRecordFieldString(selectedRecordForSync ?? undefined, 'id') || selectedSourceRecordId || null;

      // Update header properties
      const updatedHeader: TableTemplateHeader = {
        ...header,
        label: cellProperties.label !== undefined ? cellProperties.label : header.label,
        key: cellProperties.key || header.key || '',
        is_required: cellProperties.is_required,
        read_only: cellProperties.read_only,
        width: cellProperties.width !== undefined ? cellProperties.width : header.width || '',
        ...(normalizedTableField ? { table_field: normalizedTableField } : {}),
        ...(normalizedNextLabelField ? { label_field: normalizedNextLabelField } : {}),
      } as TableTemplateHeader;
      if (!normalizedNextLabelField) {
        delete updatedHeader.label_field;
      }
      const targetHeaderIndex = colIdx >= 0 ? colIdx : newHeaders.findIndex((h) => h.key === header.key);
      if (targetHeaderIndex >= 0) {
        newHeaders[targetHeaderIndex] = updatedHeader;
      }

      // Update cell value in the row or subsection
      const isSubsection = activeCell.isSubsection;

      const updatedRoots = updateBlockInHierarchy(
        blockId,
        (b: TableTemplateBlock) => {
          // Create the new cell config in the format { value, table_field, is_read_only }
          const oldCellData = isSubsection ? b.subsection?.[header.key] : row?.[header.key];
          const oldTableField =
            getStringConfigValue(
              getCellStringConfig(oldCellData, 'table_field'),
              getBlockCellStringConfig(b, header.key, 'table_field'),
              normalizedTableField,
            ) || null;
          const oldSourceTable =
            typeof oldCellData === 'object' && oldCellData !== null && 'source_table' in oldCellData
              ? oldCellData.source_table
              : null;
          const oldSourceRecordId =
            typeof oldCellData === 'object' && oldCellData !== null && 'source_record_id' in oldCellData
              ? oldCellData.source_record_id
              : null;
          const oldResolveFromContext = isContextResolvedCellData(oldCellData);
          const oldSyncRecordTrigger = isRecordSyncTriggerCellData(oldCellData);
          const oldContextSource =
            typeof oldCellData === 'object' && oldCellData !== null && 'context_source' in oldCellData
              ? oldCellData.context_source
              : null;
          const nextSourceRecordId =
            typeof resolvedSourceRecordId === 'string'
              ? resolvedSourceRecordId.trim().length > 0
                ? resolvedSourceRecordId
                : null
              : hasExplicitSourceRecordId
                ? null
                : oldSourceRecordId;
          const nextForceManual = isForceManual || isBehaviorManualField;

          const newCellConfig = {
            value: resolvedCellValue,
            table_field: oldTableField,
            is_read_only: cellProperties.read_only,
            force_manual: nextForceManual,
            ...(oldSourceTable ? { source_table: oldSourceTable } : {}),
            ...(normalizedNextLabelField ? { label_field: normalizedNextLabelField } : {}),
            ...(nextSourceRecordId ? { source_record_id: nextSourceRecordId } : {}),
            ...(oldResolveFromContext ? { resolve_from_context: true } : {}),
            ...(oldSyncRecordTrigger ? { sync_record_trigger: true } : {}),
            ...(oldContextSource ? { context_source: oldContextSource } : {}),
          };

          const row_fetch_config = b.row_fetch_config;
          const blockRowFetchTriggerFields = getRowFetchTriggerFields(row_fetch_config);
          const isBlockRowFetchTriggerCell = blockRowFetchTriggerFields.has(header.key);

          if (isBlockRowFetchTriggerCell && resolvedCellValue) {
            console.log(`Trigger field detected: ${header.key} = ${resolvedCellValue}, will auto-fetch...`);
          } else {
            console.log(`⚠️ Trigger field NOT matched:`, {
              hasFetchConfig: !!row_fetch_config,
              trigger_fields: Array.from(blockRowFetchTriggerFields),
              headerKey: header.key,
              cellValue: resolvedCellValue,
              matched: isBlockRowFetchTriggerCell,
            });
          }

          if (isSubsection) {
            // Update subsection
            let updatedSubsection = {
              ...(b.subsection || {}),
              [header.key]: newCellConfig,
            };
            updatedSubsection = applyComputedFieldsToRow(updatedSubsection) as TableTemplateSubsection;
            if (cellProperties.key && header.key !== cellProperties.key) {
              updatedSubsection[cellProperties.key] = updatedSubsection[header.key];
              delete updatedSubsection[header.key];
            }
            return {
              ...b,
              subsection: updatedSubsection as TableTemplateSubsection,
            };
          } else {
            // Update data row
            let updatedRow = {
              ...row,
              [header.key]: newCellConfig,
            };
            updatedRow = applyComputedFieldsToRow(updatedRow) as TableTemplateRow;
            if (cellProperties.key && header.key !== cellProperties.key) {
              updatedRow[cellProperties.key] = updatedRow[header.key];
              delete updatedRow[header.key];
            }
            return {
              ...b,
              rows: b.rows.map((r: TableTemplateRow, idx: number) =>
                idx === rowIdx ? (updatedRow as TableTemplateRow) : r,
              ),
            };
          }
        },
        displayBlocks,
      );

      // Update header references if key changed
      if (cellProperties.key && header.key !== cellProperties.key) {
        newHeaders.forEach((h) => {
          if (h.parent === header.key) {
            h.parent = cellProperties.key as string;
          }
        });
      }

      const rootsAfterRecordSync = syncContextResolvedCellsFromRecord(
        blockId,
        updatedRoots,
        shouldSyncSelectedRecord ? selectedRecordForSync : null,
        collectionName,
        selectedRecordIdForSync,
      );

      saveTemplateChange(newHeaders, rootsAfterRecordSync);

      // Trigger auto-fetch if this is a trigger field
      const row_fetch_config = block.row_fetch_config; // Notice we get this from the block you already found
      const rowFetchTriggerFields = getRowFetchTriggerFields(row_fetch_config);
      const isRowFetchTriggerCell = rowFetchTriggerFields.has(header.key);
      const rowFetchPrimaryTable = getStringConfigValue(row_fetch_config?.primary_table) || '';

      if (isRowFetchTriggerCell && resolvedCellValue && rowFetchPrimaryTable) {
        console.log('Trigger field detected, fetching auto-fill data...');
        const selectedOptionId = selectedSourceRecordId;
        const selectedOption = selectedOptionId
          ? dropdownOptions.find((option) => option.id === selectedOptionId)
          : dropdownOptions.find((option) => option.value === String(resolvedCellValue ?? ''));
        const configuredTriggerField = getStringConfigValue(row_fetch_config.trigger_value_field);
        const triggerFieldName =
          configuredTriggerField || (selectedOption && shouldTrackDropdownSourceRecord ? 'id' : fieldName || 'id');
        const selectedRecordTriggerValue = selectedOption
          ? getRecordFieldString(selectedOption.record, triggerFieldName) ||
            (triggerFieldName === 'id' || triggerFieldName === '_id' ? selectedOption.id : '')
          : '';
        const triggerValueForAutoFill = selectedRecordTriggerValue || String(resolvedCellValue ?? '');

        try {
          // 1. Fire the single smart query
          const autoFillResult = await getTemplateAutoFillAPI({
            trigger_table: rowFetchPrimaryTable,
            trigger_field: triggerFieldName,
            trigger_value: triggerValueForAutoFill,
            join_conditions: Array.isArray(row_fetch_config.join_conditions) ? row_fetch_config.join_conditions : [],
            fields_to_fetch: (Array.isArray(row_fetch_config.fields_to_fetch)
              ? row_fetch_config.fields_to_fetch
              : []
            ).map((fieldConfig: any) => ({
              key: fieldConfig.key,
              table: fieldConfig.table,
              field: fieldConfig.field,
              source_field: fieldConfig.source_field,
              source_table: fieldConfig.source_table,
            })),
            academic_program_id: academic_program_id || undefined,
          });
          const autoFillUpdates = autoFillResult?.updates || {};
          const autoFillSourceByField = autoFillResult?.source_by_field || {};
          const autoFillSourceIds = autoFillResult?.source_ids || {};

          // 2. Apply the updates if any were found
          if (Object.keys(autoFillUpdates).length > 0) {
            const finalRoots = updateBlockInHierarchy(
              blockId,
              (b: TableTemplateBlock) => {
                const updatedRows = b.rows.map((r: TableTemplateRow, idx: number) => {
                  if (idx === rowIdx) {
                    let updatedRow = { ...r };
                    Object.entries(autoFillUpdates).forEach(([fieldKey, fieldValue]) => {
                      const oldCellData = updatedRow[fieldKey];
                      const fieldSourceMeta = autoFillSourceByField[fieldKey] || null;
                      const fetchedValue = fieldValue as string;
                      const hasFetchedValue = fetchedValue !== '' && fetchedValue != null;
                      const cellTableField =
                        typeof oldCellData === 'object' && oldCellData !== null && 'table_field' in oldCellData
                          ? (oldCellData as any).table_field
                          : null;
                      // Fields with table_field (fetched from DB): lock when value present, unlock when empty.
                      // The row-fetch trigger field stays editable so users can change the selected source record later.
                      // Fields without table_field: preserve existing is_read_only
                      const oldIsReadOnly =
                        typeof oldCellData === 'object' && oldCellData !== null && 'is_read_only' in oldCellData
                          ? (oldCellData as any).is_read_only
                          : false;
                      const oldLabelField =
                        typeof oldCellData === 'object' &&
                        oldCellData !== null &&
                        'label_field' in oldCellData &&
                        typeof (oldCellData as any).label_field === 'string'
                          ? (oldCellData as any).label_field
                          : null;
                      const oldSyncRecordTrigger = isRecordSyncTriggerCellData(oldCellData);
                      const newIsReadOnly = rowFetchTriggerFields.has(fieldKey)
                        ? false
                        : cellTableField
                          ? hasFetchedValue
                          : oldIsReadOnly;
                      updatedRow[fieldKey] = {
                        value: fetchedValue,
                        table_field: cellTableField,
                        is_read_only: newIsReadOnly,
                        ...(oldLabelField ? { label_field: oldLabelField } : {}),
                        ...(oldSyncRecordTrigger ? { sync_record_trigger: true } : {}),
                        source_table:
                          fieldSourceMeta?.table ||
                          (typeof oldCellData === 'object' && oldCellData !== null && 'source_table' in oldCellData
                            ? oldCellData.source_table
                            : null),
                        source_record_id:
                          fieldSourceMeta?.record_id ||
                          (typeof oldCellData === 'object' && oldCellData !== null && 'source_record_id' in oldCellData
                            ? oldCellData.source_record_id
                            : null),
                      };
                    });
                    const existingSourceIds =
                      typeof updatedRow._source_ids === 'object' && updatedRow._source_ids !== null
                        ? updatedRow._source_ids
                        : {};
                    updatedRow._source_ids = {
                      ...existingSourceIds,
                      ...autoFillSourceIds,
                    };
                    updatedRow = applyComputedFieldsToRow(updatedRow) as TableTemplateRow;
                    return updatedRow as TableTemplateRow;
                  }
                  return r;
                });
                return { ...b, rows: updatedRows };
              },
              rootsAfterRecordSync, // Pass the roots you just updated above
            );

            // Save again with the populated fields
            saveTemplateChange(newHeaders, finalRoots);
            console.log('Auto-filled fields saved:', Object.keys(autoFillUpdates).join(', '));
          }
        } catch (error) {
          console.error('❌ Auto-fill fetch failed:', error);
        }
      }

      setActiveCell(null);
    } finally {
      setIsSavingCellProperties(false);
    }
  };

  // Helper function to extract cell config (supports both new object format and old string format)
  const getCellConfig = (cellData: any) => {
    if (typeof cellData === 'object' && cellData !== null && 'value' in cellData) {
      // New format: { value, table_field, is_read_only }
      return {
        value: cellData.value === undefined || cellData.value === null ? '' : cellData.value,
        table_field: cellData.table_field || null,
        is_read_only: cellData.is_read_only || false,
        force_manual: cellData.force_manual || false,
        label_field:
          typeof cellData.label_field === 'string' && cellData.label_field.trim().length > 0
            ? cellData.label_field
            : null,
        source_record_id:
          typeof cellData.source_record_id === 'string' && cellData.source_record_id.trim().length > 0
            ? cellData.source_record_id
            : null,
        resolve_from_context: isContextResolvedCellData(cellData),
        sync_record_trigger: isRecordSyncTriggerCellData(cellData),
      };
    }
    // Old format: plain string or undefined
    return {
      value: cellData === undefined || cellData === null ? '' : cellData,
      table_field: null,
      is_read_only: false,
      force_manual: false,
      label_field: null,
      source_record_id: null,
      resolve_from_context: false,
      sync_record_trigger: false,
    };
  };

  const getDisplayCellValue = (cellData: any, header: TableTemplateHeader) =>
    mapRequiredTypeDisplayValue(getCellConfig(cellData).value, header);

  return (
    <div className="table-structure-editor">
      <div className="blocks-container">
        {displayBlocks.length === 0 ? (
          <div className="empty-state">
            <p>{t('tableEditor.empty')}</p>
          </div>
        ) : (
          <div className="unified-table-card">
            <div className="table-container">
              <div className="table-header-row">
                <div className="table-header-leading-spacer" />
                <div
                  className="row-cells table-grid-cells table-header-grid"
                  style={{ gridTemplateColumns: tableGridTemplateColumns }}>
                  {headerGridCells.map(({ header, rowStart, colStart, colSpan, rowSpan }) => {
                    const isHeaderLabelEditable = header.label_editable === true;

                    return (
                      <div
                        key={`header-${header.key}`}
                        className={`cell cell-header-item ${isHeaderLabelEditable ? 'cell-header-item-editable' : ''}`}
                        style={{
                          gridColumn: `${colStart} / span ${colSpan}`,
                          gridRow: `${rowStart} / span ${rowSpan}`,
                          backgroundColor: header.background_color || undefined,
                          padding: isHeaderLabelEditable ? 0 : undefined,
                        }}>
                        {isHeaderLabelEditable ? (
                          <InlineTableCellInput
                            value={String(header.label ?? '')}
                            headerKey={header.key}
                            onCommit={(nextValue) => handleInlineHeaderLabelChange(header.key, nextValue)}
                          />
                        ) : (
                          header.label || header.key
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="table-header-spacer" />
              </div>
              <div className="rows-list">
                {(() => {
                  // Helper function to render blocks
                  const renderBlocks = (blocks: TableTemplateBlock[], getSectionDragHandle?: () => ReactNode) => {
                    const sectionBlockIds = blocks
                      .map((block) => block.id)
                      .filter((blockId): blockId is string => typeof blockId === 'string' && blockId.length > 0);

                    return blocks.flatMap((block) => {
                      const blockElements = [];

                      // Add subsection row
                      if (block.subsection) {
                        const subsection = block.subsection;
                        const showCopyBlockButton = block.button_config?.show_copy_button !== false;
                        const showDeleteBlockButton = block.button_config?.show_delete_button !== false;
                        blockElements.push(
                          <div key={`subsection-${block.id}`} className="row-item subsection-row">
                            <div className="row-actions row-leading-actions">{getSectionDragHandle?.()}</div>
                            <div
                              className="row-cells table-grid-cells"
                              style={{ gridTemplateColumns: tableGridTemplateColumns }}>
                              {(() => {
                                let skippedMergedCells = 0;

                                return leafHeaders.map((h) => {
                                  if (skippedMergedCells > 0) {
                                    skippedMergedCells -= 1;
                                    return null;
                                  }

                                  const colIdx = headerIndexByKey.get(h.key) ?? -1;
                                  const cellConfig = getCellConfig(subsection[h.key]);
                                  const colSpan = Math.min(getCellMergeColspan(subsection, h.key), leafHeaders.length);
                                  skippedMergedCells = colSpan - 1;
                                  const isEditableReadOnlyField = hasBehaviorField(
                                    tableBehavior.editableReadOnlyFields,
                                    h?.key,
                                  );
                                  const isReadOnly = isEditableReadOnlyField ? false : cellConfig.is_read_only;
                                  const cellStyle = colSpan > 1 ? { gridColumn: `span ${colSpan}` } : undefined;
                                  const isBehaviorManualCell = hasBehaviorField(tableBehavior.manualFields, h?.key);
                                  const hasFetchField =
                                    !isBehaviorManualCell &&
                                    cellConfig.table_field != null &&
                                    cellConfig.table_field !== '';
                                  const isForceManual = cellConfig.force_manual;
                                  const shouldUseInlineInput =
                                    (!hasFetchField && !isReadOnly) || isForceManual || isBehaviorManualCell;
                                  const canOpenReadOnlyCell =
                                    isReadOnly && hasFetchField && cellConfig.resolve_from_context;

                                  if (shouldUseInlineInput) {
                                    return (
                                      <div
                                        key={`subsection-${block.id}-${h.key}`}
                                        className="cell subsection-cell"
                                        style={{
                                          ...cellStyle,
                                          padding: 0,
                                        }}>
                                        <InlineTableCellInput
                                          value={String(cellConfig.value ?? '')}
                                          headerKey={h.key}
                                          onCommit={(nextValue) =>
                                            handleInlineCellValueChange(block.id as string, -1, h.key, nextValue)
                                          }
                                        />
                                      </div>
                                    );
                                  }

                                  if (isReadOnly && !canOpenReadOnlyCell) {
                                    return (
                                      <div
                                        key={`subsection-${block.id}-${h.key}`}
                                        className="cell subsection-cell"
                                        style={{
                                          ...cellStyle,
                                          color: '#6b7280',
                                          cursor: 'default',
                                        }}
                                        title={`${h.label || h.key}: ${getDisplayCellValue(subsection[h.key], h) || '–'}`}>
                                        <div className="cell-value">
                                          {getDisplayCellValue(subsection[h.key], h) || '–'}
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={`subsection-${block.id}-${h.key}`}
                                      className={`cell subsection-cell ${
                                        activeCell?.blockId === block.id &&
                                        activeCell?.isSubsection &&
                                        activeCell?.colIdx === colIdx
                                          ? 'active'
                                          : ''
                                      }`}
                                      style={cellStyle}
                                      onClick={() => {
                                        setActiveCell({
                                          blockId: block.id as string,
                                          rowIdx: -1,
                                          colIdx,
                                          header: h,
                                          row: subsection,
                                          isSubsection: true,
                                        });
                                        setCellProperties({
                                          label: h?.label || '',
                                          key: h?.key || '',
                                          value: cellConfig.value,
                                          source_record_id: cellConfig.source_record_id || undefined,
                                          resolve_from_context: cellConfig.resolve_from_context,
                                          label_field:
                                            getStringConfigValue(
                                              cellConfig.label_field,
                                              getBlockCellStringConfig(block, h?.key, 'label_field'),
                                              h?.label_field,
                                            ) || '',
                                          is_required: h?.is_required || false,
                                          read_only: isReadOnly,
                                          width: h?.width || '10%',
                                          editable: true,
                                        });
                                      }}
                                      title={`${h.label || h.key}: ${getDisplayCellValue(subsection[h.key], h) || '–'}`}>
                                      <div className="cell-value">
                                        {getDisplayCellValue(subsection[h.key], h) || '–'}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                            <div className="row-actions">
                              {(showCopyBlockButton || show_copy_button) && (
                                <button
                                  type="button"
                                  className="row-action-btn row-copy-btn"
                                  onClick={() => handleCopySectionGroup(sectionBlockIds)}
                                  title={t('tableEditor.actions.copyBlock')}>
                                  +
                                </button>
                              )}
                              {(showDeleteBlockButton || show_delete_button) && (
                                <button
                                  type="button"
                                  className="row-action-btn block-delete-btn"
                                  onClick={() => handleDeleteSectionGroup(sectionBlockIds)}
                                  title={t('tableEditor.actions.deleteBlock')}>
                                  ✕
                                </button>
                              )}

                              {/* Approval / external actions for subsection */}
                              {onSubmitForApproval && (
                                <button
                                  type="button"
                                  className="row-action-btn submit-approval-btn"
                                  onClick={() => onSubmitForApproval({ blockId: block.id ?? '' })}
                                  title={t('tableEditor.actions.submitApproval')}>
                                  ⇧
                                </button>
                              )}
                              {onDeleteItem && (
                                <button
                                  type="button"
                                  className="row-action-btn delete-item-btn"
                                  onClick={() => onDeleteItem({ id: block.id ?? '' })}
                                  title={t('tableEditor.actions.deleteItem')}>
                                  🗑
                                </button>
                              )}
                            </div>
                          </div>,
                        );
                      }

                      // Add data rows
                      if (block.rows && block.rows.length > 0) {
                        const rowSortableIds = block.rows.map((row, rowIdx) =>
                          getTableRowSortableId(block, row, rowIdx),
                        );
                        const rowElements = block.rows.map((row, rowIdx) => {
                          const row_button_config =
                            row.row_button_config && typeof row.row_button_config === 'object'
                              ? (row.row_button_config as Record<string, unknown>)
                              : {};
                          const canCopyRow =
                            typeof row_button_config.show_copy_button === 'boolean'
                              ? row_button_config.show_copy_button
                              : (block.button_config?.show_copy_button ?? show_copy_button);
                          const canDeleteRow =
                            typeof row_button_config.show_delete_button === 'boolean'
                              ? row_button_config.show_delete_button
                              : (block.button_config?.show_delete_button ?? show_delete_button);

                          return (
                            <SortableDataRow
                              key={rowSortableIds[rowIdx]}
                              id={rowSortableIds[rowIdx]}
                              disabled={block.rows.length <= 1}
                              dragTitle={t('tableEditor.actions.reorderRow')}>
                              {(rowDragHandle) => (
                                <div className="row-item">
                                  <div className="row-actions row-leading-actions">
                                    {getSectionDragHandle?.() || rowDragHandle}
                                  </div>
                                  <div
                                    className="row-cells table-grid-cells"
                                    style={{ gridTemplateColumns: tableGridTemplateColumns }}>
                                    {leafHeaders.map((h) => {
                                      const colIdx = headerIndexByKey.get(h.key) ?? -1;
                                      const cellConfig = getCellConfig(row?.[h?.key]);
                                      const row_fetch_config =
                                        block.row_fetch_config && typeof block.row_fetch_config === 'object'
                                          ? (block.row_fetch_config as Record<string, unknown>)
                                          : null;
                                      const rowFetchTriggerFields = getRowFetchTriggerFields(row_fetch_config);
                                      const isRowFetchTriggerCell = rowFetchTriggerFields.has(h.key);
                                      const isBehaviorManualCell = hasBehaviorField(tableBehavior.manualFields, h?.key);
                                      const isEditableReadOnlyField = hasBehaviorField(
                                        tableBehavior.editableReadOnlyFields,
                                        h?.key,
                                      );
                                      const hasFetchField =
                                        !isBehaviorManualCell &&
                                        cellConfig.table_field != null &&
                                        cellConfig.table_field !== '';
                                      const isSttDataCell = h.key === 'stt';
                                      const isReadOnly = isSttDataCell
                                        ? false
                                        : isRowFetchTriggerCell || isEditableReadOnlyField
                                          ? false
                                          : hasFetchField && !hasMeaningfulCellValue(cellConfig.value)
                                            ? false
                                            : cellConfig.is_read_only;
                                      const isForceManual = cellConfig.force_manual;
                                      const shouldUseInlineInput =
                                        (!hasFetchField && !isReadOnly) || isForceManual || isBehaviorManualCell;
                                      const canOpenReadOnlyCell =
                                        isReadOnly && hasFetchField && cellConfig.resolve_from_context;

                                      if (shouldUseInlineInput) {
                                        return (
                                          <div
                                            key={`${block.id}-${row.id}-${h.key}`}
                                            className="cell"
                                            style={{ padding: 0 }}>
                                            <InlineTableCellInput
                                              value={String(cellConfig.value ?? '')}
                                              headerKey={h.key}
                                              onCommit={(nextValue) =>
                                                handleInlineCellValueChange(
                                                  block.id as string,
                                                  rowIdx,
                                                  h.key,
                                                  nextValue,
                                                )
                                              }
                                            />
                                          </div>
                                        );
                                      }

                                      // Read-only cells are rendered as output only; editable source cells still open the picker.
                                      if (isReadOnly && !canOpenReadOnlyCell) {
                                        return (
                                          <div
                                            key={`${block.id}-${row.id}-${h.key}`}
                                            className="cell"
                                            style={{ color: '#6b7280', cursor: 'default' }}>
                                            <div className="cell-value">
                                              {getDisplayCellValue(row[h.key], h) || '–'}
                                            </div>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div
                                          key={`${block.id}-${row.id}-${h.key}`}
                                          className={`cell ${
                                            activeCell?.blockId === block.id &&
                                            activeCell?.rowIdx === rowIdx &&
                                            activeCell?.colIdx === colIdx
                                              ? 'active'
                                              : ''
                                          }`}
                                          onClick={() => {
                                            setActiveCell({
                                              blockId: block.id as string,
                                              rowIdx,
                                              colIdx,
                                              header: h,
                                              row,
                                              isSubsection: false,
                                            });
                                            setCellProperties({
                                              label: h?.label || '',
                                              key: h?.key || '',
                                              value: cellConfig.value,
                                              source_record_id: cellConfig.source_record_id || undefined,
                                              resolve_from_context: cellConfig.resolve_from_context,
                                              label_field:
                                                getStringConfigValue(
                                                  cellConfig.label_field,
                                                  getBlockCellStringConfig(block, h?.key, 'label_field'),
                                                  h?.label_field,
                                                ) || '',
                                              is_required: h?.is_required || false,
                                              read_only: isReadOnly,
                                              width: h?.width || '10%',
                                              editable: true,
                                            });
                                          }}
                                          title={`${h.label || h.key}: ${getDisplayCellValue(row[h.key], h) || '–'}`}>
                                          <div className="cell-value">{getDisplayCellValue(row[h.key], h) || '–'}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="row-actions">
                                    {canCopyRow && (
                                      <button
                                        type="button"
                                        className="row-action-btn row-copy-btn"
                                        onClick={() => handleCopyRow(block.id as string, rowIdx)}
                                        title={t('tableEditor.actions.copyRow')}>
                                        +
                                      </button>
                                    )}
                                    {canDeleteRow && (
                                      <button
                                        type="button"
                                        className="row-action-btn row-delete-btn"
                                        onClick={() => handleDeleteRow(block.id as string, rowIdx)}
                                        title={t('tableEditor.actions.deleteRow')}>
                                        ✕
                                      </button>
                                    )}

                                    {/* Approval / external actions for data rows */}
                                    {onSubmitForApproval && (
                                      <button
                                        type="button"
                                        className="row-action-btn submit-approval-btn"
                                        onClick={() =>
                                          onSubmitForApproval({
                                            blockId: block.id ?? '',
                                            rowId: row.id ?? '',
                                            rowIdx,
                                          })
                                        }
                                        title={t('tableEditor.actions.submitApproval')}>
                                        ⇧
                                      </button>
                                    )}

                                    {onApprove && (
                                      <button
                                        type="button"
                                        className="row-action-btn approve-btn"
                                        onClick={() => onApprove({ id: row.id ?? '' })}
                                        title={t('tableEditor.actions.approve')}>
                                        {t('common.actions.approve')}
                                      </button>
                                    )}

                                    {onReject && (
                                      <button
                                        type="button"
                                        className="row-action-btn reject-btn"
                                        onClick={() => onReject({ id: row.id ?? '' })}
                                        title={t('tableEditor.actions.reject')}>
                                        ❌
                                      </button>
                                    )}

                                    {onCancelApproval && (
                                      <button
                                        type="button"
                                        className="row-action-btn cancel-approval-btn"
                                        onClick={() => onCancelApproval({ id: row.id ?? '' })}
                                        title={t('tableEditor.actions.cancelApproval')}>
                                        ⨂
                                      </button>
                                    )}

                                    {onDeleteItem && (
                                      <button
                                        type="button"
                                        className="row-action-btn delete-item-btn"
                                        onClick={() => onDeleteItem({ id: row.id ?? '' })}
                                        title={t('tableEditor.actions.deleteItem')}>
                                        🗑
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </SortableDataRow>
                          );
                        });

                        blockElements.push(
                          <DndContext
                            key={`${block.id}-rows-sortable`}
                            sensors={sectionDragSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => handleRowDragEnd(block.id as string, event)}>
                            <SortableContext items={rowSortableIds} strategy={verticalListSortingStrategy}>
                              <div className="row-sortable-list">{rowElements}</div>
                            </SortableContext>
                          </DndContext>,
                        );
                      }

                      // Add Row button (block-level config overrides global config)
                      if (
                        (block.button_config?.show_add_row_button ?? show_add_row_button) &&
                        canAddRowsToBlock(block)
                      ) {
                        const sectionDragHandle = getSectionDragHandle?.();
                        blockElements.push(
                          <div key={`${block.id}-add-row`} className="row-item add-row-item">
                            <div className="row-actions row-leading-actions add-row-drag-actions">
                              {sectionDragHandle}
                            </div>
                            <button
                              type="button"
                              className="add-row-btn"
                              onClick={() => handleAddRowToBlock(block.id as string)}
                              title={t('tableEditor.actions.addRowTitle')}>
                              {t('tableEditor.actions.addRow')}
                            </button>
                          </div>,
                        );
                      }

                      return blockElements;
                    });
                  };

                  return (
                    <DndContext
                      sensors={sectionDragSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleSectionDragEnd}>
                      <SortableContext items={sectionGroupIds} strategy={verticalListSortingStrategy}>
                        {sectionGroups.map((sectionGroup) => (
                          <SortableSectionGroup
                            key={sectionGroup.id}
                            id={sectionGroup.id}
                            disabled={sectionGroups.length <= 1}
                            dragTitle={t('tableEditor.actions.reorderSection')}>
                            {(dragHandle) => {
                              let dragHandleRendered = false;
                              const getSectionDragHandle = () => {
                                if (dragHandleRendered) return null;
                                dragHandleRendered = true;
                                return dragHandle;
                              };

                              return renderBlocks(sectionGroup.blocks, getSectionDragHandle);
                            }}
                          </SortableSectionGroup>
                        ))}
                      </SortableContext>
                    </DndContext>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {activeCell && (
        <Dialog
          open={!!activeCell}
          onOpenChange={(open) => {
            if (!open) setActiveCell(null);
          }}>
          <DialogContent
            className="w-[min(92vw,42rem)] max-w-[42rem] min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl"
            onInteractOutside={(event) => {
              event.preventDefault();
            }}>
            <DialogHeader className="border-b border-slate-200 bg-slate-50/80 px-7 py-6">
              <DialogTitle className="text-2xl font-semibold text-slate-900">
                {t('tableEditor.cellProperties.title')}
              </DialogTitle>
              <DialogDescription>{t('tableEditor.cellProperties.description')}</DialogDescription>
            </DialogHeader>

            <div className="min-w-0 space-y-5 px-7 py-6">
              {!inlineEditMode && (
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-sm font-medium text-slate-800">
                    {t('tableEditor.cellProperties.headerLabel')}
                  </Label>
                  <Input
                    className="min-w-0"
                    value={cellProperties?.label || ''}
                    onChange={(e) => handlePropertyChange('label', e.target.value)}
                    placeholder={t('tableEditor.cellProperties.headerLabelPlaceholder')}
                  />
                </div>
              )}

              {!inlineEditMode && (
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-sm font-medium text-slate-800">
                    {t('tableEditor.cellProperties.columnKey')}
                  </Label>
                  <Input
                    className="min-w-0"
                    value={cellProperties?.key || ''}
                    onChange={(e) => handlePropertyChange('key', e.target.value)}
                    placeholder={t('tableEditor.cellProperties.columnKeyPlaceholder')}
                  />
                </div>
              )}

              <div className="min-w-0 space-y-1.5">
                <Label className="text-sm font-medium text-slate-800">
                  {t('tableEditor.cellProperties.cellValue')}
                </Label>
                {isEmptyOrError && (
                  <p className="text-[13px] text-destructive">
                    {t('tableEditor.cellProperties.noOptionsFor', { collection: collectionName })}
                  </p>
                )}
                {isDropdown ? (
                  <>
                    {isBooleanDropdownField ? (
                      <Select
                        value={String(cellProperties?.value ?? '')}
                        onValueChange={(val) =>
                          setCellProperties((prev) => ({
                            ...prev,
                            value: val,
                            source_record_id: '',
                          }))
                        }
                        disabled={isCellValueControlDisabled}>
                        <SelectTrigger className="min-w-0 h-12 rounded-xl border-slate-200 bg-white text-left shadow-sm">
                          <SelectValue placeholder={t('tableEditor.cellProperties.selectValue')} />
                        </SelectTrigger>
                        <SelectContent>
                          {booleanDropdownFieldOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <SearchableSelect
                        className="min-w-0"
                        triggerClassName="min-w-0 h-12 rounded-xl border-slate-200 bg-white text-left shadow-sm"
                        contentClassName="z-[70] rounded-2xl border border-slate-200 shadow-2xl"
                        inlineSearchTrigger
                        persistSearchText
                        fetchOnOpen
                        clearOnEmptySearch={false}
                        minSearchLength={1}
                        value={
                          shouldTrackDropdownSourceRecord
                            ? selectedDropdownOptionId || undefined
                            : String(cellProperties?.value ?? '') || undefined
                        }
                        onValueChange={(val) => {
                          if (shouldTrackDropdownSourceRecord) {
                            setSelectedDropdownOptionId(val || null);
                            return;
                          }
                          setCellProperties((prev) => ({
                            ...prev,
                            value: val,
                          }));
                        }}
                        onOptionSelect={(option) => {
                          if (!option) {
                            setSelectedDropdownOptionId(null);
                            setSelectedDropdownRecord(null);
                            setCellProperties((prev) => ({
                              ...prev,
                              value: '',
                              source_record_id: '',
                            }));
                            return;
                          }

                          const optionRecord =
                            option.record && typeof option.record === 'object'
                              ? (option.record as Record<string, unknown>)
                              : null;
                          setSelectedDropdownRecord(optionRecord);

                          if (shouldTrackDropdownSourceRecord) {
                            // Resolve the cell value from the record's own field instead of
                            // option.rawValue: when the user searches by label_field (e.g. name),
                            // the matched option comes from the secondary query and rawValue holds
                            // the label, not the value field. record[fieldName] is always correct.
                            const resolvedValue =
                              getStringConfigValue(
                                getRecordFieldString(optionRecord ?? undefined, fieldName ?? undefined),
                                typeof option.rawValue === 'string' ? option.rawValue : undefined,
                                option.label,
                              ) ?? '';
                            setSelectedDropdownOptionId(option.value || null);
                            setCellProperties((prev) => ({
                              ...prev,
                              value: resolvedValue,
                              source_record_id: option.value || '',
                            }));
                            return;
                          }

                          setCellProperties((prev) => ({
                            ...prev,
                            value:
                              getStringConfigValue(
                                getRecordFieldString(optionRecord ?? undefined, fieldName ?? undefined),
                                option.value,
                              ) ?? option.value,
                            source_record_id: getRecordFieldString(optionRecord ?? undefined, 'id') || '',
                          }));
                        }}
                        options={dropdownOptions.map((o) => ({
                          value: shouldTrackDropdownSourceRecord ? o.id : o.value,
                          label: o.label,
                          rawValue: o.value,
                          record: o.record,
                        }))}
                        apiFunction={
                          collectionName && fieldName
                            ? (params: { search?: string; page?: number; page_size?: number }) =>
                                fetchDropdownOptions({
                                  search: typeof params.search === 'string' ? params.search : undefined,
                                  page: typeof params.page === 'number' ? params.page : 1,
                                  page_size: typeof params.page_size === 'number' ? params.page_size : 100,
                                }).then((items) =>
                                  items.map((item) => ({
                                    value: shouldTrackDropdownSourceRecord ? item.id : item.value,
                                    label: item.label,
                                    rawValue: item.value,
                                    record: item.record,
                                  })),
                                )
                            : undefined
                        }
                        loadByIdFunction={
                          collectionName && fieldName
                            ? async (selectedValue) => {
                                const matched = dropdownOptions.find((option) =>
                                  shouldTrackDropdownSourceRecord
                                    ? option.id === selectedValue
                                    : option.value === selectedValue,
                                );
                                if (matched) {
                                  return {
                                    value: shouldTrackDropdownSourceRecord ? matched.id : matched.value,
                                    label: matched.label,
                                    rawValue: matched.value,
                                    record: matched.record,
                                  };
                                }

                                if (shouldTrackDropdownSourceRecord) {
                                  const record = await getTemplateRecordByFieldValueAPI({
                                    table: collectionName,
                                    field_name: 'id',
                                    field_value: selectedValue,
                                  });
                                  if (!record) return null;

                                  const displayValue = String(record[fieldName] ?? '');
                                  const recordOption = {
                                    id: selectedValue,
                                    value: displayValue,
                                    label: displayValue,
                                    record,
                                  };
                                  return {
                                    value: selectedValue,
                                    label: formatDropdownOptionLabel(fieldName, recordOption, labelFieldName),
                                    rawValue: displayValue,
                                    record,
                                  };
                                }

                                const record = await getTemplateRecordByFieldValueAPI({
                                  table: collectionName,
                                  field_name: fieldName,
                                  field_value: selectedValue,
                                });
                                if (!record) {
                                  return {
                                    value: selectedValue,
                                    label: selectedValue,
                                    rawValue: selectedValue,
                                  };
                                }

                                const displayValue = String(record[fieldName] ?? selectedValue);
                                const recordOption = {
                                  id: getRecordFieldString(record, 'id') || selectedValue,
                                  value: displayValue,
                                  label: displayValue,
                                  record,
                                };
                                return {
                                  value: selectedValue,
                                  label: formatDropdownOptionLabel(fieldName, recordOption, labelFieldName),
                                  rawValue: displayValue,
                                  record,
                                };
                              }
                            : undefined
                        }
                        loading={isLoadingDropdown}
                        disabled={isCellValueControlDisabled}
                        placeholder={
                          isLoadingDropdown
                            ? t('tableEditor.cellProperties.loadingOptions')
                            : t('tableEditor.cellProperties.searchAndSelect')
                        }
                        searchPlaceholder={
                          collectionName && fieldName
                            ? t('tableEditor.cellProperties.searchCollectionField', {
                                collection: collectionName,
                                field: fieldName,
                              })
                            : t('tableEditor.cellProperties.searchValue')
                        }
                        emptyMessage={
                          collectionName
                            ? t('tableEditor.cellProperties.emptyInCollection', { collection: collectionName })
                            : t('tableEditor.cellProperties.emptyValue')
                        }
                        searchKey="search"
                        apiPageSize={10}
                      />
                    )}
                    <p className="text-[13px] text-muted-foreground">
                      {isBooleanDropdownField
                        ? t('tableEditor.cellProperties.fixedBoolean')
                        : t('tableEditor.cellProperties.dataFrom', { source: dataSourceDisplay })}
                    </p>
                    {shouldShowLabelFieldSelector && (
                      <div className="pt-3">
                        <Label className="mb-1.5 block text-sm font-medium text-slate-800">
                          {t('tableEditor.cellProperties.labelField')}
                        </Label>
                        <SearchableSelect
                          className="min-w-0"
                          triggerClassName="min-w-0 h-11 rounded-xl border-slate-200 bg-white text-left shadow-sm"
                          contentClassName="z-[70] rounded-2xl border border-slate-200 shadow-2xl"
                          value={cellProperties?.label_field || labelFieldName || ''}
                          options={labelFieldOptions}
                          placeholder={t('tableEditor.cellProperties.labelFieldPlaceholder')}
                          searchPlaceholder={t('tableEditor.cellProperties.labelFieldSearchPlaceholder')}
                          emptyMessage={t('tableEditor.cellProperties.emptyValue')}
                          clearable
                          maxHeight="260px"
                          loading={labelFieldsLoading}
                          disabled={labelFieldsLoading || labelFieldOptions.length === 0}
                          onValueChange={(field) =>
                            setCellProperties((prev) => ({
                              ...prev,
                              label_field: field || '',
                            }))
                          }
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <Textarea
                    className="min-w-0"
                    value={cellProperties?.value ?? ''}
                    onChange={(e) => handlePropertyChange('value', e.target.value)}
                    placeholder={t('tableEditor.cellProperties.manualValuePlaceholder')}
                    disabled={isCellValueControlDisabled}
                    rows={4}
                  />
                )}
              </div>

              {!inlineEditMode && (
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-sm font-medium text-slate-800">
                    {t('tableEditor.cellProperties.columnWidth')}
                  </Label>
                  <Input
                    className="min-w-0"
                    value={cellProperties?.width || ''}
                    onChange={(e) => handlePropertyChange('width', e.target.value)}
                    placeholder={t('tableEditor.cellProperties.columnWidthPlaceholder')}
                  />
                </div>
              )}

              {!inlineEditMode && (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3">
                  {(
                    [
                      { key: 'is_required', label: t('tableEditor.cellProperties.required') },
                      { key: 'read_only', label: t('tableEditor.cellProperties.readOnly') },
                      { key: 'editable', label: t('tableEditor.cellProperties.editable') },
                    ] as const
                  ).map(({ key, label }) => (
                    <label
                      key={key}
                      htmlFor={key}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                      <Checkbox
                        id={key}
                        checked={Boolean(cellProperties?.[key])}
                        onCheckedChange={(checked) => handlePropertyChange(key, checked === true)}
                      />
                      <span className="text-sm font-medium text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              )}

              <DialogFooter className="border-t border-slate-200 pt-5">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setActiveCell(null)}
                  disabled={isSavingCellProperties}>
                  {t('common.actions.cancel')}
                </Button>
                <Button
                  className="rounded-xl px-5"
                  onClick={handleSaveCellProperties}
                  disabled={isSavingCellProperties}>
                  {isSavingCellProperties && <Loader2 className="size-4 animate-spin" />}
                  {t('tableEditor.cellProperties.saveProperties')}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
