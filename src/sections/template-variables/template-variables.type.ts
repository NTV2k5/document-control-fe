import type {
  IArtifactVariableProfile,
  ITemplateVariableDataSource,
  ITemplateVariableDefinition,
  MetadataOption,
  TArtifactVariableProfileType,
  TTemplateVariableInputType,
  TTemplateVariableType,
} from 'api';
import type { ExactSchemaCatalog } from '../../lib';

export type TTemplateVariableActiveFilter = 'active' | 'all' | 'inactive';
export type TTemplateVariableRouteFilter =
  | TTemplateVariableType
  | 'HTML_CONTENT_VARIABLE'
  | 'spreadsheet'
  | 'presentation'
  | 'image_form'
  | 'all'
  | 'settings';

export interface ITemplateVariablesSectionProps {
  variableType?: TTemplateVariableRouteFilter;
}

export interface IArtifactVariableProfilesSectionProps {
  artifactType: TArtifactVariableProfileType;
  schemaCatalog: ExactSchemaCatalog;
  templateTypeOptions: MetadataOption[];
}

export interface IArtifactVariableProfileFormState extends Pick<
  IArtifactVariableProfile,
  'artifact_type' | 'config' | 'description' | 'is_active' | 'name' | 'template_types'
> {
  id?: string;
}

export interface ITemplateVariableFormState {
  id?: string;
  key: string;
  label: string;
  description: string;
  template_types: string[];
  variable_type: TTemplateVariableType;
  input_type: TTemplateVariableInputType;
  default_value: string;
  data_source: ITemplateVariableDataSource | null;
  ui_config: Record<string, unknown> | null;
}

export interface ITemplateVariableListState {
  data: ITemplateVariableDefinition[];
  loading: boolean;
  error: string | null;
}

export interface ITemplateVariableEditorSectionProps {
  variableId?: string;
  initialRenderMode?: 'structured' | 'raw_html';
}
