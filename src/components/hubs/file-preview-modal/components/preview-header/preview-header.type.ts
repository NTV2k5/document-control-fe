import type { TMimeCategory } from '../../file-preview-modal.type';
import type { TMenuCategory } from '../preview-menu-dropdown';

export interface IPreviewHeaderProps {
  fileName: string;
  mimeCategory: TMimeCategory;
  fileUrl?: string | null;
  activeMenu: TMenuCategory;
  onMenuToggle: (menu: TMenuCategory, anchorPos?: { left: number; top: number }) => void;
  onClose: () => void;
  onDownload: () => void;
  onPrint?: () => void;
  onRename?: () => void;
  onShare?: () => void;
}
