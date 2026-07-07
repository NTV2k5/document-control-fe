import type { TTemplateVariableInputType } from 'api';
import type { TableTemplate, TableTemplateBlock, TableTemplateHeader, TableTemplateRow } from '../../../lib';
import type {
  ITableBuilderColumn,
  ITableBuilderConfig,
  ITableBuilderHeaderGroup,
  ITableBuilderRowBlock,
} from './table-designer.type';

const DEFAULT_HEADER_BACKGROUND = '#f5f5f5';
const BUILDER_VERSION = 1 as const;

export const TABLE_DESIGNER_INPUT_TYPES = [
  'Data',
  'Small Text',
  'Long Text',
  'Int',
  'Float',
  'Percent',
  'Check',
  'Select',
  'Link',
  'Attach Image',
  'Image',
  'Read Only',
] as const satisfies readonly TTemplateVariableInputType[];

export const cloneTableDesignerValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createTableDesignerId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const normalizeColumnKey = (value: string, fallback = 'column') => {
  const key = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  const normalized = key || fallback;
  return /^[A-Za-z]/.test(normalized) ? normalized : `col_${normalized}`;
};

export const normalizeTableDesignerSlug = (value: string, fallback = 'custom_table_variable') => {
  const slug = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  return slug || fallback;
};

export const parseTableDesignerField = (table_field?: string | null) => {
  if (!table_field) return { table: '', field: '' };
  const [table, ...fieldParts] = table_field.split('.');
  return { table: table ?? '', field: fieldParts.join('.') };
};

export const buildTableDesignerField = (table?: string, field?: string) => {
  if (!table || !field) return null;
  return `${table}.${field}`;
};

const getUniqueKey = (existingKeys: Iterable<string>, preferredKey: string) => {
  const normalizedPreferredKey = normalizeColumnKey(preferredKey);
  const usedKeys = new Set(existingKeys);
  if (!usedKeys.has(normalizedPreferredKey)) return normalizedPreferredKey;

  let index = 2;
  while (usedKeys.has(`${normalizedPreferredKey}_${index}`)) {
    index += 1;
  }
  return `${normalizedPreferredKey}_${index}`;
};

const getCellValue = (cell: unknown) => {
  if (cell && typeof cell === 'object' && !Array.isArray(cell) && 'value' in cell) {
    const value = (cell as { value?: unknown }).value;
    return value === null || value === undefined ? '' : String(value);
  }
  return cell === null || cell === undefined ? '' : String(cell);
};

const getFirstSubsectionCell = (
  subsection: Record<string, unknown> | null | undefined,
  columns: ITableBuilderColumn[],
) => {
  if (!subsection) return { key: columns[0]?.key ?? '', value: '' };
  const cell_merge = subsection.cell_merge && typeof subsection.cell_merge === 'object' ? subsection.cell_merge : null;
  const mergedKey = cell_merge ? Object.keys(cell_merge as Record<string, unknown>)[0] : null;
  const key = mergedKey || columns.find((column) => getCellValue(subsection[column.key]))?.key || columns[0]?.key || '';
  return { key, value: getCellValue(subsection[key]) };
};

const getCellObject = (cell: unknown) =>
  cell && typeof cell === 'object' && !Array.isArray(cell) ? (cell as Record<string, unknown>) : null;

const getCellString = (cell: Record<string, unknown> | null, key: string) => {
  const value = cell?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const isContextResolvedCell = (cell: unknown) => {
  const cellObject = getCellObject(cell);
  return Boolean(
    cellObject?.resolve_from_context ||
    cellObject?.resolveFromContext ||
    cellObject?.context_source ||
    cellObject?.contextSource,
  );
};

const getCellSourceConfig = (cell: unknown) => {
  const cellObject = getCellObject(cell);
  const table_field = getCellString(cellObject, 'table_field');
  const label_field = getCellString(cellObject, 'label_field');
  if (!table_field && !label_field) return null;

  return {
    table_field,
    label_field,
  };
};

const getStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];

const getStringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const getNumberValue = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const getPositiveIntegerValue = (value: unknown) => {
  const parsed = getNumberValue(value);
  return parsed === null ? null : Math.max(1, Math.floor(parsed));
};

const getRecordValue = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const getRecordStringValue = (record: Record<string, unknown>, keys: string[], fallback: string) => {
  for (const key of keys) {
    const value = getStringValue(record[key]);
    if (value) return value;
  }
  return fallback;
};

const getRecordNumberValue = (record: Record<string, unknown>, keys: string[], fallback: number) => {
  for (const key of keys) {
    const value = getNumberValue(record[key]);
    if (value !== null) return value;
  }
  return fallback;
};

type TDesignerGroupedColumnConfig = {
  parentKey: string;
  parentLabel: string;
  columnPrefix: string;
  countKey: string;
  labelPrefix: string;
  labelStart: number | null;
  groupWidth: number;
  defaultCount: number;
};

