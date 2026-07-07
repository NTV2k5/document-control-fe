import { getEditorGlobalStyleCss } from '../editor-style';

export const TABLE_TEMPLATE_VARIABLE_NAMESPACE = 'table_template';

export type TableTemplate = {
  id: string;
  name: string;
  title?: string;
  description?: string;
  primary_table?: string;
  table_name?: string;
  [key: string]: any;
  structure: {
    headers: TableTemplateHeader[];
    blocks: TableTemplateBlock[];
    rows?: TableTemplateRow[];
    show_add_row_button?: boolean;
    show_copy_button?: boolean;
    show_delete_button?: boolean;
    behavior?: Record<string, unknown>;
  };
  context?: TableTemplateContext;
};

export type TTableTemplateTextAlign = 'left' | 'center' | 'right' | 'justify';
export type TTableTemplateVerticalAlign = 'top' | 'middle' | 'bottom';

export type TableTemplateCellStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  font_family?: string;
  text_align?: TTableTemplateTextAlign;
  vertical_align?: TTableTemplateVerticalAlign;
  font_size?: string;
  line_height?: string | number;
  color?: string;
  background_color?: string;
};

export type TableTemplateStyle = TableTemplateCellStyle & {
  header?: TableTemplateCellStyle;
  body?: TableTemplateCellStyle;
  subsection?: TableTemplateCellStyle;
};

export type TableTemplateHeader = TableTemplateCellStyle & {
  label: string;
  key: string;
  width?: string;
  cell_bold?: boolean;
  cell_italic?: boolean;
  cell_underline?: boolean;
  cell_text_align?: TTableTemplateTextAlign;
  cell_vertical_align?: TTableTemplateVerticalAlign;
  cell_font_size?: string;
  cell_font_family?: string;
  cell_line_height?: string | number;
  cell_color?: string;
  cell_background_color?: string;
  is_parent_header?: boolean;
  parent?: string;
  colspan?: number;
  rowspan?: number;
  table_field?: string;
  reference_table?: string;
  reference_field?: string;
  [key: string]: any;
};

export type TableTemplateCell =
  | string
  | (TableTemplateCellStyle & {
      label?: string;
      key?: string;
      value?: string | number;
      is_required?: boolean;
      read_only?: boolean;
      width?: string;
      editable?: boolean;
      table_field?: string;
      reference_table?: string;
      reference_field?: string;
      [key: string]: any;
    });

export type TableTemplateSubsection = {
  type: 'subsection';
  [key: string]: any;
};

export type TableTemplateRow = {
  id?: string;
  [key: string]: any;
};

export type TableTemplateBlock = {
  id?: string;
  subsection: TableTemplateSubsection | null;
  rows: TableTemplateRow[];
  row_template?: Record<string, any> | null;
  row_fetch_config?: any;
  fetch_config?: any;
  button_config?: any;
  [key: string]: any;
};

export type TableTemplateContext = {
  academic_program_id?: string | null;
  academic_program_name?: string | null;
  academic_program_source?: string | null;
  [key: string]: any;
};

export type TTableTemplate = TableTemplate;
export type TTableTemplateHeader = TableTemplateHeader;
export type TTableTemplateCell = TableTemplateCell;
export type TTableTemplateSubsection = TableTemplateSubsection;
export type TTableTemplateRow = TableTemplateRow;
export type TTableTemplateBlock = TableTemplateBlock;
export type TTableTemplateContext = TableTemplateContext;

let tableTemplatesCache: TableTemplate[] = [];

const getDocumentTableBaseStyle = () =>
  ['width: 100%', 'border-collapse: collapse', 'table-layout: fixed', getEditorGlobalStyleCss()].join('; ');
const DOCUMENT_TABLE_HEADER_STYLE = [
  'padding: 4pt 5pt',
  'border: 1px solid #000',
  'text-align: center',
  'font-weight: 700',
  'vertical-align: middle',
  'white-space: pre-wrap',
  'overflow-wrap: anywhere',
].join('; ');
const DOCUMENT_TABLE_CELL_STYLE = [
  'padding: 4pt 5pt',
  'border: 1px solid #000',
  'vertical-align: top',
  'white-space: pre-wrap',
  'overflow-wrap: anywhere',
].join('; ');

