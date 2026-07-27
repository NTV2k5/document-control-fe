export interface IFilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  entityName: string;
  fileName: string;
  mimeType?: string | null;
  fileUrl?: string | null;
}
