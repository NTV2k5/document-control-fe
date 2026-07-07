import type { ITemplateListItem, TemplateArtifactType } from 'api';

export type TDocumentInputAgentComposerActionId = 'create_document';

export type TDocumentInputAgentCreateDocumentMode = 'upload_source' | 'agent_request';

export type TDocumentInputAgentSourceKind = 'spreadsheet' | 'document' | 'presentation' | 'image' | 'text' | 'unknown';

export interface IDocumentInputAgentSelectedTemplate {
  id: string;
  name: string;
  artifact_type?: TemplateArtifactType;
  template_type?: string;
  description?: string;
}

export interface IDocumentInputAgentActionPromptContext {
  files: Array<{
    local_name?: string;
    original_name?: string;
    mime_type?: string;
  }>;
  locale: string;
  userMessage: string;
}

export const toDocumentInputAgentSelectedTemplate = (
  template: ITemplateListItem,
): IDocumentInputAgentSelectedTemplate => ({
  id: template.id,
  name: template.name,
  artifact_type: template.artifact_type,
  template_type: template.template_type,
  description: template.description,
});
