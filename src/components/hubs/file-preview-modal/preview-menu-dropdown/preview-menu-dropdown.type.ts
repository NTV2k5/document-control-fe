export type TMenuCategory = 'file' | 'view' | 'insert' | 'tools' | 'help' | null;

export interface IMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  hasSubmenu?: boolean;
  checked?: boolean;
  disabled?: boolean;
  divider?: boolean;
  action?: () => void;
  submenuItems?: IMenuItem[];
}

export interface IPreviewMenuDropdownProps {
  activeMenu: TMenuCategory;
  onClose: () => void;
  onAction: (actionId: string) => void;
  menuAnchorPos?: { left: number; top: number };
}
