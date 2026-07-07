import type HTMLToDocx from '@turbodocx/html-to-docx';
import htmlToDocxBrowserBundle from '@turbodocx/html-to-docx/dist/html-to-docx.browser.js?raw';
import { Buffer as BufferPolyfill } from 'buffer';
import { type ClassValue, clsx } from 'clsx';
import {
  BorderStyle,
  Paragraph as DocxParagraph,
  Table as DocxTable,
  type IBorderOptions,
  type IRunStylePropertiesOptions,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';
import { jsPDF as JsPdfStatic } from 'jspdf';
import { twMerge } from 'tailwind-merge';
import { getEditorFontFamilyCssValue, getEditorGlobalStyle, getEditorHeadingSizes } from '../editor-style';

type Html2CanvasFactory = typeof import('html2canvas') extends {
  default: infer T;
}
  ? T
  : never;
type JsPdfConstructor = typeof JsPdfStatic;
type CanvgConstructor = typeof import('canvg') extends { Canvg: infer T } ? T : never;
type DomPurifyFactory = typeof import('dompurify') extends { default: infer T } ? T : never;
type DomPurifyInstance = {
  sanitize: (html: string, config?: Record<string, unknown>) => string;
};

let cachedHtml2Canvas: Html2CanvasFactory | null = null;
let cachedJsPdf: JsPdfConstructor | null = null;
let cachedCanvg: CanvgConstructor | null = null;
let cachedDomPurify: DomPurifyInstance | null = null;

const EXPORT_PAGE_WIDTH_MM = 210;
const EXPORT_PAGE_HEIGHT_MM = 297;
const EXPORT_PAGE_MARGIN_MM = { top: 10, right: 10, bottom: 20, left: 10 };
const EXPORT_CONTENT_WIDTH_MM = EXPORT_PAGE_WIDTH_MM - EXPORT_PAGE_MARGIN_MM.left - EXPORT_PAGE_MARGIN_MM.right;
const PDF_EXPORT_PAGE_MARGIN_MM = { top: 10, right: 10, bottom: 10, left: 10 };
const PDF_EXPORT_CONTENT_WIDTH_MM =
  EXPORT_PAGE_WIDTH_MM - PDF_EXPORT_PAGE_MARGIN_MM.left - PDF_EXPORT_PAGE_MARGIN_MM.right;
const PDF_EXPORT_CONTENT_HEIGHT_MM =
  EXPORT_PAGE_HEIGHT_MM - PDF_EXPORT_PAGE_MARGIN_MM.top - PDF_EXPORT_PAGE_MARGIN_MM.bottom;
const CSS_PX_PER_MM = 96 / 25.4;
const WORD_EXPORT_MAX_IMAGE_WIDTH_PX = Math.round(EXPORT_CONTENT_WIDTH_MM * CSS_PX_PER_MM);
const MM_TO_TWIP = 56.6929133858;
const WORD_PAGE_BREAK_TOKEN_PREFIX = '__DOCX_PAGE_BREAK_';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORD_XML_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const OFFICE_DOCUMENT_RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WORD_RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships';
const WORD_FOOTER_RELATIONSHIP_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer';
const WORD_FOOTER_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml';
const WORD_FONT_ATTRIBUTES = ['ascii', 'hAnsi', 'cs', 'eastAsia'] as const;
const GENERIC_WORD_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
]);

type TDocxPlaceholderReplacementMap = Record<string, string>;

const mmToTwip = (value: number) => Math.round(value * MM_TO_TWIP);
const WORD_EXPORT_TABLE_WIDTH_TWIP = mmToTwip(EXPORT_CONTENT_WIDTH_MM);

const escapeXmlText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const toDocxPlainText = (value: string) => {
  if (!value) return '';

  if (typeof DOMParser !== 'undefined' && /<[^>]+>/.test(value)) {
    try {
      const document = new DOMParser().parseFromString(value, 'text/html');
      return (document.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch {
      // Fall through to regex-based stripping below.
    }
  }

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getDocumentExportStyle = () => {
  const style = getEditorGlobalStyle();
  const headingSizes = getEditorHeadingSizes(style);

  return {
    fontFamily: getEditorFontFamilyCssValue(style.font_family),
    bodyFontSize: style.font_size,
    bodyLineHeight: style.line_height,
    tableFontSize: style.font_size,
    tableLineHeight: style.line_height,
    heading1FontSize: headingSizes.h1,
    heading2FontSize: headingSizes.h2,
    heading3FontSize: headingSizes.h3,
  };
};

const getExportPageStyle = () => {
  const {
    fontFamily,
    bodyFontSize,
    bodyLineHeight,
    tableFontSize,
    tableLineHeight,
    heading1FontSize,
    heading2FontSize,
    heading3FontSize,
  } = getDocumentExportStyle();

  return [
    `@page { size: A4; margin: ${EXPORT_PAGE_MARGIN_MM.top}mm ${EXPORT_PAGE_MARGIN_MM.right}mm ${EXPORT_PAGE_MARGIN_MM.bottom}mm ${EXPORT_PAGE_MARGIN_MM.left}mm; }`,
    'html, body { margin: 0; padding: 0; }',
    `.document-export-page { width: 100%; max-width: 100%; box-sizing: border-box; font-family: ${fontFamily}; font-size: ${bodyFontSize}; line-height: ${bodyLineHeight}; color: #000; }`,
    '.document-export-page * { box-sizing: border-box; }',
    '.document-export-page p { margin: 0 0 6pt; }',
    `.document-export-page h1 { margin: 0 0 10pt; font-family: ${fontFamily}; font-size: ${heading1FontSize}; line-height: 1.25; font-weight: 700; }`,
    `.document-export-page h2 { margin: 12pt 0 8pt; font-family: ${fontFamily}; font-size: ${heading2FontSize}; line-height: 1.25; font-weight: 700; }`,
    `.document-export-page h3 { margin: 10pt 0 6pt; font-family: ${fontFamily}; font-size: ${heading3FontSize}; line-height: 1.3; font-weight: 700; }`,
    `.document-export-page table { width: 100% !important; max-width: 100% !important; border-collapse: collapse; table-layout: fixed; font-family: ${fontFamily}; font-size: ${tableFontSize}; line-height: ${tableLineHeight}; }`,
    '.document-export-page th, .document-export-page td { border: 1px solid #000; overflow-wrap: anywhere; word-break: break-word; padding: 4pt 5pt; vertical-align: top; }',
    '.document-export-page th { font-weight: 700; text-align: center; vertical-align: middle; }',
    '.document-export-page td p { margin: 0; }',
    '.document-export-page .page-break, .document-export-page [data-cke-pagebreak] { display: block; height: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: hidden !important; break-after: page; page-break-after: always; visibility: hidden; }',
  ].join('\n');
};

const getExportWordWrapperStyle = () => {
  const { fontFamily, bodyFontSize, bodyLineHeight } = getDocumentExportStyle();

  return [
    'width:100%',
    'max-width:100%',
    'box-sizing:border-box',
    `font-family:${fontFamily}`,
    `font-size:${bodyFontSize}`,
    `line-height:${bodyLineHeight}`,
    'color:#000',
  ].join(';');
};

const getExportWordTableStyle = () => {
  const { fontFamily, tableFontSize, tableLineHeight } = getDocumentExportStyle();

  return [
    'border-collapse:collapse',
    'table-layout:fixed',
    `font-family:${fontFamily}`,
    `font-size:${tableFontSize}`,
    `line-height:${tableLineHeight}`,
  ].join(';');
};

const applyWordHeadingStylesForExport = (doc: Document) => {
  const { fontFamily, heading1FontSize, heading2FontSize, heading3FontSize } = getDocumentExportStyle();
  const headingStyles: Array<[selector: 'h1' | 'h2' | 'h3', style: string]> = [
    ['h1', `margin:0 0 10pt;font-family:${fontFamily};font-size:${heading1FontSize};line-height:1.25;font-weight:700;`],
    [
      'h2',
      `margin:12pt 0 8pt;font-family:${fontFamily};font-size:${heading2FontSize};line-height:1.25;font-weight:700;`,
    ],
    [
      'h3',
      `margin:10pt 0 6pt;font-family:${fontFamily};font-size:${heading3FontSize};line-height:1.3;font-weight:700;`,
    ],
  ];

  headingStyles.forEach(([selector, style]) => {
    doc.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      appendInlineStyle(element, style);
    });
  });
};

const EXPORT_WORD_HIDDEN_TABLE_STYLE = [
  'border:0 none transparent',
  'border-collapse:collapse',
  'table-layout:fixed',
].join(';');

const EXPORT_WORD_CELL_STYLE = [
  'border:1px solid #000',
  'overflow-wrap:anywhere',
  'word-break:break-word',
  'padding:4pt 5pt',
  'vertical-align:top',
].join(';');

const EXPORT_WORD_HIDDEN_CELL_STYLE = [
  'border:0 none transparent',
  'overflow-wrap:normal',
  'word-break:normal',
  'padding:0',
  'vertical-align:top',
].join(';');

const wrapHtmlForPageExport = (htmlContent: string) =>
  `<style>${getExportPageStyle()}</style><div class="document-export-page">${htmlContent}</div>`;

const PAGE_BREAK_SELECTOR = [
  '.page-break',
  '[data-cke-pagebreak]',
  '[style*="page-break-before"]',
  '[style*="page-break-after"]',
  '[style*="break-before: page"]',
  '[style*="break-after: page"]',
].join(',');

const splitHtmlByPdfPageBreaks = (htmlContent: string) => {
  if (typeof document === 'undefined') return [htmlContent];

  const root = document.createElement('div');
  root.innerHTML = htmlContent;
  const pageBreaks = Array.from(root.querySelectorAll<HTMLElement>(PAGE_BREAK_SELECTOR));
  if (pageBreaks.length === 0) return [htmlContent];

  const sentinel = `__PDF_PAGE_BREAK_${Date.now()}_${Math.random().toString(36).slice(2)}__`;

  pageBreaks.forEach((element) => {
    element.parentNode?.insertBefore(document.createTextNode(sentinel), element);
    element.remove();
  });

  return root.innerHTML
    .split(sentinel)
    .map((segment) => segment.trim())
    .filter(Boolean);
};

type TWordExportHtml = {
  html: string;
  pageBreakTokenCount: number;
  imageCount: number;
  tableColumnLayouts: number[][];
  tableBorderVisibility: boolean[];
  tableCellStyles: TWordTableCellStyle[][][];
};

type TWordTableExportPatch = Pick<TWordExportHtml, 'tableColumnLayouts' | 'tableBorderVisibility' | 'tableCellStyles'>;

type TWordTableCellStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  font_family?: string;
  font_size?: number;
  color?: string;
  background_color?: string;
  alignment?: 'left' | 'center' | 'right' | 'both';
  vertical_align?: 'top' | 'center' | 'bottom';
};

type TZipFile = {
  async: (type: 'string') => Promise<string>;
};

type TZipArchive = {
  loadAsync: (data: ArrayBuffer) => Promise<TZipArchive>;
  file: {
    (path: string): TZipFile | null;
    (path: string, data: string): TZipArchive;
  };
  forEach?: (callback: (relativePath: string, file: unknown) => void) => void;
  generateAsync: (options: { type: 'blob'; mimeType: string }) => Promise<Blob>;
};

