import type { ReactNode } from 'react';

export interface IRouteConfig {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  match: (path: string) => boolean;
  isPrefresh?: boolean;
}

export interface ISidebarItemProps {
  icon: ReactNode;
  label: string;
  href: string;
  is_active: boolean;
  isCollapsed: boolean;
  isPrefresh?: boolean;
}

export interface ISidebarProps {
  routes?: IRouteConfig[];
  isCollapsed: boolean;
  onCollapsedChange: (nextIsCollapsed: boolean) => void;
}

export interface IMainLayoutProps {
  children: ReactNode;
  routes?: IRouteConfig[];
  hideLeftSidebar?: boolean;
  hideHeader?: boolean;
}
