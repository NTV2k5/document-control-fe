import {
  DEFAULT_EDITOR_GLOBAL_STYLE,
  getEditorTextStyleCss,
  normalizeEditorFontFamily,
  normalizeEditorTextStyle,
  type TEditorTextStyle,
} from '../editor-style';

export const DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE = 'document_template';

export interface DocumentFieldBase {
  id: string;
  label: string;
  table_field?: string;
  value_key?: string;
  is_fetching?: boolean;
  is_read_only?: boolean;
  suffix?: string;
  prefix?: string;
  empty_text?: string;
  label_suffix?: string;
  layout?: 'inline' | 'stacked';
  line_style?: 'none' | 'dotted' | 'solid';
  line_count?: number;
  multiline?: boolean;
  rows?: number;
  style?: TEditorTextStyle;
}

export interface DocumentTextField extends DocumentFieldBase {
  type: 'text' | 'number';
  value?: string;
}

export interface DocumentComputedField extends DocumentFieldBase {
  type: 'computed';
  computed_type: 'sum' | 'concat';
  computed_from: string[];
  value?: string;
}

export interface DocumentCheckboxField extends DocumentFieldBase {
  type: 'checkbox';
  exclusive?: boolean;
  reference_table?: string;
  reference_field?: string;
  fk_path?: string;
  options: Array<{
    label: string;
    match_value: string;
    checked?: boolean;
  }>;
}

export interface DocumentReferenceField extends DocumentFieldBase {
  type: 'reference';
  reference_table: string;
  reference_field: string;
  fk_field?: string;
  fk_path?: string;
  lookup_value_field?: string;
  lookup_label_field?: string;
  allow_manual_entry?: boolean;
  value?: string;
}

export interface DocumentMultiReferenceListValueItem {
  value: string;
  label?: string;
  record?: Record<string, unknown>;
}

export interface DocumentMultiReferenceListField extends DocumentFieldBase {
  type: 'multi_reference_list';
  reference_table: string;
  reference_field?: string;
  lookup_value_field?: string;
  lookup_label_field?: string;
  display_fields?: string[];
  display_format?: 'person_contact';
  item_label_prefix?: string;
  show_dash_prefix?: boolean;
  value?: string;
}

export interface DocumentListItem {
  label: string;
  number?: string;
  value?: string;
  table_field?: string;
  is_fetching?: boolean;
  suffix?: string;
  style?: TEditorTextStyle;
  sub_items?: DocumentListItem[];
}

export interface DocumentListField extends DocumentFieldBase {
  type: 'list';
  allow_item_management_in_locked?: boolean;
  item_label_prefix?: string;
  block_layout?: boolean;
  show_dash_prefix?: boolean;
  reference_table?: string;
  reference_field?: string;
  items: DocumentListItem[];
}

export type DocumentField =
  | DocumentTextField
  | DocumentComputedField
  | DocumentCheckboxField
  | DocumentReferenceField
  | DocumentMultiReferenceListField
  | DocumentListField;

export interface DocumentSection {
  id: string;
  title: string;
  fields: DocumentField[];
  style?: TEditorTextStyle;
  layout?: 'default' | 'form_table';
  label_width?: string;
  children?: DocumentSection[];
}

export interface DocumentJoinCondition {
  from_table: string;
  from_field: string;
  to_table: string;
  to_field: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  title?: string;
  description?: string;
  type: 'document';
  primary_table: string;
  trigger_field: string;
  show_trigger_selector?: boolean;
  lock_structure?: boolean;
  allow_section_management?: boolean;
  refresh_from_definition_on_load?: boolean;
  join_conditions: DocumentJoinCondition[];
  sections: DocumentSection[];
  context?: Record<string, unknown>;
  render_mode?: 'structured' | 'raw_html';
  static_html?: string;
  is_read_only?: boolean;
  style?: TEditorTextStyle;
}

export type IDocumentFieldBase = DocumentFieldBase;
export type IDocumentTextField = DocumentTextField;
export type IDocumentComputedField = DocumentComputedField;
export type IDocumentCheckboxField = DocumentCheckboxField;
export type IDocumentReferenceField = DocumentReferenceField;
export type IDocumentMultiReferenceListField = DocumentMultiReferenceListField;
export type IDocumentMultiReferenceListValueItem = DocumentMultiReferenceListValueItem;
export type IDocumentListItem = DocumentListItem;
export type IDocumentListField = DocumentListField;
export type TDocumentField = DocumentField;
export type IDocumentSection = DocumentSection;
export type IDocumentJoinCondition = DocumentJoinCondition;
export type TDocumentTemplate = DocumentTemplate;

let documentTemplatesCache: DocumentTemplate[] = [];

