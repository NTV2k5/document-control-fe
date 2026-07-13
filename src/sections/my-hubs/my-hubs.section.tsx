import { useState } from 'react';
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

export const MyHubsSection = ({
  initialFolders,
  initialFiles,
}: IMyHubsSectionProps) => {
  const defaultFolders: IFolderItem[] = [
    {
      id: 'folder-1',
      name: 'Computer Science',
      size: '23.80 MB',
      filesCount: 6,
    },
    {
      id: 'folder-2',
      name: 'Academic Archive',
      size: '63.46 MB',
      filesCount: 13,
    },
    {
      id: 'folder-3',
      name: 'Course Materials',
      size: '1.39 GB',
      filesCount: 14,
    },
    {
      id: 'folder-4',
      name: 'Research Papers',
      size: '128 MB',
      filesCount: 32,
    },
    {
      id: 'folder-5',
      name: 'Personal Project',
      size: '45.2 MB',
      filesCount: 4,
    },
    {
      id: 'folder-6',
      name: 'Submission Inbox',
      size: '12.1 GB',
      filesCount: 150,
    },
  ];

  const defaultFiles: IFileItem[] = [
    {
      id: 'file-1',
      name: 'MHAdmin_Enrollment_Form_Final_2025',
      size: '2.4 MB',
      fileType: 'pdf',
    },
    {
      id: 'file-2',
      name: 'MHAdmin_Enrollment_Form_Final_2025',
      size: '1.2 MB',
      fileType: 'pdf',
    },
    {
      id: 'file-3',
      name: 'MHAdmin_Enrollment_Form_Final_2025',
      size: '3.1 MB',
      fileType: 'pdf',
    },
    {
      id: 'file-4',
      name: 'MHAdmin_Enrollment_Form_Final_2025',
      size: '950 KB',
      fileType: 'pdf',
    },
    {
      id: 'file-5',
      name: 'MHAdmin_Enrollment_Form_Final_2025',
      size: '4.5 MB',
      fileType: 'pdf',
    },
    {
      id: 'file-6',
      name: 'MHAdmin_Enrollment_Form_Final_2025',
      size: '2.8 MB',
      fileType: 'pdf',
    },
    {
      id: 'file-7',
      name: 'MHAdmin_Enrollment_Form_Final_2025',
      size: '1.9 MB',
      fileType: 'pdf',
    },
    {
      id: 'file-8',
      name: 'MHAdmin_Enrollment_Form_Final_2025',
      size: '3.6 MB',
      fileType: 'pdf',
    },
  ];

  const [folders, setFolders] = useState<IFolderItem[]>(
    initialFolders ?? defaultFolders
  );
  const [files, setFiles] = useState<IFileItem[]>(
    initialFiles ?? defaultFiles
  );

  const [isOpenFolderDialog, setIsOpenFolderDialog] = useState(false);
  const [isOpenFileDialog, setIsOpenFileDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');

  const handleDeleteFolder = (id: string, name: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    toast.success(`Deleted folder: ${name}`);
  };

  const handleDeleteFile = (id: string, name: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    toast.success(`Deleted file: ${name}`);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder: IFolderItem = {
      id: `folder-${Date.now()}`,
      name: newFolderName,
      size: '0 B',
      filesCount: 0,
    };

    setFolders((prev) => [...prev, newFolder]);
    setNewFolderName('');
    setIsOpenFolderDialog(false);
    toast.success(`Created folder: ${newFolder.name}`);
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const newFile: IFileItem = {
      id: `file-${Date.now()}`,
      name: newFileName,
      size: '0 B',
      fileType: 'pdf',
    };

    setFiles((prev) => [...prev, newFile]);
    setNewFileName('');
    setIsOpenFileDialog(false);
    toast.success(`Added file: ${newFile.name}`);
  };

  const renderFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return (
          <div className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
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
      <HubStats />

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
              onClick={() => setIsOpenFileDialog(true)}
            >
              <FilePlus className="size-4" />
              Add File
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
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
                      className="size-7 rounded-full text-slate-400 hover:bg-slate-55 hover:text-slate-65"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => toast.info(`Renaming folder ${folder.name}`)}
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
                      onClick={() => toast.info(`Moving folder ${folder.name}`)}
                    >
                      <FolderInput className="mr-2 size-4 text-slate-500" />
                      Move
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toast.success(`Shared link for ${folder.name}`)}
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
                    className="size-7 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-65"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => toast.info(`Renaming file ${file.name}`)}
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
                    onClick={() => toast.info(`Moving file ${file.name}`)}
                  >
                    <FolderInput className="mr-2 size-4 text-slate-500" />
                    Move
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => toast.success(`Shared link for ${file.name}`)}
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
      <HubRecentActivity />

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
                autoFocus
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

      {/* Add File Dialog */}
      <Dialog open={isOpenFileDialog} onOpenChange={setIsOpenFileDialog}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <form onSubmit={handleCreateFileSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[17px] font-bold text-slate-800">
                Add New File
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 flex flex-col gap-2">
              <Label htmlFor="file-name" className="text-xs font-bold text-slate-500">
                File Name (PDF)
              </Label>
              <Input
                id="file-name"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Enter file name..."
                className="h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-blue-600"
                autoFocus
              />
            </div>
            <DialogFooter className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500"
                onClick={() => setIsOpenFileDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-md hover:bg-blue-700"
              >
                Add File
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
