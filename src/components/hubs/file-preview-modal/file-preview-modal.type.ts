export interface IFilePreviewModalItem {
  id?: string;
  entityName: string;
  fileName: string;
  mimeType?: string | null;
  fileUrl?: string | null;
  fileSize?: string | number | null;
}

export interface IFilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  entityName: string;
  fileName: string;
  mimeType?: string | null;
  fileUrl?: string | null;
  items?: IFilePreviewModalItem[];
  currentIndex?: number;
  onNavigate?: (newIndex: number) => void;
}

export type TMimeCategory = 'image' | 'pdf' | 'office' | 'media' | 'code_text' | 'unsupported';

export type TFSMState =
  | 'IDLE'
  | 'FETCHING_META'
  | 'RESOLVING_MODULE'
  | 'STREAMING'
  | 'RENDER_SUCCESS'
  | 'FALLBACK_STATE'
  | 'ERROR_STATE';
