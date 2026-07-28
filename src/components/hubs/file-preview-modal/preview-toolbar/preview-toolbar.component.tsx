import { useState, useEffect, useRef } from 'react';
import { Download, Printer, ZoomIn, ZoomOut, ChevronDown } from 'lucide-react';
import type { IPreviewToolbarProps } from './preview-toolbar.type';

export const PreviewToolbar = ({
  currentPage,
  totalPages,
  zoomLevel,
  onPageChange,
  onZoomChange,
  onDownload,
  onPrint,
}: IPreviewToolbarProps) => {
  const [pageInput, setPageInput] = useState(currentPage.toString());
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    if (!isZoomMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setIsZoomMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isZoomMenuOpen]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(pageInput, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      onPageChange(val);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const ZOOM_OPTIONS = [
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: '100% (Mặc định)', value: 100 },
    { label: '125%', value: 125 },
    { label: '150%', value: 150 },
    { label: '200%', value: 200 },
    { label: 'divider', value: -1 },
    { label: 'Vừa màn hình', value: 100 },
    { label: 'Vừa chiều rộng', value: 125 },
  ];

  return (
    <div className="w-full bg-[#1e2023] border-b border-white/10 px-4 sm:px-6 h-11 flex items-center justify-between z-40 text-xs text-white/90 select-none shadow-sm shrink-0">
      {/* Left Group: Page Navigator, Download, Print */}
      <div className="flex items-center gap-2">
        <span className="text-white/80 font-medium">Trang</span>
        <form onSubmit={handlePageSubmit} className="inline-block">
          <input
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageSubmit}
            className="w-9 h-6 text-center bg-white/10 border border-white/20 rounded px-1 text-xs text-white font-medium focus:outline-none focus:border-blue-400"
          />
        </form>
        <span className="text-white/60 font-medium">/ {totalPages}</span>

        {/* Vertical Divider */}
        <div className="h-4 w-px bg-white/20 mx-2" />

        {/* Quick Action Download & Print Buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDownload}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
            title="Tải xuống"
          >
            <Download className="size-4" />
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
            title="In"
          >
            <Printer className="size-4" />
          </button>
        </div>
      </div>

      {/* Right Group: Zoom Controls */}
      <div className="relative flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onZoomChange(Math.max(50, zoomLevel - 25))}
          className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
          title="Thu nhỏ"
        >
          <ZoomOut className="size-4" />
        </button>

        {/* Zoom Dropdown Trigger */}
        <div ref={zoomMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsZoomMenuOpen((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded transition text-xs font-medium cursor-pointer text-white"
          >
            <span>{zoomLevel}%</span>
            <ChevronDown className={`size-3.5 transition-transform duration-150 ${isZoomMenuOpen ? 'rotate-180' : 'opacity-70'}`} />
          </button>

          {/* Zoom Menu Dropdown */}
          {isZoomMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl bg-[#282a2c] py-1.5 shadow-2xl border border-white/10 text-xs text-[#e3e2e6] select-none animate-in fade-in zoom-in-95 duration-150">
              {ZOOM_OPTIONS.map((opt, idx) => {
                if (opt.label === 'divider') {
                  return <div key={`div-${idx}`} className="my-1.5 h-px bg-white/10" />;
                }
                const isSelected = zoomLevel === opt.value && opt.value > 0;
                return (
                  <button
                    key={`${opt.label}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onZoomChange(opt.value);
                      setIsZoomMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left font-medium transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/30 text-blue-300 font-bold'
                        : 'hover:bg-white/10 text-[#e3e2e6] hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <span className="text-blue-400 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onZoomChange(Math.min(200, zoomLevel + 25))}
          className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
          title="Phóng to"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>
    </div>
  );
};
