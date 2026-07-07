import type { ExactSchemaCatalog } from '../../../lib';

export interface IDocxDocumentEditorProps {
  htmlContent: string;
  initialDocumentBuffer?: ArrayBuffer | null;
  sourceKey?: string;
  fileName?: string;
  readOnly?: boolean;
  className?: string;
  variableCatalog?: ExactSchemaCatalog;
  template_type?: string | null;
  onError?: (message: string) => void;
  onBufferChange?: (buffer: ArrayBuffer) => void;
  onReadyChange?: (ready: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface IDocxDocumentEditorHandle {
  download: () => Promise<void>;
  exportPdf: () => Promise<void>;
  saveBuffer: () => Promise<ArrayBuffer | null>;
  insertText: (text: string, replaceLength?: number) => boolean;
}
