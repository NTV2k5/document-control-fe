import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  generateDocumentHtml,
  getDocumentTemplateById,
  type DocumentTemplate,
} from '../document-templates';
import {
  generateTableHtmlFromTableTemplate,
  getTableTemplateById,
  TABLE_TEMPLATE_VARIABLE_NAMESPACE,
  type TableTemplate,
} from '../table-templates';
import {
  getTemplateVariableDefinitionByKey,
  getTemplateVariableDocumentTemplateByKey,
  getTemplateVariableTableTemplateByKey,
} from '../template-data';
import { normalizeVariableInputType, type VariableInputType, type VarTypes } from '../templates';
import { getEditorTextStyleExplicitCss, type TEditorTextStyle } from '../editor-style';

const VAR_REGEX = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;
const MENTION_SPAN_REGEX = /<span[^>]+data-mention="(\{\{[^}]+\}\})"[^>]*>[\s\S]*?<\/span>/g;
const VAR_FILLED_CLASS_REGEX = /<span[^>]*class="[^"]*\bvar-filled\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
const VAR_EMPTY_CLASS_REGEX = /<span[^>]*class="[^"]*\bvar-empty\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
const VAR_FILLED_STYLE_REGEX =
  /<span\b(?=[^>]*style="[^"]*background-color\s*:\s*#dcfce7\b[^"]*")(?=[^>]*style="[^"]*color\s*:\s*#166534\b[^"]*")[^>]*>([\s\S]*?)<\/span>/gi;
const VAR_EMPTY_STYLE_REGEX =
  /<span\b(?=[^>]*style="[^"]*background-color\s*:\s*#fff78a\b[^"]*")(?=[^>]*style="[^"]*color\s*:\s*#f57f17\b[^"]*")[^>]*>([\s\S]*?)<\/span>/gi;
const TABLE_FIGURE_REGEX = /<figure\b[^>]*class="[^"]*\btable\b[^"]*"[^>]*>[\s\S]*?<\/figure>/gi;
const TABLE_ONLY_REGEX = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const REGEXP_SPECIAL_CHARS_REGEX = /[.*+?^${}()|[\]\\]/g;
const SEMESTER_COURSES_SIGN_COMPOSITE_PATTERN =
  /\{\{\s*semester_courses\.sign_location\s*\}\}\s*,\s*ngày\s*\{\{\s*semester_courses\.sign_day\s*\}\}\s*tháng\s*\{\{\s*semester_courses\.sign_month\s*\}\}\s*năm\s*\{\{\s*semester_courses\.sign_year\s*\}\}/g;

export const SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY = 'semester_courses.sign_location_date';
export const SEMESTER_COURSES_SIGN_COMPOSITE_PLACEHOLDER = `{{${SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY}}}`;
const DEFAULT_SEMESTER_COURSES_SIGN_COMPONENT_VARIABLE_KEYS = [
  'semester_courses.sign_location',
  'semester_courses.sign_day',
  'semester_courses.sign_month',
  'semester_courses.sign_year',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const getSemesterCoursesSignCompositeConfig = () => {
  const config = getTemplateVariableDefinitionByKey(SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY)?.uiConfig
    ?.composite_field;
  if (!isRecord(config)) {
    return null;
  }

  const componentKeys = config.component_keys;
  if (!isRecord(componentKeys)) {
    return null;
  }

  const resolvedKeys = [componentKeys.location, componentKeys.day, componentKeys.month, componentKeys.year].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );

  if (resolvedKeys.length !== DEFAULT_SEMESTER_COURSES_SIGN_COMPONENT_VARIABLE_KEYS.length) {
    return null;
  }

  return {
    componentKeys: resolvedKeys,
  };
};

export const getSemesterCoursesSignComponentVariableKeys = () =>
  getSemesterCoursesSignCompositeConfig()?.componentKeys ?? [...DEFAULT_SEMESTER_COURSES_SIGN_COMPONENT_VARIABLE_KEYS];

export const SEMESTER_COURSES_SIGN_COMPONENT_VARIABLE_KEYS = getSemesterCoursesSignComponentVariableKeys();

/**
 * Regex to find `<div data-document-template="...">…</div>` wrappers inserted
 * by `generateDocumentHtml`.  Uses a greedy inner match but anchored to the
 * closing `</div>` that carries no nested `<div`.  Because document-template
 * output only contains `<p>`, `<span>`, etc. (no nested divs), a simple
 * non-nested match is safe.
 */
const DOC_TEMPLATE_OPEN_TAG_REGEX = /<div\b[^>]*data-document-template="([^"]*)"[^>]*>/i;

const getVariableTextStyle = (key: string): TEditorTextStyle | null => {
  const style = getTemplateVariableDefinitionByKey(key)?.uiConfig?.style;
  return isRecord(style) ? (style as TEditorTextStyle) : null;
};