type TZipConstructor = new () => TZipArchive;

const appendInlineStyle = (element: HTMLElement, style: string) => {
  const currentStyle = element.getAttribute('style')?.trim();
  element.setAttribute('style', currentStyle ? `${currentStyle};${style}` : style);
};

const prependInlineStyle = (element: HTMLElement, style: string) => {
  const currentStyle = element.getAttribute('style')?.trim();
  element.setAttribute('style', currentStyle ? `${style};${currentStyle}` : style);
};

const getPositiveIntegerAttribute = (element: HTMLElement, attributeName: string, fallback = 1) => {
  const value = Number.parseInt(element.getAttribute(attributeName) || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const parseCssWidthPercent = (value?: string | null) => {
  const normalized = value?.trim();
  if (!normalized) return null;

  const numericValue = Number.parseFloat(normalized);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  if (normalized.endsWith('%')) {
    return numericValue;
  }

  if (/^\d+(\.\d+)?px$/i.test(normalized)) {
    return (numericValue / WORD_EXPORT_MAX_IMAGE_WIDTH_PX) * 100;
  }

  return null;
};

const getElementWidthPercent = (element: HTMLElement) =>
  parseCssWidthPercent(element.style.width) ??
  parseCssWidthPercent(element.getAttribute('width')) ??
  parseCssWidthPercent(element.style.maxWidth);

const getTableRowColumnCount = (row: HTMLTableRowElement) =>
  Array.from(row.cells).reduce((count, cell) => count + getPositiveIntegerAttribute(cell, 'colspan'), 0);

const getTableColumnLayoutForWordExport = (table: HTMLTableElement) => {
  const rows = Array.from(table.rows);
  if (rows.length === 0) return [];

  const columnCount = Math.max(...rows.map(getTableRowColumnCount));
  if (!Number.isFinite(columnCount) || columnCount <= 0) return [];

  const columnPercents: Array<number | null> = Array.from({ length: columnCount }, () => null);

  rows.forEach((row) => {
    let columnIndex = 0;

    Array.from(row.cells).forEach((cell) => {
      const colspan = getPositiveIntegerAttribute(cell, 'colspan');
      const widthPercent = getElementWidthPercent(cell);

      if (widthPercent !== null) {
        const distributedWidth = widthPercent / colspan;

        for (let offset = 0; offset < colspan && columnIndex + offset < columnCount; offset += 1) {
          if (columnPercents[columnIndex + offset] === null) {
            columnPercents[columnIndex + offset] = distributedWidth;
          }
        }
      }

      columnIndex += colspan;
    });
  });

  const assignedTotal = columnPercents.reduce<number>((total, value) => total + (value || 0), 0);
  const missingColumnCount = columnPercents.filter((value) => value === null).length;
  const fallbackWidth =
    missingColumnCount > 0 ? Math.max(0, 100 - assignedTotal) / missingColumnCount || 100 / columnCount : 0;
  const completedPercents = columnPercents.map((value) => value ?? fallbackWidth);
  const percentTotal = completedPercents.reduce((total, value) => total + value, 0) || 100;
  const tableWidthPercent = Math.min(100, getElementWidthPercent(table) ?? 100);
  const tableWidthTwip = Math.max(1, Math.round((tableWidthPercent / 100) * WORD_EXPORT_TABLE_WIDTH_TWIP));
  const rawWidths = completedPercents.map((value) => Math.max(1, Math.round((value / percentTotal) * tableWidthTwip)));
  const widthDelta = tableWidthTwip - rawWidths.reduce((total, value) => total + value, 0);

  if (rawWidths.length > 0 && widthDelta !== 0) {
    rawWidths[rawWidths.length - 1] = Math.max(1, rawWidths[rawWidths.length - 1] + widthDelta);
  }

  return rawWidths;
};

const DOCX_BORDER_NONE_SELECTOR = '[data-docx-border="none"]';

const isInvisibleWordLayoutTable = (table: HTMLTableElement) =>
  table.matches(DOCX_BORDER_NONE_SELECTOR) || Boolean(table.closest(DOCX_BORDER_NONE_SELECTOR));

const parseWordTextAlignment = (value?: string | null): TWordTableCellStyle['alignment'] => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'center') return 'center';
  if (normalized === 'right' || normalized === 'end') return 'right';
  if (normalized === 'justify') return 'both';
  if (normalized === 'left' || normalized === 'start') return 'left';
  return undefined;
};

const parseWordVerticalAlignment = (value?: string | null): TWordTableCellStyle['vertical_align'] => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'middle' || normalized === 'center') return 'center';
  if (normalized === 'bottom') return 'bottom';
  if (normalized === 'top' || normalized === 'baseline') return 'top';
  return undefined;
};

const parseWordFontWeight = (value?: string | null): boolean | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'bold' || normalized === 'bolder') return true;
  if (normalized === 'normal' || normalized === 'lighter') return false;

  const numericWeight = Number.parseInt(normalized, 10);
  if (!Number.isFinite(numericWeight)) return undefined;
  return numericWeight >= 600;
};

const parseWordFontStyle = (value?: string | null): boolean | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'italic' || normalized === 'oblique') return true;
  if (normalized === 'normal') return false;
  return undefined;
};

const parseWordUnderline = (value?: string | null): boolean | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('underline')) return true;
  if (normalized === 'none') return false;
  return undefined;
};

const WORD_SEMANTIC_BOLD_TAG_NAMES = new Set(['p', 'span', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const applySemanticBoldForWordExport = (doc: Document) => {
  doc.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    if (!WORD_SEMANTIC_BOLD_TAG_NAMES.has(tagName)) return;
    if (element.closest('strong,b')) return;
    if (parseWordFontWeight(element.style.fontWeight) !== true) return;
    if (!element.textContent?.trim()) return;

    const strong = doc.createElement('strong');
    while (element.firstChild) {
      strong.appendChild(element.firstChild);
    }
    element.appendChild(strong);
  });
};

const parseWordFontSize = (value?: string | null): number | undefined => {
  const match = value
    ?.trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(pt|px)$/);
  if (!match) return undefined;

  const rawSize = Number.parseFloat(match[1]);
  const sizeInPoints = match[2] === 'px' ? rawSize * 0.75 : rawSize;
  const halfPoints = Math.round(sizeInPoints * 2);
  return halfPoints > 0 ? halfPoints : undefined;
};

const parseWordBackgroundColor = (value?: string | null): string | undefined => {
  const normalized = value?.trim().replace(/^#/, '').toUpperCase();
  if (!normalized) return undefined;
  const rgbMatch = normalized.match(
    /^RGBA?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:1|1\.0+))?\s*\)$/,
  );
  if (rgbMatch) {
    return rgbMatch
      .slice(1, 4)
      .map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  if (/^[0-9A-F]{3}$/.test(normalized)) {
    return normalized
      .split('')
      .map((character) => `${character}${character}`)
      .join('');
  }
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : undefined;
};

const parseWordFontFamily = (value?: string | null): string | undefined => {
  const firstFamily = value
    ?.split(',')[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
  if (!firstFamily) return undefined;

  const normalized = firstFamily.replace(/\s+/g, ' ');
  if (GENERIC_WORD_FONT_FAMILIES.has(normalized.toLowerCase())) return undefined;
  if (/^times(?:\s+new\s+roman)?$/i.test(normalized)) return 'Times New Roman';

  return normalized;
};

const normalizeWordFontFamiliesForExport = (doc: Document) => {
  doc.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    const normalizedFontFamily = parseWordFontFamily(element.style.fontFamily);
    if (!normalizedFontFamily) return;

    element.style.fontFamily = normalizedFontFamily;
  });
};

const normalizeWordCellText = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();

const isWordCellTextFullyBold = (cell: HTMLTableCellElement) => {
  const cellText = normalizeWordCellText(cell.textContent);
  if (!cellText) return false;

  const boldText = normalizeWordCellText(
    Array.from(cell.querySelectorAll('strong,b'))
      .map((element) => element.textContent || '')
      .join(' '),
  );

  return boldText === cellText;
};

const getFirstWordCellBlockChild = (cell: HTMLTableCellElement): HTMLElement | null =>
  (Array.from(cell.children).find((child) => {
    const tagName = child.tagName.toLowerCase();
    return tagName === 'p' || tagName === 'div';
  }) as HTMLElement | undefined) ?? null;

const getWordCellTextAlignment = (cell: HTMLTableCellElement) => {
  const firstBlockChild = getFirstWordCellBlockChild(cell);
  return cell.style.textAlign || cell.getAttribute('align') || firstBlockChild?.style.textAlign || null;
};

const collectWordTableCellStyles = (
  table: HTMLTableElement,
  invisibleLayoutTable: boolean,
): TWordTableCellStyle[][] => {
  if (invisibleLayoutTable) return [];

  const theadRows = new Set(Array.from(table.querySelectorAll('thead tr')));
  const tableFontFamily = parseWordFontFamily(table.style.fontFamily);
  const tableColor = parseWordBackgroundColor(table.style.color);

  return Array.from(table.rows).map((row) =>
    Array.from(row.cells).map((cell) => {
      const isHeader = cell.tagName.toLowerCase() === 'th' || theadRows.has(row);
      const bold =
        parseWordFontWeight(cell.style.fontWeight) ?? (isHeader || isWordCellTextFullyBold(cell) ? true : undefined);
      const italic = parseWordFontStyle(cell.style.fontStyle);
      const underline = parseWordUnderline(cell.style.textDecoration);
      const font_family = parseWordFontFamily(cell.style.fontFamily) ?? tableFontFamily;
      const font_size = parseWordFontSize(cell.style.fontSize);
      const color = parseWordBackgroundColor(cell.style.color) ?? tableColor;
      const background_color = parseWordBackgroundColor(cell.style.backgroundColor);
      const alignment = parseWordTextAlignment(getWordCellTextAlignment(cell)) ?? (isHeader ? 'center' : undefined);
      const vertical_align =
        parseWordVerticalAlignment(cell.style.verticalAlign || cell.getAttribute('valign')) ??
        (isHeader ? 'center' : undefined);

      return {
        ...(bold !== undefined ? { bold } : {}),
        ...(italic !== undefined ? { italic } : {}),
        ...(underline !== undefined ? { underline } : {}),
        ...(font_family ? { font_family } : {}),
        ...(font_size ? { font_size } : {}),
        ...(color ? { color } : {}),
        ...(background_color ? { background_color } : {}),
        ...(alignment ? { alignment } : {}),
        ...(vertical_align ? { vertical_align } : {}),
      };
    }),
  );
};

type TPendingWordRowspanCell = {
  sourceCell: HTMLTableCellElement;
  colspan: number;
  remainingRows: number;
};

const createWordRowspanPlaceholderCell = (
  doc: Document,
  pendingCell: TPendingWordRowspanCell,
): HTMLTableCellElement => {
  const placeholder = pendingCell.sourceCell.cloneNode(false) as HTMLTableCellElement;

  placeholder.removeAttribute('id');
  placeholder.removeAttribute('rowspan');
  placeholder.removeAttribute('colspan');
  placeholder.setAttribute('data-docx-rowspan-placeholder', 'true');

  if (pendingCell.colspan > 1) {
    placeholder.setAttribute('colspan', String(pendingCell.colspan));
  }

  appendInlineStyle(placeholder, 'border-top:0');

  if (pendingCell.remainingRows > 1) {
    placeholder.setAttribute('data-docx-rowspan-continuation', 'true');
    appendInlineStyle(placeholder, 'border-bottom:0');
  } else {
    placeholder.setAttribute('data-docx-rowspan-end', 'true');
  }

  placeholder.appendChild(doc.createTextNode('\u00a0'));

  return placeholder;
};

