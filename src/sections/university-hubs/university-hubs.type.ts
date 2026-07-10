export interface IDepartmentItem {
  id: string;
  name: string;
  size: string;
  filesCount: number;
  iconKey: 'code' | 'paint' | 'biology' | 'math' | 'folder';
}


export interface IProjectItem {
  id: string;
  name: string;
  size: string;
  partnersCount?: number;
  membersCount?: number;
  filesCount?: number;
  iconKey: 'brain' | 'leaf' | 'rocket' | 'scan' | 'folder';
}

export interface IUniversityHubsSectionProps {
  initialDepartments?: IDepartmentItem[];
  initialProjects?: IProjectItem[];
}