const getVariableTextStyleCss = (key: string) => getEditorTextStyleExplicitCss(getVariableTextStyle(key));

const escapeRegExp = (value: string) => value.replace(REGEXP_SPECIAL_CHARS_REGEX, '\\$&');

/**
 * Parse `{{table.field}}` format to split table name and field name
 */
export function parseVariableName(varName: string) {
  const cleaned = varName.replace(/\{\{|\}\}/g, '');
  const dotIndex = cleaned.indexOf('.');

  if (dotIndex <= 0 || dotIndex >= cleaned.length - 1) {
    return null;
  }

  return {
    table: cleaned.slice(0, dotIndex),
    field: cleaned.slice(dotIndex + 1),
  };
}

const cloneTemplate = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isTableTemplateVariableKey = (varKey: string) => varKey.startsWith(`${TABLE_TEMPLATE_VARIABLE_NAMESPACE}.`);

const isDocumentTemplateVariableKey = (varKey: string) => varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`);

export const isSemesterCoursesSignComponentVariableKey = (varKey: string) =>
  getSemesterCoursesSignComponentVariableKeys().includes(varKey);

export const isSemesterCoursesSignCompositeVariableKey = (varKey: string) =>
  varKey === SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY;

export const normalizeSemesterCoursesDisplayVariableKey = (varKey: string) =>
  isSemesterCoursesSignComponentVariableKey(varKey) ? SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY : varKey;

export const getSemesterCoursesSignFocusVariableKey = (varKey: string) =>
  isSemesterCoursesSignCompositeVariableKey(varKey) ? getSemesterCoursesSignComponentVariableKeys()[0] : varKey;

export const collapseSemesterCoursesDisplayVariableKeys = (varKeys: string[]) => {
  const availableKeys = new Set(varKeys);
  const componentKeys = getSemesterCoursesSignComponentVariableKeys();
  const shouldCollapse = componentKeys.every((key) => availableKeys.has(key));

  if (!shouldCollapse) {
    return varKeys;
  }

  let insertedCompositeKey = false;

  return varKeys.flatMap((varKey) => {
    if (!isSemesterCoursesSignComponentVariableKey(varKey)) {
      return [varKey];
    }

    if (!insertedCompositeKey) {
      insertedCompositeKey = true;
      return [SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY];
    }

    return [];
  });
};

export const expandSemesterCoursesDisplayVariableKeys = (varKey: string) =>
  isSemesterCoursesSignCompositeVariableKey(varKey) ? [...getSemesterCoursesSignComponentVariableKeys()] : [varKey];

export const buildSemesterCoursesSignCompositeValue = (valuesMap?: Record<string, string>) => {
  const location = valuesMap?.['semester_courses.sign_location']?.trim() ?? '';
  const day = valuesMap?.['semester_courses.sign_day']?.trim() ?? '';
  const month = valuesMap?.['semester_courses.sign_month']?.trim() ?? '';
  const year = valuesMap?.['semester_courses.sign_year']?.trim() ?? '';
  const hasComponentValue = Boolean(location || day || month || year);

  if (!hasComponentValue) {
    const hasExplicitValue = Boolean(
      valuesMap && Object.prototype.hasOwnProperty.call(valuesMap, SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY),
    );

    if (hasExplicitValue) {
      return valuesMap?.[SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY] ?? '';
    }
  }

  if (!hasComponentValue) {
    return '';
  }

  const dateText = [day ? `ngày ${day}` : '', month ? `tháng ${month}` : '', year ? `năm ${year}` : '']
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!dateText) {
    return location;
  }

  return location ? `${location}, ${dateText}` : dateText;
};

export const getOfficePreviewSearchTokenForVariableKey = (varKey: string) =>
  isSemesterCoursesSignCompositeVariableKey(varKey) ? SEMESTER_COURSES_SIGN_COMPOSITE_PLACEHOLDER : `{{${varKey}}}`;

export const countSemesterCoursesSignCompositePatternOccurrences = (html: string | undefined) => {
  if (!html) {
    return 0;
  }

  return Array.from(html.matchAll(SEMESTER_COURSES_SIGN_COMPOSITE_PATTERN)).length;
};

const withSemesterCoursesCompositeValue = (valuesMap?: Record<string, string>) => {
  if (!valuesMap) {
    return valuesMap;
  }

  const compositeValue = buildSemesterCoursesSignCompositeValue(valuesMap);
  if (!compositeValue) {
    return valuesMap;
  }

  return {
    ...valuesMap,
    [SEMESTER_COURSES_SIGN_COMPOSITE_VARIABLE_KEY]: compositeValue,
  };
};

function replaceCompositeVariablePatterns(html: string) {
  if (!html) {
    return html;
  }

  return html.replace(SEMESTER_COURSES_SIGN_COMPOSITE_PATTERN, SEMESTER_COURSES_SIGN_COMPOSITE_PLACEHOLDER);
}

export interface IReplaceVariableStateArgs {
  rawContent: string;
  oldVarKey: string;
  newVarKey: string;
  template_type?: string | null;
  varValues: Record<string, string>;
  varTypes: VarTypes;
  varTitles?: Record<string, string>;
  selectedTemplates?: Record<string, TableTemplate>;
  selectedDocumentTemplates?: Record<string, DocumentTemplate>;
  documentTemplateValues?: Record<string, Record<string, string>>;
}

export interface IReplaceVariableStateResult {
  rawContent: string;
  varValues: Record<string, string>;
  varTypes: VarTypes;
  varTitles: Record<string, string>;
  selectedTemplates: Record<string, TableTemplate>;
  selectedDocumentTemplates: Record<string, DocumentTemplate>;
  documentTemplateValues: Record<string, Record<string, string>>;
}

export function getDefaultVariableInputTypeForKey(
  varKey: string,
  previousType?: VariableInputType,
  template_type?: string | null,
): VariableInputType {
  if (isSemesterCoursesSignCompositeVariableKey(varKey)) {
    return 'Data';
  }

  if (getTemplateVariableDocumentTemplateByKey(varKey, template_type)) {
    return 'Document template';
  }

  const dynamicDefinition = getTemplateVariableDefinitionByKey(varKey, template_type);
  if (dynamicDefinition?.inputType) {
    return dynamicDefinition.inputType;
  }

  if (isTableTemplateVariableKey(varKey)) {
    return 'Table template';
  }

  if (isDocumentTemplateVariableKey(varKey)) {
    return 'Document template';
  }

  if (previousType === 'Table template' || previousType === 'Document template') {
    return 'Select';
  }

  return normalizeVariableInputType(previousType ?? 'Select');
}

export function getDefaultVariableValueForKey(varKey: string, template_type?: string | null): string | undefined {
  const defaultValue = getTemplateVariableDefinitionByKey(varKey, template_type)?.defaultValue;
  return typeof defaultValue === 'string' && defaultValue.length > 0 ? defaultValue : undefined;
}

export function replaceVariableKeyInRawContent(rawContent: string, oldVarKey: string, newVarKey: string) {
  if (oldVarKey === newVarKey) {
    return normalizeVariableHtml(rawContent || '');
  }

  const escapedOldVarKey = oldVarKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const placeholderRegex = new RegExp(`\\{\\{\\s*${escapedOldVarKey}\\s*\\}\\}`, 'gi');
  return normalizeVariableHtml(rawContent || '').replace(placeholderRegex, `{{${newVarKey}}}`);
}

export function replaceVariableState({
  rawContent,
  oldVarKey,
  newVarKey,
  template_type,
  varValues,
  varTypes,
  varTitles = {},
  selectedTemplates = {},
  selectedDocumentTemplates = {},
  documentTemplateValues = {},
}: IReplaceVariableStateArgs): IReplaceVariableStateResult {
  const oldIsTableTemplate = isTableTemplateVariableKey(oldVarKey);
  const oldIsDocumentTemplate = isDocumentTemplateVariableKey(oldVarKey);
  const newIsTableTemplate = isTableTemplateVariableKey(newVarKey);
  const newIsDocumentTemplate = isDocumentTemplateVariableKey(newVarKey);
  const oldIsField = !oldIsTableTemplate && !oldIsDocumentTemplate;
  const newIsField = !newIsTableTemplate && !newIsDocumentTemplate;

  const nextRawContent = replaceVariableKeyInRawContent(rawContent, oldVarKey, newVarKey);

  const nextVarValues = { ...varValues };
  const previousValue = nextVarValues[oldVarKey];
  delete nextVarValues[oldVarKey];
  delete nextVarValues[newVarKey];

  const nextVarTypes = { ...varTypes };
  delete nextVarTypes[oldVarKey];
  nextVarTypes[newVarKey] = getDefaultVariableInputTypeForKey(newVarKey, varTypes[oldVarKey], template_type);

  const nextVarTitles = { ...varTitles };
  const previousTitle = nextVarTitles[oldVarKey];
  delete nextVarTitles[oldVarKey];
  delete nextVarTitles[newVarKey];
  if (typeof previousTitle === 'string' && previousTitle.trim()) {
    nextVarTitles[newVarKey] = previousTitle;
  }

  const nextSelectedTemplates = { ...selectedTemplates };
  delete nextSelectedTemplates[oldVarKey];
  delete nextSelectedTemplates[newVarKey];

  const nextSelectedDocumentTemplates = { ...selectedDocumentTemplates };
  delete nextSelectedDocumentTemplates[oldVarKey];
  delete nextSelectedDocumentTemplates[newVarKey];

  const nextDocumentTemplateValues = { ...documentTemplateValues };
  delete nextDocumentTemplateValues[oldVarKey];
  delete nextDocumentTemplateValues[newVarKey];

  if (newIsField && oldIsField && previousValue !== undefined) {
    nextVarValues[newVarKey] = previousValue;
  } else if (newIsField) {
    const defaultValue = getDefaultVariableValueForKey(newVarKey, template_type);
    if (defaultValue !== undefined) {
      nextVarValues[newVarKey] = defaultValue;
    }
  }

  const dynamicTableTemplate = getTemplateVariableTableTemplateByKey(newVarKey, template_type);
  if (newIsTableTemplate || dynamicTableTemplate) {
    const parsed = parseVariableName(newVarKey);
    const baseTemplate = dynamicTableTemplate ?? (parsed ? getTableTemplateById(parsed.field) : undefined);
    if (baseTemplate) {
      const clonedTemplate = cloneTemplate(baseTemplate);
      nextSelectedTemplates[newVarKey] = clonedTemplate;
      nextVarValues[newVarKey] = generateTableHtmlFromTableTemplate(clonedTemplate, nextVarValues);
    }
  }

  const dynamicDocumentTemplate = getTemplateVariableDocumentTemplateByKey(newVarKey, template_type);
  if (newIsDocumentTemplate || dynamicDocumentTemplate) {
    const parsed = parseVariableName(newVarKey);
    const baseTemplate = dynamicDocumentTemplate ?? (parsed ? getDocumentTemplateById(parsed.field) : undefined);
    if (baseTemplate) {
      const clonedTemplate = cloneTemplate(baseTemplate);
      nextSelectedDocumentTemplates[newVarKey] = clonedTemplate;
      nextDocumentTemplateValues[newVarKey] = {};
      nextVarValues[newVarKey] = generateDocumentHtml(clonedTemplate, {});
    }
  }

  return {
    rawContent: nextRawContent,
    varValues: nextVarValues,
    varTypes: nextVarTypes,
    varTitles: nextVarTitles,
    selectedTemplates: nextSelectedTemplates,
    selectedDocumentTemplates: nextSelectedDocumentTemplates,
    documentTemplateValues: nextDocumentTemplateValues,
  };
}

export function extractVariablesFromHtml(html: string): string[] {
  const localRegex = new RegExp(VAR_REGEX);
  return [...html.matchAll(localRegex)].map((m) => m[1]);
}

export function extractVariablesInOrder(html: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const localRegex = new RegExp(VAR_REGEX);

  for (const match of html.matchAll(localRegex)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  return result;
}

function extractVariableOccurrencesInOrder(html: string): string[] {
  const localRegex = new RegExp(VAR_REGEX);
  return [...html.matchAll(localRegex)].map((m) => m[1]);
}

function countVariableOccurrences(html: string): Map<string, number> {
  const counts = new Map<string, number>();
  const localRegex = new RegExp(VAR_REGEX);

  for (const match of html.matchAll(localRegex)) {
    const key = match[1];
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

type HtmlSlice = { index: number; length: number; html: string };

function extractTableCandidates(html: string): HtmlSlice[] {
  const candidates: HtmlSlice[] = [];
  const figureRanges: Array<{ start: number; end: number }> = [];

  for (const match of html.matchAll(TABLE_FIGURE_REGEX)) {
    const start = match.index ?? 0;
    const slice = match[0];
    const end = start + slice.length;

    candidates.push({ index: start, length: slice.length, html: slice });
    figureRanges.push({ start, end });
  }

  for (const match of html.matchAll(TABLE_ONLY_REGEX)) {
    const start = match.index ?? 0;
    const slice = match[0];
    const end = start + slice.length;

    const insideFigure = figureRanges.some((range) => start >= range.start && end <= range.end);

    if (!insideFigure) {
      candidates.push({
        index: start,
        length: slice.length,
        html: slice,
      });
    }
  }

  return candidates.sort((a, b) => a.index - b.index);
}

function extractBlockCandidates(html: string, maxWindowSize = 8, maxCombinedLength = 12000): HtmlSlice[] {
  const singleBlocks: HtmlSlice[] = [];
  const blockRegex =
    /<(?:p|h[1-6]|figure|table|ul|ol|blockquote|div)\b[^>]*>[\s\S]*?<\/(?:p|h[1-6]|figure|table|ul|ol|blockquote|div)>/gi;

  for (const match of html.matchAll(blockRegex)) {
    singleBlocks.push({
      index: match.index ?? 0,
      length: match[0].length,
      html: match[0],
    });
  }

  if (singleBlocks.length === 0) return [];

  const candidates: HtmlSlice[] = [...singleBlocks];
  const seen = new Set(candidates.map((c) => `${c.index}:${c.length}`));

  for (let i = 0; i < singleBlocks.length; i++) {
    const start = singleBlocks[i].index;
    let end = singleBlocks[i].index + singleBlocks[i].length;

    for (let j = i + 1; j < singleBlocks.length && j <= i + maxWindowSize - 1; j++) {
      const next = singleBlocks[j];
      const gap = html.slice(end, next.index);
      if (/[^\s]/.test(gap)) break;

      end = next.index + next.length;
      if (end - start > maxCombinedLength) break;

      const key = `${start}:${end - start}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({
          index: start,
          length: end - start,
          html: html.slice(start, end),
        });
      }
    }
  }

  return candidates.sort((a, b) => a.index - b.index);
}

