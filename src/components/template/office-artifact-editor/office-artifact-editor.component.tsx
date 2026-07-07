import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Braces,
  FileSpreadsheet,
  Loader2,
  Maximize2,
  Minimize2,
  Presentation,
  RefreshCw,
  Save,
  Upload,
} from 'lucide-react';
import { Button } from 'reactjs-platform/ui';
import {
  getCollaboraArtifactConfigAPI,
  getRenderedCollaboraArtifactConfigAPI,
  type ICollaboraArtifactConfigResponse,
} from 'api';
import { VariablePickerDialog } from '../../variable/variable-picker-dialog';
import type {
  IOfficeArtifactEditorProps,
  IOfficeArtifactEditorRef,
  IOfficeArtifactSetupPanelProps,
} from './office-artifact-editor.type';
import {
  getOfficePreviewSearchTokenForVariableKey,
  getSemesterCoursesSignFocusVariableKey,
  type IVariablePickerItem,
} from '../../../lib';

type TUnoArg = {
  type: 'boolean' | 'short' | 'string';
  value: boolean | number | string;
};

type TCollaboraMessage = {
  MessageId: string;
  SendTime?: number;
  Values?: Record<string, unknown>;
};

type TOfficeVariableLocation = {
  address?: string;
  cell?: string;
  range?: string;
  sheet?: string;
  templateText?: string;
};

type TSpreadsheetTableBindingColumn = {
  column?: string;
  field_key?: string;
  id?: string;
};

type TSpreadsheetTableBinding = {
  columns?: TSpreadsheetTableBindingColumn[];
  data_template_row?: number;
  end_row?: number;
  id?: string;
  name?: string;
  sheet?: string;
  start_row?: number;
  subsection_template_row?: number | null;
  variable_key?: string;
};

type TFocusRequest = {
  cellRef?: string;
  searchText: string;
};

type TCellPoint = {
  col: number;
  ref: string;
  row: number;
};

type TCellRange = {
  end: TCellPoint;
  start: TCellPoint;
};

type TStringEntry = {
  path: string;
  value: string;
};

const EMPTY_OFFICE_VALUES: Record<string, string> = {};
const CELL_REF_PATTERN = /\$?([A-Z]{1,4})\$?(\d{1,7})(?::\$?([A-Z]{1,4})\$?(\d{1,7}))?/g;
const LIVE_SYNC_IGNORED_VARIABLE_PREFIXES = ['table_template.', 'document_template.'];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const parseCollaboraMessage = (data: unknown): TCollaboraMessage | null => {
  const parsed = (() => {
    if (typeof data !== 'string') return data;

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  })();

  const record = asRecord(parsed);
  return typeof record.MessageId === 'string' ? (record as TCollaboraMessage) : null;
};

const isCollaboraDocumentReadyMessage = (message: TCollaboraMessage) => {
  const values = asRecord(message.Values);
  const status = String(values.Status || values.status || '');

  return (
    message.MessageId === 'App_LoadingStatus' && ['Document_Loaded', 'Frame_Ready', 'Document_Ready'].includes(status)
  );
};

const buildValuesSignature = (values: Record<string, string>) =>
  Object.keys(values)
    .sort()
    .map((key) => `${key}\u0000${values[key] ?? ''}`)
    .join('\u0001');

const shouldLiveSyncVariableValue = (key: string) =>
  !LIVE_SYNC_IGNORED_VARIABLE_PREFIXES.some((prefix) => key.startsWith(prefix));

const buildLiveSyncValueSnapshot = (values: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => shouldLiveSyncVariableValue(key))
      .map(([key, value]) => [key, String(value ?? '')]),
  );

const RENDER_DATA_SIGNATURE_IGNORED_KEYS = new Set(['value', 'document_template_values']);

const buildObjectSignature = (value: unknown, ignoredKeys?: Set<string>): string => {
  const normalize = (current: unknown, key?: string): unknown => {
    if (key && ignoredKeys?.has(key)) {
      return `__ignored__:${key}`;
    }

    if (Array.isArray(current)) {
      return current.map((entry) => normalize(entry));
    }

    if (current && typeof current === 'object') {
      return Object.keys(current as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = normalize((current as Record<string, unknown>)[key], key);
          return result;
        }, {});
    }

    return current;
  };

  return JSON.stringify(normalize(value) ?? null);
};

const getCollaboraTargetOrigin = (iframeUrl?: string) => {
  if (!iframeUrl) return '*';

  try {
    return new URL(iframeUrl).origin;
  } catch {
    return '*';
  }
};

const createUnoArgs = (args: Record<string, TUnoArg>) => args;

const createSearchReplaceMessage = (searchText: string, replaceText: string): TCollaboraMessage => ({
  MessageId: 'Send_UNO_Command',
  Values: {
    Args: createUnoArgs({
      'SearchItem.Backward': { type: 'boolean', value: false },
      'SearchItem.Command': { type: 'short', value: 3 },
      'SearchItem.ReplaceString': { type: 'string', value: replaceText },
      'SearchItem.SearchString': { type: 'string', value: searchText },
    }),
    Command: '.uno:ExecuteSearch',
  },
});

