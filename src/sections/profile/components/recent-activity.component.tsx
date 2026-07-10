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
        return <FileEdit className="size-3.5 text-blue-600" />;
      case 'shield':
        return <ShieldAlert className="size-3.5 text-emerald-600" />;
      case 'lock':
      default:
        return <KeyRound className="size-3.5 text-amber-500" />;
    }
  };

  const getBadgeColor = (iconName: string) => {
    switch (iconName) {
      case 'document':
        return 'bg-blue-100 border-blue-200';
      case 'shield':
        return 'bg-emerald-100 border-emerald-200';
      case 'lock':
      default:
        return 'bg-amber-100 border-amber-200';
    }
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col h-full">
      <h3 className="text-base font-bold text-slate-800 mb-6">Recent Activity</h3>

      {/* Timeline */}
      <div className="relative flex-1 space-y-6 pl-4 border-l-2 border-slate-100 ml-4 py-2">
        {activities.map((activity, idx) => (
          <div key={activity.id} className="relative group">
            {/* Timeline dot */}
            <div
              className={`absolute -left-[27px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white ${getBadgeColor(activity.iconName)} shadow-sm transition-transform group-hover:scale-110`}
            >
              {getIcon(activity.iconName)}
            </div>

            {/* Timeline content */}
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                {activity.title}
              </span>
              <span className="text-[10px] text-slate-400 font-medium mt-1">
                {activity.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer link */}
      <div className="mt-6 text-center border-t border-slate-50 pt-4">
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
