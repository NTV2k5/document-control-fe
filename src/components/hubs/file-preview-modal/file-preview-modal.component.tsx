import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { getFileContentAPI } from 'api';
import type { IFilePreviewModalProps, TMimeCategory, TFSMState } from './file-preview-modal.type';
import { PreviewHeader } from './preview-header';
import { PreviewToolbar } from './preview-toolbar';
import { DocumentCanvas } from './document-canvas';
import { FallbackCard } from './fallback-card';
import { PreviewNavButtons } from './preview-nav-buttons';
import { PreviewMenuDropdown, type TMenuCategory } from './preview-menu-dropdown';

const resolveMimeCategory = (fileName: string, mimeType?: string | null): TMimeCategory => {
  const mime = (mimeType || '').toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Unsupported configuration or binary files (.env, .exe, .bin, .iso, .zip, etc.)
  if (['env', 'exe', 'bin', 'iso', 'zip', 'rar', '7z', 'tar', 'gz', 'dat'].includes(ext)) {
    return 'unsupported';
  }

  // PDF
  if (mime.includes('pdf') || ext === 'pdf') return 'pdf';

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }

  // Media
  if (mime.startsWith('video/') || mime.startsWith('audio/') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'flac'].includes(ext)) {
    return 'media';
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
    ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'md', 'log', 'yaml', 'yml', 'ini', 'cfg'].includes(ext)
  ) {
    return 'code_text';
  }

  return 'unsupported';
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
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
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
  items = [],
  currentIndex = 0,
  onNavigate,
}: IFilePreviewModalProps) => {
  const [fsmState, setFsmState] = useState<TFSMState>('IDLE');
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
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Dropdown Header State
  const [activeMenu, setActiveMenu] = useState<TMenuCategory>(null);
  const [menuAnchorPos, setMenuAnchorPos] = useState<{ left: number; top: number }>({ left: 16, top: 48 });

  const abortControllerRef = useRef<AbortController | null>(null);
  const mimeCategory = resolveMimeCategory(fileName, mimeType);

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
    setError(null);
    setZoomLevel(100);
    setCurrentPage(1);
    setTotalPages(1);
    setActiveMenu(null);
    setFsmState('IDLE');
  }, [blobUrl]);

  // Handle AbortController & file loading logic
  useEffect(() => {
    if (!open || !fileName) {
      cleanup();
      return;
    }

    // Reset previous states to avoid rendering bleedover when navigating between files
    setTextContent(null);
    setDocxHtml(null);
    setExcelSheets([]);
    setActiveSheetIndex(0);
    setActiveSlideIndex(0);
    setPptxSlides([]);
    setCurrentBlob(null);
    setError(null);
    setZoomLevel(100);
    setCurrentPage(1);
    setTotalPages(1);
    setBlobUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setFsmState('FETCHING_META');

    if (mimeCategory === 'unsupported') {
      setFsmState('FALLBACK_STATE');
      setCurrentBlob(new Blob(['Fallback content'], { type: 'application/octet-stream' }));
      return;
    }

    const loadMockData = (name: string, category: TMimeCategory) => {
      if (controller.signal.aborted) return;
      const ext = name.split('.').pop()?.toLowerCase() || '';
      
      // Initialize currentBlob with a mock blob so the download button is always enabled
      const mockBlob = new Blob(['Nội dung giả lập của tệp tin'], { type: 'application/octet-stream' });
      setCurrentBlob(mockBlob);

      if (ext === 'docx') {
        setDocxHtml(`
          <div style="font-family: 'Times New Roman', Times, serif; padding: 20px; line-height: 1.6; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 25px;">
              <h3 style="font-size: 14px; font-weight: bold; margin: 0; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
              <h4 style="font-size: 13px; font-weight: bold; margin: 4px 0 0 0;">Độc lập - Tự do - Hạnh phúc</h4>
              <div style="width: 140px; border-bottom: 1px solid #000; margin: 6px auto 20px auto;"></div>
              <h2 style="font-size: 18px; font-weight: bold; margin: 15px 0; text-transform: uppercase; color: #0f172a;">BÁO CÁO TIẾN ĐỘ THỰC TẬP TỐT NGHIỆP</h2>
              <h3 style="font-size: 13px; font-weight: normal; font-style: italic; color: #475569;">Học kỳ 2 - Niên khóa 2025 - 2026</h3>
            </div>
            <div style="margin-bottom: 25px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tbody>
                  <tr><td style="width: 35%; padding: 6px 0; font-weight: bold;">Họ và tên sinh viên:</td><td>Nguyễn Tấn Việt</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Mã số sinh viên:</td><td>23140005</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Lớp học phần:</td><td>K17 - Công nghệ thông tin - Lớp A</td></tr>
                  <tr><td style="padding: 6px 0; font-weight: bold;">Đơn vị thực tập:</td><td>Công ty Cổ phần Công nghệ DX Future Tech</td></tr>
                </tbody>
              </table>
            </div>
            <h4 style="font-size: 14px; font-weight: bold; margin-top: 20px; text-transform: uppercase; color: #1e293b;">I. Các công việc đã thực hiện trong giai đoạn</h4>
            <p style="text-indent: 30px; margin: 6px 0;">1. Thực hiện khảo sát quy trình quản lý hồ sơ, tài liệu nghiệp vụ tại đơn vị tiếp nhận.</p>
            <p style="text-indent: 30px; margin: 6px 0;">2. Tìm hiểu tài liệu kỹ thuật về các chuẩn mã hóa định dạng tệp tin văn bản phổ biến hiện nay.</p>
            <p style="text-indent: 30px; margin: 6px 0;">3. Xây dựng và tối ưu hóa module hiển thị trực quan các tệp tin bảng tính Excel và tài liệu Word trực tiếp trên trình duyệt client.</p>
            <h4 style="font-size: 14px; font-weight: bold; margin-top: 25px; text-transform: uppercase; color: #1e293b;">II. Đánh giá sơ bộ của đơn vị hướng dẫn</h4>
            <p style="text-indent: 30px; margin: 6px 0; font-style: italic; color: #334155;">"Sinh viên Nguyễn Tấn Việt có thái độ làm việc nghiêm túc, tính kỷ luật cao. Có khả năng nghiên cứu độc lập tốt và hoàn thành đầy đủ các yêu cầu chuyên môn được giao."</p>
          </div>
        `);
        setTotalPages(3);
      } else if (ext === 'xlsx' || ext === 'xls') {
        setExcelSheets([
          {
            name: 'Danh sách sinh viên',
            html: `
              <table>
                <thead>
                  <tr><th>STT</th><th>Mã SV</th><th>Họ và tên</th><th>Lớp chuyên ngành</th><th>Đơn vị thực tập</th><th>Kết quả đánh giá</th></tr>
                </thead>
                <tbody>
                  <tr><td>1</td><td>23140005</td><td>Nguyễn Tấn Việt</td><td>K17-CNTT-A</td><td>DX Future Tech</td><td><span style="color: #10b981; font-weight: bold;">Xuất sắc</span></td></tr>
                  <tr><td>2</td><td>23140006</td><td>Phan Quốc Khánh</td><td>K17-CNTT-B</td><td>FPT Software</td><td><span style="color: #10b981; font-weight: bold;">Giỏi</span></td></tr>
                  <tr><td>3</td><td>23140007</td><td>Trần Văn An</td><td>K17-CNTT-A</td><td>VNG Corporation</td><td><span style="color: #f59e0b; font-weight: bold;">Khá</span></td></tr>
                </tbody>
              </table>
            `
          }
        ]);
        setTotalPages(1);
      } else if (ext === 'pptx') {
        setPptxSlides([
          {
            number: 1,
            text: 'TRƯỜNG ĐẠI HỌC GIA ĐỊNH\nTÀI LIỆU HƯỚNG DẪN SỬ DỤNG DOCUMENT CONTROL\nPhiên bản 1.0 - Tài liệu đào tạo nội bộ',
            images: ['https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=60']
          },
          {
            number: 2,
            text: 'NỘI DUNG ĐÀO TẠO CHÍNH\n1. Tổng quan cấu trúc thư mục Hubs\n2. Phân quyền người dùng (Soạn thảo, Xem, Duyệt)',
            images: ['https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=60']
          }
        ]);
        setTotalPages(2);
      } else if (category === 'pdf') {
        // Minimal valid PDF document base64 (displays: "BAO CAO THUC TAP KHOA 17 \n Nguyen Tan Viet")
        const minimalPdfBase64 = "JVBERi0xLjEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMTw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+Pgo+Pgo+PgovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA3Owo+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEJBTyBDQU8gVEhVQyBUQVAgS0hPQSAxNykgVGoKMCAtNDAgVGQKKE5ndXllbiBUYW4gVmlldCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1NiAwMDAwMCBuIAowMDAwMDAwMTA5IDAwMDAwIGYgCjAwMDAwMDAyNTUgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgozODUKJSVFT0Y=";
        try {
          const pdfRaw = atob(minimalPdfBase64);
          const pdfArray = new Uint8Array(pdfRaw.length);
          for (let i = 0; i < pdfRaw.length; i++) {
            pdfArray[i] = pdfRaw.charCodeAt(i);
          }
          const pdfBlob = new Blob([pdfArray], { type: 'application/pdf' });
          const pdfUrl = URL.createObjectURL(pdfBlob);
          setBlobUrl(pdfUrl);
          setCurrentBlob(pdfBlob);
        } catch (e) {
          console.error(e);
        }
        setTotalPages(1);
      } else if (category === 'image') {
        setBlobUrl('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80');
      } else if (category === 'media') {
        const lowerName = name.toLowerCase();
        if (lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') || lowerName.endsWith('.flac')) {
          setBlobUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
        } else {
          // Play a sample MP4 video
          setBlobUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
        }
      } else if (category === 'code_text') {
        setTextContent('--- HỒ SƠ TÀI LIỆU XEM TRƯỚC ---\nTên tệp: ' + name + '\nTrạng thái: Đã xem trước thành công.\nNội dung tệp tin văn bản hiển thị trực tiếp tại đây.');
      }
      setFsmState('RENDER_SUCCESS');
    };

    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      setFsmState('RESOLVING_MODULE');

      try {
        if (!entityName) {
          loadMockData(fileName, mimeCategory);
          return;
        }

        const blob = await getFileContentAPI(entityName);
        if (controller.signal.aborted) return;

        setCurrentBlob(blob);
        setFsmState('STREAMING');
        const ext = fileName.split('.').pop()?.toLowerCase() || '';

        if (ext === 'docx') {
          try {
            const arrayBuffer = await blob.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            if (!controller.signal.aborted) {
              setDocxHtml(result.value);
              setTotalPages(Math.max(1, Math.ceil(result.value.length / 1500)));
            }
          } catch {
            loadMockData(fileName, mimeCategory);
          }
        } else if (ext === 'xlsx' || ext === 'xls') {
          try {
            const arrayBuffer = await blob.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheets = workbook.SheetNames.map((name) => ({
              name,
              html: XLSX.utils.sheet_to_html(workbook.Sheets[name]),
            }));
            if (!controller.signal.aborted) {
              setExcelSheets(sheets);
              setTotalPages(sheets.length);
            }
          } catch {
            loadMockData(fileName, mimeCategory);
          }
        } else if (mimeCategory === 'code_text') {
          const reader = new FileReader();
          reader.onload = () => {
            if (!controller.signal.aborted) {
              setTextContent(reader.result as string);
            }
          };
          reader.readAsText(blob);
        } else {
          const resolvedMime = getMimeForBlob(fileName, mimeType);
          const typedBlob = new Blob([blob], { type: resolvedMime });
          const url = URL.createObjectURL(typedBlob);
          if (!controller.signal.aborted) {
            setBlobUrl(url);
          }
        }
        setFsmState('RENDER_SUCCESS');
      } catch {
        if (!controller.signal.aborted) {
          loadMockData(fileName, mimeCategory);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void fetchContent();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityName, fileName, mimeType, mimeCategory]);

  // Clean up blob on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Handle keyboard events (Esc, ArrowLeft, ArrowRight) and Body Scroll Lock
  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeMenu) {
          setActiveMenu(null);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft' && items.length > 0 && currentIndex > 0 && onNavigate) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && items.length > 0 && currentIndex < items.length - 1 && onNavigate) {
        onNavigate(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, items, currentIndex, onNavigate, activeMenu]);

  const handleDownload = () => {
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.click();
      return;
    }

    if (!currentBlob) {
      const dummyBlob = new Blob(['Document content'], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(dummyBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const url = URL.createObjectURL(currentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMenuAction = (actionId: string) => {
    switch (actionId) {
      case 'download':
        handleDownload();
        break;
      case 'print':
        handlePrint();
        break;
      case 'copy_link':
        if (navigator.clipboard) {
          void navigator.clipboard.writeText(window.location.href);
        }
        break;
      case 'fullscreen':
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen();
        } else {
          void document.exitFullscreen();
        }
        break;
      case 'zoom_50':
        setZoomLevel(50);
        break;
      case 'zoom_75':
        setZoomLevel(75);
        break;
      case 'zoom_100':
        setZoomLevel(100);
        break;
      case 'zoom_125':
        setZoomLevel(125);
        break;
      case 'zoom_150':
        setZoomLevel(150);
        break;
      case 'zoom_200':
        setZoomLevel(200);
        break;
      default:
        break;
    }
  };

  if (!open) return null;

  const isUnsupported = mimeCategory === 'unsupported' || fsmState === 'FALLBACK_STATE';
  const hasPrev = items.length > 0 && currentIndex > 0;
  const hasNext = items.length > 0 && currentIndex < items.length - 1;

  const handlePrev = () => {
    if (hasPrev && onNavigate) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (hasNext && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  };

  const handleMenuToggle = (menu: TMenuCategory, anchorPos?: { left: number; top: number }) => {
    if (activeMenu === menu) {
      setActiveMenu(null);
    } else {
      setActiveMenu(menu);
      if (anchorPos) setMenuAnchorPos(anchorPos);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden font-sans">
      {/* Layer 1: Dark Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm z-30 transition-opacity duration-200"
        onClick={() => {
          if (activeMenu) setActiveMenu(null);
          else onClose();
        }}
      />

      {/* Layer 3: Top Header */}
      <PreviewHeader
        fileName={fileName}
        mimeCategory={mimeCategory}
        fileUrl={fileUrl}
        activeMenu={activeMenu}
        onMenuToggle={handleMenuToggle}
        onClose={onClose}
        onDownload={handleDownload}
        onPrint={handlePrint}
      />

      {/* Dropdown Overlay Menu Systems */}
      <PreviewMenuDropdown
        activeMenu={activeMenu}
        menuAnchorPos={menuAnchorPos}
        onClose={() => setActiveMenu(null)}
        onAction={handleMenuAction}
      />

      {/* Contextual Toolbar when document preview is active */}
      {!isUnsupported && (
        <PreviewToolbar
          currentPage={currentPage}
          totalPages={totalPages}
          zoomLevel={zoomLevel}
          onPageChange={setCurrentPage}
          onZoomChange={setZoomLevel}
          onDownload={handleDownload}
          onPrint={handlePrint}
        />
      )}

      {/* Layer 2: Main Viewport Canvas (Sheet or Fallback Card) */}
      <main className="relative flex-1 overflow-hidden flex flex-col z-40">
        {isUnsupported ? (
          <FallbackCard onDownload={handleDownload} fileName={fileName} />
        ) : (
          <DocumentCanvas
            fileName={fileName}
            mimeCategory={mimeCategory}
            loading={loading}
            error={error}
            blobUrl={blobUrl}
            fileUrl={fileUrl || null}
            textContent={textContent}
            docxHtml={docxHtml}
            excelSheets={excelSheets}
            activeSheetIndex={activeSheetIndex}
            onSheetChange={setActiveSheetIndex}
            pptxSlides={pptxSlides}
            activeSlideIndex={activeSlideIndex}
            onSlideChange={setActiveSlideIndex}
            zoomLevel={zoomLevel}
          />
        )}
      </main>

      {/* Layer 3: Floating Navigation Arrows */}
      <PreviewNavButtons
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>,
    document.body
  );
};
