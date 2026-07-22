import { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Share2,
  MoreVertical,
  SlidersHorizontal,
  ChevronDown,
  Search,
  ExternalLink,
  Star,
  Trash2,
  Info,
} from 'lucide-react';
import type { ISharedSectionProps, ISharedFileItem } from './shared.type';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from 'reactjs-platform/ui';
import { toast } from 'react-toastify';
import { useTranslation } from '../../i18n';
import { formatBytes } from '../../api/my-hubs/my-hubs.api';

// Helper to format date relative to locale
const formatDate = (isoString: string, locale: string) => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    
    if (locale === 'vi') {
      const day = date.getDate();
      const month = date.getMonth() + 1;
      return `${day} thg ${month}`;
    }
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  } catch {
    return isoString;
  }
};

const MOCK_SHARED_FILES: ISharedFileItem[] = [
  {
    id: 'sh-1',
    name: 'ZALO_MINI_APP',
    file_name: 'ZALO_MINI_APP.docx',
    file_size: 452000,
    file_type: 'docx',
    shared_by: {
      name: 'Nguyễn Văn Sơn',
      email: '51gold141@gmail.com',
    },
    shared_at: '2026-07-17T10:00:00.000Z',
    creation: '2026-07-17T10:00:00.000Z',
    modified: '2026-07-17T10:00:00.000Z',
    file_url: null,
  },
  {
    id: 'sh-2',
    name: 'Document Management (Checklist)',
    file_name: 'Document Management (Checklist).docx',
    file_size: 1845000,
    file_type: 'docx',
    shared_by: {
      name: 'Trần Gia Long',
      email: 'trangialongskd18@gmail.com',
    },
    shared_at: '2026-07-16T15:30:00.000Z',
    creation: '2026-07-16T15:30:00.000Z',
    modified: '2026-07-16T15:30:00.000Z',
    file_url: null,
  },
  {
    id: 'sh-3',
    name: 'Ban giao Doc Control',
    file_name: 'Ban giao Doc Control.pdf',
    file_size: 8932000,
    file_type: 'pdf',
    shared_by: {
      name: 'Tâm Phan',
      email: 'tamphan1509.work@gmail.com',
    },
    shared_at: '2026-07-06T09:15:00.000Z',
    creation: '2026-07-06T09:15:00.000Z',
    modified: '2026-07-06T09:15:00.000Z',
    file_url: null,
  },
  {
    id: 'sh-4',
    name: 'Mẫu 2_Báo cáo thực tập',
    file_name: 'Mẫu 2_Báo cáo thực tập.xlsx',
    file_size: 142000,
    file_type: 'xlsx',
    shared_by: {
      name: 'Nguyễn Hữu Tài',
      email: 'nhon.ta@samedtech.edu.vn',
    },
    shared_at: '2026-03-26T08:00:00.000Z',
    creation: '2026-03-26T08:00:00.000Z',
    modified: '2026-03-26T08:00:00.000Z',
    file_url: null,
  },
  {
    id: 'sh-5',
    name: 'Moodle system overview presentation',
    file_name: 'Moodle system overview presentation.pdf',
    file_size: 12450000,
    file_type: 'pdf',
    shared_by: {
      name: 'Vinh Đỗ',
      email: 'vinhdzcx111@gmail.com',
    },
    shared_at: '2025-12-29T14:20:00.000Z',
    creation: '2025-12-29T14:20:00.000Z',
    modified: '2025-12-29T14:20:00.000Z',
    file_url: null,
  },
  {
    id: 'sh-6',
    name: 'task_management',
    file_name: 'task_management.xlsx',
    file_size: 32000,
    file_type: 'xlsx',
    shared_by: {
      name: 'Đinh Tiến Quốc',
      email: 'dinh.tquoc@gmail.com',
    },
    shared_at: '2025-12-16T11:05:00.000Z',
    creation: '2025-12-16T11:05:00.000Z',
    modified: '2025-12-16T11:05:00.000Z',
    file_url: null,
  },
];

