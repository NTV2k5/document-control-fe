import type { ClassicEditor } from 'ckeditor5';
import { insertVariablePickerItems } from './variable-picker';

const VARIABLE_DRAG_MIME = 'application/x-variable-token';
const VAR_TOKEN_REGEX = /^\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}$/;

/**
 * Attach native HTML5 drop listeners to a CKEditor instance so users can
 * drag variable chips from the sidebar and drop them at any position in the
 * editor content.
 *
 * Returns a cleanup function that removes all listeners.
 */
export const setupVariableDropHandler = (editor: ClassicEditor): (() => void) => {
  const editableElement = editor.editing.view.getDomRoot();
  if (!editableElement) return () => {};

  const handleDragOver = (event: DragEvent) => {
    if (!event.dataTransfer?.types.includes(VARIABLE_DRAG_MIME)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    editableElement.classList.add('variable-drop-active');
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!editableElement.contains(event.relatedTarget as Node)) {
      editableElement.classList.remove('variable-drop-active');
    }
  };

  const handleDrop = (event: DragEvent) => {
    editableElement.classList.remove('variable-drop-active');

    const token = event.dataTransfer?.getData(VARIABLE_DRAG_MIME);
    if (!token || !VAR_TOKEN_REGEX.test(token)) return;

    event.preventDefault();
    event.stopPropagation();

    // Map DOM drop coordinates to CKEditor model position
    const domRange = getDomRangeFromDropEvent(event);
    if (!domRange) {
      // Fallback: insert at end of document
      insertVariablePickerItems(editor, [{ token, insertMode: 'inline' }]);
      return;
    }

    // Convert DOM range → view position → model position
    const viewPosition = editor.editing.view.domConverter.domPositionToView(
      domRange.startContainer,
      domRange.startOffset,
    );

    if (!viewPosition) {
      insertVariablePickerItems(editor, [{ token, insertMode: 'inline' }]);
      return;
    }

    const modelPosition = editor.editing.mapper.toModelPosition(viewPosition);
    if (!modelPosition) {
      insertVariablePickerItems(editor, [{ token, insertMode: 'inline' }]);
      return;
    }

    const modelRange = editor.model.createRange(modelPosition);
    insertVariablePickerItems(editor, [{ token, insertMode: 'inline' }], modelRange);
  };

  editableElement.addEventListener('dragover', handleDragOver);
  editableElement.addEventListener('dragleave', handleDragLeave);
  editableElement.addEventListener('drop', handleDrop);

  return () => {
    editableElement.removeEventListener('dragover', handleDragOver);
    editableElement.removeEventListener('dragleave', handleDragLeave);
    editableElement.removeEventListener('drop', handleDrop);
    editableElement.classList.remove('variable-drop-active');
  };
};

/**
 * Use the browser's caretRangeFromPoint / caretPositionFromPoint API to get
 * a DOM range at the drop coordinates.
 */
function getDomRangeFromDropEvent(event: DragEvent): Range | null {
  const { clientX, clientY } = event;

  // Standard API (Firefox)
  if ('caretPositionFromPoint' in document) {
    const position = (document as any).caretPositionFromPoint(clientX, clientY);
    if (position) {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  }

  // WebKit/Blink API (Chrome, Safari, Edge)
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(clientX, clientY);
  }

  return null;
}

export { VARIABLE_DRAG_MIME };
