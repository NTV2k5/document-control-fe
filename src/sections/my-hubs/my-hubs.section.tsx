import { useEffect, useState, useRef, useMemo } from 'react';

import {
  Folder,
  FolderPlus,
  FilePlus,
  SlidersHorizontal,
  Pencil,
  Download,
  FolderInput,
  Share2,
  Trash2,
  MoreVertical,
  FileText,
  Image as ImageIcon,
  Clapperboard,
  Archive,
} from 'lucide-react';
import type { IMyHubsSectionProps, IFolderItem, IFileItem } from './my-hubs.type';
import { HubStats, HubRecentActivity } from '../../components/hubs';
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
  DialogFooter,
  Input,
  Label,
} from 'reactjs-platform/ui';
import { toast } from 'react-toastify';
import {
  listFoldersAPI,
  createFolderAPI,
  deleteFolderAPI,
  listFilesAPI,
  createFileAPI,
  deleteFileAPI,
  getMyStatsAPI,
  getMyRecentActivityAPI,
  formatBytes,
  mapFileType,
  listDriveFilesAPI,
  renameDriveFileAPI,
  moveDriveFilesAPI,
  shareDriveFileAPI,
  deleteDriveFilesAPI,
  type IDriveFileItem,
} from 'api';


export const MyHubsSection = ({
  initialFolders,
  initialFiles,
}: IMyHubsSectionProps) => {
  const [folders, setFolders] = useState<IFolderItem[]>(
    initialFolders ?? []
  );
  const [files, setFiles] = useState<IFileItem[]>(
    initialFiles ?? []
  );
  const [stats, setStats] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [isOpenFolderDialog, setIsOpenFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listFoldersAPI().then(setFolders).catch(err => {
      console.error('Failed to fetch folders:', err);
      toast.error('Failed to fetch folders.');
    });
    listFilesAPI().then(setFiles).catch(err => {
      console.error('Failed to fetch files:', err);
      toast.error('Failed to fetch files.');
    });
    getMyStatsAPI().then((statsData) => {
      const totalSize = statsData.Images.size + statsData.Videos.size + statsData.Documents.size + statsData.Other.size;
      const mappedStats = [
        {
          id: 'images',
          label: 'IMAGES',
          itemsCount: statsData.Images.count,
          usedSpace: `${formatBytes(statsData.Images.size)} used`,
          percentage: totalSize > 0 ? (statsData.Images.size / totalSize) * 100 : 0,
          icon: <ImageIcon className="size-5" />,
          iconBgColor: 'bg-red-50',
          iconColor: 'text-red-500',
          barColor: 'bg-red-500',
        },
        {
          id: 'videos',
          label: 'VIDEOS',
          itemsCount: statsData.Videos.count,
          usedSpace: `${formatBytes(statsData.Videos.size)} used`,
          percentage: totalSize > 0 ? (statsData.Videos.size / totalSize) * 100 : 0,
          icon: <Clapperboard className="size-5" />,
          iconBgColor: 'bg-blue-50',
          iconColor: 'text-blue-500',
          barColor: 'bg-blue-500',
        },
        {
          id: 'documents',
          label: 'DOCUMENTS',
          itemsCount: statsData.Documents.count,
          usedSpace: `${formatBytes(statsData.Documents.size)} used`,
          percentage: totalSize > 0 ? (statsData.Documents.size / totalSize) * 100 : 0,
          icon: <FileText className="size-5" />,
          iconBgColor: 'bg-emerald-50',
          iconColor: 'text-emerald-500',
          barColor: 'bg-emerald-500',
        },
        {
          id: 'other',
          label: 'OTHER',
          itemsCount: statsData.Other.count,
          usedSpace: `${formatBytes(statsData.Other.size)} used`,
          percentage: totalSize > 0 ? (statsData.Other.size / totalSize) * 100 : 0,
          icon: <Archive className="size-5" />,
          iconBgColor: 'bg-amber-50',
          iconColor: 'text-amber-500',
          barColor: 'bg-amber-500',
        },
      ];
      setStats(mappedStats);
    }).catch(err => {
      console.error('Failed to fetch stats:', err);
    });

    getMyRecentActivityAPI().then((data) => {
      const mapped = data.map((item) => ({
        id: item.name,
        name: item.file_name,
        fileType: mapFileType(item.mime_type, item.file_name),
        lastModified: item.modified,
        folderId: item.folder,
        owners: [
          {
            name: item.owner_fullname || item.owner || 'Administrator',
            avatarUrl: item.owner_image ? (item.owner_image.startsWith('http') ? item.owner_image : `${import.meta.env.VITE_API_ENDPOINT || ''}${item.owner_image}`) : undefined,
            initials: (item.owner_fullname || item.owner || 'A').charAt(0).toUpperCase()
          }
        ]
      }));
      setActivities(mapped);
    }).catch(err => {
      console.error('Failed to fetch recent activities:', err);
    });
  }, []);

  const displayActivities = useMemo(() => {
    return activities.map((item) => ({
      ...item,
      directory: folders.find((f) => f.id === item.folderId)?.name || item.folderId || 'Root',
    }));
  }, [activities, folders]);

  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderFiles, setFolderFiles] = useState<IDriveFileItem[]>([]);
  const [loadingFolderFiles, setLoadingFolderFiles] = useState(false);

  const handleOpenFolder = async (id: string, name: string) => {
    setSelectedFolder({ id, name });
    setLoadingFolderFiles(true);
    try {
      const data = await listDriveFilesAPI({
        team: 'evjem9pjqi',
        entity_name: id,
        order_by: 'modified',
        ascending: 0,
        start: 0,
        limit: 50,
      });
      setFolderFiles(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load folder files.');
    } finally {
      setLoadingFolderFiles(false);
    }
  };

  const handleRename = async (id: string, currentName: string, isFolder: boolean) => {
    const newName = window.prompt(`Rename ${isFolder ? 'folder' : 'file'}:`, currentName);
    if (newName === null) return;
    if (!newName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    try {
      await renameDriveFileAPI({ entity_name: id, new_title: newName });
      toast.success(`Renamed successfully to: ${newName}`);
      if (isFolder) {
        setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
      } else {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name: newName } : f)));
      }
    } catch {
      toast.error('Failed to rename.');
    }
  };

  const handleMove = async (id: string, currentName: string, isFolder: boolean) => {
    const targetFolderId = window.prompt(
      `Enter target folder ID to move ${currentName} to (Available folders:\n` +
        folders.map((f) => `${f.name} (${f.id})`).join('\n') +
        '\nOr type "root" to move to top level):'
    );
    if (targetFolderId === null) return;
    const parentId = targetFolderId.trim().toLowerCase() === 'root' ? '' : targetFolderId.trim();
    try {
      await moveDriveFilesAPI({
        entity_names: [id],
        new_parent: parentId,
        team: 'evjem9pjqi',
      });
      toast.success(`Moved ${currentName} successfully.`);
      const updatedFolders = await listFoldersAPI();
      setFolders(updatedFolders);
      const updatedFiles = await listFilesAPI();
      setFiles(updatedFiles);
    } catch {
      toast.error('Failed to move.');
    }
  };

  const handleShare = async (id: string, currentName: string) => {
    const email = window.prompt(`Enter user email to share access to ${currentName}:`);
    if (email === null) return;
    if (!email.trim()) {
      toast.error('Email cannot be empty.');
      return;
    }
    try {
      await shareDriveFileAPI({
        entity_name: id,
        method: 'share',
        user: email,
        read: 1,
      });
      toast.success(`Shared ${currentName} with ${email} successfully.`);
    } catch {
      toast.error('Failed to share.');
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete folder: ${name}?`)) return;
    try {
      await deleteDriveFilesAPI({ entity_names: [id] });
      setFolders((prev) => prev.filter((f) => f.id !== id));
      toast.success(`Deleted folder: ${name}`);
    } catch {
      toast.error(`Failed to delete folder: ${name}`);
    }
  };

  const handleDeleteFile = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete file: ${name}?`)) return;
    try {
      await deleteDriveFilesAPI({ entity_names: [id] });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success(`Deleted file: ${name}`);
    } catch {
      toast.error(`Failed to delete file: ${name}`);
    }
  };


  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const newFolder = await createFolderAPI(newFolderName);
      setFolders((prev) => [...prev, newFolder]);
      setNewFolderName('');
      setIsOpenFolderDialog(false);
      toast.success(`Created folder: ${newFolder.name}`);
    } catch {
      toast.error(`Failed to create folder: ${newFolderName}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const formatSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    let type: 'pdf' | 'docx' | 'xlsx' | 'other' = 'other';
    if (ext === 'pdf') {
      type = 'pdf';
    } else if (ext === 'docx' || ext === 'doc') {
      type = 'docx';
    } else if (ext === 'xlsx' || ext === 'xls') {
      type = 'xlsx';
    }

    const nameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;

    try {
      const newFileItem = await createFileAPI({
        name: nameWithoutExt,
        size: formatSize(selectedFile.size),
        fileType: type,
      });
      setFiles((prev) => [newFileItem, ...prev]);
      toast.success(`Successfully uploaded file: ${selectedFile.name}`);
    } catch {
      toast.error(`Failed to upload file: ${selectedFile.name}`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
            <FileText className="size-4.5" />
          </div>
        );
      case 'docx':
        return (
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
            <FileText className="size-4.5" />
          </div>
        );
      case 'xlsx':
        return (
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
            <FileText className="size-4.5" />
          </div>
        );
      default:
        return (
          <div className="flex size-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
            <FileText className="size-4.5" />
          </div>
        );
    }
  };


  return (
    <div className="space-y-6 pb-12">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">My Hubs</h2>
        <Button
          variant="outline"
          className="flex h-10 items-center gap-2 rounded-full border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
          onClick={() => toast.info('Filter functionality coming soon!')}
        >
          <SlidersHorizontal className="size-4" />
          Filter
        </Button>
      </div>

      {/* Stats row */}
      <HubStats stats={stats} />

      {/* Folders Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Folders</h2>
          <div className="flex items-center gap-3">
            <Button
              className="flex h-10 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-xs font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-all hover:bg-blue-700 hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
              onClick={() => setIsOpenFolderDialog(true)}
            >
              <FolderPlus className="size-4" />
              Create Folder
            </Button>
            <Button
              variant="outline"
              className="flex h-10 items-center gap-2 rounded-2xl border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              onClick={() => fileInputRef.current?.click()}
            >
              <FilePlus className="size-4" />
              Add File
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.xls,.xlsx"
            />

          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {folders.map((folder) => (
            <div
              key={folder.id}
              onClick={() => handleOpenFolder(folder.id, folder.name)}
              className="cursor-pointer relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                  <Folder className="size-5" />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      className="size-7 rounded-full text-slate-400 hover:bg-slate-55 hover:text-slate-65 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={() => handleRename(folder.id, folder.name, true)}
                    >
                      <Pencil className="mr-2 size-4 text-slate-500" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toast.success(`Downloading folder ${folder.name}`)}
                    >
                      <Download className="mr-2 size-4 text-slate-500" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleMove(folder.id, folder.name, true)}
                    >
                      <FolderInput className="mr-2 size-4 text-slate-500" />
                      Move
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleShare(folder.id, folder.name)}
                    >
                      <Share2 className="mr-2 size-4 text-slate-500" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      onClick={() => handleDeleteFolder(folder.id, folder.name)}
                    >
                      <Trash2 className="mr-2 size-4 text-red-500" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-8 flex flex-col gap-1">
                <span className="font-bold text-slate-800 text-[14px] leading-tight line-clamp-1">
                  {folder.name}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {folder.size} • {folder.filesCount} files
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Files Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-slate-800">Files</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3 min-w-0">
                {renderFileIcon(file.fileType)}
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-slate-700 text-[13px] leading-snug truncate">
                    {file.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {file.size}
                  </span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-65 focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => handleRename(file.id, file.name, false)}
                  >
                    <Pencil className="mr-2 size-4 text-slate-500" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toast.success(`Downloading file ${file.name}`)}
                  >
                    <Download className="mr-2 size-4 text-slate-500" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleMove(file.id, file.name, false)}
                  >
                    <FolderInput className="mr-2 size-4 text-slate-500" />
                    Move
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleShare(file.id, file.name)}
                  >
                    <Share2 className="mr-2 size-4 text-slate-500" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    onClick={() => handleDeleteFile(file.id, file.name)}
                  >
                    <Trash2 className="mr-2 size-4 text-red-500" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <HubRecentActivity activities={displayActivities} />

      {/* Create Folder Dialog */}
      <Dialog open={isOpenFolderDialog} onOpenChange={setIsOpenFolderDialog}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <form onSubmit={handleCreateFolderSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[17px] font-bold text-slate-800">
                Create New Folder
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 flex flex-col gap-2">
              <Label htmlFor="folder-name" className="text-xs font-bold text-slate-500">
                Folder Name
              </Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name..."
                className="h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-blue-600"
              />
            </div>
            <DialogFooter className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500"
                onClick={() => setIsOpenFolderDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-md hover:bg-blue-700"
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Folder Contents Dialog */}
      <Dialog open={selectedFolder !== null} onOpenChange={(open) => !open && setSelectedFolder(null)}>
        <DialogContent className="max-w-lg bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Folder Contents: {selectedFolder?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="my-4 max-h-[300px] overflow-y-auto space-y-3">
            {loadingFolderFiles ? (
              <div className="text-center py-6 text-sm text-slate-400 font-medium">
                Loading files...
              </div>
            ) : folderFiles.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400 font-medium">
                This folder is empty.
              </div>
            ) : (
              folderFiles.map((file) => (
                <div key={file.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition">
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-blue-600" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700 leading-tight">
                        {file.file_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {formatBytes(file.file_size)} • {file.file_type}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setSelectedFolder(null)}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-5 text-xs text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
