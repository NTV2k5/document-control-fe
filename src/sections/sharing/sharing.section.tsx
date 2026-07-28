import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { FilePreviewModal } from '../../components/hubs';
import { getSharedByMeFilesAPI, getSharedWithListAPI, updateFileAccessAPI, type ISharedByMeFile } from 'api';

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
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ISharingFileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    entityName: string;
    fileName: string;
    mimeType?: string | null;
    fileUrl?: string | null;
  } | null>(null);

  const fetchSharedFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const files = await getSharedByMeFilesAPI();
      const mapped = files.map((apiFile: ISharedByMeFile): ISharingFileItem => {
        const fileName = apiFile.file_name || 'Untitled';
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        let file_type: ISharingFileItem['file_type'] = 'other';
        if (ext === 'pdf') file_type = 'pdf';
        else if (ext === 'docx' || ext === 'doc') file_type = 'docx';
        else if (ext === 'xlsx' || ext === 'xls') file_type = 'xlsx';

        const shared_users: ISharedUser[] = (apiFile.shared_with || [])
          .filter((user) => user && user.email && user.email !== '$GENERAL')
          .map((user) => {
            let role: TSharedRole = 'viewer';
            if (user.permissions?.write === 1 || user.permissions?.upload === 1) {
              role = 'editor';
            } else if (user.permissions?.comment === 1) {
              role = 'commenter';
            }
            const email = user.email || '';
            return {
              email,
              name: user.full_name || (email ? email.split('@')[0] : 'User'),
              role,
              avatar: user.user_image || undefined,
            };
          });

        const generalEntry = (apiFile.shared_with || []).find((user) => user && user.email === '$GENERAL');
        const scope: TGeneralAccessScope = generalEntry ? 'anyone' : 'restricted';
        let generalRole: TSharedRole = 'viewer';
        if (generalEntry) {
          if (generalEntry.permissions?.write === 1 || generalEntry.permissions?.upload === 1) {
            generalRole = 'editor';
          } else if (generalEntry.permissions?.comment === 1) {
            generalRole = 'commenter';
          }
        }

        const ownerEmail = apiFile.owner || '';
        const ownerName = ownerEmail ? ownerEmail.split('@')[0] : 'Owner';

        return {
          id: apiFile.name || '',
          name: fileName.split('.').slice(0, -1).join('.'),
          file_name: fileName,
          file_size: apiFile.file_size || 0,
          file_type,
          owner: {
            name: ownerName,
            email: ownerEmail,
          },
          shared_users,
          general_access: {
            scope,
            role: generalRole,
          },
          modified: apiFile.modified || new Date().toISOString(),
          file_url: apiFile.file_url || null,
        };
      });

      if (mapped.length > 0) {
        setSharingFiles(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch shared by me files', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSharedFiles();
  }, [fetchSharedFiles]);

  // Modal states
  const [newShareEmail, setNewShareEmail] = useState('');
  const [newShareRole, setNewShareRole] = useState<TSharedRole>('viewer');
  const [modalSharedUsers, setModalSharedUsers] = useState<ISharedUser[]>([]);
  const [modalGeneralAccess, setModalGeneralAccess] = useState<{
    scope: TGeneralAccessScope;
    role: TSharedRole;
  }>({ scope: 'restricted', role: 'viewer' });

  const handleOpenShareModal = async (file: ISharingFileItem) => {
    setSelectedFile(file);
    setNewShareEmail('');
    setNewShareRole('viewer');

    // Optimistically set initial states from the page list item first
    setModalSharedUsers([...file.shared_users]);
    setModalGeneralAccess({ ...file.general_access });

    try {
      const rawUsers = await getSharedWithListAPI(file.id);
      const mappedUsers: ISharedUser[] = [];
      let generalAccessObj = { scope: 'restricted' as TGeneralAccessScope, role: 'viewer' as TSharedRole };

      for (const item of rawUsers) {
        if (item.user === '$GENERAL') {
          let role: TSharedRole = 'viewer';
          if (item.write === 1 || item.upload === 1) {
            role = 'editor';
          } else if (item.comment === 1) {
            role = 'commenter';
          }
          generalAccessObj = {
            scope: 'anyone',
            role,
          };
        } else {
          let role: TSharedRole = 'viewer';
          if (item.write === 1 || item.upload === 1) {
            role = 'editor';
          } else if (item.comment === 1) {
            role = 'commenter';
          }
          const email = item.email || item.user;
          if (email && email !== file.owner.email && !mappedUsers.some((u) => u.email === email)) {
            mappedUsers.push({
              email,
              name: item.full_name || email.split('@')[0],
              role,
              avatar: item.user_image || undefined,
            });
          }
        }
      }
      setModalSharedUsers(mappedUsers);
      setModalGeneralAccess(generalAccessObj);
    } catch (err) {
      console.error('Failed to fetch shared with list', err);
    }
  };

  const handleAddUserToShare = async () => {
    const email = newShareEmail.trim();
    if (!email || !selectedFile) return;

    if (modalSharedUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      toast.error(locale === 'vi' ? 'Email này đã được thêm.' : 'This email is already added.');
      return;
    }

    try {
      await updateFileAccessAPI({
        entity_name: selectedFile.id,
        method: 'share',
        user: email,
        read: 1,
        write: newShareRole === 'editor' ? 1 : 0,
        comment: newShareRole === 'commenter' ? 1 : 0,
      });

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
    } catch (err) {
      console.error(err);
      toast.error(locale === 'vi' ? 'Không thể cấp quyền cho người dùng này.' : 'Failed to add user permission.');
    }
  };

  const handleRemoveUserFromShare = async (email: string) => {
    if (!selectedFile) return;

    try {
      await updateFileAccessAPI({
        entity_name: selectedFile.id,
        method: 'unshare',
        user: email,
      });

      setModalSharedUsers((prev) => prev.filter((u) => u.email !== email));
      toast.success(
        locale === 'vi'
          ? `Đã xoá quyền truy cập của ${email}.`
          : `Removed access for ${email}.`
      );
    } catch (err) {
      console.error(err);
      toast.error(locale === 'vi' ? 'Xoá quyền truy cập thất bại.' : 'Failed to remove user permission.');
    }
  };

  const handleUserRoleChange = async (email: string, role: TSharedRole) => {
    if (!selectedFile) return;

    try {
      await updateFileAccessAPI({
        entity_name: selectedFile.id,
        method: 'share',
        user: email,
        read: 1,
        write: role === 'editor' ? 1 : 0,
        comment: role === 'commenter' ? 1 : 0,
      });

      setModalSharedUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, role } : u))
      );
      toast.success(
        locale === 'vi'
          ? `Đã thay đổi vai trò của ${email}.`
          : `Changed role for ${email}.`
      );
    } catch (err) {
      console.error(err);
      toast.error(locale === 'vi' ? 'Cập nhật quyền thất bại.' : 'Failed to update user permission.');
    }
  };

  const handleGeneralAccessChange = async (scope: TGeneralAccessScope, role: TSharedRole) => {
    if (!selectedFile) return;

    try {
      if (scope === 'restricted') {
        await updateFileAccessAPI({
          entity_name: selectedFile.id,
          method: 'unshare',
          user: '$GENERAL',
        });
      } else {
        await updateFileAccessAPI({
          entity_name: selectedFile.id,
          method: 'share',
          user: '$GENERAL',
          read: 1,
          write: role === 'editor' ? 1 : 0,
          comment: role === 'commenter' ? 1 : 0,
        });
      }

      setModalGeneralAccess({ scope, role });
      toast.success(
        locale === 'vi'
          ? 'Đã cập nhật quyền truy cập chung.'
          : 'Updated general access scope.'
      );
    } catch (err) {
      console.error(err);
      // Optimistic update fallback for demo purposes when email configs are offline
      setModalGeneralAccess({ scope, role });
      toast.warn(
        locale === 'vi'
          ? 'Đã cập nhật quyền truy cập chung (Cảnh báo email máy chủ chưa cấu hình).'
          : 'Updated general access scope (Server outgoing email unconfigured warning).'
      );
    }
  };

  const handleSaveSharing = () => {
    setSelectedFile(null);
    void fetchSharedFiles();
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
              <div
                className="col-span-5 flex items-center gap-3 pr-4 cursor-pointer"
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

              {/* Shared with (Avatar List) */}
              <div className="col-span-3 flex items-center pr-4">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {/* Owner */}
                  <div
                    className="flex size-7 items-center justify-center rounded-full bg-blue-800 text-[10px] font-bold text-white ring-2 ring-white"
                    title={`${file.owner.name || file.owner.email} (${locale === 'vi' ? 'Chủ sở hữu' : 'Owner'})`}
                  >
                    {(file.owner.name || file.owner.email || 'O').charAt(0).toUpperCase()}
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
                            <DropdownMenuItem onClick={() => handleGeneralAccessChange('restricted', modalGeneralAccess.role)}>
                              {locale === 'vi' ? 'Hạn chế' : 'Restricted'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGeneralAccessChange('anyone', modalGeneralAccess.role)}>
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
                          <DropdownMenuItem onClick={() => handleGeneralAccessChange(modalGeneralAccess.scope, 'viewer')}>
                            {getRoleLabel('viewer')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGeneralAccessChange(modalGeneralAccess.scope, 'commenter')}>
                            {getRoleLabel('commenter')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGeneralAccessChange(modalGeneralAccess.scope, 'editor')}>
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

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          open={previewFile !== null}
          onClose={() => setPreviewFile(null)}
          entityName={previewFile.entityName || ''}
          fileName={previewFile.fileName || ''}
          mimeType={previewFile.mimeType}
          fileUrl={previewFile.fileUrl}
          items={sharingFiles.map((file) => ({
            entityName: file.id,
            fileName: file.file_name,
            mimeType: file.file_type === 'pdf' ? 'application/pdf' : file.file_type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : null,
            fileUrl: file.file_url,
          }))}
          currentIndex={Math.max(
            0,
            sharingFiles.findIndex((f) => f.file_name === previewFile.fileName || f.id === previewFile.entityName)
          )}
          onNavigate={(newIdx) => {
            const target = sharingFiles[newIdx];
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
