export interface IActivityOwner {
  name: string;
  avatarUrl?: string;
  initials?: string;
}

export interface IHubActivityItem {
  id: string;
  name: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'other';
  lastModified: string;
  directory: string;
  owners: IActivityOwner[];
}

export interface IHubRecentActivityProps {
  activities?: IHubActivityItem[];
  onActionClick?: (activity: IHubActivityItem) => void;
}