const TABLE_TEMPLATE_TITLE_OVERRIDES: Record<string, string> = {
  appendix_curriculum_comparison_matrix: 'PL-2.3.1 Bảng Đối Sánh Nội Dung CTĐT',
  curriculum: 'Bảng Cấu Trúc Chương Trình Đào Tạo/Học Phần',
  curriculum_framework_fixed: 'Bảng Khung Chương Trình Đào Tạo',
  program_general_info: 'Bảng Thông Tin Chung Chương Trình Đào Tạo',
  knowledge_block_credit_summary: 'Bảng Tổng Kết Tín Chỉ Khối Kiến Thức',
  course_plo_contribution_matrix: 'Bảng Ma Trận Đóng Góp Học Phần PLO',
  objective_comparison_matrix: 'Bảng Đối Sánh Mục Tiêu CTĐT',
  plo_bloom_level: 'Bảng Chuẩn Đầu Ra Chương Trình Đào Tạo (PLO)',
  plo_comparison_matrix: 'Bảng Đối Sánh Chuẩn Đầu Ra (PLO)',
  plo_matrix: 'Bảng Ma Trận Chuẩn Đầu Ra Chương Trình Đào Tạo',
  po_objectives: 'Bảng Mục Tiêu Chương Trình Đào Tạo (PO)',
  po_plo_matrix: 'Bảng Ma Trận Quan Hệ PO-PLO',
  semester_courses: 'Bảng Kế Hoạch Học Phần Theo Học Kỳ',
  'syllabus.assessment_rubric': 'Bảng 8.3 Tiêu Chí Đánh Giá Đồ Án',
  syllabus_clo_plo_matrix: 'Bảng Mục 5 - Ma Trận CLO-PLO',
  syllabus_clo_mapping: 'Bảng Chuẩn Đầu Ra Học Phần (CLO)',
  syllabus_content: 'Bảng Nội Dung Đề Cương Và Liên Kết CLO',
  teaching_plan: 'Bảng Kế Hoạch Giảng Dạy',
  teaching_learning_method_plo_matrix: 'Bảng Ma Trận TLM-PLO',
  assessment_method_plo_matrix: 'Bảng Ma Trận AM-PLO',
  teaching_schedule: 'Bảng Lịch Trình Giảng Dạy Và Hoạt Động',
};

const TABLE_TEMPLATE_IDENTIFIER_TOKEN_ALIASES: Record<string, string> = {
  appendix: 'Phụ Lục',
  block: 'Khối',
  clo: 'CLO',
  comparison: 'Đối Sánh',
  contribution: 'Đóng Góp',
  course: 'Học Phần',
  credit: 'Tín Chỉ',
  curriculum: 'Chương Trình',
  fixed: 'Cố Định',
  framework: 'Khung',
  knowledge: 'Kiến Thức',
  matrix: 'Ma Trận',
  objective: 'Mục Tiêu',
  plan: 'Kế Hoạch',
  plo: 'PLO',
  summary: 'Tổng Kết',
  syllabus: 'Đề Cương',
  teaching: 'Giảng Dạy',
};

function stripLeadingIcons(value?: string): string {
  if (!value) return '';
  return value
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\s]+/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function hasVietnameseCharacters(value: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu.test(value);
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 1 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toUpperCase()))
    .join(' ');
}

function humanizeTemplateId(template_id: string): string {
  const normalized = template_id
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();

  return normalized
    .split('_')
    .filter(Boolean)
    .map((token) => TABLE_TEMPLATE_IDENTIFIER_TOKEN_ALIASES[token] || toTitleCase(token))
    .join(' ');
}

function normalizeTableTemplateDisplay(template: TableTemplate): TableTemplate {
  const overrideTitle = TABLE_TEMPLATE_TITLE_OVERRIDES[template.id];
  const strippedName = stripLeadingIcons(template.name);
  const strippedTitle = stripLeadingIcons(template.title || '');
  const translatedFromId = humanizeTemplateId(template.id);

  const normalizedName =
    overrideTitle || (hasVietnameseCharacters(strippedName) ? strippedName : translatedFromId) || strippedName;
  const normalizedTitle =
    overrideTitle ||
    (strippedTitle ? (hasVietnameseCharacters(strippedTitle) ? strippedTitle : translatedFromId) : normalizedName);

  return {
    ...template,
    name: normalizedName,
    title: normalizedTitle,
    description: stripLeadingIcons(template.description || ''),
  };
}

export function setTableTemplates(templates: TableTemplate[]) {
  tableTemplatesCache = Array.isArray(templates) ? templates.map(normalizeTableTemplateDisplay) : [];
}

export function getAllTableTemplates(): TableTemplate[] {
  return tableTemplatesCache;
}

