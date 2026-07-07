import type { IDocumentInputAgentSelectedTemplate } from './document-input-agent-action.type';

export interface IDocumentInputAgentTemplateSelectorProps {
  open: boolean;
  selectedTemplateId?: string;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: IDocumentInputAgentSelectedTemplate) => void;
}