const createFindTextMessage = (searchText: string): TCollaboraMessage => ({
  MessageId: 'Send_UNO_Command',
  Values: {
    Args: createUnoArgs({
      'SearchItem.Backward': { type: 'boolean', value: false },
      'SearchItem.Command': { type: 'short', value: 0 },
      'SearchItem.SearchString': { type: 'string', value: searchText },
    }),
    Command: '.uno:ExecuteSearch',
  },
});

const createGoToCellMessage = (cellRef: string): TCollaboraMessage => ({
  MessageId: 'Send_UNO_Command',
  Values: {
    Args: createUnoArgs({
      ToPoint: { type: 'string', value: cellRef },
    }),
    Command: '.uno:GoToCell',
  },
});

const createInsertTextMessage = (text: string): TCollaboraMessage => ({
  MessageId: 'Send_UNO_Command',
  Values: {
    Args: createUnoArgs({
      Text: { type: 'string', value: text },
    }),
    Command: '.uno:InsertText',
  },
});

const createSaveMessage = (): TCollaboraMessage => ({
  MessageId: 'Send_UNO_Command',
  Values: {
    Command: '.uno:Save',
  },
});

const addVariablePlaceholder = (metadata: unknown, item: IVariablePickerItem) => {
  const record = asRecord(metadata);
  const existing = Array.isArray(record.variable_placeholders) ? record.variable_placeholders.map(String) : [];
  const token = item.token || `{{${item.key}}}`;

  return {
    ...record,
    variable_placeholders: existing.includes(token) ? existing : [...existing, token],
  };
};

const normalizeOfficeVariableLocation = (value: unknown): TOfficeVariableLocation | null => {
  const location = asRecord(value);
  const cell = typeof location.cell === 'string' ? location.cell.trim() : '';
  const range = typeof location.range === 'string' ? location.range.trim() : '';
  const address = typeof location.address === 'string' ? location.address.trim() : '';
  const sheet = typeof location.sheet === 'string' ? location.sheet.trim() : '';
  const templateText = typeof location.template_text === 'string' ? location.template_text : '';

  if (!cell && !range && !address) {
    return null;
  }

  return { address, cell, range, sheet, templateText };
};

const getSpreadsheetTableBindingLocation = (
  record: Record<string, unknown>,
  varKey: string,
): TOfficeVariableLocation | null => {
  const bindings = Array.isArray(record.spreadsheet_table_bindings)
    ? (record.spreadsheet_table_bindings as TSpreadsheetTableBinding[])
    : [];
  const binding = bindings.find((item) => item?.variable_key === varKey);
  const columns = Array.isArray(binding?.columns) ? binding.columns : [];
  const normalizedColumns = columns
    .map((item) =>
      String(item?.column ?? '')
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  const startRow = Number(binding?.start_row);
  const endRow = Number(binding?.end_row);
  const sheetName = String(binding?.sheet ?? '').trim();

  if (!normalizedColumns.length || !Number.isFinite(startRow) || !Number.isFinite(endRow)) {
    return null;
  }

  const sortedColumns = normalizedColumns.sort((left, right) => columnNameToIndex(left) - columnNameToIndex(right));
  const startColumn = sortedColumns[0];
  const endColumn = sortedColumns[sortedColumns.length - 1];
  const normalizedStartRow = Math.min(startRow, endRow);
  const normalizedEndRow = Math.max(startRow, endRow);

  return {
    cell: `${startColumn}${normalizedStartRow}`,
    range: `${startColumn}${normalizedStartRow}:${endColumn}${normalizedEndRow}`,
    sheet: sheetName,
  };
};

const getVariableLocations = (metadata: unknown, varKey: string): TOfficeVariableLocation[] => {
  const record = asRecord(metadata);
  const locations = asRecord(record.variable_locations);
  const rawLocation = locations[varKey];
  const normalizedLocations = (Array.isArray(rawLocation) ? rawLocation : [rawLocation])
    .map(normalizeOfficeVariableLocation)
    .filter(Boolean) as TOfficeVariableLocation[];

  if (normalizedLocations.length) {
    return normalizedLocations;
  }

  const bindingLocation = getSpreadsheetTableBindingLocation(record, varKey);
  return bindingLocation ? [bindingLocation] : [];
};

const getVariableLocation = (metadata: unknown, varKey: string): TOfficeVariableLocation | null =>
  getVariableLocations(metadata, varKey)[0] || null;

const stripSheetPrefix = (value: string) => value.trim().split('!').pop()?.split('.').pop()?.trim() || '';

const columnNameToIndex = (columnName: string) =>
  columnName
    .toUpperCase()
    .split('')
    .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);