const flattenTableRowspansForWordExport = (table: HTMLTableElement) => {
  const rows = Array.from(table.rows);
  const pendingRowspanCells = new Map<number, TPendingWordRowspanCell>();
  const doc = table.ownerDocument;

  const consumePendingCell = (columnIndex: number) => {
    const pendingCell = pendingRowspanCells.get(columnIndex);
    if (!pendingCell) return null;

    pendingRowspanCells.delete(columnIndex);

    if (pendingCell.remainingRows > 1) {
      pendingRowspanCells.set(columnIndex, {
        ...pendingCell,
        remainingRows: pendingCell.remainingRows - 1,
      });
    }

    return createWordRowspanPlaceholderCell(doc, pendingCell);
  };

  const appendPendingCellsAtColumn = (fragment: DocumentFragment, columnIndex: number) => {
    let nextColumnIndex = columnIndex;
    let placeholder = consumePendingCell(nextColumnIndex);

    while (placeholder) {
      const colspan = getPositiveIntegerAttribute(placeholder, 'colspan');
      fragment.appendChild(placeholder);
      nextColumnIndex += colspan;
      placeholder = consumePendingCell(nextColumnIndex);
    }

    return nextColumnIndex;
  };

  rows.forEach((row) => {
    const originalCells = Array.from(row.cells);
    const fragment = doc.createDocumentFragment();
    let columnIndex = 0;

    originalCells.forEach((cell) => {
      columnIndex = appendPendingCellsAtColumn(fragment, columnIndex);

      const colspan = getPositiveIntegerAttribute(cell, 'colspan');
      const rowspan = getPositiveIntegerAttribute(cell, 'rowspan');

      if (rowspan > 1) {
        cell.removeAttribute('rowspan');
        cell.setAttribute('data-docx-rowspan-source', 'true');
        appendInlineStyle(cell, 'border-bottom:0');
        pendingRowspanCells.set(columnIndex, {
          sourceCell: cell,
          colspan,
          remainingRows: rowspan - 1,
        });
      }

      fragment.appendChild(cell);
      columnIndex += colspan;
    });

    const maxPendingColumnIndex =
      pendingRowspanCells.size > 0 ? Math.max(...Array.from(pendingRowspanCells.keys())) : -1;

    while (pendingRowspanCells.size > 0 && columnIndex <= maxPendingColumnIndex) {
      if (pendingRowspanCells.has(columnIndex)) {
        columnIndex = appendPendingCellsAtColumn(fragment, columnIndex);
      } else {
        columnIndex += 1;
      }
    }

    row.replaceChildren(fragment);
  });
};

const collectWordTableExportPatchFromHtml = (htmlContent: string): TWordTableExportPatch => {
  if (typeof DOMParser === 'undefined') {
    return {
      tableColumnLayouts: [],
      tableBorderVisibility: [],
      tableCellStyles: [],
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${htmlContent}</body>`, 'text/html');
  const tableColumnLayouts: number[][] = [];
  const tableBorderVisibility: boolean[] = [];
  const tableCellStyles: TWordTableCellStyle[][][] = [];

  doc.querySelectorAll('style, script').forEach((element) => element.remove());

  doc.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const invisibleLayoutTable = isInvisibleWordLayoutTable(table);
    flattenTableRowspansForWordExport(table);
    tableColumnLayouts.push(getTableColumnLayoutForWordExport(table));
    tableBorderVisibility.push(!invisibleLayoutTable);

    table.querySelectorAll<HTMLElement>('th, td').forEach((cell) => {
      if (invisibleLayoutTable) {
        prependInlineStyle(cell, EXPORT_WORD_HIDDEN_CELL_STYLE);
      } else {
        appendInlineStyle(cell, EXPORT_WORD_CELL_STYLE);
      }
    });

    tableCellStyles.push(collectWordTableCellStyles(table, invisibleLayoutTable));
  });

  return {
    tableColumnLayouts,
    tableBorderVisibility,
    tableCellStyles,
  };
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const parseCssPixelValue = (value?: string | null) => {
  const normalized = value?.trim();
  if (!normalized || normalized === 'auto') return null;

  const numericValue = Number.parseFloat(normalized);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  if (/^\d+(\.\d+)?$/.test(normalized) || /^\d+(\.\d+)?px$/i.test(normalized)) {
    return numericValue;
  }

  return null;
};

const getImageRequestedPixelSize = (image: HTMLImageElement) => ({
  width: parseCssPixelValue(image.style.width) ?? parseCssPixelValue(image.getAttribute('width')),
  height: parseCssPixelValue(image.style.height) ?? parseCssPixelValue(image.getAttribute('height')),
});

const getImageNaturalPixelSize = (src: string) =>
  new Promise<{ width: number; height: number } | null>((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }

    const probe = new Image();
    let settled = false;
    const settle = (size: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(size);
    };
    const timeout = window.setTimeout(() => settle(null), 3000);
    probe.onload = () => {
      window.clearTimeout(timeout);
      const width = probe.naturalWidth || probe.width;
      const height = probe.naturalHeight || probe.height;
      settle(width > 0 && height > 0 ? { width, height } : null);
    };
    probe.onerror = () => {
      window.clearTimeout(timeout);
      settle(null);
    };
    probe.src = src;
  });

const normalizeImageDimensionsForWordExport = async (image: HTMLImageElement) => {
  const src = image.getAttribute('src')?.trim();
  const requestedSize = getImageRequestedPixelSize(image);
  const naturalSize = src ? await getImageNaturalPixelSize(src) : null;
  const naturalWidth = naturalSize?.width || image.naturalWidth || requestedSize.width || 0;
  const naturalHeight = naturalSize?.height || image.naturalHeight || requestedSize.height || 0;
  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1;

  let width = requestedSize.width ?? null;
  let height = requestedSize.height ?? null;

  if (width && !height) {
    height = width / ratio;
  } else if (!width && height) {
    width = height * ratio;
  } else if (!width && !height) {
    width = naturalWidth || WORD_EXPORT_MAX_IMAGE_WIDTH_PX;
    height = naturalHeight || width / ratio;
  }

  if (!width || !height || width <= 0 || height <= 0) return;

  if (width > WORD_EXPORT_MAX_IMAGE_WIDTH_PX) {
    const scale = WORD_EXPORT_MAX_IMAGE_WIDTH_PX / width;
    width = WORD_EXPORT_MAX_IMAGE_WIDTH_PX;
    height *= scale;
  }

  const normalizedWidth = Math.max(1, Math.round(width));
  const normalizedHeight = Math.max(1, Math.round(height));

  image.setAttribute('width', String(normalizedWidth));
  image.setAttribute('height', String(normalizedHeight));
  image.style.width = `${normalizedWidth}px`;
  image.style.height = `${normalizedHeight}px`;
  image.style.maxWidth = '100%';
  image.style.objectFit = 'contain';
};

const inlineImagesForWordExport = async (doc: Document) => {
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img[src]'));

  await Promise.all(
    images.map(async (image) => {
      const src = image.getAttribute('src')?.trim();
      if (!src) return;

      if (!src.startsWith('data:')) {
        try {
          const url = new URL(src, window.location.origin);
          const response = await fetch(url.href, { credentials: 'include' });
          if (!response.ok) {
            await normalizeImageDimensionsForWordExport(image);
            return;
          }

          const blob = await response.blob();
          if (!blob.type.startsWith('image/')) {
            await normalizeImageDimensionsForWordExport(image);
            return;
          }

          const dataUrl = await blobToDataUrl(blob);
          if (dataUrl) {
            image.setAttribute('src', dataUrl);
          }
        } catch {
          // Leave the original src in place so html-to-docx can still try to resolve it.
        }
      }

      await normalizeImageDimensionsForWordExport(image);
    }),
  );
};

const prepareHtmlForWordExport = async (htmlContent: string): Promise<TWordExportHtml> => {
  if (typeof window === 'undefined') {
    return {
      html: `<div style="${getExportWordWrapperStyle()}">${htmlContent}</div>`,
      pageBreakTokenCount: 0,
      imageCount: 0,
      tableColumnLayouts: [],
      tableBorderVisibility: [],
      tableCellStyles: [],
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${htmlContent}</body>`, 'text/html');
  let pageBreakTokenCount = 0;
  const imageCount = doc.querySelectorAll('img[src]').length;
  const tableColumnLayouts: number[][] = [];
  const tableBorderVisibility: boolean[] = [];
  const tableCellStyles: TWordTableCellStyle[][][] = [];

  doc.querySelectorAll('style, script').forEach((element) => element.remove());
  applySemanticBoldForWordExport(doc);
  normalizeWordFontFamiliesForExport(doc);
  applyWordHeadingStylesForExport(doc);

  doc.querySelectorAll<HTMLElement>(PAGE_BREAK_SELECTOR).forEach((element) => {
    const token = `${WORD_PAGE_BREAK_TOKEN_PREFIX}${pageBreakTokenCount}__`;
    const marker = doc.createElement('p');
    marker.textContent = token;
    marker.setAttribute('style', 'margin:0;padding:0');
    element.replaceWith(marker);
    pageBreakTokenCount += 1;
  });

  doc.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    const invisibleLayoutTable = isInvisibleWordLayoutTable(table);
    const exportWordTableStyle = getExportWordTableStyle();
    flattenTableRowspansForWordExport(table);
    tableColumnLayouts.push(getTableColumnLayoutForWordExport(table));
    tableBorderVisibility.push(!invisibleLayoutTable);

    if (invisibleLayoutTable) {
      table.setAttribute('border', '0');
      appendInlineStyle(table, exportWordTableStyle);
      appendInlineStyle(table, EXPORT_WORD_HIDDEN_TABLE_STYLE);
    } else {
      appendInlineStyle(table, exportWordTableStyle);
    }

    table.querySelectorAll<HTMLElement>('th, td').forEach((cell) => {
      if (invisibleLayoutTable) {
        prependInlineStyle(cell, EXPORT_WORD_HIDDEN_CELL_STYLE);
      } else {
        appendInlineStyle(cell, EXPORT_WORD_CELL_STYLE);
      }

      if (invisibleLayoutTable) return;

      if (cell.getAttribute('data-docx-rowspan-source') === 'true') {
        appendInlineStyle(cell, 'border-bottom:0 none transparent');
      }

      if (cell.getAttribute('data-docx-rowspan-placeholder') === 'true') {
        appendInlineStyle(cell, 'border-top:0 none transparent');
      }

      if (cell.getAttribute('data-docx-rowspan-continuation') === 'true') {
        appendInlineStyle(cell, 'border-bottom:0 none transparent');
      }

      if (cell.getAttribute('data-docx-rowspan-end') === 'true') {
        appendInlineStyle(cell, 'border-bottom:1px solid #000');
      }
    });

    tableCellStyles.push(collectWordTableCellStyles(table, invisibleLayoutTable));
  });

  await inlineImagesForWordExport(doc);

  const wrapper = doc.createElement('div');
  wrapper.setAttribute('style', getExportWordWrapperStyle());

  while (doc.body.firstChild) {
    wrapper.appendChild(doc.body.firstChild);
  }

  doc.body.appendChild(wrapper);

  return {
    html: doc.body.innerHTML,
    pageBreakTokenCount,
    imageCount,
    tableColumnLayouts,
    tableBorderVisibility,
    tableCellStyles,
  };
};

