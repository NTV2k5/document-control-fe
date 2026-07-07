import { createContext, useContext } from 'react';
import type { TAdminUsersTab } from './admin-users.type';

interface IAdminUsersContextValue {
  setActiveTab: (tab: TAdminUsersTab) => void;
}

export const AdminUsersContext = createContext<IAdminUsersContextValue | null>(null);

export const useAdminUsersContext = (): IAdminUsersContextValue => {
  const ctx = useContext(AdminUsersContext);
  if (!ctx) {
    return { setActiveTab: () => {} };
  }
  return ctx;
};
