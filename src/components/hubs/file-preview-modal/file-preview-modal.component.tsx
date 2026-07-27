import { useState, useEffect, useCallback } from 'react';
import { X, Download, FileText, Loader2, AlertCircle, FileSpreadsheet, Presentation, FileDown, Globe, ShieldAlert } from 'lucide-react';
import { Button } from 'reactjs-platform/ui';
import { getFileContentAPI } from 'api';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { IFilePreviewModalProps } from './file-preview-modal.type';

type TFileCategory = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'office' | 'unknown';

const getFileCategory = (fileName: string, mimeType?: string | null): TFileCategory => {
  const mime = (mimeType || '').toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // PDF
  if (mime.includes('pdf') || ext === 'pdf') return 'pdf';

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }

  // Video
  if (mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) {
    return 'video';
  }

  // Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return 'audio';
  }

  // Office
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('excel') ||
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext)
  ) {
    return 'office';
  }

  // Text-based
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md', 'log', 'yaml', 'yml', 'ini', 'cfg', 'env'].includes(ext)
  ) {
    return 'text';
  }

  return 'unknown';
};

const getMimeForBlob = (fileName: string, mimeType?: string | null): string => {
  if (mimeType) return mimeType;
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    md: 'text/markdown',
  };
  return mimeMap[ext] || 'application/octet-stream';
};



