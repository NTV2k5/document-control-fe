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

export interface IMyHubsSectionProps {
  initialFolders?: IFolderItem[];
  initialFiles?: IFileItem[];
}