export function buildTextSignature(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildTokenSet(signature: string, limit = 300): Set<string> {
  return new Set(
    signature
      .split(' ')
      .filter((token) => token.length > 1)
      .slice(0, limit),
  );
}

function findBestTableCandidate(html: string, expectedTableHtml: string): HtmlSlice | null {
  const expectedSignature = buildTextSignature(expectedTableHtml);
  if (!expectedSignature) return null;

  const expectedTokens = buildTokenSet(expectedSignature);
  if (expectedTokens.size === 0) return null;

  const expectedPrefix = expectedSignature.slice(0, 120);
  let best: (HtmlSlice & { score: number }) | null = null;

  for (const candidate of extractTableCandidates(html)) {
    const candidateSignature = buildTextSignature(candidate.html);
    if (!candidateSignature) continue;

    const candidateTokens = buildTokenSet(candidateSignature);
    if (candidateTokens.size === 0) continue;

    let intersection = 0;
    expectedTokens.forEach((token) => {
      if (candidateTokens.has(token)) intersection++;
    });

    const overlapScore = intersection / expectedTokens.size;
    const prefixScore = expectedPrefix.length >= 30 && candidateSignature.includes(expectedPrefix) ? 1 : 0;
    const score = prefixScore * 0.6 + overlapScore * 0.4;

    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  }

  return best && best.score >= 0.35 ? best : null;
}

function findBestBlockCandidate(html: string, expectedHtml: string): HtmlSlice | null {
  const expectedSignature = buildTextSignature(expectedHtml);
  if (!expectedSignature) return null;

  const expectedTokens = buildTokenSet(expectedSignature);
  if (expectedTokens.size === 0) return null;

  const expectedPrefix = expectedSignature.slice(0, 120);
  let best: (HtmlSlice & { score: number }) | null = null;

  for (const candidate of extractBlockCandidates(html)) {
    const candidateSignature = buildTextSignature(candidate.html);
    if (!candidateSignature) continue;

    const candidateTokens = buildTokenSet(candidateSignature);
    if (candidateTokens.size === 0) continue;

    let intersection = 0;
    expectedTokens.forEach((token) => {
      if (candidateTokens.has(token)) intersection++;
    });

    const overlapScore = intersection / expectedTokens.size;
    const prefixScore = expectedPrefix.length >= 24 && candidateSignature.includes(expectedPrefix) ? 1 : 0;
    const lengthRatio =
      Math.min(candidateSignature.length, expectedSignature.length) /
      Math.max(candidateSignature.length, expectedSignature.length);
    const score = prefixScore * 0.45 + overlapScore * 0.4 + lengthRatio * 0.15;

    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  }

  return best && best.score >= 0.4 ? best : null;
}

export function normalizeVariableHtml(html: string): string {
  if (!html) return html;

  let normalized = html;
  let previous = '';

  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized
      .replace(MENTION_SPAN_REGEX, '$1')
      .replace(VAR_FILLED_CLASS_REGEX, '$1')
      .replace(VAR_EMPTY_CLASS_REGEX, '$1')
      .replace(VAR_FILLED_STYLE_REGEX, '$1')
      .replace(VAR_EMPTY_STYLE_REGEX, '$1');
  }

  return normalized;
}

