import type { ReactNode } from 'react';

export interface IHubStatItem {
  id: string;
  label: string;
  itemsCount: number;
  usedSpace: string;
  percentage: number;
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
  barColor: string;
}

export interface IHubStatsProps {
  stats?: IHubStatItem[];
}