export function getTableTemplateVariableFields(): string[] {
  return getAllTableTemplates()
    .map((template) => template.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function getTableTemplateById(template_id: string): TableTemplate | undefined {
  return getAllTableTemplates().find((template) => template.id === template_id);
}

export function getTableTemplateByVariableKey(varKey: string): TableTemplate | undefined {
  const prefix = `${TABLE_TEMPLATE_VARIABLE_NAMESPACE}.`;
  if (!varKey.startsWith(prefix)) return undefined;
  return getTableTemplateById(varKey.slice(prefix.length));
}

export function getCellValue(cell: any): string {
  if (typeof cell === 'object' && cell !== null && 'value' in cell) {
    return cell.value === undefined || cell.value === null ? '' : String(cell.value);
  }
  return cell === undefined || cell === null ? '' : String(cell);
}

const cloneTableTemplate = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isPlainObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const TABLE_ROW_META_KEYS = new Set([
  'id',
  'type',
  'cell_merge',
  'row_button_config',
  '_source_ids',
  '_computed_values',
]);

const TABLE_CELL_RUNTIME_KEYS = ['source_record_id', 'source_table'];
const TABLE_HEADER_STYLE_KEYS = [
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
  'cell_bold',
  'cell_italic',
  'cell_underline',
  'cell_font_family',
  'cell_text_align',
  'cell_vertical_align',
  'cell_font_size',
  'cell_line_height',
  'cell_color',
  'cell_background_color',
] as const;
const TABLE_STRUCTURE_ACTION_KEYS = ['show_add_row_button', 'show_copy_button', 'show_delete_button'] as const;

const stringArrayFromUnknown = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
};

const getDeletedConfiguredRowIds = (template?: TableTemplate | null) => {
  const templateBehavior = isPlainObject(template?.behavior) ? template.behavior : {};
  const structureBehavior = isPlainObject(template?.structure?.behavior) ? template.structure.behavior : {};
  const behavior = { ...templateBehavior, ...structureBehavior };

  return new Set([
    ...stringArrayFromUnknown(behavior.deleted_configured_row_ids),
    ...stringArrayFromUnknown(behavior.deletedConfiguredRowIds),
  ]);
};

const getDeletedConfiguredBlockIds = (template?: TableTemplate | null) => {
  const templateBehavior = isPlainObject(template?.behavior) ? template.behavior : {};
  const structureBehavior = isPlainObject(template?.structure?.behavior) ? template.structure.behavior : {};
  const behavior = { ...templateBehavior, ...structureBehavior };

  return new Set([
    ...stringArrayFromUnknown(behavior.deleted_configured_block_ids),
    ...stringArrayFromUnknown(behavior.deletedConfiguredBlockIds),
  ]);
};

const mergeBehaviorRecord = (definitionBehavior: unknown, savedBehavior: unknown) => {
  const definitionRecord = isPlainObject(definitionBehavior) ? definitionBehavior : {};
  const savedRecord = isPlainObject(savedBehavior) ? savedBehavior : {};
  const mergedRecord = {
    ...definitionRecord,
    ...savedRecord,
  };

  return Object.keys(mergedRecord).length > 0 ? mergedRecord : undefined;
};

const mergeActionConfigFromDefinition = <T extends Record<string, any> | null | undefined>(
  definitionValue: T,
  savedValue: T,
): T => {
  if (!savedValue || !definitionValue) return savedValue;

  const mergedValue = { ...savedValue } as Record<string, any>;
  TABLE_STRUCTURE_ACTION_KEYS.forEach((key) => {
    if (key in definitionValue) {
      mergedValue[key] = definitionValue[key];
    }
  });

  return mergedValue as T;
};

const mergeBlockActionConfigFromDefinition = (
  definitionBlocks: TableTemplateBlock[] = [],
  savedBlocks: TableTemplateBlock[] = [],
) => {
  const definitionById = new Map(
    definitionBlocks.filter((block) => block.id).map((block) => [block.id as string, block]),
  );

  return savedBlocks.map((savedBlock) => {
    const definitionBlock = savedBlock.id ? definitionById.get(savedBlock.id) : undefined;
    if (!definitionBlock?.button_config) return savedBlock;

    return {
      ...savedBlock,
      button_config: mergeActionConfigFromDefinition(definitionBlock.button_config, savedBlock.button_config || {}),
    };
  });
};

const getRuntimeCellValue = (cell: unknown) => (isPlainObject(cell) && 'value' in cell ? cell.value : cell);

const mergeCellRuntimeValue = (definitionCell: unknown, savedCell: unknown) => {
  if (savedCell === undefined) return definitionCell;

  if (isPlainObject(definitionCell)) {
    const savedRuntime = isPlainObject(savedCell)
      ? TABLE_CELL_RUNTIME_KEYS.reduce<Record<string, unknown>>((acc, key) => {
          if (key in savedCell) {
            acc[key] = savedCell[key];
          }
          return acc;
        }, {})
      : {};

    return {
      ...definitionCell,
      ...savedRuntime,
      value: getRuntimeCellValue(savedCell),
    };
  }

  if (isPlainObject(savedCell) && 'value' in savedCell) {
    return savedCell.value;
  }

  return savedCell;
};

const mergeRowRuntimeValues = <TRow extends Record<string, any> | null | undefined>(
  definitionRow: TRow,
  savedRow?: Record<string, any> | null,
): TRow => {
  if (!definitionRow || !savedRow) return definitionRow;

  const mergedRow = { ...definitionRow } as Record<string, any>;
  Object.keys(savedRow).forEach((key) => {
    if (TABLE_ROW_META_KEYS.has(key)) return;
    if (!(key in mergedRow)) return;

    mergedRow[key] = mergeCellRuntimeValue(mergedRow[key], savedRow[key]);
  });

  if (savedRow._source_ids && isPlainObject(savedRow._source_ids)) {
    mergedRow._source_ids = savedRow._source_ids;
  }

  return mergedRow as TRow;
};

const mergeRowsRuntimeValues = (
  definitionRows: TableTemplateRow[] = [],
  savedRows?: TableTemplateRow[],
  deletedConfiguredRowIds = new Set<string>(),
) => {
  if (!Array.isArray(savedRows)) {
    return definitionRows.filter((row) => !row.id || !deletedConfiguredRowIds.has(row.id));
  }
  if (savedRows.length === 0) return [];

  const definitionById = new Map(definitionRows.filter((row) => row.id).map((row) => [row.id as string, row]));
  const usedDefinitionRows = new Set<TableTemplateRow>();

  const mergedRows = savedRows.map((savedRow, index) => {
    const definitionRow =
      (savedRow.id ? definitionById.get(savedRow.id) : undefined) || (!savedRow.id ? definitionRows[index] : null);

    if (!definitionRow) return savedRow;

    usedDefinitionRows.add(definitionRow);
    return mergeRowRuntimeValues(definitionRow, savedRow);
  });

  definitionRows.forEach((definitionRow) => {
    if (usedDefinitionRows.has(definitionRow)) return;
    if (definitionRow.id && deletedConfiguredRowIds.has(definitionRow.id)) return;
    if (definitionRow.id && mergedRows.some((row) => row.id === definitionRow.id)) return;
    if (!definitionRow.id && savedRows && savedRows.length > 0) return;
    mergedRows.push(definitionRow);
  });

  return mergedRows;
};

const mergeHeadersRuntimeValues = (
  definitionHeaders: TableTemplateHeader[] = [],
  savedHeaders: TableTemplateHeader[] = [],
) => {
  if (savedHeaders.length === 0) return definitionHeaders;

  const savedHeadersByKey = new Map(savedHeaders.map((header) => [header.key, header]));

  return definitionHeaders.map((definitionHeader) => {
    const savedHeader = savedHeadersByKey.get(definitionHeader.key);
    if (!savedHeader || definitionHeader.label_editable !== true) return definitionHeader;

    return {
      ...definitionHeader,
      label: savedHeader.label ?? definitionHeader.label,
    };
  });
};

const mergeBlocksRuntimeValues = (
  definitionBlocks: TableTemplateBlock[] = [],
  savedBlocks: TableTemplateBlock[] = [],
  deletedConfiguredRowIds = new Set<string>(),
  deletedConfiguredBlockIds = new Set<string>(),
) => {
  if (savedBlocks.length === 0) {
    return definitionBlocks.filter((block) => !block.id || !deletedConfiguredBlockIds.has(block.id));
  }

  const definitionById = new Map(
    definitionBlocks.filter((block) => block.id).map((block) => [block.id as string, block]),
  );
  const usedDefinitionBlocks = new Set<TableTemplateBlock>();

  const mergedBlocks = savedBlocks.map((savedBlock, index) => {
    const definitionBlock =
      (savedBlock.id ? definitionById.get(savedBlock.id) : undefined) ||
      (!savedBlock.id ? definitionBlocks[index] : null);

    if (!definitionBlock) return savedBlock;

    usedDefinitionBlocks.add(definitionBlock);
    return {
      ...definitionBlock,
      subsection: mergeRowRuntimeValues(definitionBlock.subsection, savedBlock.subsection),
      row_template: mergeRowRuntimeValues(definitionBlock.row_template, savedBlock.row_template),
      rows: mergeRowsRuntimeValues(definitionBlock.rows, savedBlock.rows, deletedConfiguredRowIds),
    };
  });

  definitionBlocks.forEach((definitionBlock) => {
    if (definitionBlock.id && deletedConfiguredBlockIds.has(definitionBlock.id)) return;
    if (
      !usedDefinitionBlocks.has(definitionBlock) &&
      (!definitionBlock.id || !mergedBlocks.some((block) => block.id === definitionBlock.id))
    ) {
      mergedBlocks.push(definitionBlock);
    }
  });

  return mergedBlocks;
};

export function mergeTableTemplateWithRuntimeValues(
  definitionTemplate: TableTemplate,
  savedTemplate?: TableTemplate | null,
): TableTemplate {
  const mergedTemplate = cloneTableTemplate(definitionTemplate);
  if (!savedTemplate) return mergedTemplate;

  const deletedConfiguredRowIds = getDeletedConfiguredRowIds(savedTemplate);
  const deletedConfiguredBlockIds = getDeletedConfiguredBlockIds(savedTemplate);
  const mergedTemplateBehavior = mergeBehaviorRecord(mergedTemplate.behavior, savedTemplate.behavior);
  const mergedStructureBehavior = mergeBehaviorRecord(
    mergedTemplate.structure?.behavior,
    savedTemplate.structure?.behavior,
  );

  if (mergedTemplateBehavior) {
    mergedTemplate.behavior = mergedTemplateBehavior;
  }
  mergedTemplate.context = savedTemplate.context
    ? {
        ...(mergedTemplate.context || {}),
        ...savedTemplate.context,
      }
    : mergedTemplate.context;
  mergedTemplate.structure = {
    ...mergedTemplate.structure,
    headers: mergeHeadersRuntimeValues(mergedTemplate.structure.headers, savedTemplate.structure?.headers),
    blocks: mergeBlocksRuntimeValues(
      mergedTemplate.structure.blocks,
      savedTemplate.structure?.blocks,
      deletedConfiguredRowIds,
      deletedConfiguredBlockIds,
    ),
    rows: mergeRowsRuntimeValues(
      mergedTemplate.structure.rows || [],
      savedTemplate.structure?.rows,
      deletedConfiguredRowIds,
    ),
    ...(mergedStructureBehavior ? { behavior: mergedStructureBehavior } : {}),
  };

  return mergedTemplate;
}

export function mergeTableTemplateStylesFromDefinition(
  definitionTemplate: TableTemplate,
  savedTemplate?: TableTemplate | null,
): TableTemplate {
  if (!savedTemplate) return cloneTableTemplate(definitionTemplate);
  const mergedTemplateBehavior = mergeBehaviorRecord(definitionTemplate.behavior, savedTemplate.behavior);
  const mergedStructureBehavior = mergeBehaviorRecord(
    definitionTemplate.structure?.behavior,
    savedTemplate.structure?.behavior,
  );

  const definitionHeaders = new Map(
    definitionTemplate.structure.headers.map((header) => [header.key, header] as const),
  );
  const savedHeaders = savedTemplate.structure.headers.map((savedHeader) => {
    const definitionHeader = definitionHeaders.get(savedHeader.key);
    if (!definitionHeader) return savedHeader;

    const mergedHeader = { ...savedHeader } as Record<string, any>;
    TABLE_HEADER_STYLE_KEYS.forEach((key) => {
      if (key in definitionHeader) {
        mergedHeader[key] = definitionHeader[key];
      } else {
        delete mergedHeader[key];
      }
    });
    return mergedHeader as TableTemplateHeader;
  });

  return {
    ...savedTemplate,
    ...(mergedTemplateBehavior ? { behavior: mergedTemplateBehavior } : {}),
    structure: {
      ...mergeActionConfigFromDefinition(definitionTemplate.structure, savedTemplate.structure),
      ...(mergedStructureBehavior ? { behavior: mergedStructureBehavior } : {}),
      headers: savedHeaders,
      blocks: mergeBlockActionConfigFromDefinition(definitionTemplate.structure.blocks, savedTemplate.structure.blocks),
    },
  };
}

function isRequiredTypeHeader(header?: TableTemplateHeader): boolean {
  if (!header) return false;
  const key = String(header.key || '').toLowerCase();
  const tableField = String(header.table_field || '').toLowerCase();
  return (
    key === 'required' ||
    key === 'requiredtype' ||
    tableField.endsWith('.is_required') ||
    tableField.endsWith('.isrequired') ||
    tableField.includes('is_required') ||
    tableField.includes('isrequired')
  );
}

export function mapRequiredTypeDisplayValue(value: unknown, header?: TableTemplateHeader): string {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (!isRequiredTypeHeader(header)) return raw;

  if (typeof value === 'boolean') {
    return value ? 'BB' : 'TC';
  }

  const normalized = raw.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'bb') {
    return 'BB';
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'tc') {
    return 'TC';
  }

  return raw;
}

function escapeTableCellHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getVariableValue(varValues: Record<string, string>, key: string): string {
  return varValues[key] ?? varValues[`{{${key}}}`] ?? '';
}

function renderTableCellHtml(value: unknown, varValues: Record<string, string>): string {
  const resolved = String(value ?? '').replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const key = String(varName || '').trim();
    return getVariableValue(varValues, key) || match;
  });

  const escaped = escapeTableCellHtml(resolved);
  return escaped.replace(/\r\n|\r|\n/g, '<br />');
}

function shouldResolveCellFromContext(cell: unknown): boolean {
  if (!isPlainObject(cell)) return false;
  return Boolean(cell.resolve_from_context || cell.resolveFromContext || cell.context_source || cell.contextSource);
}

function getCellTableField(cell: unknown): string {
  if (!isPlainObject(cell)) return '';
  const tableField = cell.table_field;
  return typeof tableField === 'string' && tableField.trim() ? tableField.trim() : '';
}

function getDisplayCellValue(cell: unknown, header: TableTemplateHeader, varValues: Record<string, string>): string {
  const tableField = getCellTableField(cell);
  if (tableField && shouldResolveCellFromContext(cell)) {
    const contextValue = getVariableValue(varValues, tableField);
    if (contextValue !== '') {
      return contextValue;
    }
  }

  return getCellValue(cell);
}