const isWellFormedXml = (xml: string) => {
  if (typeof DOMParser === 'undefined') return true;

  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  return parsed.getElementsByTagName('parsererror').length === 0;
};

const isWordXmlElement = (node: ChildNode, localName: string): node is Element =>
  node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === localName;

const getDirectWordChildren = (element: Element, localName: string) =>
  Array.from(element.childNodes).filter((node): node is Element => isWordXmlElement(node, localName));

const getDirectWordElementChildren = (element: Element) =>
  Array.from(element.childNodes).filter(
    (node): node is Element =>
      node.nodeType === Node.ELEMENT_NODE && (node as Element).namespaceURI === WORD_XML_NAMESPACE,
  );

const createWordXmlElement = (doc: XMLDocument, localName: string) =>
  doc.createElementNS(WORD_XML_NAMESPACE, `w:${localName}`);

const getWordXmlAttribute = (element: Element, localName: string) =>
  element.getAttributeNS(WORD_XML_NAMESPACE, localName) ?? element.getAttribute(`w:${localName}`);

const setWordXmlAttribute = (element: Element, localName: string, value: string | number) => {
  element.setAttributeNS(WORD_XML_NAMESPACE, `w:${localName}`, String(value));
};

const ensureDirectWordChild = (doc: XMLDocument, parent: Element, localName: string, insertAsFirstChild = false) => {
  const existing = getDirectWordChildren(parent, localName)[0];
  if (existing) return existing;

  const child = createWordXmlElement(doc, localName);
  if (insertAsFirstChild && parent.firstChild) {
    parent.insertBefore(child, parent.firstChild);
  } else {
    parent.appendChild(child);
  }

  return child;
};

const replaceWordTableGrid = (doc: XMLDocument, table: Element, columnWidths: number[]) => {
  const tableGrid = getDirectWordChildren(table, 'tblGrid')[0] ?? createWordXmlElement(doc, 'tblGrid');
  while (tableGrid.firstChild) {
    tableGrid.removeChild(tableGrid.firstChild);
  }

  columnWidths.forEach((width) => {
    const gridColumn = createWordXmlElement(doc, 'gridCol');
    setWordXmlAttribute(gridColumn, 'w', width);
    tableGrid.appendChild(gridColumn);
  });

  if (!tableGrid.parentNode) {
    const firstRow = getDirectWordChildren(table, 'tr')[0] ?? null;
    table.insertBefore(tableGrid, firstRow);
  }
};

const applyWordTableFixedGeometry = (doc: XMLDocument, table: Element, columnWidths: number[]) => {
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0);
  const tableProperties = ensureDirectWordChild(doc, table, 'tblPr', true);
  const tableWidthElement = ensureDirectWordChild(doc, tableProperties, 'tblW', true);
  const tableLayoutElement = ensureDirectWordChild(doc, tableProperties, 'tblLayout');

  setWordXmlAttribute(tableWidthElement, 'w', tableWidth);
  setWordXmlAttribute(tableWidthElement, 'type', 'dxa');
  setWordXmlAttribute(tableLayoutElement, 'type', 'fixed');
};

const setWordBorderAttributes = (border: Element, value = 'single') => {
  setWordXmlAttribute(border, 'val', value);
  setWordXmlAttribute(border, 'sz', value === 'nil' ? 0 : 4);
  setWordXmlAttribute(border, 'space', 0);
  setWordXmlAttribute(border, 'color', '000000');
};

const WORD_TABLE_BORDER_NAMES = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'] as const;
const WORD_CELL_BORDER_NAMES = ['top', 'left', 'bottom', 'right', 'tl2br', 'tr2bl'] as const;
const WORD_CELL_BOX_BORDER_NAMES = ['top', 'left', 'bottom', 'right'] as const;

const applyWordTableBorders = (doc: XMLDocument, table: Element) => {
  const tableProperties = ensureDirectWordChild(doc, table, 'tblPr', true);
  const tableBorders = ensureDirectWordChild(doc, tableProperties, 'tblBorders');

  WORD_TABLE_BORDER_NAMES.forEach((borderName) => {
    const border = ensureDirectWordChild(doc, tableBorders, borderName);
    const currentValue = getWordXmlAttribute(border, 'val');

    if (!currentValue || currentValue === 'none' || currentValue === 'nil') {
      setWordBorderAttributes(border);
    }
  });

  Array.from(table.getElementsByTagNameNS(WORD_XML_NAMESPACE, 'tc')).forEach((cell) => {
    const cellProperties = ensureDirectWordChild(doc, cell, 'tcPr', true);
    const cellBorders = ensureDirectWordChild(doc, cellProperties, 'tcBorders');

    WORD_CELL_BOX_BORDER_NAMES.forEach((borderName) => {
      const border = ensureDirectWordChild(doc, cellBorders, borderName);
      const currentValue = getWordXmlAttribute(border, 'val');

      if (!currentValue || currentValue === 'none' || currentValue === 'nil') {
        setWordBorderAttributes(border);
      }
    });
  });
};

const applyWordTableNoBorders = (doc: XMLDocument, table: Element) => {
  const tableProperties = ensureDirectWordChild(doc, table, 'tblPr', true);
  const tableBorders = ensureDirectWordChild(doc, tableProperties, 'tblBorders');

  WORD_TABLE_BORDER_NAMES.forEach((borderName) => {
    setWordBorderAttributes(ensureDirectWordChild(doc, tableBorders, borderName), 'nil');
  });

  Array.from(table.getElementsByTagNameNS(WORD_XML_NAMESPACE, 'tc')).forEach((cell) => {
    const cellProperties = ensureDirectWordChild(doc, cell, 'tcPr', true);
    const cellBorders = ensureDirectWordChild(doc, cellProperties, 'tcBorders');

    WORD_CELL_BORDER_NAMES.forEach((borderName) => {
      setWordBorderAttributes(ensureDirectWordChild(doc, cellBorders, borderName), 'nil');
    });
  });
};

const isVisibleWordBorder = (border: Element) => {
  const value = getWordXmlAttribute(border, 'val');
  if (value === 'none' || value === 'nil') return false;

  const size = Number.parseInt(getWordXmlAttribute(border, 'sz') || '', 10);
  if (Number.isFinite(size)) return size > 0;

  return Boolean(value);
};

const hasVisibleWordTableBorder = (table: Element) => {
  const tableProperties = getDirectWordChildren(table, 'tblPr')[0];
  const tableBorders = tableProperties ? getDirectWordChildren(tableProperties, 'tblBorders')[0] : null;
  if (tableBorders && getDirectWordElementChildren(tableBorders).some(isVisibleWordBorder)) {
    return true;
  }

  const cells = Array.from(table.getElementsByTagNameNS(WORD_XML_NAMESPACE, 'tc'));
  return cells.some((cell) => {
    const cellProperties = getDirectWordChildren(cell, 'tcPr')[0];
    const cellBorders = cellProperties ? getDirectWordChildren(cellProperties, 'tcBorders')[0] : null;
    return Boolean(cellBorders && getDirectWordElementChildren(cellBorders).some(isVisibleWordBorder));
  });
};

const applyWordTableCellWidths = (doc: XMLDocument, table: Element, columnWidths: number[]) => {
  getDirectWordChildren(table, 'tr').forEach((row) => {
    let columnIndex = 0;

    getDirectWordChildren(row, 'tc').forEach((cell) => {
      const cellProperties = ensureDirectWordChild(doc, cell, 'tcPr', true);
      const gridSpan = getDirectWordChildren(cellProperties, 'gridSpan')[0];
      const colspan = Math.max(1, Number.parseInt(getWordXmlAttribute(gridSpan ?? cell, 'val') || '1', 10) || 1);
      const cellWidth = columnWidths
        .slice(columnIndex, columnIndex + colspan)
        .reduce((total, width) => total + width, 0);
      const cellWidthElement = ensureDirectWordChild(doc, cellProperties, 'tcW', true);

      setWordXmlAttribute(cellWidthElement, 'w', Math.max(1, cellWidth));
      setWordXmlAttribute(cellWidthElement, 'type', 'dxa');
      columnIndex += colspan;
    });
  });
};

const hasAnyWordTableCellStyle = (tableCellStyles: TWordTableCellStyle[][][]) =>
  tableCellStyles.some((tableStyles) =>
    tableStyles.some((rowStyles) =>
      rowStyles.some(
        (style) =>
          style.bold !== undefined ||
          style.italic !== undefined ||
          style.underline !== undefined ||
          Boolean(style.font_family) ||
          Boolean(style.font_size) ||
          Boolean(style.color) ||
          Boolean(style.background_color) ||
          Boolean(style.alignment) ||
          Boolean(style.vertical_align),
      ),
    ),
  );

const applyWordTableCellStyle = (doc: XMLDocument, cell: Element, style: TWordTableCellStyle) => {
  if (style.vertical_align || style.background_color) {
    const cellProperties = ensureDirectWordChild(doc, cell, 'tcPr', true);
    if (style.vertical_align) {
      const verticalAlign = ensureDirectWordChild(doc, cellProperties, 'vAlign');
      setWordXmlAttribute(verticalAlign, 'val', style.vertical_align);
    }
    if (style.background_color) {
      const shading = ensureDirectWordChild(doc, cellProperties, 'shd');
      setWordXmlAttribute(shading, 'fill', style.background_color);
    }
  }

  const paragraphs = Array.from(cell.getElementsByTagNameNS(WORD_XML_NAMESPACE, 'p'));
  const alignment = style.alignment;
  if (alignment) {
    paragraphs.forEach((paragraph) => {
      const paragraphProperties = ensureDirectWordChild(doc, paragraph, 'pPr', true);
      const justification = ensureDirectWordChild(doc, paragraphProperties, 'jc');
      setWordXmlAttribute(justification, 'val', alignment);
    });
  }

  if (
    style.bold !== undefined ||
    style.italic !== undefined ||
    style.underline !== undefined ||
    style.font_family !== undefined ||
    style.color !== undefined ||
    style.font_size !== undefined
  ) {
    Array.from(cell.getElementsByTagNameNS(WORD_XML_NAMESPACE, 'r')).forEach((run) => {
      const runProperties = ensureDirectWordChild(doc, run, 'rPr', true);

      if (style.bold !== undefined) {
        ['b', 'bCs'].forEach((boldElementName) => {
          const boldElement = ensureDirectWordChild(doc, runProperties, boldElementName, true);
          if (style.bold) {
            boldElement.removeAttributeNS(WORD_XML_NAMESPACE, 'val');
            boldElement.removeAttribute('w:val');
          } else {
            setWordXmlAttribute(boldElement, 'val', '0');
          }
        });
      }

      if (style.italic !== undefined) {
        ['i', 'iCs'].forEach((italicElementName) => {
          const italicElement = ensureDirectWordChild(doc, runProperties, italicElementName, true);
          if (style.italic) {
            italicElement.removeAttributeNS(WORD_XML_NAMESPACE, 'val');
            italicElement.removeAttribute('w:val');
          } else {
            setWordXmlAttribute(italicElement, 'val', '0');
          }
        });
      }

      if (style.underline !== undefined) {
        const underline = ensureDirectWordChild(doc, runProperties, 'u', true);
        setWordXmlAttribute(underline, 'val', style.underline ? 'single' : 'none');
      }

      if (style.font_family) {
        const fonts = ensureDirectWordChild(doc, runProperties, 'rFonts', true);
        ['ascii', 'hAnsi', 'cs', 'eastAsia'].forEach((fontAttribute) => {
          setWordXmlAttribute(fonts, fontAttribute, style.font_family as string);
        });
      }

      if (style.color) {
        const color = ensureDirectWordChild(doc, runProperties, 'color', true);
        setWordXmlAttribute(color, 'val', style.color);
      }

      if (style.font_size) {
        ['sz', 'szCs'].forEach((sizeElementName) => {
          const sizeElement = ensureDirectWordChild(doc, runProperties, sizeElementName, true);
          setWordXmlAttribute(sizeElement, 'val', String(style.font_size));
        });
      }
    });
  }
};