const DOCUMENT_TEMPLATE_TITLE_OVERRIDES: Record<string, string> = {
  appendix_compared_programs: 'PL-1 Danh Sách CTĐT Đối Sánh',
  appendix_course_adoption_explanation: 'PL-2.3.3 Giải Thích Tiếp Thu/Không Tiếp Thu',
  appendix_curriculum_content_analysis: 'PL-2.3.2 Phân Tích Đối Sánh Nội Dung CTĐT',
  appendix_objective_analysis: 'PL-2.1.2 Phân Tích Đối Sánh Mục Tiêu',
  appendix_plo_analysis: 'PL-2.2.2 Phân Tích Đối Sánh Chuẩn Đầu Ra',
  course_descriptions_section: 'Mô Tả Các Học Phần',
  education_philosophy_vision_mission: 'Sứ Mệnh, Tầm Nhìn Và Triết Lý Giáo Dục',
  employment_and_higher_study: 'Vị Trí Việc Làm Và Học Tập Nâng Cao Sau Tốt Nghiệp',
  graduation_conditions: 'Điều Kiện Tốt Nghiệp',
  national_header_no_border: 'Mẫu Quốc Hiệu - Tiêu Ngữ (Không Viền)',
  program_learning_outcomes_plo_section: 'Chuẩn Đầu Ra Chương Trình Đào Tạo (PLO)',
  program_objectives_po_section: 'Mục Tiêu Chương Trình Đào Tạo (PO)',
  objective_comparison: 'Đối Sánh Mục Tiêu Chương Trình',
  objective_comparison_matrix: 'Đối Sánh Mục Tiêu Chương Trình',
  plo_comparison: 'Đối Sánh PLO Chương Trình',
  plo_comparison_matrix: 'Đối Sánh PLO Chương Trình',
  syllabus_general_info: 'Thông Tin Chung Về Học Phần',
  'syllabus.general_info': 'Thông Tin Chung Về Học Phần (Bản Mới)',
  'syllabus.course_description': 'Mô Tả Học Phần',
  'syllabus.course_objectives': 'Mục Tiêu Học Phần',
  teaching_learning_methods_section: 'Phương Thức Giảng Dạy Và Học Tập',
  assessment_methods_section: 'Phương Pháp Đánh Giá Người Học',
};

const DOCUMENT_TEMPLATE_IDENTIFIER_TOKEN_ALIASES: Record<string, string> = {
  appendix: 'Phụ Lục',
  comparison: 'Đối Sánh',
  curriculum: 'Chương Trình',
  document: 'Tài Liệu',
  objective: 'Mục Tiêu',
  plo: 'PLO',
  program: 'Chương Trình',
  report: 'Báo Cáo',
  summary: 'Tổng Kết',
  syllabus: 'Đề Cương',
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
    .map((token) => DOCUMENT_TEMPLATE_IDENTIFIER_TOKEN_ALIASES[token] || toTitleCase(token))
    .join(' ');
}

