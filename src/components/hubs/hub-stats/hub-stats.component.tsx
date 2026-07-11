import { Image as ImageIcon, Clapperboard, FileText, Archive } from 'lucide-react';
import type { IHubStatsProps } from './hub-stats.type';

export const HubStats = ({ stats }: IHubStatsProps) => {
  const defaultStats = [
    {
      id: 'images',
      label: 'IMAGES',
      itemsCount: 543,
      usedSpace: '2.89 GB used',
      percentage: 28.9,
      icon: <ImageIcon className="size-5" />,
      iconBgColor: 'bg-red-50',
      iconColor: 'text-red-500',
      barColor: 'bg-red-500',
    },
    {
      id: 'videos',
      label: 'VIDEOS',
      itemsCount: 2,
      usedSpace: '333.79 MB used',
      percentage: 5.5,
      icon: <Clapperboard className="size-5" />,
      iconBgColor: 'bg-blue-50',
      iconColor: 'text-blue-500',
      barColor: 'bg-blue-500',
    },
    {
      id: 'documents',
      label: 'DOCUMENTS',
      itemsCount: 1235,
      usedSpace: '8.85 GB used',
      percentage: 65.4,
      icon: <FileText className="size-5" />,
      iconBgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      barColor: 'bg-emerald-500',
    },
    {
      id: 'other',
      label: 'OTHER',
      itemsCount: 226,
      usedSpace: '30.77 GB used',
      percentage: 75.2,
      icon: <Archive className="size-5" />,
      iconBgColor: 'bg-amber-50',
      iconColor: 'text-amber-500',
      barColor: 'bg-amber-500',
    },
  ];

  const displayStats = stats ?? defaultStats;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {displayStats.map((stat) => (
        <div
          key={stat.id}
          className="relative flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md"
        >
          {/* Top Row: Icon (Left) & Label (Right) */}
          <div className="flex items-center justify-between">
            <div className={`flex size-10 items-center justify-center rounded-xl ${stat.iconBgColor} ${stat.iconColor}`}>
              {stat.icon}
            </div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {stat.label}
            </span>
          </div>

          {/* Middle Row: Items Count */}
          <div className="mt-4 flex flex-col gap-1">
            <span className="text-xl font-extrabold text-slate-800">
              {stat.itemsCount} Items
            </span>
          </div>

          {/* Bottom Row: Progress Bar & Space Used */}
          <div className="mt-4 flex flex-col gap-2">
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${stat.barColor}`}
                style={{ width: `${stat.percentage}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              {stat.usedSpace}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

};
