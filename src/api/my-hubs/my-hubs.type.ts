export interface IFolderItem {
  id: string;
  name: string;
  size: string;
  filesCount: number;
}

export interface IFileItem {
  id: string;
  name: string;
  size: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'other';
  fileUrl?: string | null;
}

export interface IMyHubFolderAPIResponse {
  name: string;
  file_name: string;
  folder: string | null;
  creation: string;
  total_files: number;
  total_size: number;
}

export interface IMyHubFileAPIResponse {
  name: string;
  file_name: string;
  modified: string;
  creation: string;
  folder: string;
  owner: string;
  mime_type: string;
  file_size: number;
}

export interface IMyHubRecentActivityAPIResponse {
  name: string;
  file_name: string;
  modified: string;
  folder: string;
  owner: string;
  mime_type: string;
  owner_fullname: string;
  owner_image: string | null;
}

export interface ICategoryStat {
  count: number;
  size: number;
}

export interface IMyHubStatsAPIResponse {
  Images: ICategoryStat;
  Videos: ICategoryStat;
  Documents: ICategoryStat;
  Other: ICategoryStat;
}