const getDynamicColumnGroupConfigs = (tableTemplate?: TableTemplate | null): TDesignerGroupedColumnConfig[] => {
  const contextSchema = getRecordValue(tableTemplate?.context_schema ?? tableTemplate?.contextSchema);
  const renderRule = getRecordValue(contextSchema?.render_rule);
  if (renderRule?.type !== 'dynamic_column_group') return [];

  const rawConfigs = Array.isArray(renderRule.group_configs)
    ? renderRule.group_configs
    : Array.isArray(renderRule.groupConfigs)
      ? renderRule.groupConfigs
      : [];

  return rawConfigs
    .map((rawConfig, index) => {
      const config = getRecordValue(rawConfig);
      if (!config) return null;

      const parentKey = getRecordStringValue(config, ['parent_key', 'parentKey', 'key'], '');
      if (!parentKey) return null;

      const columnPrefix = getRecordStringValue(
        config,
        ['column_prefix', 'columnPrefix', 'plo_column_prefix', 'ploColumnPrefix'],
        `${parentKey}_`,
      );
      const countKey = getRecordStringValue(
        config,
        ['count_key', 'countKey'],
        `${parentKey.replace(/[^A-Za-z0-9_]/g, '') || `group${index + 1}`}Count`,
      );
      const rawLabelStart = getRecordNumberValue(config, ['label_start', 'labelStart'], NaN);

      return {
        parentKey,
        parentLabel: getRecordStringValue(config, ['parent_label', 'parentLabel', 'label'], parentKey),
        columnPrefix,
        countKey,
        labelPrefix: getRecordStringValue(config, ['label_prefix', 'labelPrefix'], 'PLO'),
        labelStart: Number.isFinite(rawLabelStart) ? Math.max(1, Math.floor(rawLabelStart)) : null,
        groupWidth: Math.max(1, getRecordNumberValue(config, ['group_width', 'groupWidth', 'width'], 40)),
        defaultCount: Math.max(1, Math.floor(getRecordNumberValue(config, ['default_count', 'defaultCount'], 1))),
      };
    })
    .filter((config): config is TDesignerGroupedColumnConfig => Boolean(config));
};

const getDynamicColumnGroupFixedKeys = (tableTemplate?: TableTemplate | null) => {
  const contextSchema = getRecordValue(tableTemplate?.context_schema ?? tableTemplate?.contextSchema);
  const renderRule = getRecordValue(contextSchema?.render_rule);
  const fixedColumnKeys = getStringArray(renderRule?.fixed_column_keys ?? renderRule?.fixedColumnKeys);
  const sttKey = getStringValue(renderRule?.stt_key ?? renderRule?.sttKey) || 'stt';
  const courseNameKey = getStringValue(renderRule?.course_name_key ?? renderRule?.courseNameKey) || 'course_name';
  return fixedColumnKeys.length > 0 ? fixedColumnKeys : [sttKey, courseNameKey];
};

const getDynamicColumnGroupCount = (tableTemplate: TableTemplate, config: TDesignerGroupedColumnConfig) =>
  getPositiveIntegerValue(tableTemplate.context?.[config.countKey]) ?? config.defaultCount;

const normalizeDynamicGroupedTemplateForDesigner = (tableTemplate: TableTemplate): TableTemplate => {
  const groupConfigs = getDynamicColumnGroupConfigs(tableTemplate);
  if (groupConfigs.length === 0) return tableTemplate;

  const oldHeaders = tableTemplate.structure.headers ?? [];
  const oldBlocks = tableTemplate.structure.blocks ?? [];
  const fixedKeys = getDynamicColumnGroupFixedKeys(tableTemplate);
  const fixedHeaders = oldHeaders.filter((header) => fixedKeys.includes(header.key));
  const oldHeaderByGroupAndLabel = new Map(
    oldHeaders
      .filter((header) => !header.is_parent_header && header.parent)
      .map((header) => [`${header.parent}:${header.label || header.key}`, header]),
  );

  let nextLabelStart = 1;
  const dynamicHeaders = groupConfigs.flatMap((groupConfig) => {
    const normalizedCount = getDynamicColumnGroupCount(tableTemplate, groupConfig);
    const labelStart = groupConfig.labelStart ?? nextLabelStart;
    nextLabelStart = labelStart + normalizedCount;
    const parentHeader: TableTemplateHeader = {
      ...(oldHeaders.find((header) => header.key === groupConfig.parentKey) ?? {}),
      label: groupConfig.parentLabel,
      key: groupConfig.parentKey,
      width: `${groupConfig.groupWidth}%`,
      is_parent_header: true,
      read_only: true,
      colspan: normalizedCount,
    };
    const childWidth = `${(groupConfig.groupWidth / normalizedCount).toFixed(2)}%`;
    const childHeaders: TableTemplateHeader[] = Array.from({ length: normalizedCount }, (_, index) => {
      const label = `${groupConfig.labelPrefix}${labelStart + index}`;
      const existingHeader = oldHeaderByGroupAndLabel.get(`${groupConfig.parentKey}:${label}`);
      return {
        ...(existingHeader ?? {}),
        label,
        key: `${groupConfig.columnPrefix}${index + 1}`,
        width: childWidth,
        parent: groupConfig.parentKey,
      };
    });
    return [parentHeader, ...childHeaders];
  });

  const nextHeaders = [...fixedHeaders, ...dynamicHeaders];
  const nextColumnKeys = new Set(nextHeaders.filter((header) => !header.is_parent_header).map((header) => header.key));
  const dynamicLeafHeaders = nextHeaders.filter((header) => !header.is_parent_header && header.parent);

  const normalizeRow = (row: Record<string, unknown> | null | undefined) => {
    if (!row) return row;

    const nextRow: Record<string, unknown> = {};
    ['id', 'type', '_source_ids', 'row_button_config'].forEach((metadataKey) => {
      if (metadataKey in row) nextRow[metadataKey] = row[metadataKey];
    });

    const cellMerge = getRecordValue(row.cell_merge);
    if (cellMerge) {
      const nextCellMerge: Record<string, unknown> = {};
      Object.entries(cellMerge).forEach(([key, value]) => {
        if (nextColumnKeys.has(key)) nextCellMerge[key] = value;
      });
      if (Object.keys(nextCellMerge).length > 0) nextRow.cell_merge = nextCellMerge;
    }

    fixedKeys.forEach((key) => {
      if (key in row) nextRow[key] = row[key];
    });

    dynamicLeafHeaders.forEach((header) => {
      if (header.key in row) {
        nextRow[header.key] = row[header.key];
        return;
      }

      const oldHeader = oldHeaderByGroupAndLabel.get(`${header.parent}:${header.label || header.key}`);
      nextRow[header.key] = oldHeader ? row[oldHeader.key] : { value: '', is_read_only: false };
    });

    return nextRow;
  };

  return {
    ...tableTemplate,
    structure: {
      ...tableTemplate.structure,
      headers: nextHeaders,
      blocks: oldBlocks.map((block) => ({
        ...block,
        subsection: normalizeRow(getRecordValue(block.subsection)) as TableTemplateBlock['subsection'],
        row_template: normalizeRow(getRecordValue(block.row_template)) as TableTemplateBlock['row_template'],
        rows: Array.isArray(block.rows)
          ? (block.rows.map((row) => normalizeRow(row as Record<string, unknown>)) as TableTemplateRow[])
          : [],
      })),
    },
  };
};

