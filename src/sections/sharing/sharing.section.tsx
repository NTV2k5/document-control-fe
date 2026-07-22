import { useState, useMemo } from 'react';
import {
  FileText,
  Share2,
  Globe,
  Lock,
  Link as LinkIcon,
  ChevronDown,
  Info,
  User,
  Users,
  Plus,
  X,
  Check,
  Search,
  MoreVertical,
  Download,
  Trash2,
} from 'lucide-react';
import type { ISharingSectionProps, ISharingFileItem, ISharedUser, TSharedRole, TGeneralAccessScope } from './sharing.type';
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

const MOCK_SHARING_FILES: ISharingFileItem[] = [
  {
    id: 'sg-1',
    name: 'Ban giao Doc Control',
    file_name: 'Ban giao Doc Control.pdf',
    file_size: 8932000,
    file_type: 'pdf',
    owner: {
      name: 'Khanh Jenkins',
      email: 'khanh.jenkins@giadinh.edu.vn',
    },
    shared_users: [
      { email: 'tamphan1509.work@gmail.com', name: 'Tâm Phan', role: 'editor' },
      { email: 'trangialongskd18@gmail.com', name: 'Trần Gia Long', role: 'viewer' },
    ],
    general_access: {
      scope: 'restricted',
      role: 'viewer',
    },
    modified: '2026-07-22T08:30:00.000Z',
    file_url: null,
  },
  {
    id: 'sg-2',
    name: 'ZALO_MINI_APP',
    file_name: 'ZALO_MINI_APP.docx',
    file_size: 452000,
    file_type: 'docx',
    owner: {
      name: 'Khanh Jenkins',
      email: 'khanh.jenkins@giadinh.edu.vn',
    },
    shared_users: [
      { email: '51gold141@gmail.com', name: 'Nguyễn Văn Sơn', role: 'editor' },
    ],
    general_access: {
      scope: 'restricted',
      role: 'viewer',
    },
    modified: '2026-07-20T10:15:00.000Z',
    file_url: null,
  },
  {
    id: 'sg-3',
    name: 'Mẫu 2_Báo cáo thực tập',
    file_name: 'Mẫu 2_Báo cáo thực tập.xlsx',
    file_size: 142000,
    file_type: 'xlsx',
    owner: {
      name: 'Khanh Jenkins',
      email: 'khanh.jenkins@giadinh.edu.vn',
    },
    shared_users: [
      { email: 'nhon.ta@samedtech.edu.vn', name: 'Nguyễn Hữu Tài', role: 'editor' },
    ],
    general_access: {
      scope: 'anyone',
      role: 'viewer',
    },
    modified: '2026-07-18T14:40:00.000Z',
    file_url: null,
  },
];