const normalizeCellRef = (value: string) => value.replace(/\$/g, '').toUpperCase();

const parseCellPoint = (value: string): TCellPoint | null => {
  const normalized = normalizeCellRef(value);
  const match = /^([A-Z]{1,4})(\d{1,7})$/.exec(normalized);
  if (!match) return null;

  return {
    col: columnNameToIndex(match[1]),
    ref: `${match[1]}${Number(match[2])}`,
    row: Number(match[2]),
  };
};

const parseCellRange = (value: string): TCellRange | null => {
  const sheetlessValue = stripSheetPrefix(value);
  CELL_REF_PATTERN.lastIndex = 0;
  const match = CELL_REF_PATTERN.exec(sheetlessValue);
  if (!match) return null;

  const start = parseCellPoint(`${match[1]}${match[2]}`);
  const end = parseCellPoint(`${match[3] || match[1]}${match[4] || match[2]}`);
  if (!start || !end) return null;

  return {
    start: {
      ...start,
      col: Math.min(start.col, end.col),
      row: Math.min(start.row, end.row),
    },
    end: {
      ...end,
      col: Math.max(start.col, end.col),
      row: Math.max(start.row, end.row),
    },
  };
};

const rangesIntersect = (left: TCellRange, right: TCellRange) =>
  left.start.col <= right.end.col &&
  left.end.col >= right.start.col &&
  left.start.row <= right.end.row &&
  left.end.row >= right.start.row;

const toAbsoluteCellRef = (cellRef: string) => {
  const point = parseCellPoint(cellRef);
  return point ? `$${point.ref.replace(/\d+$/, '')}$${point.row}` : cellRef;
};

const formatSheetRef = (sheetName?: string) => {
  const sheet = sheetName?.trim();
  if (!sheet) return '';

  const escaped = sheet.replace(/'/g, "''");
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(sheet) ? `$${sheet}` : `$'${escaped}'`;
};

const getLocationRangeSource = (location: TOfficeVariableLocation | null) => {
  if (!location) return '';
  return location.range || location.cell || location.address || '';
};

const getLocationCellRef = (location: TOfficeVariableLocation | null) => {
  if (!location) return '';

  const range = parseCellRange(getLocationRangeSource(location));
  if (!range) return '';

  const sheetRef = formatSheetRef(location.sheet);
  const cellRef = toAbsoluteCellRef(range.start.ref);
  return sheetRef ? `${sheetRef}.${cellRef}` : cellRef;
};

const collectStringEntries = (value: unknown, path = '', output: TStringEntry[] = []) => {
  if (typeof value === 'string') {
    output.push({ path, value });
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStringEntries(item, `${path}[${index}]`, output));
    return output;
  }

  const record = asRecord(value);
  Object.entries(record).forEach(([key, item]) => {
    collectStringEntries(item, path ? `${path}.${key}` : key, output);
  });

  return output;
};

const extractCellRefsFromText = (value: string) => {
  if (/\.(xlsx|xls|pptx|ppt|ods|odp)\b/i.test(value)) return [];

  const refs: string[] = [];
  CELL_REF_PATTERN.lastIndex = 0;
  let match = CELL_REF_PATTERN.exec(value);

  while (match) {
    const startRef = `${match[1]}${match[2]}`;
    const endRef = match[3] && match[4] ? `${match[3]}${match[4]}` : '';
    refs.push(endRef ? `${startRef}:${endRef}` : startRef);
    match = CELL_REF_PATTERN.exec(value);
  }

  return refs;
};

const extractCandidateCellRefs = (message: TCollaboraMessage) => {
  const entries = collectStringEntries(message.Values);
  const selectionHints = /cell|cursor|selection|address|range|reference|namebox|formula/i;
  const prioritizedEntries = [
    ...entries.filter((entry) => selectionHints.test(entry.path)),
    ...entries.filter((entry) => !selectionHints.test(entry.path)),
  ];

  return prioritizedEntries.flatMap((entry) => extractCellRefsFromText(entry.value));
};

const findVariableKeyByCellRef = (metadata: unknown, cellRef: string) => {
  const selectedRange = parseCellRange(cellRef);
  if (!selectedRange) return '';

  const record = asRecord(metadata);
  const locations = asRecord(record.variable_locations);
  const bindings = Array.isArray(record.spreadsheet_table_bindings)
    ? (record.spreadsheet_table_bindings as TSpreadsheetTableBinding[])
    : [];
  const candidateVarKeys = new Set<string>([
    ...Object.keys(locations),
    ...bindings.map((binding) => String(binding?.variable_key ?? '').trim()).filter(Boolean),
  ]);

  for (const varKey of candidateVarKeys) {
    const hasMatchingLocation = getVariableLocations(record, varKey).some((location) => {
      const locationRange = parseCellRange(getLocationRangeSource(location));
      return locationRange ? rangesIntersect(selectedRange, locationRange) : false;
    });

    if (hasMatchingLocation) {
      return varKey;
    }
  }

  return '';
};