function getTableColumnWidthStyle(header?: TableTemplateHeader): string {
  const width = typeof header?.width === 'string' ? header.width.trim() : '';
  return width ? ` width: ${width}; max-width: ${width};` : '';
}

function getConfiguredTableCellStyle(source: unknown, prefix: '' | 'cell_' = ''): string {
  if (!isPlainObject(source)) return '';

  const declarations: string[] = [];
  const bold = source[`${prefix}bold`];
  const italic = source[`${prefix}italic`];
  const underline = source[`${prefix}underline`];
  const fontFamily = source[`${prefix}font_family`];
  const textAlign = source[`${prefix}text_align`];
  const verticalAlign = source[`${prefix}vertical_align`];
  const fontSize = source[`${prefix}font_size`];
  const lineHeight = source[`${prefix}line_height`];
  const color = source[`${prefix}color`];
  const backgroundColor = source[`${prefix}background_color`];

  if (typeof bold === 'boolean') declarations.push(`font-weight: ${bold ? '700' : '400'}`);
  if (typeof italic === 'boolean') declarations.push(`font-style: ${italic ? 'italic' : 'normal'}`);
  if (typeof underline === 'boolean') declarations.push(`text-decoration: ${underline ? 'underline' : 'none'}`);
  if (typeof fontFamily === 'string' && fontFamily.trim()) declarations.push(`font-family: ${fontFamily.trim()}`);
  if (textAlign === 'left' || textAlign === 'center' || textAlign === 'right' || textAlign === 'justify') {
    declarations.push(`text-align: ${textAlign}`);
  }
  if (verticalAlign === 'top' || verticalAlign === 'middle' || verticalAlign === 'bottom') {
    declarations.push(`vertical-align: ${verticalAlign}`);
  }
  if (typeof fontSize === 'string' && fontSize.trim()) declarations.push(`font-size: ${fontSize.trim()}`);
  if ((typeof lineHeight === 'string' && lineHeight.trim()) || typeof lineHeight === 'number') {
    declarations.push(`line-height: ${String(lineHeight).trim()}`);
  }
  if (typeof color === 'string' && color.trim()) declarations.push(`color: ${color.trim()}`);
  if (typeof backgroundColor === 'string' && backgroundColor.trim()) {
    declarations.push(`background-color: ${backgroundColor.trim()}`);
  }

  return declarations.length ? ` ${declarations.join('; ')};` : '';
}

