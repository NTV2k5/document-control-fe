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
import { FilePreviewModal } from '../../components/hubs';
import { formatBytes, listSharedFilesAPI, downloadDriveFile, shareDriveFileAPI, mapFileType } from 'api';
import { profileStore } from 'reactjs-platform/utilities';
import { useCallback, useEffect } from 'react';

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

export const SharedSection = (_props: ISharedSectionProps) => {
  const { locale } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'pdf' | 'docx' | 'xlsx'>('all');
  const [selectedDateSort, setSelectedDateSort] = useState<'desc' | 'asc'>('desc');
  const [sharedFiles, setSharedFiles] = useState<ISharedFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFileDetails, setSelectedFileDetails] = useState<ISharedFileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    entityName: string;
    fileName: string;
    mimeType?: string | null;
    fileUrl?: string | null;
  } | null>(null);
  const profile = profileStore((state) => state.profile);

  const fetchSharedFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSharedFilesAPI();
      const mapped = data.map((item: any): ISharedFileItem => ({
        id: item.name,
        name: item.file_name || 'Untitled',
        file_name: item.file_name || 'Untitled',
        file_size: item.file_size || 0,
        file_type: mapFileType(item.file_type || item.mime_type || '', item.file_name),
        shared_by: {
          name: item.owner_full_name || item.owner || 'System',
          email: item.owner || '',
        },
        shared_at: item.modified || item.creation || new Date().toISOString(),
        creation: item.creation || new Date().toISOString(),
        modified: item.modified || new Date().toISOString(),
        file_url: item.file_url || null,
      }));
      setSharedFiles(mapped);
    } catch (err) {
      console.error(err);
      toast.error(locale === 'vi' ? 'Không thể tải danh sách chia sẻ.' : 'Failed to load shared files.');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void fetchSharedFiles();
  }, [fetchSharedFiles]);

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

    const now = new Date();
    filteredFiles.forEach((file) => {
      const date = new Date(file.shared_at);
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        groups[0].items.push(file);
      } else if (diffDays <= 30) {
        groups[1].items.push(file);
      } else if (date.getFullYear() === now.getFullYear()) {
        groups[2].items.push(file);
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

  const handleDownload = async (file: ISharedFileItem) => {
    await downloadDriveFile(file.id, file.file_name);
  };

  const handleRemoveAccess = async (id: string, name: string) => {
    try {
      await shareDriveFileAPI({
        entity_name: id,
        method: 'unshare',
        user: profile?.email || '',
        read: 0,
      });
      setSharedFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success(
        locale === 'vi'
          ? `Đã xoá quyền truy cập tệp "${name}".`
          : `Removed access to file "${name}".`
      );
      window.dispatchEvent(new Event('drive-updated'));
    } catch (err) {
      console.error(err);
      toast.error(locale === 'vi' ? 'Gỡ quyền truy cập thất bại.' : 'Failed to remove access.');
    }
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

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-semibold text-slate-400 animate-pulse">
              {locale === 'vi' ? 'Đang tải dữ liệu...' : 'Loading shared files...'}
            </p>
          </div>
        )}

        {/* If no files */}
        {!loading && filteredFiles.length === 0 && (
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
        {!loading && groupedFiles.map((group) => (
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
                    <div
                      className="col-span-6 flex items-center gap-3 pr-4 cursor-pointer animate-fade-in"
                      onClick={() => setPreviewFile({
                        entityName: file.id,
                        fileName: file.file_name,
                        mimeType: file.file_type === 'pdf' ? 'application/pdf' : file.file_type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : null,
                        fileUrl: file.file_url,
                      })}
                    >
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

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          open={previewFile !== null}
          onClose={() => setPreviewFile(null)}
          entityName={previewFile.entityName || ''}
          fileName={previewFile.fileName || ''}
          mimeType={previewFile.mimeType}
          fileUrl={previewFile.fileUrl}
          items={sharedFiles.map((file) => ({
            entityName: file.id,
            fileName: file.file_name,
            mimeType: file.file_type === 'pdf' ? 'application/pdf' : file.file_type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : null,
            fileUrl: file.file_url,
          }))}
          currentIndex={Math.max(
            0,
            sharedFiles.findIndex((f) => f.file_name === previewFile.fileName || f.id === previewFile.entityName)
          )}
          onNavigate={(newIdx) => {
            const target = sharedFiles[newIdx];
            if (target) {
              setPreviewFile({
                entityName: target.id,
                fileName: target.file_name,
                mimeType: target.file_type === 'pdf' ? 'application/pdf' : target.file_type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : null,
                fileUrl: target.file_url,
              });
            }
          }}
        />
      )}
    </div>
  );
};
