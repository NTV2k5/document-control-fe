import { FileEdit, ShieldAlert, KeyRound } from 'lucide-react';
import type { IRecentActivityProps, IRecentActivityItem } from '../profile.type';

const DEFAULT_ACTIVITIES: IRecentActivityItem[] = [
  {
    id: '1',
    type: 'document',
    title: 'Updated "Enrollment_Form_V2"',
    timestamp: '2 hours ago • Document',
    iconName: 'document',
  },
  {
    id: '2',
    type: 'security',
    title: 'Login from New Device',
    timestamp: 'Yesterday at 10:45 AM • Security',
    iconName: 'shield',
  },
  {
    id: '3',
    type: 'security',
    title: 'Password Changed',
    timestamp: 'Oct 24, 2025 • Security',
    iconName: 'lock',
  },
];

export const RecentActivity = ({ activities = DEFAULT_ACTIVITIES }: Partial<IRecentActivityProps>) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'document':
        return <FileEdit className="size-3.5 text-white" />;
      case 'shield':
        return <ShieldAlert className="size-3.5 text-white" />;
      case 'lock':
      default:
        return <KeyRound className="size-3.5 text-white" />;
    }
  };

  const getBadgeBg = (iconName: string) => {
    switch (iconName) {
      case 'document':
        return 'bg-[#1B59F8]';
      case 'shield':
        return 'bg-[#10B981]';
      case 'lock':
      default:
        return 'bg-[#F59E0B]';
    }
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col h-full">
      <h3 className="text-base font-bold text-slate-800 mb-6">Recent Activity</h3>

      {/* Timeline wrapper */}
      <div className="relative flex-1 pl-7 border-l border-slate-100/80 ml-3.5 py-1 space-y-6">
        {activities.map((activity) => (
          <div key={activity.id} className="relative group">
            {/* Timeline solid dot */}
            <div
              className={`absolute -left-[42px] top-0 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm transition-transform group-hover:scale-105 ${getBadgeBg(activity.iconName)}`}
            >
              {getIcon(activity.iconName)}
            </div>

            {/* Timeline content */}
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                {activity.title}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-1">
                {activity.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer link */}
      <div className="mt-8 text-center border-t border-slate-50 pt-4">
        <button
          type="button"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-all"
          onClick={() => alert('Viewing all activity logs...')}
        >
          View All Logs
        </button>
      </div>
    </div>
  );
};
