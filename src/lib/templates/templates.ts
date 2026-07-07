import type { ExactSchemaCatalog } from '../template-data';
import type { DocumentTemplate } from '../document-templates';
import type { TableTemplate } from '../table-templates';

export type VariableKey =
  | {
      [Table in keyof ExactSchemaCatalog]: `${Table & string}.${ExactSchemaCatalog[Table][number] & string}`;
    }[keyof ExactSchemaCatalog]
  | string;

export const FRAPPE_VARIABLE_INPUT_TYPES = [
  'Autocomplete',
  'Attach',
  'Attach Image',
  'Barcode',
  'Button',
  'Check',
  'Code',
  'Color',
  'Currency',
  'Data',
  'Date',
  'Datetime',
  'Duration',
  'Dynamic Link',
  'Float',
  'Geolocation',
  'Heading',
  'HTML',
  'HTML Editor',
  'Icon',
  'Image',
  'Int',
  'JSON',
  'Link',
  'Long Text',
  'Markdown Editor',
  'Password',
  'Percent',
  'Phone',
  'Read Only',
  'Rating',
  'Select',
  'Signature',
  'Small Text',
  'Table',
  'Table MultiSelect',
  'Text',
  'Text Editor',
  'Time',
] as const;

export type FrappeVariableInputType = (typeof FRAPPE_VARIABLE_INPUT_TYPES)[number];

export type LegacyVariableInputType =
  | 'Checkbox'
  | 'Document template'
  | 'DropdownList'
  | 'ImageUrl'
  | 'NumberInput'
  | 'Table matrix'
  | 'Table template'
  | 'TextInput'
  | 'Textarea';

export type VariableInputType = FrappeVariableInputType | LegacyVariableInputType;

const LEGACY_FIELD_INPUT_TYPE_MAP: Partial<Record<LegacyVariableInputType, FrappeVariableInputType>> = {
  TextInput: 'Data',
  NumberInput: 'Float',
  DropdownList: 'Select',
  Checkbox: 'Check',
  Textarea: 'Long Text',
  ImageUrl: 'Attach Image',
};

const FRAPPE_INPUT_TYPE_SET = new Set<string>(FRAPPE_VARIABLE_INPUT_TYPES);
const SELECT_INPUT_TYPE_SET = new Set<VariableInputType>([
  'Autocomplete',
  'Dynamic Link',
  'Link',
  'Select',
  'Table MultiSelect',
]);
const NUMBER_INPUT_TYPE_SET = new Set<VariableInputType>(['Currency', 'Duration', 'Float', 'Int', 'Percent', 'Rating']);
const LONG_TEXT_INPUT_TYPE_SET = new Set<VariableInputType>([
  'Code',
  'HTML',
  'HTML Editor',
  'JSON',
  'Long Text',
  'Markdown Editor',
  'Text',
  'Text Editor',
]);
const IMAGE_INPUT_TYPE_SET = new Set<VariableInputType>(['Attach Image', 'Image']);

export const normalizeVariableInputType = (inputType?: string | null): VariableInputType => {
  if (!inputType) {
    return 'Data';
  }

  const legacyInputType = LEGACY_FIELD_INPUT_TYPE_MAP[inputType as LegacyVariableInputType];
  if (legacyInputType) {
    return legacyInputType;
  }

  if (FRAPPE_INPUT_TYPE_SET.has(inputType)) {
    return inputType as FrappeVariableInputType;
  }

  if (inputType === 'Table matrix' || inputType === 'Table template' || inputType === 'Document template') {
    return inputType;
  }

  return 'Data';
};

export const isSelectVariableInputType = (inputType?: string | null) =>
  SELECT_INPUT_TYPE_SET.has(normalizeVariableInputType(inputType));

export const isCheckVariableInputType = (inputType?: string | null) =>
  normalizeVariableInputType(inputType) === 'Check';

export const isNumberVariableInputType = (inputType?: string | null) =>
  NUMBER_INPUT_TYPE_SET.has(normalizeVariableInputType(inputType));

export const isLongTextVariableInputType = (inputType?: string | null) =>
  LONG_TEXT_INPUT_TYPE_SET.has(normalizeVariableInputType(inputType));

export const isImageVariableInputType = (inputType?: string | null) =>
  IMAGE_INPUT_TYPE_SET.has(normalizeVariableInputType(inputType));

export const isTableMatrixVariableInputType = (inputType?: string | null) => {
  const normalizedInputType = normalizeVariableInputType(inputType);
  return normalizedInputType === 'Table matrix';
};

export type VarTypes = Record<string, VariableInputType>;

export interface TemplateVariable {
  key: string;
  value: string;
}

export interface TemplateStructure {
  base_template_id: string;
  template: TableTemplate;
}

