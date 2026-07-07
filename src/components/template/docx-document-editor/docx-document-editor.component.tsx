import { DocxEditor, type DocxEditorRef } from '@eigenpal/docx-js-editor';
import '@eigenpal/docx-js-editor/styles.css';
import type { EditorView } from 'prosemirror-view';

import {
  forwardRef,
  type CSSProperties,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { convertDocxToPdfAPI } from 'api';
import {
  createWordDocumentBuffer,
  ensureDocxPageNumberFooter,
  ensureDocxTableBorders,
  ensureDocxTableCellStyles,
  exportToPdf,
  getVariablePickerItems,
  registerMentionRichTextEditorAdapter,
  saveFile,
  type IMentionRichTextEditorAdapter,
  type IVariablePickerItem,
} from '../../../lib';
import type { IDocxDocumentEditorHandle, IDocxDocumentEditorProps } from './docx-document-editor.type';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_EDITOR_FONT_FAMILIES = [
  {
    name: 'Times New Roman',
    fontFamily: '"Times New Roman", Tinos, "Liberation Serif", serif',
    category: 'serif' as const,
  },
  {
    name: 'Arial',
    fontFamily: 'Arial, Arimo, "Liberation Sans", sans-serif',
    category: 'sans-serif' as const,
  },
  {
    name: 'Courier New',
    fontFamily: '"Courier New", Cousine, "Liberation Mono", monospace',
    category: 'monospace' as const,
  },
  {
    name: 'Calibri',
    fontFamily: 'Calibri, Carlito, Arial, Arimo, sans-serif',
    category: 'sans-serif' as const,
  },
  {
    name: 'Cambria',
    fontFamily: 'Cambria, Caladea, "Times New Roman", Tinos, serif',
    category: 'serif' as const,
  },
] as const;

type TDocxVariableAutocompletePosition = {
  top: number;
  left: number;
  width: number;
};

type TDocxAnchorRect = Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'>;

type TDocxVariableAutocompleteState = {
  isOpen: boolean;
  query: string;
  replaceLength: number;
  replaceFrom: number;
  replaceTo: number;
  items: IVariablePickerItem[];
  position: TDocxVariableAutocompletePosition;
};

const DOCX_VARIABLE_TRIGGER = '{{';
const DOCX_VARIABLE_MAX_QUERY_LENGTH = 80;
const DOCX_VARIABLE_MAX_ITEMS = 12;
const DOCX_VARIABLE_LOOK_BEHIND = 160;
const DOCX_VARIABLE_MENU_WIDTH = 420;
const EMPTY_DOCX_VARIABLE_AUTOCOMPLETE: TDocxVariableAutocompleteState = {
  isOpen: false,
  query: '',
  replaceLength: 0,
  replaceFrom: 0,
  replaceTo: 0,
  items: [],
  position: { top: 0, left: 0, width: DOCX_VARIABLE_MENU_WIDTH },
};

const ensureDocxFileName = (fileName: string | undefined) => {
  const normalizedName = fileName?.trim() || 'document.docx';
  return normalizedName.toLowerCase().endsWith('.docx') ? normalizedName : `${normalizedName}.docx`;
};

const getPdfFileName = (docxFileName: string) => docxFileName.replace(/\.docx$/i, '.pdf');

const isUsableDocxAnchorRect = (rect: TDocxAnchorRect | null | undefined): rect is TDocxAnchorRect => {
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

const createDocxAnchorRect = (rect: TDocxAnchorRect, overrides?: Partial<TDocxAnchorRect>): TDocxAnchorRect => ({
  bottom: overrides?.bottom ?? rect.bottom,
  height: overrides?.height ?? rect.height,
  left: overrides?.left ?? rect.left,
  right: overrides?.right ?? rect.right,
  top: overrides?.top ?? rect.top,
  width: overrides?.width ?? rect.width,
});

const getDocxRangeClientRect = (range: Range): TDocxAnchorRect | null => {
  const rect = range.getBoundingClientRect();
  if (isUsableDocxAnchorRect(rect)) {
    return rect;
  }

  const clientRect = Array.from(range.getClientRects()).find(isUsableDocxAnchorRect);
  return clientRect ?? null;
};

const getDocxTextNodeCaretProbeRect = (range: Range): TDocxAnchorRect | null => {
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
    const rect = getDocxRangeClientRect(probeRange);
    if (rect) {
      return createDocxAnchorRect(rect, {
        left: rect.right,
        width: 0,
      });
    }
  }

  if (caretOffset < text.length) {
    probeRange.setStart(container, caretOffset);
    probeRange.setEnd(container, caretOffset + 1);
    const rect = getDocxRangeClientRect(probeRange);
    if (rect) {
      return createDocxAnchorRect(rect, {
        right: rect.left,
        width: 0,
      });
    }
  }

  return null;
};

const getFirstTextNode = (node: Node | null): Text | null => {
  if (!node) {
    return null;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? (node as Text) : null;
  }

  for (const child of Array.from(node.childNodes)) {
    const textNode = getFirstTextNode(child);
    if (textNode) {
      return textNode;
    }
  }

  return null;
};

const getLastTextNode = (node: Node | null): Text | null => {
  if (!node) {
    return null;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? (node as Text) : null;
  }

  const children = Array.from(node.childNodes);
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const textNode = getLastTextNode(children[index] ?? null);
    if (textNode) {
      return textNode;
    }
  }

  return null;
};