const applyWordTableCellStyles = (doc: XMLDocument, table: Element, tableCellStyles: TWordTableCellStyle[][]) => {
  if (!tableCellStyles.length) return;

  getDirectWordChildren(table, 'tr').forEach((row, rowIndex) => {
    const rowStyles = tableCellStyles[rowIndex];
    if (!rowStyles?.length) return;

    getDirectWordChildren(row, 'tc').forEach((cell, cellIndex) => {
      const style = rowStyles[cellIndex];
      if (!style) return;
      applyWordTableCellStyle(doc, cell, style);
    });
  });
};

const patchDocxTableColumnWidths = async (
  arrayBuffer: ArrayBuffer,
  tableColumnLayouts: number[][],
  tableBorderVisibility: boolean[] = [],
  tableCellStyles: TWordTableCellStyle[][][] = [],
): Promise<ArrayBuffer> => {
  const hasAnyTableLayout = tableColumnLayouts.some((layout) => layout.length > 0);
  const hasAnyVisibleTableBorder = tableBorderVisibility.some(Boolean);
  const hasAnyHiddenTableBorder = tableBorderVisibility.some((visible) => visible === false);
  const hasAnyTableStyles = hasAnyWordTableCellStyle(tableCellStyles);
  if (
    (!hasAnyTableLayout && !hasAnyVisibleTableBorder && !hasAnyHiddenTableBorder && !hasAnyTableStyles) ||
    typeof DOMParser === 'undefined' ||
    typeof XMLSerializer === 'undefined'
  ) {
    return arrayBuffer;
  }

  try {
    const jsZipModule = await import('jszip');
    const JSZipConstructor = ((jsZipModule as { default?: TZipConstructor }).default ??
      jsZipModule) as unknown as TZipConstructor;
    const zip = await new JSZipConstructor().loadAsync(arrayBuffer);
    const documentFile = zip.file('word/document.xml');
    const documentXml = documentFile ? await documentFile.async('string') : '';
    if (!documentXml) return arrayBuffer;

    const parsedDocument = new DOMParser().parseFromString(documentXml, 'application/xml');
    if (parsedDocument.getElementsByTagName('parsererror').length > 0) return arrayBuffer;

    const tables = Array.from(parsedDocument.getElementsByTagNameNS(WORD_XML_NAMESPACE, 'tbl'));
    tables.forEach((table, tableIndex) => {
      const columnWidths = tableColumnLayouts[tableIndex];

      if (columnWidths && columnWidths.length > 0) {
        replaceWordTableGrid(parsedDocument, table, columnWidths);
        applyWordTableFixedGeometry(parsedDocument, table, columnWidths);
        applyWordTableCellWidths(parsedDocument, table, columnWidths);
      }

      if (tableBorderVisibility[tableIndex] === false) {
        applyWordTableNoBorders(parsedDocument, table);
      } else if (tableBorderVisibility[tableIndex]) {
        applyWordTableBorders(parsedDocument, table);
      }

      applyWordTableCellStyles(parsedDocument, table, tableCellStyles[tableIndex] ?? []);
    });

    const patchedXml = new XMLSerializer().serializeToString(parsedDocument);
    if (!isWellFormedXml(patchedXml)) return arrayBuffer;

    zip.file('word/document.xml', patchedXml);
    const patchedBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: DOCX_MIME_TYPE,
    });

    return patchedBlob.arrayBuffer();
  } catch (error) {
    console.warn('Unable to patch DOCX table geometry after export.', error);
    return arrayBuffer;
  }
};

const patchDocxFontFamilies = async (arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return arrayBuffer;
  }

  try {
    const jsZipModule = await import('jszip');
    const JSZipConstructor = ((jsZipModule as { default?: TZipConstructor }).default ??
      jsZipModule) as unknown as TZipConstructor;
    const zip = await new JSZipConstructor().loadAsync(arrayBuffer);
    const xmlPaths: string[] = [];

    zip.forEach?.((relativePath) => {
      if (/^word\/(?:document|styles|header\d+|footer\d+)\.xml$/i.test(relativePath)) {
        xmlPaths.push(relativePath);
      }
    });

    if (xmlPaths.length === 0) {
      xmlPaths.push('word/document.xml');
    }

    let changed = false;

    for (const xmlPath of xmlPaths) {
      const xmlFile = zip.file(xmlPath);
      const xml = xmlFile ? await xmlFile.async('string') : '';
      if (!xml) continue;

      const parsedDocument = new DOMParser().parseFromString(xml, 'application/xml');
      if (parsedDocument.getElementsByTagName('parsererror').length > 0) continue;

      Array.from(parsedDocument.getElementsByTagNameNS(WORD_XML_NAMESPACE, 'rFonts')).forEach((fonts) => {
        const normalizedFonts = WORD_FONT_ATTRIBUTES.map((fontAttribute) => ({
          fontAttribute,
          normalizedFont: parseWordFontFamily(getWordXmlAttribute(fonts, fontAttribute)),
        }));
        const fallbackFont = normalizedFonts.find(({ normalizedFont }) => Boolean(normalizedFont))?.normalizedFont;
        if (!fallbackFont) return;

        normalizedFonts.forEach(({ fontAttribute, normalizedFont }) => {
          const currentFont = getWordXmlAttribute(fonts, fontAttribute);
          const targetFont = normalizedFont ?? fallbackFont;
          if (currentFont === targetFont) return;

          setWordXmlAttribute(fonts, fontAttribute, targetFont);
          changed = true;
        });
      });

      const patchedXml = new XMLSerializer().serializeToString(parsedDocument);
      if (patchedXml !== xml && isWellFormedXml(patchedXml)) {
        zip.file(xmlPath, patchedXml);
      }
    }

    if (!changed) return arrayBuffer;

    const patchedBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: DOCX_MIME_TYPE,
    });

    return patchedBlob.arrayBuffer();
  } catch (error) {
    console.warn('Unable to patch DOCX font families after export.', error);
    return arrayBuffer;
  }
};

export const replaceDocxVariablePlaceholders = async (
  arrayBuffer: ArrayBuffer,
  replacements: TDocxPlaceholderReplacementMap,
): Promise<ArrayBuffer | null> => {
  const normalizedEntries = Object.entries(replacements)
    .map(([key, value]) => [key, toDocxPlainText(value)] as const)
    .filter(([key, value]) => key.trim().length > 0 && value.length > 0);

  if (normalizedEntries.length === 0) {
    return null;
  }

  try {
    const jsZipModule = await import('jszip');
    const JSZipConstructor = ((jsZipModule as { default?: TZipConstructor }).default ??
      jsZipModule) as unknown as TZipConstructor;
    const zip = await new JSZipConstructor().loadAsync(arrayBuffer);
    const xmlPaths: string[] = [];

    zip.forEach?.((relativePath) => {
      if (/^word\/(?:document|header\d+|footer\d+)\.xml$/i.test(relativePath)) {
        xmlPaths.push(relativePath);
      }
    });

    if (xmlPaths.length === 0) {
      xmlPaths.push('word/document.xml');
    }

    let changed = false;

    for (const xmlPath of xmlPaths) {
      const xmlFile = zip.file(xmlPath);
      const xml = xmlFile ? await xmlFile.async('string') : '';
      if (!xml) continue;

      let nextXml = xml;
      normalizedEntries.forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        if (!nextXml.includes(placeholder)) return;

        nextXml = nextXml.split(placeholder).join(escapeXmlText(value));
      });

      if (nextXml === xml || !isWellFormedXml(nextXml)) {
        continue;
      }

      zip.file(xmlPath, nextXml);
      changed = true;
    }

    if (!changed) {
      return null;
    }

    const patchedBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: DOCX_MIME_TYPE,
    });

    return patchedBlob.arrayBuffer();
  } catch (error) {
    console.warn('Unable to replace DOCX placeholder values in snapshot.', error);
    return null;
  }
};

export const ensureDocxTableCellStyles = async (
  arrayBuffer: ArrayBuffer,
  htmlContent: string,
): Promise<ArrayBuffer> => {
  const { tableColumnLayouts, tableBorderVisibility, tableCellStyles } =
    collectWordTableExportPatchFromHtml(htmlContent);

  return patchDocxTableColumnWidths(arrayBuffer, tableColumnLayouts, tableBorderVisibility, tableCellStyles);
};

export const ensureDocxTableBorders = async (arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> => {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return arrayBuffer;
  }

  try {
    const jsZipModule = await import('jszip');
    const JSZipConstructor = ((jsZipModule as { default?: TZipConstructor }).default ??
      jsZipModule) as unknown as TZipConstructor;
    const zip = await new JSZipConstructor().loadAsync(arrayBuffer);
    const documentFile = zip.file('word/document.xml');
    const documentXml = documentFile ? await documentFile.async('string') : '';
    if (!documentXml) return arrayBuffer;

    const parsedDocument = new DOMParser().parseFromString(documentXml, 'application/xml');
    if (parsedDocument.getElementsByTagName('parsererror').length > 0) return arrayBuffer;

    let patched = false;
    const tables = Array.from(parsedDocument.getElementsByTagNameNS(WORD_XML_NAMESPACE, 'tbl'));
    tables.forEach((table) => {
      if (!hasVisibleWordTableBorder(table)) return;
      applyWordTableBorders(parsedDocument, table);
      patched = true;
    });

    if (!patched) return arrayBuffer;

    const patchedXml = new XMLSerializer().serializeToString(parsedDocument);
    if (!isWellFormedXml(patchedXml)) return arrayBuffer;

    zip.file('word/document.xml', patchedXml);
    const patchedBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: DOCX_MIME_TYPE,
    });

    return patchedBlob.arrayBuffer();
  } catch (error) {
    console.warn('Unable to normalize DOCX table borders.', error);
    return arrayBuffer;
  }
};

