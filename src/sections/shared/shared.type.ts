export interface ISharedFileItem {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  file_type: 'pdf' | 'docx' | 'xlsx' | 'other';
  shared_by: {
    name: string;
    email: string;
    avatar?: string;
  };
  shared_at: string; // ISO format or human date
  creation: string;
  modified: string;
  file_url: string | null;
}

export interface ISharedSectionProps {}