export const SharedSection = (_props: ISharedSectionProps) => {
  const { locale } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'pdf' | 'docx' | 'xlsx'>('all');
  const [selectedDateSort, setSelectedDateSort] = useState<'desc' | 'asc'>('desc');
  const [sharedFiles, setSharedFiles] = useState<ISharedFileItem[]>(MOCK_SHARED_FILES);
  const [selectedFileDetails, setSelectedFileDetails] = useState<ISharedFileItem | null>(null);

  // Group files by time relative to now (July 2026 in mockup timeline)
  // For the mockup's date, we use:
  // Week ago: id sh-1, sh-2
  // Earlier this month: id sh-3
  // Earlier this year: id sh-4
  // Older: id sh-5, sh-6
  const filteredFiles = useMemo(() => {
    let result = [...sharedFiles];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.file_name.toLowerCase().includes(q) ||
          f.shared_by.name.toLowerCase().includes(q) ||
          f.shared_by.email.toLowerCase().includes(q),
      );
    }

    if (selectedTypeFilter !== 'all') {
      result = result.filter((f) => f.file_type === selectedTypeFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.shared_at).getTime();
      const dateB = new Date(b.shared_at).getTime();
      return selectedDateSort === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [sharedFiles, searchQuery, selectedTypeFilter, selectedDateSort]);

  // Grouping helper
  const groupedFiles = useMemo(() => {
    const groups: {
      id: string;
      titleVi: string;
      titleEn: string;
      items: ISharedFileItem[];
    }[] = [
      { id: 'week', titleVi: 'Tuần trước', titleEn: 'Last week', items: [] },
      { id: 'month', titleVi: 'Đầu tháng này', titleEn: 'Earlier this month', items: [] },
      { id: 'year', titleVi: 'Đầu năm nay', titleEn: 'Earlier this year', items: [] },
      { id: 'older', titleVi: 'Cũ hơn', titleEn: 'Older', items: [] },
    ];

    filteredFiles.forEach((file) => {
      const date = new Date(file.shared_at);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // 0-indexed

      // Mock date categorization matching the dates:
      // sh-1 (17 thg 7, 2026) -> week
      // sh-2 (16 thg 7, 2026) -> week
      // sh-3 (6 thg 7, 2026) -> month
      // sh-4 (26 thg 3, 2026) -> year
      // sh-5, sh-6 (Dec 2025) -> older
      if (year === 2026) {
        if (month === 7) {
          const day = date.getDate();
          if (day >= 10) {
            groups[0].items.push(file);
          } else {
            groups[1].items.push(file);
          }
        } else {
          groups[2].items.push(file);
        }
      } else {
        groups[3].items.push(file);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  }, [filteredFiles]);

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

  const handleDownload = (file: ISharedFileItem) => {
    toast.info(
      locale === 'vi' 
        ? `Đang tải xuống tệp: ${file.file_name}` 
        : `Downloading file: ${file.file_name}`
    );
  };

  const handleRemoveAccess = (id: string, name: string) => {
    setSharedFiles((prev) => prev.filter((f) => f.id !== id));
    toast.success(
      locale === 'vi'
        ? `Đã xoá tệp "${name}" khỏi danh sách chia sẻ.`
        : `Removed "${name}" from shared files list.`
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold text-slate-900 leading-tight">
          {locale === 'vi' ? 'Được chia sẻ với tôi' : 'Shared with me'}
        </h2>

        {/* Local Search */}
        <div className="relative w-full max-w-md sm:w-80">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === 'vi' ? 'Tìm trong tệp chia sẻ...' : 'Search shared files...'}
            className="h-10 w-full rounded-full border-slate-200 bg-white pl-10 pr-4 text-sm focus-visible:ring-blue-600"
          />
        </div>
      </div>

      {/* Filter Row (Google Drive Mock Style) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type Filter */}
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

        {/* Sender Filter (Static Demonstration) */}
        <Button
          variant="outline"
          className="flex h-9 items-center gap-1.5 rounded-full border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={() => toast.info(locale === 'vi' ? 'Bộ lọc Người chia sẻ sẽ khả dụng khi kết nối hệ thống!' : 'Shared by filter will be available soon!')}
        >
          <span>{locale === 'vi' ? 'Người' : 'People'}</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </Button>

        {/* Last Modified Filter */}
        <Button
          variant="outline"
          className="flex h-9 items-center gap-1.5 rounded-full border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={() => toast.info(locale === 'vi' ? 'Bộ lọc Thời gian chỉnh sửa sắp ra mắt!' : 'Modified filter coming soon!')}
        >
          <span>{locale === 'vi' ? 'Lần sửa đổi gần đây nhất' : 'Last modified'}</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </Button>

        {/* Source Filter */}
        <Button
          variant="outline"
          className="flex h-9 items-center gap-1.5 rounded-full border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={() => toast.info(locale === 'vi' ? 'Bộ lọc Nguồn tệp sắp được hỗ trợ!' : 'Source filter coming soon!')}
        >
          <span>{locale === 'vi' ? 'Nguồn' : 'Source'}</span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </Button>
      </div>

      {/* Main Files Grouped List */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        {/* Table Headers */}
        <div className="grid grid-cols-12 border-b border-slate-100 pb-3 text-xs font-semibold text-slate-500 px-4">
          <div className="col-span-6">{locale === 'vi' ? 'Tên' : 'Name'}</div>
          <div className="col-span-3">{locale === 'vi' ? 'Người chia sẻ' : 'Shared by'}</div>
          <div className="col-span-2 flex items-center gap-1 cursor-pointer select-none hover:text-slate-700" onClick={() => setSelectedDateSort(selectedDateSort === 'desc' ? 'asc' : 'desc')}>
            <span>{locale === 'vi' ? 'Ngày chia sẻ' : 'Date shared'}</span>
            <span className={`transition-transform duration-250 text-blue-500 font-bold ${selectedDateSort === 'asc' ? 'rotate-180' : ''}`}>↓</span>
          </div>
          <div className="col-span-1 text-right">{locale === 'vi' ? 'Sắp xếp' : 'Actions'}</div>
        </div>

        {/* If no files */}
        {filteredFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-3">
              <Info className="size-6" />
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {locale === 'vi' ? 'Không tìm thấy tài liệu được chia sẻ nào.' : 'No shared files found.'}
            </p>
          </div>
        )}

        {/* Render Groups */}
        {groupedFiles.map((group) => (
          <div key={group.id} className="mt-6 first:mt-3">
            {/* Group Title */}
            <h3 className="mb-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              {locale === 'vi' ? group.titleVi : group.titleEn}
            </h3>

            {/* Group Items */}
            <div className="divide-y divide-slate-50">
              {group.items.map((file) => {
                const initial = file.shared_by.name.charAt(0).toUpperCase() || 'U';
                
                return (
                  <div
                    key={file.id}
                    className="grid grid-cols-12 items-center rounded-2xl hover:bg-slate-50/70 p-3 px-4 transition duration-200 group/row"
                  >
                    {/* Name Column */}
                    <div className="col-span-6 flex items-center gap-3 pr-4">
                      {renderFileIcon(file.file_type)}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-[13.5px] font-bold text-slate-700 leading-tight group-hover/row:text-blue-600 transition-colors">
                          {file.file_name}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {formatBytes(file.file_size)}
                        </span>
                      </div>
                    </div>

                    {/* Shared By Column */}
                    <div className="col-span-3 flex items-center gap-2.5 pr-4">
                      {/* Avatar */}
                      <div className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {initial}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs font-bold text-slate-700 leading-tight">
                          {file.shared_by.name}
                        </span>
                        <span className="truncate text-[10px] text-slate-400 font-medium">
                          {file.shared_by.email}
                        </span>
                      </div>
                    </div>

                    {/* Date Column */}
                    <div className="col-span-2 text-xs font-medium text-slate-500">
                      {formatDate(file.shared_at, locale)}
                    </div>

                    {/* Action Column */}
                    <div className="col-span-1 flex justify-end">
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
                          <DropdownMenuItem onClick={() => setSelectedFileDetails(file)}>
                            <Info className="mr-2 size-4 text-slate-500" />
                            {locale === 'vi' ? 'Xem chi tiết' : 'View Details'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(file)}>
                            <Download className="mr-2 size-4 text-slate-500" />
                            {locale === 'vi' ? 'Tải xuống' : 'Download'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info(locale === 'vi' ? 'Tính năng ghim tệp đang phát triển!' : 'Starred features coming soon!')}>
                            <Star className="mr-2 size-4 text-slate-500" />
                            {locale === 'vi' ? 'Thêm vào mục có dấu sao' : 'Add to starred'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => handleRemoveAccess(file.id, file.file_name)}
                          >
                            <Trash2 className="mr-2 size-4 text-red-500" />
                            {locale === 'vi' ? 'Xoá khỏi tệp chia sẻ' : 'Remove access'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Details Dialog */}
      <Dialog open={selectedFileDetails !== null} onOpenChange={(open) => !open && setSelectedFileDetails(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          {selectedFileDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[17px] font-bold text-slate-800 flex items-center gap-2">
                  <Info className="size-5 text-blue-600" />
                  {locale === 'vi' ? 'Chi tiết tài liệu' : 'File Details'}
                </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  {renderFileIcon(selectedFileDetails.file_type)}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-800 truncate">
                      {selectedFileDetails.file_name}
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {formatBytes(selectedFileDetails.file_size)}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border-t border-b border-slate-100 text-xs font-medium text-slate-600">
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-400">{locale === 'vi' ? 'Định dạng' : 'Format'}</span>
                    <span className="uppercase text-slate-700 font-bold">{selectedFileDetails.file_type}</span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-400">{locale === 'vi' ? 'Người chia sẻ' : 'Shared by'}</span>
                    <span className="text-slate-700 font-bold">
                      {selectedFileDetails.shared_by.name} ({selectedFileDetails.shared_by.email})
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-400">{locale === 'vi' ? 'Ngày chia sẻ' : 'Date shared'}</span>
                    <span className="text-slate-700">
                      {new Date(selectedFileDetails.shared_at).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                    </span>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <span className="text-slate-400">{locale === 'vi' ? 'Ngày tạo' : 'Created at'}</span>
                    <span className="text-slate-700">
                      {new Date(selectedFileDetails.creation).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button
                  onClick={() => {
                    handleDownload(selectedFileDetails);
                    setSelectedFileDetails(null);
                  }}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white flex-1"
                >
                  <Download className="mr-1.5 size-4" />
                  {locale === 'vi' ? 'Tải xuống' : 'Download'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedFileDetails(null)}
                  className="rounded-xl border border-slate-200 text-slate-500 font-bold text-xs"
                >
                  {locale === 'vi' ? 'Đóng' : 'Close'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