function isPloLeafHeader(header?: TableTemplateHeader): boolean {
  if (!header || header.is_parent_header) return false;

  const key = String(header.key || '').trim();
  const label = String(header.label || '').trim();

  return /^plo(?:[_-]?[a-z]+)?[_-]?\d+$/i.test(key) || /^PLO\d+$/i.test(label);
}

function getPloHeaderStyle(header?: TableTemplateHeader): string {
  if (!isPloLeafHeader(header)) return '';

  return `${[
    ' width: 1%',
    ' max-width: 44px',
    ' min-width: 30px',
    ' padding: 3pt 2pt',
    ' text-align: center',
    ' font-size: 9pt',
    ' font-weight: 400',
    ' line-height: 1.1',
    ' white-space: nowrap',
    ' overflow-wrap: normal',
    ' word-break: keep-all',
  ].join(';')};`;
}

function getPloBodyCellStyle(header?: TableTemplateHeader): string {
  if (!isPloLeafHeader(header)) return '';

  return `${[
    ' width: 1%',
    ' max-width: 44px',
    ' min-width: 30px',
    ' padding: 3pt 2pt',
    ' text-align: center',
    ' vertical-align: middle',
    ' font-size: 10pt',
    ' font-weight: 400',
    ' line-height: 1.1',
    ' white-space: nowrap',
    ' overflow-wrap: normal',
    ' word-break: keep-all',
  ].join(';')};`;
}