const patchDocxPageBreakTokens = async (arrayBuffer: ArrayBuffer, pageBreakTokenCount: number): Promise<Blob> => {
  if (pageBreakTokenCount <= 0) {
    return new Blob([arrayBuffer], { type: DOCX_MIME_TYPE });
  }

  const jsZipModule = await import('jszip');
  const JSZipConstructor = ((jsZipModule as { default?: TZipConstructor }).default ??
    jsZipModule) as unknown as TZipConstructor;
  const zip = await new JSZipConstructor().loadAsync(arrayBuffer);
  const documentFile = zip.file('word/document.xml');
  const documentXml = documentFile ? await documentFile.async('string') : '';

  if (!documentXml) {
    return new Blob([arrayBuffer], { type: DOCX_MIME_TYPE });
  }

  const pageBreakXml = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  const tokenParagraphPattern = new RegExp(
    `<w:p\\b[^>]*>(?:(?!<w:p\\b)[\\s\\S])*?${WORD_PAGE_BREAK_TOKEN_PREFIX}\\d+__(?:(?!<w:p\\b)[\\s\\S])*?<\\/w:p>`,
    'g',
  );
  let replacedCount = 0;
  const patchedXml = documentXml.replace(tokenParagraphPattern, () => {
    replacedCount += 1;
    return pageBreakXml;
  });
  const hasUnpatchedToken = patchedXml.includes(WORD_PAGE_BREAK_TOKEN_PREFIX);
  const canUsePatchedXml = replacedCount === pageBreakTokenCount && !hasUnpatchedToken && isWellFormedXml(patchedXml);
  const fallbackXml = documentXml.replace(new RegExp(`${WORD_PAGE_BREAK_TOKEN_PREFIX}\\d+__`, 'g'), '');
  const documentXmlToWrite = canUsePatchedXml || !isWellFormedXml(fallbackXml) ? patchedXml : fallbackXml;

  if (!isWellFormedXml(documentXmlToWrite)) {
    console.warn('Skipping DOCX page break patch because generated document.xml is not well-formed.');
    return new Blob([arrayBuffer], { type: DOCX_MIME_TYPE });
  }

  zip.file('word/document.xml', documentXmlToWrite);

  return zip.generateAsync({
    type: 'blob',
    mimeType: DOCX_MIME_TYPE,
  });
};

const warnIfDocxImagesMissing = async (arrayBuffer: ArrayBuffer, expectedImageCount: number) => {
  if (expectedImageCount <= 0) return;

  try {
    const jsZipModule = await import('jszip');
    const JSZipConstructor = ((jsZipModule as { default?: TZipConstructor }).default ??
      jsZipModule) as unknown as TZipConstructor;
    const zip = await new JSZipConstructor().loadAsync(arrayBuffer);
    let mediaFileCount = 0;

    zip.forEach?.((relativePath) => {
      if (relativePath.startsWith('word/media/')) {
        mediaFileCount += 1;
      }
    });

    if (mediaFileCount === 0) {
      console.warn(`DOCX export received ${expectedImageCount} image(s), but no word/media files were embedded.`);
    }
  } catch (error) {
    console.warn('Unable to inspect DOCX media files after export.', error);
  }
};

const createPageNumberFooterXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${WORD_XML_NAMESPACE}">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:fldChar w:fldCharType="begin"/>
    </w:r>
    <w:r>
      <w:instrText xml:space="preserve"> PAGE </w:instrText>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="separate"/>
    </w:r>
    <w:r>
      <w:t>1</w:t>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="end"/>
    </w:r>
  </w:p>
</w:ftr>`;

const createPageNumberFooterParagraphXml = () => `
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:fldChar w:fldCharType="begin"/>
    </w:r>
    <w:r>
      <w:instrText xml:space="preserve"> PAGE </w:instrText>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="separate"/>
    </w:r>
    <w:r>
      <w:t>1</w:t>
    </w:r>
    <w:r>
      <w:fldChar w:fldCharType="end"/>
    </w:r>
  </w:p>`;

const footerXmlHasPageNumberField = (footerXml: string) =>
  /<w:instrText\b[^>]*>\s*PAGE\s*<\/w:instrText>/i.test(footerXml);

const appendPageNumberToFooterXml = (footerXml: string) => {
  if (footerXmlHasPageNumberField(footerXml)) return footerXml;
  if (!footerXml.includes('</w:ftr>')) return createPageNumberFooterXml();
  return footerXml.replace('</w:ftr>', `${createPageNumberFooterParagraphXml()}\n</w:ftr>`);
};

const getDefaultFooterRelationshipId = (documentXml: string) => {
  const match = documentXml.match(/<w:footerReference\b(?=[^>]*\bw:type="default")(?=[^>]*\br:id="([^"]+)")[^>]*\/>/);
  return match?.[1] || null;
};

const getRelationshipTargetById = (relationshipsXml: string, relationshipId: string) => {
  const relationshipPattern = new RegExp(
    `<Relationship\\b(?=[^>]*\\bId="${relationshipId}")(?=[^>]*\\bTarget="([^"]+)")[^>]*/>`,
  );
  const match = relationshipsXml.match(relationshipPattern);
  return match?.[1] || null;
};

const getFooterPathFromRelationshipTarget = (target: string | null) => {
  if (!target) return null;
  const normalizedTarget = target.replace(/^\/+/, '');
  return normalizedTarget.startsWith('word/') ? normalizedTarget : `word/${normalizedTarget}`;
};

const getNextFooterPath = (zip: TZipArchive) => {
  const usedIndexes = new Set<number>();
  zip.forEach?.((relativePath) => {
    const match = relativePath.match(/^word\/footer(\d+)\.xml$/);
    if (match) usedIndexes.add(Number.parseInt(match[1], 10));
  });

  let nextIndex = 1;
  while (usedIndexes.has(nextIndex)) {
    nextIndex += 1;
  }

  return `word/footer${nextIndex}.xml`;
};

const getNextRelationshipId = (relationshipsXml: string) => {
  const usedIds = new Set<string>();
  const numericIds: number[] = [];

  for (const match of relationshipsXml.matchAll(/\bId="([^"]+)"/g)) {
    const id = match[1];
    usedIds.add(id);
    const numericMatch = id.match(/^rId(\d+)$/);
    if (numericMatch) {
      numericIds.push(Number.parseInt(numericMatch[1], 10));
    }
  }

  let nextIndex = numericIds.length ? Math.max(...numericIds) + 1 : 1;
  let relationshipId = `rId${nextIndex}`;
  while (usedIds.has(relationshipId)) {
    nextIndex += 1;
    relationshipId = `rId${nextIndex}`;
  }

  return relationshipId;
};

const ensureFooterContentTypeOverride = (contentTypesXml: string, footerPath: string) => {
  const partName = `/${footerPath}`;
  if (contentTypesXml.includes(`PartName="${partName}"`)) return contentTypesXml;

  const overrideXml = `<Override PartName="${partName}" ContentType="${WORD_FOOTER_CONTENT_TYPE}"/>`;
  return contentTypesXml.replace('</Types>', `${overrideXml}</Types>`);
};

const ensureDocumentRelationshipsRoot = (relationshipsXml: string) => {
  if (relationshipsXml.trim()) return relationshipsXml;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${WORD_RELATIONSHIPS_NAMESPACE}"></Relationships>`;
};

const ensureDocumentFooterRelationship = (relationshipsXml: string, footerPath: string) => {
  const normalizedRelationshipsXml = ensureDocumentRelationshipsRoot(relationshipsXml);
  const target = footerPath.replace(/^word\//, '');
  const existingRelationshipPattern = new RegExp(
    `<Relationship\\b(?=[^>]*\\bType="${WORD_FOOTER_RELATIONSHIP_TYPE}")(?=[^>]*\\bTarget="${target}")(?=[^>]*\\bId="([^"]+)")[^>]*/>`,
  );
  const existingRelationship = normalizedRelationshipsXml.match(existingRelationshipPattern);
  if (existingRelationship?.[1]) {
    return {
      relationshipsXml: normalizedRelationshipsXml,
      relationshipId: existingRelationship[1],
    };
  }

  const relationshipId = getNextRelationshipId(normalizedRelationshipsXml);
  const relationshipXml = `<Relationship Id="${relationshipId}" Type="${WORD_FOOTER_RELATIONSHIP_TYPE}" Target="${target}"/>`;
  const nextRelationshipsXml = normalizedRelationshipsXml.replace(
    '</Relationships>',
    `${relationshipXml}</Relationships>`,
  );

  return {
    relationshipsXml: nextRelationshipsXml,
    relationshipId,
  };
};

const ensureDocumentRelationshipNamespace = (documentXml: string) => {
  if (/\sxmlns:r=/.test(documentXml)) return documentXml;
  return documentXml.replace(
    /<w:document\b([^>]*)>/,
    `<w:document$1 xmlns:r="${OFFICE_DOCUMENT_RELATIONSHIPS_NAMESPACE}">`,
  );
};

const ensureDocumentFooterReference = (documentXml: string, relationshipId: string) => {
  const footerReferenceXml = `<w:footerReference w:type="default" r:id="${relationshipId}"/>`;
  const documentXmlWithRelationshipNamespace = ensureDocumentRelationshipNamespace(documentXml);
  const defaultFooterReferencePattern = /<w:footerReference\b(?=[^>]*\bw:type="default")[^>]*\/>/g;

  if (defaultFooterReferencePattern.test(documentXmlWithRelationshipNamespace)) {
    return documentXmlWithRelationshipNamespace.replace(defaultFooterReferencePattern, footerReferenceXml);
  }

  return documentXmlWithRelationshipNamespace.replace(/<w:sectPr\b([^>]*)>/g, `<w:sectPr$1>${footerReferenceXml}`);
};

export async function ensureDocxPageNumberFooter(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const jsZipModule = await import('jszip');
    const JSZipConstructor = ((jsZipModule as { default?: TZipConstructor }).default ??
      jsZipModule) as unknown as TZipConstructor;
    const zip = await new JSZipConstructor().loadAsync(arrayBuffer);
    const documentFile = zip.file('word/document.xml');
    const contentTypesFile = zip.file('[Content_Types].xml');
    const relationshipsFile = zip.file('word/_rels/document.xml.rels');
    const documentXml = documentFile ? await documentFile.async('string') : '';
    const contentTypesXml = contentTypesFile ? await contentTypesFile.async('string') : '';
    const relationshipsXml = relationshipsFile ? await relationshipsFile.async('string') : '';

    if (!documentXml || !contentTypesXml) return arrayBuffer;

    let relationshipId = getDefaultFooterRelationshipId(documentXml);
    let footerPath = relationshipId
      ? getFooterPathFromRelationshipTarget(getRelationshipTargetById(relationshipsXml, relationshipId))
      : null;
    let nextRelationshipsXml = relationshipsXml;
    let nextDocumentXml = documentXml;

    if (!relationshipId || !footerPath) {
      footerPath = getNextFooterPath(zip);
      const relationshipResult = ensureDocumentFooterRelationship(relationshipsXml, footerPath);
      relationshipId = relationshipResult.relationshipId;
      nextRelationshipsXml = relationshipResult.relationshipsXml;
      nextDocumentXml = ensureDocumentFooterReference(documentXml, relationshipId);
    }

    const footerFile = zip.file(footerPath);
    const footerXml = footerFile ? await footerFile.async('string') : createPageNumberFooterXml();
    const nextFooterXml = appendPageNumberToFooterXml(footerXml);
    const nextContentTypesXml = ensureFooterContentTypeOverride(contentTypesXml, footerPath);

    if (
      !isWellFormedXml(nextDocumentXml) ||
      !isWellFormedXml(nextRelationshipsXml) ||
      !isWellFormedXml(nextFooterXml) ||
      !isWellFormedXml(nextContentTypesXml)
    ) {
      console.warn('Skipping DOCX page number footer patch because generated XML is not well-formed.');
      return arrayBuffer;
    }

    zip.file('word/document.xml', nextDocumentXml);
    zip.file('word/_rels/document.xml.rels', nextRelationshipsXml);
    zip.file(footerPath, nextFooterXml);
    zip.file('[Content_Types].xml', nextContentTypesXml);

    const patchedBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: DOCX_MIME_TYPE,
    });

    return patchedBlob.arrayBuffer();
  } catch (error) {
    console.warn('Unable to ensure DOCX page number footer.', error);
    return arrayBuffer;
  }
}

