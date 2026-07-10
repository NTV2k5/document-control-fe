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
}

export interface IMyHubsSectionProps {
  initialFolders?: IFolderItem[];
  initialFiles?: IFileItem[];
}
