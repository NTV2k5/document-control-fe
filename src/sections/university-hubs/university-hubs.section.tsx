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

  const handleArchiveDept = async (id: string, name: string) => {
    try {
      await archiveDepartmentAPI(id);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      toast.success(`Archived department: ${name}`);
    } catch {
      toast.error(`Failed to archive department: ${name}`);
    }
  };

  const handleArchiveProject = async (id: string, name: string) => {
    try {
      await archiveProjectAPI(id);
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
              className="relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
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
                      className="size-7 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => toast.info(`Renaming department ${dept.name}`)}
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
                      onClick={() => toast.info(`Moving directory ${dept.name}`)}
                    >
                      <FolderInput className="mr-2 size-4 text-slate-500" />
                      Move Directory
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toast.success(`Shared access for ${dept.name}`)}
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
              className="relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                {renderProjectIcon(proj.iconKey)}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => toast.info(`Renaming project ${proj.name}`)}
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
                      onClick={() => toast.info(`Moving directory ${proj.name}`)}
                    >
                      <FolderInput className="mr-2 size-4 text-slate-500" />
                      Move Directory
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toast.success(`Shared access for ${proj.name}`)}
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
    </div>
  );
};