export interface DocumentTemplateStructure {
  base_template_id: string;
  template: DocumentTemplate;
}

export const DOCX_EDITOR_RENDERER_VERSION = 'docx-renderer-v4';

export interface TemplateDocxEditorSnapshot {
  base64: string;
  file_name?: string;
  updated_at: string;
  source: 'docx-editor';
  html_content_key?: string;
  renderer_version?: string;
}

export interface TemplateVariablesPayload {
  timestamp: string;
  variables: TemplateVariable[];
  var_types: VarTypes;
  var_titles?: Record<string, string>;
  raw_content?: string;
  manually_completed_variables?: string[];
  template_structures?: Record<string, TemplateStructure | null>;
  document_template_structures?: Record<string, DocumentTemplateStructure | null>;
  document_template_values?: Record<string, Record<string, string>>;
  docx_editor_snapshot?: TemplateDocxEditorSnapshot | null;
}

export const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return globalThis.btoa(binary);
};

export const base64ToArrayBuffer = (base64: string) => {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
};

export const isCurrentTemplateDocxEditorSnapshot = (
  snapshot: TemplateDocxEditorSnapshot | null | undefined,
  htmlContentKey: string,
): snapshot is TemplateDocxEditorSnapshot & { base64: string; renderer_version: string } =>
  snapshot !== null &&
  snapshot !== undefined &&
  Boolean(snapshot.base64) &&
  Boolean(htmlContentKey) &&
  snapshot.renderer_version === DOCX_EDITOR_RENDERER_VERSION;

export const getCurrentTemplateDocxEditorSnapshotBuffer = (
  snapshot: TemplateDocxEditorSnapshot | null | undefined,
  htmlContentKey: string,
) => {
  if (!isCurrentTemplateDocxEditorSnapshot(snapshot, htmlContentKey)) {
    return null;
  }

  try {
    return base64ToArrayBuffer(snapshot.base64);
  } catch {
    return null;
  }
};

export type TTemplateVariableRenderMode = 'snapshot' | 'live_config';

export interface ITemplateVariableEditorStyleSettings {
  font_family: string;
  font_size: string;
  line_height: string;
  color: string;
}

export interface ITemplateVariableRenderSettings {
  render_mode: TTemplateVariableRenderMode;
  live_config_draft_only: boolean;
  editor_style: ITemplateVariableEditorStyleSettings;
}

export const DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS: ITemplateVariableRenderSettings = {
  render_mode: 'snapshot',
  live_config_draft_only: true,
  editor_style: {
    font_family: 'Times New Roman, Times, serif',
    font_size: '13pt',
    line_height: '1.25',
    color: '#000000',
  },
};

export const normalizeTemplateVariableRenderSettings = (
  value?: Partial<ITemplateVariableRenderSettings> | null,
): ITemplateVariableRenderSettings => {
  const editorStyle = value?.editor_style;

  return {
    render_mode: value?.render_mode === 'live_config' ? 'live_config' : 'snapshot',
    live_config_draft_only:
      typeof value?.live_config_draft_only === 'boolean'
        ? value.live_config_draft_only
        : DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS.live_config_draft_only,
    editor_style: {
      font_family:
        typeof editorStyle?.font_family === 'string' && editorStyle.font_family.trim()
          ? editorStyle.font_family.trim()
          : DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS.editor_style.font_family,
      font_size:
        typeof editorStyle?.font_size === 'string' && editorStyle.font_size.trim()
          ? editorStyle.font_size.trim()
          : DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS.editor_style.font_size,
      line_height:
        typeof editorStyle?.line_height === 'string' && editorStyle.line_height.trim()
          ? editorStyle.line_height.trim()
          : DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS.editor_style.line_height,
      color:
        typeof editorStyle?.color === 'string' && editorStyle.color.trim()
          ? editorStyle.color.trim()
          : DEFAULT_TEMPLATE_VARIABLE_RENDER_SETTINGS.editor_style.color,
    },
  };
};

export const canUseLiveTemplateVariableConfig = (
  settings: ITemplateVariableRenderSettings,
  target: { status?: string | null; is_published?: boolean | null },
) => {
  if (settings.render_mode !== 'live_config') return false;
  if (!settings.live_config_draft_only) return true;
  return (target.status ?? 'DRAFT') === 'DRAFT' && target.is_published !== true;
};

export type TVariableKey = VariableKey;
export type TVariableInputType = VariableInputType;
export type TVarTypes = VarTypes;
export type ITemplateVariable = TemplateVariable;
export type ITemplateStructure = TemplateStructure;
export type IDocumentTemplateStructure = DocumentTemplateStructure;
export type ITemplateVariablesPayload = TemplateVariablesPayload;
