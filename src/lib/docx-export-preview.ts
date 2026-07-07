import { createEditorContentKey } from './editor-engine';
import { DOCX_EDITOR_RENDERER_VERSION } from './templates';

export type TDocxExportPreviewSource = 'document' | 'template';

export interface IDocxExportPreviewPayload {
  id: string;
  source: TDocxExportPreviewSource;
  title: string;
  fileName: string;
  htmlContent: string;
  htmlContentKey?: string;
  rendererVersion?: string;
  initialDocumentBuffer?: ArrayBuffer | null;
  createdAt: number;
}

export type TDocxExportPreviewPayloadInput = Omit<IDocxExportPreviewPayload, 'id' | 'createdAt'>;

const DOCX_EXPORT_PREVIEW_DB_NAME = 'document-manager-docx-export-preview';
const DOCX_EXPORT_PREVIEW_STORE_NAME = 'payloads';
const DOCX_EXPORT_PREVIEW_DB_VERSION = 1;
const DOCX_EXPORT_PREVIEW_TTL_MS = 1000 * 60 * 60 * 6;

const createDocxExportPreviewId = () => {
  const randomValue =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${Date.now()}-${randomValue}`;
};

const openDocxExportPreviewDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DOCX_EXPORT_PREVIEW_DB_NAME, DOCX_EXPORT_PREVIEW_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DOCX_EXPORT_PREVIEW_STORE_NAME)) {
        database.createObjectStore(DOCX_EXPORT_PREVIEW_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open DOCX export preview storage.'));
  });

const closeDatabase = (database: IDBDatabase) => {
  database.close();
};

export const writeDocxExportPreviewPayload = async (input: TDocxExportPreviewPayloadInput) => {
  const payload: IDocxExportPreviewPayload = {
    ...input,
    id: createDocxExportPreviewId(),
    htmlContentKey: createEditorContentKey(input.htmlContent),
    rendererVersion: DOCX_EDITOR_RENDERER_VERSION,
    createdAt: Date.now(),
  };
  const database = await openDocxExportPreviewDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DOCX_EXPORT_PREVIEW_STORE_NAME, 'readwrite');
    transaction.objectStore(DOCX_EXPORT_PREVIEW_STORE_NAME).put(payload);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot write DOCX export preview payload.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Cannot write DOCX export preview payload.'));
  }).finally(() => closeDatabase(database));

  void cleanupDocxExportPreviewPayloads().catch(() => {});

  return payload;
};

export const readDocxExportPreviewPayload = async (id: string) => {
  if (!id) return null;

  const database = await openDocxExportPreviewDatabase();

  return new Promise<IDocxExportPreviewPayload | null>((resolve, reject) => {
    let payload: IDocxExportPreviewPayload | null = null;
    const transaction = database.transaction(DOCX_EXPORT_PREVIEW_STORE_NAME, 'readonly');
    const request = transaction.objectStore(DOCX_EXPORT_PREVIEW_STORE_NAME).get(id);

    request.onsuccess = () => {
      payload = (request.result as IDocxExportPreviewPayload | undefined) ?? null;
    };
    request.onerror = () => reject(request.error ?? new Error('Cannot read DOCX export preview payload.'));
    transaction.oncomplete = () => {
      closeDatabase(database);
      resolve(payload);
    };
    transaction.onerror = () => {
      closeDatabase(database);
      reject(transaction.error ?? new Error('Cannot read DOCX export preview payload.'));
    };
    transaction.onabort = () => {
      closeDatabase(database);
      reject(transaction.error ?? new Error('Cannot read DOCX export preview payload.'));
    };
  });
};

export const cleanupDocxExportPreviewPayloads = async () => {
  const database = await openDocxExportPreviewDatabase();
  const expiresBefore = Date.now() - DOCX_EXPORT_PREVIEW_TTL_MS;

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DOCX_EXPORT_PREVIEW_STORE_NAME, 'readwrite');
    const request = transaction.objectStore(DOCX_EXPORT_PREVIEW_STORE_NAME).openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;

      const payload = cursor.value as IDocxExportPreviewPayload;
      if (payload.createdAt < expiresBefore) {
        cursor.delete();
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('Cannot clean DOCX export preview payloads.'));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot clean DOCX export preview payloads.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Cannot clean DOCX export preview payloads.'));
  }).finally(() => closeDatabase(database));
};

export const openDocxExportPreviewWindow = () => {
  if (typeof window === 'undefined') {
    throw new Error('Export preview can only be opened in the browser.');
  }

  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    throw new Error('Cannot open export preview tab. Please allow pop-ups for this site.');
  }

  previewWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Preparing export preview...</title>
        <style>
          body {
            align-items: center;
            background: #f8fafc;
            color: #334155;
            display: flex;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            height: 100vh;
            justify-content: center;
            margin: 0;
          }
        </style>
      </head>
      <body>Preparing export preview...</body>
    </html>
  `);
  previewWindow.document.close();

  return previewWindow;
};

export const navigateDocxExportPreviewWindow = (previewWindow: Window, payloadId: string) => {
  const previewUrl = new URL('/docx-export-preview', window.location.href);
  previewUrl.searchParams.set('id', payloadId);
  previewWindow.location.href = previewUrl.toString();
};
