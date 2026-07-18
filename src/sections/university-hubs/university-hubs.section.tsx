import { useEffect, useState, useMemo } from 'react';
import {
  Landmark,
  SlidersHorizontal,
  Pencil,
  Download,
  FolderInput,
  Share2,
  Archive,
  SquareTerminal,
  Palette,
  Microscope,
  Sigma,
  BrainCog,
  Leaf,
  Rocket,
  Scan,
  MoreVertical,
  Atom,
  Image as ImageIcon,
  Clapperboard,
  FileText
} from 'lucide-react';
import type { IUniversityHubsSectionProps, IDepartmentItem, IProjectItem } from './university-hubs.type';
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
} from 'reactjs-platform/ui';
import { toast } from 'react-toastify';
import {
  listDepartmentsAPI,
  archiveDepartmentAPI,
  listProjectsAPI,
  archiveProjectAPI,
  getHubStatsAPI,
  getHubRecentActivityAPI,
  formatBytes,
  mapFileType,
  listDriveFilesAPI,
  renameDriveFileAPI,
  moveDriveFilesAPI,
  shareDriveFileAPI,
  deleteDriveFilesAPI,
  type IDriveFileItem,
} from 'api';


export const UniversityHubsSection = ({
  initialDepartments,
  initialProjects,
}: IUniversityHubsSectionProps) => {
  const [departments, setDepartments] = useState<IDepartmentItem[]>(
    initialDepartments ?? []
  );
  const [projects, setProjects] = useState<IProjectItem[]>(
    initialProjects ?? []
  );
  const [stats, setStats] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    listDepartmentsAPI().then(setDepartments).catch(err => {
      console.error('Failed to fetch departments:', err);
      toast.error('Failed to fetch departments.');
    });
    listProjectsAPI().then(setProjects).catch(err => {
      console.error('Failed to fetch projects:', err);
      toast.error('Failed to fetch projects.');
    });
    getHubStatsAPI().then((statsData) => {
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

    getHubRecentActivityAPI().then((data) => {
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
    return activities.map((item) => {
      const foundDept = departments.find((d) => d.id === item.folderId);
      const foundProj = projects.find((p) => p.id === item.folderId);
      const directory = foundDept?.name || foundProj?.name || item.folderId || 'Root';
      return {
        ...item,
        directory,
      };
    });
  }, [activities, departments, projects]);

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

  const handleRename = async (id: string, currentName: string, isDept: boolean) => {
    const label = isDept ? 'department' : 'project';
    const newName = window.prompt(`Rename ${label}:`, currentName);
    if (newName === null) return;
    if (!newName.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    try {
      await renameDriveFileAPI({ entity_name: id, new_title: newName });
      toast.success(`Renamed successfully to: ${newName}`);
      if (isDept) {
        setDepartments((prev) => prev.map((d) => (d.id === id ? { ...d, name: newName } : d)));
      } else {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
      }
    } catch {
      toast.error('Failed to rename.');
    }
  };

  const handleMove = async (id: string, currentName: string) => {
    const targetFolderId = window.prompt(
      `Enter target folder ID to move ${currentName} to (Available departments/projects:\n` +
        [...departments, ...projects].map((f) => `${f.name} (${f.id})`).join('\n') +
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
      const updatedDepts = await listDepartmentsAPI();
      setDepartments(updatedDepts);
      const updatedProjects = await listProjectsAPI();
      setProjects(updatedProjects);
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

  const handleArchiveDept = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive department: ${name}?`)) return;
    try {
      await deleteDriveFilesAPI({ entity_names: [id] });
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      toast.success(`Archived department: ${name}`);
    } catch {
      toast.error(`Failed to archive department: ${name}`);
    }
  };

  const handleArchiveProject = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive project: ${name}?`)) return;
    try {
      await deleteDriveFilesAPI({ entity_names: [id] });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success(`Archived project: ${name}`);
    } catch {
      toast.error(`Failed to archive project: ${name}`);
    }
  };



  const renderDeptIcon = (iconKey: string) => {
    switch (iconKey) {
      case 'code':
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <SquareTerminal className="size-5" />
          </div>
        );
      case 'paint':
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <Palette className="size-5" />
          </div>
        );
      case 'biology':
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <Microscope className="size-5" />
          </div>
        );
      case 'math':
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <Sigma className="size-5" />
          </div>
        );
      default:
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <SquareTerminal className="size-5" />
          </div>
        );
    }
  };

  const renderProjectIcon = (iconKey: string) => {
    switch (iconKey) {
      case 'brain':
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <BrainCog className="size-5" />
          </div>
        );
      case 'leaf':
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <Leaf className="size-5" />
          </div>
        );
      case 'rocket':
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-500">
            <Rocket className="size-5" />
          </div>
        );
      case 'scan':
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <Scan className="size-5" />
          </div>
        );
      default:
        return (
          <div className="flex size-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <BrainCog className="size-5" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-900">University Hub</h2>
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

      {/* Departments Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-800">Departments</h2>
          </div>
          <button
            type="button"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
            onClick={() => toast.info('Navigating to Departments Directory...')}
          >
            View Directory
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {departments.map((dept) => (
            <div
              key={dept.id}
              onClick={() => handleOpenFolder(dept.id, dept.name)}
              className="cursor-pointer relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="relative">
                  {renderDeptIcon(dept.iconKey)}
                </div>


                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      className="size-7 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={() => handleRename(dept.id, dept.name, true)}
                    >
                      <Pencil className="mr-2 size-4 text-slate-500" />
                      Rename Dept
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toast.success(`Downloading files from ${dept.name}`)}
                    >
                      <Download className="mr-2 size-4 text-slate-500" />
                      Download All
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleMove(dept.id, dept.name)}
                    >
                      <FolderInput className="mr-2 size-4 text-slate-500" />
                      Move Directory
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleShare(dept.id, dept.name)}
                    >
                      <Share2 className="mr-2 size-4 text-slate-500" />
                      Share Access
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      onClick={() => handleArchiveDept(dept.id, dept.name)}
                    >
                      <Archive className="mr-2 size-4 text-red-500" />
                      Archive Dept
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-8 flex flex-col gap-1">
                <span className="font-bold text-slate-800 text-[14px] leading-tight">
                  {dept.name}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {dept.size} • {dept.filesCount} files
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Projects Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Atom className="size-5 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-800">Active Projects</h2>
          </div>
          <button
            type="button"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
            onClick={() => toast.info('Navigating to Projects Directory...')}
          >
            View All Projects
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => handleOpenFolder(proj.id, proj.name)}
              className="cursor-pointer relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                {renderProjectIcon(proj.iconKey)}

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
                  <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={() => handleRename(proj.id, proj.name, false)}
                    >
                      <Pencil className="mr-2 size-4 text-slate-500" />
                      Rename Project
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toast.success(`Downloading files from ${proj.name}`)}
                    >
                      <Download className="mr-2 size-4 text-slate-500" />
                      Download All
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleMove(proj.id, proj.name)}
                    >
                      <FolderInput className="mr-2 size-4 text-slate-500" />
                      Move Directory
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleShare(proj.id, proj.name)}
                    >
                      <Share2 className="mr-2 size-4 text-slate-500" />
                      Share Access
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      onClick={() => handleArchiveProject(proj.id, proj.name)}
                    >
                      <Archive className="mr-2 size-4 text-red-500" />
                      Archive Project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-8 flex flex-col gap-1">
                <span className="font-bold text-slate-800 text-[14px] leading-tight">
                  {proj.name}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {proj.size} •{' '}
                  {proj.partnersCount !== undefined
                    ? `${proj.partnersCount} partners`
                    : proj.membersCount !== undefined
                      ? `${proj.membersCount} members`
                      : `${proj.filesCount} files`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <HubRecentActivity activities={displayActivities} />

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
