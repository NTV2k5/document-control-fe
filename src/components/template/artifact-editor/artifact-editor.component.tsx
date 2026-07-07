import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Braces, Download, FileImage, FileSpreadsheet, FileText, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Textarea } from 'reactjs-platform/ui';
import type { TArtifactType } from 'api';
import type { ExactSchemaCatalog, IVariablePickerItem } from '../../../lib';
import { VariablePickerDialog } from '../../variable/variable-picker-dialog';
import type { IArtifactEditorProps } from './artifact-editor.type';

type TSpreadsheetCell = {
  value?: string;
  variableKey?: string;
};

type TSpreadsheetSheet = {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  cells: Record<string, TSpreadsheetCell>;
};

type TSpreadsheetConfig = {
  sheets: TSpreadsheetSheet[];
};

type TSlideItem = {
  id: string;
  type: 'text' | 'image' | 'shape';
  text?: string;
  variableKey?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
};

type TPresentationConfig = {
  size: { width: number; height: number };
  slides: Array<{
    id: string;
    title: string;
    items: TSlideItem[];
  }>;
};

type TImageFormConfig = {
  size: { width: number; height: number };
  pages: Array<{
    id: string;
    name: string;
    background?: {
      data_url?: string;
      mime_type?: string;
      file_id?: string;
    };
    fields: Array<TSlideItem & { key?: string; align?: 'left' | 'center' | 'right' }>;
  }>;
};

const makeId = () => Math.random().toString(36).slice(2, 10);

export const ARTIFACT_TYPE_OPTIONS: Array<{ value: TArtifactType; label: string }> = [
  { value: 'rich_text', label: 'Word / Rich text' },
  { value: 'spreadsheet', label: 'Excel / Spreadsheet' },
  { value: 'presentation', label: 'PowerPoint' },
  { value: 'image_form', label: 'Image / Form fill' },
];

export const getArtifactTypeLabel = (artifactType: TArtifactType) =>
  ARTIFACT_TYPE_OPTIONS.find((option) => option.value === artifactType)?.label ?? artifactType.replace('_', ' ');

export const normalizeArtifactType = (artifactType?: string | null): TArtifactType => {
  if (artifactType === 'spreadsheet' || artifactType === 'presentation' || artifactType === 'image_form') {
    return artifactType;
  }

  return 'rich_text';
};

export const createDefaultArtifactConfig = (artifactType: TArtifactType): unknown => {
  if (artifactType === 'spreadsheet') {
    return { variable_placeholders: [] };
  }

  if (artifactType === 'presentation') {
    return { variable_placeholders: [] };
  }

  if (artifactType === 'image_form') {
    return {
      size: { width: 1123, height: 794 },
      pages: [
        {
          id: makeId(),
          name: 'Page 1',
          fields: [],
        },
      ],
    } satisfies TImageFormConfig;
  }

  return {};
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeVariableKey = (value: string) =>
  value
    .replace(/^\s*\{\{\s*/, '')
    .replace(/\s*\}\}\s*$/, '')
    .trim();

const collectPlaceholderKeys = (value: string, keys: Set<string>) => {
  const placeholderPattern = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(value))) {
    const key = normalizeVariableKey(match[1]);
    if (key) keys.add(key);
  }
};

export const extractArtifactVariableKeys = (config: unknown): string[] => {
  const keys = new Set<string>();

  const visit = (value: unknown, parentKey?: string) => {
    if (typeof value === 'string') {
      if (parentKey === 'variableKey' || parentKey === 'key' || parentKey === 'variable_key') {
        const key = normalizeVariableKey(value);
        if (key) keys.add(key);
      }
      collectPlaceholderKeys(value, keys);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }

    const record = asRecord(value);
    Object.entries(record).forEach(([key, item]) => visit(item, key));
  };

  visit(config);
  return Array.from(keys);
};

export const getArtifactCatalogVariableKeys = (catalog: ExactSchemaCatalog = {}) =>
  Object.entries(catalog).flatMap(([tableName, fields]) =>
    fields.map((fieldName) => (fieldName.includes('.') ? fieldName : `${tableName}.${fieldName}`)),
  );