function normalizeDocumentTemplateDisplay(template: DocumentTemplate): DocumentTemplate {
  const overrideTitle = DOCUMENT_TEMPLATE_TITLE_OVERRIDES[template.id];
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

export function setDocumentTemplates(templates: DocumentTemplate[]) {
  documentTemplatesCache = Array.isArray(templates) ? templates.map(normalizeDocumentTemplateDisplay) : [];
}

export function getAllDocumentTemplates(): DocumentTemplate[] {
  return documentTemplatesCache;
}

export function getDocumentTemplateById(template_id: string): DocumentTemplate | undefined {
  return getAllDocumentTemplates().find((t) => t.id === template_id);
}

export function getDocumentTemplateVariableFields(): string[] {
  return getAllDocumentTemplates()
    .map((template) => template.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function areDocumentStylesEqual(left?: TEditorTextStyle, right?: TEditorTextStyle): boolean {
  const leftEntries = Object.entries(left ?? {});
  const rightStyle = right ?? {};

  return (
    leftEntries.length === Object.keys(rightStyle).length &&
    leftEntries.every(([key, value]) => rightStyle[key as keyof TEditorTextStyle] === value)
  );
}

function isBaseDocumentTemplateStyle(style?: TEditorTextStyle): boolean {
  if (!style) {
    return false;
  }

  return (
    (style.font_size === '12pt' || style.font_size === DEFAULT_EDITOR_GLOBAL_STYLE.font_size) &&
    style.line_height === DEFAULT_EDITOR_GLOBAL_STYLE.line_height
  );
}

function shouldUpgradeDocumentTemplateStyleFromDefinition(
  definitionStyle?: TEditorTextStyle,
  savedStyle?: TEditorTextStyle,
): boolean {
  if (!definitionStyle || !savedStyle) {
    return Boolean(definitionStyle && !savedStyle);
  }

  return isBaseDocumentTemplateStyle(savedStyle) && !areDocumentStylesEqual(definitionStyle, savedStyle);
}

function mergeDocumentTemplateStyleFromDefinition(
  definitionStyle?: TEditorTextStyle,
  savedStyle?: TEditorTextStyle,
): TEditorTextStyle | undefined {
  if (!definitionStyle) {
    return savedStyle;
  }
  if (!savedStyle) {
    return definitionStyle;
  }
  if (areDocumentStylesEqual(definitionStyle, savedStyle)) {
    return savedStyle;
  }
  if (!shouldUpgradeDocumentTemplateStyleFromDefinition(definitionStyle, savedStyle)) {
    return savedStyle;
  }

  return {
    ...savedStyle,
    font_family: definitionStyle.font_family,
    font_size: definitionStyle.font_size,
    line_height: definitionStyle.line_height,
    color: definitionStyle.color,
    bold: definitionStyle.bold,
  };
}

function mergeDocumentTemplateContextFromDefinition(
  definitionContext?: Record<string, unknown>,
  savedContext?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!definitionContext) {
    return savedContext;
  }

  const mergedContext = {
    ...(savedContext ?? {}),
    ...definitionContext,
  };

  const savedEntries = Object.entries(savedContext ?? {});
  const mergedEntries = Object.entries(mergedContext);
  const isUnchanged =
    savedEntries.length === mergedEntries.length &&
    mergedEntries.every(([key, value]) => (savedContext ?? {})[key] === value);

  return isUnchanged ? savedContext : mergedContext;
}

function mergeDocumentListItemStylesFromDefinition(
  definitionItems: DocumentListItem[],
  savedItems: DocumentListItem[],
): DocumentListItem[] {
  let changed = false;
  const mergedItems = savedItems.map((savedItem, index) => {
    const definitionItem =
      definitionItems.find(
        (item) =>
          item.table_field &&
          item.table_field === savedItem.table_field &&
          item.label === savedItem.label &&
          item.number === savedItem.number,
      ) ??
      definitionItems.find((item) => item.label === savedItem.label && item.number === savedItem.number) ??
      definitionItems[index];

    if (!definitionItem) {
      return savedItem;
    }

    const mergedStyle = mergeDocumentTemplateStyleFromDefinition(definitionItem.style, savedItem.style);
    const mergedSubItems = savedItem.sub_items
      ? mergeDocumentListItemStylesFromDefinition(definitionItem.sub_items ?? [], savedItem.sub_items)
      : undefined;

    if (mergedStyle === savedItem.style && mergedSubItems === savedItem.sub_items) {
      return savedItem;
    }

    changed = true;
    return {
      ...savedItem,
      style: mergedStyle,
      ...(savedItem.sub_items
        ? {
            sub_items: mergedSubItems,
          }
        : {}),
    };
  });

  return changed ? mergedItems : savedItems;
}

function mergeDocumentFieldStylesFromDefinition(
  definitionFields: DocumentField[],
  savedFields: DocumentField[],
): DocumentField[] {
  let changed = false;
  const mergedFields = savedFields.map((savedField) => {
    const definitionField = definitionFields.find((field) => field.id === savedField.id);
    if (!definitionField) {
      return savedField;
    }

    if (savedField.type !== definitionField.type) {
      changed = true;
      return {
        ...definitionField,
        style: mergeDocumentTemplateStyleFromDefinition(definitionField.style, savedField.style),
      };
    }

    if (savedField.type === 'list' && definitionField.type === 'list') {
      const mergedStyle = mergeDocumentTemplateStyleFromDefinition(definitionField.style, savedField.style);
      const mergedItems = mergeDocumentListItemStylesFromDefinition(definitionField.items, savedField.items);
      if (mergedStyle === savedField.style && mergedItems === savedField.items) {
        return savedField;
      }

      changed = true;
      return {
        ...savedField,
        style: mergedStyle,
        items: mergedItems,
      };
    }

    const mergedStyle = mergeDocumentTemplateStyleFromDefinition(definitionField.style, savedField.style);
    if (mergedStyle === savedField.style) {
      return savedField;
    }

    changed = true;
    return {
      ...savedField,
      style: mergedStyle,
    };
  });

  return changed ? mergedFields : savedFields;
}

function mergeDocumentSectionStylesFromDefinition(
  definitionSections: DocumentSection[],
  savedSections: DocumentSection[],
): DocumentSection[] {
  let changed = false;
  const mergedSections = savedSections.map((savedSection) => {
    const definitionSection = definitionSections.find((section) => section.id === savedSection.id);
    if (!definitionSection) {
      return savedSection;
    }

    const mergedFields = mergeDocumentFieldStylesFromDefinition(definitionSection.fields, savedSection.fields);
    const mergedChildren = savedSection.children
      ? mergeDocumentSectionStylesFromDefinition(definitionSection.children ?? [], savedSection.children)
      : undefined;
    const mergedStyle = mergeDocumentTemplateStyleFromDefinition(definitionSection.style, savedSection.style);

    if (
      definitionSection.layout === savedSection.layout &&
      definitionSection.label_width === savedSection.label_width &&
      mergedStyle === savedSection.style &&
      mergedFields === savedSection.fields &&
      mergedChildren === savedSection.children
    ) {
      return savedSection;
    }

    changed = true;
    return {
      ...savedSection,
      layout: definitionSection.layout,
      label_width: definitionSection.label_width,
      style: mergedStyle,
      fields: mergedFields,
      ...(savedSection.children
        ? {
            children: mergedChildren,
          }
        : {}),
    };
  });

  return changed ? mergedSections : savedSections;
}

export function mergeDocumentTemplateStylesFromDefinition(
  definitionTemplate: DocumentTemplate,
  savedTemplate?: DocumentTemplate | null,
): DocumentTemplate {
  if (!savedTemplate) {
    return definitionTemplate;
  }

  const mergedSections = mergeDocumentSectionStylesFromDefinition(definitionTemplate.sections, savedTemplate.sections);
  const mergedStyle = mergeDocumentTemplateStyleFromDefinition(definitionTemplate.style, savedTemplate.style);
  const mergedContext = mergeDocumentTemplateContextFromDefinition(definitionTemplate.context, savedTemplate.context);
  const shouldUseDefinitionRawHtml =
    definitionTemplate.render_mode === 'raw_html' &&
    (definitionTemplate.is_read_only || definitionTemplate.refresh_from_definition_on_load);
  const mergedRenderMode = shouldUseDefinitionRawHtml ? definitionTemplate.render_mode : savedTemplate.render_mode;
  const mergedStaticHtml = shouldUseDefinitionRawHtml ? definitionTemplate.static_html : savedTemplate.static_html;
  const mergedIsReadOnly = definitionTemplate.is_read_only ?? savedTemplate.is_read_only;

  if (
    mergedStyle === savedTemplate.style &&
    mergedContext === savedTemplate.context &&
    mergedRenderMode === savedTemplate.render_mode &&
    mergedStaticHtml === savedTemplate.static_html &&
    mergedIsReadOnly === savedTemplate.is_read_only &&
    definitionTemplate.lock_structure === savedTemplate.lock_structure &&
    definitionTemplate.allow_section_management === savedTemplate.allow_section_management &&
    definitionTemplate.refresh_from_definition_on_load === savedTemplate.refresh_from_definition_on_load &&
    mergedSections === savedTemplate.sections
  ) {
    return savedTemplate;
  }

  return {
    ...savedTemplate,
    context: mergedContext,
    render_mode: mergedRenderMode,
    static_html: mergedStaticHtml,
    is_read_only: mergedIsReadOnly,
    style: mergedStyle,
    lock_structure: definitionTemplate.lock_structure,
    allow_section_management: definitionTemplate.allow_section_management,
    refresh_from_definition_on_load: definitionTemplate.refresh_from_definition_on_load,
    sections: mergedSections,
  };
}

export function resolveDocumentFieldValue(field: DocumentField, values: Record<string, string>): string {
  if (field.type === 'computed') {
    const nums = field.computed_from.map((ref) => {
      const v = values[ref] ?? values[field.id] ?? '';
      return Number(v) || 0;
    });
    if (field.computed_type === 'sum') {
      const total = nums.reduce((a, b) => a + b, 0);
      return total ? String(total) : '';
    }

    return field.computed_from
      .map((ref) => values[ref] ?? '')
      .filter(Boolean)
      .join(', ');
  }

  if (field.type === 'checkbox' || field.type === 'list' || field.type === 'multi_reference_list') {
    return '';
  }

  const key = getDocumentFieldValueKey(field);
  return values[key] ?? (field.table_field ? values[field.table_field] : undefined) ?? field.value ?? '';
}

export function getDocumentFieldValueKey(field: DocumentField): string {
  const configuredKey = field.value_key?.trim();
  if (configuredKey) return configuredKey;
  return field.id;
}

export function getDocumentCheckboxOptionValue(option: DocumentCheckboxField['options'][number]): string {
  return option.match_value || option.label;
}

export function parseDocumentCheckboxValue(value?: string): string[] {
  if (!value?.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof parsed === 'string') {
      return parsed.trim() ? [parsed.trim()] : [];
    }
  } catch {
    // Legacy/manual values may be stored as comma-separated text.
  }

  return value
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeDocumentCheckboxValue(values: string[]): string {
  return JSON.stringify(Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))));
}

