import type { ITicketStatsProps } from '../ticket.type';
import {
  Ticket,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  layers: <Ticket className="size-5" strokeWidth={2.5} />,
  user: <User className="size-5" strokeWidth={2.5} />,
  clock: <Clock className="size-5" strokeWidth={2.5} />,
  'alert-triangle': <AlertTriangle className="size-5" strokeWidth={2.5} />,
  'check-circle': <CheckCircle className="size-5" strokeWidth={2.5} />,
};

const colorMap: Record<string, { iconBg: string; text: string; border: string; activeBorder: string; activeRing: string }> = {
  blue: {
    iconBg: 'bg-blue-100 text-blue-900',
    text: 'text-slate-800',
    border: 'border-slate-200 hover:bg-slate-50/50',
    activeBorder: 'border-blue-500 shadow-md',
    activeRing: 'ring-blue-100',
  },
  yellow: {
    iconBg: 'bg-amber-100 text-amber-900',
    text: 'text-slate-800',
    border: 'border-slate-200 hover:bg-slate-50/50',
    activeBorder: 'border-amber-500 shadow-md',
    activeRing: 'ring-amber-100',
  },
  orange: {
    iconBg: 'bg-orange-100 text-orange-900',
    text: 'text-slate-800',
    border: 'border-slate-200 hover:bg-slate-50/50',
    activeBorder: 'border-orange-500 shadow-md',
    activeRing: 'ring-orange-100',
  },
  red: {
    iconBg: 'bg-red-100 text-red-900',
    text: 'text-slate-800',
    border: 'border-slate-200 hover:bg-slate-50/50',
    activeBorder: 'border-red-500 shadow-md',
    activeRing: 'ring-red-100',
  },
  green: {
    iconBg: 'bg-emerald-100 text-emerald-900',
    text: 'text-slate-800',
    border: 'border-slate-200 hover:bg-slate-50/50',
    activeBorder: 'border-emerald-500 shadow-md',
    activeRing: 'ring-emerald-100',
  },
};

export const TicketStats = ({ stats, activeFilter, onFilterClick }: ITicketStatsProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => {
        const colors = colorMap[stat.color] || colorMap.blue;
        const isActive = activeFilter === stat.key;

        return (
          <button
            key={stat.key}
            onClick={() => onFilterClick(isActive ? '' : stat.key)}
            className={`flex flex-col items-start gap-2.5 rounded-xl border bg-white p-4 text-left transition-all duration-200 shadow-sm ${
              isActive ? `${colors.activeBorder} ring-2 ring-offset-1 ${colors.activeRing}` : `${colors.border}`
            }`}
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${colors.iconBg}`}>
              {iconMap[stat.icon]}
            </div>
            <div className="min-w-0">
              <div className={`text-2xl font-bold ${colors.text}`}>{stat.value}</div>
              <div className="text-xs font-semibold text-slate-800">{stat.label}</div>
              {stat.subLabel && (
                <div className="mt-0.5 text-[10px] text-slate-400">{stat.subLabel}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

