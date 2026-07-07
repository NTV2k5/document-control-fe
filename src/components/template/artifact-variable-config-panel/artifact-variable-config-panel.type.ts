import type { TArtifactType } from 'api';
import type { ExactSchemaCatalog, IVariablePickerItem } from '../../../lib';

export interface IArtifactVariableConfigPanelProps {
  artifactType: TArtifactType;
  artifactConfig?: unknown;
  variableCatalog?: ExactSchemaCatalog;
  varsInDoc?: string[];
  values?: Record<string, string>;
  template_type?: string | null;
  readOnly?: boolean;
  showVariableBrowser?: boolean;
  onInsertVariable?: (item: IVariablePickerItem) => void;
  onOpenVariablesWorkspace?: () => void;
}
