import { GripVertical, Loader2, Plus, X } from 'lucide-react';
import type { ClassicEditor } from 'ckeditor5';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTemplateTableOptionsAPI, type TTemplateDataOption } from 'api';
import {
  dedupeMentionRecordOptions,
  formatMentionRecordOptionLabel,
  getMentionEntityByAlias,
  getMentionEntitiesByVisibility,
  getMentionRichTextEditorAdapterFromElement,
  getMentionRichTextEditorFromElement,
  getMentionRecordDetailText,
  getMentionRecordInsertText,
  MENTION_ENTITY_REGISTRY,
  toMentionRecordText,
  type IMentionRichTextEditorAdapter,
  type IMentionEntityConfig,
} from '../../../lib';
import { useTranslation } from '../../../i18n';

type TFormMentionElement = HTMLInputElement | HTMLTextAreaElement;
type TMentionTarget =
  | {
      kind: 'form';
      element: TFormMentionElement;
    }
  | {
      kind: 'rich-text';
      element: HTMLElement;
      editor: ClassicEditor | null;
      adapter: IMentionRichTextEditorAdapter | null;
    };

type TMentionMatch = {
  start: number;
  end: number;
  raw: string;
  keyword: string;
  query: string;
  hasQuerySeparator: boolean;
};

type TMentionMode = 'entities' | 'records';

type TMentionPosition = {
  top: number;
  left: number;
  width: number;
};

type TMentionAnchorRect = Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'>;

type TMentionEntityItem = {
  type: 'entity';
  entity: IMentionEntityConfig;
};

type TMentionRecordItem = {
  type: 'record';
  entity: IMentionEntityConfig;
  option: TTemplateDataOption;
};

type TMentionItem = TMentionEntityItem | TMentionRecordItem;

type TMentionRecordRequest = {
  id: number;
  targetElement: HTMLElement;
  entityKey: string;
  search: string;
};

type TMentionOpenRecordMenuOptions = {
  blockSelectionMs?: number;
  initialHighlightedIndex?: number;
  initialPosition?: TMentionPosition;
};

type TMentionRecordFormatField = {
  key: string;
  label: string;
  value: string;
};

type TMentionRecordFormatModalState = {
  target: TMentionTarget;
  match: TMentionMatch;
  item: TMentionRecordItem;
  fields: TMentionRecordFormatField[];
};

type TMentionMenuState = {
  isOpen: boolean;
  target: TMentionTarget | null;
  match: TMentionMatch | null;
  mode: TMentionMode;
  entity: IMentionEntityConfig | null;
  items: TMentionItem[];
  position: TMentionPosition;
  isLoading: boolean;
  emptyMessage: string | null;
  errorMessage: string | null;
};

const EMPTY_POSITION: TMentionPosition = { top: 0, left: 0, width: 360 };

const EMPTY_MENU_STATE: TMentionMenuState = {
  isOpen: false,
  target: null,
  match: null,
  mode: 'entities',
  entity: null,
  items: [],
  position: EMPTY_POSITION,
  isLoading: false,
  emptyMessage: null,
  errorMessage: null,
};

const TEXT_INPUT_TYPES = new Set(['', 'email', 'search', 'tel', 'text', 'url']);
const MENTION_AUTOCOMPLETE_DEBUG_PREFIX = '[mention-autocomplete]';

const PREFERRED_ALIASES = [
  'giangvien',
  'khoa',
  'nganh',
  'chuyennganh',
  'hocphan',
  'ctdt',
  'khoahoc',
  'khoikienthuc',
  'decuong',
  'clo',
  'plo',
  'po',
  'tailieuthamkhao',
  'kehoachgiangday',
  'danhgia',
  'nhomplo',
  'nhompo',
];

const normalizeMentionText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .replace(/[\s_-]+/g, '')
    .trim()
    .toLowerCase();

const isMentionAutocompleteDebugEnabled = () => {
  try {
    return window.localStorage.getItem('mention-autocomplete-debug') === '1';
  } catch {
    return false;
  }
};

const debugMentionAutocomplete = (event: string, payload?: Record<string, unknown>) => {
  if (!isMentionAutocompleteDebugEnabled()) {
    return;
  }

  console.info(MENTION_AUTOCOMPLETE_DEBUG_PREFIX, event, payload ?? {});
};

const getMentionRecordFieldValue = (option: TTemplateDataOption, fieldKey: string) => {
  if (fieldKey === 'id') {
    return option.id;
  }

  if (fieldKey === '_id') {
    return option.id;
  }

  if (fieldKey === 'value') {
    return option.value;
  }

  if (fieldKey === 'label') {
    return option.label;
  }

  const recordValue = option.record?.[fieldKey];
  return toMentionRecordText(recordValue);
};

const formatMentionRecordFieldLabel = (fieldKey: string) => {
  if (fieldKey === 'id') return 'ID';
  if (fieldKey === '_id') return '_id';

  return fieldKey
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
};

const getMentionRecordFormatFields = (entity: IMentionEntityConfig, option: TTemplateDataOption) => {
  const fieldKeys = [
    entity.valueField,
    entity.labelField,
    ...entity.searchFields,
    ...Object.keys(option.record ?? {}),
    'id',
    '_id',
    'value',
    'label',
  ];

  const uniqueFieldKeys = Array.from(new Set(fieldKeys)).filter((fieldKey): fieldKey is string => {
    if (typeof fieldKey !== 'string' || !fieldKey) {
      return false;
    }

    if (fieldKey.startsWith('_') && fieldKey !== '_id') {
      return false;
    }

    return true;
  });

  return uniqueFieldKeys
    .map((fieldKey) => {
      const value = getMentionRecordFieldValue(option, fieldKey);
      if (!value.trim()) {
        return null;
      }

      return {
        key: fieldKey,
        label: formatMentionRecordFieldLabel(fieldKey),
        value,
      };
    })
    .filter((field): field is TMentionRecordFormatField => field !== null);
};