export function rebuildRawContentFromRenderedHtml(
  renderedHtml: string,
  placeholderSourceHtml: string,
  valuesMap?: Record<string, string>,
): string {
  const normalizedRendered = normalizeVariableHtml(renderedHtml);
  const normalizedSource = normalizeVariableHtml(placeholderSourceHtml || '');

  if (!normalizedRendered) {
    return normalizedSource || normalizedRendered;
  }

  const varsInOrder = extractVariableOccurrencesInOrder(normalizedSource);
  if (varsInOrder.length === 0) {
    return normalizedRendered;
  }

  let rebuilt = normalizedRendered;
  const sourceVarCounts = countVariableOccurrences(normalizedSource);
  const existingVarCounts = countVariableOccurrences(rebuilt);
  const uniqueVarsInOrder = [...new Set(varsInOrder)];

  const sortedTextVars = [...uniqueVarsInOrder]
    .sort((a, b) => {
      const aLen = valuesMap?.[a] == null ? 0 : String(valuesMap[a]).length;
      const bLen = valuesMap?.[b] == null ? 0 : String(valuesMap[b]).length;
      return bLen - aLen;
    })
    .filter((key) => {
      const value = valuesMap?.[key];
      return !(typeof value === 'string' && value.trim().startsWith('<'));
    });

  const htmlVarsInOrder = uniqueVarsInOrder.filter((key) => {
    const value = valuesMap?.[key];
    return typeof value === 'string' && value.trim().startsWith('<');
  });
  const allowSingleDocumentTemplateFuzzyFallback = htmlVarsInOrder.length === 1;
  const getNeededCount = (key: string) =>
    Math.max((sourceVarCounts.get(key) || 0) - (existingVarCounts.get(key) || 0), 0);

  sortedTextVars.forEach((key) => {
    const value = valuesMap?.[key];
    if (value === undefined || value === null || value === '') return;

    const renderedValue = normalizeVariableHtml(String(value));
    if (!renderedValue) return;

    let neededCount = getNeededCount(key);
    while (neededCount > 0) {
      const idx = rebuilt.indexOf(renderedValue);
      if (idx === -1) break;

      rebuilt = rebuilt.substring(0, idx) + `{{${key}}}` + rebuilt.substring(idx + renderedValue.length);
      existingVarCounts.set(key, (existingVarCounts.get(key) || 0) + 1);
      neededCount -= 1;
    }
  });

  htmlVarsInOrder.forEach((key) => {
    const value = valuesMap?.[key];
    if (value === undefined || value === null || value === '') return;
    const isDocumentTemplateVar = isDocumentTemplateVariableKey(key);

    const renderedValue = normalizeVariableHtml(String(value));
    if (!renderedValue) return;

    let neededCount = getNeededCount(key);
    while (neededCount > 0) {
      let replaceIdx = -1;
      let replaceLen = renderedValue.length;

      // ── Document-template div wrapper ──
      // Generated HTML is wrapped in <div data-document-template="id">.
      // Find the matching wrapper in the rebuilt HTML by its
      // data-attribute — mirrors how <table>/<figure> matching works.
      if (isDocumentTemplateVar) {
        const renderedWrapperTemplateId = renderedValue.match(DOC_TEMPLATE_OPEN_TAG_REGEX)?.[1];
        const templateIds = Array.from(
          new Set(
            [renderedWrapperTemplateId, key.slice(DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE.length + 1)].filter(
              (templateId): templateId is string => typeof templateId === 'string' && templateId.length > 0,
            ),
          ),
        );

        for (const templateId of templateIds) {
          const divPattern = new RegExp(
            `<div\\b[^>]*data-document-template="${escapeRegExp(templateId)}"[^>]*>[\\s\\S]*?<\\/div>`,
            'i',
          );
          const divMatch = rebuilt.match(divPattern);
          if (divMatch && divMatch.index !== undefined) {
            replaceIdx = divMatch.index;
            replaceLen = divMatch[0].length;
            break;
          }
        }
      }

      // ── Table in <figure> wrapper ──
      if (replaceIdx === -1 && renderedValue.trim().startsWith('<table')) {
        for (const match of rebuilt.matchAll(TABLE_FIGURE_REGEX)) {
          if (match[0].includes(renderedValue)) {
            replaceIdx = match.index ?? -1;
            replaceLen = match[0].length;
            break;
          }
        }

        if (replaceIdx === -1) {
          const bestCandidate = findBestTableCandidate(rebuilt, renderedValue);
          if (bestCandidate) {
            replaceIdx = bestCandidate.index;
            replaceLen = bestCandidate.length;
          }
        }
      }

      // ── Exact string match ──
      if (replaceIdx === -1) {
        replaceIdx = rebuilt.indexOf(renderedValue);
      }

      // ── Fuzzy block match (skip for multi-document-template vars) ──
      if (replaceIdx === -1 && (!isDocumentTemplateVar || allowSingleDocumentTemplateFuzzyFallback)) {
        const bestBlockCandidate = findBestBlockCandidate(rebuilt, renderedValue);
        if (bestBlockCandidate) {
          replaceIdx = bestBlockCandidate.index;
          replaceLen = bestBlockCandidate.length;
        }
      }

      if (replaceIdx === -1) break;

      rebuilt = rebuilt.substring(0, replaceIdx) + `{{${key}}}` + rebuilt.substring(replaceIdx + replaceLen);
      existingVarCounts.set(key, (existingVarCounts.get(key) || 0) + 1);
      neededCount -= 1;
    }
  });

  return rebuilt;
}