const normalizeDocxResultToArrayBuffer = async (result: Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> => {
  if (result instanceof Blob) {
    return result.arrayBuffer();
  }

  if (result instanceof ArrayBuffer) {
    return result;
  }

  const bytes = new Uint8Array(result);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};

async function loadHtml2Canvas(): Promise<Html2CanvasFactory> {
  if (cachedHtml2Canvas) return cachedHtml2Canvas;

  if (typeof window === 'undefined') {
    throw new Error('html2canvas can only be loaded in the browser.');
  }

  const mod = await import('html2canvas');
  const factory = (mod as { default?: Html2CanvasFactory }).default;

  if (!factory) {
    throw new Error('Failed to load html2canvas factory.');
  }

  cachedHtml2Canvas = factory;
  return factory;
}

async function loadJsPdf(): Promise<JsPdfConstructor> {
  if (cachedJsPdf) return cachedJsPdf;

  if (typeof window === 'undefined') {
    throw new Error('jsPDF can only be loaded in the browser.');
  }

  if (!JsPdfStatic) {
    throw new Error('Failed to load jsPDF constructor.');
  }

  cachedJsPdf = JsPdfStatic;
  return JsPdfStatic;
}

async function loadCanvg(): Promise<CanvgConstructor> {
  if (cachedCanvg) return cachedCanvg;

  if (typeof window === 'undefined') {
    throw new Error('canvg can only be loaded in the browser.');
  }

  const mod = await import('canvg');
  const ctor = (mod as { Canvg?: CanvgConstructor }).Canvg;

  if (!ctor) {
    throw new Error('Failed to load canvg constructor.');
  }

  cachedCanvg = ctor;
  return ctor;
}

async function loadDomPurify(): Promise<DomPurifyInstance> {
  if (cachedDomPurify) return cachedDomPurify;

  if (typeof window === 'undefined') {
    throw new Error('DOMPurify can only be loaded in the browser.');
  }

  const mod = await import('dompurify');
  const createDOMPurify = (mod as { default?: DomPurifyFactory }).default ?? (mod as unknown as DomPurifyFactory);

  if (!createDOMPurify) {
    throw new Error('Failed to load DOMPurify factory.');
  }

  const instance = (createDOMPurify as unknown as (w: Window) => DomPurifyInstance)(window);

  if (!instance?.sanitize) {
    throw new Error('DOMPurify instance is invalid.');
  }

  cachedDomPurify = instance;
  return instance;
}

async function sanitizeHtml(html: string): Promise<string> {
  const dompurify = await loadDomPurify();
  return dompurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}

async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));

  if (images.length === 0) return;

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }

          const onDone = () => resolve();
          img.addEventListener('load', onDone, { once: true });
          img.addEventListener('error', onDone, { once: true });
        }),
    ),
  );
}

async function waitForFonts(): Promise<void> {
  if (document?.fonts?.ready) {
    await document.fonts.ready;
  }
}

async function rasterizeSvgs(container: HTMLElement): Promise<void> {
  const svgs = Array.from(container.querySelectorAll('svg'));
  if (svgs.length === 0) return;

  const Canvg = await loadCanvg();
  const serializer = new XMLSerializer();

  for (const svg of svgs) {
    const rect = svg.getBoundingClientRect();
    const width = Math.ceil(rect.width) || Math.ceil(Number(svg.getAttribute('width') ?? 0));
    const height = Math.ceil(rect.height) || Math.ceil(Number(svg.getAttribute('height') ?? 0));

    if (!width || !height) continue;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const svgString = serializer.serializeToString(svg);
    const v = await (
      Canvg as unknown as {
        fromString: (
          context: CanvasRenderingContext2D,
          svg: string,
          options?: Record<string, unknown>,
        ) => Promise<{ render: () => Promise<void> }>;
      }
    ).fromString(ctx, svgString, {
      ignoreMouse: true,
      ignoreAnimation: true,
    });

    await v.render();

    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    img.width = canvas.width;
    img.height = canvas.height;

    const className = svg.getAttribute('class');
    if (className) img.setAttribute('class', className);

    const svgStyle = svg.style?.cssText;
    if (svgStyle) img.style.cssText = svgStyle;

    img.style.width = `${width}px`;
    img.style.height = `${height}px`;

    svg.parentNode?.replaceChild(img, svg);
  }
}

const UNSUPPORTED_PDF_COLOR_FUNCTION = /\bokl(?:ab|ch)\([^)]*\)/gi;

function stripUnsupportedInlinePdfColors(referenceElement: HTMLElement): void {
  const styledElements = [referenceElement, ...Array.from(referenceElement.querySelectorAll<HTMLElement>('[style]'))];

  for (const element of styledElements) {
    for (let index = element.style.length - 1; index >= 0; index -= 1) {
      const propertyName = element.style.item(index);
      const propertyValue = element.style.getPropertyValue(propertyName);

      if (UNSUPPORTED_PDF_COLOR_FUNCTION.test(propertyValue)) {
        element.style.removeProperty(propertyName);
      }

      UNSUPPORTED_PDF_COLOR_FUNCTION.lastIndex = 0;
    }
  }
}

function preserveInlineNoWrapPdfText(referenceElement: HTMLElement): void {
  const noWrapElements = Array.from(referenceElement.querySelectorAll<HTMLElement>('[style*="white-space"]')).filter(
    (element) => element.style.whiteSpace.replace(/\s+/g, '').toLowerCase().includes('nowrap'),
  );

  for (const element of noWrapElements) {
    element.style.whiteSpace = 'nowrap';
    element.style.overflowWrap = 'normal';
    element.style.wordBreak = 'keep-all';
  }
}

function fitInlineNoWrapPdfText(referenceElement: HTMLElement): void {
  const noWrapElements = Array.from(referenceElement.querySelectorAll<HTMLElement>('[style*="white-space"]')).filter(
    (element) => element.style.whiteSpace.replace(/\s+/g, '').toLowerCase().includes('nowrap'),
  );

  for (const element of noWrapElements) {
    const availableWidth = element.clientWidth;
    const requiredWidth = element.scrollWidth;
    if (availableWidth <= 0 || requiredWidth <= availableWidth) continue;

    const computedFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
    if (!Number.isFinite(computedFontSize) || computedFontSize <= 0) continue;

    const fittedFontSize = Math.max(8, computedFontSize * (availableWidth / requiredWidth) * 0.98);
    element.style.fontSize = `${fittedFontSize}px`;
  }
}

function stripUnsupportedPdfStyles(clonedDocument: Document, referenceElement: HTMLElement): void {
  const removableStyles = Array.from(clonedDocument.querySelectorAll('style, link[rel="stylesheet"]'));

  for (const node of removableStyles) {
    if (referenceElement.contains(node)) continue;
    node.remove();
  }

  const scopedStyleTags = Array.from(referenceElement.querySelectorAll('style'));
  for (const styleElement of scopedStyleTags) {
    if (!styleElement.textContent) continue;
    styleElement.textContent = styleElement.textContent.replace(UNSUPPORTED_PDF_COLOR_FUNCTION, 'transparent');
  }

  stripUnsupportedInlinePdfColors(referenceElement);
  preserveInlineNoWrapPdfText(referenceElement);

  clonedDocument.documentElement.style.backgroundColor = '#ffffff';
  clonedDocument.documentElement.style.color = '#000000';
  clonedDocument.body.style.backgroundColor = '#ffffff';
  clonedDocument.body.style.color = '#000000';
  clonedDocument.body.style.margin = '0';
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | number | Date) {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } catch (e) {
    console.error('Date formatting error:', e);
    return '-';
  }
}

let cachedConvert: typeof HTMLToDocx | null = null;

