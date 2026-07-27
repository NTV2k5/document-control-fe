export interface IFolderItem {
  id: string;
  name: string;
  size: string;
  filesCount: number;
  team?: string;
}

export interface IFileItem {
  id: string;
  name: string;
  size: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'other';
  fileUrl?: string | null;
  mimeType?: string | null;
}

export interface IMyHubsSectionProps {
  initialFolders?: IFolderItem[];
  initialFiles?: IFileItem[];
}