const hasManualCellConfig = (cell: unknown) => Boolean(getCellObject(cell)?.force_manual);

const hasManualCellShape = (cell: unknown, column: ITableBuilderColumn) => {
  const cellObject = getCellObject(cell);
  if (!cellObject || !column.table_field) return false;

  const cellTableField = getCellString(cellObject, 'table_field');
  const isReadOnly = cellObject.is_read_only === true || cellObject.read_only === true;
  return !cellTableField && !isReadOnly;
};

const getBlockManualFields = (block: TableTemplateBlock, columns: ITableBuilderColumn[]) => {
  const manualFields = new Set<string>([
    ...getStringArray((block as unknown as Record<string, unknown>).manual_fields),
    ...getStringArray((block as unknown as Record<string, unknown>).manualFields),
  ]);
  const subsection = getCellObject(block.subsection);
  const rowTemplate = getCellObject(block.row_template);
  const rows = Array.isArray(block.rows) ? block.rows : [];

  columns.forEach((column) => {
    if (
      hasManualCellConfig(subsection?.[column.key]) ||
      hasManualCellConfig(rowTemplate?.[column.key]) ||
      hasManualCellShape(subsection?.[column.key], column) ||
      hasManualCellShape(rowTemplate?.[column.key], column)
    ) {
      manualFields.add(column.key);
      return;
    }

    if (
      rows.some(
        (row) =>
          hasManualCellConfig((row as Record<string, unknown>)?.[column.key]) ||
          hasManualCellShape((row as Record<string, unknown>)?.[column.key], column),
      )
    ) {
      manualFields.add(column.key);
    }
  });

  return [...manualFields];
};

const findColumnDataSourceConfig = (columnKey: string, blocks: TableTemplateBlock[]) => {
  for (const block of blocks) {
    const rowTemplate = getCellObject(block.row_template);
    if (isContextResolvedCell(rowTemplate?.[columnKey])) continue;
    const sourceConfig = getCellSourceConfig(rowTemplate?.[columnKey]);
    if (sourceConfig?.table_field) return sourceConfig;
  }

  for (const block of blocks) {
    const rows = Array.isArray(block.rows) ? block.rows : [];
    for (const row of rows) {
      const cell = (row as Record<string, unknown>)?.[columnKey];
      if (isContextResolvedCell(cell)) continue;
      const sourceConfig = getCellSourceConfig(cell);
      if (sourceConfig?.table_field) return sourceConfig;
    }
  }

  return null;
};

const getColumnSourceConfig = (header: TableTemplateHeader, blocks: TableTemplateBlock[]) => {
  const cellSource = findColumnDataSourceConfig(header.key, blocks);
  const headerSource = getCellSourceConfig(header);
  const table_field = cellSource?.table_field || headerSource?.table_field || null;
  const label_field = table_field ? cellSource?.label_field || headerSource?.label_field || null : null;

  return {
    table_field,
    label_field,
  };
};

const hasSameOrderedItems = (leftItems: string[], rightItems: string[]) =>
  leftItems.length === rightItems.length && leftItems.every((item, index) => item === rightItems[index]);

const getBuilderColumnSignature = (column: ITableBuilderColumn) =>
  [
    column.key,
    column.label,
    column.width ?? '',
    column.table_field ?? '',
    column.label_field ?? '',
    column.computed_type ?? '',
    (column.computed_from ?? []).join(','),
    column.read_only ? 'read_only' : '',
    column.is_required ? 'required' : '',
  ].join(':');

const getBuilderBlockSignature = (block: ITableBuilderRowBlock) =>
  [
    block.id,
    block.type,
    block.label,
    JSON.stringify(block.manual_fields ?? []),
    JSON.stringify(block.subsection_values ?? {}),
    JSON.stringify(block.row_template ?? null),
    JSON.stringify(block.rows ?? []),
  ].join(':');

const HEADER_STYLE_KEYS = [
  'bold',
  'italic',
  'underline',
  'font_family',
  'font_size',
  'line_height',
  'text_align',
  'vertical_align',
  'color',
  'background_color',
  'cell_bold',
  'cell_italic',
  'cell_underline',
  'cell_font_family',
  'cell_font_size',
  'cell_line_height',
  'cell_text_align',
  'cell_vertical_align',
  'cell_color',
  'cell_background_color',
] as const;

const pickHeaderStyleMetadata = (header?: Record<string, unknown> | null) => {
  if (!header) return {};

  return Object.fromEntries(
    HEADER_STYLE_KEYS.filter((key) => header[key] !== undefined).map((key) => [key, header[key]]),
  );
};