/**
 * Remove rendered document-template HTML from content using text-signature
 * matching. This is robust against CKEditor reformatting HTML
 * attributes/styles because it compares text content, not raw HTML structure.
 *
 * Strategy:
 * 1. Build a text-signature (strip tags, lowercase, tokenise) of the
 *    rendered value that needs to be removed.
 * 2. Extract all block-level elements (<p>, <h1-6>, <div>, …) from the
 *    target HTML.
 * 3. Use a sliding window over consecutive blocks to find the contiguous
 *    region whose combined text-signature best matches the expected one.
 * 4. Remove that region from the HTML.
 *
 * Uses both token overlap (F1 score) and a leading-text prefix check to
 * disambiguate templates that share common sub-section vocabulary (e.g.
 * PLO vs PO templates both contain "Kiến thức", "Kỹ năng", etc.).
 */
export function removeRenderedDocumentTemplateHtml(html: string, renderedValue: string): string {
  if (!html || !renderedValue) return html;

  const expectedSig = buildTextSignature(renderedValue);
  if (!expectedSig || expectedSig.length < 8) return html;

  const expectedTokens = buildTokenSet(expectedSig);
  if (expectedTokens.size < 3) return html;

  // First ~120 chars of the text signature act as an anchor.  For doc
  // templates the first block is the unique section title (e.g.
  // "3.1 Mục tiêu…" vs "3.2 Chuẩn đầu ra…").
  const expectedPrefix = expectedSig.slice(0, 120);

  // Extract individual block-level elements with their positions
  const blockRegex =
    /<(?:p|h[1-6]|figure|table|ul|ol|blockquote|div|section)\b[^>]*>[\s\S]*?<\/(?:p|h[1-6]|figure|table|ul|ol|blockquote|div|section)>/gi;
  const blocks: Array<{ index: number; end: number; html: string }> = [];
  for (const m of html.matchAll(blockRegex)) {
    const idx = m.index ?? 0;
    blocks.push({ index: idx, end: idx + m[0].length, html: m[0] });
  }
  if (blocks.length === 0) return html;

  // Sliding window: try windows of increasing size to find the best match
  let bestScore = 0;
  let bestStart = -1;
  let bestEnd = -1;
  const maxWindow = Math.min(blocks.length, 60);

  for (let i = 0; i < blocks.length; i++) {
    let combinedText = '';
    for (let j = i; j < blocks.length && j - i < maxWindow; j++) {
      combinedText += ' ' + buildTextSignature(blocks[j].html);
      const trimmed = combinedText.trim();
      const combinedTokens = buildTokenSet(trimmed);
      if (combinedTokens.size === 0) continue;

      // Recall: what fraction of expected tokens appear in this window
      let intersection = 0;
      expectedTokens.forEach((token) => {
        if (combinedTokens.has(token)) intersection++;
      });
      const recall = intersection / expectedTokens.size;

      // Precision: what fraction of the window tokens are expected
      // (avoids matching huge regions that happen to contain the target)
      let reverseIntersection = 0;
      combinedTokens.forEach((token) => {
        if (expectedTokens.has(token)) reverseIntersection++;
      });
      const precision = combinedTokens.size > 0 ? reverseIntersection / combinedTokens.size : 0;

      // Prefix bonus: reward windows whose leading text matches the
      // expected template's leading text.  This is crucial for
      // disambiguating PLO vs PO (shared sub-section vocabulary).
      const prefixBonus = expectedPrefix.length >= 12 && trimmed.startsWith(expectedPrefix.slice(0, 30)) ? 0.15 : 0;

      // F1-like score with prefix bonus
      const f1 = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0;
      const score = f1 + prefixBonus;

      if (score > bestScore && recall >= 0.5) {
        bestScore = score;
        bestStart = blocks[i].index;
        bestEnd = blocks[j].end;
      }
    }
  }

  // Require a minimum score to avoid false positives
  if (bestScore < 0.45 || bestStart === -1) return html;

  // Remove the matched region, and also clean up any surrounding empty
  // whitespace / newlines left behind.
  const before = html.slice(0, bestStart);
  const after = html.slice(bestEnd);
  return (before + after).replace(/(<p>\s*<\/p>\s*){2,}/gi, '');
}

