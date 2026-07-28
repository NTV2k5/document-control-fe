import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ExternalLink,
  Plus,
  Share2,
  Copy,
  Download,
  Edit2,
  FolderInput,
  Star,
  Info,
  ShieldAlert,
  Printer,
  Eye,
  Maximize,
  MessageSquare,
  Search,
  FileSignature,
  Bell,
  HelpCircle,
  Keyboard,
  Check,
  FileText
} from 'lucide-react';
import type { IPreviewMenuDropdownProps, IMenuItem } from './preview-menu-dropdown.type';

export const PreviewMenuDropdown = ({
  activeMenu,
  onClose,
  onAction,
  menuAnchorPos = { left: 16, top: 48 },
}: IPreviewMenuDropdownProps) => {
  const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!activeMenu) return null;

  const getMenuItems = (): IMenuItem[] => {
    switch (activeMenu) {
      case 'file':
        return [
          {
            id: 'open',
            label: 'Mở',
            icon: <FileText className="size-4 text-blue-400" />,
            hasSubmenu: true,
            submenuItems: [
              { id: 'open_docs', label: 'Mở bằng Google Tài liệu', icon: <FileText className="size-4 text-blue-400" /> },
              { id: 'open_new_window', label: 'Mở trong cửa sổ mới', icon: <ExternalLink className="size-4 text-slate-300" /> },
              { id: 'connect_app', label: 'Kết nối ứng dụng khác', icon: <Plus className="size-4 text-slate-300" /> },
            ],
          },
          { id: 'div1', label: '', divider: true },
          {
            id: 'share',
            label: 'Chia sẻ',
            icon: <Share2 className="size-4 text-[#a8c7fa]" />,
            hasSubmenu: true,
            submenuItems: [
              { id: 'share_others', label: 'Chia sẻ với người khác', icon: <Share2 className="size-4" /> },
              { id: 'copy_link', label: 'Sao chép liên kết', icon: <Copy className="size-4" /> },
            ],
          },
          { id: 'download', label: 'Tải xuống', icon: <Download className="size-4" />, shortcut: 'Ctrl+D' },
          { id: 'div2', label: '', divider: true },
          { id: 'rename', label: 'Đổi tên', icon: <Edit2 className="size-4" /> },
          { id: 'move', label: 'Di chuyển', icon: <FolderInput className="size-4" /> },
          { id: 'star', label: 'Gắn dấu sao', icon: <Star className="size-4 text-amber-400" />, shortcut: 'S' },
          { id: 'div3', label: '', divider: true },
          { id: 'details', label: 'Chi tiết', icon: <Info className="size-4" />, shortcut: 'D' },
          { id: 'security', label: 'Giới hạn về mức bảo mật', icon: <ShieldAlert className="size-4 text-amber-400" /> },
          { id: 'print', label: 'In', icon: <Printer className="size-4" />, shortcut: 'Ctrl+P' },
        ];

      case 'view':
        return [
          {
            id: 'display',
            label: 'Hiển thị',
            icon: <Eye className="size-4 text-emerald-400" />,
            hasSubmenu: true,
            submenuItems: [
              { id: 'toggle_borders', label: 'Hiển thị ranh giới trang', checked: true },
              { id: 'toggle_two_pages', label: 'Chế độ trang đôi', checked: false },
              { id: 'fullscreen', label: 'Toàn màn hình', icon: <Maximize className="size-4" /> },
            ],
          },
          {
            id: 'comments',
            label: 'Nhận xét',
            icon: <MessageSquare className="size-4 text-blue-400" />,
            hasSubmenu: true,
            submenuItems: [
              { id: 'toggle_comments', label: 'Hiển thị nhận xét', checked: true },
              { id: 'comment_history', label: 'Hiển thị lịch sử nhận xét' },
            ],
          },
          { id: 'div_v1', label: '', divider: true },
          {
            id: 'zoom',
            label: 'Thu phóng',
            hasSubmenu: true,
            submenuItems: [
              { id: 'zoom_50', label: '50%' },
              { id: 'zoom_75', label: '75%' },
              { id: 'zoom_100', label: '100% (Mặc định)', checked: true },
              { id: 'zoom_125', label: '125%' },
              { id: 'zoom_150', label: '150%' },
              { id: 'zoom_200', label: '200%' },
              { id: 'div_z', label: '', divider: true },
              { id: 'zoom_fit_page', label: 'Vừa màn hình' },
              { id: 'zoom_fit_width', label: 'Vừa chiều rộng' },
            ],
          },
        ];

      case 'insert':
        return [
          { id: 'add_comment', label: 'Thêm nhận xét', icon: <MessageSquare className="size-4 text-blue-400" /> },
        ];

      case 'tools':
        return [
          { id: 'search', label: 'Tìm', icon: <Search className="size-4 text-amber-400" />, shortcut: 'Ctrl+F' },
          { id: 'esignature', label: 'Yêu cầu chữ ký điện tử', icon: <FileSignature className="size-4 text-[#a8c7fa]" /> },
          { id: 'div_t1', label: '', divider: true },
          { id: 'notifications', label: 'Quản lý thông báo', icon: <Bell className="size-4" /> },
        ];

      case 'help':
        return [
          { id: 'feedback', label: 'Gửi ý kiến phản hồi cho Google', icon: <HelpCircle className="size-4 text-emerald-400" /> },
          { id: 'div_h1', label: '', divider: true },
          { id: 'shortcuts', label: 'Phím tắt', icon: <Keyboard className="size-4" />, shortcut: 'Ctrl+/' },
        ];

      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  return (
    <div
      ref={dropdownRef}
      style={{ left: `${menuAnchorPos.left}px`, top: `${menuAnchorPos.top}px` }}
      className="fixed z-[10000] min-w-[250px] max-w-[320px] rounded-xl bg-[#282a2c] py-1.5 shadow-2xl border border-white/10 text-xs text-[#e3e2e6] select-none animate-in fade-in zoom-in-95 duration-150"
      role="menu"
    >
      {menuItems.map((item) => {
        if (item.divider) {
          return <div key={item.id} className="my-1.5 h-px bg-white/10" />;
        }

        const isSubmenuOpen = activeSubmenuId === item.id;

        return (
          <div
            key={item.id}
            className="relative"
            onMouseEnter={() => item.hasSubmenu && setActiveSubmenuId(item.id)}
            onMouseLeave={() => item.hasSubmenu && setActiveSubmenuId(null)}
          >
            <button
              type="button"
              onClick={() => {
                if (!item.hasSubmenu) {
                  onAction(item.id);
                  onClose();
                }
              }}
              disabled={item.disabled}
              className={`w-full px-3 py-2 flex items-center justify-between transition-colors text-left cursor-pointer ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : isSubmenuOpen
                    ? 'bg-white/15 text-white'
                    : 'hover:bg-white/10 text-[#e3e2e6] hover:text-white'
              }`}
              role="menuitem"
            >
              {/* Col 1: Icon / Check */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="size-4 shrink-0 flex items-center justify-center">
                  {item.checked ? <Check className="size-3.5 text-blue-400 stroke-[3]" /> : item.icon}
                </div>
                {/* Col 2: Label */}
                <span className="truncate text-[13px] font-medium">{item.label}</span>
              </div>

              {/* Col 3: Shortcut */}
              {item.shortcut && (
                <span className="ml-4 text-[11px] font-mono text-[#9aa0a6] tracking-wider shrink-0">
                  {item.shortcut}
                </span>
              )}

              {/* Col 4: Submenu Chevron */}
              {item.hasSubmenu && <ChevronRight className="size-4 ml-2 text-[#9aa0a6] shrink-0" />}
            </button>

            {/* Flyout Submenu */}
            {item.hasSubmenu && isSubmenuOpen && item.submenuItems && (
              <div className="absolute left-full top-0 ml-1 min-w-[220px] rounded-xl bg-[#282a2c] py-1.5 shadow-2xl border border-white/10 text-xs text-[#e3e2e6] select-none animate-in fade-in zoom-in-95 duration-150 z-[10001]">
                {item.submenuItems.map((subItem) => {
                  if (subItem.divider) {
                    return <div key={subItem.id} className="my-1.5 h-px bg-white/10" />;
                  }
                  return (
                    <button
                      key={subItem.id}
                      type="button"
                      onClick={() => {
                        onAction(subItem.id);
                        onClose();
                      }}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-white/10 text-left transition-colors text-[#e3e2e6] hover:text-white cursor-pointer"
                    >
                      <div className="size-4 shrink-0 flex items-center justify-center">
                        {subItem.checked ? <Check className="size-3.5 text-blue-400 stroke-[3]" /> : subItem.icon}
                      </div>
                      <span className="truncate text-[13px] font-medium">{subItem.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
