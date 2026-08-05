import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { IDocumentCanvasProps } from './document-canvas.type';

export const DocumentCanvas = ({
  fileName,
  entityName,
  mimeCategory,
  loading,
  error,
  blobUrl,
  fileUrl,
  textContent,
  docxHtml,
  excelSheets,
  activeSheetIndex,
  onSheetChange,
  pptxSlides,
  activeSlideIndex,
  onSlideChange,
  zoomLevel,
}: IDocumentCanvasProps) => {
  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-white/80 select-none">
        <Loader2 className="size-10 animate-spin text-[#a8c7fa]" />
        <span className="text-sm font-medium tracking-wide text-white/70">Đang tải bản xem trước...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-red-400 select-none">
        <span className="text-base font-medium">{error}</span>
      </div>
    );
  }

  const directUrl = fileUrl || null;
  const isMockFile = !entityName || entityName.startsWith('mock-');

  // Local state to handle source fallbacks on error (e.g. connection refused, 404/403)
  const [imgSrc, setImgSrc] = useState<string>('');
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [audioSrc, setAudioSrc] = useState<string>('');

  useEffect(() => {
    setImgSrc(directUrl || blobUrl || '');
    setVideoSrc(directUrl || blobUrl || '');
    setAudioSrc(directUrl || blobUrl || '');
  }, [directUrl, blobUrl]);
  const zoomStyle: React.CSSProperties = {
    zoom: `${zoomLevel}%`,
    transform: `scale(${zoomLevel / 100})`,
    transformOrigin: 'top center',
    transition: 'all 0.2s ease-in-out',
  };

  switch (mimeCategory) {
    case 'image':
      return imgSrc ? (
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">
          <img
            key={imgSrc}
            src={imgSrc}
            alt={fileName}
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-in-out',
            }}
            className="max-h-[85vh] max-w-full object-contain rounded shadow-2xl"
            onError={() => {
              const defaultImageMock = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80';
              if (isMockFile && imgSrc !== defaultImageMock) {
                setImgSrc(blobUrl || defaultImageMock);
              }
            }}
          />
        </div>
      ) : null;

    case 'pdf':
      return blobUrl ? (
        <div className="flex-1 w-full h-full flex justify-center p-4 overflow-auto">
          <div
            style={{
              width: `${Math.max(100, zoomLevel)}%`,
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
            }}
            className="w-full max-w-5xl h-full transition-all duration-200 flex justify-center"
          >
            <iframe
              key={`pdf-${blobUrl}-${zoomLevel}`}
              src={`${blobUrl}#zoom=${zoomLevel}`}
              className="size-full rounded border-0 shadow-2xl bg-white min-h-[85vh]"
              title={fileName}
            />
          </div>
        </div>
      ) : null;

    case 'media':
      if (fileName.match(/\.(mp4|webm|ogg|mov)$/i)) {
        return videoSrc ? (
          <div className="flex flex-1 items-center justify-center p-6 select-none">
            <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10 flex items-center justify-center">
              <video
                key={videoSrc}
                src={videoSrc}
                controls
                autoPlay={false}
                className="w-full h-full object-contain"
                onError={() => {
                  const defaultVideoMock = 'https://www.w3schools.com/html/mov_bbb.mp4';
                  if (isMockFile && videoSrc !== defaultVideoMock) {
                    setVideoSrc(blobUrl || defaultVideoMock);
                  }
                }}
              >
                Trình duyệt của bạn không hỗ trợ phát video này.
              </video>
            </div>
          </div>
        ) : null;
      }
      return audioSrc ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-white select-none">
          <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl">
            <span className="text-2xl font-bold">♪</span>
          </div>
          <span className="text-lg font-medium text-white/90">{fileName}</span>
          <audio
            key={audioSrc}
            src={audioSrc}
            controls
            className="w-full max-w-md"
            onError={() => {
              const defaultAudioMock = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
              if (isMockFile && audioSrc !== defaultAudioMock) {
                setAudioSrc(blobUrl || defaultAudioMock);
              }
            }}
          >
            Trình duyệt của bạn không hỗ trợ phát âm thanh này.
          </audio>
        </div>
      ) : null;

    case 'code_text':
      return textContent !== null ? (
        <div className="flex-1 w-full overflow-auto flex justify-center p-6 select-text">
          <div
            style={zoomStyle}
            className="w-full max-w-4xl bg-white shadow-2xl rounded-sm p-8 text-slate-800 font-mono text-sm leading-relaxed transition-transform duration-200 min-h-[80vh]"
          >
            <pre className="whitespace-pre-wrap break-words">{textContent}</pre>
          </div>
        </div>
      ) : null;

    case 'office': {
      // DOCX / DOC HTML render
      if (docxHtml !== null) {
        return (
          <div className="flex-1 w-full overflow-y-auto flex justify-center p-6 select-text">
            <div
              style={zoomStyle}
              className="w-full max-w-4xl bg-white shadow-2xl rounded-sm p-10 text-slate-900 transition-transform duration-200 min-h-[85vh] border border-slate-200"
            >
              <div
                className="prose max-w-none prose-slate font-sans text-slate-800 leading-relaxed text-sm"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            </div>
          </div>
        );
      }

      // XLSX Sheets render
      if (excelSheets.length > 0) {
        const activeSheet = excelSheets[activeSheetIndex];
        return (
          <div className="flex-1 w-full overflow-hidden flex flex-col items-center p-4 select-text">
            <div
              style={zoomStyle}
              className="w-full max-w-5xl h-full flex flex-col bg-white shadow-2xl rounded border border-slate-200 overflow-hidden transition-transform duration-200"
            >
              <style dangerouslySetInnerHTML={{ __html: `
                .excel-table-container { width: 100%; height: 100%; }
                .excel-table-container table { border-collapse: collapse; width: 100%; font-family: inherit; font-size: 13px; color: #334155; }
                .excel-table-container th, .excel-table-container td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; white-space: nowrap; }
                .excel-table-container tr:nth-child(even) { background-color: #f8fafc; }
                .excel-table-container th { background-color: #f1f5f9; font-weight: 700; color: #1e293b; position: sticky; top: 0; }
              `}} />

              {excelSheets.length > 1 && (
                <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-2 shrink-0">
                  {excelSheets.map((sheet, index) => (
                    <button
                      key={sheet.name}
                      type="button"
                      onClick={() => onSheetChange(index)}
                      className={`h-8 rounded-lg px-4 text-xs font-semibold transition-all cursor-pointer ${
                        activeSheetIndex === index
                          ? 'bg-white text-emerald-600 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}

              <div
                className="flex-1 overflow-auto p-6 excel-table-container"
                dangerouslySetInnerHTML={{ __html: activeSheet.html }}
              />
            </div>
          </div>
        );
      }

      // PPTX Slides render
      if (pptxSlides.length > 0) {
        const currentSlide = pptxSlides[activeSlideIndex] || pptxSlides[0];

        return (
          <div className="flex-1 w-full overflow-hidden p-4 flex justify-center">
            <div
              style={zoomStyle}
              className="w-full max-w-5xl h-full flex flex-col md:flex-row bg-slate-900 rounded-xl border border-white/10 shadow-2xl overflow-hidden transition-transform duration-200"
            >
              {/* Slide Stage */}
              <div className="flex-1 flex flex-col justify-between p-6 relative overflow-hidden select-text min-h-[300px]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-blue-600 to-amber-600" />
                <div className="flex items-center justify-between z-10 text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                  <span>Slide {currentSlide.number} / {pptxSlides.length}</span>
                  <span className="text-white/40 font-mono">Google Drive Preview</span>
                </div>

                <div className="flex-1 flex flex-col justify-center my-6 z-10 overflow-y-auto">
                  {currentSlide.images && currentSlide.images.length > 0 && (
                    <div className="flex flex-wrap gap-4 justify-center mb-6">
                      {currentSlide.images.map((imgUrl, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={imgUrl}
                          alt={`Slide ${currentSlide.number} Img ${imgIdx + 1}`}
                          className="max-h-[220px] object-contain rounded shadow-md border border-white/10 bg-slate-950 p-1"
                        />
                      ))}
                    </div>
                  )}
                  <div className="text-white text-center font-sans max-w-3xl mx-auto whitespace-pre-wrap">
                    <p className="text-base md:text-lg font-medium text-slate-100 antialiased">
                      {currentSlide.text || '(Chưa có nội dung chữ)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sidebar Thumbnails */}
              <div className="w-full md:w-64 bg-slate-950 border-t md:border-t-0 md:border-l border-white/10 flex flex-col h-[180px] md:h-full shrink-0">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-white/10 text-xs font-bold text-slate-300">
                  Slide Deck Navigator ({pptxSlides.length})
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {pptxSlides.map((slide, idx) => {
                    const isSelected = activeSlideIndex === idx;
                    return (
                      <button
                        key={slide.number}
                        type="button"
                        onClick={() => onSlideChange(idx)}
                        className={`w-full text-left flex gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-900'
                        }`}
                      >
                        <div className={`size-8 shrink-0 rounded flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {slide.number}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <p className="text-[11px] truncate">{slide.text || 'Empty Slide'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex-1 w-full overflow-auto flex justify-center p-6 select-text">
          <div
            style={zoomStyle}
            className="w-full max-w-4xl bg-white shadow-2xl rounded-sm p-10 text-slate-900 transition-transform duration-200 min-h-[85vh] border border-slate-200 flex flex-col items-center justify-center text-center gap-4"
          >
            <span className="text-base font-bold text-slate-700">{fileName}</span>
            <p className="text-sm text-slate-500 max-w-md">
              Định dạng tài liệu này đang được tải nội dung trực tiếp.
            </p>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
};