function replacePlaceholders(
  html: string,
  valuesMap: Record<string, string> | undefined,
  getReplacementFn: (full: string, key: string, value: any) => string,
): string {
  if (!html) return html;

  let result = '';
  let i = 0;
  const len = html.length;

  while (i < len) {
    if (html[i] === '<') {
      result += '<';
      i++;
      let inQuote: string | null = null;
      while (i < len) {
        const ch = html[i];
        if (inQuote) {
          result += ch;
          i++;
          if (ch === inQuote) inQuote = null;
        } else if (ch === '"' || ch === "'") {
          result += ch;
          i++;
          inQuote = ch;
        } else if (ch === '>') {
          result += ch;
          i++;
          break;
        } else {
          result += ch;
          i++;
        }
      }
    } else {
      const nextTag = html.indexOf('<', i);
      const nextBrace = html.indexOf('{{', i);

      if (nextBrace === -1 || (nextTag !== -1 && nextTag < nextBrace)) {
        const end = nextTag === -1 ? len : nextTag;
        result += html.slice(i, end);
        i = end;
      } else {
        result += html.slice(i, nextBrace);
        i = nextBrace;

        VAR_REGEX.lastIndex = i;
        const match = VAR_REGEX.exec(html);
        if (match && match.index === i) {
          const full = match[0];
          const key = match[1];
          const value = valuesMap?.[key];
          result += getReplacementFn(full, key, value);
          i += full.length;
        } else {
          result += '{{';
          i += 2;
        }
      }
    }
  }

  return result;
}

