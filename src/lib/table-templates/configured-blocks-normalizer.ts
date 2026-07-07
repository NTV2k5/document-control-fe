import type { TableTemplate, TableTemplateBlock, TableTemplateHeader, TableTemplateRow } from './table-templates';

type TConfiguredBlockKind = 'title' | 'summary' | 'rows';

type TConfiguredBlockConfig = {
  kind: TConfiguredBlockKind;
  id: string;
  label: string;
  sourceBlockIds: string[];
  manualFields: string[];
  defaultValues: Record<string, unknown>;
  rowFetchConfig?: Record<string, unknown>;
};

type TConfiguredComputedType = 'sum' | 'percent';

type TConfiguredComputedField = {
  targetField: string;
  sourceFields: string[];
  computedType: TConfiguredComputedType;
};

const getObjectValue = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const getRuleObjectValue = (rule: Record<string, unknown> | null | undefined, key: string) =>
  getObjectValue(rule?.[key]) ?? {};

const getRuleStringValue = (rule: Record<string, unknown> | null | undefined, key: string, fallback: string) => {
  const value = rule?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const getRuleNumberValue = (rule: Record<string, unknown> | null | undefined, key: string, fallback: number) => {
  const value = rule?.[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stringArrayFromUnknown = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];

const firstStringConfig = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const firstStringArrayConfig = (...values: unknown[]) => {
  for (const value of values) {
    const list = stringArrayFromUnknown(value);
    if (list.length > 0) return list;
  }
  return [];
};

const getConfiguredBlockKind = (kind: unknown): TConfiguredBlockKind | null => {
  if (kind === 'title') return 'title';
  if (kind === 'summary') return 'summary';
  if (kind === 'rows' || kind === 'data' || kind === 'courses') return 'rows';
  return null;
};

const getConfiguredBlockConfigs = (renderRule?: Record<string, unknown> | null): TConfiguredBlockConfig[] => {
  const rawConfigs = Array.isArray(renderRule?.block_configs) ? renderRule.block_configs : [];

  return rawConfigs
    .map((rawConfig): TConfiguredBlockConfig | null => {
      const config = getObjectValue(rawConfig);
      if (!config) return null;

      const kind = getConfiguredBlockKind(config.kind);
      const id = typeof config.id === 'string' && config.id.trim() ? config.id.trim() : '';
      if (!kind || !id) return null;

      return {
        kind,
        id,
        label: typeof config.label === 'string' ? config.label : '',
        sourceBlockIds: firstStringArrayConfig(config.source_block_ids, config.source_course_block_ids),
        manualFields: [
          ...stringArrayFromUnknown(config.manual_fields ?? config.manualFields),
          ...stringArrayFromUnknown(config.editable_fields ?? config.editableFields),
        ],
        defaultValues: {
          ...getObjectValue(config.default_values),
          ...getObjectValue(config.defaultValues),
          ...(typeof config.default_required_type === 'string' ? { required_type: config.default_required_type } : {}),
          ...(typeof config.defaultRequiredType === 'string' ? { required_type: config.defaultRequiredType } : {}),
        },
        rowFetchConfig: getObjectValue(config.row_fetch_config ?? config.rowFetchConfig) ?? undefined,
      };
    })
    .filter((config): config is TConfiguredBlockConfig => Boolean(config));
};

const normalizeConfiguredComputedField = (
  value: unknown,
  mapFieldKey: (fieldKey: string) => string,
): TConfiguredComputedField | null => {
  const config = getObjectValue(value);
  if (!config) return null;

  const targetField = firstStringConfig(config.target_field, config.targetField, config.key);
  const sourceFields = firstStringArrayConfig(
    config.source_fields,
    config.sourceFields,
    config.computed_from,
    config.computedFrom,
  );
  const rawType = firstStringConfig(config.type, config.computed_type, config.computedType);

  if (!targetField || sourceFields.length === 0) return null;

  return {
    targetField: mapFieldKey(targetField),
    sourceFields: sourceFields.map(mapFieldKey),
    computedType: rawType === 'percent' ? 'percent' : 'sum',
  };
};

const getConfiguredComputedFields = (
  value: unknown,
  mapFieldKey: (fieldKey: string) => string,
): TConfiguredComputedField[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeConfiguredComputedField(item, mapFieldKey))
    .filter((item): item is TConfiguredComputedField => Boolean(item));
};

const dedupeConfiguredComputedFields = (fields: TConfiguredComputedField[]) => {
  const seen = new Set<string>();

  return fields.filter((field) => {
    const key = `${field.targetField}:${field.computedType}:${field.sourceFields.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const cellStringValue = (cell: unknown): string => {
  if (cell && typeof cell === 'object' && 'value' in cell) {
    const value = (cell as { value?: unknown }).value;
    return value === undefined || value === null ? '' : String(value);
  }
  return cell === undefined || cell === null ? '' : String(cell);
};

const editableCellWithValue = (
  value: string,
  previous?: unknown,
  tableField?: string,
  forceManual?: boolean,
  extraConfig?: Record<string, unknown>,
) => {
  const base = previous && typeof previous === 'object' ? { ...(previous as Record<string, unknown>) } : {};
  return {
    ...base,
    ...(extraConfig || {}),
    value,
    ...(tableField ? { table_field: tableField } : {}),
    is_read_only: false,
    ...(forceManual ? { force_manual: true } : {}),
  };
};

const readonlyCellWithValue = (
  value: string,
  previous?: unknown,
  tableField?: string,
  extraConfig?: Record<string, unknown>,
) => {
  const base = previous && typeof previous === 'object' ? { ...(previous as Record<string, unknown>) } : {};
  return {
    ...base,
    ...(extraConfig || {}),
    value,
    ...(tableField ? { table_field: tableField } : {}),
    is_read_only: true,
  };
};

const manualCellWithValue = (value: string, previous?: unknown) => {
  const base = previous && typeof previous === 'object' ? { ...(previous as Record<string, unknown>) } : {};
  delete base.table_field;
  delete base.label_field;
  delete base.source_table;
  delete base.source_record_id;

  return {
    ...base,
    value,
    is_read_only: false,
    force_manual: true,
  };
};

const manualLabelCellWithValue = (fallbackValue: string, previous?: unknown) => {
  const previousValue = cellStringValue(previous).trim();
  return manualCellWithValue(previousValue || fallbackValue, previous);
};

const splitTableField = (tableField: string) => {
  const [table, ...fieldParts] = tableField.split('.');
  return {
    table: table || '',
    field: fieldParts.join('.') || '',
  };
};

const getTemplateRenderRule = (template: TableTemplate, renderRule?: Record<string, unknown> | null) => {
  if (renderRule) return renderRule;
  const contextSchema = getObjectValue(template.context_schema ?? template.contextSchema);
  return getObjectValue(contextSchema?.render_rule);
};

const getMappedFieldKey = (fieldMap: Record<string, unknown>, semanticKey: string, fallback: string) =>
  getRuleStringValue(fieldMap, semanticKey, fallback);

const createFieldResolver = (
  renderRule: Record<string, unknown> | null | undefined,
  headers: TableTemplateHeader[],
) => {
  const fieldMap = getRuleObjectValue(renderRule, 'field_map');
  const tableFieldMap = getRuleObjectValue(renderRule, 'field_table_map');
  const semanticByFieldKey = new Map<string, string>();

  Object.entries(fieldMap).forEach(([semanticKey, fieldKey]) => {
    if (typeof fieldKey === 'string' && fieldKey.trim()) semanticByFieldKey.set(fieldKey.trim(), semanticKey);
  });

  const mapConfiguredFieldKey = (fieldKey: string) => {
    const mappedFieldKey = fieldMap[fieldKey];
    return typeof mappedFieldKey === 'string' && mappedFieldKey.trim() ? mappedFieldKey.trim() : fieldKey;
  };

  const getFieldTable = (fieldKey: string, fallback = '') => {
    const directTableField = tableFieldMap[fieldKey];
    if (typeof directTableField === 'string' && directTableField.trim()) return directTableField.trim();

    const semanticKey = semanticByFieldKey.get(fieldKey);
    const semanticTableField = semanticKey ? tableFieldMap[semanticKey] : undefined;
    if (typeof semanticTableField === 'string' && semanticTableField.trim()) return semanticTableField.trim();

    return fallback;
  };

  const headerByKey = new Map(headers.map((header) => [header.key, header]));
  const getFieldExtraConfig = (fieldKey: string) => {
    const labelField = headerByKey.get(fieldKey)?.label_field;
    return typeof labelField === 'string' && labelField.trim() ? { label_field: labelField.trim() } : undefined;
  };

  const getDefaultValueForField = (fieldKey: string, defaultValues: Record<string, unknown>) => {
    const directDefault = defaultValues[fieldKey];
    if (directDefault !== undefined) return directDefault;

    const semanticKey = semanticByFieldKey.get(fieldKey);
    return semanticKey ? defaultValues[semanticKey] : undefined;
  };

  return {
    fieldMap,
    mapConfiguredFieldKey,
    getFieldTable,
    getFieldExtraConfig,
    getDefaultValueForField,
  };
};

const getLabelFieldKey = (
  renderRule: Record<string, unknown> | null | undefined,
  leafHeaders: TableTemplateHeader[],
  fieldMap: Record<string, unknown>,
) => {
  const configured = getRuleStringValue(renderRule, 'label_field_key', '');
  if (configured) return configured;

  const mergeField = getRuleStringValue(renderRule, 'merge_field_key', '');
  if (mergeField) return mergeField;

  return getMappedFieldKey(fieldMap, 'stt', leafHeaders[0]?.key || 'stt');
};

const parseNumber = (value: unknown): number => {
  const raw = cellStringValue(value).trim();
  if (!raw) return 0;
  const normalized = raw.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
};

const getConfiguredRowFetchConfig = (
  renderRule: Record<string, unknown> | null | undefined,
  config: TConfiguredBlockConfig,
  leafHeaders: TableTemplateHeader[],
  getFieldTable: (fieldKey: string, fallback?: string) => string,
) => {
  const configuredRowFetchConfig = config.rowFetchConfig ?? getObjectValue(renderRule?.row_fetch_config);
  if (configuredRowFetchConfig && Object.keys(configuredRowFetchConfig).length > 0) {
    return configuredRowFetchConfig;
  }

  const sourceHeaders = leafHeaders
    .map((header) => ({ header, tableField: getFieldTable(header.key, header.table_field || '') }))
    .filter((item) => item.tableField);

  if (sourceHeaders.length < 2) return null;

  const trigger = sourceHeaders[1] ?? sourceHeaders[0];
  return {
    trigger_field: trigger.header.key,
    trigger_fields: sourceHeaders.slice(0, 2).map((item) => item.header.key),
    primary_table: splitTableField(trigger.tableField).table,
    join_table: splitTableField(trigger.tableField).table,
    join_conditions: [],
    fields_to_fetch: sourceHeaders.slice(0, 2).map((item) => {
      const source = splitTableField(item.tableField);
      return {
        key: item.header.key,
        table: source.table,
        field: source.field,
      };
    }),
  };
};

export const isConfiguredBlocksTemplate = (template?: TableTemplate | null) => {
  if (!template) return false;
  const renderRule = getTemplateRenderRule(template);
  return renderRule?.type === 'configured_blocks' && getConfiguredBlockConfigs(renderRule).length > 0;
};

export const normalizeConfiguredBlocksTemplate = (
  template: TableTemplate,
  explicitRenderRule?: Record<string, unknown> | null,
): TableTemplate => {
  const renderRule = getTemplateRenderRule(template, explicitRenderRule);
  const blockConfigs = getConfiguredBlockConfigs(renderRule);
  if (blockConfigs.length === 0) return template;

  const headers = template.structure.headers || [];
  const leafHeaders = headers.filter((header) => !header.is_parent_header);
  const { fieldMap, mapConfiguredFieldKey, getFieldTable, getFieldExtraConfig, getDefaultValueForField } =
    createFieldResolver(renderRule, headers);
  const templateBehavior = getObjectValue(template.behavior);
  const structureBehavior = getObjectValue(template.structure.behavior);
  const computedFields = dedupeConfiguredComputedFields([
    ...headers
      .filter((header) => Array.isArray(header.computed_from) && header.computed_from.length > 0)
      .map((header) =>
        normalizeConfiguredComputedField(
          {
            target_field: header.key,
            source_fields: header.computed_from,
            computed_type: header.computed_type,
          },
          mapConfiguredFieldKey,
        ),
      )
      .filter((item): item is TConfiguredComputedField => Boolean(item)),
    ...getConfiguredComputedFields(
      templateBehavior?.computed_fields ?? templateBehavior?.computedFields,
      mapConfiguredFieldKey,
    ),
    ...getConfiguredComputedFields(
      structureBehavior?.computed_fields ?? structureBehavior?.computedFields,
      mapConfiguredFieldKey,
    ),
    ...getConfiguredComputedFields(renderRule?.computed_fields ?? renderRule?.computedFields, mapConfiguredFieldKey),
    ...getConfiguredComputedFields(
      renderRule?.row_computed_fields ?? renderRule?.rowComputedFields,
      mapConfiguredFieldKey,
    ),
  ]);
  const labelFieldKey = getLabelFieldKey(renderRule, leafHeaders, fieldMap);
  const titleMergeColspan = Math.max(
    1,
    Math.floor(getRuleNumberValue(renderRule, 'title_merge_colspan', leafHeaders.length || 1)),
  );
  const summaryMergeColspan = Math.max(1, Math.floor(getRuleNumberValue(renderRule, 'summary_merge_colspan', 1)));
  const summaryValueFields = firstStringArrayConfig(
    renderRule?.summary_value_fields,
    renderRule?.summaryValueFields,
    renderRule?.computed_summary_fields,
    renderRule?.computedSummaryFields,
    ['credits', 'lecture', 'practice'],
  ).map(mapConfiguredFieldKey);
  const globalSummaryManualFields = new Set(
    [
      ...stringArrayFromUnknown(renderRule?.summary_manual_fields),
      ...stringArrayFromUnknown(renderRule?.summaryManualFields),
      ...stringArrayFromUnknown(renderRule?.summary_editable_fields),
    ].map(mapConfiguredFieldKey),
  );
  const getSummaryManualFields = (config: TConfiguredBlockConfig) =>
    new Set([...globalSummaryManualFields, ...config.manualFields.map(mapConfiguredFieldKey)]);
  const getRowManualFields = (config: TConfiguredBlockConfig) =>
    new Set(config.manualFields.map(mapConfiguredFieldKey));

  const applyComputedFieldsToRow = (rowData: Record<string, unknown>) => {
    if (computedFields.length === 0) return rowData;

    const updatedRow = { ...rowData };

    computedFields.forEach((computedField) => {
      const sourceValues = computedField.sourceFields.map((sourceField) => updatedRow[sourceField]);
      const hasAnySourceValue = sourceValues.some((value) => cellStringValue(value).trim() !== '');
      let computedValue = '';

      if (hasAnySourceValue && computedField.computedType === 'percent') {
        const numerator = parseNumber(sourceValues[0]);
        const denominator = parseNumber(sourceValues[1]);
        computedValue = denominator !== 0 ? `${formatNumber((numerator / denominator) * 100)}%` : '';
      } else if (hasAnySourceValue) {
        computedValue = formatNumber(sourceValues.reduce<number>((acc, value) => acc + parseNumber(value), 0));
      }

      const previous = updatedRow[computedField.targetField];
      updatedRow[computedField.targetField] =
        previous && typeof previous === 'object'
          ? {
              ...(previous as Record<string, unknown>),
              value: computedValue,
              is_read_only: true,
              force_manual: false,
            }
          : {
              value: computedValue,
              is_read_only: true,
              force_manual: false,
            };
    });

    return updatedRow;
  };

  const oldBlocks = template.structure.blocks || [];
  const oldBlocksById = new Map(
    oldBlocks.filter((block) => typeof block.id === 'string' && block.id).map((block) => [String(block.id), block]),
  );
  const deletedConfiguredBlockIds = new Set(
    [
      ...stringArrayFromUnknown(structureBehavior?.deleted_configured_block_ids),
      ...stringArrayFromUnknown(structureBehavior?.deletedConfiguredBlockIds),
    ].map(String),
  );

  const normalizeRowCell = (
    fieldKey: string,
    previous: unknown,
    manualFields: Set<string>,
    defaultValues: Record<string, unknown>,
  ) => {
    const defaultValue = getDefaultValueForField(fieldKey, defaultValues);
    const value =
      cellStringValue(previous) || (defaultValue === undefined || defaultValue === null ? '' : String(defaultValue));

    if (manualFields.has(fieldKey)) return manualCellWithValue(value, previous);

    const tableField = getFieldTable(
      fieldKey,
      leafHeaders.find((header) => header.key === fieldKey)?.table_field || '',
    );
    const extraConfig = getFieldExtraConfig(fieldKey);
    return editableCellWithValue(value, previous, tableField, false, extraConfig);
  };

  const normalizeBlockRows = (config: TConfiguredBlockConfig, existingBlock?: TableTemplateBlock) => {
    const rowTemplateBase = getObjectValue(existingBlock?.row_template) ?? {};
    const manualFields = getRowManualFields(config);

    const normalizedRowTemplate = applyComputedFieldsToRow({
      ...rowTemplateBase,
      ...Object.fromEntries(
        leafHeaders.map((header) => [
          header.key,
          normalizeRowCell(header.key, rowTemplateBase[header.key], manualFields, config.defaultValues),
        ]),
      ),
    });
    const normalizedRows = (existingBlock?.rows || []).map((row, rowIdx) => {
      const rowData = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return applyComputedFieldsToRow({
        ...rowData,
        id: (typeof rowData.id === 'string' && rowData.id) || `${config.id}_row_${rowIdx + 1}`,
        ...Object.fromEntries(
          leafHeaders.map((header) => [
            header.key,
            normalizeRowCell(header.key, rowData[header.key], manualFields, config.defaultValues),
          ]),
        ),
      });
    });
    const rowFetchConfig = getConfiguredRowFetchConfig(renderRule, config, leafHeaders, getFieldTable);

    return {
      rowTemplate: normalizedRowTemplate,
      rows: normalizedRows as unknown as TableTemplateRow[],
      rowFetchConfig,
    };
  };

  const rowBlockMap = new Map<string, TableTemplateBlock>();
  const isTotalLikeBlock = (config: TConfiguredBlockConfig) => {
    const id = config.id.toLowerCase();
    const label = config.label.toLowerCase();
    return id.includes('total') || label.includes('tổng') || label.includes('tong');
  };
  const shouldShowSectionAddRowButton = (config: TConfiguredBlockConfig, configIndex: number) => {
    if (isTotalLikeBlock(config)) return false;

    const nextConfig = blockConfigs[configIndex + 1];
    const nextBlockIsDirectSourceRows = nextConfig?.kind === 'rows' && config.sourceBlockIds.includes(nextConfig.id);

    return !nextBlockIsDirectSourceRows;
  };

  blockConfigs.forEach((config) => {
    if (config.kind !== 'rows') return;

    const existingBlock = oldBlocksById.get(config.id);
    const { rowTemplate, rows, rowFetchConfig } = normalizeBlockRows(config, existingBlock);

    rowBlockMap.set(config.id, {
      id: config.id,
      subsection: null,
      rows,
      row_template: rowTemplate,
      ...(rowFetchConfig ? { row_fetch_config: rowFetchConfig } : {}),
      button_config: {
        show_add_row_button: existingBlock?.button_config?.show_add_row_button ?? true,
        show_copy_button: existingBlock?.button_config?.show_copy_button ?? true,
        show_delete_button: existingBlock?.button_config?.show_delete_button ?? true,
      },
    });
  });

  const summaryTotalsByBlockId = new Map<string, Record<string, number>>();

  const sumBySourceBlockIds = (sourceBlockIds: string[]) =>
    sourceBlockIds.reduce<Record<string, number>>((acc, blockId) => {
      if (deletedConfiguredBlockIds.has(blockId)) return acc;

      const block = rowBlockMap.get(blockId);
      const rows = Array.isArray(block?.rows) ? block.rows : [];
      const summaryTotals = summaryTotalsByBlockId.get(blockId);

      if (summaryTotals) {
        summaryValueFields.forEach((fieldKey) => {
          acc[fieldKey] = (acc[fieldKey] || 0) + (summaryTotals[fieldKey] || 0);
        });
      }

      rows.forEach((row) => {
        const rowData = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
        summaryValueFields.forEach((fieldKey) => {
          acc[fieldKey] = (acc[fieldKey] || 0) + parseNumber(rowData[fieldKey]);
        });
      });
      return acc;
    }, {});

  const createSummaryCell = (
    fieldKey: string,
    manualFields: Set<string>,
    computedValue: string,
    previous?: unknown,
  ) => {
    const tableField = getFieldTable(
      fieldKey,
      leafHeaders.find((header) => header.key === fieldKey)?.table_field || '',
    );
    if (!manualFields.has(fieldKey)) return readonlyCellWithValue(computedValue, previous, tableField);

    const hasPreviousCell = previous !== undefined && previous !== null;
    const previousValue = cellStringValue(previous);
    return manualCellWithValue(hasPreviousCell ? previousValue : computedValue, previous);
  };

  const createReadonlySubsectionCell = (fieldKey: string, previous: unknown) =>
    readonlyCellWithValue(
      '',
      previous,
      getFieldTable(fieldKey, leafHeaders.find((header) => header.key === fieldKey)?.table_field || ''),
      getFieldExtraConfig(fieldKey),
    );

  const createSubsectionCells = (
    subsectionBase: Record<string, unknown>,
    config: TConfiguredBlockConfig,
    manualFields: Set<string>,
    totals?: Record<string, number>,
  ) =>
    Object.fromEntries(
      leafHeaders.map((header) => {
        if (header.key === labelFieldKey) {
          return [header.key, manualLabelCellWithValue(config.label, subsectionBase[header.key])];
        }

        if (totals && summaryValueFields.includes(header.key)) {
          return [
            header.key,
            createSummaryCell(
              header.key,
              manualFields,
              formatNumber(totals[header.key] || 0),
              subsectionBase[header.key],
            ),
          ];
        }

        if (manualFields.has(header.key)) {
          return [
            header.key,
            manualCellWithValue(cellStringValue(subsectionBase[header.key]), subsectionBase[header.key]),
          ];
        }

        return [header.key, createReadonlySubsectionCell(header.key, subsectionBase[header.key])];
      }),
    );

  const configuredBlocks = blockConfigs.flatMap((config, configIndex) => {
    if (deletedConfiguredBlockIds.has(config.id)) return [];

    if (config.kind === 'rows') {
      return rowBlockMap.get(config.id) ? [rowBlockMap.get(config.id) as TableTemplateBlock] : [];
    }

    const existing = oldBlocksById.get(config.id);
    const subsectionBase =
      existing?.subsection && typeof existing.subsection === 'object'
        ? (existing.subsection as Record<string, unknown>)
        : ({ type: 'subsection' } as Record<string, unknown>);
    const manualFields =
      config.kind === 'summary'
        ? getSummaryManualFields(config)
        : new Set(config.manualFields.map(mapConfiguredFieldKey));
    const totals = config.kind === 'summary' ? sumBySourceBlockIds(config.sourceBlockIds) : undefined;
    const mergeColspan = config.kind === 'title' ? titleMergeColspan : summaryMergeColspan;

    const subsection = applyComputedFieldsToRow({
      ...subsectionBase,
      type: 'subsection',
      ...createSubsectionCells(subsectionBase, config, manualFields, totals),
      cell_merge: {
        ...(getObjectValue(subsectionBase.cell_merge) ?? {}),
        [labelFieldKey]: {
          colspan: mergeColspan,
        },
      },
    }) as unknown as TableTemplateBlock['subsection'];

    summaryTotalsByBlockId.set(
      config.id,
      summaryValueFields.reduce<Record<string, number>>((acc, fieldKey) => {
        acc[fieldKey] = parseNumber(subsection?.[fieldKey]);
        return acc;
      }, {}),
    );

    const canAddDirectRows = shouldShowSectionAddRowButton(config, configIndex);
    const normalizedDirectRows = canAddDirectRows ? normalizeBlockRows(config, existing) : null;

    return [
      {
        id: config.id,
        subsection,
        row_template: normalizedDirectRows?.rowTemplate ?? existing?.row_template ?? null,
        ...(normalizedDirectRows?.rowFetchConfig ? { row_fetch_config: normalizedDirectRows.rowFetchConfig } : {}),
        rows: normalizedDirectRows?.rows ?? existing?.rows ?? [],
        button_config: {
          show_add_row_button: canAddDirectRows,
          show_copy_button: true,
          show_delete_button: true,
        },
      },
    ];
  });
  const configuredBlockIds = new Set(blockConfigs.map((config) => config.id));
  const configuredBlocksById = new Map(
    configuredBlocks
      .filter((block) => typeof block.id === 'string' && block.id)
      .map((block) => [String(block.id), block]),
  );
  const usedConfiguredBlockIds = new Set<string>();
  const nextBlocks =
    oldBlocks.length > 0
      ? [
          ...oldBlocks.flatMap((oldBlock) => {
            const oldBlockId = typeof oldBlock.id === 'string' ? oldBlock.id : '';
            if (deletedConfiguredBlockIds.has(oldBlockId)) return [];

            const configuredBlock = configuredBlocksById.get(oldBlockId);
            if (configuredBlock) {
              usedConfiguredBlockIds.add(oldBlockId);
              return [configuredBlock];
            }

            if (!configuredBlockIds.has(oldBlockId)) {
              return [oldBlock];
            }

            return [];
          }),
          ...configuredBlocks.filter((block) => {
            const blockId = typeof block.id === 'string' ? block.id : '';
            return blockId && !usedConfiguredBlockIds.has(blockId) && !deletedConfiguredBlockIds.has(blockId);
          }),
        ]
      : configuredBlocks;

  return {
    ...template,
    structure: {
      ...template.structure,
      blocks: nextBlocks,
      show_add_row_button: true,
      show_copy_button: true,
      show_delete_button: true,
    },
  };
};
