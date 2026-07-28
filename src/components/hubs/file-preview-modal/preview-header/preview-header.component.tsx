import { useRef } from 'react';
import {
  X,
  Lock,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  FileCode,
  File,
  FolderPlus,
} from 'lucide-react';
import type { IPreviewHeaderProps } from './preview-header.type';
import type { TMenuCategory } from '../preview-menu-dropdown';

export const PreviewHeader = ({
  fileName,
  mimeCategory,
  activeMenu,
  onMenuToggle,
  onClose,
  onShare,
}: IPreviewHeaderProps) => {
  const menuBarRef = useRef<HTMLDivElement>(null);

  const getFileIcon = () => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (ext === 'xlsx' || ext === 'xls' || (mimeCategory === 'office' && fileName.includes('sheet'))) {
      return <FileSpreadsheet className="size-5 text-emerald-400" />;
    }
    if (ext === 'docx' || ext === 'doc' || (mimeCategory === 'office' && (fileName.includes('doc') || fileName.includes('báo cáo')))) {
      return <FileText className="size-5 text-blue-400" />;
    }
    if (ext === 'pptx' || ext === 'ppt') {
      return <Presentation className="size-5 text-amber-400" />;
    }
    if (mimeCategory === 'pdf' || ext === 'pdf') {
      return <FileText className="size-5 text-red-400" />;
    }
    if (mimeCategory === 'image') {
      return <ImageIcon className="size-5 text-purple-400" />;
    }
    if (mimeCategory === 'code_text') {
      return <FileCode className="size-5 text-slate-300" />;
    }
    return <File className="size-5 text-slate-400" />;
  };

  const getOpenWithText = () => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pptx' || ext === 'ppt') return 'Mở bằng Google Trang trình trình...';
    if (ext === 'xlsx' || ext === 'xls') return 'Mở bằng Google Trang tính';
    return 'Mở bằng Google Tài liệu';
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>, menu: TMenuCategory) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onMenuToggle(menu, { left: rect.left, top: rect.bottom + 4 });
  };

  return (
    <header className="h-16 bg-[#111318] text-white border-b border-white/10 px-4 flex items-center justify-between shrink-0 select-none z-50">
      {/* Left Area: Close Button + Vertical Stack (Title on Line 1, Menus on Line 2) */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer shrink-0"
          title="Đóng (Esc)"
        >
          <X className="size-5" />
        </button>

        <div className="flex flex-col justify-center min-w-0 py-1">
          {/* Line 1: File Icon + File Name + Drive Add Icon */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="shrink-0">{getFileIcon()}</div>
            <span
              className="text-sm font-semibold text-white/90 truncate max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg"
              title={fileName}
            >
              {fileName}
            </span>
            <button
              type="button"
              className="p-1 text-white/70 hover:text-white rounded hover:bg-white/10 transition cursor-pointer shrink-0"
              title="Thêm vào Drive"
            >
              <FolderPlus className="size-4" />
            </button>
          </div>

          {/* Line 2: Desktop MenuBar (Tệp, Xem, Chèn, Công cụ, Trợ giúp) */}
          <div ref={menuBarRef} className="flex items-center gap-1 text-xs text-[#c4c6d0] mt-0.5">
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, 'file')}
              className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                activeMenu === 'file' ? 'bg-white/20 text-white' : 'hover:bg-white/10 hover:text-white'
              }`}
            >
              Tệp
            </button>
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, 'view')}
              className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                activeMenu === 'view' ? 'bg-white/20 text-white' : 'hover:bg-white/10 hover:text-white'
              }`}
            >
              Xem
            </button>
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, 'insert')}
              className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                activeMenu === 'insert' ? 'bg-white/20 text-white' : 'hover:bg-white/10 hover:text-white'
              }`}
            >
              Chèn
            </button>
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, 'tools')}
              className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                activeMenu === 'tools' ? 'bg-white/20 text-white' : 'hover:bg-white/10 hover:text-white'
              }`}
            >
              Công cụ
            </button>
            <button
              type="button"
              onClick={(e) => handleMenuClick(e, 'help')}
              className={`px-2 py-0.5 rounded transition cursor-pointer font-medium ${
                activeMenu === 'help' ? 'bg-white/20 text-white' : 'hover:bg-white/10 hover:text-white'
              }`}
            >
              Trợ giúp
            </button>
          </div>
        </div>
      </div>

      {/* Right Area: Split Pill Buttons ("Mở bằng..." and "Chia sẻ") */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* "Mở bằng Google..." Split Pill Button */}
        <div className="bg-[#282a2c] border border-white/20 rounded-full flex items-center h-9 overflow-hidden text-xs text-white shadow-sm">
          <button
            type="button"
            onClick={(e) => handleMenuClick(e, 'file')}
            className="px-3.5 h-full flex items-center gap-2 hover:bg-white/10 transition cursor-pointer font-medium"
          >
            {getFileIcon()}
            <span className="hidden sm:inline truncate max-w-[180px]">{getOpenWithText()}</span>
            <span className="sm:hidden">Mở bằng</span>
          </button>
          <div className="h-full w-px bg-white/20" />
          <button
            type="button"
            onClick={(e) => handleMenuClick(e, 'file')}
            className="px-2.5 h-full flex items-center justify-center hover:bg-white/10 transition cursor-pointer text-white/80"
          >
            <ChevronDown className="size-4 opacity-80" />
          </button>
        </div>

        {/* "Chia sẻ" Split Pill Button */}
        <div className="bg-[#004a77] hover:bg-[#005a92] text-[#c2e7ff] rounded-full flex items-center h-9 overflow-hidden text-xs font-semibold shadow-sm">
          <button
            type="button"
            onClick={onShare}
            className="px-3.5 h-full flex items-center gap-1.5 hover:bg-white/10 transition cursor-pointer"
          >
            <Lock className="size-3.5 stroke-[2.5]" />
            <span>Chia sẻ</span>
          </button>
          <div className="h-full w-px bg-white/20" />
          <button
            type="button"
            onClick={onShare}
            className="px-2.5 h-full flex items-center justify-center hover:bg-white/10 transition cursor-pointer"
          >
            <ChevronDown className="size-3.5 opacity-90" />
          </button>
        </div>
      </div>
    </header>
  );
};