async function loadHTMLToDOCX(): Promise<typeof HTMLToDocx> {
  if (cachedConvert) return cachedConvert;

  const preamble = `if(typeof global==="undefined"){var global=globalThis||window||self;}`;
  const fn = new Function('Buffer', `${preamble}\n${htmlToDocxBrowserBundle}\nreturn HTMLToDOCX;`);
  const convert = fn(BufferPolyfill);

  if (typeof convert !== 'function') {
    throw new Error('HTMLToDOCX is not a function after loading browser build');
  }

  cachedConvert = convert;
  return convert;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportToPdf(htmlContent: string, filename: string = 'document.pdf'): Promise<void> {
  if (typeof window === 'undefined') {
    console.warn('exportToPdf called on the server; skipping.');
    return;
  }

  if (!htmlContent || !htmlContent.trim()) {
    console.warn('exportToPdf called with empty HTML content; skipping.');
    return;
  }

  const sanitizedHtml = await sanitizeHtml(htmlContent);

  const html2canvas = await loadHtml2Canvas();
  const JsPdf = await loadJsPdf();
  const pdf = new JsPdf({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const marginMm = PDF_EXPORT_PAGE_MARGIN_MM;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidthMm = pageWidth - marginMm.left - marginMm.right;
  const contentHeightMm = pageHeight - marginMm.top - marginMm.bottom;
  const htmlSegments = splitHtmlByPdfPageBreaks(sanitizedHtml);
  let pageIndex = 0;

  const appendCanvasToPdf = (canvas: HTMLCanvasElement, forceSinglePage: boolean) => {
    const pxPerMm = canvas.width / contentWidthMm;
    const pageHeightPx = Math.ceil(contentHeightMm * pxPerMm);

    if (forceSinglePage && canvas.height <= Math.round(pageHeightPx * 1.35)) {
      if (pageIndex > 0) pdf.addPage();
      const imgHeightMm = Math.min(canvas.height / pxPerMm, contentHeightMm);
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.98),
        'JPEG',
        marginMm.left,
        marginMm.top,
        contentWidthMm,
        imgHeightMm,
      );
      pageIndex += 1;
      return;
    }

    let renderedHeightPx = 0;

    while (renderedHeightPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeightPx);
      if (sliceHeightPx <= 1) break;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;

      const pageCtx = pageCanvas.getContext('2d');
      if (!pageCtx) break;

      pageCtx.drawImage(canvas, 0, renderedHeightPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', 0.98),
        'JPEG',
        marginMm.left,
        marginMm.top,
        contentWidthMm,
        Math.min(sliceHeightPx / pxPerMm, contentHeightMm),
      );

      renderedHeightPx += sliceHeightPx;
      pageIndex += 1;
    }
  };

  for (const segment of htmlSegments) {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = `${PDF_EXPORT_CONTENT_WIDTH_MM}mm`;
    wrapper.style.minHeight = `${PDF_EXPORT_CONTENT_HEIGHT_MM}mm`;
    wrapper.style.paddingBottom = '0';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = '-9999';
    wrapper.style.opacity = '0';
    wrapper.style.overflow = 'visible';
    wrapper.style.background = '#ffffff';
    wrapper.style.color = '#000000';
    wrapper.style.fontSize = '13px';
    wrapper.style.lineHeight = '1.6';
    wrapper.style.fontFamily = 'Arial, Helvetica, sans-serif';
    wrapper.setAttribute('data-pdf-export', '');

    const style = document.createElement('style');
    style.textContent = [
      '[data-pdf-export] { box-sizing: border-box; }',
      '[data-pdf-export] *, [data-pdf-export] *::before, [data-pdf-export] *::after { box-sizing: inherit; }',
      '[data-pdf-export] p { margin: 0 0 8px 0; }',
      '[data-pdf-export] h1, [data-pdf-export] h2, [data-pdf-export] h3, [data-pdf-export] h4, [data-pdf-export] h5, [data-pdf-export] h6 { margin: 12px 0 6px 0; }',
      '[data-pdf-export] div, [data-pdf-export] p, [data-pdf-export] span { overflow-wrap: anywhere; }',
      '[data-pdf-export] [style*="white-space:nowrap"], [data-pdf-export] [style*="white-space: nowrap"] { white-space: nowrap !important; overflow-wrap: normal !important; word-break: keep-all !important; }',
      '[data-pdf-export] table { border-collapse: collapse; width: 100% !important; max-width: 100% !important; margin: 10px 0; page-break-inside: avoid; table-layout: fixed; }',
      '[data-pdf-export] thead { display: table-header-group; }',
      '[data-pdf-export] tr { page-break-inside: avoid; }',
      '[data-pdf-export] table, [data-pdf-export] th, [data-pdf-export] td { border: 1px solid #333; }',
      '[data-pdf-export] th, [data-pdf-export] td { padding: 8px; text-align: left; font-size: 13px; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }',
      '[data-pdf-export] th { background-color: #e8e8e8 !important; color: #000 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '[data-pdf-export] tbody tr:nth-child(even) { background-color: #f9f9f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '[data-pdf-export] tbody tr:nth-child(odd) { background-color: #ffffff; }',
      '[data-pdf-export] ul, [data-pdf-export] ol { margin: 6px 0; padding-left: 24px; }',
      '[data-pdf-export] li { margin-bottom: 4px; }',
    ].join('\n');
    wrapper.appendChild(style);

    const content = document.createElement('div');
    content.innerHTML = wrapHtmlForPageExport(segment);
    content.style.width = '100%';
    content.style.maxWidth = 'none';
    wrapper.appendChild(content);
    document.body.appendChild(wrapper);

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      await waitForFonts();
      fitInlineNoWrapPdfText(wrapper);
      await waitForImages(wrapper);
      await rasterizeSvgs(wrapper);
      wrapper.style.opacity = '1';

      const captureWidth = Math.max(wrapper.scrollWidth, wrapper.offsetWidth, content.scrollWidth, content.offsetWidth);
      const captureHeight = Math.max(
        wrapper.scrollHeight,
        wrapper.offsetHeight,
        content.scrollHeight,
        content.offsetHeight,
      );
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDocument, clonedWrapper) => {
          stripUnsupportedPdfStyles(clonedDocument, clonedWrapper);
        },
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
      });

      appendCanvasToPdf(canvas, htmlSegments.length > 1);
    } finally {
      wrapper.remove();
    }
  }

  const pdfBlob = pdf.output('blob');
  await saveFile(pdfBlob, filename);
}

function parseInlineRuns(node: ChildNode, style: IRunStylePropertiesOptions = {}): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text.trim()) return [];
    return [new TextRun({ text, ...style })];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'br') {
    return [new TextRun({ text: '', break: 1, ...style })];
  }

  let nextStyle = style;
  if (tagName === 'strong' || tagName === 'b') {
    nextStyle = { ...nextStyle, bold: true };
  }
  if (tagName === 'em' || tagName === 'i') {
    nextStyle = { ...nextStyle, italics: true };
  }
  if (tagName === 'u') {
    nextStyle = { ...nextStyle, underline: {} };
  }

  const runs: TextRun[] = [];
  for (const child of Array.from(element.childNodes)) {
    runs.push(...parseInlineRuns(child, nextStyle));
  }

  if (runs.length === 0) {
    const fallbackText = element.textContent?.trim();
    if (fallbackText) {
      runs.push(new TextRun({ text: fallbackText, ...nextStyle }));
    }
  }

  return runs;
}

function parseHtmlTable(tableElement: HTMLElement): DocxTable {
  const rows: TableRow[] = [];
  const borderStyle: IBorderOptions = {
    style: BorderStyle.SINGLE,
    size: 6,
    color: '000000',
  };

  const theadRows = Array.from(tableElement.querySelectorAll('thead tr'));
  const tbodyRows = Array.from(tableElement.querySelectorAll('tbody tr'));
  const directRows =
    theadRows.length + tbodyRows.length > 0 ? [] : Array.from(tableElement.querySelectorAll(':scope > tr'));

  const allRows = [...theadRows, ...tbodyRows, ...directRows];

  for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
    const rowElement = allRows[rowIdx];
    const cellElements = Array.from(rowElement.querySelectorAll(':scope > td, :scope > th'));
    const cells: TableCell[] = [];

    for (const cellElement of cellElements) {
      const runs = parseInlineRuns(cellElement);
      const isHeader = cellElement.tagName.toLowerCase() === 'th' || rowIdx === 0;
      const isInThead = theadRows.includes(rowElement);

      cells.push(
        new TableCell({
          children:
            runs.length > 0
              ? [
                  new DocxParagraph({
                    children: runs,
                    spacing: { line: 240, lineRule: 'auto' },
                  }),
                ]
              : [new DocxParagraph('')],
          borders: {
            top: borderStyle,
            bottom: borderStyle,
            left: borderStyle,
            right: borderStyle,
          },
          shading: isHeader || isInThead ? { fill: 'e8e8e8' } : undefined,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          verticalAlign: 'center',
        }),
      );
    }

    if (cells.length > 0) {
      rows.push(
        new TableRow({
          children: cells,
          height: { value: 500, rule: 'auto' },
        }),
      );
    }
  }

  return new DocxTable({
    rows:
      rows.length > 0
        ? rows
        : [
            new TableRow({
              children: [
                new TableCell({
                  children: [new DocxParagraph('')],
                }),
              ],
            }),
          ],
    width: { size: 100, type: 'pct' },
  });
}

function toParagraph(node: ChildNode): (DocxParagraph | DocxTable)[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return [];
    return [
      new DocxParagraph({
        children: [new TextRun(text)],
        spacing: { after: 160 },
      }),
    ];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'table') {
    return [parseHtmlTable(element)];
  }

  if (tagName === 'ul' || tagName === 'ol') {
    const listParagraphs: DocxParagraph[] = [];
    for (const child of Array.from(element.children)) {
      if (child.tagName.toLowerCase() === 'li') {
        const runs = parseInlineRuns(child);
        listParagraphs.push(
          new DocxParagraph({
            children: runs.length > 0 ? runs : [new TextRun(child.textContent?.trim() || '')],
            bullet: { level: 0 },
            spacing: { after: 120 },
          }),
        );
      }
    }
    return listParagraphs;
  }

  if (tagName === 'br') {
    return [new DocxParagraph('')];
  }

  const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);
  if (blockTags.has(tagName)) {
    const runs = parseInlineRuns(element);
    if (runs.length > 0) {
      return [new DocxParagraph({ children: runs, spacing: { after: 160 } })];
    }
    const text = element.textContent?.trim();
    return text
      ? [
          new DocxParagraph({
            children: [new TextRun(text)],
            spacing: { after: 160 },
          }),
        ]
      : [];
  }

  const nested: (DocxParagraph | DocxTable)[] = [];
  for (const child of Array.from(element.childNodes)) {
    nested.push(...toParagraph(child));
  }
  if (nested.length > 0) return nested;

  const fallbackText = element.textContent?.trim();
  return fallbackText
    ? [
        new DocxParagraph({
          children: [new TextRun(fallbackText)],
          spacing: { after: 160 },
        }),
      ]
    : [];
}

export function htmlToDocxElements(htmlContent: string): (DocxParagraph | DocxTable)[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const elements: (DocxParagraph | DocxTable)[] = [];

  for (const child of Array.from(doc.body.childNodes)) {
    elements.push(...toParagraph(child));
  }

  return elements.length > 0 ? elements : [new DocxParagraph('')];
}

export async function saveFile(blob: Blob, suggestedName: string) {
  downloadBlob(blob, suggestedName);
}

export const createDownloadFileName = (baseName: string | null | undefined, extension: string) => {
  const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const cleanBaseName = (baseName?.trim() || 'document')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanBaseName.toLowerCase().endsWith(cleanExtension.toLowerCase())
    ? cleanBaseName
    : `${cleanBaseName}${cleanExtension}`;
};

export async function createWordDocumentBuffer(htmlContent: string): Promise<ArrayBuffer> {
  const convert = await loadHTMLToDOCX();
  const wordExportHtml = await prepareHtmlForWordExport(htmlContent);

  const result = await convert(wordExportHtml.html, null, {
    orientation: 'portrait',
    pageSize: {
      width: mmToTwip(EXPORT_PAGE_WIDTH_MM),
      height: mmToTwip(EXPORT_PAGE_HEIGHT_MM),
    },
    margins: {
      top: mmToTwip(EXPORT_PAGE_MARGIN_MM.top),
      right: mmToTwip(EXPORT_PAGE_MARGIN_MM.right),
      bottom: mmToTwip(EXPORT_PAGE_MARGIN_MM.bottom),
      left: mmToTwip(EXPORT_PAGE_MARGIN_MM.left),
      footer: mmToTwip(10),
    },
    table: { row: { cantSplit: false } },
    footer: true,
    pageNumber: true,
  });

  let resultBuffer = await normalizeDocxResultToArrayBuffer(result as Blob | ArrayBuffer | Uint8Array);
  resultBuffer = await patchDocxTableColumnWidths(
    resultBuffer,
    wordExportHtml.tableColumnLayouts,
    wordExportHtml.tableBorderVisibility,
    wordExportHtml.tableCellStyles,
  );
  resultBuffer = await patchDocxFontFamilies(resultBuffer);
  await warnIfDocxImagesMissing(resultBuffer, wordExportHtml.imageCount);
  const blob = await patchDocxPageBreakTokens(resultBuffer, wordExportHtml.pageBreakTokenCount);

  return ensureDocxPageNumberFooter(await blob.arrayBuffer());
}

export async function exportToWord(htmlContent: string, fileName: string = 'document.docx'): Promise<boolean> {
  try {
    const resultBuffer = await createWordDocumentBuffer(htmlContent);
    const blob = new Blob([resultBuffer], {
      type: DOCX_MIME_TYPE,
    });
    await saveFile(blob, fileName);
    return true;
  } catch (error) {
    console.error('Error exporting to DOCX:', error);
    throw error;
  }
}
