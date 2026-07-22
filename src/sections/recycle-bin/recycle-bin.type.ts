export interface IRecycleBinFileItem {
  id: string;
  name: string;
  file_name: string;
  file_size: number;
  file_type: 'pdf' | 'docx' | 'xlsx' | 'other';
  owner: {
    name: string;
    email: string;
  };
  deleted_at: string; // ISO format or string time
  original_location: string;
  file_url: string | null;
}

export interface IRecycleBinSectionProps {}
