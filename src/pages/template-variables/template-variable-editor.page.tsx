import { TemplateDocumentVariableEditorSection, TemplateVariableEditorSection } from '../../sections';

export type TTemplateVariableEditorPageType = 'DOCUMENT_VARIABLE' | 'TABLE_VARIABLE';

export interface ITemplateVariableEditorPageProps {
  variableId?: string;
  variableType?: TTemplateVariableEditorPageType;
  documentMode?: 'structured' | 'raw_html';
}

export const TemplateVariableEditorPage = ({
  variableId,
  variableType = 'TABLE_VARIABLE',
  documentMode = 'structured',
}: ITemplateVariableEditorPageProps) =>
  variableType === 'DOCUMENT_VARIABLE' ? (
    <TemplateDocumentVariableEditorSection variableId={variableId} initialRenderMode={documentMode} />
  ) : (
    <TemplateVariableEditorSection variableId={variableId} />
  );
