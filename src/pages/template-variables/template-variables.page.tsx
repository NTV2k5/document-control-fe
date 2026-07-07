import { TemplateVariablesSection } from '../../sections';
import type { TTemplateVariableRouteFilter } from '../../sections/template-variables/template-variables.type';

export interface ITemplateVariablesPageProps {
  variableType?: TTemplateVariableRouteFilter;
}

export const TemplateVariablesPage = ({ variableType = 'all' }: ITemplateVariablesPageProps) => (
  <TemplateVariablesSection variableType={variableType} />
);