const mergeBuilderStyleMetadata = (
  tableBuilder: ITableBuilderConfig,
  inferredBuilder: ITableBuilderConfig | null,
): ITableBuilderConfig => {
  if (!inferredBuilder) return tableBuilder;

  const inferredColumnsByKey = new Map(inferredBuilder.columns.map((column) => [column.key, column]));
  const inferredGroupsByKey = new Map(inferredBuilder.header_groups.map((group) => [group.key, group]));

  return {
    ...tableBuilder,
    columns: tableBuilder.columns.map((column) => {
      const inferredColumn = inferredColumnsByKey.get(column.key);
      const inferredStyle = pickHeaderStyleMetadata(inferredColumn?.raw_header);
      if (Object.keys(inferredStyle).length === 0) return column;

      return {
        ...column,
        background_color: column.background_color ?? inferredColumn?.background_color,
        raw_header: {
          ...inferredStyle,
          ...(column.raw_header ?? {}),
        },
      };
    }),
    header_groups: tableBuilder.header_groups.map((group) => {
      const inferredGroup = inferredGroupsByKey.get(group.key);
      const inferredStyle = pickHeaderStyleMetadata(inferredGroup?.raw_header);
      if (Object.keys(inferredStyle).length === 0) return group;

      return {
        ...group,
        background_color: group.background_color ?? inferredGroup?.background_color,
        raw_header: {
          ...inferredStyle,
          ...(group.raw_header ?? {}),
        },
      };
    }),
  };
};

const shouldRebuildBuilderFromTemplate = (
  tableBuilder: ITableBuilderConfig,
  inferredBuilder: ITableBuilderConfig | null,
) => {
  if (!inferredBuilder) return false;

  const builderColumnSignatures = tableBuilder.columns.map(getBuilderColumnSignature);
  const inferredColumnSignatures = inferredBuilder.columns.map(getBuilderColumnSignature);
  if (!hasSameOrderedItems(builderColumnSignatures, inferredColumnSignatures)) return true;

  const builderBlockSignatures = tableBuilder.row_blocks.map(getBuilderBlockSignature);
  const inferredBlockSignatures = inferredBuilder.row_blocks.map(getBuilderBlockSignature);
  return !hasSameOrderedItems(builderBlockSignatures, inferredBlockSignatures);
};

const createDefaultCell = (
  column: ITableBuilderColumn,
  oldCell?: unknown,
  options: { applyColumnSource?: boolean; manualFields?: Set<string> } = {},
) => {
  const oldCellObject =
    oldCell && typeof oldCell === 'object' && !Array.isArray(oldCell) ? (oldCell as Record<string, unknown>) : null;
  const value =
    oldCellObject && 'value' in oldCellObject
      ? oldCellObject.value
      : oldCell !== undefined
        ? oldCell
        : (column.default_value ?? '');
  const cell: Record<string, unknown> = {
    ...(oldCellObject ?? {}),
    value,
    is_read_only: Boolean(column.read_only || column.computed_type || oldCellObject?.is_read_only),
  };
  const isManualField = options.manualFields?.has(column.key);
  const explicitTableField = getStringValue(oldCellObject?.table_field);
  const explicitLabelField = getStringValue(oldCellObject?.label_field);

  if (isManualField) {
    if (explicitTableField) {
      cell.table_field = explicitTableField;
      if (explicitLabelField) {
        cell.label_field = explicitLabelField;
      } else {
        delete cell.label_field;
      }
      cell.force_manual = false;
      return cell;
    }

    delete cell.table_field;
    delete cell.label_field;
    delete cell.resolve_from_context;
    delete cell.resolveFromContext;
    delete cell.context_source;
    delete cell.contextSource;
    delete cell.sync_record_trigger;
    delete cell.syncRecordTrigger;
    delete cell.source_table;
    delete cell.source_record_id;
    cell.is_read_only = false;
    cell.force_manual = true;
    return cell;
  }

  if (options.applyColumnSource !== false && column.table_field && !column.computed_type) {
    cell.table_field = column.table_field;
    if (column.label_field) {
      cell.label_field = column.label_field;
    } else {
      delete cell.label_field;
    }
  } else if (options.applyColumnSource !== false && explicitTableField) {
    cell.table_field = explicitTableField;
    if (explicitLabelField) {
      cell.label_field = explicitLabelField;
    } else {
      delete cell.label_field;
    }
  } else if (options.applyColumnSource !== false) {
    delete cell.table_field;
    delete cell.label_field;
    delete cell.resolve_from_context;
    delete cell.resolveFromContext;
    delete cell.context_source;
    delete cell.contextSource;
    delete cell.sync_record_trigger;
    delete cell.syncRecordTrigger;
  }

  return cell;
};

const syncBuilderRowWithColumns = (
  row: Record<string, unknown> | null | undefined,
  columns: ITableBuilderColumn[],
  options: { applyColumnSource?: boolean; manualFields?: Set<string> } = {},
): Record<string, unknown> => {
  const sourceRow = row ?? {};
  const nextRow: Record<string, unknown> = {};

  ['id', 'type', '_source_ids', 'cell_merge', 'row_button_config'].forEach((metadataKey) => {
    if (metadataKey in sourceRow) {
      nextRow[metadataKey] = sourceRow[metadataKey];
    }
  });

  columns.forEach((column) => {
    nextRow[column.key] = createDefaultCell(column, sourceRow[column.key], options);
  });

  return nextRow;
};