export function applyVariablesToHtml(html: string, valuesMap?: Record<string, string>): string {
  if (!valuesMap) return html;

  const effectiveValuesMap = withSemesterCoursesCompositeValue(valuesMap);
  const resolvedValuesMap = effectiveValuesMap ?? {};
  let result = replaceCompositeVariablePatterns(normalizeVariableHtml(html));

  Object.entries(resolvedValuesMap).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim().startsWith('<')) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mentionRegex = new RegExp(
        `<span(?:[^>]*?class="mention"[^>]*?data-mention="|[^>]*?data-mention="[^>]*?class="mention")\\{\\{${escapedKey}\\}\\}"[^>]*?>.*?</span>`,
        'g',
      );
      result = result.replace(mentionRegex, value);
    }
  });

  result = replacePlaceholders(result, effectiveValuesMap, (full, key, value) => {
    if (value === undefined || value === null || value === '') return full;
    if (typeof value === 'string' && value.trim().startsWith('<')) {
      return value;
    }
    const css = getVariableTextStyleCss(key);
    if (!css) return String(value);
    return `<span style="${css}">${String(value)}</span>`;
  });

  return result;
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function withVariableAnchorAttributes(value: string, key: string, occurrence: number): string {
  const openingTagMatch = value.match(/<([a-zA-Z][\w:-]*)([^>]*)>/);
  if (!openingTagMatch) {
    return value;
  }

  const [, tagName, rawAttrs = ''] = openingTagMatch;
  const cleanAttrs = rawAttrs.replace(/\sdata-var-key="[^"]*"/gi, '').replace(/\sdata-var-occurrence="[^"]*"/gi, '');
  const attrsWithoutClosingSlash = cleanAttrs.replace(/\s*\/\s*$/, '');
  const isSelfClosing = /\/\s*>$/.test(openingTagMatch[0]);
  const escapedKey = escapeHtmlAttribute(key);
  const closing = isSelfClosing ? ' />' : '>';
  const anchoredTag = `<${tagName}${attrsWithoutClosingSlash} data-var-key="${escapedKey}" data-var-occurrence="${occurrence}"${closing}`;

  return value.replace(openingTagMatch[0], anchoredTag);
}