export const buildArtifactPlaceholderContent = (
  artifactType: TArtifactType,
  config: unknown,
  sourceFileName?: string,
) => {
  if (artifactType === 'rich_text') return '';

  const variableKeys = extractArtifactVariableKeys(config);
  const title = sourceFileName || getArtifactTypeLabel(artifactType);
  const placeholders = variableKeys.map((key) => `<p>{{${escapeHtml(key)}}}</p>`).join('');

  return `<div data-artifact-placeholder="true" data-artifact-type="${artifactType}" style="display:none"><p>${escapeHtml(title)}</p>${placeholders}</div>`;
};

const columnName = (index: number) => {
  let result = '';
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - remainder) / 26);
  }

  return result;
};

const normalizeSpreadsheet = (config: unknown): TSpreadsheetConfig => {
  const defaultConfig = createDefaultArtifactConfig('spreadsheet') as TSpreadsheetConfig;
  const sheets = Array.isArray(asRecord(config).sheets) ? (asRecord(config).sheets as unknown[]) : [];

  if (!sheets.length) return defaultConfig;

  return {
    sheets: sheets.map((sheet, index) => {
      const record = asRecord(sheet);
      return {
        id: String(record.id || makeId()),
        name: String(record.name || `Sheet ${index + 1}`),
        rowCount: Math.max(1, Math.min(Number(record.rowCount || 12), 200)),
        columnCount: Math.max(1, Math.min(Number(record.columnCount || 6), 40)),
        cells: asRecord(record.cells) as Record<string, TSpreadsheetCell>,
      };
    }),
  };
};

const normalizePresentation = (config: unknown): TPresentationConfig => {
  const defaultConfig = createDefaultArtifactConfig('presentation') as TPresentationConfig;
  const record = asRecord(config);
  const slides = Array.isArray(record.slides) ? record.slides : [];
  if (!slides.length) return defaultConfig;

  return {
    size: {
      width: Number(asRecord(record.size).width || 1280),
      height: Number(asRecord(record.size).height || 720),
    },
    slides: slides.map((slide, index) => {
      const slideRecord = asRecord(slide);
      const items = Array.isArray(slideRecord.items) ? slideRecord.items : [];
      return {
        id: String(slideRecord.id || makeId()),
        title: String(slideRecord.title || `Slide ${index + 1}`),
        items: items.map((item) => {
          const itemRecord = asRecord(item);
          return {
            id: String(itemRecord.id || makeId()),
            type: itemRecord.type === 'image' || itemRecord.type === 'shape' ? itemRecord.type : 'text',
            text: String(itemRecord.text || ''),
            variableKey: itemRecord.variableKey ? String(itemRecord.variableKey) : undefined,
            x: Number(itemRecord.x ?? 80),
            y: Number(itemRecord.y ?? 80),
            width: Number(itemRecord.width ?? 320),
            height: Number(itemRecord.height ?? 80),
            fontSize: Number(itemRecord.fontSize ?? 24),
          };
        }),
      };
    }),
  };
};

const normalizeImageForm = (config: unknown): TImageFormConfig => {
  const defaultConfig = createDefaultArtifactConfig('image_form') as TImageFormConfig;
  const record = asRecord(config);
  const pages = Array.isArray(record.pages) ? record.pages : [];
  if (!pages.length) return defaultConfig;

  return {
    size: {
      width: Number(asRecord(record.size).width || 1123),
      height: Number(asRecord(record.size).height || 794),
    },
    pages: pages.map((page, index) => {
      const pageRecord = asRecord(page);
      const fields = Array.isArray(pageRecord.fields) ? pageRecord.fields : [];
      return {
        id: String(pageRecord.id || makeId()),
        name: String(pageRecord.name || `Page ${index + 1}`),
        background: asRecord(pageRecord.background) as TImageFormConfig['pages'][number]['background'],
        fields: fields.map((field) => {
          const fieldRecord = asRecord(field);
          return {
            id: String(fieldRecord.id || makeId()),
            type: 'text' as const,
            key: fieldRecord.key ? String(fieldRecord.key) : undefined,
            text: String(fieldRecord.text || ''),
            variableKey: fieldRecord.variableKey ? String(fieldRecord.variableKey) : undefined,
            x: Number(fieldRecord.x ?? 80),
            y: Number(fieldRecord.y ?? 80),
            width: Number(fieldRecord.width ?? 260),
            height: Number(fieldRecord.height ?? 40),
            fontSize: Number(fieldRecord.fontSize ?? 20),
            align:
              fieldRecord.align === 'center' || fieldRecord.align === 'right' ? fieldRecord.align : ('left' as const),
          };
        }),
      };
    }),
  };
};

