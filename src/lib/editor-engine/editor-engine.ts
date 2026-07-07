import { DOCUMENT_DOCX_PREVIEW_EDITOR, DOCUMENT_EDITOR_ENGINE } from 'reactjs-platform/utilities';
import type { TDocumentEditorEngine } from './editor-engine.type';

export const getDocumentEditorEngine = (): TDocumentEditorEngine => {
  const configuredEngine = String(DOCUMENT_EDITOR_ENGINE ?? '').trim();

  return configuredEngine === 'docx-editor' ? 'docx-editor' : 'ckeditor';
};

export const isDocxDocumentEditorEngine = () => getDocumentEditorEngine() === 'docx-editor';

export const isDocxPreviewEditorEnabled = () =>
  getDocumentEditorEngine() === 'ckeditor' && DOCUMENT_DOCX_PREVIEW_EDITOR;

export const createEditorContentKey = (content: string) => {
  let hash = 0;

  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) | 0;
  }

  return `${content.length}:${(hash >>> 0).toString(36)}`;
};