const getAdjacentTextNode = (node: Node, direction: 'previous' | 'next', root: Node): Text | null => {
  let current: Node | null = node;

  while (current && current !== root) {
    let sibling = direction === 'previous' ? current.previousSibling : current.nextSibling;
    while (sibling) {
      const textNode = direction === 'previous' ? getLastTextNode(sibling) : getFirstTextNode(sibling);
      if (textNode) {
        return textNode;
      }

      sibling = direction === 'previous' ? sibling.previousSibling : sibling.nextSibling;
    }

    current = current.parentNode;
  }

  return null;
};

const getDocxTextNodeProbeRect = (textNode: Text, offset: number, edge: 'left' | 'right'): TDocxAnchorRect | null => {
  const textLength = textNode.textContent?.length ?? 0;
  if (textLength === 0) {
    return null;
  }

  const range = textNode.ownerDocument.createRange();
  const start =
    edge === 'right'
      ? Math.max(0, Math.min(offset - 1, textLength - 1))
      : Math.max(0, Math.min(offset, textLength - 1));
  range.setStart(textNode, start);
  range.setEnd(textNode, start + 1);
  const rect = getDocxRangeClientRect(range);
  if (!rect) {
    return null;
  }

  return createDocxAnchorRect(rect, edge === 'right' ? { left: rect.right, width: 0 } : { right: rect.left, width: 0 });
};

const getDocxDomPositionProbeRect = (node: Node, offset: number, root: Node): TDocxAnchorRect | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    return (
      getDocxTextNodeProbeRect(textNode, offset, 'right') ??
      getDocxTextNodeProbeRect(textNode, offset, 'left') ??
      getDocxTextNodeProbeRect(
        getAdjacentTextNode(textNode, 'previous', root) ?? textNode,
        Number.MAX_SAFE_INTEGER,
        'right',
      ) ??
      getDocxTextNodeProbeRect(getAdjacentTextNode(textNode, 'next', root) ?? textNode, 0, 'left')
    );
  }

  const childNodes = Array.from(node.childNodes);
  const previousTextNode =
    getLastTextNode(childNodes[Math.max(0, offset - 1)] ?? null) ?? getAdjacentTextNode(node, 'previous', root);
  const nextTextNode = getFirstTextNode(childNodes[offset] ?? null) ?? getAdjacentTextNode(node, 'next', root);

  return (
    (previousTextNode
      ? getDocxTextNodeProbeRect(previousTextNode, previousTextNode.textContent?.length ?? 0, 'right')
      : null) ?? (nextTextNode ? getDocxTextNodeProbeRect(nextTextNode, 0, 'left') : null)
  );
};

const countTextOccurrences = (text: string, searchText: string) => {
  if (!searchText) {
    return 0;
  }

  let count = 0;
  let index = text.indexOf(searchText);
  while (index >= 0) {
    count += 1;
    index = text.indexOf(searchText, index + searchText.length);
  }

  return count;
};

