import type { ExactSchemaCatalog, IVariablePickerItem } from '../../../lib';

export interface IVariablePickerDialogProps {
  open: boolean;
  catalog: ExactSchemaCatalog;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: IVariablePickerItem) => void;
  onSelectMany?: (items: IVariablePickerItem[]) => void;
  onConfirmStart?: () => void;
  template_type?: string | null;
  title?: string;
  description?: string;
  confirmLabel?: string;
  initialActiveKey?: string | null;
  multiSelect?: boolean;
  contentClassName?: string;
}
