import type { TArtifactType } from 'api';
import type { ExactSchemaCatalog } from '../../../lib';

export interface IArtifactEditorProps {
  artifactType: TArtifactType;
  config?: unknown;
  values?: Record<string, string>;
  variableKeys?: string[];
  variableCatalog?: ExactSchemaCatalog;
  template_type?: string | null;
  readOnly?: boolean;
  onConfigChange?: (config: unknown) => void;
}
