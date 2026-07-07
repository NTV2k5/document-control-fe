import type { DocumentTemplate } from './document-templates';
import type { TableTemplate } from './table-templates';
import type { VarTypes } from './templates';

export type TVariableWorkspaceDraftScope = 'template' | 'document';

export interface IVariableWorkspaceDraft {
  scope: TVariableWorkspaceDraftScope;
  id: string;
  source_updated_at?: string | null;
  updated_at: number;
  var_values: Record<string, string>;
  var_types: VarTypes;
  var_titles?: Record<string, string>;
  manually_completed_variables?: string[];
  selected_templates?: Record<string, TableTemplate>;
  selected_document_templates?: Record<string, DocumentTemplate>;
  document_template_values?: Record<string, Record<string, string>>;
}

const VARIABLE_WORKSPACE_DRAFT_DB_NAME = 'document-manager-variable-workspace-drafts';
const VARIABLE_WORKSPACE_DRAFT_STORE_NAME = 'drafts';
const VARIABLE_WORKSPACE_DRAFT_DB_VERSION = 1;
const VARIABLE_WORKSPACE_DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const getVariableWorkspaceDraftKey = (scope: TVariableWorkspaceDraftScope, id: string) => `${scope}:${id}`;

const openVariableWorkspaceDraftDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(VARIABLE_WORKSPACE_DRAFT_DB_NAME, VARIABLE_WORKSPACE_DRAFT_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VARIABLE_WORKSPACE_DRAFT_STORE_NAME)) {
        database.createObjectStore(VARIABLE_WORKSPACE_DRAFT_STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Cannot open variable workspace draft storage.'));
  });

const closeDraftDatabase = (database: IDBDatabase) => {
  database.close();
};

const serializeDraft = (draft: IVariableWorkspaceDraft) =>
  JSON.parse(
    JSON.stringify({
      ...draft,
      key: getVariableWorkspaceDraftKey(draft.scope, draft.id),
    }),
  ) as IVariableWorkspaceDraft & { key: string };

export const writeVariableWorkspaceDraft = async (draft: IVariableWorkspaceDraft) => {
  if (!draft.id) return;

  const database = await openVariableWorkspaceDraftDatabase();
  const payload = serializeDraft(draft);

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VARIABLE_WORKSPACE_DRAFT_STORE_NAME, 'readwrite');
    transaction.objectStore(VARIABLE_WORKSPACE_DRAFT_STORE_NAME).put(payload);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot write variable workspace draft.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Cannot write variable workspace draft.'));
  }).finally(() => closeDraftDatabase(database));
};

export const readVariableWorkspaceDraft = async (scope: TVariableWorkspaceDraftScope, id: string) => {
  if (!id) return null;

  const database = await openVariableWorkspaceDraftDatabase();

  return new Promise<IVariableWorkspaceDraft | null>((resolve, reject) => {
    let draft: IVariableWorkspaceDraft | null = null;
    const transaction = database.transaction(VARIABLE_WORKSPACE_DRAFT_STORE_NAME, 'readonly');
    const request = transaction
      .objectStore(VARIABLE_WORKSPACE_DRAFT_STORE_NAME)
      .get(getVariableWorkspaceDraftKey(scope, id));

    request.onsuccess = () => {
      draft = (request.result as IVariableWorkspaceDraft | undefined) ?? null;
    };
    request.onerror = () => reject(request.error ?? new Error('Cannot read variable workspace draft.'));
    transaction.oncomplete = () => {
      closeDraftDatabase(database);
      resolve(draft);
    };
    transaction.onerror = () => {
      closeDraftDatabase(database);
      reject(transaction.error ?? new Error('Cannot read variable workspace draft.'));
    };
    transaction.onabort = () => {
      closeDraftDatabase(database);
      reject(transaction.error ?? new Error('Cannot read variable workspace draft.'));
    };
  });
};

export const deleteVariableWorkspaceDraft = async (scope: TVariableWorkspaceDraftScope, id: string) => {
  if (!id) return;

  const database = await openVariableWorkspaceDraftDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VARIABLE_WORKSPACE_DRAFT_STORE_NAME, 'readwrite');
    transaction.objectStore(VARIABLE_WORKSPACE_DRAFT_STORE_NAME).delete(getVariableWorkspaceDraftKey(scope, id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot delete variable workspace draft.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Cannot delete variable workspace draft.'));
  }).finally(() => closeDraftDatabase(database));
};

export const cleanupVariableWorkspaceDrafts = async () => {
  const database = await openVariableWorkspaceDraftDatabase();
  const expiresBefore = Date.now() - VARIABLE_WORKSPACE_DRAFT_TTL_MS;

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VARIABLE_WORKSPACE_DRAFT_STORE_NAME, 'readwrite');
    const request = transaction.objectStore(VARIABLE_WORKSPACE_DRAFT_STORE_NAME).openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;

      const draft = cursor.value as IVariableWorkspaceDraft;
      if ((draft.updated_at ?? 0) < expiresBefore) {
        cursor.delete();
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('Cannot clean variable workspace drafts.'));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot clean variable workspace drafts.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Cannot clean variable workspace drafts.'));
  }).finally(() => closeDraftDatabase(database));
};