export const FilePreviewModal = ({
  open,
  onClose,
  entityName,
  fileName,
  mimeType,
  fileUrl,
}: IFilePreviewModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [excelSheets, setExcelSheets] = useState<Array<{ name: string; html: string }>>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [pptxSlides, setPptxSlides] = useState<Array<{ number: number; text: string; images: string[] }>>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const [showOnlinePreview, setShowOnlinePreview] = useState(false);

  const fileCategory = getFileCategory(fileName, mimeType);

  const cleanup = useCallback(() => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setTextContent(null);
    setDocxHtml(null);
    setExcelSheets([]);
    setActiveSheetIndex(0);
    setActiveSlideIndex(0);

    setPptxSlides([]);
    setCurrentBlob(null);
    setShowOnlinePreview(false);
    setError(null);
  }, [blobUrl]);

  useEffect(() => {
    if (!open || !entityName) {
      cleanup();
      return;
    }

    let cancelled = false;

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const blob = await getFileContentAPI(entityName);
        if (cancelled) return;

        setCurrentBlob(blob);

        const ext = fileName.split('.').pop()?.toLowerCase() || '';

        if (ext === 'docx') {
          try {
            const arrayBuffer = await blob.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            if (!cancelled) {
              setDocxHtml(result.value);
            }
          } catch (err) {
            console.error('Failed to parse docx client-side:', err);
            // fallback to public viewer
            const resolvedMime = getMimeForBlob(fileName, mimeType);
            const typedBlob = new Blob([blob], { type: resolvedMime });
            const url = URL.createObjectURL(typedBlob);
            if (!cancelled) {
              setBlobUrl(url);
            }
          }
        } else if (ext === 'xlsx' || ext === 'xls') {
          try {
            const arrayBuffer = await blob.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheets = workbook.SheetNames.map((name) => {
              const worksheet = workbook.Sheets[name];
              const html = XLSX.utils.sheet_to_html(worksheet);
              return { name, html };
            });
            if (!cancelled) {
              setExcelSheets(sheets);
            }
          } catch (err) {
            console.error('Failed to parse xlsx client-side:', err);
            const resolvedMime = getMimeForBlob(fileName, mimeType);
            const typedBlob = new Blob([blob], { type: resolvedMime });
            const url = URL.createObjectURL(typedBlob);
            if (!cancelled) {
              setBlobUrl(url);
            }
          }
        } else if (ext === 'pptx') {
          try {
            const jsZipModule = await import('jszip');
            const JSZip = jsZipModule.default || jsZipModule;
            const zip = await JSZip.loadAsync(blob);

            // Build a map of relationship IDs to media file paths per slide
            const slideFiles = Object.keys(zip.files).filter((name) =>
              name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
            );

            slideFiles.sort((a, b) => {
              const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
              const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
              return numA - numB;
            });

            // Pre-load media files as data URLs
            const mediaFiles = Object.keys(zip.files).filter((name) =>
              name.startsWith('ppt/media/')
            );
            const mediaMap = new Map<string, string>();
            for (const mediaPath of mediaFiles) {
              try {
                const mediaData = await zip.files[mediaPath].async('base64');
                const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
                const mimeMap: Record<string, string> = {
                  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                  gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
                  emf: 'image/emf', wmf: 'image/wmf', tiff: 'image/tiff',
                };
                const mime = mimeMap[ext] || 'image/png';
                mediaMap.set(mediaPath, `data:${mime};base64,${mediaData}`);
              } catch {
                // Skip unreadable media files
              }
            }

            const extractedSlides: Array<{ number: number; text: string; images: string[] }> = [];

            for (let i = 0; i < slideFiles.length; i++) {
              const slideFile = slideFiles[i];
              const file = zip.files[slideFile];
              const xmlText = await file.async('text');

              // Extract text
              const matches = xmlText.match(/<a:t>([^<]+)<\/a:t>/g) || [];
              const slideText = matches
                .map((m) => m.replace(/<\/?a:t>/g, ''))
                .filter((txt) => txt.trim().length > 0)
                .join(' ');

              // Extract image relationship IDs from slide XML
              const slideImages: string[] = [];
              const blipMatches = xmlText.match(/r:embed="([^"]+)"/g) || [];
              const rIds = blipMatches.map((m) => m.replace(/r:embed="|"/g, ''));

              // Look up relationship IDs in the slide's .rels file
              const slideNum = slideFile.match(/slide(\d+)\.xml/)?.[1];
              const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
              if (zip.files[relsPath]) {
                try {
                  const relsXml = await zip.files[relsPath].async('text');
                  for (const rId of rIds) {
                    const targetMatch = relsXml.match(
                      new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`)
                    );
                    if (targetMatch) {
                      const target = targetMatch[1];
                      // Resolve relative path (../media/image1.png -> ppt/media/image1.png)
                      const resolved = target.startsWith('..')
                        ? 'ppt/' + target.replace('../', '')
                        : target.startsWith('ppt/')
                          ? target
                          : 'ppt/slides/' + target;
                      const dataUrl = mediaMap.get(resolved);
                      if (dataUrl && !dataUrl.includes('image/emf') && !dataUrl.includes('image/wmf')) {
                        slideImages.push(dataUrl);
                      }
                    }
                  }
                } catch {
                  // Skip rels parsing errors
                }
              }

              extractedSlides.push({
                number: i + 1,
                text: slideText || '(Empty Slide)',
                images: slideImages,
              });
            }

            if (!cancelled) {
              setPptxSlides(extractedSlides);
            }
          } catch (err) {
            console.error('Failed to parse pptx client-side:', err);
            const resolvedMime = getMimeForBlob(fileName, mimeType);
            const typedBlob = new Blob([blob], { type: resolvedMime });
            const url = URL.createObjectURL(typedBlob);
            if (!cancelled) {
              setBlobUrl(url);
            }
          }
        } else if (fileCategory === 'text') {
          const reader = new FileReader();
          reader.onload = () => {
            if (!cancelled) {
              setTextContent(reader.result as string);
            }
          };
          reader.readAsText(blob);
        } else if (fileCategory !== 'office') {
          const resolvedMime = getMimeForBlob(fileName, mimeType);
          const typedBlob = new Blob([blob], { type: resolvedMime });
          const url = URL.createObjectURL(typedBlob);
          if (!cancelled) {
            setBlobUrl(url);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch file content:', err);
          setError('Failed to load file preview. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchContent();

    return () => {
      cancelled = true;
    };
  }, [open, entityName, fileCategory, fileName, mimeType]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleDownload = () => {
    if (!currentBlob) return;
    const url = URL.createObjectURL(currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  if (!open) return null;

  const getOfficeViewerUrl = (): string | null => {
    // Build the direct file URL for the Office Online viewer using VITE_API_URL or VITE_API_ENDPOINT
    const baseUrl = (
      import.meta.env.VITE_API_URL ||
      import.meta.env.VITE_API_ENDPOINT ||
      ''
    ).replace(/\/$/, '');
    if (!baseUrl) return null;
    const fileUrl = `${baseUrl}/api/method/drive.api.files.get_file_content?entity_name=${entityName}&trigger_download=0`;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 className="size-10 animate-spin text-blue-500" />
          <span className="text-sm font-medium text-slate-500">Loading preview...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <AlertCircle className="size-10 text-red-400" />
          <span className="text-sm font-medium text-red-500">{error}</span>
          <Button
            variant="outline"
            className="mt-2 rounded-xl text-xs font-bold"
            onClick={handleClose}
          >
            Close
          </Button>
        </div>
      );
    }

    const directUrl = fileUrl || null;

    switch (fileCategory) {
      case 'pdf':
        return blobUrl ? (
          <iframe
            src={blobUrl}
            className="size-full rounded-lg border-0"
            title={fileName}
          />
        ) : null;

      case 'image':
        return (directUrl || blobUrl) ? (
          <div className="flex flex-1 items-center justify-center overflow-auto p-4">
            <img
              src={directUrl || blobUrl || ''}
              alt={fileName}
              className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
            />
          </div>
        ) : null;

      case 'video':
        return (directUrl || blobUrl) ? (
          <div className="flex flex-1 items-center justify-center p-4 bg-slate-950/40 rounded-xl border border-slate-100">
            <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden bg-black shadow-2xl border border-slate-800 flex items-center justify-center">
              <video
                key={directUrl || blobUrl || ''}
                src={directUrl || blobUrl || ''}
                controls
                autoPlay={false}
                className="w-full h-full object-contain"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        ) : null;

      case 'audio':
        return (directUrl || blobUrl) ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
            <div className="flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-xl">
              <FileText className="size-10 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-700">{fileName}</span>
            <audio src={directUrl || blobUrl || ''} controls className="w-full max-w-md">
              Your browser does not support the audio tag.
            </audio>
          </div>
        ) : null;

      case 'text':
        return textContent !== null ? (
          <div className="flex-1 overflow-auto rounded-lg bg-slate-50 p-6">
            <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-slate-700">
              {textContent}
            </pre>
          </div>
        ) : null;

      case 'office': {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';

        // Render DOCX natively using mammoth-generated HTML
        if (ext === 'docx' && docxHtml !== null) {
          return (
            <div className="flex-1 overflow-auto rounded-lg border border-slate-100 bg-white p-8 shadow-inner select-text">
              <div
                className="prose max-w-none prose-slate font-sans text-slate-800 leading-relaxed text-sm"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            </div>
          );
        }

        // Render XLSX natively using sheet-tabs and custom-styled tables
        if ((ext === 'xlsx' || ext === 'xls') && excelSheets.length > 0) {
          const activeSheet = excelSheets[activeSheetIndex];
          return (
            <div className="flex-1 flex flex-col overflow-hidden rounded-xl border border-slate-150 bg-white shadow-sm select-text">
              <style dangerouslySetInnerHTML={{ __html: `
                .excel-table-container {
                  width: 100%;
                  height: 100%;
                }
                .excel-table-container table {
                  border-collapse: collapse;
                  width: 100%;
                  font-family: inherit;
                  font-size: 13px;
                  color: #334155;
                }
                .excel-table-container th, .excel-table-container td {
                  border: 1px solid #e2e8f0;
                  padding: 8px 12px;
                  text-align: left;
                  white-space: nowrap;
                }
                .excel-table-container tr:nth-child(even) {
                  background-color: #f8fafc;
                }
                .excel-table-container th {
                  background-color: #f1f5f9;
                  font-weight: 700;
                  color: #1e293b;
                  position: sticky;
                  top: 0;
                }
              `}} />
              {/* Sheet Tabs */}
              {excelSheets.length > 1 && (
                <div className="flex items-center gap-1 border-b border-slate-150 bg-slate-50/50 px-4 py-2">
                  {excelSheets.map((sheet, index) => (
                    <button
                      key={sheet.name}
                      onClick={() => setActiveSheetIndex(index)}
                      className={`h-8 rounded-lg px-4 text-xs font-bold transition-all ${
                        activeSheetIndex === index
                          ? 'bg-white text-emerald-600 shadow-sm border border-slate-150'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                      }`}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}
              {/* Sheet Table Viewer */}
              <div 
                className="flex-1 overflow-auto p-6 excel-table-container"
                dangerouslySetInnerHTML={{ __html: activeSheet.html }}
              />
            </div>
          );
        }

        // Render DOC natively using a clear explanation and download options
        if (ext === 'doc') {
          return (
            <div className="flex flex-1 flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-150">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 shadow-sm mb-4">
                <FileText className="size-10 text-blue-600" />
              </div>
              <h4 className="text-lg font-bold text-slate-800 mb-2">{fileName}</h4>
              <p className="text-sm text-slate-500 text-center max-w-md mb-6 leading-relaxed">
                Legacy Microsoft Word Document (.doc) formats cannot be natively rendered in the browser. Please download the file to view its full content, or convert it to .docx to view online.
              </p>
              <Button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-sm transition"
              >
                <Download className="size-4" />
                Download Legacy Document
              </Button>
            </div>
          );
        }

        // Render PPTX natively using a high-fidelity slide deck viewer
        if (ext === 'pptx' && pptxSlides.length > 0) {
          const currentSlide = pptxSlides[activeSlideIndex] || pptxSlides[0];

          return (
            <div className="flex flex-1 flex-col lg:flex-row overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm h-full">
              {/* Main Slide Stage (Left) */}
              <div className="flex-1 flex flex-col justify-between bg-slate-900 p-6 relative overflow-hidden select-text min-h-[300px]">
                {/* Gold theme border accent matching Gia Dinh University style */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-blue-600 to-amber-600" />
                
                {/* Slide Header / Badge */}
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] font-bold tracking-widest text-amber-500 uppercase">
                    Slide {currentSlide.number} of {pptxSlides.length}
                  </span>
                  <span className="text-[10px] text-white/50 font-mono">
                    Document Control Viewer
                  </span>
                </div>

                {/* Slide Content Area */}
                <div className="flex-1 flex flex-col justify-center my-6 z-10 max-h-[calc(100%-80px)] overflow-y-auto pr-1">
                  {/* Images on Slide */}
                  {currentSlide.images && currentSlide.images.length > 0 && (
                    <div className="flex flex-wrap gap-4 justify-center mb-6">
                      {currentSlide.images.map((imgUrl, imgIdx) => (
                        <div key={imgIdx} className="relative group max-w-full">
                          <img
                            src={imgUrl}
                            alt={`Slide ${currentSlide.number} Image ${imgIdx + 1}`}
                            className="max-h-[220px] object-contain rounded-lg shadow-md border border-white/10 bg-slate-950 p-1"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Slide Text Content */}
                  <div className="text-white text-center leading-relaxed font-sans max-w-3xl mx-auto whitespace-pre-wrap">
                    {currentSlide.text ? (
                      <p className="text-base md:text-lg font-medium text-slate-100 antialiased drop-shadow-sm">
                        {currentSlide.text}
                      </p>
                    ) : (
                      <p className="text-sm italic text-slate-500">(No text content on this slide)</p>
                    )}
                  </div>
                </div>

                {/* Slide Footer */}
                <div className="flex items-center justify-between text-white/40 text-[10px] z-10">
                  <span>Gia Dinh University</span>
                  <span>Page {currentSlide.number}</span>
                </div>
              </div>

              {/* Sidebar Thumbnails (Right) */}
              <div className="w-full lg:w-72 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col h-[200px] lg:h-full overflow-hidden shrink-0">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Slide Deck Navigator</span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    {pptxSlides.length} Slides
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {pptxSlides.map((slide, idx) => {
                    const isSelected = activeSlideIndex === idx;
                    return (
                      <button
                        key={slide.number}
                        onClick={() => setActiveSlideIndex(idx)}
                        className={`w-full text-left flex gap-3 p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-blue-50/50 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {/* Slide number badge / preview box */}
                        <div className={`size-12 shrink-0 rounded-lg flex flex-col items-center justify-center border font-bold text-xs ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          <span className="text-[9px] uppercase tracking-wider opacity-80">Slide</span>
                          <span className="text-sm leading-none mt-0.5">{slide.number}</span>
                        </div>

                        {/* Slide preview text / info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <p className="text-[11px] text-slate-600 font-medium truncate pr-1">
                            {slide.text || 'Empty Slide'}
                          </p>
                          {slide.images && slide.images.length > 0 && (
                            <span className="text-[9px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                              🖼️ {slide.images.length} {slide.images.length === 1 ? 'image' : 'images'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        // Render other Office documents with iframe and a clear helper banner by default
        const viewerUrl = getOfficeViewerUrl();
        return (
          <div className="flex flex-1 flex-col gap-3 h-full">
            <div className="flex items-center justify-between rounded-xl bg-blue-50/60 px-4 py-2.5 text-xs font-bold text-blue-600 border border-blue-100/50">
              <span className="flex items-center gap-1.5">
                💡 Previewing Office document. If the file fails to load or is private, please download to view.
              </span>
              <Button
                size="sm"
                className="h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider px-3 shadow-sm transition"
                onClick={handleDownload}
              >
                <Download className="mr-1.5 size-3.5" />
                Download file
              </Button>
            </div>
            {viewerUrl ? (
              <iframe
                src={viewerUrl}
                className="size-full rounded-lg border border-slate-150 shadow-sm"
                title={fileName}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <div className="flex size-20 items-center justify-center rounded-2xl bg-blue-50">
                  <FileText className="size-10 text-blue-500" />
                </div>
                <span className="text-lg font-bold text-slate-700">{fileName}</span>
                <p className="text-sm text-slate-400">
                  Office file preview requires a public URL. Use download instead.
                </p>
                <Button
                  onClick={handleDownload}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <Download className="size-4" />
                  Download File
                </Button>
              </div>
            )}
          </div>
        );
      }

      default:
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-slate-100">
              <FileText className="size-10 text-slate-400" />
            </div>
            <span className="text-lg font-bold text-slate-700">{fileName}</span>
            <p className="text-sm text-slate-400">
              Preview is not available for this file type.
            </p>
            <Button
              onClick={handleDownload}
              disabled={!currentBlob}
              className="mt-2 flex items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white hover:bg-blue-700"
            >
              <Download className="size-4" />
              Download File
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative flex h-[90vh] w-[90vw] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <FileText className="size-4.5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-800" title={fileName}>
                {fileName}
              </h3>
              <span className="text-[10px] font-medium text-slate-400 uppercase">
                {fileCategory} file
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentBlob && (
              <Button
                variant="outline"
                size="icon"
                className="size-8 rounded-lg border-slate-200 text-slate-500 hover:bg-slate-50"
                onClick={handleDownload}
                title="Download"
              >
                <Download className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={handleClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