export function getDocumentCheckboxSelectedValues(
  field: DocumentCheckboxField,
  values: Record<string, string>,
): string[] {
  const valueKey = getDocumentFieldValueKey(field);
  const hasValueOverride = Object.prototype.hasOwnProperty.call(values, valueKey);
  const hasTableFieldOverride = Boolean(
    field.table_field && Object.prototype.hasOwnProperty.call(values, field.table_field),
  );

  if (hasValueOverride) {
    return parseDocumentCheckboxValue(values[valueKey]);
  }

  if (hasTableFieldOverride && field.table_field) {
    return parseDocumentCheckboxValue(values[field.table_field]);
  }

  return field.options.filter((option) => option.checked === true).map(getDocumentCheckboxOptionValue);
}

export function isDocumentCheckboxOptionChecked(
  field: DocumentCheckboxField,
  option: DocumentCheckboxField['options'][number],
  values: Record<string, string>,
): boolean {
  return getDocumentCheckboxSelectedValues(field, values).includes(getDocumentCheckboxOptionValue(option));
}

function normalizeDocumentTemplateHtmlFragment(html: string, styleConfig?: TEditorTextStyle): string {
  if (!html.trim() || typeof DOMParser === 'undefined') {
    return html;
  }

  const style = normalizeEditorTextStyle(styleConfig);
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.body.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.fontFamily = normalizeEditorFontFamily(element.style.fontFamily || style.font_family);
    if (!element.style.fontSize) {
      element.style.fontSize = style.font_size;
    }
    if (!element.style.lineHeight) {
      element.style.lineHeight = style.line_height;
    }
    if (!element.style.color) {
      element.style.color = style.color;
    }
    if (style.background_color && !element.style.backgroundColor) {
      element.style.backgroundColor = style.background_color;
    }
  });

  return document.body.innerHTML;
}

function normalizeDocumentTemplateValue(value: string, styleConfig?: TEditorTextStyle): string {
  return normalizeDocumentTemplateHtmlFragment(value, styleConfig);
}

const withDefaultBold = (style?: TEditorTextStyle): TEditorTextStyle => ({ bold: true, ...style });

const shouldRenderSemanticBold = (style?: TEditorTextStyle): boolean => normalizeEditorTextStyle(style).bold === true;

const renderSemanticStyledText = (value: string, style?: TEditorTextStyle): string =>
  shouldRenderSemanticBold(style) ? `<strong>${value}</strong>` : value;

const renderLabelText = (value: string, style?: TEditorTextStyle): string =>
  renderSemanticStyledText(value, withDefaultBold(style));

const getDocumentFieldLabelSuffix = (field: Pick<DocumentFieldBase, 'label_suffix'>, fallback = ':') =>
  field.label_suffix ?? fallback;

const STYLE = {
  section: (style?: TEditorTextStyle) => `style="margin: 0 0 6pt 0; ${getEditorTextStyleCss(withDefaultBold(style))}"`,
  empty: 'style="color: #6b7280; font-style: italic;"',
  checkboxOptions:
    "style=\"font-family: 'DejaVu Sans', 'Segoe UI Symbol', 'Arial Unicode MS', sans-serif; white-space: normal;\"",
};
const CHECKBOX_OPTION_SEPARATOR = '&nbsp;&nbsp;&nbsp;';

const labelStyle = (style?: TEditorTextStyle) => `style="${getEditorTextStyleCss(withDefaultBold(style))}"`;

function fieldRowStyle(depth: number, style?: TEditorTextStyle): string {
  const marginLeft = Math.max(16, (depth + 1) * 16);
  return `style="margin: 0 0 4pt ${marginLeft}px; ${getEditorTextStyleCss(style)}"`;
}

function listItemStyle(depth: number, style?: TEditorTextStyle): string {
  const marginLeft = Math.max(32, (depth + 2) * 16);
  return `style="margin: 0 0 4pt ${marginLeft}px; ${getEditorTextStyleCss(style)}"`;
}

function subItemStyle(depth: number, level: number, style?: TEditorTextStyle): string {
  const marginLeft = Math.max(48, (depth + level + 2) * 16);
  return `style="margin: 0 0 4pt ${marginLeft}px; ${getEditorTextStyleCss(style)}"`;
}