const collectLeafColumnIds = (
  groupId: string,
  groups: ITableBuilderHeaderGroup[],
  columns: ITableBuilderColumn[],
): string[] => {
  const directColumnIds = columns.filter((column) => column.header_group_id === groupId).map((column) => column.id);
  const childColumnIds = groups
    .filter((group) => group.parent_group_id === groupId)
    .flatMap((group) => collectLeafColumnIds(group.id, groups, columns));
  return [...directColumnIds, ...childColumnIds];
};

const getGroupDepth = (group: ITableBuilderHeaderGroup, groupsById: Map<string, ITableBuilderHeaderGroup>) => {
  let depth = 0;
  let current: ITableBuilderHeaderGroup | undefined = group;
  const seen = new Set<string>();

  while (current?.parent_group_id && !seen.has(current.parent_group_id)) {
    seen.add(current.id);
    const parent = groupsById.get(current.parent_group_id);
    if (!parent) break;
    depth += 1;
    current = parent;
  }

  return Math.min(depth, 1);
};

const getColumnGroupChainLength = (column: ITableBuilderColumn, groupsById: Map<string, ITableBuilderHeaderGroup>) => {
  let count = 0;
  let group = column.header_group_id ? groupsById.get(column.header_group_id) : undefined;
  const seen = new Set<string>();

  while (group && !seen.has(group.id)) {
    seen.add(group.id);
    count += 1;
    group = group.parent_group_id ? groupsById.get(group.parent_group_id) : undefined;
  }

  return Math.min(count, 2);
};

const buildHeaderOrder = (builder: ITableBuilderConfig) => {
  const groupsById = new Map(builder.header_groups.map((group) => [group.id, group]));
  const firstColumnIndexByGroup = new Map<string, number>();
  const isColumnItem = (item: ITableBuilderColumn | ITableBuilderHeaderGroup): item is ITableBuilderColumn =>
    builder.columns.some((column) => column.id === item.id);
  const getItemIndex = (item: ITableBuilderColumn | ITableBuilderHeaderGroup) =>
    isColumnItem(item)
      ? builder.columns.findIndex((column) => column.id === item.id)
      : (firstColumnIndexByGroup.get(item.id) ?? Number.MAX_SAFE_INTEGER);

  builder.header_groups.forEach((group) => {
    const leafColumnIds = collectLeafColumnIds(group.id, builder.header_groups, builder.columns);
    const firstIndex = builder.columns.findIndex((column) => leafColumnIds.includes(column.id));
    firstColumnIndexByGroup.set(group.id, firstIndex < 0 ? Number.MAX_SAFE_INTEGER : firstIndex);
  });

  const appendGroup = (group: ITableBuilderHeaderGroup, headers: TableTemplateHeader[], maxHeaderDepth: number) => {
    const parentGroup = group.parent_group_id ? groupsById.get(group.parent_group_id) : null;
    const leafColumnIds = collectLeafColumnIds(group.id, builder.header_groups, builder.columns);
    const groupDepth = getGroupDepth(group, groupsById);
    headers.push({
      ...(group.raw_header ?? {}),
      label: group.label,
      key: group.key,
      is_parent_header: true,
      read_only: true,
      parent: parentGroup?.key,
      colspan: Math.max(1, leafColumnIds.length),
      rowspan: leafColumnIds.length === 0 ? Math.max(1, maxHeaderDepth - groupDepth) : undefined,
      background_color: group.background_color || DEFAULT_HEADER_BACKGROUND,
    });

    const childGroups = builder.header_groups
      .filter((childGroup) => childGroup.parent_group_id === group.id)
      .sort((a, b) => (firstColumnIndexByGroup.get(a.id) ?? 0) - (firstColumnIndexByGroup.get(b.id) ?? 0));
    const childColumns = builder.columns.filter((column) => column.header_group_id === group.id);

    [...childGroups, ...childColumns]
      .sort((a, b) => getItemIndex(a) - getItemIndex(b))
      .forEach((child) => {
        if (isColumnItem(child)) {
          headers.push(buildLeafHeader(child, builder, maxHeaderDepth));
        } else {
          appendGroup(child, headers, maxHeaderDepth);
        }
      });
  };

  const buildLeafHeader = (
    column: ITableBuilderColumn,
    sourceBuilder: ITableBuilderConfig,
    maxHeaderDepth: number,
  ): TableTemplateHeader => {
    const group = column.header_group_id ? groupsById.get(column.header_group_id) : null;
    const groupDepth = getColumnGroupChainLength(column, groupsById);
    const rowSpan = Math.max(1, maxHeaderDepth - groupDepth);
    const header: TableTemplateHeader = {
      ...(column.raw_header ?? {}),
      label: column.label,
      key: column.key,
      width: column.width,
      input_type: column.input_type || 'Data',
      parent: group?.key,
      rowspan: rowSpan > 1 ? rowSpan : undefined,
      read_only: Boolean(column.read_only || column.computed_type),
      is_required: Boolean(column.is_required),
      background_color: column.background_color || DEFAULT_HEADER_BACKGROUND,
    };

    if (column.table_field && !column.computed_type) {
      header.table_field = column.table_field;
      if (column.label_field) {
        header.label_field = column.label_field;
      } else {
        delete header.label_field;
      }
    } else {
      delete header.table_field;
      delete header.label_field;
    }
    if (column.computed_type) {
      header.computed_type = column.computed_type;
      header.computed_from = column.computed_from ?? [];
    }

    if (!sourceBuilder.header_groups.length) {
      delete header.rowspan;
      delete header.parent;
    }

    return header;
  };

  const maxHeaderDepth = Math.max(
    1,
    ...builder.columns.map((column) => getColumnGroupChainLength(column, groupsById) + 1),
  );
  const headers: TableTemplateHeader[] = [];
  const topLevelGroups = builder.header_groups
    .filter((group) => !group.parent_group_id)
    .sort((a, b) => (firstColumnIndexByGroup.get(a.id) ?? 0) - (firstColumnIndexByGroup.get(b.id) ?? 0));

  const topLevelItems = [...topLevelGroups, ...builder.columns.filter((column) => !column.header_group_id)].sort(
    (a, b) => getItemIndex(a) - getItemIndex(b),
  );

  topLevelItems.forEach((item) => {
    if (isColumnItem(item)) {
      headers.push(buildLeafHeader(item, builder, maxHeaderDepth));
    } else {
      appendGroup(item, headers, maxHeaderDepth);
    }
  });

  return headers;
};

