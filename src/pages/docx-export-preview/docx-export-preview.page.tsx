'use client';

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, RefreshCcw } from 'lucide-react';
import { Button } from 'reactjs-platform/ui';
import type { IDocxDocumentEditorHandle } from '../../components/template/docx-document-editor';
import { Toast, type ToastProps } from '../../components/ui';
import { useTranslation } from '../../i18n';
import {
  createEditorContentKey,
  DOCX_EDITOR_RENDERER_VERSION,
  readDocxExportPreviewPayload,
  type IDocxExportPreviewPayload,
} from '../../lib';
import type { IDocxExportPreviewPageProps } from './docx-export-preview.type';

const LazyDocxDocumentEditor = lazy(() =>
  import('../../components/template/docx-document-editor').then((module) => ({
    default: module.DocxDocumentEditor,
  })),
);

export const DocxExportPreviewPage = ({ payloadId }: IDocxExportPreviewPageProps) => {
  const { t } = useTranslation();
  const editorRef = useRef<IDocxDocumentEditorHandle | null>(null);
  const [payload, setPayload] = useState<IDocxExportPreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [exportLoading, setExportLoading] = useState<'pdf' | 'word' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastProps | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPayload(null);

    void readDocxExportPreviewPayload(payloadId)
      .then((nextPayload) => {
        if (cancelled) return;

        if (!nextPayload) {
          setError(t('docxExportPreview.missingPayload'));
          return;
        }

        setPayload(nextPayload);
      })
      .catch((loadError: any) => {
        if (!cancelled) {
          setError(loadError?.message || t('docxExportPreview.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [payloadId, t]);

  const title = payload?.title || t('docxExportPreview.title');
  const fileName = payload?.fileName || 'document.docx';
  const initialDocumentBuffer = useMemo(() => {
    if (!payload?.initialDocumentBuffer) return null;
    if (payload.rendererVersion !== DOCX_EDITOR_RENDERER_VERSION) return null;
    if (payload.htmlContentKey !== createEditorContentKey(payload.htmlContent)) return null;
    return payload.initialDocumentBuffer;
  }, [payload]);
  const statusText = useMemo(() => {
    if (loading) return t('docxExportPreview.loading');
    if (!ready) return t('docxExportPreview.preparingEditor');
    if (dirty) return t('docxExportPreview.edited');
    return t('docxExportPreview.ready');
  }, [dirty, loading, ready, t]);

  const handleExportPdf = useCallback(async () => {
    try {
      setExportLoading('pdf');
      await editorRef.current?.exportPdf();
      setToast({ message: t('docxExportPreview.exportPdfSuccess'), type: 'success' });
    } catch (exportError: any) {
      setToast({
        message: t('docxExportPreview.exportFailed', { error: exportError?.message || exportError }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  }, [t]);

  const handleExportWord = useCallback(async () => {
    try {
      setExportLoading('word');
      await editorRef.current?.download();
      setToast({ message: t('docxExportPreview.exportWordSuccess'), type: 'success' });
    } catch (exportError: any) {
      setToast({
        message: t('docxExportPreview.exportFailed', { error: exportError?.message || exportError }),
        type: 'error',
      });
    } finally {
      setExportLoading(null);
    }
  }, [t]);

  return (
    <main className="flex h-screen min-h-0 flex-col bg-slate-100 text-slate-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
            <div className="truncate text-xs text-slate-500">{statusText}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            title={t('common.actions.retry')}>
            <RefreshCcw className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleExportPdf()}
            disabled={!ready || exportLoading !== null}>
            <Download className="size-3.5" />
            {exportLoading === 'pdf' ? '...' : t('docxExportPreview.exportPdf')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleExportWord()}
            disabled={!ready || exportLoading !== null}>
            <FileText className="size-3.5" />
            {exportLoading === 'word' ? '...' : t('docxExportPreview.exportWord')}
          </Button>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {t('docxExportPreview.loading')}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          </div>
        ) : payload ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                {t('docxExportPreview.preparingEditor')}
              </div>
            }>
            <LazyDocxDocumentEditor
              ref={editorRef}
              htmlContent={payload.htmlContent}
              initialDocumentBuffer={initialDocumentBuffer}
              sourceKey={`docx-export-preview:${DOCX_EDITOR_RENDERER_VERSION}:${payload.id}`}
              fileName={fileName}
              onReadyChange={setReady}
              onDirtyChange={setDirty}
              onError={(message) => setToast({ message, type: 'error' })}
            />
          </Suspense>
        ) : null}
      </section>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </main>
  );
};