function hasTextValue(value?: string): boolean {
  return Boolean(value && value.trim().length > 0);
}

const renderCheckboxOptionLabel = (label: string) => label.trim().replace(/\s+/g, '&nbsp;');

function renderCheckboxOptionsInline(field: DocumentCheckboxField, values: Record<string, string>): string {
  const items = field.options.map((opt) => {
    const checked = isDocumentCheckboxOptionChecked(field, opt, values);
    const box = checked ? '&#9745;' : '&#9744;';
    return `${box}&nbsp;${renderCheckboxOptionLabel(opt.label)}`;
  });

  return `<span ${STYLE.checkboxOptions}>${items.join(CHECKBOX_OPTION_SEPARATOR)}</span>`;
}

const toDisplayText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(toDisplayText).filter(Boolean).join(', ');
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return '';
  }

  return String(value).trim();
};

const firstDisplayText = (value: unknown): string => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstDisplayText(item);
      if (text) return text;
    }
    return '';
  }

  return toDisplayText(value);
};

const normalizeAcademicTitle = (value: unknown): string => {
  const text = firstDisplayText(value);
  if (!text) return '';

  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (['thac si', 'ths', 'th.s'].includes(normalized)) return 'ThS.';
  if (['tien si', 'ts', 't.s'].includes(normalized)) return 'TS.';
  if (['cu nhan', 'cn', 'c.n'].includes(normalized)) return 'CN.';
  if (['ky su', 'ks', 'k.s'].includes(normalized)) return 'KS.';
  if (['pho giao su', 'pgs', 'p.g.s'].includes(normalized)) return 'PGS.';
  if (['giao su', 'gs', 'g.s'].includes(normalized)) return 'GS.';

  return text;
};

const getRecordValue = (record: Record<string, unknown> | undefined, fieldName: string): unknown =>
  record?.[fieldName] ?? (fieldName === 'id' ? record?._id : undefined);

export function parseDocumentMultiReferenceListValue(value?: string): DocumentMultiReferenceListValueItem[] {
  if (!value?.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): DocumentMultiReferenceListValueItem | null => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

        const objectItem = item as Record<string, unknown>;
        const rawValue = objectItem.value;
        if (typeof rawValue !== 'string' || !rawValue.trim()) return null;

        const record = objectItem.record;
        return {
          value: rawValue,
          ...(typeof objectItem.label === 'string' ? { label: objectItem.label } : {}),
          ...(record && typeof record === 'object' && !Array.isArray(record)
            ? { record: record as Record<string, unknown> }
            : {}),
        };
      })
      .filter((item): item is DocumentMultiReferenceListValueItem => item !== null);
  } catch {
    return [];
  }
}

export function serializeDocumentMultiReferenceListValue(items: DocumentMultiReferenceListValueItem[]): string {
  return JSON.stringify(
    items.map((item) => ({
      value: item.value,
      ...(item.label ? { label: item.label } : {}),
      ...(item.record ? { record: item.record } : {}),
    })),
  );
}

export function formatDocumentMultiReferenceListItem(
  field: DocumentMultiReferenceListField,
  item: DocumentMultiReferenceListValueItem,
): string {
  const record = item.record;

  if (field.display_format === 'person_contact') {
    const academicRank = normalizeAcademicTitle(getRecordValue(record, 'academic_rank'));
    const degree = normalizeAcademicTitle(getRecordValue(record, 'degree'));
    const title =
      academicRank && degree && academicRank !== degree ? `${academicRank} ${degree}` : academicRank || degree;
    const name = firstDisplayText(getRecordValue(record, 'name')) || item.label || item.value;
    const phone = toDisplayText(getRecordValue(record, 'phones'));
    const email = toDisplayText(getRecordValue(record, 'emails'));
    const personName = [title, name].filter(Boolean).join(' ');

    return [personName, phone, email].filter(Boolean).join(', ');
  }

  const displayFields = field.display_fields?.filter(Boolean) ?? [];
  if (displayFields.length > 0) {
    const value = displayFields.map((fieldName) => toDisplayText(getRecordValue(record, fieldName))).filter(Boolean);
    if (value.length > 0) return value.join(', ');
  }

  return item.label || item.value;
}

function renderSubItems(
  subItems: DocumentListItem[],
  fieldId: string,
  parentIdx: number,
  values: Record<string, string>,
  emptyText: string,
  depth: number,
  level: number,
  parentStyle?: TEditorTextStyle,
): string {
  return subItems
    .map((sub, subIdx) => {
      const subKey = sub.table_field || `${fieldId}_${parentIdx}_sub_${subIdx}`;
      const subVal = values[subKey] ?? sub.value ?? '';
      const currentStyle = sub.style ?? parentStyle;
      const nestedHtml =
        sub.sub_items && sub.sub_items.length > 0
          ? renderSubItems(sub.sub_items, fieldId, parentIdx, values, emptyText, depth, level + 1, currentStyle)
          : '';
      if (!hasTextValue(subVal) && !hasTextValue(sub.label) && !nestedHtml && !emptyText) {
        return '';
      }

      const style = subItemStyle(depth, level, currentStyle);
      const display = subVal
        ? normalizeDocumentTemplateValue(subVal, currentStyle)
        : `<span ${STYLE.empty}>${emptyText || '—'}</span>`;
      const labelPart = sub.label ? `${renderSemanticStyledText(`${sub.label}: `, currentStyle)}` : '';
      let html = `<p ${style}>+ ${labelPart}${display}</p>`;
      if (nestedHtml) {
        html += '\n' + nestedHtml;
      }
      return html;
    })
    .filter(Boolean)
    .join('\n');
}

