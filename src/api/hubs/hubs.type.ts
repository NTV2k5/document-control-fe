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

export interface ICategoryStat {
  count: number;
  size: number;
}

export interface IHubStatsAPIResponse {
  Images: ICategoryStat;
  Videos: ICategoryStat;
  Documents: ICategoryStat;
  Other: ICategoryStat;
}

export interface IHubFoldersAPIResponse {
  name: string;
  file_name: string;
  modified: string;
  folder: string;
  owner: string;
  mime_type: string;
  owner_fullname: string;
  owner_image: string | null;
}

export interface IHubRecentActivityAPIResponse {
  name: string;
  file_name: string;
  modified: string;
  folder: string;
  owner: string;
  mime_type: string;
  owner_fullname: string;
  owner_image: string | null;
}
