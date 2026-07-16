export interface ITrendingNowItem {
  name: string;
  file_name: string;
  mime_type: string;
  owner: string;
  creation: string;
  views: number;
}

export interface ISummaryStats {
  published_files: number;
  my_files: number;
  sharing_files: number;
}

export interface IEngagementItem {
  date: string;
  views: number;
}

export interface IFileDistribution {
  Documents: number;
  Images: number;
  Videos: number;
  Others: number;
  [key: string]: number;
}

export interface IDocumentLatestItem {
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
  attached_to_doctype: string | null;
  attached_to_name: string | null;
  shared_team: string | null;
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
