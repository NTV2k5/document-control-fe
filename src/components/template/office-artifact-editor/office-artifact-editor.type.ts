import type { TArtifactType, TOfficeArtifactScope } from 'api';
import type { ExactSchemaCatalog, IVariablePickerItem } from '../../../lib';

export interface IOfficeArtifactEditorRef {
  forceSave: () => Promise<void>;
  focusVariable: (varKey: string) => Promise<boolean>;
  insertVariable: (item: IVariablePickerItem) => Promise<boolean>;
  rebuildPreview: () => Promise<void>;
}

export interface IOfficeArtifactEditorProps {
  scope: TOfficeArtifactScope;
  id: string;
  artifactType: Extract<TArtifactType, 'spreadsheet' | 'presentation'>;
  metadata?: unknown;
  variableCatalog: ExactSchemaCatalog;
  template_type?: string | null;
  readOnly?: boolean;
  onMetadataChange?: (metadata: unknown) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onFocusedVariableChange?: (varKey: string) => void;
  onShowToast?: (toast: { message: string; type: 'success' | 'error' | 'info' }) => void;
  renderValues?: boolean;
  showInsertVariableButton?: boolean;
  values?: Record<string, string>;
  renderData?: Record<string, unknown>;
  renderArtifactState?: unknown;
}

export interface IOfficeArtifactSetupPanelProps {
  artifactType: Extract<TArtifactType, 'spreadsheet' | 'presentation'>;
  scope: TOfficeArtifactScope;
}