const getDocxMarkerOccurrenceIndex = (view: EditorView, markerText: string) => {
  const textBeforeCaret = view.state.doc.textBetween(0, view.state.selection.from, '\n', '\0');
  return countTextOccurrences(textBeforeCaret, markerText);
};

const getDocxMarkerRectFromTextNode = (textNode: Text, markerIndex: number, markerText: string) => {
  const markerEnd = markerIndex + markerText.length;
  return getDocxTextNodeProbeRect(textNode, markerEnd, 'right');
};

const getDocxMarkerAnchorRect = (
  view: EditorView,
  markerText?: string,
  rootElement: HTMLElement = view.dom,
): TDocxAnchorRect | null => {
  const normalizedMarker = markerText?.trim();
  if (!normalizedMarker) {
    return null;
  }

  const targetOccurrenceIndex = getDocxMarkerOccurrenceIndex(view, normalizedMarker);
  if (targetOccurrenceIndex <= 0) {
    return null;
  }

  const textNodes: Text[] = [];
  const treeWalker = view.dom.ownerDocument.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
  let currentNode = treeWalker.nextNode();
  while (currentNode) {
    if (currentNode.textContent?.includes(normalizedMarker)) {
      textNodes.push(currentNode as Text);
    }
    currentNode = treeWalker.nextNode();
  }

  let occurrenceIndex = 0;
  let lastVisibleRect: TDocxAnchorRect | null = null;
  for (const textNode of textNodes) {
    const text = textNode.textContent ?? '';
    let markerIndex = text.indexOf(normalizedMarker);
    while (markerIndex >= 0) {
      occurrenceIndex += 1;
      const rect = getDocxMarkerRectFromTextNode(textNode, markerIndex, normalizedMarker);
      if (isDocxAnchorRectNearEditor(view, rect, rootElement)) {
        lastVisibleRect = rect;
      }

      if (occurrenceIndex === targetOccurrenceIndex && rect) {
        return rect;
      }

      markerIndex = text.indexOf(normalizedMarker, markerIndex + normalizedMarker.length);
    }
  }

  return lastVisibleRect;
};

function isDocxAnchorRectNearEditor(
  view: EditorView,
  rect: TDocxAnchorRect | null | undefined,
  rootElement: HTMLElement = view.dom,
) {
  if (!isUsableDocxAnchorRect(rect)) {
    return false;
  }

  const editorRect = rootElement.getBoundingClientRect();
  if (!isUsableDocxAnchorRect(editorRect)) {
    return true;
  }

  const tolerance = 48;
  return (
    rect.left >= editorRect.left - tolerance &&
    rect.left <= editorRect.right + tolerance &&
    rect.top >= editorRect.top - tolerance &&
    rect.top <= editorRect.bottom + tolerance
  );
}

const getDocxDomSelectionRect = (view: EditorView, rootElement: HTMLElement = view.dom): TDocxAnchorRect | null => {
  const selection = view.dom.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!rootElement.contains(range.startContainer) || !rootElement.contains(range.endContainer)) {
    return null;
  }

  const rect = getDocxRangeClientRect(range) ?? getDocxTextNodeCaretProbeRect(range);
  return isDocxAnchorRectNearEditor(view, rect, rootElement) ? rect : null;
};

const getDocxDomAtPosRect = (view: EditorView, rootElement: HTMLElement = view.dom): TDocxAnchorRect | null => {
  try {
    const { node, offset } = view.domAtPos(view.state.selection.from);
    const range = view.dom.ownerDocument.createRange();
    const maxOffset = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').length : node.childNodes.length;
    range.setStart(node, Math.max(0, Math.min(offset, maxOffset)));
    range.collapse(true);

    const rect =
      getDocxDomPositionProbeRect(node, offset, view.dom) ??
      getDocxRangeClientRect(range) ??
      getDocxTextNodeCaretProbeRect(range);

    return isDocxAnchorRectNearEditor(view, rect, rootElement) ? rect : null;
  } catch {
    return null;
  }
};

const getDocxCoordsAtPosRect = (view: EditorView, rootElement: HTMLElement = view.dom): TDocxAnchorRect | null => {
  try {
    const coords = view.coordsAtPos(view.state.selection.from);

    const rect = {
      bottom: coords.bottom,
      height: Math.max(0, coords.bottom - coords.top),
      left: coords.left,
      right: coords.right,
      top: coords.top,
      width: Math.max(0, coords.right - coords.left),
    };

    return isDocxAnchorRectNearEditor(view, rect, rootElement) ? rect : null;
  } catch {
    return null;
  }
};

