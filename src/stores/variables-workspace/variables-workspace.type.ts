import type { IVariablesDrawerProps } from '../../components';

export interface IVariablesWorkspaceSession extends Omit<IVariablesDrawerProps, 'open' | 'onClose' | 'renderMode'> {
  backTo: string;
  resourceLabel?: string;
}

export type TVariablesWorkspaceSession = IVariablesWorkspaceSession;