const createRowFetchConfigFromBlock = (block: ITableBuilderRowBlock, columns: ITableBuilderColumn[]) => {
  if (!block.row_fetch_config) return undefined;
  const config = cloneTableDesignerValue(block.row_fetch_config);
  if (!Array.isArray(config.fields_to_fetch)) {
    config.fields_to_fetch = columns
      .map((column) => {
        const source = parseTableDesignerField(column.table_field);
        if (!source.table || !source.field) return null;
        return {
          key: column.key,
          table: source.table,
          field: source.field,
        };
      })
      .filter(Boolean);
  }
  return config;
};

export const createFetchConfigFromColumns = (
  columns: ITableBuilderColumn[],
  triggerColumnKey?: string,
  primaryTable?: string,
) => {
  const sourceColumns = columns.filter((column) => parseTableDesignerField(column.table_field).table);
  const fallbackTriggerColumn = sourceColumns[0];
  const triggerColumn = columns.find((column) => column.key === triggerColumnKey) ?? fallbackTriggerColumn;
  const triggerSource = parseTableDesignerField(triggerColumn?.table_field);
  const normalizedPrimaryTable =
    primaryTable || triggerSource.table || parseTableDesignerField(sourceColumns[0]?.table_field).table;

  return {
    trigger_field: triggerColumn?.key || columns[0]?.key || '',
    primary_table: normalizedPrimaryTable || '',
    join_table: normalizedPrimaryTable || '',
    join_conditions: [],
    fields_to_fetch: sourceColumns.map((column) => {
      const source = parseTableDesignerField(column.table_field);
      return {
        key: column.key,
        table: source.table,
        field: source.field,
      };
    }),
  };
};

export const compileTableBuilderToTemplate = (
  builder: ITableBuilderConfig,
  baseTemplate?: TableTemplate | null,
): TableTemplate => {
  const headers = buildHeaderOrder(builder);
  const columns = builder.columns;
  const blocks: TableTemplateBlock[] = builder.row_blocks.map((block) => {
    const hasDataRows = Boolean(block.row_template || block.rows?.length || block.row_fetch_config);
    const manualFields = new Set(block.manual_fields ?? []);
    const button_config = {
      show_add_row_button: block.allow_add_row !== false,
      show_copy_button: block.allow_copy_row !== false,
      show_delete_button: block.allow_delete_row !== false,
    };

    if (block.type === 'section') {
      const subsection = syncBuilderRowWithColumns(block.subsection_values ?? {}, columns, {
        applyColumnSource: false,
        manualFields,
      });
      subsection.type = 'subsection';
      if (!hasDataRows) {
        columns.forEach((column) => {
          const cell = subsection[column.key];
          subsection[column.key] = {
            ...((cell && typeof cell === 'object' && !Array.isArray(cell) ? cell : { value: cell ?? '' }) as Record<
              string,
              unknown
            >),
            is_read_only: manualFields.has(column.key) ? false : true,
            ...(manualFields.has(column.key) ? { force_manual: true } : {}),
          };
        });
      }
      const merge_column_key = block.merge_column_key || columns[0]?.key;
      if (merge_column_key) {
        const mergeColspan = Math.min(Math.max(1, block.merge_colspan || columns.length || 1), columns.length || 1);
        subsection[merge_column_key] = {
          ...((subsection[merge_column_key] && typeof subsection[merge_column_key] === 'object'
            ? subsection[merge_column_key]
            : {}) as Record<string, unknown>),
          value: block.label,
          is_read_only: manualFields.has(merge_column_key) ? false : true,
          ...(manualFields.has(merge_column_key) ? { force_manual: true } : {}),
        };
        if (mergeColspan > 1) {
          subsection.cell_merge = {
            ...((subsection.cell_merge && typeof subsection.cell_merge === 'object'
              ? subsection.cell_merge
              : {}) as Record<string, unknown>),
            [merge_column_key]: {
              colspan: mergeColspan,
            },
          };
        } else if (subsection.cell_merge && typeof subsection.cell_merge === 'object') {
          const nextCellMerge = { ...(subsection.cell_merge as Record<string, unknown>) };
          delete nextCellMerge[merge_column_key];
          if (Object.keys(nextCellMerge).length > 0) {
            subsection.cell_merge = nextCellMerge;
          } else {
            delete subsection.cell_merge;
          }
        }
      }
      const row_template = block.row_template
        ? syncBuilderRowWithColumns(block.row_template, columns, { manualFields })
        : undefined;
      const rows = Array.isArray(block.rows)
        ? block.rows.map(
            (row) =>
              syncBuilderRowWithColumns(row as Record<string, unknown>, columns, { manualFields }) as TableTemplateRow,
          )
        : [];

      return {
        ...(block.raw_block ?? {}),
        id: block.id,
        manual_fields: block.manual_fields?.length ? block.manual_fields : undefined,
        subsection: subsection as TableTemplateBlock['subsection'],
        ...(row_template ? { row_template } : {}),
        rows,
        ...(block.row_fetch_config ? { row_fetch_config: createRowFetchConfigFromBlock(block, columns) } : {}),
        button_config: {
          show_add_row_button: hasDataRows ? block.allow_add_row !== false : false,
          show_copy_button: block.allow_copy_row !== false,
          show_delete_button: block.allow_delete_row !== false,
        },
      };
    }

    const row_template = syncBuilderRowWithColumns(block.row_template ?? {}, columns, { manualFields });
    const rows = Array.isArray(block.rows)
      ? block.rows.map(
          (row) =>
            syncBuilderRowWithColumns(row as Record<string, unknown>, columns, { manualFields }) as TableTemplateRow,
        )
      : [];

    return {
      ...(block.raw_block ?? {}),
      id: block.id,
      manual_fields: block.manual_fields?.length ? block.manual_fields : undefined,
      subsection: null,
      row_template,
      rows,
      row_fetch_config: createRowFetchConfigFromBlock(block, columns),
      button_config,
    };
  });

  return {
    ...(baseTemplate ?? {}),
    id: builder.id,
    name: builder.name,
    description: builder.description || baseTemplate?.description,
    structure: {
      ...(baseTemplate?.structure ?? {}),
      headers,
      blocks,
      show_add_row_button: builder.options.show_add_row_button !== false,
      show_copy_button: builder.options.show_copy_button !== false,
      show_delete_button: builder.options.show_delete_button !== false,
    },
  };
};

