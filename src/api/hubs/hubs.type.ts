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
  total_files?: number;
  total_size?: number;
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

export interface IListDriveFilesPayload {
  team: string;
  entity_name: string;
  order_by?: string;
  ascending?: number;
  start?: number;
  limit?: number;
}

export interface IDriveFileItem {
  name: string;
  file_name: string;
  folder: string;
  file_url: string | null;
  file_size: number;
  file_type: string;
  is_folder: number;
  content_doctype: string | null;
  content_docname: string | null;
  team: string;
  creation: string;
  modified: string;
  owner: string;
  owner_full_name: string;
  owner_image: string | null;
  is_favourite: number | null;
  accessed: string | null;
  child_count: number;
  share_count: number;
  kind: string;
  read: number;
  comment: number;
  share: number;
  upload: number;
  write: number;
  type: string;
}

export interface IRenameDriveFilePayload {
  entity_name: string;
  new_title: string;
}

export interface IMoveDriveFilesPayload {
  entity_names: string[];
  new_parent: string;
  team: string;
}

export interface IShareDriveFilePayload {
  entity_name: string;
  method: 'share' | 'unshare';
  user: string;
  read: number;
}

export interface IDeleteDriveFilesPayload {
  entity_names: string[];
}

