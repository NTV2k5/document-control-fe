import { useEffect, useState } from 'react';
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
  archiveProjectAPI
} from 'api';


export const UniversityHubsSection = ({
  initialDepartments,
  initialProjects,
}: IUniversityHubsSectionProps) => {
  const defaultDepts: IDepartmentItem[] = [
    {
      id: 'dept-1',
      name: 'Computer Science',
      size: '45.2 GB',
      filesCount: 1500,
      iconKey: 'code',
    },

    {
      id: 'dept-2',
      name: 'Information Technology',
      size: '32.4 GB',
      filesCount: 1100,
      iconKey: 'folder',
    },
    {
      id: 'dept-3',
      name: 'Faculty of Arts',
      size: '12.8 GB',
      filesCount: 840,
      iconKey: 'paint',
    },
    {
      id: 'dept-4',
      name: 'Molecular Biology',
      size: '89.4 GB',
      filesCount: 2100,
      iconKey: 'biology',
    },
    {
      id: 'dept-5',
      name: 'Mathematics',
      size: '4.2 GB',
      filesCount: 420,
      iconKey: 'math',
    },
  ];

  const defaultProjects: IProjectItem[] = [
    {
      id: 'proj-1',
      name: 'AI Research Lab',
      size: '2.02 GB',
      partnersCount: 12,
      iconKey: 'brain',
    },
    {
      id: 'proj-2',
      name: 'Campus Sustainability',
      size: '856 MB',
      filesCount: 5,
      iconKey: 'leaf',
    },
    {
      id: 'proj-3',
      name: 'Smart Campus Project',
      size: '856 MB',
      filesCount: 5,
      iconKey: 'leaf',
    },
    {
      id: 'proj-4',
      name: 'Deep Space Initiative',
      size: '15.4 GB',
      membersCount: 24,
      iconKey: 'rocket',
    },
    {
      id: 'proj-5',
      name: 'Archival Digitization',
      size: '3.1 GB',
      filesCount: 8,
      iconKey: 'scan',
    },
  ];

  const [departments, setDepartments] = useState<IDepartmentItem[]>(
    initialDepartments ?? []
  );
  const [projects, setProjects] = useState<IProjectItem[]>(
    initialProjects ?? []
  );

  useEffect(() => {
    listDepartmentsAPI().then(setDepartments).catch(err => {
      console.error('Failed to fetch departments:', err);
      toast.error('Failed to fetch departments.');
    });
    listProjectsAPI().then(setProjects).catch(err => {
      console.error('Failed to fetch projects:', err);
      toast.error('Failed to fetch projects.');
    });
  }, []);

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
      <HubStats />

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
      <HubRecentActivity />
    </div>
  );
};
