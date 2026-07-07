import type { IVariablesWorkspaceSession } from './variables-workspace.type';

let variablesWorkspaceSession: IVariablesWorkspaceSession | null = null;

export const setVariablesWorkspaceSession = (session: IVariablesWorkspaceSession) => {
  variablesWorkspaceSession = session;
};

export const getVariablesWorkspaceSession = () => {
  return variablesWorkspaceSession;
};

export const clearVariablesWorkspaceSession = () => {
  variablesWorkspaceSession = null;
};
