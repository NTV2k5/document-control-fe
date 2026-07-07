export type TEditorGlobalStyle = {
  font_family: string;
  font_size: string;
  line_height: string;
  color: string;
};

export type TEditorHeadingSizes = {
  h1: string;
  h2: string;
  h3: string;
};

export type TEditorTextStyle = Partial<
  TEditorGlobalStyle & {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    text_align: 'left' | 'center' | 'right' | 'justify';
    background_color: string;
  }
>;

const GENERIC_FONT_FAMILIES = new Set([
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

export const normalizeEditorFontFamily = (value?: string | null, fallback = 'Times New Roman') => {
  const families = (value || fallback)
    .split(',')
    .map((family) =>
      family
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\s+/g, ' '),
    )
    .filter(Boolean);
  const preferredFamily = families.find((family) => !GENERIC_FONT_FAMILIES.has(family.toLowerCase())) ?? fallback;

  if (/^times(?:\s+new\s+roman)?$/i.test(preferredFamily)) return 'Times New Roman';
  return preferredFamily;
};

export const getEditorFontFamilyCssValue = (value?: string | null) => {
  const normalized = normalizeEditorFontFamily(value);
  const escaped = normalized.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return /\s/.test(escaped) ? `'${escaped}'` : escaped;
};

export const DEFAULT_EDITOR_GLOBAL_STYLE: TEditorGlobalStyle = {
  font_family: 'Times New Roman',
  font_size: '13pt',
  line_height: '1.25',
  color: '#000000',
};

let editorGlobalStyle = { ...DEFAULT_EDITOR_GLOBAL_STYLE };

const getStyleValue = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

export const getEditorHeadingSizes = (style?: Partial<TEditorGlobalStyle> | null): TEditorHeadingSizes => {
  const normalized = style ? normalizeEditorGlobalStyle(style) : getEditorGlobalStyle();
  const baseFontSize = normalized.font_size;

  return {
    h1: baseFontSize,
    h2: baseFontSize,
    h3: baseFontSize,
  };
};

const applyEditorGlobalStyleCssVariables = (style: TEditorGlobalStyle) => {
  if (typeof document === 'undefined') {
    return;
  }

  const headingSizes = getEditorHeadingSizes(style);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--document-font-family', getEditorFontFamilyCssValue(style.font_family));
  rootStyle.setProperty('--document-font-size', style.font_size);
  rootStyle.setProperty('--document-line-height', style.line_height);
  rootStyle.setProperty('--document-table-font-size', style.font_size);
  rootStyle.setProperty('--document-table-line-height', style.line_height);
  rootStyle.setProperty('--document-heading-1-font-size', headingSizes.h1);
  rootStyle.setProperty('--document-heading-2-font-size', headingSizes.h2);
  rootStyle.setProperty('--document-heading-3-font-size', headingSizes.h3);
};

export const normalizeEditorGlobalStyle = (style?: Partial<TEditorGlobalStyle> | null): TEditorGlobalStyle => ({
  font_family: normalizeEditorFontFamily(getStyleValue(style?.font_family, DEFAULT_EDITOR_GLOBAL_STYLE.font_family)),
  font_size: getStyleValue(style?.font_size, DEFAULT_EDITOR_GLOBAL_STYLE.font_size),
  line_height: getStyleValue(style?.line_height, DEFAULT_EDITOR_GLOBAL_STYLE.line_height),
  color: getStyleValue(style?.color, DEFAULT_EDITOR_GLOBAL_STYLE.color),
});

export const setEditorGlobalStyle = (style?: Partial<TEditorGlobalStyle> | null) => {
  editorGlobalStyle = normalizeEditorGlobalStyle(style);
  applyEditorGlobalStyleCssVariables(editorGlobalStyle);
};

export const getEditorGlobalStyle = () => editorGlobalStyle;

export const getEditorGlobalStyleCss = () => {
  const style = getEditorGlobalStyle();
  return `font-family: ${getEditorFontFamilyCssValue(style.font_family)}; font-size: ${style.font_size}; line-height: ${style.line_height}; color: ${style.color};`;
};

export const normalizeEditorTextStyle = (style?: TEditorTextStyle | null): TEditorGlobalStyle & TEditorTextStyle => {
  const globalStyle = getEditorGlobalStyle();

  return {
    font_family: normalizeEditorFontFamily(getStyleValue(style?.font_family, globalStyle.font_family)),
    font_size: getStyleValue(style?.font_size, globalStyle.font_size),
    line_height: getStyleValue(style?.line_height, globalStyle.line_height),
    color: getStyleValue(style?.color, globalStyle.color),
    ...(typeof style?.bold === 'boolean' ? { bold: style.bold } : {}),
    ...(typeof style?.italic === 'boolean' ? { italic: style.italic } : {}),
    ...(typeof style?.underline === 'boolean' ? { underline: style.underline } : {}),
    ...(style?.text_align === 'left' ||
    style?.text_align === 'center' ||
    style?.text_align === 'right' ||
    style?.text_align === 'justify'
      ? { text_align: style.text_align }
      : {}),
    ...(typeof style?.background_color === 'string' && style.background_color.trim()
      ? { background_color: style.background_color.trim() }
      : {}),
  };
};

export const getEditorTextStyleCss = (style?: TEditorTextStyle | null) => {
  const normalized = normalizeEditorTextStyle(style);
  const declarations = [
    `font-family: ${getEditorFontFamilyCssValue(normalized.font_family)}`,
    `font-size: ${normalized.font_size}`,
    `line-height: ${normalized.line_height}`,
    `color: ${normalized.color}`,
  ];

  if (typeof normalized.bold === 'boolean') {
    declarations.push(`font-weight: ${normalized.bold ? '700' : '400'}`);
  }
  if (typeof normalized.italic === 'boolean') {
    declarations.push(`font-style: ${normalized.italic ? 'italic' : 'normal'}`);
  }
  if (typeof normalized.underline === 'boolean') {
    declarations.push(`text-decoration: ${normalized.underline ? 'underline' : 'none'}`);
  }
  if (normalized.text_align) {
    declarations.push(`text-align: ${normalized.text_align}`);
  }
  if (normalized.background_color) {
    declarations.push(`background-color: ${normalized.background_color}`);
  }

  return `${declarations.join('; ')};`;
};

/**
 * Build CSS string containing ONLY the properties explicitly set in the given
 * style object. When `style` is null/undefined (no explicit config), returns
 * an empty string so the rendered element inherits surrounding formatting
 * (font-size, font-family, etc.) from the template.
 */
export const getEditorTextStyleExplicitCss = (style?: TEditorTextStyle | null) => {
  if (!style) return '';

  const declarations: string[] = [];

  if (typeof style.font_family === 'string' && style.font_family.trim()) {
    declarations.push(`font-family: ${getEditorFontFamilyCssValue(style.font_family)}`);
  }
  if (typeof style.font_size === 'string' && style.font_size.trim()) {
    declarations.push(`font-size: ${style.font_size}`);
  }
  if (typeof style.line_height === 'string' && style.line_height.trim()) {
    declarations.push(`line-height: ${style.line_height}`);
  }
  if (typeof style.color === 'string' && style.color.trim()) {
    declarations.push(`color: ${style.color}`);
  }
  if (typeof style.bold === 'boolean') {
    declarations.push(`font-weight: ${style.bold ? '700' : '400'}`);
  }
  if (typeof style.italic === 'boolean') {
    declarations.push(`font-style: ${style.italic ? 'italic' : 'normal'}`);
  }
  if (typeof style.underline === 'boolean') {
    declarations.push(`text-decoration: ${style.underline ? 'underline' : 'none'}`);
  }
  if (style.text_align) {
    declarations.push(`text-align: ${style.text_align}`);
  }
  if (typeof style.background_color === 'string' && style.background_color.trim()) {
    declarations.push(`background-color: ${style.background_color}`);
  }

  return declarations.length > 0 ? `${declarations.join('; ')};` : '';
};