const getDocxSelectionAnchorRect = (view: EditorView, markerText?: string, rootElement: HTMLElement = view.dom) =>
  getDocxMarkerAnchorRect(view, markerText, rootElement) ??
  getDocxDomAtPosRect(view, rootElement) ??
  getDocxDomSelectionRect(view, rootElement) ??
  getDocxCoordsAtPosRect(view, rootElement);

const clampDocxVariableMenuPosition = (
  view: EditorView,
  markerText?: string,
  rootElement?: HTMLElement | null,
): TDocxVariableAutocompletePosition => {
  const rect = getDocxSelectionAnchorRect(view, markerText, rootElement ?? view.dom);
  const width = Math.min(DOCX_VARIABLE_MENU_WIDTH, Math.max(320, window.innerWidth - 24));
  if (!rect) {
    return { top: 12, left: 12, width };
  }

  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12);
  const topBelow = rect.bottom + 8;
  const top = topBelow > window.innerHeight - 160 ? Math.max(12, rect.top - 330) : topBelow;

  return { top, left, width };
};

const getDocxVariableAutocompleteMatch = (view: EditorView) => {
  const { from, to } = view.state.selection;
  if (from !== to) {
    return null;
  }

  const lookBehindStart = Math.max(0, from - DOCX_VARIABLE_LOOK_BEHIND);
  const textBeforeCaret = view.state.doc.textBetween(lookBehindStart, from, '\n', '\0');
  const triggerIndex = textBeforeCaret.lastIndexOf(DOCX_VARIABLE_TRIGGER);
  if (triggerIndex < 0) {
    return null;
  }

  const query = textBeforeCaret.slice(triggerIndex + DOCX_VARIABLE_TRIGGER.length);
  if (query.length > DOCX_VARIABLE_MAX_QUERY_LENGTH || /[\n\r{}]/.test(query)) {
    return null;
  }

  return {
    query,
    replaceLength: DOCX_VARIABLE_TRIGGER.length + query.length,
  };
};

const areDocxVariableItemsEqual = (leftItems: IVariablePickerItem[], rightItems: IVariablePickerItem[]) =>
  leftItems.length === rightItems.length && leftItems.every((item, index) => item.key === rightItems[index]?.key);

const shouldUpdateDocxVariableAutocomplete = (
  currentState: TDocxVariableAutocompleteState,
  nextState: TDocxVariableAutocompleteState,
) => {
  if (currentState.isOpen !== nextState.isOpen) return true;
  if (!nextState.isOpen) return currentState.isOpen;
  if (currentState.query !== nextState.query) return true;
  if (currentState.replaceLength !== nextState.replaceLength) return true;
  if (currentState.replaceFrom !== nextState.replaceFrom || currentState.replaceTo !== nextState.replaceTo) return true;
  if (Math.abs(currentState.position.top - nextState.position.top) > 1) return true;
  if (Math.abs(currentState.position.left - nextState.position.left) > 1) return true;
  if (currentState.position.width !== nextState.position.width) return true;
  return !areDocxVariableItemsEqual(currentState.items, nextState.items);
};