const getMentionRecordFormatText = (fields: TMentionRecordFormatField[]) =>
  fields
    .map((field) => field.value.trim())
    .filter(Boolean)
    .join(', ');

const isFormMentionTarget = (target: TMentionTarget): target is Extract<TMentionTarget, { kind: 'form' }> =>
  target.kind === 'form';

const getSelectionRangeInElement = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) {
    return null;
  }

  return range;
};

const getSelectionElement = () => {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  if (!node) {
    return null;
  }

  return node instanceof HTMLElement ? node : node.parentElement;
};

const getEditableMentionTarget = (target: EventTarget | null): TMentionTarget | null => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  if (target.closest('[data-mention-autocomplete]')) {
    return null;
  }

  const formElement =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target
      : target.closest<HTMLInputElement | HTMLTextAreaElement>('input, textarea');

  if (formElement) {
    if (formElement.disabled || formElement.readOnly) {
      return null;
    }

    if (formElement.closest('[data-disable-mentions="true"], [data-mention-disabled="true"]')) {
      return null;
    }

    if (formElement instanceof HTMLInputElement && !TEXT_INPUT_TYPES.has(formElement.type)) {
      return null;
    }

    return { kind: 'form', element: formElement };
  }

  const editableElement = target.closest<HTMLElement>('[contenteditable="true"], .ck-editor__editable');
  if (!editableElement || editableElement.closest('[data-disable-mentions="true"], [data-mention-disabled="true"]')) {
    return null;
  }

  return {
    kind: 'rich-text',
    element: editableElement,
    editor: getMentionRichTextEditorFromElement(editableElement),
    adapter: getMentionRichTextEditorAdapterFromElement(editableElement),
  };
};

const getActiveMentionTarget = () => {
  const activeElement = document.activeElement;
  const activeTarget = activeElement instanceof HTMLElement ? getEditableMentionTarget(activeElement) : null;
  if (activeTarget) {
    return activeTarget;
  }

  const selectionElement = getSelectionElement();
  return selectionElement ? getEditableMentionTarget(selectionElement) : null;
};

const getMentionTargetFromEvent = (event: Event) => {
  if (event.target instanceof HTMLElement && event.target.closest('[data-mention-autocomplete]')) {
    return null;
  }

  return getEditableMentionTarget(event.target) ?? getActiveMentionTarget();
};

const isMentionOverlayEventTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(
    target.closest('[data-mention-autocomplete], [data-mention-format-modal], [data-docx-variable-autocomplete]'),
  );