export const createDefaultTableBuilder = (tableTemplate?: TableTemplate | null): ITableBuilderConfig => {
  const tableId = tableTemplate?.id || 'custom_table_variable';
  const tableName = tableTemplate?.name || 'Bảng mới';

  return {
    version: BUILDER_VERSION,
    id: tableId,
    name: tableName,
    description: tableTemplate?.description,
    columns: [
      {
        id: createTableDesignerId('column'),
        key: 'label',
        label: 'Nội dung',
        width: '40%',
        input_type: 'Data',
      },
      {
        id: createTableDesignerId('column'),
        key: 'value',
        label: 'Giá trị',
        width: '60%',
        input_type: 'Data',
      },
    ],
    header_groups: [],
    row_blocks: [
      {
        id: 'main',
        type: 'rows',
        label: 'Dòng dữ liệu',
        allow_add_row: true,
        allow_copy_row: true,
        allow_delete_row: true,
        row_template: {},
        rows: [],
      },
    ],
    options: {
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
  };
};

export const createTableBuilderFromTemplate = (tableTemplate?: TableTemplate | null): ITableBuilderConfig => {
  const normalizedTableTemplate = tableTemplate
    ? normalizeDynamicGroupedTemplateForDesigner(tableTemplate)
    : tableTemplate;

  if (!normalizedTableTemplate?.structure?.headers?.length) {
    return createDefaultTableBuilder(normalizedTableTemplate);
  }

  const headers = normalizedTableTemplate.structure.headers;
  const templateBlocks = normalizedTableTemplate.structure.blocks ?? [];
  const parentHeaders = headers.filter((header) => header.is_parent_header);
  const header_groups: ITableBuilderHeaderGroup[] = parentHeaders.map((header) => ({
    id: header.key,
    key: header.key,
    label: header.label || header.key,
    parent_group_id: header.parent || null,
    background_color: header.background_color,
    raw_header: cloneTableDesignerValue(header),
  }));
  const groupIdByKey = new Map(header_groups.map((group) => [group.key, group.id]));
  const columns: ITableBuilderColumn[] = headers
    .filter((header) => !header.is_parent_header)
    .map((header) => {
      const sourceConfig = getColumnSourceConfig(header, templateBlocks);
      return {
        id: header.key,
        key: header.key,
        label: header.label || header.key,
        width: header.width,
        input_type: (header.input_type as TTemplateVariableInputType | undefined) || 'Data',
        header_group_id: header.parent ? (groupIdByKey.get(header.parent) ?? header.parent) : null,
        table_field: sourceConfig.table_field,
        label_field: sourceConfig.label_field,
        computed_type: header.computed_type || null,
        computed_from: Array.isArray(header.computed_from) ? (header.computed_from as string[]) : [],
        read_only: Boolean(header.read_only),
        is_required: Boolean(header.is_required),
        background_color: header.background_color,
        raw_header: cloneTableDesignerValue(header),
      };
    });

  const row_blocks: ITableBuilderRowBlock[] = templateBlocks.map((block, index) => {
    if (block.subsection) {
      const hasDataRows = Boolean(block.row_template || block.rows?.length || block.row_fetch_config);
      const subsection = block.subsection as Record<string, unknown>;
      const firstCell = getFirstSubsectionCell(subsection, columns);
      const cell_merge =
        subsection.cell_merge && typeof subsection.cell_merge === 'object'
          ? (subsection.cell_merge as Record<string, { colspan?: number }>)
          : {};

      return {
        id: block.id || `section_${index + 1}`,
        type: 'section',
        label: firstCell.value || `Nhóm ${index + 1}`,
        merge_column_key: firstCell.key || columns[0]?.key || null,
        merge_colspan: cell_merge[firstCell.key]?.colspan || (hasDataRows ? 1 : columns.length || 1),
        allow_add_row: block.button_config?.show_add_row_button !== false,
        allow_copy_row: block.button_config?.show_copy_button !== false,
        allow_delete_row: block.button_config?.show_delete_button !== false,
        manual_fields: getBlockManualFields(block, columns),
        subsection_values: cloneTableDesignerValue(subsection),
        row_template: block.row_template ? cloneTableDesignerValue(block.row_template) : null,
        rows: Array.isArray(block.rows) ? cloneTableDesignerValue(block.rows) : [],
        row_fetch_config: block.row_fetch_config ? cloneTableDesignerValue(block.row_fetch_config) : null,
        raw_block: cloneTableDesignerValue(block),
      };
    }

    return {
      id: block.id || `rows_${index + 1}`,
      type: 'rows',
      label: block.id || `Dòng dữ liệu ${index + 1}`,
      allow_add_row: block.button_config?.show_add_row_button !== false,
      allow_copy_row: block.button_config?.show_copy_button !== false,
      allow_delete_row: block.button_config?.show_delete_button !== false,
      manual_fields: getBlockManualFields(block, columns),
      row_template: block.row_template ? cloneTableDesignerValue(block.row_template) : {},
      rows: Array.isArray(block.rows) ? cloneTableDesignerValue(block.rows) : [],
      row_fetch_config: block.row_fetch_config ? cloneTableDesignerValue(block.row_fetch_config) : null,
      raw_block: cloneTableDesignerValue(block),
    };
  });

  return {
    version: BUILDER_VERSION,
    id: normalizedTableTemplate.id || 'custom_table_variable',
    name: normalizedTableTemplate.name || normalizedTableTemplate.id || 'Bảng mới',
    description: normalizedTableTemplate.description,
    columns: columns.length ? columns : createDefaultTableBuilder(normalizedTableTemplate).columns,
    header_groups,
    row_blocks: row_blocks.length ? row_blocks : createDefaultTableBuilder(normalizedTableTemplate).row_blocks,
    options: {
      show_add_row_button: normalizedTableTemplate.structure.show_add_row_button !== false,
      show_copy_button: normalizedTableTemplate.structure.show_copy_button !== false,
      show_delete_button: normalizedTableTemplate.structure.show_delete_button !== false,
    },
  };
};

export const normalizeTableBuilder = (
  tableBuilder: ITableBuilderConfig | null | undefined,
  tableTemplate?: TableTemplate | null,
) => {
  if (
    tableBuilder &&
    tableBuilder.version === BUILDER_VERSION &&
    Array.isArray(tableBuilder.columns) &&
    tableBuilder.columns.length > 0 &&
    Array.isArray(tableBuilder.row_blocks)
  ) {
    const inferredBuilder = tableTemplate ? createTableBuilderFromTemplate(tableTemplate) : null;
    const inferredManualFieldsByBlockId = new Map(
      (inferredBuilder?.row_blocks ?? []).map((block) => [block.id, block.manual_fields ?? []]),
    );

    if (shouldRebuildBuilderFromTemplate(tableBuilder, inferredBuilder)) {
      return inferredBuilder as ITableBuilderConfig;
    }

    return mergeBuilderStyleMetadata(
      {
        ...tableBuilder,
        header_groups: Array.isArray(tableBuilder.header_groups) ? tableBuilder.header_groups : [],
        row_blocks: tableBuilder.row_blocks.map((block) => ({
          ...block,
          manual_fields: Array.isArray(block.manual_fields)
            ? block.manual_fields
            : (inferredManualFieldsByBlockId.get(block.id) ?? []),
        })),
        options: tableBuilder.options ?? {},
      },
      inferredBuilder,
    );
  }

  return createTableBuilderFromTemplate(tableTemplate);
};

export const createTableDesignerColumn = (
  builder: ITableBuilderConfig,
  patch: Partial<ITableBuilderColumn> = {},
): ITableBuilderColumn => {
  const label = patch.label || `Cột ${builder.columns.length + 1}`;
  return {
    id: createTableDesignerId('column'),
    key: getUniqueKey(
      builder.columns.map((column) => column.key),
      patch.key || label,
    ),
    label,
    width: patch.width || '12%',
    input_type: patch.input_type || 'Data',
    header_group_id: patch.header_group_id ?? null,
    table_field: patch.table_field ?? null,
    label_field: patch.label_field ?? null,
    computed_type: patch.computed_type ?? null,
    computed_from: patch.computed_from ?? [],
    read_only: patch.read_only ?? false,
    is_required: patch.is_required ?? false,
    background_color: patch.background_color || DEFAULT_HEADER_BACKGROUND,
  };
};

export const createTableDesignerGroup = (
  builder: ITableBuilderConfig,
  patch: Partial<ITableBuilderHeaderGroup> = {},
): ITableBuilderHeaderGroup => {
  const label = patch.label || `Nhóm cột ${builder.header_groups.length + 1}`;
  return {
    id: createTableDesignerId('group'),
    key: getUniqueKey(
      builder.header_groups.map((group) => group.key),
      patch.key || label,
    ),
    label,
    parent_group_id: patch.parent_group_id ?? null,
    background_color: patch.background_color || DEFAULT_HEADER_BACKGROUND,
  };
};

export const createTableDesignerBlock = (
  builder: ITableBuilderConfig,
  type: 'section' | 'rows',
): ITableBuilderRowBlock => {
  if (type === 'section') {
    return {
      id: createTableDesignerId('section'),
      type,
      label: `Nhóm ${builder.row_blocks.length + 1}`,
      merge_column_key: builder.columns[0]?.key || null,
      merge_colspan: Math.min(3, builder.columns.length || 1),
      allow_add_row: false,
      allow_copy_row: true,
      allow_delete_row: true,
      subsection_values: {},
    };
  }

  return {
    id: createTableDesignerId('rows'),
    type,
    label: `Dòng dữ liệu ${builder.row_blocks.length + 1}`,
    allow_add_row: true,
    allow_copy_row: true,
    allow_delete_row: true,
    row_template: {},
    rows: [],
  };
};