export function applyVariablesToHtmlWithHighlight(html: string, valuesMap?: Record<string, string>): string {
  const effectiveValuesMap = withSemesterCoursesCompositeValue(valuesMap);
  const resolvedValuesMap = effectiveValuesMap ?? {};
  let result = replaceCompositeVariablePatterns(normalizeVariableHtml(html));
  const occurrenceByKey = new Map<string, number>();

  const getNextOccurrence = (key: string) => {
    const current = occurrenceByKey.get(key) ?? 0;
    occurrenceByKey.set(key, current + 1);
    return current;
  };

  if (effectiveValuesMap) {
    Object.entries(resolvedValuesMap).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim().startsWith('<')) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const mentionRegex = new RegExp(
          `<span(?:[^>]*?class="mention"[^>]*?data-mention="|[^>]*?data-mention="[^>]*?class="mention")\\{\\{${escapedKey}\\}\\}"[^>]*?>.*?</span>`,
          'g',
        );
        result = result.replace(mentionRegex, () => withVariableAnchorAttributes(value, key, getNextOccurrence(key)));
      }
    });
  }

  result = replacePlaceholders(result, effectiveValuesMap, (full, key, value) => {
    const occurrence = getNextOccurrence(key);
    const escapedKey = escapeHtmlAttribute(key);
    const anchorAttrs = `data-var-key="${escapedKey}" data-var-occurrence="${occurrence}"`;
    const textStyle = getVariableTextStyleCss(key);

    if (value === undefined || value === null || value === '') {
      return `<span class="var-empty" ${anchorAttrs} style="${textStyle}background-color:#fff78a;color:#f57f17;padding:2px 4px;border-radius:3px;font-weight:600;">${full}</span>`;
    }
    if (typeof value === 'string' && value.trim().startsWith('<')) {
      return withVariableAnchorAttributes(value, key, occurrence);
    }
    return `<span class="var-filled" ${anchorAttrs} style="${textStyle}background-color:#dcfce7;color:#166534;padding:2px 4px;border-radius:3px;">${String(value)}</span>`;
  });

  return result;
}