function getHeaderChildren(header: TableTemplateHeader, headers: TableTemplateHeader[]) {
  return headers.filter((candidate) => candidate.parent === header.key);
}

function getHeaderRenderLevel(
  header: TableTemplateHeader,
  headers: TableTemplateHeader[],
  visited = new Set<string>(),
): number {
  if (!header.parent || visited.has(header.key)) return 0;

  const parentHeader = headers.find((candidate) => candidate.key === header.parent);
  if (!parentHeader) return 0;

  visited.add(header.key);
  return getHeaderRenderLevel(parentHeader, headers, visited) + 1;
}

function getHeaderLeafDescendants(header: TableTemplateHeader, headers: TableTemplateHeader[]): TableTemplateHeader[] {
  const children = getHeaderChildren(header, headers);
  if (children.length === 0) return header.is_parent_header ? [] : [header];

  return children.flatMap((child) => getHeaderLeafDescendants(child, headers));
}

export function hasInvalidTableTemplateHeaderTree(template?: TableTemplate | null) {
  const headers = template?.structure?.headers;
  if (!Array.isArray(headers) || headers.length === 0) return false;

  const byKey = new Map(headers.map((header) => [header.key, header]));
  const levels = headers.map((header) => getHeaderRenderLevel(header, headers));
  const maxLevel = Math.max(0, ...levels);

  if (levels.some((level) => level < 0)) return true;

  for (let level = 0; level <= maxLevel; level += 1) {
    if (!levels.includes(level)) return true;
  }

  return headers.some((header) => Boolean(header.parent && !byKey.has(header.parent)));
}