function renderField(field: DocumentField, values: Record<string, string>, depth = 0): string {
  const val = resolveDocumentFieldValue(field, values);
  const hasLabel = Boolean(field.label && field.label.trim().length > 0);
  const rowStyle = fieldRowStyle(depth, field.style);
  const suffix = field.suffix ?? '';
  const prefix = field.prefix ?? '';
  const emptyText = field.empty_text ?? '';
  const labelSuffix = getDocumentFieldLabelSuffix(field);
  const stackedLayout = field.layout === 'stacked';

  if (field.type === 'checkbox') {
    const items = renderCheckboxOptionsInline(field, values);
    return hasLabel
      ? `<p ${rowStyle}><span ${labelStyle(field.style)}>${renderLabelText(`${field.label}${labelSuffix}`, field.style)}</span> ${items}</p>`
      : `<p ${rowStyle}>${items}</p>`;
  }

  if (field.type === 'list') {
    const header = hasLabel
      ? `<p ${rowStyle}><span ${labelStyle(field.style)}>${renderLabelText(`${field.label}${labelSuffix}`, field.style)}</span></p>`
      : '';

    if (field.block_layout) {
      const itemPrefix = field.item_label_prefix ?? '';
      const items = field.items
        .map((item, idx) => {
          const itemKey = item.table_field || `${field.id}_${idx}`;
          const itemVal = values[itemKey] ?? item.value ?? '';
          const subItemsHtml =
            item.sub_items && item.sub_items.length > 0
              ? renderSubItems(item.sub_items, field.id, idx, values, emptyText, depth, 1, item.style ?? field.style)
              : '';
          if (!hasTextValue(itemVal) && !hasTextValue(item.label) && !subItemsHtml && !emptyText) {
            return '';
          }

          const num = item.number?.trim() || `${itemPrefix}${idx + 1}`;
          const heading = item.label ? `${num} ${item.label}` : num;
          const itemTitleTextStyle = withDefaultBold(item.style ?? field.style);
          const itemTitleStyle = fieldRowStyle(depth, item.style ?? field.style);
          const itemContentStyle = listItemStyle(depth, item.style ?? field.style);
          const titleLine = `<p ${itemTitleStyle}><span ${labelStyle(item.style ?? field.style)}>${renderSemanticStyledText(heading, itemTitleTextStyle)}</span></p>`;
          const descLine = itemVal
            ? `<p ${itemContentStyle}>${normalizeDocumentTemplateValue(itemVal, item.style ?? field.style)}</p>`
            : `<p ${itemContentStyle}><span ${STYLE.empty}>${emptyText || '—'}</span></p>`;
          let html = `${titleLine}\n${descLine}`;
          if (subItemsHtml) {
            html += '\n' + subItemsHtml;
          }
          return html;
        })
        .filter(Boolean)
        .join('\n');
      return header ? `${header}\n${items}` : items;
    }

    const showDashPrefix = field.show_dash_prefix !== false;
    const items = field.items
      .map((item, idx) => {
        const itemKey = item.table_field || `${field.id}_${idx}`;
        const itemVal = values[itemKey] ?? item.value ?? '';
        const subItemsHtml =
          item.sub_items && item.sub_items.length > 0
            ? renderSubItems(item.sub_items, field.id, idx, values, emptyText, depth, 1, item.style ?? field.style)
            : '';
        if (!hasTextValue(itemVal) && !hasTextValue(item.label) && !subItemsHtml && !emptyText) {
          return '';
        }

        const itemSuffix = item.suffix ?? '';
        const currentItemStyle = listItemStyle(depth, item.style ?? field.style);
        const display = itemVal
          ? `${normalizeDocumentTemplateValue(itemVal, item.style ?? field.style)}${itemSuffix}`
          : `<span ${STYLE.empty}>${emptyText}</span>`;
        const labelPart = item.label ? `${renderSemanticStyledText(`${item.label}: `, item.style ?? field.style)}` : '';
        const dashPrefix = showDashPrefix ? '- ' : '';
        let html = `<p ${currentItemStyle}>${dashPrefix}${labelPart}${display}</p>`;
        if (subItemsHtml) {
          html += '\n' + subItemsHtml;
        }
        return html;
      })
      .filter(Boolean)
      .join('\n');
    return header ? `${header}\n${items}` : items;
  }

  if (field.type === 'multi_reference_list') {
    const key = getDocumentFieldValueKey(field);
    const selectedItems = parseDocumentMultiReferenceListValue(values[key] ?? field.value);
    const header = hasLabel
      ? `<p ${rowStyle}><span ${labelStyle(field.style)}>${renderLabelText(field.label, field.style)}</span></p>`
      : '';
    const dashPrefix = field.show_dash_prefix === false ? '' : '- ';
    const itemLabelPrefix = field.item_label_prefix ?? '';
    const items = selectedItems
      .map((item, idx) => {
        const formatted = formatDocumentMultiReferenceListItem(field, item);
        if (!formatted && !emptyText) return '';

        const currentItemStyle = listItemStyle(depth, field.style);
        const itemLabel = itemLabelPrefix ? `${itemLabelPrefix}${idx + 1}: ` : '';
        const display = formatted
          ? normalizeDocumentTemplateValue(formatted, field.style)
          : `<span ${STYLE.empty}>${emptyText}</span>`;

        return `<p ${currentItemStyle}>${dashPrefix}${renderSemanticStyledText(itemLabel, field.style)}${display}</p>`;
      })
      .filter(Boolean)
      .join('\n');

    if (!items && emptyText) {
      const emptyLine = `<p ${listItemStyle(depth, field.style)}><span ${STYLE.empty}>${emptyText}</span></p>`;
      return header ? `${header}\n${emptyLine}` : emptyLine;
    }

    return header ? `${header}\n${items}` : items;
  }

  const display = val
    ? `<span style="${getEditorTextStyleCss(field.style)}">${prefix}${normalizeDocumentTemplateValue(val, field.style)}${suffix}</span>`
    : emptyText
      ? `<span ${STYLE.empty}>${emptyText}</span>`
      : '';

  if (stackedLayout) {
    const lineCount = Math.max(1, field.line_count ?? (field.multiline ? (field.rows ?? 2) : 1));
    const lineBorderStyle =
      field.line_style === 'none'
        ? ''
        : `border-bottom: 1px ${field.line_style === 'solid' ? 'solid' : 'dotted'} #000000;`;
    const lineBaseStyle = `margin: 0 0 4pt ${Math.max(16, (depth + 1) * 16)}px; min-height: 20px; padding: 0 2px 2px; white-space: pre-wrap; ${lineBorderStyle} ${getEditorTextStyleCss(field.style)}`;
    const lines = Array.from({ length: lineCount }, (_, index) => {
      const lineContent = index === 0 ? display || '&nbsp;' : '&nbsp;';
      return `<div style="${lineBaseStyle}">${lineContent}</div>`;
    }).join('\n');

    return hasLabel
      ? `<p ${rowStyle}><span ${labelStyle(field.style)}>${renderLabelText(`${field.label}${labelSuffix}`, field.style)}</span></p>\n${lines}`
      : lines;
  }

  return hasLabel
    ? `<p ${rowStyle}><span ${labelStyle(field.style)}>${renderLabelText(`${field.label}${labelSuffix}`, field.style)}</span> ${display}</p>`
    : `<p ${rowStyle}>${display || `<span ${STYLE.empty}>${emptyText || '—'}</span>`}</p>`;
}

