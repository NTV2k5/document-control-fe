import type { IUserProfile } from 'reactjs-platform/utilities/models';

export interface IProfileSectionProps {}

export interface IPersonalInfoFormState {
  first_name: string;
  last_name: string;
  department: string;
  bio: string;
}

export interface IProfileHeaderProps {
  profile: IUserProfile;
  onAvatarClick?: () => void;
  onAvatarChange?: (url: string) => void;
}

export interface IPersonalInfoFormProps {
  profile: IUserProfile;
  onSave: (data: IPersonalInfoFormState) => Promise<void>;
  isSaving: boolean;
}

export interface IStorageAnalyticsProps {
  usedStorageTb: number;
  totalStorageTb: number;
  documentsPercent: number;
  mediaPercent: number;
  documentsTb: number;
  mediaTb: number;
}

export interface IRecentActivityItem {
  id: string;
  type: 'document' | 'security';
  title: string;
  timestamp: string;
  iconName: 'document' | 'shield' | 'lock';
}

export interface IRecentActivityProps {
  activities: IRecentActivityItem[];
}