export function generateTableHtmlFromTableTemplate(template: TableTemplate, varValues: Record<string, string> = {}) {
  const { headers, blocks } = template.structure;

  const headerLevels = new Map(headers.map((header) => [header.key, getHeaderRenderLevel(header, headers)]));
  const headerRowCount = Math.max(1, ...Array.from(headerLevels.values()).map((level) => level + 1));
  const headerRows: string[] = [];

  for (let rowIdx = 0; rowIdx < headerRowCount; rowIdx++) {
    const rowHeaderHtml = headers
      .filter((h) => headerLevels.get(h.key) === rowIdx)
      .map((h) => {
        const childHeaders = getHeaderChildren(h, headers);
        const descendantLeafHeaders = getHeaderLeafDescendants(h, headers);
        const defaultColspan =
          childHeaders.length > 0 && descendantLeafHeaders.length > 0 ? descendantLeafHeaders.length : 1;
        const colspan = h.is_parent_header ? Math.max(1, Number(h.colspan) || defaultColspan) : 1;
        const headerLevel = headerLevels.get(h.key) ?? rowIdx;
        const defaultRowspan = childHeaders.length > 0 ? 1 : Math.max(1, headerRowCount - headerLevel);
        const rowspan = childHeaders.length > 0 ? 1 : Math.max(defaultRowspan, Number(h.rowspan) || defaultRowspan);
        const colspanAttr = colspan > 1 ? ` colspan="${colspan}"` : '';
        const rowspanAttr = rowspan > 1 ? ` rowspan="${rowspan}"` : '';

        let bgColor = '';
        if (h.background_color) {
          bgColor = ` background-color: ${h.background_color};`;
        } else if (h.is_parent_header || h.parent) {
          bgColor = ' background-color: #f5f5f5;';
        }

        const widthStyle = getTableColumnWidthStyle(h);
        const ploHeaderStyle = getPloHeaderStyle(h);
        const configuredStyle = getConfiguredTableCellStyle(h);
        const labelHtml = renderTableCellHtml(h.label, varValues);

        return `<th style="${DOCUMENT_TABLE_HEADER_STYLE};${widthStyle}${ploHeaderStyle}${bgColor}${configuredStyle}"${colspanAttr}${rowspanAttr}>${labelHtml}</th>`;
      })
      .join('');

    headerRows.push(`<tr>${rowHeaderHtml}</tr>`);
  }

  const headerHtml = headerRows.join('');
  const filteredHeaders = headers.filter((h) => !h.is_parent_header);

  const bodyHtml = blocks
    .flatMap((block) => {
      const blockRows: string[] = [];

      if (block.subsection) {
        const subsectionRow = block.subsection;
        const cell_merge = subsectionRow.cell_merge || {};

        const skipIndices = new Set<number>();
        filteredHeaders.forEach((h, headerIdx) => {
          const config = cell_merge[h.key];
          if (config?.colspan && config.colspan > 1) {
            for (let i = 1; i < config.colspan; i++) {
              skipIndices.add(headerIdx + i);
            }
          }
        });

        const cellsHtml = filteredHeaders
          .map((h, headerIdx) => {
            if (skipIndices.has(headerIdx)) {
              return '';
            }

            let value = getDisplayCellValue(subsectionRow[h.key], h, varValues) || '';
            value = mapRequiredTypeDisplayValue(value, h);
            const colspan = cell_merge[h.key]?.colspan || 1;

            if (colspan > 1) {
              const valueArray = [value];
              for (let i = 1; i < colspan; i++) {
                const spanHeader = filteredHeaders[headerIdx + i];
                if (spanHeader) {
                  const spanValue = getDisplayCellValue(subsectionRow[spanHeader.key], spanHeader, varValues) || '';
                  if (spanValue) {
                    valueArray.push(mapRequiredTypeDisplayValue(spanValue, spanHeader));
                  }
                }
              }
              value = valueArray.filter((v) => v).join(' ');
            }

            value = renderTableCellHtml(value, varValues);

            const rowspan = cell_merge[h.key]?.rowspan || 1;
            const colspanAttr = colspan > 1 ? ` colspan="${colspan}"` : '';
            const rowspanAttr = rowspan > 1 ? ` rowspan="${rowspan}"` : '';
            const widthStyle = getTableColumnWidthStyle(h);
            const ploCellStyle = getPloBodyCellStyle(h);
            const columnStyle = getConfiguredTableCellStyle(h, 'cell_');
            const cellStyle = getConfiguredTableCellStyle(subsectionRow[h.key]);
            return `<td style="${DOCUMENT_TABLE_CELL_STYLE}; font-weight: 700;${widthStyle}${ploCellStyle}${columnStyle}${cellStyle}"${colspanAttr}${rowspanAttr}>${value}</td>`;
          })
          .join('');

        blockRows.push(`<tr>${cellsHtml}</tr>`);
      }

      const rowHtml = (block.rows || [])
        .map((row) => {
          const rowCells = filteredHeaders
            .map((header) => {
              const rawValue = getDisplayCellValue(row[header.key], header, varValues);
              const value = renderTableCellHtml(mapRequiredTypeDisplayValue(rawValue, header), varValues);
              const widthStyle = getTableColumnWidthStyle(header);
              const ploCellStyle = getPloBodyCellStyle(header);
              const columnStyle = getConfiguredTableCellStyle(header, 'cell_');
              const cellStyle = getConfiguredTableCellStyle(row[header.key]);
              return `<td style="${DOCUMENT_TABLE_CELL_STYLE};${widthStyle}${ploCellStyle}${columnStyle}${cellStyle}">${value}</td>`;
            })
            .join('');

          return `<tr>${rowCells}</tr>`;
        })
        .join('');

      if (rowHtml) {
        blockRows.push(rowHtml);
      }

      return blockRows;
    })
    .join('');

  return `
    <table style="${getDocumentTableBaseStyle()}">
      <thead>${headerHtml}</thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  `;
}