export const SharingSection = (_props: ISharingSectionProps) => {
  const { locale } = useTranslation();
  const [sharingFiles, setSharingFiles] = useState<ISharingFileItem[]>(MOCK_SHARING_FILES);
  const [selectedFile, setSelectedFile] = useState<ISharingFileItem | null>(null);
  
  // Modal states
  const [newShareEmail, setNewShareEmail] = useState('');
  const [newShareRole, setNewShareRole] = useState<TSharedRole>('viewer');
  const [modalSharedUsers, setModalSharedUsers] = useState<ISharedUser[]>([]);
  const [modalGeneralAccess, setModalGeneralAccess] = useState<{
    scope: TGeneralAccessScope;
    role: TSharedRole;
  }>({ scope: 'restricted', role: 'viewer' });

  const handleOpenShareModal = (file: ISharingFileItem) => {
    setSelectedFile(file);
    setModalSharedUsers([...file.shared_users]);
    setModalGeneralAccess({ ...file.general_access });
    setNewShareEmail('');
    setNewShareRole('viewer');
  };

  const handleAddUserToShare = () => {
    const email = newShareEmail.trim();
    if (!email) return;

    // Check if duplicate
    if (modalSharedUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      toast.error(locale === 'vi' ? 'Email này đã được thêm.' : 'This email is already added.');
      return;
    }

    const name = email.split('@')[0];
    const newUser: ISharedUser = {
      email,
      name,
      role: newShareRole,
    };

    setModalSharedUsers((prev) => [...prev, newUser]);
    setNewShareEmail('');
    toast.success(
      locale === 'vi' 
        ? `Đã thêm ${email} vào danh sách quyền truy cập.` 
        : `Added ${email} to access list.`
    );
  };

  const handleRemoveUserFromShare = (email: string) => {
    setModalSharedUsers((prev) => prev.filter((u) => u.email !== email));
  };

  const handleUserRoleChange = (email: string, role: TSharedRole) => {
    setModalSharedUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, role } : u))
    );
  };

  const handleSaveSharing = () => {
    if (!selectedFile) return;

    setSharingFiles((prev) =>
      prev.map((file) =>
        file.id === selectedFile.id
          ? {
              ...file,
              shared_users: modalSharedUsers,
              general_access: modalGeneralAccess,
            }
          : file
      )
    );

    toast.success(
      locale === 'vi' 
        ? `Cập nhật cấu hình chia sẻ cho "${selectedFile.file_name}" thành công!` 
        : `Updated sharing settings for "${selectedFile.file_name}" successfully!`
    );
    setSelectedFile(null);
  };

  const handleCopyLink = () => {
    if (!selectedFile) return;
    const mockLink = `https://edu-docs-control-dev.dxfuturetech.com.vn/view/${selectedFile.id}`;
    navigator.clipboard.writeText(mockLink).then(() => {
      toast.success(
        locale === 'vi' 
          ? 'Đã sao chép đường liên kết vào khay nhớ tạm!' 
          : 'Link copied to clipboard!'
      );
    }).catch(() => {
      toast.error('Failed to copy link.');
    });
  };

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

  const getRoleLabel = (role: TSharedRole) => {
    if (locale === 'vi') {
      if (role === 'viewer') return 'Người xem';
      if (role === 'commenter') return 'Người nhận xét';
      return 'Người chỉnh sửa';
    } else {
      if (role === 'viewer') return 'Viewer';
      if (role === 'commenter') return 'Commenter';
      return 'Editor';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900 leading-tight">
          {locale === 'vi' ? 'Tài liệu chia sẻ' : 'Sharing'}
        </h2>
      </div>

      {/* Sharing list of files */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {locale === 'vi' ? 'Tài liệu do tôi chia sẻ' : 'Files shared by me'}
        </div>

        {/* Table Headers */}
        <div className="grid grid-cols-12 border-b border-slate-100 pb-3 text-xs font-semibold text-slate-500 px-4">
          <div className="col-span-5">{locale === 'vi' ? 'Tên' : 'Name'}</div>
          <div className="col-span-3">{locale === 'vi' ? 'Người có quyền truy cập' : 'People with access'}</div>
          <div className="col-span-2">{locale === 'vi' ? 'Quyền truy cập chung' : 'General Access'}</div>
          <div className="col-span-1.5">{locale === 'vi' ? 'Lần sửa cuối' : 'Modified'}</div>
          <div className="col-span-0.5 text-right"></div>
        </div>

        {/* List items */}
        <div className="divide-y divide-slate-50">
          {sharingFiles.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-12 items-center rounded-2xl hover:bg-slate-50/70 p-3 px-4 transition duration-200 group/row"
            >
              {/* Name */}
              <div className="col-span-5 flex items-center gap-3 pr-4">
                {renderFileIcon(file.file_type)}
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-[13.5px] font-bold text-slate-700 leading-tight">
                    {file.file_name}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {formatBytes(file.file_size)}
                  </span>
                </div>
              </div>

              {/* Shared with (Avatar List) */}
              <div className="col-span-3 flex items-center pr-4">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {/* Owner */}
                  <div className="flex size-7 items-center justify-center rounded-full bg-blue-800 text-[10px] font-bold text-white ring-2 ring-white" title={`${file.owner.name} (Owner)`}>
                    KJ
                  </div>
                  {/* Rest of shared users */}
                  {file.shared_users.slice(0, 3).map((user) => {
                    const initial = user.name?.charAt(0).toUpperCase() || 'U';
                    return (
                      <div
                        key={user.email}
                        className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 ring-2 ring-white"
                        title={`${user.name || user.email} (${getRoleLabel(user.role)})`}
                      >
                        {initial}
                      </div>
                    );
                  })}
                  {file.shared_users.length > 3 && (
                    <div className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 ring-2 ring-white">
                      +{file.shared_users.length - 3}
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-500 ml-2.5">
                  {file.shared_users.length === 0 
                    ? (locale === 'vi' ? 'Riêng tư' : 'Private') 
                    : `${file.shared_users.length} ${locale === 'vi' ? 'người' : 'people'}`}
                </span>
              </div>

              {/* General Access scope */}
              <div className="col-span-2 flex items-center gap-2">
                {file.general_access.scope === 'anyone' ? (
                  <>
                    <Globe className="size-4 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-600">
                      {locale === 'vi' ? 'Bất kỳ ai' : 'Anyone'}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="size-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">
                      {locale === 'vi' ? 'Hạn chế' : 'Restricted'}
                    </span>
                  </>
                )}
              </div>

              {/* Modified */}
              <div className="col-span-1.5 text-xs font-semibold text-slate-400">
                {new Date(file.modified).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
              </div>

              {/* Action */}
              <div className="col-span-0.5 flex justify-end">
                <Button
                  onClick={() => handleOpenShareModal(file)}
                  className="h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs px-3 shadow-none shrink-0"
                >
                  <Share2 className="mr-1 size-3.5" />
                  {locale === 'vi' ? 'Chia sẻ' : 'Share'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Google Drive Sharing Modal (Figma Mockup 4) */}
      <Dialog open={selectedFile !== null} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-[480px] bg-white rounded-3xl p-6 shadow-2xl border border-slate-100">
          {selectedFile && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {locale === 'vi' ? 'Chia sẻ' : 'Share'}
                  </h3>
                  <span className="text-[12.5px] font-bold text-slate-500 truncate max-w-[340px] mt-0.5">
                    "{selectedFile.file_name}"
                  </span>
                </div>
                <button onClick={() => setSelectedFile(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                  <X className="size-5" />
                </button>
              </div>

              {/* Add people section */}
              <div className="py-4 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="share-email"
                      value={newShareEmail}
                      onChange={(e) => setNewShareEmail(e.target.value)}
                      placeholder={
                        locale === 'vi' 
                          ? 'Thêm người, nhóm, không gian...' 
                          : 'Add people, groups...'
                      }
                      className="h-10 w-full rounded-xl border-slate-200 pl-9 pr-3 text-xs focus-visible:ring-blue-600"
                    />
                  </div>
                  
                  {/* Select Role for addition */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex h-10 items-center gap-1.5 rounded-xl border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm"
                      >
                        {getRoleLabel(newShareRole)}
                        <ChevronDown className="size-3.5 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-40">
                      <DropdownMenuItem onClick={() => setNewShareRole('viewer')}>
                        {getRoleLabel('viewer')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setNewShareRole('commenter')}>
                        {getRoleLabel('commenter')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setNewShareRole('editor')}>
                        {getRoleLabel('editor')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Add button */}
                  <Button
                    onClick={handleAddUserToShare}
                    className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 shadow-md"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                {/* People with access list */}
                <div className="space-y-3.5 pt-2">
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
                    {locale === 'vi' ? 'Những người có quyền truy cập' : 'People with access'}
                  </div>

                  {/* Owner (You) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        KJ
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">
                          {selectedFile.owner.name} (you)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {selectedFile.owner.email}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-bold pr-2">
                      {locale === 'vi' ? 'Chủ sở hữu' : 'Owner'}
                    </span>
                  </div>

                  {/* Shared users list */}
                  <div className="max-h-36 overflow-y-auto space-y-3 pr-1">
                    {modalSharedUsers.map((user) => {
                      const initial = user.name?.charAt(0).toUpperCase() || 'U';
                      return (
                        <div key={user.email} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                              {initial}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">
                                {user.name || user.email}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {user.email}
                              </span>
                            </div>
                          </div>
                          
                          {/* Role selector dropdown */}
                          <div className="flex items-center gap-1.5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-0"
                                >
                                  {getRoleLabel(user.role)}
                                  <ChevronDown className="size-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => handleUserRoleChange(user.email, 'viewer')}>
                                  {getRoleLabel('viewer')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUserRoleChange(user.email, 'commenter')}>
                                  {getRoleLabel('commenter')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUserRoleChange(user.email, 'editor')}>
                                  {getRoleLabel('editor')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:bg-red-50 focus:text-red-600"
                                  onClick={() => handleRemoveUserFromShare(user.email)}
                                >
                                  {locale === 'vi' ? 'Xoá quyền truy cập' : 'Remove access'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* General Access section */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
                    {locale === 'vi' ? 'Quyền truy cập chung' : 'General Access'}
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      {modalGeneralAccess.scope === 'anyone' ? (
                        <div className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 shrink-0 mt-0.5">
                          <Globe className="size-4.5" />
                        </div>
                      ) : (
                        <div className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 shrink-0 mt-0.5">
                          <Lock className="size-4.5" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        {/* Scope dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-6 justify-start items-center gap-1 p-0 text-xs font-bold text-slate-800 hover:bg-transparent hover:text-slate-900 focus-visible:ring-0"
                            >
                              {modalGeneralAccess.scope === 'anyone'
                                ? (locale === 'vi' ? 'Bất kỳ ai có đường liên kết' : 'Anyone with the link')
                                : (locale === 'vi' ? 'Hạn chế' : 'Restricted')}
                              <ChevronDown className="size-3.5 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuItem onClick={() => setModalGeneralAccess((prev) => ({ ...prev, scope: 'restricted' }))}>
                              {locale === 'vi' ? 'Hạn chế' : 'Restricted'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setModalGeneralAccess((prev) => ({ ...prev, scope: 'anyone' }))}>
                              {locale === 'vi' ? 'Bất kỳ ai có đường liên kết' : 'Anyone with the link'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Description */}
                        <span className="text-[10px] text-slate-400 leading-normal max-w-[280px]">
                          {modalGeneralAccess.scope === 'anyone'
                            ? (locale === 'vi'
                                ? 'Bất kỳ ai có kết nối Internet và có đường liên kết này đều có thể xem'
                                : 'Anyone on the Internet with this link can view')
                            : (locale === 'vi'
                                ? 'Chỉ những người được chia sẻ trực tiếp mới có thể xem bằng liên kết này'
                                : 'Only people added can open with this link')}
                        </span>
                      </div>
                    </div>

                    {/* Role dropdown for general access (if public) */}
                    {modalGeneralAccess.scope === 'anyone' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 items-center gap-1.5 rounded-full px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-0 mt-0.5 shrink-0"
                          >
                            {getRoleLabel(modalGeneralAccess.role)}
                            <ChevronDown className="size-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => setModalGeneralAccess((prev) => ({ ...prev, role: 'viewer' }))}>
                            {getRoleLabel('viewer')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setModalGeneralAccess((prev) => ({ ...prev, role: 'commenter' }))}>
                            {getRoleLabel('commenter')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setModalGeneralAccess((prev) => ({ ...prev, role: 'editor' }))}>
                            {getRoleLabel('editor')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Banner message */}
                <div className="flex gap-2.5 p-3 rounded-2xl bg-blue-50/50 border border-blue-100/50 text-[10.5px] font-semibold text-blue-700 leading-normal">
                  <Info className="size-4 shrink-0 text-blue-600 mt-0.5" />
                  <span>
                    {locale === 'vi' 
                      ? 'Những người xem tệp này có thể thấy các nhận xét và mục đề xuất' 
                      : 'Viewers of this file can see comments and suggestions'}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-10 rounded-full border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs text-slate-700 flex items-center gap-1.5 px-4 shadow-sm"
                >
                  <LinkIcon className="size-3.5" />
                  {locale === 'vi' ? 'Sao chép đường liên kết' : 'Copy link'}
                </Button>

                <Button
                  onClick={handleSaveSharing}
                  className="h-10 rounded-full bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white px-6 shadow-md shadow-blue-600/10"
                >
                  {locale === 'vi' ? 'Xong' : 'Done'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