function renderFormTableParagraphField(field: DocumentField, values: Record<string, string>): string {
  const rawValue =
    field.type === 'checkbox' || field.type === 'list' || field.type === 'multi_reference_list'
      ? ''
      : resolveDocumentFieldValue(field, values);
  const textValue = rawValue?.trim() || field.empty_text?.trim() || '';

  if (!textValue) {
    return '';
  }

  return `<p style="margin: 0 0 4pt 0; ${getEditorTextStyleCss(field.style)}">${normalizeDocumentTemplateValue(textValue, field.style)}</p>`;
}

function renderFormTableCheckboxItems(field: DocumentCheckboxField, values: Record<string, string>): string {
  return renderCheckboxOptionsInline(field, values);
}

function renderFormTableTextLines(field: DocumentField, values: Record<string, string>): string {
  const suffix = field.suffix ?? '';
  const prefix = field.prefix ?? '';
  const rawValue = resolveDocumentFieldValue(field, values);
  const normalizedValue = rawValue ? `${prefix}${rawValue}${suffix}` : '';
  const baseLineCount = Math.max(1, field.line_count ?? (field.multiline ? (field.rows ?? 2) : 1));
  const providedLines = normalizedValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lineCount = Math.max(baseLineCount, providedLines.length || 0, 1);
  const borderStyle =
    field.line_style === 'none'
      ? ''
      : `border-bottom: 1px ${field.line_style === 'solid' ? 'solid' : 'dotted'} #000000;`;
  const lineStyle = `min-height: 18px; padding: 0 2px 1px; margin: 0 0 2pt 0; white-space: pre-wrap; ${borderStyle} ${getEditorTextStyleCss(field.style)}`;

  return Array.from({ length: lineCount }, (_, index) => {
    const content = providedLines[index] ? normalizeDocumentTemplateValue(providedLines[index], field.style) : '&nbsp;';
    return `<div style="${lineStyle}">${content}</div>`;
  }).join('');
}

function renderFormTableFieldContent(field: DocumentField, values: Record<string, string>): string {
  if (field.type === 'checkbox') {
    return renderFormTableCheckboxItems(field, values);
  }

  if (field.type === 'multi_reference_list') {
    const selectedItems = parseDocumentMultiReferenceListValue(values[getDocumentFieldValueKey(field)] ?? field.value);
    if (selectedItems.length === 0) {
      return renderFormTableTextLines(field, values);
    }

    return selectedItems
      .map((item, index) => {
        const itemLabel = field.item_label_prefix ? `${field.item_label_prefix}${index + 1}: ` : '';
        const dashPrefix = field.show_dash_prefix === false ? '' : '- ';
        const formatted = formatDocumentMultiReferenceListItem(field, item);
        return `<div style="margin: 0 0 2pt 0; ${getEditorTextStyleCss(field.style)}">${dashPrefix}${renderSemanticStyledText(
          itemLabel,
          field.style,
        )}${normalizeDocumentTemplateValue(formatted, field.style)}</div>`;
      })
      .join('');
  }

  if (field.type === 'list') {
    const showDashPrefix = field.show_dash_prefix !== false;
    const items = field.items
      .map((item, idx) => {
        const itemKey = item.table_field || `${field.id}_${idx}`;
        const itemVal = values[itemKey] ?? item.value ?? '';
        if (!hasTextValue(itemVal) && !hasTextValue(item.label)) {
          return '';
        }

        const dashPrefix = showDashPrefix ? '- ' : '';
        const itemLabel = item.label ? `${item.label}: ` : '';
        return `<div style="margin: 0 0 2pt 0; ${getEditorTextStyleCss(item.style ?? field.style)}">${dashPrefix}${renderSemanticStyledText(
          itemLabel,
          item.style ?? field.style,
        )}${normalizeDocumentTemplateValue(itemVal, item.style ?? field.style)}</div>`;
      })
      .filter(Boolean)
      .join('');

    return items || renderFormTableTextLines(field, values);
  }

  return renderFormTableTextLines(field, values);
}