export const OfficeArtifactSetupPanel = ({ artifactType, scope }: IOfficeArtifactSetupPanelProps) => {
  const isSpreadsheet = artifactType === 'spreadsheet';
  const title = isSpreadsheet ? 'Excel / Spreadsheet editor' : 'PowerPoint editor';
  const extension = isSpreadsheet ? '.xlsx' : '.pptx';
  const scopeLabel = scope === 'template' ? 'template' : 'document';
  const Icon = isSpreadsheet ? FileSpreadsheet : Presentation;

  return (
    <div className="flex h-full min-h-130 items-center justify-center bg-slate-50 p-6">
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">{title}</p>
            <p className="mt-2 leading-6">
              This format opens with Collabora Online. Save this {scopeLabel} first, or import an {extension} source
              file, then the full Office editor will load here.
            </p>
            <div className="mt-4 grid gap-2 text-[13px] font-medium text-slate-500 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <Save className="size-3.5" />
                Save creates an Office source file
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <Upload className="size-3.5" />
                Import keeps native Office editing
              </div>
            </div>
            <p className="mt-4 text-[13px] text-slate-400">Collabora WOPI is used for spreadsheet and slide editing.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const OfficeArtifactEditor = forwardRef<IOfficeArtifactEditorRef, IOfficeArtifactEditorProps>(
  (
    {
      artifactType,
      id,
      metadata,
      onDirtyChange,
      onFocusedVariableChange,
      onMetadataChange,
      onShowToast,
      readOnly,
      renderArtifactState,
      renderData,
      renderValues = false,
      scope,
      showInsertVariableButton = true,
      template_type,
      values = EMPTY_OFFICE_VALUES,
      variableCatalog,
    },
    ref,
  ) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    // Live registry of mounted iframe DOM nodes keyed by their src URL. Both the
    // visible and the buffering preview live here, so promotion is a pure
    // visibility flip — the already-loaded buffer node is never re-navigated.
    const iframeNodesRef = useRef<Map<string, HTMLIFrameElement>>(new Map());
    const lastAppliedValuesRef = useRef<Record<string, string>>({});
    const lastFocusedVariableRef = useRef('');
    const pendingFocusRequestRef = useRef<TFocusRequest | null>(null);
    const selectionSyncReadyAtRef = useRef(0);
    const valuesRef = useRef(values);
    valuesRef.current = values;
    const renderDataRef = useRef(renderData);
    renderDataRef.current = renderData;
    const renderArtifactStateRef = useRef(renderArtifactState);
    renderArtifactStateRef.current = renderArtifactState;
    const latestValuesSignatureRef = useRef('');
    const lastLoadedValuesSignatureRef = useRef('');
    const latestRenderPreviewInputsSignatureRef = useRef('');
    const lastLoadedRenderPreviewInputsSignatureRef = useRef('');
    const [collaboraConfig, setCollaboraConfig] = useState<ICollaboraArtifactConfigResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showVariablePicker, setShowVariablePicker] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [isFrameReady, setIsFrameReady] = useState(false);
    const [needsPreviewRebuild, setNeedsPreviewRebuild] = useState(false);
    // Double-buffering: a rebuilt preview loads in a hidden iframe and is only
    // swapped in once fully loaded, so the visible preview never flashes/reloads.
    const [incomingConfig, setIncomingConfig] = useState<ICollaboraArtifactConfigResponse | null>(null);
    const collaboraConfigRef = useRef(collaboraConfig);
    collaboraConfigRef.current = collaboraConfig;
    const incomingConfigRef = useRef(incomingConfig);
    incomingConfigRef.current = incomingConfig;
    const incomingSettleTimerRef = useRef<number | null>(null);
    const pendingPromotionRef = useRef<{
      previewValues: Record<string, string>;
      previewSignature: string;
      valuesSignature: string;
    } | null>(null);
    const errorRef = useRef<string | null>(error);
    errorRef.current = error;
    const valuesSignature = useMemo(() => buildValuesSignature(values), [values]);
    const renderDataSignature = useMemo(
      () => buildObjectSignature(renderData, RENDER_DATA_SIGNATURE_IGNORED_KEYS),
      [renderData],
    );
    const renderArtifactStateSignature = useMemo(
      () => buildObjectSignature(renderArtifactState),
      [renderArtifactState],
    );
    const renderPreviewInputsSignature = useMemo(
      () => `${renderArtifactStateSignature}\u0002${renderDataSignature}`,
      [renderArtifactStateSignature, renderDataSignature],
    );
    if (!latestValuesSignatureRef.current) {
      latestValuesSignatureRef.current = valuesSignature;
    }
    if (!lastLoadedValuesSignatureRef.current) {
      lastLoadedValuesSignatureRef.current = valuesSignature;
    }
    if (!latestRenderPreviewInputsSignatureRef.current) {
      latestRenderPreviewInputsSignatureRef.current = renderPreviewInputsSignature;
    }
    if (!lastLoadedRenderPreviewInputsSignatureRef.current) {
      lastLoadedRenderPreviewInputsSignatureRef.current = renderPreviewInputsSignature;
    }
    latestValuesSignatureRef.current = valuesSignature;
    latestRenderPreviewInputsSignatureRef.current = renderPreviewInputsSignature;
    const collaboraTargetOrigin = useMemo(
      () => getCollaboraTargetOrigin(collaboraConfig?.iframe_url),
      [collaboraConfig?.iframe_url],
    );

    const notify = useCallback(
      (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        onShowToast?.({ message, type });
      },
      [onShowToast],
    );

    const postToFrame = useCallback(
      (node: HTMLIFrameElement | null | undefined, message: TCollaboraMessage, url?: string) => {
        const target = node?.contentWindow;
        if (!target) return false;

        target.postMessage(
          JSON.stringify({
            ...message,
            SendTime: Date.now(),
          }),
          getCollaboraTargetOrigin(url),
        );
        return true;
      },
      [],
    );

    // Stable ref callback per iframe URL so the nodes map is not churned every
    // render. Lets postMessage target whichever frame is currently visible.
    const iframeRefCallbacksRef = useRef<Map<string, (node: HTMLIFrameElement | null) => void>>(new Map());
    const getIframeRefCallback = useCallback((url: string) => {
      const existing = iframeRefCallbacksRef.current.get(url);
      if (existing) return existing;

      const callback = (node: HTMLIFrameElement | null) => {
        if (node) {
          iframeNodesRef.current.set(url, node);
        } else {
          iframeNodesRef.current.delete(url);
        }
        if (url === collaboraConfigRef.current?.iframe_url) {
          iframeRef.current = node;
        }
      };
      iframeRefCallbacksRef.current.set(url, callback);
      return callback;
    }, []);

    const postCollaboraMessage = useCallback(
      (message: TCollaboraMessage) => {
        const activeUrl = collaboraConfigRef.current?.iframe_url;
        const node = (activeUrl ? iframeNodesRef.current.get(activeUrl) : null) ?? iframeRef.current;
        return postToFrame(node, message, activeUrl);
      },
      [postToFrame],
    );

    const postFocusRequest = useCallback(
      (request: TFocusRequest) => {
        if (request.cellRef) {
          const sent = postCollaboraMessage(createGoToCellMessage(request.cellRef));

          // Some Collabora builds ignore GoToCell in embedded preview mode.
          // The search fallback keeps variable focus usable when the token is
          // still present, while GoToCell covers filled/replaced previews.
          window.setTimeout(() => {
            postCollaboraMessage(createFindTextMessage(request.searchText));
          }, 120);

          return sent;
        }

        return postCollaboraMessage(createFindTextMessage(request.searchText));
      },
      [postCollaboraMessage],
    );

    const loadConfig = useCallback(
      async (options?: { buffered?: boolean }) => {
        const buffered = Boolean(options?.buffered) && Boolean(collaboraConfigRef.current) && !errorRef.current;
        const requestedValuesSignature = latestValuesSignatureRef.current;
        const requestedRenderPreviewInputsSignature = latestRenderPreviewInputsSignatureRef.current;
        const requestedPreviewValues = renderValues ? buildLiveSyncValueSnapshot(valuesRef.current) : {};

        // A buffered rebuild keeps the current preview on screen and loads the
        // new render into a hidden iframe; it is promoted only once fully
        // loaded (see the incoming-iframe onLoad handler). A non-buffered load
        // (initial mount, manual refresh) replaces the visible iframe directly.
        if (buffered) {
          setNeedsPreviewRebuild(false);
        } else {
          setIsLoading(true);
          setError(null);
          setIsFrameReady(false);
          setNeedsPreviewRebuild(false);
          lastAppliedValuesRef.current = {};
          lastFocusedVariableRef.current = '';
          selectionSyncReadyAtRef.current = 0;
        }

        try {
          const nextConfig = renderValues
            ? await getRenderedCollaboraArtifactConfigAPI(
                scope,
                id,
                valuesRef.current,
                renderDataRef.current,
                renderArtifactStateRef.current,
              )
            : await getCollaboraArtifactConfigAPI(scope, id, 'source');

          if (buffered) {
            pendingPromotionRef.current = {
              previewValues: requestedPreviewValues,
              previewSignature: requestedRenderPreviewInputsSignature,
              valuesSignature: requestedValuesSignature,
            };
            setIncomingConfig(nextConfig);
            return;
          }

          setCollaboraConfig(nextConfig);
          lastAppliedValuesRef.current = requestedPreviewValues;
          lastLoadedValuesSignatureRef.current = requestedValuesSignature;
          lastLoadedRenderPreviewInputsSignatureRef.current = requestedRenderPreviewInputsSignature;
        } catch (loadError) {
          const message = loadError instanceof Error ? loadError.message : 'Could not load Collabora config';
          // A failed buffered rebuild must not disturb the visible preview;
          // just surface the manual rebuild button so the user can retry.
          if (buffered) {
            setNeedsPreviewRebuild(true);
            return;
          }
          setError(message);
        } finally {
          if (!buffered) {
            setIsLoading(false);
          }
        }
      },
      [id, renderValues, scope],
    );

    // Promote the hidden (incoming) iframe once it has fully loaded: swap its
    // config into the visible slot so the user never sees a blank/reloading
    // frame. Cancels any in-flight settle timer from a prior promotion.
    const promoteIncomingConfig = useCallback(() => {
      const nextConfig = incomingConfigRef.current;
      const promotion = pendingPromotionRef.current;
      if (!nextConfig) return;

      if (incomingSettleTimerRef.current !== null) {
        window.clearTimeout(incomingSettleTimerRef.current);
      }

      // Give Collabora a moment to paint the rendered values before swapping,
      // otherwise a just-loaded frame can flash its empty grid for one tick.
      incomingSettleTimerRef.current = window.setTimeout(() => {
        incomingSettleTimerRef.current = null;
        // Point the active-frame ref at the buffer node *before* committing the
        // config swap. The buffer is already registered in the nodes map, and
        // React preserves its DOM node across the swap because both iframes are
        // keyed by URL — so the visible frame's src never changes (no reload).
        const promotedNode = iframeNodesRef.current.get(nextConfig.iframe_url);
        if (promotedNode) {
          iframeRef.current = promotedNode;
        }
        setCollaboraConfig(nextConfig);
        setIncomingConfig(null);
        pendingPromotionRef.current = null;
        setIsFrameReady(true);
        selectionSyncReadyAtRef.current = Date.now() + 800;

        if (promotion) {
          lastAppliedValuesRef.current = promotion.previewValues;
          lastLoadedValuesSignatureRef.current = promotion.valuesSignature;
          lastLoadedRenderPreviewInputsSignatureRef.current = promotion.previewSignature;
        }
      }, 350);
    }, []);

    useEffect(() => {
      void loadConfig();
    }, [loadConfig]);

    useEffect(() => {
      lastLoadedValuesSignatureRef.current = latestValuesSignatureRef.current;
      lastLoadedRenderPreviewInputsSignatureRef.current = latestRenderPreviewInputsSignatureRef.current;
    }, [id, renderValues, scope]);

    useEffect(() => {
      if (!renderValues) return;

      const previewInputsChanged = lastLoadedRenderPreviewInputsSignatureRef.current !== renderPreviewInputsSignature;

      if (artifactType === 'spreadsheet') {
        // Spreadsheet previews can only be rendered correctly by the server: a
        // cell's content depends on every variable plus merge semantics, which
        // client-side cell writes corrupt. So debounce a *buffered* rebuild —
        // the new render loads in a hidden iframe and is swapped in only when
        // ready, giving instant-looking updates with zero flash or data loss.
        const valuesChanged = lastLoadedValuesSignatureRef.current !== valuesSignature;
        if (!valuesChanged && !previewInputsChanged) return;

        // Don't rebuild while the user is still typing in a variable input: the
        // iframe swap pulls focus out of the field mid-edit. Defer the rebuild
        // until they leave the field (focusout to a non-input target).
        const isEditingVariableInput = () => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return false;
          const tag = el.tagName;
          return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
        };

        let waitingForBlur = false;
        const handleFocusOut = () => {
          // Defer one tick so document.activeElement settles on the new target.
          window.setTimeout(() => {
            if (!waitingForBlur || isEditingVariableInput()) return;
            waitingForBlur = false;
            document.removeEventListener('focusout', handleFocusOut, true);
            void loadConfig({ buffered: true });
          }, 0);
        };

        const rebuildId = window.setTimeout(() => {
          if (isEditingVariableInput()) {
            waitingForBlur = true;
            document.addEventListener('focusout', handleFocusOut, true);
            return;
          }
          void loadConfig({ buffered: true });
        }, 600);

        return () => {
          window.clearTimeout(rebuildId);
          if (waitingForBlur) {
            document.removeEventListener('focusout', handleFocusOut, true);
          }
        };
      }

      const valuesChanged = lastLoadedValuesSignatureRef.current !== valuesSignature;
      if (!valuesChanged && !previewInputsChanged) return;
      if (!previewInputsChanged) return;

      setNeedsPreviewRebuild(true);
    }, [artifactType, loadConfig, renderPreviewInputsSignature, renderValues, valuesSignature]);

    useEffect(() => {
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    }, [isFocusMode]);

    useEffect(() => {
      if (!isFocusMode) return;

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsFocusMode(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [isFocusMode]);

    useEffect(() => {
      if (!collaboraConfig) return;

      const handleMessage = (event: MessageEvent) => {
        if (collaboraTargetOrigin !== '*' && event.origin !== collaboraTargetOrigin) return;

        const message = parseCollaboraMessage(event.data);
        if (!message) return;

        if (isCollaboraDocumentReadyMessage(message)) {
          postCollaboraMessage({ MessageId: 'Host_PostmessageReady' });
          setIsFrameReady(true);
          selectionSyncReadyAtRef.current = Date.now() + 800;
        }

        if (artifactType !== 'spreadsheet' || !onFocusedVariableChange) return;
        if (Date.now() < selectionSyncReadyAtRef.current) return;

        const varKey = extractCandidateCellRefs(message)
          .map((cellRef) => findVariableKeyByCellRef(metadata, cellRef))
          .find(Boolean);

        if (!varKey || varKey === lastFocusedVariableRef.current) return;

        lastFocusedVariableRef.current = varKey;
        onFocusedVariableChange(varKey);
      };

      window.addEventListener('message', handleMessage);

      return () => window.removeEventListener('message', handleMessage);
    }, [artifactType, collaboraConfig, collaboraTargetOrigin, metadata, onFocusedVariableChange, postCollaboraMessage]);

    useEffect(() => {
      if (!renderValues || !isFrameReady || !collaboraConfig) return;
      // Spreadsheets re-render through the server instead of poking Collabora:
      // a single cell's correct content depends on every variable plus merge
      // semantics, so client-side cell writes (ReplaceAll or EnterString) either
      // duplicate values or wipe merged rows. The spreadsheet branch above
      // rebuilds via loadConfig() with double-buffering, so there is no flash.
      if (artifactType === 'spreadsheet') return;

      const timeoutId = window.setTimeout(() => {
        const entries = Object.entries(values).filter(([key]) => shouldLiveSyncVariableValue(key));
        let sentUpdate = false;

        entries.forEach(([key, rawValue]) => {
          const nextValue = String(rawValue ?? '');
          const previousValue = lastAppliedValuesRef.current[key];
          if (previousValue === nextValue) return;

          const token = getOfficePreviewSearchTokenForVariableKey(key);

          if (!nextValue) {
            if (previousValue === undefined) return;

            postCollaboraMessage(createSearchReplaceMessage(previousValue, token));
            delete lastAppliedValuesRef.current[key];
            sentUpdate = true;
            return;
          }

          const searchText = previousValue || token;
          postCollaboraMessage(createSearchReplaceMessage(searchText, nextValue));
          lastAppliedValuesRef.current[key] = nextValue;
          sentUpdate = true;
        });

        if (sentUpdate) {
          setNeedsPreviewRebuild(
            lastLoadedRenderPreviewInputsSignatureRef.current !== latestRenderPreviewInputsSignatureRef.current,
          );
        }
      }, 220);

      return () => window.clearTimeout(timeoutId);
    }, [artifactType, collaboraConfig, isFrameReady, postCollaboraMessage, renderValues, values, valuesSignature]);

    useEffect(() => {
      if (!isFrameReady || !pendingFocusRequestRef.current) return;

      postFocusRequest(pendingFocusRequestRef.current);
      pendingFocusRequestRef.current = null;
    }, [isFrameReady, postFocusRequest]);

    const forceSave = useCallback(async () => {
      setIsSaving(true);
      try {
        postCollaboraMessage(createSaveMessage());
        onDirtyChange?.(false);
        notify('Save requested from Collabora', 'success');
      } finally {
        window.setTimeout(() => setIsSaving(false), 300);
      }
    }, [notify, onDirtyChange, postCollaboraMessage]);

    const focusVariable = useCallback(
      async (varKey: string) => {
        const focusVarKey = getSemesterCoursesSignFocusVariableKey(varKey);
        const token = getOfficePreviewSearchTokenForVariableKey(varKey);
        const location = artifactType === 'spreadsheet' ? getVariableLocation(metadata, focusVarKey) : null;
        const request: TFocusRequest = {
          cellRef: getLocationCellRef(location),
          searchText: token,
        };

        if (!isFrameReady) {
          pendingFocusRequestRef.current = request;
          return Boolean(iframeRef.current);
        }

        if (!postFocusRequest(request)) {
          return false;
        }

        return true;
      },
      [artifactType, isFrameReady, metadata, postFocusRequest],
    );

    const insertVariable = useCallback(
      async (item: IVariablePickerItem) => {
        const token = item.token || `{{${item.key}}}`;
        onMetadataChange?.(addVariablePlaceholder(metadata, item));

        if (postCollaboraMessage(createInsertTextMessage(token))) {
          notify(`Insert requested for ${token}.`, 'success');
          return true;
        }

        await navigator.clipboard?.writeText(token);
        notify(`Copied ${token}. Press Cmd/Ctrl+V in Collabora to paste it at the cursor.`, 'info');
        return false;
      },
      [metadata, notify, onMetadataChange, postCollaboraMessage],
    );

    useImperativeHandle(
      ref,
      () => ({
        focusVariable,
        forceSave,
        insertVariable,
        rebuildPreview: async () => {
          await loadConfig();
        },
      }),
      [focusVariable, forceSave, insertVariable, loadConfig],
    );

    const isRenderedPreview = renderValues;
    const shouldShowInsertVariableButton = !isRenderedPreview && (showInsertVariableButton || isFocusMode);

    return (
      <div
        className={`flex flex-col bg-white ${
          isFocusMode ? 'fixed inset-0 z-1000 h-screen min-h-screen w-screen shadow-2xl' : 'h-full min-h-130'
        }`}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700">
            <FileSpreadsheet className="size-4 text-emerald-600" />
            <span className="truncate">
              {artifactType === 'spreadsheet' ? 'Collabora Spreadsheet' : 'Collabora Presentation'}
              {isRenderedPreview ? ' Preview' : ''}
            </span>
            {collaboraConfig?.source_file_name ? (
              <span className="truncate text-[13px] font-medium text-slate-400">
                {collaboraConfig.source_file_name}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {shouldShowInsertVariableButton ? (
              <Button size="sm" variant="outline" onClick={() => setShowVariablePicker(true)} disabled={readOnly}>
                <Braces className="size-3.5" />
                Insert variable
              </Button>
            ) : null}
            {!isRenderedPreview ? (
              <Button size="sm" variant="outline" onClick={() => void forceSave()} disabled={readOnly || isSaving}>
                {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save Office
              </Button>
            ) : null}
            {needsPreviewRebuild ? (
              <Button size="sm" variant="outline" onClick={() => void loadConfig()} disabled={isLoading}>
                Rebuild preview
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => void loadConfig()} disabled={isLoading}>
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              variant={isFocusMode ? 'default' : 'outline'}
              onClick={() => setIsFocusMode((current) => !current)}
              className="gap-2">
              {isFocusMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              {isFocusMode ? 'Exit focus' : 'Focus'}
            </Button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-slate-100">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading Collabora...
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <p className="font-semibold">Collabora is not available</p>
                <p className="mt-1 leading-6">{error}</p>
                <p className="mt-2 text-[13px] text-amber-700">
                  Configure COLLABORA_SERVER_URL, COLLABORA_WOPI_SECRET, APP_PUBLIC_BASE_URL, and APP_FRONTEND_BASE_URL.
                </p>
              </div>
            </div>
          ) : collaboraConfig?.iframe_url || incomingConfig?.iframe_url ? (
            // Both the visible config and any buffering config are rendered as a
            // single URL-keyed list. React reconciles by key, so when a buffer
            // is promoted (its url becomes collaboraConfig.iframe_url) its DOM
            // node is preserved — the visible frame's src never changes and the
            // already-loaded preview is shown without any reload or flash.
            [
              collaboraConfig?.iframe_url ? { config: collaboraConfig, role: 'active' as const } : null,
              incomingConfig?.iframe_url && incomingConfig.iframe_url !== collaboraConfig?.iframe_url
                ? { config: incomingConfig, role: 'incoming' as const }
                : null,
            ]
              .filter((slot): slot is { config: ICollaboraArtifactConfigResponse; role: 'active' | 'incoming' } =>
                Boolean(slot),
              )
              .map(({ config, role }) => {
                const url = config.iframe_url;
                const isIncoming = role === 'incoming';

                return (
                  <iframe
                    key={url}
                    ref={getIframeRefCallback(url)}
                    title={isIncoming ? `${config.source_file_name} (loading)` : config.source_file_name}
                    src={url}
                    aria-hidden={isIncoming || undefined}
                    tabIndex={isIncoming ? -1 : undefined}
                    className={
                      isIncoming
                        ? 'pointer-events-none absolute inset-0 size-full border-0 opacity-0'
                        : 'h-full min-h-130 w-full border-0'
                    }
                    allow="clipboard-read; clipboard-write; fullscreen"
                    onLoad={() => {
                      if (isIncoming) {
                        promoteIncomingConfig();
                        return;
                      }

                      const node = iframeNodesRef.current.get(url);
                      postToFrame(node, { MessageId: 'Host_PostmessageReady' }, url);
                      window.setTimeout(() => {
                        postToFrame(iframeNodesRef.current.get(url), { MessageId: 'Host_PostmessageReady' }, url);
                      }, 800);
                      window.setTimeout(() => {
                        setIsFrameReady((current) => current || iframeNodesRef.current.has(url));
                      }, 4000);
                    }}
                  />
                );
              })
          ) : null}
        </div>

        <VariablePickerDialog
          open={showVariablePicker}
          catalog={variableCatalog}
          template_type={template_type}
          multiSelect={false}
          contentClassName={isFocusMode ? 'z-[1100]' : undefined}
          onOpenChange={setShowVariablePicker}
          onSelect={(item) => void insertVariable(item)}
        />
      </div>
    );
  },
);

OfficeArtifactEditor.displayName = 'OfficeArtifactEditor';
