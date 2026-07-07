'use client';

import { useTranslation } from '../../../i18n';

interface IPreviewModalProps {
  /** Whether modal is open */
  open: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** HTML content to preview */
  renderedHtml: string;
  /** Callback for PDF export */
  onExportPdf: () => void;
  /** Callback for Word export */
  onExportWord: () => void;
  /** Callback for combined export preview */
  onExport?: () => void;
  /** Current export status */
  exportLoading: string | null;
}

/**
 * Modal để hiện bản xem trước của template HTML
 */
export const PreviewModal = ({
  open,
  onClose,
  renderedHtml,
  onExportPdf,
  onExportWord,
  onExport,
  exportLoading,
}: IPreviewModalProps) => {
  const { t } = useTranslation();

  return (
    <>
      {open && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
          }}>
          <div className="preview-modal" role="dialog" aria-modal="true">
            <div className="preview-modal-header">
              <h2>{t('previewModal.title')}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {onExport ? (
                  <button
                    type="button"
                    className="btn btn-word"
                    onClick={onExport}
                    disabled={exportLoading === 'preview-export'}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                    }}>
                    {exportLoading === 'preview-export' ? (
                      <span className="loading-spinner" />
                    ) : (
                      <>{t('templateDetail.actions.export')}</>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-pdf"
                      onClick={onExportPdf}
                      disabled={exportLoading === 'preview-pdf'}
                      style={{
                        padding: '6px 12px',
                        fontSize: 13,
                      }}>
                      {exportLoading === 'preview-pdf' ? <span className="loading-spinner" /> : <>📥 PDF</>}
                    </button>
                    <button
                      type="button"
                      className="btn btn-word"
                      onClick={onExportWord}
                      disabled={exportLoading === 'preview-word'}
                      style={{
                        padding: '6px 12px',
                        fontSize: 13,
                      }}>
                      {exportLoading === 'preview-word' ? <span className="loading-spinner" /> : <>📄 Word</>}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={onClose}
                  title={t('previewModal.closeTitle')}>
                  ✕
                </button>
              </div>
            </div>
            <div className="preview-modal-content">
              <div
                className="preview-content"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: TODO
                dangerouslySetInnerHTML={{
                  __html: renderedHtml,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
