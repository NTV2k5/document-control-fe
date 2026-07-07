import type { ClassicEditor } from 'ckeditor5';

const editorRoots = new WeakMap<HTMLElement, ClassicEditor>();
const editorAdapters = new WeakMap<HTMLElement, IMentionRichTextEditorAdapter>();

export type TMentionRichTextAnchorRect = Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'>;

export interface IMentionRichTextReplacePayload {
  replacement: string;
  replaceLength: number;
}

export interface IMentionRichTextSelectionRectPayload {
  markerText?: string;
}

export interface IMentionRichTextEditorAdapter {
  replaceMentionText: (payload: IMentionRichTextReplacePayload) => boolean;
  getSelectionRect?: (payload?: IMentionRichTextSelectionRectPayload) => TMentionRichTextAnchorRect | null;
}

const getEditorEditableElements = (editor: ClassicEditor) => {
  const elements = new Set<HTMLElement>();
  const editableElement = editor.ui.getEditableElement();

  if (editableElement) {
    elements.add(editableElement);
  }

  const viewRoot = editor.editing.view.document.getRoot();
  if (viewRoot) {
    const domRoot = editor.editing.view.domConverter.mapViewToDom(viewRoot);
    if (domRoot instanceof HTMLElement) {
      elements.add(domRoot);
    }
  }

  return Array.from(elements);
};

export const registerMentionRichTextEditor = (editor: ClassicEditor) => {
  const editableElements = getEditorEditableElements(editor);

  editableElements.forEach((element) => {
    editorRoots.set(element, editor);
  });

  return () => {
    editableElements.forEach((element) => {
      editorRoots.delete(element);
    });
  };
};

export const registerMentionRichTextEditorAdapter = (element: HTMLElement, adapter: IMentionRichTextEditorAdapter) => {
  editorAdapters.set(element, adapter);

  return () => {
    editorAdapters.delete(element);
  };
};

export const getMentionRichTextEditorFromElement = (element: HTMLElement) => {
  let currentElement: HTMLElement | null = element;

  while (currentElement) {
    const editor = editorRoots.get(currentElement);
    if (editor) {
      return editor;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
};

export const getMentionRichTextEditorAdapterFromElement = (element: HTMLElement) => {
  let currentElement: HTMLElement | null = element;

  while (currentElement) {
    const adapter = editorAdapters.get(currentElement);
    if (adapter) {
      return adapter;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
};