function renderFormTableSection(section: DocumentSection, values: Record<string, string>, depth = 0): string {
  const noteFields = section.fields.filter((field) => !field.label.trim());
  const tableFields = section.fields.filter((field) => field.label.trim());
  const labelWidth = section.label_width?.trim() || '24%';
  const titleTextStyle = withDefaultBold(section.style);
  const titleStyle =
    depth === 0
      ? STYLE.section(section.style)
      : `style="margin: 0 0 5pt ${Math.max(16, depth * 16)}px; ${getEditorTextStyleCss(titleTextStyle)}"`;
  let html = `<p ${titleStyle}>${renderSemanticStyledText(section.title, titleTextStyle)}</p>\n`;

  noteFields.forEach((field) => {
    const paragraphHtml = renderFormTableParagraphField(field, values);
    if (paragraphHtml) {
      html += `${paragraphHtml}\n`;
    }
  });

  if (tableFields.length > 0) {
    const rows = tableFields
      .map((field) => {
        const labelSuffix = getDocumentFieldLabelSuffix(field, '');
        const labelText = `${field.label}${labelSuffix}`;
        return [
          '<tr>',
          `<td style="width:${labelWidth}; border: 1px solid #8f8f8f; padding: 4px 6px; vertical-align: top; ${getEditorTextStyleCss(withDefaultBold(field.style))}">${renderLabelText(labelText, field.style)}</td>`,
          `<td style="border: 1px solid #8f8f8f; padding: 4px 6px; vertical-align: top;">${renderFormTableFieldContent(field, values)}</td>`,
          '</tr>',
        ].join('');
      })
      .join('');

    html += [
      '<table style="width: 100%; border-collapse: collapse; table-layout: auto; margin: 0 0 6pt 0;">',
      '<tbody>',
      rows,
      '</tbody>',
      '</table>',
    ].join('');
  }

  if (section.children) {
    for (const child of section.children) {
      html += '\n' + renderSection(child, values, depth + 1);
    }
  }

  return html;
}

function renderSection(section: DocumentSection, values: Record<string, string>, depth = 0): string {
  if (section.layout === 'form_table') {
    return renderFormTableSection(section, values, depth);
  }

  const titleTextStyle = withDefaultBold(section.style);
  const titleStyle =
    depth === 0
      ? STYLE.section(section.style)
      : `style="margin: 0 0 5pt ${Math.max(16, depth * 16)}px; ${getEditorTextStyleCss(titleTextStyle)}"`;
  let html = `<p ${titleStyle}>${renderSemanticStyledText(section.title, titleTextStyle)}</p>\n`;

  for (const field of section.fields) {
    html += renderField(field, values, depth) + '\n';
  }

  if (section.children) {
    for (const child of section.children) {
      html += renderSection(child, values, depth + 1) + '\n';
    }
  }

  return html;
}

export const DOCUMENT_TEMPLATE_WRAPPER_ATTR = 'data-document-template';
export const DOCUMENT_TEMPLATE_WRAPPER_NAME_ATTR = 'data-document-template-name';
export const DOCUMENT_TEMPLATE_DOCX_BORDER_ATTR = 'data-docx-border';

const getDocumentTemplateDocxBorder = (template: DocumentTemplate) => {
  const value = template.context?.docx_border;
  return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
};

const getDocumentTemplateWrapperAttributes = (template: DocumentTemplate, escapedName: string) => {
  const escapedId = template.id.replace(/"/g, '&quot;');
  const attributes = [
    `${DOCUMENT_TEMPLATE_WRAPPER_ATTR}="${escapedId}"`,
    `${DOCUMENT_TEMPLATE_WRAPPER_NAME_ATTR}="${escapedName}"`,
  ];

  if (getDocumentTemplateDocxBorder(template) === 'none') {
    attributes.push(`${DOCUMENT_TEMPLATE_DOCX_BORDER_ATTR}="none"`);
  }

  return attributes.join(' ');
};

export function generateDocumentHtml(template: DocumentTemplate, values: Record<string, string> = {}): string {
  const escapedName = (template.name || '').replace(/"/g, '&quot;');
  const wrapperAttributes = getDocumentTemplateWrapperAttributes(template, escapedName);

  if (template.render_mode === 'raw_html') {
    const normalizedStaticHtml = normalizeDocumentTemplateHtmlFragment(template.static_html ?? '', template.style);
    return (
      `<div ${wrapperAttributes}>` +
      `<div style="${getEditorTextStyleCss(template.style)}">${normalizedStaticHtml}</div></div>`
    );
  }

  const sections = Array.isArray(template.sections) ? template.sections : [];
  const innerHtml = sections.map((section) => renderSection(section, values)).join('\n');
  return (
    `<div ${wrapperAttributes}>` + `<div style="${getEditorTextStyleCss(template.style)}">${innerHtml}</div></div>`
  );
}

export function getDocumentFetchFields(
  template: DocumentTemplate,
): Array<{ key: string; table: string; field: string }> {
  if (template.render_mode === 'raw_html') {
    return [];
  }

  const result: Array<{ key: string; table: string; field: string }> = [];

  function walk(sections: DocumentSection[]) {
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.table_field) {
          const [table, fieldName] = field.table_field.split('.');
          if (table && fieldName) {
            result.push({ key: getDocumentFieldValueKey(field), table, field: fieldName });
          }
        }
        if (field.type === 'list') {
          for (const item of field.items) {
            if (item.table_field) {
              const [table, fieldName] = item.table_field.split('.');
              if (table && fieldName) {
                result.push({
                  key: item.table_field,
                  table,
                  field: fieldName,
                });
              }
            }
          }
        }
        if (field.type === 'computed') {
          for (const ref of field.computed_from) {
            const [table, fieldName] = ref.split('.');
            if (table && fieldName) {
              result.push({ key: ref, table, field: fieldName });
            }
          }
        }
      }
      if (section.children) {
        walk(section.children);
      }
    }
  }

  if (Array.isArray(template.sections)) {
    walk(template.sections);
  }
  return result;
}