const getMentionMatchFromValue = (value: string, caretPosition: number, nextCharacter = ''): TMentionMatch | null => {
  if (caretPosition === null) {
    return null;
  }

  const valueBeforeCaret = value.slice(0, caretPosition);
  const start = valueBeforeCaret.lastIndexOf('@');
  if (start < 0) {
    return null;
  }

  const previousCharacter = start > 0 ? valueBeforeCaret[start - 1] : '';
  if (previousCharacter && !/[\s([{/"'“‘]/.test(previousCharacter)) {
    return null;
  }

  const raw = valueBeforeCaret.slice(start + 1);
  if (raw.includes('\n') || raw.includes('\r') || raw.length > 80) {
    return null;
  }

  if (nextCharacter && !/[\s.,;:!?)]/.test(nextCharacter)) {
    return null;
  }

  const hasQuerySeparator = /\s/.test(raw);
  const keywordMatch = raw.match(/^([^\s@]*)\s*(.*)$/);
  const keyword = keywordMatch?.[1] ?? '';
  const query = keywordMatch?.[2] ?? '';

  return {
    start,
    end: caretPosition,
    raw,
    keyword,
    query,
    hasQuerySeparator,
  };
};

const getRichTextMentionValueBeforeCaret = (element: HTMLElement) => {
  const range = getSelectionRangeInElement(element);
  if (!range) {
    return null;
  }

  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(element);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  return beforeRange.toString();
};

const getMentionMatch = (target: TMentionTarget): TMentionMatch | null => {
  if (isFormMentionTarget(target)) {
    const caretPosition = target.element.selectionStart;
    if (caretPosition === null) {
      return null;
    }

    return getMentionMatchFromValue(
      target.element.value,
      caretPosition,
      target.element.value.slice(caretPosition, caretPosition + 1),
    );
  }

  const valueBeforeCaret = getRichTextMentionValueBeforeCaret(target.element);
  if (valueBeforeCaret === null) {
    return null;
  }

  return getMentionMatchFromValue(valueBeforeCaret, valueBeforeCaret.length);
};

const isUsableMentionAnchorRect = (rect: TMentionAnchorRect | null | undefined): rect is TMentionAnchorRect => {
  if (!rect) {
    return false;
  }

  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.bottom) &&
    rect.width + rect.height > 0 &&
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
};

const getRangeClientRect = (range: Range): TMentionAnchorRect | null => {
  const rect = range.getBoundingClientRect();
  if (isUsableMentionAnchorRect(rect)) {
    return rect;
  }

  const clientRect = Array.from(range.getClientRects()).find(isUsableMentionAnchorRect);
  return clientRect ?? null;
};

const createMentionAnchorRect = (
  rect: TMentionAnchorRect,
  overrides?: Partial<TMentionAnchorRect>,
): TMentionAnchorRect => ({
  bottom: overrides?.bottom ?? rect.bottom,
  height: overrides?.height ?? rect.height,
  left: overrides?.left ?? rect.left,
  right: overrides?.right ?? rect.right,
  top: overrides?.top ?? rect.top,
  width: overrides?.width ?? rect.width,
});

const getTextNodeCaretProbeRect = (range: Range): TMentionAnchorRect | null => {
  const container = range.startContainer;
  if (container.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const text = container.textContent ?? '';
  if (!text) {
    return null;
  }

  const caretOffset = range.startOffset;
  const probeRange = range.cloneRange();

  if (caretOffset > 0) {
    probeRange.setStart(container, caretOffset - 1);
    probeRange.setEnd(container, caretOffset);
    const rect = getRangeClientRect(probeRange);
    if (rect) {
      return createMentionAnchorRect(rect, {
        left: rect.right,
        width: 0,
      });
    }
  }

  if (caretOffset < text.length) {
    probeRange.setStart(container, caretOffset);
    probeRange.setEnd(container, caretOffset + 1);
    const rect = getRangeClientRect(probeRange);
    if (rect) {
      return createMentionAnchorRect(rect, {
        right: rect.left,
        width: 0,
      });
    }
  }

  return null;
};

const getRichTextMentionAnchorRect = (
  target: Extract<TMentionTarget, { kind: 'rich-text' }>,
  match?: TMentionMatch,
) => {
  const adapterRect = target.adapter?.getSelectionRect?.({
    markerText: match ? `@${match.raw}` : undefined,
  });
  if (isUsableMentionAnchorRect(adapterRect)) {
    return adapterRect;
  }

  const selectionRange = getSelectionRangeInElement(target.element);
  if (!selectionRange) {
    return null;
  }

  return getRangeClientRect(selectionRange) ?? getTextNodeCaretProbeRect(selectionRange);
};

const getMentionPosition = (target: TMentionTarget, match?: TMentionMatch): TMentionPosition => {
  const anchorRect = isFormMentionTarget(target) ? null : getRichTextMentionAnchorRect(target, match);
  const rect = anchorRect ?? target.element.getBoundingClientRect();
  const width = Math.min(Math.max(target.element.getBoundingClientRect().width, 320), 440);
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12);
  const topBelow = rect.bottom + 8;
  const top = topBelow > window.innerHeight - 160 ? Math.max(12, rect.top - 328) : topBelow;

  return { top, left, width };
};

const getPreferredAlias = (entity: IMentionEntityConfig) =>
  PREFERRED_ALIASES.find((alias) => entity.aliases.includes(alias)) ?? entity.aliases[0] ?? entity.key;

const getEntitySearchText = (entity: IMentionEntityConfig) =>
  normalizeMentionText([entity.key, entity.table, entity.label, ...entity.aliases].join(' '));

const getEntityItems = (keyword: string): TMentionEntityItem[] => {
  const normalizedKeyword = normalizeMentionText(keyword);
  const baseEntities = normalizedKeyword ? MENTION_ENTITY_REGISTRY : getMentionEntitiesByVisibility('primary');
  const entities = normalizedKeyword
    ? baseEntities.filter((entity) => getEntitySearchText(entity).includes(normalizedKeyword))
    : baseEntities;

  return entities.slice(0, 10).map((entity) => ({ type: 'entity', entity }));
};

const getDefaultPersonEntity = () =>
  getMentionEntityByAlias('person') ?? getMentionEntitiesByVisibility('primary')[0] ?? null;

const shouldLoadDefaultRecordOptions = (entity: IMentionEntityConfig) => Boolean(entity.table && entity.valueField);

const hasDomainLikeMentionText = (value: string) => /[.@:/\\|?#=&]/.test(value);

const hasVietnameseDiacritic = (value: string) => /[À-ỹ]/.test(value);

const isLikelyDirectPersonQuery = (match: TMentionMatch) => {
  const raw = match.raw.trim();
  if (!raw || hasDomainLikeMentionText(raw)) {
    return false;
  }

  if (match.hasQuerySeparator) {
    return true;
  }

  return hasVietnameseDiacritic(raw) || /^[A-ZĐ][A-Za-zÀ-ỹ'-]{1,}$/.test(raw);
};

const getRecordModeEntity = (match: TMentionMatch): { entity: IMentionEntityConfig; search: string } | null => {
  const exactEntity = match.keyword ? getMentionEntityByAlias(match.keyword) : null;
  if (exactEntity) {
    return {
      entity: exactEntity,
      search: match.hasQuerySeparator ? match.query.trim() : '',
    };
  }

  const shouldSearchPerson = isLikelyDirectPersonQuery(match);
  const personEntity = getDefaultPersonEntity();
  if (!shouldSearchPerson || !personEntity) {
    return null;
  }

  return {
    entity: personEntity,
    search: match.raw.trim(),
  };
};

const setNativeInputValue = (element: TFormMentionElement, value: string) => {
  const prototype = Object.getPrototypeOf(element);
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (valueSetter) {
    valueSetter.call(element, value);
    return;
  }

  element.value = value;
};

const replaceFormMentionText = (element: TFormMentionElement, match: TMentionMatch, replacement: string) => {
  const nextValue = `${element.value.slice(0, match.start)}${replacement}${element.value.slice(match.end)}`;
  const nextCaretPosition = match.start + replacement.length;

  setNativeInputValue(element, nextValue);
  element.focus();
  element.setSelectionRange(nextCaretPosition, nextCaretPosition);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  return getMentionMatch({ kind: 'form', element });
};

const replaceRichTextMentionText = (
  target: Extract<TMentionTarget, { kind: 'rich-text' }>,
  match: TMentionMatch,
  replacement: string,
) => {
  if (target.editor) {
    const editor = target.editor;

    try {
      editor.model.change((writer) => {
        const selection = editor.model.document.selection;
        const focus = selection.getFirstPosition();
        if (!focus) {
          return;
        }

        const start = focus.getShiftedBy(-(match.raw.length + 1));
        const range = writer.createRange(start, focus);
        const attributes = Object.fromEntries(selection.getAttributes());
        editor.model.insertContent(writer.createText(replacement, attributes), range);
      });
      editor.editing.view.focus();
    } catch {
      return null;
    }

    return getMentionMatch(target);
  }

  if (target.adapter) {
    if (target.adapter.replaceMentionText({ replacement, replaceLength: match.raw.length + 1 })) {
      return getMentionMatch(target);
    }

    return null;
  }

  const range = getSelectionRangeInElement(target.element);
  if (!range) {
    return null;
  }

  const startRange = range.cloneRange();
  startRange.setStart(range.startContainer, Math.max(0, range.startOffset - match.raw.length - 1));
  startRange.deleteContents();

  const textNode = document.createTextNode(replacement);
  startRange.insertNode(textNode);
  startRange.setStartAfter(textNode);
  startRange.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(startRange);
  target.element.dispatchEvent(new Event('input', { bubbles: true }));

  return getMentionMatch(target);
};

const replaceMentionText = (target: TMentionTarget, match: TMentionMatch, replacement: string) => {
  if (isFormMentionTarget(target)) {
    return replaceFormMentionText(target.element, match, replacement);
  }

  return replaceRichTextMentionText(target, match, replacement);
};

const fetchMentionRecordOptions = async (entity: IMentionEntityConfig, search: string) => {
  const requestParams = {
    table: entity.table,
    filter_field: undefined,
    filter_value: undefined,
    search: search || undefined,
    sort_order: 'asc' as const,
    page: 1,
    page_size: 8,
  };

  const primary = await getTemplateTableOptionsAPI({
    ...requestParams,
    field_name: entity.valueField,
    label_field: entity.labelField,
  });

  if (!entity.labelField || !search.trim() || entity.labelField === entity.valueField) {
    return primary;
  }

  const secondary = await getTemplateTableOptionsAPI({
    ...requestParams,
    field_name: entity.labelField,
    label_field: entity.valueField,
  });

  return dedupeMentionRecordOptions([...primary, ...secondary]);
};

export const MentionAutocompleteProvider = () => {
  const { t } = useTranslation();
  const [menuState, setMenuState] = useState<TMentionMenuState>(EMPTY_MENU_STATE);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [formatModalState, setFormatModalState] = useState<TMentionRecordFormatModalState | null>(null);
  const [formatSelectedKeys, setFormatSelectedKeys] = useState<string[]>([]);
  const [formatDraggedKey, setFormatDraggedKey] = useState<string | null>(null);
  const menuStateRef = useRef(menuState);
  const requestSequenceRef = useRef(0);
  const activeRecordRequestRef = useRef<TMentionRecordRequest | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const recordSearchTimerRef = useRef<number | null>(null);
  const recordSelectionBlockedUntilRef = useRef(0);
  const selectionChangeRafRef = useRef<number | null>(null);
  const recordPositionRafRef = useRef<number | null>(null);
  const suppressBlurCloseRef = useRef(false);

  const updateMenuState = useCallback((nextState: TMentionMenuState) => {
    menuStateRef.current = nextState;
    setMenuState(nextState);
  }, []);

  const closeMenu = useCallback(() => {
    debugMentionAutocomplete('close-menu', {
      activeRequestId: activeRecordRequestRef.current?.id,
      activeEntity: activeRecordRequestRef.current?.entityKey,
      activeSearch: activeRecordRequestRef.current?.search,
      hadRecordTimer: recordSearchTimerRef.current !== null,
    });
    suppressBlurCloseRef.current = false;
    recordSelectionBlockedUntilRef.current = 0;
    requestSequenceRef.current += 1;
    activeRecordRequestRef.current = null;
    if (recordPositionRafRef.current !== null) {
      window.cancelAnimationFrame(recordPositionRafRef.current);
      recordPositionRafRef.current = null;
    }
    if (recordSearchTimerRef.current) {
      window.clearTimeout(recordSearchTimerRef.current);
      recordSearchTimerRef.current = null;
    }
    updateMenuState(EMPTY_MENU_STATE);
    setHighlightedIndex(0);
  }, [updateMenuState]);

  const openEntityMenu = useCallback(
    (target: TMentionTarget, match: TMentionMatch) => {
      activeRecordRequestRef.current = null;
      const items = getEntityItems(match.keyword);
      updateMenuState({
        isOpen: true,
        target,
        match,
        mode: 'entities',
        entity: null,
        items,
        position: getMentionPosition(target, match),
        isLoading: false,
        emptyMessage: null,
        errorMessage: null,
      });
      setHighlightedIndex(-1);
    },
    [updateMenuState],
  );

  const scheduleRecordMenuPositionRefresh = useCallback(
    (requestId: number, target: TMentionTarget, match: TMentionMatch, entity: IMentionEntityConfig) => {
      if (recordPositionRafRef.current !== null) {
        window.cancelAnimationFrame(recordPositionRafRef.current);
      }

      recordPositionRafRef.current = window.requestAnimationFrame(() => {
        recordPositionRafRef.current = window.requestAnimationFrame(() => {
          recordPositionRafRef.current = null;
          const activeRequest = activeRecordRequestRef.current;
          const currentState = menuStateRef.current;
          if (
            activeRequest?.id !== requestId ||
            !currentState.isOpen ||
            currentState.mode !== 'records' ||
            currentState.target?.element !== target.element ||
            currentState.entity?.key !== entity.key ||
            currentState.match?.start !== match.start ||
            currentState.match.end !== match.end ||
            currentState.match.raw !== match.raw
          ) {
            return;
          }

          updateMenuState({
            ...currentState,
            position: getMentionPosition(target, match),
          });
        });
      });
    },
    [updateMenuState],
  );

  const closeRecordFormatModal = useCallback(() => {
    setFormatModalState(null);
    setFormatSelectedKeys([]);
    setFormatDraggedKey(null);
  }, []);

  const openRecordFormatModal = useCallback(
    (item: TMentionRecordItem) => {
      const currentState = menuStateRef.current;
      if (!currentState.target || !currentState.match) {
        return;
      }

      const fields = getMentionRecordFormatFields(item.entity, item.option);
      if (fields.length === 0) {
        replaceMentionText(
          currentState.target,
          currentState.match,
          `${getMentionRecordInsertText(item.entity, item.option)} `,
        );
        closeMenu();
        return;
      }

      const defaultSelectedKeys = fields.some((field) => field.key === item.entity.valueField)
        ? [item.entity.valueField]
        : [fields[0]?.key].filter((key): key is string => Boolean(key));

      suppressBlurCloseRef.current = true;
      window.setTimeout(() => {
        suppressBlurCloseRef.current = false;
      }, 250);

      setFormatModalState({
        target: currentState.target,
        match: currentState.match,
        item,
        fields,
      });
      setFormatSelectedKeys(defaultSelectedKeys);
      setFormatDraggedKey(null);
      closeMenu();
    },
    [closeMenu],
  );

  const formatSelectedFields = useMemo(() => {
    if (!formatModalState) {
      return [];
    }

    const fieldMap = new Map(formatModalState.fields.map((field) => [field.key, field]));
    return formatSelectedKeys
      .map((key) => fieldMap.get(key))
      .filter((field): field is TMentionRecordFormatField => Boolean(field));
  }, [formatModalState, formatSelectedKeys]);

  const formatPreviewText = useMemo(() => getMentionRecordFormatText(formatSelectedFields), [formatSelectedFields]);

  const handleRecordFormatFieldToggle = useCallback((fieldKey: string, checked: boolean) => {
    setFormatSelectedKeys((current) => {
      if (checked) {
        return current.includes(fieldKey) ? current : [...current, fieldKey];
      }

      return current.filter((key) => key !== fieldKey);
    });
  }, []);

  const handleRecordFormatFieldDrop = useCallback(
    (targetKey: string) => {
      if (!formatDraggedKey || formatDraggedKey === targetKey) {
        setFormatDraggedKey(null);
        return;
      }

      setFormatSelectedKeys((current) => {
        const fromIndex = current.indexOf(formatDraggedKey);
        const toIndex = current.indexOf(targetKey);
        if (fromIndex < 0 || toIndex < 0) {
          return current;
        }

        const next = [...current];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });

      setFormatDraggedKey(null);
    },
    [formatDraggedKey],
  );

  const handleRecordFormatSubmit = useCallback(() => {
    if (!formatModalState) {
      return;
    }

    const nextText = formatPreviewText.trim();
    if (!nextText) {
      return;
    }

    const { target, match } = formatModalState;
    closeRecordFormatModal();
    closeMenu();

    // Restore focus to editor before replacing — modal steals DOM focus
    if (target.kind === 'rich-text' && target.editor) {
      target.editor.editing.view.focus();
    } else if (target.kind === 'rich-text' && target.element) {
      target.element.focus();
    } else if (target.kind === 'form') {
      target.element.focus();
    }

    replaceMentionText(target, match, `${nextText} `);
  }, [closeMenu, closeRecordFormatModal, formatModalState, formatPreviewText]);

  const openRecordMenu = useCallback(
    (
      target: TMentionTarget,
      match: TMentionMatch,
      entity: IMentionEntityConfig,
      search: string,
      options: TMentionOpenRecordMenuOptions = {},
    ) => {
      const normalizedSearch = search.trim();
      const activeRequest = activeRecordRequestRef.current;
      const currentState = menuStateRef.current;
      const isSameActiveRequest =
        activeRequest?.targetElement === target.element &&
        activeRequest.entityKey === entity.key &&
        activeRequest.search === normalizedSearch &&
        currentState.isOpen &&
        currentState.mode === 'records' &&
        currentState.entity?.key === entity.key;

      if (isSameActiveRequest) {
        debugMentionAutocomplete('same-record-request', {
          activeRequestId: activeRequest?.id,
          entity: entity.key,
          search: normalizedSearch,
          mode: currentState.mode,
          isLoading: currentState.isLoading,
          itemCount: currentState.items.length,
        });

        if (
          currentState.match?.start !== match.start ||
          currentState.match.end !== match.end ||
          currentState.match.raw !== match.raw
        ) {
          updateMenuState({
            ...currentState,
            target,
            match,
            position: getMentionPosition(target, match),
          });
        }
        return;
      }

      const requestId = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestId;
      activeRecordRequestRef.current = {
        id: requestId,
        targetElement: target.element,
        entityKey: entity.key,
        search: normalizedSearch,
      };
      debugMentionAutocomplete('open-record-menu', {
        requestId,
        entity: entity.key,
        table: entity.table,
        valueField: entity.valueField,
        labelField: entity.labelField,
        search: normalizedSearch,
      });
      const initialHighlightedIndex = options.initialHighlightedIndex ?? -1;
      const initialPosition = options.initialPosition ?? getMentionPosition(target, match);
      recordSelectionBlockedUntilRef.current = options.blockSelectionMs ? Date.now() + options.blockSelectionMs : 0;

      updateMenuState({
        isOpen: true,
        target,
        match,
        mode: 'records',
        entity,
        items: [],
        position: initialPosition,
        isLoading: true,
        emptyMessage: null,
        errorMessage: null,
      });
      setHighlightedIndex(initialHighlightedIndex);
      scheduleRecordMenuPositionRefresh(requestId, target, match, entity);

      if (recordSearchTimerRef.current) {
        debugMentionAutocomplete('clear-record-timer-before-open', {
          nextRequestId: requestId,
          entity: entity.key,
          search: normalizedSearch,
        });
        window.clearTimeout(recordSearchTimerRef.current);
      }
      const loadRecordOptions = () => {
        recordSearchTimerRef.current = null;
        debugMentionAutocomplete('record-timer-fired', {
          requestId,
          entity: entity.key,
          search: normalizedSearch,
        });

        const isCurrentRecordRequest = () => {
          const activeRequest = activeRecordRequestRef.current;
          const currentState = menuStateRef.current;
          const isSameRequest =
            activeRequest?.id === requestId ||
            (activeRequest?.targetElement === target.element &&
              activeRequest.entityKey === entity.key &&
              activeRequest.search === normalizedSearch);

          return (
            isSameRequest &&
            currentState.isOpen &&
            currentState.mode === 'records' &&
            currentState.target?.element === target.element &&
            currentState.entity?.key === entity.key
          );
        };

        const applyRecordOptions = (options: TTemplateDataOption[]) => {
          if (!isCurrentRecordRequest()) {
            debugMentionAutocomplete('stale-record-response', {
              requestId,
              activeRequestId: activeRecordRequestRef.current?.id,
              activeEntity: activeRecordRequestRef.current?.entityKey,
              activeSearch: activeRecordRequestRef.current?.search,
              entity: entity.key,
              search: normalizedSearch,
              optionCount: options.length,
            });
            return;
          }

          debugMentionAutocomplete('apply-record-options', {
            requestId,
            activeRequestId: activeRecordRequestRef.current?.id,
            entity: entity.key,
            search: normalizedSearch,
            optionCount: options.length,
          });

          const currentRecordState = menuStateRef.current;
          const position =
            currentRecordState.isOpen &&
            currentRecordState.mode === 'records' &&
            currentRecordState.target?.element === target.element &&
            currentRecordState.entity?.key === entity.key
              ? currentRecordState.position
              : getMentionPosition(target, match);

          updateMenuState({
            isOpen: true,
            target,
            match,
            mode: 'records',
            entity,
            items: options.map((option) => ({ type: 'record', entity, option })),
            position,
            isLoading: false,
            emptyMessage: null,
            errorMessage: null,
          });
          setHighlightedIndex(initialHighlightedIndex);
        };

        debugMentionAutocomplete('fetch-record-options-start', {
          requestId,
          entity: entity.key,
          table: entity.table,
          valueField: entity.valueField,
          labelField: entity.labelField,
          search: normalizedSearch,
        });

        void fetchMentionRecordOptions(entity, normalizedSearch)
          .then((options) => {
            debugMentionAutocomplete('fetch-record-options-resolved', {
              requestId,
              entity: entity.key,
              search: normalizedSearch,
              optionCount: options.length,
            });
            applyRecordOptions(options);
          })
          .catch((error) => {
            debugMentionAutocomplete('fetch-record-options-error', {
              requestId,
              activeRequestId: activeRecordRequestRef.current?.id,
              entity: entity.key,
              search: normalizedSearch,
              error: error instanceof Error ? error.message : String(error),
            });

            if (!isCurrentRecordRequest()) {
              return;
            }

            const currentRecordState = menuStateRef.current;
            const position =
              currentRecordState.isOpen &&
              currentRecordState.mode === 'records' &&
              currentRecordState.target?.element === target.element &&
              currentRecordState.entity?.key === entity.key
                ? currentRecordState.position
                : getMentionPosition(target, match);

            updateMenuState({
              isOpen: true,
              target,
              match,
              mode: 'records',
              entity,
              items: [],
              position,
              isLoading: false,
              emptyMessage: null,
              errorMessage: 'Không tải được dữ liệu. Gõ thêm từ khóa hoặc thử lại.',
            });
          });
      };

      if (normalizedSearch) {
        recordSearchTimerRef.current = window.setTimeout(loadRecordOptions, 180);
        return;
      }

      loadRecordOptions();
    },
    [scheduleRecordMenuPositionRefresh, updateMenuState],
  );

  const updateFromElement = useCallback(
    (target: TMentionTarget | null) => {
      if (!target) {
        closeMenu();
        return;
      }

      const match = getMentionMatch(target);
      if (!match) {
        closeMenu();
        return;
      }

      const currentState = menuStateRef.current;
      if (
        currentState.isOpen &&
        currentState.target?.element === target.element &&
        currentState.match?.start === match.start &&
        currentState.match.end === match.end &&
        currentState.match.raw === match.raw
      ) {
        return;
      }

      const lockedRecordEntity =
        currentState.isOpen &&
        currentState.mode === 'records' &&
        currentState.entity &&
        currentState.target?.element === target.element &&
        currentState.match?.start === match.start
          ? currentState.entity
          : null;

      if (lockedRecordEntity && !getMentionEntityByAlias(match.keyword)) {
        openRecordMenu(target, match, lockedRecordEntity, match.raw.trim());
        return;
      }

      const exactEntity = match.keyword ? getMentionEntityByAlias(match.keyword) : null;
      const entityItems = getEntityItems(match.keyword);
      const normalizedKeywordLength = normalizeMentionText(match.keyword).length;
      const shouldShowEntities = !exactEntity && (entityItems.length > 0 || normalizedKeywordLength < 2);

      if (shouldShowEntities) {
        openEntityMenu(target, match);
        return;
      }

      const recordMode = getRecordModeEntity(match);
      if (!recordMode) {
        closeMenu();
        return;
      }

      openRecordMenu(target, match, recordMode.entity, recordMode.search);
    },
    [closeMenu, openEntityMenu, openRecordMenu],
  );

  const selectItem = useCallback(
    (item: TMentionItem) => {
      const currentState = menuStateRef.current;
      const target = currentState.target;
      const match = currentState.match;
      if (!target || !match) {
        closeMenu();
        return;
      }

      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      suppressBlurCloseRef.current = true;
      window.setTimeout(() => {
        suppressBlurCloseRef.current = false;
      }, 300);

      if (item.type === 'entity') {
        const initialPosition = currentState.position;
        const alias = getPreferredAlias(item.entity);
        const nextMatch =
          replaceMentionText(target, match, `@${alias} `) ??
          ({
            start: match.start,
            end: match.start + alias.length + 2,
            raw: `${alias} `,
            keyword: alias,
            query: '',
            hasQuerySeparator: true,
          } satisfies TMentionMatch);

        if (shouldLoadDefaultRecordOptions(item.entity)) {
          openRecordMenu(target, nextMatch, item.entity, '', {
            blockSelectionMs: 300,
            initialHighlightedIndex: -1,
            initialPosition,
          });
          return;
        }

        requestSequenceRef.current += 1;
        activeRecordRequestRef.current = null;
        updateMenuState({
          isOpen: true,
          target,
          match: nextMatch,
          mode: 'records',
          entity: item.entity,
          items: [],
          position: initialPosition,
          isLoading: false,
          emptyMessage: `Gõ từ khóa để tìm ${item.entity.label}.`,
          errorMessage: null,
        });
        setHighlightedIndex(-1);
        return;
      }

      if (Date.now() < recordSelectionBlockedUntilRef.current) {
        return;
      }

      replaceMentionText(target, match, `${getMentionRecordInsertText(item.entity, item.option)} `);
      closeMenu();
    },
    [closeMenu, openRecordMenu, updateMenuState],
  );

  const handleDocumentKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const currentState = menuStateRef.current;
      if (!currentState.isOpen) {
        return;
      }

      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
        return;
      }

      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (currentState.isLoading || currentState.items.length === 0) {
        event.preventDefault();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((currentIndex) => (currentIndex < 0 ? 0 : (currentIndex + 1) % currentState.items.length));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((currentIndex) =>
          currentIndex < 0
            ? currentState.items.length - 1
            : (currentIndex - 1 + currentState.items.length) % currentState.items.length,
        );
        return;
      }

      if (highlightedIndex < 0) {
        event.preventDefault();
        closeMenu();
        return;
      }

      event.preventDefault();
      selectItem(currentState.items[highlightedIndex] ?? currentState.items[0]);
    },
    [closeMenu, highlightedIndex, selectItem],
  );

  useEffect(() => {
    menuStateRef.current = menuState;
  }, [menuState]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!menuState.isOpen) {
      document.body.classList.remove('mention-autocomplete-open');
      return;
    }

    document.body.classList.add('mention-autocomplete-open');

    return () => {
      document.body.classList.remove('mention-autocomplete-open');
    };
  }, [menuState.isOpen]);

  useEffect(() => {
    const handleInput = (event: Event) => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      updateFromElement(getMentionTargetFromEvent(event));
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const target = getMentionTargetFromEvent(event);
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        return;
      }

      updateFromElement(target);
    };

    const handleFocus = (event: FocusEvent) => {
      if (isMentionOverlayEventTarget(event.target)) {
        return;
      }

      updateFromElement(getMentionTargetFromEvent(event));
    };

    const handlePointer = (event: MouseEvent) => {
      if (isMentionOverlayEventTarget(event.target)) {
        return;
      }

      const target = getMentionTargetFromEvent(event);
      if (target) {
        window.setTimeout(() => updateFromElement(target), 0);
        return;
      }

      if (menuStateRef.current.isOpen) {
        closeMenu();
      }
    };

    const handleBlur = () => {
      if (suppressBlurCloseRef.current) {
        debugMentionAutocomplete('blur-close-suppressed', {
          activeRequestId: activeRecordRequestRef.current?.id,
          activeEntity: activeRecordRequestRef.current?.entityKey,
        });
        return;
      }

      closeTimerRef.current = window.setTimeout(() => closeMenu(), 150);
    };

    const handleViewportChange = () => {
      const currentState = menuStateRef.current;
      if (!currentState.isOpen || !currentState.target) {
        return;
      }

      updateMenuState({
        ...currentState,
        position: getMentionPosition(currentState.target, currentState.match ?? undefined),
      });
    };

    const handleSelectionChange = () => {
      if (!menuStateRef.current.isOpen) {
        return;
      }

      if (selectionChangeRafRef.current !== null) {
        return;
      }

      selectionChangeRafRef.current = window.requestAnimationFrame(() => {
        selectionChangeRafRef.current = null;
        const target = getActiveMentionTarget();
        if (target?.kind === 'rich-text') {
          updateFromElement(target);
        }
      });
    };

    document.addEventListener('input', handleInput, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('click', handlePointer, true);
    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('focusout', handleBlur, true);
    document.addEventListener('keydown', handleDocumentKeyDown, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('click', handlePointer, true);
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('focusout', handleBlur, true);
      document.removeEventListener('keydown', handleDocumentKeyDown, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);

      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }

      if (recordSearchTimerRef.current) {
        window.clearTimeout(recordSearchTimerRef.current);
      }

      if (selectionChangeRafRef.current !== null) {
        window.cancelAnimationFrame(selectionChangeRafRef.current);
      }

      if (recordPositionRafRef.current !== null) {
        window.cancelAnimationFrame(recordPositionRafRef.current);
      }
    };
  }, [closeMenu, handleDocumentKeyDown, updateFromElement, updateMenuState]);

  const menuStyle = useMemo<CSSProperties>(
    () => ({
      top: menuState.position.top,
      left: menuState.position.left,
      width: menuState.position.width,
    }),
    [menuState.position.left, menuState.position.top, menuState.position.width],
  );

  if (!isMounted) {
    return null;
  }

  return createPortal(
    <>
      {menuState.isOpen ? (
        <div
          style={menuStyle}
          className="fixed z-[2147483647] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
          data-mention-autocomplete>
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {menuState.mode === 'records' && menuState.entity ? menuState.entity.label : 'Chọn nguồn dữ liệu'}
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {menuState.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải dữ liệu...
              </div>
            ) : null}
            {!menuState.isLoading && menuState.errorMessage ? (
              <div className="px-3 py-4 text-sm text-red-600">{menuState.errorMessage}</div>
            ) : null}
            {!menuState.isLoading && !menuState.errorMessage && menuState.emptyMessage ? (
              <div className="px-3 py-4 text-sm text-slate-500">{menuState.emptyMessage}</div>
            ) : null}
            {!menuState.isLoading &&
            !menuState.errorMessage &&
            !menuState.emptyMessage &&
            menuState.items.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500">Không tìm thấy dữ liệu phù hợp.</div>
            ) : null}
            {!menuState.isLoading
              ? menuState.items.map((item, index) => {
                  const isHighlighted = index === highlightedIndex;

                  if (item.type === 'entity') {
                    return (
                      <button
                        key={item.entity.key}
                        type="button"
                        className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition ${
                          isHighlighted ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectItem(item);
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}>
                        <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                          @{getPreferredAlias(item.entity)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{item.entity.label}</span>
                          {item.entity.description ? (
                            <span className="block truncate text-xs text-slate-500">{item.entity.description}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <div
                      key={`${item.entity.key}-${item.option.id}-${item.option.value}-${item.option.label}`}
                      className={`flex w-full items-stretch rounded-md transition ${
                        isHighlighted ? 'bg-blue-50 text-blue-700' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                      onMouseEnter={() => setHighlightedIndex(index)}>
                      <button
                        type="button"
                        className="min-w-0 flex-1 px-3 py-2 text-left"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectItem(item);
                        }}>
                        <span className="block truncate text-sm font-semibold">
                          {formatMentionRecordOptionLabel(item.entity, item.option)}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {getMentionRecordDetailText(item.entity, item.option)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`flex shrink-0 items-center justify-center border-l border-slate-200 px-3 text-slate-400 transition ${
                          isHighlighted ? 'text-blue-700' : 'hover:text-blue-700'
                        }`}
                        title="Tùy biến hiển thị"
                        aria-label="Tùy biến hiển thị"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openRecordFormatModal(item);
                        }}>
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              : null}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            Gõ <span className="font-mono">@nganh</span>, <span className="font-mono">@khoa</span>,{' '}
            <span className="font-mono">@giangvien</span> hoặc nhập trực tiếp{' '}
            <span className="font-mono">@Nguyễn Văn</span>.
          </div>
        </div>
      ) : null}

      {formatModalState ? (
        <div
          className="fixed inset-0 z-[2147483647] bg-slate-950/40 px-4 py-6"
          data-mention-format-modal
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRecordFormatModal();
            }
          }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Tùy biến hiển thị ${formatModalState.item.entity.label}`}
            className="mx-auto flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{formatModalState.item.entity.label}</div>
                <div className="text-xs text-slate-500">{t('mentionAutocomplete.recordFormat.description')}</div>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
                onClick={closeRecordFormatModal}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</div>
                <div className="mt-1 text-sm text-slate-900">
                  {formatPreviewText.trim() ? formatPreviewText : 'Chưa chọn trường nào'}
                </div>
              </div>

              <div className="max-h-[calc(90vh-196px)] overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="w-14 px-4 py-3">{t('mentionAutocomplete.recordFormat.dragColumn')}</th>
                      <th className="w-16 px-2 py-3">Chọn</th>
                      <th className="px-4 py-3">Trường</th>
                      <th className="px-4 py-3">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const fieldMap = new Map(formatModalState.fields.map((f) => [f.key, f]));
                      const selected = formatSelectedKeys
                        .map((key) => fieldMap.get(key))
                        .filter((f): f is TMentionRecordFormatField => Boolean(f));
                      const unselected = formatModalState.fields.filter((f) => !formatSelectedKeys.includes(f.key));
                      return [...selected, ...unselected];
                    })().map((field) => {
                      const isSelected = formatSelectedKeys.includes(field.key);
                      const isDragging = formatDraggedKey === field.key;

                      return (
                        <tr
                          key={field.key}
                          className={`border-b border-slate-100 transition ${
                            isSelected ? 'bg-white' : 'bg-slate-50/40'
                          } ${isDragging ? 'opacity-50' : ''}`}
                          draggable={isSelected}
                          onDragStart={(event) => {
                            if (!isSelected) {
                              event.preventDefault();
                              return;
                            }

                            setFormatDraggedKey(field.key);
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', field.key);
                          }}
                          onDragOver={(event) => {
                            if (!isSelected || !formatDraggedKey) {
                              return;
                            }

                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleRecordFormatFieldDrop(field.key);
                          }}
                          onDragEnd={() => {
                            setFormatDraggedKey(null);
                          }}>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className={`flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-400 transition ${
                                isSelected ? 'cursor-grab hover:border-slate-300 hover:text-slate-700' : 'opacity-40'
                              }`}
                              aria-label={t('mentionAutocomplete.recordFormat.dragFieldAria', { field: field.label })}
                              title={
                                isSelected
                                  ? t('mentionAutocomplete.recordFormat.dragToReorder')
                                  : t('mentionAutocomplete.recordFormat.selectBeforeDrag')
                              }
                              disabled={!isSelected}>
                              <GripVertical className="h-4 w-4" />
                            </button>
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) => handleRecordFormatFieldToggle(field.key, event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{field.label}</td>
                          <td className="px-4 py-3 text-slate-600">{field.value}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
              <div className="text-xs text-slate-500">
                {formatSelectedKeys.length > 0
                  ? `${formatSelectedKeys.length} trường đã chọn`
                  : 'Chọn ít nhất một trường để chèn'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={closeRecordFormatModal}>
                  Hủy
                </button>
                <button
                  type="button"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!formatPreviewText.trim()}
                  onClick={handleRecordFormatSubmit}>
                  Chèn
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
};
