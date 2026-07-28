import { useState, useEffect } from 'react';
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

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(pageInput, 10);
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      onPageChange(val);
    } else {
      setPageInput(currentPage.toString());
    }
  };

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
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onZoomChange(Math.max(50, zoomLevel - 25))}
          className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
          title="Thu nhỏ"
        >
          <ZoomOut className="size-4" />
        </button>

        <button
          type="button"
          onClick={() => onZoomChange(100)}
          className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded transition text-xs font-medium cursor-pointer text-white"
        >
          <span>{zoomLevel}%</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </button>

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