export const DocxDocumentEditor = forwardRef<IDocxDocumentEditorHandle, IDocxDocumentEditorProps>(
  (
    {
      htmlContent,
      initialDocumentBuffer,
      sourceKey = 'default',
      fileName,
      readOnly = false,
      className = '',
      variableCatalog,
      template_type,
      onError,
      onBufferChange,
      onReadyChange,
      onDirtyChange,
    },
    ref,
  ) => {
    const editorRef = useRef<DocxEditorRef | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const generationIdRef = useRef(0);
    const htmlContentRef = useRef(htmlContent);
    const initialDocumentBufferRef = useRef(initialDocumentBuffer);
    const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const hasUserInteractedSinceLoadRef = useRef(false);
    const documentName = useMemo(() => ensureDocxFileName(fileName), [fileName]);
    const onErrorRef = useRef(onError);
    const onBufferChangeRef = useRef(onBufferChange);
    const onReadyChangeRef = useRef(onReadyChange);
    const onDirtyChangeRef = useRef(onDirtyChange);
    const readOnlyRef = useRef(readOnly);
    const mentionAdapterCleanupRef = useRef<(() => void) | null>(null);
    const variableAutocompleteRafRef = useRef<number | null>(null);
    const [editorDom, setEditorDom] = useState<HTMLElement | null>(null);
    const [variableAutocomplete, setVariableAutocomplete] = useState<TDocxVariableAutocompleteState>(
      EMPTY_DOCX_VARIABLE_AUTOCOMPLETE,
    );
    const variableAutocompleteRef = useRef(variableAutocomplete);
    const [highlightedVariableIndex, setHighlightedVariableIndex] = useState(0);
    const highlightedVariableIndexRef = useRef(0);

    onErrorRef.current = onError;
    onBufferChangeRef.current = onBufferChange;
    onReadyChangeRef.current = onReadyChange;
    onDirtyChangeRef.current = onDirtyChange;
    readOnlyRef.current = readOnly;
    htmlContentRef.current = htmlContent;
    initialDocumentBufferRef.current = initialDocumentBuffer;

    const updateVariableAutocomplete = useCallback((nextState: TDocxVariableAutocompleteState) => {
      if (!shouldUpdateDocxVariableAutocomplete(variableAutocompleteRef.current, nextState)) {
        return;
      }

      variableAutocompleteRef.current = nextState;
      setVariableAutocomplete(nextState);
    }, []);

    const closeVariableAutocomplete = useCallback(() => {
      updateVariableAutocomplete(EMPTY_DOCX_VARIABLE_AUTOCOMPLETE);
      highlightedVariableIndexRef.current = 0;
      setHighlightedVariableIndex(0);
    }, [updateVariableAutocomplete]);

    const updateHighlightedVariableIndex = useCallback((updater: (currentIndex: number) => number) => {
      const nextIndex = updater(highlightedVariableIndexRef.current);
      highlightedVariableIndexRef.current = nextIndex;
      setHighlightedVariableIndex(nextIndex);
    }, []);

    const markDirty = useCallback(() => {
      if (!hasUserInteractedSinceLoadRef.current) {
        return;
      }

      setDirty(true);
      onDirtyChangeRef.current?.(true);
    }, []);

    const getCurrentEditorView = useCallback(() => editorRef.current?.getEditorRef()?.getView() ?? null, []);

    const insertTextAtRange = useCallback(
      (text: string, from: number, to: number) => {
        if (readOnlyRef.current || !text) {
          return false;
        }

        const view = getCurrentEditorView();
        if (!view) {
          return false;
        }

        try {
          const transaction = view.state.tr.insertText(text, from, to).scrollIntoView();
          view.dispatch(transaction);
          view.focus();
          markDirty();
          closeVariableAutocomplete();
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Cannot insert text into DOCX editor.';
          onErrorRef.current?.(message);
          return false;
        }
      },
      [closeVariableAutocomplete, getCurrentEditorView, markDirty],
    );

    const insertText = useCallback(
      (text: string, replaceLength = 0) => {
        const view = getCurrentEditorView();
        if (!view) {
          return false;
        }

        const { from, to } = view.state.selection;
        return insertTextAtRange(text, Math.max(0, from - Math.max(0, replaceLength)), to);
      },
      [getCurrentEditorView, insertTextAtRange],
    );

    const getSelectionRect = useCallback(
      (payload?: { markerText?: string }) => {
        const view = getCurrentEditorView();
        if (!view) {
          return null;
        }

        return getDocxSelectionAnchorRect(view, payload?.markerText, containerRef.current ?? view.dom);
      },
      [getCurrentEditorView],
    );

    const refreshVariableAutocomplete = useCallback(() => {
      if (readOnlyRef.current) {
        closeVariableAutocomplete();
        return;
      }

      const view = getCurrentEditorView();
      if (!view) {
        closeVariableAutocomplete();
        return;
      }

      const match = getDocxVariableAutocompleteMatch(view);
      if (!match) {
        closeVariableAutocomplete();
        return;
      }

      const catalog = variableCatalog && Object.keys(variableCatalog).length > 0 ? variableCatalog : undefined;
      const items = getVariablePickerItems(match.query, catalog, { template_type }).slice(0, DOCX_VARIABLE_MAX_ITEMS);
      const replaceTo = view.state.selection.from;
      const nextState: TDocxVariableAutocompleteState = {
        isOpen: true,
        query: match.query,
        replaceLength: match.replaceLength,
        replaceFrom: Math.max(0, replaceTo - match.replaceLength),
        replaceTo,
        items,
        position: clampDocxVariableMenuPosition(view, `${DOCX_VARIABLE_TRIGGER}${match.query}`, containerRef.current),
      };

      updateVariableAutocomplete(nextState);
      const nextHighlightedIndex =
        items.length === 0 ? -1 : Math.min(highlightedVariableIndexRef.current, items.length - 1);
      if (nextHighlightedIndex !== highlightedVariableIndexRef.current) {
        highlightedVariableIndexRef.current = nextHighlightedIndex;
        setHighlightedVariableIndex(nextHighlightedIndex);
      }
    }, [closeVariableAutocomplete, getCurrentEditorView, template_type, updateVariableAutocomplete, variableCatalog]);

    const scheduleVariableAutocompleteRefresh = useCallback(() => {
      if (variableAutocompleteRafRef.current !== null) {
        return;
      }

      variableAutocompleteRafRef.current = window.requestAnimationFrame(() => {
        variableAutocompleteRafRef.current = null;
        refreshVariableAutocomplete();
      });
    }, [refreshVariableAutocomplete]);

    const selectVariableAutocompleteItem = useCallback(
      (item: IVariablePickerItem | undefined) => {
        const currentState = variableAutocompleteRef.current;
        if (!item || !currentState.isOpen) {
          return;
        }

        insertTextAtRange(item.token, currentState.replaceFrom, currentState.replaceTo);
      },
      [insertTextAtRange],
    );

    const handleVariableAutocompleteKeyDown = useCallback(
      (event: KeyboardEvent) => {
        const currentState = variableAutocompleteRef.current;
        if (!currentState.isOpen || !['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.key === 'Escape') {
          closeVariableAutocomplete();
          return;
        }

        if (currentState.items.length === 0) {
          return;
        }

        if (event.key === 'ArrowDown') {
          updateHighlightedVariableIndex((currentIndex) =>
            currentIndex < 0 ? 0 : (currentIndex + 1) % currentState.items.length,
          );
          return;
        }

        if (event.key === 'ArrowUp') {
          updateHighlightedVariableIndex((currentIndex) =>
            currentIndex < 0
              ? currentState.items.length - 1
              : (currentIndex - 1 + currentState.items.length) % currentState.items.length,
          );
          return;
        }

        selectVariableAutocompleteItem(
          currentState.items[highlightedVariableIndexRef.current] ?? currentState.items[0],
        );
      },
      [closeVariableAutocomplete, selectVariableAutocompleteItem, updateHighlightedVariableIndex],
    );

    const handleEditorViewReady = useCallback(
      (view: EditorView) => {
        mentionAdapterCleanupRef.current?.();
        const adapter: IMentionRichTextEditorAdapter = {
          replaceMentionText: ({ replacement, replaceLength }) => insertText(replacement, replaceLength),
          getSelectionRect,
        };
        const cleanups = [registerMentionRichTextEditorAdapter(view.dom, adapter)];
        if (containerRef.current && containerRef.current !== view.dom) {
          cleanups.push(registerMentionRichTextEditorAdapter(containerRef.current, adapter));
        }
        mentionAdapterCleanupRef.current = () => {
          cleanups.forEach((cleanup) => cleanup());
        };
        setEditorDom(view.dom);
        scheduleVariableAutocompleteRefresh();
      },
      [getSelectionRect, insertText, scheduleVariableAutocompleteRefresh],
    );

    useEffect(
      () => () => {
        mentionAdapterCleanupRef.current?.();
        mentionAdapterCleanupRef.current = null;
        if (variableAutocompleteRafRef.current !== null) {
          window.cancelAnimationFrame(variableAutocompleteRafRef.current);
          variableAutocompleteRafRef.current = null;
        }
      },
      [],
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return undefined;
      }

      const markUserInteracted = () => {
        hasUserInteractedSinceLoadRef.current = true;
      };

      container.addEventListener('pointerdown', markUserInteracted, true);
      container.addEventListener('keydown', markUserInteracted, true);
      container.addEventListener('beforeinput', markUserInteracted, true);
      container.addEventListener('paste', markUserInteracted, true);
      container.addEventListener('drop', markUserInteracted, true);

      return () => {
        container.removeEventListener('pointerdown', markUserInteracted, true);
        container.removeEventListener('keydown', markUserInteracted, true);
        container.removeEventListener('beforeinput', markUserInteracted, true);
        container.removeEventListener('paste', markUserInteracted, true);
        container.removeEventListener('drop', markUserInteracted, true);
      };
    }, []);

    useEffect(() => {
      if (!editorDom) {
        return undefined;
      }

      const handleEditorInput = () => {
        scheduleVariableAutocompleteRefresh();
      };
      const handleEditorKeyUp = (event: KeyboardEvent) => {
        if (
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Backspace', 'Delete'].includes(event.key)
        ) {
          return;
        }

        scheduleVariableAutocompleteRefresh();
      };
      const handleEditorPointer = () => {
        window.setTimeout(scheduleVariableAutocompleteRefresh, 0);
      };

      editorDom.addEventListener('keydown', handleVariableAutocompleteKeyDown, true);
      editorDom.addEventListener('input', handleEditorInput, true);
      editorDom.addEventListener('keyup', handleEditorKeyUp, true);
      editorDom.addEventListener('mousedown', handleEditorPointer, true);

      return () => {
        editorDom.removeEventListener('keydown', handleVariableAutocompleteKeyDown, true);
        editorDom.removeEventListener('input', handleEditorInput, true);
        editorDom.removeEventListener('keyup', handleEditorKeyUp, true);
        editorDom.removeEventListener('mousedown', handleEditorPointer, true);
      };
    }, [editorDom, handleVariableAutocompleteKeyDown, scheduleVariableAutocompleteRefresh]);

    useEffect(() => {
      let cancelled = false;
      const generationId = generationIdRef.current + 1;
      generationIdRef.current = generationId;
      hasUserInteractedSinceLoadRef.current = false;
      setLoading(true);
      setDirty(false);
      onDirtyChangeRef.current?.(false);
      onReadyChangeRef.current?.(false);

      void (async () => {
        try {
          const rawBuffer =
            initialDocumentBufferRef.current ?? (await createWordDocumentBuffer(htmlContentRef.current || '<p></p>'));
          const styledBuffer = await ensureDocxTableCellStyles(rawBuffer, htmlContentRef.current || '');
          const nextBuffer = await ensureDocxPageNumberFooter(await ensureDocxTableBorders(styledBuffer));
          if (cancelled || generationId !== generationIdRef.current) return;
          setDocumentBuffer(nextBuffer);
          onBufferChangeRef.current?.(nextBuffer);
          onReadyChangeRef.current?.(true);
        } catch (error) {
          if (!cancelled) {
            const message = error instanceof Error ? error.message : 'Cannot prepare DOCX editor document.';
            onErrorRef.current?.(message);
            setDocumentBuffer(null);
            onReadyChangeRef.current?.(false);
          }
        } finally {
          if (!cancelled && generationId === generationIdRef.current) {
            setLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [sourceKey]);

    const saveCurrentBuffer = useCallback(async () => {
      try {
        const savedBuffer = (await editorRef.current?.save({ selective: false })) ?? documentBuffer;
        if (!savedBuffer) return null;
        const styledBuffer = await ensureDocxTableCellStyles(savedBuffer, htmlContentRef.current || '');
        const nextBuffer = await ensureDocxPageNumberFooter(await ensureDocxTableBorders(styledBuffer));
        setDocumentBuffer(nextBuffer);
        onBufferChangeRef.current?.(nextBuffer);
        setDirty(false);
        onDirtyChangeRef.current?.(false);
        return nextBuffer;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot save DOCX editor document.';
        onErrorRef.current?.(message);
        return null;
      }
    }, [documentBuffer]);

    const handleDownload = useCallback(async () => {
      const savedBuffer = await saveCurrentBuffer();
      if (!savedBuffer) return;
      await saveFile(
        new Blob([savedBuffer], {
          type: DOCX_MIME_TYPE,
        }),
        documentName,
      );
    }, [documentName, saveCurrentBuffer]);

    const handleExportPdf = useCallback(async () => {
      const savedBuffer = await saveCurrentBuffer();
      if (!savedBuffer) {
        throw new Error('DOCX editor is not ready.');
      }

      try {
        const pdfBlob = await convertDocxToPdfAPI(savedBuffer, documentName);
        await saveFile(pdfBlob, getPdfFileName(documentName));
      } catch (error) {
        console.warn('Server DOCX to PDF export failed. Falling back to browser PDF export.', error);
        await exportToPdf(htmlContentRef.current || '<p></p>', getPdfFileName(documentName));
      }
    }, [documentName, saveCurrentBuffer]);

    useImperativeHandle(
      ref,
      () => ({
        download: handleDownload,
        exportPdf: handleExportPdf,
        saveBuffer: saveCurrentBuffer,
        insertText,
      }),
      [handleDownload, handleExportPdf, insertText, saveCurrentBuffer],
    );

    const variableAutocompleteStyle = useMemo<CSSProperties>(
      () => ({
        top: variableAutocomplete.position.top,
        left: variableAutocomplete.position.left,
        width: variableAutocomplete.position.width,
      }),
      [variableAutocomplete.position.left, variableAutocomplete.position.top, variableAutocomplete.position.width],
    );

    if (loading || !documentBuffer) {
      return (
        <div className="flex h-full min-h-[480px] items-center justify-center text-sm text-slate-500">
          Preparing DOCX editor...
        </div>
      );
    }

    return (
      <>
        <div
          ref={containerRef}
          className={`docx-document-editor flex h-full min-h-[680px] flex-col bg-slate-100 ${className}`}>
          <div className="border-b border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-500">
            DOCX editor{dirty ? ' - unsaved DOCX buffer changes' : ''}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocxEditor
              ref={editorRef}
              documentBuffer={documentBuffer}
              documentName={documentName}
              documentNameEditable={false}
              readOnly={readOnly}
              mode={readOnly ? 'viewing' : 'editing'}
              showToolbar={!readOnly}
              showPrintButton={false}
              showZoomControl
              showRuler={!readOnly}
              showMarginGuides
              rulerUnit="cm"
              initialZoom={1}
              fontFamilies={DOCX_EDITOR_FONT_FAMILIES}
              showOutline={false}
              showOutlineButton={false}
              className="h-full"
              onChange={() => {
                markDirty();
                scheduleVariableAutocompleteRefresh();
              }}
              onSelectionChange={scheduleVariableAutocompleteRefresh}
              onSave={(nextBuffer) => {
                onBufferChangeRef.current?.(nextBuffer);
                setDirty(false);
                onDirtyChangeRef.current?.(false);
              }}
              onEditorViewReady={handleEditorViewReady}
              onError={(error) => onErrorRef.current?.(error.message)}
            />
          </div>
        </div>
        {variableAutocomplete.isOpen
          ? createPortal(
              <div
                style={variableAutocompleteStyle}
                className="fixed z-[2147483646] overflow-hidden rounded-lg border border-slate-300 bg-slate-50 p-1 shadow-2xl"
                data-docx-variable-autocomplete>
                <div className="max-h-80 overflow-auto">
                  {variableAutocomplete.items.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500">No matching variables.</div>
                  ) : (
                    variableAutocomplete.items.map((item, index) => {
                      const isHighlighted = index === highlightedVariableIndex;

                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`mb-0.5 block min-h-[58px] w-full rounded-md px-3 py-2 text-left transition last:mb-0 ${
                            isHighlighted
                              ? 'bg-blue-100 text-slate-900 shadow-[inset_3px_0_0_#0284c7]'
                              : 'bg-white text-slate-900 hover:bg-sky-50'
                          }`}
                          onMouseEnter={() => updateHighlightedVariableIndex(() => index)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            selectVariableAutocompleteItem(item);
                          }}>
                          <span className="mention-variable-option">
                            <span className="mention-variable-option__label">{item.label}</span>
                            <span className="mention-variable-option__key">{item.token}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>,
              document.body,
            )
          : null}
      </>
    );
  },
);

DocxDocumentEditor.displayName = 'DocxDocumentEditor';