const renderBoundText = (
  item: { text?: string; variableKey?: string; key?: string },
  values?: Record<string, string>,
) => {
  const key = item.variableKey || item.key || '';
  return key && values?.[key] !== undefined ? values[key] : item.text || '';
};

export const ArtifactEditor = ({
  artifactType,
  config,
  values = {},
  variableKeys = [],
  variableCatalog = {},
  template_type,
  readOnly = false,
  onConfigChange,
}: IArtifactEditorProps) => {
  if (artifactType === 'spreadsheet') {
    return (
      <SpreadsheetArtifactEditor
        config={normalizeSpreadsheet(config)}
        readOnly={readOnly}
        values={values}
        variableKeys={variableKeys}
        variableCatalog={variableCatalog}
        template_type={template_type}
        onConfigChange={onConfigChange}
      />
    );
  }

  if (artifactType === 'presentation') {
    return (
      <PresentationArtifactEditor
        config={normalizePresentation(config)}
        readOnly={readOnly}
        values={values}
        variableKeys={variableKeys}
        variableCatalog={variableCatalog}
        template_type={template_type}
        onConfigChange={onConfigChange}
      />
    );
  }

  if (artifactType === 'image_form') {
    return (
      <ImageFormArtifactEditor
        config={normalizeImageForm(config)}
        readOnly={readOnly}
        values={values}
        variableKeys={variableKeys}
        variableCatalog={variableCatalog}
        template_type={template_type}
        onConfigChange={onConfigChange}
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-500">
      Rich text templates use the existing editor.
    </div>
  );
};

const SpreadsheetArtifactEditor = ({
  config,
  values,
  variableKeys,
  variableCatalog,
  template_type,
  readOnly,
  onConfigChange,
}: {
  config: TSpreadsheetConfig;
  values: Record<string, string>;
  variableKeys: string[];
  variableCatalog: ExactSchemaCatalog;
  template_type?: string | null;
  readOnly: boolean;
  onConfigChange?: (config: unknown) => void;
}) => {
  const sheet = config.sheets[0];
  const [activeCellKey, setActiveCellKey] = useState('A1');

  const updateSheet = (nextSheet: TSpreadsheetSheet) => {
    onConfigChange?.({ ...config, sheets: [nextSheet, ...config.sheets.slice(1)] });
  };

  const updateCell = (key: string, patch: Partial<TSpreadsheetCell>) => {
    const currentCell = sheet.cells[key] || {};
    updateSheet({
      ...sheet,
      cells: {
        ...sheet.cells,
        [key]: {
          ...currentCell,
          ...patch,
        },
      },
    });
  };

  const insertVariable = (item: IVariablePickerItem) => {
    const targetCellKey = activeCellKey || 'A1';
    updateCell(targetCellKey, {
      value: item.token || `{{${item.key}}}`,
      variableKey: item.key,
    });
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileSpreadsheet className="size-4 text-emerald-600" />
          Spreadsheet editor
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[13px] font-semibold text-slate-600">
            Target {activeCellKey}
          </span>
          <VariablePickerButton
            catalog={variableCatalog}
            template_type={template_type}
            disabled={readOnly}
            onSelect={insertVariable}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => updateSheet({ ...sheet, rowCount: sheet.rowCount + 1 })}>
            <Plus className="size-3.5" />
            Row
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => updateSheet({ ...sheet, columnCount: sheet.columnCount + 1 })}>
            <Plus className="size-3.5" />
            Column
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 border border-slate-200 bg-slate-100 px-3 py-2 text-slate-500" />
              {Array.from({ length: sheet.columnCount }).map((_, columnIndex) => (
                <th
                  key={columnName(columnIndex)}
                  className="sticky top-0 z-10 min-w-[180px] border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600">
                  {columnName(columnIndex)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rowCount }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                <th className="sticky left-0 z-10 border border-slate-200 bg-slate-100 px-3 py-2 text-slate-500">
                  {rowIndex + 1}
                </th>
                {Array.from({ length: sheet.columnCount }).map((__, columnIndex) => {
                  const cellKey = `${columnName(columnIndex)}${rowIndex + 1}`;
                  const cell = sheet.cells[cellKey] || {};
                  return (
                    <td key={cellKey} className="border border-slate-200 align-top">
                      <div className="grid gap-1 p-1">
                        <Input
                          value={cell.variableKey ? (values[cell.variableKey] ?? cell.value ?? '') : (cell.value ?? '')}
                          disabled={readOnly}
                          onFocus={() => setActiveCellKey(cellKey)}
                          onChange={(event) => updateCell(cellKey, { value: event.target.value })}
                          className="h-8 rounded-md border-0 px-2 shadow-none"
                        />
                        <VariableKeyInput
                          value={cell.variableKey ?? ''}
                          disabled={readOnly}
                          variableKeys={variableKeys}
                          onFocus={() => setActiveCellKey(cellKey)}
                          onChange={(nextValue) => updateCell(cellKey, { variableKey: nextValue || undefined })}
                          className="h-7 rounded-md border-dashed px-2 text-[13px] text-blue-700"
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PresentationArtifactEditor = ({
  config,
  values,
  variableKeys,
  variableCatalog,
  template_type,
  readOnly,
  onConfigChange,
}: {
  config: TPresentationConfig;
  values: Record<string, string>;
  variableKeys: string[];
  variableCatalog: ExactSchemaCatalog;
  template_type?: string | null;
  readOnly: boolean;
  onConfigChange?: (config: unknown) => void;
}) => {
  const slide = config.slides[0];

  const updateSlide = (nextSlide: TPresentationConfig['slides'][number]) => {
    onConfigChange?.({ ...config, slides: [nextSlide, ...config.slides.slice(1)] });
  };

  const updateItem = (itemId: string, patch: Partial<TSlideItem>) => {
    updateSlide({
      ...slide,
      items: slide.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  };

  const addText = () => {
    updateSlide({
      ...slide,
      items: [
        ...slide.items,
        {
          id: makeId(),
          type: 'text',
          text: 'Text',
          x: 120,
          y: 120,
          width: 360,
          height: 72,
          fontSize: 28,
        },
      ],
    });
  };

  return (
    <CanvasArtifactEditor
      title="Presentation editor"
      icon={<FileText className="size-4 text-blue-600" />}
      size={config.size}
      items={slide.items}
      values={values}
      variableKeys={variableKeys}
      variableCatalog={variableCatalog}
      template_type={template_type}
      readOnly={readOnly}
      onAddText={addText}
      onUpdateItem={updateItem}
      onRemoveItem={(itemId) => updateSlide({ ...slide, items: slide.items.filter((item) => item.id !== itemId) })}
    />
  );
};

const ImageFormArtifactEditor = ({
  config,
  values,
  variableKeys,
  variableCatalog,
  template_type,
  readOnly,
  onConfigChange,
}: {
  config: TImageFormConfig;
  values: Record<string, string>;
  variableKeys: string[];
  variableCatalog: ExactSchemaCatalog;
  template_type?: string | null;
  readOnly: boolean;
  onConfigChange?: (config: unknown) => void;
}) => {
  const page = config.pages[0];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updatePage = (nextPage: TImageFormConfig['pages'][number]) => {
    onConfigChange?.({ ...config, pages: [nextPage, ...config.pages.slice(1)] });
  };

  const updateItem = (itemId: string, patch: Partial<TImageFormConfig['pages'][number]['fields'][number]>) => {
    updatePage({
      ...page,
      fields: page.fields.map((field) => (field.id === itemId ? { ...field, ...patch } : field)),
    });
  };

  const addField = () => {
    updatePage({
      ...page,
      fields: [
        ...page.fields,
        {
          id: makeId(),
          type: 'text',
          key: 'field_key',
          text: '{{field_key}}',
          x: 120,
          y: 120,
          width: 280,
          height: 42,
          fontSize: 22,
          align: 'left',
        },
      ],
    });
  };

  const handleBackgroundFile = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    updatePage({
      ...page,
      background: {
        data_url: dataUrl,
        mime_type: file.type,
      },
    });
  };

  const handleDownloadPng = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = config.size.width;
    canvas.height = config.size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (page.background?.data_url) {
      const image = new Image();
      image.src = page.background.data_url;
      await new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

    page.fields.forEach((field) => {
      ctx.font = `${field.fontSize || 20}px "Times New Roman", serif`;
      ctx.fillStyle = '#111';
      ctx.textAlign = field.align || 'left';
      const text = renderBoundText(field, values);
      const x =
        field.align === 'center'
          ? field.x + field.width / 2
          : field.align === 'right'
            ? field.x + field.width
            : field.x;
      ctx.fillText(text, x, field.y + field.fontSize);
    });

    const link = document.createElement('a');
    link.download = 'image-form.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileImage className="size-4 text-amber-600" />
          Image form editor
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleBackgroundFile(event.target.files?.[0])}
          />
          <Button size="sm" variant="outline" disabled={readOnly} onClick={() => fileInputRef.current?.click()}>
            Background
          </Button>
          <Button size="sm" variant="outline" disabled={readOnly} onClick={addField}>
            <Plus className="size-3.5" />
            Field
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleDownloadPng()}>
            <Download className="size-3.5" />
            PNG
          </Button>
        </div>
      </div>
      <CanvasArtifactEditor
        title=""
        icon={null}
        size={config.size}
        items={page.fields}
        values={values}
        variableKeys={variableKeys}
        variableCatalog={variableCatalog}
        template_type={template_type}
        readOnly={readOnly}
        background={page.background?.data_url}
        onAddText={addField}
        onUpdateItem={updateItem}
        onRemoveItem={(itemId) => updatePage({ ...page, fields: page.fields.filter((field) => field.id !== itemId) })}
      />
    </div>
  );
};

const CanvasArtifactEditor = ({
  title,
  icon,
  size,
  items,
  values,
  variableKeys,
  variableCatalog,
  template_type,
  readOnly,
  background,
  onAddText,
  onUpdateItem,
  onRemoveItem,
}: {
  title: string;
  icon: ReactNode;
  size: { width: number; height: number };
  items: Array<TSlideItem & { key?: string; align?: 'left' | 'center' | 'right' }>;
  values: Record<string, string>;
  variableKeys: string[];
  variableCatalog: ExactSchemaCatalog;
  template_type?: string | null;
  readOnly: boolean;
  background?: string;
  onAddText: () => void;
  onUpdateItem: (
    itemId: string,
    patch: Partial<TSlideItem & { key?: string; align?: 'left' | 'center' | 'right' }>,
  ) => void;
  onRemoveItem: (itemId: string) => void;
}) => {
  const scale = useMemo(() => Math.min(1, 980 / size.width), [size.width]);
  const dragRef = useRef<{ id: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? '');
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];

  const insertVariable = (item: IVariablePickerItem) => {
    if (!selectedItem) return;
    const token = item.token || `{{${item.key}}}`;
    onUpdateItem(selectedItem.id, {
      text: token,
      variableKey: item.key,
      key: item.key,
    });
    setSelectedItemId(selectedItem.id);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {title ? (
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {icon}
            {title}
          </div>
          <Button size="sm" variant="outline" disabled={readOnly} onClick={onAddText}>
            <Plus className="size-3.5" />
            Text
          </Button>
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
        <div className="overflow-auto bg-slate-100 p-6">
          <div
            className="relative mx-auto overflow-hidden rounded border border-slate-300 bg-white shadow-sm"
            style={{ width: size.width * scale, height: size.height * scale }}>
            {background ? (
              <img src={background} alt="" className="absolute inset-0 h-full w-full object-contain" />
            ) : null}
            {items.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onPointerDown={(event) => {
                  if (readOnly) return;
                  setSelectedItemId(item.id);
                  dragRef.current = {
                    id: item.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    x: item.x,
                    y: item.y,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const drag = dragRef.current;
                  if (!drag || drag.id !== item.id) return;
                  onUpdateItem(item.id, {
                    x: Math.max(0, drag.x + (event.clientX - drag.startX) / scale),
                    y: Math.max(0, drag.y + (event.clientY - drag.startY) / scale),
                  });
                }}
                onPointerUp={() => {
                  dragRef.current = null;
                }}
                onFocus={() => setSelectedItemId(item.id)}
                className={`absolute cursor-move border bg-blue-50/70 p-1 text-slate-950 outline-none ring-blue-300 focus:ring-2 ${
                  selectedItem?.id === item.id ? 'border-blue-600 ring-2' : 'border-blue-400'
                }`}
                style={{
                  left: item.x * scale,
                  top: item.y * scale,
                  width: item.width * scale,
                  height: item.height * scale,
                  fontSize: Math.max(10, item.fontSize * scale),
                  textAlign: item.align || 'left',
                }}>
                {renderBoundText(item, values) || 'Text'}
              </div>
            ))}
          </div>
        </div>
        <div className="min-h-0 overflow-auto border-l border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-500">Items</div>
              <div className="mt-1 truncate text-[13px] text-slate-500">
                Target {selectedItem?.key || selectedItem?.variableKey || selectedItem?.text || 'none'}
              </div>
            </div>
            <VariablePickerButton
              catalog={variableCatalog}
              template_type={template_type}
              disabled={readOnly || !selectedItem}
              onSelect={insertVariable}
            />
          </div>
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${
                  selectedItem?.id === item.id ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200'
                }`}>
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className="min-w-0 truncate text-left text-sm font-semibold text-slate-800">
                    {item.key || item.variableKey || 'Text'}
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onRemoveItem(item.id)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="grid gap-2">
                  <Textarea
                    value={item.text || ''}
                    disabled={readOnly}
                    onChange={(event) => onUpdateItem(item.id, { text: event.target.value })}
                    className="min-h-16 text-sm"
                  />
                  <VariableKeyInput
                    value={item.variableKey || item.key || ''}
                    disabled={readOnly}
                    variableKeys={variableKeys}
                    onChange={(nextValue) =>
                      onUpdateItem(item.id, {
                        variableKey: nextValue || undefined,
                        key: nextValue || undefined,
                      })
                    }
                    className="h-9 text-[13px]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={Math.round(item.x)}
                      disabled={readOnly}
                      onChange={(event) => onUpdateItem(item.id, { x: Number(event.target.value) })}
                    />
                    <Input
                      type="number"
                      value={Math.round(item.y)}
                      disabled={readOnly}
                      onChange={(event) => onUpdateItem(item.id, { y: Number(event.target.value) })}
                    />
                    <Input
                      type="number"
                      value={Math.round(item.width)}
                      disabled={readOnly}
                      onChange={(event) => onUpdateItem(item.id, { width: Number(event.target.value) })}
                    />
                    <Input
                      type="number"
                      value={Math.round(item.height)}
                      disabled={readOnly}
                      onChange={(event) => onUpdateItem(item.id, { height: Number(event.target.value) })}
                    />
                  </div>
                  <Input
                    type="number"
                    value={item.fontSize}
                    disabled={readOnly}
                    onChange={(event) => onUpdateItem(item.id, { fontSize: Number(event.target.value) })}
                    placeholder="font size"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const VariableKeyInput = ({
  value,
  disabled,
  variableKeys,
  className,
  onFocus,
  onChange,
}: {
  value: string;
  disabled: boolean;
  variableKeys: string[];
  className?: string;
  onFocus?: () => void;
  onChange: (value: string) => void;
}) => {
  const listId = useId();

  return (
    <>
      <Input
        value={value}
        list={listId}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Bind variable key"
        className={className}
      />
      <datalist id={listId}>
        {variableKeys.map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>
    </>
  );
};

const VariablePickerButton = ({
  catalog,
  template_type,
  disabled,
  onSelect,
}: {
  catalog: ExactSchemaCatalog;
  template_type?: string | null;
  disabled?: boolean;
  onSelect: (item: IVariablePickerItem) => void;
}) => {
  const [open, setOpen] = useState(false);
  const hasCatalog = Object.keys(catalog || {}).length > 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !hasCatalog}
        onClick={() => setOpen(true)}
        title={hasCatalog ? 'Insert variable' : 'Variable catalog is not ready'}>
        <Braces className="size-3.5" />
        Insert Variable
      </Button>
      <VariablePickerDialog
        open={open}
        catalog={catalog}
        onOpenChange={setOpen}
        onSelect={onSelect}
        template_type={template_type}
        title="Insert variable"
        description="Choose a variable to bind to the selected artifact target."
        confirmLabel="Insert"
        multiSelect={false}
      />
    </>
  );
};
