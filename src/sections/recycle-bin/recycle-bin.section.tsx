import { useState, useMemo } from 'react';
import {
  FileText,
  RotateCcw,
  Trash2,
  MoreVertical,
  SlidersHorizontal,
  ChevronDown,
  Info,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { IRecycleBinSectionProps, IRecycleBinFileItem } from './recycle-bin.type';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'reactjs-platform/ui';
import { toast } from 'react-toastify';
import { useTranslation } from '../../i18n';
import { formatBytes } from '../../api/my-hubs/my-hubs.api';

const MOCK_TRASH_FILES: IRecycleBinFileItem[] = [
  {
    id: 'tr-1',
    name: 'Bản đồ không có tiêu đề',
    file_name: 'Bản đồ không có tiêu đề.pdf',
    file_size: 154000,
    file_type: 'pdf',
    owner: {
      name: 'tôi',
      email: 'khanh.jenkins@giadinh.edu.vn',
    },
    deleted_at: '2026-07-22T14:28:00.000Z',
    original_location: 'Drive của tôi',
    file_url: null,
  },
  {
    id: 'tr-2',
    name: 'Draft Document Outline',
    file_name: 'Draft Document Outline.docx',
    file_size: 42000,
    file_type: 'docx',
    owner: {
      name: 'tôi',
      email: 'khanh.jenkins@giadinh.edu.vn',
    },
    deleted_at: '2026-07-21T09:12:00.000Z',
    original_location: 'My Hubs / Research',
    file_url: null,
  },
  {
    id: 'tr-3',
    name: 'Q3 Budget Estimate (v1)',
    file_name: 'Q3 Budget Estimate (v1).xlsx',
    file_size: 1040000,
    file_type: 'xlsx',
    owner: {
      name: 'tôi',
      email: 'khanh.jenkins@giadinh.edu.vn',
    },
    deleted_at: '2026-07-15T16:45:00.000Z',
    original_location: 'University Hubs / Finance',
    file_url: null,
  },
];

export const RecycleBinSection = (_props: IRecycleBinSectionProps) => {
  const { locale } = useTranslation();
  const [trashFiles, setTrashFiles] = useState<IRecycleBinFileItem[]>(MOCK_TRASH_FILES);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'pdf' | 'docx' | 'xlsx'>('all');
  const [activeDialog, setActiveDialog] = useState<{
    type: 'delete_single' | 'empty_all';
    fileId?: string;
    fileName?: string;
  } | null>(null);

  // Filter logic
  const filteredFiles = useMemo(() => {
    let result = [...trashFiles];
    if (selectedTypeFilter !== 'all') {
      result = result.filter((f) => f.file_type === selectedTypeFilter);
    }
    return result;
  }, [trashFiles, selectedTypeFilter]);

  const renderFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
            <FileText className="size-4.5" />
          </div>
        );
      case 'docx':
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
            <FileText className="size-4.5" />
          </div>
        );
      case 'xlsx':
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
            <FileText className="size-4.5" />
          </div>
        );
      default:
        return (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
            <FileText className="size-4.5" />
          </div>
        );
    }
  };

  const handleRestore = (id: string, name: string) => {
    setTrashFiles((prev) => prev.filter((f) => f.id !== id));
    toast.success(
      locale === 'vi'
        ? `Đã khôi phục tài liệu: ${name}`
        : `Restored document: ${name}`
    );
    window.dispatchEvent(new Event('drive-updated'));
  };

  const handleDeleteConfirm = () => {
    if (!activeDialog) return;

    if (activeDialog.type === 'delete_single') {
      const id = activeDialog.fileId!;
      const name = activeDialog.fileName!;
      setTrashFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success(
        locale === 'vi'
          ? `Đã xoá vĩnh viễn tài liệu: ${name}`
          : `Permanently deleted document: ${name}`
      );
    } else if (activeDialog.type === 'empty_all') {
      setTrashFiles([]);
      toast.success(
        locale === 'vi'
          ? 'Đã dọn sạch thùng rác.'
          : 'Recycle bin has been emptied.'
      );
    }
    setActiveDialog(null);
    window.dispatchEvent(new Event('drive-updated'));
  };

  const formatDeletedDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      
      const now = new Date();
      // If deleted today, show hour:minute
      if (date.toDateString() === now.toDateString()) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      }

      if (locale === 'vi') {
        return `${date.getDate()} thg ${date.getMonth() + 1}, ${date.getFullYear()}`;
      }
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900 leading-tight">
          {locale === 'vi' ? 'Thùng rác' : 'Recycle Bin'}
        </h2>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex h-9 items-center gap-1.5 rounded-full border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span>{locale === 'vi' ? 'Loại' : 'Type'}</span>
              <ChevronDown className="size-3.5 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => setSelectedTypeFilter('all')}>
              {locale === 'vi' ? 'Tất cả các loại' : 'All types'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedTypeFilter('docx')}>
              Word
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedTypeFilter('xlsx')}>
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedTypeFilter('pdf')}>
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          className="flex h-9 items-center gap-1.5 rounded-full border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={() => toast.info(locale === 'vi' ? 'Bộ lọc thời gian chỉnh sửa thùng rác đang phát triển!' : 'Date filters coming soon!')}
        >
          <span>{locale === 'vi' ? 'Lần sửa đổi gần đây nhất' : 'Last modified'}</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </Button>

        <Button
          variant="outline"
          className="flex h-9 items-center gap-1.5 rounded-full border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={() => toast.info(locale === 'vi' ? 'Bộ lọc Nguồn tệp trong thùng rác đang phát triển!' : 'Source filters coming soon!')}
        >
          <span>{locale === 'vi' ? 'Nguồn' : 'Source'}</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </Button>
      </div>

      {/* Warning Alert Banner & Clean Actions */}
      <div className="flex flex-col gap-4 rounded-2xl bg-blue-50/50 border border-blue-100/50 p-4 sm:flex-row sm:items-center sm:justify-between px-6">
        <div className="flex items-center gap-3 text-blue-800">
          <AlertCircle className="size-5 shrink-0 text-blue-600" />
          <span className="text-xs font-bold leading-tight">
            {locale === 'vi' 
              ? 'Các mục trong thùng rác sẽ bị xoá vĩnh viễn sau 30 ngày' 
              : 'Items in the recycle bin will be deleted forever after 30 days'}
          </span>
        </div>
        
        {trashFiles.length > 0 && (
          <Button
            onClick={() => setActiveDialog({ type: 'empty_all' })}
            className="h-9 shrink-0 rounded-full bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-sm transition"
          >
            {locale === 'vi' ? 'Dọn sạch thùng rác' : 'Empty recycle bin'}
          </Button>
        )}
      </div>

      {/* Table List of Trashed Files */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        {/* Table Headers */}
        <div className="grid grid-cols-12 border-b border-slate-100 pb-3 text-xs font-semibold text-slate-500 px-4">
          <div className="col-span-5">{locale === 'vi' ? 'Tên' : 'Name'}</div>
          <div className="col-span-2">{locale === 'vi' ? 'Chủ sở hữu' : 'Owner'}</div>
          <div className="col-span-2">{locale === 'vi' ? 'Ngày chuyển vào...' : 'Date moved'}</div>
          <div className="col-span-1">{locale === 'vi' ? 'Kích cỡ' : 'Size'}</div>
          <div className="col-span-1.5">{locale === 'vi' ? 'Vị trí gốc' : 'Original location'}</div>
          <div className="col-span-0.5 text-right"></div>
        </div>

        {/* Empty state */}
        {filteredFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-3">
              <Trash2 className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {locale === 'vi' ? 'Thùng rác trống.' : 'Recycle bin is empty.'}
            </p>
          </div>
        )}

        {/* List items */}
        <div className="divide-y divide-slate-50">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-12 items-center rounded-2xl hover:bg-slate-50/70 p-3 px-4 transition duration-200 group/row"
            >
              {/* Name column */}
              <div className="col-span-5 flex items-center gap-3 pr-4">
                {renderFileIcon(file.file_type)}
                <span className="truncate text-[13.5px] font-bold text-slate-700 leading-tight">
                  {file.file_name}
                </span>
              </div>

              {/* Owner column */}
              <div className="col-span-2 text-xs font-bold text-slate-600">
                {file.owner.name === 'tôi' && locale === 'vi' ? 'tôi' : file.owner.name === 'tôi' ? 'me' : file.owner.name}
              </div>

              {/* Date column */}
              <div className="col-span-2 text-xs font-medium text-slate-500">
                {formatDeletedDate(file.deleted_at)}
              </div>

              {/* Size column */}
              <div className="col-span-1 text-xs font-medium text-slate-500">
                {file.file_size > 0 ? formatBytes(file.file_size) : '—'}
              </div>

              {/* Location column */}
              <div className="col-span-1.5 truncate text-xs font-semibold text-slate-500 pr-2">
                {file.original_location}
              </div>

              {/* Actions column */}
              <div className="col-span-0.5 flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-0"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => handleRestore(file.id, file.file_name)}>
                      <RotateCcw className="mr-2 size-4 text-slate-500" />
                      {locale === 'vi' ? 'Khôi phục' : 'Restore'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      onClick={() =>
                        setActiveDialog({
                          type: 'delete_single',
                          fileId: file.id,
                          fileName: file.file_name,
                        })
                      }
                    >
                      <Trash2 className="mr-2 size-4 text-red-500" />
                      {locale === 'vi' ? 'Xoá vĩnh viễn' : 'Delete forever'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={activeDialog !== null} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold text-slate-800 flex items-center gap-2">
              <AlertCircle className="size-5 text-red-500" />
              {activeDialog?.type === 'delete_single'
                ? (locale === 'vi' ? 'Xoá vĩnh viễn tài liệu?' : 'Delete permanently?')
                : (locale === 'vi' ? 'Dọn sạch thùng rác?' : 'Empty recycle bin?')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium pt-2">
              {activeDialog?.type === 'delete_single'
                ? (locale === 'vi'
                    ? `Tài liệu "${activeDialog.fileName}" sẽ bị xoá vĩnh viễn và không thể khôi phục lại.`
                    : `"${activeDialog.fileName}" will be deleted permanently. You cannot undo this action.`)
                : (locale === 'vi'
                    ? 'Tất cả các mục trong thùng rác sẽ bị xoá vĩnh viễn. Bạn không thể hoàn tác hành động này.'
                    : 'All items in the recycle bin will be permanently deleted. This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => setActiveDialog(null)}
              className="rounded-xl border border-slate-200 text-slate-500 font-bold text-xs px-4"
            >
              {locale === 'vi' ? 'Huỷ' : 'Cancel'}
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              className="rounded-xl bg-red-600 hover:bg-red-700 font-bold text-xs text-white px-4"
            >
              {locale === 'vi' ? 'Xoá vĩnh viễn' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
