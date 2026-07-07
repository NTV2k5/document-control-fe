export interface ISubmitForApprovalDialogProps {
  isOpen: boolean;
  templateName?: string;
  template_id: string;
  onClose: () => void;
  onSubmit: (template_id: string) => Promise<void>;
}
