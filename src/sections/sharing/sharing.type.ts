export type TSharedRole = 'viewer' | 'commenter' | 'editor';
export type TGeneralAccessScope = 'restricted' | 'anyone';

export interface ISharedUser {
  email: string;
  name?: string;
  role: TSharedRole;
  avatar?: string;
}

export interface ISharingFileItem {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  file_type: 'pdf' | 'docx' | 'xlsx' | 'other';
  owner: {
    name: string;
    email: string;
  };
  shared_users: ISharedUser[];
  general_access: {
    scope: TGeneralAccessScope;
    role: TSharedRole;
  };
  modified: string;
  file_url: string | null;
}

export interface ISharingSectionProps {}
